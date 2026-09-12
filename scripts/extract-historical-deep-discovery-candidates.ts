import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { extractHistoricalDeepDiscoveryCandidates } from '../src/evaluation/historical-deep-discovery-extractor.js';
import type { HistoricalDeepDiscoveryManifest } from '../src/evaluation/historical-deep-discovery.js';
import type { HistoricalDeepSourceBundle } from '../src/evaluation/historical-deep-source-catalog.js';

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requiredArgument(name: string): string {
  const value = argumentValue(name);
  if (!value) throw new Error(`${name} is required`);
  return resolve(value);
}

function main(): void {
  const discoveryPath = requiredArgument('--discovery');
  const sourcesPath = requiredArgument('--sources');
  const outputPath = resolve(
    argumentValue('--output')
      ?? process.env.VOTEPREDICT_DEEP_DISCOVERY_CANDIDATES_OUTPUT
      ?? 'artifacts/historical-deep-discovery-candidates.json',
  );

  const discovery = JSON.parse(readFileSync(discoveryPath, 'utf8')) as HistoricalDeepDiscoveryManifest;
  const sources = JSON.parse(readFileSync(sourcesPath, 'utf8')) as HistoricalDeepSourceBundle;
  const result = extractHistoricalDeepDiscoveryCandidates(discovery, sources);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });

  console.log(JSON.stringify({
    outputPath,
    input: result.input,
    summary: result.summary,
    nayCandidates: result.candidates
      .filter((candidate) => candidate.voteSide === 'nay')
      .map((candidate) => ({
        identifier: candidate.case.identifier,
        memberName: candidate.memberName,
        party: candidate.party,
        quickYesProbability: candidate.quickYesProbability ?? null,
        selectedForCurrentDeep: candidate.selectedForCurrentDeep,
        sourceId: candidate.source.sourceId,
      })),
    diagnostics: result.diagnostics.length,
  }));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}
