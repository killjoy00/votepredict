export {};

const ALLOWED_HOSTS = new Set(['register.cfb.mn.gov', 'cfb.mn.gov', 'www.cfb.mn.gov']);
const TARGETS = [
  'https://register.cfb.mn.gov/reports/current-lists/',
  'https://register.cfb.mn.gov/reports-and-data/searches-and-lists/other-reports-and-lists/current-lists/',
  'https://register.cfb.mn.gov/reports-and-data/viewers/lobbying/lobbying-organizations/418/2024.1/',
  'https://register.cfb.mn.gov/reports-and-data/viewers/lobbying/lobbying-organizations/418/2024.2/',
] as const;

function assertOfficial(url: URL) {
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Lobbyist report probe only allows official CFB HTTPS hosts');
  }
}

async function fetchOfficial(url: string): Promise<{ url: string; status: number; text: string; headers: Record<string,string|null> }> {
  const target = new URL(url);
  assertOfficial(target);
  const response = await fetch(target, {
    headers: {
      'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-lobbyist-report-probe',
      accept: 'text/html,application/json,text/javascript;q=0.9,*/*;q=0.1',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  const finalUrl = new URL(response.url);
  assertOfficial(finalUrl);
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('CFB lobbyist probe response exceeded 8 MB');
  return {
    url: finalUrl.toString(),
    status: response.status,
    text,
    headers: {
      contentType: response.headers.get('content-type'),
      lastModified: response.headers.get('last-modified'),
    },
  };
}

function scriptUrls(html: string, baseUrl: string): string[] {
  const values = new Set<string>();
  for (const match of html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
    const href = (match[1] ?? '').trim();
    if (!href) continue;
    const url = new URL(href, baseUrl);
    if (url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname.toLowerCase())) values.add(url.toString());
    if (values.size >= 24) break;
  }
  return [...values];
}

function anchors(html: string, baseUrl: string) {
  const rows: Array<{ text: string; href: string }> = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = (match[1] ?? '').trim();
    const text = (match[2] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!href || !/(lobby|report|subject|fil|disclos)/i.test(text + ' ' + href)) continue;
    let url: URL;
    try { url = new URL(href, baseUrl); } catch { continue; }
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) continue;
    rows.push({ text, href: url.toString() });
    if (rows.length >= 80) break;
  }
  return rows;
}

