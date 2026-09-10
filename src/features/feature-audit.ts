import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { extractDeterministicBillFeatures, DETERMINISTIC_EXTRACTOR_VERSION } from './bills';

export interface FeatureSource {
  id: string; bill_id: string; identifier: string; session_slug: string; title: string;
  version_key: string; published_at: string; raw_text: string; source_url: string | null;
  stored_features?: unknown;
}

export function auditBillFeature(source: FeatureSource) {
  // Match JSONB semantics: optional undefined properties are not stored.
  const features = JSON.parse(JSON.stringify(extractDeterministicBillFeatures({ title: source.title, text: source.raw_text }))) as ReturnType<typeof extractDeterministicBillFeatures>;
  const before = source.stored_features as Record<string, unknown> | null | undefined;
  return {
    billVersionId: source.id,
    features,
    changed: !isDeepStrictEqual(before, features),
    changedFields: [...new Set([...Object.keys(features), ...Object.keys(before ?? {})])].filter(key => !isDeepStrictEqual(before?.[key], features[key as keyof typeof features])),
    provenance: {
      billId: source.bill_id, identifier: source.identifier, session: source.session_slug,
      versionKey: source.version_key, publishedAt: source.published_at, sourceUrl: source.source_url,
      sourceTextHash: createHash('sha256').update(source.raw_text).digest('hex'),
      extractorVersion: DETERMINISTIC_EXTRACTOR_VERSION,
      extractionMethod: 'repository-typescript-extractor',
    },
  };
}
