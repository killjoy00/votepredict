import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLifecycleSnapshotsForBill,
  deriveLifecycleState,
  lifecycleDateEligibleBeforeCutoff,
  type LifecycleP3BillInput,
  type LifecycleP3Event,
} from '../src/evaluation/lifecycle-p3-snapshot-dataset.js';

function event(input: Partial<LifecycleP3Event> & Pick<LifecycleP3Event, 'eventKey' | 'occurredOn' | 'stageKind'>): LifecycleP3Event {
  return {
    chamber: 'house',
    outcome: null,
    sourceUrl: 'https://example.test/status.xml',
    sourceDocumentId: input.eventKey,
    sourceContentSha256: `sha-${input.eventKey}`,
    parserVersion: 'revisor-process-v2',
    companionIdentifiers: [],
    ...input,
  };
}

function bill(overrides: Partial<LifecycleP3BillInput> = {}): LifecycleP3BillInput {
  return {
    billId: '00000000-0000-0000-0000-000000000042',
    sessionSlug: '2023-2024',
    chamber: 'house',
    identifier: 'HF42',
    introducedOn: '2023-01-10',
    adjournmentOn: '2024-05-20',
    authoritativePassage: false,
    passageLabelVersion: 'revisor-source-chamber-passage-v1',
    introductionParserVersion: 'revisor-introduction-v1',
    processParserVersion: 'revisor-process-v2',
    processAuditVersion: 'revisor-process-audit-v1',
    processStatus: 'parsed',
    processSourceUrl: 'https://example.test/status.xml',
    processContentSha256: 'process-sha',
    sourceChamberPassageOn: null,
    sourceChamberFailureOn: null,
    authorship: null,
    events: [
      event({ eventKey: 'committee', occurredOn: '2023-02-01', stageKind: 'committee_referral' }),
      event({ eventKey: 'second', occurredOn: '2023-03-01', stageKind: 'second_reading' }),
      event({ eventKey: 'calendar', occurredOn: '2023-03-01', stageKind: 'floor_scheduled' }),
      event({
        eventKey: 'expiration',
        occurredOn: '2024-05-20',
        stageKind: 'session_expiration',
        outcome: true,
      }),
    ],
    billVersions: [
      {
        id: 'version-zero',
        versionKey: '0',
        publishedOn: '2023-01-10',
        textHash: 'zero-hash',
        textLengthChars: 1200,
      },
    ],
    evidence: [
      { evidenceKind: 'official_statement', availableOn: '2023-02-01' },
    ],
    ...overrides,
  };
}

test('calendar-date cutoff excludes same-day information', () => {
  assert.equal(lifecycleDateEligibleBeforeCutoff('2023-02-01', '2023-02-01'), false);
  assert.equal(lifecycleDateEligibleBeforeCutoff('2023-01-31', '2023-02-01'), true);
});

test('lifecycle state uses only source-chamber events strictly before the cutoff', () => {
  const events = [
    event({ eventKey: 'committee', occurredOn: '2023-02-01', stageKind: 'committee_referral' }),
    event({ eventKey: 'senate-floor', occurredOn: '2023-02-15', stageKind: 'floor_scheduled', chamber: 'senate' }),
    event({ eventKey: 'second', occurredOn: '2023-03-01', stageKind: 'second_reading' }),
  ];
  assert.equal(deriveLifecycleState(events, 'house', '2023-02-01'), 'introduced');
  assert.equal(deriveLifecycleState(events, 'house', '2023-03-01'), 'committee_process_engagement');
  assert.equal(deriveLifecycleState(events, 'house', '2023-03-02'), 'floor_eligibility_or_scheduling');
});

test('same-day state transitions collapse to one leakage-safe event-time snapshot', () => {
  const snapshots = buildLifecycleSnapshotsForBill(bill());
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.cutoff.asOfDateExclusive),
    ['2023-01-10', '2023-02-01', '2023-03-01', '2024-05-20'],
  );

  const intro = snapshots[0];
  assert.equal(intro.features.latestEligibleBillVersion, null);

  const committee = snapshots[1];
  assert.equal(committee.features.lifecycleState, 'introduced');
  assert.equal(committee.features.evidenceFamilyCounts.official_statement, undefined);
  assert.equal(committee.features.latestEligibleBillVersion?.versionKey, '0');

  const floor = snapshots[2];
  assert.equal(floor.features.lifecycleState, 'committee_process_engagement');
  assert.deepEqual(floor.targets.transitionOnCutoffDate.stageKinds, ['floor_scheduled', 'second_reading']);
  assert.equal(floor.targets.transitionOnCutoffDate.toState, 'floor_eligibility_or_scheduling');
  assert.equal(floor.features.evidenceFamilyCounts.official_statement, 1);

  const terminal = snapshots[3];
  assert.equal(terminal.features.lifecycleState, 'floor_eligibility_or_scheduling');
  assert.equal(
    terminal.targets.transitionOnCutoffDate.terminalOutcome,
    'session_expired_without_source_chamber_passage',
  );
  assert.equal(terminal.targets.memberVoteLabel, null);
});

test('source-chamber passage creates a terminal lifecycle target without member labels', () => {
  const snapshots = buildLifecycleSnapshotsForBill(bill({
    authoritativePassage: true,
    sourceChamberPassageOn: '2023-04-10',
    events: [
      event({ eventKey: 'committee', occurredOn: '2023-02-01', stageKind: 'committee_referral' }),
    ],
  }));
  const terminal = snapshots.at(-1);
  assert.equal(terminal?.cutoff.asOfDateExclusive, '2023-04-10');
  assert.equal(terminal?.targets.terminalOutcome, 'source_chamber_passed');
  assert.equal(terminal?.targets.transitionOnCutoffDate.toState, 'source_chamber_passage_vote_reached');
  assert.equal(terminal?.targets.memberVoteLabel, null);
});
