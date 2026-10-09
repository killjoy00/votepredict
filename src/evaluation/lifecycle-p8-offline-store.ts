/**
 * Immutable local-file proof of the P8 daily-capture storage semantics.
 * Offline only. No database, network, object store, forecast endpoint or cron.
 */
import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  P8_DAILY_CAPTURE_SCHEMA,
  type P8DailyCaptureBatch,
  type P8DailyCaptureRow,
} from './lifecycle-p8-daily-capture';

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function verifyOfflineP8BatchIntegrity(batch: P8DailyCaptureBatch): void {
  if (batch.schemaVersion !== P8_DAILY_CAPTURE_SCHEMA ||
    batch.session !== '2027-2028' ||
    batch.outcomeRead !== false ||
    batch.productionCaptureActivated !== false ||
    batch.servingChanged !== false ||
    batch.predictionsComputed !== false ||
    !Array.isArray(batch.rows)) {
    throw new Error('Invalid or unexpectedly activated offline P8 capture');
  }
  let previous = '';
  for (const row of batch.rows) {
    const { contentSha256, ...content } = row;
    if (row.schemaVersion !== P8_DAILY_CAPTURE_SCHEMA ||
      row.cutoff.asOfDateExclusive !== batch.cutoffDateExclusive ||
      row.memberVoteLabel !== null ||
      contentSha256 !== sha256(content)) {
      throw new Error('Invalid or modified immutable P8 row hash');
    }
    if (previous && row.bill.billId.localeCompare(previous) <= 0) {
      throw new Error('Daily rows must be unique and deterministically ordered');
    }
    previous = row.bill.billId;
  }
  const { contentSha256, capturedAt: _firstTime, ...immutableContent } = batch;
  if (contentSha256 !== sha256(immutableContent)) {
    throw new Error('Invalid or modified immutable P8 batch hash');
  }
}

export interface P8OfflineCaptureWrite {
  filePath: string;
  result: 'created' | 'already_present';
  contentSha256: string;
  rowCount: number;
}

/**
 * Atomic publication using exclusive hard-link creation on one local filesystem.
 * Repeating identical as-of rows is idempotent even if capturedAt differs.
 * Late discoveries *never* rewrite yesterday's rows; a conflicting replay fails.
 */
export async function writeOfflineP8DailyCapture(
  batch: P8DailyCaptureBatch,
  outputDir: string,
): Promise<P8OfflineCaptureWrite> {
  verifyOfflineP8BatchIntegrity(batch);
  const folder = resolve(outputDir);
  await mkdir(folder, { recursive: true });
  const filePath = join(folder, 'lifecycle-p8-' + batch.cutoffDateExclusive + '.json');
  const payload = JSON.stringify(batch, null, 2) + '\n';
  const tempPath = join(folder, '.' + batch.cutoffDateExclusive + '-' + randomUUID() + '.tmp');
  await writeFile(tempPath, payload, { flag: 'wx', mode: 0o600 });
  try {
    try {
      await link(tempPath, filePath);
      return {
        filePath,
        result: 'created',
        contentSha256: batch.contentSha256,
        rowCount: batch.rows.length,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const existingText = await readFile(filePath, 'utf8');
      const existing = JSON.parse(existingText) as P8DailyCaptureBatch;
      verifyOfflineP8BatchIntegrity(existing);
      if (existing.contentSha256 !== batch.contentSha256) {
        throw new Error('Immutable P8 day already exists with different as-of content: ' +
          batch.cutoffDateExclusive);
      }
      return {
        filePath,
        result: 'already_present',
        contentSha256: existing.contentSha256,
        rowCount: existing.rows.length,
      };
    }
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}
