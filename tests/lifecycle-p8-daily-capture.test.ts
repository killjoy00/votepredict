import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  buildOfflineP8DailyCapture,
  latestP8CaptureBeforeEvent,
  P8_DAILY_CAPTURE_SCHEMA,
  type P8DailyBillInput,
  type P8ObservedProcessEvent,
} from '../src/evaluation/lifecycle-p8-daily-capture.js';
import {
  verifyOfflineP8BatchIntegrity,
  writeOfflineP8DailyCapture,
} from '../src/evaluation/lifecycle-p8-offline-store.js';
import { LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256 } from '../src/evaluation/lifecycle-p8-prospective.js';

const ROOT_URL = 'https://www.revisor.mn.gov/bills/status?b=HF42';
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const CAPTURED = '2027-01-10T16:00:00.000Z';

function event(overrides: Partial<P8ObservedProcessEvent> = {}): P8ObservedProcessEvent {
  return {
    eventKey: 'committee',
    occurredOn: '2027-01-08',
    observedAt: '2027-01-08T20:00:00.000Z',
    chamber: 'house',
    stageKind: 'committee_referral',
    sourceUrl: ROOT_URL,
    sourceSha256: SHA_A,
    companionIdentifiers: [],
    ...overrides,
  };
}

function bill(overrides: Partial<P8DailyBillInput> = {}): P8DailyBillInput {
  return {
    billId: 'fixture-hf42',
    session: '2027-2028',
    chamber: 'house',
    identifier: 'HF42',
    introducedOn: '2027-01-06',
    adjournmentOn: '2028-05-20',
    firstObservedAt: '2027-01-07T15:00:00.000Z',
    sourceUrl: ROOT_URL,
    sourceSha256: SHA_A,
    process: {
      status: 'parsed',
      observedAt: '2027-01-08T20:00:00.000Z',
      parserVersion: 'revisor-process-v2',
      events: [
        event(),
        event({
          eventKey: 'floor',
          occurredOn: '2027-01-09',
          observedAt: '2027-01-09T20:00:00.000Z',
          stageKind: 'floor_scheduled',
          sourceSha256: SHA_B,
          companionIdentifiers: ['SF42'],
        }),
      ],
    },
    billVersions: [
      {
        id: 'version-zero', versionKey: '0', publishedOn: '2027-01-06',
        observedAt: '2027-01-07T15:00:00.000Z',
        sourceUrl: ROOT_URL, sourceSha256: SHA_A,
        textHash: 'zero-hash', textLengthChars: 1200,
      },
      {
        id: 'version-1', versionKey: '1', publishedOn: '2027-01-10',
        observedAt: '2027-01-10T16:00:00.000Z',
        sourceUrl: ROOT_URL, sourceSha256: SHA_C,
        textHash: 'later-hash', textLengthChars: 1400,
      },
    ],
    ...overrides,
  };
}

function make(cutoffDateExclusive = '2027-01-10',
  capturedAt = CAPTURED, bills: P8DailyBillInput[] = [bill()]) {
  return buildOfflineP8DailyCapture({ cutoffDateExclusive, capturedAt, bills });
}

