import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildHistoricalDeepHouseJournalHoldoutMechanicsArtifact } from '../src/evaluation/historical-deep-house-journal-holdout-mechanics.js';

const sourcePath = process.argv[2];
const sourceArtifactId = Number(process.argv[3]);
const sourceArtifactDigest = process.argv[4];
const sourceHeadSha = process.argv[5];
const developmentMechanicsArtifactId = Number(process.argv[6]);
const developmentMechanicsArtifactDigest = process.argv[7];
const developmentMechanicsHeadSha = process.argv[8];
const parserSourceBlobSha = process.argv[9];
const outputPath = resolve(process.argv[10] ?? 'artifacts/historical-deep-house-journal-holdout-mechanics-v1.json');

if (!sourcePath) throw new Error('Holdout House Journal source artifact path is required');
if (!Number.isInteger(sourceArtifactId) || sourceArtifactId <= 0) throw new Error('positive holdout source artifact id is required');
if (!sourceArtifactDigest) throw new Error('holdout source artifact digest is required');
if (!sourceHeadSha) throw new Error('holdout source head SHA is required');
if (!Number.isInteger(developmentMechanicsArtifactId) || developmentMechanicsArtifactId <= 0) {
  throw new Error('positive frozen development mechanics artifact id is required');
}
if (!developmentMechanicsArtifactDigest) throw new Error('frozen development mechanics artifact digest is required');
if (!developmentMechanicsHeadSha) throw new Error('frozen development mechanics head SHA is required');
if (!parserSourceBlobSha) throw new Error('frozen parser source blob SHA is required');

const sourceBundle = JSON.parse(readFileSync(resolve(sourcePath), 'utf8'));
const result = buildHistoricalDeepHouseJournalHoldoutMechanicsArtifact({
  sourceBundle,
  sourceArtifactId,
  sourceArtifactDigest,
  sourceHeadSha,
  parserReference: {
    developmentMechanicsArtifactId,
    developmentMechanicsArtifactDigest,
    developmentMechanicsHeadSha,
    parserSourceBlobSha,
  },
});

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ outputPath, input: result.input, summary: result.summary }));
