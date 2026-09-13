import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { extractHistoricalDeepExpansionCandidates } from '../src/evaluation/historical-deep-expansion-extractor.js';
import type { HistoricalDeepExpansionDiscoveryManifest } from '../src/evaluation/historical-deep-expansion-discovery.js';
import type { HistoricalDeepExpansionSourceBundle } from '../src/evaluation/historical-deep-expansion-source-bundle.js';

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
      ?? process.env.VOTEPREDICT_DEEP_EXPANSION_CANDIDATES_OUTPUT
      ?? 'artifacts/historical-deep-expansion-discovery-candidates.json',
  );

  const discovery = JSON.parse(readFileSync(discoveryPath, 'utf8')) as HistoricalDeepExpansionDiscoveryManifest;
  const sources = JSON.parse(readFileSync(sourcesPath, 'utf8')) as HistoricalDeepExpansionSourceBundle;
  const result = extractHistoricalDeepExpansionCandidates(discovery, sources);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });

  console.log(JSON.stringify({
    outputPath,
    input: result.input,
    summary: result.summary,
    casesWithCandidates: [...new Set(result.candidates.map((item) => item.case.stableKey))].sort(),
    currentOnly: result.candidates
      .filter((item) => item.selectedForCurrentDeep && !item.selectedForCandidateDeep)
      .map((item) => ({ stableKey: item.case.stableKey, memberName: item.memberName, voteSide: item.voteSide })),
    candidateOnly: result.candidates
      .filter((item) => item.selectedForCandidateDeep && !item.selectedForCurrentDeep)
      .map((item) => ({ stableKey: item.case.stableKey, memberName: item.memberName, voteSide: item.voteSide })),
    diagnostics: result.diagnostics.length,
  }));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}
