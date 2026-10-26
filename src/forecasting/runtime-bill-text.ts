import type { Pool, PoolClient } from 'pg';
import { createHash } from 'node:crypto';

export interface RetainedTargetText {
  id: string;
  billVersionId?: string;
  versionKey: string;
  publishedAt: string;
  observedAt: string;
  text: string;
  textSha256: string;
  sourceUrl: string;
  title?: string;
}

export async function retainedTargetTextAsOf(db: Pick<Pool, 'query'>, billId: string, asOf: string): Promise<RetainedTargetText | undefined> {
  if (!Number.isFinite(Date.parse(asOf))) throw new Error('Invalid bill-text cutoff');
  const result = await db.query<{
    id: string; bill_version_id: string | null; version_key: string; published_at: string;
    observed_at: string; raw_text: string; text_sha256: string; source_url: string; title: string | null;
  }>(`
    SELECT * FROM (
      SELECT 'observation:'||o.id::text AS id,o.bill_version_id,o.version_key,
        o.claimed_published_at::text AS published_at,o.observed_at::text,
        convert_from(b.body,'UTF8') AS raw_text,o.text_sha256::text,o.source_url,o.title
      FROM forecast_bill_text_observations o JOIN evidence_content_blobs b ON b.sha256=o.text_sha256
      WHERE o.bill_id=$1 AND o.observed_at < $2::timestamptz
        AND o.claimed_published_at < $2::timestamptz
      UNION ALL
      SELECT 'raw-capture:'||c.id::text,NULL::uuid,c.source_locator,
        LEAST(c.archived_observed_at,c.fetched_at)::text,
        LEAST(c.archived_observed_at,c.fetched_at)::text,
        c.raw_text,encode(sha256(convert_to(c.raw_text,'UTF8')),'hex'),c.source_url,NULL::text
      FROM senate_official_bill_text_captures c
      WHERE c.bill_id=$1 AND LEAST(c.archived_observed_at,c.fetched_at) < $2::timestamptz
    ) retained WHERE length(raw_text)>=100
    ORDER BY observed_at::timestamptz DESC,id LIMIT 1`, [billId, asOf]);
  const row = result.rows[0];
  if (!row) return undefined;
  if (createHash('sha256').update(row.raw_text).digest('hex') !== row.text_sha256) throw new Error('Retained bill-text digest mismatch');
  return { id: row.id,billVersionId: row.bill_version_id ?? undefined,versionKey: row.version_key,
    publishedAt: row.published_at,observedAt: row.observed_at,text: row.raw_text,textSha256: row.text_sha256,sourceUrl: row.source_url,title: row.title ?? undefined };
}

export async function retainRuntimeBillText(client: PoolClient, input: {
  billId: string; billVersionId: string; versionKey: string; sourceUrl: string;
  claimedPublishedAt: string; observedAt: string; text: string; title?: string;
}): Promise<RetainedTargetText> {
  const digest=createHash('sha256').update(input.text).digest('hex');
  await client.query(`INSERT INTO evidence_content_blobs(sha256,body,media_type)
    VALUES($1,$2,'text/plain; charset=utf-8') ON CONFLICT(sha256) DO NOTHING`,[digest,Buffer.from(input.text)]);
  const row=(await client.query<{id:string}>(`INSERT INTO forecast_bill_text_observations
    (bill_id,bill_version_id,version_key,source_url,text_sha256,claimed_published_at,observed_at,title)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text`,[input.billId,input.billVersionId,input.versionKey,input.sourceUrl,digest,input.claimedPublishedAt,input.observedAt,input.title ?? null])).rows[0];
  return { id:'observation:'+row.id,billVersionId:input.billVersionId,versionKey:input.versionKey,
    sourceUrl:input.sourceUrl,text:input.text,textSha256:digest,publishedAt:input.claimedPublishedAt,observedAt:input.observedAt,title:input.title };
}
