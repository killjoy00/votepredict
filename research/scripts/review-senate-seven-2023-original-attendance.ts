/**
 * One-time #864: exact original PDFs behind the nine highest-risk no-label
 * committee PDFs; compare original attendance sections against YEA/NAY.
 * Seven source originals only, no private DB, serving or forecast.
 */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fetchSenateCommitteeMinutePdf} from '../../src/evidence/minnesota-senate-committee-source.js';
import {
  extractNineSourceIndividualRolls,selectNinePinnedSourceRollOriginals,
} from '../../src/evidence/senate-committee-nine-no-label-counted-rolls.js';
import {inspect2023OriginalElectionRollDateAndAttendance,parse2023ElectionsOriginalMeetingAttendance}
 from '../evidence/senate-committee-2023-elections-attendance-headers.js';
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const MAX_BYTES=3_000_000,MAX_PAGES=30;
function args(){
 const a=process.argv.slice(2);
 if(a.length!==6||a[0]!=='--source-json'||a[2]!=='--source-queue-json'||a[4]!=='--output')
   throw Error('Exact --source-json PATH --source-queue-json PATH --output PATH');
 return {source:resolve(a[1]!),queue:resolve(a[3]!),out:resolve(a[5]!)};
}
function safe(e:unknown){
 return (e instanceof Error?e.message:String(e))
  .replace(/https?:\/\/\S+/gi,'[official PDF]').slice(0,160);
}
async function fixedOfficialPdf(url:string,allowed:ReadonlySet<string>,init?:RequestInit){
 if(!allowed.has(url))throw Error('Original PDF outside exact nine source identities');
 const r=await fetch(url,{...init,redirect:'manual'});
 if(r.status!==200||r.url!==url)throw Error('Official source PDF redirect or HTTP status drift');
 const len=r.headers.get('content-length');
 if(len&&Number(len)>MAX_BYTES)throw Error('Original PDF exceeds declared byte cap');
 const reader=r.body?.getReader();if(!reader)throw Error('Original PDF body missing');
 let count=0;const arr:Uint8Array[]=[];
 try{
  for(;;){const p=await reader.read();if(p.done)break;
   count+=p.value.byteLength;
   if(count>MAX_BYTES)throw Error('Original PDF streamed bytes cap exceeded');
   arr.push(p.value);
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(count);let i=0;
 for(const b of arr){bytes.set(b,i);i+=b.byteLength}
 if(count<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
  throw Error('Original Senate minutes source is not PDF');
 const dir=mkdtempSync(join(tmpdir(),'senate-nine-'));
 try{
  const file=join(dir,'source.pdf');writeFileSync(file,bytes);
  const info=execFileSync('pdfinfo',[file],{encoding:'utf8',timeout:15000});
  const pages=Number(info.match(/^Pages:\s*(\d+)\s*$/mi)?.[1]??NaN);
  if(!Number.isInteger(pages)||pages<1||pages>MAX_PAGES)
   throw Error('Original source PDF exceeds hard page cap');
 }finally{rmSync(dir,{recursive:true,force:true})}
 return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
 const op=args();
 const selected=selectNinePinnedSourceRollOriginals(2023,readFileSync(op.source,'utf8'));
 if(selected.length!==7)throw Error('Source original 2023 Elections cohort is not seven PDFs');
 const queue=JSON.parse(readFileSync(op.queue,'utf8')) as {
  issue:number;proofRunId:number;totalOriginalOfficialPdfs:number;
  totalProvisionalNamedRollBlocks:number;documents:Array<{
   year:number;officialSourcePdfUrl:string;hearingDate:string;
   sourceRollBlocks:Array<{sourceTextOffset:number;sourceNamedYeaCount:number;
    sourceNamedNayCount:number;sourceNumericTallyMatchesNamedRoll:boolean}>;
  }>;
 };
 if(queue.issue!==864||queue.proofRunId!==38084229868||
    queue.totalOriginalOfficialPdfs!==9||queue.totalProvisionalNamedRollBlocks!==12)
   throw Error('Original nine-source review queue drifted');
 const targets=queue.documents.filter(x=>x.year===2023);
 if(targets.length!==7||targets.reduce((n,x)=>n+x.sourceRollBlocks.length,0)!==10)
   throw Error('Original attendance source target population not seven PDFs / ten rolls');
 const allowed=new Set(selected.map(x=>x.originalOfficialPdfUrl));
 const proof:Record<string,unknown>[]=[];
 const errors:Array<{urlSha256:string;hearingDate:string;reason:string}>=[];
 for(const doc of selected){
  try{
   const t=targets.find(r=>r.officialSourcePdfUrl===doc.originalOfficialPdfUrl &&
    r.hearingDate===doc.hearingDate);
   if(!t)throw Error('Original PDF not in independent permanent source-offset queue');
   const original=await fetchSenateCommitteeMinutePdf({
    url:doc.originalOfficialPdfUrl,
    fetchImpl:((input:string|URL|Request,init?:RequestInit)=>{
     const url=input instanceof Request?input.url:String(input);
     return fixedOfficialPdf(url,allowed,init);
    }) as typeof fetch,
   });
   if(original.extractionMethod!=='embedded_text'||
     original.contentSha256!==doc.originalPdfSha256||
     sha(original.text)!==doc.extractedTextSha256)
     throw Error('Exact original official PDF/text SHA changed from independent run');
   const sourceRolls=extractNineSourceIndividualRolls(original.text,2023,doc.committeeName);
   if(sourceRolls.length!==t.sourceRollBlocks.length)
     throw Error('Original source candidate action denominator drifted');
   const attendance=parse2023ElectionsOriginalMeetingAttendance(original.text);
   const sourceResults=t.sourceRollBlocks.map(expected=>{
     if(expected.sourceNumericTallyMatchesNamedRoll!==true)
       throw Error('Unverified source match in original review queue');
     const roll=sourceRolls.find(c=>
       c.sourceOffset===expected.sourceTextOffset &&
       c.explicitlyNamedYeas===expected.sourceNamedYeaCount &&
       c.explicitlyNamedNays===expected.sourceNamedNayCount);
     if(!roll)throw Error('Original source roll action text offset or named count drift');
     return inspect2023OriginalElectionRollDateAndAttendance(
       original.text,doc.hearingDate,roll);
   });
   proof.push({
    hearingDate:doc.hearingDate,originalOfficialPdfUrl:doc.originalOfficialPdfUrl,
    originalPdfSha256:original.contentSha256,
    originalTextSha256:sha(original.text),
    originalMeetingAttendance:attendance,
    provisionalRollBlocksReviewed:sourceResults.length,
    sourceBlocks:sourceResults,
   });
  }catch(e){errors.push({
   urlSha256:sha(doc.originalOfficialPdfUrl),hearingDate:doc.hearingDate,reason:safe(e),
  })}
 }
 const flat=proof.flatMap(x=>x.sourceBlocks as Array<ReturnType<typeof inspect2023OriginalElectionRollDateAndAttendance>>);
 const summary={
  originalPdfsExpected:7,originalPdfsReverified:proof.length,sourceFailures:errors.length,
  candidateOriginalSourceRollBlocksExpected:10,candidateBlocksReverified:flat.length,
  originalMeetingHeadersWithComplete14MemberAttendance:proof.filter(x=>
   (x.originalMeetingAttendance as ReturnType<typeof parse2023ElectionsOriginalMeetingAttendance>)
     .uniqueRosterPartitionVerified).length,
  candidateSourceDateHeadingMismatches:flat.filter(x=>x.originalHeadingDateRequiresReview).length,
  candidateVoteChoiceConflictsWithMeetingLevelAbsent:flat.filter(x=>
   x.originalAbsentHeaderMembersGivenExplicitYeaNay>0).length,
  candidateVoteSpecificAbsentDespiteMeetingInitiallyPresent:flat.filter(x=>
   x.sourceRollMarkedAbsentDespiteBeingPresentAtStart>0).length,
 };
 const report={
  schemaVersion:'senate-2023-elections-seven-original-date-and-attendance-crosscheck-v1',
  issue:864,year:2023,independentOriginalAuditRun:38066441841,
  priorNamedSourceRun:38084229868,
  publicRosterAuditSourceRun:38085294202,
  sourceBounds:{maxPdfBytes:MAX_BYTES,maxPdfPages:MAX_PAGES,noRedirects:true},
  summary,sourceOriginals:proof,sourceFailures:errors,
  noFullSourcePdfOrTextOrNameEntriesArchived:true,
  sourceMembersNotAutomaticallyHistoricalDbVotes:true,
  originalMeetingHeaderDoesNotProvePresenceForLaterMotion:true,
  noPrivateDatabaseReadOrWriteOrForecastModelServingScheduler2027Changes:true,
 };
 mkdirSync(dirname(op.out),{recursive:true});
 writeFileSync(op.out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(summary,null,2));
 if(errors.length||flat.length!==10)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});