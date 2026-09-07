import { getProductionScorecard, type ProductionScorecard, type ScorecardRevision } from './scorecard';

function mean(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function isUnambiguouslyPreVoteRevision(revision: ScorecardRevision): boolean {
  if (!revision.generatedAt) return false;
  return revision.generatedAt.slice(0, 10) < revision.actualOccurredOn;
}

export function aggregateSafeScorecard(resolvedForecasts: number, revisions: readonly ScorecardRevision[]): ProductionScorecard {
  const passageBriers = revisions.map((row) => row.passageBrier).filter((value): value is number => value !== undefined);
  const yesErrors = revisions.map((row) => row.yesAbsoluteError).filter((value): value is number => value !== undefined);
  const rangeCoverage = revisions.map((row) => row.rangeContainsActual).filter((value): value is boolean => value !== undefined).map((value) => value ? 1 : 0);
  let memberResolved = 0;
  let memberCannotPredict = 0;
  let memberCorrectWeighted = 0;
  let memberBrierWeighted = 0;
  let memberLogLossWeighted = 0;
  for (const row of revisions) {
    memberResolved += row.memberResolved;
    memberCannotPredict += row.memberCannotPredict;
    if (row.memberAccuracy !== undefined) memberCorrectWeighted += row.memberAccuracy * row.memberResolved;
    if (row.memberBrier !== undefined) memberBrierWeighted += row.memberBrier * row.memberResolved;
    if (row.memberLogLoss !== undefined) memberLogLossWeighted += row.memberLogLoss * row.memberResolved;
  }
  return {
    resolvedForecasts,
    scoredRevisions: revisions.length,
    aggregate: {
      passageBrier: mean(passageBriers),
      expectedYesMae: mean(yesErrors),
      rangeCoverage: mean(rangeCoverage),
      memberAccuracy: memberResolved ? memberCorrectWeighted / memberResolved : undefined,
      memberBrier: memberResolved ? memberBrierWeighted / memberResolved : undefined,
      memberLogLoss: memberResolved ? memberLogLossWeighted / memberResolved : undefined,
      memberResolved,
      memberCannotPredict,
    },
    revisions: [...revisions],
  };
}

export async function getLeakageSafeProductionScorecard(ownerUserId: string): Promise<ProductionScorecard> {
  const raw = await getProductionScorecard(ownerUserId);
  const safeRevisions = raw.revisions.filter(isUnambiguouslyPreVoteRevision);
  return aggregateSafeScorecard(raw.resolvedForecasts, safeRevisions);
}
