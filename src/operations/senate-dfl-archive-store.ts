/** Original URL insert-only raw text plus atomic independent archive provenance. */
import type {Pool} from 'pg';
import type {ArchivedDFLStatement} from '../sources/minnesota/senate-dfl-wayback.js';

export class ArchivedSenateDFLStore{
  constructor(private readonly pool:Pool){}
  async existing(urls:string[]):Promise<ReadonlySet<string>>{
    if(!urls.length)return new Set<string>();
    if(urls.length>100)throw Error('Oversized archive existence query');
    const rows=await this.pool.query<{source_url:string}>(
      'SELECT source_url FROM senate_raw_statements WHERE source_url = ANY($1::text[])',[urls]);
    return new Set(rows.rows.map(x=>x.source_url));
  }
  async insert(source:ArchivedDFLStatement):Promise<boolean>{
    const {item,capturedAt,archiveUrl,archiveDigest,bodySha256}=source;
    if(item.source_id!=='senate_dfl'||
      item.source_type!=='senate_dfl_caucus_and_members'||
      !/^https:\/\/senatedfl\.mn\/[a-z0-9-]+\/$/.test(item.source_url)||
      !item.published_on||item.published_on<'2023-01-01'||item.published_on>'2025-12-31'||
      !archiveUrl.startsWith('https://web.archive.org/web/')||
      !Number.isFinite(Date.parse(capturedAt))||
      capturedAt.slice(0,10)<item.published_on||
      item.raw_text.length<100||
      !/^[A-Z2-7]{20,64}$/.test(archiveDigest)||
      !/^[0-9a-f]{64}$/.test(bodySha256))
      throw Error('Archived Senate DFL source provenance failed insert-only validation');
    const result=await this.pool.query(
      'WITH inserted AS ('+
      ' INSERT INTO senate_raw_statements '+
      ' (source_id,source_type,source_url,fetched_at,published_on,title,named_senators,bill_identifiers,raw_text) '+
      ' VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) '+
      ' ON CONFLICT(source_url) DO NOTHING RETURNING source_url'+
      ') INSERT INTO senate_raw_statement_archive_captures '+
      ' (source_url,archive_provider,archive_snapshot_url,captured_at,archive_digest,body_sha256) '+
      ' SELECT source_url,$10,$11,$12,$13,$14 FROM inserted '+
      ' ON CONFLICT(source_url) DO NOTHING',
      [item.source_id,item.source_type,item.source_url,item.fetched_at,item.published_on,
        item.title,item.named_senators,item.bill_identifiers,item.raw_text,
        'internet_archive',archiveUrl,capturedAt,archiveDigest,bodySha256],
    );
    return (result.rowCount??0)===1;
  }
}
