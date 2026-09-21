import test from 'node:test';
import assert from 'node:assert/strict';
import { revisorProcessStatusUrls } from '../src/operations/revisor-process-backfill.js';

test('process backfill derives both regular-session Revisor status URLs without stored source metadata', () => {
  assert.deepEqual(
    revisorProcessStatusUrls('2023-2024', 'HF42', null),
    [
      'https://api.revisor.mn.gov/bills/v1/93/2023/0/HF/42/',
      'https://api.revisor.mn.gov/bills/v1/93/2024/0/HF/42/',
    ],
  );
});

test('process backfill tries stored official source first and deduplicates derived matches', () => {
  const stored = 'https://api.revisor.mn.gov/bills/v1/94/2025/0/SF/10/';
  assert.deepEqual(
    revisorProcessStatusUrls('2025-2026', 'SF10', stored),
    [
      stored,
      'https://api.revisor.mn.gov/bills/v1/94/2026/0/SF/10/',
    ],
  );
});
