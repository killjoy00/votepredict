/**
 * #864: explicitly bounded SECOND source-only Senate 2022-25 OCR sample.
 * The first six-source pilot recovered all six original scanned Minutes PDFs.
 * This follow-up handles exactly 24 DIFFERENT previously failed originals.
 *
 * No private database, scheduler, forecast, office contact or 2027 work.
 * One historical year per invocation; 8/4/4/8 fixed docs, <=8MiB, <=8 pages.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fetchSenateCommitteeMinutePdf } from '../src/evidence/minnesota-senate-committee-source.js';
import { auditSenateCommitteeOriginalMinutePdf } from '../src/evidence/senate-committee-original-pdf-action-audit.js';
import {
  SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES,
  SENATE_SIX_SCANNED_ORIGINAL_MAX_PAGES,
  isPinnedScannedSenateOriginalPdfUrl,
  validateSenateOriginalOcrPageCount,
} from '../src/evidence/senate-committee-scanned-ocr-pilot.js';

export const ORIGINALS_MANIFEST_PATH =
  '../docs/evaluation/source-proof/senate-committee-24-scanned-originals-source-manifest.json';
export const SOURCE_SAMPLE_YEAR_COUNTS = {2022:8,2023:4,2024:4,2025:8} as const;
type Year = keyof typeof SOURCE_SAMPLE_YEAR_COUNTS;
type Original = { year: number; committeeName: string; meetingDate: string; url: string };
type Manifest = {
  schemaVersion: string;
  independentSourceRunId: number;
  originals: Original[];
  years: number[];
  maxOriginalBytes: number;
  maxPdfPages: number;
};

function digest(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

export function verifyFixedSourceManifest(manifest: Manifest): boolean {
  if (manifest.schemaVersion !== 'senate-committee-2022-25-original-scan-24-stratified-v1'
    || manifest.independentSourceRunId !== 38066441841
    || manifest.maxOriginalBytes !== SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES
    || manifest.maxPdfPages !== SENATE_SIX_SCANNED_ORIGINAL_MAX_PAGES
    || !Array.isArray(manifest.originals) || manifest.originals.length !== 24
    || JSON.stringify(manifest.years) !== JSON.stringify([2022,2023,2024,2025])) return false;
  const counts = new Map<number, number>();
  const urls = new Set<string>();
  for (const item of manifest.originals) {
    if (!item || !Number.isInteger(item.year)
      || !Object.prototype.hasOwnProperty.call(SOURCE_SAMPLE_YEAR_COUNTS,item.year)
      || typeof item.committeeName !== 'string' || !item.committeeName.trim()
      || typeof item.meetingDate !== 'string' || typeof item.url !== 'string'
      || urls.has(item.url) || isPinnedScannedSenateOriginalPdfUrl(item.url)) return false;
    let u:URL;
    try { u=new URL(item.url); } catch { return false; }
    const match=u.pathname.match(
      /^\/archive\/minutes\/senate\/(202[2-5])\/[^/]+\/(20\d{6})\/[^/]+_minutes\.pdf$/i,
    );
    if (!match || u.protocol!=='https:' || u.hostname!=='www.lrl.mn.gov'
      || u.search || match[1]!==String(item.year)
      || item.meetingDate !== [
        match[2]!.slice(0,4),match[2]!.slice(4,6),match[2]!.slice(6,8),
      ].join('-')) return false;
    urls.add(item.url);
    counts.set(item.year,(counts.get(item.year)??0)+1);
  }
  return Object.entries(SOURCE_SAMPLE_YEAR_COUNTS).every(([year,count])=>counts.get(Number(year))===count);
}

export function loadSourceManifest() {
  const raw=readFileSync(new URL(ORIGINALS_MANIFEST_PATH,import.meta.url),'utf8');
  const manifest=JSON.parse(raw) as Manifest;
  if (!verifyFixedSourceManifest(manifest)) throw Error('24-source original PDF cohort outside fixed official audit');
  return {manifest,manifestRawSha256:digest(raw)};
}

function options() {
  const args=process.argv.slice(2);
  let yearRaw: string | undefined, outputRaw: string | undefined;
  for(let i=0;i<args.length;i++){
    const arg=args[i];
    if(arg==='--year')yearRaw=args[++i];
    else if(arg==='--output')outputRaw=args[++i];
    else throw Error('Only --year and --output are permitted');
  }
  const year=Number(yearRaw);
  if (!Object.prototype.hasOwnProperty.call(SOURCE_SAMPLE_YEAR_COUNTS, year)
    || !outputRaw) throw Error('Set fixed Senate historical year 2022|2023|2024|2025 and local --output');
  if (process.env.VOTEPREDICT_SENATE_COMMITTEE_OCR!=='1')
    throw Error('Explicit scanned-original OCR opt-in required');
  return {year:year as Year,output:resolve(outputRaw)};
}

function safeError(e:unknown) {
  return (e instanceof Error ? e.message : String(e))
    .replace(/https?:\/\/\S+/gi,'[original public source]').slice(0,160);
}

async function fetchOriginalWithPreflight(
  input: string | URL | Request,
  init?: RequestInit,
  allowed?: ReadonlySet<string>,
): Promise<Response> {
  const url=input instanceof Request ? input.url : String(input);
  if (!allowed?.has(url)) throw Error('Refusing unpinned Senate OCR source URL');
  const response=await fetch(url,{...init,redirect:'manual'});
  if(response.status!==200)throw Error('Official Minutes original HTTP '+response.status);
  const length=Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length>SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES){
    await response.body?.cancel();
    throw Error('Source original PDF byte cap exceeded');
  }
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<300||bytes.length>SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES
    ||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-'){
    throw Error('Source PDF failed signature or byte cap');
  }
  const temp=mkdtempSync(join(tmpdir(),'senate-24-ocr-pdfinfo-'));
  try{
    const pdfPath=join(temp,'source.pdf');
    writeFileSync(pdfPath,bytes);
    const info=execFileSync('pdfinfo',[pdfPath],{
      encoding:'utf8',timeout:20_000,maxBuffer:100_000,
    });
    const pages=info.match(/^Pages:\s*(\d+)\s*$/mi);
    if(!pages)throw Error('Original page count not verified');
    validateSenateOriginalOcrPageCount(Number(pages[1]));
  }finally{rmSync(temp,{recursive:true,force:true});}
  return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}

async function main(){
  const {year,output}=options();
  const {manifest,manifestRawSha256}=loadSourceManifest();
  const sources=manifest.originals.filter(x=>x.year===year);
  if(sources.length!==SOURCE_SAMPLE_YEAR_COUNTS[year])
    throw Error('Fixed historical source cohort had changed');
  const allowed=new Set(sources.map(x=>x.url));
  const reports:Array<ReturnType<typeof auditSenateCommitteeOriginalMinutePdf>>=[];
  const failures:Array<{originalUrl:string;originalUrlSha256:string;meetingDate:string;reason:string}>=[];
  for (const source of sources){
    try{
      const pdf=await fetchSenateCommitteeMinutePdf({
        url:source.url,
        fetchImpl:((input: string | URL | Request, init?:RequestInit)=>
          fetchOriginalWithPreflight(input,init,allowed)) as typeof fetch,
      });
      const audit=auditSenateCommitteeOriginalMinutePdf({document:source,pdf});
      reports.push(audit);
    }catch(e){
      failures.push({
        originalUrl:source.url,originalUrlSha256:digest(source.url),
        meetingDate:source.meetingDate,reason:safeError(e),
      });
    }
  }
  const sum=(f:(r:typeof reports[number])=>number)=>reports.reduce((n,r)=>n+f(r),0);
  const totals={
    recoveredOriginalPdfs:reports.length,
    unresolvedOriginalPdfs:failures.length,
    ocrTesseractRecovered:reports.filter(r=>r.document.extractionMethod==='ocr_tesseract').length,
    namedRolls:sum(r=>r.sourceParserTotals.namedRollCalls),
    countOnlyRolls:sum(r=>r.sourceParserTotals.countOnlyRollCalls),
    namedMemberChoices:sum(r=>r.sourceParserTotals.namedMemberChoicesInPdf),
    voiceContextActions:sum(r=>r.sourceParserTotals.voiceActions),
    unanimousContextActions:sum(r=>r.sourceParserTotals.unanimousActions),
    resultOnlyContextActions:sum(r=>r.sourceParserTotals.motionResultOnlyActions),
    possibleUnparsedRollCallSignal:reports.filter(r=>r.missingness.possibleUnparsedRollCallSignal).length,
    noSupportedActionDetected:reports.filter(r=>r.missingness.noSupportedVoteOrActionDetected).length,
  };
  const result={
    schemaVersion:'senate-committee-24-scanned-original-action-audit-v1',
    sourceSelection: {
      manifestVersion:manifest.schemaVersion,manifestRawSha256,
      independentSourceRunId:manifest.independentSourceRunId,
      fullOriginalSourceYear:year,
      expectedSourceCount:sources.length,
      priorSixSourcePilotExcluded:true,
      maxBytesEach:SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES,
      maxPagesEach:SENATE_SIX_SCANNED_ORIGINAL_MAX_PAGES,
    },
    totals,
    originalProofs:reports.map(r=>({
      document:r.document,parserVersions:r.parserVersions,
      sourceSignalHints:r.sourceSignalHints,sourceParserTotals:r.sourceParserTotals,
      voteKeys:r.voteObservations.map(v=>v.externalKey),
      actionKeys:r.contextOnlyActions.map(a=>a.sourceObservationKey),
      missingness:r.missingness,
    })),
    failures,
    sourceOnly:true,
    noRawOriginalPdfOrOcrTextPersisted:true,
    parserObservationsNotOfficialAllVoteDenominator:true,
    noPrivateDatabaseOrForecastAccess:true,
    year2021AndPrinted2022Uncovered:true,
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({
    year,manifestRawSha256,attempted:sources.length,
    totals,
    sourceCompleteVoteDenominatorCertified:false,
    dbTouched:false,
    output,
  },null,2));
}

main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
