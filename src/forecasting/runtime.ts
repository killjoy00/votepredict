import type { PoolClient } from 'pg';
import { extractDeterministicBillFeatures, retrieveHistoricalAnalogues, type BillFeatureIdentity, type HistoricalAnalogueCandidate } from '@/features/bills';
import { pool } from '@/lib/db';
import { fetchRevisorBill, fetchRevisorBillVersion, type RevisorBillMetadata, type RevisorBillVersionMetadata } from '@/sources/minnesota/revisor';
import { MINNESOTA_HOUSE_HISTORICAL_SESSIONS } from '@/sources/minnesota/sessions';
import { simulateChamber, type ChamberSimulation, type PassageRule } from './chamber';
import { estimateMemberProbability, MEMBER_MODEL_VERSION, type RateEvidence } from './member-model';

const MAX_PREFILTER_EVENTS = 30;
const MAX_ANALOGUES = 10;
const REVISOR_CONCURRENCY = 4;

export type RuntimeResearchMode = 'quick' | 'deep';

export type ForecastRuntimeSubject = {
  kind: 'bill';
  billId: string;
  identifier: string;
  title: string;
  sessionId: string;
  sessionSlug: string;
  sourceUrl?: string | null;
  companionIdentifier?: string | null;
} | {
  kind: 'proposal';
  proposalId: string;
  title: string;
  text: string;
  sessionId: string;
  sessionSlug: string;
};

export interface ForecastRuntimeRequest {
  forecastId: string;
  chamberId: string;
  chamberSlug: string;
  chamberName: string;
  subject: ForecastRuntimeSubject;
  researchMode: RuntimeResearchMode;
  asOf?: string;
}

export interface ForecastRuntimeMember {
  membershipId: string;
  legislatorId: string;
  memberName: string;
  party: string;
  district: string;
  yesProbability?: number;
  cannotPredictReason?: string;
  evidenceQuality: 'strong' | 'moderate' | 'limited';
  uncertainty?: number;
  support: {
    global: number;
    party: number;
    member: number;
    analogue: number;
  };
  analogue?: {
    identifier: string;
    voteEventId: string;
    occurredOn: string;
    score: number;
    memberChoice: 'yea' | 'nay';
    reasons: string[];
  };
  strongestReason: string;
  researched: boolean;
}

export interface ForecastRuntimeAnalogue {
  voteEventId: string;
  billId: string;
  identifier: string;
  title: string;
  chamber: string;
  occurredOn: string;
  score: number;
  similarity: number;
  relationship?: string;
  reasons: string[];
  yeaCount: number;
  nayCount: number;
  passed: boolean | null;
}

export interface ForecastRuntimeResult {
  forecastId: string;
  revisionId: string;
  revisionNumber: number;
  researchMode: RuntimeResearchMode;
  modelVersion: typeof MEMBER_MODEL_VERSION;
  asOf: string;
  chamber: {
    id: string;
    slug: string;
    name: string;
    activeMembers: number;
    passageRule: PassageRule;
    requiredYes: number;
    passageProbability?: number;
    expectedYes?: number;
    yesLow?: number;
    yesHigh?: number;
  };
  supportState: 'supported' | 'partial';
  members: ForecastRuntimeMember[];
  analogues: ForecastRuntimeAnalogue[];
  diagnostics: {
    prefilteredEvents: number;
    safeCandidateEvents: number;
    selectedAnalogues: number;
    directAnalogueMembers: number;
    cannotPredictMembers: number;
  };
}

export class ForecastRuntimeError extends Error {
  constructor(readonly code: 'SOURCE_NOT_READY' | 'NO_SAFE_ANALOGUES' | 'NO_MEMBER_ANALOGUE_SUPPORT' | 'NO_ACTIVE_MEMBERS', message: string) {
    super(message);
  }
}

type ActiveMemberRow = {
  membership_id: string;
  legislator_id: string;
  member_name: string;
  party: string;
  district: string;
};

type HistoricalSupportRow = {
  legislator_id: string;
  party: string;
  yes: number;
  total: number;
};

type CandidateEventRow = {
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
  lexical_hits: number;
};

type DatedVersionRow = {
  id: string;
  version_key: string;
  published_at: string;
  raw_text: string;
  text_url: string | null;
};

