import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditCfbHistoricalReleaseDebt,
  type HistoricalFinanceEvidenceExport,
  type HistoricalFinanceReportRowProof,
} from '../src/evidence/cfb-historical-release-audit.js';

const sourceHash = 'a'.repeat(64);
const rowProofHash = 'b'.repeat(64);

function persisted(
  rowKey: string,
  input: Partial<HistoricalFinanceEvidenceExport> & {
    metadata?: Record<string, unknown>;
  } = {},
): HistoricalFinanceEvidenceExport {
  return {
    sourceKind: 'campaign_finance_candidate_contribution_bulk',
    membershipChamber: 'senate',
    publishedAt: '2025-01-29T12:00:00Z',
    sourceUrl: 'https://register.cfb.mn.gov/reports-and-data/',
    sourceSha256: 'c'.repeat(64),
    ...input,
    metadata: {
      rowKey, year: 2024, chamber: 'senate', filerRegistrationNumber: '18443',
      transactionDate: '2024-10-25', reportName: '2024 Year-End',
      availableOn: '2025-01-29', filedOn: '2025-01-28',
      asOfEligible: true,
      availabilityPolicyVersion: 'mn-cfb-report-availability-v6',
      ...input.metadata,
    },
  };
}

function reportProof(rowKey: string, input: Partial<HistoricalFinanceReportRowProof> = {}): HistoricalFinanceReportRowProof {
  return {
    rowKey, family: 'candidate_contribution',
    registrationNumber: '18443', reportId: '2024:18443:YE',
    reportName: '2024 Year-End', reportType: 'ordinary_report',
    coverageStartOn: '2024-01-01', coverageEndOn: '2024-12-31',
    filedOn: '2025-01-28', dueOn: '2025-01-31',
    proofUrl: 'https://cfb.mn.gov/rptViewer/Main.php?regnum=18443',
    reportSha256: sourceHash, exactRowProofSha256: rowProofHash,
    ...input,
  };
}

test('flags early-filed v6 history and keeps exact source-linked bound separate from legacy claim', () => {
  const audit = auditCfbHistoricalReleaseDebt([persisted('r1')], [reportProof('r1')]);
  const row = audit.rows[0]!;
  assert.equal(audit.scope.chamber, 'senate');
  assert.equal(row.storedAvailableOn, '2025-01-29');
  assert.equal(row.sourceLinkedBoundOn, '2025-02-01');
  assert.equal(row.sourceLinkedReportId, '2024:18443:YE');
  assert.equal(row.sourceLinkedProofUrl, reportProof('r1').proofUrl);
  assert.equal(row.status, 'source_linked_review_candidate');
  assert.equal(row.sourceLinkedProvenanceOnly, true);
  assert.ok(row.flags.includes('legacy_eligibility_requires_revalidation'));
  assert.ok(row.flags.includes('missing_report_due_date'));
  assert.ok(row.flags.includes('stored_date_precedes_source_linked_bound'));
  assert.equal(audit.denominator.officialReportCount, null);
  assert.equal(audit.denominator.reconciliationCertified, false);
  assert.equal(audit.policy.noDatabaseWrites, true);
});

test('late report bound is conservative and needs a source-linked filing date after due', () => {
  const input = persisted('late', {
    publishedAt: '2024-07-30T12:00:00Z',
    metadata: {
      rowKey: 'late', year: 2024, chamber: 'senate',
      filerRegistrationNumber: '18443', transactionDate: '2024-07-01',
      asOfEligible: true, availableOn: '2024-07-30',
      availabilityPolicyVersion: 'mn-cfb-report-availability-v6',
      filedOn: '2024-08-02', reportDueOn: '2024-07-29',
    },
  });
  const proof = reportProof('late', {
    reportId: '18443:preprimary', reportName: '2024 Pre-Primary',
    coverageStartOn: '2024-01-01', coverageEndOn: '2024-07-20',
    filedOn: '2024-08-02', dueOn: '2024-07-29',
  });
  const row = auditCfbHistoricalReleaseDebt([input], [proof]).rows[0]!;
  assert.equal(row.sourceLinkedBoundOn, '2024-08-03');
  assert.ok(row.flags.includes('stored_date_precedes_recorded_due_date_bound'));
  assert.ok(row.flags.includes('stored_date_precedes_source_linked_bound'));
});

test('missing and uncorroborated official row links remain explicitly unverified', () => {
  const input = persisted('no-report', {
    metadata: {
      rowKey: 'no-report', year: 2024, chamber: 'senate',
      filerRegistrationNumber: '18443', transactionDate: '2024-10-25',
      availableOn: '2025-01-29', asOfEligible: true,
      availabilityPolicyVersion: 'mn-cfb-report-availability-v6',
    },
  });
  const noReport = auditCfbHistoricalReleaseDebt([input]).rows[0]!;
  assert.equal(noReport.status, 'unverified');
  assert.equal(noReport.sourceLinkedBoundOn, null);
  assert.ok(noReport.flags.includes('missing_report_filing_date'));
  assert.ok(noReport.flags.includes('missing_report_due_date'));
  assert.ok(noReport.flags.includes('missing_row_level_official_proof'));

  const invalidClaims: Array<Partial<HistoricalFinanceReportRowProof>> = [
    { proofUrl: 'https://example.com/report.pdf' },
    { exactRowProofSha256: '' },
    { registrationNumber: '99999' },
    { family: 'candidate_expenditure' },
    { dueOn: undefined },
    { dueOn: '2025-01-15', disclosedOn: '2025-01-16' },
    { coverageEndOn: '2024-10-01' },
  ];
  for (const altered of invalidClaims) {
    const row = auditCfbHistoricalReleaseDebt([input], [
      reportProof('no-report', altered),
    ]).rows[0]!;
    assert.equal(row.status, 'unverified');
    assert.ok(row.flags.includes('invalid_official_proof_manifest'));
    assert.ok(row.flags.includes('missing_row_level_official_proof'));
  }
});

