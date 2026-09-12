import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  extractBillProceduralRollCalls,
  extractHistoricalDeepDiscoveryCandidates,
  historicalHtmlLines,
} from '../src/evaluation/historical-deep-discovery-extractor.js';
import type { HistoricalDeepDiscoveryManifest } from '../src/evaluation/historical-deep-discovery.js';
import { HISTORICAL_DEEP_PILOT_CASES } from '../src/evaluation/historical-deep-pilot.js';
import type { HistoricalDeepSourceBundle } from '../src/evaluation/historical-deep-source-catalog.js';

function discovery(memberNames = ['Rick Hansen', 'Jim Nash']): HistoricalDeepDiscoveryManifest {
  return {
    metadata: {
      generatedAt: '2026-09-12T00:00:00.000Z',
      codeSha: 'sha',
      databaseSource: 'DATABASE_URL',
      purpose: 'test',
      pilotCases: HISTORICAL_DEEP_PILOT_CASES,
      cases: 1,
      memberCasePairs: memberNames.length,
      currentDeepTargetLimit: 12,
    },
    cases: [{
      voteEventId: 'vote-1',
      billId: 'bill-1',
      identifier: 'HF3276',
      title: 'Ranked choice voting',
      session: '2023-2024',
      chamberId: 'house-1',
      chamber: 'house',
      occurredOn: '2024-05-19',
      asOf: '2024-05-18T23:59:59.999Z',
      targetVersionId: 'version-1',
      quickModelVersion: 'model-1',
      currentDeepTargetIds: [],
      members: memberNames.map((memberName, index) => ({
        membershipId: `membership-${index}`,
        legislatorId: `legislator-${index}`,
        memberName,
        district: `${index + 1}A`,
        party: index === 0 ? 'DFL' : 'R',
        yesProbability: index === 0 ? 0.995 : 0.005,
        evidenceQuality: 'strong' as const,
        support: { global: 100, party: 50, member: 20, analogue: 1 },
        selectedForCurrentDeep: false,
      })),
      discoveryRequest: {
        forecastId: 'vote-1',
        billId: 'bill-1',
        chamberId: 'house-1',
        asOf: '2024-05-18T23:59:59.999Z',
        subject: { identifier: 'HF3276', title: 'Ranked choice voting' },
        targets: [],
      },
    }],
  };
}

function sourceBundle(html: string, shaOverride?: string): HistoricalDeepSourceBundle {
  const contentSha256 = shaOverride ?? createHash('sha256').update(Buffer.from(html, 'utf8')).digest('hex');
  return {
    schemaVersion: 'historical-deep-source-bundle-v1',
    catalogSchemaVersion: 'historical-deep-source-catalog-v1',
    jurisdictionSlug: 'us-mn',
    generatedAt: '2026-09-12T00:00:00.000Z',
    sourceCount: 1,
    caseCount: 1,
    sources: [{
      case: { session: '2023-2024', chamber: 'house', identifier: 'HF3276', occurredOn: '2024-05-19' },
      id: 'hf3276-committee',
      sourceClass: 'house_committee_record',
      url: 'https://www.house.mn.gov/committees/minutes/93022/100838',
      title: 'State and Local Government Finance and Policy',
      publishedAt: '2024-04-09T00:00:00.000Z',
      expectedMarkers: ['HF3276', 'Hansen'],
      fetchedAt: '2026-09-12T00:00:00.000Z',
      finalUrl: 'https://www.house.mn.gov/committees/minutes/93022/100838',
      httpStatus: 200,
      contentType: 'text/html',
      bytes: Buffer.byteLength(html),
      contentSha256,
      content: html,
    }],
  };
}

const FINAL_ROLL_CALL_HTML = `
<html><body>
<p>HF3276 (Frazier); Ranked choice voting provided.</p>
<p>Representative Frazier moved the H3276A4 amendment.</p>
<p>Representative Nadeau requested a roll call on the H3276A4 amendment.</p>
<div>AYES</div><div>Nash</div><div>NAYS</div><div>Hansen</div><div>There being 1 aye and 1 nay.</div>
<p>Chair Klevorn renewed the motion that HF3276 as amended be re-referred to the Ways and Means Committee.</p>
<p>Representative Nadeau requested a roll call on HF3276.</p>
<p>The clerk took the roll:</p>
<div>AYES</div><div>Nash</div><div>NAYS</div><div>Hansen</div><div>There being 1 aye and 1 nay. THE MOTION PREVAILED.</div>
</body></html>`;

test('bill-procedural parser ignores amendment votes and keeps the final bill motion', () => {
  const blocks = extractBillProceduralRollCalls(historicalHtmlLines(FINAL_ROLL_CALL_HTML), 'HF3276');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].ayes.length, 1);
  assert.equal(blocks[0].nays.length, 1);
  assert.match(blocks[0].motionText, /re-referred to the Ways and Means Committee/i);
  assert.deepEqual(blocks[0].ayes, ['Nash']);
  assert.deepEqual(blocks[0].nays, ['Hansen']);
});

