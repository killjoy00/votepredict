/**
 * Issue #864. Bounded full electronic ORIGINAL PDF observation audit, one
 * historical Senate year per standalone job, 2022/23/24/25 only. The
 * independently inventoried 2021 official record is print-only.
 *
 * No private database, original PDF body/text persistence, model or scheduler.
 * node --import tsx scripts/capture-senate-committee-2022-25-original-minutes-actions.ts
 *   --year 2023 --output artifacts/2023-senate-committee-original-actions.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  discoverSenateCommitteeMinuteDocuments,
  fetchSenateCommitteeMinutePdf,
} from '../src/evidence/minnesota-senate-committee-source.js';
import {
  auditSenateCommitteeOriginalMinutePdf,
  SENATE_MINUTE_PDF_ACTION_AUDIT_VERSION,
  type AuditedYear,
} from '../src/evidence/senate-committee-original-pdf-action-audit.js';

const YEARS = [2022, 2023, 2024, 2025] as const;
const PDF_MAX_BYTES = 12_000_000;
const MAX_DOCUMENTS_PER_YEAR = 650;
const DOC_WORKERS = 2;

function safeError(e: unknown) {
  return (e instanceof Error ? e.message : String(e))
    .replace(/https?:\/\/\S+/gi, '[official source]').slice(0, 200);
}

async function officialPdfFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const target = new URL(input instanceof Request ? input.url : String(input));
  if (target.protocol !== 'https:'
    || !['www.lrl.mn.gov', 'lrl.mn.gov'].includes(target.hostname)
    || !/^\/archive\/minutes\/senate\/202[2-5]\//i.test(target.pathname)
    || !/_Minutes\.pdf$/i.test(target.pathname)
    || target.search !== '') throw Error('Untrusted or out-of-scope original Senate committee PDF');
  const response = await fetch(target.toString(), { ...init, redirect: 'follow' });
  const final = new URL(response.url);
  if (final.protocol !== 'https:' || !['www.lrl.mn.gov', 'lrl.mn.gov'].includes(final.hostname)
    || !/^\/archive\/minutes\/senate\/202[2-5]\//i.test(final.pathname)
    || !/_Minutes\.pdf$/i.test(final.pathname)) {
    throw Error('Senate original PDF redirected off allowed official source path');
  }
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > PDF_MAX_BYTES) {
    await response.body?.cancel();
    throw Error('Official Minutes PDF exceeds maximum byte length');
  }
  return response;
}

function args() {
  const flags = process.argv.slice(2);
  const yearPosition = flags.indexOf('--year'), outPosition = flags.indexOf('--output');
  const yearRaw = yearPosition >= 0 ? flags[yearPosition + 1]
    : flags.find(x => x.startsWith('--year='))?.slice(7);
  const outputRaw = outPosition >= 0 ? flags[outPosition + 1]
    : flags.find(x => x.startsWith('--output='))?.slice(9);
  const year = Number(yearRaw);
  if (!YEARS.some(x => x === year) || !outputRaw) {
    throw Error('Specify historical Senate --year 2022|2023|2024|2025 and --output file');
  }
  if (flags.some(x => x.startsWith('--') && !['--year', '--output'].includes(x)
    && !x.startsWith('--year=') && !x.startsWith('--output='))) {
    throw Error('Refusing unbounded or unsupported source-scope flags');
  }
  return { year: year as AuditedYear, output: resolve(outputRaw) };
}

async function main() {
  const { year, output } = args();
  const discovered = await discoverSenateCommitteeMinuteDocuments({ year });
  const docs = [...new Map(discovered.documents.map(d => [d.url, d])).values()];
  if (!docs.length || docs.length > MAX_DOCUMENTS_PER_YEAR) {
    throw Error('Official Senate minutes year discovery zero or above fixed maximum');
  }
  docs.sort((a, b) => a.meetingDate.localeCompare(b.meetingDate)
    || a.committeeName.localeCompare(b.committeeName) || a.url.localeCompare(b.url));
  const results: Array<ReturnType<typeof auditSenateCommitteeOriginalMinutePdf>> = [];
  const failures: Array<{ sourceUrl: string; committeeName: string; meetingDate: string; error: string }> = [];
  let next = 0;
  const tasks = Array.from({ length: Math.min(DOC_WORKERS, docs.length) }, async () => {
    for (;;) {
      const index = next++;
      const doc = docs[index];
      if (!doc) return;
      try {
        const pdf = await fetchSenateCommitteeMinutePdf({
          url: doc.url,
          fetchImpl: officialPdfFetch as typeof fetch,
        });
        if (pdf.bytes > PDF_MAX_BYTES) throw Error('Original PDF unexpectedly exceeded hard byte bound');
        results.push(auditSenateCommitteeOriginalMinutePdf({ document: doc, pdf }));
      } catch (error) {
        failures.push({
          sourceUrl: doc.url, meetingDate: doc.meetingDate,
          committeeName: doc.committeeName, error: safeError(error),
        });
      }
      if ((index + 1) % 100 === 0) console.log('Verified bounded source documents processed: ' + (index + 1));
    }
  });
  await Promise.all(tasks);
  results.sort((a, b) => a.document.meetingDate.localeCompare(b.document.meetingDate)
    || a.document.sourceUrl.localeCompare(b.document.sourceUrl));
  failures.sort((a, b) => a.meetingDate.localeCompare(b.meetingDate)
    || a.sourceUrl.localeCompare(b.sourceUrl));
  const sum = (fn: (r: typeof results[number]) => number) =>
    results.reduce((total, r) => total + fn(r), 0);
  const report = {
    schemaVersion: SENATE_MINUTE_PDF_ACTION_AUDIT_VERSION,
    auditedYear: year,
    officialElectronicIndexCommitteePages: discovered.committeePages,
    independentlyDiscoveredOriginalMinutesPdfLinks: docs.length,
    originalPdfsFetchedAndParsed: results.length,
    originalPdfsFailedOrUnparsed: failures.length,
    parsedCandidateObservations: {
      namedRolls: sum(r => r.sourceParserTotals.namedRollCalls),
      countOnlyRolls: sum(r => r.sourceParserTotals.countOnlyRollCalls),
      namedMemberChoicesInOriginalPdfs: sum(r => r.sourceParserTotals.namedMemberChoicesInPdf),
      voiceActions: sum(r => r.sourceParserTotals.voiceActions),
      unanimousActions: sum(r => r.sourceParserTotals.unanimousActions),
      resultOnlyActions: sum(r => r.sourceParserTotals.motionResultOnlyActions),
    },
    sourceSignalReview: {
      pdfsWithPossibleUnparsedRollCall: results.filter(r => r.missingness.possibleUnparsedRollCallSignal).length,
      pdfsWithPossibleUnparsedVoiceVote: results.filter(r => r.missingness.possibleUnparsedVoiceVoteSignal).length,
      pdfsWithNoSupportedActionDetected: results.filter(r => r.missingness.noSupportedVoteOrActionDetected).length,
      signalHintsAreNotAuthoritativeVoteCounts: true,
    },
    documentProofs: results,
    unresolvedOriginalDocuments: failures,
    scopeAndSafety: {
      exactYears: [2022, 2023, 2024, 2025],
      currentYearOnly: year,
      sourceKind: 'official_LRL_Senate_original_Minutes_PDF',
      year2021PrintMinuteUniverseUnaccountedFor: true,
      year2022PrintElectronicCollectionsCanDiffer: true,
      pdfFilesOrFullExtractedTextStored: false,
      memberNamesOrSpeechTextStored: false,
      noAutomatedSourceToDatabaseReconciliation: true,
      noOfficialFullMeetingOrVoteDenominatorCertified: true,
      noProductionDatabaseAccess: true,
      noHistoricalEvidenceWrites: true,
      noForecastOrServingChanges: true,
    },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    year, sourceCount: docs.length,
    fetchedAndParsed: results.length,
    unresolvedOriginalDocuments: failures.length,
    candidateObservations: report.parsedCandidateObservations,
    sourceSignalReview: report.sourceSignalReview,
    anyDatabaseWrites: false,
    fullHistoricalVoteCompletenessCertified: false,
    output,
  }, null, 2));
}

main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
