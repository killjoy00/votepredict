/** #864: exact single original Jan 22 2025 media-caption cue HTTP retry. */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectPinnedMtgidRecords} from '../src/evidence/senate-committee-138-mtgid-head-source.js';
import {readExactPriorMediaHtmlProof,inspectMediaPageCaptionSurface}
 from '../src/evidence/senate-committee-138-caption-surface.js';
import {fetchBoundedSenateMediaRecordHtml}
 from '../src/evidence/senate-committee-138-record-html-metadata.js';
import {readOriginal2025CaptionAvailabilityProof,findAutoCaptionMotionCueWindows,
 retrieveVerifiedOfficialCaptionMarkup}
 from '../src/evidence/senate-committee-caption-motion-cues.js';

export const ORIGINAL_2025_22_PARTIAL_CUE_SHA256=
 '6c39b11830b2c3e53e0b14f037203cbbe85e0b0b4e07dc0a3f1610f0d56ff00c' as const;
export const RETRY_TARGET={year:2025,hearingDate:'2025-01-22',
 committeeName:'Energy, Utilities, Environment, and Climate',mtgid:'1050345'} as const;
export const JAN22_RETRY_SCHEMA=
 'senate-2025-jan22-one-original-caption-motion-cue-retry-v1' as const;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export function verify2025FirstMotionCueSourceOutcome(raw:string){
 if(sha(raw)!==ORIGINAL_2025_22_PARTIAL_CUE_SHA256)
   throw Error('Original 2025 21/22 caption motion-cue partial source SHA changed');
 const j=JSON.parse(raw) as {
  schemaVersion:string;year:number;records:Array<{originalMediaRecordId:string}>;
  total:{original2025IndexedMediaLeadsExpected:number;
   fullOriginalHtmlAndCaptionBodyShaReverified:number;failedSourceBodies:number;
   sourceCueWindowsTotal:number;combinedSourceCaptionTimestampMarkers:number};
  failures:Array<{hearingDate:string;mtgid:string;reason:string}>;
 };
 if(j.schemaVersion!=='senate-2025-22-unlinked-original-caption-motion-cue-review-v1'
   ||j.year!==2025||j.total.original2025IndexedMediaLeadsExpected!==22
   ||j.total.fullOriginalHtmlAndCaptionBodyShaReverified!==21
   ||j.total.failedSourceBodies!==1||j.total.sourceCueWindowsTotal!==162
   ||j.total.combinedSourceCaptionTimestampMarkers!==43582
   ||j.records.length!==21||j.failures.length!==1
   ||j.failures[0]!.hearingDate!==RETRY_TARGET.hearingDate
   ||j.failures[0]!.mtgid!==RETRY_TARGET.mtgid
   ||j.failures[0]!.reason!=='fetch failed'
   ||j.records.some(r=>r.originalMediaRecordId===RETRY_TARGET.mtgid))
    throw Error('Original 2025 incomplete cue run date/failed source mismatch');
 return j;
}
const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[source page]').slice(0,170);
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==10||a[0]!=='--hrefs'||a[2]!=='--original-html'
   ||a[4]!=='--caption-metadata'||a[6]!=='--first-failed-cues'||a[8]!=='--output')
   throw Error('Exact --hrefs --original-html --caption-metadata --first-failed-cues --output paths');
 const [hrefP,htmlP,capP,firstP,out]=[a[1],a[3],a[5],a[7],a[9]].map(x=>resolve(x!));
 const allHrefs=selectPinnedMtgidRecords(2025,readFileSync(hrefP,'utf8'));
 const oldHtml=readExactPriorMediaHtmlProof(2025,readFileSync(htmlP,'utf8'));
 const oldCaptions=readOriginal2025CaptionAvailabilityProof(readFileSync(capP,'utf8'));
 verify2025FirstMotionCueSourceOutcome(readFileSync(firstP,'utf8'));
 if(allHrefs.length!==22||oldHtml.size!==22||oldCaptions.size!==22)
   throw Error('Earlier original 2025 official source population changed');
 const source=allHrefs.find(x=>x.mtgid===RETRY_TARGET.mtgid)!;
 if(!source||source.meetingDate!==RETRY_TARGET.hearingDate
   ||source.committeeName!==RETRY_TARGET.committeeName)
   throw Error('Single Jan 22 original media identity not independently sourced');
 const checkedHtml=oldHtml.get(source.mtgid)!;
 const prior=oldCaptions.get(source.mtgid)!;
 if(!checkedHtml||!prior||prior.originalHearingDate!==RETRY_TARGET.hearingDate
   ||checkedHtml.originalHtmlSha256!==prior.previouslyVerifiedOriginalPageHtmlSha256)
   throw Error('Jan 22 earlier original page/caption provenance changed');
 const failures:Array<{mtgid:string;reason:string}>=[];
 const rows:Array<Record<string,unknown>>=[];
 try{
  const fetched=await fetchBoundedSenateMediaRecordHtml(source.mediaUrl,new Set([source.mediaUrl]));
  const surface=inspectMediaPageCaptionSurface(fetched.html,source.mediaUrl);
  if(surface.pageOriginalHtmlSha256!==checkedHtml.originalHtmlSha256
    ||surface.safeRequestCandidates.length!==1)
    throw Error('Original Jan22 media HTML/one safe caption request SHA changed');
  const payload=await retrieveVerifiedOfficialCaptionMarkup(
    surface.safeRequestCandidates[0]!.endpointUrl,
    source.mediaUrl,prior.captionPayloadSha256s[0]!);
  if(payload.bytes!==prior.returnedPayloadBytes)
    throw Error('Original Jan22 caption payload bytes length changed');
  const cues=findAutoCaptionMotionCueWindows(payload.html);
  if(cues.timestampMarkers!==prior.timedCaptionRowsVisible)
    throw Error('Original Jan22 timestamp marker count drifted');
  rows.push({year:2025,hearingDate:source.meetingDate,
    committeeName:source.committeeName,mtgid:source.mtgid,
    originalMediaUrl:source.mediaUrl,
    originalHtmlSha256:checkedHtml.originalHtmlSha256,
    originalCaptionPayloadSha256:payload.bodySha256,
    originalCaptionPayloadBytes:payload.bytes,
    ...cues,sourceHtmlAndCaptionByteShaReverified:true});
 }catch(e){failures.push({mtgid:source.mtgid,reason:safe(e)});}
 const report={
  schemaVersion:JAN22_RETRY_SCHEMA,issue:864,year:2025,
  sourcePriorFirstRunId:38107642535,
  priorFirstRunConcludedFailure:true,
  priorFirstRunPartialJsonSha256:ORIGINAL_2025_22_PARTIAL_CUE_SHA256,
  exactOriginalRetryRecordId:RETRY_TARGET.mtgid,exactOriginalHearingDate:RETRY_TARGET.hearingDate,
  retryOriginalsExpected:1,originalHtmlAndCaptionShaVerified:rows.length,
  sourceFailures:failures.length,records:rows,failures,
  sourceAutoCaptionCuesAreNotCertifiedVotes:true,
  noAudioVideoBodiesOrOriginalFullTranscriptsSaved:true,
  noNamedSenatorSidesCertified:true,noPrivateOrProductionDbWrites:true,
  noModelForecastTrainingServingSchedulerFloor2027Changes:true,
  issue864MustRemainOpen:true
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({expectedOriginalSources:1,verified:rows.length,failures:failures.length,
  motionCueWindows:rows[0]?.totalDistinctThirtySecondCategoryCueWindows??0},null,2));
 if(failures.length)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{console.error(safe(e));process.exitCode=1});
