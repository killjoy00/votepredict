import { createHash } from 'node:crypto';

export const CFB_HISTORICAL_CALENDAR_INDEX_VERSION = 'cfb-calendar-index-2021-25-v1' as const;
export const CFB_HISTORICAL_CALENDAR_INDEX_URL =
  'https://register.cfb.mn.gov/filer-resources/disclosure-publications/calendars/calendars-archive/';
export const CFB_SD6_STANDALONE_CALENDAR_URL =
  'https://register.cfb.mn.gov/pdf/calendars/2025_special_election_6.pdf';
export const CFB_SD6_CANDIDATE_PACKET_URL =
  'https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2025/Senate_6_special.pdf';

const YEARS = [2021, 2022, 2023, 2024, 2025] as const;
type Year = typeof YEARS[number];
type CalendarFamily =
  | 'senate_special_election'
  | 'house_special_election'
  | 'ambiguous_chamber_label'
  | 'candidate_regular'
  | 'party_unit'
  | 'committee_or_fund'
  | 'general'
  | 'other';

export interface CfbArchivedCalendarLink {
  year: Year;
  title: string;
  sourceUrl: string;
  family: CalendarFamily;
}

export interface CfbArchivedCalendarYear {
  year: Year;
  listingStatus: 'listed' | 'year_not_listed' | 'source_markup_unrecognized';
  calendarLinksObserved: number | null;
  senateSpecialElectionLinksObserved: number | null;
  ambiguousChamberLabelLinksObserved: number | null;
}

export interface CfbCalendarPdfObservation {
  role: 'archive_standalone' | 'candidate_packet';
  sourceUrl: string;
  finalSourceUrl: string;
  rawPdfSha256: string;
  pdfBytes: number;
  fetchedAt: string;
  extractedText: string;
}

function isOfficialPdfUrl(value: string): boolean {
  let url: URL;
  try { url = new URL(value); }
  catch { return false; }
  const host = url.hostname.toLowerCase();
  return url.protocol === 'https:'
    && (host === 'cfb.mn.gov' || host.endsWith('.cfb.mn.gov')
      || host === 'cfb.state.mn.us' || host.endsWith('.cfb.state.mn.us'))
    && /^\/pdf\//i.test(url.pathname);
}

function htmlText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, digits: string) => {
      const cp = Number(digits);
      return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : '';
    })
    .replace(/\s+/g, ' ').trim();
}

function classify(label: string): CalendarFamily {
  // Senate districts are numeric. A public archive label such as "Senate
  // District 64A" must not silently count as a Senate calendar: the CFB's
  // original 2025_64A PDF instead identifies House District 64A.
  if (/senate\s+district\s+\d+[A-Z]\s+special election/i.test(label)) return 'ambiguous_chamber_label';
  if (/senate\s+district\s+\d+\s+special election/i.test(label)) return 'senate_special_election';
  if (/house\s+district\s+\d+[A-Z]?\s+special election/i.test(label)) return 'house_special_election';
  if (/party|caucus/i.test(label)) return 'party_unit';
  if (/committee|fund/i.test(label)) return 'committee_or_fund';
  if (/general disclosure calendar/i.test(label)) return 'general';
  if (/candidate|senate candidates|house candidates/i.test(label)) return 'candidate_regular';
  return 'other';
}

