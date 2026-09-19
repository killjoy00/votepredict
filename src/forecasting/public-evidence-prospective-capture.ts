import { pool } from '@/lib/db';
import type { ForecastRuntimeRequest, ForecastRuntimeResult } from './runtime';

export const PUBLIC_EVIDENCE_PROSPECTIVE_EXPERIMENT = 'public-evidence-prospective-v1' as const;
export const PUBLIC_EVIDENCE_PROSPECTIVE_SESSION = '2027-2028' as const;
export const PUBLIC_EVIDENCE_PROSPECTIVE_MODEL_VERSION = 'member-eb-v1.2-decay180' as const;

type EvidenceAggregateRow = {
  membership_id: string;
  total_items: number;
  campaign_finance_items: number;
  campaign_site_items: number;
  member_primary_items: number;
  news_items: number;
  curated_items: number;
  source_kinds: number;
  newest_fetched_at: string | null;
};

export interface PublicEvidenceProspectiveSnapshot {
  kind: 'prospective_public_evidence_snapshot';
  experiment: typeof PUBLIC_EVIDENCE_PROSPECTIVE_EXPERIMENT;
  capturedAt: string;
  servesTraffic: false;
  outcomeUseAtCapture: 'none';
  mechanicallyActionable: false;
  totalItems: number;
  sourceKinds: number;
  campaignFinanceItems: number;
  campaignSiteItems: number;
  memberPrimaryItems: number;
  newsItems: number;
  curatedItems: number;
  hasAnyWebEvidence: boolean;
  newestFetchedAt: string | null;
  newestEvidenceAgeDays: number | null;
}

export interface PublicEvidenceProspectiveCaptureResult {
  experiment: typeof PUBLIC_EVIDENCE_PROSPECTIVE_EXPERIMENT;
  revisionId: string;
  capturedMembers: number;
  membersWithAnyWebEvidence: number;
  membersWithNews: number;
  membersWithMemberPrimary: number;
  servesTraffic: false;
}

export function shouldCapturePublicEvidenceProspectiveSnapshot(scope: {
  sessionSlug: string;
  chamberSlug: string;
  researchMode: string;
  modelVersion: string;
}): boolean {
  return scope.sessionSlug === PUBLIC_EVIDENCE_PROSPECTIVE_SESSION
    && scope.researchMode === 'quick'
    && scope.modelVersion === PUBLIC_EVIDENCE_PROSPECTIVE_MODEL_VERSION
    && (scope.chamberSlug === 'house' || scope.chamberSlug === 'senate');
}

