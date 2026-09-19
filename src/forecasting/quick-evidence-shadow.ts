import { pool } from '@/lib/db';
import { evidenceLogitDelta, EVIDENCE_IMPACT_VERSION } from '@/evidence/impact';
import { evidenceImpactPolicy } from '@/evidence/policy';
import type { EvidenceDraft, EvidenceSignal } from '@/evidence/types';
import {
  authorshipAvailableAt,
  authorshipMembershipIdsAsOf,
  type StoredRevisorAuthorship,
} from './quick-evidence-authorship';
import type { ForecastRuntimeRequest, ForecastRuntimeResult } from './runtime';

export const QUICK_EVIDENCE_SHADOW_VERSION = 'quick-evidence-v1' as const;
export const QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT = 'quick-evidence-prospective-v1' as const;
export const QUICK_EVIDENCE_PROSPECTIVE_SESSION = '2027-2028' as const;
export const QUICK_EVIDENCE_BASE_MODEL_VERSION = 'member-eb-v1.2-decay180' as const;
export const QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA = 1 as const;

export type QuickEvidenceStoredRow = {
  id: string;
  membership_id: string;
  evidence_kind: EvidenceSignal['kind'];
  stance: EvidenceSignal['stance'];
  source_quality: EvidenceSignal['sourceQuality'];
  relevance: EvidenceSignal['relevance'];
  freshness: EvidenceSignal['freshness'];
  confidence: number | null;
  published_at: string | null;
  source_kind: string;
  fetched_at: string;
  metadata: Record<string, unknown> | null;
};

export type QuickEvidenceAvailabilityRow = {
  membership_id: string;
  total_items: number;
  campaign_finance_items: number;
  campaign_site_items: number;
  member_primary_items: number;
  news_items: number;
  source_kinds: number;
  newest_fetched_at: string | null;
};

export type QuickEvidencePriorVoteRow = {
  membership_id: string;
  same_yes: number;
  same_no: number;
  companion_yes: number;
  companion_no: number;
  same_amendment_yes: number;
  same_amendment_no: number;
  same_motion_procedural_yes: number;
  same_motion_procedural_no: number;
  same_other_yes: number;
  same_other_no: number;
};

export interface QuickEvidenceFeatureVector {
  directSupport: number;
  directOppose: number;
  relatedSupport: number;
  relatedOppose: number;
  officialFactSupport: number;
  officialFactOppose: number;
  priorSameBillYes: number;
  priorSameBillNo: number;
  priorCompanionYes: number;
  priorCompanionNo: number;
  priorSameBillAmendmentYes: number;
  priorSameBillAmendmentNo: number;
  priorSameBillMotionProceduralYes: number;
  priorSameBillMotionProceduralNo: number;
  priorSameBillOtherYes: number;
  priorSameBillOtherNo: number;
  billAuthor: boolean;
  authorshipAvailable: boolean;
  candidateEvidenceItems: number;
  conflictingDirectionalEvidence: boolean;
  totalEvidenceItems: number;
  sourceKinds: number;
  campaignFinanceItems: number;
  campaignSiteItems: number;
  memberPrimaryItems: number;
  newsItems: number;
  newestFetchedAt: string | null;
  newestEvidenceAgeDays: number | null;
}

export interface QuickEvidenceMemberShadow {
  kind: 'quick_evidence_shadow';
  version: typeof QUICK_EVIDENCE_SHADOW_VERSION;
  impactVersion: typeof EVIDENCE_IMPACT_VERSION;
  experiment?: typeof QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT;
  servesTraffic: false;
  outcomeUseAtCapture: 'none';
  capturedAt: string;
  baseProbability: number | null;
  candidateProbability: number | null;
  uncappedLogitDelta: number;
  appliedLogitDelta: number;
  appliedEvidenceItems: number;
  features: QuickEvidenceFeatureVector;
}

export interface QuickEvidenceCaptureResult {
  version: typeof QUICK_EVIDENCE_SHADOW_VERSION;
  revisionId: string;
  capturedMembers: number;
  changedMembers: number;
  membersWithDirectionalEvidence: number;
  membersWithPriorBillVotes: number;
  prospectiveEligible: boolean;
  servesTraffic: false;
}

function clampProbability(value: number): number {
  return Math.min(0.995, Math.max(0.005, value));
}

function logit(probability: number): number {
  const p = clampProbability(probability);
  return Math.log(p / (1 - p));
}

