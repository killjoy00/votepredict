/**
 * Issue #864. Read exactly twelve pinned original-version C/E report PDFs
 * from seven 2025 Senate registrations in districts 6, 29 and 47.
 *
 * Re-query only official candidate viewer metadata, then fetch the exact
 * official original-version report URLs and three independently official
 * 2025 district disclosure calendars. Persist metadata/hash/header dates ONLY.
 * No original PDF bytes, donor names, contact details, transaction text,
 * database credentials, production Neon/Vercel or inference changes.
 *
 * node --import tsx scripts/capture-cfb-2025-senate-12-special-original-pdf-proofs.ts \
 *   --output artifacts/cfb-2025-senate-12-special-original-pdf-proofs.json
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import {
  fetchCfbCandidateHistoricalReportReferenceSnapshot,
} from '../../src/evidence/cfb-candidate-report-history.js';
import { fetchCfbReportViewerText } from '../../src/evidence/cfb-current-report-acquisition.js';
import {
  CFB_2025_SPECIAL_CALENDAR_RULES,
  CFB_2025_SPECIAL_DISTRICT_ROSTER_SHA256,
  auditCfb2025SpecialOriginalTarget,
  parsePinnedCfb2025SpecialOriginalTargets,
  verifyCfb2025SpecialCalendarCapture,
  type Cfb2025SpecialCalendarCapture,
  type Cfb2025SpecialDistrict,
  type Cfb2025SpecialPdfCapture,
} from '../evidence/cfb-2025-senate-special-original-pdf-proof.js';

const LEDGER_PATH = 'docs/evaluation/source-proof/cfb-2025-dated-senate-85-reference-versions.psv';
const BASE_VIEWER = 'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/';
const MAX_CALENDAR_BYTES = 12_000_000;

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/\S+/gi, '[official source]').slice(0, 220);
}

async function fetchCalendar(district: Cfb2025SpecialDistrict): Promise<Cfb2025SpecialCalendarCapture> {
  const sourceUrl = CFB_2025_SPECIAL_CALENDAR_RULES[district].sourceUrl;
  const response = await fetch(sourceUrl, {
    headers: {
      'user-agent': 'VotePredict/2.0 bounded-2025-special-election-calendar-proof',
      accept: 'application/pdf',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(50_000),
  });
  const final = new URL(response.url);
  if (final.protocol !== 'https:' || !['cfb.mn.gov', 'www.cfb.mn.gov'].includes(final.hostname.toLowerCase())
    || !final.pathname.startsWith('/pdf/')) throw Error('Calendar redirected off official CFB PDF path');
  if (!response.ok) throw Error('Official CFB calendar HTTP ' + response.status);
  const declaredLength = Number(response.headers.get('content-length'));
  if (declaredLength > MAX_CALENDAR_BYTES) throw Error('Official CFB calendar length exceeded bound');
  const body = new Uint8Array(await response.arrayBuffer());
  const bytes = body.byteLength;
  if (bytes < 500 || bytes > MAX_CALENDAR_BYTES
    || new TextDecoder('ascii').decode(body.subarray(0, 5)) !== '%PDF-') {
    throw Error('Official calendar was not a bounded PDF');
  }
  const pdfSha256 = createHash('sha256').update(body).digest('hex');
  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: body, CanvasFactory });
  try {
    const text = (await parser.getText()).text ?? '';
    if (text.trim().length < 100) throw Error('Official calendar text missing');
    return { district, sourceUrl, pdfSha256, bytes,
      fetchedAt: new Date().toISOString(), text };
  } finally { await parser.destroy(); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--output' || !args[1]) {
    throw Error('Required: --output artifacts/<new-json-file>.json, no extra flags');
  }
  const output = resolve(args[1]);
  if (!output.startsWith(resolve('artifacts') + sep) || !output.endsWith('.json')) {
    throw Error('Metadata-only output must be a new JSON file under artifacts/');
  }
  const targets = parsePinnedCfb2025SpecialOriginalTargets(readFileSync(LEDGER_PATH, 'utf8'));
  const registrations = [...new Set(targets.map(t => t.registrationNumber))].sort();
  if (registrations.length !== 7) throw Error('Expected exactly seven original C/E special-election filers');

  const calendars: Cfb2025SpecialCalendarCapture[] = [];
  const calendarFailures: Array<{ district: number; reason: string }> = [];
  await Promise.all(([6, 29, 47] as const).map(async district => {
    try { calendars.push(await fetchCalendar(district)); }
    catch (error) { calendarFailures.push({ district, reason: safeError(error) }); }
  }));

  const candidateViewers: Array<Record<string, unknown>> = [];
  const reportCaptures = new Map<string, Cfb2025SpecialPdfCapture>();
  const sourceFailures = new Map<string, string>();
  let index = 0;
  async function worker() {
    while (index < registrations.length) {
      const regnum = registrations[index++]!;
      const matching = targets.filter(t => t.registrationNumber === regnum);
      let source;
      try {
        source = await fetchCfbCandidateHistoricalReportReferenceSnapshot(regnum, 2026);
        const expectedUrl = BASE_VIEWER + regnum + '/2026/';
        if (source.sourceUrl !== expectedUrl || source.registrationNumber !== regnum
          || source.segmentEndYear !== 2026) {
          throw Error('Candidate viewer response identity failed');
        }
        candidateViewers.push({
          registrationNumber: regnum,
          sourceUrl: source.sourceUrl,
          apiUrl: source.apiUrl,
          retrievedAt: source.fetchedAt,
          currentApiResponseSha256: source.responseSha256,
          originalApiResponseSha256: matching[0]!.originalCandidateApiResponseSha256,
          sourceApiResponseChangedSincePinned2025RefCapture:
            source.responseSha256 !== matching[0]!.originalCandidateApiResponseSha256,
          district: matching[0]!.district,
          originalDistrictRosterHtmlSha256:
            CFB_2025_SPECIAL_DISTRICT_ROSTER_SHA256[matching[0]!.district],
        });
      } catch (error) {
        for (const target of matching) sourceFailures.set(target.reportId, safeError(error));
        continue;
      }
      for (const target of matching) {
        const refs = source.references.filter(ref =>
          ref.registrationNumber === target.registrationNumber
          && ref.year === target.year && ref.type === target.type
          && ref.period === target.period && ref.se === target.se
          && ref.amendment === target.amendment);
        if (refs.length !== 1) {
          sourceFailures.set(target.reportId, 'Pinned original-version key absent or duplicate in current viewer');
          continue;
        }
        try {
          const pdf = await fetchCfbReportViewerText(refs[0]!, {
            method: 'POST', referer: source.sourceUrl, searchType: 'Candidate',
          });
          if (new URL(pdf.sourceUrl).hostname !== 'cfb.mn.gov') {
            throw Error('CFB PDF URL host identity mismatch');
          }
          reportCaptures.set(target.reportId, {
            sourceUrl: pdf.sourceUrl, pdfSha256: pdf.contentSha256,
            bytes: pdf.bytes, fetchedAt: pdf.fetchedAt, text: pdf.text,
          });
        } catch (error) {
          sourceFailures.set(target.reportId, safeError(error));
        }
      }
    }
  }
  await Promise.all([worker(), worker()]);

  const reports = targets.map(target => auditCfb2025SpecialOriginalTarget(
    target,
    reportCaptures.get(target.reportId) ?? null,
    calendars.find(c => c.district === target.district) ?? null,
    sourceFailures.get(target.reportId) ?? null,
  ));
  const verified = reports.filter(r => r.status === 'pdf_header_period_and_calendar_verified').length;
  const distinctIds = new Set(reports.map(r => r.reportId));
  if (distinctIds.size !== 12 || reports.length !== 12) throw Error('Duplicate/missing bounded report ID');
  const reportCountsByDistrict = ([6, 29, 47] as const).map(district => ({
    district,
    originalViewerReferences: targets.filter(t => t.district === district).length,
    pdfHeadersAndCalendarVerified: reports.filter(
      r => r.senateDistrict === district && r.status === 'pdf_header_period_and_calendar_verified'
    ).length,
  }));
  const outputBody = {
    schemaVersion: 'cfb-2025-senate-12-special-original-pdf-and-calendars-v1',
    capturedAt: new Date().toISOString(),
    scope: {
      historicalIssue: 864,
      reportYear: 2025,
      viewerSegmentEndYear: 2026,
      sourcePinned2025RegistrationCohortSize: 41,
      targetOriginalVersionCount: 12,
      targetRegistrationCount: 7,
      targetDistricts: [6, 29, 47],
      sourceVersionLedger: LEDGER_PATH,
      sourceVersionLedgerCanonicalSha256:
        'd34bb475cccd94481fd2f2215bf47e3c9695ad328e06bed2475967add067f0d0',
    },
    candidateViewers: candidateViewers.sort(
      (a,b) => String(a.registrationNumber).localeCompare(String(b.registrationNumber))
    ),
    originalDistrictRosterProvenance: CFB_2025_SPECIAL_DISTRICT_ROSTER_SHA256,
    calendars: ([6, 29, 47] as const).map(district => {
      const c = calendars.find(x => x.district === district);
      const proof = c ? verifyCfb2025SpecialCalendarCapture(c)
        : { verified: false, reason: 'source_pdf_not_acquired' };
      return {
        district, sourceUrl: CFB_2025_SPECIAL_CALENDAR_RULES[district].sourceUrl,
        pdfSha256: c?.pdfSha256 ?? null,
        bytes: c?.bytes ?? null,
        fetchedAt: c?.fetchedAt ?? null,
        calendarIdentityAndManualDueDateMarkersVerified: proof.verified,
        validationFailureReason: proof.reason,
        prePrimaryDueOn: proof.verified ? CFB_2025_SPECIAL_CALENDAR_RULES[district].prePrimaryDueOn : null,
        preGeneralDueOn: proof.verified ? CFB_2025_SPECIAL_CALENDAR_RULES[district].preGeneralDueOn : null,
      };
    }),
    calendarFailures: calendarFailures.sort((a,b) => a.district - b.district),
    reportCountsByDistrict,
    reports,
    reportOriginalVersionPdfAndCalendarVerified: verified,
    reportOriginalVersionUnverifiedOrFailed: 12 - verified,
    originalReportPdfBytesStored: false,
    reportBodyOrDonorTextStored: false,
    calendarPdfBytesStored: false,
    historicalPublicByVerifiedCount: 0,
    reportVersionObligationDenominator: null,
    statewideLegallyActiveSenateCommitteeCount: null,
    statewideRequiredReportCount: null,
    sourceToDbRowReconciled: false,
    independentAmendmentCheckboxVerifiedCount: 0,
    productionDatabaseChanged: false,
    productionPredictionsOrServingChanged: false,
    modelRetrainingTriggered: false,
    noScheduledAutomation: true,
    issue864RemainsOpen: true,
  };
  mkdirSync(dirname(output), {recursive:true});
  writeFileSync(output, JSON.stringify(outputBody,null,2) + '\n', {encoding:'utf8',flag:'wx'});
  console.log(JSON.stringify({
    schemaVersion: outputBody.schemaVersion,
    originalReferenceCount: 12, originalReferenceRegistrations: 7,
    districts: reportCountsByDistrict,
    officialCalendarPdfsAcquired: calendars.length,
    officialCalendarFailures: calendarFailures.length,
    reportPdfsDownloaded: reportCaptures.size,
    reportPdfsAndCalendarsVerified: verified,
    sourceFailures: sourceFailures.size,
    failClosedReports: reports.filter(r => r.status !== 'pdf_header_period_and_calendar_verified')
      .map(r => ({reportId:r.reportId,status:r.status,reason:r.sourceFailureReason})),
    historicalPublicByVerifiedCount: 0,
    statewideReportObligationDenominator: null,
    output, productionAction: 'none',
  },null,2));
  if (verified !== 12 || calendarFailures.length) process.exitCode = 1;
}
main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