type AnalogueVoteRow = {
  vote_event_id: string;
  legislator_id: string;
  party: string;
  choice: 'yea' | 'nay';
};

type RuntimeTargetVersion = {
  id: string;
  versionKey: string;
  publishedAt: string;
  text: string;
  companionIdentifier?: string;
};

function toCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sessionForSlug(slug: string) {
  const session = MINNESOTA_HOUSE_HISTORICAL_SESSIONS.find((candidate) => candidate.slug === slug);
  if (!session) throw new Error(`Unsupported Minnesota session slug: ${slug}`);
  return session;
}

function rateEvidence(yes: number, total: number): RateEvidence {
  return { yes, total };
}

function qualityForSupport(memberSupport: number, analogueSupport: number): ForecastRuntimeMember['evidenceQuality'] {
  if (memberSupport >= 20 && analogueSupport >= 1) return 'strong';
  if (memberSupport >= 5 || analogueSupport >= 0.5) return 'moderate';
  return 'limited';
}

function persistedEvidenceQuality(quality: ForecastRuntimeMember['evidenceQuality']): 'high' | 'medium' | 'low' {
  if (quality === 'strong') return 'high';
  if (quality === 'moderate') return 'medium';
  return 'low';
}

function uncertainty(probability: number | undefined): number | undefined {
  if (probability === undefined) return undefined;
  return 1 - Math.abs(probability - 0.5) * 2;
}

function candidateTokens(identity: BillFeatureIdentity): string[] {
  const candidates = [
    ...identity.features.titleTokens,
    ...identity.features.policyAreas,
    ...identity.features.actionTypes,
    ...identity.features.keywords.slice(0, 12),
  ].map((token) => token.toLowerCase().trim())
    .filter((token) => token.length >= 4 && !/^\d+$/.test(token));
  return [...new Set(candidates)].slice(0, 18);
}

async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function persistRevisorVersion(billId: string, version: RevisorBillVersionMetadata & { text: string; textSha256: string }): Promise<DatedVersionRow> {
  const result = await pool.query<DatedVersionRow>(`
    INSERT INTO bill_versions (bill_id, version_key, published_at, text_url, text_hash, raw_text, source_url)
    VALUES ($1, $2, $3::date, $4, $5, $6, $4)
    ON CONFLICT (bill_id, version_key) DO UPDATE SET
      published_at = EXCLUDED.published_at,
      text_url = EXCLUDED.text_url,
      text_hash = EXCLUDED.text_hash,
      raw_text = EXCLUDED.raw_text,
      source_url = EXCLUDED.source_url
    RETURNING id, version_key, published_at::text, raw_text, text_url`, [
    billId,
    version.versionKey,
    version.postedOn,
    version.textUrl,
    version.textSha256,
    version.text,
  ]);
  return result.rows[0];
}

async function existingDatedVersionAsOf(billId: string, occurredOn: string): Promise<DatedVersionRow | undefined> {
  const result = await pool.query<DatedVersionRow>(`
    SELECT id, version_key, published_at::text, raw_text, text_url
      FROM bill_versions
     WHERE bill_id = $1
       AND published_at IS NOT NULL
       AND published_at <= $2::date
       AND raw_text IS NOT NULL
       AND length(raw_text) >= 100
     ORDER BY published_at DESC, created_at DESC
     LIMIT 1`, [billId, occurredOn]);
  return result.rows[0];
}

async function targetVersionFromDatabase(billId: string, asOf: string): Promise<RuntimeTargetVersion | undefined> {
  const result = await pool.query<{ id: string; version_key: string; published_at: string | null; raw_text: string }>(`
    SELECT id, version_key, published_at::text, raw_text
      FROM bill_versions
     WHERE bill_id = $1
       AND raw_text IS NOT NULL
       AND length(raw_text) >= 100
     ORDER BY published_at DESC NULLS LAST,
              (version_key = 'latest') DESC,
              created_at DESC
     LIMIT 1`, [billId]);
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.id,
    versionKey: row.version_key,
    publishedAt: row.published_at ?? asOf,
    text: row.raw_text,
  };
}

