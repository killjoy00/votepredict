import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fetchRevisorSourceChamberPassageSearch } from '../src/sources/minnesota/revisor-action-search.js';
import type { RevisorBillSearchBody } from '../src/sources/minnesota/revisor-bill-search.js';

type Scope = {
  sessionKey: '2021-2022' | '2023-2024' | '2025-2026';
  body: RevisorBillSearchBody;
};

const scopes: Scope[] = [
  { sessionKey: '2021-2022', body: 'House' },
  { sessionKey: '2021-2022', body: 'Senate' },
  { sessionKey: '2023-2024', body: 'House' },
  { sessionKey: '2023-2024', body: 'Senate' },
  { sessionKey: '2025-2026', body: 'House' },
  { sessionKey: '2025-2026', body: 'Senate' },
];

async function main(): Promise<void> {
  const outputPath = resolve(process.env.OUTPUT_PATH || 'artifacts/revisor-source-passage-snapshot.json');
  const rows = [];

  for (const scope of scopes) {
    const result = await fetchRevisorSourceChamberPassageSearch(scope);
    rows.push({
      session: scope.sessionKey,
      body: scope.body,
      count: result.bills.length,
      bills: result.bills.map((bill) => ({
        identifier: bill.identifier,
        statusXmlUrl: bill.statusXmlUrl,
      })),
      documents: result.documents.map((document) => ({
        actionId: document.actionId,
        sourceUrl: document.sourceUrl,
        fetchedAt: document.fetchedAt,
        contentSha256: document.contentSha256,
        allChamberResultCount: document.results.length,
      })),
    });
  }

  const snapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'Minnesota Revisor Search by Action XML',
    semantics: 'Originating-chamber final passage: HF must have a House pass action; SF must have a Senate third-reading pass action.',
    totalSourcePassages: rows.reduce((sum, row) => sum + row.count, 0),
    scopes: rows,
  };

  if (snapshot.totalSourcePassages !== 651) {
    throw new Error(`Authoritative passage snapshot changed unexpectedly: ${snapshot.totalSourcePassages} != audited 651`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath, totalSourcePassages: snapshot.totalSourcePassages, counts: rows.map((row) => ({ session: row.session, body: row.body, count: row.count })) }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
