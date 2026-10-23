import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractRowRollQuestions,resolvePrintedHistoricalChoices,sha} from '../src/evidence/senate-864-population-named-rolls.mjs';
const f=JSON.parse(readFileSync('tests/fixtures/senate-864-printed-voted-referral.json')),doc=f.source,text=doc.pages.map(p=>p.text).join('\n\n');
const qs=(s=text)=>extractRowRollQuestions(s,doc).filter(q=>q.format==='individually_printed_voted_referral');
test('actual original prints a failed SF3882 referral with exactly four individual sides; later lay-over is a different question',()=>{
 for(const p of doc.pages)assert.equal(sha(p.text),p.textSha256);
 const [q]=qs();assert.equal(qs().length,1);assert.equal(q.confidence,'source_proven_question');assert.equal(q.billIdentifier,'SF3882');assert.equal(q.voteKind,'motion');assert.equal(q.amendmentRef,null);assert.equal(q.passed,false);assert.equal(q.yea,2);assert.equal(q.nay,2);
 assert.deepEqual(q.choices,[{name:'Weber',choice:'nay'},{name:'Murphy',choice:'yea'},{name:'Klein',choice:'yea'},{name:'Chamberlain',choice:'nay'}]);
 assert.ok(q.motionText.includes('to refer S.F. 3882 to Local Government'));assert.ok(!q.fullQuestionPassage.includes('be laid over'));assert.equal(sha(q.fullQuestionPassage),q.fullQuestionPassageSha256);
 const roster=f.roster.map((r,i)=>({...r,membership_id:'fixture-'+i}));const resolved=resolvePrintedHistoricalChoices(q,text,roster,doc);assert.equal(resolved.length,4);assert.deepEqual(resolved.map(v=>v.fullName),['Bill Weber','Erin P. Murphy','Matt D. Klein','Roger C. Chamberlain']);
});
test('a constrained Roll cail OCR marker never changes literal evidence and has the same question identity as Roll call',()=>{
 const a=qs()[0],b=qs(text.replace('requested Roll cail','requested Roll call'))[0];assert.equal(a.questionKey,b.questionKey);assert.notEqual(a.motionText,b.motionText);assert.notEqual(a.fullQuestionPassageSha256,b.fullQuestionPassageSha256);
});
test('a heading, later summary, missing row, duplicate person, changed tally or non-tie unlabeled ordering cannot supply the question/sides/result',()=>{
 const intro='Senator Klein requested Roll cail to refer S.F. 3882 to Local Government';
 for(const [old,changed]of [[intro,'Senator Klein requested Roll cail'],[intro,'Senator Klein requested Roll cail to refer it to Local Government'],[intro,'Senator Klein requested Roll cail to refer S.F. 9999 to Local Government'],['* Senator Klein voted yes',''],['* Senator Klein voted yes','* Senator Murphy voted yes'],['2-2 Motion did not prevail','3-1 Motion did not prevail'],['2-2 Motion did not prevail','Motion did not prevail']]){
  const s=text.replace(old,changed);assert.notEqual(s,text);assert.ok(!qs(s).some(q=>q.confidence==='source_proven_question'),changed);
 }
 const untied=text.replace('Senator Chamberlain voted no','Senator Chamberlain voted yes').replace('2-2 Motion did not prevail','3-1 Motion prevailed');assert.ok(!qs(untied).some(q=>q.confidence==='source_proven_question'));
});
test('the printed failed outcome is required even when a later motion prevailed; historical service bounds remain mandatory',()=>{
 const s=text.replace('2-2 Motion did not prevail','Roll recorded').replace('Senator Weber moved that S.F. 3882, be laid over.','Senator Weber moved that S.F. 3882, be laid over. Motion prevailed.');
 assert.ok(!qs(s).some(q=>q.confidence==='source_proven_question'));
 const r=f.roster.map((m,i)=>({...m,membership_id:'m'+i,starts_on:'2023-01-01',ends_on:'2024-12-31'}));assert.throws(()=>resolvePrintedHistoricalChoices(qs()[0],text,r,doc),/historical/);
});
test('duplicate complete wording cannot become two distinct referral events',()=>{
 const q=qs()[0],doubled=text+'\n'+q.fullQuestionPassage;assert.ok(!qs(doubled).some(q=>q.confidence==='source_proven_question'));
});
