import {
  cfbCandidateSegmentEndYear,
  type CfbCandidateViewerReferenceSnapshot,
} from './cfb-candidate-report-history.js';
import { cfbReportViewerUrl } from './cfb-current-report-acquisition.js';
import type { CfbReportViewerReference } from './cfb-report-pdf-proof.js';
import type { HistoricalFinanceEvidenceExport } from './cfb-historical-release-audit.js';

export const CFB_CANDIDATE_REFERENCE_INVENTORY_VERSION =
  'cfb-senate-candidate-reference-inventory-v1' as const;
export const CFB_CANDIDATE_INVENTORY_YEARS = [2021, 2022, 2023, 2024, 2025] as const;

export interface CfbCandidateInventoryTarget {
  registrationNumber: string;
  year: number;
}

export type CfbCandidateInventorySnapshot =
  | (CfbCandidateViewerReferenceSnapshot & { status: 'acquired' })
  | {
      status: 'fetch_failed';
      registrationNumber: string;
      segmentEndYear: number;
      sourceUrl: string;
      errorKind: string;
    };

export interface CfbCandidateReportReferenceEntry {
  registrationNumber: string;
  reportYear: number;
  reportId: string;
  reportName: string;
  period: string;
  amendment: number;
  viewerUrl: string;
  sourceViewerPage: string;
  sourceApiUrl: string;
  sourceResponseSha256: string;
  fetchedAt: string;
  reportPdfSha256: null;
  reportFiledOn: null;
  reportDueOn: null;
  availableOn: null;
  rowContainmentVerified: false;
}

export interface CfbCandidateInventoryYearEntry {
  registrationNumber: string;
  year: number;
  segmentEndYear: 2022 | 2024 | 2026;
  status:
    | 'source_not_probed'
    | 'source_fetch_failed'
    | 'source_payload_invalid'
    | 'source_snapshots_conflict'
    | 'source_references_observed'
    | 'no_matching_year_references';
  referenceCount: number;
  referenceIds: string[];
  invalidReferences: number;
  sourceResponseSha256: string | null;
  sourceViewerPage: string | null;
  reportFileVerification: 'not_performed';
  scopeIsOfficialDenominator: false;
}

const BASE = 'https://register.cfb.mn.gov';

function validTarget(value: CfbCandidateInventoryTarget): boolean {
  return /^\d{3,8}$/.test(value.registrationNumber)
    && CFB_CANDIDATE_INVENTORY_YEARS.includes(value.year as typeof CFB_CANDIDATE_INVENTORY_YEARS[number]);
}

function sourceViewer(registrationNumber: string, segmentEndYear: number): string {
  return BASE + '/reports-and-data/viewers/campaign-finance/candidates/'
    + registrationNumber + '/' + segmentEndYear + '/';
}

function validCapture(s: CfbCandidateInventorySnapshot): s is Extract<CfbCandidateInventorySnapshot, { status: 'acquired' }> {
  if (s.status !== 'acquired' || !/^\d{3,8}$/.test(s.registrationNumber)) return false;
  if (![2022, 2024, 2026].includes(s.segmentEndYear)) return false;
  if (s.sourceUrl !== sourceViewer(s.registrationNumber, s.segmentEndYear)) return false;
  if (s.apiUrl !== BASE + '/reports-and-data/viewers/campaign-finance/candidates/api') return false;
  if (!/^[a-f0-9]{64}$/.test(s.responseSha256)) return false;
  const date = new Date(s.fetchedAt);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === s.fetchedAt
    && Array.isArray(s.references);
}

function referenceKey(r: CfbReportViewerReference): string {
  return [r.registrationNumber, r.year, r.type, r.period, r.se, r.amendment].join(':');
}