function endpointCandidates(text: string): string[] {
  const values = new Set<string>();
  const patterns = [
    /(?:url|action)\s*[:=]\s*["']([^"']{1,320})["']/gi,
    /\$\.ajax\s*\(\s*["']([^"']{1,320})["']/gi,
    /["'](\/[^"'\s]{1,320}(?:lobby|report|subject|api)[^"'\s]{0,180})["']/gi,
    /(?:server|srv|api)\.send\s*\(\s*["'`]([^"'`]{1,180})["'`]/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = (match[1] ?? '').trim().replace(/\\\//g, '/');
      if (!value || value.startsWith('javascript:')) continue;
      if (!/(lobby|report|subject|current-list|grid_|api)/i.test(value)) continue;
      values.add(value);
      if (values.size >= 160) return [...values];
    }
  }
  return [...values];
}

function contexts(text: string): string[] {
  const patterns = [
    /lobbyist reports?/gi,
    /specific lobbying subjects?/gi,
    /lobbying subjects?/gi,
    /lobbying-organizations/gi,
    /\/reports\/api\//gi,
    /grid_(?:info|data)/gi,
    /viewPDF\s*\(/gi,
    /tab_content/gi,
    /reports_data/gi,
    /\bfiled\b/gi,
    /\breceived\b/gi,
    /\bsubmitted\b/gi,
    /publication/gi,
    /disclosure/gi,
  ];
  const rows: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const value = text
        .slice(Math.max(0, index - 1800), Math.min(text.length, index + 4200))
        .replace(/\s+/g, ' ')
        .trim();
      if (value && !rows.includes(value)) rows.push(value);
      if (rows.length >= 48) return rows;
    }
  }
  return rows;
}

function viewPdfReferences(text: string): string[] {
  const values = new Set<string>();
  const generic = /viewPDF\s*\(([^)]{1,500})\)/gi;
  for (const match of text.matchAll(generic)) {
    const args = (match[1] ?? '').replace(/\s+/g, ' ').trim();
    if (args) values.add(args);
    if (values.size >= 120) break;
  }
  return [...values];
}

function forms(html: string) {
  const rows: Array<{ action: string; method: string; inputs: Array<{name:string;value:string}> }> = [];
  for (const match of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const attrs = match[1] ?? '';
    const body = match[2] ?? '';
    if (!/(lobby|report|subject|api)/i.test(attrs + ' ' + body)) continue;
    const action = attrs.match(/\baction=["']([^"']*)["']/i)?.[1] ?? '';
    const method = attrs.match(/\bmethod=["']([^"']*)["']/i)?.[1] ?? '';
    const inputs = [...body.matchAll(/<input\b([^>]*)>/gi)].map(row => {
      const input = row[1] ?? '';
      return {
        name: input.match(/\bname=["']([^"']+)["']/i)?.[1] ?? '',
        value: input.match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? '',
      };
    }).filter(row => row.name).slice(0, 80);
    rows.push({ action, method, inputs });
    if (rows.length >= 20) break;
  }
  return rows;
}


type LobbyistPdfReference = {
  year: string;
  type: string;
  period: string;
  assoc: string;
  lob: string;
  amend: string;
};

function parsedViewPdfReferences(text: string): LobbyistPdfReference[] {
  const rows: LobbyistPdfReference[] = [];
  const seen = new Set<string>();
  const pattern = /viewPDF\s*\(\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*,\s*['"]?(\d+)['"]?\s*\)/gi;
  for (const match of text.matchAll(pattern)) {
    const row = {
      year: match[1] ?? '',
      type: match[2] ?? '',
      period: match[3] ?? '',
      assoc: match[4] ?? '',
      lob: match[5] ?? '',
      amend: match[6] ?? '',
    };
    const key = Object.values(row).join('|');
    if (!seen.has(key)) {
      seen.add(key);
      rows.push(row);
    }
    if (rows.length >= 40) break;
  }
  return rows;
}

async function fetchPageSession(url: string) {
  const target = new URL(url);
  assertOfficial(target);
  const response = await fetch(target, {
    headers: {
      'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-lobbyist-tab-probe',
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  const finalUrl = new URL(response.url);
  assertOfficial(finalUrl);
  await response.arrayBuffer();
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [response.headers.get('set-cookie') ?? ''].filter(Boolean);
  return {
    finalUrl: response.url,
    cookie: setCookies
      .map(value => value.split(';', 1)[0]?.trim())
      .filter(Boolean)
      .join('; '),
    cookieNames: setCookies
      .map(value => value.split('=', 1)[0]?.trim())
      .filter(Boolean),
  };
}

async function probeLobbyistTab(input: {
  id: string;
  year: string;
  period: string;
  tabname: 'reports_data' | 'categories';
}) {
  const pageUrl =
    'https://register.cfb.mn.gov/reports-and-data/viewers/lobbying/lobbying-organizations/'
    + input.id + '/' + input.year + '.' + input.period + '/';
  const session = await fetchPageSession(pageUrl);
  const endpoint = new URL(
    '/reports-and-data/viewers/lobbying/lobbying-organizations/api',
    'https://register.cfb.mn.gov',
  );
  const body = new URLSearchParams({
    id: input.id,
    year: input.year,
    period: input.period,
    tabname: input.tabname,
  });
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-lobbyist-tab-probe',
      accept: 'application/json,text/javascript,*/*;q=0.1',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      referer: session.finalUrl,
      origin: 'https://register.cfb.mn.gov',
      'x-requested-with': 'XMLHttpRequest',
      ...(session.cookie ? { cookie: session.cookie } : {}),
    },
    body: body.toString(),
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  const finalUrl = new URL(response.url);
  assertOfficial(finalUrl);
  const raw = await response.text();
  if (raw.length > 8_000_000) throw new Error('CFB lobbyist tab response exceeded 8 MB');
  let tabcontent = '';
  try {
    const parsed = JSON.parse(raw) as { tabcontent?: unknown };
    if (typeof parsed.tabcontent === 'string') tabcontent = parsed.tabcontent;
  } catch {
    // Non-JSON responses are retained only as a bounded diagnostic sample.
  }
  return {
    id: input.id,
    year: input.year,
    period: input.period,
    tabname: input.tabname,
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get('content-type'),
    cookieNames: session.cookieNames,
    responseBytes: raw.length,
    tabcontentBytes: tabcontent.length,
    viewPdfReferences: parsedViewPdfReferences(tabcontent),
    contexts: contexts(tabcontent),
    responseSample: (tabcontent || raw).replace(/\s+/g, ' ').trim().slice(0, 24000),
  };
}

function pdfDateAndSubjectContexts(text: string): string[] {
  const normalized = text.replace(/\u0000/g, '');
  const patterns = [
    /\breceived\b/gi,
    /\bfiled\b/gi,
    /\bsubmitted\b/gi,
    /\bperiod covered\b/gi,
    /\breporting period\b/gi,
    /specific lobbying subject/gi,
    /specific subject/gi,
    /lobbying subject/gi,
    /\bsubject\b/gi,
  ];
  const rows: string[] = [];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const index = match.index ?? 0;
      const value = normalized
        .slice(Math.max(0, index - 500), Math.min(normalized.length, index + 1400))
        .replace(/\s+/g, ' ')
        .trim();
      if (value && !rows.includes(value)) rows.push(value);
      if (rows.length >= 36) return rows;
    }
  }
  return rows;
}

async function fetchLobbyistReportPdf(reference: LobbyistPdfReference, referer: string) {
  const endpoint = new URL('https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF');
  const form = new URLSearchParams({
    downloadpdf: 'false',
    year: reference.year,
    type: reference.type,
    period: reference.period,
    assoc: reference.assoc,
    lob: reference.lob,
    amend: reference.amend,
  });
  const commonHeaders: Record<string, string> = {
    'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-lobbyist-pdf-probe',
    accept: 'application/pdf,text/html;q=0.9,*/*;q=0.1',
    referer,
  };
  let response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  let method = 'POST';
  if (response.status === 403) {
    const getUrl = new URL(endpoint);
    for (const [key, value] of form) getUrl.searchParams.set(key, value);
    response = await fetch(getUrl, {
      headers: commonHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(45_000),
    });
    method = 'GET-after-403';
  }
  const finalUrl = new URL(response.url);
  assertOfficial(finalUrl);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 30_000_000) throw new Error('CFB lobbyist PDF response exceeded 30 MB');
  const header = new TextDecoder('ascii').decode(bytes.subarray(0, Math.min(5, bytes.byteLength)));
  const isPdf = header === '%PDF-';
  const byteLength = bytes.byteLength;
  const { createHash } = await import('node:crypto');
  const contentSha256 = createHash('sha256').update(bytes).digest('hex');
  let text = '';
  if (isPdf && bytes.byteLength >= 300) {
    const { CanvasFactory } = await import('pdf-parse/worker');
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: bytes, CanvasFactory });
    try {
      const parsed = await parser.getText();
      text = parsed.text ?? '';
    } finally {
      await parser.destroy();
    }
  } else {
    text = new TextDecoder('utf-8').decode(bytes);
  }
  return {
    reference,
    method,
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get('content-type'),
    bytes: byteLength,
    isPdf,
    contentSha256,
    textLength: text.length,
    contexts: pdfDateAndSubjectContexts(text),
    textSample: text.replace(/\s+/g, ' ').trim().slice(0, 12000),
  };
}

async function main() {
  const pages: Array<Record<string,unknown>> = [];
  const scriptSet = new Set<string>();

  for (const target of TARGETS) {
    try {
      const page = await fetchOfficial(target);
      const scripts = scriptUrls(page.text, page.url);
      scripts.forEach(url => scriptSet.add(url));
      pages.push({
        target,
        finalUrl: page.url,
        status: page.status,
        bytes: page.text.length,
        headers: page.headers,
        anchors: anchors(page.text, page.url),
        endpointCandidates: endpointCandidates(page.text),
        viewPdfReferences: viewPdfReferences(page.text),
        forms: forms(page.text),
        contexts: contexts(page.text),
        scripts,
      });
    } catch (error) {
      pages.push({
        target,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const scripts: Array<Record<string,unknown>> = [];
  for (const url of [...scriptSet].slice(0, 24)) {
    try {
      const script = await fetchOfficial(url);
      const endpoints = endpointCandidates(script.text);
      const snippets = contexts(script.text);
      const refs = viewPdfReferences(script.text);
      if (endpoints.length || snippets.length || refs.length) {
        scripts.push({
          url,
          bytes: script.text.length,
          endpointCandidates: endpoints,
          viewPdfReferences: refs,
          contexts: snippets,
        });
      }
    } catch (error) {
      scripts.push({
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const tabProbes: Array<Record<string, unknown>> = [];
  const pdfReferences = new Map<string, { reference: LobbyistPdfReference; referer: string }>();
  for (const period of ['1', '2'] as const) {
    for (const tabname of ['reports_data', 'categories'] as const) {
      try {
        const probe = await probeLobbyistTab({ id: '418', year: '2024', period, tabname });
        tabProbes.push(probe);
        if (tabname === 'reports_data') {
          const referer =
            'https://register.cfb.mn.gov/reports-and-data/viewers/lobbying/lobbying-organizations/418/2024.'
            + period + '/';
          for (const reference of probe.viewPdfReferences) {
            const key = Object.values(reference).join('|');
            pdfReferences.set(key, { reference, referer });
          }
        }
      } catch (error) {
        tabProbes.push({
          id: '418',
          year: '2024',
          period,
          tabname,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const pdfProbes: Array<Record<string, unknown>> = [];
  for (const { reference, referer } of [...pdfReferences.values()].slice(0, 12)) {
    try {
      pdfProbes.push(await fetchLobbyistReportPdf(reference, referer));
    } catch (error) {
      pdfProbes.push({
        reference,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(JSON.stringify({
    cfbLobbyistReportProbe: {
      pages,
      scripts,
      tabProbes,
      pdfProbes,
      policy: {
        readOnly: true,
        databaseAccess: false,
        reportPeriodIsAvailability: false,
        activityDateIsAvailability: false,
        dueDateIsAvailability: false,
        directDisclosureOrIndependentArchiveProofRequired: true,
        campaignFinanceNextDayRuleAssumed: false,
        productionAction: 'none',
      },
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
