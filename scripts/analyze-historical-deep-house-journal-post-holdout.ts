import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  analyzeHistoricalDeepHouseJournalPostHoldout,
  type HistoricalDeepHouseJournalPostHoldoutPlan,
} from '../src/evaluation/historical-deep-house-journal-post-holdout.js';
import type { HistoricalDeepHouseJournalMechanicsScoreArtifact } from '../src/evaluation/historical-deep-house-journal-mechanics-score.js';
import type { HistoricalDeepHouseJournalHoldoutScoreArtifact } from '../src/evaluation/historical-deep-house-journal-holdout-score.js';

const developmentPath = process.argv[2];
const holdoutPath = process.argv[3];
const planPath = process.argv[4];
const outputPath = resolve(process.argv[5] ?? 'artifacts/historical-deep-house-journal-post-holdout-sensitivity-v1.json');
if (!developmentPath || !holdoutPath || !planPath) {
  throw new Error('development score, holdout score, and post-holdout plan paths are required');
}

const development = JSON.parse(readFileSync(resolve(developmentPath), 'utf8')) as HistoricalDeepHouseJournalMechanicsScoreArtifact;
const holdout = JSON.parse(readFileSync(resolve(holdoutPath), 'utf8')) as HistoricalDeepHouseJournalHoldoutScoreArtifact;
const plan = JSON.parse(readFileSync(resolve(planPath), 'utf8')) as HistoricalDeepHouseJournalPostHoldoutPlan;
const result = analyzeHistoricalDeepHouseJournalPostHoldout({ development, holdout, plan });
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({
  outputPath,
  companionDevelopmentContrast: result.companionSubstitution.development.incrementalContrast,
  companionHoldoutContrast: result.companionSubstitution.holdout.incrementalContrast,
  companionCrossPeriod: result.companionSubstitution.crossPeriod,
  companionCaseHeterogeneity: result.companionSubstitution.caseHeterogeneity,
  negativeControlDevelopmentContrast: result.negativeControlAuthorAdded.development.incrementalContrast,
  negativeControlHoldoutContrast: result.negativeControlAuthorAdded.holdout.incrementalContrast,
  conclusion: result.conclusion,
}, null, 2));
