import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import { Pool as PgPool } from 'pg';
import { pool as appPool } from '../src/lib/db/index.js';
import { ensureProspectiveEvidenceForecasts } from '../src/operations/prospective-evidence.js';
import { captureProspectivePassageFragilityShadows } from '../src/operations/passage-fragility-shadow-capture.js';

const url = process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;

test('2027 production-evidence seeding and passage-fragility shadow activate on eligible future bills', { skip: !url }, async (t) => {
  if (!['localhost', '127.0.0.1'].includes(new URL(url!).hostname)) {
    throw new Error('Prospective activation fixtures require local disposable PostgreSQL');
  }

  const db = new PgPool({ connectionString: url, max: 1 });
  const client = await db.connect();
  const schema = `prospective_activation_${process.pid}`;
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`
      CREATE TABLE legislative_sessions (
        id text PRIMARY KEY,
        slug text NOT NULL,
        is_current boolean NOT NULL DEFAULT false
      );
      CREATE TABLE chambers (
        id text PRIMARY KEY,
        slug text NOT NULL
      );
      CREATE TABLE bills (
        id text PRIMARY KEY,
        session_id text NOT NULL,
        originating_chamber_id text NOT NULL,
        identifier text NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}',
        status text,
        latest_action_at timestamptz,
        introduced_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE memberships (
        id text PRIMARY KEY,
        session_id text NOT NULL,
        chamber_id text NOT NULL,
        legislator_id text NOT NULL,
        party text
      );
      CREATE TABLE vote_events (
        id uuid PRIMARY KEY,
        bill_id text,
        chamber_id text NOT NULL,
        is_passage boolean NOT NULL,
        occurred_on date
      );
      CREATE TABLE legislative_stage_events (
        bill_id text NOT NULL,
        session_id text NOT NULL,
        stage_kind text NOT NULL
      );
      CREATE TABLE forecasts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id text NOT NULL,
        target_type text NOT NULL,
        target_kind text NOT NULL,
        conditional_on text,
        bill_id text,
        target_chamber_id text NOT NULL,
        session_id text NOT NULL,
        status text NOT NULL
      );
      CREATE TABLE forecast_schedules (
        forecast_id uuid PRIMARY KEY,
        enabled boolean NOT NULL,
        cadence_hours integer NOT NULL,
        research_mode text NOT NULL,
        next_run_at timestamptz NOT NULL
      );
      CREATE TABLE forecast_revisions (
        id uuid PRIMARY KEY,
        forecast_id uuid NOT NULL,
        model_version text,
        generated_at timestamptz,
        passage_probability double precision,
        metadata jsonb NOT NULL DEFAULT '{}',
        research_mode text NOT NULL
      );
      CREATE TABLE forecast_member_predictions (
        revision_id uuid NOT NULL,
        membership_id text NOT NULL,
        yes_probability double precision,
        facts jsonb NOT NULL DEFAULT '[]',
        context jsonb NOT NULL DEFAULT '[]'
      );
    `);

    await client.query(`
      INSERT INTO legislative_sessions(id, slug, is_current)
      VALUES ('s25', '2025-2026', false), ('s27', '2027-2028', true);
      INSERT INTO chambers(id, slug) VALUES ('house', 'house'), ('senate', 'senate');
      INSERT INTO memberships(id, session_id, chamber_id, legislator_id, party)
      VALUES ('m1', 's27', 'house', 'l1', 'A'), ('m2', 's27', 'house', 'l2', 'B');

      INSERT INTO bills(id, session_id, originating_chamber_id, identifier, metadata, status, introduced_at)
      VALUES
        ('eligible', 's27', 'house', 'HF1', '{"revisorUniverse":true,"revisorLiveStatus":{"currentVersionKind":"engrossment"}}', 'First engrossment', '2027-01-05'),
        ('passage-blocked', 's27', 'house', 'HF2', '{"revisorUniverse":true,"revisorLiveStatus":{"currentVersionKind":"engrossment","passageActionObserved":true}}', 'First engrossment', '2027-01-06'),
        ('not-engrossed', 's27', 'house', 'HF3', '{"revisorUniverse":true,"revisorLiveStatus":{"currentVersionKind":"introduced"}}', 'Introduced', '2027-01-07'),
        ('old-session', 's25', 'house', 'HF4', '{"revisorUniverse":true,"revisorLiveStatus":{"currentVersionKind":"engrossment"}}', 'First engrossment', '2026-01-07');
    `);

    const appClient = {
      query: client.query.bind(client),
      release() {},
    };
    t.mock.method(appPool, 'connect', async () => appClient as any);

    const seeded = await ensureProspectiveEvidenceForecasts();
    assert.equal(seeded.session, '2027-2028');
    assert.equal(seeded.seededForecasts, 1);
    assert.deepEqual(seeded.forecasts.map((row) => row.identifier), ['HF1']);

    const scheduled = await client.query(`
      SELECT f.owner_user_id, f.target_kind, fs.enabled, fs.cadence_hours, fs.research_mode
        FROM forecasts f
        JOIN forecast_schedules fs ON fs.forecast_id = f.id
       WHERE f.bill_id = 'eligible'
    `);
    assert.equal(scheduled.rows.length, 1);
    assert.equal(scheduled.rows[0].owner_user_id, 'system:prospective-evidence-v1');
    assert.equal(scheduled.rows[0].target_kind, 'house_floor_passage');
    assert.equal(scheduled.rows[0].enabled, true);
    assert.equal(scheduled.rows[0].cadence_hours, 24);
    assert.equal(scheduled.rows[0].research_mode, 'quick');

    const reseed = await ensureProspectiveEvidenceForecasts();
    assert.equal(reseed.seededForecasts, 0);

    const forecast = await client.query<{ id: string }>(`
      INSERT INTO forecasts(owner_user_id, target_type, target_kind, conditional_on, bill_id, target_chamber_id, session_id, status)
      VALUES ('owner', 'bill', 'house_floor_passage', 'a House floor vote', 'eligible', 'house', 's27', 'active')
      RETURNING id::text
    `);
    const forecastId = forecast.rows[0].id;
    const revisionId = '20000000-0000-0000-0000-000000000001';
    await client.query(`
      INSERT INTO forecast_revisions(id, forecast_id, model_version, generated_at, passage_probability, metadata, research_mode)
      VALUES ($1::uuid, $2::uuid, 'member-eb-v1.2-decay180', '2027-02-01T12:00:00Z', 0.55,
        '{"passageRule":{"kind":"fixed","requiredYes":1},"analogue":{"selected":[]}}', 'quick')
    `, [revisionId, forecastId]);
    await client.query(`
      INSERT INTO forecast_member_predictions(revision_id, membership_id, yes_probability, facts)
      VALUES
        ($1::uuid, 'm1', 0.65, '[]'),
        ($1::uuid, 'm2', 0.35, '[]')
    `, [revisionId]);

    const rehearsalPool = { query: client.query.bind(client) } as unknown as Pool;
    const captured = await captureProspectivePassageFragilityShadows(rehearsalPool);
    assert.equal(captured.productionAction, 'none');
    assert.equal(captured.eligibleRevisions, 1);
    assert.equal(captured.capturedRevisions, 1);

    const revision = await client.query(`
      SELECT metadata->'passageFragilityShadow' AS shadow
        FROM forecast_revisions
       WHERE id = $1::uuid
    `, [revisionId]);
    const shadow = revision.rows[0].shadow;
    assert.equal(shadow.version, 'passage-fragility-shadow-v1');
    assert.equal(shadow.prospectiveScope.session, '2027-2028');
    assert.equal(shadow.prospectiveScope.servingMemberModelVersion, 'member-eb-v1.2-decay180');
    assert.equal(shadow.servesTraffic, false);
    assert.equal(shadow.outcomeUseAtCapture, 'none');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => undefined);
    client.release();
    await db.end();
  }
});
