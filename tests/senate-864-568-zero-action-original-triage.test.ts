import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectSenate864FirstPassZeroActionOriginals,selectSenate864Next64UnreviewedOriginals,classifySourceMinuteMotionSignals}
 from '../src/evidence/senate-864-568-zero-action-original-triage.js';
const S='ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0';
function fixture(){
 const rows=[] as any[];
 for(const [year,total,ocr] of [[2022,202,113],[2023,131,22],[2024,66,13],[2025,169,49]]){
  for(let i=0;i<total;i++){
   const date=new Date(Date.UTC(year,0,i+1)).toISOString().slice(0,10);
   rows.push({year,committee:'Fictional test '+year+'-'+i,hearingDate:date,hasOriginalPdf:true,
    originalMinutes:[{sourceUrl:'https://www.lrl.mn.gov/archive/minutes/senate/'+year+
      '/fixture/'+date.replaceAll('-','')+'/f_'+i+'_Minutes.pdf',
     originalPdfSha256:(year*1000+i).toString(16).padStart(64,'0'),
     ocrRecoveredFromInitiallyLowText:i<ocr,sourceActions:[]}]});
  }
 }
 assert.equal(rows.length,568);
 for(let i=0;i<1024;i++)rows.push({year:2023,committee:'Unrelated indexed '+i,
  hearingDate:'2023-01-01',hasOriginalPdf:false,originalMinutes:[]});
 return {meetingCensusOriginalSha256:S,meetings:rows};
}
test('original 568 zero-action meeting cohort conserved by year and OCR/embedded; 32 reproducible samples',()=>{
 const cohort=fixture();
 let samples=0;
 for(const year of [2022,2023,2024,2025] as const){
  const s=selectSenate864FirstPassZeroActionOriginals(cohort,year,4);
  assert.equal(s.fullOriginalZeroActionMeetings,568);
  assert.equal(s.originalOcrZeroActionMeetings,197);
  assert.equal(s.originalEmbeddedZeroActionMeetings,371);
  assert.equal(s.selectedOriginals.length,8);
  assert.equal(s.selectedOriginals.filter(x=>x.originallyRequiredOcr).length,4);
  assert.equal(s.selectedOriginals.filter(x=>!x.originallyRequiredOcr).length,4);
  assert.equal(new Set(s.selectedOriginals.map(x=>x.sourceUrl)).size,8);
  assert.ok(s.selectedOriginals.every(x=>x.year===year));
  assert.equal(s.originalBaselineNoParserActionNotNoVoteProof,true);
  assert.deepEqual(s,selectSenate864FirstPassZeroActionOriginals(cohort,year,4));
  samples+=8;
 }
 assert.equal(samples,32);
});
test('official source drift and an unverified PDF hash are explicit holds, never zero-vote facts',()=>{
 const source=fixture();
 assert.throws(()=>selectSenate864FirstPassZeroActionOriginals({
  ...source,meetings:source.meetings.slice(0,-1)
 },2022));
 assert.throws(()=>selectSenate864FirstPassZeroActionOriginals({
  ...source,meetings:[{...source.meetings[0],year:2021},...source.meetings.slice(1)]
 },2022));
 assert.throws(()=>selectSenate864FirstPassZeroActionOriginals({
  ...source,meetings:[{...source.meetings[0],originalMinutes:[{
   ...source.meetings[0].originalMinutes[0],originalPdfSha256:'bad'
  }]},...source.meetings.slice(1)]
 },2022));
});
test('distinguish actual printed MOTION PREVAILED / roll signals from informational hearings and uncertain motion beginnings',()=>{
 const yes=classifySourceMinuteMotionSignals(
  'Senator Example moved that S.F. 32 be recommended to pass. MOTION PREVAILED. Roll call vote: Ayes: Example');
 assert.equal(yes.explicitRecordedMotionResultCues,1);
 assert.ok(yes.reportedRollOrVoiceVoteCues>=1);
 assert.equal(yes.originalContainsPotentialUncapturedMotion,true);
 const information=classifySourceMinuteMotionSignals(
  'Informational hearing on social and economic impacts. Presentation on sports betting. Meeting adjourned.');
 assert.equal(information.explicitRecordedMotionResultCues,0);
 assert.ok(information.informationalHearingTextCues>=1);
 assert.equal(information.originalContainsPotentialUncapturedMotion,false);
 assert.equal(information.silenceIsNotProofOfNoAction,true);
 const mayBe=classifySourceMinuteMotionSignals('Senator moved to discuss a bill.');
 assert.ok(mayBe.motionIntroductionTextCues>=1);
 assert.equal(mayBe.originalContainsPotentialUncapturedMotion,false);
});
test('source study never infers member vote from cue, updates old ordinal events, or reaches protected DB',()=>{
 const c=readFileSync('scripts/audit-senate-864-568-zero-action-originals-sample.ts','utf8');
 assert.match(c,/originalPdfSha256:pdf.contentSha256/);
 assert.match(c,/sha\(bytes\)!==originalSha/);
 assert.match(c,/fetchSenateCommitteeMinutePdf/);
 assert.match(c,/parseSenateCommitteeMinuteVotes/);
 assert.match(c,/sampleNotAll568Sources:true/);
 assert.match(c,/noProductionDatabaseReadWrite:true/);
 assert.doesNotMatch(c,/\b(?:INSERT INTO|UPDATE vote_events|DELETE FROM|DROP TABLE)\b/);
});