test('recognizes candidate spending and IE independently, not as all contributions', () => {
  const rows = [
    persisted('receipt'),
    persisted('spending', {
      sourceKind: 'campaign_finance_candidate_expenditure_bulk',
      metadata: { rowKey: 'spending', year: 2023, chamber: 'senate',
        filerRegistrationNumber: '18443', transactionDate: '2023-12-01',
        asOfEligible: false, availableOn: null },
      publishedAt: null,
    }),
    persisted('ie', {
      sourceKind: 'campaign_finance_independent_expenditure_bulk',
      metadata: { rowKey: 'ie', year: 2022, chamber: 'senate',
        spenderRegistrationNumber: '40200', transactionDate: '2022-07-20',
        asOfEligible: false, availableOn: null },
      publishedAt: null,
    }),
    persisted('other-house', { membershipChamber: 'house' }),
    persisted('future', { metadata: { year: 2026, rowKey: 'future' } }),
    persisted('unrelated', { sourceKind: 'random_nonfinance_source' }),
  ];
  const audit = auditCfbHistoricalReleaseDebt(rows);
  assert.equal(audit.rows.length, 3);
  assert.deepEqual(audit.rows.map(x => x.family).sort(),
    ['candidate_contribution', 'candidate_expenditure', 'independent_expenditure']);
  assert.equal(audit.input.omitted.nonSenateOrUnresolved, 1);
  assert.equal(audit.input.omitted.outOfYears, 1);
  assert.equal(audit.input.omitted.unrelatedFinanceFamily, 1);
  const year2022Ie = audit.byYearFamily.find(x => x.year === 2022 && x.family === 'independent_expenditure');
  assert.equal(year2022Ie?.persistedDistinctRowKeys, 1);
  assert.equal(year2022Ie?.priorEligibleClaims, 0);
  assert.equal(year2022Ie?.officialReportDenominator, null);
  assert.equal(audit.byYearFamily.length, 15);
});

test('duplicate row identities do not inflate totals; conflicting copies fail closed', () => {
  const original = persisted('same');
  const conflict = persisted('same', {
    publishedAt: '2025-02-04T12:00:00Z',
    metadata: { ...original.metadata, availableOn: '2025-02-04' },
  });
  const audit = auditCfbHistoricalReleaseDebt([original, conflict], [reportProof('same')]);
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0]?.persistedCopies, 2);
  assert.equal(audit.rows[0]?.status, 'unverified');
  assert.ok(audit.rows[0]?.flags.includes('conflicting_persisted_copies'));
  assert.equal(audit.byYearFamily.find(x => x.year === 2024
    && x.family === 'candidate_contribution')?.persistedDistinctRowKeys, 1);
});

test('notice has a distinct publication rule; transaction time is not publication proof', () => {
  const ie = persisted('notice', {
    sourceKind: 'campaign_finance_independent_expenditure_bulk',
    publishedAt: null,
    metadata: { rowKey: 'notice', year: 2025, chamber: 'senate',
      spenderRegistrationNumber: '40200', transactionDate: '2025-09-12',
      asOfEligible: false, availableOn: null },
  });
  const proof = reportProof('notice', {
    family: 'independent_expenditure',
    registrationNumber: '40200', reportType: 'large_contribution_notice',
    reportId: 'notice-1', coverageStartOn: '2025-09-12',
    coverageEndOn: '2025-09-12', filedOn: '2025-09-13',
    dueOn: undefined, disclosedOn: '2025-09-14',
  });
  const row = auditCfbHistoricalReleaseDebt([ie], [proof]).rows[0]!;
  assert.equal(row.sourceLinkedBoundOn, '2025-09-14');
  assert.equal(row.status, 'source_linked_review_candidate');
  assert.equal(row.storedEligible, false);
});

test('same-day cannot be mistaken for a certified historical forecast cutoff', () => {
  const item = persisted('same-day', {
    publishedAt: '2025-02-01T12:00:00Z',
    metadata: { rowKey: 'same-day', year: 2024, chamber: 'senate',
      filerRegistrationNumber: '18443', transactionDate: '2024-10-25',
      asOfEligible: true, availableOn: '2025-02-01',
      availabilityPolicyVersion: 'mn-cfb-report-availability-v7' },
  });
  const audit = auditCfbHistoricalReleaseDebt([item], [reportProof('same-day')]);
  assert.equal(audit.rows[0]?.sourceLinkedBoundOn, '2025-02-01');
  assert.equal(audit.policy.noForecastCutoffOnSameAvailableDay, true);
  assert.equal(audit.denominator.reconciliationCertified, false);
  assert.equal(audit.byYearFamily.find(x => x.year === 2024 &&
    x.family === 'candidate_contribution')?.sourceLinkedReviewCandidates, 1);
});

test('output is deterministic regardless of export order', () => {
  const a = persisted('first');
  const b = persisted('second', { metadata: { rowKey: 'second', year: 2021, chamber: 'senate',
    filerRegistrationNumber: '18443', transactionDate: '2021-01-01' } });
  assert.deepEqual(
    auditCfbHistoricalReleaseDebt([a, b], [reportProof('first')]),
    auditCfbHistoricalReleaseDebt([b, a], [reportProof('first')]),
  );
});
