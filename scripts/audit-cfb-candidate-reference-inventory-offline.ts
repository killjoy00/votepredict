/**
 * Issue #864: offline join of Senate candidate evidence-registration scope to
 * public CFB candidate reports-tab snapshots. Does not fetch or write a DB.
 *
 * node --import tsx scripts/audit-cfb-candidate-reference-inventory-offline.ts
 *   --evidence /private/senate-finance-export.jsonl
 *   --snapshots /private/cfb-reference-snapshots.jsonl
 *   --output /private/cfb-report-inventory.json
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  auditCfbSenateCandidateReportReferences,
  deriveSenateCandidateFinanceInventoryTargets,
  type CfbCandidateInventorySnapshot,
  type CfbCandidateInventoryTarget,
} from '../src/evidence/cfb-candidate-report-inventory.js';
import type { HistoricalFinanceEvidenceExport } from '../src/evidence/cfb-historical-release-audit.js';

function argument(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : args.find(x => x.startsWith(name + '='))?.slice(name.length + 1);
}

function object(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
}

function jsonl(path: string): unknown[] {
  const file = resolve(path);
  if (statSync(file).size > 128 * 1024 * 1024) throw Error('Input exceeds 128 MiB limit');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line.trim());
  if (lines.length > 250_000) throw Error('Input exceeds 250,000 lines');
  return lines.map((line, i) => {
    try { return JSON.parse(line); }
    catch { throw Error('Invalid JSONL line ' + (i + 1)); }
  });
}

function evidence(x: unknown): HistoricalFinanceEvidenceExport {
  if (!object(x) || typeof x.sourceKind !== 'string' || !object(x.metadata)) {
    throw Error('Invalid evidence export record');
  }
  return {
    sourceKind: x.sourceKind, metadata: x.metadata,
    membershipChamber: typeof x.membershipChamber === 'string' ? x.membershipChamber : null,
  };
}

function target(x: unknown): CfbCandidateInventoryTarget {
  if (!object(x) || typeof x.registrationNumber !== 'string'
    || typeof x.year !== 'number') throw Error('Invalid target filer-year record');
  return { registrationNumber: x.registrationNumber, year: x.year };
}

function snapshot(x: unknown): CfbCandidateInventorySnapshot {
  if (!object(x) || !['acquired', 'fetch_failed'].includes(String(x.status))
    || typeof x.registrationNumber !== 'string' || typeof x.segmentEndYear !== 'number') {
    throw Error('Invalid official source capture record');
  }
  if (x.status === 'fetch_failed') {
    if (typeof x.sourceUrl !== 'string' || typeof x.errorKind !== 'string') {
      throw Error('Invalid failed-source record');
    }
  } else if (typeof x.sourceUrl !== 'string' || typeof x.apiUrl !== 'string'
    || typeof x.responseSha256 !== 'string' || typeof x.fetchedAt !== 'string'
    || !Array.isArray(x.references)) {
    throw Error('Invalid acquired-source record');
  }
  return x as unknown as CfbCandidateInventorySnapshot;
}

function main() {
  const snapshotsPath = argument('--snapshots');
  const evidencePath = argument('--evidence');
  const targetsPath = argument('--targets');
  const outputPath = argument('--output');
  if (!snapshotsPath || (!evidencePath && !targetsPath) || !outputPath) {
    throw Error('Required: --snapshots <jsonl> --output <json>; supply --evidence <jsonl> or --targets <jsonl>');
  }
  const evidenceRows = evidencePath ? jsonl(evidencePath).map(evidence) : [];
  const explicitlyScoped = targetsPath ? jsonl(targetsPath).map(target) : [];
  const targets = [...deriveSenateCandidateFinanceInventoryTargets(evidenceRows), ...explicitlyScoped];
  if (!targets.length) throw Error('No verified-scope candidates in the supplied inputs; not a zero-report result');
  const snapshots = jsonl(snapshotsPath).map(snapshot);
  const audit = auditCfbSenateCandidateReportReferences(targets, snapshots);
  const file = resolve(outputPath);
  if ([snapshotsPath, evidencePath, targetsPath].filter(Boolean).some(input => resolve(input!) === file)) {
    throw Error('Refusing to overwrite source data');
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(audit, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    schemaVersion: audit.schemaVersion,
    scope: audit.scope,
    input: audit.inputs,
    byYear: audit.byYear,
    denominator: audit.denominator,
    policy: audit.policy,
    reportReferenceCount: audit.reports.length,
    reportDetails: file,
  }, null, 2));
}
try { main(); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
