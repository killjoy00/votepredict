/**
 * #864 Track D. Operator-supplied SELECT-only JSONL + independently acquired
 * archived source bytes. NO network, DB, GitHub API, scheduler or model access.
 *
 * node --import tsx scripts/audit-senate-media-remarks-offline.ts \
 *   --context PRIVATE-context.jsonl --roster PRIVATE-roster.jsonl \
 *   --reviews PRIVATE-reviewed-quotes.jsonl \
 *   --snapshots PRIVATE-original-snapshots.jsonl \
 *   --output PRIVATE-media-audit.json
 *
 * --reviews and --snapshots are optional: missing proofs remain unverified.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  auditSenateMediaRemarks,
  type SenateMediaContextExport, type SenateMediaRosterYear,
  type SenateMediaReview, type SenateMediaSourceSnapshot,
} from '../src/evidence/senate-media-remarks-audit.js';

function parseArgs(): Record<string, string> {
  const allowed = new Set(['--context', '--roster', '--reviews', '--snapshots', '--output']);
  const params: Record<string, string> = {};
  const argv = process.argv.slice(2);
  if (argv.length % 2 !== 0) throw Error('Every offline media audit option needs a file path');
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]!;
    if (!allowed.has(key) || params[key]) throw Error('Invalid or duplicate offline media audit option');
    params[key] = resolve(argv[i + 1]!);
  }
  if (!params['--context'] || !params['--roster'] || !params['--output'])
    throw Error('Require --context, --roster and --output; --reviews and --snapshots are optional');
  if (new Set(Object.values(params)).size !== Object.values(params).length)
    throw Error('Offline media input and output paths must be distinct');
  return params;
}
function inputFile(path: string, sizeLimit: number) {
  const body = readFileSync(path, 'utf8');
  if (!body || Buffer.byteLength(body) > sizeLimit)
    throw Error('Offline media input is empty or exceeds the fixed size limit');
  return body;
}
function jsonl<T>(body: string, label: string): T[] {
  const lines = body.trimEnd().split(/\r?\n/);
  if (lines.length > 50_000) throw Error(label + ' exceeds the row-count bound');
  return lines.map((line, i) => {
    if (!line.trim()) throw Error(label + ' has an empty row ' + (i + 1));
    let row: unknown;
    try { row = JSON.parse(line); }
    catch { throw Error(label + ' contains malformed JSON at row ' + (i + 1)); }
    if (!row || typeof row !== 'object' || Array.isArray(row))
      throw Error(label + ' row ' + (i + 1) + ' is not an object');
    return row as T;
  });
}
function main() {
  const args = parseArgs();
  const body = inputFile(args['--context'], 80_000_000);
  const contexts = jsonl<SenateMediaContextExport>(body, 'context');
  const roster = jsonl<SenateMediaRosterYear>(
    inputFile(args['--roster'], 8_000_000), 'roster');
  const reviews = args['--reviews']
    ? jsonl<SenateMediaReview>(inputFile(args['--reviews'], 20_000_000), 'reviews') : [];
  const snapshots = args['--snapshots']
    ? jsonl<SenateMediaSourceSnapshot>(inputFile(args['--snapshots'], 200_000_000), 'snapshots') : [];
  const result = auditSenateMediaRemarks({ contexts, roster, reviews, snapshots });
  const report = {
    ...result,
    inputAudit: {
      sourceContextFileSha256: createHash('sha256').update(body).digest('hex'),
      suppliedRosterRows: roster.length,
      suppliedReviewVerdicts: reviews.length,
      suppliedVerifiedByteCandidates: snapshots.length,
      originalSnapshotBytesPersistedInReport: false,
      authorizedExportSuppliedExternally: true,
      databaseConnectedByThisTool: false,
      productionWrite: false,
    },
  };
  // Sensitive inputs/quotes remain operator-private; NEVER upload report to CI.
  writeFileSync(args['--output'], JSON.stringify(report, null, 2) + '\n',
    { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({
    version: result.version, years: result.studyYears,
    contextItems: result.corpusContextItemsInSuppliedExport,
    excluded2026AndOtherYearItems: result.corpusContextItemsOutsideStudyYears,
    archivedArticles: result.distinctArchivedArticlesInExport,
    verifiedNamedQuotes: result.verifiedAttributedQuotePassages,
    unverifiedReviewedQuotes: result.reviewedButUnverifiedQuotePassages,
    unreviewedArticles: result.unreviewedArchivedArticles,
    unknownOfficialPublisherRemarkDenominator: true,
    historicalCompletenessCertified: false,
    networkOrDatabaseAccess: false,
  }, null, 2));
}
try { main(); }
catch (error) {
  // Never include private source text/quote rows or private file paths in logs.
  const reason = error instanceof Error ? error.message : 'Unknown media audit failure';
  console.error(reason.replace(/https?:\/\/\S+/g, '[source]').replace(/\/\S+\.jsonl\b/g, '[private]'));
  process.exitCode = 1;
}
