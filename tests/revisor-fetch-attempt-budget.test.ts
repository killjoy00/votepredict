import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchRevisorStatusXml,
  revisorFetchAttemptBudget,
} from '../src/sources/minnesota/revisor-actions.js';

const OVERRIDE = 'VOTEPREDICT_REVISOR_FETCH_ATTEMPTS';

function restoreEnv(previous: string | undefined): void {
  if (previous === undefined) delete process.env[OVERRIDE];
  else process.env[OVERRIDE] = previous;
}

test('Revisor fetch attempt budget defaults to five', () => {
  const previous = process.env[OVERRIDE];
  delete process.env[OVERRIDE];
  try {
    assert.equal(revisorFetchAttemptBudget(), 5);
  } finally {
    restoreEnv(previous);
  }
});

test('direct backfill can cap an individual Revisor year candidate at one attempt', async () => {
  const previous = process.env[OVERRIDE];
  const originalFetch = globalThis.fetch;
  let calls = 0;
  process.env[OVERRIDE] = '1';
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response('temporary failure', { status: 500, headers: { 'retry-after': '0' } });
  }) as typeof fetch;

  try {
    assert.equal(revisorFetchAttemptBudget(), 1);
    await assert.rejects(
      fetchRevisorStatusXml('https://api.revisor.mn.gov/bills/v1/92/2021/0/HF/2665/'),
      /returned 500/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(previous);
  }
});

test('malformed Revisor HTML is retried before it can become a source exclusion', async () => {
  const previous = process.env[OVERRIDE];
  const originalFetch = globalThis.fetch;
  let calls = 0;
  process.env[OVERRIDE] = '2';
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response('<!doctype html><html><body>temporary upstream page</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    }
    return new Response('<?xml version="1.0"?><BILL><ACTIONS /></BILL>', {
      status: 200,
      headers: { 'content-type': 'text/xml' },
    });
  }) as typeof fetch;

  try {
    const xml = await fetchRevisorStatusXml('https://api.revisor.mn.gov/bills/v1/93/2024/0/HF/3769/');
    assert.match(xml, /<BILL>/);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(previous);
  }
});

test('invalid Revisor attempt overrides preserve the five-attempt default', () => {
  const previous = process.env[OVERRIDE];
  try {
    for (const value of ['0', '6', 'not-a-number']) {
      process.env[OVERRIDE] = value;
      assert.equal(revisorFetchAttemptBudget(), 5);
    }
  } finally {
    restoreEnv(previous);
  }
});
