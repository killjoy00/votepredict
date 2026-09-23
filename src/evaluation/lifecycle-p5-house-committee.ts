import { createHash } from 'node:crypto';
import { historicalHtmlLines } from './historical-deep-discovery-extractor';
import { findExpandedRollCalls } from './historical-deep-expansion-extractor-v2';
import {
  classifyMotion,
  type HistoricalDeepProceduralMechanic,
} from './historical-deep-procedural-mechanics';
import type {
  LifecycleP3Snapshot,
  LifecycleState,
} from './lifecycle-p3-snapshot-dataset';

export const LIFECYCLE_P5_HOUSE_COMMITTEE_PLAN_VERSION =
  'lifecycle-p5-house-committee-plan-v1' as const;
export const LIFECYCLE_P5_HOUSE_COMMITTEE_MANIFEST_SCHEMA =
  'lifecycle-p5-house-committee-manifest-v1' as const;
export const LIFECYCLE_P5_HOUSE_COMMITTEE_SOURCE_SCHEMA =
  'lifecycle-p5-house-committee-sources-v1' as const;
export const LIFECYCLE_P5_HOUSE_COMMITTEE_FEATURE_SCHEMA =
  'lifecycle-p5-house-committee-features-v1' as const;
export const LIFECYCLE_P5_HOUSE_COMMITTEE_COVERAGE_SCHEMA =
  'lifecycle-p5-house-committee-coverage-v1' as const;

export const FROZEN_LIFECYCLE_P3_CONTENT_SHA256 =
  '45030a9780ce76690ea960605385f501c24047b461a82e1368a427a7267be39d' as const;

export const LIFECYCLE_P5_HOUSE_EXPECTED_BILLS: Record<string, number> = {
  '2021-2022': 4905,
  '2023-2024': 5488,
  '2025-2026': 5162,
};

export const LIFECYCLE_P5_HOUSE_ADJOURNMENT: Record<string, string> = {
  '2021-2022': '2022-05-23',
  '2023-2024': '2024-05-20',
  '2025-2026': '2026-05-18',
};

export interface LifecycleP5HouseBill {
  billId: string;
  session: string;
  identifier: string;
  introducedOn: string;
}

export interface LifecycleP5HouseCommitteeManifest {
  schemaVersion: typeof LIFECYCLE_P5_HOUSE_COMMITTEE_MANIFEST_SCHEMA;
  planVersion: typeof LIFECYCLE_P5_HOUSE_COMMITTEE_PLAN_VERSION;
  generatedAt: string;
  codeSha: string | null;
  frozenP3ContentSha256: typeof FROZEN_LIFECYCLE_P3_CONTENT_SHA256;
  metadata: {
    population: 'all_introduced_minnesota_house_hf_bills_2021_2026';
    selectionUsesFloorAccessOrOutcome: false;
    sourceDiscoveryUsesBillSpecificSearch: false;
    sameDayExcluded: true;
  };
  counts: {
    totalBills: number;
    bySession: Record<string, number>;
  };
  bills: LifecycleP5HouseBill[];
}

export interface LifecycleP5HouseCommitteeSourceMatch {
  billId: string;
  identifier: string;
  introducedOn: string;
}

export interface LifecycleP5HouseCommitteeSource {
  id: string;
  session: string;
  committeeId: string;
  meetingId: string;
  publishedOn: string;
  url: string;
  finalUrl: string;
  fetchedAt: string;
  contentSha256: string;
  byteLength: number;
  matchedBills: LifecycleP5HouseCommitteeSourceMatch[];
  content: string;
}

export interface LifecycleP5HouseCommitteeSourceDiagnostic {
  type:
    | 'committee_home_unavailable'
    | 'minute_unavailable'
    | 'minute_date_unresolved'
    | 'minute_index_date_mismatch';
  session: string;
  committeeId: string;
  meetingId?: string;
  url: string;
  detail: string;
  httpStatus?: number;
}

