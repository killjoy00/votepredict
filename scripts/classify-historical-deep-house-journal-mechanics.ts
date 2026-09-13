import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildHistoricalDeepHouseJournalMechanicsArtifact } from '../src/evaluation/historical-deep-house-journal-mechanics.js';

const sourcePath = process.argv[2];
const sourceArtifactId = Number(process.argv[3]);
const sourceArtifactDigest = process.argv[4];
const sourceHeadSha = process.argv[5];
const outputPath = resolve(process.argv[6] ?? 'artifacts/historical-deep-house-journal-mechanics-v1.json');

if (!sourcePath) throw new Error('House Journal source artifact path is required');
if (!Number.isInteger(sourceArtifactId) || sourceArtifactId <= 0) throw new Error('positive source artifact id is required');
if (!sourceArtifactDigest) throw new Error('source artifact digest is required');
if (!sourceHeadSha) throw new Error('source head SHA is required');

const sourceBundle = JSON.parse(readFileSync(resolve(sourcePath), 'utf8'));
const result = buildHistoricalDeepHouseJournalMechanicsArtifact({
  sourceBundle,
  sourceArtifactId,
  sourceArtifactDigest,
  sourceHeadSha,
});
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ outputPath, input: result.input, summary: result.summary }));