test('extractor resolves committee votes to active members without floor outcomes', () => {
  const result = extractHistoricalDeepDiscoveryCandidates(
    discovery(),
    sourceBundle(FINAL_ROLL_CALL_HTML),
    '2026-09-12T00:00:00.000Z',
  );
  assert.equal(result.summary.candidateCount, 2);
  assert.equal(result.summary.ayeCandidates, 1);
  assert.equal(result.summary.nayCandidates, 1);
  const hansen = result.candidates.find((candidate) => candidate.memberName === 'Rick Hansen');
  assert.ok(hansen);
  assert.equal(hansen.voteSide, 'nay');
  assert.equal(hansen.quickYesProbability, 0.995);
  assert.equal(hansen.selectedForCurrentDeep, false);
  assert.match(hansen.excerpt, /roll call on HF3276/i);
  assert.equal(JSON.stringify(result).includes('actualOutcome'), false);
  assert.equal(JSON.stringify(result).includes('passed'), false);
});

test('ambiguous last-name-only committee votes fail closed instead of guessing', () => {
  const ambiguousDiscovery = discovery(['Michael V. Nelson', 'Nathan Nelson']);
  const html = `
    <p>HF3276 (Frazier)</p>
    <p>Chair Klevorn renewed the motion that HF3276 be re-referred to Ways and Means.</p>
    <p>Representative Nadeau requested a roll call on HF3276.</p>
    <div>AYES</div><div>Nelson</div><div>NAYS</div><div>Nash</div><div>There being one aye and one nay.</div>`;
  const result = extractHistoricalDeepDiscoveryCandidates(ambiguousDiscovery, sourceBundle(html));
  assert.equal(result.candidates.some((candidate) => /Nelson/.test(candidate.memberName)), false);
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.type === 'ambiguous_vote_name' && diagnostic.rawName === 'Nelson'), true);
});

test('page-local roster identity safely resolves otherwise ambiguous last-name shorthand', () => {
  const ambiguousDiscovery = discovery(['Michael V. Nelson', 'Nathan Nelson']);
  const html = `
    <div>NELSON, Michael, Chair</div>
    <p>HF3276 (Frazier)</p>
    <p>Chair Nelson renewed the motion that HF3276 be re-referred to Ways and Means.</p>
    <p>Representative Nadeau requested a roll call on HF3276.</p>
    <div>AYES</div><div>NELSON</div><div>NAYS</div><div>Nash</div><div>There being one aye and one nay.</div>`;
  const result = extractHistoricalDeepDiscoveryCandidates(ambiguousDiscovery, sourceBundle(html));
  const nelson = result.candidates.find((candidate) => candidate.memberName === 'Michael V. Nelson');
  assert.ok(nelson);
  assert.equal(nelson.voteSide, 'aye');
  assert.equal(result.candidates.some((candidate) => candidate.memberName === 'Nathan Nelson'), false);
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.rawName === 'NELSON'), false);
});

test('extractor rejects frozen source content that does not match its recorded SHA', () => {
  assert.throws(() => extractHistoricalDeepDiscoveryCandidates(
    discovery(),
    sourceBundle(FINAL_ROLL_CALL_HTML, '0'.repeat(64)),
  ), /hash mismatch/i);
});

test('parser recognizes final roll call when the request itself omits the bill identifier', () => {
  const html = `
    <p>Chair Liebling renewed her motion that HF1 be re-referred to the Committee on Judiciary Finance and Civil Law.</p>
    <p>Representative Backer requested a roll call vote.</p>
    <div>AYE</div><div>LIEBLING, Tina (Chair)</div><div>NAY</div><div>BACKER, Jeff</div>
    <div>On a vote of 1 AYE and 1 NAY THE MOTION PREVAILED.</div>`;
  const blocks = extractBillProceduralRollCalls(historicalHtmlLines(html), 'HF1');
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].ayes, ['LIEBLING, Tina (Chair)']);
  assert.deepEqual(blocks[0].nays, ['BACKER, Jeff']);
});

test('clerk roll-call narration does not create a second procedural vote', () => {
  const html = `
    <p>Chair Nelson renewed the motion that HF 2, as amended, be recommended to pass and re-referred to State and Local Government.</p>
    <p>Representative McDonald requested a roll call on HF 2, as amended.</p>
    <p>The clerk took the roll call.</p>
    <div>AYE</div><div>Nelson</div><div>NAY</div><div>McDonald</div><div>There being 1 aye and 1 nay.</div>`;
  const blocks = extractBillProceduralRollCalls(historicalHtmlLines(html), 'HF2');
  assert.equal(blocks.length, 1);
});
