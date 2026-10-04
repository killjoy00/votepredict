export type ArchiveProofClassification =
  | 'verified_pre_vote_archive_match'
  | 'archive_exists_but_excerpt_not_found'
  | 'archive_only_after_vote'
  | 'no_archive_capture'
  | 'ambiguous_snapshot'
  | 'non_archive_publication_proof';

export type ArchiveProofVerifiedProof = {
  matchedExcerpt?: string;
  [key: string]: unknown;
};

export type ArchiveProofTarget = {
  rowKey: string;
  voteEventId?: string;
  membershipId?: string;
  billId?: string;
  identifier?: string;
  occurredOn?: string;
  session?: string;
  evidenceIds?: string[];
  frozenExcerpts?: string[];
  frozenExcerptFingerprints?: string[];
  classification: ArchiveProofClassification;
  preVoteCaptureCount?: number;
  firstPreVoteCapture?: Record<string, unknown> | null;
  lastPreVoteCapture?: Record<string, unknown> | null;
  verifiedProof?: ArchiveProofVerifiedProof | null;
  [key: string]: unknown;
};

export type ArchiveProofSource = {
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  sourceContentSha256: string;
  storedPublishedOnDiagnosticOnly?: string | null;
  sessions: string[];
  potentialNewRows: number;
  captureDiscovery?: Record<string, unknown>;
  snapshotFetches?: Record<string, unknown>;
  classification: ArchiveProofClassification;
  targets: ArchiveProofTarget[];
  [key: string]: unknown;
};

export type ArchiveProofReport = {
  schemaVersion: string;
  sources: ArchiveProofSource[];
  [key: string]: unknown;
};

export type CanonicalArchiveProofTarget = ArchiveProofTarget & {
  canonicalSourceRun: 'first' | 'retry';
  firstRunClassification: ArchiveProofClassification;
  retryRunClassification: ArchiveProofClassification;
};

export function archiveProofTargetKey(sourceDocumentId: string, rowKey: string): string {
  return sourceDocumentId + '|' + rowKey;
}

function targetMap(report: ArchiveProofReport) {
  const map = new Map<string, { source: ArchiveProofSource; target: ArchiveProofTarget }>();
  for (const source of report.sources) {
    for (const target of source.targets) {
      const key = archiveProofTargetKey(source.sourceDocumentId, target.rowKey);
      if (map.has(key)) throw new Error('Duplicate archive proof target: ' + key);
      map.set(key, { source, target });
    }
  }
  return map;
}

export function mergeArchiveProofRetry(
  first: ArchiveProofReport,
  retry: ArchiveProofReport,
): {
  sources: Array<Omit<ArchiveProofSource, 'targets'> & { targets: CanonicalArchiveProofTarget[] }>;
  transitionsFromFirstAmbiguous: Record<ArchiveProofClassification, number>;
} {
  const firstMap = targetMap(first);
  const retryMap = targetMap(retry);
  if (firstMap.size !== retryMap.size) {
    throw new Error('Archive proof target count changed between first and retry runs');
  }
  for (const key of firstMap.keys()) {
    if (!retryMap.has(key)) throw new Error('Archive proof target missing from retry: ' + key);
  }

  const transitions = new Map<ArchiveProofClassification, number>();
  const sources = first.sources.map((source) => {
    const targets = source.targets.map((firstTarget): CanonicalArchiveProofTarget => {
      const key = archiveProofTargetKey(source.sourceDocumentId, firstTarget.rowKey);
      const retryTarget = retryMap.get(key)!.target;
      const firstClass = firstTarget.classification;
      const retryClass = retryTarget.classification;

      if (firstClass === 'ambiguous_snapshot') {
        transitions.set(retryClass, (transitions.get(retryClass) ?? 0) + 1);
        return {
          ...retryTarget,
          canonicalSourceRun: 'retry',
          firstRunClassification: firstClass,
          retryRunClassification: retryClass,
        };
      }

      return {
        ...firstTarget,
        canonicalSourceRun: 'first',
        firstRunClassification: firstClass,
        retryRunClassification: retryClass,
      };
    });

    return { ...source, targets };
  });

  return {
    sources,
    transitionsFromFirstAmbiguous: Object.fromEntries(
      [...transitions.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ) as Record<ArchiveProofClassification, number>,
  };
}
