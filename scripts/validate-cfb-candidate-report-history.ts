import {
  acquireCfbCandidateHistoricalReportProofs,
  cfbCandidateSegmentEndYear,
  type CfbCandidateHistoricalReport,
} from '../src/evidence/cfb-candidate-report-history.js';
import { firstProvenCfbFinanceAvailability } from '../src/evidence/cfb-report-finance-mapper.js';
import {
  parseCfbCandidateContributionCsv,
  parseCfbCandidateExpenditureCsv,
  type CfbCandidateFinanceRow,
} from '../src/evidence/cfb-candidate-finance-history.js';
import {
  discoverCampaignFinanceDownloadUrls,
  fetchCampaignFinanceBulkText,
} from '../src/evidence/campaign-finance-live.js';

const TARGETS = [
  { registrationNumber: '15677', segmentEndYear: 2022 },
  { registrationNumber: '15677', segmentEndYear: 2024 },
  { registrationNumber: '15677', segmentEndYear: 2026 },
  { registrationNumber: '19238', segmentEndYear: 2026 },
] as const;

function reportMap(reports: readonly CfbCandidateHistoricalReport[]) {
  return reports.map(report => ({ proof: report.proof, text: report.text }));
}

function mapperInput(row: CfbCandidateFinanceRow) {
  return {
    registrationNumber: row.filerRegistrationNumber,
    transactionDate: row.transactionDate,
    kind: row.kind,
    amount: row.amount,
    totalAmount: row.kind === 'expenditure' ? row.totalAmount : undefined,
    contributor: row.kind === 'contribution' ? row.contributor : null,
    contributorRegistrationNumber:
      row.kind === 'contribution' ? row.contributorRegistrationNumber : null,
    vendorName: row.kind === 'expenditure' ? row.vendorName : null,
    affectedCommitteeName: row.kind === 'expenditure' ? row.affectedCommitteeName : null,
    affectedCommitteeRegistrationNumber:
      row.kind === 'expenditure' ? row.affectedCommitteeRegistrationNumber : null,
  };
}

async function main() {
  const urls = await discoverCampaignFinanceDownloadUrls();
  const [contributionText, expenditureText] = await Promise.all([
    fetchCampaignFinanceBulkText(urls.contributions),
    fetchCampaignFinanceBulkText(urls.expenditures),
  ]);
  const rows: CfbCandidateFinanceRow[] = [
    ...parseCfbCandidateContributionCsv(contributionText, { fromYear: 2021, toYear: 2026 }),
    ...parseCfbCandidateExpenditureCsv(expenditureText, { fromYear: 2021, toYear: 2026 }),
  ].filter(row => Boolean(row.candidateName && row.chamber && row.filerRegistrationNumber));

  const targetResults = [];
  let rowsExamined = 0;
  let rowsMatched = 0;
  const samples: Array<Record<string, unknown>> = [];

  for (const target of TARGETS) {
    const acquired = await acquireCfbCandidateHistoricalReportProofs({
      registrationNumber: target.registrationNumber,
      segmentEndYear: target.segmentEndYear,
      maxReports: 12,
    });
    const reportTexts = reportMap(acquired.reports);
    const targetRows = rows.filter(row =>
      row.filerRegistrationNumber === target.registrationNumber
      && row.transactionDate
      && cfbCandidateSegmentEndYear(row.year) === target.segmentEndYear);

    let targetMatched = 0;
    for (const row of targetRows) {
      rowsExamined += 1;
      const match = firstProvenCfbFinanceAvailability(mapperInput(row), reportTexts);
      if (!match) continue;
      rowsMatched += 1;
      targetMatched += 1;
      if (samples.length < 16) {
        samples.push({
          rowKind: row.kind,
          rowKey: row.rowKey,
          registrationNumber: row.filerRegistrationNumber,
          candidateName: row.candidateName,
          chamber: row.chamber,
          year: row.year,
          transactionDate: row.transactionDate,
          availableOn: match.window.availableOn,
          reportName: match.window.reportName,
          proofUrl: match.window.proofUrl,
          proofTextSha256: match.proof.textSha256,
        });
      }
    }

    targetResults.push({
      ...target,
      referencesDiscovered: acquired.referencesDiscovered,
      selectedReports: acquired.selectedReports,
      proofsParsed: acquired.reports.length,
      failures: acquired.failures.length,
      failureExamples: acquired.failures.slice(0, 6),
      rowsExamined: targetRows.length,
      rowsMatched: targetMatched,
      rowsFailClosed: targetRows.length - targetMatched,
      reportProofs: acquired.reports.slice(0, 12).map(report => ({
        reportName: report.proof.window.reportName,
        coverageStartOn: report.proof.window.coverageStartOn,
        coverageEndOn: report.proof.window.coverageEndOn,
        filedOn: report.proof.filedOn,
        availableOn: report.proof.window.availableOn,
        proofUrl: report.proof.window.proofUrl,
        proofTextSha256: report.proof.textSha256,
        contentSha256: report.contentSha256,
      })),
    });
  }

  console.log(JSON.stringify({
    cfbCandidateHistoricalReportDiagnostic: {
      targets: targetResults.map(result => ({
        registrationNumber: result.registrationNumber,
        segmentEndYear: result.segmentEndYear,
        referencesDiscovered: result.referencesDiscovered,
        selectedReports: result.selectedReports,
        proofsParsed: result.proofsParsed,
        failures: result.failures,
        failureExamples: result.failureExamples,
      })),
    },
  }, null, 2));

  if (!targetResults.some(result => result.proofsParsed > 0)) {
    throw new Error('Historical CFB candidate report validation parsed zero official report proofs');
  }

  console.log(JSON.stringify({
    cfbCandidateHistoricalReportValidation: {
      targets: targetResults,
      rowsExamined,
      rowsMatched,
      rowsFailClosed: rowsExamined - rowsMatched,
      samples,
      policy: {
        transactionDateIsAvailability: false,
        reportMustDemonstrateRow: true,
        reportCoverageRequired: true,
        filingDerivedAvailabilityUsesDocumentedNextDayRule: true,
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
