/**
 * Minnesota Secretary of State Senate district results, as published.
 * One year-parameterized adapter for general, special, and (where bulk files
 * exist) primary elections. No source reconciliation or vote-total auditing.
 *
 * Data layout: https://electionresults.sos.mn.gov/Results/MediaFileLayout/Index?erselectionId=169
 * Catalog: https://www.sos.mn.gov/elections-voting/election-results/
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';

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
  totalVotes: number | null;
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
  sourceKind: 'official_bulk_text' | 'official_archived_rows_copy' | 'official_sos_pdf';
  originalObservedOn: string | null;
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
  const lines = rawContent.split(/\r\n|\n|\r/);
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

  return markRawElectionLeaders(records, type);
}

function markRawElectionLeaders(records: SenateElectionCandidate[], type: SenateElectionType): SenateElectionCandidate[] {
  // Only an inferred leading named candidate, NOT certification of election.
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
    const top = named.filter((record) => record.votes === highest);
    if (top.length === 1) top[0].winner = true;
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
    throw new Error('Official election results request failed (' + response.status + ', final host ' + new URL(response.url).hostname + '): ' + url);
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

/**
 * The SOS publishes a stable mediafileid=30 district export for its older
 * archived contests and stsenate.txt for newer contests. These URL shapes
 * were checked against the official per-election download indexes.
 */
export function directSenateDistrictFileUrl(event: SenateElectionEvent): string | null {
  // SOS 2016 statewide primary index lists only municipal/school files.
  if (event.resultsId === 99) return null;
  // This SOS special election's publication directory includes the
  // former (postponed) district 60 election sequence suffix.
  if (event.resultsId === 178) {
    return 'https://electionresultsfiles.sos.mn.gov/20250128_27/stsenate.txt';
  }
  if (Number(event.date.slice(0, 4)) < 2020) {
    return 'https://electionresults.sos.mn.gov/Results/MediaFile_Archive/Index?erselectionId='
      + event.resultsId + '&mediafileid=30';
  }
  return 'https://electionresultsfiles.sos.mn.gov/' +
    event.date.replaceAll('-', '') + '/stsenate.txt';
}

// The older electionresults host serves automated-request challenges for
// closely spaced requests. Pace archived reads; never use challenge pages as
// data. The separate bulk-file host does not need this delay.
let lastArchiveRequestAt = 0;
async function waitForArchivedHost(): Promise<void> {
  const delay = Math.max(0, 3000 - (Date.now() - lastArchiveRequestAt));
  if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay));
  lastArchiveRequestAt = Date.now();
}

interface LegacyOfficialRows {
  observationDate: string;
  sources: Array<{resultsId: number;rows: string[]}>;
}
/**
 * The old results host challenges automated requests. These seven literal
 * official published source text exports have been recorded separately as
 * source DATA. They are normalized copies (not a claim of byte-exact remote
 * transfer), with the original official archival download URL preserved.
 */
async function readArchivedPublishedRows(event: SenateElectionEvent): Promise<SenateElectionDownload | null> {
  const buffer = await readFile(new URL('../../../data/mn-senate-election-legacy-official-rows.json', import.meta.url), 'utf8');
  const bundled = JSON.parse(buffer) as LegacyOfficialRows;
  const item = bundled.sources.find((item) => item.resultsId === event.resultsId);
  if (!item) return null;
  const rawContent = item.rows.join('\n') + '\n';
  const bytes = Buffer.from(rawContent,'utf8');
  const officialUrl = directSenateDistrictFileUrl(event);
  if (!officialUrl) return null;
  return {
    event,
    indexUrl: senateElectionMediaIndexUrl(event.resultsId),
    sourceUrl: officialUrl,
    fetchedAt: new Date().toISOString(),
    sourceKind: 'official_archived_rows_copy',
    originalObservedOn: bundled.observationDate,
    contentType:'text/plain; charset=utf-8',
    contentSha256: createHash('sha256').update(bytes).digest('hex'),
    rawContent,rawBase64: bytes.toString('base64'),
    post2022Redistricting:false,
    candidates:parseSenateDistrictFile(rawContent,event.type),
  };
}

const OFFICIAL_2016_ELECTION_BOOK = 'https://www.sos.mn.gov/media/3002/mn-votes_2017.pdf';

/**
 * The 2016 state general text export is blocked to GitHub runners by the
 * official archive's request challenge. Instead retain the SOS-published
 * 2017 Minnesota Votes book PDF, which has district totals for the 2016
 * general. That booklet omits minor-party/write-in records; never present
 * this partial fallback as a complete 2016 candidate inventory.
 */
