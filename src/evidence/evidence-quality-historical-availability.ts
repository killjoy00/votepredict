import { archiveProofExcerptFingerprint } from './evidence-quality-archive-proof.js';
import { HISTORICAL_PUBLIC_AVAILABILITY_VERSION } from './historical-public-availability.js';

export const EVIDENCE_QUALITY_GRANULAR_AVAILABILITY_SCOPE = 'evidence_item_excerpt' as const;
export const EVIDENCE_QUALITY_GRANULAR_CONTENT_IDENTITY = 'exact_frozen_excerpt_match' as const;

export type EvidenceQualityAvailabilitySource =
  | 'evidence_item_exact_excerpt'
  | 'source_document'
  | 'none';

export type EvidenceQualityAvailabilityResolution = {
  availableOn: string | null;
  source: EvidenceQualityAvailabilitySource;
  availableAt: string | null;
};

function stringMeta(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function booleanTrue(metadata: Record<string, unknown> | null | undefined, key: string): boolean {
  const value = metadata?.[key];
  return value === true || value === 'true';
}

function validSha256(value: string | null): value is string {
  return Boolean(value && /^[a-f0-9]{64}$/i.test(value));
}

function validDigest(value: string | null): boolean {
  return Boolean(value && /^sha256:[a-f0-9]{64}$/i.test(value));
}

function validDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function timestampDate(value: string | null): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  const date = value.slice(0, 10);
  return validDateOnly(date) ? date : null;
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function evidenceQualitySourceAvailabilityDate(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  for (const key of ['availableAt', 'availableOn', 'archiveCapturedAt'] as const) {
    const date = timestampDate(stringMeta(metadata, key));
    if (date) return date;
  }
  return null;
}

export function evidenceQualityExactEvidenceItemAvailabilityDate(input: {
  evidenceMetadata: Record<string, unknown> | null | undefined;
  sourceUrl: string;
  sourceContentSha256: string;
  evidenceExcerpt: string | null | undefined;
  claimSupportingExcerpt?: string | null;
}): string | null {
  const metadata = input.evidenceMetadata;
  if (!metadata) return null;

  if (stringMeta(metadata, 'historicalAvailabilityVersion') !== HISTORICAL_PUBLIC_AVAILABILITY_VERSION) return null;
  if (stringMeta(metadata, 'availabilityProof') !== 'independent_archive_capture') return null;
  if (stringMeta(metadata, 'availabilityScope') !== EVIDENCE_QUALITY_GRANULAR_AVAILABILITY_SCOPE) return null;
  if (stringMeta(metadata, 'availabilityContentIdentity') !== EVIDENCE_QUALITY_GRANULAR_CONTENT_IDENTITY) return null;
  if (!booleanTrue(metadata, 'asOfEligible')) return null;

  const availableAt = stringMeta(metadata, 'availableAt');
  const archiveCapturedAt = stringMeta(metadata, 'archiveCapturedAt');
  const availableDate = timestampDate(availableAt);
  if (!availableDate || !archiveCapturedAt || Date.parse(availableAt!) !== Date.parse(archiveCapturedAt)) return null;

  const canonicalSourceUrl = stringMeta(metadata, 'canonicalSourceUrl');
  if (canonicalSourceUrl !== input.sourceUrl) return null;

  const sourceContentSha256 = stringMeta(metadata, 'sourceContentSha256');
  if (!validSha256(sourceContentSha256) || sourceContentSha256.toLowerCase() !== input.sourceContentSha256.toLowerCase()) {
    return null;
  }

  const archiveUrl = stringMeta(metadata, 'archiveUrl');
  if (!archiveUrl) return null;
  try {
    const parsed = new URL(archiveUrl);
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'web.archive.org') return null;
  } catch {
    return null;
  }

  const excerptFingerprint = stringMeta(metadata, 'availabilityProofExcerptFingerprint');
  const archiveContentSha256 = stringMeta(metadata, 'availabilityProofArchiveContentSha256');
  const artifactDigest = stringMeta(metadata, 'availabilityProofCanonicalArtifactDigest');
  const artifactId = metadata.availabilityProofCanonicalArtifactId;
  if (!validSha256(excerptFingerprint) || !validSha256(archiveContentSha256) || !validDigest(artifactDigest)) return null;
  if (typeof artifactId !== 'number' || !Number.isInteger(artifactId) || artifactId < 1) return null;

  const evidenceExcerpt = input.evidenceExcerpt?.trim();
  if (!evidenceExcerpt) return null;
  if (archiveProofExcerptFingerprint(evidenceExcerpt) !== excerptFingerprint.toLowerCase()) return null;

  const claimExcerpt = input.claimSupportingExcerpt?.trim();
  if (claimExcerpt) {
    const normalizedEvidence = normalizeText(evidenceExcerpt);
    const normalizedClaim = normalizeText(claimExcerpt);
    if (!normalizedClaim || !normalizedEvidence.includes(normalizedClaim)) return null;
  }

  return availableDate;
}

export function resolveEvidenceQualityAvailability(input: {
  sourceMetadata: Record<string, unknown> | null | undefined;
  sourceUrl: string;
  sourceContentSha256: string;
  evidenceMetadata?: Record<string, unknown> | null;
  evidenceExcerpt?: string | null;
  claimSupportingExcerpt?: string | null;
}): EvidenceQualityAvailabilityResolution {
  const itemDate = evidenceQualityExactEvidenceItemAvailabilityDate({
    evidenceMetadata: input.evidenceMetadata,
    sourceUrl: input.sourceUrl,
    sourceContentSha256: input.sourceContentSha256,
    evidenceExcerpt: input.evidenceExcerpt,
    claimSupportingExcerpt: input.claimSupportingExcerpt,
  });

  if (itemDate) {
    return {
      availableOn: itemDate,
      source: 'evidence_item_exact_excerpt',
      availableAt: stringMeta(input.evidenceMetadata, 'availableAt'),
    };
  }

  const sourceDate = evidenceQualitySourceAvailabilityDate(input.sourceMetadata);
  if (sourceDate) {
    return {
      availableOn: sourceDate,
      source: 'source_document',
      availableAt: stringMeta(input.sourceMetadata, 'availableAt')
        ?? stringMeta(input.sourceMetadata, 'availableOn')
        ?? stringMeta(input.sourceMetadata, 'archiveCapturedAt'),
    };
  }

  return { availableOn: null, source: 'none', availableAt: null };
}
