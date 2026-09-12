import { Pool } from 'pg';
import {
  scorePairedChamberForecasts,
  scorePairedMemberForecasts,
  scorePairedMembersBy,
  scorePairedMembersByEvidenceKind,
  type PairedChamberForecast,
  type PairedMemberForecast,
} from '../src/evaluation/deep-vs-quick.js';
import type { EvidenceKind } from '../src/evidence/types.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');

  const pool = new Pool({ connectionString, max: 1 });
  try {
    const diagnostics = await pool.query<{
      research_runs: number;
      completed_runs: number;
      failed_runs: number;
      completed_with_result_revision: number;
      resolved_forecasts: number;
      revision_evidence_rows: number;
    }>(`
      SELECT (SELECT count(*)::int FROM research_runs) AS research_runs,
             (SELECT count(*)::int FROM research_runs WHERE status = 'completed') AS completed_runs,
             (SELECT count(*)::int FROM research_runs WHERE status = 'failed') AS failed_runs,
             (SELECT count(*)::int FROM research_runs WHERE status = 'completed' AND result_revision_id IS NOT NULL) AS completed_with_result_revision,
             (SELECT count(*)::int FROM forecast_resolutions) AS resolved_forecasts,
             (SELECT count(*)::int FROM forecast_revision_evidence) AS revision_evidence_rows`);

    const memberResult = await pool.query<{
      forecast_id: string;
      quick_revision_id: string;
      deep_revision_id: string;
      vote_event_id: string;
      membership_id: string;
      session_slug: string;
      chamber_slug: string;
      occurred_on: string;
      quick_probability: number;
      deep_probability: number;
      outcome: 0 | 1;
      included_evidence_kinds: EvidenceKind[] | null;
      included_evidence_count: number;
    }>(`
      WITH eligible_pairs AS (
        SELECT rr.forecast_id,
               rr.base_revision_id AS quick_revision_id,
               rr.result_revision_id AS deep_revision_id,
               fr.vote_event_id,
               ve.occurred_on,
               s.slug AS session_slug,
               c.slug AS chamber_slug
          FROM research_runs rr
          JOIN forecast_revisions quick
            ON quick.id = rr.base_revision_id
           AND quick.research_mode = 'quick'
          JOIN forecast_revisions deep
            ON deep.id = rr.result_revision_id
           AND deep.research_mode = 'deep'
          JOIN forecast_resolutions fr ON fr.forecast_id = rr.forecast_id
          JOIN vote_events ve ON ve.id = fr.vote_event_id
          JOIN legislative_sessions s ON s.id = ve.session_id
          JOIN chambers c ON c.id = ve.chamber_id
         WHERE rr.status = 'completed'
           AND rr.result_revision_id IS NOT NULL
           AND quick.generated_at IS NOT NULL
           AND deep.generated_at IS NOT NULL
           AND quick.generated_at::date < ve.occurred_on
           AND deep.generated_at::date < ve.occurred_on
           AND rr.as_of::date < ve.occurred_on
      )
      SELECT pair.forecast_id,
             pair.quick_revision_id,
             pair.deep_revision_id,
             pair.vote_event_id,
             quick_member.membership_id,
             pair.session_slug,
             pair.chamber_slug,
             pair.occurred_on::text,
             quick_member.yes_probability AS quick_probability,
             deep_member.yes_probability AS deep_probability,
             CASE mv.choice WHEN 'yea' THEN 1 ELSE 0 END AS outcome,
             COALESCE(evidence.included_evidence_kinds, '{}'::text[]) AS included_evidence_kinds,
             COALESCE(evidence.included_evidence_count, 0)::int AS included_evidence_count
        FROM eligible_pairs pair
        JOIN forecast_member_predictions quick_member
          ON quick_member.revision_id = pair.quick_revision_id
         AND quick_member.yes_probability IS NOT NULL
        JOIN forecast_member_predictions deep_member
          ON deep_member.revision_id = pair.deep_revision_id
         AND deep_member.membership_id = quick_member.membership_id
         AND deep_member.yes_probability IS NOT NULL
        JOIN member_votes mv
          ON mv.vote_event_id = pair.vote_event_id
         AND mv.membership_id = quick_member.membership_id
         AND mv.choice IN ('yea', 'nay')
        LEFT JOIN LATERAL (
          SELECT array_agg(DISTINCT ei.evidence_kind) FILTER (WHERE fre.disposition = 'included') AS included_evidence_kinds,
                 count(*) FILTER (WHERE fre.disposition = 'included')::int AS included_evidence_count
            FROM forecast_revision_evidence fre
            JOIN evidence_items ei ON ei.id = fre.evidence_item_id
           WHERE fre.revision_id = pair.deep_revision_id
             AND fre.membership_id = quick_member.membership_id
        ) evidence ON true
       ORDER BY pair.occurred_on, pair.vote_event_id, quick_member.membership_id`);

    const chamberResult = await pool.query<{
      forecast_id: string;
      quick_revision_id: string;
      deep_revision_id: string;
      vote_event_id: string;
      session_slug: string;
      chamber_slug: string;
      occurred_on: string;
      quick_probability: number;
      deep_probability: number;
      outcome: 0 | 1;
      quick_expected_yes: number | null;
      deep_expected_yes: number | null;
      actual_yes: number;
    }>(`
      SELECT rr.forecast_id,
             rr.base_revision_id AS quick_revision_id,
             rr.result_revision_id AS deep_revision_id,
             ve.id AS vote_event_id,
             s.slug AS session_slug,
             c.slug AS chamber_slug,
             ve.occurred_on::text,
             quick.passage_probability AS quick_probability,
             deep.passage_probability AS deep_probability,
             CASE WHEN ve.passed THEN 1 ELSE 0 END AS outcome,
             quick.expected_yes AS quick_expected_yes,
             deep.expected_yes AS deep_expected_yes,
             ve.yea_count AS actual_yes
        FROM research_runs rr
        JOIN forecast_revisions quick
          ON quick.id = rr.base_revision_id
         AND quick.research_mode = 'quick'
        JOIN forecast_revisions deep
          ON deep.id = rr.result_revision_id
         AND deep.research_mode = 'deep'
        JOIN forecast_resolutions fr ON fr.forecast_id = rr.forecast_id
        JOIN vote_events ve ON ve.id = fr.vote_event_id
        JOIN legislative_sessions s ON s.id = ve.session_id
        JOIN chambers c ON c.id = ve.chamber_id
       WHERE rr.status = 'completed'
         AND rr.result_revision_id IS NOT NULL
         AND quick.generated_at IS NOT NULL
         AND deep.generated_at IS NOT NULL
         AND quick.generated_at::date < ve.occurred_on
         AND deep.generated_at::date < ve.occurred_on
         AND rr.as_of::date < ve.occurred_on
         AND quick.passage_probability IS NOT NULL
         AND deep.passage_probability IS NOT NULL
         AND ve.passed IS NOT NULL
       ORDER BY ve.occurred_on, ve.id`);

    const memberRows: PairedMemberForecast[] = memberResult.rows.map((row) => ({
      forecastId: row.forecast_id,
      quickRevisionId: row.quick_revision_id,
      deepRevisionId: row.deep_revision_id,
      voteEventId: row.vote_event_id,
      membershipId: row.membership_id,
      session: row.session_slug,
      chamber: row.chamber_slug,
      occurredOn: row.occurred_on,
      quickProbability: Number(row.quick_probability),
      deepProbability: Number(row.deep_probability),
      outcome: Number(row.outcome) as 0 | 1,
      includedEvidenceKinds: row.included_evidence_kinds ?? [],
      includedEvidenceCount: Number(row.included_evidence_count),
    }));

    const chamberRows: PairedChamberForecast[] = chamberResult.rows.map((row) => ({
      forecastId: row.forecast_id,
      quickRevisionId: row.quick_revision_id,
      deepRevisionId: row.deep_revision_id,
      voteEventId: row.vote_event_id,
      session: row.session_slug,
      chamber: row.chamber_slug,
      occurredOn: row.occurred_on,
      quickProbability: Number(row.quick_probability),
      deepProbability: Number(row.deep_probability),
      outcome: Number(row.outcome) as 0 | 1,
      quickExpectedYes: row.quick_expected_yes === null ? undefined : Number(row.quick_expected_yes),
      deepExpectedYes: row.deep_expected_yes === null ? undefined : Number(row.deep_expected_yes),
      actualYes: Number(row.actual_yes),
    }));

    const blockers: string[] = [];
    if (memberRows.length === 0) blockers.push('No completed, resolved, strictly pre-vote Deep/Quick member pairs are available.');
    if (chamberRows.length === 0) blockers.push('No completed, resolved, strictly pre-vote Deep/Quick chamber pairs are available.');

    console.log(JSON.stringify({
      metadata: {
        generatedAt: new Date().toISOString(),
        codeSha: process.env.GITHUB_SHA ?? null,
        status: blockers.length === 0 ? 'evaluable' : 'insufficient-sample',
        purpose: 'evaluation-only; this command never creates forecasts, invokes research, or changes serving probabilities',
        pairingRule: 'research_runs.base_revision_id (Quick) versus research_runs.result_revision_id (Deep)',
        leakageGuard: 'Quick generated_at, Deep generated_at, and research as_of must all be on a calendar date strictly before the resolved official vote date',
      },
      readiness: {
        ...diagnostics.rows[0],
        pairedMemberObservations: memberRows.length,
        pairedChamberObservations: chamberRows.length,
        blockers,
      },
      member: {
        overall: scorePairedMemberForecasts(memberRows),
        byChamber: scorePairedMembersBy(memberRows, 'chamber'),
        bySession: scorePairedMembersBy(memberRows, 'session'),
        byIncludedEvidenceKind: scorePairedMembersByEvidenceKind(memberRows),
      },
      chamber: scorePairedChamberForecasts(chamberRows),
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
