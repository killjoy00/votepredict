/**
 * Issue #864: offline-only, read-only, 2021-2025 Senate historical finance audit.
 * Accepts pre-exported JSONL, never connects to a database or fetches URLs.
 *
 * node --import tsx scripts/audit-cfb-historical-release-offline.ts \
 *   --evidence /path/to/cfb-senate-evidence.jsonl \
 *   --proofs /path/to/independently-reviewed-row-proofs.jsonl \
 *   --output /path/to/finance-release-audit.json
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  auditCfbHistoricalReleaseDebt,
  type HistoricalFinanceEvidenceExport,
  type HistoricalFinanceReportRowProof,
} from '../src/evidence/cfb-historical-release-audit.js';

const MAX_FILE_BYTES = 128 * 1024 * 1024;
const MAX_RECORDS = 250_000;

function argument(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  const inline = args.find(x => x.startsWith(name + '='));
  return inline?.slice(name.length + 1);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonl(path: string): unknown[] {
  const file = resolve(path);
  if (statSync(file).size > MAX_FILE_BYTES) throw new Error('Offline input exceeds the 128 MiB safety cap');
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const output: unknown[] = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    if (output.length >= MAX_RECORDS) throw new Error('Offline input exceeds the 250,000-record safety cap');
    try {
      output.push(JSON.parse(line));
    } catch {
      throw new Error('Invalid JSONL at line ' + (index + 1));
    }
  }
  return output;
}

function evidenceExport(item: unknown, index: number): HistoricalFinanceEvidenceExport {
  if (!record(item) || typeof item.sourceKind !== 'string' || !record(item.metadata)) {
    throw new Error('Invalid evidence export at record ' + (index + 1));
  }
  return {
    sourceKind: item.sourceKind,
    metadata: item.metadata,
    sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : null,
    sourceSha256: typeof item.sourceSha256 === 'string' ? item.sourceSha256 : null,
    publishedAt: typeof item.publishedAt === 'string' ? item.publishedAt : null,
    membershipChamber: typeof item.membershipChamber === 'string' ? item.membershipChamber : null,
  };
}

function rowProof(item: unknown, index: number): HistoricalFinanceReportRowProof {
  if (!record(item)) throw new Error('Invalid report row proof at record ' + (index + 1));
  const required = [
    'rowKey', 'family', 'registrationNumber', 'reportId', 'reportName',
    'reportType', 'coverageStartOn', 'coverageEndOn',
    'filedOn', 'proofUrl', 'reportSha256', 'exactRowProofSha256',
  ] as const;
  if (required.some(key => typeof item[key] !== 'string')) {
    throw new Error('Missing report row proof fields at record ' + (index + 1));
  }
  if (item.family !== 'candidate_contribution'
      && item.family !== 'candidate_expenditure'
      && item.family !== 'independent_expenditure') {
    throw new Error('Unsupported finance family at record ' + (index + 1));
  }
  if (item.reportType !== 'ordinary_report' && item.reportType !== 'large_contribution_notice') {
    throw new Error('Unsupported report type at record ' + (index + 1));
  }
  return {
    rowKey: item.rowKey as string,
    family: item.family,
    registrationNumber: item.registrationNumber as string,
    reportId: item.reportId as string,
    reportName: item.reportName as string,
    reportType: item.reportType,
    coverageStartOn: item.coverageStartOn as string,
    coverageEndOn: item.coverageEndOn as string,
    filedOn: item.filedOn as string,
    dueOn: typeof item.dueOn === 'string' ? item.dueOn : undefined,
    disclosedOn: typeof item.disclosedOn === 'string' ? item.disclosedOn : undefined,
    proofUrl: item.proofUrl as string,
    reportSha256: item.reportSha256 as string,
    exactRowProofSha256: item.exactRowProofSha256 as string,
  };
}

function main() {
  const evidencePath = argument('--evidence');
  if (!evidencePath) {
    throw new Error('Required: --evidence <local.jsonl> [--proofs <local.jsonl>] [--output <local.json>]');
  }
  const evidence = readJsonl(evidencePath).map(evidenceExport);
  const claims = argument('--proofs') ? readJsonl(argument('--proofs')!).map(rowProof) : [];
  const audit = auditCfbHistoricalReleaseDebt(evidence, claims);
  const outputPath = argument('--output');
  if (outputPath) {
    const out = resolve(outputPath);
    if (out === resolve(evidencePath) || (argument('--proofs') && out === resolve(argument('--proofs')!))) {
      throw new Error('Refusing to overwrite an input file');
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(audit, null, 2) + '\n', 'utf8');
  }
  console.log(JSON.stringify({
    schemaVersion: audit.schemaVersion,
    scope: audit.scope,
    input: audit.input,
    byYearFamily: audit.byYearFamily,
    denominator: audit.denominator,
    policy: audit.policy,
    rowDetails: outputPath ? resolve(outputPath) : 'omitted from stdout; pass --output to export',
  }, null, 2));
}

try { main(); } catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
