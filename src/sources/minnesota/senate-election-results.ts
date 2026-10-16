/**
 * Minnesota Secretary of State Senate district results, as published.
 * One year-parameterized adapter for general, special, and (where bulk files
 * exist) primary elections. No source reconciliation or vote-total auditing.
 *
 * Data layout: https://electionresults.sos.mn.gov/Results/MediaFileLayout/Index?erselectionId=169
 * Catalog: https://www.sos.mn.gov/elections-voting/election-results/
 */
import { createHash } from 'node:crypto';
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
  sourceKind: 'official_bulk_text' | 'official_sos_pdf' | 'university_election_archive_html';
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

/**
 * The Secretary of State's official Minnesota Votes publication includes
 * district totals for the 2016 general and the 2018/2019 Senate specials.
 * Preserve the ORIGINAL PDF bytes rather than re-creating fake text exports.
 */
const OFFICIAL_2019_ELECTION_BOOK = 'https://www.sos.mn.gov/media/3854/10-minnesota-votes-2019.pdf';
const HISTORICAL_BOOK_EVENTS: Readonly<Record<number,{page:number;district:string;useLastBlock:boolean}>> = {
  110: {page:13,district:'54',useLastBlock:false},
  115: {page:68,district:'13',useLastBlock:true},
  119: {page:177,district:'11',useLastBlock:false},
};
function publishedBookCandidateLine(line:string): {candidate:string;party:string;votes:number;voteShare:number}|null {
  const m=line.trim().match(/^(.+?)\s+\(([A-Za-z]{1,5})\)\s+([\d,]+)\s+\((\d+(?:\.\d+)?)%\)\s*$/);
  if(!m)return null;
  return {candidate:m[1].trim(),party:m[2],votes:integerField(m[3],'published vote'),voteShare:Number(m[4])};
}
export function parsePublishedSpecialSenateBook(
  text:string, type:SenateElectionType, district:string,useLastBlock:boolean,
):SenateElectionCandidate[]{
  const lines=text.split(/\r\n|\r|\n/);
  const blocks:SenateElectionCandidate[][]=[];
  for(let i=0;i<lines.length-2;i++){
    if(lines[i].trim()!=='Senate District'||lines[i+1].trim()!==district)continue;
    const rows:SenateElectionCandidate[]=[];
    for(let j=i+2;j<Math.min(i+14,lines.length);j++){
      const parsed=publishedBookCandidateLine(lines[j]);
      if(!parsed)break;
      rows.push({...parsed,sourceOrdinal:j+1,district,totalVotes:null,winner:false,rawLine:lines[j]});
    }
    if(rows.length>=2)blocks.push(rows);
  }
  const chosen=useLastBlock?blocks.at(-1):blocks[0];
  if(!chosen)throw new Error('Official special election PDF district result table unavailable');
  return markRawElectionLeaders(chosen,type);
}
async function fetchPublishedOfficialPDF(
  event:SenateElectionEvent, url:string,pages:number[],parse:(text:string)=>SenateElectionCandidate[],
):Promise<SenateElectionDownload>{
  const response=await fetch(url,{
    redirect:'error',headers:{'user-agent':'VotePredict/2.0 Minnesota Senate original PDF collection'},
    signal:AbortSignal.timeout(40_000),
  });
  if(!response.ok||!['www.sos.mn.gov','sos.mn.gov'].includes(new URL(response.url).hostname))
    throw new Error('Official SOS original publication unavailable: '+url);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.byteLength<100_000||bytes.byteLength>5_000_000)
    throw new Error('Official SOS PDF original bytes missing or oversized');
  const pdf=new PDFParse({data:bytes});
  let text:string;
  try {text=(await pdf.getText({partial:pages})).text;}
  finally {await pdf.destroy();}
  const candidates=parse(text);
  return {
    event,indexUrl:senateElectionMediaIndexUrl(event.resultsId),
    sourceUrl:url,fetchedAt:new Date().toISOString(),contentType:'application/pdf',
    contentSha256:createHash('sha256').update(bytes).digest('hex'),
    rawContent:text,rawBase64:Buffer.from(bytes).toString('base64'),
    post2022Redistricting:false,candidates,sourceKind:'official_sos_pdf',
    originalObservedOn:null,
  };
}
async function publishedSpecialPDFElection(event:SenateElectionEvent):Promise<SenateElectionDownload>{
  const spec=HISTORICAL_BOOK_EVENTS[event.resultsId];
  if(!spec)throw new Error('No Secretary of State PDF for this historical election');
  return fetchPublishedOfficialPDF(event,OFFICIAL_2019_ELECTION_BOOK,[spec.page],
    (text)=>parsePublishedSpecialSenateBook(text,event.type,spec.district,spec.useLastBlock));
}

