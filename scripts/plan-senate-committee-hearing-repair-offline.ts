/**
 * Issue #864. OFFLINE local/private JSONL planning only.
 * No network, no database driver, no env-secret lookup and NO mutation.
 *
 * node --import tsx scripts/plan-senate-committee-hearing-repair-offline.ts \
 *   --input private-senate-committee-evidence.jsonl \
 *   --plan private-committee-hearing-repair-plan.json \
 *   --sql private-committee-hearing-repair-DRYRUN.sql
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  planSenateCommitteeHearingRepair,
  previewSenateCommitteeHearingRepairSql,
  type SenateCommitteeHistoricalEvidenceExportRow,
} from '../src/evidence/senate-committee-hearing-repair-plan.js';

function readOption(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  const inline = args.filter(x => x.startsWith(name + '='));
  if (index >= 0 && inline.length || inline.length > 1) throw Error('Duplicate ' + name);
  if (index >= 0) return args[index + 1] ?? null;
  return inline[0]?.slice(name.length + 1) ?? null;
}

function main() {
  const args = process.argv.slice(2);
  const input = readOption(args, '--input');
  const out = readOption(args, '--plan');
  const sql = readOption(args, '--sql');
  if (!input || !out || !sql) throw Error('Provide --input, --plan, and --sql');
  const allowed = new Set(['--input', '--plan', '--sql']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (allowed.has(arg)) { i++; continue; }
    if (arg.startsWith('--') && [...allowed].some(flag => arg.startsWith(flag + '='))) continue;
    if (arg.startsWith('--') || i === 0 && !arg.startsWith('--')) throw Error('Unsupported option');
  }
  const paths = [input, out, sql].map(resolve);
  if (new Set(paths).size !== 3) throw Error('Input and output paths must be distinct');
  const contents = readFileSync(paths[0]!, 'utf8');
  if (contents.length > 30_000_000) throw Error('Private JSONL export exceeds 30 MiB');
  const lines = contents.split(/\r?\n/).filter(Boolean);
  if (lines.length > 100_000) throw Error('Private JSONL row bound exceeded');
  const rows = lines.map((line, i) => {
    let value: unknown;
    try { value = JSON.parse(line); }
    catch { throw Error('Malformed JSONL at line ' + (i + 1)); }
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw Error('Nonobject export row at line ' + (i + 1));
    return value as SenateCommitteeHistoricalEvidenceExportRow;
  });
  const plan = planSenateCommitteeHearingRepair(rows);
  writeFileSync(paths[1]!, JSON.stringify(plan, null, 2) + '\n');
  const preview = previewSenateCommitteeHearingRepairSql(rows);
  if (!preview.trimEnd().endsWith('ROLLBACK;')) throw Error('Refusing SQL without an unconditional rollback');
  writeFileSync(paths[2]!, preview);
  // No member UUIDs, raw source names, excerpts or URLs in terminal logs.
  console.log(JSON.stringify({
    exportedRows: plan.exportedRows,
    reviewCandidates: plan.reviewCandidates,
    alreadyCorrect: plan.alreadyCorrect,
    blocked: plan.blocked,
    byDisposition: plan.byDisposition,
    sqlAlwaysRollsBack: true,
    productionDbConnected: false,
    rowOrModelDataChanged: false,
  }, null, 2));
}

try { main(); }
catch (e) {
  console.error(e instanceof Error ? e.message.replace(/https?:\/\/\S+/g, '[source]') : 'Offline repair planner failed');
  process.exitCode = 1;
}
