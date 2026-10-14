/**
 * Minnesota Senate #864 other 24 exact source-unlinked LRL original meetings:
 * all 12 in 2022; 6 outside large selected 53 in 2024; 6 in 2025.
 * No 2021 collection, protected rows, outreach, deployment or forecast.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {selectMissingMinutesFromExactIndex} from
 '../src/evidence/senate-committee-missing-minutes-official-queue.js';
import {
 type OtherOriginalTarget,checkedOtherTarget,otherCalendarUrl,otherClerkUrl,
 inspectOtherCalendar,inspectOtherClerkOriginal
} from '../src/evidence/senate-864-other-24-original-clerk-probe.js';
import {createHash} from 'node:crypto';

const sha=(x:string|Uint8Array)=>createHash('sha256').update(x).digest('hex');
const INDEX_SHA='ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0';
const original141='docs/evaluation/source-proof/senate-committee-141-unlinked-original-meeting-roster.json';
const original53='docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-53-no-pdf-official-index.json';
const key=(r:{year:number;committeeName:string;hearingDate:string})=>
 [r.year,r.committeeName,r.hearingDate].join('|');
function validateOther24(sourceText:string){
 const indexed=selectMissingMinutesFromExactIndex(sourceText).filter(r=>
  r.minutesPdfUrls.length===0&&r.electronicMinutesStatus==='meeting_without_linked_minutes');
 if(indexed.length!==141)throw Error('Exact original 141 indexed no-LRL-PDF government scope drift');
 const frozen=JSON.parse(readFileSync(original141,'utf8'));
 const large=JSON.parse(readFileSync(original53,'utf8'));
 if(frozen.originalIndexedCensus?.originalJsonSha256!==INDEX_SHA||
  large.original141NoMinutesRoster?.originalCensusJsonSha256!==INDEX_SHA||
  large.meetings.length!==53)
  throw Error('2022-25 LRL original 141/53 independently pinned source SHA drift');
 const frozen141=frozen.meetingGroups.flatMap((g:any)=>
  g.missingMinutesMeetingDates.map((md:string)=>({
   year:g.year,committeeName:g.committeeName,
   hearingDate:g.year+'-'+md,officialIndexCommitteeId:g.officialIndexCommitteeId
  })));
 const key141=new Set(frozen141.map(key));
 if(key141.size!==141||indexed.some(r=>!key141.has(key({
  year:r.year,committeeName:r.committeeName,hearingDate:r.meetingDate
 }))))
  throw Error('Original 141 LRL independently indexed committee-days do not reconcile');
 const skip53=new Set(large.meetings.map(key));
 if(skip53.size!==53||large.meetings.some((r:any)=>!key141.has(key(r))))
  throw Error('Large 53 original meeting selection source misjoin');
 const left:OtherOriginalTarget[]=[];
 for(const r of frozen141){
  if(r.year===2023||skip53.has(key(r)))continue;
  if(![2022,2024,2025].includes(r.year))throw Error('Unsupported historical year');
  const t:OtherOriginalTarget={
   year:r.year,committeeName:r.committeeName,officialIndexCommitteeId:r.officialIndexCommitteeId,
   hearingDate:r.hearingDate,originalLrlMinutesPdfLinked:false
  };
  checkedOtherTarget(t);
  left.push(t);
 }
 const by=[2022,2024,2025].map(y=>left.filter(x=>x.year===y).length);
 if(left.length!==24||new Set(left.map(key)).size!==24||
  JSON.stringify(by)!=='[12,6,6]')
  throw Error('Unproven 2022/2024/2025 other 24 meeting denominator');
 return left.sort((a,b)=>a.year-b.year||a.hearingDate.localeCompare(b.hearingDate)||
  a.committeeName.localeCompare(b.committeeName));
}
async function fetchOfficial(url:string,kind:'calendar'|'minutes',year:number){
 const u=new URL(url);
 const calendar=kind==='calendar'&&u.hostname==='www.leg.mn.gov'&&u.pathname==='/cal'&&
  u.searchParams.size===1&&new RegExp('^\\d{1,2}\\/\\d{1,2}\\/'+year+'$').test(
   u.searchParams.get('d1')??'');
 const minutes=kind==='minutes'&&u.hostname==='www.senate.mn'&&
  u.pathname==='/schedule/hearing_minutes.html'&&u.searchParams.size===4&&
  u.searchParams.get('ls')===String(year===2022?92:year===2024?93:94)&&
  u.searchParams.get('always_show_minutes')==='Y'&&u.searchParams.get('type')==='minutes'&&
  /^\d{5}$/.test(u.searchParams.get('hearing_id')??'');
 if(u.protocol!=='https:'||!(calendar||minutes))
  throw Error('Nonallowlisted Minnesota legislature official original source URL');
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(45000),
  headers:{accept:'text/html,application/xhtml+xml',
   'user-agent':'VotePredict/2.0 original-Senate-2022-25-other-24-source-only'}});
 if(r.status!==200||r.url!==url||
  !/text\/html|application\/xhtml\+xml/i.test(r.headers.get('content-type')??''))
  throw Error('Original Minnesota Legislature/Senate HTML response status, MIME, redirect HOLD');
 const size=Number(r.headers.get('content-length'));
 if(Number.isFinite(size)&&size>2_000_000)
  throw Error('Original government HTML content length cap');
 const reader=r.body?.getReader();if(!reader)throw Error('Original government HTML stream absent');
 const parts:Uint8Array[]=[];let n=0;
 try{for(;;){
  const item=await reader.read();if(item.done)break;
  n+=item.value.byteLength;
  if(n>2_000_000)throw Error('Original government HTML stream cap');
  parts.push(item.value);
 }}finally{reader.releaseLock()}
 const raw=new Uint8Array(n);let off=0;
 for(const p of parts){raw.set(p,off);off+=p.length}
 if(n<1500)throw Error('Original government body too short');
 const html=new TextDecoder('utf-8',{fatal:true}).decode(raw);
 if(sha(raw)!==sha(html))throw Error('Original source transport bytes differ from UTF8');
 return {html,sha256:sha(raw),retrievedAt:new Date().toISOString()};
}
async function pool<T>(arr:readonly T[],fn:(x:T)=>Promise<void>){
 let next=0;
 await Promise.all(Array.from({length:3},async()=>{for(;;){
  const x=arr[next++];if(x===undefined)return;await fn(x);
 }}));
}
function holdCategory(error:unknown){
 const text=error instanceof Error?error.message:'';
 if(/out-of-year|anchor|card|hearing ID|legislative day/.test(text))
  return 'official_senate_calendar_hearing_id_or_day_HOLD';
 if(/Clerk date|Clerk HTML|named Clerk/.test(text))
  return 'official_clerk_html_missing_heading_or_named_vote_HOLD';
 return 'original_government_source_transport_or_integrity_HOLD';
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==4||args[0]!=='--source-index'||args[2]!=='--output'||!args[1]||!args[3])
  throw Error('Only --source-index exact official census and --output');
 const source=resolve(args[1]),dest=resolve(args[3]);
 if(source===dest)throw Error('Cannot overwrite official government original index');
 const targets=validateOther24(readFileSync(source,'utf8'));
 const dayInput=new Map<string,OtherOriginalTarget>();
 for(const t of targets)dayInput.set(t.hearingDate,t);
 const governmentDays=new Map<string,Awaited<ReturnType<typeof fetchOfficial>>>();
 await pool([...dayInput],async ([date,t])=>{
  try{governmentDays.set(date,await fetchOfficial(otherCalendarUrl(t),'calendar',t.year))}
  catch{/* Original government day HOLD remains visible in per-meeting ledger */}
 });
 const findings:Array<Record<string,unknown>>=[];
 await pool(targets,async t=>{
  const base={
   year:t.year,committeeName:t.committeeName,officialIndexCommitteeId:t.officialIndexCommitteeId,
   hearingDate:t.hearingDate,originalLrlMinutesPdfLinked:false,
   originalPublicationByExactDayIndependentlyProven:false,
   noActualMeetingOrMotionZeroInferred:true
  };
  const day=governmentDays.get(t.hearingDate);
  if(!day){
   findings.push({...base,status:'original_calendar_not_authenticated_HOLD',
    hearingId:null,calendarSha256:null,clerkOriginal:null,
    gapCategory:'official_day_calendar_transport_or_integrity_HOLD'});
   return;
  }
  let calendar:ReturnType<typeof inspectOtherCalendar>;
  try{calendar=inspectOtherCalendar(day.html,t)}
  catch(e){
   findings.push({...base,status:'official_day_calendar_identity_HOLD',
    hearingId:null,calendarSha256:day.sha256,clerkOriginal:null,gapCategory:holdCategory(e)});
   return;
  }
  const id=calendar.verifiedHearingId??calendar.soloAnchorPendingOriginalBody;
  if(id===null){
   findings.push({...base,status:'official_no_unique_senate_hearing_id_HOLD',
    hearingId:null,calendarSha256:day.sha256,clerkOriginal:null,
    gapCategory:'official_committee_specific_hearing_id_not_independently_proven'});
   return;
  }
  try{
   const bytes=await fetchOfficial(otherClerkUrl(t,id),'minutes',t.year);
   const clerk=inspectOtherClerkOriginal(bytes.html,t,id,calendar,bytes.retrievedAt);
   if(clerk.originalClerkHtmlSha256!==bytes.sha256)
    throw Error('Original Clerk source SHA differed from its original transport bytes');
   findings.push({...base,status:'original_senate_clerk_body_authenticated',
    hearingId:id,calendarSha256:day.sha256,clerkOriginal:clerk,
    gapCategory:null});
  }catch(e){
   findings.push({...base,status:'original_senate_clerk_body_HOLD',
    hearingId:id,calendarSha256:day.sha256,clerkOriginal:null,
    gapCategory:holdCategory(e)});
  }
 });
 findings.sort((a,b)=>Number(a.year)-Number(b.year)||
  String(a.hearingDate).localeCompare(String(b.hearingDate))||
  String(a.committeeName).localeCompare(String(b.committeeName)));
 if(findings.length!==24||
  new Set(findings.map(x=>[x.year,x.committeeName,x.hearingDate].join('|'))).size!==24)
  throw Error('One-to-one 24 original LRL meeting identities failed');
 const recovered=findings.filter(x=>x.status==='original_senate_clerk_body_authenticated');
 const byYear=[2022,2024,2025].map(y=>({
  year:y,originalIndexedUnlinkedMeetings:targets.filter(x=>x.year===y).length,
  recoveredOriginalSenateClerkHtml:recovered.filter(x=>x.year===y).length,
  stillUnverifiedOriginalClerk:findings.filter(x=>x.year===y&&x.status!=='original_senate_clerk_body_authenticated').length,
  sourceRecordedMotionResultCues:recovered.filter(x=>x.year===y)
   .reduce((n,x)=>n+Number((x.clerkOriginal as any).originalRecordedOutcomeTextSignals),0),
  explicitPrintedNamedRollBlocks:recovered.filter(x=>x.year===y)
   .reduce((n,x)=>n+Number((x.clerkOriginal as any).separatelyPrintedNamedYeaNayBlocks),0),
 }));
 const out={
  schemaVersion:'senate-864-2022-25-other-24-original-government-calendar-clerk-meeting-ledger-v1',
  issue:864,activeYearScope:[2022,2023,2024,2025],
  excludes2021CompletelyFromNewResearch:true,
  independentOriginalLRLCensusSha256:INDEX_SHA,
  totalNoLinkedLRLMinutesMeetings2022to2025:141,
  previouslySelected2023NoPdfCohortExcluded:64,
  previouslySelectedThreeHighGap2024to2025Excluded:53,
  remaining24OriginallyIndexedUnlinkedMeetings:24,
  uniqueOriginalGovernmentCalendarDaysObtained:governmentDays.size,
  authenticatedOriginalSenateClerkMinutes:recovered.length,
  stillUnverifiedSenateClerkMinutes:24-recovered.length,
  byYear,perOfficiallyIndexedMeeting:findings,
  unknownOfficialAllMeetingAndRecordedMotionUniverse:true,
  paper2022PrintElectronicFullParityNotProven:true,
  no2021PrintResearch:true,
  noSourceMemberIdOrPersistedRowParity:true,
  historicSourceFirstPublicByDateUnknown:true,
  noProductionDatabaseWritesOrReads:true,
 };
 mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,JSON.stringify(out,null,2)+'\n');
 console.log('SENATE864_OTHER_24_OFFICIAL_CLERK_SOURCES='+JSON.stringify({
  activeScope:'2022-2025',officialOther24:24,originalGovernmentDayBodies:governmentDays.size,
  originalClerkHtmlAuthenticated:recovered.length,held:24-recovered.length,
  byYear,namedMemberIdRowsCreated:0,noDatabaseActivity:true,no2021Research:true
 }));
 console.log('SENATE864_OTHER_24_PUBLIC_SHA_RECEIPTS='+JSON.stringify(findings.map(x=>{
  const r=x.clerkOriginal as any;
  return {year:x.year,committee:x.committeeName,hearingDate:x.hearingDate,
   status:x.status,gapCategory:x.gapCategory,
   originalHearingId:x.hearingId,calendarSha256:x.calendarSha256,
   clerkHtmlSha256:r?.originalClerkHtmlSha256??null,
   clerkTextSha256:r?.originalClerkTextSha256??null,
   motionResultCues:r?.originalRecordedOutcomeTextSignals??null,
   sourceNamedRollBlocks:r?.separatelyPrintedNamedYeaNayBlocks??null};
 })));
 // A zero-recovery job can still produce a valid audited HOLD ledger. Fail
 // only if source preflight/output integrity breaks, not if print-only records.
}
main().catch(()=>{
 console.error('SENATE864_OTHER_24_SOURCE_PROOF_PREFLIGHT_OR_OUTPUT_HOLD');
 process.exitCode=1;
});
