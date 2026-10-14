/**
 * #864 2022-25-only Senate committee gaps: primary original government
 * calendar to written Senate Clerk minutes for exact remaining 50 LRL-indexed
 * 2023 no-PDF meetings (other 14 Clerk sources already SHA authenticated).
 * Bounded public-only requests, no data connection, no 2021 research.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {selectMissingMinutesFromExactIndex} from
 '../src/evidence/senate-committee-missing-minutes-official-queue.js';
import {
 type RemainingTarget,validate2023Target,governmentCalendarUrl,
 senateClerkUrl,inspectGovernment2023Calendar,inspect2023OriginalClerk,hash
} from '../src/evidence/senate-864-2023-remaining-clerk-original-source.js';

const IDS:Record<string,string>={
 'Taxes':'26142-0','Agriculture, Broadband and Rural Development':'26143-0',
 'Education Finance':'26140-0','Environment, Climate, and Legacy':'26147-0',
 'Jobs and Economic Development':'26153-0',
};
const CENSUS_SHA='ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0';
const ORIGINAL_2023_CROSSWALK=
 'docs/evaluation/source-proof/senate-864-2023-64-no-lrl-pdf-to-senate-clerk-original-html-crosswalk.json';
const MAX_HTML=2_000_000,WORKERS=3;
const originalKey=(r:{committeeName:string;hearingDate:string})=>
 r.hearingDate+'|'+r.committeeName;
async function safeOriginalHtml(url:string,kind:'calendar'|'minutes'){
 const u=new URL(url);
 const isCal=kind==='calendar'&&u.hostname==='www.leg.mn.gov'&&u.pathname==='/cal'&&
  u.searchParams.size===1&&/^\d{1,2}\/\d{1,2}\/2023$/.test(u.searchParams.get('d1')??'');
 const isMinutes=kind==='minutes'&&u.hostname==='www.senate.mn'&&
  u.pathname==='/schedule/hearing_minutes.html'&&u.searchParams.size===4&&
  u.searchParams.get('ls')==='93'&&u.searchParams.get('type')==='minutes'&&
  u.searchParams.get('always_show_minutes')==='Y'&&
  /^(?:17|18)\d{3}$/.test(u.searchParams.get('hearing_id')??'');
 if(u.protocol!=='https:'||!(isCal||isMinutes))
  throw Error('Disallowed original state-host source address');
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(45000),
  headers:{accept:'text/html,application/xhtml+xml',
   'user-agent':'VotePredict/2.0 committee-2022-25-public-original-Clerk-audit'}});
 if(r.status!==200||r.url!==url||!(/text\/html|application\/xhtml\+xml/i.test(
    r.headers.get('content-type')??'')))
  throw Error('Original state-host HTML HTTP, MIME or redirect hold');
 const contentLength=Number(r.headers.get('content-length'));
 if(Number.isSafeInteger(contentLength)&&contentLength>MAX_HTML)
  throw Error('Official HTML body exceeds bounded source size');
 const reader=r.body?.getReader();if(!reader)throw Error('Official HTML stream absent');
 const parts:Uint8Array[]=[];let n=0;
 try{for(;;){
  const v=await reader.read();if(v.done)break;n+=v.value.byteLength;
  if(n>MAX_HTML)throw Error('Official HTML exceeds stream bound');
  parts.push(v.value);
 }}finally{reader.releaseLock()}
 const b=new Uint8Array(n);let at=0;
 for(const p of parts){b.set(p,at);at+=p.length}
 if(n<1500)throw Error('Official HTML unexpectedly short');
 const html=new TextDecoder('utf-8',{fatal:true}).decode(b);
 if(hash(html)!==hash(b))throw Error('Official original byte vs normalized transport SHA mismatch');
 return {html,originalSha256:hash(b),fetchedAt:new Date().toISOString(),bytes:n};
}
async function pool<T>(items:readonly T[],task:(x:T)=>Promise<void>){
 let next=0;
 await Promise.all(Array.from({length:WORKERS},async()=>{for(;;){
  const x=items[next++];if(x===undefined)return;
  await task(x);
 }}));
}
function safeHold(e:unknown){
 const m=e instanceof Error?e.message:'';
 if(/exact 2023 day|not exact 2023 day|government day calendar|Combined government calendar/i.test(m))
  return 'official_government_calendar_day_or_format_HOLD';
 if(/not independently anchored|same-ID|contradictory|calendar/i.test(m))
  return 'senate_calendar_hearing_identity_HOLD';
 if(/named roll count|uniqueness/.test(m))
  return 'clerk_explicit_named_vote_identity_or_tally_HOLD';
 if(/original heading|original heading|Archived Clerk original|Original Clerk HTML/i.test(m))
  return 'senate_clerk_original_committee_day_or_body_HOLD';
 return 'original_government_html_transport_or_unclassified_HOLD';
}
function official50(original:string){
 const all=selectMissingMinutesFromExactIndex(original);
 const row64=all.filter(r=>r.year===2023&&r.minutesPdfUrls.length===0&&
   r.electronicMinutesStatus==='meeting_without_linked_minutes');
 if(row64.length!==64)throw Error('Original official LRL 2023 64 no-PDF census drift');
 const cross=JSON.parse(readFileSync(ORIGINAL_2023_CROSSWALK,'utf8'));
 if(cross.schemaVersion!=='senate-864-2023-64-no-lrl-linked-pdf-alternate-clerk-html-source-status-v1'||
  cross.year!==2023||cross.indexedWithoutLrlElectronicPdf!==64||
  cross.authenticatedOnlineSenateClerkMinutes!==14||
  cross.remainingUnverifiedViaNewSourceRoute!==50||
  cross.officialLrlOriginalIndexedCensus?.originalJsonSha256!==CENSUS_SHA)
  throw Error('Original 2023 alternate Clerk 64-row crosswalk or LRL source digest drift');
 const known=new Set(row64.map(r=>r.meetingDate+'|'+r.committeeName));
 const seen=new Set<string>();
 const targets:RemainingTarget[]=[];
 let complete=0;
 for(const x of cross.perOfficiallyIndexedMeeting){
  const k=originalKey(x);
  if(x.year!==2023||!known.has(k)||seen.has(k)||
   IDS[x.committeeName]!==x.officialLrlCommitteeId||
   x.originalLrlElectronicMinutesPdfLinkAvailable!==false)
   throw Error('Unmatched original official LRL committee/date/source 2023 crosswalk row');
  seen.add(k);
  if(x.onlineSenateClerkMinutesSourceStatus==='independently_authenticated_original_html'){
   if(!Number.isSafeInteger(x.originalSenateHearingId)||!/^([a-f0-9]{64})$/.test(x.originalSenateHtmlSha256))
    throw Error('Previously authenticated source 2023 Clerk meeting receipt lost');
   complete++;
  }else{
   if(x.onlineSenateClerkMinutesSourceStatus!=='not_yet_authenticated_by_this_alternate_source_route'||
    x.originalSenateHearingId!==null||x.originalSenateHtmlSha256!==null)
    throw Error('Not-yet-authenticated 2023 Clerk meeting became unsupported certainty');
   const t={year:2023,committeeName:x.committeeName,officialLrlCommitteeId:x.officialLrlCommitteeId,
    hearingDate:x.hearingDate,originalLrlElectronicMinutesPdfLinkAvailable:false} as RemainingTarget;
   validate2023Target(t);
   targets.push(t);
  }
 }
 if(seen.size!==64||complete!==14||targets.length!==50)
  throw Error('Official 2023 missing-PDF exact 64/14/50 conservation fails');
 return targets.sort((a,b)=>a.hearingDate.localeCompare(b.hearingDate)||
  a.committeeName.localeCompare(b.committeeName));
}
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==4||a[0]!=='--source-index'||a[2]!=='--output'||!a[1]||!a[3])
  throw Error('Exact original official-index and output are both required');
 const inPath=resolve(a[1]!),outputPath=resolve(a[3]!);
 if(inPath===outputPath)throw Error('Cannot overwrite exact official original source census');
 const source=readFileSync(inPath,'utf8');
 const targets=official50(source);
 const dayInputs=new Map<string,RemainingTarget>();
 for(const t of targets)dayInputs.set(t.hearingDate,t);
 const days=new Map<string,Awaited<ReturnType<typeof safeOriginalHtml>>>();
 const dayHolds=new Set<string>();
 await pool([...dayInputs],async ([day,t])=>{
  try{days.set(day,await safeOriginalHtml(governmentCalendarUrl(t),'calendar'))}
  catch{dayHolds.add(day)}
 });
 const findings:Array<Record<string,unknown>>=[];
 await pool(targets,async t=>{
  const base={year:2023,committeeName:t.committeeName,hearingDate:t.hearingDate,
   officialLrlCommitteeId:t.officialLrlCommitteeId,
   lrlOriginalMinutesPdfLinked:false,originalClerkHistoricalFirstPublicBy:null,
   notProvenToHaveZeroCommitteeVotes:true};
  const calendarOriginal=days.get(t.hearingDate);
  if(!calendarOriginal){
   findings.push({...base,status:'original_government_day_calendar_HOLD',
    sourceGapCategory:'government_calendar_transport_or_format_HOLD',
    calendarSha256:null,exactHearingId:null,clerkOriginal:null});
   return;
  }
  let cal:ReturnType<typeof inspectGovernment2023Calendar>;
  try{cal=inspectGovernment2023Calendar(calendarOriginal.html,t)}
  catch(e){
   findings.push({...base,status:'original_calendar_committee_date_HOLD',
    sourceGapCategory:safeHold(e),calendarSha256:calendarOriginal.originalSha256,
    exactHearingId:null,clerkOriginal:null});
   return;
  }
  const id=cal.matchedHearingId??cal.uniqueSenateAnchorWithoutCard;
  if(id===null){
   findings.push({...base,status:'official_calendar_no_unique_senate_hearing_id_HOLD',
    sourceGapCategory:'committee_specific_senate_hearing_id_unverified',
    calendarSha256:cal.originalCalendarRawSha256,exactHearingId:null,clerkOriginal:null});
   return;
  }
  try{
   const original=await safeOriginalHtml(senateClerkUrl(t,id),'minutes');
   const clerk=inspect2023OriginalClerk(original.html,t,id,cal,original.fetchedAt);
   if(clerk.originalClerkHtmlSha256!==original.originalSha256)
    throw Error('Original Clerk transport SHA and parsed SHA differ');
   findings.push({...base,status:'authenticated_official_senate_clerk_minutes',
    sourceGapCategory:cal.markedCanceled?'calendar_canceled_but_clerk_minutes_recovered_REVIEW':null,
    calendarSha256:cal.originalCalendarRawSha256,
    exactHearingId:id,clerkOriginal:clerk});
  }catch(e){
   findings.push({...base,status:'original_senate_clerk_body_HOLD',
    sourceGapCategory:safeHold(e),calendarSha256:cal.originalCalendarRawSha256,
    exactHearingId:id,clerkOriginal:null});
  }
 });
 findings.sort((a,b)=>String(a.hearingDate).localeCompare(String(b.hearingDate))||
  String(a.committeeName).localeCompare(String(b.committeeName)));
 if(findings.length!==50||new Set(findings.map(x=>x.hearingDate+'|'+x.committeeName)).size!==50)
  throw Error('An original official 2023 indexed no-PDF meeting lost or duplicated');
 const ok=findings.filter(x=>x.status==='authenticated_official_senate_clerk_minutes');
 const named=ok.reduce((n,x)=>n+Number((x.clerkOriginal as any).namedRollCandidates),0);
 const count=ok.reduce((n,x)=>n+Number((x.clerkOriginal as any).countOnlyCandidates),0);
 const result=ok.reduce((n,x)=>n+Number((x.clerkOriginal as any).resultOnlyCandidates),0);
 const choice=ok.reduce((n,x)=>n+Number((x.clerkOriginal as any).printedOriginalNamedChoices),0);
 const byCommittee=Object.keys(IDS).map(c=>({
  year:2023,committeeName:c,
  previouslyMissingClerk:targets.filter(x=>x.committeeName===c).length,
  newlyAuthenticatedClerk:ok.filter(x=>x.committeeName===c).length,
  stillHeld:findings.filter(x=>x.committeeName===c&&x.status!=='authenticated_official_senate_clerk_minutes').length,
  originalNamedRolls:ok.filter(x=>x.committeeName===c).reduce((n,x)=>n+Number((x.clerkOriginal as any).namedRollCandidates),0),
 }));
 const out={
  schemaVersion:'senate-864-2022-25-only-original-2023-fifty-no-LRL-linked-PDF-clerk-crosswalk-v1',
  issue:864,yearScope:[2022,2023,2024,2025],
  excludes2021CommitteeResearch:true,
  originalOfficialLrlCensusJsonSha256:CENSUS_SHA,
  originalElectronic2023NoMinutesMeetingDenominator:64,
  earlierAuthenticated2023ClerkBodies:14,
  separatelySearchedRemaining2023ClerkMeetings:50,
  originalGovernmentCalendarsAuthenticated:days.size,
  originalGovernmentCalendarHolds:dayHolds.size,
  newlyOriginalClerkMinutesAuthenticated:ok.length,
  remaining2023WithoutIndependentlyAuthenticatedAlternateClerk:50-ok.length,
  sourceNamedRollCandidates:named,sourceNamedChoiceOccurrences:choice,
  sourceCountOnlyCandidates:count,sourceResultOnlyCandidates:result,
  originalClerkAllMotionsOfficialDenominatorKnown:false,
  noIndividualVoteMemberIdMapping:true,
  archivedPageHistoricalFirstPublicByUnknown:true,
  noCurrentStoredRowsReconciled:true,
  noProductionDatabaseWritesOrReads:true,
  byCommittee,perOfficiallyIndexedMeeting:findings,
 };
 mkdirSync(dirname(outputPath),{recursive:true});
 writeFileSync(outputPath,JSON.stringify(out,null,2)+'\n');
 console.log('SENATE864_2023_REMAINING_50_ORIGINAL_SOURCES='+JSON.stringify({
  yearScope:'2022-2025',excluded2021:true,
  official2023NoMinutesPdfDenominator:64,previouslyVerifiedClerk:14,
  newOriginalClerk:ok.length,stillHeld:50-ok.length,
  uniqueOriginalGovernmentDays:days.size,sourceNamedRolls:named,
  originalPrintedNamedChoiceOccurrences:choice,sourceCountOnly:count,
  sourceResultOnly:result,committeeBreakdown:byCommittee,
  noDatabaseOperations:true,noFalseZeroVoteInferences:true
 }));
 console.log('SENATE864_2023_REMAINING_50_SOURCE_SHA_RECEIPTS='+JSON.stringify(findings.map(x=>{
  const c=x.clerkOriginal as any;
  return {committeeName:x.committeeName,hearingDate:x.hearingDate,
   status:x.status,category:x.sourceGapCategory,hearingId:x.exactHearingId,
   calendarSha256:x.calendarSha256,clerkHtmlSha256:c?.originalClerkHtmlSha256??null,
   clerkTextSha256:c?.originalClerkNormalizedTextSha256??null,
   namedRolls:c?.namedRollCandidates??null,namedChoices:c?.printedOriginalNamedChoices??null,
   candidateMotions:c?.sourceActionCandidates??null};
 })));
 if(ok.length===0)process.exitCode=1;
}
main().catch(()=>{
 console.error('SENATE864_2023_REMAINING_50_ORIGINAL_SOURCE_PREFLIGHT_OR_PRIVACY_HOLD');
 process.exitCode=1;
});
