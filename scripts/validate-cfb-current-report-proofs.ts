import {
  acquireCfbCurrentReportProofs,
  type CfbAcquiredCurrentReport,
} from '../src/evidence/cfb-current-report-acquisition.js';
import { firstProvenCfbFinanceAvailability } from '../src/evidence/cfb-report-finance-mapper.js';
import {
  parseCfbCandidateContributionCsv,
  parseCfbCandidateExpenditureCsv,
  type CfbCandidateFinanceRow,
} from '../src/evidence/cfb-candidate-finance-history.js';
import { parseCfbIndependentExpenditureCsv } from '../src/evidence/cfb-independent-expenditure-history.js';
import {
  discoverCampaignFinanceDownloadUrls,
  fetchCampaignFinanceBulkText,
} from '../src/evidence/campaign-finance-live.js';

function reportLimit(): number {
  const requested = Number.parseInt(process.env.VOTEPREDICT_CFB_CURRENT_REPORT_VALIDATION_REPORTS ?? '', 10);
  if (!Number.isFinite(requested)) return 6;
  return Math.min(12, Math.max(2, requested));
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map(value => value.trim()))];
}

function reportMap(reports: readonly CfbAcquiredCurrentReport[]) {
  const map = new Map<string, Array<{ proof: CfbAcquiredCurrentReport['proof']; text: string }>>();
  for (const report of reports) {
    const registrationNumber = report.proof.reference.registrationNumber;
    const rows = map.get(registrationNumber) ?? [];
    rows.push({ proof: report.proof, text: report.text });
    map.set(registrationNumber, rows);
  }
  return map;
}

function candidateInput(row: CfbCandidateFinanceRow) {
  return {
    registrationNumber: row.filerRegistrationNumber,
    transactionDate: row.transactionDate,
    kind: row.kind,
    amount: row.amount,
    totalAmount: row.kind === 'expenditure' ? row.totalAmount : undefined,
    contributor: row.kind === 'contribution' ? row.contributor : null,
    contributorRegistrationNumber: row.kind === 'contribution' ? row.contributorRegistrationNumber : null,
    vendorName: row.kind === 'expenditure' ? row.vendorName : null,
    affectedCommitteeName: row.kind === 'expenditure' ? row.affectedCommitteeName : null,
    affectedCommitteeRegistrationNumber:
      row.kind === 'expenditure' ? row.affectedCommitteeRegistrationNumber : null,
  };
}

