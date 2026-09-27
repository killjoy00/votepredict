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


const CFB_ORIGIN = 'https://register.cfb.mn.gov';
const CFB_CURRENT_LISTS_URL =
  CFB_ORIGIN + '/reports-and-data/searches-and-lists/other-reports-and-lists/current-lists/';
const CFB_REPORTS_APP_URL = CFB_ORIGIN + '/reports/';
const CFB_CURRENT_LISTS_APP_URL = CFB_ORIGIN + '/reports/current-lists/';

async function fetchOfficialText(url: string): Promise<string> {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.hostname !== 'register.cfb.mn.gov') {
    throw new Error('CFB report-list audit only allows the official register.cfb.mn.gov host');
  }
  const response = await fetch(target, {
    headers: { 'user-agent': 'VotePredict/2.0 cfb-disclosure-audit' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`CFB report-list audit returned HTTP ${response.status} for ${target}`);
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error(`CFB report-list audit response too large: ${target}`);
  return text;
}

function htmlText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function reportAnchors(html: string): Array<{ text: string; href: string }> {
  const anchors: Array<{ text: string; href: string }> = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const text = htmlText(match[2] ?? '');
    const href = (match[1] ?? '').trim();
    if (!text || !href) continue;
    if (!/(candidate|committee|fund|party|report|filing|current list)/i.test(text)) continue;
    anchors.push({ text, href: new URL(href, CFB_ORIGIN).toString() });
  }
  return [...new Map(anchors.map(row => [`${row.text}|\u0000|${row.href}`, row])).values()]
    .slice(0, 120);
}

function scriptUrls(html: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
    const href = (match[1] ?? '').trim();
    if (!href) continue;
    const url = new URL(href, CFB_ORIGIN);
    if (url.protocol === 'https:' && url.hostname === 'register.cfb.mn.gov') urls.push(url.toString());
  }
  return [...new Set(urls)].slice(0, 24);
}

