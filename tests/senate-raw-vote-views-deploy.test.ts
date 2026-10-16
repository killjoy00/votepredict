import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

test('Senate flat SQL is only three replaceable read-only views with existing crosswalks', () => {
  const sql = readFileSync('migrations/0024_senate_raw_vote_views.sql', 'utf8');
  assert.equal((sql.match(/CREATE OR REPLACE VIEW public\./g) ?? []).length, 3);
  for (const view of ['senate_raw_vote_records_v','senate_raw_member_votes_v','senate_vote_trail_v'])
    assert.match(sql, new RegExp('CREATE OR REPLACE VIEW public\\.' + view + ' AS'));
  assert.match(sql, /jsonb_array_elements\(/);
  assert.match(sql, /WITH ORDINALITY/);
  assert.match(sql, /voter\.position - 1/);
  assert.match(sql, /rec\.item->>'ordinal'/);
  assert.match(sql, /role = 'mover'/);
  assert.match(sql, /role = 'voter'/);
  assert.match(sql, /bill_companions/);
  assert.match(sql, /vote_events/);
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE|INSERT|UPDATE|DELETE|CREATE TABLE|MATERIALIZED)\b/i);
});

test('One-shot production route pins marker, migration, keyless main gate, no schedule', () => {
  const script = readFileSync('scripts/deploy-senate-raw-vote-views-neon.ts', 'utf8');
  const workflow = readFileSync('.github/workflows/senate-raw-vote-views-production.yml', 'utf8');
  assert.match(script, /SENATE_RAW_VOTE_VIEWS_PRODUCTION/);
  assert.match(script, /EXPECTED_COUNT = 24/);
  assert.match(script, /discoverExistingVotePredictNeonConnection/);
  assert.match(script, /check-production-migration-drift\.ts/);
  assert.match(script, /REPEATABLE READ READ ONLY/);
  assert.match(script, /ROLLBACK/);
  assert.match(script, /GITHUB_RUN_ATTEMPT !== '1'/);
  assert.match(workflow, /needs\.independent-main\.result == 'success'/);
  assert.match(workflow, /environment: evidence-readonly-sandbox/);
  assert.match(workflow, /contains\(github\.event\.head_commit\.message, 'SENATE_RAW_VOTE_VIEWS_PRODUCTION'\)/);
  assert.doesNotMatch(workflow, /^\s*(schedule:|cron:|workflow_dispatch:)/m);
  assert.doesNotMatch(workflow, /pull_request_target/);
});
