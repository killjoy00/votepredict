import { auditRevisorSourceChamberPassage, fetchRevisorStatusXml } from '../src/sources/minnesota/revisor-actions.js';

type Sample = { legislature: number; year: number; identifier: string; expectedPass: boolean };

const samples: Sample[] = [
  { legislature: 92, year: 2021, identifier: 'HF1064', expectedPass: true },
  { legislature: 92, year: 2021, identifier: 'HF109', expectedPass: true },
  { legislature: 92, year: 2021, identifier: 'SF1', expectedPass: true },
  { legislature: 93, year: 2023, identifier: 'HF1', expectedPass: true },
  { legislature: 93, year: 2023, identifier: 'SF10', expectedPass: true },
  { legislature: 93, year: 2023, identifier: 'SF13', expectedPass: true },
  { legislature: 94, year: 2025, identifier: 'HF1014', expectedPass: true },
  { legislature: 94, year: 2025, identifier: 'SF1075', expectedPass: true },
  { legislature: 92, year: 2021, identifier: 'HF1051', expectedPass: false },
  { legislature: 92, year: 2021, identifier: 'HF2267', expectedPass: false },
];

function url(sample: Sample): string {
  const fileType = sample.identifier.slice(0, 2);
  const fileNumber = Number(sample.identifier.slice(2));
  return `https://api.revisor.mn.gov/bills/v1/${sample.legislature}/${sample.year}/0/${fileType}/${fileNumber}/`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const results = [];
  let failures = 0;
  for (const sample of samples) {
    try {
      const xml = await fetchRevisorStatusXml(url(sample));
      const audit = auditRevisorSourceChamberPassage({ xml, identifier: sample.identifier });
      const matches = sample.expectedPass ? audit.sourceChamberPassed : !audit.sourceChamberPassed;
      if (!matches) failures += 1;
      results.push({
        identifier: sample.identifier,
        expectedPass: sample.expectedPass,
        sourceChamberPassed: audit.sourceChamberPassed,
        sourceChamberFailed: audit.sourceChamberFailed,
        actions: audit.actions.length,
        classifiedActions: audit.classifiedActions,
        unclassifiedActions: audit.unclassifiedActions,
        passageDescriptions: audit.passageActions.map((action) => action.description),
        matches,
      });
    } catch (error) {
      failures += 1;
      results.push({ identifier: sample.identifier, expectedPass: sample.expectedPass, error: error instanceof Error ? error.message : String(error) });
    }
    await sleep(250);
  }
  console.log(JSON.stringify({ liveRevisorParentChamberValidation: { failures, results } }, null, 2));
  if (failures) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
