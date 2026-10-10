/**
 * #912 Track D: trusted-operator local rehydration of the ORIGINAL Wayback bytes.
 *
 * Run after the separately authorized SELECT-only #909 private export.
 * No DB, Vercel, model, CI artifact or user data publication.
 *
 * node --import tsx scripts/rehydrate-senate-media-archive-private.ts \
 *   --context "$HOME/votepredict-media-private-2021-25/media-context.jsonl" \
 *   --roster "$HOME/votepredict-media-private-2021-25/senate-roster.jsonl" \
 *   --output-dir "$HOME/votepredict-media-original-bytes-batch-0" \
 *   --offset 0 --limit 6
 */
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditSenateMediaRemarks,
  type SenateMediaContextExport,
  type SenateMediaRosterYear,
  type SenateMediaSourceSnapshot,
} from '../src/evidence/senate-media-remarks-audit.js';
import {
  SENATE_MEDIA_REHYDRATION_VERSION,
  fetchSenateMediaOriginalBytes,
  planSenateMediaRehydration,
  type MediaArchiveFetchResult,
} from '../src/evidence/senate-media-archive-rehydration.js';

const REPO = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));

function opts(): Record<string,string> {
  const allowed = new Set(['--context','--roster','--output-dir','--year','--offset','--limit']);
  const argv = process.argv.slice(2);
  const out: Record<string,string> = {};
  if (argv.length % 2 !== 0) throw Error('Expected named key/value arguments');
  for (let i=0;i<argv.length;i+=2) {
    const key=argv[i]!, value=argv[i+1]!;
    if (!allowed.has(key) || key in out || !value.trim() || value.startsWith('--'))
      throw Error('Invalid, duplicate, or missing private archive argument');
    out[key]=value;
  }
  if (!out['--context'] || !out['--roster'] || !out['--output-dir'])
    throw Error('Require --context, --roster and --output-dir');
  return out;
}
function numeric(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^(0|[1-9]\d{0,7})$/.test(value)) throw Error('Invalid numeric archive batch argument');
  return Number(value);
}
function privatePath(path: string): string {
  if (!isAbsolute(path)) throw Error('Private source inputs and outputs require absolute paths');
  const real=realpathSync(path);
  if (real === REPO || real.startsWith(REPO + sep))
    throw Error('Private input file must stay outside the Git checkout');
  return real;
}
function newOutputDir(value: string): string {
  if (!isAbsolute(value)) throw Error('Private output directory must be absolute');
  const output=resolve(value);
  if (existsSync(output)) throw Error('Refusing to overwrite/reuse private source output');
  const parent=realpathSync(dirname(output));
  const destination=resolve(parent,basename(output));
  if (destination === REPO || destination.startsWith(REPO+sep))
    throw Error('Refusing private source files in the Git checkout');
  return destination;
}
function readJsonl<T>(path: string, maxBytes: number): T[] {
  const body=readFileSync(privatePath(path),'utf8');
  if (Buffer.byteLength(body,'utf8') > maxBytes || !body.trim())
    throw Error('Private input file empty or above size cap');
  const rows=body.trimEnd().split(/\r?\n/);
  if (rows.length > 20000) throw Error('Private source export has too many rows');
  return rows.map(row => {
    let parsed: unknown;
    try { parsed=JSON.parse(row); } catch { throw Error('Invalid private source JSONL'); }
    if (!parsed || typeof parsed!=='object' || Array.isArray(parsed))
      throw Error('Private source JSONL must contain objects only');
    return parsed as T;
  });
}
function hash(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}
function writePrivate(path: string, body: string): void {
  writeFileSync(path,body,{encoding:'utf8',mode:0o600,flag:'wx'});
}
function jsonl(rows: unknown[]): string {
  return rows.map(x=>JSON.stringify(x)).join('\n') + (rows.length ? '\n' : '');
}
const delay = (ms: number) => new Promise(resolve=>setTimeout(resolve,ms));

