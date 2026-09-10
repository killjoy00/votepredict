import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { auditBillFeature, type FeatureSource } from '../src/features/feature-audit.js';
import { DETERMINISTIC_EXTRACTOR_VERSION } from '../src/features/bills.js';

const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const directory = arg('input-dir');
if (!directory) throw new Error('Specify --input-dir with JSON batches of dated bill versions');
const rows: FeatureSource[] = readdirSync(directory).filter(f => f.endsWith('.json')).sort()
  .flatMap(f => JSON.parse(readFileSync(join(directory, f), 'utf8')));
if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('Duplicate bill versions in audit input');
const audit = rows.map(auditBillFeature);
const fields: Record<string, number> = {};
for (const row of audit) for (const key of row.changedFields) fields[key] = (fields[key] ?? 0) + 1;
const manifest = arg('manifest');
if (manifest) writeFileSync(manifest, JSON.stringify(audit));
console.log(JSON.stringify({ extractorVersion: DETERMINISTIC_EXTRACTOR_VERSION, versions: rows.length,
  changed: audit.filter(r => r.changed).length, changedFields: fields,
  gamblingVersions: audit.filter(r => r.features.gambling).length,
  datasetSha256: createHash('sha256').update(JSON.stringify(audit.map(r => [r.billVersionId, r.provenance.sourceTextHash]))).digest('hex'),
  writes: 0 }, null, 2));
