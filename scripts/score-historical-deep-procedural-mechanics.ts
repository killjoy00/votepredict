import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { scoreHistoricalDeepProceduralMechanics } from '../src/evaluation/historical-deep-procedural-mechanics-score.js';

const candidatePath = process.argv[2];
const taxonomyPath = process.argv[3];
const outcomePath = process.argv[4];
const outputPath = resolve(process.argv[5] ?? 'artifacts/historical-deep-procedural-mechanics-score-v1.json');
if (!candidatePath || !taxonomyPath || !outcomePath) {
  throw new Error('candidate, taxonomy, and outcome artifact paths are required');
}

const candidates = JSON.parse(readFileSync(resolve(candidatePath), 'utf8'));
const taxonomy = JSON.parse(readFileSync(resolve(taxonomyPath), 'utf8'));
const outcomes = JSON.parse(readFileSync(resolve(outcomePath), 'utf8'));
const result = scoreHistoricalDeepProceduralMechanics(candidates, taxonomy, outcomes);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ outputPath, input: result.input, summary: result.summary }));
