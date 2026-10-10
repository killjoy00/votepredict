/**
 * Issue #864 — public Minnesota Legislative Reference Library 2021–2025
 * Senate committee index census. Exactly 2022–25 electronic committee pages;
 * 2021 is print-only/not enumerated on the electronic site. No database,
 * original minute PDF fetch, predictions, scheduler or office contact.
 *
 * node --import tsx scripts/capture-senate-committee-2021-25-official-meeting-census.ts
 *   --output artifacts/senate-2021-25-meeting-census.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  parseSenateCommitteeIndexHtml,
} from '../src/evidence/minnesota-senate-committee-source.js';
import {
  reconcileSenateCommitteeCensus,
  senateCensusSha256,
  type SenateCommitteeCensusPage,
  type SenateCommitteeCensusYearInput,
} from '../src/evidence/senate-committee-meeting-census.js';

const YEARS = [2022, 2023, 2024, 2025] as const;
type Year = typeof YEARS[number];

function failSafe(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return value.replace(/https?:\/\/\S+/gi, '[official source]').slice(0, 160);
}

async function fetchOfficialPage(sourceUrl: string) {
  const u = new URL(sourceUrl);
  if (u.protocol !== 'https:' || !['www.lrl.mn.gov', 'lrl.mn.gov'].includes(u.hostname)
    || !u.pathname.toLowerCase().startsWith('/minutes/')) {
    throw Error('Refusing nonofficial Minnesota LRL committee URL');
  }
  const response = await fetch(sourceUrl, {
    redirect: 'follow',
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'VotePredict/2.0 2021-25-Senate-committee-public-meeting-census',
    },
    signal: AbortSignal.timeout(45_000),
  });
  const final = new URL(response.url);
  if (!['www.lrl.mn.gov', 'lrl.mn.gov'].includes(final.hostname)
    || final.protocol !== 'https:' || !final.pathname.toLowerCase().startsWith('/minutes/')) {
    throw Error('Official LRL page redirected to an untrusted location');
  }
  if (!response.ok) throw Error('LRL HTML HTTP ' + response.status);
  const len = Number(response.headers.get('content-length'));
  if (Number.isFinite(len) && len > 3_000_000) throw Error('Official HTML exceeds byte bound');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 150 || bytes.length > 3_000_000) throw Error('Official HTML has unexpected size');
  const html = new TextDecoder().decode(bytes);
  if (!/<html|<h[1-6]|<main/i.test(html)) throw Error('Official committee response does not resemble HTML');
  return { html, sha256: senateCensusSha256(bytes), fetchedAt: new Date().toISOString() };
}

async function yearCapture(year: Year): Promise<SenateCommitteeCensusYearInput> {
  const indexUrl = 'https://www.lrl.mn.gov/minutes/default?body=senate&year=' + year;
  const index = await fetchOfficialPage(indexUrl);
  const committees = parseSenateCommitteeIndexHtml({
    year, html: index.html, sourceUrl: indexUrl,
  });
  if (committees.length > 120) throw Error('Official index committee-page cap exceeded');
  const pages = new Array<SenateCommitteeCensusPage>();
  const failures: SenateCommitteeCensusYearInput['failures'] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(4, committees.length) }, async () => {
    for (;;) {
      const i = next++;
      const committee = committees[i];
      if (!committee) return;
      try {
        const response = await fetchOfficialPage(committee.url);
        pages.push({
          committeeName: committee.committeeName, url: committee.url,
          rawHtmlSha256: response.sha256, html: response.html, fetchedAt: response.fetchedAt,
        });
      } catch (e) {
        failures.push({
          committeeName: committee.committeeName,
          url: committee.url,
          category: e instanceof TypeError ? 'transport' : 'http',
        });
      }
    }
  });
  await Promise.all(workers);
  return {
    year, indexUrl, indexHtml: index.html, indexRawHtmlSha256: index.sha256,
    indexFetchedAt: index.fetchedAt, pages, failures,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const pos = args.indexOf('--output');
  const outputRaw = pos >= 0 ? args[pos + 1]
    : args.find(a => a.startsWith('--output='))?.slice('--output='.length);
  if (!outputRaw || args.some(a => a.startsWith('--') && a !== '--output'
    && !a.startsWith('--output='))) {
    throw Error('Only a local --output file is permitted; audited years are fixed');
  }
  const years: SenateCommitteeCensusYearInput[] = [];
  const indexFailures: Array<{ year: Year; category: string }> = [];
  for (const year of YEARS) {
    try { years.push(await yearCapture(year)); }
    catch (error) { indexFailures.push({ year, category: failSafe(error) }); }
  }
  const census = reconcileSenateCommitteeCensus(years);
  const output = resolve(outputRaw);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({
    ...census,
    indexAcquisitionFailures: indexFailures,
    limitation: {
      electronicIndexNotAnAllMeetingsDenominator: true,
      unlistedMeetingNotProvenNotHeld: true,
      year2021PrintSenateMinutesNotPubliclyEnumerated: true,
      year2022PrintAndElectronicCollectionsMayDiffer: true,
      originalMinutesPdfBytesNotRetrievedInThisCensus: true,
      recordedVoteAndIndividualMemberVoteDenominatorsNotVerified: true,
      existingEvidenceDatabaseNotReadOrCorrected: true,
      allZeroOutputsRequireRealSourceEvidence: true,
    },
  }, null, 2) + '\n');
  console.log(JSON.stringify({
    scope: '2021-2025 Senate only', version: census.schemaVersion,
    years: census.yearSummaries,
    electronicMeetingEntries: census.indexedMeetings.length,
    anomalies: census.anomalies.length,
    indexAcquisitionFailures: indexFailures,
    sourceCoverageState: census.yearSummaries.map(y => [y.year, y.electronicIndexStatus]),
    officialAllMeetingsDenominatorKnown: false,
    voteContentParsed: false,
    databaseReadOrWritten: false,
    output,
  }, null, 2));
}
main().catch(e => { console.error(failSafe(e)); process.exitCode = 1; });
