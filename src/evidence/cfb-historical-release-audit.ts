import { cfbElectronicReportAvailableOn } from './cfb-report-availability.js';

export const CFB_HISTORICAL_RELEASE_AUDIT_VERSION = 'cfb-historical-release-debt-v1' as const;
export const CFB_HISTORICAL_RELEASE_YEARS = [2021, 2022, 2023, 2024, 2025] as const;

export type HistoricalFinanceFamily =
  | 'candidate_contribution'
  | 'candidate_expenditure'
  | 'independent_expenditure';

export interface HistoricalFinanceEvidenceExport {
  sourceKind: string;
  membershipChamber?: string | null;
  sourceUrl?: string | null;
  sourceSha256?: string | null;
  publishedAt?: string | null;
  metadata: Record<string, unknown>;
}

// This is a separately supplied, row-specific official-report proof manifest.
// A digest/locator must be checked against the actual official source in an
// independent acquisition step; the manifest itself is NOT a certificate.
export interface HistoricalFinanceReportRowProof {
  rowKey: string;
  family: HistoricalFinanceFamily;
  registrationNumber: string;
  reportId: string;
  reportName: string;
  reportType: 'ordinary_report' | 'large_contribution_notice';
  coverageStartOn: string;
  coverageEndOn: string;
  filedOn: string;
  dueOn?: string;
  disclosedOn?: string;
  proofUrl: string;
  reportSha256: string;
  exactRowProofSha256: string;
}

type AuditFlag =
  | 'legacy_eligibility_requires_revalidation'
  | 'missing_report_due_date'
  | 'missing_report_filing_date'
  | 'missing_row_level_official_proof'
  | 'invalid_official_proof_manifest'
  | 'conflicting_persisted_copies'
  | 'stored_date_precedes_source_linked_bound'
  | 'stored_date_precedes_recorded_due_date_bound'
  | 'published_at_and_metadata_disagree'
  | 'eligible_without_stored_date'
  | 'registration_number_missing';

export interface HistoricalFinanceAuditRow {
  rowKey: string;
  family: HistoricalFinanceFamily;
  year: number;
  registrationNumber: string | null;
  transactionDate: string | null;
  storedEligible: boolean;
  storedAvailableOn: string | null;
  storedPolicyVersions: string[];
  sourceKinds: string[];
  publishedDate: string | null;
  sourceLinkedBoundOn: string | null;
  sourceLinkedReportId: string | null;
  sourceLinkedProofUrl: string | null;
  sourceLinkedReportSha256: string | null;
  sourceLinkedRowProofSha256: string | null;
  sourceLinkedProvenanceOnly: true;
  status: 'source_linked_review_candidate' | 'unverified';
  flags: AuditFlag[];
  persistedCopies: number;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function iso(value: unknown): string | null {
  const s = str(value);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s ? s : null;
}

function sourceFamily(row: HistoricalFinanceEvidenceExport): HistoricalFinanceFamily | null {
  if (row.sourceKind === 'campaign_finance_candidate_contribution_bulk') return 'candidate_contribution';
  if (row.sourceKind === 'campaign_finance_candidate_expenditure_bulk') return 'candidate_expenditure';
  if (row.sourceKind === 'campaign_finance_independent_expenditure_bulk') return 'independent_expenditure';
  if (row.sourceKind === 'campaign_finance_bulk') {
    if (row.metadata.subtype === 'candidate_contribution_record') return 'candidate_contribution';
    if (row.metadata.subtype === 'candidate_expenditure_record') return 'candidate_expenditure';
  }
  return null;
}

function officialUrl(value: unknown): boolean {
  const raw = str(value);
  if (!raw) return false;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (host === 'cfb.mn.gov' || host.endsWith('.cfb.mn.gov'));
  } catch {
    return false;
  }
}

