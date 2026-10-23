import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractRowRollQuestions,resolvePrintedHistoricalChoices,sha} from '../src/evidence/senate-864-population-named-rolls.mjs';
import {verifyPriorAmendmentsForRenewal} from '../src/evidence/senate-864-renewed-question-bridge.mjs';
import {freshOriginals,planSource,correctionPlan,runProduction} from '../scripts/deploy-senate-864-population-row-rolls.mjs';
import {SF1_INSERT_EVENT,SF1_INSERT_CHOICE} from '../src/evidence/senate-864-sf1-repair.ts';
const fixture=JSON.parse(readFileSync('tests/fixtures/senate-864-population-renewed-question.json')),source=fixture.sourceDocuments[0];
const original=()=>freshOriginals(async()=>source.text,'renewal');
const qs=(text=source.text)=>extractRowRollQuestions(text,source);
function acceptedPriorSnapshot(o){
 const roster=fixture.roster.map((m,i)=>({...m,membership_id:'m'+i}));
 const d={...source,id:'doc',source_url:source.url,content_sha256:source.sha256,session_id:'s',chamber_id:'senate'};
 const events=[],choices=[];
 for(const [i,p]of o.pins.priorQuestions.entries()){
  const q=qs().find(q=>q.questionKey===p.questionKey),id='prior'+i;
  events.push({id,source_document_id:d.id,session_id:d.session_id,chamber_id:d.chamber_id,bill_id:'bill',session_slug:source.session_slug,bill_identifier:q.billIdentifier,occurred_on:source.date,motion_text:q.motionText,vote_kind:q.voteKind,amendment_ref:q.amendmentRef,yea_count:q.yea,nay_count:q.nay,passed:q.passed,is_passage:false,metadata:{committeeVote:true,committeeName:source.committee,sourceQuestionKey:q.questionKey}});
  choices.push(...resolvePrintedHistoricalChoices(q,source.text,roster,source).map(v=>({vote_event_id:id,membership_id:v.membershipId,choice:v.choice})));
 }
 return {docs:[d],events,choices,roster,bills:[{id:'bill',identifier:'SF1426',session_id:'s',chamber_id:'senate',session_slug:source.session_slug}]};
}
test('actual complete renewal has its own explicit question and fourteen sides; three prior amendment proofs remain exact',()=>{
 assert.equal(sha(source.text),source.sha256);const q=qs();assert.equal(q.length,4);assert.ok(q.every(q=>q.confidence==='source_proven_question'));
 assert.deepEqual(q.map(q=>[q.voteKind,q.amendmentRef,q.yea,q.nay,q.passed]),[['amendment','A10',8,5,true],['amendment','A28',8,5,true],['amendment','A21',6,8,false],['motion',null,8,6,true]]);
 assert.ok(q[3].motionText.startsWith('Senator Murphy renewed her motion that SF1426'));
 assert.ok(!q[3].fullQuestionPassage.includes('Senator Koran moved SF1426A21'));
 for(const p of planSource('renewal').priorQuestions)assert.equal(q.find(q=>q.questionKey===p.questionKey).fullQuestionPassageSha256,p.fullQuestionPassageSha256);
});
test('incomplete renewals, inferred bill headings, amendment references, withdrawn wording, changed totals and repeated complete wording remain held',()=>{
 const intro='Senator Murphy renewed her motion that SF1426, as amended, be recommended to pass and re-referred to Finance Committee.';
 for(const replacement of ['Senator Murphy renewed her motion.','Senator Murphy renewed her motion that it be recommended to pass and re-referred to Finance Committee.','Senator Murphy renewed her motion that SF1426.','Senator Murphy renewed her motion that SF1426 A21 be recommended to pass.','Senator Murphy renewed her motion that SF9999 be recommended to pass.','Senator Murphy renewed her motion that SF1426 be recommended to pass, then withdrew it.']){
  const text=source.text.replace(intro,replacement);assert.notEqual(text,source.text);assert.ok(!qs(text).some(q=>q.confidence==='source_proven_question'&&q.voteKind==='motion'));
 }
 const wrong=source.text.replace('With 8 voting YES and 6 voting NO','With 7 voting YES and 6 voting NO');assert.ok(!qs(wrong).some(q=>q.confidence==='source_proven_question'&&q.voteKind==='motion'));
 const final=qs()[3];assert.ok(!qs(source.text+'\n'+final.fullQuestionPassage).some(q=>q.confidence==='source_proven_question'&&q.voteKind==='motion'));
});
test('only original-and-choice exact prior questions exclude stored events; metadata, missing sides or wrong outcome cannot bypass the hold',async()=>{
 const o=await original(),s=acceptedPriorSnapshot(o);
 assert.throws(()=>correctionPlan(o,s),/held/);
 s.verifiedPriorQuestions=verifyPriorAmendmentsForRenewal(o,s);assert.equal(s.verifiedPriorQuestions.length,3);assert.equal(s.verifiedPriorQuestions.reduce((n,p)=>n+p.choices,0),40);
 assert.equal(correctionPlan(o,s)[0].result.status,'missing_event');
 for(const mutate of [s=>s.choices.pop(),s=>s.events[0].passed=false,s=>s.events[0].motion_text='Unidentified prior question',s=>s.events[0].source_document_id='other']){
  const altered=structuredClone(s);mutate(altered);assert.throws(()=>verifyPriorAmendmentsForRenewal(o,altered));
 }
 await assert.rejects(freshOriginals(async()=>source.text+' altered','renewal'));
});
test('all 233 prior candidates preserve literal proven passages and choices; only one new distinct question is admitted and held occurrences become forty',()=>{
 const p=planSource('renewal'),bytes=readFileSync(p.sourceInventoryInput.path);assert.equal(sha(bytes),p.sourceInventoryInput.sha256);
 const input=JSON.parse(bytes),oldKeys=new Set(input.originals.flatMap(d=>d.rowQuestions.filter(q=>q.confidence==='source_proven_question').map(q=>q.questionKey))),added=new Map();let held=0,witnesses=0;
 for(const d of input.originals.filter(d=>d.candidateOriginalExtractedText)){
  const actual=extractRowRollQuestions(d.candidateOriginalExtractedText,{date:d.date,committee:d.committee,session_slug:d.session});held+=actual.filter(q=>q.confidence==='held_question').length;
  for(const old of d.rowQuestions.filter(q=>q.confidence==='source_proven_question')){const q=actual.find(q=>q.confidence==='source_proven_question'&&q.questionKey===old.questionKey);assert.ok(q);assert.equal(q.choices.length,old.choices);assert.equal(q.fullQuestionPassageSha256,old.sourcePassageSha256);}
  for(const q of actual.filter(q=>q.confidence==='source_proven_question')){if(!d.rowQuestions.some(old=>old.confidence==='source_proven_question'&&old.questionKey===q.questionKey))witnesses++;if(!oldKeys.has(q.questionKey))added.set(q.questionKey,q);}
 }
 assert.equal(held,40);assert.equal(witnesses,3);assert.deepEqual([...added.keys()],[p.questions[0].questionKey]);assert.equal([...added.values()][0].choices.length,14);
});
test('disposable PostgreSQL: reverify three accepted amendments/40 choices, add one distinct recommendation/14 choices, preserve every prior row and replay zero writes',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;if(!url)return t.skip('CI supplies disposable database');
 const parsed=new URL(url);assert.ok(['localhost','127.0.0.1'].includes(parsed.hostname));const {Pool}=await import('pg'),{randomUUID}=await import('node:crypto');
 const admin=new Pool({connectionString:url,max:1}),schema='renewal_'+randomUUID().replaceAll('-','');let pool;
 try{
  await admin.query('CREATE SCHEMA '+schema);
  for(const table of ['jurisdictions','chambers','legislative_sessions','legislators','memberships','membership_source_aliases','bills','source_documents','vote_events','member_votes','votepredict_schema_migrations'])await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
  await admin.query(`INSERT INTO ${schema}.votepredict_schema_migrations SELECT * FROM public.votepredict_schema_migrations`);
  pool=new Pool({connectionString:url,max:1,options:'-c search_path='+schema+',public'});const one=async(sql,args=[])=>(await pool.query(sql,args)).rows[0];
  const j=(await one("INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US') RETURNING id")).id;
  const c=(await one("INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Senate','upper') RETURNING id",[j])).id;
  const s=(await one("INSERT INTO legislative_sessions(jurisdiction_id,slug,name) VALUES($1,'2023-2024','Fixture') RETURNING id",[j])).id;
  const roster=[];
  for(const[i,m]of fixture.roster.entries()){
   const l=(await one('INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,$3,lower($3)) RETURNING id',[j,'renewal-fixture-'+i,m.name])).id;
   const membership=(await one("INSERT INTO memberships(session_id,chamber_id,legislator_id,district,party,title,starts_on,ends_on) VALUES($1,$2,$3,$4,'DFL','Senator',$5,$6) RETURNING id",[s,c,l,String(i+1),m.starts_on,m.ends_on])).id;roster.push({...m,membership_id:membership});
  }
  const bill=(await one("INSERT INTO bills(session_id,originating_chamber_id,identifier,title) VALUES($1,$2,'SF1426','Fixture') RETURNING id",[s,c])).id;
  const doc=(await one("INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,http_status,metadata) VALUES($1,$2,$3,'senate_committee_minutes_html',$4,$5,200,$6::jsonb) RETURNING id",[j,s,c,source.url,source.sha256,JSON.stringify({meetingDate:source.date,committeeName:source.committee})])).id;
  const originalIds=[];for(const q of qs().slice(0,3)){
   const meta={committeeVote:true,committeeName:source.committee,sourceQuestionKey:q.questionKey,preserveSentinel:true};
   const id=(await one(SF1_INSERT_EVENT,[s,c,bill,doc,'accepted:'+q.questionKey,q.voteKind,q.motionText,q.amendmentRef,source.date,q.yea,q.nay,q.passed,JSON.stringify(meta)])).id;originalIds.push(id);
   for(const v of resolvePrintedHistoricalChoices(q,source.text,roster,source))await one(SF1_INSERT_CHOICE,[id,v.membershipId,v.name,v.name.toLowerCase(),v.choice,null,JSON.stringify({preserveSentinel:true})]);
  }
  const o=await original(),target={database:parsed.pathname.slice(1),role:decodeURIComponent(parsed.username)},first=await runProduction(pool,target,o);
  assert.equal(first.independentlyReverifiedPriorQuestions,3);assert.equal(first.independentlyReverifiedPriorChoices,40);assert.equal(first.insertedEvents,1);assert.equal(first.insertedChoices,14);assert.equal(first.correctedClassifications,0);assert.equal(first.verifiedExact,1);assert.equal(first.existingEventIdsAndChoicesPreserved,true);
  const replay=await runProduction(pool,target,o);assert.equal(replay.insertedEvents,0);assert.equal(replay.insertedChoices,0);assert.equal(replay.correctedClassifications,0);assert.equal(replay.zeroWriteReplay,true);
 }finally{if(pool)await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();}
});
