/**
 * Minnesota Secretary of State Senate district results, as published.
 * One year-parameterized adapter for general, special, and (where bulk files
 * exist) primary elections. No source reconciliation or vote-total auditing.
 *
 * Data layout: https://electionresults.sos.mn.gov/Results/MediaFileLayout/Index?erselectionId=169
 * Catalog: https://www.sos.mn.gov/elections-voting/election-results/
 */
import { createHash } from 'node:crypto';

export type SenateElectionType = 'general' | 'special' | 'primary' | 'special_primary';

export interface SenateElectionEvent {
  date: string;
  type: SenateElectionType;
  resultsId: number;
  expectedDistricts?: number;
}

export interface SenateElectionCandidate {
  sourceOrdinal: number;
  district: string;
  candidate: string;
  party: string;
  votes: number;
  totalVotes: number;
  voteShare: number;
  winner: boolean;
  rawLine: string;
}

export interface SenateElectionDownload {
  event: SenateElectionEvent;
  indexUrl: string;
  sourceUrl: string;
  fetchedAt: string;
  contentType: string;
  contentSha256: string;
  rawContent: string;
  rawBase64: string;
  post2022Redistricting: boolean;
  candidates: SenateElectionCandidate[];
}

/**
 * Election dates are the Secretary of State's published election dates.
 * 2018-11-06 and 2024-11-05 are Senate *special* races held alongside
 * statewide general elections. 2025-11-04 contains both SD 29 and SD 47.
 * No 2026 general result is included before the November 2026 election.
 */
const EVENTS: readonly SenateElectionEvent[] = [
  { date: '2016-01-12', type: 'special_primary', resultsId: 93, expectedDistricts: 1 },
  { date: '2016-02-09', type: 'special', resultsId: 94, expectedDistricts: 1 },
  { date: '2016-08-09', type: 'primary', resultsId: 99 },
  { date: '2016-11-08', type: 'general', resultsId: 100, expectedDistricts: 67 },
  { date: '2018-01-29', type: 'special_primary', resultsId: 109, expectedDistricts: 1 },
  { date: '2018-02-12', type: 'special', resultsId: 110, expectedDistricts: 1 },
  { date: '2018-11-06', type: 'special', resultsId: 115, expectedDistricts: 1 },
  { date: '2019-01-22', type: 'special_primary', resultsId: 118, expectedDistricts: 1 },
  { date: '2019-02-05', type: 'special', resultsId: 119, expectedDistricts: 1 },
  { date: '2020-08-11', type: 'primary', resultsId: 135 },
  { date: '2020-11-03', type: 'general', resultsId: 136, expectedDistricts: 67 },
  { date: '2022-08-09', type: 'primary', resultsId: 148 },
  { date: '2022-11-08', type: 'general', resultsId: 149, expectedDistricts: 67 },
  { date: '2024-08-13', type: 'primary', resultsId: 169, expectedDistricts: 1 },
  { date: '2024-11-05', type: 'special', resultsId: 170, expectedDistricts: 1 },
  { date: '2025-01-14', type: 'special_primary', resultsId: 177, expectedDistricts: 1 },
  { date: '2025-01-28', type: 'special', resultsId: 178, expectedDistricts: 1 },
  { date: '2025-04-15', type: 'special_primary', resultsId: 183, expectedDistricts: 1 },
  { date: '2025-04-29', type: 'special', resultsId: 184, expectedDistricts: 1 },
  { date: '2025-08-26', type: 'special_primary', resultsId: 190, expectedDistricts: 2 },
  { date: '2025-11-04', type: 'special', resultsId: 187, expectedDistricts: 2 },
  { date: '2026-08-11', type: 'primary', resultsId: 200 },
];

export function senateElectionsForYear(year: number, includePrimaries = true): SenateElectionEvent[] {
  if (!Number.isInteger(year) || year < 2016 || year > new Date().getUTCFullYear()) {
    throw new Error('Election year must be between 2016 and the current year');
  }
  return EVENTS.filter((entry) =>
    Number(entry.date.slice(0, 4)) === year &&
    (includePrimaries || (entry.type !== 'primary' && entry.type !== 'special_primary')));
}

export function senateElectionMediaIndexUrl(resultsId: number): string {
  return 'https://electionresults.sos.mn.gov/Select/MediaFiles/Index?ersElectionId=' + resultsId;
}

export function isPost2022RedistrictedMap(electionDate: string): boolean {
  return electionDate >= '2022-08-09';
}

function decodeHtmlText(raw: string): string {
  return raw.replace(/<[^>]*>/g, ' ').replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ').replace(/&#(\d+);/g, (_match, numeric: string) =>
      String.fromCodePoint(Number(numeric))).replace(/\s+/g, ' ').trim();
}