async function main() {
  const limit = reportLimit();
  const urls = await discoverCampaignFinanceDownloadUrls();
  const [contributionText, expenditureText, ieText] = await Promise.all([
    fetchCampaignFinanceBulkText(urls.contributions),
    fetchCampaignFinanceBulkText(urls.expenditures),
    fetchCampaignFinanceBulkText(urls.independentExpenditures),
  ]);

  const contributions = parseCfbCandidateContributionCsv(contributionText, { fromYear: 2026, toYear: 2026 });
  const expenditures = parseCfbCandidateExpenditureCsv(expenditureText, { fromYear: 2026, toYear: 2026 });
  const candidateRows: CfbCandidateFinanceRow[] = [...contributions, ...expenditures];
  const legislativeCandidateRows = candidateRows.filter(row => Boolean(row.candidateName && row.chamber));
  const ieRows = parseCfbIndependentExpenditureCsv(ieText, { fromYear: 2026, toYear: 2026 });

  const candidateRegistrations = unique(legislativeCandidateRows.map(row => row.filerRegistrationNumber));
  const pcfRegistrations = unique(ieRows.map(row => row.spenderRegistrationNumber));

  const candidate = await acquireCfbCurrentReportProofs({
    kind: 'candidate-reports',
    maxReports: limit,
    registrationNumbers: candidateRegistrations,
  });
  const pcf = await acquireCfbCurrentReportProofs({
    kind: 'pcf-reports',
    maxReports: limit,
    registrationNumbers: pcfRegistrations,
  });

  if (!candidate.reports.length && !pcf.reports.length) {
    throw new Error('CFB current-report validation acquired zero parseable official reports');
  }

  const candidateReports = reportMap(candidate.reports);
  const pcfReports = reportMap(pcf.reports);
  let candidateRowsExamined = 0;
  let candidateRowsMatched = 0;
  let ieRowsExamined = 0;
  let ieRowsMatched = 0;
  const samples: Array<Record<string, unknown>> = [];

  for (const row of legislativeCandidateRows) {
    const registrationNumber = row.filerRegistrationNumber;
    if (!registrationNumber) continue;
    const reports = candidateReports.get(registrationNumber);
    if (!reports?.length) continue;
    candidateRowsExamined += 1;
    const match = firstProvenCfbFinanceAvailability(candidateInput(row), reports);
    if (!match) continue;
    candidateRowsMatched += 1;
    if (samples.length < 12) {
      samples.push({
        rowKind: row.kind,
        rowKey: row.rowKey,
        registrationNumber,
        transactionDate: row.transactionDate,
        availableOn: match.window.availableOn,
        reportDueOn: match.proof.dueOn,
        filedOn: match.proof.filedOn,
        reportName: match.window.reportName,
        proofUrl: match.window.proofUrl,
      });
    }
  }

  for (const row of ieRows) {
    const registrationNumber = row.spenderRegistrationNumber;
    if (!registrationNumber) continue;
    const reports = pcfReports.get(registrationNumber);
    if (!reports?.length) continue;
    ieRowsExamined += 1;
    const match = firstProvenCfbFinanceAvailability({
      registrationNumber,
      transactionDate: row.transactionDate,
      kind: 'expenditure',
      amount: row.amount,
      totalAmount: row.totalAmount,
      affectedCommitteeName: row.affectedCommitteeName,
      affectedCommitteeRegistrationNumber: row.affectedCommitteeRegistrationNumber,
    }, reports);
    if (!match) continue;
    ieRowsMatched += 1;
    if (samples.length < 12) {
      samples.push({
        rowKind: 'independent_expenditure',
        rowKey: row.rowKey,
        registrationNumber,
        transactionDate: row.transactionDate,
        availableOn: match.window.availableOn,
        reportDueOn: match.proof.dueOn,
        filedOn: match.proof.filedOn,
        reportName: match.window.reportName,
        proofUrl: match.window.proofUrl,
      });
    }
  }

  console.log(JSON.stringify({
    cfbCurrentReportValidation: {
      reportLimitPerKind: limit,
      bulkRows: {
        contributions2026: contributions.length,
        candidateExpenditures2026: expenditures.length,
        legislativeCandidateRows2026: legislativeCandidateRows.length,
        legislativeCandidateRegistrations2026: candidateRegistrations.length,
        independentExpenditures2026: ieRows.length,
      },
      candidateReports: {
        entitiesDiscovered: candidate.entitiesDiscovered,
        referencesDiscovered: candidate.referencesDiscovered,
        eligibleReferences: candidate.eligibleReferences,
        selectedReports: candidate.selectedReports,
        proofsParsed: candidate.reports.length,
        failures: candidate.failures.length,
        failureExamples: candidate.failures.slice(0, 6),
      },
      pcfReports: {
        entitiesDiscovered: pcf.entitiesDiscovered,
        referencesDiscovered: pcf.referencesDiscovered,
        eligibleReferences: pcf.eligibleReferences,
        selectedReports: pcf.selectedReports,
        proofsParsed: pcf.reports.length,
        failures: pcf.failures.length,
        failureExamples: pcf.failures.slice(0, 6),
      },
      rowMapping: {
        candidateRowsExamined,
        candidateRowsMatched,
        candidateRowsFailClosed: candidateRowsExamined - candidateRowsMatched,
        ieRowsExamined,
        ieRowsMatched,
        ieRowsFailClosed: ieRowsExamined - ieRowsMatched,
        samples,
      },
      policy: {
        transactionDateIsAvailability: false,
        reportMustDemonstrateRow: true,
        reportCoverageRequired: true,
        filingDerivedAvailabilityUsesDocumentedNextDayRule: false,
        ordinaryReportRequiresProvenDueAndFilingDates: true,
        statutoryRelease: '08:00 America/Chicago day after report due',
        lateFilingConservativeBound: 'day after filing',
        sameDayReplayExcluded: true,
        contextOnly: true,
        mechanicallyActionable: false,
        modelWeight: 0,
        servingChanged: false,
        productionAction: 'none',
      },
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});