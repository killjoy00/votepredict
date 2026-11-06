import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const retired = [
  'senate-evidence-repair-production.yml',
  'senate-paper-history-production.yml',
  'senate-official-bill-text-production.yml',
  'senate-official-bill-text-watchdog.yml',
  'source-expansion-cfb-candidate-finance-watchdog.yml',
];

test('retired Senate recovery and collector workflows have no recurring schedules', () => {
  for (const name of retired) {
    const yaml = readFileSync('.github/workflows/' + name, 'utf8');
    assert.doesNotMatch(yaml, /^  schedule:/m, name);
    assert.doesNotMatch(yaml, /^\s*- cron:/m, name);
  }
});

test('retired watchdogs only run from explicit workflow dispatch', () => {
  for (const name of [
    'senate-official-bill-text-watchdog.yml',
    'source-expansion-cfb-candidate-finance-watchdog.yml',
  ]) {
    const yaml = readFileSync('.github/workflows/' + name, 'utf8');
    assert.match(yaml, /^  workflow_dispatch:/m, name);
    assert.doesNotMatch(yaml, /^  push:/m, name);
    assert.doesNotMatch(yaml, /^  pull_request:/m, name);
  }
});
