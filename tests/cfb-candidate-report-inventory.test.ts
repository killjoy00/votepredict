import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditCfbSenateCandidateReportReferences,
  deriveSenateCandidateFinanceInventoryTargets,
  type CfbCandidateInventorySnapshot,
  type CfbCandidateInventoryTarget,
} from '../src/evidence/cfb-candidate-report-inventory.js';
import type { CfbReportViewerReference } from '../src/evidence/cfb-report-pdf-proof.js';
import type { HistoricalFinanceEvidenceExport } from '../src/evidence/cfb-historical-release-audit.js';

function reference(
  id = '19205', year = '25',
  changes: Partial<CfbReportViewerReference> = {},
): CfbReportViewerReference {
  return {
    filingYear: 2026,
    registrationNumber: id, year, type: 'pcc',
    period: 'YE', se: '0', amendment: 0,
    reportName: '2025 Year-End Report',
    ...changes,
  };
}
function snapshot(
  id = '19205', segmentEndYear: 2022 | 2024 | 2026 = 2026,
  references: CfbReportViewerReference[] = [reference()],
): Extract<CfbCandidateInventorySnapshot, { status: 'acquired' }> {
  return {
    status: 'acquired',
    registrationNumber: id,
    segmentEndYear,
    sourceUrl: `https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/${id}/${segmentEndYear}/`,
    apiUrl: 'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/api',
    fetchedAt: '2026-10-09T20:00:00.000Z',
    responseSha256: 'a'.repeat(64),
    references,
  };
}

test('observes historical candidate reports but NEVER creates filing, due date, or completeness proof', () => {
  const targets: CfbCandidateInventoryTarget[] = [{ registrationNumber: '19205', year: 2025 }];
  const inventory = auditCfbSenateCandidateReportReferences(targets, [
    snapshot('19205', 2026, [reference(), reference('19205', '26'), reference()]),
  ]);
  assert.equal(inventory.filerYears[0]?.status, 'source_references_observed');
  assert.equal(inventory.filerYears[0]?.referenceCount, 1);
  assert.equal(inventory.reports.length, 1);
  assert.equal(inventory.reports[0]?.reportYear, 2025);
  assert.equal(inventory.reports[0]?.reportPdfSha256, null);
  assert.equal(inventory.reports[0]?.reportDueOn, null);
  assert.equal(inventory.reports[0]?.reportFiledOn, null);
  assert.equal(inventory.reports[0]?.availableOn, null);
  assert.equal(inventory.reports[0]?.rowContainmentVerified, false);
  assert.equal(inventory.reports[0]?.sourceResponseSha256, 'a'.repeat(64));
  assert.ok(inventory.reports[0]?.viewerUrl.includes('regnum=19205'));
  assert.equal(inventory.byYear.find(x => x.year === 2025)?.observedDistinctReportReferences, 1);
  assert.equal(inventory.denominator.actualFiledReportCount, null);
  assert.equal(inventory.denominator.completenessCertified, false);
  assert.equal(inventory.policy.noReportReferenceGrantsHistoricalEligibility, true);
  assert.equal(inventory.policy.liveDatabaseWrite, false);
});

test('strictly derives only 2021-25 Senate candidate-filer years, not IE/PAC/House/future', () => {
  function row(
    sourceKind: string,
    chamber: string, year: number, registrationNumber: string,
    subtype?: string,
  ): HistoricalFinanceEvidenceExport {
    return {
      sourceKind, membershipChamber: chamber,
      metadata: { year, filerRegistrationNumber: registrationNumber, subtype },
    };
  }
  const targets = deriveSenateCandidateFinanceInventoryTargets([
    row('campaign_finance_candidate_contribution_bulk', 'senate', 2021, '18201'),
    row('campaign_finance_candidate_expenditure_bulk', 'senate', 2021, '18201'),
    row('campaign_finance_candidate_expenditure_bulk', 'senate', 2025, '19205'),
    row('campaign_finance_candidate_expenditure_bulk', 'house', 2024, '18202'),
    row('campaign_finance_candidate_expenditure_bulk', 'senate', 2026, '19300'),
    row('campaign_finance_independent_expenditure_bulk', 'senate', 2024, '19501'),
    row('campaign_finance_bulk', 'senate', 2022, '18201', 'candidate_contribution_record'),
    row('campaign_finance_bulk', 'senate', 2023, '18201', 'independent_expenditure_record'),
    row('campaign_finance_bulk', 'senate', 2024, 'badregistration', 'candidate_contribution_record'),
  ]);
  assert.deepEqual(targets, [
    { registrationNumber: '18201', year: 2021 },
    { registrationNumber: '18201', year: 2022 },
    { registrationNumber: '19205', year: 2025 },
  ]);
});

