import type {
  HistoricalDeepHouseJournalMechanicsScoreArtifact,
  HistoricalDeepHouseJournalQuickOutcomeSlice,
} from './historical-deep-house-journal-mechanics-score';
import type {
  HistoricalDeepHouseJournalHoldoutScoreArtifact,
} from './historical-deep-house-journal-holdout-score';
import type { HistoricalDeepHouseJournalMechanic } from './historical-deep-house-journal-mechanics';

export const HISTORICAL_DEEP_HOUSE_JOURNAL_POST_HOLDOUT_SCHEMA = 'historical-deep-house-journal-post-holdout-sensitivity-v1' as const;

type Period = 'development' | 'holdout';

interface ArtifactRef {
  workflowRunId: number;
  artifactId: number;
  artifactName: string;
  artifactSha256: string;
  headSha: string;
  fileName: string;
}

export interface HistoricalDeepHouseJournalPostHoldoutPlan {
  schemaVersion: 'historical-deep-house-journal-post-holdout-plan-v1';
  frozenInputs: {
    developmentScoreArtifact: ArtifactRef;
    holdoutScoreArtifact: ArtifactRef;
  };
  frozenFinding: {
    mechanic: 'companion_substitution';
    predeclaredHoldoutStatus: 'replicates';
  };
  decisionBoundary: {
    confirmatoryStatus: 'none-post-reveal';
    probabilityAction: 'none';
    mechanicActionability: 'none';
    evidenceWeightChanges: 'none';
    targetPolicyChanges: 'none';
    productionChanges: 'none';
  };
  prospective2027_2028: {
    schemaVersion: 'historical-deep-house-journal-prospective-plan-v1';
    session: '2027-2028';
    chamber: 'house';
    mechanic: 'companion_substitution';
    minimumCompanionCases: number;
    minimumCompanionDecisiveMemberOutcomes: number;
    minimumAbsoluteMemberWeightedIncrementalContrast: number;
  };
}

interface PeriodSlice {
  cases: number;
  decisiveMemberOutcomes: number;
  memberWeightedSignedResidual: number;
  caseMeanSignedResidual: number;
}

interface PeriodDiagnostic {
  period: Period;
  overall: PeriodSlice;
  withMechanic: PeriodSlice;
  withoutMechanic: PeriodSlice;
  incrementalContrast: {
    memberWeighted: number;
    equalCase: number;
  };
  periodNormalizedResidual: {
    memberWeighted: number;
    equalCase: number;
  };
}

interface CaseResidual {
  period: Period;
  stableKey: string;
  identifier: string;
  occurredOn: string;
  signedResidual: number;
  mechanics: HistoricalDeepHouseJournalMechanic[];
}

