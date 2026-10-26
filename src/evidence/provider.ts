import type { EvidenceDraft } from './types';
import type { VerifiedImpactProof } from './verified-impact-proof';

export interface DeepResearchSubject {
  identifier?: string;
  title: string;
  summary?: string;
  sourceUrl?: string;
}

export interface DeepResearchSourceReference {
  id: string;
  url: string;
  title?: string;
}

export interface DeepResearchRequest {
  forecastId: string;
  billId?: string;
  proposalId?: string;
  chamberId: string;
  asOf: string;
  subject?: DeepResearchSubject;
  targets: readonly {
    membershipId: string;
    memberName?: string;
    party?: string;
    district?: string;
    yesProbability?: number;
    rationale: string;
  }[];
}

export interface DeepResearchProviderResult {
  provider: string;
  providerVersion?: string;
  evidence: EvidenceDraft[];
  sourceReferences?: DeepResearchSourceReference[];
  diagnostics?: Record<string, unknown>;
  /** Trusted verifier output; the gateway's model schema cannot supply these receipts. */
  verifiedImpactProofs?: readonly VerifiedImpactProof[];
}

export interface DeepResearchProvider {
  readonly name: string;
  readonly version?: string;
  research(request: DeepResearchRequest): Promise<DeepResearchProviderResult>;
}