test('offline P8 daily rows are deterministic, sorted, source lineaged and outcome-free', () => {
  const deferred = bill({
    billId: 'fixture-hf21', identifier: 'HF21',
    process: { status: 'source_deferred', observedAt: null, parserVersion: null, events: [] },
    billVersions: [],
  });
  const batch = make('2027-01-10', CAPTURED, [bill(), deferred]);
  assert.equal(batch.schemaVersion, P8_DAILY_CAPTURE_SCHEMA);
  assert.equal(batch.rows.length, 2);
  assert.deepEqual(batch.rows.map(row => row.bill.billId), ['fixture-hf21', 'fixture-hf42']);
  assert.equal(batch.frozenModelContentSha256Reference, LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256);
  assert.equal(batch.outcomeRead, false);
  assert.equal(batch.productionCaptureActivated, false);
  assert.equal(batch.predictionsComputed, false);
  assert.equal(batch.rows[0].features.lifecycleState, 'introduced');
  assert.equal(batch.rows[0].lineage.processSourceEligible, false);
  assert.equal(batch.rows[0].lineage.processParserVersion, null);
  const parsed = batch.rows[1];
  assert.equal(parsed.features.lifecycleState, 'floor_eligibility_or_scheduling');
  assert.equal(parsed.features.priorProcessEventCount, 2);
  assert.equal(parsed.features.priorProcessStageCounts.floor_scheduled, 1);
  assert.deepEqual(parsed.features.priorCompanionIdentifiers, ['SF42']);
  assert.equal(parsed.features.latestEligibleBillVersion?.versionKey, '0');
  assert.equal(parsed.features.authorship.reconstructable, false);
  assert.deepEqual(parsed.features.evidenceFamilyCounts, {});
  assert.equal(parsed.memberVoteLabel, null);
  assert.deepEqual(parsed.lineage.observedProcessSourceSha256, [SHA_A, SHA_B]);
  assert.equal(parsed.model.predictionsComputed, false);
  assert.equal(Object.hasOwn(parsed, 'targets'), false);
  assert.equal(Object.hasOwn(parsed, 'authoritativePassage'), false);
  assert.equal(JSON.stringify(batch).includes('eventualSourceChamberPassage'), false);
  assert.deepEqual(make('2027-01-10', CAPTURED, [deferred, bill()]), batch);
  verifyOfflineP8BatchIntegrity(batch);
});

test('same-day process and version observations are excluded regardless of intraday order', () => {
  const snapshot = make('2027-01-09', '2027-01-09T16:00:00.000Z').rows[0];
  assert.equal(snapshot.features.lifecycleState, 'committee_process_engagement');
  assert.equal(snapshot.features.priorProcessEventCount, 1);
  assert.equal(snapshot.features.priorProcessStageCounts.floor_scheduled, undefined);
  assert.equal(snapshot.features.latestEligibleBillVersion?.versionKey, '0');
  assert.deepEqual(snapshot.features.priorCompanionIdentifiers, []);
});

test('late-observed prior-dated events and versions do not backfill old daily rows', () => {
  const observation = bill({
    process: {
      status: 'parsed',
      observedAt: '2027-01-10T14:00:00.000Z',
      parserVersion: 'revisor-process-v2',
      events: [
        event({
          occurredOn: '2027-01-07',
          observedAt: '2027-01-10T14:00:00.000Z',
        }),
      ],
    },
    billVersions: [
      {
        id: 'late', versionKey: '0', publishedOn: '2027-01-07',
        observedAt: '2027-01-10T14:00:00.000Z',
        sourceUrl: ROOT_URL, sourceSha256: SHA_C,
        textHash: null, textLengthChars: 900,
      },
    ],
  });
  const today = make('2027-01-10', CAPTURED, [observation]).rows[0];
  assert.equal(today.lineage.processSourceEligible, false);
  assert.equal(today.features.lifecycleState, 'introduced');
  assert.equal(today.features.latestEligibleBillVersion, null);
  assert.deepEqual(today.lineage.observedProcessSourceSha256, []);
  const tomorrow = make('2027-01-11', '2027-01-11T16:00:00.000Z', [observation]).rows[0];
  assert.equal(tomorrow.lineage.processSourceEligible, true);
  assert.equal(tomorrow.features.lifecycleState, 'committee_process_engagement');
  assert.equal(tomorrow.features.latestEligibleBillVersion?.billVersionId, 'late');
  assert.equal(today.contentSha256, make('2027-01-10', CAPTURED, [observation]).rows[0].contentSha256);
});

