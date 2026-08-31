import test from 'node:test';
import assert from 'node:assert/strict';
import billsHandler from '../api/bills.js';
import billTextHandler from '../api/bill-text.js';
import legislatorsHandler from '../api/legislators.js';
import predictHandler from '../api/predict.js';
import type { ApiRequest, ApiResponse } from '../src/types/http.js';
import {
  consumeRateLimit,
  isSameOriginRequest,
  resetRateLimitsForTests,
} from '../src/services/rateLimit.js';

class MockResponse {
  statusCode = 200;
  headers = new Map<string, string>();
  body: unknown;

  setHeader(name: string, value: string | number | readonly string[]) {
    this.headers.set(name.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value));
    return this;
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(body: unknown) {
    this.body = body;
    return this;
  }
}

function request(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    method: 'GET',
    headers: { host: 'votepredict.example', 'x-forwarded-for': `test-${Math.random()}` },
    query: {},
    body: undefined,
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  };
}

function response(): MockResponse & ApiResponse {
  return new MockResponse() as MockResponse & ApiResponse;
}

test('rate limiter blocks requests beyond a fixed window', () => {
  resetRateLimitsForTests();
  const rule = { maxRequests: 2, windowMs: 1_000 };

  assert.equal(consumeRateLimit('test', rule, 1_000).allowed, true);
  assert.equal(consumeRateLimit('test', rule, 1_100).allowed, true);
  const blocked = consumeRateLimit('test', rule, 1_200);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(consumeRateLimit('test', rule, 2_000).allowed, true);
});

test('same-origin check accepts the deployment host and rejects another site', () => {
  assert.equal(isSameOriginRequest(request({ headers: {
    host: 'votepredict.example',
    origin: 'https://votepredict.example',
  } })), true);
  assert.equal(isSameOriginRequest(request({ headers: {
    host: 'votepredict.example',
    origin: 'https://attacker.example',
  } })), false);
});

test('bill search validates method and query shape before upstream calls', async () => {
  const wrongMethod = response();
  await billsHandler(request({ method: 'POST' }), wrongMethod);
  assert.equal(wrongMethod.statusCode, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'GET');

  const arrayQuery = response();
  await billsHandler(request({ query: { q: ['HF 1', 'HF 2'] } }), arrayQuery);
  assert.equal(arrayQuery.statusCode, 400);

  const longQuery = response();
  await billsHandler(request({ query: { q: 'x'.repeat(121) } }), longQuery);
  assert.equal(longQuery.statusCode, 400);
});

test('bill text endpoint rejects non-Revisor URLs without fetching them', async () => {
  const res = response();
  await billTextHandler(request({ query: { url: 'https://attacker.example/bill' } }), res);
  assert.equal(res.statusCode, 400);
});

test('legislator API rejects unsupported chamber values', async () => {
  const res = response();
  await legislatorsHandler(request({ query: { chamber: 'executive' } }), res);
  assert.equal(res.statusCode, 400);
});

test('prediction API enforces JSON, same-origin requests, and bounded input', async () => {
  const missingType = response();
  await predictHandler(request({ method: 'POST', body: { billDescription: 'Test' } }), missingType);
  assert.equal(missingType.statusCode, 415);

  const crossOrigin = response();
  await predictHandler(request({
    method: 'POST',
    headers: {
      host: 'votepredict.example',
      origin: 'https://attacker.example',
      'content-type': 'application/json',
      'x-forwarded-for': 'cross-origin-test',
    },
    body: { billDescription: 'Test' },
  }), crossOrigin);
  assert.equal(crossOrigin.statusCode, 403);

  const missingDescription = response();
  await predictHandler(request({
    method: 'POST',
    headers: {
      host: 'votepredict.example',
      'content-type': 'application/json',
      'x-forwarded-for': 'missing-description-test',
    },
    body: {},
  }), missingDescription);
  assert.equal(missingDescription.statusCode, 400);

  const tooLong = response();
  await predictHandler(request({
    method: 'POST',
    headers: {
      host: 'votepredict.example',
      'content-type': 'application/json',
      'x-forwarded-for': 'long-description-test',
    },
    body: { billDescription: 'x'.repeat(12_001) },
  }), tooLong);
  assert.equal(tooLong.statusCode, 400);
});
