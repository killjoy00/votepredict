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

async function main() {
  const pages = [];
  for (const path of TARGETS) {
    try {
      const page = await fetchOfficial(path);
      const scripts = scriptUrls(page.text);
      const scriptResults = [];
      for (const url of scripts) {
        try {
          const script = await fetchOfficial(url);
          const context = snippets(script.text);
          const endpoints = endpointCandidates(script.text);
          if (context.length || endpoints.length) {
            scriptResults.push({
              url,
              bytes: script.text.length,
              endpointCandidates: endpoints.slice(0, 80),
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
      pages.push({
        path,
        finalUrl: page.url,
        status: page.status,
        bytes: page.text.length,
        pageEndpointCandidates: endpointCandidates(page.text).slice(0, 100),
        pageContextSnippets: snippets(page.text),
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
