import type { EvidenceDraft } from './types';

export interface DeepResearchSubject {
  identifier?: string;
  title: string;
  summary?: string;
  sourceUrl?: string;
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
  diagnostics?: Record<string, unknown>;
}

export interface DeepResearchProvider {
  readonly name: string;
  readonly version?: string;
  research(request: DeepResearchRequest): Promise<DeepResearchProviderResult>;
}
