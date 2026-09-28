import assert from 'node:assert/strict';
import test from 'node:test';
import { LboFiscalNoteSession } from '../src/evidence/lbo-fiscal-note-http.js';

test('retains official-source cookies between fiscal-note bill requests', async () => {
  const originalFetch = globalThis.fetch;
  const seenCookies: Array<string | null> = [];
  let call = 0;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seenCookies.push(headers.get('cookie'));
    call += 1;
    return new Response('<html><body>Record Count: 0</body></html>', {
      status: 200,
      headers: call === 1
        ? {
            'content-type': 'text/html; charset=utf-8',
            'set-cookie': 'lbo_session=abc123; Path=/; Secure; HttpOnly',
          }
        : { 'content-type': 'text/html; charset=utf-8' },
    });
  }) as typeof fetch;

  try {
    const session = new LboFiscalNoteSession();
    const first = await session.fetchBill({ billIdentifier: 'HF1', sessionStartYear: 2021 });
    const second = await session.fetchBill({ billIdentifier: 'HF2', sessionStartYear: 2021 });
    assert.equal(first.cookieCount, 1);
    assert.equal(second.cookieCount, 1);
    assert.deepEqual(seenCookies, [null, 'lbo_session=abc123']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects anti-bot or other redirects away from the fixed official endpoint', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(null, {
    status: 302,
    headers: { location: 'https://validate.perfdrive.com/challenge' },
  })) as typeof fetch;

  try {
    const session = new LboFiscalNoteSession();
    await assert.rejects(
      session.fetchBill({ billIdentifier: 'HF1', sessionStartYear: 2021 }),
      /left the fixed official LBO search endpoint/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
