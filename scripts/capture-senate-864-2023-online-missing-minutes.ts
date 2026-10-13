/**
 * Public-only #864: original Minnesota Senate ONLINE Clerk hearing minutes for
 * exact LRL indexed 2023 no-PDF meetings. This is a DIFFERENT government
 * source family from LRL file?mtgid media/caption pages.
 *
 * Inputs: exact original SHA-pinned 2022-25 LRL official meeting census,
 * source URL allowlist/code-reviewed 14 hearing IDs; no private database.
 *
 * node --import tsx scripts/capture-senate-864-2023-online-missing-minutes.ts
 *   --source-index artifacts/senate-2021-25-official-meeting-census.json
 *   --output artifacts/2023-original-online-senate-minute-motion-ledger.json
 */
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {
 SENATE_MISSING_MINUTES_SOURCE,
 selectMissingMinutesFromExactIndex,
} from '../src/evidence/senate-committee-missing-minutes-official-queue.js';
import {
 SENATE_864_ONLINE_MISSING_MINUTE_TARGETS,
 inspectOriginalSenateOnlineMinutes,
 exactOfficialSenateOnlineMinutesURL,
 validateOnline2023TargetsAgainstOfficialNoPdfCensus,
} from '../src/evidence/senate-864-2023-online-missing-minutes.js';

