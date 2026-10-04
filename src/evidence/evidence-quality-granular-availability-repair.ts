export const EVIDENCE_QUALITY_GRANULAR_AVAILABILITY_PATCH_KEYS = [
  'historicalAvailabilityVersion',
  'availabilityProof',
  'availableAt',
  'canonicalSourceUrl',
  'archiveUrl',
  'archiveCapturedAt',
  'sourceContentSha256',
  'availabilityScope',
  'availabilityContentIdentity',
  'availabilityProofExcerptFingerprint',
  'availabilityProofArchiveContentSha256',
  'availabilityProofCanonicalArtifactId',
  'availabilityProofCanonicalArtifactDigest',
  'asOfEligible',
] as const;

// These fields indicate that evidence-item-scoped archive proof metadata already exists.
// Background ingestion metadata such as asOfEligible=false, canonicalSourceUrl, or
// sourceContentSha256 can predate granular proof and must not alone be treated as a conflict.
export const EVIDENCE_QUALITY_GRANULAR_AVAILABILITY_PROOF_KEYS = [
  'availabilityProof',
  'availableAt',
  'archiveUrl',
  'archiveCapturedAt',
  'availabilityScope',
  'availabilityContentIdentity',
  'availabilityProofExcerptFingerprint',
  'availabilityProofArchiveContentSha256',
  'availabilityProofCanonicalArtifactId',
  'availabilityProofCanonicalArtifactDigest',
] as const;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

export function evidenceQualityGranularAvailabilityPatchSubset(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of EVIDENCE_QUALITY_GRANULAR_AVAILABILITY_PATCH_KEYS) {
    if (metadata && Object.prototype.hasOwnProperty.call(metadata, key)) result[key] = metadata[key];
  }
  return result;
}

export function sameEvidenceQualityGranularAvailabilityPatch(
  existing: Record<string, unknown> | null | undefined,
  planned: Record<string, unknown>,
): boolean {
  return canonicalJson(evidenceQualityGranularAvailabilityPatchSubset(existing))
    === canonicalJson(evidenceQualityGranularAvailabilityPatchSubset(planned));
}

export function hasEvidenceQualityGranularAvailabilityProofMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return EVIDENCE_QUALITY_GRANULAR_AVAILABILITY_PROOF_KEYS.some(
    (key) => metadata && Object.prototype.hasOwnProperty.call(metadata, key),
  );
}
