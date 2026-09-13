import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { HistoricalDeepExpansionDiscoveryCandidateBundleV2 } from '../src/evaluation/historical-deep-expansion-extractor-v2';
import { auditHistoricalDeepExpansionSourceGaps } from '../src/evaluation/historical-deep-expansion-source-gap-audit';
import type { HistoricalDeepExpansionSourceBundle } from '../src/evaluation/historical-deep-expansion-source-bundle';

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function main(): Promise<void> {
  const [sourcePath, candidatePath, outputPath] = process.argv.slice(2);
  if (!sourcePath || !candidatePath || !outputPath) {
    throw new Error('Usage: audit-historical-deep-expansion-source-gaps <source-bundle.json> <candidate-bundle-v2.json> <output.json>');
  }

  const [sources, candidates] = await Promise.all([
    readJson<HistoricalDeepExpansionSourceBundle>(sourcePath),
    readJson<HistoricalDeepExpansionDiscoveryCandidateBundleV2>(candidatePath),
  ]);
  const audit = auditHistoricalDeepExpansionSourceGaps(sources, candidates);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    schemaVersion: audit.schemaVersion,
    cases: audit.summary.cases,
    casesWithOfficialSources: audit.summary.casesWithOfficialSources,
    casesWithoutOfficialSources: audit.summary.casesWithoutOfficialSources,
    casesWithCandidates: audit.summary.casesWithCandidates,
    casesWithSourcesButNoCandidates: audit.summary.casesWithSourcesButNoCandidates,
    sourceCoverageRate: audit.summary.sourceCoverageRate,
    candidateCoverageRate: audit.summary.candidateCoverageRate,
    candidateCoverageAmongSourceCoveredCases: audit.summary.candidateCoverageAmongSourceCoveredCases,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
