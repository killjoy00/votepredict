/**
 * #864 second source review: all 26 flagged original embedded-text Senate
 * minutes from the exhaustive 323/323 official SHA-verified source pass.
 * Re-authenticate original government bytes and source text SHA before
 * classifying printed formal-result boundary cues. No Neon or individual
 * named votes can be inferred, invented or inserted by this script.
 */
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {exactOriginal} from './audit-senate-864-81-ocr-original-motion-anchors.js';
import {classifyOriginalSenateMotionResultBoundaries} from
 '../src/evidence/senate-864-original-motion-action-boundaries.js';
import {identifyOriginalSourceMotionCues} from
 '../src/evidence/senate-864-original-motion-cue-review.js';
import {parseSenateCommitteeMinuteVotes,parseSenateCommitteeMinuteContextActions} from
 '../src/evidence/minnesota-senate-committee-minutes.js';

const RECEIPT='docs/evaluation/source-proof/senate-864-323-embedded-original-source-artifact-manifest.json';
const ORIGINAL='https://www.lrl.mn.gov/archive/minutes/senate/';
type SourceRow={
 year:number;committeeName:string;hearingDate:string;originalSourceUrl:string;
 originalPdfSha256:string;originalNormalizedExtractedTextSha256:string;
 originallyRequiredOcr:boolean;status:string;priority:string;
 explicitRecordedMotionResultCues:number;currentParserNamedRollCandidates:number;
 currentParserCountOnlyRollCandidates:number;currentParserContextActionCandidates:number;
 originalExplicitNamedRollLabelCues?:number;
};
type Artifact={year:number;shard:number;artifactId:number;zipSha256:string};
type ProofManifest={
 schemaVersion:string;issue:number;runId:number;reviewedSourceCommit:string;
 verifiedEmbeddedOriginalPdfs:number;flaggedReviewDocuments:number;
 formalResultCueDocuments:number;noOriginalPersonVoteInferred:boolean;
 noOriginalCueConsideredCertifiedDistinctMotion:boolean;
 originalArtifactZips:Artifact[];
};
type Report={
 schemaVersion:string;sourceRecallPhase:string;year:number;
 remainingEmbeddedShardIndex:number;remainingEmbeddedTotalShards:number;
 selectedOriginals:number;originalShaReverified:number;originalsHeld:number;
 noProductionDatabaseReadWrite:boolean;no2021Sources:boolean;
 noAutomaticallyInferredNamedVoteOrZeroAction:boolean;rows:SourceRow[];
};
const hex=(s:string)=>/^[a-f0-9]{64}$/.test(s);
export function selectExactFlagged26FromAll323(input:Report[],manifest:ProofManifest){
 if(manifest.schemaVersion!=='senate-864-323-embedded-original-48-source-zip-sha-manifest-v1'||
  manifest.issue!==864||manifest.runId!==38783916630||
  manifest.reviewedSourceCommit!=='584d19e64c3b220c2040884c581629612778700d'||
  manifest.verifiedEmbeddedOriginalPdfs!==323||manifest.flaggedReviewDocuments!==26||
  manifest.formalResultCueDocuments!==17||
  manifest.noOriginalPersonVoteInferred!==true||
  manifest.noOriginalCueConsideredCertifiedDistinctMotion!==true||
  !Array.isArray(manifest.originalArtifactZips)||
  manifest.originalArtifactZips.length!==48||
  !Array.isArray(input)||input.length!==48)
  throw Error('Frozen exhaustive 323 original source ZIP proof missing');
 const sourceRows:SourceRow[]=[];
 const expected=[77,97,41,108],years=[2022,2023,2024,2025];
 const seenShards=new Set<string>(),seenUrls=new Set<string>();
 for(const report of input){
  const k=report.year+'/'+report.remainingEmbeddedShardIndex;
  const artifact=manifest.originalArtifactZips.find(x=>
   x.year===report.year&&x.shard===report.remainingEmbeddedShardIndex);
  if(!artifact||!Number.isSafeInteger(artifact.artifactId)||artifact.artifactId<=0||
   !hex(artifact.zipSha256)||seenShards.has(k)||
   report.schemaVersion!=='senate-864-568-original-remaining323-embedded-source-recall-v1'||
   report.sourceRecallPhase!=='remaining323embedded'||
   !years.includes(report.year)||report.remainingEmbeddedTotalShards!==12||
   !Number.isSafeInteger(report.remainingEmbeddedShardIndex)||
   report.remainingEmbeddedShardIndex<0||report.remainingEmbeddedShardIndex>=12||
   !Array.isArray(report.rows)||report.rows.length<1||report.rows.length>10||
   report.selectedOriginals!==report.rows.length||
   report.originalShaReverified!==report.selectedOriginals||
   report.originalsHeld!==0||
   report.noProductionDatabaseReadWrite!==true||report.no2021Sources!==true||
   report.noAutomaticallyInferredNamedVoteOrZeroAction!==true)
   throw Error('Archived original embedded minute proof shard drift');
  seenShards.add(k);
  for(const row of report.rows){
   if(row.year!==report.year||!/^(2022|2023|2024|2025)-\d\d-\d\d$/.test(row.hearingDate)||
    !row.hearingDate.startsWith(String(report.year)+'-')||
    !row.committeeName.trim()||row.originallyRequiredOcr!==false||
    !row.originalSourceUrl.startsWith(ORIGINAL+report.year+'/')||
    !/\.pdf$/i.test(row.originalSourceUrl)||
    !hex(row.originalPdfSha256)||!hex(row.originalNormalizedExtractedTextSha256)||
    row.status!=='original_pdf_sha_reverified_parser_rechecked'||
    !['possible_new_action_needs_original_motion_review',
      'parser_now_recognizes_action_needs_review',
      'zero_detected_still_not_a_certified_no_vote'].includes(row.priority)||
    seenUrls.has(row.originalSourceUrl))
    throw Error('Raw authenticated original source identity or SHA missing');
   seenUrls.add(row.originalSourceUrl);
   sourceRows.push(row);
  }
 }
 if(seenShards.size!==48||sourceRows.length!==323||seenUrls.size!==323||
  years.some((y,i)=>sourceRows.filter(v=>v.year===y).length!==expected[i])||
  manifest.originalArtifactZips.some(a=>!seenShards.has(a.year+'/'+a.shard)))
  throw Error('Missing original embedded year/documents/shard partition');
 const flagged=sourceRows.filter(x=>x.priority!=='zero_detected_still_not_a_certified_no_vote')
  .sort((a,b)=>a.year-b.year||a.hearingDate.localeCompare(b.hearingDate)||
   a.committeeName.localeCompare(b.committeeName)||a.originalSourceUrl.localeCompare(b.originalSourceUrl));
 const formal=flagged.filter(x=>x.explicitRecordedMotionResultCues>0);
 if(flagged.length!==26||formal.length!==17||
  years.map(y=>flagged.filter(v=>v.year===y).length).join(',')!=='6,6,3,11'||
  years.map(y=>formal.filter(v=>v.year===y).length).join(',')!=='3,3,1,10'||
  flagged.some(x=>x.currentParserNamedRollCandidates<0||
   x.currentParserCountOnlyRollCandidates<0||
   x.currentParserContextActionCandidates<0))
  throw Error('26 flagged and 17 formal source review denominator drift');
 return flagged;
}
function reports(dir:string){
 const names=readdirSync(dir).filter(n=>/^remaining-embedded-202[2-5]-(?:[0-9]|1[01])\.json$/.test(n));
 if(names.length!==48)throw Error('Expected 48 frozen original embedded SHA result artifact JSONs');
 return names.map(name=>{
  const raw=readFileSync(join(dir,name),'utf8');
  if(raw.length<600||raw.length>25000)throw Error('Invalid bounded embedded source result JSON size');
  return JSON.parse(raw) as Report;
 });
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2&&args.length!==6)
  throw Error('Use --cohort-preflight DIR or --shard N --artifact-dir DIR --output FILE');
 const manifest=JSON.parse(readFileSync(RECEIPT,'utf8')) as ProofManifest;
 if(args.length===2&&args[0]==='--cohort-preflight'){
  const cohort=selectExactFlagged26FromAll323(reports(resolve(args[1]!)),manifest);
  console.log('SENATE864_EMBEDDED_EXACT26_PREFLIGHT='+JSON.stringify({
   originalDocumentsSHAProof:323,unreviewedOriginals:0,
   flaggedDocuments:cohort.length,explicitFormalResultDocuments:
    cohort.filter(r=>r.explicitRecordedMotionResultCues>0).length,
   yearCounts:[2022,2023,2024,2025].map(y=>cohort.filter(x=>x.year===y).length)
  }));
  return;
 }
 if(args.length!==6||args[0]!=='--shard'||!/^[0-7]$/.test(args[1]??'')||
  args[2]!=='--artifact-dir'||args[4]!=='--output')
  throw Error('Exact eight bounded source motion review shards required');
 const shard=Number(args[1]);
 const all=selectExactFlagged26FromAll323(reports(resolve(args[3]!)),manifest);
 const selected=all.filter((_,i)=>i%8===shard);
 if(selected.length<3||selected.length>4)
  throw Error('26 original embedded source shard cardinality drift');
 const documents:Array<Record<string,unknown>>=[];
 for(const row of selected){
  try{
   const source=await exactOriginal(row as Parameters<typeof exactOriginal>[0]);
   const segmentation=classifyOriginalSenateMotionResultBoundaries(source.text);
   const cues=identifyOriginalSourceMotionCues(source.text,250);
   const rolls=parseSenateCommitteeMinuteVotes(source.text);
   const context=parseSenateCommitteeMinuteContextActions(source.text);
   documents.push({
    year:row.year,committeeName:row.committeeName,hearingDate:row.hearingDate,
    originalGovernmentPdfSha256:row.originalPdfSha256,
    originalOfficialSourceUrl:row.originalSourceUrl,
    status:'original_government_pdf_sha_and_text_sha_reverified',
    independentResultCueBoundaries:segmentation,
    allDetectedPrintedCueTypeCounts:cues.byCueKind,
    priorOriginalFormalResultCues:row.explicitRecordedMotionResultCues,
    currentOriginalNamedRollParserCandidates:rolls.filter(x=>x.individualVotesAvailable).length,
    currentOriginalCountOnlyRollParserCandidates:rolls.filter(x=>!x.individualVotesAvailable).length,
    currentOriginalContextParserCandidates:context.length,
    originalPrintedResultCuesNotCertifiedAsUniqueParliamentaryMotions:true,
    originalSourceNotYetMatchedToExistingStoredEvents:true,
    noAttendeeOrMemberSideInferred:true
   });
  }catch{
   documents.push({year:row.year,committeeName:row.committeeName,
    hearingDate:row.hearingDate,originalGovernmentPdfSha256:row.originalPdfSha256,
    status:'official_original_source_integrity_or_boundary_hold',
    noAbsentVotesInferredFromFailure:true});
  }
 }
 const good=documents.filter(x=>x.status==='original_government_pdf_sha_and_text_sha_reverified');
 const result={
  schemaVersion:'senate-864-26-embedded-original-formal-motion-context-review-v1',
  issue:864,shard,documentsInShard:selected.length,originalsShaAndTextVerified:good.length,
  heldOriginals:selected.length-good.length,
  printedFormalResultCueSlotsInShard:good.reduce((n,x)=>n+
   Number((x.independentResultCueBoundaries as {sourcePrintedFormalResultCues:number}).sourcePrintedFormalResultCues),0),
  documentsWithExplicitFormalResultCue:good.filter(x=>
   (x.independentResultCueBoundaries as {sourcePrintedFormalResultCues:number}).sourcePrintedFormalResultCues>0).length,
  noNamedMemberVotesOrDistinctMotionInference:true,
  noProductionNeonQueryOrWrite:true,
  noOldPositionalEventKeyReplay:true,
  no2021MinutesSourceIncluded:true,
  documents
 };
 const out=resolve(args[5]!);mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('SENATE864_26_EMBEDDED_ORIGINAL_FORMAL_RESULT='+JSON.stringify({
  shard,documents:selected.length,verified:good.length,holds:result.heldOriginals,
  formalCueSlots:result.printedFormalResultCueSlotsInShard,
  formalCueDocuments:result.documentsWithExplicitFormalResultCue
 }));
 if(result.heldOriginals>0)process.exitCode=1;
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-26-embedded-original-motion-boundaries.ts'))
 void main().catch(error=>{
  // Expose only our fixed, public proof-stage enum to diagnose harmless
  // archive path/shape differences. Never print an underlying URL, person,
  // source text or untrusted thrown exception string.
  const allowed=[
   'Frozen exhaustive 323 original source ZIP proof missing',
   'Archived original embedded minute proof shard drift',
   'Raw authenticated original source identity or SHA missing',
   'Missing original embedded year/documents/shard partition',
   '26 flagged and 17 formal source review denominator drift',
   'Expected 48 frozen original embedded SHA result artifact JSONs',
   'Invalid bounded embedded source result JSON size',
   'Exact eight bounded source motion review shards required',
   'Use --cohort-preflight DIR or --shard N --artifact-dir DIR --output FILE',
  ];
  const message=error instanceof Error?error.message:'';
  const code=allowed.indexOf(message);
  console.error('SENATE864_26_EMBEDDED_SOURCE_HOLD=stage_'+(code<0?'unclassified':code));
  process.exitCode=1;
 });
