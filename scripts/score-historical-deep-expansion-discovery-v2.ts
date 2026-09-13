import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { scoreHistoricalDeepExpansionCandidatesV2 } from '../src/evaluation/historical-deep-expansion-outcome-scorer-v2.js';

const candidatePath = process.argv[2];
const outcomePath = process.argv[3];
const outputPath = resolve(process.argv[4] ?? 'artifacts/historical-deep-expansion-discovery-score-v2.json');
if (!candidatePath || !outcomePath) throw new Error('candidate and outcome paths are required');

const candidates = JSON.parse(readFileSync(resolve(candidatePath), 'utf8'));
const outcomes = JSON.parse(readFileSync(resolve(outcomePath), 'utf8'));
const result = scoreHistoricalDeepExpansionCandidatesV2(candidates, outcomes);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ outputPath, metadata: result.metadata, summary: result.summary }));
