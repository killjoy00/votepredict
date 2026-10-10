import { createHash } from 'node:crypto';
import {
  parseSenateCommitteeIndexHtml,
  parseSenateCommitteePageHtml,
  type SenateCommitteeMinuteDocument,
} from './minnesota-senate-committee-source.js';

export const SENATE_COMMITTEE_CENSUS_VERSION = 'mn-senate-committee-2021-25-electronic-meeting-census-v1' as const;
export const SENATE_COMMITTEE_MINUTES_MAIN_URL = 'https://www.lrl.mn.gov/minutes/';
export const SENATE_COMMITTEE_CENSUS_YEARS = [2021, 2022, 2023, 2024, 2025] as const;
type Year = typeof SENATE_COMMITTEE_CENSUS_YEARS[number];
type OnlineYear = Exclude<Year, 2021>;

export interface SenateCommitteeCensusPage {
  committeeName: string;
  url: string;
  rawHtmlSha256: string;
  html: string;
  fetchedAt: string;
}
export interface SenateCommitteeCensusYearInput {
  year: OnlineYear;
  indexUrl: string;
  indexHtml: string;
  indexRawHtmlSha256: string;
  indexFetchedAt: string;
  pages: SenateCommitteeCensusPage[];
  failures: Array<{ committeeName: string; url: string; category: 'http' | 'parse' | 'transport' }>;
}
export interface SenateCommitteeCensusMeeting {
  year: OnlineYear;
  committeeName: string;
  committeeUrl: string;
  meetingDate: string;
  indexHeadingVerified: boolean;
  minutesPdfUrls: string[];
  electronicMinutesStatus: 'linked' | 'meeting_without_linked_minutes';
}

function date(value: string, year: number): string | null {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(20\d\d)$/);
  if (!m || Number(m[3]) !== year) return null;
  const y = Number(m[3]), month = Number(m[1]), day = Number(m[2]);
  const d = new Date(Date.UTC(y, month - 1, day));
  return d.getUTCFullYear() === y && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? d.toISOString().slice(0, 10) : null;
}

