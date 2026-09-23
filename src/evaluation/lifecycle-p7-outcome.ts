import { createHash } from 'node:crypto';
import {
  LIFECYCLE_P7_FROZEN_LINEAGE_CONTENT_SHA256,
  type LifecycleP7LineageEdge,
} from './lifecycle-p7-lineage';
import {
  averagePrecision,
  brierScore,
  expectedCalibrationError,
  logLoss,
  rocAuc,
} from './metrics';

export const LIFECYCLE_P7_OUTCOME_SCHEMA_VERSION = 'lifecycle-p7-outcome-v1' as const;
export const LIFECYCLE_P7_OUTCOME_TARGET_VERSION = 'substantive_vehicle_passage_v1' as const;
export const LIFECYCLE_P7_FROZEN_LABEL_SHA256 =
  '5b18378725c736dd4eceb37992fd4295cbd779e24e3cdd92123f28192ab75eec';
export const LIFECYCLE_P7_FROZEN_INTRO_V4_TRANSFER_SHA256 =
  '1edb9e1466e5449fec5d382cfac6bcffa01c67be1cc0da52981506cb43fab8a6';

export interface LifecycleP7OutcomeBill {
  billId: string;
  session: string;
  chamber: 'house' | 'senate';
  identifier: string;
  strictPassage: boolean;
}

export interface LifecycleP7OutcomeRow {
  schemaVersion: typeof LIFECYCLE_P7_OUTCOME_SCHEMA_VERSION;
  targetVersion: typeof LIFECYCLE_P7_OUTCOME_TARGET_VERSION;
  billId: string;
  session: string;
  chamber: 'house' | 'senate';
  identifier: string;
  strictBillNumberPassage: boolean;
  substantiveVehiclePassage: boolean;
  incrementalVehiclePassage: boolean;
  directNeighborBillIds: string[];
  successfulDirectNeighborBillIds: string[];
  successfulDirectEdgeReasonCombinations: string[];
}

export interface LifecycleP7ProbabilityScore {
  observations: number;
  positives: number;
  positiveRate: number;
  meanProbability: number;
  brier: number;
  logLoss: number;
  expectedCalibrationError: number;
  averagePrecision: number | null;
  rocAuc: number | null;
}

function hashRows(rows: readonly unknown[]): string {
  const digest = createHash('sha256');
  for (const row of rows) digest.update(JSON.stringify(row) + '\n');
  return digest.digest('hex');
}

function sliceSummary(rows: readonly LifecycleP7OutcomeRow[]) {
  return {
    bills: rows.length,
    strictPositives: rows.filter((row) => row.strictBillNumberPassage).length,
    substantiveVehiclePositives: rows.filter((row) => row.substantiveVehiclePassage).length,
    incrementalVehiclePositives: rows.filter((row) => row.incrementalVehiclePassage).length,
    matchedBills: rows.filter((row) => row.directNeighborBillIds.length > 0).length,
    unmatchedBills: rows.filter((row) => row.directNeighborBillIds.length === 0).length,
  };
}

function groupedSummary(
  rows: readonly LifecycleP7OutcomeRow[],
  key: (row: LifecycleP7OutcomeRow) => string,
) {
  const groups = new Map<string, LifecycleP7OutcomeRow[]>();
  for (const row of rows) {
    const value = key(row);
    const bucket = groups.get(value) ?? [];
    bucket.push(row);
    groups.set(value, bucket);
  }
  return Object.fromEntries(
    [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([value, bucket]) => [value, sliceSummary(bucket)]),
  );
}

