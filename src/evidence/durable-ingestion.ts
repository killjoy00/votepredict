import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '@/lib/db';

export type DurableEvidenceKind = 'direct_statement' | 'related_statement' | 'fact' | 'context' | 'inference';
export type DurableEvidenceStance = 'supports' | 'opposes' | 'mixed' | 'neutral' | 'unclear';
export type DurableEvidenceSourceQuality = 'official' | 'member_primary' | 'reputable_secondary' | 'other' | 'unknown';
export type DurableEvidenceRelevance = 'direct' | 'high' | 'medium' | 'low';
export type DurableEvidenceFreshness = 'current' | 'recent' | 'stale' | 'unknown';

export interface DurableSourceDescriptor {
  sourceKind: string;
  sourceUrl: string;
  contentSha256: string;
  jurisdictionSlug?: string;
  sessionSlug?: string;
  chamberSlug?: string;
  fetchedAt?: string;
  httpStatus?: number;
  metadata?: Record<string, unknown>;
}

export interface DurableEvidenceTarget {
  membershipId?: string;
  memberName?: string;
  legislatorExternalKey?: string;
  billId?: string;
  billIdentifier?: string;
  sessionSlug?: string;
  chamberSlug?: string;
  occurredOn?: string;
}

export interface DurableEvidenceDraft {
  target?: DurableEvidenceTarget;
  kind: DurableEvidenceKind;
  stance?: DurableEvidenceStance;
  claim: string;
  excerpt?: string;
  publishedAt?: string;
  sourceQuality: DurableEvidenceSourceQuality;
  relevance: DurableEvidenceRelevance;
  freshness: DurableEvidenceFreshness;
  extractionMethod: string;
  extractionVersion?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface DurableEvidencePersistResult {
  sourceDocumentId: string;
  evidenceItemIds: string[];
  inserted: number;
  reused: number;
  supersessionRelationships: number;
  unresolvedTargets: Array<{ claim: string; reason: string }>;
}

function requiredDate(value: string | undefined, label: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date/time`);
  return date;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function evidenceIngestionKey(input: {
  sourceUrl: string;
  contentSha256: string;
  membershipId?: string;
  billId?: string;
  draft: DurableEvidenceDraft;
}): string {
  return sha256(stableJson({
    sourceUrl: input.sourceUrl,
    contentSha256: input.contentSha256,
    membershipId: input.membershipId ?? null,
    billId: input.billId ?? null,
    kind: input.draft.kind,
    stance: input.draft.stance ?? null,
    claim: input.draft.claim,
    publishedAt: input.draft.publishedAt ?? null,
    extractionMethod: input.draft.extractionMethod,
    extractionVersion: input.draft.extractionVersion ?? null,
  }));
}

export function evidenceSeriesKey(input: {
  membershipId?: string;
  billId?: string;
  draft: DurableEvidenceDraft;
}): string | undefined {
  const explicit = input.draft.metadata?.evidenceSeriesKey;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();

  if (input.draft.metadata?.contextType !== 'campaign_finance' || !input.membershipId) return undefined;
  const subtype = input.draft.metadata?.subtype;
  if (typeof subtype !== 'string' || !subtype.trim()) return undefined;
  const cycleYears = Array.isArray(input.draft.metadata?.cycleYears)
    ? input.draft.metadata.cycleYears
        .map((year) => typeof year === 'number' || typeof year === 'string' ? String(year).trim() : '')
        .filter(Boolean)
        .sort()
        .join('-')
    : 'unknown';
  return `campaign_finance:${subtype.trim()}:membership:${input.membershipId}:cycle:${cycleYears || 'unknown'}`;
}

async function scalarId(client: PoolClient, sql: string, values: unknown[], label: string): Promise<string> {
  const result = await client.query<{ id: string }>(sql, values);
  if (result.rows.length !== 1) throw new Error(`${label} could not be resolved uniquely`);
  return result.rows[0].id;
}

async function resolveSourceScope(client: PoolClient, source: DurableSourceDescriptor) {
  const jurisdictionId = await scalarId(
    client,
    `SELECT id::text FROM jurisdictions WHERE slug = $1`,
    [source.jurisdictionSlug ?? 'us-mn'],
    `Jurisdiction ${source.jurisdictionSlug ?? 'us-mn'}`,
  );
  const sessionId = source.sessionSlug
    ? await scalarId(client, `SELECT id::text FROM legislative_sessions WHERE jurisdiction_id = $1 AND slug = $2`, [jurisdictionId, source.sessionSlug], `Session ${source.sessionSlug}`)
    : null;
  const chamberId = source.chamberSlug
    ? await scalarId(client, `SELECT id::text FROM chambers WHERE jurisdiction_id = $1 AND slug = $2`, [jurisdictionId, source.chamberSlug], `Chamber ${source.chamberSlug}`)
    : null;
  return { jurisdictionId, sessionId, chamberId };
}

async function resolveMembership(
  client: PoolClient,
  target: DurableEvidenceTarget | undefined,
  publishedAt?: string,
): Promise<string | null> {
  if (!target) return null;
  if (target.membershipId) {
    return scalarId(client, `SELECT id::text FROM memberships WHERE id = $1::uuid`, [target.membershipId], `Membership ${target.membershipId}`);
  }
  if (!target.memberName && !target.legislatorExternalKey) return null;
  const occurredOn = target.occurredOn ?? publishedAt;
  const result = await client.query<{ id: string }>(`
    SELECT m.id::text
      FROM memberships m
      JOIN legislators l ON l.id = m.legislator_id
      JOIN legislative_sessions s ON s.id = m.session_id
      JOIN chambers c ON c.id = m.chamber_id
     WHERE ($1::text IS NULL OR lower(l.name) = lower($1))
       AND ($2::text IS NULL OR l.external_key = $2)
       AND ($3::text IS NULL OR s.slug = $3)
       AND ($4::text IS NULL OR c.slug = $4)
       AND ($5::date IS NULL OR (
         (m.starts_on IS NULL OR m.starts_on <= $5::date)
         AND (m.ends_on IS NULL OR m.ends_on >= $5::date)
         AND (s.starts_on IS NULL OR s.starts_on <= $5::date)
         AND (s.ends_on IS NULL OR s.ends_on >= $5::date)
       ))
     ORDER BY s.starts_on DESC NULLS LAST, m.starts_on DESC NULLS LAST
     LIMIT 2`, [
    target.memberName ?? null,
    target.legislatorExternalKey ?? null,
    target.sessionSlug ?? null,
    target.chamberSlug ?? null,
    occurredOn ?? null,
  ]);
  return result.rows.length === 1 ? result.rows[0].id : null;
}

async function resolveBill(client: PoolClient, target: DurableEvidenceTarget | undefined): Promise<string | null> {
  if (!target) return null;
  if (target.billId) return scalarId(client, `SELECT id::text FROM bills WHERE id = $1::uuid`, [target.billId], `Bill ${target.billId}`);
  if (!target.billIdentifier) return null;
  const result = await client.query<{ id: string }>(`
    SELECT b.id::text
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
     WHERE upper(b.identifier) = upper($1)
       AND ($2::text IS NULL OR s.slug = $2)
     ORDER BY s.starts_on DESC NULLS LAST
     LIMIT 2`, [target.billIdentifier, target.sessionSlug ?? null]);
  return result.rows.length === 1 ? result.rows[0].id : null;
}

async function persistSourceDocument(client: PoolClient, source: DurableSourceDescriptor): Promise<string> {
  if (!/^https?:\/\//i.test(source.sourceUrl)) throw new Error(`Evidence source must be HTTP(S): ${source.sourceUrl}`);
  if (!/^[a-f0-9]{64}$/i.test(source.contentSha256)) throw new Error(`Invalid SHA-256 for ${source.sourceUrl}`);
  const fetchedAt = requiredDate(source.fetchedAt, 'fetchedAt') ?? new Date();
  const { jurisdictionId, sessionId, chamberId } = await resolveSourceScope(client, source);
  const result = await client.query<{ id: string }>(`
    INSERT INTO source_documents (
      jurisdiction_id, session_id, chamber_id, source_kind, source_url,
      fetched_at, content_sha256, http_status, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
    ON CONFLICT (source_url, content_sha256)
    DO UPDATE SET metadata = source_documents.metadata || EXCLUDED.metadata
    RETURNING id::text`, [
    jurisdictionId,
    sessionId,
    chamberId,
    source.sourceKind,
    source.sourceUrl,
    fetchedAt,
    source.contentSha256.toLowerCase(),
    source.httpStatus ?? 200,
    JSON.stringify(source.metadata ?? {}),
  ]);
  return result.rows[0].id;
}

async function persistSupersessionRelationships(input: {
  client: PoolClient;
  evidenceItemId: string;
  sourceDocumentId: string;
  seriesKey: string;
  membershipId: string | null;
  billId: string | null;
}): Promise<number> {
  const { client, evidenceItemId, sourceDocumentId, seriesKey, membershipId, billId } = input;
  const older = await client.query<{ id: string }>(`
    INSERT INTO evidence_relationships (from_evidence_id,to_evidence_id,relation_kind,reason)
    SELECT $1::uuid, prior.id, 'supersedes', 'Newer source snapshot in the same durable evidence series'
      FROM evidence_items prior
      JOIN source_documents prior_source ON prior_source.id = prior.source_document_id
      JOIN source_documents current_source ON current_source.id = $2::uuid
     WHERE prior.id <> $1::uuid
       AND prior.metadata->>'evidenceSeriesKey' = $3
       AND prior.membership_id IS NOT DISTINCT FROM $4::uuid
       AND prior.bill_id IS NOT DISTINCT FROM $5::uuid
       AND prior_source.fetched_at < current_source.fetched_at
       AND NOT EXISTS (
         SELECT 1 FROM evidence_relationships existing_rel
          WHERE existing_rel.to_evidence_id = prior.id
            AND existing_rel.relation_kind = 'supersedes'
       )
    ON CONFLICT DO NOTHING
    RETURNING id::text`, [evidenceItemId, sourceDocumentId, seriesKey, membershipId, billId]);

  const newer = await client.query<{ id: string }>(`
    INSERT INTO evidence_relationships (from_evidence_id,to_evidence_id,relation_kind,reason)
    SELECT newer_item.id, $1::uuid, 'supersedes', 'A newer source snapshot already exists in the same durable evidence series'
      FROM evidence_items newer_item
      JOIN source_documents newer_source ON newer_source.id = newer_item.source_document_id
      JOIN source_documents current_source ON current_source.id = $2::uuid
     WHERE newer_item.id <> $1::uuid
       AND newer_item.metadata->>'evidenceSeriesKey' = $3
       AND newer_item.membership_id IS NOT DISTINCT FROM $4::uuid
       AND newer_item.bill_id IS NOT DISTINCT FROM $5::uuid
       AND newer_source.fetched_at > current_source.fetched_at
       AND NOT EXISTS (
         SELECT 1 FROM evidence_relationships existing_rel
          WHERE existing_rel.to_evidence_id = newer_item.id
            AND existing_rel.relation_kind = 'supersedes'
       )
    ON CONFLICT DO NOTHING
    RETURNING id::text`, [evidenceItemId, sourceDocumentId, seriesKey, membershipId, billId]);

  return (older.rowCount ?? 0) + (newer.rowCount ?? 0);
}

export async function persistDurableEvidence(
  source: DurableSourceDescriptor,
  drafts: readonly DurableEvidenceDraft[],
): Promise<DurableEvidencePersistResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sourceDocumentId = await persistSourceDocument(client, source);
    const evidenceItemIds: string[] = [];
    const unresolvedTargets: Array<{ claim: string; reason: string }> = [];
    let inserted = 0;
    let reused = 0;
    let supersessionRelationships = 0;

    for (const draft of drafts) {
      const membershipId = await resolveMembership(client, draft.target, draft.publishedAt);
      const billId = await resolveBill(client, draft.target);
      if ((draft.target?.memberName || draft.target?.legislatorExternalKey) && !membershipId) {
        const identity = draft.target.legislatorExternalKey ?? draft.target.memberName ?? 'unknown';
        unresolvedTargets.push({ claim: draft.claim, reason: `membership:${identity}` });
        continue;
      }
      if (draft.target?.billIdentifier && !billId) {
        unresolvedTargets.push({ claim: draft.claim, reason: `bill:${draft.target.billIdentifier}` });
        continue;
      }
      const key = evidenceIngestionKey({ sourceUrl: source.sourceUrl, contentSha256: source.contentSha256, membershipId: membershipId ?? undefined, billId: billId ?? undefined, draft });
      const seriesKey = evidenceSeriesKey({ membershipId: membershipId ?? undefined, billId: billId ?? undefined, draft });
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [seriesKey ? `series:${seriesKey}` : `item:${key}`]);
      const existing = await client.query<{ id: string }>(`SELECT id::text FROM evidence_items WHERE metadata->>'ingestionKey' = $1 LIMIT 1`, [key]);
      if (existing.rows[0]) {
        if (seriesKey) {
          await client.query(`
            UPDATE evidence_items
               SET metadata = metadata || jsonb_build_object('evidenceSeriesKey',$2::text)
             WHERE id = $1::uuid
               AND metadata->>'evidenceSeriesKey' IS DISTINCT FROM $2`, [existing.rows[0].id, seriesKey]);
        }
        evidenceItemIds.push(existing.rows[0].id);
        reused += 1;
        continue;
      }
      const publishedAt = requiredDate(draft.publishedAt, 'publishedAt') ?? null;
      const metadata = {
        ...(draft.metadata ?? {}),
        ...(seriesKey ? { evidenceSeriesKey: seriesKey } : {}),
        ingestionKey: key,
        durableIngestion: true,
      };
      const result = await client.query<{ id: string }>(`
        INSERT INTO evidence_items (
          source_document_id, bill_id, membership_id, evidence_kind, stance, claim, excerpt,
          published_at, source_quality, relevance, freshness, extraction_method,
          extraction_version, confidence, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
        RETURNING id::text`, [
        sourceDocumentId,
        billId,
        membershipId,
        draft.kind,
        draft.stance ?? null,
        draft.claim,
        draft.excerpt ?? null,
        publishedAt,
        draft.sourceQuality,
        draft.relevance,
        draft.freshness,
        draft.extractionMethod,
        draft.extractionVersion ?? null,
        draft.confidence ?? null,
        JSON.stringify(metadata),
      ]);
      evidenceItemIds.push(result.rows[0].id);
      inserted += 1;
      if (seriesKey) {
        supersessionRelationships += await persistSupersessionRelationships({
          client,
          evidenceItemId: result.rows[0].id,
          sourceDocumentId,
          seriesKey,
          membershipId,
          billId,
        });
      }
    }

    await client.query('COMMIT');
    return { sourceDocumentId, evidenceItemIds, inserted, reused, supersessionRelationships, unresolvedTargets };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
