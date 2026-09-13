import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { extractHistoricalDeepExpansionCandidates } from '../src/evaluation/historical-deep-expansion-extractor.js';
import type { HistoricalDeepExpansionDiscoveryManifest } from '../src/evaluation/historical-deep-expansion-discovery.js';
import type { HistoricalDeepExpansionSourceBundle } from '../src/evaluation/historical-deep-expansion-source-bundle.js';

function discovery(): HistoricalDeepExpansionDiscoveryManifest {
  const cases = Array.from({ length: 24 }, (_, index) => {
    const identifier = `HF${100 + index}`;
    const occurredOn = `2024-04-${String(index + 1).padStart(2, '0')}`;
    const voteEventId = `vote-${index}`;
    const stableKey = `2023-2024|house|external-${index}`;
    const members = [
      {
        membershipId: `m-${index}-aye`, legislatorId: `l-${index}-aye`, memberName: 'Alice Alpha', party: 'DFL', yesProbability: 0.48,
        evidenceQuality: 'moderate' as const, support: { global: 10, party: 8, member: 4, analogue: 1 }, selectedForCurrentDeep: false, selectedForCandidateDeep: true,
      },
      {
        membershipId: `m-${index}-nay`, legislatorId: `l-${index}-nay`, memberName: 'Bob Beta', party: 'R', yesProbability: 0.52,
        evidenceQuality: 'moderate' as const, support: { global: 10, party: 8, member: 4, analogue: 1 }, selectedForCurrentDeep: true, selectedForCandidateDeep: false,
      },
    ];
    return {
      stableKey,
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
      asOf: `2024-04-${String(index).padStart(2, '0')}T23:59:59.999Z`,
      targetVersionId: `target-${index}`,
      quickModelVersion: 'member-eb-v1.1',
      members,
      currentDeepTargetIds: [members[1].membershipId],
      candidateDeepTargetIds: [members[0].membershipId],
      discoveryRequest: {
        forecastId: voteEventId,
        billId: `bill-${index}`,
        chamberId: 'house-id',
        asOf: `2024-04-${String(index).padStart(2, '0')}T23:59:59.999Z`,
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

function sources(manifest: HistoricalDeepExpansionDiscoveryManifest): HistoricalDeepExpansionSourceBundle {
  const target = manifest.cases[0];
  const content = [
    '<p>Alice Alpha, District 1</p>',
    '<p>Bob Beta, District 2</p>',
    `<p>Representative Alpha moved that ${target.identifier} be recommended to pass.</p>`,
    '<p>Representative Beta requested a roll call.</p>',
    '<p>AYES</p>',
    '<p>Alpha, Alice</p>',
    '<p>NAYS</p>',
    '<p>Beta, Bob</p>',
    '<p>There being no further discussion.</p>',
  ].join('\n');
  const bytes = Buffer.from(content, 'utf8');
  const source = {
    id: 'house-minutes-93010-99999',
    sourceClass: 'house_committee_record' as const,
    session: '2023-2024',
    committeeId: '93010',
    meetingId: '99999',
    indexDate: '2024-03-31',
    publishedAt: '2024-03-31T00:00:00.000Z',
    title: 'Fixture committee minutes',
    url: 'https://www.house.mn.gov/committees/minutes/93010/99999',
    finalUrl: 'https://www.house.mn.gov/committees/minutes/93010/99999',
    fetchedAt: '2026-09-13T00:00:00.000Z',
    httpStatus: 200,
    contentType: 'text/html; charset=utf-8',
    bytes: bytes.length,
    contentSha256: createHash('sha256').update(bytes).digest('hex'),
    expectedMarkers: ['2024-03-31', target.identifier],
    matchedCases: [{
      stableKey: target.stableKey,
      caseKey: target.caseKey,
      voteEventId: target.voteEventId,
      externalKey: target.externalKey,
      identifier: target.identifier,
      occurredOn: target.occurredOn,
      tranche: target.tranche,
    }],
    content,
  };
  return {
    schemaVersion: 'historical-deep-expansion-source-bundle-v1',
    generatedAt: '2026-09-13T00:00:00.000Z',
    metadata: {
      codeSha: 'source-sha', cohortHeadSha: 'cohort-sha', cohortArtifactId: 1, cohortArtifactDigest: 'digest',
      sourcePolicy: 'house-committee-archive-enumeration-v1', purpose: 'test', selectionGuard: 'test',
    },
    input: { selectedCases: 24, sessions: ['2023-2024'], chamber: 'house', committeeHomeIdsAttempted: 99 },
    summary: {
      committeesDiscovered: 20, minuteLinksDiscovered: 500, minutePagesEligibleByIndexDate: 400, minutePagesFetched: 400,
      matchedSourcePages: 1, sourceCaseMatches: 1, casesWithSources: 1, casesWithoutSources: 23,
    },
    cases: manifest.cases.map((item) => ({
      stableKey: item.stableKey, caseKey: item.caseKey, voteEventId: item.voteEventId, externalKey: item.externalKey,
      identifier: item.identifier, session: item.session, occurredOn: item.occurredOn, tranche: item.tranche,
      sourceIds: item.voteEventId === target.voteEventId ? [source.id] : [],
    })),
    sources: [source],
    diagnostics: [],
  };
}

test('runs the frozen expansion artifacts through the unchanged pilot parser and reattaches candidate targeting', () => {
  const manifest = discovery();
  const result = extractHistoricalDeepExpansionCandidates(manifest, sources(manifest), '2026-09-13T01:00:00.000Z');

  assert.equal(result.metadata.parser, 'deterministic-house-committee-roll-call-v1');
  assert.equal(result.metadata.outcomeUse, 'none');
  assert.equal(result.input.discoveryCases, 24);
  assert.equal(result.input.sourcePages, 1);
  assert.equal(result.summary.candidateCount, 2);
  assert.equal(result.summary.ayeCandidates, 1);
  assert.equal(result.summary.nayCandidates, 1);
  assert.equal(result.summary.currentDeepTargetCandidates, 1);
  assert.equal(result.summary.candidateDeepTargetCandidates, 1);
  assert.equal(result.summary.bothTargetCandidates, 0);
  assert.equal(result.summary.outsideBothTargetCandidates, 0);
  assert.equal(result.candidates[0].source.sourceId, 'house-minutes-93010-99999');

  const aye = result.candidates.find((item) => item.voteSide === 'aye');
  const nay = result.candidates.find((item) => item.voteSide === 'nay');
  assert.equal(aye?.memberName, 'Alice Alpha');
  assert.equal(aye?.selectedForCurrentDeep, false);
  assert.equal(aye?.selectedForCandidateDeep, true);
  assert.equal(nay?.memberName, 'Bob Beta');
  assert.equal(nay?.selectedForCurrentDeep, true);
  assert.equal(nay?.selectedForCandidateDeep, false);
  assert.equal(aye?.case.stableKey, manifest.cases[0].stableKey);
});

test('fails closed if the selected expansion corpus no longer has unique bill/date case keys', () => {
  const manifest = discovery();
  manifest.cases[1].caseKey = manifest.cases[0].caseKey;
  assert.throws(
    () => extractHistoricalDeepExpansionCandidates(manifest, sources(manifest)),
    /case keys are not unique/,
  );
});
