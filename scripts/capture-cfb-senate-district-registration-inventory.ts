/**
 * Issue #864. One-time, read-only official Senate candidate selection capture.
 * Exactly 67 districts by 4 election segments, including predecessor 2020.
 * Not an official historical committee or required-report denominator.
 *
 * node --import tsx scripts/capture-cfb-senate-district-registration-inventory.ts \
 *   --output artifacts/cfb-senate-district-candidate-registrations.json
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  auditCfbSenateDistrictRegistrationInventory,
  cfbSenateDistrictPageUrl,
  failedCfbSenateDistrictPage,
  parseCfbSenateDistrictCandidatePage,
  CFB_SENATE_ROSTER_SEGMENTS,
  CFB_SENATE_DISTRICT_COUNT,
  type CfbSenateDistrictPageObservation,
} from '../src/evidence/cfb-senate-district-registration-inventory.js';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--output');
const outputPath = outIndex >= 0 ? args[outIndex + 1] : null;
if (!outputPath || args.length !== 2 || outIndex !== 0) {
  throw new Error('Required: --output <local JSON file>');
}
const output = resolve(outputPath);
if (output.endsWith('/source-proof/cfb-2025-senate-district6-report-pdfs.json') ||
  output.endsWith('/source-proof/cfb-2021-22-senate-one-filer-original-reports-and-calendars.json')) {
  throw new Error('Refusing to overwrite original source proof ledgers');
}

const jobs = CFB_SENATE_ROSTER_SEGMENTS.flatMap(segmentEndYear =>
  Array.from({ length: CFB_SENATE_DISTRICT_COUNT }, (_v, i) => ({ segmentEndYear, district: i + 1 })));

async function capture({ district, segmentEndYear }: typeof jobs[number]): Promise<CfbSenateDistrictPageObservation> {
  const sourceUrl = cfbSenateDistrictPageUrl(district, segmentEndYear);
  try {
    const response = await fetch(sourceUrl, {
      headers: { 'user-agent': 'Mozilla/5.0 VotePredict/2.0 historical-cfb-senate-registration-audit' },
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    });
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'register.cfb.mn.gov' ||
      !response.ok || !/text\/html/i.test(response.headers.get('content-type') ?? '')) {
      throw new Error('CFB source failed official-host/HTML/HTTP validation');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < 500 || bytes.byteLength > 3_000_000) {
      throw new Error('CFB source body outside 500B–3MB bound');
    }
    const html = new TextDecoder().decode(bytes);
    return parseCfbSenateDistrictCandidatePage({
      district, segmentEndYear, sourceUrl: finalUrl.toString(),
      fetchedAt: new Date().toISOString(),
      htmlSha256: createHash('sha256').update(bytes).digest('hex'),
      html, responseBytes: bytes.byteLength,
    });
  } catch (error) {
    return failedCfbSenateDistrictPage({
      district, segmentEndYear, sourceUrl,
      error: (error instanceof Error ? error.message : String(error))
        .replace(/https?:\/\/\S+/gi, '[official source]').slice(0, 150),
    });
  }
}

async function main(): Promise<void> {
  const observations: CfbSenateDistrictPageObservation[] = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const index = next++;
      observations[index] = await capture(jobs[index]!);
      await new Promise(done => setTimeout(done, 100)); // polite public source request spacing
    }
  }
  await Promise.all([worker(), worker()]);
  const audit = auditCfbSenateDistrictRegistrationInventory(observations);
  const sourceErrors = observations.filter(x => x.status !== 'candidate_labels_observed' &&
    x.status !== 'no_candidate_labels_visible');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({
    schemaVersion: audit.schemaVersion,
    capturedAt: new Date().toISOString(),
    canonicalSource: 'https://register.cfb.mn.gov',
    capturePurpose: 'historical 2021-2025 Senate principal candidate registration discovery, NOT legal obligations',
    observations, audit,
  }, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  console.log(JSON.stringify({
    schemaVersion: audit.schemaVersion,
    pagesExpected: audit.sourceSummary.expectedDistrictSegmentPages,
    pagesAcquiredAndParsed: audit.bySegment.reduce((sum, s) => sum + s.pagesAcquiredAndParsed, 0),
    observedDistinctRegistrationIds: audit.observedUniqueCandidateRegistrations,
    bySegment: audit.bySegment.map(s => ({
      segmentEndYear: s.segmentEndYear,
      pagesAcquiredAndParsed: s.pagesAcquiredAndParsed,
      pagesWithCandidateLabels: s.pagesWithCandidateLabels,
      pagesWithNoVisibleLabels: s.pagesWithNoVisibleLabels,
      distinctRegistrationIdsObserved: s.distinctRegistrationIdsObserved,
    })),
    sourceFailuresOrInvalid: sourceErrors.length,
    sourceErrorSummary: sourceErrors.slice(0, 20).map(x => ({
      district: x.district, segmentEndYear: x.segmentEndYear, status: x.status, reason: x.error,
    })),
    repeatedNamesWithMultipleRegistrations: audit.ambiguousDisplayNameCollisions.length,
    knownControlIds: audit.knownOriginalDocumentControlIds,
    statewideHistoricFilerCount: audit.historicalFinanceDenominator.registeredSenateCommittees2021to2025,
    completenessCertified: audit.historicalFinanceDenominator.completenessCertified,
    output,
  }, null, 2));
  if (sourceErrors.length || !audit.sourceSummary.allDistrictSegmentsCapturedAndParsed) {
    process.exitCode = 1; // partial source proof is a failure, not an official zero.
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