function stripMarkup(value: string): string {
  return value.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

/**
 * An official committee page's dated section is a *meeting listing*, even
 * when it has no original Minutes-PDF link. Never manufacture a minutes
 * document or an individual vote from a meeting listing.
 */
export function parseSenateCommitteePageMeetingDates(year: OnlineYear, html: string): string[] {
  if (html.length > 3_000_000) throw new Error('Unbounded LRL Senate committee page');
  const result = new Set<string>();
  for (const h of html.matchAll(/<h[2-5]\b[^>]*>([\s\S]*?)<\/h[2-5]>/gi)) {
    const day = date(stripMarkup(h[1] ?? ''), year);
    if (day) result.add(day);
  }
  return [...result].sort();
}

function validPdf(row: SenateCommitteeMinuteDocument, year: number): boolean {
  if (row.year !== year || row.meetingDate.slice(0, 4) !== String(year)) return false;
  const url = new URL(row.url);
  return url.protocol === 'https:' && ['lrl.mn.gov', 'www.lrl.mn.gov'].includes(url.hostname)
    && url.pathname.toLowerCase().startsWith('/archive/minutes/senate/' + year + '/')
    && /_minutes\.pdf$/i.test(url.pathname);
}

function validPage(urlValue: string, year: number): boolean {
  try {
    const url = new URL(urlValue);
    return url.protocol === 'https:' && ['lrl.mn.gov', 'www.lrl.mn.gov'].includes(url.hostname)
      && /^\/minutes\/comm(?:\.aspx)?$/i.test(url.pathname)
      && url.searchParams.get('year') === String(year);
  } catch { return false; }
}

export function reconcileSenateCommitteeCensus(
  sourceYears: readonly SenateCommitteeCensusYearInput[],
) {
  const duplicatedInputYears = sourceYears.map(y => y.year).filter((y, i, all) => all.indexOf(y) !== i);
  if (duplicatedInputYears.length) throw new Error('Duplicate official LRL census year supplied');
  const items: SenateCommitteeCensusMeeting[] = [];
  const summaries: Array<{
    year: Year;
    electronicIndexStatus: string;
    committeePagesListed: number | null;
    committeePagesDownloaded: number | null;
    committeePagesFailed: number | null;
    indexedMeetings: number | null;
    minutesLinkedMeetings: number | null;
    meetingsWithoutLinkedMinutes: number | null;
    distinctOriginalMinutesPdfLinks: number | null;
    officialCompleteMeetingDenominator: null;
    actualRecordedVotesDenominator: null;
    printRecordGap: boolean;
  }> = [];
  const anomalies: Array<{ year: number; committeeName: string; type: string; url: string }> = [];
  const indexProofs: Array<{
    year: OnlineYear;
    indexUrl: string;
    rawHtmlSha256: string;
    fetchedAt: string;
    distinctCommitteePages: number;
    downloadedPageHashes: Array<{ committeeName: string; pageUrl: string; htmlSha256: string }>;
  }> = [];
  for (const year of SENATE_COMMITTEE_CENSUS_YEARS) {
    if (year === 2021) {
      summaries.push({
        year, electronicIndexStatus: 'official_print_only_no_electronic_index',
        committeePagesListed: null, committeePagesDownloaded: null, committeePagesFailed: null,
        indexedMeetings: null, minutesLinkedMeetings: null, meetingsWithoutLinkedMinutes: null,
        distinctOriginalMinutesPdfLinks: null,
        officialCompleteMeetingDenominator: null, actualRecordedVotesDenominator: null,
        printRecordGap: true,
      });
      continue;
    }
    const source = sourceYears.find(s => s.year === year);
    if (!source) {
      summaries.push({
        year, electronicIndexStatus: 'index_not_acquired',
        committeePagesListed: null, committeePagesDownloaded: null, committeePagesFailed: null,
        indexedMeetings: null, minutesLinkedMeetings: null, meetingsWithoutLinkedMinutes: null,
        distinctOriginalMinutesPdfLinks: null,
        officialCompleteMeetingDenominator: null, actualRecordedVotesDenominator: null,
        printRecordGap: year === 2022,
      });
      continue;
    }
    const expectedIndex = 'https://www.lrl.mn.gov/minutes/default?body=senate&year=' + year;
    const validIndex = source.indexUrl === expectedIndex
      && /^[a-f0-9]{64}$/.test(source.indexRawHtmlSha256)
      && !Number.isNaN(Date.parse(source.indexFetchedAt));
    if (!validIndex) throw new Error('Official LRL calendar index provenance invalid for ' + year);
    const committeePages = parseSenateCommitteeIndexHtml({
      year, html: source.indexHtml, sourceUrl: source.indexUrl,
    });
    if (!committeePages.length) {
      anomalies.push({ year, committeeName: '', type: 'zero_official_committee_pages', url: source.indexUrl });
    }
    const expected = new Map(committeePages.map(p => [p.url, p.committeeName]));
    const observed = new Set<string>();
    const hashes: Array<{ committeeName: string; pageUrl: string; htmlSha256: string }> = [];
    for (const page of source.pages) {
      if (!validPage(page.url, year) || expected.get(page.url) !== page.committeeName
        || observed.has(page.url) || !/^[a-f0-9]{64}$/.test(page.rawHtmlSha256)
        || !page.html || Number.isNaN(Date.parse(page.fetchedAt))) {
        anomalies.push({ year, committeeName: page.committeeName, type: 'invalid_duplicate_or_unlisted_page', url: page.url });
        continue;
      }
      observed.add(page.url);
      hashes.push({ committeeName: page.committeeName, pageUrl: page.url, htmlSha256: page.rawHtmlSha256 });
      const dates = parseSenateCommitteePageMeetingDates(year, page.html);
      const minutes = parseSenateCommitteePageHtml({
        year, committeeName: page.committeeName, html: page.html, sourceUrl: page.url,
      });
      const documentGroups = new Map<string, string[]>();
      for (const doc of minutes) {
        if (!validPdf(doc, year)) {
          anomalies.push({ year, committeeName: page.committeeName, type: 'invalid_minutes_pdf_link', url: doc.url });
          continue;
        }
        const list = documentGroups.get(doc.meetingDate) ?? [];
        if (!list.includes(doc.url)) list.push(doc.url);
        documentGroups.set(doc.meetingDate, list);
      }
      const allDays = new Set([...dates, ...documentGroups.keys()]);
      for (const day of [...allDays].sort()) {
        const urls = (documentGroups.get(day) ?? []).sort();
        const foundHeading = dates.includes(day);
        if (!foundHeading) {
          anomalies.push({ year, committeeName: page.committeeName, type: 'minutes_link_without_date_heading', url: page.url });
        }
        items.push({
          year, committeeName: page.committeeName, committeeUrl: page.url,
          meetingDate: day, indexHeadingVerified: foundHeading,
          minutesPdfUrls: urls,
          electronicMinutesStatus: urls.length > 0 ? 'linked' : 'meeting_without_linked_minutes',
        });
      }
    }
    for (const committee of committeePages) {
      if (!observed.has(committee.url)) {
        anomalies.push({ year, committeeName: committee.committeeName, type: 'committee_page_not_acquired', url: committee.url });
      }
    }
    for (const failure of source.failures) {
      anomalies.push({ year, committeeName: failure.committeeName, type: 'committee_fetch_' + failure.category, url: failure.url });
    }
    const yearMeetings = items.filter(item => item.year === year);
    const uniquePdf = new Set(yearMeetings.flatMap(item => item.minutesPdfUrls));
    const completeForIndex = committeePages.length > 0 && observed.size === committeePages.length
      && source.failures.length === 0 && !anomalies.some(a =>
        a.year === year && ['invalid_duplicate_or_unlisted_page', 'zero_official_committee_pages'].includes(a.type));
    summaries.push({
      year,
      electronicIndexStatus: completeForIndex ? 'all_current_electronic_index_pages_parsed'
        : 'incomplete_electronic_index_capture',
      committeePagesListed: committeePages.length,
      committeePagesDownloaded: observed.size,
      committeePagesFailed: committeePages.length - observed.size,
      indexedMeetings: yearMeetings.length,
      minutesLinkedMeetings: yearMeetings.filter(item => item.minutesPdfUrls.length).length,
      meetingsWithoutLinkedMinutes: yearMeetings.filter(item => !item.minutesPdfUrls.length).length,
      distinctOriginalMinutesPdfLinks: uniquePdf.size,
      officialCompleteMeetingDenominator: null,
      actualRecordedVotesDenominator: null,
      printRecordGap: year === 2022,
    });
    indexProofs.push({
      year, indexUrl: source.indexUrl, rawHtmlSha256: source.indexRawHtmlSha256,
      fetchedAt: source.indexFetchedAt, distinctCommitteePages: committeePages.length,
      downloadedPageHashes: hashes.sort((a, b) => a.pageUrl.localeCompare(b.pageUrl)),
    });
  }
  items.sort((a, b) => a.year - b.year || a.meetingDate.localeCompare(b.meetingDate)
    || a.committeeName.localeCompare(b.committeeName) || a.committeeUrl.localeCompare(b.committeeUrl));
  return {
    schemaVersion: SENATE_COMMITTEE_CENSUS_VERSION,
    archiveAuthorityUrl: SENATE_COMMITTEE_MINUTES_MAIN_URL,
    sourceYears: [2021, 2022, 2023, 2024, 2025],
    yearSummaries: summaries,
    officialIndexProofs: indexProofs,
    indexedMeetings: items,
    anomalies,
    totalIndexedMeetings2022To2025: summaries.slice(1).every(s => s.indexedMeetings !== null)
      ? items.length : null,
    allYearsCompleteMeetingDenominator: null,
    allYearsRecordedVotesDenominator: null,
    allYearsNamedMemberVotesDenominator: null,
    sourceInventoryOnlyNotDatabaseReconciled: true,
    noSourcePdfContentsStored: true,
    noProductionDatabaseAccess: true,
    noModelOrServingChange: true,
  };
}

export function senateCensusSha256(body: string | Uint8Array) {
  return createHash('sha256').update(body).digest('hex');
}
