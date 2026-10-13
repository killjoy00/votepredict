/**
 * #864 owner-scoped source-only three-high-gap 2024/25 written Clerk Minutes.
 * First independently replay exact original LRL government 141-no-PDF census.
 * Then fetch original Legislature calendar date with identified hearing ID,
 * then the exact official Senate printed online Clerk minutes for that ID.
 *
 * No private DB, source member choice names, roster matching, replay/rekey,
 * forecast/train, scheduler, deployment, or outside contact.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {
 SENATE_MISSING_MINUTES_SOURCE,
 selectMissingMinutesFromExactIndex,
} from '../src/evidence/senate-committee-missing-minutes-official-queue.js';
import {
 reconcileExact53HighGapRoster,inspectOriginalGovernmentCombinedDay,
 inspectOriginalHighGapSenateClerkHtml,originalSenateClerkMinutesUrl,
 legislatureCombinedCalendarUrl,type HighGapTarget
} from '../src/evidence/senate-864-2024-25-three-high-gap-clerk-source.js';

const sha=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const ORIGINAL_BYTES=2_000_000;
const RETRIES=2;
const WORKERS=3;
type Incoming=HighGapTarget&{clerkMinutesSourceStatus:string;originalClerkMinutesHtmlSha256:null};
function safeCategory(e:unknown):string{
 const s=e instanceof Error?e.message:'unknown_source_failure';
 if(/combined calendar original day|Original Minnesota Legislature combined calendar/i.test(s))
  return 'government_day_content_identity_HOLD';
 if(/No historical|not independently established|Senate Clerk printed committee/i.test(s))
  return 'original_senate_clerk_identity_or_missing_minutes_body_HOLD';
 if(/Ambiguous|duplicated|duplicate|Same Senate ID/i.test(s))
  return 'government_calendar_duplicate_identity_HOLD';
 if(/Archived Minnesota Senate original Clerk minutes/i.test(s))
  return 'senate_clerk_original_missing_or_invalid_HOLD';
 return 'original_official_source_transport_or_shape_HOLD';
}
async function fetchOfficialHtml(url:string,origin:'calendar'|'minutes'){
 const u=new URL(url);
 const allowed=origin==='calendar'?
  u.hostname==='www.leg.mn.gov'&&u.pathname==='/cal'&&
   u.searchParams.size===1&&u.searchParams.has('d1'):
  u.hostname==='www.senate.mn'&&u.pathname==='/schedule/hearing_minutes.html'&&
   u.searchParams.size===4&&u.searchParams.get('always_show_minutes')==='Y'&&
   u.searchParams.get('type')==='minutes'&&
   ['93','94'].includes(u.searchParams.get('ls')??'')&&
   /^\d{5}$/.test(u.searchParams.get('hearing_id')??'');
 if(u.protocol!=='https:'||!allowed)throw Error('Unreviewed original government-source URL');
 let last:unknown;
 for(let n=0;n<RETRIES;n++){
  try{
   const res=await fetch(url,{redirect:'manual',
    headers:{accept:'text/html,application/xhtml+xml',
     'user-agent':'VotePredict/2.0 bounded-2024-25-Senate-committee-Clerk-minute-original-research'},
    signal:AbortSignal.timeout(40000)});
   if(res.status!==200||new URL(res.url).toString()!==url)
    throw Error('Original government body non-200 or redirected');
   const mime=res.headers.get('content-type')??'';
   if(!/text\/html|application\/xhtml\+xml/i.test(mime))
    throw Error('Original government body MIME not HTML');
   const header=Number(res.headers.get('content-length'));
   if(Number.isFinite(header)&&header>ORIGINAL_BYTES)throw Error('Original government body declared oversized');
   const rd=res.body?.getReader();
   if(!rd)throw Error('Original government body stream missing');
   const chunks:Uint8Array[]=[];let count=0;
   try{
    for(;;){
     const part=await rd.read();if(part.done)break;
     count+=part.value.byteLength;
     if(count>ORIGINAL_BYTES)throw Error('Original government body streamed oversized');
     chunks.push(part.value);
    }
   }finally{rd.releaseLock()}
   if(count<1500)throw Error('Original government body too short');
   const buf=new Uint8Array(count);let offset=0;
   for(const p of chunks){buf.set(p,offset);offset+=p.length}
   const html=new TextDecoder('utf-8',{fatal:true}).decode(buf);
   if(sha(buf)!==sha(new TextEncoder().encode(html)))
    throw Error('Original government HTML UTF8 bytes changed in decoding');
   return {html,sha256:sha(buf),bytes:count,retrievedAt:new Date().toISOString()};
  }catch(e){
   last=e;
   // No follow-up on unexpected response-content/identity failures. Retry
   // only transient network or server errors after an unchanged request.
   const s=e instanceof Error?e.message:'';
   if(/MIME|oversized|too short|UTF8|Unreviewed|redirected/.test(s))break;
  }
 }
 throw last instanceof Error?last:Error('Original government source network failure');
}
function sourceArgs(){
 const a=process.argv.slice(2);
 if(a.length!==6||a[0]!=='--source-index'||a[2]!=='--selected-53'||a[4]!=='--output'||!a[1]||!a[3]||!a[5])
  throw Error('Only --source-index ORIGINAL --selected-53 SCOPE --output REPORT allowed');
 const paths=[a[1],a[3],a[5]].map(resolve);
 if(new Set(paths).size!==3)throw Error('Do not overwrite original evidence inputs');
 return paths;
}
async function runPool<T>(values:readonly T[],fun:(x:T)=>Promise<void>,max=WORKERS){
 let index=0;
 await Promise.all(Array.from({length:Math.min(max,values.length)},async()=>{
  for(;;){
   const next=values[index++];if(!next)return;
   await fun(next);
  }
 }));
}
async function main(){
 const [officialIndex,chosen,out]=sourceArgs();
 const originalIndex=readFileSync(officialIndex,'utf8');
 const missing=selectMissingMinutesFromExactIndex(originalIndex);
 const selectedJson=JSON.parse(readFileSync(chosen,'utf8')) as {
  schemaVersion:string;totalIndexedMissingOriginalMinutesLinkedPdf:number;
  original141NoMinutesRoster:{originalCensusJsonSha256:string};
  meetings:Incoming[];
 };
 if(selectedJson.schemaVersion!=='senate-864-2024-25-three-high-gap-official-unlinked-meeting-roster-v1'||
    selectedJson.original141NoMinutesRoster.originalCensusJsonSha256!==SENATE_MISSING_MINUTES_SOURCE.originalJsonSha256||
    selectedJson.totalIndexedMissingOriginalMinutesLinkedPdf!==53)
  throw Error('Original high-gap source universe not independently verified');
 const sourceRows=selectedJson.meetings;
 reconcileExact53HighGapRoster(sourceRows);
 const lookup=new Map(missing.map(x=>[
  [x.year,x.committeeName,x.meetingDate,x.committeeUrl.split('commid=')[1]?.split('&')[0]].join('|'),x
 ]));
 for(const x of sourceRows){
  const k=[x.year,x.committeeName,x.hearingDate,x.officialIndexCommitteeId].join('|');
  if(!lookup.has(k))throw Error('Selected 53 original meetings do not join authentic LRL original 141 no-PDF roster');
 }
 const groups=[...new Set(sourceRows.map(x=>x.hearingDate))].sort();
 const days=new Map<string,Awaited<ReturnType<typeof fetchOfficialHtml>>>();
 const dayHolds:Array<{hearingDate:string;reason:string}>=[];
 await runPool(groups,async d=>{
  const t=sourceRows.find(x=>x.hearingDate===d)!;
  try{days.set(d,await fetchOfficialHtml(legislatureCombinedCalendarUrl(t),'calendar'))}
  catch(e){dayHolds.push({hearingDate:d,reason:safeCategory(e)})}
 });
 const rows:Array<Record<string,unknown>>=[];
 let idx=0;
 await runPool(sourceRows,async t=>{
  const base={
   year:t.year,hearingDate:t.hearingDate,committeeName:t.committeeName,
   officialIndexCommitteeId:t.officialIndexCommitteeId,
   originalLrlMinutesPdfLinked:false,
   noHearingOrNoVoteInferred:false,
   historicFirstPublicationOnUnproved:true,
  };
  const day=days.get(t.hearingDate);
  if(!day){
   rows.push({...base,status:'government_calendar_original_source_HOLD',
    governmentCalendarHtmlSha256:null,senateOriginalHtmlSha256:null,
    hearingId:null,provisionalActions:[],sourceGapCategory:'calendar_transport_or_source_integrity_HOLD'});
   return;
  }
  let calendar:ReturnType<typeof inspectOriginalGovernmentCombinedDay>;
  try{calendar=inspectOriginalGovernmentCombinedDay(day.html,t)}
  catch(e){
   rows.push({...base,status:'government_calendar_exact_day_or_committee_HOLD',
    governmentCalendarHtmlSha256:day.sha256,hearingId:null,senateOriginalHtmlSha256:null,
    provisionalActions:[],sourceGapCategory:safeCategory(e)});
   return;
  }
  if(calendar.exactOfficialHearingId===null){
   rows.push({...base,status:'calendar_hearing_id_ambiguous_or_unlisted_HOLD',
    governmentCalendarHtmlSha256:day.sha256,calendar,
    hearingId:null,senateOriginalHtmlSha256:null,provisionalActions:[],
    sourceGapCategory:'no_unique_original_calendar_senate_committee_day_id'});
   return;
  }
  const hearingId=calendar.exactOfficialHearingId;
  try{
   const url=originalSenateClerkMinutesUrl(t,hearingId);
   const clerk=await fetchOfficialHtml(url,'minutes');
   const result=inspectOriginalHighGapSenateClerkHtml(
    clerk.html,t,hearingId,calendar,clerk.retrievedAt);
   if(result.originalClerkHtmlSha256!==clerk.sha256)
    throw Error('Independent public Clerk SHA content evidence mismatch');
   rows.push({...base,status:'independently_authenticated_original_senate_clerk_minutes',
    hearingId,calendar,senateOriginalHtmlSha256:clerk.sha256,senateOriginal:result,
    sourceGapCategory:calendar.calendarMarkedCanceled?
       'calendar_canceled_but_clerk_minutes_exist_identity_review_HOLD':null});
  }catch(e){
   rows.push({...base,status:'official_calendar_id_but_clerk_original_minutes_HOLD',
    governmentCalendarHtmlSha256:day.sha256,calendar,hearingId,
    senateOriginalHtmlSha256:null,provisionalActions:[],
    sourceGapCategory:safeCategory(e)});
  }
 });
 const sort=(a:Record<string,unknown>,b:Record<string,unknown>)=>
  Number(a.year)-Number(b.year)||
  String(a.committeeName).localeCompare(String(b.committeeName))||
  String(a.hearingDate).localeCompare(String(b.hearingDate));
 rows.sort(sort);
 if(rows.length!==53||new Set(rows.map(x=>[x.year,x.committeeName,x.hearingDate].join('|'))).size!==53)
  throw Error('One-to-one original 53-meeting source crosswalk dropped or duplicated');
 const authenticated=rows.filter(x=>x.status==='independently_authenticated_original_senate_clerk_minutes');
 const withId=rows.filter(x=>x.hearingId!==null);
 const actions=authenticated.reduce((n,x)=>n+(x.senateOriginal as any).canonicalMotionCandidates,0);
 const tally=authenticated.reduce((n,x)=>n+(x.senateOriginal as any).classificationCounts.countOnly,0);
 const voice=authenticated.reduce((n,x)=>n+(x.senateOriginal as any).classificationCounts.voiceAmendment,0);
 const resultOnly=actions-tally-voice;
 const cohorts=([
  {year:2024,committeeName:'Taxes',n:23},
  {year:2024,committeeName:'State and Local Government and Veterans',n:13},
  {year:2025,committeeName:'Energy, Utilities, Environment, and Climate',n:17},
 ] as const).map(c=>{
  const these=rows.filter(x=>x.year===c.year&&x.committeeName===c.committeeName);
  if(these.length!==c.n)throw Error('Exact original official 2024/2025 committee-year census drift');
  const yes=these.filter(x=>x.status==='independently_authenticated_original_senate_clerk_minutes');
  return {year:c.year,committeeName:c.committeeName,
   officialLrlIndexWithoutMinutesPdf:c.n,
   independentCalendarHearingIdsFound:these.filter(x=>x.hearingId!==null).length,
   originalClerkMinutesHtmlAuthenticated:yes.length,
   originalSourceCalendarOrClerkHolds:c.n-yes.length,
   originalCalendarCanceledAndClerkBodyBothAuthenticated:yes.filter(x=>(x.senateOriginal as any).exactCalendarMarkedCanceled).length,
   sourceMotionCandidates:yes.reduce((n,x)=>n+(x.senateOriginal as any).canonicalMotionCandidates,0),
   officialAllRecordedActionsDenominator:null,
   originalSenatorIndividualVoteSidesInferred:0
  };
 });
 const report={
  schemaVersion:'senate-864-2024-25-three-high-gap-original-calendar-to-clerk-source-reconciliation-v1',
  issue:864,
  sourceDateForAudit:new Date().toISOString().slice(0,10),
  officialLRLIndexedMeetingOriginalRun:38065594898,
  officialLRLCensusOriginalSha256:SENATE_MISSING_MINUTES_SOURCE.originalJsonSha256,
  selected53MeetingsSourceFile:chosen.split('/').at(-1),
  totalOriginalLRLNoLinkedMinutesMeetingsTargeted:53,
  uniqueOriginalGovernmentCalendarDates:groups.length,
  uniqueOriginalGovernmentCalendarDaysFetched:days.size,
  originalCalendarSourceTransportHolds:dayHolds,
  originalCalendarHearingIdentitiesRecovered:withId.length,
  independentlySourceAuthenticatedSenateOnlineClerkMinutes:authenticated.length,
  originalCalendarAndClerkGapsStillUnresolved:53-authenticated.length,
  originalCalendarCancellationVsArchivedClerkMinutesConflicts:authenticated.filter(x=>(x.senateOriginal as any).exactCalendarMarkedCanceled).length,
  recognizedNonExhaustiveSourceActionCandidates:actions,
  recognizedResultOnlyActions:resultOnly,recognizedCountOnlyRollCalls:tally,
  recognizedVoiceAmendmentCues:voice,
  originalLrlNoPdfMeetingsCannotBeCalledNoVoteOrNoMinutes:true,
  originalHtmlFirstPublicByDatesKnown:0,
  actionHearingDayRulePreservedWithSameDayCutoffHold:true,
  noVoterSidesInferredFromAnyAggregateAttendanceVoiceOrResult:true,
  noProductionDbReadWriteOrParserPositionalRekey:true,
  noModelRetrainingOrDeployOrSchedule:true,
  excludes2023UnverifiedAnd2022PrintGap:true,
  officialAllMotionDenominatorNotCertified:true,
  cohorts,originalMeetingSourceCrosswalk:rows
 };
 const payload=JSON.stringify(report);
 if(payload.length>1_400_000||/normalizedMemberName|choiceIdentitySha256|rawHtmlBody|storedMemberVoteId/i.test(payload))
  throw Error('Original public ledger output exceeds safe size or identity limit');
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log('SENATE864_53_LARGE_SOURCE_RESEARCH='+JSON.stringify({
  indexed53:53,uniqueCalendarDaysFetched:days.size,
  originalOfficialCalendarIdsResolved:withId.length,
  sourceAuthenticatedClerkMinutes:authenticated.length,
  sourceHolds:53-authenticated.length,actionCandidates:actions,
  resultOnly,aggregateCountOnly:tally,voiceCues:voice,
  canceledCalendarVsClerkBody:report.originalCalendarCancellationVsArchivedClerkMinutesConflicts,
  cohorts:cohorts.map(x=>({year:x.year,committee:x.committeeName,
   originalMinutes:x.originalClerkMinutesHtmlAuthenticated,
   missingStill:x.originalSourceCalendarOrClerkHolds,
   candidateActions:x.sourceMotionCandidates})),
  memberVotesAssigned:0,noDbOrProductionOperations:true,
  officialMeetingMotionCompletenessCertified:false,
 }));
 // Original hashes and date + hearing IDs without full Clerk HTML are safe
 // to retain if the short-lived CI source-motion artifact expires.
 console.log('SENATE864_53_ORIGINAL_DOC_SHA_RECEIPTS='+JSON.stringify(
  rows.map(r=>({
   year:r.year,committeeName:r.committeeName,hearingDate:r.hearingDate,
   status:r.status,originalHearingId:r.hearingId??null,
   calendarSha:(r.calendar as any)?.calendarOriginalHtmlSha256??r.governmentCalendarHtmlSha256??null,
   senateClerkHtmlSha:r.senateOriginalHtmlSha256??null,
   senateClerkTextSha:(r.senateOriginal as any)?.normalizedOriginalClerkTextSha256??null,
   clerkOriginalHtmlBytes:(r.senateOriginal as any)?.originalClerkHtmlBytes??null,
   actionCandidates:(r.senateOriginal as any)?.canonicalMotionCandidates??null,
   resultOnly:(r.senateOriginal as any)?.classificationCounts?.resultOnly??null,
   countOnly:(r.senateOriginal as any)?.classificationCounts?.countOnly??null,
   voice:(r.senateOriginal as any)?.classificationCounts?.voiceAmendment??null,
   canceledAndClerkProven:(r.senateOriginal as any)?.calendarCanceledAndSenateClerkMinutesBodyBothPresent??null,
  }))
 ));
 if(days.size<Math.min(10,groups.length)||authenticated.length===0)
  process.exitCode=1;
}
main().catch(()=>{
 console.error('SENATE864_53_SOURCE_AUDIT_HOLD=preflight_or_internal_evidence_safety');
 process.exitCode=1;
});
