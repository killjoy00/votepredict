import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {Pool} from 'pg';
import {assertEvidenceRepairRun} from '../src/operations/senate-evidence-repair-gate.js';
import {backfillJournalAuthorEvents,backfillScorecardContentObservations} from '../src/operations/senate-evidence-repair.js';
import {runSenateEvidenceLinkBackfill} from '../src/operations/senate-identity-bill-backfill.js';

test('repair runs require reviewed main, first attempt, exact protected workflow and trigger',()=>{
 const env={NODE_ENV:'test' as const,GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'push',
   GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ATTEMPT:'1',
   GITHUB_WORKFLOW_REF:'killjoy00/votepredict/.github/workflows/senate-evidence-repair-production.yml@refs/heads/main',
   VOTEPREDICT_SENATE_EVIDENCE_REPAIR_INDEPENDENT_CI:'true'};
 const event={ref:'refs/heads/main',after:env.GITHUB_SHA,repository:{full_name:env.GITHUB_REPOSITORY,default_branch:'main'},
   head_commit:{id:env.GITHUB_SHA,message:'SENATE_EVIDENCE_REPAIR_PRODUCTION'}};
 assert.doesNotThrow(()=>assertEvidenceRepairRun(env,event));
 for(const patch of [{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_EVENT_NAME:'workflow_dispatch'},
   {GITHUB_REF:'refs/heads/topic'},{GITHUB_WORKFLOW_REF:'other'},
   {VOTEPREDICT_SENATE_EVIDENCE_REPAIR_INDEPENDENT_CI:'false'}])
   assert.throws(()=>assertEvidenceRepairRun({...env,...patch},event));
 assert.throws(()=>assertEvidenceRepairRun(env,{...event,forced:true}));
 assert.throws(()=>assertEvidenceRepairRun(env,{...event,head_commit:undefined}));
 assert.doesNotThrow(()=>assertEvidenceRepairRun({...env,GITHUB_EVENT_NAME:'schedule'},
   {repository:event.repository,schedule:'23 * * * *'}));
 assert.throws(()=>assertEvidenceRepairRun({...env,GITHUB_EVENT_NAME:'schedule'},
   {repository:event.repository,schedule:'* * * * *'}));
});

test('archive proofs require exact original body, and SQL failures cannot become source unavailability',async()=>{
 const body=Buffer.from('publisher original bytes'),hash=createHash('sha256').update(body).digest('hex');
 const writes:Array<{sql:string;args:unknown}>=[];
 const mock={query:async(sql:string,args:unknown)=>{
   if(sql.startsWith('SELECT'))return {rows:[{id:randomUUID(),url:'https://example.test/2023.pdf',sha256:hash}]};
   writes.push({sql,args});return {rows:[]};
 }} as unknown as Pool;
 const fetcher=(bytes:Buffer)=>(async(url:string|URL|Request)=>String(url).includes('/cdx/')
   ?new Response(JSON.stringify([['timestamp','statuscode'],['20230715120000','200']]))
   :new Response(new Uint8Array(bytes))) as typeof fetch;
 const wrong=await backfillScorecardContentObservations(mock,{fetchImpl:fetcher(Buffer.from('revised bytes')),sleep:async()=>{}});
 assert.equal(wrong.verified,0);assert.equal(wrong.mismatch,1);
 assert.equal(writes.filter(w=>w.sql.includes('INSERT INTO senate_scorecard_content_observations')).length,0);
 const good=await backfillScorecardContentObservations(mock,{fetchImpl:fetcher(body),sleep:async()=>{}});
 assert.equal(good.verified,1);
 const failing={query:async(sql:string)=>{if(sql.startsWith('SELECT'))return {rows:[{id:randomUUID(),url:'https://example.test/2023.pdf',sha256:hash}]};
   throw Error('database-write-failure');}} as unknown as Pool;
 await assert.rejects(backfillScorecardContentObservations(failing,{fetchImpl:fetcher(body),sleep:async()=>{}}),/database-write-failure/);
});

