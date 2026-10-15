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


/**
 * Next independent, disjoint review round AFTER the 32-SHA-original baseline.
 * Eight extra original PDFs per year/stratum: 4 years x (8 OCR+8 embedded)
 * = 64 previously UNSAMPLED dated meeting originals, 96 cumulative sampled.
 * All identities and PDF raw SHA derive from the previously pinned full
 * 1,592-date original source ledger, never from heuristically searched URLs.
 */
export function selectSenate864Next64UnreviewedOriginals(
 input:FirstPassLedger,year:2022|2023|2024|2025,
 stratum:'ocr'|'embedded',
){
 if(!['ocr','embedded'].includes(stratum))
  throw Error('Original source parser OCR or embedded-text stratum required');
 const prior=selectSenate864FirstPassZeroActionOriginals(input,year,4);
 const priorOriginals=new Set(prior.selectedOriginals.map(x=>x.sourceUrl));
 const wantsOcr=stratum==='ocr';
 const cohort=input.meetings.filter(m=>m.year===year&&m.hasOriginalPdf&&
  m.originalMinutes.length>0&&m.originalMinutes.every(d=>d.sourceActions.length===0)&&
  m.originalMinutes.some(d=>d.ocrRecoveredFromInitiallyLowText)===wantsOcr&&
  !priorOriginals.has(m.originalMinutes[0]!.sourceUrl))
  .sort((a,b)=>a.hearingDate.localeCompare(b.hearingDate)||a.committee.localeCompare(b.committee));
 if(cohort.length<8)throw Error('Insufficient independently SHA-proven held action originals');
 const selected:ZeroActionTarget[]=[];
 for(let i=0;i<8;i++){
  const m=cohort[Math.round(i*(cohort.length-1)/7)]!;
  const p=m.originalMinutes[0]!;
  if(!/^[a-f0-9]{64}$/.test(p.originalPdfSha256??'')||
   !p.sourceUrl.startsWith('https://www.lrl.mn.gov/archive/minutes/senate/'+year+'/'))
   throw Error('Original government PDF SHA/URL missing');
  selected.push({year,committee:m.committee,hearingDate:m.hearingDate,
   sourceUrl:p.sourceUrl,sourcePdfSha256:p.originalPdfSha256!,
   originallyRequiredOcr:wantsOcr});
 }
 if(selected.length!==8||new Set(selected.map(x=>x.sourceUrl)).size!==8||
  selected.some(x=>priorOriginals.has(x.sourceUrl)))
  throw Error('Second source audit overlapping previously SHA-reviewed 32 PDF originals');
 return {year,stratum,originalZeroActionMeetingDates:568,
  earlierShaVerifiedOriginalSample:32,additionalPreviouslyUnreviewedOriginals:8,
  selectedOriginals:selected,
  cumulativeUniqueOriginalsTargetWhenAllShardsComplete:96,
  rawSourceShaRequired:true,
  zeroParserActionsDoesNotMeanZeroActualVotes:true,
  noOriginalNamedMembershipInferred:true};
}

/**
 * Third independent review: exhaust the 149 OCR-recovered PDFs still unaudited
 * after the original 32 and the disjoint next64 (12 OCR per year reviewed).
 * A reviewed zero-action PDF is not proof that no parliamentary vote occurred.
 *
 * The shard counts are fixed by year so CI can recover every original source
 * once, without accidentally selecting a convenient subset or relabeling the
 * old evidence inventory. These are OFFLINE source reviews, not DB imports.
 */
export function selectSenate864RemainingOcrOriginals(
 input:FirstPassLedger,year:2022|2023|2024|2025,
 shardIndex:number,totalShards:number,
){
 const shardByYear:{[year:number]:number}={2022:10,2023:1,2024:1,2025:4};
 const initialOcrByYear:{[year:number]:number}={2022:113,2023:22,2024:13,2025:49};
 const remainingByYear:{[year:number]:number}={2022:101,2023:10,2024:1,2025:37};
 if(![2022,2023,2024,2025].includes(year)||
  totalShards!==shardByYear[year]||
  !Number.isSafeInteger(shardIndex)||shardIndex<0||shardIndex>=totalShards)
  throw Error('Fixed 2022-25 remaining OCR cohort shard required');
 // The two prior selectors independently re-validate the exact original
 // 1,592 meeting / 568 zero-action / 197 OCR SHA-bound universe.
 const first=selectSenate864FirstPassZeroActionOriginals(input,year,4);
 const second=selectSenate864Next64UnreviewedOriginals(input,year,'ocr');
 const reviewed=new Set([...first.selectedOriginals,...second.selectedOriginals]
  .filter(x=>x.originallyRequiredOcr).map(x=>x.sourceUrl));
 if(reviewed.size!==12)throw Error('Prior original OCR samples overlap or drift');
 const originalRows=input.meetings.filter(m=>m.year===year&&m.hasOriginalPdf&&
  m.originalMinutes.length>0&&m.originalMinutes.every(d=>d.sourceActions.length===0)&&
  m.originalMinutes.some(d=>d.ocrRecoveredFromInitiallyLowText))
  .sort((a,b)=>a.hearingDate.localeCompare(b.hearingDate)||
   a.committee.localeCompare(b.committee));
 if(originalRows.length!==initialOcrByYear[year])
  throw Error('Original year-specific OCR zero-action denominator drift');
 const remaining=originalRows.filter(m=>!reviewed.has(m.originalMinutes[0]!.sourceUrl));
 if(remaining.length!==remainingByYear[year]||
  new Set(remaining.map(m=>m.originalMinutes[0]!.sourceUrl)).size!==remaining.length)
  throw Error('Remaining original OCR source denominator or uniqueness drift');
 const selectedOriginals:ZeroActionTarget[]=remaining
  .filter((_,i)=>i%totalShards===shardIndex)
  .map(m=>{
   const doc=m.originalMinutes[0]!;
   if(!SHA.test(doc.originalPdfSha256??'')||
    !doc.sourceUrl.startsWith('https://www.lrl.mn.gov/archive/minutes/senate/'+year+'/'))
    throw Error('Remaining original OCR PDF lacks pinned source identity');
   return {year,committee:m.committee,hearingDate:m.hearingDate,
    sourceUrl:doc.sourceUrl,sourcePdfSha256:doc.originalPdfSha256!,
    originallyRequiredOcr:true};
  });
 if(selectedOriginals.length<1||selectedOriginals.length>12||
  selectedOriginals.some(x=>reviewed.has(x.sourceUrl)))
  throw Error('Unbounded or previously inspected original OCR shard');
 return {year,stratum:'ocr' as const,shardIndex,totalShards,
  originalZeroActionMeetingDates:568,originalZeroActionOcrDates:197,
  independentlyReviewedFirst32AndNext64:96,
  remainingOcrAfterPriorReviewsAcrossYears:149,
  remainingOcrOriginalsThisYear:remaining.length,
  selectedOriginals,originalShaRequired:true,
  no2021MeetingSources:true,notIndividualVoteOrNoVoteProof:true};
}


