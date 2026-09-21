import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractQuickEvidenceCommitteeRollcallCandidates,
} from '../src/evaluation/quick-evidence-committee-rollcall-extractor.js';
import type { QuickEvidenceCommitteeRollcallManifest } from '../src/evaluation/quick-evidence-committee-rollcall-manifest.js';
import type {
  QuickEvidenceCommitteeRollcallCollectedSource,
  QuickEvidenceCommitteeRollcallSourceBundle,
} from '../src/evaluation/quick-evidence-committee-rollcall-source-bundle.js';

function manifest(): QuickEvidenceCommitteeRollcallManifest {
  const makeCase = (index: number, identifier: string) => ({
    stableKey: `2023-2024|house|external-${index}`,
    voteEventId: `vote-${index}`,
    externalKey: `external-${index}`,
    billId: `bill-${index}`,
    identifier,
    title: `${identifier} fixture`,
    session: '2023-2024' as const,
    partition: 'validation' as const,
    chamberId: 'house-id',
    chamber: 'house' as const,
    occurredOn: `2024-05-${String(index + 10).padStart(2, '0')}`,
    asOf: `2024-05-${String(index + 9).padStart(2, '0')}T23:59:59.999Z`,
    targetVersionId: `version-${index}`,
    quickModelVersion: 'member-eb-v1.2-decay180',
    members: [
      {
        membershipId: `m-${index}-alice`,
        legislatorId: `l-${index}-alice`,
        memberName: 'Alice Alpha',
        party: 'DFL',
        yesProbability: 0.48,
        evidenceQuality: 'moderate' as const,
        support: { global: 10, party: 8, member: 4, analogue: 1 },
      },
      {
        membershipId: `m-${index}-bob`,
        legislatorId: `l-${index}-bob`,
        memberName: 'Bob Beta',
        party: 'R',
        yesProbability: 0.52,
        evidenceQuality: 'moderate' as const,
        support: { global: 10, party: 8, member: 4, analogue: 1 },
      },
    ],
  });
  const cases = [makeCase(0, 'HF100'), makeCase(1, 'HF101')];
  return {
    schemaVersion: 'quick-evidence-committee-rollcall-manifest-v1',
    generatedAt: '2026-09-21T16:00:00.000Z',
    metadata: {
      codeSha: 'a'.repeat(40),
      databaseSource: 'test',
      purpose: 'test',
      outcomeBoundary: 'test',
      sourcePlan: 'quick-evidence-committee-rollcall-screen-plan-v1',
      sessions: ['2021-2022', '2023-2024', '2025-2026'],
      chamber: 'house',
      cases: cases.length,
      memberCasePairs: 4,
      casesBySession: { '2021-2022': 0, '2023-2024': 2, '2025-2026': 0 },
    },
    cases,
  };
}

function sourceFor(
  item: QuickEvidenceCommitteeRollcallManifest['cases'][number],
  meetingId: string,
  lines: string[],
): QuickEvidenceCommitteeRollcallCollectedSource {
  const content = lines.map((line) => `<p>${line}</p>`).join('\n');
  const bytes = Buffer.from(content, 'utf8');
  return {
    id: `house-minutes-93010-${meetingId}`,
    sourceClass: 'house_committee_record',
    session: item.session,
    committeeId: '93010',
    meetingId,
    indexDate: '2024-04-01',
    publishedAt: '2024-04-01T00:00:00.000Z',
    title: `Fixture ${meetingId}`,
    url: `https://www.house.mn.gov/committees/minutes/93010/${meetingId}`,
    finalUrl: `https://www.house.mn.gov/committees/minutes/93010/${meetingId}`,
    fetchedAt: '2026-09-21T16:01:00.000Z',
    httpStatus: 200,
    contentType: 'text/html; charset=utf-8',
    bytes: bytes.length,
    contentSha256: createHash('sha256').update(bytes).digest('hex'),
    expectedMarkers: ['2024-04-01', item.identifier],
    matchedCases: [{
      stableKey: item.stableKey,
      voteEventId: item.voteEventId,
      externalKey: item.externalKey,
      identifier: item.identifier,
      occurredOn: item.occurredOn,
      partition: item.partition,
    }],
    content,
  };
}

