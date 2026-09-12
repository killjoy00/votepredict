import { Pool } from 'pg';
import {
  MIN_REPLAY_BILL_TEXT_LENGTH,
  MIN_REPLAY_DECISIVE_MEMBER_VOTES,
  replayCaseValidationErrors,
  strictPreVoteCutoff,
  summarizeReplayCohort,
  type HistoricalReplayCase,
} from '../src/evaluation/deep-replay.js';

type ReplayRow = {
  vote_event_id: string;
  bill_id: string;
  bill_version_id: string;
  identifier: string;
  title: string;
  session_slug: string;
  chamber_slug: string;
  occurred_on: string;
  bill_version_published_at: string;
  bill_text_length: number;
  passed: boolean;
  yea_count: number;
  nay_count: number;
  decisive_member_votes: number;
  stored_evidence_count: number;
  bill_scoped_evidence_count: number;
  member_scoped_evidence_count: number;
  evidence_kinds: string[] | null;
  source_kinds: string[] | null;
  extraction_methods: string[] | null;
};

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected finite numeric value, received ${String(value)}`);
  return parsed;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');

  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = await pool.query<ReplayRow>(`
      WITH candidates AS (
        SELECT ve.id AS vote_event_id,
               ve.bill_id,
               ve.occurred_on,
               ve.passed,
               ve.yea_count,
               ve.nay_count,
               b.identifier,
               b.title,
               s.slug AS session_slug,
               c.slug AS chamber_slug,
               count(*) FILTER (WHERE mv.choice IN ('yea', 'nay'))::int AS decisive_member_votes,
               array_agg(DISTINCT mv.membership_id)
                 FILTER (WHERE mv.choice IN ('yea', 'nay') AND mv.membership_id IS NOT NULL) AS membership_ids
          FROM vote_events ve
          JOIN bills b ON b.id = ve.bill_id
          JOIN legislative_sessions s ON s.id = ve.session_id
          JOIN chambers c ON c.id = ve.chamber_id
          LEFT JOIN member_votes mv ON mv.vote_event_id = ve.id
         WHERE ve.is_passage = true
           AND ve.bill_id IS NOT NULL
           AND ve.passed IS NOT NULL
           AND ve.occurred_on < CURRENT_DATE
         GROUP BY ve.id, ve.bill_id, ve.occurred_on, ve.passed, ve.yea_count, ve.nay_count,
                  b.identifier, b.title, s.slug, c.slug
        HAVING count(*) FILTER (WHERE mv.choice IN ('yea', 'nay')) >= ${MIN_REPLAY_DECISIVE_MEMBER_VOTES}
      )
      SELECT candidate.vote_event_id,
             candidate.bill_id,
             version.id AS bill_version_id,
             candidate.identifier,
             candidate.title,
             candidate.session_slug,
             candidate.chamber_slug,
             candidate.occurred_on::text,
             version.published_at::text AS bill_version_published_at,
             version.bill_text_length,
             candidate.passed,
             candidate.yea_count,
             candidate.nay_count,
             candidate.decisive_member_votes,
             COALESCE(evidence.stored_evidence_count, 0)::int AS stored_evidence_count,
             COALESCE(evidence.bill_scoped_evidence_count, 0)::int AS bill_scoped_evidence_count,
             COALESCE(evidence.member_scoped_evidence_count, 0)::int AS member_scoped_evidence_count,
             COALESCE(evidence.evidence_kinds, '{}'::text[]) AS evidence_kinds,
             COALESCE(evidence.source_kinds, '{}'::text[]) AS source_kinds,
             COALESCE(evidence.extraction_methods, '{}'::text[]) AS extraction_methods
        FROM candidates candidate
        JOIN LATERAL (
          SELECT bv.id,
                 bv.published_at,
                 length(bv.raw_text)::int AS bill_text_length
            FROM bill_versions bv
           WHERE bv.bill_id = candidate.bill_id
             AND bv.published_at IS NOT NULL
             AND bv.published_at::date < candidate.occurred_on
             AND bv.raw_text IS NOT NULL
             AND length(bv.raw_text) >= ${MIN_REPLAY_BILL_TEXT_LENGTH}
           ORDER BY bv.published_at DESC, bv.created_at DESC, bv.id
           LIMIT 1
        ) version ON true
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS stored_evidence_count,
                 count(*) FILTER (WHERE ei.bill_id = candidate.bill_id)::int AS bill_scoped_evidence_count,
                 count(*) FILTER (WHERE ei.membership_id = ANY(candidate.membership_ids))::int AS member_scoped_evidence_count,
                 array_agg(DISTINCT ei.evidence_kind ORDER BY ei.evidence_kind)
                   FILTER (WHERE ei.evidence_kind IS NOT NULL) AS evidence_kinds,
                 array_agg(DISTINCT sd.source_kind ORDER BY sd.source_kind)
                   FILTER (WHERE sd.source_kind IS NOT NULL) AS source_kinds,
                 array_agg(DISTINCT ei.extraction_method ORDER BY ei.extraction_method)
                   FILTER (WHERE ei.extraction_method IS NOT NULL) AS extraction_methods
            FROM evidence_items ei
            LEFT JOIN source_documents sd ON sd.id = ei.source_document_id
           WHERE ei.published_at IS NOT NULL
             AND ei.published_at::date < candidate.occurred_on
             AND (
               ei.bill_id = candidate.bill_id
               OR ei.membership_id = ANY(candidate.membership_ids)
             )
        ) evidence ON true
       ORDER BY candidate.occurred_on, candidate.vote_event_id`);

    const cases: HistoricalReplayCase[] = result.rows.map((row) => ({
      voteEventId: row.vote_event_id,
      billId: row.bill_id,
      billVersionId: row.bill_version_id,
      identifier: row.identifier,
      title: row.title,
      session: row.session_slug,
      chamber: row.chamber_slug,
      occurredOn: row.occurred_on,
      cutoff: strictPreVoteCutoff(row.occurred_on),
      billVersionPublishedAt: row.bill_version_published_at,
      billTextLength: toNumber(row.bill_text_length),
      passed: row.passed,
      yeaCount: toNumber(row.yea_count),
      nayCount: toNumber(row.nay_count),
      decisiveMemberVotes: toNumber(row.decisive_member_votes),
      storedEvidenceCount: toNumber(row.stored_evidence_count),
      billScopedEvidenceCount: toNumber(row.bill_scoped_evidence_count),
      memberScopedEvidenceCount: toNumber(row.member_scoped_evidence_count),
      evidenceKinds: row.evidence_kinds ?? [],
      sourceKinds: row.source_kinds ?? [],
      extractionMethods: row.extraction_methods ?? [],
    }));

    const invalidCases = cases
      .map((replayCase) => ({ replayCase, errors: replayCaseValidationErrors(replayCase) }))
      .filter(({ errors }) => errors.length > 0);
    if (invalidCases.length > 0) {
      const sample = invalidCases.slice(0, 5).map(({ replayCase, errors }) => ({
        voteEventId: replayCase.voteEventId,
        errors,
      }));
      throw new Error(`Historical replay cohort failed closed validation: ${JSON.stringify(sample)}`);
    }

    const summary = summarizeReplayCohort(cases);
    const withBillScopedEvidence = cases.filter((replayCase) => replayCase.billScopedEvidenceCount > 0).length;
    const withMemberScopedEvidence = cases.filter((replayCase) => replayCase.memberScopedEvidenceCount > 0).length;

    console.log(JSON.stringify({
      metadata: {
        generatedAt: new Date().toISOString(),
        codeSha: process.env.GITHUB_SHA ?? null,
        purpose: 'evaluation-only historical replay manifest; this command performs no writes, creates no forecasts, invokes no research, and changes no serving probabilities',
        leakageGuard: 'target bill text and stored evidence must be published on a calendar date strictly before the official vote date; same-day information is excluded because vote_events stores date but not vote time',
        researchCutoff: '23:59:59.999Z on the calendar day before each vote',
        minimumDecisiveMemberVotes: MIN_REPLAY_DECISIVE_MEMBER_VOTES,
        minimumBillTextLength: MIN_REPLAY_BILL_TEXT_LENGTH,
      },
      readiness: {
        ...summary,
        withBillScopedStoredEvidence: withBillScopedEvidence,
        withMemberScopedStoredEvidence: withMemberScopedEvidence,
        storedEvidenceWarning: 'Stored evidence availability is diagnostic only. It is not a claim of relevance or actionability, and sparse historical evidence must not be backfilled with post-cutoff/current research.',
      },
      cases,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
