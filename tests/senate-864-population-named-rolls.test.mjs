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
 const event={id:'event',occurred_on:doc.date,session_slug:doc.session_slug,source_document_id:doc.id,bill_identifier:q.billIdentifier,motion_text:q.motionText,vote_kind:'motion',amendment_ref:null,yea_count:8,nay_count:5,passed:true,is_passage:false,metadata:{committeeName:'Elections'}};
 s.events=[event];s.choices=votes.map(v=>({vote_event_id:'event',membership_id:v.membershipId,choice:v.choice}));
 assert.equal(reconcileRowQuestion(q,doc,s).status,'exact');s.choices.pop();assert.equal(reconcileRowQuestion(q,doc,s).status,'missing_choices');s.choices.push({vote_event_id:'event',membership_id:'wrong',choice:'yea'});assert.equal(reconcileRowQuestion(q,doc,s).status,'conflicting_choices_or_tally');
 s.choices=votes.map(v=>({vote_event_id:'event',membership_id:v.membershipId,choice:v.choice}));event.vote_kind='amendment';assert.equal(reconcileRowQuestion(q,doc,s).status,'classification_defect');event.vote_kind='motion';
 event.source_document_id='other';assert.equal(reconcileRowQuestion(q,doc,s).status,'different_source_identity');event.motion_text='Unidentified different motion with the same tally';assert.equal(reconcileRowQuestion(q,doc,s).status,'ambiguous_production_match');
});
test('eight-document population-generated plan has exact bounds and source-specific overrides are unnecessary',()=>{
 const p=planSource();assert.equal(p.sourceDocuments.length,8);assert.equal(p.questions.length,10);assert.equal(p.questions.reduce((n,q)=>n+q.yea+q.nay,0),131);assert.equal(new Set(p.questions.map(q=>q.questionKey)).size,10);
 assert.ok(p.questions.every(q=>q.motionText.length>20&&q.questionKey.length===64));
});
test('static bounded production SQL compiles against migrated disposable Postgres',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;if(!url)return t.skip('CI supplies disposable database');
 const {Pool}=await import('pg'),pool=new Pool({connectionString:url,max:1});try{for(const [key,sql] of Object.entries(SNAPSHOT_SQL)){const args=['documents','bills'].includes(key)?[[]]:[];await pool.query('EXPLAIN '+sql,args);}}finally{await pool.end();}
});
