import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractRowRollQuestions,resolvePrintedHistoricalChoices,reconcileRowQuestion,sha} from '../src/evidence/senate-864-population-named-rolls.mjs';
import {freshOriginals,planSource,runProduction} from '../scripts/deploy-senate-864-population-row-rolls.mjs';
import {buildHeldTriage} from '../scripts/triage-senate-864-held-rows.mjs';
const fixture=JSON.parse(readFileSync('tests/fixtures/senate-864-population-explicit-labels.json'));
const clerk=fixture.sourceDocuments.find(d=>d.format==='html'),pdf=fixture.sourceDocuments.find(d=>d.format==='pdf');
const sourceFixture=()=>freshOriginals(async url=>fixture.sourceDocuments.find(d=>d.url===url).text,'labels');
const questions=(source,text=source.text)=>extractRowRollQuestions(text,source);
test('original yay/yays rows are explicit choices, Pass is excluded, and printed totals and outcome agree',()=>{
 assert.equal(sha(clerk.text),clerk.sha256);assert.equal(sha(pdf.text),pdf.textSha256);
 const a=questions(clerk);assert.equal(a.length,1);assert.equal(a[0].confidence,'source_proven_question');
 assert.deepEqual([a[0].billIdentifier,a[0].amendmentRef,a[0].yea,a[0].nay,a[0].passed,a[0].excludedOtherLabels],['SF2051','A2',5,8,false,1]);
 const b=questions(pdf);assert.equal(b.length,3);assert.ok(b.every(q=>q.confidence==='source_proven_question'));
 assert.deepEqual(b.map(q=>[q.amendmentRef,q.yea,q.nay,q.passed]),[['A25',6,8,false],['A28',6,8,false],[null,8,6,true]]);
 assert.ok(a[0].choices.every(v=>!/Bahr/.test(v.name)),'Pass never becomes yea/nay');
 const roster=fixture.roster.map((m,i)=>({...m,membership_id:'m'+i}));
 assert.equal(resolvePrintedHistoricalChoices(a[0],clerk.text,roster,clerk).length,13);
});
test('missing rows, unknown label, disagreeing tally, ambiguous result and expired historical identity stay held',()=>{
 for(const text of [clerk.text.replace('Senator Koran - yay','Senator Koran - maybe'),clerk.text.replace('Senator Koran - yay',''),clerk.text.replace('5 yays, 8 nays','6 yays, 8 nays'),clerk.text.replace('the motion failed','the motion failed and the motion prevailed')]){
  assert.ok(!questions(clerk,text).some(q=>q.confidence==='source_proven_question'));
 }
 const q=questions(clerk)[0];
 assert.throws(()=>resolvePrintedHistoricalChoices(q,clerk.text,fixture.roster.map(m=>({...m,ends_on:'2023-01-01'})),clerk));
});
test('Absence row preserves a complete PDF roll without supplying an inferred vote',()=>{
 const inventory=JSON.parse(readFileSync(planSource('labels').sourceInventoryInput.path));
 const d=inventory.originals.find(d=>d.date==='2023-01-17'&&d.committee==='Elections'&&d.format==='pdf');
 const q=extractRowRollQuestions(d.candidateOriginalExtractedText,{date:d.date,committee:d.committee,session_slug:d.session})[0];
 assert.equal(q.confidence,'source_proven_question');assert.equal(q.excludedOtherLabels,1);assert.equal(q.choices.length,13);assert.ok(!q.choices.some(v=>v.name==='Port'));
});
test('frozen 233-original triage preserves label proofs and admits only the separately reviewed renewal',()=>{
 const r=buildHeldTriage();assert.equal(r.examinedCandidateOriginals,233);assert.equal(r.heldOccurrencesBefore,56);assert.equal(r.heldOccurrencesAfter,40);
 assert.equal(r.newlyProvenSourceWitnesses.length,8);assert.equal(r.newlyProvenSourceWitnesses.filter(q=>q.alreadyProvenFromAnotherOriginal).length,5);
 assert.deepEqual(new Set(r.newDistinctQuestionKeys.map(q=>q.questionKey)),new Set([planSource('labels').questions[0].questionKey,planSource('renewal').questions[0].questionKey]));
 assert.equal(r.newDistinctQuestionKeys.reduce((n,q)=>n+q.choices,0),27);
 assert.equal(r.coverageByYear.reduce((n,r)=>n+r.ocrVisualQualityUncertified,0),247);
 assert.equal(r.heldOccurrences.length,Object.values(r.primaryCausesAfter).reduce((a,b)=>a+b,0));
});
test('exact question on a different source is held and never inserted as a duplicate',()=>{
 const q=questions(pdf)[0],d={...pdf,id:'pdf',session_id:'s',chamber_id:'senate'};
 const roster=fixture.roster.map((m,i)=>({...m,membership_id:'m'+i})),choices=resolvePrintedHistoricalChoices(q,pdf.text,roster,pdf);
 const event={id:'accepted-clerk',source_document_id:'clerk',occurred_on:pdf.date,session_slug:pdf.session_slug,session_id:'s',chamber_id:'senate',bill_identifier:'SF1636',motion_text:q.motionText,vote_kind:q.voteKind,amendment_ref:q.amendmentRef,passed:q.passed,yea_count:q.yea,nay_count:q.nay,is_passage:false};
 const result=reconcileRowQuestion(q,d,{roster,events:[event],choices:choices.map(v=>({vote_event_id:event.id,membership_id:v.membershipId,choice:v.choice}))});
 assert.equal(result.status,'different_source_identity');assert.equal(result.missingChoices,0);assert.equal(result.classification,false);
});
test('independent source-only profile rejects drift and remains bounded to one complete question / 13 choices',async()=>{
 const o=await sourceFixture();assert.equal(o.docs.length,1);assert.equal(o.pins.expectedQuestions,1);assert.equal(o.pins.expectedChoices,13);
 await assert.rejects(freshOriginals(async()=>clerk.text+' changed','labels'));
});
test('disposable PostgreSQL: add one event / 13 choices, preserve unrelated accepted data, then replay zero writes',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;if(!url)return t.skip('CI supplies disposable database');
 const parsed=new URL(url);assert.ok(['localhost','127.0.0.1'].includes(parsed.hostname));
 const {Pool}=await import('pg'),{randomUUID}=await import('node:crypto');
 const admin=new Pool({connectionString:url,max:1}),schema='explicit_labels_'+randomUUID().replaceAll('-','');let pool;
 try{
  await admin.query('CREATE SCHEMA '+schema);
  for(const table of ['jurisdictions','chambers','legislative_sessions','legislators','memberships','membership_source_aliases','bills','source_documents','vote_events','member_votes','votepredict_schema_migrations'])await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
  await admin.query(`INSERT INTO ${schema}.votepredict_schema_migrations SELECT * FROM public.votepredict_schema_migrations`);
  pool=new Pool({connectionString:url,max:1,options:'-c search_path='+schema+',public'});
  const one=async(sql,args=[])=> (await pool.query(sql,args)).rows[0];
  const j=(await one("INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US') RETURNING id")).id;
  const c=(await one("INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Senate','upper') RETURNING id",[j])).id;
  const s=(await one("INSERT INTO legislative_sessions(jurisdiction_id,slug,name) VALUES($1,'2023-2024','Fixture') RETURNING id",[j])).id;
  const members=[];
  for(const [i,m]of fixture.roster.entries()){
   const l=(await one('INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,$3,lower($3)) RETURNING id',[j,'label-fixture-'+i,m.name])).id;
   members.push((await one("INSERT INTO memberships(session_id,chamber_id,legislator_id,district,party,title,starts_on,ends_on) VALUES($1,$2,$3,$4,'DFL','Senator',$5,$6) RETURNING id",[s,c,l,String(i+1),m.starts_on,m.ends_on])).id);
  }
  const bill=(await one("INSERT INTO bills(session_id,originating_chamber_id,identifier,title) VALUES($1,$2,'SF2051','Fixture') RETURNING id",[s,c])).id;
  const d=(await one("INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,http_status,metadata) VALUES($1,$2,$3,'senate_committee_minutes_html',$4,$5,200,$6::jsonb) RETURNING id",[j,s,c,clerk.url,clerk.sha256,JSON.stringify({meetingDate:clerk.date,committeeName:clerk.committee})])).id;
  const sentinel=(await one("INSERT INTO vote_events(session_id,chamber_id,bill_id,source_document_id,external_key,vote_kind,motion_text,amendment_ref,occurred_on,yea_count,nay_count,passed,is_passage,metadata) VALUES($1,$2,$3,$4,'accepted-preserved','amendment','Senator Rest moved the A1 Author amendment.','A1','2023-03-07',0,1,false,false,$5::jsonb) RETURNING id",[s,c,bill,d,JSON.stringify({committeeVote:true,committeeName:'Elections'})])).id;
  await one("INSERT INTO member_votes(vote_event_id,membership_id,source_member_name,normalized_member_name,choice) VALUES($1,$2,$3,lower($3),'nay') RETURNING id",[sentinel,members[0],fixture.roster[0].name]);
  const o=await sourceFixture(),target={database:parsed.pathname.slice(1),role:decodeURIComponent(parsed.username)};
  const first=await runProduction(pool,target,o);assert.equal(first.insertedEvents,1);assert.equal(first.insertedChoices,13);assert.equal(first.correctedClassifications,0);assert.equal(first.verifiedExact,1);assert.equal(first.verifiedChoices,13);assert.equal(first.existingEventIdsAndChoicesPreserved,true);
  const replay=await runProduction(pool,target,o);assert.equal(replay.insertedEvents,0);assert.equal(replay.insertedChoices,0);assert.equal(replay.correctedClassifications,0);assert.equal(replay.zeroWriteReplay,true);
 }finally{if(pool)await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();}
});