export interface HistoricalDeepHouseJournalPostHoldoutArtifact {
  schemaVersion: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_POST_HOLDOUT_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    analysisStatus: 'post-reveal-descriptive-only';
    probabilityAction: 'none';
    actionabilityDecision: 'none';
    developmentArtifactId: number;
    holdoutArtifactId: number;
    interpretationGuard: string;
  };
  companionSubstitution: {
    development: PeriodDiagnostic;
    holdout: PeriodDiagnostic;
    crossPeriod: {
      memberWeightedIncrementalContrastChange: number;
      equalCaseIncrementalContrastChange: number;
      memberWeightedPeriodNormalizedChange: number;
      equalCasePeriodNormalizedChange: number;
      incrementalContrastSignStable: boolean;
      periodNormalizedSignStable: boolean;
      periodBalancedMeanIncrementalContrast: {
        memberWeighted: number;
        equalCase: number;
      };
    };
    caseHeterogeneity: {
      cases: CaseResidual[];
      positiveResidualCases: number;
      negativeResidualCases: number;
      zeroResidualCases: number;
    };
  };
  negativeControlAuthorAdded: {
    development: PeriodDiagnostic;
    holdout: PeriodDiagnostic;
    crossPeriod: {
      memberWeightedIncrementalContrastChange: number;
      equalCaseIncrementalContrastChange: number;
      incrementalContrastSignStable: boolean;
    };
    interpretation: string;
  };
  conclusion: {
    predeclaredReplicationStatus: 'replicates';
    incrementalSignalAssessment: 'not_stable_across_periods' | 'stable_positive_across_periods';
    productionAction: 'none';
    nextStep: string;
  };
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sign(value: number): -1 | 0 | 1 {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function compactDevelopmentSlice(value: HistoricalDeepHouseJournalQuickOutcomeSlice): PeriodSlice {
  return {
    cases: value.cases,
    decisiveMemberOutcomes: value.decisiveMemberOutcomes,
    memberWeightedSignedResidual: value.memberWeightedSignedResidual,
    caseMeanSignedResidual: value.caseMeanSignedResidual,
  };
}

function holdoutSlice(
  artifact: HistoricalDeepHouseJournalHoldoutScoreArtifact,
  mechanic: HistoricalDeepHouseJournalMechanic | null,
  include: boolean,
): PeriodSlice {
  const cases = mechanic === null
    ? artifact.cases
    : artifact.cases.filter((item) => item.mechanics.includes(mechanic) === include);
  if (cases.length === 0) {
    return { cases: 0, decisiveMemberOutcomes: 0, memberWeightedSignedResidual: 0, caseMeanSignedResidual: 0 };
  }
  const members = cases.flatMap((item) => item.members);
  const actualYesRate = members.filter((item) => item.actualOutcome === 1).length / members.length;
  const quickMean = mean(members.map((item) => item.yesProbability));
  return {
    cases: cases.length,
    decisiveMemberOutcomes: members.length,
    memberWeightedSignedResidual: actualYesRate - quickMean,
    caseMeanSignedResidual: mean(cases.map((item) => item.signedResidual)),
  };
}

function developmentDiagnostic(
  artifact: HistoricalDeepHouseJournalMechanicsScoreArtifact,
  mechanic: HistoricalDeepHouseJournalMechanic,
): PeriodDiagnostic {
  const score = artifact.summary.mechanics[mechanic];
  if (!score.withoutMechanic) throw new Error(`Development ${mechanic} has no without-mechanic slice`);
  const overall = compactDevelopmentSlice(artifact.summary.overall);
  const withMechanic = compactDevelopmentSlice(score.withMechanic);
  const withoutMechanic = compactDevelopmentSlice(score.withoutMechanic);
  return {
    period: 'development',
    overall,
    withMechanic,
    withoutMechanic,
    incrementalContrast: {
      memberWeighted: withMechanic.memberWeightedSignedResidual - withoutMechanic.memberWeightedSignedResidual,
      equalCase: withMechanic.caseMeanSignedResidual - withoutMechanic.caseMeanSignedResidual,
    },
    periodNormalizedResidual: {
      memberWeighted: withMechanic.memberWeightedSignedResidual - overall.memberWeightedSignedResidual,
      equalCase: withMechanic.caseMeanSignedResidual - overall.caseMeanSignedResidual,
    },
  };
}

function holdoutDiagnostic(
  artifact: HistoricalDeepHouseJournalHoldoutScoreArtifact,
  mechanic: HistoricalDeepHouseJournalMechanic,
): PeriodDiagnostic {
  const overall = holdoutSlice(artifact, null, true);
  const withMechanic = holdoutSlice(artifact, mechanic, true);
  const withoutMechanic = holdoutSlice(artifact, mechanic, false);
  if (withMechanic.cases === 0 || withoutMechanic.cases === 0) {
    throw new Error(`Holdout ${mechanic} needs both with/without slices`);
  }
  return {
    period: 'holdout',
    overall,
    withMechanic,
    withoutMechanic,
    incrementalContrast: {
      memberWeighted: withMechanic.memberWeightedSignedResidual - withoutMechanic.memberWeightedSignedResidual,
      equalCase: withMechanic.caseMeanSignedResidual - withoutMechanic.caseMeanSignedResidual,
    },
    periodNormalizedResidual: {
      memberWeighted: withMechanic.memberWeightedSignedResidual - overall.memberWeightedSignedResidual,
      equalCase: withMechanic.caseMeanSignedResidual - overall.caseMeanSignedResidual,
    },
  };
}

function validateInputs(
  development: HistoricalDeepHouseJournalMechanicsScoreArtifact,
  holdout: HistoricalDeepHouseJournalHoldoutScoreArtifact,
  plan: HistoricalDeepHouseJournalPostHoldoutPlan,
): void {
  if (development.schemaVersion !== 'historical-deep-house-journal-mechanics-score-v1') throw new Error('Unexpected development score schema');
  if (holdout.schemaVersion !== 'historical-deep-house-journal-holdout-score-v1') throw new Error('Unexpected holdout score schema');
  if (plan.schemaVersion !== 'historical-deep-house-journal-post-holdout-plan-v1') throw new Error('Unexpected post-holdout plan schema');
  if (development.metadata.lineage.mechanicsArtifactId !== 10324485900) throw new Error('Development score mechanics lineage drifted');
  if (holdout.metadata.lineage.mechanicsArtifact.artifactId !== 10329173931) throw new Error('Holdout score mechanics lineage drifted');
  if (holdout.summary.primaryHypotheses.find((item) => item.mechanic === 'companion_substitution')?.status !== 'replicates') {
    throw new Error('Frozen holdout companion-substitution result is not the predeclared replication');
  }
  if (plan.frozenFinding.mechanic !== 'companion_substitution' || plan.frozenFinding.predeclaredHoldoutStatus !== 'replicates') {
    throw new Error('Post-holdout plan does not preserve the frozen finding');
  }
  if (plan.decisionBoundary.confirmatoryStatus !== 'none-post-reveal'
    || plan.decisionBoundary.probabilityAction !== 'none'
    || plan.decisionBoundary.mechanicActionability !== 'none'
    || plan.decisionBoundary.evidenceWeightChanges !== 'none'
    || plan.decisionBoundary.targetPolicyChanges !== 'none'
    || plan.decisionBoundary.productionChanges !== 'none') {
    throw new Error('Post-holdout decision boundary drifted');
  }
  if (plan.prospective2027_2028.session !== '2027-2028'
    || plan.prospective2027_2028.chamber !== 'house'
    || plan.prospective2027_2028.mechanic !== 'companion_substitution') {
    throw new Error('Prospective plan target drifted');
  }
}

export function analyzeHistoricalDeepHouseJournalPostHoldout(input: {
  development: HistoricalDeepHouseJournalMechanicsScoreArtifact;
  holdout: HistoricalDeepHouseJournalHoldoutScoreArtifact;
  plan: HistoricalDeepHouseJournalPostHoldoutPlan;
  generatedAt?: string;
}): HistoricalDeepHouseJournalPostHoldoutArtifact {
  validateInputs(input.development, input.holdout, input.plan);
  const devCompanion = developmentDiagnostic(input.development, 'companion_substitution');
  const holdoutCompanion = holdoutDiagnostic(input.holdout, 'companion_substitution');
  const devAuthor = developmentDiagnostic(input.development, 'author_added');
  const holdoutAuthor = holdoutDiagnostic(input.holdout, 'author_added');
  const companionCases: CaseResidual[] = [
    ...input.development.cases.filter((item) => item.mechanics.includes('companion_substitution')).map((item) => ({
      period: 'development' as const,
      stableKey: item.stableKey,
      identifier: item.identifier,
      occurredOn: item.occurredOn,
      signedResidual: item.signedResidual,
      mechanics: item.mechanics,
    })),
    ...input.holdout.cases.filter((item) => item.mechanics.includes('companion_substitution')).map((item) => ({
      period: 'holdout' as const,
      stableKey: item.stableKey,
      identifier: item.identifier,
      occurredOn: item.occurredOn,
      signedResidual: item.signedResidual,
      mechanics: item.mechanics,
    })),
  ].sort((left, right) => left.occurredOn.localeCompare(right.occurredOn) || left.identifier.localeCompare(right.identifier));

  const incrementalSignStable = sign(devCompanion.incrementalContrast.memberWeighted) === sign(holdoutCompanion.incrementalContrast.memberWeighted)
    && sign(devCompanion.incrementalContrast.equalCase) === sign(holdoutCompanion.incrementalContrast.equalCase);
  const normalizedSignStable = sign(devCompanion.periodNormalizedResidual.memberWeighted) === sign(holdoutCompanion.periodNormalizedResidual.memberWeighted)
    && sign(devCompanion.periodNormalizedResidual.equalCase) === sign(holdoutCompanion.periodNormalizedResidual.equalCase);

  return {
    schemaVersion: HISTORICAL_DEEP_HOUSE_JOURNAL_POST_HOLDOUT_SCHEMA,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    purpose: 'post-reveal descriptive sensitivity analysis preserving the #173 unconditional companion-substitution replication while testing whether its residual association is stable relative to contemporaneous non-companion and period-wide calibration; no result can change production behavior',
    metadata: {
      analysisStatus: 'post-reveal-descriptive-only',
      probabilityAction: 'none',
      actionabilityDecision: 'none',
      developmentArtifactId: input.plan.frozenInputs.developmentScoreArtifact.artifactId,
      holdoutArtifactId: input.plan.frozenInputs.holdoutScoreArtifact.artifactId,
      interpretationGuard: 'The holdout outcomes were known before this sensitivity plan was written. The predeclared H3 replication remains valid on its original unconditional endpoint, but these diagnostics are descriptive and cannot upgrade that finding into an incremental or causal mechanic effect.',
    },
    companionSubstitution: {
      development: devCompanion,
      holdout: holdoutCompanion,
      crossPeriod: {
        memberWeightedIncrementalContrastChange: holdoutCompanion.incrementalContrast.memberWeighted - devCompanion.incrementalContrast.memberWeighted,
        equalCaseIncrementalContrastChange: holdoutCompanion.incrementalContrast.equalCase - devCompanion.incrementalContrast.equalCase,
        memberWeightedPeriodNormalizedChange: holdoutCompanion.periodNormalizedResidual.memberWeighted - devCompanion.periodNormalizedResidual.memberWeighted,
        equalCasePeriodNormalizedChange: holdoutCompanion.periodNormalizedResidual.equalCase - devCompanion.periodNormalizedResidual.equalCase,
        incrementalContrastSignStable: incrementalSignStable,
        periodNormalizedSignStable: normalizedSignStable,
        periodBalancedMeanIncrementalContrast: {
          memberWeighted: mean([devCompanion.incrementalContrast.memberWeighted, holdoutCompanion.incrementalContrast.memberWeighted]),
          equalCase: mean([devCompanion.incrementalContrast.equalCase, holdoutCompanion.incrementalContrast.equalCase]),
        },
      },
      caseHeterogeneity: {
        cases: companionCases,
        positiveResidualCases: companionCases.filter((item) => item.signedResidual > 0).length,
        negativeResidualCases: companionCases.filter((item) => item.signedResidual < 0).length,
        zeroResidualCases: companionCases.filter((item) => item.signedResidual === 0).length,
      },
    },
    negativeControlAuthorAdded: {
      development: devAuthor,
      holdout: holdoutAuthor,
      crossPeriod: {
        memberWeightedIncrementalContrastChange: holdoutAuthor.incrementalContrast.memberWeighted - devAuthor.incrementalContrast.memberWeighted,
        equalCaseIncrementalContrastChange: holdoutAuthor.incrementalContrast.equalCase - devAuthor.incrementalContrast.equalCase,
        incrementalContrastSignStable: sign(devAuthor.incrementalContrast.memberWeighted) === sign(holdoutAuthor.incrementalContrast.memberWeighted)
          && sign(devAuthor.incrementalContrast.equalCase) === sign(holdoutAuthor.incrementalContrast.equalCase),
      },
      interpretation: 'author_added remains an administrative-only confounding sentinel and can never become actionable. Its comparison shows whether mechanics that correlate with bill mix acquire unstable residual associations across periods.',
    },
    conclusion: {
      predeclaredReplicationStatus: 'replicates',
      incrementalSignalAssessment: incrementalSignStable && normalizedSignStable
        ? 'stable_positive_across_periods'
        : 'not_stable_across_periods',
      productionAction: 'none',
      nextStep: 'Use the frozen 2027-2028 prospective shadow protocol. Evaluate companion substitution only on its within-session incremental residual contrast after minimum enrollment is met; do not create a production weight from development/2025-2026 data.',
    },
  };
}
