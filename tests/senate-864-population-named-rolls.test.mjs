import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractRowRollQuestions,resolvePrintedHistoricalChoices,reconcileRowQuestion,inspectOriginal,sha} from '../src/evidence/senate-864-population-named-rolls.mjs';
import {OFFICIAL_FULL} from '../src/evidence/senate-864-elections-2023-original-recovery.mjs';
import {parseSenateCommitteeMinuteVotes} from '../src/evidence/minnesota-senate-committee-minutes.ts';
import {parseSenateCommitteeMinutesRaw} from '../src/sources/minnesota/senate-raw-votes.ts';
import {freshOriginals,planSource,SNAPSHOT_SQL,correctionPlan} from '../scripts/deploy-senate-864-population-row-rolls.mjs';
const f=JSON.parse(readFileSync('tests/fixtures/senate-864-population-row-original.json'));
const doc={...f.source,text:f.text,authenticated:true,id:'doc',session_id:'session',chamber_id:'senate'};
const roster=OFFICIAL_FULL.map(([,name],i)=>({membership_id:'member-'+i,name,starts_on:'2023-01-03',ends_on:'2025-01-06',session_slug:'2023-2024'}));
const qs=()=>extractRowRollQuestions(f.text,doc);
const snap=()=>({events:[],choices:[],roster});
test('actual original: two different bill recommendations, 26 printed sides, two Absent labels excluded, legacy parser misses both',()=>{
 assert.equal(sha(f.text),doc.content_sha256);const q=qs();assert.equal(q.length,2);
 assert.deepEqual(q.map(x=>x.billIdentifier),['SF1515','SF1507']);assert.ok(q.every(x=>x.confidence==='source_proven_question'&&x.voteKind==='motion'&&x.amendmentRef===null&&x.passed));
 assert.deepEqual(q.map(x=>[x.yea,x.nay,x.excludedOtherLabels]),[[8,5,1],[8,5,1]]);
 assert.equal(parseSenateCommitteeMinuteVotes(f.text).filter(x=>x.individualVotesAvailable).length,0);
 const raw=parseSenateCommitteeMinutesRaw(f.text).filter(x=>x.memberVotes.length);
 assert.equal(raw.length,2);for(let i=0;i<2;i++)assert.deepEqual(q[i].choices,raw[i].memberVotes.filter(v=>v.choice!=='other').map(({name,choice})=>({name,choice})));
 assert.notEqual(q[0].questionKey,q[1].questionKey);
});
test('full original identities plus active historical service are required; never a surname-only join',()=>{
 const q=qs()[0];assert.equal(resolvePrintedHistoricalChoices(q,f.text,roster,doc).length,13);
 assert.throws(()=>resolvePrintedHistoricalChoices(q,f.text,roster.map(x=>({...x,name:x.name.split(' ').at(-1)})),doc));
 assert.throws(()=>resolvePrintedHistoricalChoices(q,f.text,[...roster,{...roster.find(x=>x.name==='Jim Carlson'),membership_id:'second'}],doc));
 assert.throws(()=>resolvePrintedHistoricalChoices(q,f.text,roster.map(x=>({...x,starts_on:'2024-01-01'})),doc));
 assert.throws(()=>resolvePrintedHistoricalChoices(q,f.text.replace('Senator Warren Limmer','Senator Different Limmer'),roster,doc));
});
test('contradictory labels and bill references fail closed',()=>{
 const conflict=f.text.replace('Senator Koran - Nay','Senator Carlson - Nay');assert.ok(extractRowRollQuestions(conflict,doc)[0].holds.includes('duplicate_or_contradictory_names'));
 const wrong=f.text.replace('Senator Mitchell moved that SF 1515','Senator Mitchell moved that SF 9999');assert.ok(extractRowRollQuestions(wrong,doc)[0].holds.includes('contradictory_bill_association'));
 const bad=f.text.replace('8 Yeas, 5 Nays','7 Yeas, 5 Nays');assert.ok(extractRowRollQuestions(bad,doc)[0].holds.includes('missing_or_disagreeing_printed_tally'));
});
test('withdrawn/compound amendment questions and duplicate wording remain held, even with identical correct slates',()=>{
 // A withdrawal immediately before an independently new recommendation is not
 // itself the voting question; a withdrawal IN the chosen question is a hold.
 const b=f.text.replace('Senator Mitchell moved that SF 1515','Senator Mitchell moved the A2 amendment and withdrew the A2 amendment to SF 1515');
 assert.ok(extractRowRollQuestions(b,doc)[0].holds.includes('intervening_or_withdrawn_question'));
 const doubled=f.text+'\n'+f.text;assert.ok(extractRowRollQuestions(doubled,doc).every(q=>q.holds.includes('duplicate_question_wording')));
 const refs=f.text.replace('Senator Mitchell moved that SF 1515','Senator Mitchell moved the A2 amendment to the A3 amendment for SF 1515');assert.ok(extractRowRollQuestions(refs,doc)[0].holds.includes('compound_or_repeated_question'));
});
test('attendance, voice votes, aggregate counts and result restatements never manufacture choices',()=>{
 const text=f.text.replace(/^\s*Senator\s+.+?\s*-\s*(?:Yea|Nay|Absent)\s*$/gim,'');assert.equal(extractRowRollQuestions(text,doc).length,0);
 assert.equal(extractRowRollQuestions('Present: Senator Jim Carlson, Senator John Marty\nSenator Carlson moved SF26. The motion unanimously prevailed. Voice vote 2-0.',doc).length,0);
 assert.equal(qs().length,2); // each original also prints a formal result restatement
});
test('exact question identity precedes side/tally validation; alternate sources, identical slates and classification defects stay distinct',()=>{
 const q=qs()[0],s=snap();assert.equal(reconcileRowQuestion(q,doc,s).status,'missing_event');
 const votes=resolvePrintedHistoricalChoices(q,f.text,roster,doc);
 const event={id:'event',session_id:doc.session_id,chamber_id:doc.chamber_id,occurred_on:doc.date,session_slug:doc.session_slug,source_document_id:doc.id,bill_identifier:q.billIdentifier,motion_text:q.motionText,vote_kind:'motion',amendment_ref:null,yea_count:8,nay_count:5,passed:true,is_passage:false,metadata:{committeeName:'Elections'}};
 s.events=[event];s.choices=votes.map(v=>({vote_event_id:'event',membership_id:v.membershipId,choice:v.choice}));
 assert.equal(reconcileRowQuestion(q,doc,s).status,'exact');s.choices.pop();assert.equal(reconcileRowQuestion(q,doc,s).status,'missing_choices');s.choices.push({vote_event_id:'event',membership_id:'wrong',choice:'yea'});assert.equal(reconcileRowQuestion(q,doc,s).status,'conflicting_choices_or_tally');
 s.choices=votes.map(v=>({vote_event_id:'event',membership_id:v.membershipId,choice:v.choice}));event.vote_kind='amendment';assert.equal(reconcileRowQuestion(q,doc,s).status,'classification_defect');event.vote_kind='motion';
 event.source_document_id='other';assert.equal(reconcileRowQuestion(q,doc,s).status,'different_source_identity');event.motion_text='Unidentified different motion with the same tally';assert.equal(reconcileRowQuestion(q,doc,s).status,'ambiguous_production_match');
});
test('ten-document population-generated plan has exact bounds and source-specific overrides are unnecessary',()=>{
 const p=planSource();assert.equal(p.sourceDocuments.length,10);assert.equal(p.questions.length,14);assert.equal(p.questions.reduce((n,q)=>n+q.yea+q.nay,0),181);assert.equal(new Set(p.questions.map(q=>q.questionKey)).size,14);
 assert.ok(p.questions.every(q=>q.motionText.length>20&&q.questionKey.length===64));
});
test('static bounded production SQL compiles against migrated disposable Postgres',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;if(!url)return t.skip('CI supplies disposable database');
 const {Pool}=await import('pg'),pool=new Pool({connectionString:url,max:1});try{for(const [key,sql] of Object.entries(SNAPSHOT_SQL)){const args=['documents','bills'].includes(key)?[[]]:[];await pool.query('EXPLAIN '+sql,args);}}finally{await pool.end();}
});

