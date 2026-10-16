/** Insert-only raw statement storage. Re-fetches do not rewrite old text. */
import type { Pool } from 'pg';
import type { RawSenateStatement, StatementSink } from '../sources/minnesota/senate-press-raw.js';

export class SenatePressRawStore implements StatementSink {
  constructor(private readonly pool: Pool) {}
  async existing(urls: string[]): Promise<ReadonlySet<string>> {
    if (!urls.length) return new Set<string>();
    const found = await this.pool.query<{ source_url: string }>(
      'SELECT source_url FROM senate_raw_statements WHERE source_url = ANY($1::text[])', [urls],
    );
    return new Set(found.rows.map((row) => row.source_url));
  }
  async insert(item: RawSenateStatement): Promise<boolean> {
    const result = await this.pool.query(
      'INSERT INTO senate_raw_statements ' +
      '(source_id, source_type, source_url, fetched_at, published_on, title, named_senators, bill_identifiers, raw_text) ' +
      'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (source_url) DO NOTHING',
      [item.source_id, item.source_type, item.source_url, item.fetched_at,
        item.published_on, item.title, item.named_senators, item.bill_identifiers, item.raw_text],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
