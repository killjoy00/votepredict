import { canonicalPublicUrl, fetchPublicPage, type PublicPage } from './public-http';

export const MN_SOS_CANDIDATE_RESULTS_URL = 'https://candidates.sos.mn.gov/CandidateFilingResults.aspx?candidateid=0&county=0&executive=False&federal=False&hospitaldistrict=0&judicial=False&level=1&municipality=0&office=0&party=0&representative=True&schooldistrict=0&senate=True';

export interface CampaignSiteFiling {
  chamber: 'house' | 'senate';
  district: string;
  candidateName: string;
  party?: string;
  website: string;
  filingDate?: string;
}

export interface CampaignSiteDiscovery {
  filingSource: PublicPage;
  filings: CampaignSiteFiling[];
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function textCell(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeWebsite(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || /^(?:n\/a|none|no website)$/i.test(trimmed) || trimmed.includes('@')) return undefined;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const normalized = canonicalPublicUrl(withScheme);
    const url = new URL(normalized);
    if (url.username || url.password || !url.hostname.includes('.')) return undefined;
    return normalized;
  } catch {
    return undefined;
  }
}

function parseOffice(value: string): { chamber: 'house' | 'senate'; district: string } | undefined {
  const cleaned = textCell(value);
  const senate = cleaned.match(/State\s+Senator\s+District\s+(\d+)/i);
  if (senate) return { chamber: 'senate', district: senate[1] };
  const house = cleaned.match(/State\s+Representative\s+District\s+(\d+[A-B]?)/i);
  if (house) return { chamber: 'house', district: house[1].toUpperCase() };
  return undefined;
}

/**
 * Parses Minnesota Secretary of State candidate filing tables without depending on
 * presentation CSS/classes. Table cells and office headings are the stable contract;
 * incomplete rows and candidates without a filed campaign website are ignored.
 */
export function parseCampaignSiteFilings(html: string): CampaignSiteFiling[] {
  const normalized = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(h[1-6]|caption)\b[^>]*>/gi, '\n<$1>')
    .replace(/<\/\s*(h[1-6]|caption)\s*>/gi, '</$1>\n')
    .replace(/<tr\b[^>]*>/gi, '\n<tr>')
    .replace(/<\/tr>/gi, '</tr>\n');

  let office: { chamber: 'house' | 'senate'; district: string } | undefined;
  const filings: CampaignSiteFiling[] = [];
  for (const block of normalized.split(/\n+/)) {
    const parsedOffice = parseOffice(block);
    if (parsedOffice) {
      office = parsedOffice;
      continue;
    }
    if (!office || !/<tr>/i.test(block)) continue;
    const cells = [...block.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => textCell(match[1]));
    if (cells.length < 3 || /candidate\s+name/i.test(cells[0])) continue;
    const dateIndex = cells.findIndex((cell) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cell));
    if (dateIndex < 0) continue;
    const websiteIndex = cells.findIndex((cell, index) => index > 0 && index < dateIndex && /(?:https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(cell));
    if (websiteIndex < 0) continue;
    const website = normalizeWebsite(cells[websiteIndex]);
    if (!website) continue;
    const filingDate = cells[dateIndex];
    filings.push({
      ...office,
      candidateName: cells[0],
      party: cells[1] || undefined,
      website,
      filingDate,
    });
  }

  const unique = new Map<string, CampaignSiteFiling>();
  for (const filing of filings) {
    unique.set(`${filing.chamber}|${filing.district}|${normalizePersonKey(filing.candidateName)}|${filing.website}`, filing);
  }
  return [...unique.values()].sort((a, b) => a.chamber.localeCompare(b.chamber)
    || a.district.localeCompare(b.district, undefined, { numeric: true })
    || a.candidateName.localeCompare(b.candidateName));
}

export function normalizePersonKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function nameEndpoints(value: string): { first: string; last: string } | undefined {
  const tokens = normalizePersonKey(value).split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return undefined;
  return { first: tokens[0], last: tokens[tokens.length - 1] };
}

export function filingMatchesMember(
  filing: CampaignSiteFiling,
  member: { name: string; chamber: string; district: string },
): boolean {
  if (filing.chamber !== member.chamber || filing.district.toUpperCase() !== member.district.toUpperCase()) return false;
  const candidate = nameEndpoints(filing.candidateName);
  const legislator = nameEndpoints(member.name);
  if (!candidate || !legislator) return false;
  return candidate.first === legislator.first && candidate.last === legislator.last;
}

export async function discoverMinnesotaCampaignSites(): Promise<CampaignSiteDiscovery> {
  const source = await fetchPublicPage(MN_SOS_CANDIDATE_RESULTS_URL, {
    timeoutMs: 20_000,
    maxBytes: 4_000_000,
    userAgent: 'VotePredict/2.0 Minnesota campaign-site registry',
  });
  return { filingSource: source, filings: parseCampaignSiteFilings(source.rawContent) };
}

export function selectCampaignContentLinks(page: PublicPage, limit = 2): string[] {
  const base = new URL(page.finalUrl);
  const scored = page.links.flatMap((link) => {
    try {
      const url = new URL(link);
      if (url.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) return [];
      const key = `${url.pathname} ${url.search}`.toLowerCase();
      const score = /issues?|priorities|platform|policy|positions?/.test(key) ? 4
        : /news|press|updates?|blog/.test(key) ? 3
          : /about|meet/.test(key) ? 1
            : 0;
      return score > 0 ? [{ link, score }] : [];
    } catch {
      return [];
    }
  });
  return [...new Map(scored.sort((a, b) => b.score - a.score || a.link.localeCompare(b.link)).map((row) => [row.link, row])).values()]
    .slice(0, limit)
    .map((row) => row.link);
}
