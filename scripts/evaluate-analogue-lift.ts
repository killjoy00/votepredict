import { Pool } from 'pg';
import { loadHistoricalQuickReplayDataset } from '../src/evaluation/historical-quick-replay-dataset.js';
import {
  evaluateChronologicalMemberModel,
  scoreMemberModel,
  scoreMemberModelBy,
  scoreMemberModelChambers,
  type MemberModelObservation,
  type MemberModelPrediction,
} from '../src/evaluation/member-model.js';
import { ordinaryMinnesotaPassageRule } from '../src/forecasting/minnesota-rules.js';

type EventAnalogueSupport = import('../src/evaluation/historical-quick-replay.js').QuickReplayAnalogueSupport;

function enrichRows(
  rows: readonly MemberModelObservation[],
  supportByEvent: ReadonlyMap<string, EventAnalogueSupport>,
): MemberModelObservation[] {
  return rows.map((row) => {
    const support = supportByEvent.get(row.voteEventId)?.member.get(row.memberId);
    if (!support || support.weight <= 0) return row;
    return {
      ...row,
      analogueYesRate: support.yesWeight / support.weight,
      analogueEffectiveWeight: support.weight,
    };
  });
}

function scoreComparableMemberRows(
  predictions: readonly MemberModelPrediction[],
  eligibleEvents: ReadonlySet<string>,
) {
  const comparable = predictions.filter((row) => eligibleEvents.has(row.voteEventId));
  return {
    overall: scoreMemberModel(comparable),
    bySession: scoreMemberModelBy(comparable, 'session'),
  };
}

