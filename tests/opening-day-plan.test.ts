import test from 'node:test';
import assert from 'node:assert/strict';
import { assessOpeningDaySources, OPENING_DAY_SESSION } from '../src/operations/opening-day-plan.js';

test('2027 Opening Day readiness stays informational before the biennium starts', () => {
  const result = assessOpeningDaySources({
    checkedAt: new Date('2026-09-17T12:00:00Z'),
    lrlLegislatorRefs: 0,
    revisorHouseBillsInFirst500: 0,
    revisorSenateBillsInFirst500: 0,
  });
  assert.equal(result.session, OPENING_DAY_SESSION);
  assert.equal(result.legislature, 95);
  assert.equal(result.sessionStarted, false);
  assert.equal(result.readyForLiveBootstrap, false);
  assert.equal(result.failClosed, false);
  assert.equal(result.blockers.length, 3);
});

test('prestart source probe failures remain visible without failing the production job', () => {
  const result = assessOpeningDaySources({
    checkedAt: new Date('2026-09-17T12:00:00Z'),
    lrlLegislatorRefs: 0,
    revisorHouseBillsInFirst500: 0,
    revisorSenateBillsInFirst500: 0,
    sourceErrors: ['Minnesota Revisor House probe failed: future session unavailable'],
  });
  assert.equal(result.sessionStarted, false);
  assert.equal(result.failClosed, false);
  assert.deepEqual(result.sourceErrors, ['Minnesota Revisor House probe failed: future session unavailable']);
  assert.equal(result.blockers.length, 4);
});

test('2027 Opening Day readiness fails closed after start when authoritative sources are incomplete', () => {
  const result = assessOpeningDaySources({
    checkedAt: new Date('2027-01-12T12:00:00Z'),
    lrlLegislatorRefs: 189,
    revisorHouseBillsInFirst500: 1,
    revisorSenateBillsInFirst500: 0,
  });
  assert.equal(result.sessionStarted, true);
  assert.equal(result.lrl.rosterExposed, false);
  assert.equal(result.revisor.billsExposed, true);
  assert.equal(result.readyForLiveBootstrap, false);
  assert.equal(result.failClosed, true);
});

test('2027 Opening Day readiness clears only when roster and live bills are both exposed', () => {
  const result = assessOpeningDaySources({
    checkedAt: new Date('2027-01-05T12:00:00Z'),
    lrlLegislatorRefs: 201,
    revisorHouseBillsInFirst500: 42,
    revisorSenateBillsInFirst500: 38,
  });
  assert.equal(result.termStarted, true);
  assert.equal(result.sessionStarted, false);
  assert.equal(result.lrl.rosterExposed, true);
  assert.equal(result.revisor.billsExposed, true);
  assert.equal(result.readyForLiveBootstrap, true);
  assert.equal(result.failClosed, false);
  assert.deepEqual(result.blockers, []);
});

test('prefiled bills and a full search index cannot activate a roster before the Minnesota term starts', () => {
  const source = { lrlLegislatorRefs: 201, revisorHouseBillsInFirst500: 42, revisorSenateBillsInFirst500: 38 };
  const before = assessOpeningDaySources({ ...source, checkedAt: new Date('2027-01-04T05:59:59Z') });
  assert.equal(before.termStarted, false);
  assert.equal(before.readyForLiveBootstrap, false);
  assert.equal(before.failClosed, false);
  const after = assessOpeningDaySources({ ...source, checkedAt: new Date('2027-01-04T06:00:00Z') });
  assert.equal(after.termStarted, true);
  assert.equal(after.readyForLiveBootstrap, true);
  assert.equal(after.sessionStarted, false);
  const missing = { ...source, lrlLegislatorRefs: 0 };
  assert.equal(assessOpeningDaySources({ ...missing, checkedAt: new Date('2027-01-12T05:59:59Z') }).failClosed, false);
  assert.equal(assessOpeningDaySources({ ...missing, checkedAt: new Date('2027-01-12T06:00:00Z') }).failClosed, true);
});