export function parse2016SenateBookDistricts(text: string): SenateElectionCandidate[] {
  const lines = text.split(/\r\n|\n|\r/);
  const candidates: SenateElectionCandidate[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const headline = lines[index].match(/^Senate District\s+(\d+)\s+Total\s*$/);
    if (!headline) continue;
    const district = String(Number(headline[1]));
    // Each district-total block is headed by the district number on
    // its own line, then candidate rows. Other pages contain district-level
    // precinct figures; those are deliberately ignored.
    let start = index + 1;
    while (start < lines.length && !/^Senate District$/.test(lines[start].trim())) start++;
    if (start + 1 >= lines.length || lines[start + 1].trim() !== district) continue;
    for (let row = start + 2; row < Math.min(lines.length, start + 18); row += 1) {
      const line = lines[row].trim();
      if (!line || line.startsWith('-- ') || /^House District|^Ballot|^Senate District|^Total persons/.test(line)) break;
      const m = line.match(/^(.+?)\s+\(([A-Z]{1,4})\)\s+([\d,]+)\s+\((\d+(?:\.\d+)?)%\)$/);
      if (!m) continue;
      candidates.push({
        sourceOrdinal: row + 1, district, candidate:m[1].trim(), party:m[2],
        votes:integerField(m[3],'2016 book candidate votes'),totalVotes:null,
        voteShare:Number(m[4]),winner:false,rawLine:line,
      });
    }
  }
  if (new Set(candidates.map((row) => row.district)).size !== 67) {
    const found = new Set(candidates.map((row) => Number(row.district)));
    const missing = Array.from({ length: 67 }, (_, i) => i + 1).filter((d) => !found.has(d));
    const headings = lines.filter((line) => /^Senate District\\s+\\d+\\s+Total\\s*$/.test(line));
    throw new Error('Published 2016 Senate book parse incomplete: found '+found.size+' district totals, missed '+missing.join(',')+' (headings '+headings.length+'; lines '+lines.length+')');
  }
  return markRawElectionLeaders(candidates, 'general');
}

async function official2016BookElection(event: SenateElectionEvent): Promise<SenateElectionDownload> {
  const response = await fetch(OFFICIAL_2016_ELECTION_BOOK,{
    redirect:'error',
    headers:{'user-agent':'VotePredict/2.0 Minnesota Senate original source collector'},
    signal:AbortSignal.timeout(40_000),
  });
  if (!response.ok || new URL(response.url).hostname !== 'www.sos.mn.gov') {
    throw new Error('Official 2016 Minnesota Votes PDF not accessible');
  }
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.byteLength<100_000||bytes.byteLength>5_000_000) throw new Error('SOS 2016 published book size unexpected');
  const pdf=new PDFParse({data:bytes});
  let text:string;
  try {text=(await pdf.getText({partial:Array.from({length:68},(_,i)=>i+31)})).text;}
  finally {await pdf.destroy();}
  const candidates=parse2016SenateBookDistricts(text);
  return {
    event,indexUrl:senateElectionMediaIndexUrl(event.resultsId),
    sourceUrl:OFFICIAL_2016_ELECTION_BOOK,fetchedAt:new Date().toISOString(),
    contentType:'application/pdf',contentSha256:createHash('sha256').update(bytes).digest('hex'),
    rawContent:text,rawBase64:Buffer.from(bytes).toString('base64'),
    post2022Redistricting:false,candidates,sourceKind:'official_sos_pdf',
    originalObservedOn:null,
  };
}

export async function fetchSenateElection(event: SenateElectionEvent): Promise<SenateElectionDownload> {
  const indexUrl = senateElectionMediaIndexUrl(event.resultsId);
  const directUrl = directSenateDistrictFileUrl(event);
  if (!directUrl) throw new Error('No bulk State Senate by-district file listed at ' + indexUrl);
  let fileUrl = directUrl;
  let file: Response;
  try {
    if (Number(event.date.slice(0, 4)) < 2020) await waitForArchivedHost();
    file = await getOfficialResponse(fileUrl);
  } catch (directError) {
    // No circumvention of the archived host challenge: use separate
    // original published SOS sources that remain openly accessible.
    if (Number(event.date.slice(0, 4)) < 2020) {
      if (event.resultsId === 100) return official2016BookElection(event);
      const archiveCopy = await readArchivedPublishedRows(event);
      if (archiveCopy) return archiveCopy;
      throw directError;
    }
    // For modern files, the index is discovery fallback, not a routine GET.
    const index = await getOfficialResponse(indexUrl);
    const alternative = locateSenateDistrictDownload(await index.text(), indexUrl);
    if (!alternative || alternative === directUrl) throw directError;
    fileUrl = alternative;
    file = await getOfficialResponse(fileUrl);
  }
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
    sourceKind:'official_bulk_text',originalObservedOn:null,
    candidates: parseSenateDistrictFile(rawContent, event.type),
  };
}
