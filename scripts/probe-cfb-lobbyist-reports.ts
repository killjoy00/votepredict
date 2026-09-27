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

  console.log(JSON.stringify({
    cfbLobbyistReportProbe: {
      pages,
      scripts,
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
