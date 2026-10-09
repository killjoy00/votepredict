/**
 * Synthetic, no-credentials proof of immutable P8 daily capture.
 *
 * This script cannot read the application database or make a real 2027 capture.
 * It intentionally writes one fixture day to a disposable OS temp directory,
 * checks repeatability and removes all temporary files on exit.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildOfflineP8DailyCapture, type P8DailyBillInput } from
  '../src/evaluation/lifecycle-p8-daily-capture.js';
import { writeOfflineP8DailyCapture } from
  '../src/evaluation/lifecycle-p8-offline-store.js';

const officialUrl = 'https://www.revisor.mn.gov/bills/status?b=HF123';
const sourceHash = 'a'.repeat(64);
const bill: P8DailyBillInput = {
  billId: 'synthetic-hf123',
  session: '2027-2028',
  chamber: 'house',
  identifier: 'HF123',
  introducedOn: '2027-01-06',
  adjournmentOn: '2028-05-20',
  firstObservedAt: '2027-01-07T18:00:00.000Z',
  sourceUrl: officialUrl,
  sourceSha256: sourceHash,
  process: {
    status: 'parsed',
    observedAt: '2027-01-08T16:00:00.000Z',
    parserVersion: 'revisor-process-v2',
    events: [
      {
        eventKey: 'synthetic-referral',
        occurredOn: '2027-01-08',
        observedAt: '2027-01-08T16:00:00.000Z',
        chamber: 'house',
        stageKind: 'committee_referral',
        sourceUrl: officialUrl,
        sourceSha256: sourceHash,
        companionIdentifiers: [],
      },
    ],
  },
  billVersions: [{
    id: 'synthetic-version-zero',
    versionKey: '0',
    publishedOn: '2027-01-06',
    observedAt: '2027-01-07T18:00:00.000Z',
    sourceUrl: officialUrl,
    sourceSha256: sourceHash,
    textHash: null,
    textLengthChars: 640,
  }],
};

async function main() {
  if (process.argv.length > 2) {
    throw new Error('This is a fixed synthetic rehearsal; no real inputs or source locations accepted');
  }
  const folder = await mkdtemp(join(tmpdir(), 'vp-p8-synthetic-'));
  try {
    const input = { cutoffDateExclusive: '2027-01-10', capturedAt: '2027-01-10T16:00:00.000Z', bills: [bill] };
    const batch = buildOfflineP8DailyCapture(input);
    const first = await writeOfflineP8DailyCapture(batch, folder);
    const second = await writeOfflineP8DailyCapture(
      buildOfflineP8DailyCapture({ ...input, capturedAt: '2027-01-10T19:00:00.000Z' }),
      folder,
    );
    const stored = JSON.parse(await readFile(first.filePath, 'utf8'));
    assert.equal(first.result, 'created');
    assert.equal(second.result, 'already_present');
    assert.equal(stored.capturedAt, input.capturedAt);
    assert.equal(batch.rows.length, 1);
    assert.equal(batch.rows[0].features.lifecycleState, 'committee_process_engagement');
    assert.equal(batch.productionCaptureActivated, false);
    assert.equal(batch.outcomeRead, false);
    assert.equal(batch.predictionsComputed, false);
    console.log(JSON.stringify({
      rehearsal: 'synthetic P8 as-of daily capture',
      verdict: 'passed',
      session: batch.session,
      cutoffDateExclusive: batch.cutoffDateExclusive,
      rows: batch.rows.length,
      firstWrite: first.result,
      secondWrite: second.result,
      contentSha256: batch.contentSha256,
      productionCaptureActivated: batch.productionCaptureActivated,
      outcomeRead: batch.outcomeRead,
      predictionsComputed: batch.predictionsComputed,
      temporaryFilesRemoved: true,
    }));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