function isSha256(value: unknown): boolean {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function proofBound(
  proof: HistoricalFinanceReportRowProof,
  input: { rowKey: string; family: HistoricalFinanceFamily; registrationNumber: string | null; transactionDate: string | null },
): string | null {
  if (
    !input.registrationNumber
    || proof.rowKey !== input.rowKey
    || proof.family !== input.family
    || proof.registrationNumber !== input.registrationNumber
    || !str(proof.reportId)
    || !str(proof.reportName)
    || !officialUrl(proof.proofUrl)
    || !isSha256(proof.reportSha256)
    || !isSha256(proof.exactRowProofSha256)
  ) return null;
  const start = iso(proof.coverageStartOn);
  const end = iso(proof.coverageEndOn);
  const filed = iso(proof.filedOn);
  if (
    !start || !end || !filed || start > end
    || !input.transactionDate
    || input.transactionDate < start || input.transactionDate > end
  ) return null;

  if (proof.reportType === 'ordinary_report') {
    const due = iso(proof.dueOn);
    if (!due || due < end || filed < end) return null;
    const statutoryAndFilingBound = cfbElectronicReportAvailableOn(filed, due);
    if (proof.disclosedOn !== undefined) {
      const disclosed = iso(proof.disclosedOn);
      if (!disclosed || disclosed < statutoryAndFilingBound) return null;
      return disclosed > statutoryAndFilingBound ? disclosed : statutoryAndFilingBound;
    }
    return statutoryAndFilingBound;
  }
  if (proof.reportType === 'large_contribution_notice') {
    const disclosed = iso(proof.disclosedOn);
    return disclosed && disclosed >= filed ? disclosed : null;
  }
  return null;
}

function metadataDate(row: HistoricalFinanceEvidenceExport, key: string): string | null {
  return iso(row.metadata[key]);
}

function eligible(row: HistoricalFinanceEvidenceExport): boolean {
  return row.metadata.asOfEligible === true || row.metadata.asOfEligible === 'true';
}

function yearForRow(row: HistoricalFinanceEvidenceExport): number | null {
  const raw = row.metadata.year;
  const year = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d{4}$/.test(raw) ? Number(raw) : NaN;
  return Number.isInteger(year) && year >= 2021 && year <= 2025 ? year : null;
}

function registrationForRow(row: HistoricalFinanceEvidenceExport, family: HistoricalFinanceFamily): string | null {
  return str(row.metadata[family === 'independent_expenditure' ? 'spenderRegistrationNumber' : 'filerRegistrationNumber']);
}

function sortedUnique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))].sort();
}

/**
 * Read-only triage over supplied exports. In particular, a source-linked claim
 * is only an independent REVIEW CANDIDATE, never a verified true denominator or
 * permission to update database eligibility.
 */
