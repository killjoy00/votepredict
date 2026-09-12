import assert from 'node:assert/strict';
import test from 'node:test';
import {
  requireEvaluationDatabaseConnection,
  resolveEvaluationDatabaseConnection,
} from '../src/operations/evaluation-database.js';

test('evaluation jobs prefer the same pooled production URL used by the application', () => {
  const connection = requireEvaluationDatabaseConnection({
    DATABASE_URL: ' postgres://pooled.example/db ',
    POSTGRES_URL: 'postgres://fallback.example/db',
    DATABASE_URL_UNPOOLED: 'postgres://base/db',
    POSTGRES_URL_NON_POOLING: 'postgres://nonpool.example/db',
  });

  assert.equal(connection.source, 'DATABASE_URL');
  assert.equal(connection.connectionString, 'postgres://pooled.example/db');
});

test('evaluation jobs fall through production connection candidates in order', () => {
  assert.equal(resolveEvaluationDatabaseConnection({ POSTGRES_URL: 'postgres://postgres/db' })?.source, 'POSTGRES_URL');
  assert.equal(resolveEvaluationDatabaseConnection({ DATABASE_URL_UNPOOLED: 'postgres://unpooled/db' })?.source, 'DATABASE_URL_UNPOOLED');
  assert.equal(resolveEvaluationDatabaseConnection({ POSTGRES_URL_NON_POOLING: 'postgres://nonpool/db' })?.source, 'POSTGRES_URL_NON_POOLING');
});

test('blank database variables do not shadow a valid fallback', () => {
  const connection = requireEvaluationDatabaseConnection({
    DATABASE_URL: '   ',
    POSTGRES_URL: '',
    DATABASE_URL_UNPOOLED: ' postgres://valid.example/db ',
  });
  assert.equal(connection.source, 'DATABASE_URL_UNPOOLED');
  assert.equal(connection.connectionString, 'postgres://valid.example/db');
});

test('missing evaluation database configuration fails closed', () => {
  assert.equal(resolveEvaluationDatabaseConnection({}), undefined);
  assert.throws(() => requireEvaluationDatabaseConnection({}), /Evaluation database connection is required/);
});
