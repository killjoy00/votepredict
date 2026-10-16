/** Targeted raw-only import of recovered official Minutes. No vote/model writes. */
import {createHash} from 'node:crypto';
import type {Client,PoolClient} from 'pg';
import {parseSenateCommitteeMinutesRaw,SENATE_RAW_VOTE_PARSER_VERSION} from '../sources/minnesota/senate-raw-votes.js';

export const MINUTE_RECOVERY_BATCH='senate-minute-gap-recovery-20261016';
export interface RecoveredMinute {
  year:number; committeeName:string; hearingDate:string; printedDateText:string;
  indexUrl:string; sourceUrl:string; contentSha256:string; bytes:number;
  fetchedAt:string; extractionMethod:'embedded_text'|'ocr_tesseract';
  rawText:string; textSha256:string;
}
export interface MinuteRecoveryCorpus {
  schemaVersion:typeof MINUTE_RECOVERY_BATCH;
  originalGapDates:number;
  documents:RecoveredMinute[];
  remainingGaps:Array<{year:number;committeeName:string;hearingDate:string}>;
}
export const sha256=(text:string|Uint8Array)=>createHash('sha256').update(text).digest('hex');
export function validateMinuteRecoveryCorpus(corpus:MinuteRecoveryCorpus):void {
  if(corpus.schemaVersion!==MINUTE_RECOVERY_BATCH||corpus.originalGapDates!==14||
    !Array.isArray(corpus.documents)||!corpus.documents.length||corpus.documents.length>14||
    !Array.isArray(corpus.remainingGaps)||corpus.documents.length+corpus.remainingGaps.length!==14)
    throw Error('Invalid bounded minute recovery corpus');
  const days=new Set<string>();
  for(const row of [...corpus.documents,...corpus.remainingGaps]){
    if(![2022,2023,2024,2025].includes(row.year)||!row.hearingDate.startsWith(String(row.year))||
      !/^20\d{2}-\d{2}-\d{2}$/.test(row.hearingDate)||!row.committeeName)
      throw Error('Invalid historical Senate meeting');
    const key=row.hearingDate+'|'+row.committeeName;
    if(days.has(key))throw Error('Duplicate recovered or remaining meeting');
    days.add(key);
  }
  for(const row of corpus.documents){
    const url=new URL(row.sourceUrl),index=new URL(row.indexUrl);
    if(url.origin!=='https://www.lrl.mn.gov'||url.search||url.hash||
      !url.pathname.startsWith(`/archive/minutes/senate/${row.year}/`)||
      !url.pathname.includes('/'+row.hearingDate.replaceAll('-','')+'/')||
      !/\.pdf$/i.test(url.pathname)||/previous[-_]meeting/i.test(url.pathname)||
      index.origin!==url.origin||index.pathname!=='/minutes/comm'||
      index.searchParams.get('year')!==String(row.year)||!index.searchParams.get('commid')||
      !/^[a-f0-9]{64}$/.test(row.contentSha256)||row.bytes<300||row.bytes>8_000_000||
      !Number.isFinite(Date.parse(row.fetchedAt))||!['embedded_text','ocr_tesseract'].includes(row.extractionMethod)||
      row.rawText.length<100||row.rawText.length>500_000||sha256(row.rawText)!==row.textSha256||
      !row.printedDateText||!row.rawText.slice(0,500).includes(row.printedDateText))
      throw Error('Recovered minute source/text provenance mismatch');
  }
}
export function minuteRawPayload(row:RecoveredMinute){
  const records=parseSenateCommitteeMinutesRaw(row.rawText);
  const sessionSlug=row.year===2025?'2025-2026':row.year>=2023?'2023-2024':'2021-2022';
  return {
    sourceType:'mn_senate_committee_minutes_pdf',parserVersion:SENATE_RAW_VOTE_PARSER_VERSION,
    sessionSlug,sourceDate:row.hearingDate,publicationDate:null,
    dateBasis:'printed_hearing_date',fetchedAt:row.fetchedAt,
    sourceIndexUrl:row.indexUrl,committeeName:row.committeeName,
    printedDateText:row.printedDateText,extractionMethod:row.extractionMethod,
    textSha256:row.textSha256,recoveryBatch:MINUTE_RECOVERY_BATCH,text:row.rawText,records,
    stats:{records:records.length,rollCalls:records.filter(r=>r.method==='roll_call').length,
      withNames:records.filter(r=>r.memberVotes.length>0).length,
      namesMismatchTally:records.filter(r=>r.namesMatchTally===false).length},
  };
}
type Connection=Pick<Client|PoolClient,'query'>;
// Preserve existing source versions and every sibling metadata key. Existing
// raw captures are never overwritten, even if a future parser changes.
export const INSERT_RECOVERED_MINUTE_SQL=`
  INSERT INTO source_documents (jurisdiction_id,session_id,chamber_id,source_kind,
    source_url,content_sha256,http_status,metadata)
  SELECT j.id,s.id,c.id,'senate_committee_minutes_pdf',$1,$2,200,
    jsonb_build_object('rawPrepassageVotes',$3::jsonb)
  FROM jurisdictions j
  JOIN legislative_sessions s ON s.jurisdiction_id=j.id AND s.slug=$4
  JOIN chambers c ON c.jurisdiction_id=j.id AND c.slug='senate'
  WHERE j.slug='us-mn'
  ON CONFLICT (source_url,content_sha256) DO UPDATE SET
    metadata=jsonb_set(source_documents.metadata,'{rawPrepassageVotes}',$3::jsonb,true)
  WHERE NOT (source_documents.metadata ? 'rawPrepassageVotes')
  RETURNING id`;

export async function importRecoveredMinutes(client:Connection,corpus:MinuteRecoveryCorpus){
  validateMinuteRecoveryCorpus(corpus);
  let changed=0;
  for(const row of corpus.documents){
    const payload=minuteRawPayload(row);
    const saved=await client.query(INSERT_RECOVERED_MINUTE_SQL,
      [row.sourceUrl,row.contentSha256,JSON.stringify(payload),payload.sessionSlug]);
    changed+=saved.rowCount??0;
  }
  return {changed,...await readRecoveredMinutes(client,corpus)};
}
export async function readRecoveredMinutes(client:Connection,corpus:MinuteRecoveryCorpus){
  const saved=await client.query<{source_url:string;content_sha256:string;raw:{text?:string;stats?:{records?:number}}}>(
    `SELECT source_url,content_sha256,metadata->'rawPrepassageVotes' AS raw
     FROM source_documents WHERE source_url=ANY($1::text[]) LIMIT 100`,
    [corpus.documents.map(r=>r.sourceUrl)]);
  let matching=0,records=0;
  for(const row of corpus.documents){
    const match=saved.rows.filter(s=>s.source_url===row.sourceUrl&&
      s.content_sha256===row.contentSha256&&s.raw?.text===row.rawText);
    if(match.length===1){matching++;records+=match[0]!.raw.stats?.records??0;}
  }
  return {matching,expected:corpus.documents.length,rawRecords:records};
}
