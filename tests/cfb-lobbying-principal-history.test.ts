import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CFB_LOBBYING_PRINCIPAL_HISTORY_VERSION,
  cfbLobbyingPrincipalContentSha256,
  parseCfbLobbyingPrincipalCsv,
} from '../src/evidence/cfb-lobbying-principal-history.js';

test('parses official CFB principal lobbying expenditure columns', () => {
  const csv = [
    'Principal,Entity ID,Report Year,PUC lobbying amount,Legislative lobbying amount,Administrative lobbying amount,MGU lobbying amount,General lobbying amount,Total spent',
    '"Example Association",12345,2024,1000,"12,500",250,0,0,"13,750"',
    '"Older Principal",22222,2020,0,1,2,3,4,10',
  ].join('\n');

  const rows = parseCfbLobbyingPrincipalCsv(csv, { fromYear: 2021, toYear: 2026 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].principal, 'Example Association');
  assert.equal(rows[0].entityId, '12345');
  assert.equal(rows[0].reportYear, 2024);
  assert.equal(rows[0].legislativeLobbyingAmount, 12500);
  assert.equal(rows[0].totalSpent, 13750);
  assert.match(rows[0].rowKey, /^[a-f0-9]{64}$/);
  assert.equal(CFB_LOBBYING_PRINCIPAL_HISTORY_VERSION, 'mn-cfb-lobbying-principal-v1');
  assert.match(cfbLobbyingPrincipalContentSha256(rows), /^[a-f0-9]{64}$/);
});

test('rejects schema drift instead of silently remapping lobbying columns', () => {
  const csv = [
    'Principal,Entity ID,Report Year,Legislative lobbying amount,Total spent',
    'Example,123,2024,100,100',
  ].join('\n');
  assert.throws(() => parseCfbLobbyingPrincipalCsv(csv), /Unexpected CFB lobbying principal header/);
});

test('rejects malformed lobbying amounts', () => {
  const csv = [
    'Principal,Entity ID,Report Year,PUC lobbying amount,Legislative lobbying amount,Administrative lobbying amount,MGU lobbying amount,General lobbying amount,Total spent',
    'Example,123,2024,0,not-a-number,0,0,0,0',
  ].join('\n');
  assert.throws(() => parseCfbLobbyingPrincipalCsv(csv), /Invalid CFB lobbying amount/);
});
