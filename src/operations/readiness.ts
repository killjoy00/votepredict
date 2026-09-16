import { pool } from '@/lib/db';

export type DeepReadinessState = 'ready' | 'blocked' | 'unverified';

export type ProductionReadiness = {
  generatedAt: string;
  deploymentSha?: string;
  deep: {
    state: DeepReadinessState;
    completedRuns: number;
    failedRuns: number;
    latestStatus?: string;
    latestFinishedAt?: string;
    latestError?: string;
    billingBlocked: boolean;
  };
  futureSession: {
    slug: '2027-2028';
    exists: boolean;
    isCurrent: boolean;
    memberships: number;
    bills: number;
  };
  evidence: {
    currentCampaignFinanceItems: number;
    campaignFinanceMembers: number;
    currentCuratedItems: number;
    mechanicallyActionableItems: number;
    latestCampaignFinanceFetch?: string;
  };
};

export async function getProductionReadiness(): Promise<ProductionReadiness> {
  const [researchResult, futureSessionResult, evidenceResult] = await Promise.all([
    pool.query<{
      completed_runs: number;
      failed_runs: number;
      latest_status: string | null;
      latest_finished_at: string | null;
      latest_error: string | null;
    }>(`
      SELECT
        (SELECT count(*)::int FROM research_runs WHERE provider='ai-gateway-web' AND status='completed') AS completed_runs,
        (SELECT count(*)::int FROM research_runs WHERE provider='ai-gateway-web' AND status='failed') AS failed_runs,
        (SELECT status FROM research_runs WHERE provider='ai-gateway-web' ORDER BY created_at DESC LIMIT 1) AS latest_status,
        (SELECT finished_at::text FROM research_runs WHERE provider='ai-gateway-web' ORDER BY created_at DESC LIMIT 1) AS latest_finished_at,
        (SELECT error_summary FROM research_runs WHERE provider='ai-gateway-web' ORDER BY created_at DESC LIMIT 1) AS latest_error`),
    pool.query<{
      session_exists: boolean;
      is_current: boolean;
      memberships: number;
      bills: number;
    }>(`
      WITH target_session AS (
        SELECT s.id, s.is_current
          FROM legislative_sessions s
          JOIN jurisdictions j ON j.id=s.jurisdiction_id
         WHERE j.slug='us-mn'
           AND s.slug='2027-2028'
         ORDER BY s.starts_on DESC NULLS LAST
         LIMIT 1
      )
      SELECT
        EXISTS(SELECT 1 FROM target_session) AS session_exists,
        COALESCE((SELECT is_current FROM target_session), false) AS is_current,
        (SELECT count(*)::int FROM memberships m WHERE m.session_id=(SELECT id FROM target_session)) AS memberships,
        (SELECT count(*)::int FROM bills b WHERE b.session_id=(SELECT id FROM target_session)) AS bills`),
    pool.query<{
      campaign_finance_items: number;
      campaign_finance_members: number;
      curated_items: number;
      mechanically_actionable_items: number;
      latest_campaign_finance_fetch: string | null;
    }>(`
      WITH current_evidence AS (
        SELECT ei.*, sd.source_kind, sd.fetched_at
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
         WHERE NOT EXISTS (
           SELECT 1
             FROM evidence_relationships er
            WHERE er.to_evidence_id=ei.id
              AND er.relation_kind='supersedes'
         )
      )
      SELECT
        count(*) FILTER (WHERE metadata->>'contextType'='campaign_finance')::int AS campaign_finance_items,
        count(DISTINCT membership_id) FILTER (WHERE metadata->>'contextType'='campaign_finance')::int AS campaign_finance_members,
        count(*) FILTER (WHERE source_kind IN ('member_statement','official_news','interest_group_position','official_member_profile','official_committee_roster'))::int AS curated_items,
        count(*) FILTER (WHERE metadata->>'mechanicallyActionable'='true')::int AS mechanically_actionable_items,
        max(fetched_at) FILTER (WHERE source_kind='campaign_finance_bulk')::text AS latest_campaign_finance_fetch
      FROM current_evidence`),
  ]);

  const research = researchResult.rows[0] ?? {
    completed_runs: 0,
    failed_runs: 0,
    latest_status: null,
    latest_finished_at: null,
    latest_error: null,
  };
  const latestError = research.latest_error ?? undefined;
  const billingBlocked = /valid credit card|billing|add-credit-card/i.test(latestError ?? '');
  const deepState: DeepReadinessState = research.completed_runs > 0 && research.latest_status === 'completed'
    ? 'ready'
    : research.latest_status === 'failed'
      ? 'blocked'
      : 'unverified';

  const futureSession = futureSessionResult.rows[0] ?? {
    session_exists: false,
    is_current: false,
    memberships: 0,
    bills: 0,
  };
  const evidence = evidenceResult.rows[0] ?? {
    campaign_finance_items: 0,
    campaign_finance_members: 0,
    curated_items: 0,
    mechanically_actionable_items: 0,
    latest_campaign_finance_fetch: null,
  };

  return {
    generatedAt: new Date().toISOString(),
    deploymentSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? undefined,
    deep: {
      state: deepState,
      completedRuns: Number(research.completed_runs),
      failedRuns: Number(research.failed_runs),
      latestStatus: research.latest_status ?? undefined,
      latestFinishedAt: research.latest_finished_at ?? undefined,
      latestError,
      billingBlocked,
    },
    futureSession: {
      slug: '2027-2028',
      exists: Boolean(futureSession.session_exists),
      isCurrent: Boolean(futureSession.is_current),
      memberships: Number(futureSession.memberships),
      bills: Number(futureSession.bills),
    },
    evidence: {
      currentCampaignFinanceItems: Number(evidence.campaign_finance_items),
      campaignFinanceMembers: Number(evidence.campaign_finance_members),
      currentCuratedItems: Number(evidence.curated_items),
      mechanicallyActionableItems: Number(evidence.mechanically_actionable_items),
      latestCampaignFinanceFetch: evidence.latest_campaign_finance_fetch ?? undefined,
    },
  };
}
