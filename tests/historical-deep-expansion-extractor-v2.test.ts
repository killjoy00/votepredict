import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { extractHistoricalDeepExpansionCandidatesV2 } from '../src/evaluation/historical-deep-expansion-extractor-v2.js';
import type { HistoricalDeepExpansionDiscoveryManifest } from '../src/evaluation/historical-deep-expansion-discovery.js';
import type {
  HistoricalDeepExpansionCollectedSource,
  HistoricalDeepExpansionSourceBundle,
} from '../src/evaluation/historical-deep-expansion-source-bundle.js';

function discovery(): HistoricalDeepExpansionDiscoveryManifest {
  const cases = Array.from({ length: 24 }, (_, index) => {
    const identifier = `HF${100 + index}`;
    const occurredOn = `2024-05-${String(index + 1).padStart(2, '0')}`;
    const voteEventId = `vote-${index}`;
    const members = [
      {
        membershipId: `m-${index}-alice`, legislatorId: `l-${index}-alice`, memberName: 'Alice Alpha', party: 'DFL', yesProbability: 0.48,
        evidenceQuality: 'moderate' as const, support: { global: 10, party: 8, member: 4, analogue: 1 }, selectedForCurrentDeep: false, selectedForCandidateDeep: true,
      },
      {
        membershipId: `m-${index}-bob`, legislatorId: `l-${index}-bob`, memberName: 'Bob Beta', party: 'R', yesProbability: 0.52,
        evidenceQuality: 'moderate' as const, support: { global: 10, party: 8, member: 4, analogue: 1 }, selectedForCurrentDeep: true, selectedForCandidateDeep: false,
      },
    ];
    return {
      stableKey: `2023-2024|house|external-${index}`,
      caseKey: `2023-2024|house|${identifier}|${occurredOn}`,
      externalKey: `external-${index}`,
      tranche: index % 2 === 0 ? 'deterministic-uniform' as const : 'selector-disagreement' as const,
      voteEventId,
      billId: `bill-${index}`,
      identifier,
      title: `${identifier} fixture`,
      session: '2023-2024',
      chamberId: 'house-id',
      chamber: 'house',
      occurredOn,
      asOf: `2024-04-${String(Math.min(index + 1, 30)).padStart(2, '0')}T23:59:59.999Z`,
      targetVersionId: `target-${index}`,
      quickModelVersion: 'member-eb-v1.1',
      members,
      currentDeepTargetIds: [members[1].membershipId],
      candidateDeepTargetIds: [members[0].membershipId],
      discoveryRequest: {
        forecastId: voteEventId,
        billId: `bill-${index}`,
        chamberId: 'house-id',
        asOf: `2024-04-${String(Math.min(index + 1, 30)).padStart(2, '0')}T23:59:59.999Z`,
        subject: { identifier, title: `${identifier} fixture` },
        targets: members.map((member) => ({
          membershipId: member.membershipId,
          memberName: member.memberName,
          party: member.party,
          yesProbability: member.yesProbability,
          rationale: 'fixture',
        })),
      },
    };
  });
  return {
    schemaVersion: 'historical-deep-expansion-discovery-manifest-v1',
    generatedAt: '2026-09-13T00:00:00.000Z',
    metadata: {
      codeSha: 'discovery-sha', databaseSource: 'test', purpose: 'test', selectionGuard: 'test', cohortGeneratedAt: '2026-09-12T00:00:00.000Z', cohortCodeSha: 'cohort-sha',
      cases: 24, memberCasePairs: 48, currentDeepTargetLimit: 12, candidateStrategy: 'need-only',
    },
    cases,
  };
}

function sourceFor(
  item: HistoricalDeepExpansionDiscoveryManifest['cases'][number],
  meetingId: string,
  lines: string[],
): HistoricalDeepExpansionCollectedSource {
  const content = lines.map((line) => `<p>${line}</p>`).join('\n');
  const bytes = Buffer.from(content, 'utf8');
  return {
    id: `house-minutes-93010-${meetingId}`,
    sourceClass: 'house_committee_record',
    session: '2023-2024',
    committeeId: '93010',
    meetingId,
    indexDate: '2024-04-01',
    publishedAt: '2024-04-01T00:00:00.000Z',
    title: `Fixture ${meetingId}`,
    url: `https://www.house.mn.gov/committees/minutes/93010/${meetingId}`,
    finalUrl: `https://www.house.mn.gov/committees/minutes/93010/${meetingId}`,
    fetchedAt: '2026-09-13T00:00:00.000Z',
    httpStatus: 200,
    contentType: 'text/html; charset=utf-8',
    bytes: bytes.length,
    contentSha256: createHash('sha256').update(bytes).digest('hex'),
    expectedMarkers: ['2024-04-01', item.identifier],
    matchedCases: [{
      stableKey: item.stableKey,
      caseKey: item.caseKey,
      voteEventId: item.voteEventId,
      externalKey: item.externalKey,
      identifier: item.identifier,
      occurredOn: item.occurredOn,
      tranche: item.tranche,
    }],
    content,
  };
}

