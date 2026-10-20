import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {sha,fixture} from '../src/evidence/senate-864-three-bounded-evidence.mjs';
import {VERSION,REPORT,committeeMeta,productionPlan,committeePlan,mediaPlan,financePlan} from '../src/evidence/senate-864-three-bounded-plan.mjs';
import {READ_QUERIES,readOnly,privateSnapshot,applyProduction,verifyPreserved} from '../scripts/deploy-senate-864-three-bounded.mjs';
import {verifyThreeBoundedOriginals} from '../scripts/verify-senate-864-three-bounded-originals.mjs';
import {SF1_INSERT_EVENT,SF1_INSERT_CHOICE} from '../src/evidence/senate-864-sf1-repair.ts';
const norm=s=>s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
test('new private read scope is SELECT-only, bounded and original/session/recipient restricted',()=>{
 assert.equal(READ_QUERIES.length,13);
 for(const q of READ_QUERIES){assert.match(q,/^SELECT /);assert.match(q,/LIMIT \d+/);assert.doesNotMatch(q,/\b(?:UPDATE|INSERT|DELETE|ALTER|CREATE|TRUNCATE|GRANT)\b/i);}
 const writer=readFileSync('scripts/deploy-senate-864-three-bounded.mjs','utf8');
 assert.doesNotMatch(writer,/UPDATE evidence_items|UPDATE cfb_official|DELETE FROM|TRUNCATE TABLE/);
 assert.match(writer,/ISOLATION LEVEL SERIALIZABLE/);assert.match(writer,/state\(await privateSnapshot/);
});
test('read-only identity failures always explicitly rollback without source row output',async()=>{
 const calls=[],pool={connect:async()=>({query:async q=>{calls.push(q);return {rows:[{db:'wrong',role:'wrong',ro:'off',isolation:'read committed'}]}},release(){}})};
 await assert.rejects(()=>readOnly(pool,{database:'expected',role:'expected'},{}),/identity/);
 assert.equal(calls.at(-1),'ROLLBACK');assert.equal(calls.some(x=>/^(INSERT|UPDATE)/.test(x)),false);
});
test('source proof and missing report snapshots fail closed',()=>{
 assert.throws(()=>committeePlan({documents:[]},{}),/fixture/);
 assert.throws(()=>financePlan({finance:{}},{versions:[]}),/version/);
 assert.throws(()=>mediaPlan({media:{pins:[{}],verifiedVersions:0}},{}),/clock/);
});
async function seed(db,proof){
 const put=async(sql,params=[])=>{const r=await db.query(sql,params);return r.rows[0]?.id;};
 const j=await put("INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US') RETURNING id");
 const c=await put("INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Senate','upper') RETURNING id",[j]);
 const sessions={};for(const slug of ['2021-2022','2023-2024','2025-2026'])sessions[slug]=await put('INSERT INTO legislative_sessions(jurisdiction_id,slug,name) VALUES($1,$2,$2) RETURNING id',[j,slug]);
 const people=new Map(),members=new Map(),bills=new Map();
 const member=async(name,slug)=>{const key=slug+name;if(members.has(key))return members.get(key);let l=people.get(name);if(!l){l=await put('INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,$3,$4) RETURNING id',[j,sha(name),name,norm(name)]);people.set(name,l);}const m=await put("INSERT INTO memberships(session_id,chamber_id,legislator_id,district,party,title,starts_on,ends_on) VALUES($1,$2,$3,'1','TEST','Senator',$4,$5) RETURNING id",[sessions[slug],c,l,slug.slice(0,4)+'-01-01',slug.slice(5)+'-12-31']);members.set(key,m);return m;};
 await member('Jeremy R. Miller','2021-2022');
 for(const [di,d] of proof.documents.entries()){
  const slug=d.year===2024?'2023-2024':'2025-2026';for(const name of d.people)await member(name,slug);
  const source=await put("INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,metadata) VALUES($1,$2,$3,'senate_committee_minutes',$4,$5,$6) RETURNING id",[j,sessions[slug],c,d.sourceUrl,d.originalRawPdfSha256,JSON.stringify({meetingDate:d.meetingDate,committeeName:d.committeeName})]);
  for(const [mi,m] of d.motions.entries()){
   const bid=m.question.match(/^SF\d+/)[0],bk=slug+bid;
   if(!bills.has(bk))bills.set(bk,await put('INSERT INTO bills(session_id,originating_chamber_id,identifier,title) VALUES($1,$2,$3,$3) RETURNING id',[sessions[slug],c,bid]));
   if(![[0,2],[0],[0],[0,1,2]][di].includes(mi))continue;
   const kind=m.question.includes('recommendation')?'motion':'amendment',ref=kind==='motion'?null:m.question.slice(bid.length+1),meta=committeeMeta(d,m);
   const e=(await db.query(SF1_INSERT_EVENT,[sessions[slug],c,bills.get(bk),source,'original-key-'+di+'-'+mi,kind,m.literal,ref,d.meetingDate,m.yea,m.nay,m.passed,JSON.stringify(meta)])).rows[0].id;
   for(const [i,v] of m.choices.entries()){const name=d.people.find(p=>norm(p).endsWith(norm(v.token)));await db.query(SF1_INSERT_CHOICE,[e,members.get(slug+name),v.token,norm(v.token),v.choice,i,JSON.stringify({legacy:true})]);}
  }
 }
 const r=proof.finance.report;
 await db.query(`INSERT INTO cfb_official_senate_pdf_versions(report_version_id,committee_registration,report_year,official_viewer_url,full_original_pdf_sha256,full_original_pdf_bytes,board_received_on,report_due_on,statutory_release_floor_on,estimated_available_on,website_observed_on,dating_method,dating_confidence) VALUES($1,'16891',2024,$2,$3,$4,'2025-01-09','2025-01-31','2025-02-01','2025-02-01','2026-10-15','pdf_board_stamp_with_statutory_floor','medium')`,[REPORT,r.url,r.sha,r.bytes]);
 await db.query('INSERT INTO cfb_finance_pdf_body_captures(pdf_sha256,byte_length,original_pdf,verified_from_url,fetched_at) VALUES($1,$2,$3,$4,now())',[r.sha,r.bytes,Buffer.from(proof.finance.originalPdf),r.url]);
 await db.query("INSERT INTO cfb_finance_report_schedule_captures(report_version_id,pdf_sha256,fetched_at,page_count,raw_schedule_text,extraction_status) VALUES($1,$2,now(),6,'source-body-authenticated','machine_readable')",[REPORT,r.sha]);
 for(let i=1;i<=6;i++)await db.query("INSERT INTO cfb_finance_report_schedule_pages(pdf_sha256,page_number,raw_page_text) VALUES($1,$2,'fixture page; original bytes independently authenticated')",[r.sha,i]);
 const sources={};for(const family of ['contribution','expenditure'])sources[family]=await put("INSERT INTO source_documents(jurisdiction_id,source_kind,source_url,content_sha256) VALUES($1,$2,$3,$4) RETURNING id",[j,'campaign_finance_candidate_'+family+'_bulk','https://example.invalid/'+family,sha(family)]);
 let expense=0;
 for(const [i,row] of proof.finance.rows.entries()){
  const exp=row.schedule==='CE',m={rowKey:sha('synthetic-canonical-'+i),subtype:'candidate_'+(exp?'expenditure':'contribution')+'_record',filerRegistrationNumber:'16891',year:2024,transactionDate:row.date,amount:row.cents/100,asOfEligible:true};
  if(exp)Object.assign(m,{vendorName:row.party,purpose:row.purpose+(expense++>=7?' deliberately different purpose':''),expenditureType:'Campaign Expenditure',unpaidAmount:row.unpaid/100,totalAmount:row.total/100});
  else Object.assign(m,{contributor:row.party,contributorRegistrationNumber:row.registration,contributorType:row.schedule==='IND'?'Individual':'Political Committee',receiptType:'Contribution'});
  await db.query("INSERT INTO evidence_items(source_document_id,evidence_kind,claim,source_quality,relevance,freshness,extraction_method,metadata) VALUES($1,'fact','synthetic integration fixture','official','low','stale','test',$2)",[sources[exp?'expenditure':'contribution'],JSON.stringify(m)]);
 }
}
test('actual migrated PostgreSQL: 12/144 additions, three media, 25 links, preservation, rejection and zero-write replay',{skip:!process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL,timeout:360000},async()=>{
 const {Client,Pool}=await import('pg'),url=new URL(process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL),admin=new Client({connectionString:url.toString()}),name='senate864_production_test_'+process.pid;
 await admin.connect();let pool,phase='database_setup';
 try{
  await admin.query('CREATE DATABASE '+name);url.pathname='/'+name;
  execFileSync(process.execPath,['--import','tsx','scripts/migrate.ts'],{env:{...process.env,DATABASE_URL_UNPOOLED:url.toString()},stdio:'pipe',timeout:60000});
  pool=new Pool({connectionString:url.toString(),max:1});const db=await pool.connect();let target;
  phase='fresh_originals';const proof=await verifyThreeBoundedOriginals();phase='seed';
  try{await seed(db,proof);target=(await db.query('SELECT current_database() AS database,current_user AS role')).rows[0];}finally{db.release()}
  phase='read_and_plan';const before=(await readOnly(pool,target,proof)).snapshot,plan=productionPlan(proof,before);
  assert.equal(plan.committee.add.length,12);assert.equal(plan.committee.add.flatMap(p=>p.votes).length,144);assert.equal(plan.media.filter(p=>!p.stored).length,3);assert.equal(plan.finance.filter(p=>!p.stored).length,25);
  const bad=structuredClone(before);bad.roster.find(p=>p.name==='Ron Latz').ends_on=null;assert.throws(()=>productionPlan(proof,bad),/Historical/);
  const wrong=structuredClone(before);wrong.choices[0].choice='other';assert.throws(()=>productionPlan(proof,wrong),/choices/);
  const shared=structuredClone(before);shared.finance[0].metadata.contributor='not the printed donor';assert.throws(()=>productionPlan(proof,shared),/comparator/);
  phase='atomic_apply';const counts=await applyProduction(pool,proof,before);assert.equal(counts.insertedEvents,12);assert.equal(counts.insertedChoices,144);assert.equal(counts.insertedMedia,3);assert.equal(counts.insertedFinanceLinks,25);
  phase='independent_readback';const after=(await readOnly(pool,target,proof)).snapshot;verifyPreserved(before,after);assert.equal(after.events.length,19);assert.equal(after.choices.length,211);assert.equal(after.links.length,25);assert.equal(after.media.filter(r=>r.kind).length,3);
  phase='replay_and_negative_guards';const replay=await applyProduction(pool,proof,after);assert.equal(Object.values(replay).reduce((a,b)=>a+b,0),0);
  const backdate=structuredClone(after);backdate.media[0].published_at='2021-11-08T00:00:00Z';assert.throws(()=>productionPlan(proof,backdate),/Media stored/);
  const purpose=structuredClone(after);purpose.finance.find(r=>r.metadata.subtype==='candidate_expenditure_record').metadata.purpose='wrong';assert.throws(()=>productionPlan(proof,purpose),/comparator/);
  const drift=structuredClone(after);drift.choices[0].metadata={changed:true};assert.throws(()=>verifyPreserved(before,drift),/choice/);
  // Drift between the read-only snapshot and SERIALIZABLE lock must rollback.
  const c=await pool.connect();try{await c.query("UPDATE evidence_items SET metadata=metadata||'{\"concurrentChange\":true}'::jsonb WHERE id=$1",[before.finance[0].id]);}finally{c.release()}
  await assert.rejects(()=>applyProduction(pool,proof,before),/Concurrent state/);
  const final=(await readOnly(pool,target,proof)).snapshot;assert.equal(final.events.length,19);assert.equal(final.links.length,25);
 }catch{throw Error('Disposable PostgreSQL production test failed at '+phase)}finally{if(pool)await pool.end();await admin.query('DROP DATABASE IF EXISTS '+name+' WITH (FORCE)');await admin.end()}
});
