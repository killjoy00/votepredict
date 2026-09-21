import { pool } from '@/lib/db';
import {
  QUICK_EVIDENCE_BASE_MODEL_VERSION,
  QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT,
  QUICK_EVIDENCE_PROSPECTIVE_SESSION,
} from '@/forecasting/quick-evidence-shadow';

export const QUICK_EVIDENCE_REQUIRED_FEATURE_KEYS = [
  'directSupport','directOppose','relatedSupport','relatedOppose',
  'officialFactSupport','officialFactOppose',
  'priorSameBillYes','priorSameBillNo','priorCompanionYes','priorCompanionNo',
  'priorSameBillAmendmentYes','priorSameBillAmendmentNo',
  'priorSameBillMotionProceduralYes','priorSameBillMotionProceduralNo',
  'priorSameBillOtherYes','priorSameBillOtherNo',
  'billAuthor','authorshipAvailable','floorAmendmentOffers','floorAmendmentWins',
  'conferenceConferee','legislativeSpeechItems','districtElectionContextAvailable',
  'districtElectionTopTwoMarginPct','districtElectionUncontested',
  'billSummaryItems','fiscalNoteItems',
  'committeeRecommendsPassageAye','committeeRecommendsPassageNay',
  'advancesTowardFloorEligibilityAye','advancesTowardFloorEligibilityNay',
  'continuesCommitteeReviewAye','continuesCommitteeReviewNay',
  'impedesCurrentBillProgressAye','impedesCurrentBillProgressNay',
  'defersCurrentBillActionAye','defersCurrentBillActionNay',
  'unclassifiedCommitteeMotionAye','unclassifiedCommitteeMotionNay',
  'candidateEvidenceItems','conflictingDirectionalEvidence','totalEvidenceItems',
  'sourceKinds','campaignFinanceItems','campaignSiteItems','memberPrimaryItems',
  'newsItems','newestFetchedAt','newestEvidenceAgeDays',
] as const;

export type QuickEvidenceAccrualFamily =
  | 'directional' | 'availability' | 'campaignFinance' | 'campaignSite'
  | 'memberPrimary' | 'news' | 'priorPassage' | 'nonPassageVotes'
  | 'authorship' | 'floorActivity' | 'conferee' | 'speech'
  | 'districtContext' | 'billContext' | 'committeeRollcall';

export interface QuickEvidenceAccrualAlert {
  severity: 'warning' | 'error';
  code: 'capture_failure' | 'feature_schema_gap' | 'source_without_shadow_yield' | 'no_feature_yield';
  message: string;
  family?: QuickEvidenceAccrualFamily;
}

type CountRow = Record<string, string | number>;

function n(value: string | number | undefined): number {
  return value === undefined ? 0 : typeof value === 'number' ? value : Number(value);
}

function families(row: CountRow): Record<QuickEvidenceAccrualFamily, number> {
  return {
    directional: n(row.directional),
    availability: n(row.availability),
    campaignFinance: n(row.campaign_finance),
    campaignSite: n(row.campaign_site),
    memberPrimary: n(row.member_primary),
    news: n(row.news),
    priorPassage: n(row.prior_passage),
    nonPassageVotes: n(row.non_passage_votes),
    authorship: n(row.authorship),
    floorActivity: n(row.floor_activity),
    conferee: n(row.conferee),
    speech: n(row.speech),
    districtContext: n(row.district_context),
    billContext: n(row.bill_context),
    committeeRollcall: n(row.committee_rollcall),
  };
}

