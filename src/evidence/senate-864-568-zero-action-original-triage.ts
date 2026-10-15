/**
 * #864 Stratified original PDF source recall audit, 2022-25 Senate only.
 * Zero recognized parser-v2 actions is NOT proof no actual committee motions.
 * Source PDF SHA is independently fixed in the old 1592-day ledger.
 */
export type FirstPassOriginal={
 sourceUrl:string;originalPdfSha256:string|null;
 ocrRecoveredFromInitiallyLowText:boolean;
 sourceActions:Array<{actionType:string}>;
};
export type FirstPassMeeting={
 year:number;committee:string;hearingDate:string;hasOriginalPdf:boolean;
 originalMinutes:FirstPassOriginal[];
};
export type FirstPassLedger={meetingCensusOriginalSha256:string;meetings:FirstPassMeeting[]};
export type ZeroActionTarget={
 year:2022|2023|2024|2025;committee:string;hearingDate:string;
 sourceUrl:string;sourcePdfSha256:string;originallyRequiredOcr:boolean;
};
const VALID_SOURCE_INDEX_SHA='ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0';
const SHA=/^[a-f0-9]{64}$/;
export function selectSenate864FirstPassZeroActionOriginals(input:FirstPassLedger,year:2022|2023|2024|2025,perGroup=4){
 if(input.meetingCensusOriginalSha256!==VALID_SOURCE_INDEX_SHA||
  input.meetings.length!==1592||![2022,2023,2024,2025].includes(year)||
  !Number.isSafeInteger(perGroup)||perGroup<1||perGroup>6)
  throw Error('Independent 1592-day original Senate ledger or bounded sample selection absent');
 const all=input.meetings.filter(m=>m.hasOriginalPdf&&m.originalMinutes.length>0&&
  m.originalMinutes.every(d=>d.sourceActions.length===0));
 if(all.length!==568||
  all.filter(m=>m.originalMinutes.some(d=>d.ocrRecoveredFromInitiallyLowText)).length!==197)
  throw Error('Frozen original 568 unparsed action meeting/197 OCR denominator drift');
 if(all.some(m=>![2022,2023,2024,2025].includes(m.year)||
  !/^\d{4}-\d\d-\d\d$/.test(m.hearingDate)||
  !m.hearingDate.startsWith(m.year+'-')||
  m.originalMinutes.some(d=>!SHA.test(d.originalPdfSha256??'')||
    !d.sourceUrl.startsWith('https://www.lrl.mn.gov/archive/minutes/senate/'+m.year+'/'))))
  throw Error('Unverified original PDF SHA, URL, or indexed meeting date in source cohort');
 const selections:ZeroActionTarget[]=[];
 for(const ocr of [true,false]){
  const rows=all.filter(m=>m.year===year&&
   m.originalMinutes.some(d=>d.ocrRecoveredFromInitiallyLowText)===ocr)
   .sort((a,b)=>a.hearingDate.localeCompare(b.hearingDate)||a.committee.localeCompare(b.committee));
  if(rows.length<perGroup)throw Error('Not enough fixed original zero-action meeting documents in stratum');
  const seen=new Set<string>();
  for(let i=0;i<perGroup;i++){
   const index=Math.round(i*(rows.length-1)/(perGroup-1||1));
   const r=rows[index]!,source=r.originalMinutes[0]!;
   if(seen.has(source.sourceUrl))throw Error('Stratified original zero-action PDF selection not unique');
   seen.add(source.sourceUrl);
   selections.push({
    year,committee:r.committee,hearingDate:r.hearingDate,sourceUrl:source.sourceUrl,
    sourcePdfSha256:source.originalPdfSha256!,originallyRequiredOcr:ocr
   });
  }
 }
 return {year,fullOriginalZeroActionMeetings:568,
  originalOcrZeroActionMeetings:197,
  originalEmbeddedZeroActionMeetings:371,
  selectedOriginals:selections.sort((a,b)=>a.hearingDate.localeCompare(b.hearingDate)||
   a.committee.localeCompare(b.committee)),sampleNotAllSourceAudit:true,
  originalBaselineNoParserActionNotNoVoteProof:true};
}
export function classifySourceMinuteMotionSignals(text:string){
 const source=text.replace(/\s+/g,' ');
 const explicitMotionResult=(source.match(/\b(?:MOTION|AMENDMENT)\s+(?:PREVAILED|FAILED|PASSED|CARRIED|ADOPTED|DID NOT PREVAIL)\b/gi)||[]).length;
 const explicitNamedRollSignal=(source.match(/\b(?:Ayes?|Nays?)\s*[:\-–]\s*[A-Z]/gi)||[]).length;
 const reportedVoteSignal=(source.match(/\broll[\s-]+call(?:\s+vote)?\b|\bvoice[\s-]+vote\b/gi)||[]).length;
 const motionIntroductionCue=(source.match(/\b(?:moved that|moved to|motion to|offered the|amendment was adopted)\b/gi)||[]).length;
 const informative=(source.match(/\b(?:informational hearing|presentation on|overview of|testimony from)\b/gi)||[]).length;
 return {
  explicitRecordedMotionResultCues:explicitMotionResult,
  explicitNamedRollLabelCues:explicitNamedRollSignal,
  reportedRollOrVoiceVoteCues:reportedVoteSignal,
  motionIntroductionTextCues:motionIntroductionCue,
  informationalHearingTextCues:informative,
  // Cue is a review prompt, not proof of a different distinct vote event.
  originalContainsPotentialUncapturedMotion:
   explicitMotionResult>0||explicitNamedRollSignal>0||reportedVoteSignal>0,
  silenceIsNotProofOfNoAction:true
 };
}
