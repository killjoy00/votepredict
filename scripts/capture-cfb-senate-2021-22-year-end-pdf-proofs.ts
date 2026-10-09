/**
 * Historical Senate finance, issue #864.
 * Exactly ONE official candidate committee, TWO original 2021–22 year-end
 * report PDFs at most. Public PDF bytes/text are used only in-process.
 *
 * node --import tsx scripts/capture-cfb-senate-2021-22-year-end-pdf-proofs.ts
 *   --output artifacts/cfb-2021-22-senate-one-filer-proof.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fetchCfbCandidateHistoricalReportReferenceSnapshot } from '../src/evidence/cfb-candidate-report-history.js';
import { fetchCfbReportViewerText } from '../src/evidence/cfb-current-report-acquisition.js';
import {
  auditCfb2021_22SenateYearEndPdfSource,
  type Cfb2021_22YearEndPdfCapture,
} from '../src/evidence/cfb-senate-2021-22-year-end-source-proof.js';

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/\S+/g, '[CFB source]').slice(0, 230);
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--output');
  const outputRaw = i >= 0 ? args[i + 1]
    : args.find(a => a.startsWith('--output='))?.slice('--output='.length);
  if (!outputRaw || args.some(a => /^--(?!output)/.test(a)))
    throw Error('Only --output is supported; source scope is permanently bounded');

  const source = await fetchCfbCandidateHistoricalReportReferenceSnapshot('18443', 2022);
  const references = source.references.filter(r =>
    r.registrationNumber === '18443' && ['21', '22'].includes(r.year)
    && r.type === 'pcc' && r.period === 'YE' && r.se === '0'
    && r.amendment === 0);
  if (references.length > 2) throw Error('Unexpected historical report reference count above two');

  const captures: Cfb2021_22YearEndPdfCapture[] = [];
  const failures: Array<{ reportId: string; reason: string }> = [];
  for (const reference of references) {
    const reportId = [
      reference.registrationNumber, reference.year, reference.type,
      reference.period, reference.se, reference.amendment,
    ].join(':');
    try {
      const pdf = await fetchCfbReportViewerText(reference, {
        method: 'POST', referer: source.sourceUrl, searchType: 'Candidate',
      });
      captures.push({
        reference,
        sourceUrl: pdf.sourceUrl,
        contentSha256: pdf.contentSha256,
        bytes: pdf.bytes,
        fetchedAt: pdf.fetchedAt,
        text: pdf.text,
      });
    } catch (error) {
      failures.push({ reportId, reason: safeError(error) });
    }
  }
  const audit = auditCfb2021_22SenateYearEndPdfSource(references, captures);
  const result = {
    ...audit,
    sourceViewer: {
      sourceUrl: source.sourceUrl,
      apiUrl: source.apiUrl,
      exactApiResponseSha256: source.responseSha256,
      sourceFetchedAt: source.fetchedAt,
      reportReferencesListed: references.length,
    },
    sourcePdfFailures: failures,
    noOriginalPdfBytesOrRawBodyWritten: true,
    noIndividualContributionsOrExpendituresWritten: true,
    noProductionDataReadOrWritten: true,
  };
  const output = resolve(outputRaw);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({
    schemaVersion: result.schemaVersion,
    historicalReportReferencesObserved: references.length,
    originalPdfSourceDownloadsSucceeded: captures.length,
    sourcePdfFailures: failures.length,
    verifiedOriginalPdfFiledAndDueHeaders: audit.verifiedOriginalPdfFiledAndDueHeaders,
    reports: audit.yearResults.map(r => ({
      year: r.year,
      reportId: r.reportId,
      status: r.status,
      sourceReceivedOn: r.sourceReceivedOn,
      sourceDueOn: r.sourceDueOn,
      conservativeLegalAndFilingBoundOn: r.conservativeLegalAndFilingBoundOn,
      independentlyProvenHistoricalPublicByOn: null,
    })),
    officialSenateDenominatorKnown: false,
    historicalEligibilityChanged: false,
    output,
  }, null, 2));
}
main().catch(error => {
  console.error(safeError(error));
  process.exitCode = 1;
});
