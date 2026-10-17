import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import {
  backfillIntroductionAuthors, backfillScorecardArchiveDates, earliestCdxCapture,
  parseJournalIntroductions, splitIntroducerNames, urlNamesScorecardYear,
} from '../src/operations/senate-evidence-dates.js';

// Trimmed from the Senate Journal, 7th day, January 12, 2023 (journal page 164),
// with one list wrapped across lines as longer lists are printed.
const journal = `INTRODUCTION AND FIRST READING OF SENATE BILLS
The following bills were read the first time.
Senators Hoffman, Morrison, Abeler, Kupec, and Utke introduced--
S.F. No. 187: A bill for an act relating to taxation; lawful gambling; modifying the combined
net receipts tax; amending Minnesota Statutes 2022, section 297E.02, subdivision 6.
Referred to the Committee on Taxes.
Senator Howe introduced--
S.F. No. 189: A bill for an act relating to transportation; appropriating money for a grant to
Stearns County for improvements to Town Line Road in Stearns County.
Referred to the Committee on Transportation.
Senators Frentz and Draheim introduced--
S.F. No. 190: A bill for an act relating to capital investment.
Referred to the Committee on Capital Investment.
Senators Maye Quade, Oumou Verbeten, Champion, Dibble, Fateh, Gustafson,
Hawj, and Kunesh introduced--
S.F. No. 191: A bill for an act relating to education.`;

// TEXT_VERSION_LIST from the Revisor status XML for SF 187 (2023), plus a
// second version added to exercise multi-version matching.
const statusXml = `<BILL><TEXT_VERSION_LIST>
  <DOCUMENT>
    <HTML_URI>https://www.revisor.mn.gov/bills/93/2023/0/SF/187/versions/0/</HTML_URI>
    <DATE_INSERT>2023-01-11 11:02:22</DATE_INSERT>
    <DOCUMENT_NAME>2023.0-SF0187-0</DOCUMENT_NAME>
    <DOCUMENT_ENGROSSMENT>0</DOCUMENT_ENGROSSMENT>
  </DOCUMENT>
  <DOCUMENT>
    <HTML_URI>https://www.revisor.mn.gov/bills/93/2023/0/SF/187/versions/1/</HTML_URI>
    <DATE_INSERT>2023-03-02 09:15:00</DATE_INSERT>
    <DOCUMENT_NAME>2023.0-SF0187-1</DOCUMENT_NAME>
    <DOCUMENT_ENGROSSMENT>1</DOCUMENT_ENGROSSMENT>
  </DOCUMENT>
</TEXT_VERSION_LIST></BILL>`;

test('journal introduction lines yield every author, including wrapped and compound names', () => {
  assert.deepEqual(parseJournalIntroductions(journal), [
    { billIdentifier: 'SF187', names: ['Hoffman', 'Morrison', 'Abeler', 'Kupec', 'Utke'] },
    { billIdentifier: 'SF189', names: ['Howe'] },
    { billIdentifier: 'SF190', names: ['Frentz', 'Draheim'] },
    { billIdentifier: 'SF191', names: ['Maye Quade', 'Oumou Verbeten', 'Champion', 'Dibble', 'Fateh', 'Gustafson', 'Hawj', 'Kunesh'] },
  ]);
  assert.deepEqual(splitIntroducerNames('Frentz and Draheim'), ['Frentz', 'Draheim']);
  // Prose mentioning a senator is not an introduction line.
  assert.deepEqual(parseJournalIntroductions('Senator Dibble moved that S.F. No. 12 be laid on the table.'), []);
});

test('scorecard archive capture is trusted only for URLs naming that year', () => {
  assert.equal(urlNamesScorecardYear('https://example.org/files/2023-legislative-scorecard.pdf', 2023), true);
  assert.equal(urlNamesScorecardYear('https://example.org/scorecard/', 2023), false);
  assert.equal(urlNamesScorecardYear('https://example.org/2023-2024-scorecard.pdf', 2023), false);
  assert.equal(earliestCdxCapture([['timestamp', 'statuscode'], ['20240105120000', '200'], ['20230701083000', '200']]), '20230701083000');
  assert.equal(earliestCdxCapture([]), null);
});

test('migration 0033 is additive and keeps senate_evidence_v columns', () => {
  const sql = readFileSync('migrations/0033_senate_evidence_dates.sql', 'utf8');
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE|DELETE|ALTER TABLE)\b/i);
  assert.match(sql, /CREATE OR REPLACE VIEW public\.senate_evidence_v AS/);
  assert.match(sql, /'journal\.introduction'/);
  assert.match(sql, /'revisor_xml\.date_insert'/);
  assert.match(sql, /'scorecard\.archive_first_capture'/);
});