/**
 * Fourth source wave: exhaust the 323 remaining embedded-text original
 * 2022-25 committee-minute PDFs disjoint from first 32 and next 64.
 * The 149 remaining OCR originals were audited separately, so never
 * claim they are included in this cohort. No "zero votes" inference.
 */
export function selectSenate864RemainingEmbeddedOriginals(
 input:FirstPassLedger,year:2022|2023|2024|2025,
 shardIndex:number,totalShards:number,
){
 const years=[2022,2023,2024,2025] as const;
 const counts:{[year:number]:number}={2022:77,2023:97,2024:41,2025:108};
 if(!years.includes(year)||totalShards!==12||
  !Number.isSafeInteger(shardIndex)||shardIndex<0||shardIndex>=totalShards)
  throw Error('Fixed 2022-25 remaining embedded-original cohort shard required');
 const prior=new Set<string>();
 for(const y of years){
  const first=selectSenate864FirstPassZeroActionOriginals(input,y,4);
  const second=selectSenate864Next64UnreviewedOriginals(input,y,'embedded');
  const urls=[...first.selectedOriginals.filter(v=>!v.originallyRequiredOcr),
   ...second.selectedOriginals].map(x=>x.sourceUrl);
  if(urls.length!==12||urls.some(url=>prior.has(url)))
   throw Error('Prior original embedded-source samples overlap or drift');
  for(const url of urls)prior.add(url);
 }
 if(prior.size!==48)throw Error('48 original embedded source samples not verified');
 const all=input.meetings.filter(m=>m.hasOriginalPdf&&
  m.originalMinutes.length>0&&m.originalMinutes.every(d=>d.sourceActions.length===0));
 const embedded=all.filter(m=>!m.originalMinutes.some(d=>d.ocrRecoveredFromInitiallyLowText));
 if(all.length!==568||embedded.length!==371)
  throw Error('Frozen 568/371 original denominator drift');
 const remaining=embedded.filter(m=>!prior.has(m.originalMinutes[0]!.sourceUrl))
  .sort((a,b)=>a.year-b.year||a.hearingDate.localeCompare(b.hearingDate)||
   a.committee.localeCompare(b.committee));
 const urls=remaining.map(m=>m.originalMinutes[0]!.sourceUrl);
 if(remaining.length!==323||new Set(urls).size!==323||
  years.some(y=>remaining.filter(m=>m.year===y).length!==counts[y]))
  throw Error('323 embedded original source identity or year partition drift');
 const selectedOriginals=remaining.filter(m=>m.year===year)
  .filter((_,i)=>i%totalShards===shardIndex)
  .map(m=>{
   const d=m.originalMinutes[0]!;
   if(!SHA.test(d.originalPdfSha256??'')||
    !d.sourceUrl.startsWith('https://www.lrl.mn.gov/archive/minutes/senate/'+year+'/'))
    throw Error('Embedded Senate original source URL/SHA missing');
   return {year,committee:m.committee,hearingDate:m.hearingDate,
    sourceUrl:d.sourceUrl,sourcePdfSha256:d.originalPdfSha256!,
    originallyRequiredOcr:false};
  });
 if(selectedOriginals.length<1||selectedOriginals.length>10)
  throw Error('Unbounded or empty original embedded source shard');
 return {year,stratum:'embedded' as const,shardIndex,totalShards,
  firstPassZeroActionOriginals:568,originalEmbeddedCohort:371,
  independentlyReviewedEmbeddedOriginals:48,
  remainingUnreviewedEmbeddedOriginals:323,
  remainingYearOriginals:counts[year],selectedOriginals,
  oldParserZeroActionsNotCertifiedNoVotes:true,
  sourceOriginalShaRequired:true,no2021:true,noDatabaseReadOrWrites:true};
}
