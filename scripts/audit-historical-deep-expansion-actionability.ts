import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { HistoricalDeepExpansionImpactReplayV2 } from '../src/evaluation/historical-deep-expansion-impact-replay-v2';
import { auditHistoricalDeepExpansionActionability } from '../src/evaluation/historical-deep-expansion-actionability-audit';
import type { HistoricalDeepProceduralMechanicsArtifact } from '../src/evaluation/historical-deep-procedural-mechanics';

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function main(): Promise<void> {
  const [replayPath, taxonomyPath, outputPath] = process.argv.slice(2);
  if (!replayPath || !taxonomyPath || !outputPath) {
    throw new Error('Usage: audit-historical-deep-expansion-actionability <impact-replay-v2.json> <procedural-mechanics-v1.json> <output.json>');
  }

  const [replay, taxonomy] = await Promise.all([
    readJson<HistoricalDeepExpansionImpactReplayV2>(replayPath),
    readJson<HistoricalDeepProceduralMechanicsArtifact>(taxonomyPath),
  ]);
  const audit = auditHistoricalDeepExpansionActionability(replay, taxonomy);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    schemaVersion: audit.schemaVersion,
    blockedObservations: audit.summary.blockedObservations,
    mechanicallyActionableObservations: audit.summary.mechanicallyActionableObservations,
    legacyScenarioAppliedEvidenceItems: audit.summary.legacyScenarioAppliedEvidenceItems,
    gatedScenarioAppliedEvidenceItems: audit.summary.gatedScenarioAppliedEvidenceItems,
  }, null, 2));
}

await main();
