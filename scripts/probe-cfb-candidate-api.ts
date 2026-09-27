const ORIGIN = 'https://register.cfb.mn.gov';
const API_URL = ORIGIN + '/reports-and-data/viewers/campaign-finance/candidates/api';

const TARGETS = [
  {
    label: 'house-15677-2026',
    regnum: '15677',
    year: '2026',
    name: 'Hortman, Melissa A House Committee',
    office: 'House',
    dist: '34B',
  },
  {
    label: 'house-15677-2024',
    regnum: '15677',
    year: '2024',
    name: 'Hortman, Melissa A House Committee',
    office: 'House',
    dist: '34B',
  },
  {
    label: 'senate-19238-2026',
    regnum: '19238',
    year: '2026',
    name: 'Oundo, Ian Senate Committee',
    office: 'Senate',
    dist: '35',
  },
] as const;

function reportReferences(text: string) {
  const rows: Array<{
    title: string;
    year: string;
    type: string;
    period: string;
    se: string;
    regnum: string;
    amend: number;
  }> = [];
  const seen = new Set<string>();
  const pattern = /title=["']([^"']+)["'][^>]*href=["']javascript:viewPDF\('([^']+)','([^']+)','([^']+)','([^']+)','([^']+)',(\d+)\)["']/gi;
  for (const match of text.matchAll(pattern)) {
    const row = {
      title: (match[1] ?? '').trim(),
      year: (match[2] ?? '').trim(),
      type: (match[3] ?? '').trim(),
      period: (match[4] ?? '').trim(),
      se: (match[5] ?? '').trim(),
      regnum: (match[6] ?? '').trim(),
      amend: Number(match[7] ?? 0),
    };
    const key = JSON.stringify(row);
    if (!seen.has(key)) {
      seen.add(key);
      rows.push(row);
    }
  }
  return rows.slice(0, 40);
}

function boundedSample(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const index = normalized.search(/viewPDF|Report|Period|Received|No Results/i);
  const start = index >= 0 ? Math.max(0, index - 800) : 0;
  return normalized.slice(start, start + 6000);
}

async function fetchSessionCookie(referer: string): Promise<string> {
  const response = await fetch(referer, {
    headers: { 'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-candidate-api-probe' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  await response.arrayBuffer();
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [response.headers.get('set-cookie') ?? ''].filter(Boolean);
  return setCookies
    .map(value => value.split(';', 1)[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

function paramsFor(
  target: typeof TARGETS[number],
  searchType: string,
  alpha: string,
) {
  return new URLSearchParams({
    searchType,
    office: target.office,
    year: target.year,
    regnum: target.regnum,
    letter: '',
    name: target.name,
    dist: target.dist,
    alpha,
  });
}

async function probeVariant(input: {
  target: typeof TARGETS[number];
  method: 'GET' | 'POST';
  searchType: string;
  alpha: string;
  trailingSlash: boolean;
  cookie: string;
}) {
  const params = paramsFor(input.target, input.searchType, input.alpha);
  const base = API_URL + (input.trailingSlash ? '/' : '');
  const url = input.method === 'GET' ? base + '?' + params.toString() : base;
  const referer =
    ORIGIN + '/reports-and-data/viewers/campaign-finance/candidates/'
    + input.target.regnum + '/' + input.target.year + '/';
  const response = await fetch(url, {
    method: input.method,
    headers: {
      'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-candidate-api-probe',
      accept: 'text/html,application/json;q=0.9,*/*;q=0.1',
      referer,
      origin: ORIGIN,
      'x-requested-with': 'XMLHttpRequest',
      ...(input.cookie ? { cookie: input.cookie } : {}),
      ...(input.method === 'POST'
        ? { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' }
        : {}),
    },
    ...(input.method === 'POST' ? { body: params.toString() } : {}),
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'register.cfb.mn.gov') {
    throw new Error('Candidate API probe redirected off register.cfb.mn.gov');
  }
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('Candidate API probe response exceeded 8 MB');
  const refs = reportReferences(text);
  return {
    method: input.method,
    searchType: input.searchType,
    alpha: input.alpha,
    trailingSlash: input.trailingSlash,
    status: response.status,
    contentType: response.headers.get('content-type'),
    bytes: text.length,
    reportReferenceCount: refs.length,
    reportReferences: refs,
    sample: boundedSample(text),
  };
}

async function main() {
  const results = [];
  for (const target of TARGETS) {
    const referer =
      ORIGIN + '/reports-and-data/viewers/campaign-finance/candidates/'
      + target.regnum + '/' + target.year + '/';
    const cookie = await fetchSessionCookie(referer);
    const variants = [];
    const searchTypes = ['', 'candidate', 'candidates', 'cand'];
    for (const method of ['GET', 'POST'] as const) {
      for (const searchType of searchTypes) {
        try {
          const variant = await probeVariant({
            target,
            method,
            searchType,
            alpha: '0',
            trailingSlash: false,
            cookie,
          });
          variants.push(variant);
          if (variant.reportReferenceCount > 0) break;
        } catch (error) {
          variants.push({
            method,
            searchType,
            alpha: '0',
            trailingSlash: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (variants.some(row => 'reportReferenceCount' in row && row.reportReferenceCount > 0)) break;
    }

    if (!variants.some(row => 'reportReferenceCount' in row && row.reportReferenceCount > 0)) {
      for (const trailingSlash of [true]) {
        try {
          variants.push(await probeVariant({
            target,
            method: 'GET',
            searchType: '',
            alpha: '0',
            trailingSlash,
            cookie,
          }));
        } catch (error) {
          variants.push({
            method: 'GET',
            searchType: '',
            alpha: '0',
            trailingSlash,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    results.push({ label: target.label, target, variants });
  }

  console.log(JSON.stringify({
    cfbCandidateApiProbe: {
      apiUrl: API_URL,
      results,
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
