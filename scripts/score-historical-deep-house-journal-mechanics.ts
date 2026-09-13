import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  scoreHistoricalDeepHouseJournalMechanics,
  type HistoricalDeepHouseJournalMechanicsScoreLineage,
} from '../src/evaluation/historical-deep-house-journal-mechanics-score.js';

const discoveryPath = process.argv[2];
const mechanicsPath = process.argv[3];
const outcomesPath = process.argv[4];
const lineagePath = process.argv[5];
const outputPath = resolve(process.argv[6] ?? 'artifacts/historical-deep-house-journal-mechanics-score-v1.json');

if (!discoveryPath) throw new Error('frozen Quick discovery manifest path is required');
if (!mechanicsPath) throw new Error('frozen House Journal mechanics artifact path is required');
if (!outcomesPath) throw new Error('frozen development outcome snapshot path is required');
if (!lineagePath) throw new Error('House Journal mechanics score lineage path is required');

const discovery = JSON.parse(readFileSync(resolve(discoveryPath), 'utf8'));
const mechanics = JSON.parse(readFileSync(resolve(mechanicsPath), 'utf8'));
const outcomes = JSON.parse(readFileSync(resolve(outcomesPath), 'utf8'));
const lineage = JSON.parse(readFileSync(resolve(lineagePath), 'utf8')) as HistoricalDeepHouseJournalMechanicsScoreLineage;

const result = scoreHistoricalDeepHouseJournalMechanics({
  discovery,
  mechanics,
  outcomes,
  lineage,
});

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({
  outputPath,
  input: result.input,
  overall: result.summary.overall,
  mechanics: Object.fromEntries(Object.entries(result.summary.mechanics).map(([name, value]) => [name, {
    observations: value.observations,
    cases: value.withMechanic.cases,
    actualYesRate: value.withMechanic.actualYesRate,
    quickMeanYesProbability: value.withMechanic.quickMeanYesProbability,
    memberWeightedSignedResidual: value.withMechanic.memberWeightedSignedResidual,
    caseMeanSignedResidual: value.withMechanic.caseMeanSignedResidual,
    quickBrier: value.withMechanic.quickBrier,
    recency: value.lastObservationRecency,
  }])),
}));