async function ensureTargetBillVersion(subject: Extract<ForecastRuntimeSubject, { kind: 'bill' }>, asOf: string): Promise<RuntimeTargetVersion> {
  const session = sessionForSlug(subject.sessionSlug);
  try {
    const metadata = await fetchRevisorBill(session.sessionKey, subject.identifier, false);
    const current = metadata.versions.find((version) => metadata.currentVersion && version.versionKey === metadata.currentVersion)
      ?? metadata.versions.at(-1);
    if (current) {
      const fetched = await fetchRevisorBillVersion(current);
      const persisted = await persistRevisorVersion(subject.billId, fetched);
      return {
        id: persisted.id,
        versionKey: persisted.version_key,
        publishedAt: persisted.published_at,
        text: persisted.raw_text,
        companionIdentifier: metadata.companionIdentifier,
      };
    }
  } catch {
    // A current target may still be forecastable from the stored current text. Historical analogue
    // candidates never use this undated fallback; they require a dated version as of their vote.
  }

  const stored = await targetVersionFromDatabase(subject.billId, asOf);
  if (!stored) throw new ForecastRuntimeError('SOURCE_NOT_READY', 'The selected bill does not have usable official text yet.');
  return { ...stored, companionIdentifier: subject.companionIdentifier ?? undefined };
}

async function loadActiveMembers(sessionId: string, chamberId: string, asOfDate: string): Promise<ActiveMemberRow[]> {
  const result = await pool.query<ActiveMemberRow>(`
    SELECT m.id AS membership_id,
           m.legislator_id,
           l.name AS member_name,
           COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN') AS party,
           m.district
      FROM memberships m
      JOIN legislators l ON l.id = m.legislator_id
     WHERE m.session_id = $1
       AND m.chamber_id = $2
       AND (m.starts_on IS NULL OR m.starts_on <= $3::date)
       AND (m.ends_on IS NULL OR m.ends_on >= $3::date)
     ORDER BY m.district, l.name`, [sessionId, chamberId, asOfDate]);
  return result.rows;
}

async function loadHistoricalSupport(asOfDate: string, chamberId: string): Promise<{
  global: RateEvidence;
  parties: Map<string, RateEvidence>;
  members: Map<string, RateEvidence>;
}> {
  const result = await pool.query<HistoricalSupportRow>(`
    SELECT m.legislator_id,
           COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN') AS party,
           sum(CASE WHEN mv.choice = 'yea' THEN 1 ELSE 0 END)::int AS yes,
           count(*)::int AS total
      FROM member_votes mv
      JOIN vote_events ve ON ve.id = mv.vote_event_id
      JOIN memberships m ON m.id = mv.membership_id
     WHERE ve.is_passage = true
       AND ve.occurred_on < $1::date
       AND ve.chamber_id = $2
       AND mv.choice IN ('yea', 'nay')
     GROUP BY m.legislator_id, COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN')`, [asOfDate, chamberId]);

  const parties = new Map<string, RateEvidence>();
  const members = new Map<string, RateEvidence>();
  let globalYes = 0;
  let globalTotal = 0;
  for (const row of result.rows) {
    const yes = toCount(row.yes);
    const total = toCount(row.total);
    globalYes += yes;
    globalTotal += total;
    const party = parties.get(row.party) ?? rateEvidence(0, 0);
    party.yes += yes;
    party.total += total;
    parties.set(row.party, party);
    const member = members.get(row.legislator_id) ?? rateEvidence(0, 0);
    member.yes += yes;
    member.total += total;
    members.set(row.legislator_id, member);
  }
  return { global: rateEvidence(globalYes, globalTotal), parties, members };
}