export function buildLifecycleP7Outcome(input: {
  observedLineageSha256: string;
  bills: readonly LifecycleP7OutcomeBill[];
  edges: readonly LifecycleP7LineageEdge[];
}) {
  if (input.observedLineageSha256 !== LIFECYCLE_P7_FROZEN_LINEAGE_CONTENT_SHA256) {
    throw new Error(
      'Lifecycle P7 outcome refuses lineage drift: expected ' +
      LIFECYCLE_P7_FROZEN_LINEAGE_CONTENT_SHA256 + ', observed ' +
      input.observedLineageSha256,
    );
  }

  const billsById = new Map(input.bills.map((bill) => [bill.billId, bill]));
  const edgesByBill = new Map<string, LifecycleP7LineageEdge[]>();
  for (const edge of input.edges) {
    if (!billsById.has(edge.left.billId) || !billsById.has(edge.right.billId)) {
      throw new Error('Lifecycle P7 edge references a bill outside the outcome population: ' + edge.edgeId);
    }
    for (const id of [edge.left.billId, edge.right.billId]) {
      const bucket = edgesByBill.get(id) ?? [];
      bucket.push(edge);
      edgesByBill.set(id, bucket);
    }
  }

  const rows: LifecycleP7OutcomeRow[] = [...input.bills]
    .sort((left, right) =>
      (left.session + '|' + left.chamber + '|' + left.identifier + '|' + left.billId)
        .localeCompare(right.session + '|' + right.chamber + '|' + right.identifier + '|' + right.billId))
    .map((bill) => {
      const directEdges = edgesByBill.get(bill.billId) ?? [];
      const directNeighborIds = new Set<string>();
      const successfulNeighborIds = new Set<string>();
      const successfulReasonCombinations = new Set<string>();

      for (const edge of directEdges) {
        const neighborId = edge.left.billId === bill.billId ? edge.right.billId : edge.left.billId;
        directNeighborIds.add(neighborId);
        const neighbor = billsById.get(neighborId);
        if (!neighbor) throw new Error('Missing direct P7 neighbor bill ' + neighborId);
        if (neighbor.strictPassage) {
          successfulNeighborIds.add(neighborId);
          successfulReasonCombinations.add([...edge.acceptedReasons].sort().join('+'));
        }
      }

      const successfulDirectNeighborBillIds = [...successfulNeighborIds].sort();
      const substantiveVehiclePassage = bill.strictPassage || successfulDirectNeighborBillIds.length > 0;
      return {
        schemaVersion: LIFECYCLE_P7_OUTCOME_SCHEMA_VERSION,
        targetVersion: LIFECYCLE_P7_OUTCOME_TARGET_VERSION,
        billId: bill.billId,
        session: bill.session,
        chamber: bill.chamber,
        identifier: bill.identifier,
        strictBillNumberPassage: bill.strictPassage,
        substantiveVehiclePassage,
        incrementalVehiclePassage: !bill.strictPassage && substantiveVehiclePassage,
        directNeighborBillIds: [...directNeighborIds].sort(),
        successfulDirectNeighborBillIds,
        successfulDirectEdgeReasonCombinations: [...successfulReasonCombinations].sort(),
      };
    });

  const incrementalRows = rows.filter((row) => row.incrementalVehiclePassage);
  const reasonCombinationCounts: Record<string, number> = {};
  for (const row of incrementalRows) {
    for (const combination of row.successfulDirectEdgeReasonCombinations) {
      reasonCombinationCounts[combination] = (reasonCombinationCounts[combination] ?? 0) + 1;
    }
  }

  return {
    report: {
      schemaVersion: LIFECYCLE_P7_OUTCOME_SCHEMA_VERSION,
      targetVersion: LIFECYCLE_P7_OUTCOME_TARGET_VERSION,
      frozenLineageSha256: LIFECYCLE_P7_FROZEN_LINEAGE_CONTENT_SHA256,
      population: sliceSummary(rows),
      bySession: groupedSummary(rows, (row) => row.session),
      byChamber: groupedSummary(rows, (row) => row.chamber),
      incrementalSuccessfulEdgeReasonCombinationCounts: Object.fromEntries(
        Object.entries(reasonCombinationCounts).sort(([left], [right]) => left.localeCompare(right)),
      ),
      labelSha256: hashRows(rows),
      policy: {
        strictBillNumberLabelModified: false,
        directEdgesOnly: true,
        transitiveComponentClosureUsed: false,
        memberVoteLabelsManufactured: 0,
        historicalResultStatus: 'development/robustness',
        automaticPromotionAllowed: false,
        servingChanged: false,
        productionAction: 'none',
        prospective2027RequiredForGoverningConfirmation: true,
      },
    },
    rows,
  };
}

export function scoreLifecycleP7Probabilities(input: {
  probabilities: readonly { billId: string; probability: number }[];
  labels: readonly LifecycleP7OutcomeRow[];
  target: 'strict' | 'substantive';
}): LifecycleP7ProbabilityScore {
  const labelsByBill = new Map(input.labels.map((row) => [row.billId, row]));
  const forecasts = input.probabilities.map((row) => {
    const label = labelsByBill.get(row.billId);
    if (!label) throw new Error('Missing Lifecycle P7 label for prediction bill ' + row.billId);
    return {
      probability: row.probability,
      outcome: (input.target === 'strict'
        ? label.strictBillNumberPassage
        : label.substantiveVehiclePassage) ? 1 as const : 0 as const,
    };
  });
  if (!forecasts.length) throw new Error('Lifecycle P7 probability scoring requires observations');
  const positives = forecasts.reduce((sum, row) => sum + row.outcome, 0);
  const negatives = forecasts.length - positives;
  return {
    observations: forecasts.length,
    positives,
    positiveRate: positives / forecasts.length,
    meanProbability: forecasts.reduce((sum, row) => sum + row.probability, 0) / forecasts.length,
    brier: brierScore(forecasts),
    logLoss: logLoss(forecasts),
    expectedCalibrationError: expectedCalibrationError(forecasts),
    averagePrecision: positives ? averagePrecision(forecasts) : null,
    rocAuc: positives && negatives ? rocAuc(forecasts) : null,
  };
}
