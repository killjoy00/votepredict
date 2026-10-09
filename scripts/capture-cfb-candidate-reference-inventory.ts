/**
 * Bounded official CFB reports-tab reference capture only. Never obtains PDF
 * bodies, personal contributions, live DB credentials, or forecasting inputs.
 *
 * node --import tsx scripts/capture-cfb-candidate-reference-inventory.ts
 *   --registrations 19205 --segments 2026 --output /tmp/cfb-refs.jsonl
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  fetchCfbCandidateHistoricalReportReferenceSnapshot,
} from '../src/evidence/cfb-candidate-report-history.js';
import type { CfbCandidateInventorySnapshot } from '../src/evidence/cfb-candidate-report-inventory.js';

function argument(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return args.find(arg => arg.startsWith(name + '='))?.slice(name.length + 1);
}

function registrations(value: string | undefined): string[] {
  const values = (value ?? '').split(',').map(v => v.trim()).filter(Boolean);
  if (!values.length || values.length > 5 || values.some(x => !/^\d{3,8}$/.test(x))) {
    throw new Error('Supply 1-5 numeric CFB registration IDs with --registrations');
  }
  if (new Set(values).size !== values.length) throw new Error('Duplicate registration ID');
  return values;
}

function segments(value: string | undefined): Array<2022 | 2024 | 2026> {
  const options = (value ?? '').split(',').map(v => v.trim()).filter(Boolean);
  if (!options.length || options.length > 3 || options.some(v => !['2022', '2024', '2026'].includes(v))) {
    throw new Error('Supply 2022,2024,2026 or a subset with --segments');
  }
  if (new Set(options).size !== options.length) throw new Error('Duplicate segment');
  return options.map(v => Number(v) as 2022 | 2024 | 2026);
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // A public-source fetch failure is a gap, not evidence of zero filings.
  return message.replace(/https?:\/\/\S+/g, '[official source URL]').slice(0, 250);
}

async function main() {
  const ids = registrations(argument('--registrations'));
  const endYears = segments(argument('--segments'));
  const output = argument('--output');
  if (!output) throw new Error('--output path is required');
  const snapshots: CfbCandidateInventorySnapshot[] = [];
  for (const id of ids) {
    for (const segment of endYears) {
      const sourceUrl = 'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'
        + id + '/' + segment + '/';
      try {
        const snapshot = await fetchCfbCandidateHistoricalReportReferenceSnapshot(id, segment);
        if (snapshot.references.length > 250) throw new Error('Source listed more than 250 report references');
        snapshots.push({ status: 'acquired', ...snapshot });
      } catch (error) {
        snapshots.push({
          status: 'fetch_failed', registrationNumber: id, segmentEndYear: segment,
          sourceUrl, errorKind: safeError(error),
        });
      }
    }
  }
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(resolve(output), snapshots.map(x => JSON.stringify(x)).join('\n') + '\n', 'utf8');
  console.log(JSON.stringify({
    provenanceOnly: true,
    scope: '2021-2025 candidate viewer report-reference discovery',
    requestedRegistrationCount: ids.length,
    requestedSegments: endYears,
    requests: snapshots.length,
    acquiredSnapshots: snapshots.filter(s => s.status === 'acquired').length,
    failedSnapshots: snapshots.filter(s => s.status === 'fetch_failed').length,
    reportReferencesObserved: snapshots.reduce((count, s) => count
      + (s.status === 'acquired' ? s.references.length : 0), 0),
    file: resolve(output),
    trueOfficialDenominatorKnown: false,
    reportPdfBytesFetched: 0,
    historicalAvailabilityEstablished: false,
    productionAction: 'none',
  }, null, 2));
}

main().catch(error => {
  console.error(safeError(error));
  process.exitCode = 1;
});
