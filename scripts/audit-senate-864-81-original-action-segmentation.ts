/**
 * #864: independently re-authenticate all 81 original flagged government
 * minute PDFs and classify each SHA-bound printed formal-result source
 * boundary. Export ONLY source offsets, excerpt hashes, public bill/amendment
 * references and explicitly UNCERTIFIED action categories.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {selectOriginalFlagged81,readReports,exactOriginal} from
 './audit-senate-864-81-ocr-original-motion-anchors.js';
import {classifyOriginalSenateMotionResultBoundaries} from
 '../src/evidence/senate-864-original-motion-action-boundaries.js';
import {parseSenateCommitteeMinuteVotes,parseSenateCommitteeMinuteContextActions}
 from '../src/evidence/minnesota-senate-committee-minutes.js';

export const PRIOR_VERIFIED_CUE_COUNTS=[28,34,35,20,25,17,20,28] as const;
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==6||a[0]!=='--shard'||!/^[0-7]$/.test(a[1]??'')||
  a[2]!=='--artifact-dir'||a[4]!=='--output'||!a[3]||!a[5])
  throw Error('Fixed original 81-action classification shard 0..7 only');
 const shard=Number(a[1]);
 const cohort=selectOriginalFlagged81(readReports(resolve(a[3]!)));
 const items=cohort.filter((_,i)=>i%8===shard);
 if(items.length<10||items.length>11)
  throw Error('Frozen government source 81 partition drift');
 const documents:Array<Record<string,unknown>>=[];
 for(const r of items){
  try{
   const pdf=await exactOriginal(r);
   const segmented=classifyOriginalSenateMotionResultBoundaries(pdf.text);
   const named=parseSenateCommitteeMinuteVotes(pdf.text);
   const context=parseSenateCommitteeMinuteContextActions(pdf.text);
   documents.push({
    year:r.year,committeeName:r.committeeName,hearingDate:r.hearingDate,
    originalGovernmentPdfSha256:r.originalPdfSha256,
    originalOfficialUrl:r.originalSourceUrl,
    status:'original_pdf_text_sha_verified_and_result_cues_classified',
    parserContextOnlyCandidates:context.length,
    sourceOriginalNamedRolls:named.filter(x=>x.individualVotesAvailable).length,
    sourceOriginalCountOnlyRolls:named.filter(x=>!x.individualVotesAvailable).length,
    ...segmented,
    exactDistinctOriginalParliamentaryActionCount:null,
    persistedMotionMatchCount:null,
    attendeeOrMemberChoiceNotInferred:true,
   });
  }catch{
   documents.push({year:r.year,committeeName:r.committeeName,hearingDate:r.hearingDate,
    originalGovernmentPdfSha256:r.originalPdfSha256,
    status:'original_source_document_or_boundary_classification_hold',
    noActionOrVoteAbsenceInferred:true});
  }
 }
 const good=documents.filter(x=>x.status==='original_pdf_text_sha_verified_and_result_cues_classified');
 const sum=(key:string)=>good.reduce((n,x)=>n+Number(x[key]??0),0);
 const result={
  schemaVersion:'senate-864-81-original-formal-result-action-boundaries-v1',
  issue:864,shard,officialSourceYears:[2022,2023,2024,2025],
  frozenFlaggedGovernmentMinuteDocuments:81,
  documentsInShard:items.length,shaVerifiedDocuments:good.length,
  heldDocuments:items.length-good.length,
  originalPrintedFormalResultCueSlots:sum('sourcePrintedFormalResultCues'),
  candidatesWithOneMotionIntroduction:sum('candidateOneIntroduction'),
  candidatesWithMultipleMotionIntroductions:sum('ambiguousMultipleIntroductions'),
  possibleDuplicatedResultCues:sum('possibleRepeatedResultCues'),
  resultsWithoutBoundedMotionIntroduction:sum('resultOnlyWithoutBoundedMotionIntro'),
  knownAll81PrintedResultSlots:207,
  originalPrintedResultsNotDeclaredDistinctParliamentaryActions:true,
  noOldPositionBasedEventsOrMemberChoicesInserted:true,
  sourceOnlyNoNeonOrProductionWrite:true,
  originalActionsComparedToStoredMotionRows:false,
  no2021MinutesIncluded:true,
  documents
 };
 const path=resolve(a[5]!);mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path,JSON.stringify(result,null,2)+'\n');
 console.log('SENATE864_81_ORIGINAL_RESULT_ACTION_CLASSIFICATION='+JSON.stringify({
  shard,documents:items.length,verified:good.length,holds:result.heldDocuments,
  printedResultCues:result.originalPrintedFormalResultCueSlots,
  oneIntro:result.candidatesWithOneMotionIntroduction,
  multipleIntros:result.candidatesWithMultipleMotionIntroductions,
  possibleRepeated:result.possibleDuplicatedResultCues,
  noIntro:result.resultsWithoutBoundedMotionIntroduction
 }));
 if(result.heldDocuments>0||
  result.originalPrintedFormalResultCueSlots!==PRIOR_VERIFIED_CUE_COUNTS[shard])
  process.exitCode=1;
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-81-original-action-segmentation.ts'))
 void main().catch(()=>{
  console.error('SENATE864_81_RESULT_SEGMENTATION_HOLD=original_source_or_fixed_cohort');
  process.exitCode=1;
 });