export interface LifecycleP5HouseCommitteeSourceBundle {
  schemaVersion: typeof LIFECYCLE_P5_HOUSE_COMMITTEE_SOURCE_SCHEMA;
  planVersion: typeof LIFECYCLE_P5_HOUSE_COMMITTEE_PLAN_VERSION;
  generatedAt: string;
  codeSha: string | null;
  manifestGeneratedAt: string;
  frozenP3ContentSha256: typeof FROZEN_LIFECYCLE_P3_CONTENT_SHA256;
  summary: {
    manifestBills: number;
    committeeHomeIdsAttempted: number;
    committeesDiscovered: number;
    minuteLinksDiscovered: number;
    minutePagesEligibleByIndexDate: number;
    minutePagesFetched: number;
    matchedSourcePages: number;
    billSourceMatches: number;
    billsWithAnySource: number;
    billsWithoutSource: number;
    billsWithAnySourceBySession: Record<string, number>;
  };
  sources: LifecycleP5HouseCommitteeSource[];
  diagnostics: LifecycleP5HouseCommitteeSourceDiagnostic[];
}

export interface LifecycleP5HouseCommitteeFeatureObservation {
  observationId: string;
  billId: string;
  session: string;
  identifier: string;
  publishedOn: string;
  sourceId: string;
  sourceUrl: string;
  sourceContentSha256: string;
  minuteMention: 1;
  namedRollCallBlocks: number;
  namedAyeCount: number;
  namedNayCount: number;
  mechanics: Record<HistoricalDeepProceduralMechanic | 'unclassified', number>;
}

export interface LifecycleP5HouseCommitteeFeatureArtifact {
  schemaVersion: typeof LIFECYCLE_P5_HOUSE_COMMITTEE_FEATURE_SCHEMA;
  planVersion: typeof LIFECYCLE_P5_HOUSE_COMMITTEE_PLAN_VERSION;
  generatedAt: string;
  sourceBundleSha256: string;
  summary: {
    sourcePages: number;
    observations: number;
    billsWithMinuteMention: number;
    billsWithNamedRollCall: number;
    namedRollCallBlocks: number;
    namedAyeNames: number;
    namedNayNames: number;
    bySession: Record<string, {
      observations: number;
      billsWithMinuteMention: number;
      billsWithNamedRollCall: number;
      namedRollCallBlocks: number;
    }>;
  };
  observations: LifecycleP5HouseCommitteeFeatureObservation[];
}

export interface LifecycleP5HouseCommitteeCoverageReport {
  schemaVersion: typeof LIFECYCLE_P5_HOUSE_COMMITTEE_COVERAGE_SCHEMA;
  planVersion: typeof LIFECYCLE_P5_HOUSE_COMMITTEE_PLAN_VERSION;
  generatedAt: string;
  frozenP3ContentSha256: typeof FROZEN_LIFECYCLE_P3_CONTENT_SHA256;
  eligibility: {
    genericDurableEvidence: {
      historicalLifecycleEligible: false;
      reason: string;
      p3EligibleSnapshots: 0;
    };
    priorFloorCohortCommitteeArtifact: {
      historicalSourceTimingValid: true;
      lifecycleSelectionEligible: false;
      reason: string;
      extractionRunId: 35627060388;
      candidateArtifactId: 10652783041;
    };
    fullUniverseHouseCommitteeCorpus: {
      lifecycleSelectionEligible: true;
      outcomeUseDuringDiscoveryOrExtraction: 'none';
      sameDayExcluded: true;
    };
  };
  coverageGate: {
    minimumTrainingBillsWithNamedRollCall: 50;
    minimumValidationBillsWithNamedRollCall: 50;
    minimumTrainingEligibleSnapshots: 100;
    minimumValidationEligibleSnapshots: 100;
    passed: boolean;
  };
  coverage: {
    houseBills: number;
    houseSnapshots: number;
    eligibleSnapshotsWithMinuteMention: number;
    eligibleSnapshotsWithNamedRollCall: number;
    billsWithEligibleMinuteMention: number;
    billsWithEligibleNamedRollCall: number;
    bySession: Record<string, {
      bills: number;
      snapshots: number;
      eligibleSnapshotsWithMinuteMention: number;
      eligibleSnapshotsWithNamedRollCall: number;
      billsWithEligibleMinuteMention: number;
      billsWithEligibleNamedRollCall: number;
    }>;
    byState: Record<LifecycleState, {
      snapshots: number;
      eligibleSnapshotsWithMinuteMention: number;
      eligibleSnapshotsWithNamedRollCall: number;
    }>;
  };
  nextAction: 'freeze_modeling_plan' | 'stop_for_coverage';
  automaticPromotion: false;
  servingChanged: false;
}

function isoDate(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) throw new Error(`Expected ISO calendar date, got ${value}`);
  return match[1];
}

