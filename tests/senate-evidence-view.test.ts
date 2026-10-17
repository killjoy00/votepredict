import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

const sql = readFileSync('migrations/0032_senate_evidence_v.sql', 'utf8');
const script = readFileSync('scripts/deploy-senate-evidence-view-neon.ts', 'utf8');
const workflow = readFileSync('.github/workflows/senate-evidence-view-production.yml', 'utf8');

test('evidence index migration only creates a view and never writes source tables', () => {
  assert.match(sql, /CREATE OR REPLACE VIEW public\.senate_evidence_v AS/);
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT|ALTER TABLE)\b/i);
  for (const type of ['official_floor_vote', 'committee_vote', 'bill_chief_author', 'bill_coauthor',
    'committee_testimony', 'press_statement_member', 'election_result', 'district_partisanship']) {
    assert.ok(sql.includes(`'${type}'`) || sql.includes(type), type);
  }
});

test('evidence view deploy is one-shot, marker-gated and protected', () => {
  assert.match(script, /SENATE_EVIDENCE_VIEW_PRODUCTION/);
  assert.match(script, /0032_senate_evidence_v\.sql/);
  assert.match(script, /REPEATABLE READ READ ONLY/);
  assert.doesNotMatch(workflow, /schedule|cron/);
  assert.match(workflow, /environment: evidence-readonly-sandbox/);
  assert.match(workflow, /needs\.independent-main\.result == 'success'/);
  assert.match(workflow, /contains\(github\.event\.head_commit\.message, 'SENATE_EVIDENCE_VIEW_PRODUCTION'\)/);
});

const url = process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const local = !!url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname);

test('Postgres: evidence rows carry member, bill and a conservative as-of date',
  { skip: !local, timeout: 60_000 }, async () => {
    const pool = new Pool({ connectionString: url!, max: 2 });
    const tag = 'evidence-view-fixture';
    try {
      const one = async <T extends Record<string, unknown>>(q: string, p: unknown[] = []) =>
        (await pool.query<T>(q, p)).rows[0];
      const juris = (await one<{ id: string }>(
        "INSERT INTO jurisdictions(slug,name,country_code) VALUES ('us-mn','Minnesota','US') " +
        'ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id')).id;
      const chamber = (await one<{ id: string }>(
        "INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Minnesota Senate','upper') " +
        'ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id', [juris])).id;
      const session = (await one<{ id: string }>(
        "INSERT INTO legislative_sessions(jurisdiction_id,slug,name,starts_on,ends_on) " +
        "VALUES($1,'2023-2024','2023-2024','2023-01-01','2024-12-31') " +
        'ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id', [juris])).id;
      const legislator = (await one<{ id: string }>(
        `INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,'Fixture Evidence','fixture evidence')
         ON CONFLICT (jurisdiction_id,external_key) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [juris, tag])).id;
      const membership = (await one<{ id: string }>(
        `INSERT INTO memberships(legislator_id,session_id,chamber_id,district,party,title)
         VALUES($1,$2,$3,'99','X','Senator')
         ON CONFLICT (session_id,chamber_id,legislator_id) DO UPDATE SET district=EXCLUDED.district RETURNING id`,
        [legislator, session, chamber])).id;
      const bill = (await one<{ id: string }>(
        `INSERT INTO bills(session_id,originating_chamber_id,identifier,title,introduced_at)
         VALUES($1,$2,'SF9901','Evidence fixture bill','2023-02-01T12:00:00Z')
         ON CONFLICT(session_id,identifier) DO UPDATE SET introduced_at=EXCLUDED.introduced_at RETURNING id`,
        [session, chamber])).id;

      // Clean this test's own rows so repeated suite runs on one database pass.
      await pool.query('DELETE FROM senate_bill_authors WHERE bill_id=$1', [bill]);
      await pool.query('DELETE FROM senate_bill_author_snapshots WHERE bill_id=$1', [bill]);
      await pool.query("DELETE FROM member_votes WHERE source_member_name=$1", [tag]);
      await pool.query("DELETE FROM vote_events WHERE external_key=$1", [tag]);
      await pool.query("DELETE FROM source_documents WHERE source_url=$1", ['https://example.test/' + tag]);

      const doc = (await one<{ id: string }>(
        `INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,http_status,metadata)
         VALUES($1,$2,$3,'fixture',$4,$5,200,'{}'::jsonb) RETURNING id`,
        [juris, session, chamber, 'https://example.test/' + tag, 'e'.repeat(64)])).id;
      const event = (await one<{ id: string }>(
        `INSERT INTO vote_events(session_id,chamber_id,bill_id,source_document_id,external_key,vote_kind,motion_text,occurred_on,yea_count,nay_count)
         VALUES($1,$2,$3,$4,$5,'passage','Final passage','2023-05-10',1,0) RETURNING id`,
        [session, chamber, bill, doc, tag])).id;
      await pool.query(
        `INSERT INTO member_votes(vote_event_id,membership_id,source_member_name,normalized_member_name,choice)
         VALUES($1,$2,$3,'fixture evidence','yea')`, [event, membership, tag]);
      const snapshot = (await one<{ id: string }>(
        `INSERT INTO senate_bill_author_snapshots(bill_id,source_url,fetched_at,http_status)
         VALUES($1,'https://example.test/authors','2026-10-16T00:00:00Z',200) RETURNING id`, [bill])).id;
      await pool.query(
        `INSERT INTO senate_bill_authors(bill_id,session_id,chamber,name_raw,author_key,membership_id,match_method,role,author_order,source,snapshot_id,source_url)
         VALUES ($1,$2,'senate','Evidence','chief-key',$3,'exact','chief',1,'revisor_xml',$4,'https://example.test/authors'),
                ($1,$2,'senate','Other','co-key',NULL,'unresolved','coauthor',2,'revisor_xml',$4,'https://example.test/authors')`,
        [bill, session, membership, snapshot]);

      const rows = (await pool.query<{
        evidence_type: string; membership_id: string | null; observed_on: string; observed_basis: string; value_text: string;
      }>(
        `SELECT evidence_type,membership_id,observed_on::text,observed_basis,value_text
           FROM senate_evidence_v WHERE bill_id=$1 ORDER BY evidence_type`, [bill])).rows;
      const byType = new Map(rows.map((row) => [row.evidence_type, row]));
      assert.deepEqual(
        [byType.get('official_floor_vote')?.membership_id, byType.get('official_floor_vote')?.observed_on,
          byType.get('official_floor_vote')?.value_text],
        [membership, '2023-05-10', 'yea']);
      // A chief author with no printed added date is public at introduction.
      assert.deepEqual([byType.get('bill_chief_author')?.observed_on, byType.get('bill_chief_author')?.observed_basis],
        ['2023-02-01', 'bills.introduced_at']);
      // A coauthor with no printed date falls back to the (later) fetch date, never earlier.
      assert.deepEqual([byType.get('bill_coauthor')?.observed_on, byType.get('bill_coauthor')?.observed_basis],
        ['2026-10-16', 'author_snapshot.fetched_at']);

      // As-of filtering: before the floor vote only the chief authorship is visible.
      const asOf = (await pool.query<{ evidence_type: string }>(
        "SELECT evidence_type FROM senate_evidence_v WHERE bill_id=$1 AND observed_on <= '2023-05-09' ORDER BY 1", [bill])).rows;
      assert.deepEqual(asOf.map((row) => row.evidence_type), ['bill_chief_author']);
    } finally {
      await pool.end();
    }
  });
