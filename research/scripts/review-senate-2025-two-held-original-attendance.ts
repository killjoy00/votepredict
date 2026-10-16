/**
 * #864 two original 2025 Elections held minutes, safe bounded real PDF+text
 * SHA re-download and exact 19-queue source-offset/11-member attendance audit.
 * No private DB, media, upload of names or PDF, nor production vote import.
 */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fetchSenateCommitteeMinutePdf} from '../../src/evidence/minnesota-senate-committee-source.js';
import {loadStrongRollSourceManifest} from
  '../evidence/senate-committee-41-strong-roll-original-review.js';
import {extractSupplementalNamedSenateRollCandidates} from
  '../../src/evidence/senate-committee-supplemental-named-roll-review.js';
import {
  HELD_ELECTIONS_TARGETS,inspect2025HeldOriginalElectionsRoll,
  type HeldElectionDate,
} from '../evidence/senate-2025-elections-two-held-original-attendance.js';

const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const MAX_BYTES=3_000_000,MAX_PAGES=30;
const allowedDates=new Set<string>(Object.keys(HELD_ELECTIONS_TARGETS));
function args(){
 const a=process.argv.slice(2);
 if(a.length!==4 || a[0]!=='--source-json' || a[2]!=='--output')
   throw Error('Require exact --source-json PATH --output PATH');
 return {source:resolve(a[1]!),out:resolve(a[3]!)};
}
function errorLabel(e:unknown){
 return (e instanceof Error?e.message:String(e))
   .replace(/https?:\/\/\S+/gi,'[official URL]').slice(0,175);
}
async function boundedOriginalPdf(url:string,allow:Set<string>,init?:RequestInit){
 if(!allow.has(url))throw Error('Unpinned original PDF request refused');
 const r=await fetch(url,{...init,redirect:'manual'});
 if(r.status!==200||r.url!==url)throw Error('Source original redirected or returned non-200');
 const declared=r.headers.get('content-length');
 if(declared&&Number(declared)>MAX_BYTES)throw Error('PDF declared larger than 3 MiB');
 const reader=r.body?.getReader();
 if(!reader)throw Error('Original PDF response missing streamed body');
 const chunks:Uint8Array[]=[];let size=0;
 try {
  for(;;){
   const item=await reader.read();
   if(item.done)break;
   size+=item.value.byteLength;
   if(size>MAX_BYTES)throw Error('PDF stream exceeded exact byte bound');
   chunks.push(item.value);
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let index=0;
 for(const chunk of chunks){bytes.set(chunk,index);index+=chunk.byteLength}
 if(size<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
  throw Error('Original source is not bounded valid PDF');
 const tmp=mkdtempSync(join(tmpdir(),'senate-two-held-'));
 try{
  const pdf=join(tmp,'original.pdf');writeFileSync(pdf,bytes);
  const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8',timeout:15000,maxBuffer:100_000});
  const pages=Number(info.match(/^Pages:\s*(\d+)\s*$/mi)?.[1]??NaN);
  if(!Number.isInteger(pages)||pages<1||pages>MAX_PAGES)
   throw Error('Original PDF page-count exceeds bounded source check');
 }finally{rmSync(tmp,{recursive:true,force:true})}
 return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}

async function main(){
 const a=args();
 const originals=loadStrongRollSourceManifest(2025,readFileSync(a.source,'utf8'));
 const queue=JSON.parse(readFileSync(new URL(
  '../docs/evaluation/source-proof/senate-committee-19-tally-matched-provisional-roll-review-queue.json',
  import.meta.url),'utf8')) as {
  issue:number;sourceRunId:number;totalCandidateBlocks:number;explicitNamedSourceTokens:number;
  records:Array<{year:number;hearingDate:string;committeeName:string;
   officialSourcePdfUrl:string;sourceTextOffset:number;yeaNamed:number;nayNamed:number;
   sourceNumericTallyMatchesNames:boolean;eligibleAsMemberVote:boolean;}>;
 };
 if(queue.issue!==864||queue.sourceRunId!==38079646647||
    queue.totalCandidateBlocks!==19||queue.explicitNamedSourceTokens!==196||
    queue.records.length!==19)
  throw Error('Historical 19-block source-queue identity changed');
 const target=queue.records.filter(x=>allowedDates.has(x.hearingDate));
 if(target.length!==2||target.some(x=>x.year!==2025||x.committeeName!=='Elections'||
     !x.sourceNumericTallyMatchesNames||x.eligibleAsMemberVote))
  throw Error('Expected exactly two held 2025 Elections source offsets');
 const urls=new Set(target.map(t=>t.officialSourcePdfUrl));
 if(urls.size!==2 || originals.filter(x=>urls.has(x.originalOfficialPdfUrl)).length!==2)
  throw Error('Two original official PDFs not in source SHA pinned strong-roll manifest');
 const results:Array<Record<string,unknown>>=[];
 const failures:Array<{date:string;sourceUrlSha256:string;reason:string}>=[];
 for(const row of [...target].sort((l,r)=>l.hearingDate.localeCompare(r.hearingDate))){
  try {
   const pinned=originals.find(x=>x.originalOfficialPdfUrl===row.officialSourcePdfUrl);
   if(!pinned||pinned.hearingDate!==row.hearingDate||pinned.committeeName!=='Elections')
    throw Error('Original PDF hearing identity differs from indexed source manifest');
   const original=await fetchSenateCommitteeMinutePdf({
    url:pinned.originalOfficialPdfUrl,
    fetchImpl:((input:string|URL|Request,init?:RequestInit)=>{
     const url=input instanceof Request?input.url:String(input);
     return boundedOriginalPdf(url,urls,init);
    }) as typeof fetch,
   });
   if(original.extractionMethod!=='embedded_text' ||
     original.contentSha256!==pinned.originalPdfSha256||
     sha(original.text)!==pinned.extractedTextSha256)
    throw Error('Exact source PDF bytes or extracted text SHA256 changed');
   const all=extractSupplementalNamedSenateRollCandidates(original.text);
   const named=all.find(c=>c.sourceOffset===row.sourceTextOffset &&
     c.namedYeaCount===row.yeaNamed && c.namedNayCount===row.nayNamed);
   if(!named)throw Error('Prior original roll text offset or explicit source names drifted');
   const checked=inspect2025HeldOriginalElectionsRoll({
     originalText:original.text,indexedHearingDate:row.hearingDate as HeldElectionDate,
     candidate:named,
   });
   results.push({
     year:2025,committeeName:'Elections',hearingDate:row.hearingDate,
     officialOriginalPdfUrl:pinned.originalOfficialPdfUrl,
     originalPDFSha256:original.contentSha256,
     extractedOriginalTextSha256:sha(original.text),
     sourcePdfByteCount:original.bytes,
     originalCandidatePassageSha256:named.sourcePassageSnippetSha256,
     ...checked,
     originalSourceReverifiedButMotionSpeakerNotIndependentlyAuthenticated:true,
     sourceIsNotApprovedHistoricalMemberVote:true,
   });
  }catch(e){
   failures.push({date:row.hearingDate,sourceUrlSha256:sha(row.officialSourcePdfUrl),
     reason:errorLabel(e)});
  }
 }
 const report={
  schemaVersion:'senate-2025-two-held-elections-original-date-attendance-v1',
  issue:864,sourceYear:2025,originalStrongRollMetadataRun:38075573031,
  originalSupplementalNamedRollRun:38079646647,
  originalTallyMatchedQueueSha256:sha(readFileSync(new URL(
   '../docs/evaluation/source-proof/senate-committee-19-tally-matched-provisional-roll-review-queue.json',
    import.meta.url))),
  twoOriginalPdfSourcesExpected:2,twoOriginalPdfSourcesSHAReverified:results.length,
  exactSourceRollOffsetsExpected:2,exactSourceRollOffsetsReverified:results.length,
  originalPdfSourceFailures:failures.length,
  totalOriginalNamedYeaNayTokens:results.reduce((n,x)=>
    n+Number(x.explicitNamedYeas)+Number(x.explicitNamedNays),0),
  originalPrintedDateDiscrepancies:results.filter(x=>x.originalHeaderIsNotIndexedHearingDate).length,
  openingRosterAbsenteeNamedChoiceContradictions:results.reduce((n,x)=>
    n+Number(x.sourceOpeningAbsentGivenExplicitYeaOrNay),0),
  records:results,failedOriginals:failures,
  sourceOriginalsOnlyNoRecordedMediaOrIndependentRollAttestation:true,
  officialBillLogsAndVideoMeetingIdentityReviewedSeparatelyNotCodedAsNamedVoteProof:true,
  noOriginalPdfFullTextNamedMemberChoiceArraysCommitted:true,
  noSourceMemberChoicesImputedForUnlistedMembers:true,
  noCandidateApprovedForPersistedMemberVotes:true,
  noPrivateDatabaseReadWrite:true,
  noPredictionModelServingTrainingSchedulerFloorOr2027Changes:true,
 };
 mkdirSync(dirname(a.out),{recursive:true});
 writeFileSync(a.out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({
  originalPdfsVerified:results.length,rolls:results.length,failures:failures.length,
  namedChoices:report.totalOriginalNamedYeaNayTokens,
  printedHeaderDateProblems:report.originalPrintedDateDiscrepancies,
  openingAbsentMemberHasNamedSide:report.openingRosterAbsenteeNamedChoiceContradictions,
  holdsRemain:true,
 },null,2));
 if(failures.length||results.length!==2)process.exitCode=1;
}
main().catch(e=>{console.error(errorLabel(e));process.exitCode=1});
