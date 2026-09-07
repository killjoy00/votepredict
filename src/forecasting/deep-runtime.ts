import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AiGatewayDeepResearchProvider } from '@/evidence/ai-gateway-provider';
import type { DeepForecastMember } from '@/evidence/deep-revision';
import { runPersistedDeepResearch } from '@/evidence/persisted-deep-research';
import type { DeepResearchSourceReference } from '@/evidence/provider';
import { failResearchRun } from '@/evidence/repository';
import { pool } from '@/lib/db';
import { MEMBER_MODEL_VERSION } from './member-model';
import type { ForecastRuntimeMember, ForecastRuntimeRequest, ForecastRuntimeResult } from './runtime';

const DEEP_TARGET_LIMIT = 12;

export interface DeepRuntimeEvidence {
  sourceUrl: string;
  publishedAt?: string;
  kind: string;
  stance: string;
  claim: string;
  excerpt?: string;
  sourceQuality: string;
  relevance: string;
  freshness: string;
  confidence?: number;
  disposition: 'included' | 'excluded';
  rationale: string;
}

export interface DeepRuntimeMemberResearch {
  targeted: boolean;
  rank?: number;
  rationale?: string;
  pivotality?: number;
  uncertainty?: number;
  evidenceGap?: number;
  priorityScore?: number;
  probabilityBefore?: number;
  probabilityAfter?: number;
  appliedEvidenceCount: number;
  excludedEvidenceCount: number;
  evidence: DeepRuntimeEvidence[];
}

export interface DeepRuntimeMember extends ForecastRuntimeMember {
  deepResearch?: DeepRuntimeMemberResearch;
}

export interface DeepRuntimeResult extends Omit<ForecastRuntimeResult, 'researchMode' | 'modelVersion' | 'members'> {
  researchMode: 'deep';
  modelVersion: string;
  members: DeepRuntimeMember[];
  research: {
    baseRevisionId: string;
    researchRunId: string;
    provider: string;
    providerVersion?: string;
    targetCount: number;
    evidenceCount: number;
    includedEvidenceCount: number;
    excludedEvidenceCount: number;
    contradictions: number;
    duplicates: number;
    chamberPassageMovement?: number;
    sources: Array<{ id: string; url: string; title?: string }>;
    providerDiagnostics?: Record<string, unknown>;
  };
}

function evidenceQualityScore(quality: ForecastRuntimeMember['evidenceQuality']): number {
  if (quality === 'strong') return 0.9;
  if (quality === 'moderate') return 0.6;
  return 0.3;
}

function persistedEvidenceQuality(quality: ForecastRuntimeMember['evidenceQuality']): 'high' | 'medium' | 'low' {
  if (quality === 'strong') return 'high';
  if (quality === 'moderate') return 'medium';
  return 'low';
}

function probabilityUncertainty(probability: number | undefined): number | undefined {
  if (probability === undefined) return undefined;
  return 1 - Math.abs(probability - 0.5) * 2;
}