/** Read only the bulk Senate by-district anchor, never precinct or county files. */
export function locateSenateDistrictDownload(html: string, indexUrl: string): string | null {
  for (const anchor of html.matchAll(/<a\b[^>]*href\s*=\s*(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = decodeHtmlText(anchor[3]);
    if (!/\b(?:state\s+senat(?:e|or)|senate\s+senate)\b/i.test(title) ||
        !/\bdistrict\b/i.test(title) || /\b(?:precinct|county|congressional)\b/i.test(title)) continue;
    const href = anchor[2].replace(/&amp;/gi, '&');
    const url = new URL(href, indexUrl);
    if (url.protocol !== 'https:' ||
        !['electionresults.sos.mn.gov', 'electionresultsfiles.sos.mn.gov'].includes(url.hostname)) continue;
    return url.toString();
  }
  return null;
}

function integerField(value: string, label: string): number {
  const stripped = value.trim().replace(/,/g, '');
  if (!/^\d+$/.test(stripped)) throw new Error('Invalid ' + label + ' in official Senate file: ' + value);
  return Number(stripped);
}

/**
 * The by-district file is semicolon-delimited, with the exact layout:
 * 4 office name, 5 district, 7 candidate, 8 suffix, 10 party,
 * 13 candidate votes, 14 published percentage, 15 office/party total.
 * The primary total is PER PARTY; do not sum party totals together.
 */
export function parseSenateDistrictFile(rawContent: string, type: SenateElectionType): SenateElectionCandidate[] {
  const records: SenateElectionCandidate[] = [];
  const lines = rawContent.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const fields = line.split(';');
    if (fields.length < 16) throw new Error('Unexpected Senate district file format at line ' + (index + 1));
    if (!/\bstate senat(?:e|or)\b/i.test(fields[4])) continue;
    const districtNumber = integerField(fields[5], 'district');
    if (!districtNumber || districtNumber > 67) throw new Error('Invalid Senate district at line ' + (index + 1));
    const candidate = [fields[7].trim(), fields[8].trim()].filter(Boolean).join(' ');
    if (!candidate) throw new Error('Missing Senate candidate name at line ' + (index + 1));
    const percent = Number(fields[14].trim());
    if (!Number.isFinite(percent)) throw new Error('Invalid official percentage at line ' + (index + 1));
    records.push({
      sourceOrdinal: index + 1,
      district: String(districtNumber),
      candidate,
      party: fields[10].trim(),
      votes: integerField(fields[13], 'candidate votes'),
      totalVotes: integerField(fields[15], 'office total'),
      voteShare: percent,
      winner: false,
      rawLine: line,
    });
  }
  if (!records.length) throw new Error('The downloaded bulk file contains no State Senate district rows');

  // Winner is the leading named candidate, inferred directly from published
  // vote counts, not a separate canvass / certification claim. For primaries,
  // the winner means leading candidate within a party nomination contest.
  const groups = new Map<string, SenateElectionCandidate[]>();
  for (const record of records) {
    const key = record.district +
      ((type === 'primary' || type === 'special_primary') ? ':' + record.party : '');
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  for (const group of groups.values()) {
    const named = group.filter((record) => record.party !== 'WI' &&
      !/^write[\s-]?in/i.test(record.candidate));
    const highest = Math.max(...named.map((record) => record.votes));
    const first = named.filter((record) => record.votes === highest);
    if (first.length === 1) first[0].winner = true;
  }
  return records;
}

async function getOfficialResponse(url: string): Promise<Response> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'VotePredict/2.0 (Minnesota Senate raw election collection)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok ||
      !['electionresults.sos.mn.gov', 'electionresultsfiles.sos.mn.gov'].includes(new URL(response.url).hostname)) {
    throw new Error('Official election results request failed (' + response.status + '): ' + url);
  }
  return response;
}

function decodeOfficialFile(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Historical SOS text files can use Windows-1252 names.
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export async function fetchSenateElection(event: SenateElectionEvent): Promise<SenateElectionDownload> {
  const indexUrl = senateElectionMediaIndexUrl(event.resultsId);
  const index = await getOfficialResponse(indexUrl);
  const fileUrl = locateSenateDistrictDownload(await index.text(), indexUrl);
  if (!fileUrl) throw new Error('No bulk State Senate by-district file at ' + indexUrl);
  const file = await getOfficialResponse(fileUrl);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > 5_000_000) throw new Error('Official State Senate bulk file exceeds 5 MB: ' + fileUrl);
  const rawContent = decodeOfficialFile(bytes);
  return {
    event,
    indexUrl,
    sourceUrl: fileUrl,
    fetchedAt: new Date().toISOString(),
    contentType: file.headers.get('content-type') ?? 'text/plain',
    contentSha256: createHash('sha256').update(bytes).digest('hex'),
    rawContent,
    rawBase64: Buffer.from(bytes).toString('base64'),
    post2022Redistricting: isPost2022RedistrictedMap(event.date),
    candidates: parseSenateDistrictFile(rawContent, event.type),
  };
}