function logistic(value: number): number {
  return clampProbability(1 / (1 + Math.exp(-value)));
}

function count(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function candidateDecision(draft: EvidenceDraft): boolean {
  if (draft.metadata?.quickEvidenceCandidate === true) {
    if (draft.metadata?.sourceVerified !== true) return false;
    if (draft.metadata?.afterAsOf === true || draft.metadata?.publishedAtInvalid === true) return false;
    if (!['supports', 'opposes'].includes(draft.stance)) return false;
    if (!['direct_statement', 'related_statement', 'fact'].includes(draft.kind)) return false;
    if (!['official', 'member_primary', 'reputable_secondary'].includes(draft.sourceQuality)) return false;
    if (draft.relevance === 'low') return false;
    const minimumConfidence = draft.kind === 'direct_statement' ? 0.9 : 0.8;
    return (draft.confidence ?? 0) >= minimumConfidence;
  }
  return evidenceImpactPolicy(draft).mechanicallyActionable;
}

function rowDraft(row: QuickEvidenceStoredRow): EvidenceDraft {
  return {
    sourceUrl: 'stored://quick-evidence',
    publishedAt: row.published_at ?? undefined,
    kind: row.evidence_kind,
    stance: row.stance,
    claim: 'Stored bill-specific evidence',
    sourceQuality: row.source_quality,
    relevance: row.relevance,
    freshness: row.freshness,
    confidence: row.confidence ?? undefined,
    targetMembershipId: row.membership_id,
    metadata: row.metadata ?? {},
  };
}

function rowSignal(row: QuickEvidenceStoredRow): EvidenceSignal {
  return {
    evidenceId: row.id,
    kind: row.evidence_kind,
    stance: row.stance,
    sourceQuality: row.source_quality,
    relevance: row.relevance,
    freshness: row.freshness,
    confidence: row.confidence ?? undefined,
  };
}

function priorVoteSignals(row: QuickEvidencePriorVoteRow | undefined): EvidenceSignal[] {
  if (!row) return [];
  const signals: EvidenceSignal[] = [];
  const add = (id: string, stance: 'supports' | 'opposes') => signals.push({
    evidenceId: id,
    kind: 'fact',
    stance,
    sourceQuality: 'official',
    relevance: 'direct',
    freshness: 'current',
    confidence: 1,
  });
  if (count(row.same_yes) > 0) add('prior-same-bill-yes', 'supports');
  if (count(row.same_no) > 0) add('prior-same-bill-no', 'opposes');
  if (count(row.companion_yes) > 0) add('prior-companion-bill-yes', 'supports');
  if (count(row.companion_no) > 0) add('prior-companion-bill-no', 'opposes');
  return signals;
}

export function buildQuickEvidenceFeatureVector(input: {
  evidenceRows?: readonly QuickEvidenceStoredRow[];
  availability?: QuickEvidenceAvailabilityRow;
  priorVotes?: QuickEvidencePriorVoteRow;
  billAuthor?: boolean;
  authorshipAvailable?: boolean;
  capturedAt: string;
}): QuickEvidenceFeatureVector {
  const rows = input.evidenceRows ?? [];
  const directional = rows.filter((row) => candidateDecision(rowDraft(row)));
  const prior = input.priorVotes;
  const newestFetchedAt = input.availability?.newest_fetched_at ?? null;
  const newestEvidenceAgeDays = newestFetchedAt
    ? Math.max(0, (new Date(input.capturedAt).getTime() - new Date(newestFetchedAt).getTime()) / 86_400_000)
    : null;
  const supportCount = directional.filter((row) => row.stance === 'supports').length;
  const opposeCount = directional.filter((row) => row.stance === 'opposes').length;
  return {
    directSupport: directional.filter((row) => row.evidence_kind === 'direct_statement' && row.stance === 'supports').length,
    directOppose: directional.filter((row) => row.evidence_kind === 'direct_statement' && row.stance === 'opposes').length,
    relatedSupport: directional.filter((row) => row.evidence_kind === 'related_statement' && row.stance === 'supports').length,
    relatedOppose: directional.filter((row) => row.evidence_kind === 'related_statement' && row.stance === 'opposes').length,
    officialFactSupport: directional.filter((row) => row.evidence_kind === 'fact' && row.source_quality === 'official' && row.stance === 'supports').length,
    officialFactOppose: directional.filter((row) => row.evidence_kind === 'fact' && row.source_quality === 'official' && row.stance === 'opposes').length,
    priorSameBillYes: count(prior?.same_yes),
    priorSameBillNo: count(prior?.same_no),
    priorCompanionYes: count(prior?.companion_yes),
    priorCompanionNo: count(prior?.companion_no),
    priorSameBillAmendmentYes: count(prior?.same_amendment_yes),
    priorSameBillAmendmentNo: count(prior?.same_amendment_no),
    priorSameBillMotionProceduralYes: count(prior?.same_motion_procedural_yes),
    priorSameBillMotionProceduralNo: count(prior?.same_motion_procedural_no),
    priorSameBillOtherYes: count(prior?.same_other_yes),
    priorSameBillOtherNo: count(prior?.same_other_no),
    billAuthor: input.billAuthor === true,
    authorshipAvailable: input.authorshipAvailable === true,
    candidateEvidenceItems: directional.length,
    conflictingDirectionalEvidence: supportCount > 0 && opposeCount > 0,
    totalEvidenceItems: count(input.availability?.total_items),
    sourceKinds: count(input.availability?.source_kinds),
    campaignFinanceItems: count(input.availability?.campaign_finance_items),
    campaignSiteItems: count(input.availability?.campaign_site_items),
    memberPrimaryItems: count(input.availability?.member_primary_items),
    newsItems: count(input.availability?.news_items),
    newestFetchedAt,
    newestEvidenceAgeDays: Number.isFinite(newestEvidenceAgeDays ?? Number.NaN) ? newestEvidenceAgeDays : null,
  };
}

export function buildQuickEvidenceMemberShadow(input: {
  baseProbability?: number;
  evidenceRows?: readonly QuickEvidenceStoredRow[];
  availability?: QuickEvidenceAvailabilityRow;
  priorVotes?: QuickEvidencePriorVoteRow;
  billAuthor?: boolean;
  authorshipAvailable?: boolean;
  capturedAt: string;
  prospective?: boolean;
}): QuickEvidenceMemberShadow {
  const evidenceSignals = (input.evidenceRows ?? [])
    .filter((row) => candidateDecision(rowDraft(row)))
    .map(rowSignal);
  const signals = [...evidenceSignals, ...priorVoteSignals(input.priorVotes)];
  const uncappedLogitDelta = signals.reduce((sum, signal) => sum + evidenceLogitDelta(signal), 0);
  const appliedLogitDelta = Math.max(
    -QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA,
    Math.min(QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA, uncappedLogitDelta),
  );
  const candidateProbability = input.baseProbability === undefined
    ? null
    : logistic(logit(input.baseProbability) + appliedLogitDelta);
  return {
    kind: 'quick_evidence_shadow',
    version: QUICK_EVIDENCE_SHADOW_VERSION,
    impactVersion: EVIDENCE_IMPACT_VERSION,
    ...(input.prospective ? { experiment: QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT } : {}),
    servesTraffic: false,
    outcomeUseAtCapture: 'none',
    capturedAt: input.capturedAt,
    baseProbability: input.baseProbability ?? null,
    candidateProbability,
    uncappedLogitDelta,
    appliedLogitDelta,
    appliedEvidenceItems: signals.length,
    features: buildQuickEvidenceFeatureVector({
      evidenceRows: input.evidenceRows,
      availability: input.availability,
      priorVotes: input.priorVotes,
      billAuthor: input.billAuthor,
      authorshipAvailable: input.authorshipAvailable,
      capturedAt: input.capturedAt,
    }),
  };
}

async function loadAvailability(membershipIds: readonly string[], asOf: string): Promise<Map<string, QuickEvidenceAvailabilityRow>> {
  const result = await pool.query<QuickEvidenceAvailabilityRow>(`
    WITH current_evidence AS (
      SELECT ei.membership_id, sd.source_kind, sd.fetched_at
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
       WHERE ei.membership_id = ANY($1::uuid[])
         AND sd.fetched_at <= $2::timestamptz
         AND NOT EXISTS (
           SELECT 1 FROM evidence_relationships er
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
           count(DISTINCT source_kind)::int AS source_kinds,
           max(fetched_at)::text AS newest_fetched_at
      FROM current_evidence
     GROUP BY membership_id`, [membershipIds, asOf]);
  return new Map(result.rows.map((row) => [row.membership_id, row]));
}

async function loadDirectionalEvidence(
  membershipIds: readonly string[],
  billId: string,
  asOf: string,
): Promise<Map<string, QuickEvidenceStoredRow[]>> {
  const result = await pool.query<QuickEvidenceStoredRow>(`
    SELECT ei.id::text,
           ei.membership_id::text,
           ei.evidence_kind,
           COALESCE(ei.stance,'unclear') AS stance,
           ei.source_quality,
           ei.relevance,
           ei.freshness,
           ei.confidence,
           ei.published_at::text,
           sd.source_kind,
           sd.fetched_at::text,
           ei.metadata
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
     WHERE ei.membership_id = ANY($1::uuid[])
       AND ei.bill_id = $2::uuid
       AND sd.fetched_at <= $3::timestamptz
       AND (ei.published_at IS NULL OR ei.published_at <= $3::timestamptz)
       AND NOT EXISTS (
         SELECT 1 FROM evidence_relationships er
          WHERE er.to_evidence_id=ei.id
            AND er.relation_kind='supersedes'
       )
     ORDER BY ei.membership_id, COALESCE(ei.published_at,sd.fetched_at) DESC, ei.id`, [
    membershipIds,
    billId,
    asOf,
  ]);
  const byMembership = new Map<string, QuickEvidenceStoredRow[]>();
  for (const row of result.rows) {
    const rows = byMembership.get(row.membership_id) ?? [];
    rows.push(row);
    byMembership.set(row.membership_id, rows);
  }
  return byMembership;
}

async function loadAuthorship(
  billId: string,
  asOf: string,
): Promise<{ available: boolean; membershipIds?: Set<string> }> {
  const result = await pool.query<{ authorship: StoredRevisorAuthorship | null }>(`
    SELECT metadata -> 'revisorAuthorship' AS authorship
      FROM bills
     WHERE id=$1::uuid`, [billId]);
  const authorship = result.rows[0]?.authorship ?? null;
  if (!authorship || !authorshipAvailableAt(authorship, asOf)) return { available: false };
  const membershipIds = authorshipMembershipIdsAsOf(authorship, asOf.slice(0, 10));
  return membershipIds ? { available: true, membershipIds } : { available: false };
}

async function loadPriorVotes(
  membershipIds: readonly string[],
  billId: string,
  asOf: string,
): Promise<Map<string, QuickEvidencePriorVoteRow>> {
  const result = await pool.query<QuickEvidencePriorVoteRow>(`
    WITH target_members AS (
      SELECT m.id, m.legislator_id
        FROM memberships m
       WHERE m.id = ANY($1::uuid[])
    ), target_bill AS (
      SELECT b.id, b.session_id, b.metadata #>> '{revisor,companionIdentifier}' AS companion_identifier
        FROM bills b
       WHERE b.id=$2::uuid
    ), bill_scope AS (
      SELECT id, 'same'::text AS relation FROM target_bill
      UNION ALL
      SELECT companion.id, 'companion'::text
        FROM target_bill target
        JOIN bills companion
          ON companion.session_id=target.session_id
         AND upper(companion.identifier)=upper(target.companion_identifier)
       WHERE target.companion_identifier IS NOT NULL
    )
    SELECT tm.id::text AS membership_id,
           count(*) FILTER (WHERE bs.relation='same' AND ve.is_passage=true AND mv.choice='yea')::int AS same_yes,
           count(*) FILTER (WHERE bs.relation='same' AND ve.is_passage=true AND mv.choice='nay')::int AS same_no,
           count(*) FILTER (WHERE bs.relation='companion' AND ve.is_passage=true AND mv.choice='yea')::int AS companion_yes,
           count(*) FILTER (WHERE bs.relation='companion' AND ve.is_passage=true AND mv.choice='nay')::int AS companion_no,
           count(*) FILTER (
             WHERE bs.relation='same'
               AND ve.is_passage=false
               AND ve.vote_kind='amendment'
               AND mv.choice='yea'
           )::int AS same_amendment_yes,
           count(*) FILTER (
             WHERE bs.relation='same'
               AND ve.is_passage=false
               AND ve.vote_kind='amendment'
               AND mv.choice='nay'
           )::int AS same_amendment_no,
           count(*) FILTER (
             WHERE bs.relation='same'
               AND ve.is_passage=false
               AND ve.vote_kind IN ('motion','procedural')
               AND mv.choice='yea'
           )::int AS same_motion_procedural_yes,
           count(*) FILTER (
             WHERE bs.relation='same'
               AND ve.is_passage=false
               AND ve.vote_kind IN ('motion','procedural')
               AND mv.choice='nay'
           )::int AS same_motion_procedural_no,
           count(*) FILTER (
             WHERE bs.relation='same'
               AND ve.is_passage=false
               AND ve.vote_kind='other'
               AND mv.choice='yea'
           )::int AS same_other_yes,
           count(*) FILTER (
             WHERE bs.relation='same'
               AND ve.is_passage=false
               AND ve.vote_kind='other'
               AND mv.choice='nay'
           )::int AS same_other_no
      FROM target_members tm
      LEFT JOIN memberships prior_m ON prior_m.legislator_id=tm.legislator_id
      LEFT JOIN member_votes mv ON mv.membership_id=prior_m.id AND mv.choice IN ('yea','nay')
      LEFT JOIN vote_events ve
        ON ve.id=mv.vote_event_id
       AND ve.occurred_on < $3::timestamptz::date
      LEFT JOIN bill_scope bs ON bs.id=ve.bill_id
     GROUP BY tm.id`, [membershipIds, billId, asOf]);
  return new Map(result.rows.map((row) => [row.membership_id, row]));
}

export async function captureQuickEvidenceShadow(
  request: ForecastRuntimeRequest,
  quick: ForecastRuntimeResult,
): Promise<QuickEvidenceCaptureResult | undefined> {
  if (request.subject.kind !== 'bill') return undefined;
  if (quick.researchMode !== 'quick') return undefined;
  if (quick.modelVersion !== QUICK_EVIDENCE_BASE_MODEL_VERSION) return undefined;
  if (quick.forecastId !== request.forecastId || quick.chamber.id !== request.chamberId) {
    throw new Error('Quick Evidence request/result lineage mismatch');
  }

  const membershipIds = quick.members.map((member) => member.membershipId);
  const prospectiveEligible = request.subject.sessionSlug === QUICK_EVIDENCE_PROSPECTIVE_SESSION;
  const [availability, evidence, priorVotes, authorship] = await Promise.all([
    loadAvailability(membershipIds, quick.asOf),
    loadDirectionalEvidence(membershipIds, request.subject.billId, quick.asOf),
    loadPriorVotes(membershipIds, request.subject.billId, quick.asOf),
    loadAuthorship(request.subject.billId, quick.asOf),
  ]);
  const shadows = quick.members.map((member) => ({
    membershipId: member.membershipId,
    shadow: buildQuickEvidenceMemberShadow({
      baseProbability: member.yesProbability,
      evidenceRows: evidence.get(member.membershipId),
      availability: availability.get(member.membershipId),
      priorVotes: priorVotes.get(member.membershipId),
      billAuthor: authorship.membershipIds?.has(member.membershipId) ?? false,
      authorshipAvailable: authorship.available,
      capturedAt: quick.asOf,
      prospective: prospectiveEligible,
    }),
  }));

  const marker = JSON.stringify([{ kind: 'quick_evidence_shadow', version: QUICK_EVIDENCE_SHADOW_VERSION }]);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let updated = 0;
    for (const row of shadows) {
      const result = await client.query(`
        UPDATE forecast_member_predictions
           SET context = COALESCE(context,'[]'::jsonb) || $3::jsonb
         WHERE revision_id=$1
           AND membership_id=$2
           AND NOT (COALESCE(context,'[]'::jsonb) @> $4::jsonb)`, [
        quick.revisionId,
        row.membershipId,
        JSON.stringify([row.shadow]),
        marker,
      ]);
      updated += result.rowCount ?? 0;
    }
    if (updated !== shadows.length) {
      throw new Error(`Quick Evidence shadow updated ${updated}/${shadows.length} member rows`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    version: QUICK_EVIDENCE_SHADOW_VERSION,
    revisionId: quick.revisionId,
    capturedMembers: shadows.length,
    changedMembers: shadows.filter((row) => row.shadow.baseProbability !== null
      && row.shadow.candidateProbability !== null
      && Math.abs(row.shadow.baseProbability - row.shadow.candidateProbability) > 1e-12).length,
    membersWithDirectionalEvidence: shadows.filter((row) => row.shadow.features.candidateEvidenceItems > 0).length,
    membersWithPriorBillVotes: shadows.filter((row) =>
      row.shadow.features.priorSameBillYes
      + row.shadow.features.priorSameBillNo
      + row.shadow.features.priorCompanionYes
      + row.shadow.features.priorCompanionNo > 0).length,
    prospectiveEligible,
    servesTraffic: false,
  };
}
