import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash, randomUUID} from 'node:crypto';
import {Pool, type PoolClient} from 'pg';

const connection = process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const local = !!connection && ['127.0.0.1', 'localhost'].includes(new URL(connection).hostname);

async function insertedId(client: PoolClient, sql: string, params: unknown[] = []): Promise<string> {
  const row = (await client.query<{id: string}>(sql, params)).rows[0];
  assert.ok(row?.id);
  return row.id;
}

// All test-specific inserts happen inside one transaction that ALWAYS rolls
// back, including after an assertion failure. Running the full suite twice on
// the same disposable Postgres therefore starts with zero leftover fixtures.
test('Postgres: Senate flat views preserve raw ordinals, links, companion and official trail',
  {skip: !local, timeout: 45_000}, async () => {
  const pool = new Pool({connectionString: connection!, max: 1});
  const client = await pool.connect();
  const token = randomUUID();
  const base = 'https://example.invalid/votepredict/senate-flat-view-test/' + token;
  const hash = (input: string) => createHash('sha256').update(input).digest('hex');
  try {
    await client.query('BEGIN');
    await client.query(
      "INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US') ON CONFLICT(slug) DO NOTHING");
    const jurisdiction = (await client.query<{id: string}>(
      "SELECT id FROM jurisdictions WHERE slug='us-mn'")).rows[0]!.id;
    const chambers: Record<string, string> = {};
    for (const [slug, name, kind] of [
      ['senate', 'Minnesota Senate', 'upper'], ['house', 'Minnesota House', 'lower'],
    ]) {
      await client.query(
        'INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,$2,$3,$4) ' +
          'ON CONFLICT(jurisdiction_id,slug) DO NOTHING',
        [jurisdiction, slug, name, kind]);
      chambers[slug] = (await client.query<{id: string}>(
        'SELECT id FROM chambers WHERE jurisdiction_id=$1 AND slug=$2',
        [jurisdiction, slug])).rows[0]!.id;
    }
    await client.query(
      "INSERT INTO legislative_sessions(jurisdiction_id,slug,name,starts_on,ends_on) " +
        "VALUES($1,'2025-2026','2025-2026','2025-01-01','2026-12-31') " +
        'ON CONFLICT(jurisdiction_id,slug) DO NOTHING', [jurisdiction]);
    const session = (await client.query<{id: string}>(
      "SELECT id FROM legislative_sessions WHERE jurisdiction_id=$1 AND slug='2025-2026'",
      [jurisdiction])).rows[0]!.id;
    const members: string[] = [];
    for (const [i, party] of ['DFL', 'R'].entries()) {
      const name = 'Flat Vote Fixture ' + i + ' ' + token.slice(0, 8);
      const legislator = await insertedId(client,
        'INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) ' +
          'VALUES($1,$2,$3,$4) RETURNING id',
        [jurisdiction, 'senate-flat-test:' + token + ':' + i, name, name.toLowerCase()]);
      members.push(await insertedId(client,
        'INSERT INTO memberships(session_id,chamber_id,legislator_id,district,party,title) ' +
          "VALUES($1,$2,$3,$4,$5,'Senator') RETURNING id",
        [session, chambers.senate, legislator, String(60 + i), party]));
    }
    const sf = await insertedId(client,
      "INSERT INTO bills(session_id,originating_chamber_id,identifier,title) " +
        "VALUES($1,$2,'SF993221','Fixture Senate bill') RETURNING id",
      [session, chambers.senate]);
    const hf = await insertedId(client,
      "INSERT INTO bills(session_id,originating_chamber_id,identifier,title) " +
        "VALUES($1,$2,'HF993221','Fixture House companion') RETURNING id",
      [session, chambers.house]);
    await client.query(
      'INSERT INTO bill_companions(senate_bill_id,house_bill_id,session_id,source_url,fetched_at) ' +
        'VALUES($1,$2,$3,$4,now())', [sf, hf, session, base + '/companion']);
    const committeeRaw = {
      sourceType: 'mn_senate_committee_minutes_html',
      sessionSlug: '2025-2026', sourceDate: '2025-03-01',
      hearing: {committeeName: 'Elections'},
      records: [
        {ordinal: 7, venue: 'committee', billIdentifier: 'SF993221', method: 'roll_call',
          voteKind: 'amendment', amendmentRef: 'A1', mover: 'Fixture Mover',
          yeaCount: 1, nayCount: 1, namesMatchTally: true,
          motionText: 'Committee amendment', memberVotes: [
            {name: 'Fixture Alpha', choice: 'yea'},
            {name: 'Fixture Beta', choice: 'nay'},
          ]},
        // No ordinal: crosswalk must use the 1-based JSON array position (2).
        {venue: 'committee', billIdentifier: 'SF993221', method: 'voice',
          voteKind: 'motion', motionText: 'Unanimous voice motion', memberVotes: []},
      ],
    };
    const journalRaw = {
      sourceType: 'mn_senate_journal', sessionSlug: '2025-2026',
      sourceDate: '2025-03-03', nameSegmentation: 'session_roster',
      records: [
        {ordinal: 5, venue: 'floor', billIdentifier: 'SF993221',
          method: 'roll_call', voteKind: 'passage', yeaCount: 1, nayCount: 1,
          namesMatchTally: true, motionText: 'Senate floor motion', memberVotes: [
            {name: 'Fixture Alpha', choice: 'yea'},
            {name: 'Fixture Beta', choice: 'nay'},
          ]},
      ],
    };
    const document = async (suffix: string, kind: string, raw: unknown) =>
      insertedId(client,
        'INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,' +
          'source_url,content_sha256,metadata) ' +
          "VALUES($1,$2,$3,$4,$5,$6,jsonb_build_object('rawPrepassageVotes',$7::jsonb)) RETURNING id",
        [jurisdiction, session, chambers.senate, kind, base + suffix, hash(token + suffix),
          JSON.stringify(raw)]);
    const committee = await document('/committee', 'senate_committee_minutes_html', committeeRaw);
    const journal = await document('/journal', 'senate_journal_pdf', journalRaw);
    for (const [sourceId, ordinal] of [[committee, 7], [committee, 2], [journal, 5]] as const) {
      await client.query(
        'INSERT INTO senate_raw_vote_bill_mentions(source_document_id,record_ordinal,' +
          'printed_identifier,bill_id,match_method) VALUES($1,$2,$3,$4,$5)',
        [sourceId, ordinal, 'SF993221', sf, 'exact']);
    }
    for (const [sourceId, ordinal] of [[committee, 7], [journal, 5]] as const) {
      for (const i of [0, 1]) {
        await client.query(
          'INSERT INTO senate_raw_vote_member_mentions(source_document_id,record_ordinal,' +
            'name_ordinal,role,printed_name,membership_id,match_method) ' +
            "VALUES($1,$2,$3,'voter',$4,$5,'exact')",
          [sourceId, ordinal, i, i === 0 ? 'Fixture Alpha' : 'Fixture Beta', members[i]]);
      }
    }
    await client.query(
      'INSERT INTO senate_raw_vote_member_mentions(source_document_id,record_ordinal,' +
        'name_ordinal,role,printed_name,membership_id,match_method) ' +
        "VALUES($1,7,0,'mover','Fixture Mover',$2,'alias')",
      [committee, members[0]]);
    // This is a rollback-only, disposable official-vote fixture. Application
    // vote_events and member_votes are never changed by the migration or runner.
    const official = await insertedId(client,
      'INSERT INTO vote_events(session_id,chamber_id,bill_id,source_document_id,external_key,' +
        'vote_kind,motion_text,occurred_on,yea_count,nay_count,passed,is_passage) ' +
        "VALUES($1,$2,$3,$4,$5,'passage','Official recorded vote','2025-03-04',1,1,true,true) " +
        'RETURNING id',
      [session, chambers.senate, sf, journal, 'flat-test:' + token]);

    const records = (await client.query<{
      source_document_id: string; record_ordinal: number; committee: string | null;
      bill_id: string | null; mover_membership_id: string | null; method: string;
      names_match_tally: boolean | null; source_type: string; occurred_on: string;
    }>(
      'SELECT * FROM senate_raw_vote_records_v WHERE source_document_id=ANY($1::uuid[]) ' +
        'ORDER BY source_document_id,record_ordinal',
      [[committee, journal]])).rows;
    assert.equal(records.length, 3);
    const committeeRoll = records.find(r => r.source_document_id === committee && r.record_ordinal === 7)!;
    const committeeVoice = records.find(r => r.source_document_id === committee && r.record_ordinal === 2)!;
    const floor = records.find(r => r.source_document_id === journal && r.record_ordinal === 5)!;
    assert.equal(committeeRoll.committee, 'Elections');
    assert.equal(committeeRoll.bill_id, sf);
    assert.equal(committeeRoll.mover_membership_id, members[0]);
    assert.equal(committeeRoll.names_match_tally, true);
    assert.equal(committeeVoice.method, 'voice');
    assert.equal(committeeVoice.names_match_tally, null);
    assert.equal(floor.source_type, 'mn_senate_journal');

    const votes = (await client.query<{
      source_document_id: string; record_ordinal: number; name_ordinal: number;
      name_raw: string; choice: string; membership_id: string; match_method: string;
    }>(
      'SELECT * FROM senate_raw_member_votes_v WHERE source_document_id=ANY($1::uuid[]) ' +
        'ORDER BY source_document_id,record_ordinal,name_ordinal',
      [[committee, journal]])).rows;
    assert.equal(votes.length, 4); // The committee voice vote has no individual names.
    for (const sourceId of [committee, journal]) {
      const slice = votes.filter(v => v.source_document_id === sourceId);
      assert.deepEqual(slice.map(v => v.name_ordinal), [0, 1]);
      assert.deepEqual(slice.map(v => v.choice), ['yea', 'nay']);
      assert.deepEqual(slice.map(v => v.membership_id), members);
      assert.deepEqual(slice.map(v => v.match_method), ['exact', 'exact']);
    }

    const trail = (await client.query<{
      bill_id: string; matched_bill_id: string; via_companion: boolean;
      entry_source: string; source_document_id: string; vote_event_id: string | null;
    }>(
      'SELECT bill_id,matched_bill_id,via_companion,entry_source,source_document_id,vote_event_id ' +
        'FROM senate_vote_trail_v WHERE bill_id=ANY($1::uuid[]) AND ' +
        'source_document_id=ANY($2::uuid[]) ORDER BY bill_id,entry_source,record_ordinal',
      [[sf, hf], [committee, journal]])).rows;
    assert.equal(trail.length, 8); // 3 raw + 1 official for each bill/companion root.
    for (const root of [sf, hf]) {
      const entries = trail.filter(v => v.bill_id === root);
      assert.equal(entries.length, 4);
      assert.deepEqual(entries.map(v => v.entry_source).sort(),
        ['official', 'raw', 'raw', 'raw']);
      assert.ok(entries.every(v => v.matched_bill_id === sf));
      assert.ok(entries.every(v => v.via_companion === (root === hf)));
      assert.equal(entries.find(v => v.entry_source === 'official')?.vote_event_id, official);
    }
  } finally {
    try {await client.query('ROLLBACK');} finally {
      client.release();
      await pool.end();
    }
  }
});
