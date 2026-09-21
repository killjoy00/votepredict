import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  extractQuickEvidenceCommitteeRollcallCandidates,
} from '../src/evaluation/quick-evidence-committee-rollcall-extractor.js';
import type { QuickEvidenceCommitteeRollcallManifest } from '../src/evaluation/quick-evidence-committee-rollcall-manifest.js';
import type { QuickEvidenceCommitteeRollcallSourceBundle } from '../src/evaluation/quick-evidence-committee-rollcall-source-bundle.js';

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
  return value;
}

async function main(): Promise<void> {
  const manifestPath = resolve(requiredArgument('--manifest'));
  const sourcesPath = resolve(requiredArgument('--sources'));
  const outputPath = resolve(
    argumentValue('--output')
      ?? 'artifacts/quick-evidence-committee-rollcall-candidates-v1.json',
  );

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as QuickEvidenceCommitteeRollcallManifest;
  const sources = JSON.parse(readFileSync(sourcesPath, 'utf8')) as QuickEvidenceCommitteeRollcallSourceBundle;
  const result = extractQuickEvidenceCommitteeRollcallCandidates(manifest, sources);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });

  console.log(JSON.stringify({
    outputPath,
    schemaVersion: result.schemaVersion,
    parser: result.metadata.parser,
    outcomeUse: result.metadata.outcomeUse,
    observations: result.summary.observations,
    baselineObservations: result.summary.baselineObservations,
    supplementalObservations: result.summary.supplementalObservations,
    memberEventPairsWithFeatures: result.summary.memberEventPairsWithFeatures,
    eventsWithFeatures: result.summary.eventsWithFeatures,
    sourcesWithFeatures: result.summary.sourcesWithFeatures,
    bySession: result.summary.bySession,
    diagnostics: result.diagnostics.length,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