test('consistent result restatements corroborate one question; contradictory outcomes hold',()=>{
 const consistent=f.text.replace('With a roll call vote of 8 Yeas, 5 Nays, and 1 Absence, the motion prevailed.','With a roll call vote of 8 Yeas, 5 Nays, and 1 Absence, the motion prevailed and the motion passed.');
 assert.equal(extractRowRollQuestions(consistent,doc)[0].confidence,'source_proven_question');
 const contradictory=f.text.replace('With a roll call vote of 8 Yeas, 5 Nays, and 1 Absence, the motion prevailed.','With a roll call vote of 8 Yeas, 5 Nays, and 1 Absence, the motion prevailed and the motion failed.');
 assert.ok(extractRowRollQuestions(contradictory,doc)[0].holds.includes('ambiguous_or_missing_printed_outcome'));
});

test('actual 2024 PDF: wrapped full names resolve without a surname-only fallback',()=>{
 const w=JSON.parse(readFileSync('tests/fixtures/senate-864-population-wrapped-original.json'));
 const d={...w.source};const rows=extractRowRollQuestions(w.text,d);
 assert.ok(/Bruce\nD\. Anderson/.test(w.text));
 assert.equal(rows.length,4);
 for(const q of rows)assert.equal(resolvePrintedHistoricalChoices(q,w.text,roster,d).length,q.choices.length);
});
test('a later distinct motion inside a legacy context blocks exact-question matching despite identical tallies',()=>{
 const q=qs()[0],s=snap();s.events=[{id:'wrong',session_id:doc.session_id,chamber_id:doc.chamber_id,occurred_on:doc.date,session_slug:doc.session_slug,source_document_id:doc.id,bill_identifier:q.billIdentifier,motion_text:q.motionText+' Senator Koran moved the A2 amendment.',yea_count:8,nay_count:5,metadata:{committeeName:'Elections'}}];
 assert.equal(reconcileRowQuestion(q,doc,s).status,'ambiguous_production_match');
});
test('wrapped source cohort has five independent originals, nine questions and 123 choices; SHA drift fails before DB',async()=>{
 const p=planSource('wrapped');assert.equal(p.sourceDocuments.length,5);assert.equal(p.questions.length,9);assert.equal(p.questions.reduce((n,q)=>n+q.yea+q.nay,0),123);assert.equal(p.questions.filter(q=>q.voteKind==='amendment').length,6);
 await assert.rejects(freshOriginals(undefined,'wrapped',async()=>({text:'incorrect original',contentSha256:'0'.repeat(64)})));
});

