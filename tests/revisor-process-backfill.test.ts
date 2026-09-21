import test from 'node:test';
import assert from 'node:assert/strict';
import { revisorProcessCandidateHasImpossiblePreIntroductionEvent, revisorProcessStatusUrls } from '../src/operations/revisor-process-backfill.js';

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


test('process backfill rejects procedural events that predate stored introduction', () => {
  assert.equal(
    revisorProcessCandidateHasImpossiblePreIntroductionEvent([
      {
        chamber: 'house',
        occurredOn: '2021-01-31',
        stageKind: 'committee_report',
        description: 'Committee report, to adopt as amended',
        companionIdentifiers: [],
      },
    ], '2021-05-14T12:00:00.000Z'),
    true,
  );
});

test('process backfill permits second-year procedural events after stored introduction', () => {
  assert.equal(
    revisorProcessCandidateHasImpossiblePreIntroductionEvent([
      {
        chamber: 'house',
        occurredOn: '2022-01-31',
        stageKind: 'committee_report',
        description: 'Committee report, to adopt as amended',
        companionIdentifiers: [],
      },
    ], '2021-05-14T12:00:00.000Z'),
    false,
  );
});

test('process backfill does not reject pre-introduction author metadata as a procedural stage', () => {
  assert.equal(
    revisorProcessCandidateHasImpossiblePreIntroductionEvent([
      {
        chamber: 'house',
        occurredOn: '2021-05-01',
        stageKind: 'author_added',
        description: 'Author added',
        companionIdentifiers: [],
      },
    ], '2021-05-14T12:00:00.000Z'),
    false,
  );
});
