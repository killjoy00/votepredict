export const EVIDENCE_ITEM_AVAILABILITY_SCOPE = 'evidence_item_excerpt' as const;
export const EVIDENCE_ITEM_AVAILABILITY_CONTENT_IDENTITY = 'exact_frozen_excerpt_match' as const;

export type HistoricalAvailabilityResolution = {
  availableAt: string;
  availableOn: string;
  scope: 'evidence_item_excerpt' | 'source_document';
  proof: string | null;
};

function stringMeta(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validInstant(value: string | null): value is string {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

function validSha256(value: string | null): value is string {
  return Boolean(value && /^[a-f0-9]{64}$/i.test(value));
}

function validHttpsUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validWaybackUrl(value: string | null): value is string {
  if (!validHttpsUrl(value)) return false;
  return new URL(value).hostname.toLowerCase() === 'web.archive.org';
}

function sourceDocumentResolution(
  metadata: Record<string, unknown> | null,
): HistoricalAvailabilityResolution | null {
  for (const key of ['availableAt', 'availableOn', 'archiveCapturedAt'] as const) {
    const raw = stringMeta(metadata, key);
    if (!validInstant(raw)) continue;
    return {
      availableAt: new Date(raw).toISOString(),
      availableOn: new Date(raw).toISOString().slice(0, 10),
      scope: 'source_document',
      proof: stringMeta(metadata, 'availabilityProof'),
    };
  }
  return null;
}

export function evidenceItemExcerptAvailabilityErrors(
  metadata: Record<string, unknown> | null,
): string[] {
  const errors: string[] = [];
  if (!metadata || stringMeta(metadata, 'availabilityScope') !== EVIDENCE_ITEM_AVAILABILITY_SCOPE) {
    errors.push('availabilityScope must be evidence_item_excerpt');
    return errors;
  }

  if (stringMeta(metadata, 'historicalAvailabilityVersion') !== 'historical-public-availability-v1') {
    errors.push('historicalAvailabilityVersion must be historical-public-availability-v1');
  }
  if (stringMeta(metadata, 'availabilityProof') !== 'independent_archive_capture') {
    errors.push('availabilityProof must be independent_archive_capture');
  }
  if (stringMeta(metadata, 'availabilityContentIdentity') !== EVIDENCE_ITEM_AVAILABILITY_CONTENT_IDENTITY) {
    errors.push('availabilityContentIdentity must be exact_frozen_excerpt_match');
  }

  const availableAt = stringMeta(metadata, 'availableAt');
  const archiveCapturedAt = stringMeta(metadata, 'archiveCapturedAt');
  if (!validInstant(availableAt)) errors.push('availableAt must be a valid timestamp');
  if (!validInstant(archiveCapturedAt)) errors.push('archiveCapturedAt must be a valid timestamp');
  if (validInstant(availableAt) && validInstant(archiveCapturedAt)
      && Date.parse(availableAt) !== Date.parse(archiveCapturedAt)) {
    errors.push('availableAt must equal archiveCapturedAt');
  }

  const archiveUrl = stringMeta(metadata, 'archiveUrl');
  if (!validWaybackUrl(archiveUrl)) errors.push('archiveUrl must be an https web.archive.org URL');

  const canonicalSourceUrl = stringMeta(metadata, 'canonicalSourceUrl');
  if (!validHttpsUrl(canonicalSourceUrl)) errors.push('canonicalSourceUrl must be https');

  if (!validSha256(stringMeta(metadata, 'sourceContentSha256'))) {
    errors.push('sourceContentSha256 must be SHA-256');
  }
  if (!validSha256(stringMeta(metadata, 'availabilityProofExcerptFingerprint'))) {
    errors.push('availabilityProofExcerptFingerprint must be SHA-256');
  }
  if (!validSha256(stringMeta(metadata, 'availabilityProofArchiveContentSha256'))) {
    errors.push('availabilityProofArchiveContentSha256 must be SHA-256');
  }

  return errors;
}

function evidenceItemResolution(
  metadata: Record<string, unknown> | null,
): HistoricalAvailabilityResolution | null {
  if (evidenceItemExcerptAvailabilityErrors(metadata).length) return null;
  const raw = stringMeta(metadata, 'availableAt')!;
  return {
    availableAt: new Date(raw).toISOString(),
    availableOn: new Date(raw).toISOString().slice(0, 10),
    scope: 'evidence_item_excerpt',
    proof: 'independent_archive_capture',
  };
}

export function resolveHistoricalEvidenceAvailability(input: {
  evidenceMetadata: Record<string, unknown> | null;
  sourceMetadata: Record<string, unknown> | null;
}): HistoricalAvailabilityResolution | null {
  const item = evidenceItemResolution(input.evidenceMetadata);
  const source = sourceDocumentResolution(input.sourceMetadata);
  if (!item) return source;
  if (!source) return item;
  return Date.parse(item.availableAt) <= Date.parse(source.availableAt) ? item : source;
}

export function historicalEvidenceAvailabilityDate(input: {
  evidenceMetadata: Record<string, unknown> | null;
  sourceMetadata: Record<string, unknown> | null;
}): string | null {
  return resolveHistoricalEvidenceAvailability(input)?.availableOn ?? null;
}
