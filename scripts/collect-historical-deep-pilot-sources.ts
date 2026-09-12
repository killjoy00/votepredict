import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  buildHistoricalDeepSourceBundle,
  collectedHistoricalDeepSource,
  historicalDeepSourceCatalogErrors,
  type HistoricalDeepSourceCatalog,
} from '../src/evaluation/historical-deep-source-catalog.js';

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function fetchCatalogSource(entry: HistoricalDeepSourceCatalog['sources'][number]) {
  const fetchedAt = new Date().toISOString();
  const response = await fetch(entry.url, {
    headers: {
      'user-agent': 'VotePredict/2.0 historical-evaluation-source-collector',
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return collectedHistoricalDeepSource(entry, {
    fetchedAt,
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get('content-type') ?? '',
    bytes,
  });
}

async function main(): Promise<void> {
  const catalogPath = resolve(
    argumentValue('--catalog') ?? 'data/evaluation/historical-deep-pilot-sources-v1.json',
  );
  const outputPath = resolve(
    argumentValue('--output')
      ?? process.env.VOTEPREDICT_DEEP_SOURCE_BUNDLE_OUTPUT
      ?? 'artifacts/historical-deep-pilot-source-bundle.json',
  );
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as HistoricalDeepSourceCatalog;
  const errors = historicalDeepSourceCatalogErrors(catalog);
  if (errors.length > 0) throw new Error(`Invalid historical Deep source catalog: ${errors.join('; ')}`);

  const collected = [];
  for (const entry of catalog.sources) {
    collected.push(await fetchCatalogSource(entry));
  }
  const bundle = buildHistoricalDeepSourceBundle(catalog, collected);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, { mode: 0o600 });

  const cases = new Map<string, number>();
  for (const source of bundle.sources) {
    const key = `${source.case.identifier}|${source.case.occurredOn}`;
    cases.set(key, (cases.get(key) ?? 0) + 1);
  }
  console.log(JSON.stringify({
    outputPath,
    schemaVersion: bundle.schemaVersion,
    sourceCount: bundle.sourceCount,
    caseCount: bundle.caseCount,
    bytes: bundle.sources.reduce((sum, source) => sum + source.bytes, 0),
    sourcesPerCase: [...cases.entries()].map(([key, sourceCount]) => ({ key, sourceCount })),
    hashes: bundle.sources.map((source) => ({ id: source.id, sha256: source.contentSha256 })),
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