/**
 * U of Minnesota's Minnesota Historical Election Archive preserves 2016 SD35
 * official-result-derived data; this is explicitly SECONDARY provenance.
 * The entire genuine HTML response is saved as the raw source, never a
 * synthesized stand-in for an unreachable SOS archival export.
 */
const ACADEMIC_2016_SPECIAL='https://mn.electionarchives.lib.umn.edu/election/232016209997035/';
function htmlEntityDecode(s:string):string{
  return s.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'").replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
export function parse2016SpecialAcademicArchive(html:string):SenateElectionCandidate[]{
  if(!html.includes('February 9, 2016')||!html.includes('State Senate')||!html.includes('District 35'))
    throw new Error('University archive is not the 2016 Senate District 35 special');
  const allRows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const candidates:SenateElectionCandidate[]=[];
  for(let i=0;i<allRows.length;i++){
    const cells=[...allRows[i][1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(x=>htmlEntityDecode(x[1]));
    if(cells.length<5)continue;
    const parties:Record<string,string>={'Republican':'R','Democratic-Farmer-Labor':'DFL','Legal Marijuana Now':'LMN','Write-In':'WI'};
    const party=parties[cells[2]];
    const votes=cells[3].replace(/,/g,'');
    const percent=cells[4].replace('%','');
    if(!party||! /^\d+$/.test(votes)||! /^\d+(?:\.\d+)?$/.test(percent))continue;
    candidates.push({
      sourceOrdinal:i+1,district:'35',candidate:cells[0]||'Write-in',
      party,votes:Number(votes),totalVotes:null,voteShare:Number(percent),
      winner:false,rawLine:allRows[i][0],
    });
  }
  if(candidates.length!==4)throw new Error('University archive special district 35 table incomplete');
  return markRawElectionLeaders(candidates,'special');
}
async function academic2016SpecialElection(event:SenateElectionEvent):Promise<SenateElectionDownload>{
  const response=await fetch(ACADEMIC_2016_SPECIAL,{redirect:'follow',
    headers:{'user-agent':'VotePredict/2.0 Minnesota Senate election collection'},
    signal:AbortSignal.timeout(20_000)});
  if(!response.ok||!['mn.electionarchives.lib.umn.edu','mnelectionarchive.datamade.us']
    .includes(new URL(response.url).hostname))
    throw new Error('Original university election archive unavailable');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<300||bytes.length>500_000)
    throw new Error('University archive body missing or oversized');
  const html=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  return {
    event,indexUrl:senateElectionMediaIndexUrl(event.resultsId),
    sourceUrl:response.url,fetchedAt:new Date().toISOString(),
    contentType:response.headers.get('content-type')??'text/html',
    contentSha256:createHash('sha256').update(bytes).digest('hex'),rawContent:html,
    rawBase64:Buffer.from(bytes).toString('base64'),post2022Redistricting:false,
    candidates:parse2016SpecialAcademicArchive(html),
    sourceKind:'university_election_archive_html',originalObservedOn:null,
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
  // In the Secretary of State's PDF layout, District 2 prints its
  // "Senate District 2 Total" heading AFTER the first district-total block
  // at the page boundary. Parse that genuine block (not either House-half
  // subtotal) from the same original PDF bytes.
  if(!candidates.some((row)=>row.district==='2') &&
     text.includes('Senate District 2 Total')){
    candidates.push(...parsePublishedSpecialSenateBook(text,'general','2',false));
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
  return fetchPublishedOfficialPDF(
    event, OFFICIAL_2016_ELECTION_BOOK,
    Array.from({length:68},(_,i)=>i+31),
    parse2016SenateBookDistricts,
  );
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
      if (event.resultsId === 94) return academic2016SpecialElection(event);
      if (HISTORICAL_BOOK_EVENTS[event.resultsId]) return publishedSpecialPDFElection(event);
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
