/**
 * Issue #864 V41: fetch public Minnesota CFB PDF bodies for all 240
 * report-version references left index-only by the merged V40 ledger.
 * Offline input is the exact immutable V40 source ledger. Network access is
 * only to the CFB government PDF origin. Output: version ID + public source
 * identity + full-body SHA256/byte length + retrieval method/date or reason.
 * No text extraction, donor rows, PDF blobs, transaction details, database
 * writes, eligibility changes or assumed historical publication dates.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { verify830OriginalSenateCFBReportPdfBytes } from './audit-cfb-864-830-590-original-pdf-source-v40.mjs';

export const SCHEMA = 'cfb-864-240-v40-index-only-original-government-pdf-bodies-v41';
export const LOG = 'CFB_864_REMAINING_240_SOURCE_V41 ';
const FILE = 'docs/evaluation/source-proof/cfb-2021-25-95-senators-830-indexed-590-downloaded-v40.psv';
const GOV = 'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF';
const SHA = /^[a-f0-9]{64}$/;
const COUNTS = { 2021: 18, 2022: 115, 2023: 44, 2024: 63 };

export function selectRemaining240() {
  const previous = verify830OriginalSenateCFBReportPdfBytes();
  if (previous.official2021to25IndexedReportVersions !== 830
    || previous.originalCompletePdfBytesDownloadedVersionRefs !== 590
    || previous.indexedVersionsPendingAnyPdfDownload !== 240)
    throw Error('V40 original source/index baseline no longer matches');
  const text = readFileSync(FILE, 'utf8');
  if (!text.endsWith('\n') || text.includes('\r'))
    throw Error('V40 official source ledger line structure changed');
  const rows = text.trimEnd().split('\n').map(x => x.split('|'));
  if (rows.length !== 830 || rows.some(x => x.length !== 19))
    throw Error('V40 source report version structure changed');
  const filtered = rows.filter(x => x[7] === 'official_indexed_pdf_not_yet_retrieved');
  if (filtered.length !== 240) throw Error('Original index-only selection is no longer 240 reports');
  const totals = {};
  const selected = filtered.map(row => {
    const [id, person, year, registration, period, amend, kind, status, identity, url,
      pdfSha, pdfBytes, viewerSha, receipt, from, through, sourceNote, provenance, historic] = row;
    const key = id.split(':');
    const expected = GOV + '&downloadpdf=false&year=' + key[1]
      + '&type=pcc&period=' + key[3] + '&se=' + key[4]
      + '&regnum=' + registration + '&amend=' + key[5];
    if (key.length !== 6 || key[0] !== registration || Number(key[1]) + 2000 !== Number(year)
      || key[2] !== 'pcc' || key[3] !== period || key[5] !== amend
      || (Number(amend) === 0) !== (kind === 'original')
      || !/^\d+$/.test(registration) || !/^\d+$/.test(amend)
      || !['0', '1'].includes(key[4]) || !/^(C|E|YE|S)$/.test(period)
      || !person || !identity || !provenance || !sourceNote
      || status !== 'official_indexed_pdf_not_yet_retrieved'
      || pdfSha !== '-' || pdfBytes !== '-' || historic !== 'UNKNOWN'
      || receipt !== '-' || from !== '-' || through !== '-'
      || !SHA.test(viewerSha) || url !== expected)
      throw Error('Unexpected original government viewer or PDF reference ' + id);
    totals[year] = (totals[year] || 0) + 1;
    return { id, person, reportYear: Number(year), registration, period,
      amendment: Number(amend), officialViewerSHA256: viewerSha, exactGovUrl: url };
  });
  if (new Set(selected.map(x => x.id)).size !== 240
    || JSON.stringify(totals) !== JSON.stringify(COUNTS))
    throw Error('240 indexed versions were lost, repeated or moved between report years');
  return selected;
}
function errorCategory(e) {
  const value = e instanceof Error ? e.message : String(e);
  if (/abort|timeout/i.test(value)) return 'government_pdf_timeout';
  if (/HTTP 429|HTTP 50[234]/.test(value)) return 'government_pdf_transient_http';
  if (/HTTP 4\d\d/.test(value)) return 'government_pdf_http_4xx';
  if (/PDF|redirect|size|length|URL/.test(value)) return 'government_pdf_invalid_binary_or_origin';
  return 'government_pdf_transport_error';
}
async function getOfficialPdf(record, method) {
  const pieces = record.id.split(':');
  const form = new URLSearchParams({
    searchType: 'Candidate', downloadpdf: 'false', year: pieces[1], type: pieces[2],
    period: pieces[3], se: pieces[4], regnum: record.registration, amend: pieces[5],
    disc: '', date: '', show: '0'
  });
  const response = await fetch(method === 'GET' ? record.exactGovUrl : GOV, {
    method, headers: {
      'user-agent': 'Mozilla/5.0 VotePredict/2.0 official-Senate-CFB-version-source-V41',
      accept: 'application/pdf,*/*;q=0.3',
      referer: 'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'
        + record.registration + '/' + String(2 * Math.ceil(record.reportYear / 2)) + '/',
      ...(method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } : {})
    },
    ...(method === 'POST' ? { body: form.toString() } : {}),
    redirect: 'follow', signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) throw Error('Official CFB PDF HTTP ' + response.status);
  const final = new URL(response.url);
  if (final.protocol !== 'https:' || !['cfb.mn.gov', 'www.cfb.mn.gov'].includes(final.hostname)
    || final.pathname !== '/rptViewer/Main.php')
    throw Error('Original CFB PDF response redirected outside official source URL');
  const headerBytes = Number(response.headers.get('content-length'));
  if (headerBytes > 30_000_000) throw Error('Original CFB PDF exceeds safety size');
  const raw = new Uint8Array(await response.arrayBuffer());
  if (raw.byteLength < 300 || raw.byteLength > 30_000_000
    || Buffer.from(raw.subarray(0, 5)).toString('ascii') !== '%PDF-')
    throw Error('Original CFB government response not complete PDF binary');
  return { wholeSha256: createHash('sha256').update(raw).digest('hex'),
    wholeBytes: raw.byteLength, fetchedAt: new Date().toISOString(), method };
}
export async function captureRemaining240() {
  const targets = selectRemaining240();
  let cursor = 0;
  const results = Array(targets.length);
  async function worker() {
    while (cursor < targets.length) {
      const i = cursor++, target = targets[i];
      let observed = null;
      const holds = [];
      for (const method of ['GET', 'POST']) {
        try { observed = await getOfficialPdf(target, method); break; }
        catch (e) { holds.push({ method, reason: errorCategory(e) }); }
      }
      results[i] = {
        versionId: target.id, person: target.person, reportYear: target.reportYear,
        registration: target.registration, period: target.period, amendment: target.amendment,
        officialViewerSHA256: target.officialViewerSHA256,
        ...(observed ? {
          status: 'government_pdf_full_bytes_downloaded_unparsed',
          originalWholePDFSHA256: observed.wholeSha256,
          originalWholePDFBytes: observed.wholeBytes,
          fetchedAt: observed.fetchedAt, method: observed.method
        } : { status: 'government_pdf_transport_hold', attempts: holds }),
        contemporaneousPublicByDate: null,
        financialContentNotReviewed: true
      };
      await new Promise(done => setTimeout(done, 250));
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  const successful = results.filter(x => x?.status === 'government_pdf_full_bytes_downloaded_unparsed');
  if (results.length !== 240 || results.some(x => !x)
    || new Set(results.map(x => x.versionId)).size !== 240)
    throw Error('Original 240 version references lost in CFB acquisition');
  return { schema: SCHEMA, originalIndexedReferencesAttempted: 240,
    completeGovernmentPdfDownloads: successful.length,
    originalOfficialPdfTransportHolds: 240 - successful.length,
    numberOfUnreviewedPdfContents: successful.length,
    historicalExactVersionPublicByProven: 0,
    statutoryOwedReportDenominator: null, noRawPDFBodiesOrDonorTransactionsStored: true,
    noPrivateDatabaseModelEligibilityOrDeploymentChange: true, reports: results };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) throw Error('Fixed original 240 government indexed IDs only');
  const source = await captureRemaining240();
  const { reports, ...summary } = source;
  console.log(LOG + 'SUMMARY ' + JSON.stringify(summary));
  for (let i = 0; i < reports.length; i += 10) {
    const chunk = JSON.stringify({ offset: i, reports: reports.slice(i, i + 10) });
    if (chunk.length > 12000 || /%PDF-|"(?:donorName|transactionBody|rawPDF)"\s*:/i.test(chunk))
      throw Error('Only bounded source PDF hashes and statuses may be printed');
    console.log(LOG + 'CHUNK ' + chunk);
  }
}