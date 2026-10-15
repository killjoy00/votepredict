/**
 * #864 V41: SHA-pinned, standalone offline reconstruction of all 830 indexed
 * 2021–25 Senate CFB PDF-version sources from immutable merged V40 plus 240
 * new publicly retrieved whole-body PDF metadata proofs. No raw PDF parsing,
 * donor rows, private database, forecast eligibility or timestamp inference.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { verify830OriginalSenateCFBReportPdfBytes } from './audit-cfb-864-830-590-original-pdf-source-v40.mjs';

export const SCHEMA = 'cfb-864-830-indexed-830-source-pdfs-813-distinct-v41';
const BASE = 'docs/evaluation/source-proof/';
const FILE = {
  old: BASE + 'cfb-2021-25-95-senators-830-indexed-590-downloaded-v40.psv',
  proof: BASE + 'cfb-2021-25-240-new-government-PDF-source-retrieval-v41.psv',
  after: BASE + 'cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv',
  checkpoint: BASE + 'cfb-2021-25-240-government-PDF-source-recovery-checkpoint-v41.json',
  profile: 'data/cfb-senate-official-filings-2021-25-v41.json'
};
const PIN = {
  proof: '1709f4a03cfc7aa0737dc404051e70b36f245796',
  after: '7955971a2b714a981a03ce3d93d4693a97e3ab3e',
  checkpoint: '1a1b8d11e4ef7dd10b6f34a6ea34b75f18a55dfd',
  profile: 'd4099ccd00a1e72b52d709b5a2bb6a2c52829523'
};
const SHA = /^[a-f0-9]{64}$/;
function gitBlobHash(str) {
  return createHash('sha1').update('blob ' + Buffer.byteLength(str) + '\0').update(str).digest('hex');
}
function readFile(key) {
  const raw = readFileSync(FILE[key], 'utf8');
  if (!raw.endsWith('\n') || raw.includes('\r') || (PIN[key] && gitBlobHash(raw) !== PIN[key]))
    throw Error('Original CFB V41 source Git blob changed: ' + key);
  return raw;
}
export function verifyAll830SenateCFBPDFSourceVersionsV41() {
  const v40 = verify830OriginalSenateCFBReportPdfBytes();
  if (v40.official2021to25IndexedReportVersions !== 830
    || v40.originalCompletePdfBytesDownloadedVersionRefs !== 590
    || v40.independentlyDistinctWholeGovernmentPdfByteSha256Bodies !== 579
    || v40.indexedVersionsPendingAnyPdfDownload !== 240)
    throw Error('Merged 590-PDF source proof baseline changed');
  const old = readFile('old').trimEnd().split('\n').map(x => x.split('|'));
  const proof = readFile('proof').trimEnd().split('\n').map(x => x.split('|'));
  const full = readFile('after');
  const checkpoint = JSON.parse(readFile('checkpoint'));
  const profile = JSON.parse(readFile('profile'));
  if (old.length !== 830 || proof.length !== 240 || proof.some(x => x.length !== 16)
    || checkpoint.schema !== 'cfb-864-830-indexed-830-government-PDF-downloads-813-distinct-v41'
    || checkpoint.originalOfficialSourceWorkflowRunId !== 38751927330
    || checkpoint.originalOfficialSourceJobId !== 116480257433
    || checkpoint.originalIndependentReplayJobId !== 116482128081
    || checkpoint.originalIndependentReplayWorkflowRunId !== 38751927330
    || checkpoint.independentlyReplayedSourceFullPdfHashesAndBytesEqual !== true
    || checkpoint.independentlyReplayedSourcesCount !== 240
    || checkpoint.source2021to24AdditionalGovPDFDownloads !== 240
    || checkpoint.source2021to24AdditionalDistinctGovPDFFullBodies !== 234
    || checkpoint.additionalSameRegisteredCommitteeIndexedVersionAliases !== 6
    || checkpoint.governmentPDFSourceHolds !== 0
    || checkpoint.complete830IndexedVersions !== 830
    || checkpoint.sourceDownloadedReportVersionRefs !== 830
    || checkpoint.distinctCurrentGovernmentWholePDFSha256Binaries !== 813
    || checkpoint.totalSameBinaryVersionAliases !== 17
    || checkpoint.historicalIndependentExactReportPdfPublicByProven !== 0
    || checkpoint.officialStatutoryOwedReportDenominator !== null
    || checkpoint.originalFinancialContentsAndTransactionsReconciled !== false
    || checkpoint.noRawPDFBodiesOrDonorRowsStored !== true
    || checkpoint.noProtectedDBModelOrDeploymentChange !== true)
    throw Error('Independent government-source capture/replay proof for V41 is incomplete');
  const copies = new Map(old.map(x => [x[0], [...x]]));
  const whole = new Map();
  for (const x of old) {
    if (x.length !== 19) throw Error('Old official PDF report row changed');
    if (x[10] !== '-') {
      const previous = whole.get(x[10]);
      if (previous && previous !== x[3]) throw Error('Historical original cross-committee PDF hash collision');
      whole.set(x[10], x[3]);
    }
  }
  let newlyDistinct = 0, duplicateVersions = 0;
  const seen = new Set(), perYear = {};
  for (const p of proof) {
    const [id, name, year, reg, period, amend, state, sha, bytes, viewer,
      url, fetched, method, run, job, pub] = p;
    const existing = copies.get(id);
    const key = id.split(':');
    if (!existing || seen.has(id) || key.length !== 6
      || key[0] !== reg || key[2] !== 'pcc'
      || existing[1] !== name || existing[2] !== year || existing[3] !== reg
      || existing[4] !== period || existing[5] !== amend || existing[9] !== url
      || existing[12] !== viewer || existing[7] !== 'official_indexed_pdf_not_yet_retrieved'
      || existing[10] !== '-' || existing[11] !== '-'
      || existing[18] !== 'UNKNOWN' || pub !== 'UNKNOWN'
      || !SHA.test(viewer) || !SHA.test(sha)
      || !Number.isSafeInteger(Number(bytes)) || Number(bytes) < 300 || Number(bytes) > 30_000_000
      || !fetched.startsWith('2026-10-15T') || method !== 'GET'
      || run !== '38751927330' || job !== '116480257433')
      throw Error('V41 original government PDF source proof does not match exact indexed version ' + id);
    const originalReg = whole.get(sha);
    if (originalReg && originalReg !== reg)
      throw Error('Cross-committee official PDF binary hash collision in V41');
    const computed = originalReg ? 'indexed_alias_of_same_pdf' : 'official_pdf_downloaded_unparsed';
    if (state !== computed) throw Error('Same-file amendment status mismatch for government PDF ' + id);
    whole.set(sha, reg);
    originalReg ? duplicateVersions++ : newlyDistinct++;
    existing[7] = state; existing[10] = sha; existing[11] = bytes;
    existing[16] = originalReg
      ? 'government_original_2021_24_same_registration_same_pdf_binary_alias_v41'
      : 'government_original_2021_24_complete_pdf_bytes_unparsed_v41';
    existing[17] = FILE.proof;
    perYear[year] = (perYear[year] || 0) + 1;
    seen.add(id);
  }
  if (seen.size !== 240 || newlyDistinct !== 234 || duplicateVersions !== 6
    || JSON.stringify(perYear) !== JSON.stringify({2021: 18, 2022: 115, 2023: 44, 2024: 63}))
    throw Error('V41 PDF additions not reproduced from CFB original immutable indexed versions');
  const rebuilt = [...copies.values()].map(x => x.join('|')).join('\n') + '\n';
  if (rebuilt !== full) throw Error('Original 830-version combined V41 government source ledger cannot be reconstructed byte for byte');
  const rows = [...copies.values()];
  if (rows.length !== 830 || rows.some(x => x.length !== 19 || x[10] === '-'
    || x[11] === '-' || x[18] !== 'UNKNOWN')
    || whole.size !== 813
    || rows.filter(x => x[7] === 'indexed_alias_of_same_pdf').length !== 17
    || rows.filter(x => x[7] === 'official_pdf_downloaded_unparsed').length !== 373)
    throw Error('All 830 exact indexed reports must have current complete government PDF sources');
  const counts = profile.sourceVerifiedCounts;
  if (profile.senators.length !== 95
    || profile.schemaVersion !== 'cfb-senate-practical-830-indexed-830-downloaded-813-distinct-official-pdfs-v41'
    || counts.total !== 830 || counts.original !== 506 || counts.amended !== 324
    || counts.versionsWithDownloadedPDF !== 830 || counts.distinctDownloadedPDFBodies !== 813
    || counts.viewerOnlyNotYetDownloaded !== 0 || counts.indexAliases !== 17
    || counts.unparsedDownloadedSourcePDFBodies !== 373
    || counts.originalV41NewPDFVersionsRetrieved !== 240
    || counts.originalV41DistinctNewPDFBodies !== 234
    || counts.originalV41SameBinaryAliases !== 6
    || counts.originalV41IndependentReplayMatched !== true)
    throw Error('Profile-facing complete government PDF source counters missing');
  const byId = new Map(rows.map(x => [x[0], x]));
  const byReg = new Map();
  for (const r of rows) { const list = byReg.get(r[3]) || []; list.push(r); byReg.set(r[3], list); }
  for (const senator of profile.senators) {
    const docs = byReg.get(senator.registrationNumber) || [];
    if (docs.length !== senator.observedVersions || docs.length !== senator.downloadedVersions
      || senator.filings.length !== senator.observedVersions || docs.some(x => x[1] !== senator.name))
      throw Error('Official actual-serving senator and PDF identity mismatch');
    const review = docs.filter(x => [
      'downloaded_pdf_details_unreadable_or_unresolved',
      'downloaded_pdf_report_date_conflict',
      'official_pdf_downloaded_unparsed'
    ].includes(x[7])).length;
    if (senator.needsReportTextReview !== review) throw Error('Unparsed PDF report text counted incorrectly');
    for (const filing of senator.filings) {
      const source = byId.get(filing.id);
      if (!source || source[3] !== senator.registrationNumber || source[9] !== filing.url
        || source[7] !== filing.status || Number(source[2]) !== filing.year
        || Number(source[5]) !== filing.amendment)
        throw Error('Senator profile version does not reflect original official government PDF source');
    }
  }
  return { schema: SCHEMA, actualSenators: 95, allIndexedFilingVersionReferences: 830,
    originalVersions: 506, amendedVersions: 324, completeOfficialGovernmentPDFVersionSources: 830,
    distinctWholeGovernmentPdfBodies: 813, sameBinaryIndexedVersionAliases: 17,
    newOriginalPDFVersionSources: 240, newlyDistinctPdfBodies: 234,
    independentlyReproducedNewPDFVersions: 240, missingPdfBinarySources: 0,
    newSourcePDFBodiesRequiringContentReview: 234,
    historicalIndependentExactVersionPublicByDatesProven: 0,
    legallyRequiredReportObligationDenominator: null,
    originalFinancialAmountsFullyReconciled: false,
    noPrivateDBOrModelEligibilityProductionChanges: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) throw Error('Only immutable offline official source proofs supported');
  console.log('CFB_864_830_813_V41 ' + JSON.stringify(verifyAll830SenateCFBPDFSourceVersionsV41()));
}