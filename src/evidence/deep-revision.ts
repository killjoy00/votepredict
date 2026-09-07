import { simulateChamber, type ChamberSimulation, type PassageRule } from '../forecasting/chamber';
import { diagnoseEvidence, type EvidenceDiagnostics } from './diagnostics';
import { applyEvidenceSignals } from './impact';
import type { DeepResearchProvider, DeepResearchProviderResult } from './provider';
import { selectDeepResearchTargets, type DeepResearchCandidate } from './targeting';
import type { DeepResearchTarget, EvidenceDraft, EvidenceSignal } from './types';

export interface DeepForecastMember extends DeepResearchCandidate {
  memberName?: string;
  party?: string;
  district?: string;
}

export interface DeepResearchContext {
  forecastId: string;
  billId?: string;
  proposalId?: string;
  chamberId: string;
  asOf: string;
  passageRule: PassageRule;
  targetLimit?: number;
}

export interface DeepMemberUpdate {
  membershipId: string;
  probabilityBefore?: number;
  probabilityAfter?: number;
  totalLogitDelta?: number;
  evidenceCount: number;
  evidence: EvidenceDraft[];
}

export interface DeepResearchExecution {
  provider: string;
  providerVersion?: string;
  targets: DeepResearchTarget[];
  evidence: EvidenceDraft[];
  memberUpdates: DeepMemberUpdate[];
  chamberBefore?: ChamberSimulation;
  chamberAfter?: ChamberSimulation;
  diagnostics: {
    unscopedEvidence: number;
    unresolvedMembers: number;
    evidence: EvidenceDiagnostics;
    providerDiagnostics?: Record<string, unknown>;
  };
}

function evidenceSignal(draft: EvidenceDraft): EvidenceSignal {
  return {
    kind: draft.kind,
    stance: draft.stance,
    sourceQuality: draft.sourceQuality,
    relevance: draft.relevance,
    freshness: draft.freshness,
    confidence: draft.confidence,
  };
}

export function planDeepResearch(
  members: readonly DeepForecastMember[],
  context: Pick<DeepResearchContext, 'passageRule' | 'targetLimit'>,
): DeepResearchTarget[] {
  return selectDeepResearchTargets(members, context.passageRule, { limit: context.targetLimit ?? 12 });
}

function chamberSimulation(members: readonly { yesProbability?: number }[], rule: PassageRule): ChamberSimulation | undefined {
  if (members.some((member) => member.yesProbability === undefined)) return undefined;
  return simulateChamber(members.map((member) => member.yesProbability as number), rule);
}

export async function executeDeepResearch(
  members: readonly DeepForecastMember[],
  context: DeepResearchContext,
  provider: DeepResearchProvider,
): Promise<DeepResearchExecution> {
  const targets = planDeepResearch(members, context);
  const memberById = new Map(members.map((member) => [member.membershipId, member]));
  const providerResult: DeepResearchProviderResult = await provider.research({
    forecastId: context.forecastId,
    billId: context.billId,
    proposalId: context.proposalId,
    chamberId: context.chamberId,
    asOf: context.asOf,
    targets: targets.map((target) => {
      const member = memberById.get(target.membershipId);
      return {
        membershipId: target.membershipId,
        memberName: member?.memberName,
        party: member?.party,
        district: member?.district,
        yesProbability: member?.yesProbability,
        rationale: target.rationale,
      };
    }),
  });

  const targetedIds = new Set(targets.map((target) => target.membershipId));
  const scopedEvidence = new Map<string, EvidenceDraft[]>();
  for (const draft of providerResult.evidence) {
    if (!draft.targetMembershipId || !targetedIds.has(draft.targetMembershipId)) continue;
    const rows = scopedEvidence.get(draft.targetMembershipId) ?? [];
    rows.push(draft);
    scopedEvidence.set(draft.targetMembershipId, rows);
  }

  const memberUpdates: DeepMemberUpdate[] = members.map((member) => {
    const evidence = scopedEvidence.get(member.membershipId) ?? [];
    if (member.yesProbability === undefined || evidence.length === 0) {
      return {
        membershipId: member.membershipId,
        probabilityBefore: member.yesProbability,
        probabilityAfter: member.yesProbability,
        evidenceCount: evidence.length,
        evidence,
      };
    }
    const impact = applyEvidenceSignals(member.yesProbability, evidence.map(evidenceSignal));
    return {
      membershipId: member.membershipId,
      probabilityBefore: member.yesProbability,
      probabilityAfter: impact.probability,
      totalLogitDelta: impact.totalLogitDelta,
      evidenceCount: evidence.length,
      evidence,
    };
  });

  const afterMembers = members.map((member) => {
    const update = memberUpdates.find((row) => row.membershipId === member.membershipId);
    return { yesProbability: update?.probabilityAfter };
  });
  const evidenceDiagnostics = diagnoseEvidence(providerResult.evidence);

  return {
    provider: providerResult.provider,
    providerVersion: providerResult.providerVersion,
    targets,
    evidence: providerResult.evidence,
    memberUpdates,
    chamberBefore: chamberSimulation(members, context.passageRule),
    chamberAfter: chamberSimulation(afterMembers, context.passageRule),
    diagnostics: {
      unscopedEvidence: providerResult.evidence.filter((draft) => !draft.targetMembershipId || !targetedIds.has(draft.targetMembershipId)).length,
      unresolvedMembers: memberUpdates.filter((update) => update.probabilityAfter === undefined).length,
      evidence: evidenceDiagnostics,
      providerDiagnostics: providerResult.diagnostics,
    },
  };
}
