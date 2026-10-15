/**
 * #864 public-original-only source acquisition for the remaining 29
 * 2022–25 indexed Senate committee dates without authenticated written minutes.
 * Recover archive paths of the form /YYYYMMDDmorning/...Minutes-morning.pdf
 * and /YYYYMMDDevening/...Minutes.pdf omitted by the legacy strict parser.
 * Index-page link AND unchanged original PDF AND printed committee/day required.
 * No Neon, production rows, member-id inference, future-year work or outreach.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {parseSenateCommitteeIndexHtml,fetchSenateCommitteeMinutePdf} from
 '../src/evidence/minnesota-senate-committee-source.js';
import {parseSenateCommitteeMinuteVotes,parseSenateCommitteeMinuteContextActions}
 from '../src/evidence/minnesota-senate-committee-minutes.js';
import {check29HeldOriginalMeetings,inspectOtherOriginalLrlCommitteePdfUrls,
 validateOriginalAlternatePdfText,type HeldSenateMeeting,type CandidateMinutePdf} from
 '../src/evidence/senate-864-nonstandard-lrl-minutes-source.js';
const sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const INDEX_SHA='ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0';
const ROOT='docs/evaluation/source-proof/senate-864-2022-25-141-official-no-pdf-meeting-to-Clerk-crosswalk.json';
function original29(){
 const raw=readFileSync(ROOT,'utf8');
 if(raw.length<3000||raw.length>350_000)throw Error('Source index crosswalk outside bounded proof size');
 const j=JSON.parse(raw);
 if(j.originalLrlIndexSourceSha256!==INDEX_SHA||j.originalLrlIndexMeetings!==1592||
  j.originalNoLinkedMinuteMeetings!==141||
  j.independentlyAuthenticatedOriginalClerkHtmlMeetings!==111||
  j.stillWithoutAuthenticatedWrittenMinutes!==29)
  throw Error('Official 2022–25 electronic LRL index and Clerk baseline drift');
 const all=j.perOriginallyIndexedNoPdfMeeting as HeldSenateMeeting[];
 if(all.length!==141)throw Error('Original 141 indexed missing-PDF rows absent');
 return check29HeldOriginalMeetings(all.filter(x=>x.sourceClass===
  'no_written_minutes_authenticated_through_independent_routes'));
}
async function html(url:string):Promise<string>{
 const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(25_000),
  headers:{accept:'text/html', 'user-agent':'VotePredict/2.0 committee-original-minutes-research'}});
 const requested=new URL(url),landed=new URL(r.url);
 if(r.status!==200||landed.protocol!=='https:'||
  !['www.lrl.mn.gov','lrl.mn.gov'].includes(landed.hostname)||
  !['/minutes/default','/minutes/comm','/minutes/comm.aspx'].includes(landed.pathname)||
  !(requested.pathname==='/minutes/default'&&landed.pathname==='/minutes/default'&&
    landed.searchParams.get('year')===requested.searchParams.get('year')&&
    landed.searchParams.get('body')==='senate')&&
  !(requested.pathname.startsWith('/minutes/comm')&&landed.pathname.startsWith('/minutes/comm')&&
    landed.searchParams.get('year')===requested.searchParams.get('year')&&
    landed.searchParams.get('commid')===requested.searchParams.get('commid')))
   throw Error('Official LRL page unavailable or redirected to an unrelated page');
 const length=r.headers.get('content-length');
 if(length!==null&&Number(length)>2_000_000)throw Error('Original government HTML exceeded byte cap');
 const body=await r.text();
 if(body.length<1000||body.length>2_000_000)throw Error('Bounded government HTML failed');
 return body;
}
async function minutePdf(url:string){
 const urlObj=new URL(url);
 if(urlObj.protocol!=='https:'||!['www.lrl.mn.gov','lrl.mn.gov'].includes(urlObj.hostname)||
  !/^\/archive\/minutes\/senate\/202[2-5]\//.test(urlObj.pathname)||
  !/minutes[^/]*\.pdf$/i.test(urlObj.pathname)||urlObj.search||urlObj.hash)
  throw Error('Alternative original PDF URL outside government scope');
 return fetchSenateCommitteeMinutePdf({url,fetchImpl:(async(_url,init)=>{
  const r=await fetch(url,{...init,redirect:'manual',
   signal:AbortSignal.timeout(35_000)});
  if(r.status!==200)throw Error('Original government PDF unavailable');
  if(Number(r.headers.get('content-length')??0)>8_000_000)
   throw Error('Original PDF metadata exceeds byte cap');
  if(!r.body)throw Error('Original PDF has no byte stream');
  const reader=r.body.getReader(),parts:Uint8Array[]=[];let size=0;
  try{
   for(;;){const item=await reader.read();if(item.done)break;
    size+=item.value.byteLength;
    if(size>8_000_000)throw Error('Original PDF byte stream exceeded safe cap');
    parts.push(item.value);
   }
  }finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let cursor=0;
  for(const p of parts){bytes.set(p,cursor);cursor+=p.length}
  if(bytes.length<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
   throw Error('Original alternate body is not a genuine PDF');
  return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
 }) as typeof fetch});
}
async function main(){
 if(process.argv.length!==4||process.argv[2]!=='--output'||!process.argv[3])
  throw Error('Use only --output FILE');
 const output=resolve(process.argv[3]);
 const targets=original29();
 const years=new Map<number,ReturnType<typeof parseSenateCommitteeIndexHtml>>();
 const indexProofs=[] as Array<{year:number,governmentIndexUrl:string,htmlSha256:string,committeeCount:number}>;
 for(const y of [2022,2023,2024,2025] as const){
  const url='https://www.lrl.mn.gov/minutes/default?body=senate&year='+y;
  const body=await html(url);
  const pages=parseSenateCommitteeIndexHtml({year:y,html:body,sourceUrl:url});
  if(pages.length<3||pages.length>60)throw Error('Official Senate LRL year index missing');
  years.set(y,pages);
  indexProofs.push({year:y,governmentIndexUrl:url,htmlSha256:sha(body),committeeCount:pages.length});
 }
 const pageCache=new Map<string,{body:string,sourceSha:string}>();
 let pagesHeld=0,sourceDocsVerified=0;
 const out=[];
 for(const t of targets){
  const key=t.year+'|'+t.committeeName;
  const candidates=years.get(t.year)?.filter(p=>p.committeeName===t.committeeName)??[];
  let pageHeldReason:string|null=null;
  let links:CandidateMinutePdf[]=[];
  if(candidates.length!==1){
   pageHeldReason='committee_identity_not_unique_in_original_official_year_index';
   pagesHeld++;
  }else{
   try{
    let page=pageCache.get(key);
    if(!page){
     const body=await html(candidates[0]!.url);
     page={body,sourceSha:sha(body)};pageCache.set(key,page);
    }
    links=inspectOtherOriginalLrlCommitteePdfUrls({
     year:t.year as 2022|2023|2024|2025,committeeName:t.committeeName,
     meetingDate:t.hearingDate,lrlCommitteePageUrl:candidates[0]!.url,html:page.body
    });
   }catch{pageHeldReason='official_committee_page_transport_or_identity_hold';pagesHeld++}
  }
  const docs=[];
  for(const l of links){
   try{
    const result=await minutePdf(l.sourceUrl);
    const printed=validateOriginalAlternatePdfText({
     year:l.year,committeeName:t.committeeName,meetingDate:t.hearingDate,
     originalText:result.text
    });
    const named=parseSenateCommitteeMinuteVotes(result.text);
    const namedOnly=named.filter(x=>x.individualVotesAvailable);
    const context=parseSenateCommitteeMinuteContextActions(result.text);
    docs.push({
     originalSourceUrl:l.sourceUrl,originalPdfSha256:result.contentSha256,
     originalPdfBytes:result.bytes,extractedOriginalTextSha256:sha(result.text),
     sourceArchiveDateDirectory:l.sourceArchiveDateDirectory,
     omittedByOldDirectoryOrFilenameSelector:l.recoveredFromNonstandardArchivePath,
     printedOfficialCommitteeAndDayVerified:printed.officialExactCommitteeAndDayPrinted,
     indexedOriginalMinuteDate:t.hearingDate,
     extractionMethod:result.extractionMethod,
     sourceNamedRollCandidates:namedOnly.length,
     sourcePrintedNamedChoiceOccurrences:namedOnly.reduce((n,r)=>n+r.memberVotes.length,0),
     sourceCountOnlyRollCandidates:named.filter(x=>!x.individualVotesAvailable).length,
     sourceContextCandidates:context.length,
     sourceVoiceCandidates:context.filter(x=>x.actionKind==='voice_vote').length,
     sourceResultOnlyCandidates:context.filter(x=>x.actionKind==='motion_result_only').length,
     sourceIndividualHistoricalMemberIdJoinPerformed:false,
     sourceToStoredRowParityPerformed:false
    });
    sourceDocsVerified++;
   }catch{
    docs.push({originalSourceUrl:l.sourceUrl,
     originalPdfSha256:null,originalPdfBytes:null,
     status:'original_lrl_link_exists_but_pdf_transport_or_printed_identity_HOLD'});
   }
  }
  out.push({
   year:t.year,committeeName:t.committeeName,hearingDate:t.hearingDate,
   sourceStatus:docs.some(d=>d.originalPdfSha256)?
    'independently_authenticated_alternative_original_lrl_pdf':
    pageHeldReason??(links.length?
     'linked_original_lrl_pdf_unverified':'no_original_alternate_lrl_pdf_link_on_government_page'),
   originalLrlCommitteePage:candidates.length===1?candidates[0]!.url:null,
   committeePageOriginalHtmlSha256:pageCache.get(key)?.sourceSha??null,
   originallyNotLinkedOrAuthenticatedIn141Crosswalk:true,
   originalMinutePdfCandidatesFound:links.length,originalMinutePdfsAuthenticated:
    docs.filter(d=>d.originalPdfSha256).length,
   originalPdfDocuments:docs,
  });
 }
 const complete=out.filter(x=>x.originalMinutePdfsAuthenticated>0);
 const body={
  schemaVersion:'senate-864-original-29-gap-alternate-path-lrl-pdf-source-v1',
  issue:864,yearScope:[2022,2023,2024,2025],
  knownOriginalIndexed2022_25Meetings:1592,
  priorShaAuthenticatedWrittenMinuteDays:1563,
  exactGovernmentPreviouslyUnwrittenMinuteDates:29,
  governmentYearIndexSourceProofs:indexProofs,
  committeeYearPagesAuthenticated:pageCache.size,committeePageHolds:pagesHeld,
  newlyAuthenticatedOriginalPdfBodies:sourceDocsVerified,
  newlyAuthenticatedOriginalWrittenMinuteDays:complete.length,
  cumulativeOriginalWrittenMinuteDays:1563+complete.length,
  remainingIndexedMinutesDocumentGaps:29-complete.length,
  originalExactPublicationDayProven:false,
  sourceCandidateActionsNotAllMotions:true,
  noHistoricalPersonIdInferredFromAttendanceVoiceOrCounts:true,
  noProdDatabaseReadWriteOrModelChanges:true,
  meetingDocuments:out,
 };
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(body,null,2)+'\n');
 console.log('SENATE864_ALTERNATE_OFFICIAL_LRL_29_SOURCE_SUMMARY='+JSON.stringify({
  exactIndexedDays:29,officialCommitteePagesFetched:pageCache.size,
  pagesHeld,newlyVerifiedWrittenMinuteDays:complete.length,
  originalPdfBodies:sourceDocsVerified,stillHeld:29-complete.length,
  newlyProvenDays:complete.map(x=>({day:x.hearingDate,committee:x.committeeName,
   pdfs:x.originalPdfDocuments.filter(d=>d.originalPdfSha256).map(d=>({
    url:d.originalSourceUrl,sha:d.originalPdfSha256,bytes:d.originalPdfBytes,
    named:d.sourceNamedRollCandidates,counts:d.sourceCountOnlyRollCandidates,
    context:d.sourceContextCandidates
   }))}))
 }));
}
void main().catch(error=>{
 const safeErrors=new Set([
  'Source index crosswalk outside bounded proof size','Official 2022–25 electronic LRL index and Clerk baseline drift',
  'Original 141 indexed missing-PDF rows absent','Official Senate LRL year index missing',
  'Use only --output FILE'
 ]);
 const message=error instanceof Error?error.message:'';
 console.error('SENATE864_ALTERNATE_OFFICIAL_LRL_SOURCE_FATAL='+(
  safeErrors.has(message)?message.replace(/\s/g,'_'):'original_transport_or_source_identity_hold'));
 process.exitCode=1;
});
