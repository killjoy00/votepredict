import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { evaluateHistoricalDeepTargetedImpactReplay } from '../src/evaluation/historical-deep-targeted-impact-replay.js';

async function main(): Promise<void> {
  const targetStrategyPath = process.argv[2];
  const discoveryPath = process.argv[3];
  const candidatePath = process.argv[4];
  const sourcePath = process.argv[5];
  const outcomePath = process.argv[6];
  const outputPath = resolve(process.argv[7] ?? 'artifacts/historical-deep-targeted-impact-replay.json');

  if (!targetStrategyPath || !discoveryPath || !candidatePath || !sourcePath || !outcomePath) {
    throw new Error('target-strategy, discovery, candidate, source, and outcome paths are required');
  }

  const targetStrategies = JSON.parse(readFileSync(resolve(targetStrategyPath), 'utf8'));
  const discovery = JSON.parse(readFileSync(resolve(discoveryPath), 'utf8'));
  const candidates = JSON.parse(readFileSync(resolve(candidatePath), 'utf8'));
  const sources = JSON.parse(readFileSync(resolve(sourcePath), 'utf8'));
  const outcomes = JSON.parse(readFileSync(resolve(outcomePath), 'utf8'));
  const result = await evaluateHistoricalDeepTargetedImpactReplay(
    targetStrategies,
    discovery,
    candidates,
    sources,
    outcomes,
  );

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });

  const current = result.scenarios['current-targets'];
  const candidate = result.scenarios['need-only-targets'];
  const ceiling = result.scenarios['discovery-all'];
  console.log(JSON.stringify({
    outputPath,
    candidateStrategy: result.metadata.candidateStrategy,
    targetLimit: result.metadata.targetLimit,
    bakeoff: result.bakeoff,
    currentTargets: {
      candidateObservations: current.candidateObservations,
      affectedDecisiveMemberPairs: current.affectedDecisiveMemberPairs,
      correctedClassifications: current.correctedClassifications,
      harmedClassifications: current.harmedClassifications,
      deltaBrier: current.allDecisive.delta.brier ?? null,
      deltaLogLoss: current.allDecisive.delta.logLoss ?? null,
      deltaEce: current.allDecisive.delta.expectedCalibrationError ?? null,
      deltaAccuracy: current.allDecisive.delta.accuracy ?? null,
    },
    candidateTargets: {
      candidateObservations: candidate.candidateObservations,
      affectedDecisiveMemberPairs: candidate.affectedDecisiveMemberPairs,
      correctedClassifications: candidate.correctedClassifications,
      harmedClassifications: candidate.harmedClassifications,
      deltaBrier: candidate.allDecisive.delta.brier ?? null,
      deltaLogLoss: candidate.allDecisive.delta.logLoss ?? null,
      deltaEce: candidate.allDecisive.delta.expectedCalibrationError ?? null,
      deltaAccuracy: candidate.allDecisive.delta.accuracy ?? null,
    },
    discoveryAll: {
      candidateObservations: ceiling.candidateObservations,
      affectedDecisiveMemberPairs: ceiling.affectedDecisiveMemberPairs,
      correctedClassifications: ceiling.correctedClassifications,
      harmedClassifications: ceiling.harmedClassifications,
      deltaBrier: ceiling.allDecisive.delta.brier ?? null,
      deltaLogLoss: ceiling.allDecisive.delta.logLoss ?? null,
      deltaEce: ceiling.allDecisive.delta.expectedCalibrationError ?? null,
      deltaAccuracy: ceiling.allDecisive.delta.accuracy ?? null,
    },
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
