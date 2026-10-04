export const SESSION_DAILY_LEGACY_AS_OF_INELIGIBILITY_REASON =
  'historical archive page has publication day but no immutable revision history' as const;

export const EVIDENCE_QUALITY_GRANULAR_AS_OF_ELIGIBILITY_REASON =
  'exact evidence-item excerpt independently archived before target vote' as const;

export const EVIDENCE_QUALITY_GRANULAR_MANAGED_KEYS = [
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
  'asOfEligibilityReason',
] as const;

const PROOF_KEYS = EVIDENCE_QUALITY_GRANULAR_MANAGED_KEYS.filter(
  (key) => key !== 'asOfEligible' && key !== 'asOfEligibilityReason',
);

export type GranularAvailabilityRepairState =
  | 'already_applied'
  | 'legacy_session_daily_ineligible_repairable'
  | 'needs_apply'
  | 'conflict';

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + canonicalJson(object[key]))
      .join(',') + '}';
  }
  return JSON.stringify(value);
}

export function evidenceQualityGranularManagedSubset(
  metadata: Record<string, unknown> | null,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of EVIDENCE_QUALITY_GRANULAR_MANAGED_KEYS) {
    if (metadata && Object.prototype.hasOwnProperty.call(metadata, key)) {
      result[key] = metadata[key];
    }
  }
  return result;
}

export function evidenceQualityEffectiveGranularAvailabilityPatch(
  planned: Record<string, unknown>,
): Record<string, unknown> {
  if (planned.asOfEligible !== true) {
    throw new Error('Granular availability patch must set asOfEligible=true');
  }
  return {
    ...planned,
    asOfEligibilityReason: EVIDENCE_QUALITY_GRANULAR_AS_OF_ELIGIBILITY_REASON,
  };
}

export function evidenceQualityGranularMetadataMatches(
  existing: Record<string, unknown> | null,
  planned: Record<string, unknown>,
): boolean {
  const effective = evidenceQualityEffectiveGranularAvailabilityPatch(planned);
  return canonicalJson(evidenceQualityGranularManagedSubset(existing))
    === canonicalJson(evidenceQualityGranularManagedSubset(effective));
}

function hasProofMetadata(metadata: Record<string, unknown> | null): boolean {
  return PROOF_KEYS.some((key) =>
    Boolean(metadata && Object.prototype.hasOwnProperty.call(metadata, key)));
}

function hasEligibilityMetadata(metadata: Record<string, unknown> | null): boolean {
  return Boolean(
    metadata
    && (
      Object.prototype.hasOwnProperty.call(metadata, 'asOfEligible')
      || Object.prototype.hasOwnProperty.call(metadata, 'asOfEligibilityReason')
    )
  );
}

export function classifyEvidenceQualityGranularRepairState(input: {
  sourceKind: string;
  existingMetadata: Record<string, unknown> | null;
  plannedMetadata: Record<string, unknown>;
}): GranularAvailabilityRepairState {
  const { sourceKind, existingMetadata, plannedMetadata } = input;
  if (evidenceQualityGranularMetadataMatches(existingMetadata, plannedMetadata)) {
    return 'already_applied';
  }

  if (!hasProofMetadata(existingMetadata) && !hasEligibilityMetadata(existingMetadata)) {
    return 'needs_apply';
  }

  const legacySessionDailyState = sourceKind === 'house_session_daily'
    && !hasProofMetadata(existingMetadata)
    && existingMetadata?.asOfEligible === false
    && existingMetadata?.asOfEligibilityReason === SESSION_DAILY_LEGACY_AS_OF_INELIGIBILITY_REASON
    && plannedMetadata.asOfEligible === true;

  return legacySessionDailyState
    ? 'legacy_session_daily_ineligible_repairable'
    : 'conflict';
}