function sources(targets: QuickEvidenceCommitteeRollcallManifest): QuickEvidenceCommitteeRollcallSourceBundle {
  const baseline = sourceFor(targets.cases[0], '1', [
    `Representative Alpha moved that ${targets.cases[0].identifier} be recommended to pass and re-referred to the Committee on Taxes.`,
    'Representative Alpha requested a roll call.',
    'AYES',
    'Alpha, Alice',
    'NAYS',
    'Beta, Bob',
    'With a vote of 1 AYES and 1 NAY, the motion prevailed.',
  ]);
  const supplemental = sourceFor(targets.cases[1], '2', [
    `Representative Alpha moved that ${targets.cases[1].identifier} be recommended to be placed on the General Register.`,
    'A roll call was taken.',
    'AYES',
    'Alpha, Alice',
    'NAYS',
    'Beta, Bob',
    'With a vote of 1 AYES and 1 NAY, the motion prevailed.',
  ]);
  return {
    schemaVersion: 'quick-evidence-committee-rollcall-source-bundle-v1',
    generatedAt: '2026-09-21T16:01:00.000Z',
    metadata: {
      codeSha: 'b'.repeat(40),
      manifestGeneratedAt: targets.generatedAt,
      manifestCodeSha: targets.metadata.codeSha,
      sourcePolicy: 'house-committee-archive-enumeration-v1',
      sourcePlan: 'quick-evidence-committee-rollcall-screen-plan-v1',
      purpose: 'test',
      selectionGuard: 'test',
    },
    input: {
      manifestCases: targets.cases.length,
      sessions: ['2021-2022', '2023-2024', '2025-2026'],
      chamber: 'house',
      committeeHomeIdsAttempted: 297,
    },
    summary: {
      committeesDiscovered: 30,
      minuteLinksDiscovered: 100,
      minutePagesEligibleByIndexDate: 80,
      minutePagesFetched: 80,
      matchedSourcePages: 2,
      sourceCaseMatches: 2,
      casesWithSources: 2,
      casesWithoutSources: 0,
      casesWithSourcesBySession: { '2021-2022': 0, '2023-2024': 2, '2025-2026': 0 },
    },
    cases: targets.cases.map((item, index) => ({
      stableKey: item.stableKey,
      voteEventId: item.voteEventId,
      externalKey: item.externalKey,
      identifier: item.identifier,
      session: item.session,
      partition: item.partition,
      occurredOn: item.occurredOn,
      sourceIds: [index === 0 ? baseline.id : supplemental.id],
    })),
    sources: [baseline, supplemental],
    diagnostics: [],
  };
}

test('broad committee extractor reuses v1 plus v2 rules and emits zero-weight mechanics features', () => {
  const targets = manifest();
  const result = extractQuickEvidenceCommitteeRollcallCandidates(targets, sources(targets), '2026-09-21T16:02:00.000Z');

  assert.equal(result.metadata.parser, 'deterministic-house-committee-roll-call-v2');
  assert.equal(result.metadata.outcomeUse, 'none');
  assert.equal(result.metadata.probabilityAction, 'none');
  assert.equal(result.summary.observations, 4);
  assert.equal(result.summary.baselineObservations, 2);
  assert.equal(result.summary.supplementalObservations, 2);
  assert.equal(result.summary.memberEventPairsWithFeatures, 4);
  assert.equal(result.summary.eventsWithFeatures, 2);

  const baselineAye = result.featureRows.find((row) =>
    row.voteEventId === 'vote-0' && row.membershipId === 'm-0-alice');
  assert.equal(baselineAye?.features.committeeRecommendsPassageAye, 1);
  assert.equal(baselineAye?.features.continuesCommitteeReviewAye, 1);
  const baselineNay = result.featureRows.find((row) =>
    row.voteEventId === 'vote-0' && row.membershipId === 'm-0-bob');
  assert.equal(baselineNay?.features.committeeRecommendsPassageNay, 1);
  assert.equal(baselineNay?.features.continuesCommitteeReviewNay, 1);

  const registerAye = result.featureRows.find((row) =>
    row.voteEventId === 'vote-1' && row.membershipId === 'm-1-alice');
  assert.equal(registerAye?.features.advancesTowardFloorEligibilityAye, 1);
  const registerNay = result.featureRows.find((row) =>
    row.voteEventId === 'vote-1' && row.membershipId === 'm-1-bob');
  assert.equal(registerNay?.features.advancesTowardFloorEligibilityNay, 1);

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('actualOutcome'), false);
  assert.equal(serialized.includes('"passed"'), false);
  assert.ok(result.observations.every((item) => item.mechanicallyActionable === false));
  assert.ok(result.observations.every((item) => item.finalPassageInference === 'none'));
});

test('broad committee extractor fails closed when a frozen source hash changes', () => {
  const targets = manifest();
  const bundle = sources(targets);
  bundle.sources[0].content += '<p>tampered</p>';
  assert.throws(
    () => extractQuickEvidenceCommitteeRollcallCandidates(targets, bundle),
    /source hash mismatch/,
  );
});