function delta(after: number | undefined, before: number | undefined): number | null {
  return after === undefined || before === undefined ? null : after - before;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const dataset = await loadHistoricalQuickReplayDataset(pool);
    const supportByEvent = dataset.analogueSupportByEvent;
    const safeTargetEvents = dataset.targetVersionByEvent.size;

    const memberResult = await pool.query<{
      observation_id: string;
      vote_event_id: string;
      member_id: string;
      party: string | null;
      occurred_at: string;
      outcome: 0 | 1;
      session_slug: string;
      chamber_slug: string;
    }>(`
      SELECT mv.id AS observation_id,
             ve.id AS vote_event_id,
             m.legislator_id AS member_id,
             NULLIF(btrim(m.party), '') AS party,
             ve.occurred_on::text || 'T00:00:00Z' AS occurred_at,
             CASE mv.choice WHEN 'yea' THEN 1 ELSE 0 END AS outcome,
             s.slug AS session_slug,
             c.slug AS chamber_slug
        FROM member_votes mv
        JOIN vote_events ve ON ve.id = mv.vote_event_id
        JOIN memberships m ON m.id = mv.membership_id
        JOIN legislative_sessions s ON s.id = ve.session_id
        JOIN chambers c ON c.id = ve.chamber_id
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       WHERE ve.is_passage = true
         AND mv.choice IN ('yea', 'nay')
       ORDER BY ve.occurred_on, ve.id, mv.id`);
    const memberRows: MemberModelObservation[] = memberResult.rows.map((row) => ({
      observationId: row.observation_id,
      voteEventId: row.vote_event_id,
      memberId: row.member_id,
      party: row.party ?? 'UNKNOWN',
      occurredAt: row.occurred_at,
      outcome: Number(row.outcome) as 0 | 1,
      session: row.session_slug,
      chamber: row.chamber_slug,
    }));

    const chamberResult = await pool.query<{
      observation_id: string;
      vote_event_id: string;
      member_id: string;
      party: string | null;
      occurred_at: string;
      outcome: 0 | 1;
      history_outcome: 0 | 1 | null;
      member_scorable: boolean;
      session_slug: string;
      chamber_slug: string;
      passed: boolean | null;
    }>(`
      SELECT ve.id::text || ':' || m.id::text AS observation_id,
             ve.id AS vote_event_id,
             m.legislator_id AS member_id,
             NULLIF(btrim(m.party), '') AS party,
             ve.occurred_on::text || 'T00:00:00Z' AS occurred_at,
             CASE WHEN mv.choice = 'yea' THEN 1 ELSE 0 END AS outcome,
             CASE WHEN mv.choice = 'yea' THEN 1 WHEN mv.choice = 'nay' THEN 0 ELSE NULL END AS history_outcome,
             COALESCE(mv.choice IN ('yea', 'nay'), false) AS member_scorable,
             s.slug AS session_slug,
             c.slug AS chamber_slug,
             ve.passed
        FROM vote_events ve
        JOIN legislative_sessions s ON s.id = ve.session_id
        JOIN chambers c ON c.id = ve.chamber_id
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
        JOIN memberships m
          ON m.session_id = ve.session_id
         AND m.chamber_id = ve.chamber_id
         AND (m.starts_on IS NULL OR m.starts_on <= ve.occurred_on)
         AND (m.ends_on IS NULL OR m.ends_on >= ve.occurred_on)
        LEFT JOIN member_votes mv
          ON mv.vote_event_id = ve.id
         AND mv.membership_id = m.id
       WHERE ve.is_passage = true
       ORDER BY ve.occurred_on, ve.id, m.id`);
    const chamberRows: MemberModelObservation[] = chamberResult.rows.map((row) => ({
      observationId: row.observation_id,
      voteEventId: row.vote_event_id,
      memberId: row.member_id,
      party: row.party ?? 'UNKNOWN',
      occurredAt: row.occurred_at,
      outcome: Number(row.outcome) as 0 | 1,
      historyOutcome: row.history_outcome === null ? null : Number(row.history_outcome) as 0 | 1,
      memberScorable: row.member_scorable,
      session: row.session_slug,
      chamber: row.chamber_slug,
      passageRule: ordinaryMinnesotaPassageRule(row.chamber_slug),
      passed: row.passed ?? undefined,
    }));

    const eligibleEvents = new Set(supportByEvent.keys());
    if (eligibleEvents.size === 0) throw new Error('No as-of-safe events produced historical analogues');

    const baseMemberPredictions = evaluateChronologicalMemberModel(memberRows);
    const analogueMemberRows = enrichRows(memberRows, supportByEvent);
    const analogueMemberPredictions = evaluateChronologicalMemberModel(analogueMemberRows);
    const baseMember = scoreComparableMemberRows(baseMemberPredictions, eligibleEvents);
    const analogueMember = scoreComparableMemberRows(analogueMemberPredictions, eligibleEvents);

    const baseChamberPredictions = evaluateChronologicalMemberModel(chamberRows)
      .filter((row) => eligibleEvents.has(row.voteEventId));
    const analogueChamberRows = enrichRows(chamberRows, supportByEvent);
    const analogueChamberPredictions = evaluateChronologicalMemberModel(analogueChamberRows)
      .filter((row) => eligibleEvents.has(row.voteEventId));
    const baseChamber = scoreMemberModelChambers(baseChamberPredictions);
    const analogueChamber = scoreMemberModelChambers(analogueChamberPredictions);

    const directResolvedRows = analogueMemberPredictions.filter((row) => eligibleEvents.has(row.voteEventId) && (row.analogueEffectiveWeight ?? 0) > 0);
    const baseById = new Map(baseMemberPredictions.map((row) => [row.observationId, row]));
    const directBaseRows = directResolvedRows.map((row) => baseById.get(row.observationId)).filter((row): row is MemberModelPrediction => Boolean(row));
    const directBase = scoreMemberModel(directBaseRows);
    const directAnalogue = scoreMemberModel(directResolvedRows);

    const selectedCounts = [...supportByEvent.values()].map((value) => value.selected);
    const prefilteredCounts = [...supportByEvent.values()].map((value) => value.prefiltered);

    console.log(JSON.stringify({
      metadata: {
        generatedAt: new Date().toISOString(),
        codeSha: process.env.GITHUB_SHA ?? null,
        historicalReplayVersion: 'historical-quick-replay-v2',
        analoguePolicy: 'shared historical Quick v2 analogue support: dated-feature-token prefilter (30), top-10 feature similarity + recency',
        leakageGuard: 'uses the shared v2 loader: dated bill text only, no mutable current title, no current companion metadata, and strict pre-vote target versions',
        passageScoring: 'only official known outcomes; unknown ve.passed values are not inferred; Minnesota ordinary thresholds are fixed at 68 House / 34 Senate for simulation',
      },
      coverage: {
        passageEvents: dataset.events.length,
        datedVersions: [...dataset.versionsByBill.values()].reduce((sum, rows) => sum + rows.length, 0),
        safeTargetEvents,
        eventsWithSelectedAnalogues: eligibleEvents.size,
        meanSelectedAnalogues: selectedCounts.reduce((sum, value) => sum + value, 0) / selectedCounts.length,
        meanPrefilteredEvents: prefilteredCounts.reduce((sum, value) => sum + value, 0) / prefilteredCounts.length,
        directResolvedMemberRows: directResolvedRows.length,
      },
      memberComparable: {
        base: baseMember,
        analogue: analogueMember,
        delta: {
          accuracy: delta(analogueMember.overall.accuracy, baseMember.overall.accuracy),
          brier: delta(analogueMember.overall.brier, baseMember.overall.brier),
          logLoss: delta(analogueMember.overall.logLoss, baseMember.overall.logLoss),
          expectedCalibrationError: delta(analogueMember.overall.expectedCalibrationError, baseMember.overall.expectedCalibrationError),
        },
      },
      directMemberRows: {
        base: directBase,
        analogue: directAnalogue,
        delta: {
          accuracy: delta(directAnalogue.accuracy, directBase.accuracy),
          brier: delta(directAnalogue.brier, directBase.brier),
          logLoss: delta(directAnalogue.logLoss, directBase.logLoss),
          expectedCalibrationError: delta(directAnalogue.expectedCalibrationError, directBase.expectedCalibrationError),
        },
      },
      chamberComparable: {
        base: baseChamber,
        analogue: analogueChamber,
        delta: {
          meanAbsoluteYesError: delta(analogueChamber.meanAbsoluteYesError, baseChamber.meanAbsoluteYesError),
          intervalCoverage: delta(analogueChamber.intervalCoverage, baseChamber.intervalCoverage),
          passageBrier: delta(analogueChamber.passageBrier, baseChamber.passageBrier),
          passageBrierSkillVsAlwaysPass: delta(analogueChamber.passageBrierSkillVsAlwaysPass, baseChamber.passageBrierSkillVsAlwaysPass),
        },
      },
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
