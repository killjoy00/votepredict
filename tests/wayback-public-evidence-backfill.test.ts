import test from 'node:test';
import assert from 'node:assert/strict';
import { selectWaybackEvidenceCaptures,sessionArchiveWindow } from '../src/evidence/wayback-public-evidence-backfill.js';

test('Wayback selection prioritizes issue/news pages and limits yearly duplicates',()=>{
  const capture=(timestamp:string,original:string)=>({timestamp,original,mimetype:'text/html',statuscode:'200',digest:timestamp,length:100,capturedAt:timestamp.slice(0,4)+'-'+timestamp.slice(4,6)+'-'+timestamp.slice(6,8)+'T00:00:00.000Z',archiveUrl:'https://web.archive.org/'+timestamp}) as any;
  const rows=selectWaybackEvidenceCaptures([
    capture('20240101000000','https://x.test/random'),
    capture('20240201000000','https://x.test/issues/health'),
    capture('20240301000000','https://x.test/issues/health'),
    capture('20250101000000','https://x.test/news/a'),
  ],{maxCaptures:3});
  assert.equal(rows.length,3);
  assert.ok(rows.some(row=>row.original.includes('/issues/health')));
  assert.ok(rows.some(row=>row.original.includes('/news/a')));
  assert.equal(rows.filter(row=>row.original.includes('/issues/health')).length,1);
});

test('archive windows include lead-in year but end with biennium',()=>{
  assert.deepEqual(sessionArchiveWindow('2021-2022'),{from:'20200101',to:'20221231'});
  assert.deepEqual(sessionArchiveWindow('2025-2026'),{from:'20240101',to:'20261231'});
});
