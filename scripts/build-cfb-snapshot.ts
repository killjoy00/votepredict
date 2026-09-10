import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fetchCurrentCampaignFinanceSnapshot } from '../src/evidence/campaign-finance-live.js';

const output = resolve(process.argv[2] ?? 'data/cfb-2025-2026-snapshot.json');

async function main(): Promise<void> {
  const snapshot = await fetchCurrentCampaignFinanceSnapshot();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(snapshot)}\n`, 'utf8');
  console.log(`Wrote ${snapshot.candidates.length} legislative candidate committee summaries to ${output}`);
  console.log(
    `2025-26 contribution rows: ${snapshot.provenance.contributions.cycleRows}; `
      + `candidate expenditure rows: ${snapshot.provenance.expenditures?.cycleRows ?? 0}; `
      + `IE rows: ${snapshot.provenance.independentExpenditures.cycleRows}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
