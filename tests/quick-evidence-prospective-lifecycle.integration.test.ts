import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool as PgPool } from 'pg';
import { pool as appPool } from '../src/lib/db/index.js';
import {
  captureQuickEvidenceShadow,
  QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT,
} from '../src/forecasting/quick-evidence-shadow.js';
import type {
  ForecastRuntimeRequest,
  ForecastRuntimeResult,
} from '../src/forecasting/runtime.js';
import { resolveSafeForecastOutcome } from '../src/operations/safe-resolution.js';
import {
  getQuickEvidenceProspectiveScorecard,
} from '../src/operations/quick-evidence-prospective-scorecard.js';

const url = process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;

test('Quick prospective lifecycle rehearses capture, resolution, and sealed paired scoring', { skip: !url }, async (t) => {
  if (!['localhost', '127.0.0.1'].includes(new URL(url!).hostname)) {
    throw new Error('Quick lifecycle rehearsal requires local disposable PostgreSQL');
  }

  const db = new PgPool({ connectionString: url, max: 1 });
  const client = await db.connect();
  const schema = 'quick_lifecycle_' + process.pid;
  try {
    await client.query('CREATE SCHEMA ' + schema);
    await client.query('SET search_path TO ' + schema);
    await client.query(`
      CREATE TABLE legislative_sessions (
        id uuid PRIMARY KEY,
        slug text NOT NULL,
        starts_on date
      );
      CREATE TABLE chambers (
        id uuid PRIMARY KEY,
        slug text NOT NULL,
        name text NOT NULL
      );
      CREATE TABLE bills (
        id uuid PRIMARY KEY,
        session_id uuid NOT NULL,
        identifier text NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}'
      );
      CREATE TABLE memberships (
        id uuid PRIMARY KEY,
        session_id uuid NOT NULL,
        chamber_id uuid NOT NULL,
        legislator_id uuid NOT NULL,
        party text
      );
      CREATE TABLE source_documents (
        id uuid PRIMARY KEY,
        source_kind text NOT NULL,
        fetched_at timestamptz NOT NULL
      );
      CREATE TABLE evidence_items (
        id uuid PRIMARY KEY,
        source_document_id uuid NOT NULL,
        membership_id uuid,
        bill_id uuid,
        evidence_kind text NOT NULL,
        stance text,
        source_quality text NOT NULL,
        relevance text NOT NULL,
        freshness text NOT NULL,
        confidence double precision,
        published_at timestamptz,
        metadata jsonb NOT NULL DEFAULT '{}'
      );
      CREATE TABLE evidence_relationships (
        to_evidence_id uuid NOT NULL,
        relation_kind text NOT NULL
      );
      CREATE TABLE vote_events (
        id uuid PRIMARY KEY,
        session_id uuid NOT NULL,
        chamber_id uuid NOT NULL,
        bill_id uuid,
        is_passage boolean NOT NULL,
        vote_kind text NOT NULL,
        occurred_on date NOT NULL,
        passed boolean,
        yea_count integer NOT NULL,
        nay_count integer NOT NULL DEFAULT 0
      );
      CREATE TABLE member_votes (
        vote_event_id uuid NOT NULL,
        membership_id uuid NOT NULL,
        choice text NOT NULL
      );
      CREATE TABLE forecasts (
        id uuid PRIMARY KEY,
        owner_user_id text NOT NULL,
        target_type text NOT NULL,
        target_kind text NOT NULL,
        bill_id uuid,
        target_chamber_id uuid NOT NULL,
        session_id uuid NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE forecast_revisions (
        id uuid PRIMARY KEY,
        forecast_id uuid NOT NULL,
        revision_number integer NOT NULL,
        research_mode text NOT NULL,
        model_version text,
        generated_at timestamptz,
        metadata jsonb NOT NULL DEFAULT '{}',
        passage_probability double precision,
        expected_yes double precision
      );
      CREATE TABLE forecast_member_predictions (
        revision_id uuid NOT NULL,
        membership_id uuid NOT NULL,
        yes_probability double precision,
        context jsonb NOT NULL DEFAULT '[]'
      );
      CREATE TABLE forecast_schedules (
        forecast_id uuid PRIMARY KEY,
        enabled boolean NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE forecast_resolutions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        forecast_id uuid NOT NULL UNIQUE,
        vote_event_id uuid NOT NULL,
        resolved_at timestamptz NOT NULL DEFAULT now(),
        metadata jsonb NOT NULL DEFAULT '{}'
      );
    `);

    const sessionId = '10000000-0000-0000-0000-000000000001';
    const chamberId = '10000000-0000-0000-0000-000000000002';
    const billId = '10000000-0000-0000-0000-000000000003';
    const member1 = '10000000-0000-0000-0000-000000000004';
    const member2 = '10000000-0000-0000-0000-000000000005';
    const legislator1 = '10000000-0000-0000-0000-000000000006';
    const legislator2 = '10000000-0000-0000-0000-000000000007';
    const forecastId = '10000000-0000-0000-0000-000000000008';
    const revisionId = '10000000-0000-0000-0000-000000000009';
    const source1 = '10000000-0000-0000-0000-000000000010';
    const source2 = '10000000-0000-0000-0000-000000000011';
    const evidence1 = '10000000-0000-0000-0000-000000000012';
    const evidence2 = '10000000-0000-0000-0000-000000000013';
    const voteId = '10000000-0000-0000-0000-000000000014';

    await client.query(
      "INSERT INTO legislative_sessions VALUES ($1, '2027-2028', '2027-01-01')",
      [sessionId],
    );
    await client.query(
      "INSERT INTO chambers VALUES ($1, 'house', 'House')",
      [chamberId],
    );
    await client.query(
      "INSERT INTO bills VALUES ($1, $2, 'HF1', '{}')",
      [billId, sessionId],
    );
    await client.query(`
      INSERT INTO memberships(id,session_id,chamber_id,legislator_id,party) VALUES
        ($1,$3,$4,$5,'A'),($2,$3,$4,$6,'B')
    `, [member1, member2, sessionId, chamberId, legislator1, legislator2]);
    await client.query(`
      INSERT INTO source_documents VALUES
        ($1,'member_primary_article','2027-01-31T10:00:00Z'),
        ($2,'house_committee_minutes','2027-01-31T11:00:00Z')
    `, [source1, source2]);
    await client.query(`
      INSERT INTO evidence_items(
        id,source_document_id,membership_id,bill_id,evidence_kind,stance,
        source_quality,relevance,freshness,confidence,published_at,metadata
      ) VALUES
        ($1,$3,$5,$7,'direct_statement','supports','official','direct','current',0.99,
         '2027-01-31T09:00:00Z',
         '{"quickEvidenceCandidate":true,"sourceVerified":true,"mechanicallyActionable":false}'),
        ($2,$4,$6,$7,'context','neutral','official','high','current',1,
         '2027-01-31T00:00:00Z',
         '{"subtype":"committee_rollcall","voteSide":"aye","mechanics":["committee_recommends_passage"],"asOfEligible":true,"mechanicallyActionable":false}')
    `, [evidence1, evidence2, source1, source2, member1, member2, billId]);
    await client.query(`
      INSERT INTO forecasts(
        id,owner_user_id,target_type,target_kind,bill_id,target_chamber_id,session_id,created_at
      ) VALUES
        ($1,'system:prospective-evidence-v1','bill','house_floor_passage',$2,$3,$4,'2027-01-30T12:00:00Z')
    `, [forecastId, billId, chamberId, sessionId]);
    await client.query(`
      INSERT INTO forecast_revisions(
        id,forecast_id,revision_number,research_mode,model_version,generated_at,metadata,
        passage_probability,expected_yes
      ) VALUES
        ($1,$2,1,'quick','member-eb-v1.2-decay180','2027-02-01T12:00:00Z',
         '{"passageRule":{"kind":"fixed","requiredYes":1}}',0.75,1.0)
    `, [revisionId, forecastId]);
    await client.query(`
      INSERT INTO forecast_member_predictions(revision_id,membership_id,yes_probability,context) VALUES
        ($1,$2,0.55,'[]'),($1,$3,0.45,'[]')
    `, [revisionId, member1, member2]);
    await client.query(
      'INSERT INTO forecast_schedules(forecast_id,enabled) VALUES ($1,true)',
      [forecastId],
    );

    const query = client.query.bind(client);
    const connect = async () => ({ query, release() {} });
    t.mock.method(appPool, 'query', query as typeof appPool.query);
    t.mock.method(appPool, 'connect', connect as typeof appPool.connect);

    const request: ForecastRuntimeRequest = {
      forecastId,
      chamberId,
      chamberSlug: 'house',
      chamberName: 'House',
      subject: {
        kind: 'bill',
        billId,
        identifier: 'HF1',
        title: 'Lifecycle rehearsal bill',
        sessionId,
        sessionSlug: '2027-2028',
      },
      researchMode: 'quick',
      asOf: '2027-02-01T12:00:00Z',
    };
    const quick: ForecastRuntimeResult = {
      forecastId,
      revisionId,
      revisionNumber: 1,
      researchMode: 'quick',
      modelVersion: 'member-eb-v1.2-decay180',
      asOf: '2027-02-01T12:00:00Z',
      chamber: {
        id: chamberId,
        slug: 'house',
        name: 'House',
        activeMembers: 2,
        passageRule: { kind: 'fixed', requiredYes: 1 },
        requiredYes: 1,
        passageProbability: 0.75,
        expectedYes: 1,
        yesLow: 0,
        yesHigh: 2,
      },
      supportState: 'supported',
      members: [
        {
          membershipId: member1,
          legislatorId: legislator1,
          memberName: 'Alpha Member',
          party: 'A',
          district: '1A',
          yesProbability: 0.55,
          evidenceQuality: 'moderate',
          support: { global: 10, party: 5, member: 3, analogue: 2 },
          strongestReason: 'fixture',
          researched: false,
        },
        {
          membershipId: member2,
          legislatorId: legislator2,
          memberName: 'Beta Member',
          party: 'B',
          district: '1B',
          yesProbability: 0.45,
          evidenceQuality: 'moderate',
          support: { global: 10, party: 5, member: 3, analogue: 2 },
          strongestReason: 'fixture',
          researched: false,
        },
      ],
      analogues: [],
      diagnostics: {
        prefilteredEvents: 0,
        safeCandidateEvents: 0,
        selectedAnalogues: 0,
        directAnalogueMembers: 0,
        cannotPredictMembers: 0,
      },
    };

    const capture = await captureQuickEvidenceShadow(request, quick);
    assert.ok(capture);
    assert.equal(capture.prospectiveEligible, true);
    assert.equal(capture.capturedMembers, 2);
    assert.equal(capture.changedMembers, 1);
    assert.equal(capture.membersWithDirectionalEvidence, 1);

    const captured = await client.query(`
      SELECT membership_id::text, context
        FROM forecast_member_predictions
       WHERE revision_id=$1::uuid
       ORDER BY membership_id
    `, [revisionId]);
    assert.equal(captured.rows.length, 2);
    const shadows = captured.rows.map((row) =>
      (row.context as Array<Record<string, unknown>>)
        .find((item) => item.experiment === QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT));
    assert.ok(shadows.every(Boolean));
    const member1Shadow = shadows[0] as Record<string, any>;
    const member2Shadow = shadows[1] as Record<string, any>;
    assert.ok(member1Shadow.candidateProbability > member1Shadow.baseProbability);
    assert.equal(member2Shadow.candidateProbability, member2Shadow.baseProbability);
    assert.equal(member2Shadow.features.committeeRecommendsPassageAye, 1);

    await client.query(`
      INSERT INTO vote_events(
        id,session_id,chamber_id,bill_id,is_passage,vote_kind,occurred_on,passed,yea_count,nay_count
      ) VALUES ($1,$2,$3,$4,true,'passage','2027-02-05',true,1,1)
    `, [voteId, sessionId, chamberId, billId]);
    await client.query(`
      INSERT INTO member_votes VALUES
        ($1,$2,'yea'),($1,$3,'nay')
    `, [voteId, member1, member2]);

    await resolveSafeForecastOutcome({
      forecastId,
      ownerUserId: 'system:prospective-evidence-v1',
      voteEventId: voteId,
    });

    const sealed = await getQuickEvidenceProspectiveScorecard({ query } as any);
    assert.equal(sealed.status, 'accruing');
    assert.equal(sealed.primaryScoringAllowed, false);
    assert.equal(sealed.metrics, null);
    assert.equal(sealed.cohort.selectedStrictlyPreVoteCases, 1);
    assert.equal(sealed.minimums.resolvedForecasts.observed, 1);
    assert.equal(sealed.minimums.memberOutcomes.observed, 2);
    assert.equal(sealed.minimums.membersWithAppliedDirectionalEvidence.observed, 1);

    const rehearsal = await getQuickEvidenceProspectiveScorecard(
      { query } as any,
      { revealMetrics: true },
    );
    assert.ok(rehearsal.metrics);
    assert.equal(rehearsal.metrics.memberOutcomes, 2);
    assert.equal(rehearsal.metrics.movedMemberOutcomes, 1);
    assert.equal(rehearsal.metrics.distinctMembersWithDirectionalEvidence, 1);
    assert.ok(
      (rehearsal.metrics.overall.member.deltaCandidateMinusServing?.brier ?? 1) < 0,
      'directional evidence should improve the fixture member Brier',
    );

    const resolution = await client.query(
      'SELECT metadata, resolved_at FROM forecast_resolutions WHERE forecast_id=$1::uuid',
      [forecastId],
    );
    assert.equal(resolution.rows[0].metadata.resolutionSource, 'verified_official_floor_vote');
    const schedule = await client.query(
      'SELECT enabled FROM forecast_schedules WHERE forecast_id=$1::uuid',
      [forecastId],
    );
    assert.equal(schedule.rows[0].enabled, false);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => undefined);
    client.release();
    await db.end();
  }
});
