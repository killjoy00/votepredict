import test from 'node:test';
import assert from 'node:assert/strict';
import {DOC_SQL,supplemental,summarize,coalesceQuestionSources,compareAcquiredPdfExtraction} from '../scripts/inventory-senate-864-population.mjs';
test('supplementary registry has 28 exact official original identities scoped to 2022–25',()=>{
 const docs=supplemental();assert.equal(docs.length,28);assert.equal(new Set(docs.map(d=>d.source_url+'|'+d.content_sha256)).size,28);
 assert.ok(docs.every(d=>/^202[2-5]-\d\d-\d\d$/.test(d.date)&&/^https:\/\/www\.lrl\.mn\.gov\/archive\/minutes\/senate\//.test(d.source_url)&&/^[a-f0-9]{64}$/.test(d.content_sha256)));
});
test('population metrics preserve distinct source, question, choice and production denominators',()=>{
 const rows=[{date:'2023-02-07',committee:'Elections',format:'html',readable:true,status:'named_candidate_original',detectorCandidates:3,detectorChoiceOccurrences:42}];
 const question={date:'2023-02-07',committee:'Elections',choices:14,production:{status:'different_source_identity',alternateSourceParityVerified:true}};
 const state={events:[{id:'a',occurred_on:'2023-02-07'}],choices:[{vote_event_id:'a'},{vote_event_id:'a'}]};
 const r=summarize(rows,[question],state),year=r.byYear.find(r=>r.year===2023);
 assert.equal(year.originals,1);assert.equal(year.detectorCandidateOccurrences,3);assert.equal(year.strictDistinctQuestions,1);assert.equal(year.correctlyRepresentedChoices,14);assert.equal(year.alternateSourceVerified,1);assert.equal(year.questionOrIdentityHolds,0);
 assert.deepEqual(r.storedByYear.find(r=>r.year===2023),{year:2023,storedEvents:1,storedExplicitChoices:2});
 question.production.alternateSourceParityVerified=false;assert.equal(summarize(rows,[question],state).byYear.find(r=>r.year===2023).questionOrIdentityHolds,1);
});
test('population document SQL compiles against disposable Postgres',async t=>{
 if(!process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL)return t.skip('CI supplies disposable database');
 const {Pool}=await import('pg'),pool=new Pool({connectionString:process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL,max:1});
 try{await pool.query('EXPLAIN '+DOC_SQL);}finally{await pool.end();}
});

test('same exact question from multiple originals uses the matching source, independent of original order',async()=>{
 const {readFileSync}=await import('node:fs');
 const {extractRowRollQuestions,resolvePrintedHistoricalChoices}=await import('../src/evidence/senate-864-population-named-rolls.mjs');
 const {OFFICIAL_FULL}=await import('../src/evidence/senate-864-elections-2023-original-recovery.mjs');
 const fixture=JSON.parse(readFileSync('tests/fixtures/senate-864-population-row-original.json'));
 const a={...fixture.source,id:'alternate',text:fixture.text,session_id:'session',chamber_id:'senate'},b={...a,id:'stored'};
 const q=extractRowRollQuestions(fixture.text,b)[0];
 const roster=OFFICIAL_FULL.map(([,name],i)=>({membership_id:'m'+i,name,starts_on:'2023-01-03',ends_on:'2025-01-06',session_slug:'2023-2024'}));
 const choices=resolvePrintedHistoricalChoices(q,fixture.text,roster,b);
 const event={id:'event',source_document_id:'stored',session_id:b.session_id,chamber_id:b.chamber_id,session_slug:b.session_slug,occurred_on:b.date,bill_identifier:q.billIdentifier,motion_text:q.motionText,vote_kind:q.voteKind,amendment_ref:q.amendmentRef,yea_count:q.yea,nay_count:q.nay,passed:q.passed,is_passage:false,metadata:{committeeName:b.committee}};
 const snapshot={events:[event],choices:choices.map(v=>({vote_event_id:event.id,membership_id:v.membershipId,choice:v.choice})),roster};
 for(const occurrences of [[{q,d:a},{q,d:b}],[{q,d:b},{q,d:a}]]){
  const r=coalesceQuestionSources(occurrences,snapshot);
  assert.equal(r.status,'exact');assert.equal(r.missingChoices,0);
  assert.deepEqual(r.sourceWitnessClasses.sort(),['different_source_identity','exact']);
  assert.ok(!JSON.stringify(r).includes('eventId'));
 }
 assert.equal(coalesceQuestionSources([{q,d:a},{q:{...q,passed:!q.passed},d:b}],snapshot).status,'source_question_hold');
 snapshot.events.push({...event,id:'other-event',source_document_id:a.id});
 assert.equal(coalesceQuestionSources([{q,d:a},{q,d:b}],snapshot).status,'ambiguous_production_match');
});

test('immutable acquired-source cache has the pinned blob/content identities and complete public population',async()=>{
 const {readFileSync}=await import('node:fs'),{createHash}=await import('node:crypto'),{gunzipSync}=await import('node:zlib');
 const plan=JSON.parse(readFileSync('docs/evaluation/source-proof/senate-864-population-prior-inventory.json'));
 const bytes=readFileSync('docs/evaluation/source-proof/senate-864-population-acquired-cache-20261022.json.gz');
 assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),plan.reportGitBlobSha);
 const decoded=gunzipSync(bytes);assert.equal(createHash('sha256').update(decoded).digest('hex'),plan.reportContentSha256);
 const report=JSON.parse(decoded);assert.equal(report.originals.length,2860);assert.equal(report.reviewedCommit,plan.reviewedCommit);assert.equal(report.runId,plan.runId);
 assert.equal(report.productionWrites,0);assert.equal(report.distinctRowQuestions.length,24);
 assert.ok(report.originals.every(d=>d.sourceUrl&&/^[a-f0-9]{64}$/.test(d.originalSha256)));
});

test('OCR differences preserve byte proof and prior text hashes as holds; embedded drift or unauthenticated bytes fail',()=>{
 const digest='a'.repeat(64),other='b'.repeat(64);
 const stable={authenticated:true,textSha256:digest,extractionMethod:'embedded_text'};
 compareAcquiredPdfExtraction(digest,stable);assert.equal(stable.extractionTextChangedFromAcquiredCache,undefined);
 assert.throws(()=>compareAcquiredPdfExtraction(digest,{...stable,textSha256:other}));
 assert.throws(()=>compareAcquiredPdfExtraction(digest,{...stable,authenticated:false}));
 const ocr={authenticated:true,textSha256:other,extractionMethod:'ocr_tesseract'};
 compareAcquiredPdfExtraction(digest,ocr);assert.equal(ocr.extractionTextChangedFromAcquiredCache,true);assert.equal(ocr.previousExtractedTextSha256,digest);assert.equal(ocr.authenticated,true);
});
