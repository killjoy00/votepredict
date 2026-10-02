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
import { resolveCfbCandidateFinanceTargetBatch } from '../src/evidence/cfb-candidate-finance-target-batches.js';

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

function normalizeDiagnosticValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function diagnosticDateTokens(value: string | null): { padded: string | null; unpadded: string | null } {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { padded: null, unpadded: null };
  const [, year = '', month = '', day = ''] = match;
  return {
    padded: month + '/' + day + '/' + year,
    unpadded: String(Number(month)) + '/' + String(Number(day)) + '/' + year,
  };
}

function diagnosticHasAmount(text: string, amount: number): boolean {
  const fixed = amount.toFixed(2);
  const withCommas = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return text.includes(withCommas) || text.replace(/,/g, '').includes(fixed);
}

function diagnosticHasIdentity(row: CfbCandidateFinanceRow, text: string): boolean {
  const strongIds = [
    row.kind === 'expenditure' ? row.affectedCommitteeRegistrationNumber : null,
    row.kind === 'contribution' ? row.contributorRegistrationNumber : null,
  ].filter((value): value is string => Boolean(value?.trim()));
  if (strongIds.some(value => text.includes(value))) return true;

  const normalized = normalizeDiagnosticValue(text);
  const names = [
    row.kind === 'expenditure' ? row.affectedCommitteeName : null,
    row.kind === 'contribution' ? row.contributor : null,
    row.kind === 'expenditure' ? row.vendorName : null,
  ]
    .map(value => value ? normalizeDiagnosticValue(value) : '')
    .filter(value => value.length >= 4);
  return names.some(value => normalized.includes(value));
}

function legacyContainmentSignals(
  row: CfbCandidateFinanceRow,
  reports: readonly CfbCandidateHistoricalReport[],
) {
  const dateTokens = diagnosticDateTokens(row.transactionDate);
  const amount = row.kind === 'expenditure' && Number.isFinite(row.totalAmount)
    ? Number(row.totalAmount)
    : row.amount;
  let paddedDateSeen = false;
  let unpaddedDateSeen = false;
  let amountSeen = false;
  let identitySeen = false;
  let paddedFullMatch = false;
  let flexibleDateFullMatch = false;

  for (const report of reports) {
    const inCoverage = Boolean(
      row.transactionDate
      && row.transactionDate >= report.proof.window.coverageStartOn
      && row.transactionDate <= report.proof.window.coverageEndOn
    );
    const padded = Boolean(dateTokens.padded && report.text.includes(dateTokens.padded));
    const unpadded = Boolean(dateTokens.unpadded && report.text.includes(dateTokens.unpadded));
    const hasAmount = diagnosticHasAmount(report.text, amount);
    const hasIdentity = diagnosticHasIdentity(row, report.text);
    paddedDateSeen ||= padded;
    unpaddedDateSeen ||= unpadded;
    amountSeen ||= hasAmount;
    identitySeen ||= hasIdentity;
    paddedFullMatch ||= inCoverage && padded && hasAmount && hasIdentity;
    flexibleDateFullMatch ||= inCoverage && (padded || unpadded) && hasAmount && hasIdentity;
  }

  return {
    paddedDateSeen,
    unpaddedDateSeen,
    amountSeen,
    identitySeen,
    paddedFullMatch,
    flexibleDateFullMatch,
    flexibleDateWouldRecover: flexibleDateFullMatch && !paddedFullMatch,
  };
}

async function main() {
  const targetBatch = resolveCfbCandidateFinanceTargetBatch(
    process.env.VOTEPREDICT_CFB_CANDIDATE_FINANCE_BATCH_REQUEST,
  );
  const TARGETS = targetBatch.targets;
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
    const failClosedSignals = {
      rows: 0,
      paddedDateSeen: 0,
      unpaddedDateSeen: 0,
      unpaddedOnlyDateSeen: 0,
      amountSeen: 0,
      identitySeen: 0,
      paddedFullMatch: 0,
      flexibleDateFullMatch: 0,
      flexibleDateWouldRecover: 0,
      contributions: { rows: 0, flexibleDateWouldRecover: 0 },
      expenditures: { rows: 0, flexibleDateWouldRecover: 0 },
    };
    for (const row of targetRows) {
      rowsExamined += 1;
      const match = firstProvenCfbFinanceAvailability(mapperInput(row), reportTexts);
      if (!match) {
        const signals = legacyContainmentSignals(row, acquired.reports);
        failClosedSignals.rows += 1;
        if (signals.paddedDateSeen) failClosedSignals.paddedDateSeen += 1;
        if (signals.unpaddedDateSeen) failClosedSignals.unpaddedDateSeen += 1;
        if (signals.unpaddedDateSeen && !signals.paddedDateSeen) failClosedSignals.unpaddedOnlyDateSeen += 1;
        if (signals.amountSeen) failClosedSignals.amountSeen += 1;
        if (signals.identitySeen) failClosedSignals.identitySeen += 1;
        if (signals.paddedFullMatch) failClosedSignals.paddedFullMatch += 1;
        if (signals.flexibleDateFullMatch) failClosedSignals.flexibleDateFullMatch += 1;
        if (signals.flexibleDateWouldRecover) failClosedSignals.flexibleDateWouldRecover += 1;
        const kindSignals = row.kind === 'contribution'
          ? failClosedSignals.contributions
          : failClosedSignals.expenditures;
        kindSignals.rows += 1;
        if (signals.flexibleDateWouldRecover) kindSignals.flexibleDateWouldRecover += 1;
        continue;
      }
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
      failClosedSignals,
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
      targetBatch: targetBatch.name,
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
      targetBatch: targetBatch.name,
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
