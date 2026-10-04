import type {
  ArchiveProofClassification,
  ArchiveProofSource,
} from './evidence-quality-archive-proof-retry';

export type AvailabilityFallbackResult = {
  sourceDocumentId: string;
  rowKey: string;
  classification: 'verified_pre_vote_archive_match' | 'ambiguous_snapshot';
  verifiedProof?: Record<string, unknown> | null;
  fallbackReason?: string;
  [key: string]: unknown;
};

export type CanonicalV2Target = Record<string, unknown> & {
  rowKey: string;
  classification: ArchiveProofClassification;
  verifiedProof?: Record<string, unknown> | null;
  verifiedProof?: Record<string, unknown> | null;
  canonicalAvailabilityStage: 'canonical_retry' | 'availability_fallback';
  preFallbackClassification: ArchiveProofClassification;
  fallbackClassification: 'verified_pre_vote_archive_match' | 'ambiguous_snapshot';
};

function key(sourceDocumentId: string, rowKey: string): string {
  return sourceDocumentId + '|' + rowKey;
}

export function mergeCanonicalArchiveProofWithAvailabilityFallback(
  canonicalSources: readonly ArchiveProofSource[],
  fallbackResults: readonly AvailabilityFallbackResult[],
): {
  sources: Array<ArchiveProofSource & { targets: CanonicalV2Target[] }>;
  upgradedTargetKeys: string[];
} {
  const canonicalTargets = new Map<string, { source: ArchiveProofSource; target: Record<string, unknown> & {
    rowKey: string;
    classification: ArchiveProofClassification;
  } }>();

  for (const source of canonicalSources) {
    for (const rawTarget of source.targets) {
      const target = rawTarget as Record<string, unknown> & {
        rowKey: string;
        classification: ArchiveProofClassification;
      };
      const targetKey = key(source.sourceDocumentId, target.rowKey);
      if (canonicalTargets.has(targetKey)) throw new Error('Duplicate canonical target: ' + targetKey);
      canonicalTargets.set(targetKey, { source, target });
    }
  }

  const ambiguousKeys = new Set(
    [...canonicalTargets.entries()]
      .filter(([, entry]) => entry.target.classification === 'ambiguous_snapshot')
      .map(([targetKey]) => targetKey),
  );

  const fallbackMap = new Map<string, AvailabilityFallbackResult>();
  for (const result of fallbackResults) {
    const targetKey = key(result.sourceDocumentId, result.rowKey);
    if (fallbackMap.has(targetKey)) throw new Error('Duplicate fallback target: ' + targetKey);
    if (!ambiguousKeys.has(targetKey)) {
      throw new Error('Fallback result is not a canonical ambiguous target: ' + targetKey);
    }
    fallbackMap.set(targetKey, result);
  }

  if (fallbackMap.size !== ambiguousKeys.size) {
    throw new Error('Fallback result set must cover every canonical ambiguous target exactly once');
  }

  const upgradedTargetKeys: string[] = [];
  const sources = canonicalSources.map((source) => {
    const targets = source.targets.map((rawTarget): CanonicalV2Target => {
      const target = rawTarget as Record<string, unknown> & {
        rowKey: string;
        classification: ArchiveProofClassification;
      };
      const targetKey = key(source.sourceDocumentId, target.rowKey);

      if (target.classification !== 'ambiguous_snapshot') {
        return {
          ...target,
          canonicalAvailabilityStage: 'canonical_retry',
          preFallbackClassification: target.classification,
          fallbackClassification: 'ambiguous_snapshot',
        };
      }

      const fallback = fallbackMap.get(targetKey)!;
      if (fallback.classification === 'verified_pre_vote_archive_match') {
        if (!fallback.verifiedProof) {
          throw new Error('Verified fallback target lacks verifiedProof: ' + targetKey);
        }
        upgradedTargetKeys.push(targetKey);
        return {
          ...target,
          classification: 'verified_pre_vote_archive_match',
          verifiedProof: fallback.verifiedProof,
          availabilityFallback: fallback,
          canonicalAvailabilityStage: 'availability_fallback',
          preFallbackClassification: 'ambiguous_snapshot',
          fallbackClassification: 'verified_pre_vote_archive_match',
        };
      }

      return {
        ...target,
        availabilityFallback: fallback,
        canonicalAvailabilityStage: 'canonical_retry',
        preFallbackClassification: 'ambiguous_snapshot',
        fallbackClassification: 'ambiguous_snapshot',
      };
    });
    return { ...source, targets };
  });

  return {
    sources,
    upgradedTargetKeys: upgradedTargetKeys.sort(),
  };
}