function validReference(r: CfbReportViewerReference, s: CfbCandidateViewerReferenceSnapshot): boolean {
  const expected = new Set([String(s.segmentEndYear - 1).slice(2), String(s.segmentEndYear).slice(2)]);
  return r.registrationNumber === s.registrationNumber
    && expected.has(r.year)
    && r.type === 'pcc'
    && /^[A-Za-z0-9_-]{1,15}$/.test(r.period)
    && /^[A-Za-z0-9_-]{1,10}$/.test(r.se)
    && Number.isInteger(r.amendment) && r.amendment >= 0 && r.amendment <= 99
    && typeof r.reportName === 'string' && r.reportName.length > 0 && r.reportName.length < 250;
}

export function deriveSenateCandidateFinanceInventoryTargets(
  rows: readonly HistoricalFinanceEvidenceExport[],
): CfbCandidateInventoryTarget[] {
  const keys = new Set<string>();
  for (const row of rows) {
    const candidateKind =
      row.sourceKind === 'campaign_finance_candidate_contribution_bulk'
      || row.sourceKind === 'campaign_finance_candidate_expenditure_bulk'
      || (
        row.sourceKind === 'campaign_finance_bulk'
        && ['candidate_contribution_record', 'candidate_expenditure_record'].includes(String(row.metadata.subtype))
      );
    if (!candidateKind) continue;
    const chamber = row.membershipChamber ?? row.metadata.chamber;
    if (chamber !== 'senate') continue;
    const registrationNumber = String(row.metadata.filerRegistrationNumber ?? '').trim();
    const year = Number(row.metadata.year);
    const target = { registrationNumber, year };
    if (validTarget(target)) keys.add(registrationNumber + ':' + year);
  }
  return [...keys].sort().map(key => {
    const [registrationNumber, rawYear] = key.split(':');
    return { registrationNumber: registrationNumber!, year: Number(rawYear) };
  });
}

/**
 * This reconciles *observed public viewer references* against a supplied
 * partial target set. No target/source row count is the official CFB filer or
 * required-report denominator; it does not verify a downloaded PDF, filing
 * date, statutory due date, historical publication, or row containment.
 */