async function prefilterCandidateEvents(tokens: string[], asOfDate: string, targetBillId?: string, companionIdentifier?: string): Promise<CandidateEventRow[]> {
  const result = await pool.query<CandidateEventRow>(`
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
           b.metadata #>> '{revisor,companionIdentifier}' AS companion_identifier,
           lexical.hits::int AS lexical_hits
      FROM vote_events ve
      JOIN bills b ON b.id = ve.bill_id
      JOIN legislative_sessions s ON s.id = ve.session_id
      JOIN chambers c ON c.id = ve.chamber_id
      CROSS JOIN LATERAL (
        SELECT count(*) AS hits
          FROM unnest($2::text[]) token
         WHERE lower(b.title) LIKE '%' || token || '%'
      ) lexical
     WHERE ve.is_passage = true
       AND ve.occurred_on < $1::date
       AND (
         lexical.hits > 0
         OR ($3::uuid IS NOT NULL AND b.id = $3::uuid)
         OR ($4::text IS NOT NULL AND b.identifier = $4::text)
       )
     ORDER BY CASE WHEN $3::uuid IS NOT NULL AND b.id = $3::uuid THEN 3
                   WHEN $4::text IS NOT NULL AND b.identifier = $4::text THEN 2
                   ELSE 1 END DESC,
              lexical.hits DESC,
              ve.occurred_on DESC,
              ve.id
     LIMIT ${MAX_PREFILTER_EVENTS}`, [asOfDate, tokens, targetBillId ?? null, companionIdentifier ?? null]);
  return result.rows;
}

function versionAsOf(metadata: RevisorBillMetadata, occurredOn: string): RevisorBillVersionMetadata | undefined {
  return [...metadata.versions]
    .filter((version) => version.postedOn <= occurredOn)
    .sort((a, b) => b.postedOn.localeCompare(a.postedOn) || b.ordinal - a.ordinal)[0];
}

async function loadSafeCandidates(events: readonly CandidateEventRow[]): Promise<HistoricalAnalogueCandidate[]> {
  const metadataCache = new Map<string, Promise<RevisorBillMetadata>>();
  const fetchedVersionCache = new Map<string, Promise<DatedVersionRow>>();

  const results = await mapWithConcurrency(events, REVISOR_CONCURRENCY, async (event): Promise<HistoricalAnalogueCandidate | undefined> => {
    let dated = await existingDatedVersionAsOf(event.bill_id, event.occurred_on);
    if (!dated) {
      const session = sessionForSlug(event.session_slug);
      const metadataKey = `${event.session_slug}:${event.identifier}`;
      let metadataPromise = metadataCache.get(metadataKey);
      if (!metadataPromise) {
        metadataPromise = fetchRevisorBill(session.sessionKey, event.identifier, false);
        metadataCache.set(metadataKey, metadataPromise);
      }
      try {
        const metadata = await metadataPromise;
        const version = versionAsOf(metadata, event.occurred_on);
        if (!version) return undefined;
        let versionPromise = fetchedVersionCache.get(version.textUrl);
        if (!versionPromise) {
          versionPromise = fetchRevisorBillVersion(version).then((fetched) => persistRevisorVersion(event.bill_id, fetched));
          fetchedVersionCache.set(version.textUrl, versionPromise);
        }
        dated = await versionPromise;
      } catch {
        return undefined;
      }
    }

    return {
      billId: event.bill_id,
      billVersionId: dated.id,
      identifier: event.identifier,
      session: event.session_slug,
      title: event.title,
      publishedAt: dated.published_at,
      companionIdentifier: event.companion_identifier ?? undefined,
      features: extractDeterministicBillFeatures({ title: event.title, text: dated.raw_text }),
      voteEventId: event.vote_event_id,
      occurredAt: `${event.occurred_on}T23:59:59Z`,
      chamber: event.chamber_slug,
      yeaCount: toCount(event.yea_count),
      nayCount: toCount(event.nay_count),
      passed: event.passed,
    };
  });

  return results.filter((candidate): candidate is HistoricalAnalogueCandidate => candidate !== undefined);
}

async function loadAnalogueVotes(eventIds: readonly string[]): Promise<AnalogueVoteRow[]> {
  if (eventIds.length === 0) return [];
  const result = await pool.query<AnalogueVoteRow>(`
    SELECT mv.vote_event_id,
           m.legislator_id,
           COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN') AS party,
           mv.choice
      FROM member_votes mv
      JOIN memberships m ON m.id = mv.membership_id
     WHERE mv.vote_event_id = ANY($1::uuid[])
       AND mv.choice IN ('yea', 'nay')`, [eventIds]);
  return result.rows;
}