async function main(): Promise<void> {
  const args=opts();
  const output=newOutputDir(args['--output-dir']!);
  const contexts=readJsonl<SenateMediaContextExport>(args['--context']!,80_000_000);
  const roster=readJsonl<SenateMediaRosterYear>(args['--roster']!,10_000_000);
  const plan=planSenateMediaRehydration(contexts,{
    ...(args['--year'] !== undefined ? {year:numeric(args['--year'],0)} : {}),
    offset:numeric(args['--offset'],0), limit:numeric(args['--limit'],6),
  });
  const fetched: MediaArchiveFetchResult[] = [];
  const snapshots: SenateMediaSourceSnapshot[] = [];
  for (const [index, candidate] of plan.selected.entries()) {
    if (index > 0) await delay(750); // bounded, courteous archival GET pacing
    const result=await fetchSenateMediaOriginalBytes(candidate);
    fetched.push(result);
    if (result.snapshot) snapshots.push(result.snapshot);
  }
  // Original body is ONLY persisted on byte-for-byte source_documents SHA match.
  const audit=auditSenateMediaRemarks({contexts,roster,snapshots});
  const statuses: Record<string,number> = {};
  for (const item of fetched) statuses[item.status]=(statuses[item.status]??0)+1;
  const queue=plan.selected.map(candidate => {
    const attempt=fetched.find(x=>x.sourceDocumentId===candidate.sourceDocumentId)!;
    return {
      sourceDocumentId:candidate.sourceDocumentId,
      publisher:candidate.publisher, seedId:candidate.seedId,
      originalUrl:candidate.originalUrl,
      archiveUrl:candidate.archiveUrl,
      archiveCapturedAt:candidate.archiveCapturedAt,
      recordedOriginalSha256:candidate.sourceSha256,
      observedOriginalSha256:attempt.observedSha256,
      sourceProofDisposition:attempt.status,
      rawBytesAuthenticated:attempt.status==='verified_original_bytes',
      reviewDisposition:'unreviewed',
      mentionedMembersAsDiscoveryLeadsOnly:candidate.mentionedMembers,
      namedSpeakerVerified:false, issueClassified:false,
      exactQuotationVerified:false,
    };
  });
  mkdirSync(output,{mode:0o700});
  const filenames: Record<string,{bytes:number,sha256:string,rows?:number}> = {};
  const store=(name:string,body:string,rows?:number)=>{
    writePrivate(resolve(output,name),body);
    filenames[name]={bytes:Buffer.byteLength(body),sha256:hash(body),...(rows===undefined?{}:{rows})};
  };
  const evidenceBody=jsonl(fetched.map(({snapshot,...rest})=>rest));
  store('source-attempts.jsonl',evidenceBody,fetched.length);
  store('human-review-queue.jsonl',jsonl(queue),queue.length);
  store('discovery-audit.json',JSON.stringify(audit,null,2)+'\n');
  if (snapshots.length) store('authenticated-original-snapshots.jsonl',jsonl(snapshots),snapshots.length);
  const manifest={
    version:SENATE_MEDIA_REHYDRATION_VERSION,
    generatedAt:new Date().toISOString(),
    inputMetadataOnly:true, productionDatabaseRead:false, productionDatabaseWrite:false,
    exactSourceSha256IsMandatory:true, sourceRetrievalUsedOnlyPublicExactWaybackUrls:true,
    noPublisherLiveSiteFallback:true, noAlternateCaptureFallback:true,
    noArticleBytesExportedWithoutHashMatch:true,
    noHumanReviewPerformed:true, noVerifiedQuotationsClaimed:true,
    neverUseContextMentionsAsSenatorQuotes:true,
    noHistoricalCompletenessCertificate:true,
    selection:{requestedYear:args['--year'] === undefined ? null : Number(args['--year']),
      offset:numeric(args['--offset'],0),limit:numeric(args['--limit'],6),
      eligibleDocuments:plan.eligibleDocuments,
      studyYearContexts:plan.studyYearContexts,
      excludedOutside2021To2025:plan.excludedOutside2021To2025,
      rejectedInvalidProvenance:plan.rejectedInStudy,
      rejectionReasons:plan.rejectionReasons,
      nextOffset:plan.nextOffset},
    attempted:fetched.length,
    verifiedSourceBodies:snapshots.length,
    statuses,
    files:filenames,
    interpretation:'Authenticated bytes only establish the same archived response as the original DB hash. Publication date, speaker, quote, issue and retrospective availability require separate human validation. 2026 is excluded.',
  };
  store('manifest.json',JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({
    outputDirectory:output,
    attemptedSources:fetched.length,
    originalSourceBytesHashMatched:snapshots.length,
    rejectedInvalidSourceMetadata:plan.rejectedInStudy,
    excluded2026AndUnknown:plan.excludedOutside2021To2025,
    nextOffset:plan.nextOffset,
    sourceStatusCounts:statuses,
    noQuotesYetVerified:true,
    allFilesPrivate:true,
  },null,2));
}
main().catch(error=>{
  const text = error instanceof Error ? error.message : 'Private archival source replay failed';
  console.error(text.replace(/https?:\/\/\S+/g,'[source]').replace(/\/\S+\.jsonl\b/g,'[private]'));
  process.exitCode=1;
});
