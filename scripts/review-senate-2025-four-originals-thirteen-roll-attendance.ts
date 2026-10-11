/**
 * #864 bounded real original four PDF / thirteen source-roll attendance check.
 * Exact SHA pinned original 2025 strong-roll manifest. NOT an ingestion path.
 */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {loadStrongRollSourceManifest} from
  '../src/evidence/senate-committee-41-strong-roll-original-review.js';
import {extractSupplementalNamedSenateRollCandidates} from
  '../src/evidence/senate-committee-supplemental-named-roll-review.js';
import {REMAINING_2025_ELECTIONS_ORIGINAL_ROLL_OFFSETS,
  inspectOther2025ElectionOriginalRoll,type OtherElections2025Date} from
  '../src/evidence/senate-2025-elections-remaining-thirteen-attendance.js';

const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const MAX_BYTES=3_000_000,MAX_PAGES=30;
type Target={year:number;hearingDate:string;committeeName:string;officialSourcePdfUrl:string;
  sourceTextOffset:number;yeaNamed:number;nayNamed:number;
  sourceNumericTallyMatchesNames:boolean;eligibleAsMemberVote:boolean};
function args(){
  const a=process.argv.slice(2);
  if(a.length!==4||a[0]!=='--source-json'||a[2]!=='--output')
    throw Error('Exact --source-json PATH --output PATH required');
  return {manifest:resolve(a[1]!),out:resolve(a[3]!)};
}
function label(e:unknown){
 return (e instanceof Error?e.message:String(e))
   .replace(/https?:\/\/\S+/gi,'[official original PDF]').slice(0,170);
}
async function cappedOriginal(url:string,allow:ReadonlySet<string>,init?:RequestInit){
 if(!allow.has(url))throw Error('Original URL not present in exact four-source scope');
 const r=await fetch(url,{...init,redirect:'manual'});
 if(r.status!==200||r.url!==url)throw Error('Original PDF redirect or HTTP drift');
 const len=r.headers.get('content-length');
 if(len&&Number(len)>MAX_BYTES)throw Error('Original declared PDF length exceeds 3MiB');
 const stream=r.body?.getReader();
 if(!stream)throw Error('Missing original source PDF stream');
 let size=0;const chunks:Uint8Array[]=[];
 try{
   for(;;){
     const next=await stream.read();if(next.done)break;
     size+=next.value.byteLength;
     if(size>MAX_BYTES)throw Error('Original PDF exceeds streamed cap');
     chunks.push(next.value);
   }
 }finally{stream.releaseLock()}
 const bytes=new Uint8Array(size);let pos=0;
 for(const c of chunks){bytes.set(c,pos);pos+=c.byteLength}
 if(size<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
    throw Error('Not original bounded PDF bytes');
 const dir=mkdtempSync(join(tmpdir(),'senate-2025-other-four-'));
 try{
   const pdf=join(dir,'original.pdf');writeFileSync(pdf,bytes);
   const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8',timeout:15000,maxBuffer:100_000});
   const pages=Number(info.match(/^Pages:\s*(\d+)\s*$/mi)?.[1]??NaN);
   if(!Number.isInteger(pages)||pages<1||pages>MAX_PAGES)
     throw Error('Original PDF exceeds bounded page count');
 }finally{rmSync(dir,{recursive:true,force:true})}
 return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
 const a=args();
 const manifest=loadStrongRollSourceManifest(2025,readFileSync(a.manifest,'utf8'));
 const raw=readFileSync(new URL('../docs/evaluation/source-proof/senate-committee-19-tally-matched-provisional-roll-review-queue.json',import.meta.url));
 const queue=JSON.parse(raw.toString('utf8')) as {
   issue:number;sourceRunId:number;totalCandidateBlocks:number;explicitNamedSourceTokens:number;records:Target[];
 };
 if(queue.issue!==864||queue.sourceRunId!==38079646647||queue.totalCandidateBlocks!==19||
    queue.explicitNamedSourceTokens!==196||queue.records.length!==19)
   throw Error('Original 19 candidate source queue changed');
 const dates=Object.keys(REMAINING_2025_ELECTIONS_ORIGINAL_ROLL_OFFSETS) as OtherElections2025Date[];
 const selected=queue.records.filter(x=>x.year===2025&&dates.includes(x.hearingDate as OtherElections2025Date));
 if(selected.length!==13||new Set(selected.map(x=>x.officialSourcePdfUrl)).size!==4)
   throw Error('Non-HOLD original source population not exactly four PDFs and 13 rolls');
 const originals=[...new Set(selected.map(x=>x.officialSourcePdfUrl))].sort();
 const allowed=new Set(originals),results:Record<string,unknown>[]=[];
 const errors:Array<{hearingDate:string;urlSha256:string;reason:string}>=[];
 for(const url of originals){
   const target=selected.filter(x=>x.officialSourcePdfUrl===url);
   const pinned=manifest.find(x=>x.originalOfficialPdfUrl===url);
   if(!pinned||target.some(t=>t.hearingDate!==pinned.hearingDate||t.committeeName!=='Elections'))
     throw Error('Exact source original metadata not found in independently pinned manifest');
   const yearDate=pinned.hearingDate as OtherElections2025Date;
   const expected=REMAINING_2025_ELECTIONS_ORIGINAL_ROLL_OFFSETS[yearDate];
   if(!expected||target.length!==expected.length||
      !target.every(x=>expected.some(offset=>offset===x.sourceTextOffset)&&
        x.sourceNumericTallyMatchesNames===true&&x.eligibleAsMemberVote===false))
     throw Error('Exact thirteen original date/offset/numeric denominator changed');
   try{
     const original=await fetchSenateCommitteeMinutePdf({
       url,
       fetchImpl:((input:string|URL|Request,init?:RequestInit)=>{
          const requested=input instanceof Request?input.url:String(input);
          return cappedOriginal(requested,allowed,init);
       }) as typeof fetch,
     });
     if(original.extractionMethod!=='embedded_text'||
       original.contentSha256!==pinned.originalPdfSha256||
       sha(original.text)!==pinned.extractedTextSha256)
       throw Error('Original official source PDF/text SHA256 changed from independent proof');
     const parsed=extractSupplementalNamedSenateRollCandidates(original.text);
     const blocks=target.map(row=>{
       const candidate=parsed.find(x=>x.sourceOffset===row.sourceTextOffset&&
         x.namedYeaCount===row.yeaNamed&&x.namedNayCount===row.nayNamed);
       if(!candidate)throw Error('Source offset, named-vote count or parser drift');
       return inspectOther2025ElectionOriginalRoll({
          text:original.text,indexedHearingDate:yearDate,candidate});
     });
     if(blocks.length!==expected.length||
       new Set(blocks.map(b=>b.originalSourceOffset)).size!==blocks.length)
       throw Error('Original roll denominator or unique offsets changed');
     results.push({
        year:2025,committeeName:'Elections',indexedHearingDate:pinned.hearingDate,
        originalOfficialPdfUrl:url,originalPDFSha256:original.contentSha256,
        originalExtractedTextSha256:sha(original.text),pdfBytes:original.bytes,
        originalPrintedHearingDate:blocks[0]?.originalPrintedHearingDate,
        originalOpeningPresent:blocks[0]?.openingPresent,
        originalOpeningAbsent:blocks[0]?.openingAbsent,
        sourceRollCandidatesReverified:blocks.length,
        sourceRollCandidates:blocks,
     });
   }catch(e){
     errors.push({hearingDate:pinned.hearingDate,urlSha256:sha(url),reason:label(e)});
   }
 }
 const flat=results.flatMap(x=>x.sourceRollCandidates as Array<ReturnType<typeof inspectOther2025ElectionOriginalRoll>>);
 const report={
   schemaVersion:'senate-2025-four-other-elections-originals-13-roll-attendance-v1',
   issue:864,sourceYear:2025,
   earlierOriginalMetadataRun:38075573031,
   earlierSupplementalNamedTallyRun:38079646647,
   originalNineteenCandidateQueueSha256:sha(raw),
   originalPdfSourcesExpected:4,originalPdfSourcesShaReverified:results.length,
   originalSourceOffsetsExpected:13,originalSourceOffsetsReproduced:flat.length,
   sourceNamedYeaCount:flat.reduce((n,x)=>n+x.originalSourceNamedYeaCount,0),
   sourceNamedNayCount:flat.reduce((n,x)=>n+x.originalSourceNamedNayCount,0),
   sourceOriginalAcquisitionOrParserFailures:errors.length,
   sourcePrintedDateDiscrepancyCount:flat.filter(x=>x.printedDateMatchesIndexed!==true).length,
   sourceRollBlocksWithOpeningAbsentNamedYeaNayConflicts:flat.filter(x=>x.anyOriginalOpeningAbsentVoteConflict).length,
   totalOpeningAbsentNamedYeaNayConflicts:flat.reduce((n,x)=>n+x.originalOpeningAbsentGivenExplicitYeaNay,0),
   sourceRollBlocksWithCompleteElevenNamedSourceSides:flat.filter(x=>x.sourceOriginalRosterMembersWithoutRecordedYeaNay===0).length,
   records:results,failedOriginals:errors,
   sourceOpeningAttendanceNotMotionTimePresence:true,
   allThirteenRemainNotYetHumanCertifiedDistinctMotionMemberVotes:true,
   noOriginalMinutesPdfOrFullTextOrNamedChoiceListPersisted:true,
   noPrivateDatabaseReadWrite:true,
   noPredictionModelTrainingServingSchedulerFloorOr2027Changes:true,
 };
 mkdirSync(dirname(a.out),{recursive:true});writeFileSync(a.out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({reverifiedOriginals:results.length,sourceRolls:flat.length,
   namedChoices:report.sourceNamedYeaCount+report.sourceNamedNayCount,
   originalSourcesFailed:errors.length,
   originalHeaderDateDiscrepancies:report.sourcePrintedDateDiscrepancyCount,
   sourceRollBlocksWithOpeningAbsentChoiceConflicts:report.sourceRollBlocksWithOpeningAbsentNamedYeaNayConflicts},null,2));
 if(errors.length||results.length!==4||flat.length!==13)process.exitCode=1;
}
main().catch(e=>{console.error(label(e));process.exitCode=1});
