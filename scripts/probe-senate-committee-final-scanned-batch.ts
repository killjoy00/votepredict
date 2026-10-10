/**
 * One-time #864 source-only OCR of 2022 and 2025 original Senate Minutes
 * previously proven low-text by the complete 2022-25 original LRL PDF audit.
 *
 * Each job processes exactly one pinned historical year and one of 6/3
 * disjoint shards. Artifact input SHA-256, original URLs/date, per-PDF byte
 * and original page caps all fail closed. No DB/model/scheduler dependencies.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fetchSenateCommitteeMinutePdf } from '../src/evidence/minnesota-senate-committee-source.js';
import { auditSenateCommitteeOriginalMinutePdf } from '../src/evidence/senate-committee-original-pdf-action-audit.js';
import {
  SENATE_FINAL_OCR_MAX_BYTES,
  SENATE_FINAL_OCR_MAX_PAGES,
  SENATE_FINAL_OCR_EXPECTED,
  SENATE_FINAL_OCR_SOURCE_RUN,
  selectVerifiedFinalOriginals,
  type SenateFinalOcrYear,
} from '../src/evidence/senate-committee-final-ocr-cohort.js';

const sha = (raw: string | Uint8Array) =>
  createHash('sha256').update(raw).digest('hex');
function safe(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/\S+/gi, '[official original source]').slice(0, 200);
}
function options() {
  const args = process.argv.slice(2);
  if (args.length !== 8 ||
      args[0] !== '--year' || args[2] !== '--batch' ||
      args[4] !== '--source-json' || args[6] !== '--output')
    throw Error('Fixed args: --year 2022|2025 --batch N --source-json PATH --output PATH');
  const year = Number(args[1]);
  if (year !== 2022 && year !== 2025) throw Error('Only the two remaining original Senate PDF years allowed');
  const conf = SENATE_FINAL_OCR_EXPECTED[year];
  if (!/^\d+$/.test(args[3]!) || Number(args[3]) >= conf.batches)
    throw Error('Invalid fixed-source OCR batch index');
  if (!args[5] || !args[7] || args[5]!.startsWith('--') || args[7]!.startsWith('--'))
    throw Error('Source JSON and local output paths are required');
  if (process.env.VOTEPREDICT_SENATE_COMMITTEE_OCR !== '1')
    throw Error('Explicit OCR opt-in required');
  return { year: year as SenateFinalOcrYear, batch: Number(args[3]),
    source: resolve(args[5]!), output: resolve(args[7]!) };
}
async function fetchPinnedOriginal(
  input: string | URL | Request,
  init: RequestInit | undefined,
  allowed: ReadonlySet<string>,
): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  if (!allowed.has(url)) throw Error('Refusing source URL outside independently pinned manifest');
  const response = await fetch(url, { ...init, redirect:'manual' });
  if (response.status !== 200 || response.url !== url)
    throw Error('Original LRL PDF unexpected HTTP status or redirect');
  const header = response.headers.get('content-length');
  if (header !== null && Number.isFinite(Number(header))
      && Number(header) > SENATE_FINAL_OCR_MAX_BYTES) {
    await response.body?.cancel();
    throw Error('Original PDF exceeds hard byte limit');
  }
  const reader = response.body?.getReader();
  if (!reader) throw Error('Original PDF body missing');
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const read = await reader.read();
      if (read.done) break;
      total += read.value.byteLength;
      if (total > SENATE_FINAL_OCR_MAX_BYTES)
        throw Error('Streaming original PDF exceeds hard byte cap');
      chunks.push(read.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let i = 0;
  for (const chunk of chunks) { bytes.set(chunk, i); i += chunk.byteLength; }
  if (total < 300 || new TextDecoder('latin1').decode(bytes.slice(0,5)) !== '%PDF-')
    throw Error('Original Senate document PDF signature invalid');

  const tmp = mkdtempSync(join(tmpdir(),'senate-final-scanned-'));
  try {
    const path = join(tmp, 'original.pdf');
    writeFileSync(path, bytes);
    const info = execFileSync('pdfinfo',[path],{
      encoding:'utf8',timeout:20_000,maxBuffer:100_000,
    });
    const match = info.match(/^Pages:\s*(\d+)\s*$/mi);
    if (!match || Number(match[1]) < 1 || Number(match[1]) > SENATE_FINAL_OCR_MAX_PAGES)
      throw Error('Original PDF page count outside OCR fixed cap');
  } finally {
    rmSync(tmp,{recursive:true,force:true});
  }
  return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main() {
  const {year,batch,source,output} = options();
  const conf = SENATE_FINAL_OCR_EXPECTED[year];
  const sourceRaw = readFileSync(source, 'utf8');
  const all = selectVerifiedFinalOriginals(year,sourceRaw);
  const docs = all.filter((_, index) => index % conf.batches === batch);
  const expectedBatchSize = Math.floor(conf.remaining/conf.batches) +
    (batch < conf.remaining % conf.batches ? 1 : 0);
  if (docs.length !== expectedBatchSize || docs.length > 20)
    throw Error('Fixed year batch partition unexpectedly drifted');
  const allowed = new Set(docs.map(x=>x.url));
  const results: Array<ReturnType<typeof auditSenateCommitteeOriginalMinutePdf>>=[];
  const failures: Array<{originalUrlSha256:string;meetingDate:string;committeeName:string;reason:string}>=[];
  for (const doc of docs) {
    try {
      const body = await fetchSenateCommitteeMinutePdf({
        url:doc.url, fetchImpl:((input:string|URL|Request,init?:RequestInit) =>
          fetchPinnedOriginal(input,init,allowed)) as typeof fetch,
      });
      if (body.extractionMethod !== 'ocr_tesseract')
        throw Error('Original PDF embedded text now different; requires manual source drift audit');
      results.push(auditSenateCommitteeOriginalMinutePdf({document:doc,pdf:body}));
    } catch(e) {
      failures.push({originalUrlSha256:sha(doc.url), meetingDate:doc.meetingDate,
        committeeName:doc.committeeName, reason:safe(e)});
    }
  }
  const sum = (f:(r:typeof results[number])=>number) =>
    results.reduce((n,r)=>n+f(r),0);
  const stats = {
    expectedOriginals:docs.length, recoveredOriginals:results.length,
    failedOriginals:failures.length,
    namedRolls:sum(r=>r.sourceParserTotals.namedRollCalls),
    countOnlyRolls:sum(r=>r.sourceParserTotals.countOnlyRollCalls),
    sourceNamedMemberChoices:sum(r=>r.sourceParserTotals.namedMemberChoicesInPdf),
    voiceContextCandidates:sum(r=>r.sourceParserTotals.voiceActions),
    unanimousContextCandidates:sum(r=>r.sourceParserTotals.unanimousActions),
    resultOnlyContextCandidates:sum(r=>r.sourceParserTotals.motionResultOnlyActions),
    possibleUnparsedRollSignal:results.filter(r=>r.missingness.possibleUnparsedRollCallSignal).length,
    noSupportedActionDetected:results.filter(r=>r.missingness.noSupportedVoteOrActionDetected).length,
  };
  const out = {
    schemaVersion:'senate-committee-final-scanned-2022-2025-batch-v1',
    issue:864,year,batch,totalBatches:conf.batches,
    independentOriginalRunId:SENATE_FINAL_OCR_SOURCE_RUN,
    independentOriginalArtifactId:conf.sourceArtifactId,
    originalAuditJsonSha256:conf.originalJsonSha256,
    fixedAllRemainingUrlsSha256:conf.selectedUrlsSha256,
    fixedBatchUrlsSha256:sha(docs.map(x=>x.url).join('\n')),
    bounds:{originalMaxBytes:SENATE_FINAL_OCR_MAX_BYTES,
      originalMaxPages:SENATE_FINAL_OCR_MAX_PAGES,sourceUrlsPinned:true,noRedirects:true},
    stats,
    originalProofs:results.map(r=>({
      document:r.document,parserVersions:r.parserVersions,
      sourceSignalHints:r.sourceSignalHints,sourceParserTotals:r.sourceParserTotals,
      voteObservations:r.voteObservations,contextOnlyActionKeys:
        r.contextOnlyActions.map(a=>a.sourceObservationKey),
      missingness:r.missingness,
    })),
    failedOriginals:failures,
    noOriginalPdfOrRasterOrOcrTextPersisted:true,
    parserCandidatesNotCertifiedRecordedVoteDenominator:true,
    noPrivateDatabaseAccessOrMutation:true,
    noModelForecastServingSchedulerChange:true,
    year2021PrintAnd2022PrintGapStillOpen:true,
    oneHundredFortyOneMeetingsWithoutLinkedMinutesUnresolved:true,
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify({year,batch,stats,output,dbTouched:false},null,2));
  if (failures.length) process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});