export function parseCfbHistoricalCalendarIndex(body: string, fetchedAt: string) {
  if (body.length > 2_000_000) throw new Error('CFB calendar index body is over 2 MiB');
  const years: CfbArchivedCalendarYear[] = [];
  const links: CfbArchivedCalendarLink[] = [];
  const normalizedBody = body.replace(/<!--[\s\S]*?-->/g, '');
  const headings = [...normalizedBody.matchAll(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map(match => ({ offset: match.index ?? 0, end: (match.index ?? 0) + match[0].length, title: htmlText(match[2] ?? '') }));
  for (const year of YEARS) {
    const section = headings.find(h =>
      h.title.toLowerCase() === String(year) + ' campaign finance');
    if (!section) {
      years.push({ year, listingStatus: headings.length ? 'year_not_listed' : 'source_markup_unrecognized',
        calendarLinksObserved: null, senateSpecialElectionLinksObserved: null,
        ambiguousChamberLabelLinksObserved: null });
      continue;
    }
    const following = headings.find(h => h.offset > section.end);
    const block = normalizedBody.slice(section.end, following?.offset ?? normalizedBody.length);
    const entries = [...block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
    const seen = new Set<string>();
    for (const entry of entries) {
      const hrefRaw = (entry[1] ?? '').match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
      const href = (hrefRaw?.[1] ?? hrefRaw?.[2] ?? '').replace(/&amp;/gi, '&');
      if (!href || href.startsWith('javascript:')) continue;
      let absolute = '';
      try { absolute = new URL(href, CFB_HISTORICAL_CALENDAR_INDEX_URL).href; }
      catch { continue; }
      if (!isOfficialPdfUrl(absolute)) continue;
      const title = htmlText(entry[2] ?? '');
      if (!title || title.length > 180) continue;
      const identity = [year, absolute, title].join('|');
      if (seen.has(identity)) continue;
      seen.add(identity);
      links.push({ year, title, sourceUrl: absolute, family: classify(title) });
    }
    const found = links.filter(l => l.year === year);
    years.push({
      year,
      listingStatus: found.length > 0 ? 'listed' : 'source_markup_unrecognized',
      calendarLinksObserved: found.length > 0 ? found.length : null,
      senateSpecialElectionLinksObserved: found.length > 0
        ? found.filter(l => l.family === 'senate_special_election').length : null,
      ambiguousChamberLabelLinksObserved: found.length > 0
        ? found.filter(l => l.family === 'ambiguous_chamber_label').length : null,
    });
  }
  links.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title) || a.sourceUrl.localeCompare(b.sourceUrl));
  return {
    schemaVersion: CFB_HISTORICAL_CALENDAR_INDEX_VERSION,
    indexSourceUrl: CFB_HISTORICAL_CALENDAR_INDEX_URL,
    indexRawHtmlSha256: createHash('sha256').update(body).digest('hex'),
    fetchedAt,
    years,
    links,
    observedUniquePdfUrls: new Set(links.map(l => l.sourceUrl)).size,
    ambiguousChamberSourceLabels: links.filter(l => l.family === 'ambiguous_chamber_label'),
    ambiguousLabelsAreNotSenateCalendarProof: true,
    // The index is a list of links, NOT the required filing universe.
    requiredReportDenominator: null,
    registeredSenateFilerDenominator: null,
    missingSectionIsNotProofNoCalendarExists: true,
    noDateOrEligibilityInferredFromIndex: true,
  };
}

export function verifyCfbSd6StandaloneCalendarComparison(
  sources: readonly CfbCalendarPdfObservation[],
) {
  const results = (['archive_standalone', 'candidate_packet'] as const).map(role => {
    const relevant = sources.filter(s => s.role === role);
    const expected = role === 'archive_standalone'
      ? CFB_SD6_STANDALONE_CALENDAR_URL : CFB_SD6_CANDIDATE_PACKET_URL;
    if (relevant.length !== 1) return {
      role, status: relevant.length === 0 ? 'not_acquired' : 'conflicting_captures',
      sourceUrl: expected, rawPdfSha256: null as string | null, pdfBytes: null as number | null,
      fetchedAt: null as string | null, finalPeriodEndOn: null as string | null,
      calendarFinalDueOn: null as string | null, subsidyCycleEndOn: null as string | null,
    };
    const source = relevant[0]!;
    const contentValid = source.sourceUrl === expected && isOfficialPdfUrl(source.finalSourceUrl)
      && /^[a-f0-9]{64}$/.test(source.rawPdfSha256)
      && Number.isInteger(source.pdfBytes) && source.pdfBytes >= 500
      && !Number.isNaN(Date.parse(source.fetchedAt))
      && source.extractedText.length > 100;
    const text = source.extractedText.replace(/\s+/g, ' ');
    const titled = /Senate\s+District\s+6\s+Special\s+Election\s+Public\s+Disclosure\s+Calendar/i.test(text);
    const final = text.match(/special election cycle final report of receipts and expenditures due\.\s*Period covered:\s*January\s+1\s+through\s+May\s+(\d{1,2}),?\s+2025/i);
    const due = /May\s+27\b/.test(text) && /May\s+28\b/.test(text);
    const subsidy = text.match(/Special\s+Election\s+Cycle:\s*March\s+25,\s*2025,\s*through\s+May\s+(\d{1,2}),?\s*2025/i);
    const end = final?.[1] === '14' ? '2025-05-14' : final?.[1] === '20' ? '2025-05-20' : null;
    const status = !contentValid ? 'invalid_pdf_provenance'
      : !titled ? 'calendar_scope_not_verified'
      : !end || !due ? 'final_row_not_verified'
      : 'final_reporting_row_verified';
    return {
      role, status, sourceUrl: expected,
      rawPdfSha256: contentValid ? source.rawPdfSha256 : null,
      pdfBytes: contentValid ? source.pdfBytes : null,
      fetchedAt: contentValid ? source.fetchedAt : null,
      finalPeriodEndOn: status === 'final_reporting_row_verified' ? end : null,
      // May 27 is a document-level checked due marker; not a full table alignment proof.
      calendarFinalDueOn: status === 'final_reporting_row_verified' ? '2025-05-27' : null,
      subsidyCycleEndOn: subsidy?.[1] === '14' ? '2025-05-14' : subsidy?.[1] === '20' ? '2025-05-20' : null,
    };
  });
  const [standalone, packet] = results;
  const separatelyVerified = results.every(r => r.status === 'final_reporting_row_verified');
  return {
    schemaVersion: 'cfb-2025-sd6-calendar-version-comparison-v1' as const,
    reports: results,
    sourcesSeparatelyVerified: separatelyVerified,
    differentFinalPeriodEndDates: separatelyVerified
      ? standalone!.finalPeriodEndOn !== packet!.finalPeriodEndOn : null,
    standaloneAndPacketHaveSameMay27Due: separatelyVerified
      ? standalone!.calendarFinalDueOn === packet!.calendarFinalDueOn : null,
    governingVersionOrErratumProven: false,
    candidatePdfPeriodEndOn: '2025-05-14',
    candidatePdfPeriodEndSource: 'docs/evaluation/source-proof/cfb-2025-senate-district6-report-pdfs.json',
    historicalPublicByOn: null,
    rowContainmentVerified: false,
    officialSenateReportDenominator: null,
    noEligibilityPromotion: true,
    noLiveDatabaseAccess: true,
  };
}
