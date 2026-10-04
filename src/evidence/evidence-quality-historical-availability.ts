import {
  HISTORICAL_PUBLIC_AVAILABILITY_VERSION,
  historicalAvailabilityErrors,
  type HistoricalAvailabilityProof,
  type HistoricalAvailabilityRecord,
} from './historical-public-availability';

export type EvidenceQualityAvailabilityMethod =
  | 'source_document'
  | 'evidence_item_excerpt'
  | 'none';

export interface EvidenceQualityAvailabilityContext {
  evidenceItemId: string;
  membershipId: string | null;
  billId: string | null;
  excerpt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface EvidenceQualityAvailabilityResolution {
  availableOn: string | null;
  method: EvidenceQualityAvailabilityMethod;
  evidenceItemIds: string[];
}

const HISTORICAL_PROOFS = new Set<HistoricalAvailabilityProof>([
  'official_publication_timestamp',
  'independent_archive_capture',
  'regulatory_filing_or_disclosure_timestamp',
  'publisher_page_metadata',
]);

function stringMeta(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function booleanMeta(metadata: Record<string, unknown> | null, key: string): boolean | null {
  const value = metadata?.[key];
  return typeof value === 'boolean' ? value : null;
}

function validDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function dateOnly(value: string | null): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  const date = value.slice(0, 10);
  return validDateOnly(date) ? date : null;
}

function normalizedExcerpt(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function exactSourceUrlMatches(metadataUrl: string, sourceUrl: string): boolean {
  try {
    return new URL(metadataUrl).toString() === new URL(sourceUrl).toString();
  } catch {
    return false;
  }
}

export function sourceDocumentAvailabilityDate(
  metadata: Record<string, unknown> | null,
): string | null {
  for (const key of ['availableAt', 'availableOn', 'archiveCapturedAt'] as const) {
    const date = dateOnly(stringMeta(metadata, key));
    if (date) return date;
  }
  return null;
}

export function granularEvidenceAvailabilityRecord(input: {
  metadata: Record<string, unknown> | null;
  sourceUrl: string;
  sourceContentSha256: string;
}): HistoricalAvailabilityRecord | null {
  const { metadata, sourceUrl, sourceContentSha256 } = input;
  if (!metadata) return null;
  if (stringMeta(metadata, 'historicalAvailabilityVersion') !== HISTORICAL_PUBLIC_AVAILABILITY_VERSION) {
    return null;
  }
  if (stringMeta(metadata, 'availabilityScope') !== 'evidence_item_excerpt') return null;
  if (stringMeta(metadata, 'availabilityContentIdentity') !== 'exact_frozen_excerpt_match') return null;
  if (booleanMeta(metadata, 'asOfEligible') !== true) return null;

  const proof = stringMeta(metadata, 'availabilityProof');
  if (!proof || !HISTORICAL_PROOFS.has(proof as HistoricalAvailabilityProof)) return null;

  const availableAt = stringMeta(metadata, 'availableAt');
  const canonicalUrl = stringMeta(metadata, 'canonicalSourceUrl');
  const contentSha256 = stringMeta(metadata, 'sourceContentSha256');
  if (!availableAt || !canonicalUrl || !contentSha256) return null;
  if (!exactSourceUrlMatches(canonicalUrl, sourceUrl)) return null;
  if (contentSha256.toLowerCase() !== sourceContentSha256.toLowerCase()) return null;

  const excerptFingerprint = stringMeta(metadata, 'availabilityProofExcerptFingerprint');
  if (!excerptFingerprint || !/^[0-9a-f]{64}$/i.test(excerptFingerprint)) return null;

  const archiveContentSha256 = stringMeta(metadata, 'availabilityProofArchiveContentSha256');
  if (proof === 'independent_archive_capture'
    && (!archiveContentSha256 || !/^[0-9a-f]{64}$/i.test(archiveContentSha256))) {
    return null;
  }

  const record: HistoricalAvailabilityRecord = {
    proof: proof as HistoricalAvailabilityProof,
    availableAt,
    canonicalUrl,
    archiveUrl: stringMeta(metadata, 'archiveUrl') ?? undefined,
    capturedAt: stringMeta(metadata, 'archiveCapturedAt') ?? undefined,
    publishedAt: stringMeta(metadata, 'sourcePublishedAt') ?? undefined,
    filingAt: stringMeta(metadata, 'regulatoryFiledAt') ?? undefined,
    contentSha256,
    metadata: {
      availabilityScope: 'evidence_item_excerpt',
      availabilityContentIdentity: 'exact_frozen_excerpt_match',
      availabilityProofExcerptFingerprint: excerptFingerprint,
      availabilityProofArchiveContentSha256: archiveContentSha256,
    },
  };

  return historicalAvailabilityErrors(record).length === 0 ? record : null;
}

export function evidenceItemAvailabilityDate(input: {
  sourceMetadata: Record<string, unknown> | null;
  evidenceMetadata: Record<string, unknown> | null;
  sourceUrl: string;
  sourceContentSha256: string;
}): EvidenceQualityAvailabilityResolution {
  const sourceDate = sourceDocumentAvailabilityDate(input.sourceMetadata);
  if (sourceDate) {
    return { availableOn: sourceDate, method: 'source_document', evidenceItemIds: [] };
  }

  const record = granularEvidenceAvailabilityRecord({
    metadata: input.evidenceMetadata,
    sourceUrl: input.sourceUrl,
    sourceContentSha256: input.sourceContentSha256,
  });
  const evidenceDate = record ? dateOnly(record.availableAt) : null;
  return evidenceDate
    ? { availableOn: evidenceDate, method: 'evidence_item_excerpt', evidenceItemIds: [] }
    : { availableOn: null, method: 'none', evidenceItemIds: [] };
}

export function claimHistoricalAvailability(input: {
  sourceMetadata: Record<string, unknown> | null;
  sourceUrl: string;
  sourceContentSha256: string;
  contexts: readonly EvidenceQualityAvailabilityContext[];
  supportingExcerpt: string;
  membershipId: string;
  billId?: string | null;
}): EvidenceQualityAvailabilityResolution {
  const sourceDate = sourceDocumentAvailabilityDate(input.sourceMetadata);
  if (sourceDate) {
    return { availableOn: sourceDate, method: 'source_document', evidenceItemIds: [] };
  }

  const supportingExcerpt = normalizedExcerpt(input.supportingExcerpt);
  if (supportingExcerpt.length < 20) {
    return { availableOn: null, method: 'none', evidenceItemIds: [] };
  }

  const granular: Array<{ evidenceItemId: string; availableOn: string }> = [];
  for (const context of input.contexts) {
    if (context.membershipId !== input.membershipId) continue;
    if (input.billId && context.billId !== input.billId) continue;
    if (!context.excerpt) continue;

    const evidenceExcerpt = normalizedExcerpt(context.excerpt);
    if (!evidenceExcerpt.includes(supportingExcerpt)) continue;

    const record = granularEvidenceAvailabilityRecord({
      metadata: context.metadata,
      sourceUrl: input.sourceUrl,
      sourceContentSha256: input.sourceContentSha256,
    });
    const availableOn = record ? dateOnly(record.availableAt) : null;
    if (!availableOn) continue;
    granular.push({ evidenceItemId: context.evidenceItemId, availableOn });
  }

  if (!granular.length) {
    return { availableOn: null, method: 'none', evidenceItemIds: [] };
  }

  granular.sort((a, b) =>
    a.availableOn.localeCompare(b.availableOn)
    || a.evidenceItemId.localeCompare(b.evidenceItemId));
  const earliest = granular[0].availableOn;
  return {
    availableOn: earliest,
    method: 'evidence_item_excerpt',
    evidenceItemIds: granular
      .filter((row) => row.availableOn === earliest)
      .map((row) => row.evidenceItemId),
  };
}
