import { Pool } from 'pg';
import {
  BILL_FEATURE_SCHEMA_VERSION,
  DETERMINISTIC_EXTRACTOR_VERSION,
  retrieveHistoricalAnalogues,
  type BillFeatureIdentity,
  type DeterministicBillFeatures,
  type HistoricalAnalogueCandidate,
} from '../src/features/bills.js';
import {
  evaluateChronologicalMemberModel,
  scoreMemberModel,
  scoreMemberModelBy,
  scoreMemberModelChambers,
  type MemberModelObservation,
  type MemberModelPrediction,
} from '../src/evaluation/member-model.js';
import { ordinaryMinnesotaPassageRule } from '../src/forecasting/minnesota-rules.js';

const MAX_PREFILTER_EVENTS = 30;
const MAX_ANALOGUES = 10;

type VersionRow = {
  id: string;
  bill_id: string;
  published_at: string;
  features: DeterministicBillFeatures;
};

type EventRow = {
  vote_event_id: string;
  bill_id: string;
  identifier: string;
  title: string;
  session_slug: string;
  chamber_slug: string;
  occurred_on: string;
  yea_count: number;
  nay_count: number;
  passed: boolean | null;
  companion_identifier: string | null;
};

type VoteRow = {
  vote_event_id: string;
  legislator_id: string;
  choice: 'yea' | 'nay';
};

type AnalogueSupport = {
  yesWeight: number;
  weight: number;
};

type EventAnalogueSupport = {
  selected: number;
  prefiltered: number;
  member: Map<string, AnalogueSupport>;
};

function candidateTokens(identity: BillFeatureIdentity): string[] {
  const values = [
    ...identity.features.titleTokens,
    ...identity.features.policyAreas,
    ...identity.features.actionTypes,
    ...identity.features.keywords.slice(0, 12),
  ].map((token) => token.toLowerCase().trim())
    .filter((token) => token.length >= 4 && !/^\d+$/.test(token));
  return [...new Set(values)].slice(0, 18);
}

function safeVersionAsOf(versions: readonly VersionRow[] | undefined, occurredOn: string): VersionRow | undefined {
  // Revisor version metadata is date-granular. Require the version to predate the vote day,
  // rather than using a same-day version whose before/after-vote ordering cannot be proven.
  return [...(versions ?? [])]
    .filter((version) => version.published_at.slice(0, 10) < occurredOn)
    .sort((a, b) => b.published_at.localeCompare(a.published_at))[0];
}

function lexicalHits(title: string, tokens: readonly string[]): number {
  const value = title.toLowerCase();
  return tokens.filter((token) => value.includes(token)).length;
}

