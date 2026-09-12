import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { evaluateHistoricalDeepImpactReplay } from '../src/evaluation/historical-deep-impact-replay.js';

const discoveryPath = process.argv[2];
const candidatePath = process.argv[3];
const sourcePath = process.argv[4];
const outcomePath = process.argv[5];
const outputPath = resolve(process.argv[6] ?? 'artifacts/historical-deep-impact-replay.json');

if (!discoveryPath || !candidatePath || !sourcePath || !outcomePath) {
  throw new Error('discovery, candidate, source, and outcome paths are required');
}

const discovery = JSON.parse(readFileSync(resolve(discoveryPath), 'utf8'));
const candidates = JSON.parse(readFileSync(resolve(candidatePath), 'utf8'));
const sources = JSON.parse(readFileSync(resolve(sourcePath), 'utf8'));
const outcomes = JSON.parse(readFileSync(resolve(outcomePath), 'utf8'));
const result = await evaluateHistoricalDeepImpactReplay(discovery, candidates, sources, outcomes);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({
  outputPath,
  impactVersion: result.metadata.impactVersion,
  currentTargets: {
    candidateObservations: result.scenarios['current-targets'].candidateObservations,
    affectedDecisiveMemberPairs: result.scenarios['current-targets'].affectedDecisiveMemberPairs,
    correctedClassifications: result.scenarios['current-targets'].correctedClassifications,
    harmedClassifications: result.scenarios['current-targets'].harmedClassifications,
    deltaBrier: result.scenarios['current-targets'].allDecisive.delta.brier ?? null,
    deltaLogLoss: result.scenarios['current-targets'].allDecisive.delta.logLoss ?? null,
  },
  discoveryAll: {
    candidateObservations: result.scenarios['discovery-all'].candidateObservations,
    affectedDecisiveMemberPairs: result.scenarios['discovery-all'].affectedDecisiveMemberPairs,
    correctedClassifications: result.scenarios['discovery-all'].correctedClassifications,
    harmedClassifications: result.scenarios['discovery-all'].harmedClassifications,
    deltaBrier: result.scenarios['discovery-all'].allDecisive.delta.brier ?? null,
    deltaLogLoss: result.scenarios['discovery-all'].allDecisive.delta.logLoss ?? null,
  },
}));