function sources(manifest: HistoricalDeepExpansionDiscoveryManifest): HistoricalDeepExpansionSourceBundle {
  const [general, alternate, direct, unanimous, voice, amendment] = manifest.cases;
  const values = [
    sourceFor(general, '10001', [
      `Representative Alpha moved that ${general.identifier} be recommended to be placed on the General Register.`,
      'A roll call was taken.',
      'AYES', 'Alpha, Alice', 'NAYS', 'Beta, Bob', 'With a vote of 1 AYES and 1 NAY, the motion prevailed.',
    ]),
    sourceFor(alternate, '10002', [
      `Representative Alpha moved that ${alternate.identifier} be re-referred to the Committee on Ways and Means.`,
      'The clerk noted the roll.',
      'AYES', 'Alpha, Alice', 'NAYS', 'Beta, Bob', 'With a vote of 1 AYES and 1 NAY, the motion prevailed.',
    ]),
    sourceFor(direct, '10003', [
      `Representative Alpha renewed the motion that ${direct.identifier} be re-referred to the Committee on Taxes.`,
      'AYES', 'Alpha, Alice', 'NAYS', 'Beta, Bob', 'There being 1 aye and 1 nay, the motion prevailed.',
    ]),
    sourceFor(unanimous, '10004', [
      `Representative Alpha moved that ${unanimous.identifier} be recommended to pass and re-referred to the General Register.`,
      'AYES', 'Alpha, Alice', 'There being 1 aye and 0 nays, the motion prevailed.',
    ]),
    sourceFor(voice, '10005', [
      `Representative Alpha moved that ${voice.identifier} be re-referred to the Committee on Taxes.`,
      'THE MOTION PREVAILED.',
    ]),
    sourceFor(amendment, '10006', [
      `Representative Alpha moved the A1 amendment to ${amendment.identifier}.`,
      'A roll call was taken.', 'AYES', 'Alpha, Alice', 'NAYS', 'Beta, Bob', 'The motion prevailed.',
    ]),
  ];
  const sourceIdsByVote = new Map(values.map((source) => [source.matchedCases[0].voteEventId, source.id]));
  return {
    schemaVersion: 'historical-deep-expansion-source-bundle-v1',
    generatedAt: '2026-09-13T00:00:00.000Z',
    metadata: {
      codeSha: 'source-sha', cohortHeadSha: 'cohort-sha', cohortArtifactId: 1, cohortArtifactDigest: 'digest',
      sourcePolicy: 'house-committee-archive-enumeration-v1', purpose: 'test', selectionGuard: 'test',
    },
    input: { selectedCases: 24, sessions: ['2023-2024'], chamber: 'house', committeeHomeIdsAttempted: 99 },
    summary: {
      committeesDiscovered: 1, minuteLinksDiscovered: 6, minutePagesEligibleByIndexDate: 6, minutePagesFetched: 6,
      matchedSourcePages: 6, sourceCaseMatches: 6, casesWithSources: 6, casesWithoutSources: 18,
    },
    cases: manifest.cases.map((item) => ({
      stableKey: item.stableKey, caseKey: item.caseKey, voteEventId: item.voteEventId, externalKey: item.externalKey,
      identifier: item.identifier, session: item.session, occurredOn: item.occurredOn, tranche: item.tranche,
      sourceIds: sourceIdsByVote.has(item.voteEventId) ? [sourceIdsByVote.get(item.voteEventId)!] : [],
    })),
    sources: values,
    diagnostics: [],
  };
}

test('v2 broadens only deterministic named-member roll-call formats and remains outcome-blind', () => {
  const manifest = discovery();
  const result = extractHistoricalDeepExpansionCandidatesV2(manifest, sources(manifest), '2026-09-13T02:00:00.000Z');

  assert.equal(result.metadata.parser, 'deterministic-house-committee-roll-call-v2');
  assert.equal(result.metadata.outcomeUse, 'none');
  assert.equal(result.summary.v1BaselineCandidateCount, 0);
  assert.equal(result.summary.candidateCount, 7);
  assert.equal(result.summary.supplementalCandidateCount, 7);
  assert.equal(result.summary.casesWithCandidates, 4);
  assert.equal(result.summary.sourceCaseMatchesWithCandidates, 4);
  assert.equal(result.summary.generalRegisterCandidates, 2);
  assert.equal(result.summary.alternateRollTriggerCandidates, 2);
  assert.equal(result.summary.directNamedRollListCandidates, 3);
  assert.equal(result.summary.currentDeepTargetCandidates, 3);
  assert.equal(result.summary.candidateDeepTargetCandidates, 4);
  assert.equal(result.summary.bothTargetCandidates, 0);
  assert.equal(result.summary.outsideBothTargetCandidates, 0);
  assert.ok(result.candidates.every((item) => item.extractionMethod === 'deterministic-house-committee-roll-call-v2'));
  assert.ok(result.candidates.every((item) => !('actualOutcome' in item) && !('actualYes' in item)));

  assert.equal(result.candidates.filter((item) => item.case.voteEventId === 'vote-3').length, 1);
  assert.equal(result.candidates.find((item) => item.case.voteEventId === 'vote-3')?.voteSide, 'aye');
  assert.equal(result.candidates.some((item) => item.case.voteEventId === 'vote-4'), false);
  assert.equal(result.candidates.some((item) => item.case.voteEventId === 'vote-5'), false);
});

test('v2 fails closed on modified frozen source content', () => {
  const manifest = discovery();
  const bundle = sources(manifest);
  bundle.sources[0].content += '<p>tampered</p>';
  assert.throws(() => extractHistoricalDeepExpansionCandidatesV2(manifest, bundle), /hash mismatch/);
});