test('unknown missing, failed, empty, invalid and contradictory source snapshots stay separate', () => {
  const targets = [2021, 2022, 2023, 2024, 2025].map(year => ({ registrationNumber: '19205', year }));
  const base = snapshot('19205', 2024, []);
  const result = auditCfbSenateCandidateReportReferences(targets, [
    { status: 'fetch_failed', registrationNumber: '19205', segmentEndYear: 2022,
      sourceUrl: snapshot('19205', 2022).sourceUrl, errorKind: 'HTTP 403' },
    { ...base, sourceUrl: 'https://example.invalid/not-official' },
    snapshot('19205', 2026, []),
  ]);
  const s = new Map(result.filerYears.map(row => [row.year, row.status]));
  assert.equal(s.get(2021), 'source_fetch_failed');
  assert.equal(s.get(2022), 'source_fetch_failed');
  assert.equal(s.get(2023), 'source_payload_invalid');
  assert.equal(s.get(2024), 'source_payload_invalid');
  assert.equal(s.get(2025), 'no_matching_year_references');
  assert.equal(result.reports.length, 0);
  assert.equal(result.denominator.actualFiledReportCount, null);
  const none = auditCfbSenateCandidateReportReferences([{ registrationNumber: '19205', year: 2021 }], []);
  assert.equal(none.filerYears[0]?.status, 'source_not_probed');
});

test('same capture repeated deduplicates; different captures or a success and failure cause source conflict', () => {
  const target = [{ registrationNumber: '19205', year: 2025 }];
  const a = snapshot();
  const b = snapshot('19205', 2026, [reference('19205', '25', { amendment: 1 })]);
  b.responseSha256 = 'b'.repeat(64);
  const conflict = auditCfbSenateCandidateReportReferences(target, [a, b]);
  assert.equal(conflict.filerYears[0]?.status, 'source_snapshots_conflict');
  assert.equal(conflict.reports.length, 0);
  const mixed = auditCfbSenateCandidateReportReferences(target, [
    a, { status: 'fetch_failed', registrationNumber: '19205', segmentEndYear: 2026,
      sourceUrl: a.sourceUrl, errorKind: 'timeout' },
  ]);
  assert.equal(mixed.filerYears[0]?.status, 'source_snapshots_conflict');
  const repeat = auditCfbSenateCandidateReportReferences(target, [a, a]);
  assert.equal(repeat.filerYears[0]?.referenceCount, 1);
});

test('unrelated filer, unrecognized type and wrong year do not get counted as Senate reports', () => {
  const result = auditCfbSenateCandidateReportReferences([
    { registrationNumber: '19205', year: 2025 },
  ], [snapshot('19205', 2026, [
    reference('19205', '25', { type: 'pcf' }),
    reference('19400', '25'),
    reference('19205', '25', { period: '\\bad' }),
    reference('19205', '24'),
  ])]);
  assert.equal(result.filerYears[0]?.status, 'no_matching_year_references');
  assert.equal(result.filerYears[0]?.invalidReferences, 4);
  assert.equal(result.reports.length, 0);
});

test('normalizes ordering and treats unsupported or missing annual scope as unknown, never zero', () => {
  const targets = [
    { registrationNumber: '19205', year: 2025 },
    { registrationNumber: '18201', year: 2021 },
    { registrationNumber: '19205', year: 2025 },
    { registrationNumber: 'nope', year: 2023 },
    { registrationNumber: '19205', year: 2027 },
  ];
  const a = auditCfbSenateCandidateReportReferences(targets, [snapshot()]);
  const b = auditCfbSenateCandidateReportReferences([...targets].reverse(), [snapshot()]);
  assert.deepEqual(a, b);
  assert.equal(a.inputs.acceptedDistinctTargetFilerYears, 2);
  assert.equal(a.inputs.excludedInvalidTargetFilerYears, 2);
  assert.equal(a.byYear.length, 5);
  assert.equal(a.byYear.find(x => x.year === 2022)?.sourceDenominator, null);
});
