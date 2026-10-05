export const EVIDENCE_QUALITY_PRE_VOTE_V14_INVENTORY_SCHEMA =
  'evidence-quality-pre-vote-candidate-inventory-v1.4' as const;
export const EVIDENCE_QUALITY_PRE_VOTE_TRAINING_SESSION = '2021-2022' as const;
export const EVIDENCE_QUALITY_EXHAUSTED_SESSION_DAILY_SOURCES = 21 as const;
export const EVIDENCE_QUALITY_EXHAUSTED_SESSION_DAILY_ROWS = 34 as const;
export const EVIDENCE_QUALITY_EXHAUSTED_ORDINARY_SOURCE_ID =
  '42ed87aa-f850-4d2b-bebc-2b4c25f14b7c' as const;

export type PriorInventoryPotentialTarget = {
  voteEventId: string;
  membershipId: string;
  session: string;
};

export type PriorInventoryMissingAvailabilityCandidate = {
  sourceDocumentId: string;
  sourceKind: string;
  sessions: string[];
  potentialTargets: PriorInventoryPotentialTarget[];
};

export type PriorEvidenceQualityInventory = {
  schemaVersion: string;
  targetUniverse: {
    currentCoveredRows: number;
    trainingSession?: string;
    trainingCoveredRows?: number;
  };
  recommendedTrainingOrdinaryCohort: {
    session: string;
    sources: number;
    potentialNewRows: number;
    rows: Array<{ sourceDocumentId: string }>;
  };
  missingAvailabilityDiagnostic: {
    trainingSession: {
      session: string;
      sourcesWithStoredPublishedAtThatCouldAddRows: number;
      potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated: number;
    };
    candidates: PriorInventoryMissingAvailabilityCandidate[];
  };
};

export type HistoricalRecoveryExhaustion = {
  sessionDailySourceIds: Set<string>;
  sessionDailyTrainingRowKeys: Set<string>;
  ordinarySourceIds: Set<string>;
};

export type HistoricalRecoveryDisposition =
  | { fresh: true; reason: 'fresh_source_surface' }
  | {
      fresh: false;
      reason: 'exhausted_2021_22_session_daily_archive_lane' | 'exhausted_single_ordinary_source_archive_lane';
    };

function rowKey(target: Pick<PriorInventoryPotentialTarget, 'voteEventId' | 'membershipId'>): string {
  return target.voteEventId + '|' + target.membershipId;
}

export function deriveHistoricalRecoveryExhaustion(
  priorInventory: PriorEvidenceQualityInventory,
): HistoricalRecoveryExhaustion {
  if (priorInventory.schemaVersion !== EVIDENCE_QUALITY_PRE_VOTE_V14_INVENTORY_SCHEMA) {
    throw new Error('Prior Evidence Quality inventory schema drifted');
  }
  if (
    priorInventory.targetUniverse.currentCoveredRows !== 29
    || priorInventory.targetUniverse.trainingSession !== EVIDENCE_QUALITY_PRE_VOTE_TRAINING_SESSION
    || priorInventory.targetUniverse.trainingCoveredRows !== 3
  ) {
    throw new Error('Prior Evidence Quality inventory baseline drifted');
  }

  const ordinary = priorInventory.recommendedTrainingOrdinaryCohort;
  if (
    ordinary.session !== EVIDENCE_QUALITY_PRE_VOTE_TRAINING_SESSION
    || ordinary.sources !== 1
    || ordinary.potentialNewRows !== 1
    || ordinary.rows.length !== 1
    || ordinary.rows[0]?.sourceDocumentId !== EVIDENCE_QUALITY_EXHAUSTED_ORDINARY_SOURCE_ID
  ) {
    throw new Error('Prior ordinary 2021-22 recovery source drifted');
  }

  const diagnostic = priorInventory.missingAvailabilityDiagnostic.trainingSession;
  if (
    diagnostic.session !== EVIDENCE_QUALITY_PRE_VOTE_TRAINING_SESSION
    || diagnostic.sourcesWithStoredPublishedAtThatCouldAddRows !== EVIDENCE_QUALITY_EXHAUSTED_SESSION_DAILY_SOURCES
    || diagnostic.potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated !== EVIDENCE_QUALITY_EXHAUSTED_SESSION_DAILY_ROWS
  ) {
    throw new Error('Prior 2021-22 missing-availability diagnostic drifted');
  }

  const trainingCandidates = priorInventory.missingAvailabilityDiagnostic.candidates.filter((candidate) =>
    candidate.sessions.includes(EVIDENCE_QUALITY_PRE_VOTE_TRAINING_SESSION)
  );
  if (trainingCandidates.length !== EVIDENCE_QUALITY_EXHAUSTED_SESSION_DAILY_SOURCES) {
    throw new Error('Prior exhausted Session Daily source count drifted');
  }

  const sourceIds = new Set<string>();
  const trainingRowKeys = new Set<string>();
  for (const candidate of trainingCandidates) {
    if (candidate.sourceKind !== 'house_session_daily') {
      throw new Error('Prior exhausted training availability cohort contains a non-Session-Daily source');
    }
    if (!candidate.sourceDocumentId || sourceIds.has(candidate.sourceDocumentId)) {
      throw new Error('Prior exhausted Session Daily source identity is missing or duplicated');
    }
    sourceIds.add(candidate.sourceDocumentId);

    for (const target of candidate.potentialTargets ?? []) {
      if (target.session !== EVIDENCE_QUALITY_PRE_VOTE_TRAINING_SESSION) {
        throw new Error('Prior exhausted Session Daily target escaped the 2021-22 training session');
      }
      if (!target.voteEventId || !target.membershipId) {
        throw new Error('Prior exhausted Session Daily target identity is incomplete');
      }
      trainingRowKeys.add(rowKey(target));
    }
  }

  if (trainingRowKeys.size !== EVIDENCE_QUALITY_EXHAUSTED_SESSION_DAILY_ROWS) {
    throw new Error('Prior exhausted Session Daily row-key count drifted');
  }

  return {
    sessionDailySourceIds: sourceIds,
    sessionDailyTrainingRowKeys: trainingRowKeys,
    ordinarySourceIds: new Set([EVIDENCE_QUALITY_EXHAUSTED_ORDINARY_SOURCE_ID]),
  };
}

export function historicalRecoveryDisposition(
  sourceDocumentId: string,
  exhaustion: HistoricalRecoveryExhaustion,
): HistoricalRecoveryDisposition {
  if (exhaustion.ordinarySourceIds.has(sourceDocumentId)) {
    return { fresh: false, reason: 'exhausted_single_ordinary_source_archive_lane' };
  }
  if (exhaustion.sessionDailySourceIds.has(sourceDocumentId)) {
    return { fresh: false, reason: 'exhausted_2021_22_session_daily_archive_lane' };
  }
  return { fresh: true, reason: 'fresh_source_surface' };
}
