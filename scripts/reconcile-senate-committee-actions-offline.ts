/**
 * Issue #864 — OFFLINE ONLY, no database connection, no GitHub Actions.
 * Requires operator-supplied private SELECT-only source/event export and
 * source PDF proof artifacts. This script cannot obtain production credentials.
 *
 * node --import tsx scripts/reconcile-senate-committee-actions-offline.ts \
 *   --source reports-2022.json --source reports-2023.json \
 *   --source reports-2024.json --source reports-2025.json \
 *   --db-export private-senate-committee-actions.jsonl \
 *   --output private-reconciliation.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport,
  type OriginalSenateCommitteeYearAudit,
  type PersistedSenateCommitteeSourceExport,
} from '../src/evidence/senate-committee-source-to-db-reconciliation.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const sourceFiles: string[] = [];
  let exportFile = '';
  let outputFile = '';
  for (let i = 0; i < args.length; i++) {
    const token = args[i]!;
    if (token === '--source') sourceFiles.push(args[++i] ?? '');
    else if (token === '--db-export') exportFile = args[++i] ?? '';
    else if (token === '--output') outputFile = args[++i] ?? '';
    else throw Error('Unrecognized option: provide --source, --db-export, --output only');
  }
  if (sourceFiles.length < 1 || sourceFiles.length > 4
    || sourceFiles.some(x=>!x) || !exportFile || !outputFile) {
    throw Error('Require 1–4 annual source proof files plus an authorized SELECT-only DB export and output');
  }
  const paths = [...sourceFiles, exportFile, outputFile].map(x => resolve(x));
  if (new Set(paths).size !== paths.length) throw Error('All input and output paths must be different');
  return { sourceFiles: paths.slice(0, -2), exportFile: paths.at(-2)!, outputFile: paths.at(-1)! };
}

function loadInput(path: string, sizeMax: number): string {
  const body = readFileSync(path, 'utf8');
  if (!body.length || body.length > sizeMax) throw Error('Source/DB export exceeds fixed byte bound');
  return body;
}

function main() {
  const args = parseArgs();
  const sourceReports: OriginalSenateCommitteeYearAudit[] = args.sourceFiles.map(path => {
    const body = loadInput(path, 22_000_000);
    const parsed = JSON.parse(body) as OriginalSenateCommitteeYearAudit;
    if (!parsed || typeof parsed.auditedYear !== 'number'
      || !Array.isArray(parsed.documentProofs)
      || !Array.isArray(parsed.unresolvedOriginalDocuments)) {
      throw Error('Annual original PDF source manifest malformed');
    }
    return parsed;
  });
  const raw = loadInput(args.exportFile, 80_000_000);
  const lines = raw.trimEnd().split(/\r?\n/);
  if (lines.length > 25_000) throw Error('Private export exceeded source row bound');
  const exported: PersistedSenateCommitteeSourceExport[] = lines.map((line, index) => {
    let row: unknown;
    try { row = JSON.parse(line); }
    catch { throw Error('Invalid private JSONL source row ' + (index + 1)); }
    if (!row || typeof row !== 'object' || !Array.isArray((row as PersistedSenateCommitteeSourceExport).voteEvents)
      || !Array.isArray((row as PersistedSenateCommitteeSourceExport).contextActions)) {
      throw Error('Private source row missing expected event/action arrays at ' + (index + 1));
    }
    return row as PersistedSenateCommitteeSourceExport;
  });
  const report = reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport(sourceReports, exported);
  const output = {
    ...report,
    inputProof: {
      sourceYearCount: sourceReports.length,
      perYearOriginalPdfCounts: sourceReports.map(x=>({
        year: x.auditedYear, originalPdfs: x.independentlyDiscoveredOriginalMinutesPdfLinks,
      })),
      operatorExportOriginalContentSha256: createHash('sha256').update(raw).digest('hex'),
      productionDataObtainedByTool: false,
      publicRepositoryOrGitHubActionsWrite: false,
    },
  };
  writeFileSync(args.outputFile, JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({
    sourceYearCount: sourceReports.length,
    originalPdfCount: report.sourceOriginalPdfsAvailable,
    sourcePdfFailures: report.sourceOriginalPdfsUnavailable,
    sourceToDb: report.summary,
    privateDatabaseConnected: false,
    completenessCertified: false,
    output: args.outputFile,
  }, null, 2));
}
try { main(); }
catch (e) {
  // Don't echo raw private export lines or original PDF text into logs.
  console.error(e instanceof Error ? e.message.replace(/https?:\/\/\S+/gi, '[source]') : 'Offline audit failed');
  process.exitCode = 1;
}
