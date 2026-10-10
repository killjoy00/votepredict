/**
 * One-time #864: exactly 19 prior exact-tally, but NOT human-verified,
 * historical 2023–25 Senate committee candidates. Re-fetch the 10 exact
 * independently SHA-pinned official originals, isolate source context and
 * test hearing-date header + listed absentee against named choice hashes.
 *
 * No production/private DB, no ingestion, no model and no scheduler.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname,join,resolve } from 'node:path';
import { fetchSenateCommitteeMinutePdf } from '../src/evidence/minnesota-senate-committee-source.js';
import {
  loadStrongRollSourceManifest,type ReviewYear,
} from '../src/evidence/senate-committee-41-strong-roll-original-review.js';
import { extractSupplementalNamedSenateRollCandidates } from '../src/evidence/senate-committee-supplemental-named-roll-review.js';
import { inspectProvisionalMatchedSenateMotion } from '../src/evidence/senate-committee-19-original-date-attendance-review.js';

const hash=(x:string|Uint8Array)=>createHash('sha256').update(x).digest('hex');
const MAX_BYTES=3_000_000,MAX_PAGES=30;
type Target={
  year:number;hearingDate:string;committeeName:string;officialSourcePdfUrl:string;
  sourceTextOffset:number;yeaNamed:number;nayNamed:number;
  sourceNumericTallyMatchesNames:true;eligibleAsMemberVote:false;
};
function getArgs(){
  const a=process.argv.slice(2);
  if(a.length!==6||a[0]!=='--year'||a[2]!=='--source-json'||a[4]!=='--output')
    throw Error('Exact --year 2023|2024|2025 --source-json PATH --output PATH required');
  const year=Number(a[1]);
  if(![2023,2024,2025].includes(year))throw Error('Only scoped high-priority original years');
  return {year:year as ReviewYear,priorSource:resolve(a[3]!),output:resolve(a[5]!)};
}
function errorLabel(x:unknown){
  return (x instanceof Error?x.message:String(x))
    .replace(/https?:\/\/\S+/gi,'[official PDF]').slice(0,180);
}
function load19(year:ReviewYear):Target[]{
  const src=JSON.parse(readFileSync(new URL(
    '../docs/evaluation/source-proof/senate-committee-19-tally-matched-provisional-roll-review-queue.json',
    import.meta.url),'utf8')) as {
    issue:number;sourceRunId:number;totalCandidateBlocks:number;
    explicitNamedSourceTokens:number;records:Target[];
  };
  if(src.issue!==864||src.sourceRunId!==38079646647||
    src.totalCandidateBlocks!==19||src.explicitNamedSourceTokens!==196||
    src.records.length!==19||new Set(src.records.map(x=>x.officialSourcePdfUrl+'|'+x.sourceTextOffset)).size!==19)
    throw Error('Immutable previously-reviewed 19 source candidate queue changed');
  const rows=src.records.filter(x=>x.year===year);
  const counts:{[k:number]:number}={2023:1,2024:3,2025:15};
  const pdfs:{[k:number]:number}={2023:1,2024:3,2025:6};
  if(rows.length!==counts[year]||new Set(rows.map(r=>r.officialSourcePdfUrl)).size!==pdfs[year])
    throw Error('Exact priority candidate year population drifted');
  for(const r of rows){
    if(r.sourceNumericTallyMatchesNames!==true||r.eligibleAsMemberVote!==false ||
      !r.hearingDate.startsWith(String(year)+'-')||!r.committeeName.trim() ||
      !Number.isInteger(r.sourceTextOffset)||r.sourceTextOffset<0 ||
      !Number.isInteger(r.yeaNamed)||!Number.isInteger(r.nayNamed) ||
      r.yeaNamed+r.nayNamed<2)
      throw Error('Invalid original review target metadata');
  }
  return rows;
}
async function downloadCapped(url:string,allowed:Set<string>,init?:RequestInit){
  if(!allowed.has(url))throw Error('Refusing URL outside 19 prior source target originals');
  const r=await fetch(url,{...init,redirect:'manual'});
  if(r.status!==200||r.url!==url)throw Error('Original official Senate PDF HTTP status or redirect');
  const header=r.headers.get('content-length');
  if(header&&Number(header)>MAX_BYTES)throw Error('Original PDF oversized');
  const reader=r.body?.getReader();
  if(!reader)throw Error('Original PDF has no response body stream');
  let n=0;const chunks:Uint8Array[]=[];
  try{
    for(;;){
      const next=await reader.read();if(next.done)break;
      n+=next.value.byteLength;
      if(n>MAX_BYTES)throw Error('Original PDF streamed bytes exceeded cap');
      chunks.push(next.value);
    }
  }finally{reader.releaseLock()}
  const bytes=new Uint8Array(n);
  let i=0;
  for(const part of chunks){bytes.set(part,i);i+=part.byteLength}
  if(n<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
    throw Error('Original PDF signature failed');
  const dir=mkdtempSync(join(tmpdir(),'senate-19-source-'));
  try{
    const path=join(dir,'source.pdf');
    writeFileSync(path,bytes);
    const info=execFileSync('pdfinfo',[path],{encoding:'utf8',timeout:15000,maxBuffer:100_000});
    const pages=Number(info.match(/^Pages:\s*(\d+)\s*$/mi)?.[1]??NaN);
    if(!Number.isInteger(pages)||pages<1||pages>MAX_PAGES)
      throw Error('Official source PDF exceeds hard page cap');
  }finally{rmSync(dir,{recursive:true,force:true})}
  return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
  const args=getArgs();
  const target=load19(args.year);
  const strong=loadStrongRollSourceManifest(args.year,readFileSync(args.priorSource,'utf8'));
  const originals=[...new Set(target.map(r=>r.officialSourcePdfUrl))].sort();
  const allowed=new Set(originals);
  const proofs:Record<string,unknown>[]=[];
  const failures:Array<{meetingDate:string;committeeName:string;sourceUrlSha256:string;reason:string}>=[];
  for(const url of originals){
    const row=strong.find(r=>r.originalOfficialPdfUrl===url);
    const expected=target.filter(t=>t.officialSourcePdfUrl===url);
    if(!row||expected.some(t=>t.hearingDate!==row.hearingDate ||
      t.committeeName!==row.committeeName))
      throw Error('Source review PDF not found with exact independent LRL metadata identity');
    try {
      const result=await fetchSenateCommitteeMinutePdf({
        url,fetchImpl:((input:string|URL|Request,init?:RequestInit)=>{
          const raw=input instanceof Request?input.url:String(input);
          return downloadCapped(raw,allowed,init);
        }) as typeof fetch,
      });
      if(result.extractionMethod!=='embedded_text' ||
        result.contentSha256!==row.originalPdfSha256 ||
        hash(result.text)!==row.extractedTextSha256)
        throw Error('Official original PDF or embedded text changed since independent source SHA audit');
      const all=extractSupplementalNamedSenateRollCandidates(result.text);
      const scoped=expected.map(t=>{
        const record=all.find(c=>c.sourceOffset===t.sourceTextOffset &&
          c.namedYeaCount===t.yeaNamed && c.namedNayCount===t.nayNamed);
        if(!record)throw Error('Original source candidate text offset, names or parser no longer reproduces');
        return inspectProvisionalMatchedSenateMotion({
          text:result.text,indexedHearingDate:t.hearingDate,
          expectedSourceOffset:t.sourceTextOffset,candidate:record,
        });
      });
      proofs.push({
        year:args.year,committeeName:row.committeeName,hearingDate:row.hearingDate,
        sourceUrl:url,originalSourcePdfSha256:result.contentSha256,
        originalTextSha256:hash(result.text),originalPdfBytes:result.bytes,
        reviewedProvisionalExactTallyCandidates:scoped.length,
        PDFHeaderDate:scoped[0]?.header.printedHeaderDate??null,
        headerMismatch:scoped[0]?.header.sourceDateHeaderNeedsReview??true,
        sourceCandidates:scoped,
      });
    }catch(e){failures.push({
      meetingDate:row.hearingDate,committeeName:row.committeeName,
      sourceUrlSha256:hash(url),reason:errorLabel(e),
    })}
  }
  const rows=proofs.flatMap(p=>p.sourceCandidates as Array<ReturnType<typeof inspectProvisionalMatchedSenateMotion>>);
  const report={
    schemaVersion:'senate-19-pinned-original-motion-date-absentee-crosscheck-v1',
    issue:864,year:args.year,originalStrongRollAuditRun:38075573031,
    priorProvisionalSourceRun:38079646647,
    originalPdfsExpected:originals.length,originalPdfsReverified:proofs.length,
    candidateOffsetsExpected:target.length,candidateOffsetsReverified:rows.length,
    originalSourceFailures:failures.length,
    summary:{
      candidateSourceHeaderDateMismatch:rows.filter(x=>x.header.printedHeaderDateAgreesWithIndexedDate===false).length,
      candidatePrintedWeekdayWrong:rows.filter(x=>x.header.printedWeekdayMatchesPrintedDate===false).length,
      candidateAnyAbsentVoterConflict:rows.filter(x=>x.attendance.explicitChoiceFingerprintMatchesAbsentee>0).length,
      totalMatchedAbsenteeChoiceFingerprints:rows.reduce((n,x)=>n+x.attendance.explicitChoiceFingerprintMatchesAbsentee,0),
      candidatesWithNoMachineDetectedSourceContradiction:rows.filter(x=>x.reviewFlags.length===0).length,
    },
    officialPdfs:proofs,failedOriginals:failures,
    sourceContextExcerptsTemporarySevenDayReviewOnly:true,
    noSourceTextOrOriginalPdfSaved:true,
    humanMotionAndActualMemberRosterNotValidated:true,
    neverAutomaticIndividualSenatorVotes:true,
    noProductionDatabaseReadOrWrite:true,
    noModelsForecastsServingSchedulersOr2027Changed:true,
  };
  mkdirSync(dirname(args.output),{recursive:true});
  writeFileSync(args.output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({
    year:args.year,originalPdfs:proofs.length,candidates:rows.length,
    failures:failures.length,reviewFlags:report.summary,
  },null,2));
  if(failures.length||rows.length!==target.length)process.exitCode=1;
}
main().catch(e=>{console.error(errorLabel(e));process.exitCode=1});