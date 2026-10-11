/** #864: RETRY ONLY two previously failing 2023 Taxes official archive metadata pages. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectPinnedMtgidRecords} from '../src/evidence/senate-committee-138-mtgid-head-source.js';
import {fetchBoundedSenateMediaRecordHtml} from '../src/evidence/senate-committee-138-record-html-metadata.js';
import {readExactPriorMediaHtmlProof,inspectMediaPageCaptionSurface,
  fetchBoundedCaptionEvidence} from '../src/evidence/senate-committee-138-caption-surface.js';

export const TWO_SOURCE_RETRY=[{id:'1046920',day:'2023-01-12',committee:'Taxes'},
  {id:'1047266',day:'2023-02-08',committee:'Taxes'}] as const;
export const PREVIOUS_2023_PARTIAL_CAPTION_JSON_SHA=
  'a1a3155b54c3a55d7f98bc812f75f90653d1727c135cd77972d16b3737bd50a4';
export const TWO_SOURCE_RETRY_SCHEMA=
  'senate-2023-two-previously-failed-taxes-caption-original-source-retry-v1' as const;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');

export function checkFailed2023OriginalArtifact(raw:string){
  if(sha(raw)!==PREVIOUS_2023_PARTIAL_CAPTION_JSON_SHA)
    throw Error('Original 2023 partial-run artifact SHA changed');
  const j=JSON.parse(raw) as {
    schemaVersion:string;year:number;totals:{
      officialOriginalMediaRecordsExpected:number;originalHtmlPagesReverified:number;
      originalHtmlPageFailures:number;pagesWithTimedCaptionRows:number;
    };records:Array<{originalMtgid:string}>;failures:Array<{mtgid:string;hearingDate:string;reason:string}>;
  };
  if(j.schemaVersion!=='senate-2022-25-138-original-media-record-caption-surface-proof-v1'
   ||j.year!==2023||j.totals.officialOriginalMediaRecordsExpected!==64
   ||j.totals.originalHtmlPagesReverified!==62||j.totals.originalHtmlPageFailures!==2
   ||j.totals.pagesWithTimedCaptionRows!==56||j.records.length!==62||j.failures.length!==2
   ||j.failures.some((f,i)=>f.mtgid!==TWO_SOURCE_RETRY[i]!.id||
     f.hearingDate!==TWO_SOURCE_RETRY[i]!.day||f.reason!=='fetch failed')
   ||j.records.some(x=>TWO_SOURCE_RETRY.some(t=>t.id===x.originalMtgid)))
    throw Error('Original 2023 two-failed source identity or failure statuses drifted');
  return j.failures;
}

const clean=(e:unknown)=>(e instanceof Error?e.message:String(e))
  .replace(/https?:\/\/\S+/g,'[original LRL record]').slice(0,160);
async function main(){
  const a=process.argv.slice(2);
  if(a.length!==8||a[0]!=='--source-hrefs'||a[2]!=='--prior-html'||
     a[4]!=='--previous-failed-run'||a[6]!=='--output')
    throw Error('Pass exact --source-hrefs, --prior-html, --previous-failed-run and --output paths');
  const href=resolve(a[1]!),html=resolve(a[3]!),first=resolve(a[5]!),output=resolve(a[7]!);
  const hrefs=selectPinnedMtgidRecords(2023,readFileSync(href,'utf8'));
  const prior=readExactPriorMediaHtmlProof(2023,readFileSync(html,'utf8'));
  const failureIdentity=checkFailed2023OriginalArtifact(readFileSync(first,'utf8'));
  if(hrefs.length!==64||prior.size!==64)throw Error('Official original 2023 source list incomplete');
  const targets=TWO_SOURCE_RETRY.map(t=>{
    const r=hrefs.find(x=>x.mtgid===t.id);
    if(!r||r.committeeName!==t.committee||r.meetingDate!==t.day
      ||r.mediaUrl!=='https://www.lrl.mn.gov/media/file?mtgid='+t.id
      ||!prior.get(t.id))throw Error('Failed 2023 Taxes source not independently confirmed');
    return r;
  });
  const allow=new Set(targets.map(x=>x.mediaUrl));
  const records:Array<Record<string,unknown>>=[];
  const failures:Array<{mtgid:string;hearingDate:string;reason:string}>=[];
  for(const r of targets){
    try{
      const page=await fetchBoundedSenateMediaRecordHtml(r.mediaUrl,allow);
      const surface=inspectMediaPageCaptionSurface(page.html,r.mediaUrl);
      if(surface.pageOriginalHtmlSha256!==prior.get(r.mtgid)!.originalHtmlSha256)
        throw Error('Original 2023 LRL page HTML SHA changed');
      const results=[];
      for(const request of surface.safeRequestCandidates.slice(0,2)){
        try{results.push(await fetchBoundedCaptionEvidence(request.endpointUrl,r.mediaUrl));}
        catch(e){results.push({status:'caption_endpoint_fetch_failed',
          timedCaptionRows:0,originalPayloadSha256:null,originalPayloadBytes:0});}
      }
      records.push({
        year:2023,committeeName:r.committeeName,originalHearingDate:r.meetingDate,
        originalMtgid:r.mtgid,officialOriginalPageUrl:r.mediaUrl,
        originalHtmlSha256:surface.pageOriginalHtmlSha256,
        captionRequestCandidates:surface.totalRequestCandidates,
        safeCaptionRequests:surface.safeRequestCandidates.length,
        captionResponses:results.map(x=>({status:x.status,timedCaptionRows:x.timedCaptionRows,
          originalPayloadSha256:x.originalPayloadSha256,originalPayloadBytes:x.originalPayloadBytes})),
        totalTimedCaptionMarkers:results.reduce((n,x)=>n+x.timedCaptionRows,0),
        originalHtmlPageShaReverified:true,
        noMediaOrTranscriptStored:true,noVoteOrSpeakerCertified:true
      });
    }catch(e){failures.push({mtgid:r.mtgid,hearingDate:r.meetingDate,reason:clean(e)});}
  }
  const report={
    schemaVersion:TWO_SOURCE_RETRY_SCHEMA,issue:864,year:2023,
    sourceOriginalHrefAuditRun:38079233118,
    originalHtmlAuditRun:38081463362,
    previousSourceRunId:38103766440,
    previousFailedRunJsonSha256:PREVIOUS_2023_PARTIAL_CAPTION_JSON_SHA,
    previousFailureIdentity:failureIdentity,expectedOnlyTwoExactOriginals:2,
    reverifiedOriginalHtmlPages:records.length,retryFailures:failures.length,
    records,failures,
    noAudioVideoOrRawCaptionBodiesStored:true,
    captionMarkupNotProofOfSpeakerOrNamedYeaNay:true,
    statewideOfficialRecordedVotesDenominator:null,
    noPrivateDbReadsOrWrites:true,noModelForecastServingSchedulerFloor2027Changes:true,
    issue864MustRemainOpen:true
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({expected:2,htmlVerified:records.length,sourceFailures:failures.length,
    pagesWithTimedCaptionRows:records.filter(r=>Number(r.totalTimedCaptionMarkers)>0).length},null,2));
  if(failures.length)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(e=>{console.error(clean(e));process.exitCode=1});
