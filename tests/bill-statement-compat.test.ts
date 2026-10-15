import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractExplicitBillStatements } from '../src/evidence/bill-statement-extractor';
import { extractExplicitBillStatementsV3 } from '../src/evidence/bill-statement-extractor';
import { extractExplicitBillStatementsV4 } from '../src/evidence/bill-statement-extractor';
import type { ExtractBillStatementsInput } from '../src/evidence/bill-statement-extractor';

const fixtures = JSON.parse(readFileSync(resolve('tests/fixtures/bill-statement-compat-inputs.json'), 'utf8')) as
  { name: string; input: ExtractBillStatementsInput }[];
const expected = JSON.parse(readFileSync(resolve('tests/fixtures/bill-statement-compat-expected.json'), 'utf8')) as
  { name: string; baseline: { v2: unknown[]; v3: unknown[]; v4: unknown[] } }[];

const jsonRecords = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

test('all extractor baselines are immutable, complete, and pinned before consolidation', () => {
  assert.deepEqual(fixtures.map((row) => row.name), expected.map((row) => row.name));
  assert.equal(fixtures.length, 20);
  for (let i = 0; i < fixtures.length; i++) {
    const { input, name } = fixtures[i];
    assert.deepEqual(jsonRecords(extractExplicitBillStatements(input)), expected[i].baseline.v2, name + ' production v2');
    assert.deepEqual(jsonRecords(extractExplicitBillStatementsV3(input)), expected[i].baseline.v3, name + ' audit v3');
    assert.deepEqual(jsonRecords(extractExplicitBillStatementsV4(input)), expected[i].baseline.v4, name + ' audit v4');
  }
});