test('second 64-original QA round never overlaps the previous 32, retains 197 OCR/371 embedded source identity',()=>{
 const source=fixture(),allUrls=new Set<string>();
 for(const year of [2022,2023,2024,2025] as const){
  const first=selectSenate864FirstPassZeroActionOriginals(source,year,4);
  const firstSet=new Set(first.selectedOriginals.map(x=>x.sourceUrl));
  for(const x of first.selectedOriginals)allUrls.add(x.sourceUrl);
  for(const mode of ['ocr','embedded'] as const){
   const v=selectSenate864Next64UnreviewedOriginals(source,year,mode);
   assert.equal(v.additionalPreviouslyUnreviewedOriginals,8);
   assert.equal(v.cumulativeUniqueOriginalsTargetWhenAllShardsComplete,96);
   assert.equal(v.zeroParserActionsDoesNotMeanZeroActualVotes,true);
   assert.equal(v.rawSourceShaRequired,true);
   assert.equal(v.selectedOriginals.length,8);
   assert.ok(v.selectedOriginals.every(x=>x.originallyRequiredOcr===(mode==='ocr')));
   for(const x of v.selectedOriginals){
    assert.match(x.sourcePdfSha256,/^[0-9a-f]{64}$/);
    assert.equal(firstSet.has(x.sourceUrl),false);
    assert.equal(allUrls.has(x.sourceUrl),false);
    allUrls.add(x.sourceUrl);
   }
   assert.deepEqual(v,selectSenate864Next64UnreviewedOriginals(source,year,mode));
  }
 }
 assert.equal(allUrls.size,96);
});
test('second original sample fails closed for malformed source or unsupported 2021 year and mode',()=>{
 const source=fixture();
 assert.throws(()=>selectSenate864Next64UnreviewedOriginals(source,2022,'unknown' as 'ocr'));
 assert.throws(()=>selectSenate864Next64UnreviewedOriginals({
  ...source,meetingCensusOriginalSha256:'bad'
 },2023,'embedded'));
 assert.throws(()=>selectSenate864Next64UnreviewedOriginals(source,2021 as 2022,'embedded'));
 const c=readFileSync('scripts/audit-senate-864-568-zero-action-originals-sample.ts','utf8');
 assert.match(c,/selectSenate864Next64UnreviewedOriginals/);
 assert.match(c,/originalPdfSha256:pdf\.contentSha256/);
 assert.doesNotMatch(c,/ON CONFLICT|INSERT INTO member_votes|UPDATE vote_events/);
});