test('same-day introductions and first-discovered bills are not retrospectively included', () => {
  const introducedToday = bill({
    introducedOn: '2027-01-10',
    firstObservedAt: '2027-01-10T14:00:00.000Z',
    process: { status: 'source_deferred', observedAt: null, parserVersion: null, events: [] },
    billVersions: [],
  });
  const firstFetchedToday = bill({
    billId: 'fixture-late', identifier: 'HF66',
    firstObservedAt: '2027-01-10T14:00:00.000Z',
  });
  assert.equal(make('2027-01-10', CAPTURED, [introducedToday, firstFetchedToday]).rows.length, 0);
  assert.equal(make('2027-01-11', '2027-01-11T16:00:00.000Z',
    [introducedToday, firstFetchedToday]).rows.length, 2);
});

test('no post-adjournment capture and no non-2027 cutoffs', () => {
  assert.equal(make('2028-05-21', '2028-05-21T16:00:00.000Z', [bill()]).rows.length, 0);
  assert.throws(() => make('2029-01-01', '2029-01-01T16:00:00.000Z'), /2027-2028/);
});

test('capture timestamp uses Chicago calendar date including spring DST transition', () => {
  assert.throws(() => make('2027-03-14', '2027-03-14T05:30:00.000Z'), /America\/Chicago/);
  assert.doesNotThrow(() => make('2027-03-14', '2027-03-14T06:30:00.000Z'));
  assert.doesNotThrow(() => make('2027-01-10', '2027-01-11T05:59:59.000Z'));
  assert.throws(() => make('2027-01-10', '2027-01-11T06:00:00.000Z'), /America\/Chicago/);
});

test('unknown and outcome-bearing fields fail closed before any artifact is produced', () => {
  assert.throws(() => make('2027-01-10', CAPTURED,
    [{ ...bill(), authoritativePassage: true } as P8DailyBillInput]), /unexpected field authoritativePassage/);
  assert.throws(() => make('2027-01-10', CAPTURED,
    [bill({ process: {
      ...bill().process, events: [
        { ...event(), outcome: true } as P8ObservedProcessEvent,
      ],
    } })]), /unexpected field outcome/);
  assert.throws(() => make('2027-01-10', CAPTURED,
    [bill({ process: {
      ...bill().process, events: [event({ stageKind: 'source_chamber_passage_action' })],
    } })]), /Terminal, outcome or unknown process stage/);
  assert.throws(() => make('2027-01-10', CAPTURED,
    [bill({ process: {
      ...bill().process, events: [event({ stageKind: 'session_expiration' })],
    } })]), /Terminal, outcome or unknown process stage/);
});

test('bad official-source provenance, duplicate bill identity, invalid dates and parser drift reject', () => {
  assert.throws(() => make('2027-01-10', CAPTURED,
    [bill({ sourceUrl: 'https://example.com/trick' })]), /official HTTPS Revisor/);
  assert.throws(() => make('2027-01-10', CAPTURED,
    [bill({ session: '2025-2026' as '2027-2028' })]), /Invalid P8 session/);
  assert.throws(() => make('2027-01-10', CAPTURED, [bill(), bill()]), /Duplicate bill/);
  assert.throws(() => make('2027-02-30', CAPTURED), /not a valid date/);
  assert.throws(() => make('2027-01-10', CAPTURED, [bill({
    process: {
      status: 'parsed', observedAt: '2027-01-09T17:00:00.000Z',
      parserVersion: 'unexpected-v3' as 'revisor-process-v2', events: [],
    },
  })]), /exact frozen parser/);
  assert.throws(() => make('2027-01-10', CAPTURED,
    [bill({ sourceSha256: 'not-a-hash' })]), /SHA-256 source hash/);
});

test('wrong-chamber dated actions cannot promote the original chamber state', () => {
  const crossChamber = bill({
    process: {
      status: 'parsed', observedAt: '2027-01-08T20:00:00.000Z',
      parserVersion: 'revisor-process-v2',
      events: [event({ chamber: 'senate', stageKind: 'floor_scheduled' })],
    },
  });
  assert.equal(make('2027-01-10', CAPTURED, [crossChamber]).rows[0].features.lifecycleState, 'introduced');
});