const url = process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const local = !!url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname);

test('Postgres: journal, Revisor XML and archive dates replace fetch dates in senate_evidence_v',
  { skip: !local, timeout: 90_000 }, async () => {
    const pool = new Pool({ connectionString: url!, max: 2 });
    const tag = 'evidence-dates-fixture';
    try {
      const one = async <T extends Record<string, unknown>>(q: string, p: unknown[] = []) => (await pool.query<T>(q, p)).rows[0];
      const juris = (await one<{ id: string }>(
        "INSERT INTO jurisdictions(slug,name,country_code) VALUES ('us-mn','Minnesota','US') ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id")).id;
      const chamber = (await one<{ id: string }>(
        "INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Minnesota Senate','upper') ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id", [juris])).id;
      const sessionIds: Record<string, string> = {};
      for (const slug of ['2021-2022', '2023-2024', '2025-2026']) {
        sessionIds[slug] = (await one<{ id: string }>(
          `INSERT INTO legislative_sessions(jurisdiction_id,slug,name,starts_on,ends_on) VALUES($1,$2,$2,$3::date,$4::date)
           ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
          [juris, slug, slug.slice(0, 4) + '-01-01', slug.slice(5) + '-12-31'])).id;
      }
      const session = sessionIds['2023-2024'];
      const memberIds: Record<string, string> = {};
      for (const [i, name] of ['Pat Hoffman', 'Fixture Morrison', 'Fixture Abeler', 'Fixture Kupec', 'Fixture Utke'].entries()) {
        const legislator = (await one<{ id: string }>(
          `INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,$3,lower($3))
           ON CONFLICT (jurisdiction_id,external_key) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [juris, `${tag}-${i}`, name])).id;
        memberIds[name.split(' ').at(-1)!] = (await one<{ id: string }>(
          `INSERT INTO memberships(legislator_id,session_id,chamber_id,district,party,title) VALUES($1,$2,$3,$4,'X','Senator')
           ON CONFLICT (session_id,chamber_id,legislator_id) DO UPDATE SET title=EXCLUDED.title RETURNING id`,
          [legislator, session, chamber, String(80 + i)])).id;
      }
      const bill = (await one<{ id: string }>(
        `INSERT INTO bills(session_id,originating_chamber_id,identifier,title) VALUES($1,$2,'SF187','Fixture SF187')
         ON CONFLICT(session_id,identifier) DO UPDATE SET title=EXCLUDED.title RETURNING id`, [session, chamber])).id;

      // Clean this test's own rows so the suite can run twice on one database.
      await pool.query('DELETE FROM senate_bill_introduction_authors WHERE bill_id=$1', [bill]);
      await pool.query('DELETE FROM senate_official_bill_text_captures WHERE bill_id=$1', [bill]);
      await pool.query('DELETE FROM senate_bill_authors WHERE bill_id=$1', [bill]);
      await pool.query('DELETE FROM senate_bill_author_snapshots WHERE bill_id=$1', [bill]);
      await pool.query(`DELETE FROM senate_scorecard_archive_dates WHERE url LIKE 'https://example.test/${tag}%'`);
      await pool.query(`DELETE FROM senate_scorecard_entries WHERE source_url LIKE 'https://example.test/${tag}%'`);
      await pool.query(`DELETE FROM senate_scorecard_snapshots WHERE url LIKE 'https://example.test/${tag}%'`);
      await pool.query(`DELETE FROM source_documents WHERE source_url LIKE 'https://example.test/${tag}%'`);

      // A stored raw journal document, as the raw-vote collector saves it.
      await pool.query(
        `INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,http_status,metadata)
         VALUES($1,$2,$3,'mn_senate_journal_raw_votes',$4,$5,200,$6::jsonb)`,
        [juris, session, chamber, `https://example.test/${tag}/journal.pdf`, 'a'.repeat(64), JSON.stringify({ rawPrepassageVotes: {
          sourceType: 'mn_senate_journal', sessionSlug: '2023-2024', sourceDate: '2023-01-12', text: journal, records: [],
        } })]);
      const intro = await backfillIntroductionAuthors(pool);
      assert.ok(intro.introductions >= 1);
      const introRows = (await pool.query<{ name_raw: string; membership_id: string | null; introduced_on: string }>(
        'SELECT name_raw,membership_id,introduced_on::text FROM senate_bill_introduction_authors WHERE bill_id=$1 ORDER BY author_order', [bill])).rows;
      assert.deepEqual(introRows.map((r) => [r.name_raw, r.membership_id, r.introduced_on]), [
        ['Hoffman', memberIds.Hoffman, '2023-01-12'], ['Morrison', memberIds.Morrison, '2023-01-12'],
        ['Abeler', memberIds.Abeler, '2023-01-12'], ['Kupec', memberIds.Kupec, '2023-01-12'], ['Utke', memberIds.Utke, '2023-01-12'],
      ]);

      // A coauthor with no printed added date, previously dated by the snapshot fetch.
      const snapshot = (await one<{ id: string }>(
        `INSERT INTO senate_bill_author_snapshots(bill_id,source_url,fetched_at,http_status,raw_xml)
         VALUES($1,'https://example.test/${tag}/status.xml','2026-10-16T00:00:00Z',200,$2) RETURNING id`, [bill, statusXml])).id;
      await pool.query(
        `INSERT INTO senate_bill_authors(bill_id,session_id,chamber,name_raw,author_key,membership_id,match_method,role,author_order,source,snapshot_id,source_url)
         VALUES($1,$2,'senate','Utke','utke-key',$3,'exact','coauthor',5,'revisor_xml',$4,'https://example.test/${tag}/status.xml')`,
        [bill, session, memberIds.Utke, snapshot]);
      // The 1st engrossment text, captured without a printed posting date.
      await pool.query(
        `INSERT INTO senate_official_bill_text_captures(session_id,bill_id,family,source_url,source_locator,printed_label,raw_text,
           original_body_sha256,body_hash_provenance,extracted_text_sha256,fetched_at)
         VALUES($1,$2,'numbered_version','https://www.revisor.mn.gov/bills/93/2023/0/SF/187/versions/1/','v1','1st Engrossment','text',
           $3,'fetched_original_bytes',$3,'2026-10-16T00:00:00Z')`,
        [session, bill, 'd'.repeat(64)]);

      // Two scorecards: one URL names its year, one does not.
      const dated = (await one<{ id: string }>(
        `INSERT INTO senate_scorecard_snapshots(url,group_name,year,fetched_at,sha256,content_type,raw_text)
         VALUES('https://example.test/${tag}/2023-scorecard.pdf','Fixture Group',2023,'2026-10-16T00:00:00Z',$1,'application/pdf','x') RETURNING id`, ['b'.repeat(64)])).id;
      const undated = (await one<{ id: string }>(
        `INSERT INTO senate_scorecard_snapshots(url,group_name,year,fetched_at,sha256,content_type,raw_text)
         VALUES('https://example.test/${tag}/scorecard/','Fixture Group',2023,'2026-10-16T00:00:00Z',$1,'text/html','x') RETURNING id`, ['c'.repeat(64)])).id;
      for (const [snap, n] of [[dated, 1], [undated, 2]] as const) {
        await pool.query(
          `INSERT INTO senate_scorecard_entries(group_name,year,kind,value_raw,name_raw,membership_id,match_method,snapshot_id,source_url,source_ordinal)
           VALUES('Fixture Group',2023,'score','90','Utke',$1,'exact',$2,$3,$4)`,
          [memberIds.Utke, snap, `https://example.test/${tag}/entry-${n}`, n]);
      }
      const fakeFetch = (async () => new Response(JSON.stringify([['timestamp', 'statuscode'], ['20230715120000', '200']]),
        { status: 200 })) as unknown as typeof fetch;
      const archive = await backfillScorecardArchiveDates(pool, { fetchImpl: fakeFetch, intervalMs: 0 });
      assert.ok(archive.captured >= 2);

      const rows = (await pool.query<{ evidence_type: string; source_row: string; observed_on: string; observed_basis: string }>(
        `SELECT evidence_type, source_row, observed_on::text, observed_basis FROM senate_evidence_v
          WHERE bill_id=$1 OR (evidence_type LIKE 'scorecard_%' AND source_url LIKE 'https://example.test/${tag}%')
          ORDER BY evidence_type, source_url`, [bill])).rows;
      const pick = (type: string) => rows.filter((r) => r.evidence_type === type).map((r) => [r.observed_on, r.observed_basis]);
      // All four journal coauthors are now exposed independently of the XML scan.
      assert.deepEqual(pick('bill_coauthor'), Array.from({length:4},()=>['2023-01-12', 'journal.introduction']));
      // An XML posting assertion cannot date the currently captured body.
      assert.deepEqual(pick('bill_text_version'), [['2026-10-16', 'bill_text.fetched_at']]);
      assert.deepEqual(pick('scorecard_score'), [
        ['2026-10-16', 'scorecard.fetched_at'],
        ['2026-10-16', 'scorecard.fetched_at'],
      ]);
    } finally {
      await pool.end();
    }
  });