function endpointCandidates(text: string): string[] {
  const values = new Set<string>();
  const patterns = [
    /["'`](\/[^"'\`\s]{1,220}(?:api|ajax|report|list|data)[^"'\`\s]{0,220})["'`]/gi,
    /["'`](https:\/\/register\.cfb\.mn\.gov\/[^"'\`\s]{1,420})["'`]/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = (match[1] ?? '').replace(/\\\//g, '/').trim();
      if (!raw || /\.(?:png|jpe?g|gif|svg|css|woff2?)(?:\?|$)/i.test(raw)) continue;
      values.add(raw);
      if (values.size >= 160) break;
    }
    if (values.size >= 160) break;
  }
  return [...values];
}

function contextSnippets(text: string): string[] {
  const patterns = [
    /\/reports\/api\//gi,
    /candidate[-_]?reports/gi,
    /pcf[-_]?reports/gi,
    /current[-_]?reports/gi,
    /report[-_]?date/gi,
    /fil(?:ed|ing)/gi,
    /\.send\s*\(/gi,
  ];
  const snippets: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const start = Math.max(0, index - 900);
      const end = Math.min(text.length, index + 1800);
      const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
      if (snippet && !snippets.includes(snippet)) snippets.push(snippet);
      if (snippets.length >= 40) return snippets;
    }
  }
  return snippets;
}

function serverActionCalls(text: string): Array<{ action: string; snippet: string }> {
  const rows: Array<{ action: string; snippet: string }> = [];
  const seen = new Set<string>();
  const patterns = [
    /(?:server|srv|api)\.send\s*\(\s*["'`]([^"'`]{1,160})["'`]/gi,
    /\.send\s*\(\s*["'`]([^"'`]{1,160})["'`]/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const action = (match[1] ?? '').trim();
      if (!action || seen.has(action)) continue;
      seen.add(action);
      const index = match.index ?? 0;
      rows.push({
        action,
        snippet: text.slice(Math.max(0, index - 500), Math.min(text.length, index + 1500))
          .replace(/\s+/g, ' ')
          .trim(),
      });
      if (rows.length >= 120) return rows;
    }
  }
  return rows;
}

async function readResponseSample(response: Response) {
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Preserve a bounded public response snippet for diagnostics.
  }
  const serialized = parsed === null ? text : JSON.stringify(parsed);
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    responseBytes: text.length,
    topLevelKeys: parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.keys(parsed as Record<string, unknown>).slice(0, 80)
      : [],
    responseSample: serialized.slice(0, 24_000),
  };
}

function browserFormBody(operation: 'grid_info' | 'grid_data', routeAction: string, arrayStyle: 'indexed' | 'brackets') {
  const params = new URLSearchParams();
  params.set('action', operation);
  params.set('data[action]', routeAction);
  params.set('data[type]', 'current-lists');
  params.set(arrayStyle === 'indexed' ? 'data[params][0]' : 'data[params][]', 'all');
  return params.toString();
}

async function fetchReportAppSession() {
  const response = await fetch(CFB_CURRENT_LISTS_APP_URL, {
    headers: { 'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-disclosure-audit' },
    signal: AbortSignal.timeout(30_000),
  });
  await response.arrayBuffer();
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = typeof getSetCookie === 'function'
    ? getSetCookie.call(response.headers)
    : [response.headers.get('set-cookie') ?? ''].filter(Boolean);
  const cookie = setCookies
    .map(value => value.split(';', 1)[0]?.trim())
    .filter(Boolean)
    .join('; ');
  return {
    cookie,
    cookieNames: setCookies
      .map(value => value.split('=', 1)[0]?.trim())
      .filter(Boolean),
  };
}

async function probeReportApiVariants(operation: 'grid_info' | 'grid_data', routeAction: string) {
  const referer = CFB_CURRENT_LISTS_APP_URL + '#/' + routeAction + '/all/';
  const session = await fetchReportAppSession();
  const commonHeaders: Record<string, string> = {
    'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-disclosure-audit',
    accept: 'application/json,text/plain;q=0.8,*/*;q=0.1',
    referer,
    origin: CFB_ORIGIN,
    'x-requested-with': 'XMLHttpRequest',
  };
  if (session.cookie) commonHeaders.cookie = session.cookie;

  const variants: Array<Record<string, unknown>> = [];

  for (const arrayStyle of ['indexed', 'brackets'] as const) {
    const response = await fetch(CFB_ORIGIN + '/reports/api/', {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: browserFormBody(operation, routeAction, arrayStyle),
      signal: AbortSignal.timeout(30_000),
    });
    variants.push({
      method: 'POST',
      arrayStyle,
      cookieNames: session.cookieNames,
      ...(await readResponseSample(response)),
    });
  }

  const payload = encodeURIComponent(JSON.stringify({
    action: routeAction,
    type: 'current-lists',
    params: ['all'],
  }));
  const uriJsonResponse = await fetch(
    CFB_ORIGIN + '/reports/api/' + operation + '/' + payload,
    {
      headers: commonHeaders,
      signal: AbortSignal.timeout(30_000),
    },
  );
  variants.push({
    method: 'URIJSON',
    cookieNames: session.cookieNames,
    ...(await readResponseSample(uriJsonResponse)),
  });

  const query = new URLSearchParams();
  query.set('action', operation);
  query.set('data[action]', routeAction);
  query.set('data[type]', 'current-lists');
  query.set('data[params][]', 'all');
  const getResponse = await fetch(CFB_ORIGIN + '/reports/api/?' + query.toString(), {
    headers: commonHeaders,
    signal: AbortSignal.timeout(30_000),
  });
  variants.push({
    method: 'GET',
    cookieNames: session.cookieNames,
    ...(await readResponseSample(getResponse)),
  });

  return { operation, routeAction, variants };
}

async function auditReportLists() {
  const homeHtml = await fetchOfficialText(CFB_ORIGIN + '/');
  const listsHtml = await fetchOfficialText(CFB_CURRENT_LISTS_URL);
  const reportsAppHtml = await fetchOfficialText(CFB_REPORTS_APP_URL);
  const currentListsAppHtml = await fetchOfficialText(CFB_CURRENT_LISTS_APP_URL);
  const scripts = [...new Set([
    ...scriptUrls(homeHtml),
    ...scriptUrls(listsHtml),
    ...scriptUrls(reportsAppHtml),
    ...scriptUrls(currentListsAppHtml),
  ])];

  const scriptResults: Array<{
    url: string;
    endpointCandidates: string[];
    contextSnippets: string[];
    serverActionCalls: Array<{ action: string; snippet: string }>;
  }> = [];
  for (const url of scripts) {
    try {
      const body = await fetchOfficialText(url);
      const candidates = endpointCandidates(body);
      if (candidates.length > 0 || /current-lists|Current candidate reports|report_date|filed/i.test(body)) {
        scriptResults.push({
          url,
          endpointCandidates: candidates.slice(0, 80),
          contextSnippets: contextSnippets(body),
          serverActionCalls: serverActionCalls(body),
        });
      }
    } catch (error) {
      scriptResults.push({
        url,
        endpointCandidates: [`audit-error:${error instanceof Error ? error.message : String(error)}`],
        contextSnippets: [],
        serverActionCalls: [],
      });
    }
  }

  const reportApiProbes = [];
  for (const routeAction of ['candidate-reports', 'pcf-reports']) {
    for (const operation of ['grid_info', 'grid_data'] as const) {
      try {
        reportApiProbes.push(await probeReportApiVariants(operation, routeAction));
      } catch (error) {
        reportApiProbes.push({
          operation,
          routeAction,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    currentListsUrl: CFB_CURRENT_LISTS_URL,
    homeReportAnchors: reportAnchors(homeHtml),
    currentListReportAnchors: reportAnchors(listsHtml),
    reportsAppUrl: CFB_REPORTS_APP_URL,
    currentListsAppUrl: CFB_CURRENT_LISTS_APP_URL,
    reportsAppReportAnchors: reportAnchors(reportsAppHtml),
    currentListsAppReportAnchors: reportAnchors(currentListsAppHtml),
    inlineEndpointCandidates: [
      ...endpointCandidates(homeHtml),
      ...endpointCandidates(listsHtml),
      ...endpointCandidates(reportsAppHtml),
      ...endpointCandidates(currentListsAppHtml),
    ].slice(0, 260),
    scriptUrls: scripts,
    scriptResults,
    reportApiProbes,
  };
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

  const reportListAudit = await auditReportLists();

  console.log(JSON.stringify({
    cfbDisclosureColumnAudit: {
      discoveredDownloadUrls: urls.discovered,
      sources: result,
      reportListAudit,
      productionAction: 'none',
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});