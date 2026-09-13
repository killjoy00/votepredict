import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePgSslMode } from '../src/lib/db/connection-string.js';

test('normalizes pg 8 compatibility SSL modes to explicit verify-full', () => {
  for (const sslmode of ['prefer', 'require', 'verify-ca', 'REQUIRE']) {
    assert.equal(
      normalizePgSslMode(`postgresql://user:p%40ss@host.example/db?sslmode=${sslmode}&channel_binding=require`),
      'postgresql://user:p%40ss@host.example/db?sslmode=verify-full&channel_binding=require',
    );
  }
});

test('leaves already-explicit and intentionally different SSL modes unchanged', () => {
  const values = [
    'postgresql://user:pass@host.example/db?sslmode=verify-full',
    'postgresql://user:pass@host.example/db?sslmode=disable',
    'postgresql://user:pass@host.example/db',
  ];

  for (const value of values) assert.equal(normalizePgSslMode(value), value);
  assert.equal(normalizePgSslMode('  postgresql://user:pass@host.example/db?sslmode=require  '), 'postgresql://user:pass@host.example/db?sslmode=verify-full');
  assert.equal(normalizePgSslMode(undefined), undefined);
});
