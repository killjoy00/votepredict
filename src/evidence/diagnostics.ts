import type { EvidenceDraft } from './types';

export type SuggestedEvidenceRelationKind = 'contradicts' | 'duplicates';

export interface SuggestedEvidenceRelationship {
  fromIndex: number;
  toIndex: number;
  kind: SuggestedEvidenceRelationKind;
  reason: string;
}

export interface EvidenceDiagnostics {
  relationships: SuggestedEvidenceRelationship[];
  unscopedItems: number;
  lowConfidenceItems: number;
}

function normalizeClaim(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function opposingStances(a: EvidenceDraft['stance'], b: EvidenceDraft['stance']): boolean {
  return (a === 'supports' && b === 'opposes') || (a === 'opposes' && b === 'supports');
}

function sameTarget(a: EvidenceDraft, b: EvidenceDraft): boolean {
  return Boolean(a.targetMembershipId && b.targetMembershipId && a.targetMembershipId === b.targetMembershipId)
    || Boolean(a.targetBillId && b.targetBillId && a.targetBillId === b.targetBillId);
}

export function diagnoseEvidence(evidence: readonly EvidenceDraft[]): EvidenceDiagnostics {
  const relationships: SuggestedEvidenceRelationship[] = [];
  for (let fromIndex = 0; fromIndex < evidence.length; fromIndex += 1) {
    for (let toIndex = fromIndex + 1; toIndex < evidence.length; toIndex += 1) {
      const from = evidence[fromIndex];
      const to = evidence[toIndex];
      if (normalizeClaim(from.claim) === normalizeClaim(to.claim) && sameTarget(from, to)) {
        relationships.push({
          fromIndex,
          toIndex,
          kind: 'duplicates',
          reason: 'Normalized claims are identical for the same target.',
        });
        continue;
      }
      if (sameTarget(from, to)
        && opposingStances(from.stance, to.stance)
        && ['direct_statement', 'related_statement'].includes(from.kind)
        && ['direct_statement', 'related_statement'].includes(to.kind)) {
        relationships.push({
          fromIndex,
          toIndex,
          kind: 'contradicts',
          reason: 'Directional statement evidence points in opposite directions for the same target.',
        });
      }
    }
  }
  return {
    relationships,
    unscopedItems: evidence.filter((item) => !item.targetMembershipId && !item.targetBillId).length,
    lowConfidenceItems: evidence.filter((item) => item.confidence !== undefined && item.confidence < 0.5).length,
  };
}