/** Shared by disposable Postgres CI and an optional in-process local SQL check. */
export async function exerciseRepair(pool:Pool){
 const tag='repair'+randomUUID().replace(/[^a-f]/g,'').slice(0,12),url='https://example.test/'+tag;
 const one=async(sql:string,args:unknown[]=[]) => (await pool.query(sql,args)).rows[0];
 const juris=(await one(`INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US')
   ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`)).id;
 const chamber=(await one(`INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Senate','upper')
   ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,[juris])).id;
 const sessions:Record<string,string>={},members:Record<string,string>={};
 for(const slug of ['2021-2022','2023-2024','2025-2026']){
   sessions[slug]=(await one(`INSERT INTO legislative_sessions(jurisdiction_id,slug,name,starts_on,ends_on)
     VALUES($1,$2,$2,$3,$4) ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
     [juris,slug,slug.slice(0,4)+'-01-01',slug.slice(5)+'-12-31'])).id;
 }
 let person='';
 for(let i=0;i<40;i++){
   const name=i===0?tag+' Alpha':tag+' Member'+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26);
   const l=(await one(`INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,$3,lower($3)) RETURNING id`,[juris,tag+i,name])).id;
   if(i===0)person=l;
   for(const [slug,session] of Object.entries(sessions)){
     const m=(await one(`INSERT INTO memberships(legislator_id,session_id,chamber_id,district,party,title,starts_on,ends_on)
       VALUES($1,$2,$3,$4,'Fixture','Senator',$5,$6) RETURNING id`,[l,session,chamber,String(i+1),slug.slice(0,4)+'-01-01',slug.slice(5)+'-12-31'])).id;
     if(i===0)members[slug]=m;
   }
 }
 const session=sessions['2023-2024'],member=members['2023-2024'];
 const bill=(await one(`INSERT INTO bills(session_id,originating_chamber_id,identifier,title,introduced_at)
   VALUES($1,$2,$3,'repair fixture','2023-02-01') RETURNING id`,[session,chamber,'SF'+(100000+Number.parseInt(tag.slice(-5),16)%800000)])).id;
 const identifier=(await one('SELECT identifier FROM bills WHERE id=$1',[bill])).identifier;
 const number=identifier.slice(2);
 const source=async(path:string,raw:unknown={})=>(await one(`INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,metadata)
   VALUES($1,$2,$3,'repair_fixture',$4,$5,$6::jsonb) RETURNING id`,[juris,session,chamber,url+path,'a'.repeat(64),JSON.stringify(raw)])).id;
 const introSource=await source('/intro');
 await pool.query(`INSERT INTO senate_bill_introduction_authors(bill_id,session_id,author_order,name_raw,membership_id,match_method,introduced_on,source_document_id,source_url)
   VALUES($1,$2,1,$3,$4,'exact','2023-02-01',$5,$6)`,[bill,session,tag+' Alpha',member,introSource,url+'/intro']);
 const journalSources:string[]=[];
 for(const [date,operation] of [['2023-03-10','added'],['2023-05-20','stricken']]){
   const text=`Senator ${tag} Alpha was ${operation} as a chief author to S.F. No. ${number}.`;
   journalSources.push(await source('/journal-'+date,{rawPrepassageVotes:{sourceType:'mn_senate_journal',sessionSlug:'2023-2024',sourceDate:date,text,records:[]}}));
 }
 const pdf=await source('/recovered.pdf',{rawPrepassageVotes:{sourceType:'mn_senate_committee_minutes_pdf',sessionSlug:'2023-2024',sourceDate:'2023-04-01',
   text:'Public committee minutes with a named mover and a bill, preserved as printed.',records:[{ordinal:1,venue:'committee',method:'roll_call',voteKind:'committee_recommendation',billIdentifier:identifier,mover:tag+' Alpha',outcome:'passed',memberVotes:[{name:tag+' Alpha',choice:'yea'}]}]}});
 const press=(await one(`INSERT INTO senate_raw_statements(source_id,source_type,source_url,fetched_at,published_on,title,named_senators,bill_identifiers,raw_text)
   VALUES('fixture','fixture',$1,'2026-10-17','2023-03-01','Fixture headline',$2::text[],$3::text[],'Actual complete statement words') RETURNING id`,[url+'/press',[tag+' Alpha'],[identifier]])).id;
 const empty=(await one(`INSERT INTO senate_raw_statements(source_id,source_type,source_url,fetched_at,title,raw_text)
   VALUES('fixture','fixture',$1,'2026-10-17','No names','No identifiable mentions') RETURNING id`,[url+'/empty'])).id;
 const q=(await one(`INSERT INTO mn_senate_questionnaire_captures(source_id,publisher,source_kind,source_url,questionnaire_title,election_cycle,candidate_name,displayed_publication_on,displayed_submitted_on,fetched_at,content_type,content_sha256,raw_content,membership_id)
   VALUES('fixture','fixture','publisher_response',$1,'Title only',2022,$2,'2022-10-15','2022-10-01','2026-10-17','text/html',$3,'original body',$4) RETURNING id`,[url+'/qa',tag+' Alpha','b'.repeat(64),member])).id;
 await pool.query(`INSERT INTO mn_senate_questionnaire_qa(capture_id,question_ordinal,question_text,answer_text) VALUES($1,1,'Policy question','Actual answer')`,[q]);
 const challenger=(await one(`INSERT INTO mn_senate_questionnaire_captures(source_id,publisher,source_kind,source_url,questionnaire_title,election_cycle,candidate_name,fetched_at,content_type,content_sha256,raw_content)
   VALUES('fixture','fixture','publisher_response',$1,'Unlinked challenger',2026,'Another Person','2026-10-17','text/html',$2,'Challenger source') RETURNING id`,[url+'/challenger','f'.repeat(64)])).id;
 const snap=(await one(`INSERT INTO senate_scorecard_snapshots(url,group_name,year,fetched_at,sha256,content_type,raw_text,published_on)
   VALUES($1,'fixture',2023,'2026-10-17',$2,'application/pdf','score original','2023-05-01') RETURNING id`,[url+'/2023.pdf','c'.repeat(64)])).id;
 await pool.query(`INSERT INTO senate_scorecard_archive_dates(snapshot_id,url,url_names_year,first_captured_at,capture_url,result)
   VALUES($1,$2,true,'2023-06-01',$3,'captured')`,[snap,url+'/2023.pdf','https://web.archive.org/web/20230601000000/'+url+'/2023.pdf']);
 await pool.query(`INSERT INTO senate_scorecard_entries(group_name,year,kind,value_raw,name_raw,membership_id,snapshot_id,source_url,source_ordinal)
   VALUES('fixture',2023,'score','90',$1,$2,$3,$4,1)`,[tag+' Alpha',member,snap,url+'/score']);
 const roleSnap=(await one(`INSERT INTO senate_role_source_snapshots(session_id,source_url,fetched_at,source_session,source_date,content_type,raw_content,content_sha256)
   VALUES($1,$2,'2026-10-17','2023-2024','As of 2023-01-01','text/html','original role text',$3) RETURNING id`,[session,url+'/roles','d'.repeat(64)])).id;
 for(const [i,committee,role] of [[0,'Finance','Chair'],[1,null,'Majority Leader']] as const)
   await pool.query(`INSERT INTO senate_role_observations(session_id,source_snapshot_id,source_ordinal,membership_id,senator_name,role,committee,starts_on,ends_on,source_url,fetched_at,source_session,raw_content)
     VALUES($1,$2,$3,$4,$5,$6,$7,NULL,NULL,$8,'2026-10-17','2023-2024','Role words')`,[session,roleSnap,i,member,tag+' Alpha',role,committee,url+'/roles']);
 await pool.query(`INSERT INTO senate_official_bill_text_captures(session_id,bill_id,family,source_url,source_locator,printed_label,raw_text,original_body_sha256,body_hash_provenance,extracted_text_sha256,fetched_at,posted_on)
   VALUES($1,$2,'numbered_version',$3,'v0','Introduction','Actual full bill text',$4,'fetched_original_bytes',$4,'2026-10-17','2023-02-01')`,[session,bill,url+'/text','e'.repeat(64)]);
 const websiteSource=await source('/website');
 await pool.query(`INSERT INTO evidence_items(source_document_id,membership_id,evidence_kind,claim,excerpt,published_at,source_quality,relevance,freshness,extraction_method,extraction_version,metadata)
   VALUES($1,$2,'context','Website observation','Literal website words','2022-10-01','member_primary','low','stale','fixture','senate-864-literal-website-observed-asof-v1',$3::jsonb)`,[websiteSource,members['2021-2022'],JSON.stringify({experimentalWebsiteTextForHistoricalEvaluation:true,mechanicallyActionable:false,availabilityProof:'original_site_html_cdx_index_in_existing_research'})]);
 await runSenateEvidenceLinkBackfill(pool,10000);
 await backfillJournalAuthorEvents(pool);
 const rows=(await pool.query('SELECT * FROM senate_evidence_v WHERE bill_id=$1 OR source_url LIKE $2',[bill,url+'%'])).rows;
 const byType=(type:string)=>rows.filter(r=>r.evidence_type===type);
 assert.equal(byType('bill_chief_author')[0].observed_basis,'journal.introduction');
 assert.equal(byType('press_statement_member')[0].value_text,'Actual complete statement words');
 assert.match(byType('candidate_questionnaire')[0].value_text,/Actual answer/);
 for(const type of ['press_statement_member','candidate_questionnaire','scorecard_score','committee_role','leadership_role','bill_text_version'])
   assert.equal(new Date(byType(type)[0].observed_on).toISOString().slice(0,10),'2026-10-17',type);
 assert.equal(byType('bill_text_version')[0].value_text,'Actual full bill text');
 assert.equal((await one('SELECT count(*)::int AS n FROM senate_raw_vote_records_v WHERE source_document_id=$1',[pdf])).n,1);
 assert.equal((await one('SELECT membership_id FROM senate_raw_member_votes_v WHERE source_document_id=$1',[pdf])).membership_id,member);
 const before=(await pool.query('SELECT * FROM senate_evidence_asof($1,$2) WHERE bill_id=$3',['2023-05-20',member,bill])).rows;
 assert.equal(before.some(r=>r.evidence_type==='bill_author_removed'),false);
 assert.equal(before.some(r=>r.evidence_type==='bill_author_added'),true);
 assert.equal(before.some(r=>/press|questionnaire|scorecard|bill_text/.test(r.evidence_type)),false);
 const carry=(await pool.query("SELECT * FROM senate_evidence_asof('2023-01-01',$1) WHERE evidence_type='candidate_website_text' AND source_url=$2",[members['2025-2026'],url+'/website'])).rows;
 assert.equal(carry.length,1);
 assert.equal((await one("SELECT count(*)::int AS n FROM senate_evidence_asof('2027-01-01',$1) WHERE source_row=$2",[member,challenger])).n,0);
 assert.equal((await one('SELECT count(*)::int AS n FROM senate_evidence_link_receipts WHERE source_row=$1',[empty])).n,1);
 await pool.query(`INSERT INTO senate_scorecard_content_observations(snapshot_id,observed_at,archive_url,body_sha256)
   VALUES($1,'2023-07-15',$2,$3)`,[snap,'https://web.archive.org/web/20230715000000/'+url+'/2023.pdf','c'.repeat(64)]);
 const dated=(await one('SELECT observed_on::text FROM senate_scorecard_observed_v WHERE snapshot_id=$1',[snap])).observed_on;
 assert.equal(dated,'2023-07-15');
 const linkedBefore=await one('SELECT count(*)::int AS n FROM senate_statement_member_mentions WHERE statement_id=$1',[press]);
 await runSenateEvidenceLinkBackfill(pool,10000);
 assert.deepEqual(await one('SELECT count(*)::int AS n FROM senate_statement_member_mentions WHERE statement_id=$1',[press]),linkedBefore);
 assert.equal((await one('SELECT count(*)::int AS n FROM senate_author_journal_events WHERE bill_id=$1',[bill])).n,2);
 // A changed/reordered raw record cannot inherit an old positional identity.
 await pool.query(`UPDATE source_documents SET metadata=jsonb_set(metadata,
   '{rawPrepassageVotes,records,0,memberVotes,0,name}','"An Unresolved Different Person"'::jsonb) WHERE id=$1`,[pdf]);
 assert.equal((await one('SELECT membership_id FROM senate_raw_member_votes_v WHERE source_document_id=$1',[pdf])).membership_id,null);
 // Derived journal rows must not block an explicit source deletion or fixture replay.
 await pool.query('DELETE FROM source_documents WHERE id=ANY($1::uuid[])',[journalSources]);
 for(const table of ['senate_author_journal_events','senate_author_journal_event_scans'])
   assert.equal((await one(`SELECT count(*)::int AS n FROM ${table} WHERE source_document_id=ANY($1::uuid[])`,[journalSources])).n,0);
 assert.ok(person);
}

const connection=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const local=!!connection&&['localhost','127.0.0.1'].includes(new URL(connection).hostname);
test('real Postgres: strict clocks, full words, PDF/link parity, dated roles and person carry-forward',
 {skip:!local,timeout:90000},async()=>{
   // Global backfills must see only this fixture's catalog and pending queue.
   const schema='repair_contract_'+randomUUID().replaceAll('-','');
   const admin=new Pool({connectionString:connection,max:1});
   const pool=new Pool({connectionString:connection,max:3,options:'-c search_path='+schema+',public'});
   try{
     await admin.query('CREATE SCHEMA '+schema);
     for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())
       await pool.query(readFileSync('migrations/'+file,'utf8').replaceAll('public.',schema+'.'));
     await exerciseRepair(pool);
   }finally{await pool.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end()}
 });

test('repair is additive and official minute hearing dates remain intact',()=>{
 const sql=readFileSync('migrations/0034_senate_evidence_repair.sql','utf8');
 assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|DELETE FROM|UPDATE member_votes|UPDATE vote_events)\b/i);
 assert.match(sql,/r\.occurred_on,\s+'raw_vote.source_date'/);
 assert.match(sql,/e\.observed_on < cutoff/);
});
