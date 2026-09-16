import { canonicalPublicUrl, fetchPublicPage, type PublicPage } from './public-http';

export const MN_SOS_CANDIDATE_RESULTS_URL = 'https://candidates.sos.mn.gov/CandidateFilingResults.aspx?candidateid=0&executive=False&federal=False&judicial=False&level=1&office=0&party=0&representative=True&senate=True';

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

function normalizeDistrict(value: string): string {
  const compact = value.toUpperCase().replace(/\s+/g, '');
  const match = compact.match(/^0*(\d+)([A-B]?)$/);
  if (!match) return compact;
  return `${Number(match[1])}${match[2]}`;
}

function normalizeWebsite(value: string): string | undefined {
  const trimmed = decodeEntities(value).trim();
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

function lastOffice(value: string): { chamber: 'house' | 'senate'; district: string } | undefined {
  const cleaned = textCell(value);
  const matches = [...cleaned.matchAll(/State\s+(Senator|Representative)\s+District\s+(\d+[A-B]?)/gi)];
  const match = matches.at(-1);
  if (!match) return undefined;
  return {
    chamber: match[1].toLowerCase() === 'senator' ? 'senate' : 'house',
    district: normalizeDistrict(match[2]),
  };
}

function isRegistryNavigationUrl(value: string): boolean {
  try {
    const url = new URL(value, MN_SOS_CANDIDATE_RESULTS_URL);
    const hostname = url.hostname.toLowerCase();
    return hostname === 'candidates.sos.mn.gov' || hostname === 'www.sos.mn.gov' || hostname === 'sos.mn.gov';
  } catch {
    return false;
  }
}

function websiteFromCell(raw: string, text: string): string | undefined {
  if (text.includes('@')) return undefined;
  if (/(?:https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(text)) {
    const normalized = normalizeWebsite(text);
    if (normalized && !isRegistryNavigationUrl(normalized)) return normalized;
  }
  const href = raw.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!href || /^mailto:/i.test(href)) return undefined;
  let resolved: string;
  try {
    resolved = new URL(decodeEntities(href), MN_SOS_CANDIDATE_RESULTS_URL).toString();
  } catch {
    return undefined;
  }
  if (isRegistryNavigationUrl(resolved)) return undefined;
  return normalizeWebsite(resolved);
}

function plausibleCandidateName(value: string): boolean {
  const text = value.trim();
  if (!text || lastOffice(text)) return false;
  if (/^(?:candidate\s+name|party|website|file\s+date|details?|view|select|more)$/i.test(text)) return false;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) return false;
  return /[A-Za-z]/.test(text);
}

/**
 * Parse the live Minnesota Secretary of State filing result tables without relying on
 * presentation-specific heading tags/classes. Office labels can appear either between
 * candidate rows or inside a table row, so each candidate row inherits the most recent
 * State Senator/Representative district label in document order.
 *
 * The live ASP.NET result grid may add presentation/navigation cells before the candidate
 * name. Find the campaign-website cell first, then infer the candidate from the first
 * plausible textual cell before it rather than assuming candidate name is always cell 0.
 */
export function parseCampaignSiteFilings(html: string): CampaignSiteFiling[] {
  const sanitized = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');

  let office: { chamber: 'house' | 'senate'; district: string } | undefined;
  let cursor = 0;
  const filings: CampaignSiteFiling[] = [];
  const rows = sanitized.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi);

  for (const rowMatch of rows) {
    const rowIndex = rowMatch.index ?? cursor;
    const precedingOffice = lastOffice(sanitized.slice(cursor, rowIndex));
    if (precedingOffice) office = precedingOffice;
    const rowOffice = lastOffice(rowMatch[0]);
    if (rowOffice) office = rowOffice;
    cursor = rowIndex + rowMatch[0].length;
    if (!office) continue;

    const cells = [...rowMatch[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => ({
      raw: match[1],
      text: textCell(match[1]),
    }));
    if (cells.length < 3 || cells.some((cell) => /candidate\s+name/i.test(cell.text))) continue;

    const dateIndex = cells.findIndex((cell) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cell.text));
    if (dateIndex < 0) continue;

    let website: string | undefined;
    let websiteIndex = -1;
    for (let index = 0; index < dateIndex; index += 1) {
      const candidateWebsite = websiteFromCell(cells[index].raw, cells[index].text);
      if (!candidateWebsite) continue;
      website = candidateWebsite;
      websiteIndex = index;
      break;
    }
    if (!website || websiteIndex <= 0) continue;

    const candidateIndex = cells.slice(0, websiteIndex).findIndex((cell) => plausibleCandidateName(cell.text));
    if (candidateIndex < 0) continue;
    const candidateName = cells[candidateIndex].text;
    const party = cells
      .slice(candidateIndex + 1, websiteIndex)
      .map((cell) => cell.text.trim())
      .find((text) => text && plausibleCandidateName(text));

    filings.push({
      ...office,
      candidateName,
      party,
      website,
      filingDate: cells[dateIndex].text,
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
  if (filing.chamber !== member.chamber || normalizeDistrict(filing.district) !== normalizeDistrict(member.district)) return false;
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
