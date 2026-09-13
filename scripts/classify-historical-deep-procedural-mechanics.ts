import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildHistoricalDeepProceduralMechanicsArtifact } from '../src/evaluation/historical-deep-procedural-mechanics.js';

const candidatePath = process.argv[2];
const outputPath = resolve(process.argv[3] ?? 'artifacts/historical-deep-procedural-mechanics-v1.json');
if (!candidatePath) throw new Error('candidate artifact path is required');

const candidates = JSON.parse(readFileSync(resolve(candidatePath), 'utf8'));
const result = buildHistoricalDeepProceduralMechanicsArtifact(candidates);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ outputPath, input: result.input, summary: result.summary }));
