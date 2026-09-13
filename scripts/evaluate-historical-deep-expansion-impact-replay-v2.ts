import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { evaluateHistoricalDeepExpansionImpactReplayV2 } from '../src/evaluation/historical-deep-expansion-impact-replay-v2.js';

async function main(): Promise<void> {
  const discoveryPath = process.argv[2];
  const candidatePath = process.argv[3];
  const sourcePath = process.argv[4];
  const outcomePath = process.argv[5];
  const scorePath = process.argv[6];
  const outputPath = resolve(process.argv[7] ?? 'artifacts/historical-deep-expansion-impact-replay-v2.json');
  if (!discoveryPath || !candidatePath || !sourcePath || !outcomePath || !scorePath) {
    throw new Error('discovery, candidate, source, outcome, and score paths are required');
  }

  const discovery = JSON.parse(readFileSync(resolve(discoveryPath), 'utf8'));
  const candidates = JSON.parse(readFileSync(resolve(candidatePath), 'utf8'));
  const sources = JSON.parse(readFileSync(resolve(sourcePath), 'utf8'));
  const outcomes = JSON.parse(readFileSync(resolve(outcomePath), 'utf8'));
  const score = JSON.parse(readFileSync(resolve(scorePath), 'utf8'));
  const result = await evaluateHistoricalDeepExpansionImpactReplayV2(
    discovery,
    candidates,
    sources,
    outcomes,
    score,
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });

  const scenarioSummary = (name: 'current-targets' | 'need-only-targets' | 'discovery-all') => {
    const scenario = result.scenarios[name];
    return {
      requestedTargets: scenario.requestedTargets,
      candidateObservations: scenario.candidateObservations,
      evidenceItems: scenario.evidenceItems,
      appliedEvidenceItems: scenario.appliedEvidenceItems,
      excludedEvidenceItems: scenario.excludedEvidenceItems,
      affectedMembers: scenario.affectedMembers,
      changedMembers: scenario.changedMembers,
      decisiveMemberPairs: scenario.decisiveMemberPairs,
      affectedDecisiveMemberPairs: scenario.affectedDecisiveMemberPairs,
      correctedClassifications: scenario.correctedClassifications,
      harmedClassifications: scenario.harmedClassifications,
      classificationFlips: scenario.classificationFlips,
      accuracyDelta: scenario.allDecisive.delta.accuracy ?? null,
      brierDelta: scenario.allDecisive.delta.brier ?? null,
      logLossDelta: scenario.allDecisive.delta.logLoss ?? null,
      eceDelta: scenario.allDecisive.delta.expectedCalibrationError ?? null,
    };
  };

  console.log(JSON.stringify({
    outputPath,
    signalContext: result.signalContext,
    quick: result.comparison.quick ?? null,
    currentTargets: scenarioSummary('current-targets'),
    needOnlyTargets: scenarioSummary('need-only-targets'),
    discoveryAll: scenarioSummary('discovery-all'),
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
