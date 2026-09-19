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
    publicNewsItems: number;
    publicNewsMembers: number;
    latestNewsInserted: number;
    latestNewsFailures: number;
    latestNewsNoLeadMembers: number;
    prospectiveEvidenceSince?: string;
    campaignSiteItems: number;
    memberPrimaryItems: number;
    memberPrimaryMembers: number;
    publicEvidenceMembers: number;
    mechanicallyActionableItems: number;
    latestCampaignFinanceFetch?: string;
    latestPublicEvidenceRun?: string;
    latestPublicEvidenceStatus?: string;
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
      public_news_items: number;
      public_news_members: number;
      latest_news_inserted: number;
      latest_news_failures: number;
      latest_news_no_lead_members: number;
      prospective_evidence_since: string | null;
      campaign_site_items: number;
      member_primary_items: number;
      member_primary_members: number;
      public_evidence_members: number;
      mechanically_actionable_items: number;
      latest_campaign_finance_fetch: string | null;
      latest_public_evidence_run: string | null;
      latest_public_evidence_status: string | null;
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
        count(*) FILTER (WHERE source_kind='public_news_article')::int AS public_news_items,
        count(DISTINCT membership_id) FILTER (WHERE source_kind='public_news_article')::int AS public_news_members,
        COALESCE((
          SELECT (metadata->'news'->>'inserted')::int
            FROM ingestion_runs
           WHERE source_system='public-evidence-pipeline'
           ORDER BY created_at DESC
           LIMIT 1
        ), 0)::int AS latest_news_inserted,
        COALESCE((
          SELECT (metadata->'news'->>'failures')::int
            FROM ingestion_runs
           WHERE source_system='public-evidence-pipeline'
           ORDER BY created_at DESC
           LIMIT 1
        ), 0)::int AS latest_news_failures,
        COALESCE((
          SELECT jsonb_array_length(COALESCE(metadata->'diagnostics'->'newsNoLeadMembers', '[]'::jsonb))
            FROM ingestion_runs
           WHERE source_system='public-evidence-pipeline'
           ORDER BY created_at DESC
           LIMIT 1
        ), 0)::int AS latest_news_no_lead_members,
        (
          SELECT min(sd2.fetched_at)::text
            FROM source_documents sd2
           WHERE sd2.source_kind IN (
             'public_news_article',
             'campaign_site',
             'campaign_site_registry',
             'member_primary_article',
             'member_primary_registry'
           )
        ) AS prospective_evidence_since,
        count(*) FILTER (WHERE source_kind IN ('campaign_site','campaign_site_registry'))::int AS campaign_site_items,
        count(*) FILTER (WHERE source_kind='member_primary_article')::int AS member_primary_items,
        count(DISTINCT membership_id) FILTER (WHERE source_kind IN ('member_primary_article','member_primary_registry'))::int AS member_primary_members,
        count(DISTINCT membership_id) FILTER (
          WHERE source_kind IN (
            'public_news_article',
            'campaign_site',
            'campaign_site_registry',
            'member_primary_article',
            'member_primary_registry'
          )
        )::int AS public_evidence_members,
        count(*) FILTER (WHERE metadata->>'mechanicallyActionable'='true')::int AS mechanically_actionable_items,
        max(fetched_at) FILTER (WHERE source_kind='campaign_finance_bulk')::text AS latest_campaign_finance_fetch,
        (SELECT finished_at::text FROM ingestion_runs WHERE source_system='public-evidence-pipeline' ORDER BY created_at DESC LIMIT 1) AS latest_public_evidence_run,
        (SELECT status FROM ingestion_runs WHERE source_system='public-evidence-pipeline' ORDER BY created_at DESC LIMIT 1) AS latest_public_evidence_status
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
    public_news_items: 0,
    public_news_members: 0,
    latest_news_inserted: 0,
    latest_news_failures: 0,
    latest_news_no_lead_members: 0,
    prospective_evidence_since: null,
    campaign_site_items: 0,
    member_primary_items: 0,
    member_primary_members: 0,
    public_evidence_members: 0,
    mechanically_actionable_items: 0,
    latest_campaign_finance_fetch: null,
    latest_public_evidence_run: null,
    latest_public_evidence_status: null,
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
      publicNewsItems: Number(evidence.public_news_items),
      publicNewsMembers: Number(evidence.public_news_members),
      latestNewsInserted: Number(evidence.latest_news_inserted),
      latestNewsFailures: Number(evidence.latest_news_failures),
      latestNewsNoLeadMembers: Number(evidence.latest_news_no_lead_members),
      prospectiveEvidenceSince: evidence.prospective_evidence_since ?? undefined,
      campaignSiteItems: Number(evidence.campaign_site_items),
      memberPrimaryItems: Number(evidence.member_primary_items),
      memberPrimaryMembers: Number(evidence.member_primary_members),
      publicEvidenceMembers: Number(evidence.public_evidence_members),
      mechanicallyActionableItems: Number(evidence.mechanically_actionable_items),
      latestCampaignFinanceFetch: evidence.latest_campaign_finance_fetch ?? undefined,
      latestPublicEvidenceRun: evidence.latest_public_evidence_run ?? undefined,
      latestPublicEvidenceStatus: evidence.latest_public_evidence_status ?? undefined,
    },
  };
}
