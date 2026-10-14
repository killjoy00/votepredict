/**
 * #864 - a different original government-source class for no-Clerk-body
 * committee hearings: official archived MN Legislative Reference Library
 * Senate committee bill logs. Bill/action status and hearing date only.
 * NOT meeting minutes, exact parliamentary motions, roll-call proof,
 * individual voter attribution, or first-public-by-date authentication.
 *
 * Commands:
 * node --import tsx scripts/reconcile-senate-864-high-gap-original-bill-logs.ts
 *   --selected-53 docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-53-no-pdf-official-index.json
 *   --output artifacts/senate-864-high-gap-original-bill-log-supplement.json
 */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {reconcileExact53HighGapRoster,type HighGapTarget} from
 '../src/evidence/senate-864-2024-25-three-high-gap-clerk-source.js';

const sha=(raw:string|Uint8Array)=>createHash('sha256').update(raw).digest('hex');
const HEADERS=[{
 year:2024,committeeName:'Taxes',
 originalOfficialUrl:'https://www.lrl.mn.gov/archive/minutes/senate/2024/taxes/taxes_2024_Bill-Log.pdf',
 expectedSourcePdfTitle:'Minnesota Senate Committee Bill Log',
 originalTextCommitteeHeader:'Committee on Taxes',
 targetDays:['2024-03-07','2024-04-03','2024-04-04','2024-04-09','2024-04-16',
  '2024-04-17','2024-04-18','2024-04-25','2024-05-01','2024-05-02','2024-05-07'],
},{
 year:2025,committeeName:'Energy, Utilities, Environment, and Climate',
 originalOfficialUrl:'https://www.lrl.mn.gov/archive/minutes/senate/2025/energy/energy_2025_Bill-Log.pdf',
 expectedSourcePdfTitle:'Minnesota Senate Committee Bill Log',
 originalTextCommitteeHeader:'Committee on Energy',
 targetDays:['2025-04-02','2025-04-07','2025-04-09'],
}] as const;
export const SENATE864_OFFICIAL_LOG_SOURCES=HEADERS;
type LogOriginal=typeof HEADERS[number];
export type OriginalBillLogRow={
 hearingDate:string;billReference:string;printedBillPage:number;
 sourceStatusExcerpt:string;originalContextSha256:string;
 sourceLogEntryTextOffset:number;sourceLogActionClass:
 'amended_or_recommended'|'laid_over'|'discussion_only'|'not_heard'|
 'canceled'|'other_official_bill_status';
 individualMemberVoteAttributionProven:false;
 parliamentaryMotionIdentityProven:false;
 officialBillLogStatusNotIdenticalToClerkMinutes:true;
};
export function inspectOriginalOfficialSenateBillLogText(
 text:string,source:LogOriginal,selection:readonly string[]
){
 const count=Buffer.byteLength(text,'utf8');
 if(count<2000||count>4_000_000||
   !text.includes(source.expectedSourcePdfTitle)||
   !text.includes(source.originalTextCommitteeHeader))
  throw Error('Original government bill-log PDF text, title or committee source HOLD');
 const desired=new Set(selection);
 if(selection.length!==new Set(selection).size||
  selection.some(d=>!source.targetDays.some(allowed=>allowed===d)))
  throw Error('Prohibited unrelated source-day request');
 const billRx=/^\s*([SH])\s*\.\s*F\s*\.\s*(\d{3,5})\s*:/gim;
 const bills=[...text.matchAll(billRx)].filter(x=>x.index!==undefined);
 if(bills.length<15||bills.length>1700)
  throw Error('Official government bill-log source has impossible bill section count');
 const normalized=text.replace(/\r/g,'');
 const actions:OriginalBillLogRow[]=[];
 for(let i=0;i<bills.length;i++){
  const head=bills[i]!;
  const start=head.index!;
  const stop=bills[i+1]?.index??text.length;
  const section=normalized.slice(start,stop);
  const billRef=head[1]!.toUpperCase()+'F'+Number(head[2]);
  if(!new RegExp('UNOFFICIAL\\s+STATUS\\s+FOR\\s+'+billRef.replace('SF','S\\\\s*F').replace('HF','H\\\\s*F'),'i').test(section)&&
     !/\bUNOFFICIAL STATUS FOR [SH]F/i.test(section))
    continue;
  const days=[...section.matchAll(/^\s*(\d{2}\/\d{2}\/20\d{2})\s+([^\n]*)/gm)];
  for(let j=0;j<days.length;j++){
   const date=days[j]![1]!, [mm,dd,yyyy]=date.split('/');
   const iso=yyyy+'-'+mm+'-'+dd;
   if(!desired.has(iso))continue;
   const offset=start+(days[j]!.index??0);
   const end=days[j+1]?.index??section.length;
   const raw=section.slice(days[j]!.index??0,end);
   const context=raw.split(/\n/).map(s=>s.trim()).filter(Boolean)
    .filter(s=>!/^(?:https?:\/\/|Minnesota State Senate|[0-9]+\/[0-9]+\/[0-9]+,|Meeting scheduled for|DATE\s+UNOFFICIAL STATUS|[0-9]+\/[0-9]+\/[0-9]+\s+Minnesota)/i.test(s));
   const trimmed=context.map(s=>s.replace(/^\d\d\/\d\d\/\d{4}\s*/,'')).join(' ')
    .replace(/\s+/g,' ').trim().slice(0,380);
   if(!trimmed)continue; // official hearing detail alone does NOT prove bill handling
   const cls:OriginalBillLogRow['sourceLogActionClass']=
    /cancell?ed/i.test(trimmed)?'canceled':
    /\bnot heard\b/i.test(trimmed)?'not_heard':
    /\bdiscussion only\b/i.test(trimmed)?'discussion_only':
    /amended|recommended/i.test(trimmed)?'amended_or_recommended':
    /laid over/i.test(trimmed)?'laid_over':'other_official_bill_status';
   actions.push({
    hearingDate:iso,billReference:billRef,
    printedBillPage:1+text.slice(0,start).split('\f').length-1,
    sourceStatusExcerpt:trimmed,originalContextSha256:sha(raw),
    sourceLogEntryTextOffset:offset,sourceLogActionClass:cls,
    individualMemberVoteAttributionProven:false,
    parliamentaryMotionIdentityProven:false,
    officialBillLogStatusNotIdenticalToClerkMinutes:true
   });
  }
 }
 const seen=new Set<string>();
 for(const a of actions){
  const k=a.hearingDate+'|'+a.billReference+'|'+a.sourceLogEntryTextOffset;
  if(seen.has(k))throw Error('Duplicate official source bill log/date/status');
  seen.add(k);
 }
 actions.sort((a,b)=>a.hearingDate.localeCompare(b.hearingDate)||
  a.billReference.localeCompare(b.billReference)||a.sourceLogEntryTextOffset-b.sourceLogEntryTextOffset);
 const byDay=selection.map(d=>({
  hearingDate:d,sourceBillStatusRows:actions.filter(x=>x.hearingDate===d).length,
  originalLogStatusIsNotProofOfAnyRecordedRollCall:true,
  noBillStatusInSourceDoesNotEstablishNoCommitteeAction:true
 }));
 return {
  year:source.year,committeeName:source.committeeName,
  originalOfficialBillLogUrl:source.originalOfficialUrl,
  extractedSourceTextLength:count,
  extractedTextSha256:sha(text),
  originalBillSectionsSeen:bills.length,
  selectedOfficialNoClerkMinutesDates:selection.length,
  recoveredBillLogDateStatusRows:actions.length,
  sourceLogBillStatuses:actions,byDay,
  noNamedVotesOrMeetingMinutesInferred:true,
  historicBillLogPublicByDateUnknown:true,
 };
}
async function boundedOriginalPdf(url:string){
 const u=new URL(url);
 if(u.protocol!=='https:'||u.hostname!=='www.lrl.mn.gov'||
   !HEADERS.some(x=>x.originalOfficialUrl===url))
  throw Error('Refusing unreviewed Minnesota government bill-log source URL');
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(55000),
  headers:{accept:'application/pdf',
   'user-agent':'VotePredict/2.0 official-Senate-committee-historic-bill-log-source-audit'}});
 if(r.status!==200||new URL(r.url).toString()!==url)
  throw Error('Original official LRL PDF source HTTP/redirect HOLD');
 const header=Number(r.headers.get('content-length'));
 if(Number.isFinite(header)&&header>9_000_000)throw Error('Government bill-log PDF declared oversized');
 const reader=r.body?.getReader();if(!reader)throw Error('Government original PDF bytes unavailable');
 const parts:Uint8Array[]=[];let n=0;
 try{for(;;){const chunk=await reader.read();if(chunk.done)break;
  n+=chunk.value.byteLength;if(n>9_000_000)throw Error('Government original PDF size bound');
  parts.push(chunk.value);
 }}finally{reader.releaseLock()}
 const body=new Uint8Array(n);let offset=0;
 for(const p of parts){body.set(p,offset);offset+=p.byteLength}
 if(n<2500||new TextDecoder().decode(body.subarray(0,5))!=='%PDF-')
  throw Error('Original LRL bill-log source not a valid bounded PDF');
 return {body,bytes:n,sha256:sha(body),fetchedAt:new Date().toISOString()};
}
function extractSourcePdf(body:Uint8Array){
 const folder=mkdtempSync(join(tmpdir(),'senate-864-log-'));
 try{
  const path=join(folder,'original.pdf');writeFileSync(path,body);
  const metadata=execFileSync('pdfinfo',[path],{encoding:'utf8',timeout:25000});
  const pages=Number(metadata.match(/^Pages:\s*(\d+)/mi)?.[1]);
  if(!Number.isSafeInteger(pages)||pages<2||pages>150)
   throw Error('Government original Senate bill-log PDF page count HOLD');
  const text=execFileSync('pdftotext',['-layout',path,'-'],{
   encoding:'utf8',timeout:75000,maxBuffer:5_000_000
  });
  return {text,pages};
 }finally{rmSync(folder,{recursive:true,force:true})}
}
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==4||a[0]!=='--selected-53'||a[2]!=='--output'||!a[1]||!a[3])
  throw Error('Only --selected-53 original scope and --output source ledger');
 const p=resolve(a[1]!),out=resolve(a[3]!);
 if(p===out)throw Error('Cannot overwrite original official LRL census');
 const selected=JSON.parse(readFileSync(p,'utf8')) as {meetings:HighGapTarget[];schemaVersion:string};
 if(selected.schemaVersion!=='senate-864-2024-25-three-high-gap-official-unlinked-meeting-roster-v1')
  throw Error('Wrong immutable original LRL indexed meeting universe');
 reconcileExact53HighGapRoster(selected.meetings);
 const docs=[] as Array<Record<string,unknown>>;
 const holds=[] as Array<{year:number;committeeName:string;category:string}>;
 for(const source of HEADERS){
  const matched=selected.meetings.filter(x=>x.year===source.year&&x.committeeName===source.committeeName);
  for(const day of source.targetDays)
   if(matched.filter(x=>x.hearingDate===day).length!==1)
    throw Error('Original official supplemental bill-log day is not in exact government 53 no-Minutes-PDF index');
  try{
   const downloaded=await boundedOriginalPdf(source.originalOfficialUrl);
   const extracted=extractSourcePdf(downloaded.body);
   const reviewed=inspectOriginalOfficialSenateBillLogText(extracted.text,source,source.targetDays);
   docs.push({...reviewed,originalOfficialPdfSha256:downloaded.sha256,
    originalOfficialPdfBytes:downloaded.bytes,originalOfficialPdfPages:extracted.pages,
    originalPdfFetchedAt:downloaded.fetchedAt});
  }catch(e){
   const detail=e instanceof Error?e.message:'';
   const category=/HTTP\/redirect/i.test(detail)?'original_pdf_http_or_official_redirect_HOLD':
    /MIME|PDF size bound|PDF declared oversized/i.test(detail)?'original_pdf_response_format_or_size_HOLD':
    /text, title or committee source/i.test(detail)?'original_pdf_extracted_text_heading_HOLD':
    /bill section count/i.test(detail)?'original_pdf_bill_sections_HOLD':
    /page count/i.test(detail)?'original_pdf_pagecount_HOLD':
    /not a valid bounded PDF/i.test(detail)?'original_pdf_invalid_pdf_header_HOLD':
    /ENOENT|spawn|pdftotext|pdfinfo/i.test(detail)?'original_pdf_extraction_executable_HOLD':
    'original_pdf_transport_or_unclassified_integrity_HOLD';
   holds.push({year:source.year,committeeName:source.committeeName,category});
  }
 }
 const byDay=HEADERS.flatMap(source=>{
  const original=docs.find(x=>x.year===source.year&&x.committeeName===source.committeeName);
  return source.targetDays.map(day=>({
   year:source.year,committeeName:source.committeeName,hearingDate:day,
   originalOfficialBillLogSourceAvailable:Boolean(original),
   loggedBillHandlingRows:original?((original.byDay as any[]).find(x=>x.hearingDate===day)?.sourceBillStatusRows??null):null,
   missingClerkMinutesOriginalBodyStillUnresolved:true,
   noVoiceRollNamedChoiceFromBillLog:true,
   officialBillLogIsUnverifiedPublicByForHistoricalCutoff:true,
  }));
 });
 const sum=docs.reduce((n,x)=>n+Number(x.recoveredBillLogDateStatusRows),0);
 const output={
  schemaVersion:'senate-864-2024-25-14-no-Clerk-original-dates-official-bill-log-provisional-actions-v1',
  issue:864,targetedSourceGroups:2,targetedPreviouslyUnresolvedClerkOriginalMeetings:14,
  retrievedOriginalPdfAndTextProofs:docs.length,officialOriginalPdfSourceHolds:holds,
  targetDaysWithOriginalGovernmentBillLogRetrieved:byDay.filter(x=>x.originalOfficialBillLogSourceAvailable).length,
  selectedBillDateStatusRecords:sum,
  originalLRLIndexedMeetingsNotOfficialVotes:true,
  governmentBillLogIsUnofficialHandlingNotFullClerkMotionOrRollProof:true,
  sourceTimestampsAre2026OriginalRetrievalNotHistoricalFirstPublicBy:true,
  noIndividualVoteSidesInferredOrDatabaseAccess:true,
  docs,byDay
 };
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(output,null,2)+'\n');
 console.log('SENATE864_ORIGINAL_HIGH_GAP_GOVERNMENT_BILL_LOGS='+JSON.stringify({
  selectedUnresolvedOriginalClerkMeetings:14,
  originalOfficialPdfBodiesAndTextAuthenticated:docs.length,
  sourcePdfHolds:holds.length,
  sourcesHeldByReviewedSafeCategory:holds,
  exactOriginalBillStatusRows:sum,
  byYear:docs.map(x=>({year:x.year,sourcePdfSha256:x.originalOfficialPdfSha256,
    pages:x.originalOfficialPdfPages,bytes:x.originalOfficialPdfBytes,
    verifiedBillDateRows:x.recoveredBillLogDateStatusRows,
    daysWithStatus:(x.byDay as any[]).filter(d=>d.sourceBillStatusRows>0).length
  })),
  namedVoterChoicesAdded:0,noProductionDbWritesOrReads:true,fullMotionDenominatorCertified:false
 }));
 if(docs.length!==HEADERS.length)process.exitCode=1;
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/reconcile-senate-864-high-gap-original-bill-logs.ts')){
 main().catch(()=>{
  console.error('SENATE864_ORIGINAL_HIGH_GAP_BILL_LOG_SOURCE_HOLD=preflight_or_source_integrity');
  process.exitCode=1;
 });
}