function prefilterCandidates(
  target: BillFeatureIdentity,
  targetEvent: EventRow,
  priorCandidates: readonly HistoricalAnalogueCandidate[],
): HistoricalAnalogueCandidate[] {
  const tokens = candidateTokens(target);
  const companion = target.companionIdentifier;
  return priorCandidates
    .map((candidate) => ({
      candidate,
      hits: lexicalHits(candidate.title, tokens),
      priority: candidate.billId === targetEvent.bill_id ? 3 : companion && candidate.identifier === companion ? 2 : 1,
    }))
    .filter((row) => row.hits > 0 || row.priority > 1)
    .sort((a, b) => b.priority - a.priority || b.hits - a.hits || b.candidate.occurredAt.localeCompare(a.candidate.occurredAt) || a.candidate.voteEventId.localeCompare(b.candidate.voteEventId))
    .slice(0, MAX_PREFILTER_EVENTS)
    .map((row) => row.candidate);
}

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
    const versionResult = await pool.query<VersionRow>(`
      SELECT bv.id,
             bv.bill_id,
             to_char(bv.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at,
             bfs.features
        FROM bill_versions bv
        JOIN bill_feature_sets bfs ON bfs.bill_version_id = bv.id
       WHERE bv.published_at IS NOT NULL
         AND bv.raw_text IS NOT NULL
         AND length(bv.raw_text) >= 100
         AND bfs.feature_schema_version = $1
         AND bfs.extractor_version = $2`, [BILL_FEATURE_SCHEMA_VERSION, DETERMINISTIC_EXTRACTOR_VERSION]);
    const versionsByBill = new Map<string, VersionRow[]>();
    for (const row of versionResult.rows) {
      const rows = versionsByBill.get(row.bill_id) ?? [];
      rows.push(row);
      versionsByBill.set(row.bill_id, rows);
    }

    const eventResult = await pool.query<EventRow>(`
      SELECT ve.id AS vote_event_id,
             b.id AS bill_id,
             b.identifier,
             b.title,
             s.slug AS session_slug,
             c.slug AS chamber_slug,
             ve.occurred_on::text,
             ve.yea_count,
             ve.nay_count,
             ve.passed,
             b.metadata #>> '{revisor,companionIdentifier}' AS companion_identifier
        FROM vote_events ve
        JOIN bills b ON b.id = ve.bill_id
        JOIN legislative_sessions s ON s.id = ve.session_id
        JOIN chambers c ON c.id = ve.chamber_id
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       WHERE ve.is_passage = true
       ORDER BY ve.occurred_on, ve.id`);

    const voteResult = await pool.query<VoteRow>(`
      SELECT mv.vote_event_id,
             m.legislator_id,
             mv.choice
        FROM member_votes mv
        JOIN vote_events ve ON ve.id = mv.vote_event_id AND ve.is_passage = true
        JOIN memberships m ON m.id = mv.membership_id
       WHERE mv.choice IN ('yea', 'nay')`);
    const votesByEvent = new Map<string, Map<string, 'yea' | 'nay'>>();
    for (const row of voteResult.rows) {
      const rows = votesByEvent.get(row.vote_event_id) ?? new Map<string, 'yea' | 'nay'>();
      rows.set(row.legislator_id, row.choice);
      votesByEvent.set(row.vote_event_id, rows);
    }

    const priorCandidates: HistoricalAnalogueCandidate[] = [];
    const supportByEvent = new Map<string, EventAnalogueSupport>();
    let safeTargetEvents = 0;

    for (const event of eventResult.rows) {
      const safeVersion = safeVersionAsOf(versionsByBill.get(event.bill_id), event.occurred_on);
      const asOf = `${event.occurred_on}T00:00:00Z`;
      if (safeVersion) {
        safeTargetEvents += 1;
        const target: BillFeatureIdentity = {
          billId: event.bill_id,
          billVersionId: safeVersion.id,
          identifier: event.identifier,
          session: event.session_slug,
          title: event.title,
          publishedAt: safeVersion.published_at,
          companionIdentifier: event.companion_identifier ?? undefined,
          features: safeVersion.features,
        };
        const prefiltered = prefilterCandidates(target, event, priorCandidates);
        const selected = retrieveHistoricalAnalogues(target, prefiltered, asOf, { limit: MAX_ANALOGUES });
        if (selected.length > 0) {
          const perMember = new Map<string, AnalogueSupport>();
          for (const analogue of selected) {
            for (const [memberId, choice] of votesByEvent.get(analogue.candidate.voteEventId) ?? []) {
              const support = perMember.get(memberId) ?? { yesWeight: 0, weight: 0 };
              support.weight += analogue.score;
              if (choice === 'yea') support.yesWeight += analogue.score;
              perMember.set(memberId, support);
            }
          }
          supportByEvent.set(event.vote_event_id, {
            selected: selected.length,
            prefiltered: prefiltered.length,
            member: perMember,
          });
        }
      }

      if (safeVersion) {
        priorCandidates.push({
          billId: event.bill_id,
          billVersionId: safeVersion.id,
          identifier: event.identifier,
          session: event.session_slug,
          title: event.title,
          publishedAt: safeVersion.published_at,
          companionIdentifier: event.companion_identifier ?? undefined,
          features: safeVersion.features,
          voteEventId: event.vote_event_id,
          occurredAt: `${event.occurred_on}T00:00:00Z`,
          chamber: event.chamber_slug,
          yeaCount: Number(event.yea_count),
          nayCount: Number(event.nay_count),
          passed: event.passed,
        });
      }
    }

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
        featureSchemaVersion: BILL_FEATURE_SCHEMA_VERSION,
        extractorVersion: DETERMINISTIC_EXTRACTOR_VERSION,
        analoguePolicy: 'production-equivalent title-token prefilter (30), top-10 feature similarity + recency; historical target/candidate bill versions must predate the vote day',
        leakageGuard: 'same-day Revisor versions are excluded because before/after-vote ordering cannot be established from date-only metadata',
        passageScoring: 'only official known outcomes; unknown ve.passed values are not inferred; Minnesota ordinary thresholds are fixed at 68 House / 34 Senate for simulation',
      },
      coverage: {
        passageEvents: eventResult.rows.length,
        featuredVersions: versionResult.rows.length,
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
