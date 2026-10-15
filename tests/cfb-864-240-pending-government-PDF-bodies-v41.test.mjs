import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRemaining240, SCHEMA, LOG } from '../scripts/acquire-cfb-864-240-pending-government-pdf-bodies-v41.mjs';

test('V41 replays merged V40 and selects 240 distinct 2021–24 CFB government viewer versions', () => {
  assert.match(SCHEMA, /240/);
  assert.match(LOG, /CFB_864/);
  const rows = selectRemaining240();
  assert.equal(rows.length, 240);
  assert.equal(new Set(rows.map(x => x.id)).size, 240);
  assert.deepEqual(Object.fromEntries([2021, 2022, 2023, 2024].map(y =>
    [y, rows.filter(x => x.reportYear === y).length])),
    { 2021: 18, 2022: 115, 2023: 44, 2024: 63 });
  assert.equal(rows.some(x => x.reportYear === 2025), false);
  for (const x of rows) {
    assert.match(x.id, /^\d+:(21|22|23|24):pcc:(?:C|E|YE|S):[01]:\d+$/);
    assert.match(x.officialViewerSHA256, /^[a-f0-9]{64}$/);
    assert.equal(new URL(x.exactGovUrl).hostname, 'cfb.mn.gov');
    assert.equal(new URL(x.exactGovUrl).searchParams.get('regnum'), x.registration);
    assert.equal(Number(new URL(x.exactGovUrl).searchParams.get('amend')), x.amendment);
  }
});
