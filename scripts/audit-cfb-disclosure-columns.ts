import {
  discoverCampaignFinanceDownloadUrls,
  fetchCampaignFinanceBulkText,
} from '../src/evidence/campaign-finance-live.js';

function parseCsvHeader(text: string): string[] {
  const header: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field.length === 0) {
      quoted = true;
      continue;
    }
    if (char === ',') {
      header.push(field.trim());
      field = '';
      continue;
    }
    if (char === '\n' || char === '\r') {
      header.push(field.trim());
      break;
    }
    field += char;
  }
  if (header.length === 0 && field.trim()) header.push(field.trim());
  return header.filter(Boolean);
}

function timingColumns(headers: readonly string[]): string[] {
  return headers.filter(header =>
    /(?:filed|filing|disclos|publish|public|report|period|date|receipt)/i.test(header),
  );
}

function hasAny(headers: readonly string[], patterns: readonly RegExp[]): boolean {
  return headers.some(header => patterns.some(pattern => pattern.test(header)));
}

async function main() {
  const urls = await discoverCampaignFinanceDownloadUrls();
  const sources = [
    ['contributions', urls.contributions],
    ['expenditures', urls.expenditures],
    ['independentExpenditures', urls.independentExpenditures],
  ] as const;

  const result: Record<string, unknown> = {};
  for (const [name, url] of sources) {
    const text = await fetchCampaignFinanceBulkText(url);
    const headers = parseCsvHeader(text);
    result[name] = {
      headerCount: headers.length,
      headers,
      timingColumns: timingColumns(headers),
      hasDirectDisclosureColumn: hasAny(headers, [
        /disclos/i, /publish/i, /public.*date/i,
      ]),
      hasFiledColumn: hasAny(headers, [
        /filed.*date/i, /filing.*date/i, /date.*filed/i,
      ]),
      hasReportIdentityColumn: hasAny(headers, [
        /^report$/i, /report.*name/i, /report.*type/i, /filing.*type/i,
      ]),
    };
  }

  console.log(JSON.stringify({
    cfbDisclosureColumnAudit: {
      discoveredDownloadUrls: urls.discovered,
      sources: result,
      productionAction: 'none',
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