function strongestReason(memberName: string, memberSupport: RateEvidence | undefined, analogue: ForecastRuntimeMember['analogue']): string {
  if (analogue) {
    return `${analogue.identifier} is the strongest selected analogue with a direct ${memberName} vote (${analogue.memberChoice === 'yea' ? 'Yes' : 'No'}).`;
  }
  if (memberSupport?.total) {
    return `${memberSupport.total} prior passage votes support the member estimate; no direct vote was found on the selected analogues.`;
  }
  return 'No direct member history or direct analogue vote is available; the estimate relies on broader historical support.';
}

function simulationForMembers(members: readonly ForecastRuntimeMember[], passageRule: PassageRule): ChamberSimulation | undefined {
  if (members.some((member) => member.yesProbability === undefined)) return undefined;
  return simulateChamber(members.map((member) => member.yesProbability as number), passageRule);
}

async function persistRevision(
  request: ForecastRuntimeRequest,
  targetVersionId: string | null,
  members: readonly ForecastRuntimeMember[],
  simulation: ChamberSimulation | undefined,
  passageRule: PassageRule,
  analogues: readonly ForecastRuntimeAnalogue[],
  diagnostics: ForecastRuntimeResult['diagnostics'],
  asOf: string,
): Promise<{ revisionId: string; revisionNumber: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM forecasts WHERE id = $1 FOR UPDATE', [request.forecastId]);
    const revisionNumberResult = await client.query<{ revision_number: number }>(
      'SELECT COALESCE(max(revision_number), 0)::int + 1 AS revision_number FROM forecast_revisions WHERE forecast_id = $1',
      [request.forecastId],
    );
    const revisionNumber = revisionNumberResult.rows[0]?.revision_number ?? 1;
    const metadata = {
      asOf,
      passageRule,
      requiredYes: simulation?.requiredYes ?? (passageRule.kind === 'absolute-majority' ? Math.floor(passageRule.seats / 2) + 1 : undefined),
      activeMemberCount: members.length,
      predictedMemberCount: members.filter((member) => member.yesProbability !== undefined).length,
      cannotPredictCount: diagnostics.cannotPredictMembers,
      billSpecific: true,
      calibration: 'off',
      memberProbabilityBounds: 'non-informative [0,1] until a validated interval model earns promotion',
      analogue: {
        selected: analogues,
        directMemberCoverage: members.length === 0 ? 0 : diagnostics.directAnalogueMembers / members.length,
      },
      procedure: {
        basis: 'Minnesota Constitution Article IV, Section 22: majority of all members elected',
        sourceUrl: 'https://www.revisor.mn.gov/constitution/#article_4',
      },
    };
    const revisionResult = await client.query<{ id: string }>(`
      INSERT INTO forecast_revisions (
        forecast_id, revision_number, research_mode, bill_version_id, generated_at,
        passage_probability, expected_yes, yes_low, yes_high, model_version, metadata
      ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10, $11::jsonb)
      RETURNING id`, [
      request.forecastId,
      revisionNumber,
      request.researchMode,
      targetVersionId,
      asOf,
      simulation?.passageProbability ?? null,
      simulation?.expectedYes ?? null,
      simulation?.yesLow ?? null,
      simulation?.yesHigh ?? null,
      MEMBER_MODEL_VERSION,
      JSON.stringify(metadata),
    ]);
    const revisionId = revisionResult.rows[0].id;
    await insertMemberPredictions(client, revisionId, members);
    await client.query(`UPDATE forecasts SET status = 'complete', updated_at = now() WHERE id = $1`, [request.forecastId]);
    await client.query('COMMIT');
    return { revisionId, revisionNumber };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function insertMemberPredictions(client: PoolClient, revisionId: string, members: readonly ForecastRuntimeMember[]): Promise<void> {
  if (members.length === 0) return;
  const values: unknown[] = [];
  const placeholders = members.map((member, index) => {
    const base = index * 11;
    const yesProbability = member.yesProbability ?? null;
    values.push(
      revisionId,
      member.membershipId,
      yesProbability,
      yesProbability === null ? null : 0,
      yesProbability === null ? null : 1,
      persistedEvidenceQuality(member.evidenceQuality),
      member.cannotPredictReason ?? null,
      member.strongestReason,
      JSON.stringify([{
        kind: 'model_support',
        global: member.support.global,
        party: member.support.party,
        member: member.support.member,
        analogue: member.support.analogue,
      }]),
      JSON.stringify(member.analogue ? [{ kind: 'historical_analogue', ...member.analogue }] : []),
      JSON.stringify([{ uncertainty: member.uncertainty, researched: member.researched }]),
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}::jsonb, $${base + 10}::jsonb, $${base + 11}::jsonb)`;
  });
  await client.query(`
    INSERT INTO forecast_member_predictions (
      revision_id, membership_id, yes_probability, probability_low, probability_high,
      evidence_quality, cannot_predict_reason, reasoning_summary, facts, inferences, context
    ) VALUES ${placeholders.join(', ')}`, values);
}

export async function executeRuntimeForecast(request: ForecastRuntimeRequest): Promise<ForecastRuntimeResult> {
  const asOf = request.asOf ?? new Date().toISOString();
  const asOfDate = asOf.slice(0, 10);
  const targetVersion = request.subject.kind === 'bill'
    ? await ensureTargetBillVersion(request.subject, asOf)
    : {
      id: `proposal:${request.subject.proposalId}`,
      versionKey: 'proposal',
      publishedAt: asOf,
      text: request.subject.text,
      companionIdentifier: undefined,
    };

  const targetIdentity: BillFeatureIdentity = {
    billId: request.subject.kind === 'bill' ? request.subject.billId : `proposal:${request.subject.proposalId}`,
    billVersionId: targetVersion.id,
    identifier: request.subject.kind === 'bill' ? request.subject.identifier : 'PROPOSAL',
    session: request.subject.sessionSlug,
    title: request.subject.title,
    publishedAt: targetVersion.publishedAt,
    companionIdentifier: targetVersion.companionIdentifier ?? (request.subject.kind === 'bill' ? request.subject.companionIdentifier ?? undefined : undefined),
    features: extractDeterministicBillFeatures({ title: request.subject.title, text: targetVersion.text }),
  };

  const [activeMembers, historicalSupport] = await Promise.all([
    loadActiveMembers(request.subject.sessionId, request.chamberId, asOfDate),
    loadHistoricalSupport(asOfDate, request.chamberId),
  ]);
  if (activeMembers.length === 0) throw new ForecastRuntimeError('NO_ACTIVE_MEMBERS', 'No active memberships are available for the selected chamber and as-of date.');

  const prefilteredEvents = await prefilterCandidateEvents(
    candidateTokens(targetIdentity),
    asOfDate,
    request.subject.kind === 'bill' ? request.subject.billId : undefined,
    targetIdentity.companionIdentifier,
  );
  const safeCandidates = await loadSafeCandidates(prefilteredEvents);
  if (safeCandidates.length === 0) {
    throw new ForecastRuntimeError('NO_SAFE_ANALOGUES', 'No dated, as-of-safe historical analogue text could be assembled for this measure.');
  }
  const selected = retrieveHistoricalAnalogues(targetIdentity, safeCandidates, asOf, { limit: MAX_ANALOGUES });
  if (selected.length === 0) {
    throw new ForecastRuntimeError('NO_SAFE_ANALOGUES', 'Historical candidates were available, but none met the substantive analogue threshold.');
  }

  const analogueByEvent = new Map(selected.map((analogue) => [analogue.candidate.voteEventId, analogue]));
  const analogueVotes = await loadAnalogueVotes([...analogueByEvent.keys()]);
  const votesByLegislator = new Map<string, AnalogueVoteRow[]>();
  for (const row of analogueVotes) {
    const rows = votesByLegislator.get(row.legislator_id) ?? [];
    rows.push(row);
    votesByLegislator.set(row.legislator_id, rows);
  }

  let directAnalogueMembers = 0;
  const members: ForecastRuntimeMember[] = activeMembers.map((member) => {
    const directRows = votesByLegislator.get(member.legislator_id) ?? [];
    let analogueYesWeight = 0;
    let analogueWeight = 0;
    let strongest: ForecastRuntimeMember['analogue'];
    for (const row of directRows) {
      const analogue = analogueByEvent.get(row.vote_event_id);
      if (!analogue) continue;
      analogueWeight += analogue.score;
      if (row.choice === 'yea') analogueYesWeight += analogue.score;
      if (!strongest || analogue.score > strongest.score) {
        strongest = {
          identifier: analogue.candidate.identifier,
          voteEventId: analogue.candidate.voteEventId,
          occurredOn: analogue.candidate.occurredAt.slice(0, 10),
          score: analogue.score,
          memberChoice: row.choice,
          reasons: analogue.reasons,
        };
      }
    }
    if (analogueWeight > 0) directAnalogueMembers += 1;
    const memberSupport = historicalSupport.members.get(member.legislator_id);
    const partySupport = historicalSupport.parties.get(member.party);
    const estimate = estimateMemberProbability({
      memberId: member.legislator_id,
      party: member.party,
      global: historicalSupport.global,
      partyHistory: partySupport,
      memberHistory: memberSupport,
      analogueYesRate: analogueWeight > 0 ? analogueYesWeight / analogueWeight : undefined,
      analogueEffectiveWeight: analogueWeight,
    });
    return {
      membershipId: member.membership_id,
      legislatorId: member.legislator_id,
      memberName: member.member_name,
      party: member.party,
      district: member.district,
      yesProbability: estimate.probability,
      cannotPredictReason: estimate.cannotPredictReason,
      evidenceQuality: qualityForSupport(memberSupport?.total ?? 0, analogueWeight),
      uncertainty: uncertainty(estimate.probability),
      support: estimate.support,
      analogue: strongest,
      strongestReason: strongestReason(member.member_name, memberSupport, strongest),
      researched: false,
    };
  });

  if (directAnalogueMembers === 0) {
    throw new ForecastRuntimeError('NO_MEMBER_ANALOGUE_SUPPORT', 'The selected analogues contain no direct votes from the active chamber membership, so VotePredict will not substitute a bill-insensitive prior.');
  }

  const passageRule: PassageRule = { kind: 'absolute-majority', seats: activeMembers.length };
  const simulation = simulationForMembers(members, passageRule);
  const requiredYes = simulation?.requiredYes ?? Math.floor(activeMembers.length / 2) + 1;
  const analogues: ForecastRuntimeAnalogue[] = selected.map((analogue) => ({
    voteEventId: analogue.candidate.voteEventId,
    billId: analogue.candidate.billId,
    identifier: analogue.candidate.identifier,
    title: analogue.candidate.title,
    chamber: analogue.candidate.chamber,
    occurredOn: analogue.candidate.occurredAt.slice(0, 10),
    score: analogue.score,
    similarity: analogue.similarity,
    relationship: analogue.relationship,
    reasons: analogue.reasons,
    yeaCount: analogue.candidate.yeaCount,
    nayCount: analogue.candidate.nayCount,
    passed: analogue.candidate.passed,
  }));
  const cannotPredictMembers = members.filter((member) => member.yesProbability === undefined).length;
  const diagnostics: ForecastRuntimeResult['diagnostics'] = {
    prefilteredEvents: prefilteredEvents.length,
    safeCandidateEvents: safeCandidates.length,
    selectedAnalogues: analogues.length,
    directAnalogueMembers,
    cannotPredictMembers,
  };
  const supportState: ForecastRuntimeResult['supportState'] = analogues.length >= 3 && directAnalogueMembers / members.length >= 0.5
    ? 'supported'
    : 'partial';
  const persisted = await persistRevision(
    request,
    request.subject.kind === 'bill' && !targetVersion.id.startsWith('proposal:') ? targetVersion.id : null,
    members,
    simulation,
    passageRule,
    analogues,
    diagnostics,
    asOf,
  );

  return {
    forecastId: request.forecastId,
    revisionId: persisted.revisionId,
    revisionNumber: persisted.revisionNumber,
    researchMode: request.researchMode,
    modelVersion: MEMBER_MODEL_VERSION,
    asOf,
    chamber: {
      id: request.chamberId,
      slug: request.chamberSlug,
      name: request.chamberName,
      activeMembers: members.length,
      passageRule,
      requiredYes,
      passageProbability: simulation?.passageProbability,
      expectedYes: simulation?.expectedYes,
      yesLow: simulation?.yesLow,
      yesHigh: simulation?.yesHigh,
    },
    supportState,
    members,
    analogues,
    diagnostics,
  };
}