test('a complete, unique original question/rows/result passage binds the legacy event despite its later wrong bill or amendment label',()=>{
 const w=JSON.parse(readFileSync('tests/fixtures/senate-864-population-wrapped-original.json'));
 const d={...w.source,text:w.text,id:'pdf-doc',session_id:'session',chamber_id:'senate'};
 const q=extractRowRollQuestions(w.text,d).find(q=>q.amendmentRef==='A4');
 const s=snap();const body=q.fullQuestionPassage+' Senator Koran moved the A5 Amendment.';
 s.events=[{id:'retained',session_id:d.session_id,chamber_id:d.chamber_id,occurred_on:d.date,session_slug:d.session_slug,source_document_id:d.id,bill_identifier:'SF9999',motion_text:body,vote_kind:'amendment',amendment_ref:'A5',yea_count:q.yea,nay_count:q.nay,passed:q.passed,is_passage:false,metadata:{committeeName:'Elections'}}];
 const result=reconcileRowQuestion(q,d,s);assert.equal(result.status,'classification_defect');assert.equal(result.eventId,'retained');assert.equal(result.missingChoices.length,14);
 s.events[0].motion_text=q.motionText+' Senator Koran moved the A5 Amendment.';
 assert.equal(reconcileRowQuestion(q,d,s).status,'ambiguous_production_match');
});