test('event-time selection uses the latest captured date strictly before a transition', () => {
  const d9 = make('2027-01-09', '2027-01-09T16:00:00.000Z').rows[0];
  const d10 = make('2027-01-10', CAPTURED).rows[0];
  assert.equal(latestP8CaptureBeforeEvent([d9, d10], 'fixture-hf42', '2027-01-10')?.rowId, d9.rowId);
  assert.equal(latestP8CaptureBeforeEvent([d9, d10], 'fixture-hf42', '2027-01-11')?.rowId, d10.rowId);
  assert.equal(latestP8CaptureBeforeEvent([d10], 'fixture-hf42', '2027-01-10'), null);
  assert.equal(latestP8CaptureBeforeEvent([d9], 'nonexistent', '2027-01-11'), null);
});

test('exclusive offline daily files are immutable, idempotent, and preserve first capture time', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vp-p8-offline-test-'));
  try {
    const original = make();
    const first = await writeOfflineP8DailyCapture(original, dir);
    assert.equal(first.result, 'created');
    const unchangedAtLaterTime = make('2027-01-10', '2027-01-10T19:00:00.000Z');
    assert.equal(unchangedAtLaterTime.contentSha256, original.contentSha256);
    const second = await writeOfflineP8DailyCapture(unchangedAtLaterTime, dir);
    assert.equal(second.result, 'already_present');
    const saved = JSON.parse(await readFile(first.filePath, 'utf8'));
    assert.equal(saved.capturedAt, CAPTURED);
    assert.equal(saved.contentSha256, original.contentSha256);
    assert.equal((await readdir(dir)).length, 1);

    const newLateSource = bill({
      billVersions: [...bill().billVersions, {
        id: 'late-yesterday', versionKey: '0a', publishedOn: '2027-01-08',
        observedAt: '2027-01-09T17:00:00.000Z',
        sourceUrl: ROOT_URL, sourceSha256: SHA_B,
        textHash: 'changed', textLengthChars: 1500,
      }],
    });
    await assert.rejects(() => writeOfflineP8DailyCapture(
      make('2027-01-10', CAPTURED, [newLateSource]), dir,
    ), /already exists with different as-of content/);
    const savedAgain = JSON.parse(await readFile(first.filePath, 'utf8'));
    assert.deepEqual(savedAgain, saved);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('simultaneous duplicate file writers cannot overwrite each other', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vp-p8-parallel-'));
  try {
    const values = await Promise.all([
      writeOfflineP8DailyCapture(make(), dir),
      writeOfflineP8DailyCapture(make(), dir),
    ]);
    assert.deepEqual(values.map(item => item.result).sort(), ['already_present', 'created']);
    assert.equal((await readdir(dir)).length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('tampered row/batch hash is rejected before any file is written', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vp-p8-integrity-'));
  try {
    const first = make();
    first.rows[0].features.priorProcessEventCount = 345;
    await assert.rejects(() => writeOfflineP8DailyCapture(first, dir), /row hash/);
    const second = make();
    second.contentSha256 = SHA_C;
    await assert.rejects(() => writeOfflineP8DailyCapture(second, dir), /batch hash/);
    assert.deepEqual(await readdir(dir), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('synthetic-only rehearsal CLI runs without external credentials or databases', () => {
  const output = execFileSync(process.execPath, [
    '--import', 'tsx', 'scripts/rehearse-lifecycle-p8-daily-capture.ts',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000,
  });
  const summary = JSON.parse(output) as {
    verdict: string;
    rows: number;
    firstWrite: string;
    secondWrite: string;
    productionCaptureActivated: boolean;
    outcomeRead: boolean;
    predictionsComputed: boolean;
    temporaryFilesRemoved: boolean;
  };
  assert.equal(summary.verdict, 'passed');
  assert.equal(summary.rows, 1);
  assert.equal(summary.firstWrite, 'created');
  assert.equal(summary.secondWrite, 'already_present');
  assert.equal(summary.productionCaptureActivated, false);
  assert.equal(summary.outcomeRead, false);
  assert.equal(summary.predictionsComputed, false);
  assert.equal(summary.temporaryFilesRemoved, true);
});
