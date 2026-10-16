import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import {
  journalKnownNames, reparseJournalRecords, reparseStoredSenateJournalRawVotes, SENATE_JOURNAL_NAME_SEGMENTATION,
} from '../src/operations/senate-journal-raw-reparse.js';
import type { MembershipCandidate } from '../src/sources/minnesota/member-reconciliation.js';

const member = (id: string, name: string, extra: Partial<MembershipCandidate> = {}): MembershipCandidate =>
  ({ membershipId: id, legislatorId: 'l-' + id, name, ...extra });
const roster: MembershipCandidate[] = [
  member('1', 'Gary Dahms'), member('2', 'Rich Draheim'), member('3', 'Gene Dornink'),
  member('4', 'Bruce Anderson'), member('5', 'Erin Maye Quade'), member('6', 'Jordan Rasmusson'),
  member('7', 'Andrew Mathews', { startsOn: '2025-01-14' }),
];
// Roll-call columns are separated by single spaces in the extracted PDF text,
// and a running page header sits between the columns.
const text = `Senator Dahms moved to amend S.F. No. 1434 as follows (A-3):
The question was taken on the adoption of the amendment.
The roll was called, and there were yeas 4 and nays 2, as follows:
Those who voted in the affirmative were:
Anderson Dahms Dornink
FRIDAY, JANUARY 27, 2023
Draheim
Those who voted in the negative were:
Maye Quade Rasmusson
The motion prevailed. So the amendment was adopted.`;

test('journal name forms cover surnames, compound surnames and only members serving on the date', () => {
  const names = journalKnownNames(roster, '2023-01-27');
  assert.ok(names.includes('Dahms') && names.includes('Maye Quade') && names.includes('Quade'));
  assert.ok(!names.includes('Mathews'));
  assert.ok(journalKnownNames(roster, null).includes('Mathews'));
});

test('roster re-parse splits run-together roll-call columns and drops page headers', () => {
  const records = reparseJournalRecords({
    text, sessionSlug: '2023-2024', sourceUrl: 'https://www.senate.mn/journals/2023-2024/example.pdf',
    sourceDate: '2023-01-27', roster,
  });
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].memberVotes, [
    { name: 'Anderson', choice: 'yea' }, { name: 'Dahms', choice: 'yea' }, { name: 'Dornink', choice: 'yea' },
    { name: 'Draheim', choice: 'yea' }, { name: 'Maye Quade', choice: 'nay' }, { name: 'Rasmusson', choice: 'nay' },
  ]);
  assert.equal(records[0].namesMatchTally, true);
});

const url = process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const local = !!url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname);

test('Postgres: stored journal raw votes are re-parsed once and their derived mention rows cleared',
  { skip: !local, timeout: 60_000 }, async () => {
    const pool = new Pool({ connectionString: url!, max: 2 });
    const sourceUrl = 'https://www.senate.mn/journals/2023-2024/reparse-test-fixture.pdf';
    try {
      const juris = (await pool.query<{ id: string }>(
        "INSERT INTO jurisdictions(slug,name,country_code) VALUES ('us-mn','Minnesota','US') " +
        'ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id')).rows[0].id;
      const chamber = (await pool.query<{ id: string }>(
        "INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Minnesota Senate','upper') " +
        'ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id', [juris])).rows[0].id;
      const session = (await pool.query<{ id: string }>(
        "INSERT INTO legislative_sessions(jurisdiction_id,slug,name,starts_on,ends_on) " +
        "VALUES($1,'2023-2024','2023-2024','2023-01-01','2024-12-31') " +
        'ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id', [juris])).rows[0].id;
      // Fixture roster: 40+ senators so the reparse treats the roster as usable.
      const names = [...roster.slice(0, 6).map((m) => m.name), ...Array.from({ length: 40 }, (_, i) => `Fixture Senatorx${i}`)];
      for (const [i, name] of names.entries()) {
        const legislator = (await pool.query<{ id: string }>(
          `INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,$3,$4)
           ON CONFLICT (jurisdiction_id,external_key) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
          [juris, 'reparse-fixture-' + i, name, name.toLowerCase()])).rows[0].id;
        await pool.query(
          `INSERT INTO memberships(legislator_id,session_id,chamber_id,district,party,title)
           VALUES($1,$2,$3,$4,'X','Senator') ON CONFLICT (session_id,chamber_id,legislator_id) DO NOTHING`,
          [legislator, session, chamber, String(i + 1)]);
      }
      await pool.query('DELETE FROM source_documents WHERE source_url=$1', [sourceUrl]);
      const doc = (await pool.query<{ id: string }>(
        `INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,http_status,metadata)
         VALUES($1,$2,$3,'mn_senate_journal_raw_votes',$4,$5,200,$6::jsonb) RETURNING id`,
        [juris, session, chamber, sourceUrl, 'f'.repeat(64), JSON.stringify({ rawPrepassageVotes: {
          sourceType: 'mn_senate_journal', parserVersion: 'mn-senate-raw-votes-v1', sessionSlug: '2023-2024',
          sourceDate: '2023-01-27', text,
          records: [{ ordinal: 1, memberVotes: [{ name: 'Anderson Dahms Dornink', choice: 'yea' }], namesMatchTally: false }],
        } })])).rows[0].id;
      await pool.query(
        `INSERT INTO senate_raw_vote_member_mentions(source_document_id,record_ordinal,name_ordinal,role,printed_name,match_method)
         VALUES($1,1,0,'voter','Anderson Dahms Dornink','unresolved')`, [doc]);

      const first = await reparseStoredSenateJournalRawVotes(pool);
      assert.ok(first.reparsed >= 1);
      assert.ok(first.mentionRowsCleared >= 1);
      const stored = (await pool.query<{ raw: { nameSegmentation: string; records: { memberVotes: { name: string }[] }[] } }>(
        "SELECT metadata->'rawPrepassageVotes' AS raw FROM source_documents WHERE id=$1", [doc])).rows[0].raw;
      assert.equal(stored.nameSegmentation, SENATE_JOURNAL_NAME_SEGMENTATION);
      assert.deepEqual(stored.records[0].memberVotes.map((v) => v.name),
        ['Anderson', 'Dahms', 'Dornink', 'Draheim', 'Maye Quade', 'Rasmusson']);
      const mentions = (await pool.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM senate_raw_vote_member_mentions WHERE source_document_id=$1', [doc])).rows[0].n;
      assert.equal(mentions, 0);
      const second = await reparseStoredSenateJournalRawVotes(pool);
      assert.equal(second.reparsed, 0);
    } finally {
      await pool.query('DELETE FROM source_documents WHERE source_url=$1', [sourceUrl]).catch(() => undefined);
      await pool.end();
    }
  });
