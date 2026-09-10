import { parseRevisorBillSearchXml } from '../src/sources/minnesota/revisor-bill-search.js';

const queries = [
  { body: 'House', session: '0942025', actions: ['1283', '1284'], sourcePrefix: 'HF' },
  { body: 'Senate', session: '0942025', actions: ['2268', '2269'], sourcePrefix: 'SF' },
] as const;

async function main(): Promise<void> {
  const output = [];
  for (const query of queries) {
    const params = new URLSearchParams({
      body: query.body,
      search: 'action',
      session: query.session,
      submit_action: 'GO',
      format: 'xml',
    });
    for (const action of query.actions) params.append('action[]', action);
    const url = `https://www.revisor.mn.gov/bills/status_result.php?${params.toString()}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'VotePredict/2.0 Minnesota Revisor action-result audit' },
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    const parsed = parseRevisorBillSearchXml(text);
    const sourceBills = parsed.filter((row) => row.identifier.startsWith(query.sourcePrefix));
    output.push({
      body: query.body,
      session: query.session,
      actions: query.actions,
      url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      responseLength: text.length,
      prefix: text.replace(/\s+/g, ' ').slice(0, 300),
      billResultTags: [...text.matchAll(/<BILL_RESULT>/gi)].length,
      parsedBills: parsed.length,
      sourceBills: sourceBills.length,
      otherChamberBills: parsed.length - sourceBills.length,
      sourceSample: sourceBills.slice(0, 20).map((row) => row.identifier),
    });
  }
  console.log(JSON.stringify({ revisorActionResultProbe: output }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
