const ORIGIN = 'https://register.cfb.mn.gov';
const TARGETS = [
  '/reports-and-data/viewers/campaign-finance/candidates/15677/2026/',
  '/reports-and-data/viewers/campaign-finance/candidates/15677/2024/',
  '/reports-and-data/viewers/campaign-finance/candidates/19238/2026/',
  '/reports-and-data/viewers/campaign-finance/candidates/19238/2024/',
] as const;

async function fetchOfficial(url: string): Promise<{ url: string; status: number; text: string }> {
  const target = new URL(url, ORIGIN);
  if (target.protocol !== 'https:' || target.hostname !== 'register.cfb.mn.gov') {
    throw new Error('Candidate viewer probe only allows register.cfb.mn.gov');
  }
  const response = await fetch(target, {
    headers: { 'user-agent': 'VotePredict/2.0 cfb-candidate-viewer-probe' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'register.cfb.mn.gov') {
    throw new Error('Candidate viewer probe redirected off register.cfb.mn.gov');
  }
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('Candidate viewer probe response exceeded 8 MB');
  return { url: finalUrl.toString(), status: response.status, text };
}

function scriptUrls(html: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
    const href = (match[1] ?? '').trim();
    if (!href) continue;
    const url = new URL(href, ORIGIN);
    if (url.protocol === 'https:' && url.hostname === 'register.cfb.mn.gov') urls.push(url.toString());
  }
  return [...new Set(urls)].slice(0, 30);
}

function snippets(text: string): string[] {
  const patterns = [
    /view-cand-reports-post/gi,
    /getSpecificCommittee_SelectYear/gi,
    /getLinkSupport/gi,
    /updateResults\s*\(/gi,
    /searchType/gi,
    /ajaxSetup/gi,
    /\.ajax\s*\(/gi,
    /viewPDF\s*\(/gi,
    /reports\s+and\s+data/gi,
  ];
  const rows: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const value = text
        .slice(Math.max(0, index - 1200), Math.min(text.length, index + 2600))
        .replace(/\s+/g, ' ')
        .trim();
      if (value && !rows.includes(value)) rows.push(value);
      if (rows.length >= 36) return rows;
    }
  }
  return rows;
}

function endpointCandidates(text: string): string[] {
  const values = new Set<string>();
  const patterns = [
    /(?:url|action)\s*[:=]\s*["']([^"']{1,300})["']/gi,
    /\$\.ajax\s*\(\s*["']([^"']{1,300})["']/gi,
    /<form\b[^>]*action=["']([^"']{1,300})["']/gi,
    /["'](\/[^"'\s]{1,300}(?:report|candidate|ajax|viewer)[^"'\s]{0,160})["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = (match[1] ?? '').trim().replace(/\\\//g, '/');
      if (!value || value.startsWith('javascript:')) continue;
      values.add(value);
      if (values.size >= 120) return [...values];
    }
  }
  return [...values];
}

function focusedContexts(text: string): string[] {
  const patterns = [
    /\/reports-and-data\/viewers\/campaign-finance\/candidates\/api/gi,
    /\bsearchType\b/gi,
    /\$\.ajaxSetup\s*\(/gi,
    /\$\.ajax\s*\(/gi,
  ];
  const rows: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const value = text
        .slice(Math.max(0, index - 2200), Math.min(text.length, index + 4200))
        .replace(/\s+/g, ' ')
        .trim();
      if (value && !rows.includes(value)) rows.push(value);
      if (rows.length >= 24) return rows;
    }
  }
  return rows;
}

function searchTypeValues(text: string): string[] {
  const values = new Set<string>();
  const patterns = [
    /\bsearchType\s*=\s*["']([^"']{1,80})["']/gi,
    /["']searchType["']\s*:\s*["']([^"']{1,80})["']/gi,
    /data-search-type\s*=\s*["']([^"']{1,80})["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = (match[1] ?? '').trim();
      if (value) values.add(value);
    }
  }
  return [...values];
}

function pageIdentity(path: string, html: string) {
  const match = path.match(/\/candidates\/(\d+)\/(\d{4})\/?$/);
  if (!match) return null;
  const comparison = html.match(
    /\/districts-constitutional-offices\/(House|Senate)\/([^/"']+)\/(\d{4})/i,
  );
  return {
    registrationNumber: match[1],
    year: match[2],
    office: comparison?.[1] ?? '',
    district: comparison?.[2] ?? '',
  };
}

function viewPdfReferences(text: string): string[] {
  const values = new Set<string>();
  const pattern = /viewPDF\('([^']+)','([^']+)','([^']+)','([^']+)','([^']+)',(\d+)\)/gi;
  for (const match of text.matchAll(pattern)) {
    values.add([match[1], match[2], match[3], match[4], match[5], match[6]].join('|'));
    if (values.size >= 80) break;
  }
  return [...values];
}

async function probeCandidateApi(input: {
  method: 'GET' | 'POST';
  searchType: string;
  registrationNumber: string;
  year: string;
  office: string;
  district: string;
}) {
  const endpoint = new URL('/reports-and-data/viewers/campaign-finance/candidates/api', ORIGIN);
  const params = new URLSearchParams({
    searchType: input.searchType,
    office: input.office,
    year: input.year,
    regnum: input.registrationNumber,
    letter: '',
    name: '',
    dist: input.district,
    alpha: '0',
  });
  const response = await fetch(
    input.method === 'GET' ? endpoint.toString() + '?' + params.toString() : endpoint.toString(),
    {
      method: input.method,
      headers: {
        'user-agent': 'VotePredict/2.0 cfb-candidate-viewer-probe',
        accept: 'text/html,application/json;q=0.9,*/*;q=0.1',
        ...(input.method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: input.method === 'POST' ? params.toString() : undefined,
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    },
  );
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'register.cfb.mn.gov') {
    throw new Error('Candidate viewer API redirected off register.cfb.mn.gov');
  }
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('Candidate viewer API response exceeded 8 MB');
  return {
    method: input.method,
    searchType: input.searchType,
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get('content-type'),
    bytes: text.length,
    viewPdfReferences: viewPdfReferences(text),
    responseSample: text.replace(/\s+/g, ' ').trim().slice(0, 16_000),
  };
}


function tabContentContexts(text: string): string[] {
  const patterns = [
    /\btab_content\b/gi,
    /\bdata_name\b/gi,
    /\bextra_data\b/gi,
    /\bstore_name\b/gi,
    /candidate_viewer-tabs/gi,
    /\bcandidtab\b/gi,
  ];
  const rows: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const value = text
        .slice(Math.max(0, index - 2600), Math.min(text.length, index + 6200))
        .replace(/\s+/g, ' ')
        .trim();
      if (value && !rows.includes(value)) rows.push(value);
      if (rows.length >= 30) return rows;
    }
  }
  return rows;
}

async function main() {
  const pages = [];
  for (const path of TARGETS) {
    try {
      const page = await fetchOfficial(path);
      const scripts = scriptUrls(page.text);
      const scriptResults = [];
      const combinedSearchTypes = new Set(searchTypeValues(page.text));
      const pageFocusedContexts = focusedContexts(page.text);
      const pageTabContentContexts = tabContentContexts(page.text);
      for (const url of scripts) {
        try {
          const script = await fetchOfficial(url);
          const context = snippets(script.text);
          const endpoints = endpointCandidates(script.text);
          const focused = focusedContexts(script.text);
          const tabContexts = tabContentContexts(script.text);
          for (const value of searchTypeValues(script.text)) combinedSearchTypes.add(value);
          if (context.length || endpoints.length || focused.length || tabContexts.length) {
            scriptResults.push({
              url,
              bytes: script.text.length,
              endpointCandidates: endpoints.slice(0, 80),
              searchTypeValues: searchTypeValues(script.text),
              focusedContexts: focused,
              tabContentContexts: tabContexts,
              contextSnippets: context,
            });
          }
        } catch (error) {
          scriptResults.push({
            url,
            error: error instanceof Error ? error.message : String(error),
            endpointCandidates: [],
            contextSnippets: [],
          });
        }
      }
      const identity = pageIdentity(path, page.text);
      const apiProbes: Array<Record<string, unknown>> = [];
      if (identity) {
        for (const searchType of [...combinedSearchTypes].slice(0, 4)) {
          for (const method of ['GET', 'POST'] as const) {
            try {
              apiProbes.push(await probeCandidateApi({ ...identity, searchType, method }));
            } catch (error) {
              apiProbes.push({
                method,
                searchType,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }
      }
      pages.push({
        path,
        finalUrl: page.url,
        status: page.status,
        bytes: page.text.length,
        identity,
        pageEndpointCandidates: endpointCandidates(page.text).slice(0, 100),
        pageSearchTypeValues: searchTypeValues(page.text),
        combinedSearchTypeValues: [...combinedSearchTypes],
        pageFocusedContexts,
        pageTabContentContexts,
        pageContextSnippets: snippets(page.text),
        apiProbes,
        scripts,
        scriptResults,
      });
    } catch (error) {
      pages.push({
        path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(JSON.stringify({
    cfbCandidateViewerProbe: {
      pages,
      policy: {
        readOnly: true,
        databaseAccess: false,
        transactionDateIsAvailability: false,
        productionAction: 'none',
      },
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});