function normalizedHouseIdentifiers(html: string): Set<string> {
  const text = historicalHtmlLines(html).join(' ');
  const identifiers = new Set<string>();
  for (const match of text.matchAll(/\bH\.?\s*F\.?\s*0*(\d+)\b/gi)) {
    identifiers.add(`HF${Number(match[1])}`);
  }
  return identifiers;
}

export function matchFullUniverseHouseBills(
  bills: readonly LifecycleP5HouseBill[],
  input: { session: string; meetingDate: string; html: string },
): LifecycleP5HouseCommitteeSourceMatch[] {
  const mentioned = normalizedHouseIdentifiers(input.html);
  return bills
    .filter((bill) =>
      bill.session === input.session
      && isoDate(bill.introducedOn) <= isoDate(input.meetingDate)
      && mentioned.has(bill.identifier))
    .map((bill) => ({
      billId: bill.billId,
      identifier: bill.identifier,
      introducedOn: bill.introducedOn,
    }))
    .sort((left, right) => left.identifier.localeCompare(right.identifier));
}

function emptyMechanics(): Record<HistoricalDeepProceduralMechanic | 'unclassified', number> {
  return {
    committee_recommends_passage: 0,
    advances_toward_floor_eligibility: 0,
    continues_committee_review: 0,
    impedes_current_bill_progress: 0,
    defers_current_bill_action: 0,
    unclassified: 0,
  };
}

function sourceBundleDigest(bundle: LifecycleP5HouseCommitteeSourceBundle): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({
    schemaVersion: bundle.schemaVersion,
    planVersion: bundle.planVersion,
    manifestGeneratedAt: bundle.manifestGeneratedAt,
    frozenP3ContentSha256: bundle.frozenP3ContentSha256,
    sources: bundle.sources.map((source) => ({
      id: source.id,
      session: source.session,
      publishedOn: source.publishedOn,
      contentSha256: source.contentSha256,
      matchedBills: source.matchedBills,
    })),
  }));
  return hash.digest('hex');
}

export function extractLifecycleP5HouseCommitteeFeatures(
  bundle: LifecycleP5HouseCommitteeSourceBundle,
  generatedAt = new Date().toISOString(),
): LifecycleP5HouseCommitteeFeatureArtifact {
  if (bundle.schemaVersion !== LIFECYCLE_P5_HOUSE_COMMITTEE_SOURCE_SCHEMA) {
    throw new Error(`Unsupported lifecycle P5 House committee source schema: ${String(bundle.schemaVersion)}`);
  }
  const observations: LifecycleP5HouseCommitteeFeatureObservation[] = [];

  for (const source of bundle.sources) {
    const actualHash = createHash('sha256').update(Buffer.from(source.content, 'utf8')).digest('hex');
    if (actualHash !== source.contentSha256) {
      throw new Error(`Lifecycle P5 source hash mismatch for ${source.id}`);
    }
    const lines = historicalHtmlLines(source.content);
    for (const bill of source.matchedBills) {
      const blocks = findExpandedRollCalls(lines, bill.identifier);
      const mechanics = emptyMechanics();
      let ayeCount = 0;
      let nayCount = 0;
      for (const block of blocks) {
        ayeCount += block.ayes.length;
        nayCount += block.nays.length;
        const classified = classifyMotion(block.motionText);
        if (classified.length === 0) mechanics.unclassified += 1;
        for (const mechanic of classified) mechanics[mechanic] += 1;
      }
      observations.push({
        observationId: createHash('sha256')
          .update(`${source.id}|${bill.billId}`)
          .digest('hex')
          .slice(0, 24),
        billId: bill.billId,
        session: source.session,
        identifier: bill.identifier,
        publishedOn: source.publishedOn,
        sourceId: source.id,
        sourceUrl: source.url,
        sourceContentSha256: source.contentSha256,
        minuteMention: 1,
        namedRollCallBlocks: blocks.length,
        namedAyeCount: ayeCount,
        namedNayCount: nayCount,
        mechanics,
      });
    }
  }

  observations.sort((left, right) =>
    left.session.localeCompare(right.session)
    || left.billId.localeCompare(right.billId)
    || left.publishedOn.localeCompare(right.publishedOn)
    || left.sourceId.localeCompare(right.sourceId));

  const sessions = Object.keys(LIFECYCLE_P5_HOUSE_EXPECTED_BILLS).sort();
  const bySession = Object.fromEntries(sessions.map((session) => {
    const rows = observations.filter((row) => row.session === session);
    return [session, {
      observations: rows.length,
      billsWithMinuteMention: new Set(rows.map((row) => row.billId)).size,
      billsWithNamedRollCall: new Set(rows.filter((row) => row.namedRollCallBlocks > 0).map((row) => row.billId)).size,
      namedRollCallBlocks: rows.reduce((sum, row) => sum + row.namedRollCallBlocks, 0),
    }];
  }));

  return {
    schemaVersion: LIFECYCLE_P5_HOUSE_COMMITTEE_FEATURE_SCHEMA,
    planVersion: LIFECYCLE_P5_HOUSE_COMMITTEE_PLAN_VERSION,
    generatedAt,
    sourceBundleSha256: sourceBundleDigest(bundle),
    summary: {
      sourcePages: bundle.sources.length,
      observations: observations.length,
      billsWithMinuteMention: new Set(observations.map((row) => row.billId)).size,
      billsWithNamedRollCall: new Set(
        observations.filter((row) => row.namedRollCallBlocks > 0).map((row) => row.billId),
      ).size,
      namedRollCallBlocks: observations.reduce((sum, row) => sum + row.namedRollCallBlocks, 0),
      namedAyeNames: observations.reduce((sum, row) => sum + row.namedAyeCount, 0),
      namedNayNames: observations.reduce((sum, row) => sum + row.namedNayCount, 0),
      bySession,
    },
    observations,
  };
}