export function auditCfbSenateCandidateReportReferences(
  targets: readonly CfbCandidateInventoryTarget[],
  snapshots: readonly CfbCandidateInventorySnapshot[],
) {
  const skippedTargets = targets.filter(target => !validTarget(target)).length;
  const uniqueTargets = new Map<string, CfbCandidateInventoryTarget>();
  for (const target of targets) {
    if (validTarget(target)) uniqueTargets.set(target.registrationNumber + ':' + target.year, target);
  }
  const scoped = [...uniqueTargets.values()].sort((a, b) =>
    a.year - b.year || a.registrationNumber.localeCompare(b.registrationNumber));

  const snapshotGroups = new Map<string, CfbCandidateInventorySnapshot[]>();
  for (const s of snapshots) {
    const key = s.registrationNumber + ':' + s.segmentEndYear;
    const current = snapshotGroups.get(key) ?? [];
    current.push(s);
    snapshotGroups.set(key, current);
  }

  const refs = new Map<string, CfbCandidateReportReferenceEntry>();
  const rows: CfbCandidateInventoryYearEntry[] = [];
  for (const target of scoped) {
    const segmentEndYear = cfbCandidateSegmentEndYear(target.year)!;
    const key = target.registrationNumber + ':' + segmentEndYear;
    const matching = snapshotGroups.get(key) ?? [];
    let status: CfbCandidateInventoryYearEntry['status'] = 'source_not_probed';
    let invalidReferences = 0;
    let sourceResponseSha256: string | null = null;
    let sourceViewerPage: string | null = null;
    const referenceIds: string[] = [];
    if (matching.length > 0) {
      const acquired = matching.filter(validCapture);
      if (matching.some(s => s.status === 'acquired' && !validCapture(s))) {
        status = 'source_payload_invalid';
      } else if (acquired.length === 0) {
        status = 'source_fetch_failed';
      } else if (
        matching.length !== acquired.length
        || new Set(acquired.map(s => s.responseSha256)).size > 1
        || new Set(acquired.map(s => JSON.stringify(s.references))).size > 1
      ) {
        status = 'source_snapshots_conflict';
      } else {
        const source = acquired[0]!;
        sourceResponseSha256 = source.responseSha256;
        sourceViewerPage = source.sourceUrl;
        status = 'no_matching_year_references';
        {
          const seen = new Set<string>();
          for (const ref of source.references) {
            if (!validReference(ref, source)) {
              invalidReferences++;
              continue;
            }
            if (2000 + Number(ref.year) !== target.year) continue;
            const id = referenceKey(ref);
            if (seen.has(id)) continue;
            seen.add(id);
            referenceIds.push(id);
            refs.set(id, {
              registrationNumber: ref.registrationNumber,
              reportYear: target.year,
              reportId: id,
              reportName: ref.reportName,
              period: ref.period,
              amendment: ref.amendment,
              viewerUrl: cfbReportViewerUrl(ref),
              sourceViewerPage: source.sourceUrl,
              sourceApiUrl: source.apiUrl,
              sourceResponseSha256: source.responseSha256,
              fetchedAt: source.fetchedAt,
              reportPdfSha256: null,
              reportFiledOn: null,
              reportDueOn: null,
              availableOn: null,
              rowContainmentVerified: false,
            });
          }
          if (referenceIds.length > 0) status = 'source_references_observed';
        }
      }
    }
    referenceIds.sort();
    rows.push({
      registrationNumber: target.registrationNumber, year: target.year,
      segmentEndYear, status, referenceCount: referenceIds.length,
      referenceIds, invalidReferences, sourceResponseSha256, sourceViewerPage,
      reportFileVerification: 'not_performed', scopeIsOfficialDenominator: false,
    });
  }

  const byYear = CFB_CANDIDATE_INVENTORY_YEARS.map(year => {
    const group = rows.filter(r => r.year === year);
    return {
      year,
      scopedFilerYears: group.length,
      filerYearsWithViewerReferences: group.filter(r => r.status === 'source_references_observed').length,
      observedDistinctReportReferences: group.reduce((sum, r) => sum + r.referenceCount, 0),
      sourceNotProbed: group.filter(r => r.status === 'source_not_probed').length,
      sourceFetchFailed: group.filter(r => r.status === 'source_fetch_failed').length,
      sourcePayloadInvalid: group.filter(r => r.status === 'source_payload_invalid').length,
      sourceSnapshotsConflict: group.filter(r => r.status === 'source_snapshots_conflict').length,
      noMatchingYearReferences: group.filter(r => r.status === 'no_matching_year_references').length,
      sourceDenominator: null as null,
      requiredReportDenominator: null as null,
      verifiedPdfCount: 0,
    };
  });
  const reports = [...refs.values()].sort((a, b) =>
    a.reportYear - b.reportYear || a.registrationNumber.localeCompare(b.registrationNumber)
    || a.reportId.localeCompare(b.reportId));
  return {
    schemaVersion: CFB_CANDIDATE_REFERENCE_INVENTORY_VERSION,
    scope: { chamber: 'senate' as const, years: [...CFB_CANDIDATE_INVENTORY_YEARS] },
    inputs: {
      suppliedTargetFilerYears: targets.length,
      acceptedDistinctTargetFilerYears: scoped.length,
      excludedInvalidTargetFilerYears: skippedTargets,
      officialViewerSnapshotsSupplied: snapshots.length,
      targetSetMayOmitEntireFilerCommittees: true,
    },
    byYear,
    filerYears: rows,
    reports,
    denominator: {
      officialRegisteredSenateFilerCount: null as null,
      officialRequiredReportCount: null as null,
      actualFiledReportCount: null as null,
      completenessCertified: false,
      reason: 'The partial Senate target set and reports tab expose references only. The official historical filer/required-filing inventory, amendments, waived reports, and nonfilers are not exhaustively enumerated.',
    },
    policy: {
      liveDatabaseRead: false,
      liveDatabaseWrite: false,
      noReportPdfAcquired: true,
      noStatutoryDueDateInferredFromReportTitle: true,
      noReportReferenceGrantsHistoricalEligibility: true,
      noProductionServingOrModelChange: true,
    },
  };
}