export function auditCfbHistoricalReleaseDebt(
  exports: readonly HistoricalFinanceEvidenceExport[],
  officialProofClaims: readonly HistoricalFinanceReportRowProof[] = [],
) {
  const accepted: Array<{ row: HistoricalFinanceEvidenceExport; family: HistoricalFinanceFamily; year: number; rowKey: string; registration: string | null }> = [];
  const omitted = { outOfYears: 0, nonSenateOrUnresolved: 0, unrelatedFinanceFamily: 0, missingRowKey: 0 };
  for (const row of exports) {
    const family = sourceFamily(row);
    if (!family) { omitted.unrelatedFinanceFamily += 1; continue; }
    const year = yearForRow(row);
    if (year === null) { omitted.outOfYears += 1; continue; }
    const chamber = str(row.membershipChamber) ?? str(row.metadata.chamber);
    if (chamber !== 'senate') { omitted.nonSenateOrUnresolved += 1; continue; }
    const rowKey = str(row.metadata.rowKey);
    if (!rowKey) { omitted.missingRowKey += 1; continue; }
    accepted.push({ row, family, year, rowKey, registration: registrationForRow(row, family) });
  }

  const grouped = new Map<string, typeof accepted>();
  for (const item of accepted) {
    const key = [item.family, item.year, item.registration ?? '', item.rowKey].join('|');
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }

  const reports = new Map<string, HistoricalFinanceReportRowProof[]>();
  for (const proof of officialProofClaims) {
    const rowKey = str(proof.rowKey);
    if (!rowKey) continue;
    const bucket = reports.get(rowKey) ?? [];
    bucket.push(proof);
    reports.set(rowKey, bucket);
  }

  const rows: HistoricalFinanceAuditRow[] = [];
  for (const copies of grouped.values()) {
    const first = copies[0]!;
    const { family, year, rowKey, registration } = first;
    const storedDates = sortedUnique(copies.map(({ row }) => metadataDate(row, 'availableOn')));
    const publishedDates = sortedUnique(copies.map(({ row }) => iso(str(row.publishedAt)?.slice(0, 10))));
    const storedAvailableOn = storedDates[0] ?? publishedDates[0] ?? null;
    const publishedDate = publishedDates[0] ?? null;
    const storedEligible = copies.some(({ row }) => eligible(row));
    const filedDates = sortedUnique(copies.map(({ row }) => metadataDate(row, 'filedOn')));
    const dueDates = sortedUnique(copies.map(({ row }) => metadataDate(row, 'reportDueOn')));
    const transactionDates = sortedUnique(copies.map(({ row }) => metadataDate(row, 'transactionDate')));
    const versions = sortedUnique(copies.map(({ row }) => str(row.metadata.availabilityPolicyVersion)));
    const flags = new Set<AuditFlag>();
    if (!registration) flags.add('registration_number_missing');
    if (!dueDates.length) flags.add('missing_report_due_date');
    if (!filedDates.length) flags.add('missing_report_filing_date');
    if (storedEligible && copies.some(({ row }) =>
      !str(row.metadata.availabilityPolicyVersion)
      || row.metadata.availabilityPolicyVersion !== 'mn-cfb-report-availability-v7'
    )) flags.add('legacy_eligibility_requires_revalidation');
    if (storedEligible && !storedAvailableOn) flags.add('eligible_without_stored_date');
    if (
      storedDates.length > 1 || publishedDates.length > 1
      || filedDates.length > 1 || dueDates.length > 1 || transactionDates.length > 1
    ) flags.add('conflicting_persisted_copies');
    if (storedDates.length && publishedDates.length && storedDates[0] !== publishedDates[0]) {
      flags.add('published_at_and_metadata_disagree');
    }
    if (filedDates.length === 1 && dueDates.length === 1 && storedAvailableOn) {
      const minimum = cfbElectronicReportAvailableOn(filedDates[0]!, dueDates[0]!);
      if (storedAvailableOn < minimum || (publishedDate !== null && publishedDate < minimum)) {
        flags.add('stored_date_precedes_recorded_due_date_bound');
      }
    }

    const candidates = reports.get(rowKey) ?? [];
    const linked = candidates.flatMap(proof => {
      const bound = proofBound(proof, {
        rowKey,
        family,
        registrationNumber: registration,
        transactionDate: transactionDates.length === 1 ? transactionDates[0]! : null,
      });
      return bound === null ? [] : [{ proof, bound }];
    }).sort((a, b) => a.bound.localeCompare(b.bound) || a.proof.reportId.localeCompare(b.proof.reportId));
    const best = linked[0];
    if (!best) flags.add('missing_row_level_official_proof');
    if (candidates.length && !linked.length) flags.add('invalid_official_proof_manifest');
    if (best && storedEligible && (
      (storedAvailableOn !== null && storedAvailableOn < best.bound)
      || (publishedDate !== null && publishedDate < best.bound)
    )) flags.add('stored_date_precedes_source_linked_bound');

    rows.push({
      rowKey, family, year, registrationNumber: registration,
      transactionDate: transactionDates.length === 1 ? transactionDates[0]! : null,
      storedEligible, storedAvailableOn, publishedDate,
      storedPolicyVersions: versions,
      sourceKinds: sortedUnique(copies.map(({ row }) => row.sourceKind)),
      sourceLinkedBoundOn: best?.bound ?? null,
      sourceLinkedReportId: best?.proof.reportId ?? null,
      sourceLinkedProofUrl: best?.proof.proofUrl ?? null,
      sourceLinkedReportSha256: best?.proof.reportSha256 ?? null,
      sourceLinkedRowProofSha256: best?.proof.exactRowProofSha256 ?? null,
      sourceLinkedProvenanceOnly: true,
      status: best && !flags.has('conflicting_persisted_copies')
        ? 'source_linked_review_candidate' : 'unverified',
      flags: [...flags].sort(),
      persistedCopies: copies.length,
    });
  }
  rows.sort((a, b) => a.year - b.year || a.family.localeCompare(b.family)
    || (a.registrationNumber ?? '').localeCompare(b.registrationNumber ?? '')
    || a.rowKey.localeCompare(b.rowKey));

  const families: HistoricalFinanceFamily[] =
    ['candidate_contribution', 'candidate_expenditure', 'independent_expenditure'];
  const byYearFamily = CFB_HISTORICAL_RELEASE_YEARS.flatMap(year => families.map(family => {
    const selected = rows.filter(row => row.year === year && row.family === family);
    return {
      year, family,
      persistedDistinctRowKeys: selected.length,
      priorEligibleClaims: selected.filter(row => row.storedEligible).length,
      legacyEligibleRevalidationDebt: selected.filter(row =>
        row.flags.includes('legacy_eligibility_requires_revalidation')).length,
      sourceLinkedReviewCandidates: selected.filter(row =>
        row.status === 'source_linked_review_candidate').length,
      rowsMissingRowProof: selected.filter(row =>
        row.flags.includes('missing_row_level_official_proof')).length,
      storedBeforeSourceLinkedBound: selected.filter(row =>
        row.flags.includes('stored_date_precedes_source_linked_bound')).length,
      conflictingPersistedCopies: selected.filter(row =>
        row.flags.includes('conflicting_persisted_copies')).length,
      officialReportDenominator: null as null,
      denominatorStatus: 'not_established' as const,
    };
  }));

  return {
    schemaVersion: CFB_HISTORICAL_RELEASE_AUDIT_VERSION,
    scope: { chamber: 'senate' as const, years: [...CFB_HISTORICAL_RELEASE_YEARS] },
    input: {
      exportedEvidenceRows: exports.length,
      inScopeEvidenceCopies: accepted.length,
      distinctInScopeRows: rows.length,
      externallySuppliedRowProofClaims: officialProofClaims.length,
      omitted,
    },
    byYearFamily,
    rows,
    denominator: {
      status: 'not_established' as const,
      officialReportCount: null as null,
      reconciliationCertified: false,
      reason: 'Official 2021–2025 CFB report/filer inventory denominator was not independently enumerated. Persisted rows and supplied proof claims are not that denominator.',
    },
    policy: {
      readOnlyOffline: true,
      priorEligibilityNeverAutoApproved: true,
      noSourceBytesIndependentlyVerified: true,
      noServingChange: true,
      noDatabaseWrites: true,
      noForecastCutoffOnSameAvailableDay: true,
    },
  };
}