const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const MAX_HTML=1_200_000;
const MAX_ROWS=14;
const WORKERS=2;
const sanitize=(error:unknown)=>{
 const s=error instanceof Error?error.message:String(error);
 const safe=new Set([
  'Original official Senate HTML missing or outside byte bounds',
  'Original Senate Clerk Minutes committee/day/attendance heading not verified',
  'Original hearing title and calendar day not adjacent',
  'Ambiguous duplicate source hearing heading',
  'Original official Minutes omitted required independently discovered motion results',
 ]);
 return safe.has(s)?s:'original_source_transport_or_content_HOLD';
};
async function officialHtml(url:string):Promise<{html:string,receivedAt:string}>{
 const req=new URL(url);
 if(req.protocol!=='https:'||req.hostname!=='www.senate.mn'||
    req.pathname!=='/schedule/hearing_minutes.html'||req.searchParams.size!==4||
    req.searchParams.get('ls')!=='93'||
    req.searchParams.get('always_show_minutes')!=='Y'||
    req.searchParams.get('type')!=='minutes'||
    !/^\d{5}$/.test(req.searchParams.get('hearing_id')??''))
   throw Error('Out-of-scope official Senate original HTML request');
 const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(35_000),
  headers:{accept:'text/html,application/xhtml+xml',
   'user-agent':'VotePredict/2.0 original-Senate-online-2023-no-LRL-Minutes-source-only'}});
 if(response.status!==200||new URL(response.url).toString()!==url)
  throw Error('Unexpected source HTTP status or redirect');
 const contentType=response.headers.get('content-type')??'';
 if(!/text\/html|application\/xhtml\+xml/i.test(contentType))
  throw Error('Not original Senate HTML');
 const length=Number(response.headers.get('content-length'));
 if(Number.isFinite(length)&&length>MAX_HTML)throw Error('Original HTML content-length overflow');
 const reader=response.body?.getReader();
 if(!reader)throw Error('Original Senate HTML response stream unavailable');
 let sum=0;
 const parts:Uint8Array[]=[];
 try{
  for(;;){
   const next=await reader.read();
   if(next.done)break;
   sum+=next.value.byteLength;
   if(sum>MAX_HTML)throw Error('Original Senate HTML streamed size cap');
   parts.push(next.value);
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(sum);let at=0;
 for(const p of parts){bytes.set(p,at);at+=p.length}
 if(sum<1500)throw Error('Original Senate HTML unexpectedly short');
 const html=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(sha(bytes)!==sha(new TextEncoder().encode(html)))
  throw Error('Original official HTML UTF8 SHA differs from text bytes');
 return {html,receivedAt:new Date().toISOString()};
}
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==4||a[0]!=='--source-index'||a[2]!=='--output'||
    !a[1]||!a[3]||a[1]===a[3])
  throw Error('Require exact original source index and output arguments');
 const input=resolve(a[1]),dest=resolve(a[3]);
 if(input===dest)throw Error('Output must not overwrite original source evidence');
 const originalText=readFileSync(input,'utf8');
 // Verify exact prior government-index original whole-body SHA before any web
 // call. The upstream selector also verifies original ordered 141-missing SHA.
 const selected=selectMissingMinutesFromExactIndex(originalText);
 const counts=validateOnline2023TargetsAgainstOfficialNoPdfCensus(
  SENATE_864_ONLINE_MISSING_MINUTE_TARGETS,selected);
 const ok:ReturnType<typeof inspectOriginalSenateOnlineMinutes>[]=[];
 const held:{committeeName:string,hearingDate:string,category:string}[]=[];
 let next=0;
 await Promise.all(Array.from({length:WORKERS},async()=>{
  for(;;){
   const target=SENATE_864_ONLINE_MISSING_MINUTE_TARGETS[next++];
   if(!target)return;
   try{
    const source=await officialHtml(exactOfficialSenateOnlineMinutesURL(target));
    ok.push(inspectOriginalSenateOnlineMinutes(source.html,target,source.receivedAt));
   }catch(error){
    held.push({committeeName:target.committeeName,hearingDate:target.day,
     category:sanitize(error)});
   }
  }
 }));
 ok.sort((x,y)=>x.hearingDate.localeCompare(y.hearingDate)||
  x.committeeName.localeCompare(y.committeeName));
 held.sort((x,y)=>x.hearingDate.localeCompare(y.hearingDate)||
  x.committeeName.localeCompare(y.committeeName));
 const recovered=ok.length,actions=ok.reduce((n,r)=>n+r.actions.length,0);
 const report={
  schemaVersion:'senate-864-2023-no-lrl-linked-pdf-official-senate-online-source-recovery-v1',
  issue:864,originalLrlIndexSourceRun:SENATE_MISSING_MINUTES_SOURCE.originalRunId,
  originalLrlIndexArtifact:SENATE_MISSING_MINUTES_SOURCE.originalArtifactId,
  originalLrlIndexJsonSha256:SENATE_MISSING_MINUTES_SOURCE.originalJsonSha256,
  lrl2023NoMinutesMeetingDenominator:counts.indexedWithoutLrlMinutes,
  boundedOriginalSenateOnlineHearingTargets:MAX_ROWS,
  independentSenateOnlineMinutesRecovered:recovered,
  officialSenateOnlineHtmlFailures:held.length,
  distinctSourceResultOnlyActionCandidates:actions,
  originalElectronicLrlPdfLinksStillMissingForTargets:MAX_ROWS,
  sourceOriginalPublicByTimestampsIndependentlyProven:0,
  namedMemberVotesRecoveredByThisResultOnlyParser:0,
  originalHtmlSourceDocuments:ok,
  unresolvedOnlineHtmlTargets:held,
  notAnOfficialAllMotionOrCommitteeMeetingDenominator:true,
  memberPositionCannotBeInferredFromAttendanceOrPassedMotion:true,
  sourceOriginalPublishedByNotProven:true,
  original2021PrintAnd2022PrintElectronicHold:true,
  sourceToExistingDatabaseRowIdentityUnproven:true,
  noSourceTextOrOriginalPrivateNamedVoteSidesExported:true,
  noProductionDbReadWriteOrModelServingChanges:true,
  noExternalOfficeContact:true,
 };
 // Original motion micro-excerpts are from public clerk's minutes and
 // reviewed against their original whole HTML SHA. Not attendance names,
 // donor/source private rows, member vote positions, transcripts or videos.
 const body=JSON.stringify(report);
 if(body.length>250000||/normalized_member_name|choiceIdentitySha256|membership_id|rawHtmlBody/i.test(body))
  throw Error('Unsafe source-level public metadata would be emitted');
 mkdirSync(dirname(dest),{recursive:true});
 writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
 console.log('SENATE_864_ONLINE_2023_SOURCE_RECOVERY='+JSON.stringify({
  independentNoPdfMeetingDenominator:counts.indexedWithoutLrlMinutes,
  targetedHearingMinutes:MAX_ROWS,originalSenateHtmlRecovered:recovered,
  verifiedResultOnlyActionCandidates:actions,
  sourcesHeld:held.length,
  individualPositionsInferred:false,
  existingDatabaseAccess:false,allHistoryComplete:false
 }));
 if(recovered!==MAX_ROWS||held.length||actions<16)process.exitCode=1;
}
main().catch(()=>{
 console.error('SENATE_864_ONLINE_SENATE_2023_ORIGINAL_SOURCE_HOLD=preflight_or_output_safety');
 process.exitCode=1;
});
