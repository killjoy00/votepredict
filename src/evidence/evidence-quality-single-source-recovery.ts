export const HISTORICAL_DENSITY_SINGLE_SOURCE_INVENTORY_SCHEMA =
  'evidence-quality-pre-vote-candidate-inventory-v1.4' as const;
export const HISTORICAL_DENSITY_SINGLE_SOURCE_SESSION = '2021-2022' as const;
export const HISTORICAL_DENSITY_SINGLE_SOURCE_ID = '42ed87aa-f850-4d2b-bebc-2b4c25f14b7c' as const;
export const HISTORICAL_DENSITY_SINGLE_SOURCE_KIND = 'house_member_primary_historical_article' as const;
export const HISTORICAL_DENSITY_SINGLE_SOURCE_URL =
  'https://www.house.mn.gov/members/profile/news/15535/31155' as const;
export const HISTORICAL_DENSITY_SINGLE_SOURCE_SHA256 =
  '1681853a685360e99e48cb4a0203544dfe49e51cc1254ed0144d9e145c0f76f4' as const;
export const HISTORICAL_DENSITY_SINGLE_SOURCE_AVAILABLE_ON = '2021-02-08' as const;

export type HistoricalDensityFrozenCandidate = {
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  contentSha256: string;
  availableOn: string;
  sourceSession: string | null;
  sourceDocumentTextId: string | null;
  textReady: boolean;
  targetPairs: number;
  potentialCoverageRows: number;
  newCoverageRows: number;
  newCoverageEvents: number;
  newCoverageMemberships: number;
  newCoverageBySession: Record<string, number>;
  marginalRows: number;
  cumulativeRows: number;
};

export type HistoricalDensityInventoryShape = {
  schemaVersion: string;
  targetUniverse: {
    rows: number;
    currentCoveredRows: number;
    trainingSession?: string;
    trainingRows?: number;
    trainingCoveredRows?: number;
  };
  recommendedTrainingOrdinaryCohort: {
    session: string;
    sources: number;
    potentialNewRows: number;
    rows: HistoricalDensityFrozenCandidate[];
  };
};

export type HistoricalDensityTargetRow = {
  voteEventId: string;
  membershipId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
};

export type HistoricalDensityEvidenceContext = {
  evidenceId: string;
  membershipId: string;
  billId: string;
  excerpt: string | null;
};

export function historicalDensityRowKey(row: Pick<HistoricalDensityTargetRow, 'voteEventId' | 'membershipId'>): string {
  return row.voteEventId + '|' + row.membershipId;
}

function exactCandidateIdentity(candidate: HistoricalDensityFrozenCandidate): boolean {
  return candidate.sourceDocumentId === HISTORICAL_DENSITY_SINGLE_SOURCE_ID
    && candidate.sourceKind === HISTORICAL_DENSITY_SINGLE_SOURCE_KIND
    && candidate.sourceUrl === HISTORICAL_DENSITY_SINGLE_SOURCE_URL
    && candidate.contentSha256 === HISTORICAL_DENSITY_SINGLE_SOURCE_SHA256
    && candidate.availableOn === HISTORICAL_DENSITY_SINGLE_SOURCE_AVAILABLE_ON
    && candidate.sourceSession === HISTORICAL_DENSITY_SINGLE_SOURCE_SESSION
    && candidate.sourceDocumentTextId === null
    && candidate.textReady === false
    && candidate.targetPairs === 1
    && candidate.potentialCoverageRows === 1
    && candidate.newCoverageRows === 1
    && candidate.newCoverageEvents === 1
    && candidate.newCoverageMemberships === 1
    && candidate.newCoverageBySession[HISTORICAL_DENSITY_SINGLE_SOURCE_SESSION] === 1
    && candidate.marginalRows === 1
    && candidate.cumulativeRows === 1;
}

export function selectHistoricalDensitySingleSourceCandidate(
  inventory: HistoricalDensityInventoryShape,
): HistoricalDensityFrozenCandidate {
  if (inventory.schemaVersion !== HISTORICAL_DENSITY_SINGLE_SOURCE_INVENTORY_SCHEMA) {
    throw new Error('Historical density source probe inventory schema drifted');
  }
  if (inventory.targetUniverse.rows !== 135457 || inventory.targetUniverse.currentCoveredRows !== 29) {
    throw new Error('Historical density source probe v1.4 baseline drifted');
  }
  const cohort = inventory.recommendedTrainingOrdinaryCohort;
  if (
    cohort.session !== HISTORICAL_DENSITY_SINGLE_SOURCE_SESSION
    || cohort.sources !== 1
    || cohort.potentialNewRows !== 1
    || cohort.rows.length !== 1
  ) {
    throw new Error('Historical density training ordinary cohort drifted');
  }
  const candidate = cohort.rows[0];
  if (!exactCandidateIdentity(candidate)) {
    throw new Error('Historical density frozen source identity drifted');
  }
  return candidate;
}

function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function resolveHistoricalDensitySingleTarget(input: {
  candidate: HistoricalDensityFrozenCandidate;
  targets: readonly HistoricalDensityTargetRow[];
  contexts: readonly HistoricalDensityEvidenceContext[];
  coveredRowKeys: ReadonlySet<string>;
}): {
  target: HistoricalDensityTargetRow;
  evidenceIds: string[];
  excerpts: string[];
} {
  if (!validDateOnly(input.candidate.availableOn)) {
    throw new Error('Historical density source availability date is invalid');
  }

  const contextsByPair = new Map<string, HistoricalDensityEvidenceContext[]>();
  for (const context of input.contexts) {
    if (!context.membershipId || !context.billId) continue;
    const key = context.membershipId + '|' + context.billId;
    const rows = contextsByPair.get(key) ?? [];
    rows.push(context);
    contextsByPair.set(key, rows);
  }

  const matches = input.targets.flatMap((target) => {
    if (target.session !== HISTORICAL_DENSITY_SINGLE_SOURCE_SESSION) return [];
    if (!validDateOnly(target.occurredOn)) throw new Error('Historical density target date is invalid');
    if (input.candidate.availableOn >= target.occurredOn) return [];
    if (input.coveredRowKeys.has(historicalDensityRowKey(target))) return [];
    const contexts = contextsByPair.get(target.membershipId + '|' + target.billId) ?? [];
    if (!contexts.length) return [];
    return [{ target, contexts }];
  });

  if (matches.length !== 1) {
    throw new Error('Expected exactly one uncovered 2021-22 target row, found ' + matches.length);
  }

  const evidenceIds = [...new Set(matches[0].contexts.map((row) => row.evidenceId))].sort();
  const excerpts = [...new Set(
    matches[0].contexts
      .map((row) => row.excerpt?.trim() ?? '')
      .filter(Boolean),
  )].sort();

  if (!evidenceIds.length || !excerpts.length) {
    throw new Error('Historical density target lacks frozen evidence identity/excerpt');
  }

  return { target: matches[0].target, evidenceIds, excerpts };
}
