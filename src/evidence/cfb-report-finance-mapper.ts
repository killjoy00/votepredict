import {
  firstCfbReportAvailabilityForTransaction,
  type CfbReportAvailabilityWindow,
} from './cfb-report-availability.js';
import {
  cfbReportTextDemonstratesFinanceRow,
  type CfbParsedReportProof,
} from './cfb-report-pdf-proof.js';

export interface CfbFinanceRowForAvailability {
  registrationNumber: string | null;
  transactionDate: string | null;
  kind?: string;
  amount: number;
  totalAmount?: number;
  contributor?: string | null;
  contributorRegistrationNumber?: string | null;
  vendorName?: string | null;
  affectedCommitteeName?: string | null;
  affectedCommitteeRegistrationNumber?: string | null;
}

export interface CfbFinanceAvailabilityMatch {
  proof: CfbParsedReportProof;
  window: CfbReportAvailabilityWindow;
}

export function firstProvenCfbFinanceAvailability(
  row: CfbFinanceRowForAvailability,
  reportTexts: ReadonlyArray<{ proof: CfbParsedReportProof; text: string }>,
): CfbFinanceAvailabilityMatch | null {
  if (!row.registrationNumber || !row.transactionDate) return null;

  const demonstrated = reportTexts.filter(item =>
    item.proof.reference.registrationNumber === row.registrationNumber
    && cfbReportTextDemonstratesFinanceRow(row, item.text));

  const window = firstCfbReportAvailabilityForTransaction({
    registrationNumber: row.registrationNumber,
    occurredOn: row.transactionDate,
  }, demonstrated.map(item => item.proof.window));

  if (!window) return null;
  const matched = demonstrated.find(item =>
    item.proof.window.reportName === window.reportName
    && item.proof.window.availableOn === window.availableOn
    && item.proof.window.proofUrl === window.proofUrl);
  return matched ? { proof: matched.proof, window } : null;
}