function stateCoverageTemplate(): Record<LifecycleState, {
  snapshots: number;
  eligibleSnapshotsWithMinuteMention: number;
  eligibleSnapshotsWithNamedRollCall: number;
}> {
  return {
    introduced: { snapshots: 0, eligibleSnapshotsWithMinuteMention: 0, eligibleSnapshotsWithNamedRollCall: 0 },
    committee_process_engagement: { snapshots: 0, eligibleSnapshotsWithMinuteMention: 0, eligibleSnapshotsWithNamedRollCall: 0 },
    floor_eligibility_or_scheduling: { snapshots: 0, eligibleSnapshotsWithMinuteMention: 0, eligibleSnapshotsWithNamedRollCall: 0 },
    source_chamber_passage_vote_reached: { snapshots: 0, eligibleSnapshotsWithMinuteMention: 0, eligibleSnapshotsWithNamedRollCall: 0 },
  };
}

export function auditLifecycleP5HouseCommitteeCoverage(input: {
  snapshots: readonly LifecycleP3Snapshot[];
  features: LifecycleP5HouseCommitteeFeatureArtifact;
  p3ContentSha256: string;
  generatedAt?: string;
}): LifecycleP5HouseCommitteeCoverageReport {
  if (input.p3ContentSha256 !== FROZEN_LIFECYCLE_P3_CONTENT_SHA256) {
    throw new Error(
      `Lifecycle P5 refuses P3 drift: ${input.p3ContentSha256} != ${FROZEN_LIFECYCLE_P3_CONTENT_SHA256}`,
    );
  }
  const houseSnapshots = input.snapshots.filter((snapshot) => snapshot.bill.chamber === 'house');
  const byBill = new Map<string, LifecycleP5HouseCommitteeFeatureObservation[]>();
  for (const observation of input.features.observations) {
    const bucket = byBill.get(observation.billId) ?? [];
    bucket.push(observation);
    byBill.set(observation.billId, bucket);
  }

  const sessionStats = Object.fromEntries(
    Object.keys(LIFECYCLE_P5_HOUSE_EXPECTED_BILLS).sort().map((session) => [session, {
      bills: new Set(houseSnapshots.filter((snapshot) => snapshot.bill.session === session)
        .map((snapshot) => snapshot.bill.billId)).size,
      snapshots: 0,
      eligibleSnapshotsWithMinuteMention: 0,
      eligibleSnapshotsWithNamedRollCall: 0,
      billsWithEligibleMinuteMention: 0,
      billsWithEligibleNamedRollCall: 0,
    }]),
  );
  const stateStats = stateCoverageTemplate();
  const billsWithMinute = new Set<string>();
  const billsWithRollCall = new Set<string>();
  const billsWithMinuteBySession = new Map<string, Set<string>>();
  const billsWithRollCallBySession = new Map<string, Set<string>>();
  let snapshotMinuteCount = 0;
  let snapshotRollCallCount = 0;

  for (const snapshot of houseSnapshots) {
    const session = sessionStats[snapshot.bill.session];
    if (!session) throw new Error(`Unexpected P5 session ${snapshot.bill.session}`);
    session.snapshots += 1;
    stateStats[snapshot.features.lifecycleState].snapshots += 1;
    const eligible = (byBill.get(snapshot.bill.billId) ?? []).filter(
      (row) => isoDate(row.publishedOn) < isoDate(snapshot.cutoff.asOfDateExclusive),
    );
    if (eligible.length > 0) {
      snapshotMinuteCount += 1;
      session.eligibleSnapshotsWithMinuteMention += 1;
      stateStats[snapshot.features.lifecycleState].eligibleSnapshotsWithMinuteMention += 1;
      billsWithMinute.add(snapshot.bill.billId);
      const set = billsWithMinuteBySession.get(snapshot.bill.session) ?? new Set<string>();
      set.add(snapshot.bill.billId);
      billsWithMinuteBySession.set(snapshot.bill.session, set);
    }
    if (eligible.some((row) => row.namedRollCallBlocks > 0)) {
      snapshotRollCallCount += 1;
      session.eligibleSnapshotsWithNamedRollCall += 1;
      stateStats[snapshot.features.lifecycleState].eligibleSnapshotsWithNamedRollCall += 1;
      billsWithRollCall.add(snapshot.bill.billId);
      const set = billsWithRollCallBySession.get(snapshot.bill.session) ?? new Set<string>();
      set.add(snapshot.bill.billId);
      billsWithRollCallBySession.set(snapshot.bill.session, set);
    }
  }

  for (const session of Object.keys(sessionStats)) {
    sessionStats[session].billsWithEligibleMinuteMention =
      billsWithMinuteBySession.get(session)?.size ?? 0;
    sessionStats[session].billsWithEligibleNamedRollCall =
      billsWithRollCallBySession.get(session)?.size ?? 0;
  }

  const coverageGate = {
    minimumTrainingBillsWithNamedRollCall: 50 as const,
    minimumValidationBillsWithNamedRollCall: 50 as const,
    minimumTrainingEligibleSnapshots: 100 as const,
    minimumValidationEligibleSnapshots: 100 as const,
    passed:
      (sessionStats['2021-2022']?.billsWithEligibleNamedRollCall ?? 0) >= 50
      && (sessionStats['2023-2024']?.billsWithEligibleNamedRollCall ?? 0) >= 50
      && (sessionStats['2021-2022']?.eligibleSnapshotsWithNamedRollCall ?? 0) >= 100
      && (sessionStats['2023-2024']?.eligibleSnapshotsWithNamedRollCall ?? 0) >= 100,
  };

  return {
    schemaVersion: LIFECYCLE_P5_HOUSE_COMMITTEE_COVERAGE_SCHEMA,
    planVersion: LIFECYCLE_P5_HOUSE_COMMITTEE_PLAN_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    frozenP3ContentSha256: FROZEN_LIFECYCLE_P3_CONTENT_SHA256,
    eligibility: {
      genericDurableEvidence: {
        historicalLifecycleEligible: false,
        reason: 'P3 found zero generic durable-evidence rows whose persisted fetch/publication availability predates the historical lifecycle cutoffs.',
        p3EligibleSnapshots: 0,
      },
      priorFloorCohortCommitteeArtifact: {
        historicalSourceTimingValid: true,
        lifecycleSelectionEligible: false,
        reason: 'The prior committee artifact was generated from replayable historical Quick floor-vote events. Outcome fields were excluded, but cohort inclusion itself conditions on floor access and is therefore invalid for lifecycle/floor-access modeling.',
        extractionRunId: 35627060388,
        candidateArtifactId: 10652783041,
      },
      fullUniverseHouseCommitteeCorpus: {
        lifecycleSelectionEligible: true,
        outcomeUseDuringDiscoveryOrExtraction: 'none',
        sameDayExcluded: true,
      },
    },
    coverageGate,
    coverage: {
      houseBills: new Set(houseSnapshots.map((snapshot) => snapshot.bill.billId)).size,
      houseSnapshots: houseSnapshots.length,
      eligibleSnapshotsWithMinuteMention: snapshotMinuteCount,
      eligibleSnapshotsWithNamedRollCall: snapshotRollCallCount,
      billsWithEligibleMinuteMention: billsWithMinute.size,
      billsWithEligibleNamedRollCall: billsWithRollCall.size,
      bySession: sessionStats,
      byState: stateStats,
    },
    nextAction: coverageGate.passed ? 'freeze_modeling_plan' : 'stop_for_coverage',
    automaticPromotion: false,
    servingChanged: false,
  };
}
