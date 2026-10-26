import { createHash } from 'node:crypto';
import type { EvidenceDraft } from './types';

/** Supplied by a trusted source verifier, never copied from LLM output or legacy flags. */
export interface VerifiedImpactProof {
  version: 'content-bound-impact-v1';
  sourceUrl: string;
  sourceContentSha256: string;
  excerptSha256: string;
  membershipId: string;
  billId: string;
  availableAt: string;
  observedAt: string;
  basis: 'authenticated_archive' | 'official_exact_record' | 'contemporaneous_observation';
  attributionVerified: true;
}

export function impactProofError(draft: EvidenceDraft, proof: VerifiedImpactProof | undefined, asOf: string | undefined): string | undefined {
  const cutoff = Date.parse(asOf ?? '');
  if (!Number.isFinite(cutoff) || !proof || proof.version !== 'content-bound-impact-v1') return 'Positive content-bound availability proof and forecast cutoff are required.';
  if (draft.metadata?.sourceVerified !== true) return 'Positive source verification is required.';
  if (!draft.excerpt || !draft.targetMembershipId || !draft.targetBillId
    || proof.sourceUrl !== draft.sourceUrl || proof.membershipId !== draft.targetMembershipId || proof.billId !== draft.targetBillId
    || !/^[a-f0-9]{64}$/.test(proof.sourceContentSha256)
    || proof.excerptSha256 !== createHash('sha256').update(draft.excerpt).digest('hex')
    || proof.attributionVerified !== true) return 'The verified source, literal, person and bill must match the evidence.';
  if (!['authenticated_archive','official_exact_record','contemporaneous_observation'].includes(proof.basis)) return 'Unsupported availability proof basis.';
  const available = Date.parse(proof.availableAt), observed = Date.parse(proof.observedAt);
  if (!Number.isFinite(available) || !Number.isFinite(observed) || available >= cutoff || observed >= cutoff
    || (proof.basis === 'contemporaneous_observation' && available < observed)) return 'Verified availability and observation must precede the forecast cutoff.';
  if (draft.publishedAt && (!Number.isFinite(Date.parse(draft.publishedAt)) || Date.parse(draft.publishedAt) >= cutoff)) return 'Evidence publication must precede the forecast cutoff.';
  return undefined;
}