export async function getQuickEvidenceAccrualHealth(input: {
  eligibleRevisions: number;
  capturedRevisions: number;
  failedRevisions: number;
}) {
  const shadowResult = await pool.query<CountRow>(`
    WITH shadows AS (
      SELECT r.id AS revision_id,
             fmp.membership_id,
             item.value AS shadow
        FROM forecast_revisions r
        JOIN forecasts f ON f.id=r.forecast_id
        JOIN legislative_sessions s ON s.id=f.session_id
        JOIN forecast_member_predictions fmp ON fmp.revision_id=r.id
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(fmp.context,'[]'::jsonb)) item(value)
       WHERE s.slug=$1
         AND f.target_type='bill'
         AND r.research_mode='quick'
         AND r.model_version=$2
         AND item.value->>'kind'='quick_evidence_shadow'
         AND item.value->>'experiment'=$3
    )
    SELECT count(*)::int AS member_shadows,
           count(*) FILTER (
             WHERE abs(
               COALESCE(NULLIF(shadow->>'candidateProbability','')::double precision,0)
               - COALESCE(NULLIF(shadow->>'baseProbability','')::double precision,0)
             ) > 1e-12
           )::int AS moved_member_shadows,
           count(DISTINCT membership_id) FILTER (
             WHERE COALESCE((shadow #>> '{features,candidateEvidenceItems}')::int,0) > 0
           )::int AS directional_members,
           count(*) FILTER (
             WHERE NOT (COALESCE(shadow->'features','{}'::jsonb) ?& $4::text[])
           )::int AS schema_missing,
           count(*) FILTER (WHERE COALESCE((shadow #>> '{features,candidateEvidenceItems}')::int,0) > 0)::int AS directional,
           count(*) FILTER (WHERE COALESCE((shadow #>> '{features,totalEvidenceItems}')::int,0) > 0)::int AS availability,
           count(*) FILTER (WHERE COALESCE((shadow #>> '{features,campaignFinanceItems}')::int,0) > 0)::int AS campaign_finance,
           count(*) FILTER (WHERE COALESCE((shadow #>> '{features,campaignSiteItems}')::int,0) > 0)::int AS campaign_site,
           count(*) FILTER (WHERE COALESCE((shadow #>> '{features,memberPrimaryItems}')::int,0) > 0)::int AS member_primary,
           count(*) FILTER (WHERE COALESCE((shadow #>> '{features,newsItems}')::int,0) > 0)::int AS news,
           count(*) FILTER (
             WHERE COALESCE((shadow #>> '{features,priorSameBillYes}')::int,0)
                 + COALESCE((shadow #>> '{features,priorSameBillNo}')::int,0)
                 + COALESCE((shadow #>> '{features,priorCompanionYes}')::int,0)
                 + COALESCE((shadow #>> '{features,priorCompanionNo}')::int,0) > 0
           )::int AS prior_passage,
           count(*) FILTER (
             WHERE COALESCE((shadow #>> '{features,priorSameBillAmendmentYes}')::int,0)
                 + COALESCE((shadow #>> '{features,priorSameBillAmendmentNo}')::int,0)
                 + COALESCE((shadow #>> '{features,priorSameBillMotionProceduralYes}')::int,0)
                 + COALESCE((shadow #>> '{features,priorSameBillMotionProceduralNo}')::int,0)
                 + COALESCE((shadow #>> '{features,priorSameBillOtherYes}')::int,0)
                 + COALESCE((shadow #>> '{features,priorSameBillOtherNo}')::int,0) > 0
           )::int AS non_passage_votes,
           count(*) FILTER (
             WHERE COALESCE((shadow #>> '{features,authorshipAvailable}')::boolean,false)
                OR COALESCE((shadow #>> '{features,billAuthor}')::boolean,false)
           )::int AS authorship,
           count(*) FILTER (
             WHERE COALESCE((shadow #>> '{features,floorAmendmentOffers}')::int,0)
                 + COALESCE((shadow #>> '{features,floorAmendmentWins}')::int,0) > 0
           )::int AS floor_activity,
           count(*) FILTER (WHERE COALESCE((shadow #>> '{features,conferenceConferee}')::boolean,false))::int AS conferee,
           count(*) FILTER (WHERE COALESCE((shadow #>> '{features,legislativeSpeechItems}')::int,0) > 0)::int AS speech,
           count(*) FILTER (WHERE COALESCE((shadow #>> '{features,districtElectionContextAvailable}')::boolean,false))::int AS district_context,
           count(*) FILTER (
             WHERE COALESCE((shadow #>> '{features,billSummaryItems}')::int,0)
                 + COALESCE((shadow #>> '{features,fiscalNoteItems}')::int,0) > 0
           )::int AS bill_context,
           count(*) FILTER (
             WHERE COALESCE((shadow #>> '{features,committeeRecommendsPassageAye}')::int,0)
                 + COALESCE((shadow #>> '{features,committeeRecommendsPassageNay}')::int,0)
                 + COALESCE((shadow #>> '{features,advancesTowardFloorEligibilityAye}')::int,0)
                 + COALESCE((shadow #>> '{features,advancesTowardFloorEligibilityNay}')::int,0)
                 + COALESCE((shadow #>> '{features,continuesCommitteeReviewAye}')::int,0)
                 + COALESCE((shadow #>> '{features,continuesCommitteeReviewNay}')::int,0)
                 + COALESCE((shadow #>> '{features,impedesCurrentBillProgressAye}')::int,0)
                 + COALESCE((shadow #>> '{features,impedesCurrentBillProgressNay}')::int,0)
                 + COALESCE((shadow #>> '{features,defersCurrentBillActionAye}')::int,0)
                 + COALESCE((shadow #>> '{features,defersCurrentBillActionNay}')::int,0)
                 + COALESCE((shadow #>> '{features,unclassifiedCommitteeMotionAye}')::int,0)
                 + COALESCE((shadow #>> '{features,unclassifiedCommitteeMotionNay}')::int,0) > 0
           )::int AS committee_rollcall
      FROM shadows
  `, [
    QUICK_EVIDENCE_PROSPECTIVE_SESSION,
    QUICK_EVIDENCE_BASE_MODEL_VERSION,
    QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT,
    [...QUICK_EVIDENCE_REQUIRED_FEATURE_KEYS],
  ]);

  const sourceResult = await pool.query<CountRow>(`
    WITH target_session AS (
      SELECT id FROM legislative_sessions
       WHERE slug=$1 ORDER BY starts_on DESC NULLS LAST LIMIT 1
    ), evidence AS (
      SELECT ei.*, sd.source_kind,
             m.session_id AS membership_session_id,
             b.session_id AS bill_session_id
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        LEFT JOIN memberships m ON m.id=ei.membership_id
        LEFT JOIN bills b ON b.id=ei.bill_id
       WHERE (m.session_id=(SELECT id FROM target_session)
          OR b.session_id=(SELECT id FROM target_session))
         AND NOT EXISTS (
           SELECT 1 FROM evidence_relationships er
            WHERE er.to_evidence_id=ei.id AND er.relation_kind='supersedes'
         )
    )
    SELECT
      count(*) FILTER (
        WHERE metadata->>'quickEvidenceCandidate'='true'
           OR metadata->>'mechanicallyActionable'='true'
      )::int AS directional,
      count(*)::int AS availability,
      count(*) FILTER (WHERE source_kind='campaign_finance_bulk')::int AS campaign_finance,
      count(*) FILTER (WHERE source_kind IN ('campaign_site','campaign_site_registry'))::int AS campaign_site,
      count(*) FILTER (WHERE source_kind IN ('member_primary_article','member_primary_registry'))::int AS member_primary,
      count(*) FILTER (WHERE source_kind='public_news_article')::int AS news,
      (SELECT count(*)::int FROM vote_events ve
        WHERE ve.session_id=(SELECT id FROM target_session) AND ve.is_passage=true) AS prior_passage,
      (SELECT count(*)::int FROM vote_events ve
        WHERE ve.session_id=(SELECT id FROM target_session) AND ve.is_passage=false) AS non_passage_votes,
      (SELECT count(*)::int FROM bills b
        WHERE b.session_id=(SELECT id FROM target_session) AND b.metadata ? 'revisorAuthorship') AS authorship,
      count(*) FILTER (WHERE metadata->>'subtype'='floor_amendment_offer')::int AS floor_activity,
      count(*) FILTER (WHERE metadata->>'subtype'='conference_conferee')::int AS conferee,
      count(*) FILTER (WHERE metadata->>'subtype'='legislative_speech')::int AS speech,
      count(*) FILTER (WHERE metadata->>'subtype'='district_election_context')::int AS district_context,
      count(*) FILTER (WHERE metadata->>'subtype' IN ('bill_summary_version','fiscal_note_context'))::int AS bill_context,
      count(*) FILTER (WHERE metadata->>'subtype'='committee_rollcall')::int AS committee_rollcall
    FROM evidence
  `, [QUICK_EVIDENCE_PROSPECTIVE_SESSION]);

  const shadow = shadowResult.rows[0] ?? {};
  const source = sourceResult.rows[0] ?? {};
  const familyNonzeroMemberShadows = families(shadow);
  const familySourceRecords = families(source);
  const alerts: QuickEvidenceAccrualAlert[] = [];

  if (input.failedRevisions > 0) {
    alerts.push({
      severity: 'error',
      code: 'capture_failure',
      message: input.failedRevisions
        + ' eligible Quick Evidence revisions remain uncaptured beyond the failure grace period.',
    });
  }
  if (n(shadow.schema_missing) > 0) {
    alerts.push({
      severity: 'error',
      code: 'feature_schema_gap',
      message: n(shadow.schema_missing)
        + ' captured member shadows are missing at least one frozen Quick Evidence feature key.',
    });
  }
  if (input.capturedRevisions >= 5 && n(shadow.member_shadows) >= 250) {
    const totalNonzero = Object.values(familyNonzeroMemberShadows)
      .reduce((sum, value) => sum + value, 0);
    if (totalNonzero === 0) {
      alerts.push({
        severity: 'error',
        code: 'no_feature_yield',
        message: 'At least five captured revisions and 250 member shadows exist, but every monitored Quick Evidence family remains zero.',
      });
    }
    for (const family of Object.keys(familyNonzeroMemberShadows) as QuickEvidenceAccrualFamily[]) {
      if (familySourceRecords[family] >= 5 && familyNonzeroMemberShadows[family] === 0) {
        alerts.push({
          severity: 'warning',
          code: 'source_without_shadow_yield',
          family,
          message: family + ' has ' + familySourceRecords[family]
            + ' source records in the 2027-28 corpus but zero nonzero captured member shadows.',
        });
      }
    }
  }

  return {
    state: input.eligibleRevisions === 0
      ? 'armed'
      : alerts.some((alert) => alert.severity === 'error')
        ? 'attention'
        : 'active',
    memberShadows: n(shadow.member_shadows),
    movedMemberShadows: n(shadow.moved_member_shadows),
    distinctMembersWithDirectionalEvidence: n(shadow.directional_members),
    schemaMissingMemberShadows: n(shadow.schema_missing),
    familyNonzeroMemberShadows,
    familySourceRecords,
    alerts,
  } as const;
}
