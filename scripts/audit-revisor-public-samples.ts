import { auditRevisorSourceChamberPassage, fetchRevisorStatusXml } from '../src/sources/minnesota/revisor-actions.js';

type Sample = {
  legislature: number;
  year: number;
  identifier: string;
  expectation: 'known-pass' | 'provisional-fail' | 'public-dead';
};

const samples: Sample[] = [
  { legislature: 92, year: 2021, identifier: 'HF1064', expectation: 'known-pass' },
  { legislature: 92, year: 2021, identifier: 'HF109', expectation: 'known-pass' },
  { legislature: 92, year: 2021, identifier: 'HF1051', expectation: 'provisional-fail' },
  { legislature: 92, year: 2021, identifier: 'HF2267', expectation: 'provisional-fail' },
  { legislature: 92, year: 2021, identifier: 'SF1', expectation: 'known-pass' },
  { legislature: 92, year: 2021, identifier: 'SF1018', expectation: 'known-pass' },
  { legislature: 93, year: 2023, identifier: 'HF1', expectation: 'known-pass' },
  { legislature: 93, year: 2023, identifier: 'HF100', expectation: 'known-pass' },
  { legislature: 93, year: 2023, identifier: 'SF10', expectation: 'known-pass' },
  { legislature: 93, year: 2023, identifier: 'SF13', expectation: 'known-pass' },
  { legislature: 94, year: 2025, identifier: 'HF1014', expectation: 'known-pass' },
  { legislature: 94, year: 2025, identifier: 'HF4591', expectation: 'known-pass' },
  { legislature: 94, year: 2025, identifier: 'SF1075', expectation: 'known-pass' },
  { legislature: 94, year: 2025, identifier: 'HF3422', expectation: 'public-dead' },
  { legislature: 94, year: 2025, identifier: 'HF4271', expectation: 'public-dead' },
];

function statusPageUrl(sample: Sample): string {
  const fileType = sample.identifier.slice(0, 2).toUpperCase();
  const fileNumber = Number(sample.identifier.slice(2));
  return `https://www.revisor.mn.gov/bills/${sample.legislature}/${sample.year}/0/${fileType}/${fileNumber}/`;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main(): Promise<void> {
  const rows = [];
  let hardFailures = 0;

  for (const sample of samples) {
    try {
      const xml = await fetchRevisorStatusXml(statusPageUrl(sample));
      const audit = auditRevisorSourceChamberPassage({ xml, identifier: sample.identifier });
      const expectedPass = sample.expectation === 'known-pass';
      const expectedDead = sample.expectation === 'public-dead';
      const matchesExpectation = expectedPass
        ? audit.sourceChamberPassed
        : expectedDead
          ? !audit.sourceChamberPassed
          : null;

      if (matchesExpectation === false) hardFailures += 1;
      rows.push({
        identifier: sample.identifier,
        expectation: sample.expectation,
        sourceChamber: audit.sourceChamber,
        sourceChamberPassed: audit.sourceChamberPassed,
        sourceChamberFailed: audit.sourceChamberFailed,
        actionCount: audit.actions.length,
        classifiedActions: audit.classifiedActions,
        unclassifiedActions: audit.unclassifiedActions,
        fieldNames: [...new Set(audit.actions.flatMap((action) => Object.keys(action.fields)))].sort(),
        passageDescriptions: audit.passageActions.map((action) => action.description),
        matchesExpectation,
      });
    } catch (error) {
      hardFailures += 1;
      rows.push({
        identifier: sample.identifier,
        expectation: sample.expectation,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await sleep(350);
  }

  console.log(JSON.stringify({
    revisorPublicSampleAudit: {
      generatedAt: new Date().toISOString(),
      samples: rows,
      knownPasses: rows.filter((row) => row.expectation === 'known-pass').length,
      publicDeadControls: rows.filter((row) => row.expectation === 'public-dead').length,
      provisionalFailAudits: rows.filter((row) => row.expectation === 'provisional-fail').length,
      hardFailures,
    },
  }, null, 2));

  if (hardFailures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
