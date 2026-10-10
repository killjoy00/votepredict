/**
 * One-command, offline candidate report source-proof census (issue #864).
 * Only opens the two previously independently verified, metadata-only ledgers.
 * No network/DB read or write. The official statewide denominator stays null.
 *
 * node --import tsx scripts/audit-cfb-senate-pinned-ledgers-offline.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  auditCfbSenatePinnedReportCoverage,
  readCfbSenatePinnedReportProofs,
} from '../src/evidence/cfb-senate-pinned-ledger-coverage.js';

const LEDGER_SD6 = 'docs/evaluation/source-proof/cfb-2025-senate-district6-report-pdfs.json';
const LEDGER_SD64 = 'docs/evaluation/source-proof/cfb-2021-22-senate-one-filer-original-reports-and-calendars.json';

function readLedger(file: string): unknown {
  const contents = readFileSync(resolve(file), 'utf8');
  if (contents.length > 2_000_000) throw Error('Unexpectedly large metadata-only source ledger');
  return JSON.parse(contents) as unknown;
}

const args = process.argv.slice(2);
if (args.length > 2 || (args.length && (args[0] !== '--output' || !args[1]))) {
  throw Error('Usage: node --import tsx scripts/audit-cfb-senate-pinned-ledgers-offline.ts [--output <json>]');
}
const output = args[1] ? resolve(args[1]) : null;
if (output && [LEDGER_SD6, LEDGER_SD64].some(file => resolve(file) === output)) {
  throw Error('Refusing to overwrite a pinned original source ledger');
}
const reports = readCfbSenatePinnedReportProofs({
  sd6: readLedger(LEDGER_SD6),
  senate64: readLedger(LEDGER_SD64),
});
const audit = auditCfbSenatePinnedReportCoverage(reports);
if (output) writeFileSync(output, JSON.stringify(audit, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  schemaVersion: audit.schemaVersion,
  byYear: audit.byYear,
  pilotTotals: audit.pilotTotals,
  statewideDenominator: audit.statewideDenominator,
  output: output ?? 'stdout-summary-only',
}, null, 2));
