import type { EvidenceDraft } from './types';

export interface EvidenceImpactPolicyDecision {
  mechanicallyActionable: boolean;
  rationale: string;
}

export function evidenceImpactPolicy(draft: EvidenceDraft): EvidenceImpactPolicyDecision {
  if (!['supports', 'opposes'].includes(draft.stance)) {
    return { mechanicallyActionable: false, rationale: 'No directional support/opposition stance is established.' };
  }
  if (draft.kind === 'inference') {
    return { mechanicallyActionable: false, rationale: 'Model inference is retained separately and cannot feed itself back as evidence.' };
  }
  if (draft.relevance === 'low') {
    return { mechanicallyActionable: false, rationale: 'Low-relevance evidence is stored for context but excluded from probability impact.' };
  }
  if (draft.sourceQuality === 'unknown') {
    return { mechanicallyActionable: false, rationale: 'Unknown-source evidence requires verification before it can affect a probability.' };
  }
  if (draft.confidence !== undefined && draft.confidence < 0.5) {
    return { mechanicallyActionable: false, rationale: 'Extraction confidence is below the initial impact threshold.' };
  }
  return { mechanicallyActionable: true, rationale: 'Directional evidence passed the initial provenance, relevance, and confidence checks.' };
}
