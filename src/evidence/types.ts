export type EvidenceKind = 'direct_statement' | 'related_statement' | 'fact' | 'context' | 'inference';
export type EvidenceStance = 'supports' | 'opposes' | 'mixed' | 'neutral' | 'unclear';
export type EvidenceSourceQuality = 'official' | 'member_primary' | 'reputable_secondary' | 'other' | 'unknown';
export type EvidenceRelevance = 'direct' | 'high' | 'medium' | 'low';
export type EvidenceFreshness = 'current' | 'recent' | 'stale' | 'unknown';

export interface EvidenceSignal {
  evidenceId?: string;
  kind: EvidenceKind;
  stance: EvidenceStance;
  sourceQuality: EvidenceSourceQuality;
  relevance: EvidenceRelevance;
  freshness: EvidenceFreshness;
  confidence?: number;
}

export interface EvidenceDraft {
  sourceUrl: string;
  publishedAt?: string;
  kind: EvidenceKind;
  stance: EvidenceStance;
  claim: string;
  excerpt?: string;
  sourceQuality: EvidenceSourceQuality;
  relevance: EvidenceRelevance;
  freshness: EvidenceFreshness;
  confidence?: number;
  targetMembershipId?: string;
  targetBillId?: string;
  metadata?: Record<string, unknown>;
}

export interface DeepResearchTarget {
  membershipId: string;
  rank: number;
  pivotality: number;
  uncertainty: number;
  evidenceGap: number;
  priorityScore: number;
  rationale: string;
}
