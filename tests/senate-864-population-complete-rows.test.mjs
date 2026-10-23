import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractRowRollQuestions,resolvePrintedHistoricalChoices,reconcileRowQuestion,sha} from '../src/evidence/senate-864-population-named-rolls.mjs';
import {freshOriginals,planSource,correctionPlan,runProduction} from '../scripts/deploy-senate-864-population-row-rolls.mjs';
const fixture=JSON.parse(readFileSync('tests/fixtures/senate-864-population-complete-rows.json'));
const doc=source=>({...source,source_url:source.url,session_id:'session',chamber_id:'senate',authenticated:true});
const pdf=fixture.sourceDocuments.find(d=>d.format==='pdf'),clerk=fixture.sourceDocuments.find(d=>d.format==='html');
const sourceFixture=()=>freshOriginals(async url=>fixture.sourceDocuments.find(d=>d.url===url).text,'continuation',async({url})=>{
 const d=fixture.sourceDocuments.find(d=>d.url===url);return {text:d.text,contentSha256:d.sha256};
});
test('actual originals: six complete paginated amendment rolls and three role-prefixed coded amendment rolls',()=>{
 assert.equal(sha(pdf.text),pdf.textSha256);assert.equal(sha(clerk.text),clerk.sha256);
 const a=extractRowRollQuestions(pdf.text,doc(pdf)).filter(q=>q.confidence==='source_proven_question');
 assert.deepEqual(a.map(q=>q.amendmentRef),['A11','A16','A22','A13','A14','A15']);
 assert.deepEqual(a.map(q=>[q.yea,q.nay,q.excludedOtherLabels,q.passed]),[[6,7,1,false],[6,8,0,false],[7,6,1,true],[6,8,0,false],[6,8,0,false],[7,7,0,false]]);
 const b=extractRowRollQuestions(clerk.text,doc(clerk)).filter(q=>q.confidence==='source_proven_question');
 assert.deepEqual(b.map(q=>[q.billIdentifier,q.amendmentRef,q.voteKind,q.yea,q.nay,q.passed]),[['SF1426','A10','amendment',8,5,true],['SF1426','A28','amendment',8,5,true],['SF1426','A21','amendment',6,8,false]]);
 const roster=fixture.roster.map((m,i)=>({...m,membership_id:'m'+i}));
 for(const [source,questions]of [[pdf,a],[clerk,b]])for(const q of questions)assert.equal(resolvePrintedHistoricalChoices(q,source.text,roster,doc(source)).length,q.choices.length);
 assert.ok(!b[0].choices.some(v=>/Lang/.test(v.name)),'no vote inferred for a name absent from the printed roll');
});
test('page-number continuity is proved; mismatched footers, intervening motion text and unexplained numeric lines stop rows',()=>{
 const find=text=>extractRowRollQuestions(text,doc(pdf)).find(q=>q.amendmentRef==='A11');
 assert.equal(find(pdf.text).choices.length,13);
 for(const [from,to]of [['-- 1 of 4 --\n\n2','-- 1 of 4 --\n\n3'],['-- 1 of 4 --\n\n2','2'],['-- 1 of 4 --\n\n2','-- 1 of 4 --\n\n2\nSenator Carlson moved the A99 Amendment.']]){
  const altered=pdf.text.replace(from,to);assert.notEqual(altered,pdf.text);
  assert.notEqual(find(altered).confidence,'source_proven_question');
 }
 const shortened=pdf.text.replace('Senator Rest – Absent','Senator Rest – Nay');
 assert.ok(find(shortened).holds.includes('missing_or_disagreeing_printed_tally'));
});
test('coded amendment identity, literal outcome and historical full identities remain mandatory',()=>{
 const questions=text=>extractRowRollQuestions(text,doc(clerk));
 assert.ok(questions(clerk.text.replace('moved SF1426A10','moved SF9999A10'))[0].holds.includes('contradictory_bill_association'));
 assert.ok(questions(clerk.text.replace('8 voting YES and 5 voting NO','7 voting YES and 5 voting NO'))[0].holds.includes('missing_or_disagreeing_printed_tally'));
 assert.ok(questions(clerk.text.replace('m otion prevailed.','m otion prevailed and the motion failed.'))[0].holds.includes('ambiguous_or_missing_printed_outcome'));
 const roster=fixture.roster.map((m,i)=>({...m,membership_id:'m'+i}));
 const first=questions(clerk.text)[0];
 assert.throws(()=>resolvePrintedHistoricalChoices(first,clerk.text,roster.map(m=>({...m,name:m.name.split(' ').at(-1)})),doc(clerk)));
 assert.throws(()=>resolvePrintedHistoricalChoices(first,clerk.text,roster.map(m=>({...m,ends_on:'2023-01-01'})),doc(clerk)));
 assert.notEqual(questions(clerk.text.replace('Lead Anderson - NO','Lead Anderson - YES'))[0].confidence,'source_proven_question');
});
test('frozen complete population preserves previous proofs and all nine continuation keys',()=>{
 const input=readFileSync('docs/evaluation/source-proof/senate-864-population-original-inventory-20261022.json');
 assert.equal(sha(input),planSource('continuation').sourceInventoryInput.sha256);
 const report=JSON.parse(input),added=new Map();
 for(const d of report.originals.filter(d=>d.candidateOriginalExtractedText)){
  const actual=extractRowRollQuestions(d.candidateOriginalExtractedText,{date:d.date,committee:d.committee,session_slug:d.session}).filter(q=>q.confidence==='source_proven_question');
  const previous=d.rowQuestions.filter(q=>q.confidence==='source_proven_question');
  for(const old of previous){const q=actual.find(q=>q.questionKey===old.questionKey);assert.ok(q,'previous exact question changed');assert.equal(q.choices.length,old.choices);assert.equal(q.amendmentRef,old.amendmentRef);}
  for(const q of actual)if(!previous.some(p=>p.questionKey===q.questionKey))added.set(q.questionKey,q);
 }
 const continuationKeys=new Set(planSource('continuation').questions.map(q=>q.questionKey));
 const continuation=[...added.values()].filter(q=>continuationKeys.has(q.questionKey));
 assert.equal(continuation.length,9);assert.equal(continuation.reduce((n,q)=>n+q.choices.length,0),122);
 assert.deepEqual(new Set(continuation.map(q=>q.questionKey)),continuationKeys);
});
test('source profile independently verifies nine questions and rejects original body drift',async()=>{
 const o=await sourceFixture();assert.equal(o.docs.length,2);assert.equal(o.pins.expectedQuestions,9);assert.equal(o.pins.expectedChoices,122);
 await assert.rejects(freshOriginals(async()=>clerk.text,'continuation',async()=>({text:pdf.text,contentSha256:'0'.repeat(64)})));
 await assert.rejects(freshOriginals(async()=>clerk.text+' changed','continuation',async()=>({text:pdf.text,contentSha256:pdf.sha256})));
});
test('disposable PostgreSQL: add three events and 122 choices, correct five classifications, preserve six event IDs and replay zero writes',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;if(!url)return t.skip('CI supplies disposable database');
 const parsed=new URL(url);assert.ok(['localhost','127.0.0.1'].includes(parsed.hostname));
 const {Pool}=await import('pg'),{randomUUID}=await import('node:crypto');
 const admin=new Pool({connectionString:url,max:1}),schema='complete_rows_'+randomUUID().replaceAll('-','');let pool;
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
   const l=(await one('INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,$3,lower($3)) RETURNING id',[j,'complete-row-fixture-'+i,m.name])).id;
   members.push((await one("INSERT INTO memberships(session_id,chamber_id,legislator_id,district,party,title,starts_on,ends_on) VALUES($1,$2,$3,$4,'DFL','Senator',$5,$6) RETURNING id",[s,c,l,String(i+1),m.starts_on,m.ends_on])).id);
  }
  const o=await sourceFixture(),bills=new Map(),docs=new Map();
  for(const identifier of ['SF1426','SF4729'])bills.set(identifier,(await one('INSERT INTO bills(session_id,originating_chamber_id,identifier,title) VALUES($1,$2,$3,$3) RETURNING id',[s,c,identifier])).id);
  for(const d of o.docs)docs.set(d.url,(await one("INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,http_status,metadata) VALUES($1,$2,$3,$4,$5,$6,200,$7::jsonb) RETURNING id",[j,s,c,d.format==='pdf'?'senate_committee_minutes':'senate_committee_minutes_html',d.url,d.sha256,JSON.stringify({meetingDate:d.date,committeeName:d.committee})])).id);
  const old=[];
  for(const e of fixture.legacyStoredEvents){const q=o.pins.questions.find(q=>q.questionKey===e.questionKey);old.push((await one("INSERT INTO vote_events(session_id,chamber_id,bill_id,source_document_id,external_key,vote_kind,motion_text,amendment_ref,occurred_on,yea_count,nay_count,passed,is_passage,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'2024-03-21',$9,$10,$11,false,$12::jsonb) RETURNING id",[s,c,e.billIdentifier?bills.get(e.billIdentifier):null,docs.get(q.sourceUrl),'original-legacy-'+e.questionKey,e.voteKind,e.motionText,e.amendmentRef,e.yea,e.nay,e.passed,JSON.stringify({committeeVote:true,committeeName:'Elections',individualVotesAvailable:false,preserveSentinel:true})])).id);}
  const sentinel=(await one("INSERT INTO vote_events(session_id,chamber_id,bill_id,source_document_id,external_key,vote_kind,motion_text,occurred_on,yea_count,nay_count,passed,is_passage,metadata) VALUES($1,$2,$3,$4,'unrelated-preserved','motion','A different accepted question','2024-03-21',0,1,false,false,$5::jsonb) RETURNING id",[s,c,bills.get('SF4729'),docs.get(pdf.url),JSON.stringify({committeeVote:true,committeeName:'Elections'})])).id;
  await one("INSERT INTO member_votes(vote_event_id,membership_id,source_member_name,normalized_member_name,choice) VALUES($1,$2,$3,lower($3),'nay') RETURNING id",[sentinel,members[0],fixture.roster[0].name]);
  const target={database:parsed.pathname.slice(1),role:decodeURIComponent(parsed.username)},first=await runProduction(pool,target,o);
  assert.equal(first.insertedEvents,3);assert.equal(first.insertedChoices,122);assert.equal(first.correctedClassifications,5);assert.equal(first.preservedExistingTargetEventIds,6);assert.equal(first.verifiedExact,9);assert.equal(first.verifiedChoices,122);
  assert.ok(old.every(id=>first.recoveredEvents.some(e=>e.eventId===id)));
  const replay=await runProduction(pool,target,o);assert.equal(replay.insertedEvents,0);assert.equal(replay.insertedChoices,0);assert.equal(replay.correctedClassifications,0);assert.equal(replay.zeroWriteReplay,true);
 }finally{if(pool)await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();}
});