test('disposable PostgreSQL: preserve eight event IDs, correct five classifications, add one event and 123 choices, then write zero on replay',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;if(!url)return t.skip('CI supplies disposable database');
 const parsed=new URL(url);assert.ok(['localhost','127.0.0.1'].includes(parsed.hostname),'This test may only write to disposable localhost');
 const {Pool}=await import('pg'),{randomUUID}=await import('node:crypto');
 const admin=new Pool({connectionString:url,max:1}),schema='row_repair_'+randomUUID().replaceAll('-','');let pool;
 try{
  await admin.query('CREATE SCHEMA '+schema);
  for(const table of ['jurisdictions','chambers','legislative_sessions','legislators','memberships','membership_source_aliases','bills','source_documents','vote_events','member_votes','votepredict_schema_migrations'])await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
  await admin.query(`INSERT INTO ${schema}.votepredict_schema_migrations SELECT * FROM public.votepredict_schema_migrations`);
  pool=new Pool({connectionString:url,max:1,options:'-c search_path='+schema+',public'});
  const one=async(sql,args=[])=>{const r=await pool.query(sql,args);return r.rows[0];};
  const j=(await one("INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US') RETURNING id")).id;
  const c=(await one("INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Senate','upper') RETURNING id",[j])).id;
  const s=(await one("INSERT INTO legislative_sessions(jurisdiction_id,slug,name) VALUES($1,'2023-2024','Fixture') RETURNING id",[j])).id;
  for(const [i,[,name]] of OFFICIAL_FULL.entries()){
   const l=(await one('INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,$3,lower($3)) RETURNING id',[j,'row-fixture-'+i,name])).id;
   await one("INSERT INTO memberships(session_id,chamber_id,legislator_id,district,party,title,starts_on,ends_on) VALUES($1,$2,$3,$4,'DFL','Senator','2023-01-03','2025-01-06') RETURNING id",[s,c,l,String(i+1)]);
  }
  const fixture=JSON.parse(readFileSync('tests/fixtures/senate-864-population-wrapped-five-originals.json'));
  const o=await freshOriginals(undefined,'wrapped',async({url})=>fixture.find(f=>f.url===url));
  const billIds=new Map();for(const identifier of new Set([...o.pins.questions.map(q=>q.billIdentifier),'SF4951']))billIds.set(identifier,(await one('INSERT INTO bills(session_id,originating_chamber_id,identifier,title) VALUES($1,$2,$3,$3) RETURNING id',[s,c,identifier])).id);
  const docIds=new Map();for(const d of o.docs)docIds.set(d.url,(await one("INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,http_status,metadata) VALUES($1,$2,$3,'senate_committee_minutes',$4,$5,200,$6::jsonb) RETURNING id",[j,s,c,d.url,d.sha256,JSON.stringify({meetingDate:d.date,committeeName:d.committee})])).id);
  const oldIds=[];
  for(const spec of o.pins.questions){
   if(spec.billIdentifier==='SF4785')continue;
   const d=o.docs.find(d=>d.url===spec.sourceUrl),q=extractRowRollQuestions(d.text,d).find(q=>q.questionKey===spec.questionKey);
   let bill=spec.billIdentifier,amendment=spec.amendmentRef,kind=spec.voteKind;
   if(bill==='SF3616'&&amendment==='A4')amendment='A5';
   else if(bill==='SF3616'&&amendment==='A5'){bill=null;amendment='A6';}
   else if(['SF3868','SF4039'].includes(bill)&&amendment===null){kind='amendment';amendment='A4';}
   else if(bill==='SF4700')bill='SF4951';
   const e=await one("INSERT INTO vote_events(session_id,chamber_id,bill_id,source_document_id,external_key,vote_kind,motion_text,amendment_ref,occurred_on,yea_count,nay_count,passed,is_passage,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,$13::jsonb) RETURNING id",[s,c,bill?billIds.get(bill):null,docIds.get(d.url),'legacy-fixture-'+q.questionKey,kind,q.fullQuestionPassage,amendment,d.date,q.yea,q.nay,q.passed,JSON.stringify({committeeVote:true,committeeName:'Elections',individualVotesAvailable:false})]);oldIds.push(e.id);
  }
  const {runProduction}=await import('../scripts/deploy-senate-864-population-row-rolls.mjs');
  const target={database:parsed.pathname.slice(1),role:decodeURIComponent(parsed.username)};
  const first=await runProduction(pool,target,o);
  assert.equal(first.insertedEvents,1);assert.equal(first.insertedChoices,123);assert.equal(first.correctedClassifications,5);assert.equal(first.preservedExistingTargetEventIds,8);assert.equal(first.verifiedExact,9);
  const replay=await runProduction(pool,target,o);assert.equal(replay.insertedEvents,0);assert.equal(replay.insertedChoices,0);assert.equal(replay.correctedClassifications,0);
  assert.ok(oldIds.every(id=>first.recoveredEvents.some(e=>e.eventId===id)));
 }finally{if(pool)await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();}
});

test('only an independently authenticated different prior question removes a duplicate hold',()=>{
 const q=qs()[0],s=snap();
 s.events=[{id:'prior',occurred_on:doc.date,session_slug:doc.session_slug,source_document_id:'prior-doc',bill_identifier:q.billIdentifier,motion_text:'Prior original amendment question',metadata:{committeeName:doc.committee}}];
 assert.equal(reconcileRowQuestion(q,doc,s).status,'ambiguous_production_match');
 const proof={eventId:'prior',bill:q.billIdentifier,date:doc.date,kind:'amendment',amendmentRef:'A35',independentlyAuthenticated:false};
 s.verifiedPriorQuestions=[proof];assert.equal(reconcileRowQuestion(q,doc,s).status,'ambiguous_production_match');
 proof.independentlyAuthenticated=true;assert.equal(reconcileRowQuestion(q,doc,s).status,'missing_event');
 proof.bill='SF9999';assert.equal(reconcileRowQuestion(q,doc,s).status,'ambiguous_production_match');
});
test('prior-source profile selects the separate final SF3 recommendation, not the accepted A35 amendment',()=>{
 const p=planSource('prior');assert.equal(p.sourceDocuments.length,1);assert.equal(p.expectedChoices,14);
 assert.equal(p.questions.length,1);assert.equal(p.questions[0].billIdentifier,'SF3');
 assert.equal(p.questions[0].voteKind,'motion');assert.equal(p.questions[0].amendmentRef,null);assert.equal(p.questions[0].passed,true);
});