function count(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildPublicEvidenceProspectiveSnapshot(
  row: EvidenceAggregateRow | undefined,
  capturedAt: string,
): PublicEvidenceProspectiveSnapshot {
  const campaignSiteItems = count(row?.campaign_site_items);
  const memberPrimaryItems = count(row?.member_primary_items);
  const newsItems = count(row?.news_items);
  const newestFetchedAt = row?.newest_fetched_at ?? null;
  let newestEvidenceAgeDays: number | null = null;
  if (newestFetchedAt) {
    const ageMs = new Date(capturedAt).getTime() - new Date(newestFetchedAt).getTime();
    newestEvidenceAgeDays = Number.isFinite(ageMs) ? Math.max(0, ageMs / 86_400_000) : null;
  }
  return {
    kind: 'prospective_public_evidence_snapshot',
    experiment: PUBLIC_EVIDENCE_PROSPECTIVE_EXPERIMENT,
    capturedAt,
    servesTraffic: false,
    outcomeUseAtCapture: 'none',
    mechanicallyActionable: false,
    totalItems: count(row?.total_items),
    sourceKinds: count(row?.source_kinds),
    campaignFinanceItems: count(row?.campaign_finance_items),
    campaignSiteItems,
    memberPrimaryItems,
    newsItems,
    curatedItems: count(row?.curated_items),
    hasAnyWebEvidence: campaignSiteItems + memberPrimaryItems + newsItems > 0,
    newestFetchedAt,
    newestEvidenceAgeDays,
  };
}

export async function capturePublicEvidenceProspectiveSnapshot(
  request: ForecastRuntimeRequest,
  quick: ForecastRuntimeResult,
): Promise<PublicEvidenceProspectiveCaptureResult | undefined> {
  if (request.subject.kind !== 'bill') return undefined;
  if (!shouldCapturePublicEvidenceProspectiveSnapshot({
    sessionSlug: request.subject.sessionSlug,
    chamberSlug: request.chamberSlug,
    researchMode: request.researchMode,
    modelVersion: quick.modelVersion,
  })) return undefined;
  if (quick.researchMode !== 'quick') throw new Error('Public-evidence prospective capture requires a Quick runtime result');
  if (quick.forecastId !== request.forecastId || quick.chamber.id !== request.chamberId) {
    throw new Error('Public-evidence prospective capture request/result lineage mismatch');
  }

  const membershipIds = quick.members.map((member) => member.membershipId);
  if (membershipIds.length === 0) {
    return {
      experiment: PUBLIC_EVIDENCE_PROSPECTIVE_EXPERIMENT,
      revisionId: quick.revisionId,
      capturedMembers: 0,
      membersWithAnyWebEvidence: 0,
      membersWithNews: 0,
      membersWithMemberPrimary: 0,
      servesTraffic: false,
    };
  }

  const evidence = await pool.query<EvidenceAggregateRow>(`
    WITH current_evidence AS (
      SELECT ei.membership_id,
             ei.metadata,
             sd.source_kind,
             sd.fetched_at
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
       WHERE ei.membership_id = ANY($1::uuid[])
         AND sd.fetched_at <= $2::timestamptz
         AND NOT EXISTS (
           SELECT 1
             FROM evidence_relationships er
            WHERE er.to_evidence_id=ei.id
              AND er.relation_kind='supersedes'
         )
    )
    SELECT membership_id::text,
           count(*)::int AS total_items,
           count(*) FILTER (WHERE source_kind='campaign_finance_bulk')::int AS campaign_finance_items,
           count(*) FILTER (WHERE source_kind IN ('campaign_site','campaign_site_registry'))::int AS campaign_site_items,
           count(*) FILTER (WHERE source_kind IN ('member_primary_article','member_primary_registry'))::int AS member_primary_items,
           count(*) FILTER (WHERE source_kind='public_news_article')::int AS news_items,
           count(*) FILTER (
             WHERE source_kind IN (
               'member_statement',
               'official_news',
               'interest_group_position',
               'official_member_profile',
               'official_committee_roster'
             )
           )::int AS curated_items,
           count(DISTINCT source_kind)::int AS source_kinds,
           max(fetched_at)::text AS newest_fetched_at
      FROM current_evidence
     GROUP BY membership_id`, [membershipIds, quick.asOf]);

  const aggregateByMembership = new Map(evidence.rows.map((row) => [row.membership_id, row]));
  const snapshots = quick.members.map((member) => ({
    membershipId: member.membershipId,
    snapshot: buildPublicEvidenceProspectiveSnapshot(aggregateByMembership.get(member.membershipId), quick.asOf),
  }));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let updated = 0;
    for (const row of snapshots) {
      const result = await client.query(`
        UPDATE forecast_member_predictions
           SET context = COALESCE(context, '[]'::jsonb) || $3::jsonb
         WHERE revision_id = $1
           AND membership_id = $2
           AND NOT (COALESCE(context, '[]'::jsonb) @> $4::jsonb)`, [
        quick.revisionId,
        row.membershipId,
        JSON.stringify([row.snapshot]),
        JSON.stringify([{ experiment: PUBLIC_EVIDENCE_PROSPECTIVE_EXPERIMENT }]),
      ]);
      updated += result.rowCount ?? 0;
    }
    if (updated !== snapshots.length) {
      throw new Error(`Public-evidence prospective capture updated ${updated}/${snapshots.length} member rows`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    experiment: PUBLIC_EVIDENCE_PROSPECTIVE_EXPERIMENT,
    revisionId: quick.revisionId,
    capturedMembers: snapshots.length,
    membersWithAnyWebEvidence: snapshots.filter((row) => row.snapshot.hasAnyWebEvidence).length,
    membersWithNews: snapshots.filter((row) => row.snapshot.newsItems > 0).length,
    membersWithMemberPrimary: snapshots.filter((row) => row.snapshot.memberPrimaryItems > 0).length,
    servesTraffic: false,
  };
}