async function createDeepRevisionSkeleton(forecastId: string, baseRevisionId: string, asOf: string): Promise<{ id: string; revisionNumber: number; billVersionId: string | null }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM forecasts WHERE id = $1 FOR UPDATE', [forecastId]);
    const baseResult = await client.query<{ bill_version_id: string | null }>(
      'SELECT bill_version_id FROM forecast_revisions WHERE id = $1 AND forecast_id = $2',
      [baseRevisionId, forecastId],
    );
    if (!baseResult.rows[0]) throw new Error('Deep research base revision was not found');
    const numberResult = await client.query<{ revision_number: number }>(
      'SELECT COALESCE(max(revision_number), 0)::int + 1 AS revision_number FROM forecast_revisions WHERE forecast_id = $1',
      [forecastId],
    );
    const revisionNumber = numberResult.rows[0]?.revision_number ?? 1;
    const result = await client.query<{ id: string }>(`
      INSERT INTO forecast_revisions (
        forecast_id, revision_number, research_mode, bill_version_id, generated_at,
        passage_probability, expected_yes, yes_low, yes_high, model_version, metadata
      ) VALUES ($1, $2, 'deep', $3, $4::timestamptz, NULL, NULL, NULL, NULL, $5, $6::jsonb)
      RETURNING id`, [
      forecastId,
      revisionNumber,
      baseResult.rows[0].bill_version_id,
      asOf,
      MEMBER_MODEL_VERSION,
      JSON.stringify({ status: 'researching', baseRevisionId, asOf }),
    ]);
    await client.query('COMMIT');
    return { id: result.rows[0].id, revisionNumber, billVersionId: baseResult.rows[0].bill_version_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function markDeepRevisionFailed(revisionId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await pool.query(`
    UPDATE forecast_revisions
       SET metadata = metadata || $2::jsonb
     WHERE id = $1`, [revisionId, JSON.stringify({ status: 'failed', error: message.slice(0, 1600) })]);
}

async function materializeResearchSource(
  reference: DeepResearchSourceReference,
  request: ForecastRuntimeRequest,
): Promise<string> {
  const response = await fetch(reference.url, {
    headers: { 'User-Agent': 'VotePredict/2.0 source provenance fetcher' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Could not materialize research source (${response.status}): ${reference.url}`);
  const content = await response.text();
  if (content.length === 0) throw new Error(`Research source returned no content: ${reference.url}`);
  const contentSha256 = createHash('sha256').update(content).digest('hex');
  const result = await pool.query<{ id: string }>(`
    INSERT INTO source_documents (
      jurisdiction_id, session_id, chamber_id, source_kind, source_url, fetched_at,
      content_sha256, http_status, metadata
    )
    SELECT s.jurisdiction_id, $1, $2, 'deep_research_web', $3, now(), $4, $5, $6::jsonb
      FROM legislative_sessions s
     WHERE s.id = $1
    ON CONFLICT (source_url, content_sha256) DO UPDATE SET
      fetched_at = EXCLUDED.fetched_at,
      http_status = EXCLUDED.http_status,
      metadata = source_documents.metadata || EXCLUDED.metadata
    RETURNING id`, [
    request.subject.sessionId,
    request.chamberId,
    reference.url,
    contentSha256,
    response.status,
    JSON.stringify({ sourceReferenceId: reference.id, title: reference.title ?? null }),
  ]);
  if (!result.rows[0]) throw new Error(`Could not persist research source provenance: ${reference.url}`);
  return result.rows[0].id;
}

function memberResearchRows(
  base: ForecastRuntimeResult,
  execution: Awaited<ReturnType<typeof runPersistedDeepResearch>>['execution'],
): DeepRuntimeMember[] {
  const targetByMember = new Map(execution.targets.map((target) => [target.membershipId, target]));
  const updateByMember = new Map(execution.memberUpdates.map((update) => [update.membershipId, update]));

  return base.members.map((member): DeepRuntimeMember => {
    const target = targetByMember.get(member.membershipId);
    const update = updateByMember.get(member.membershipId);
    const evidence: DeepRuntimeEvidence[] = (update?.evidence ?? []).map((item, index) => {
      const decision = update?.evidenceDecisions[index];
      return {
        sourceUrl: item.sourceUrl,
        publishedAt: item.publishedAt,
        kind: item.kind,
        stance: item.stance,
        claim: item.claim,
        excerpt: item.excerpt,
        sourceQuality: item.sourceQuality,
        relevance: item.relevance,
        freshness: item.freshness,
        confidence: item.confidence,
        disposition: decision?.mechanicallyActionable ? 'included' : 'excluded',
        rationale: decision?.rationale ?? 'No mechanical evidence decision was available.',
      };
    });
    const strongestIncluded = evidence.find((item) => item.disposition === 'included' && item.kind === 'direct_statement')
      ?? evidence.find((item) => item.disposition === 'included');
    const nextProbability = update?.probabilityAfter ?? member.yesProbability;
    return {
      ...member,
      yesProbability: nextProbability,
      uncertainty: probabilityUncertainty(nextProbability),
      researched: Boolean(target),
      strongestReason: strongestIncluded
        ? `Deep evidence: ${strongestIncluded.claim}`
        : target
          ? `Deep research found no mechanically actionable evidence. ${member.strongestReason}`
          : member.strongestReason,
      deepResearch: target ? {
        targeted: true,
        rank: target.rank,
        rationale: target.rationale,
        pivotality: target.pivotality,
        uncertainty: target.uncertainty,
        evidenceGap: target.evidenceGap,
        priorityScore: target.priorityScore,
        probabilityBefore: update?.probabilityBefore,
        probabilityAfter: update?.probabilityAfter,
        appliedEvidenceCount: update?.appliedEvidenceCount ?? 0,
        excludedEvidenceCount: update?.excludedEvidenceCount ?? 0,
        evidence,
      } : undefined,
    };
  });
}

async function insertDeepMemberPredictions(client: PoolClient, revisionId: string, members: readonly DeepRuntimeMember[]): Promise<void> {
  await client.query('DELETE FROM forecast_member_predictions WHERE revision_id = $1', [revisionId]);
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
      JSON.stringify([
        ...(member.analogue ? [{ kind: 'historical_analogue', ...member.analogue }] : []),
        ...(member.deepResearch?.evidence ?? []).map((item) => ({ ...item, recordKind: 'deep_evidence' })),
      ]),
      JSON.stringify([{
        uncertainty: member.uncertainty,
        researched: member.researched,
        deepResearch: member.deepResearch ? {
          rank: member.deepResearch.rank,
          rationale: member.deepResearch.rationale,
          pivotality: member.deepResearch.pivotality,
          evidenceGap: member.deepResearch.evidenceGap,
          appliedEvidenceCount: member.deepResearch.appliedEvidenceCount,
          excludedEvidenceCount: member.deepResearch.excludedEvidenceCount,
        } : null,
      }]),
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}::jsonb, $${base + 10}::jsonb, $${base + 11}::jsonb)`;
  });
  await client.query(`
    INSERT INTO forecast_member_predictions (
      revision_id, membership_id, yes_probability, probability_low, probability_high,
      evidence_quality, cannot_predict_reason, reasoning_summary, facts, inferences, context
    ) VALUES ${placeholders.join(', ')}`, values);
}

async function finalizeDeepRevision(
  request: ForecastRuntimeRequest,
  skeleton: { id: string; revisionNumber: number },
  base: ForecastRuntimeResult,
  researchRunId: string,
  execution: Awaited<ReturnType<typeof runPersistedDeepResearch>>['execution'],
  members: readonly DeepRuntimeMember[],
): Promise<void> {
  const simulation = execution.chamberAfter;
  const modelVersion = `${MEMBER_MODEL_VERSION}+${execution.providerVersion ?? execution.provider}`;
  const includedEvidenceCount = execution.memberUpdates.reduce((sum, update) => sum + update.appliedEvidenceCount, 0);
  const excludedEvidenceCount = execution.memberUpdates.reduce((sum, update) => sum + update.excludedEvidenceCount, 0);
  const contradictions = execution.diagnostics.evidence.relationships.filter((relation) => relation.kind === 'contradicts').length;
  const duplicates = execution.diagnostics.evidence.relationships.filter((relation) => relation.kind === 'duplicates').length;
  const chamberPassageMovement = execution.chamberBefore && execution.chamberAfter
    ? execution.chamberAfter.passageProbability - execution.chamberBefore.passageProbability
    : undefined;
  const metadata = {
    status: 'ready',
    asOf: base.asOf,
    baseRevisionId: base.revisionId,
    researchRunId,
    passageRule: base.chamber.passageRule,
    requiredYes: base.chamber.requiredYes,
    memberProbabilityBounds: 'non-informative [0,1] until a validated interval model earns promotion',
    provider: execution.provider,
    providerVersion: execution.providerVersion,
    targets: execution.targets,
    diagnostics: execution.diagnostics,
    chamberBefore: execution.chamberBefore ? {
      passageProbability: execution.chamberBefore.passageProbability,
      expectedYes: execution.chamberBefore.expectedYes,
      yesLow: execution.chamberBefore.yesLow,
      yesHigh: execution.chamberBefore.yesHigh,
    } : null,
    chamberAfter: execution.chamberAfter ? {
      passageProbability: execution.chamberAfter.passageProbability,
      expectedYes: execution.chamberAfter.expectedYes,
      yesLow: execution.chamberAfter.yesLow,
      yesHigh: execution.chamberAfter.yesHigh,
    } : null,
    chamberPassageMovement,
    includedEvidenceCount,
    excludedEvidenceCount,
    contradictions,
    duplicates,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      UPDATE forecast_revisions
         SET generated_at = $2::timestamptz,
             passage_probability = $3,
             expected_yes = $4,
             yes_low = $5,
             yes_high = $6,
             model_version = $7,
             metadata = $8::jsonb
       WHERE id = $1`, [
      skeleton.id,
      base.asOf,
      simulation?.passageProbability ?? null,
      simulation?.expectedYes ?? null,
      simulation?.yesLow ?? null,
      simulation?.yesHigh ?? null,
      modelVersion,
      JSON.stringify(metadata),
    ]);
    await insertDeepMemberPredictions(client, skeleton.id, members);
    await client.query(`UPDATE forecasts SET status = 'complete', updated_at = now() WHERE id = $1`, [request.forecastId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function executeDeepRuntimeForecast(
  request: ForecastRuntimeRequest,
  base: ForecastRuntimeResult,
): Promise<DeepRuntimeResult> {
  if (request.researchMode !== 'deep') throw new Error('Deep runtime requires researchMode=deep');
  const skeleton = await createDeepRevisionSkeleton(request.forecastId, base.revisionId, base.asOf);
  const deepMembers: DeepForecastMember[] = base.members.map((member) => ({
    membershipId: member.membershipId,
    memberName: member.memberName,
    party: member.party,
    district: member.district,
    yesProbability: member.yesProbability,
    cannotPredictReason: member.cannotPredictReason,
    evidenceQuality: evidenceQualityScore(member.evidenceQuality),
  }));
  const provider = new AiGatewayDeepResearchProvider();

  try {
    const persisted = await runPersistedDeepResearch(deepMembers, {
      forecastId: request.forecastId,
      billId: request.subject.kind === 'bill' ? request.subject.billId : undefined,
      proposalId: request.subject.kind === 'proposal' ? request.subject.proposalId : undefined,
      chamberId: request.chamberId,
      asOf: base.asOf,
      passageRule: base.chamber.passageRule,
      targetLimit: DEEP_TARGET_LIMIT,
      subject: {
        identifier: request.subject.kind === 'bill' ? request.subject.identifier : undefined,
        title: request.subject.title,
        summary: request.subject.kind === 'proposal' ? request.subject.text.slice(0, 4_000) : undefined,
        sourceUrl: request.subject.kind === 'bill' ? request.subject.sourceUrl ?? undefined : undefined,
      },
    }, provider, {
      baseRevisionId: base.revisionId,
      resultRevisionId: skeleton.id,
      configuration: { targetLimit: DEEP_TARGET_LIMIT, model: process.env.VOTEPREDICT_DEEP_MODEL ?? 'default' },
      materializeSource: (reference) => materializeResearchSource(reference, request),
    });

    const members = memberResearchRows(base, persisted.execution);
    try {
      await finalizeDeepRevision(request, skeleton, base, persisted.researchRunId, persisted.execution, members);
    } catch (error) {
      await failResearchRun(persisted.researchRunId, error);
      throw error;
    }

    const simulation = persisted.execution.chamberAfter;
    const includedEvidenceCount = persisted.execution.memberUpdates.reduce((sum, update) => sum + update.appliedEvidenceCount, 0);
    const excludedEvidenceCount = persisted.execution.memberUpdates.reduce((sum, update) => sum + update.excludedEvidenceCount, 0);
    const contradictions = persisted.execution.diagnostics.evidence.relationships.filter((relation) => relation.kind === 'contradicts').length;
    const duplicates = persisted.execution.diagnostics.evidence.relationships.filter((relation) => relation.kind === 'duplicates').length;
    const chamberPassageMovement = persisted.execution.chamberBefore && persisted.execution.chamberAfter
      ? persisted.execution.chamberAfter.passageProbability - persisted.execution.chamberBefore.passageProbability
      : undefined;

    return {
      ...base,
      revisionId: skeleton.id,
      revisionNumber: skeleton.revisionNumber,
      researchMode: 'deep',
      modelVersion: `${MEMBER_MODEL_VERSION}+${persisted.execution.providerVersion ?? persisted.execution.provider}`,
      chamber: {
        ...base.chamber,
        passageProbability: simulation?.passageProbability,
        expectedYes: simulation?.expectedYes,
        yesLow: simulation?.yesLow,
        yesHigh: simulation?.yesHigh,
      },
      members,
      research: {
        baseRevisionId: base.revisionId,
        researchRunId: persisted.researchRunId,
        provider: persisted.execution.provider,
        providerVersion: persisted.execution.providerVersion,
        targetCount: persisted.execution.targets.length,
        evidenceCount: persisted.execution.evidence.length,
        includedEvidenceCount,
        excludedEvidenceCount,
        contradictions,
        duplicates,
        chamberPassageMovement,
        sources: persisted.execution.sourceReferences,
        providerDiagnostics: persisted.execution.diagnostics.providerDiagnostics,
      },
    };
  } catch (error) {
    await markDeepRevisionFailed(skeleton.id, error);
    throw error;
  }
}
