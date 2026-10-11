/** #864 original source-only strict procedural cues from already independently
 * SHA-verified THIRD Apr27 2023 Senate Taxes caption track. NOT named votes.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {selectPinnedMtgidRecords} from '../src/evidence/senate-committee-138-mtgid-head-source.js';
import {readExactPriorMediaHtmlProof,inspectMediaPageCaptionSurface}
 from '../src/evidence/senate-committee-138-caption-surface.js';
import {fetchBoundedSenateMediaRecordHtml}
 from '../src/evidence/senate-committee-138-record-html-metadata.js';
import {retrieveVerifiedOfficialCaptionMarkup}
 from '../src/evidence/senate-committee-caption-motion-cues.js';
import {findStrict2025OriginalAutoCaptionMotionCues}
 from '../src/evidence/senate-committee-caption-motion-cues-v2.js';
import {ORIGINAL_APR27_TAXES_CAPTION_SOURCE,verifyOriginalApr27ThirdCaptionLead}
 from '../src/evidence/senate-2023-taxes-third-original-caption-source.js';
import {PROVEN_2023_APR27_THIRD_CAPTION,verifyProven2023Apr27ThirdCaptionJson}
 from '../src/evidence/senate-2023-apr27-third-caption-strict-source.js';
const argv=process.argv.slice(2);
if(argv.length!==10||argv[0]!=='--hrefs'||argv[2]!=='--original-html'
 ||argv[4]!=='--first-caption'||argv[6]!=='--third-source'||argv[8]!=='--output')
 throw Error('Exact --hrefs, --original-html, --first-caption, --third-source, --output');
const [href,html,first,third,out]=[argv[1]!,argv[3]!,argv[5]!,argv[7]!,argv[9]!].map(s=>resolve(s));
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[original public LRL source]').slice(0,160);
async function main(){
 const p=PROVEN_2023_APR27_THIRD_CAPTION,old=ORIGINAL_APR27_TAXES_CAPTION_SOURCE;
 const rows=selectPinnedMtgidRecords(2023,readFileSync(href,'utf8'));
 const originals=readExactPriorMediaHtmlProof(2023,readFileSync(html,'utf8'));
 const firstProof=verifyOriginalApr27ThirdCaptionLead(readFileSync(first,'utf8'));
 const sourceProof=verifyProven2023Apr27ThirdCaptionJson(readFileSync(third,'utf8'));
 if(rows.length!==64||originals.size!==64||firstProof.remainingUninspectedStreams!==1
  ||sourceProof.originalMtgid!==p.mediaMtgid)
  throw Error('Prior authentic 2023 original index/HTML and source lead changed');
 const matched=rows.filter(x=>x.mtgid===p.mediaMtgid);
 const row=matched[0],page=originals.get(p.mediaMtgid);
 if(matched.length!==1||!row||!page
  ||row.meetingDate!==p.meetingDate||row.committeeName!==p.committee
  ||row.mediaUrl!==p.originalMediaUrl
  ||page.originalHtmlSha256!==p.originalHtmlSha256
  ||page.originalIndexedHearingDate!==p.meetingDate
  ||old.exactOriginalPageHtmlSha256!==p.originalHtmlSha256)
  throw Error('Third Apr27 source belongs to unexpected Senate hearing');
 let outcome:Record<string,unknown>={
   htmlOriginalSHAReverified:false,
   thirdOriginalCaptionBodySHAReverified:false,
   originalCaptionBodyBytes:null,originalTimestampMarkers:null,
   strictProceduralCueCount:null,strictCueWindowSourceMetadata:null,
   sourceError:null
 };
 let successful=false;
 try{
  const media=await fetchBoundedSenateMediaRecordHtml(p.originalMediaUrl,new Set([p.originalMediaUrl]));
  const surface=inspectMediaPageCaptionSurface(media.html,p.originalMediaUrl);
  if(surface.pageOriginalHtmlSha256!==p.originalHtmlSha256
    ||surface.safeRequestCandidates.length!==3||surface.rejectedRequestCandidates!==0
    ||surface.totalRequestCandidates!==3)
    throw Error('Third Apr27 source HTTP HTML SHA/three-caption contract drift');
  outcome.htmlOriginalSHAReverified=true;
  const request=surface.safeRequestCandidates[2]!;
  if(!request||sha(request.mp4)!==p.thirdOriginalCaptionFilenameSha256)
    throw Error('Previously authenticated exact third original mp4 caption identifier changed');
  const payload=await retrieveVerifiedOfficialCaptionMarkup(
    request.endpointUrl,p.originalMediaUrl,p.thirdOriginalCaptionBodySha256);
  const cues=findStrict2025OriginalAutoCaptionMotionCues(payload.html);
  if(payload.bytes!==p.thirdOriginalCaptionBodyBytes
    ||cues.originalTimestampAttributeMarkers!==p.thirdOriginalTimestampMarkers)
    throw Error('Exact third original source body length or timestamp marker count drift');
  outcome={...outcome,
    thirdOriginalCaptionBodySHAReverified:true,
    sourceOriginalCaptionBodySha256:payload.bodySha256,
    originalCaptionBodyBytes:payload.bytes,
    originalTimestampMarkers:cues.originalTimestampAttributeMarkers,
    strictProceduralCueCount:cues.categoryThirtySecondWindowsNotDistinctMotions,
    strictCueWindowSourceMetadata:{
      matchedRowsByPhraseCategoryNotDistinctMotions:cues.matchedRowsByPhraseCategoryNotDistinctMotions,
      sourceReviewCueTimeWindows:cues.sourceReviewCueTimeWindows,
      cueWindowsAboveOutputCap:cues.cueWindowsAboveOutputCap,
      noHumanAudioValidationPerformed:cues.noHumanAudioValidationPerformed,
      rawCaptionTextOrHtmlSaved:cues.rawCaptionTextOrHtmlSaved,
      noUniqueMotionOrRecordedSenatorVoteCertified:cues.noUniqueMotionOrRecordedSenatorVoteCertified
    },
    sourceError:null
  };
  successful=true;
 }catch(e){outcome.sourceError=safe(e)}
 const j={
  schemaVersion:'senate-2023-apr27-third-caption-original-sha-strict-cues-v1',
  issue:864,hearingDate:p.meetingDate,committeeName:p.committee,
  originalMtgid:p.mediaMtgid,originalMediaUrl:p.originalMediaUrl,
  originalHtmlPageSha256:p.originalHtmlSha256,
  priorFirstRunId:old.originalFirstCaptionRunId,priorFirstRunConclusion:'failure',
  actualThirdCaptionSourceRunId:p.originalSourceRunId,
  actualThirdOriginalSourceRunConclusion:p.originalSourceRunConclusion,
  originalThirdCaptionMetadataSha256:p.sourceUncompressedJsonSha256,
  alreadyOriginalSHAProvenThirdBodySha256:p.thirdOriginalCaptionBodySha256,
  sourceReviewStatus:successful?'third_original_caption_procedural_cues_sha_verified':'third_original_caption_procedural_cues_hold',
  result:outcome,
  noCaptionWordsOrCompleteMediaBodiesStored:true,
  noVerifiedMotionSpeakerOrNamedVote:true,
  oneAdditionalTrackNotOneAdditionalVote:true,
  original2021OfficialSenatePrintedMinutesUnknown:true,
  original2022ElectronicPrintedDifferenceNotReconciled:true,
  complete2021to2025OfficialCommitteeVoteDenominator:null,
  noPrivateProductionDBModelTrainingForecastServingSchedulerFloor2027Changes:true,
  issue864MustRemainOpen:true
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(j,null,2)+'\n');
 console.log(JSON.stringify({sourceReviewStatus:j.sourceReviewStatus,originalCaptionMarkers:outcome.originalTimestampMarkers,cueWindows:outcome.strictProceduralCueCount},null,2));
 if(!successful)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});
