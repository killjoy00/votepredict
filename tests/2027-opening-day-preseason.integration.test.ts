import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Pool } from 'pg';

const integrationUrl = process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const openingDay = new Date('2027-01-12T12:00:00Z');


function databaseUrl(base: string, database: string): string {
  const parsed = new URL(base);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

function runCleanMigrations(connectionString: string): void {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/migrate.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      DATABASE_URL_UNPOOLED: connectionString,
    },
    encoding: 'utf8',
  });
  assert.equal(
    result.status,
    0,
    `clean rehearsal migrations failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

function lrlSearchHtml(): string {
  return [
    '<html><body>',
    ...Array.from({ length: 201 }, (_, index) => {
      const id = 900001 + index;
      return `<a href="/legdb/fulldetail?id=${id}">Synthetic Legislator ${index + 1}</a>`;
    }),
    '</body></html>',
  ].join('\n');
}

function lrlDetailHtml(id: number): string {
  const index = id - 900001;
  if (index < 0 || index >= 201) throw new Error(`Unexpected synthetic LRL id ${id}`);
  const house = index < 134;
  const seat = house ? `${Math.floor(index / 2) + 1}${index % 2 === 0 ? 'A' : 'B'}` : String(index - 133);
  return `<!doctype html><html><body>
    <h1>Synthetic Legislator ${index + 1} - Legislator Record</h1>
    <h2>95th Legislative Session (2027-2028)</h2>
    <p>Body</p><p>${house ? 'House' : 'Senate'}</p>
    <p>District</p><p>${seat}</p>
    <p>Party</p><p>${index % 2 === 0 ? 'Independent' : 'Republican'}</p>
    <p>Term of Office</p><p>01/04/2027 - 12/31/2028</p>
    <p>Oath Date</p><p>01/12/2027</p>
  </body></html>`;
}

function billSearchXml(body: 'House' | 'Senate', range: string): string {
  if (range !== '1-500') return '<?xml version="1.0"?><SEARCH_RESULTS></SEARCH_RESULTS>';
  const bills = body === 'House'
    ? [
        { type: 'HF', number: 1, description: 'Synthetic eligible bill.' },
        { type: 'HF', number: 2, description: 'Synthetic passage-blocked bill.' },
      ]
    : [
        { type: 'SF', number: 1, description: 'Synthetic Senate bill.' },
      ];
  return `<?xml version="1.0"?><SEARCH_RESULTS>${bills.map((bill) => `
    <BILL_RESULT>
      <FILE_TYPE>${bill.type}</FILE_TYPE>
      <FILE_NUMBER>${bill.number}</FILE_NUMBER>
      <STATUS_XML_URI>api.revisor.mn.gov/bills/v1/95/2027/0/${bill.type}/${bill.number}/</STATUS_XML_URI>
      <LATEST_TEXT_HTML_URI>www.revisor.mn.gov/bills/95/2027/0/${bill.type}/${bill.number}/latest/</LATEST_TEXT_HTML_URI>
      <DESCRIPTION>${bill.description}</DESCRIPTION>
    </BILL_RESULT>`).join('')}
  </SEARCH_RESULTS>`;
}

function statusXml(type: 'HF' | 'SF', number: number, hf1Engrossment = 0): string {
  const chamber = type === 'HF' ? 'HOUSE' : 'SENATE';
  const engrossed = type === 'HF' && (number !== 1 || hf1Engrossment >= 1);
  const passageObserved = type === 'HF' && number === 2;
  const padded = String(number).padStart(4, '0');
  return `<?xml version="1.0"?>
  <BILL>
    <FILE_TYPE>${type}</FILE_TYPE>
    <FILE_NUMBER>${number}</FILE_NUMBER>
    <TEXT_VERSION_LIST>
      <DOCUMENT>
        <HTML_URI>www.revisor.mn.gov/bills/95/${type}/${number}/versions/0/</HTML_URI>
        <DATE_INSERT>2027-01-11 08:00:00</DATE_INSERT>
        <DOCUMENT_NAME>2027.0-${type}${padded}-0</DOCUMENT_NAME>
        <DOCUMENT_TYPE>official</DOCUMENT_TYPE>
        <DOCUMENT_ENGROSSMENT>0</DOCUMENT_ENGROSSMENT>
      </DOCUMENT>
      ${engrossed ? `<DOCUMENT>
        <HTML_URI>www.revisor.mn.gov/bills/95/${type}/${number}/versions/1/</HTML_URI>
        <DATE_INSERT>2027-01-20 10:00:00</DATE_INSERT>
        <DOCUMENT_NAME>2027.0-${type}${padded}-1</DOCUMENT_NAME>
        <DOCUMENT_TYPE>official</DOCUMENT_TYPE>
        <DOCUMENT_ENGROSSMENT>1</DOCUMENT_ENGROSSMENT>
      </DOCUMENT>` : ''}
      ${type === 'HF' && number === 1 && hf1Engrossment >= 2 ? `<DOCUMENT>
        <HTML_URI>www.revisor.mn.gov/bills/95/HF/1/versions/2/</HTML_URI>
        <DATE_INSERT>2027-02-02 10:00:00</DATE_INSERT>
        <DOCUMENT_NAME>2027.0-HF0001-2</DOCUMENT_NAME>
        <DOCUMENT_TYPE>official</DOCUMENT_TYPE>
        <DOCUMENT_ENGROSSMENT>2</DOCUMENT_ENGROSSMENT>
      </DOCUMENT>` : ''}
    </TEXT_VERSION_LIST>
    <ACTIONS>
      <${chamber}>
        <ACTION>
          <ACTION_NUMBER>1</ACTION_NUMBER>
          <ACTION_TEXT>Introduction and first reading, referred to committee</ACTION_TEXT>
          <ACTION_DATE>2027-01-12 00:00:00</ACTION_DATE>
        </ACTION>
        ${passageObserved ? `<ACTION>
          <ACTION_NUMBER>9</ACTION_NUMBER>
          <ACTION_TEXT>Bill was passed as amended</ACTION_TEXT>
          <ACTION_DATE>2027-01-21 00:00:00</ACTION_DATE>
        </ACTION>` : ''}
      </${chamber}>
    </ACTIONS>
  </BILL>`;
}

function billTextHtml(identifier: string): string {
  const text = `${identifier} synthetic legislative text for a disposable Opening Day rehearsal. `.repeat(4);
  return `<html><body><main><div id="document"><p>${text}</p></div></main></body></html>`;
}

function installSyntheticMinnesotaSources(options: { missingSenateDetails: number; duplicateHouseDistrict?: boolean; wrongBillStatus?: boolean; hf1Engrossment?: number } = { missingSenateDetails: 0 }): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(href);

    if (url.hostname === 'www.lrl.mn.gov' && url.pathname === '/legdb/results') {
      return new Response(lrlSearchHtml(), { status: 200, headers: { 'content-type': 'text/html' } });
    }
    if (url.hostname === 'www.lrl.mn.gov' && /\/legdb\/fulldetail(?:\.aspx)?$/i.test(url.pathname)) {
      const id = Number(url.searchParams.get('ID') ?? url.searchParams.get('id'));
      const original = lrlDetailHtml(id);
      const html = options.duplicateHouseDistrict && id === 900002 ? original.replace('<p>1B</p>', '<p>1A</p>') : original;
      const detail = id >= 900001 + 201 - options.missingSenateDetails
        ? html.replace('95th Legislative Session (2027-2028)', '94th Legislative Session (2025-2026)')
        : html;
      return new Response(detail, { status: 200, headers: { 'content-type': 'text/html' } });
    }
    if (url.hostname === 'www.revisor.mn.gov' && url.pathname === '/bills/status_result.php') {
      const body = url.searchParams.get('body');
      if (body !== 'House' && body !== 'Senate') throw new Error(`Unexpected Revisor body ${body}`);
      return new Response(billSearchXml(body, url.searchParams.get('bill') ?? ''), {
        status: 200,
        headers: { 'content-type': 'application/xml' },
      });
    }
    if (url.hostname === 'api.revisor.mn.gov') {
      const match = url.pathname.match(/\/HF\/(\d+)\/$/i) ?? url.pathname.match(/\/SF\/(\d+)\/$/i);
      const type = url.pathname.includes('/HF/') ? 'HF' : url.pathname.includes('/SF/') ? 'SF' : null;
      if (match && type) {
        const xml = options.wrongBillStatus && type === 'HF' && Number(match[1]) === 1
          ? statusXml('HF', 2) : statusXml(type, Number(match[1]), options.hf1Engrossment);
        return new Response(xml, {
          status: 200,
          headers: { 'content-type': 'application/xml' },
        });
      }
    }
    if (url.hostname === 'www.revisor.mn.gov') {
      const match = url.pathname.match(/\/bills\/95\/(HF|SF)\/(\d+)\/versions\/0\/$/i);
      if (match) {
        return new Response(billTextHtml(`${match[1].toUpperCase()}${Number(match[2])}`), {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
    }
    throw new Error(`Unexpected network request during Opening Day rehearsal: ${href}`);
  }) as typeof fetch;
  return () => { globalThis.fetch = originalFetch; };
}

test('clean database rehearses 2027 session rollover, official-source bootstrap, and prospective cohort', { skip: !integrationUrl }, async () => {
  if (!['localhost', '127.0.0.1'].includes(new URL(integrationUrl!).hostname)) {
    throw new Error('Opening Day preseason rehearsal requires local disposable PostgreSQL');
  }

  const databaseName = `votepredict_preseason_${process.pid}_${Date.now()}`;
  const admin = new Pool({ connectionString: databaseUrl(integrationUrl!, 'postgres'), max: 1 });
  const rehearsalUrl = databaseUrl(integrationUrl!, databaseName);
  let appPool: { end(): Promise<void> } | undefined;
  let restoreFetch: (() => void) | undefined;

  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    runCleanMigrations(rehearsalUrl);

    process.env.DATABASE_URL = rehearsalUrl;
    process.env.DATABASE_URL_UNPOOLED = rehearsalUrl;
    const sourceFixture = { missingSenateDetails: 0, duplicateHouseDistrict: false, wrongBillStatus: false, hf1Engrossment: 0 };
    restoreFetch = installSyntheticMinnesotaSources(sourceFixture);

    const dbModule = await import('../src/lib/db/index.js');
    appPool = dbModule.pool;
    const { ensureOpeningDaySessionMetadata, probeOpeningDaySources, runOpeningDayReadiness } = await import('../src/operations/opening-day-readiness.js');
    const { ingestLrlMembershipSession } = await import('../src/operations/lrl-membership-ingest.js');
    const { syncLiveRevisorUniverse } = await import('../src/operations/live-revisor-universe.js');
    const { syncLiveRevisorStatusBatch } = await import('../src/operations/live-revisor-status.js');
    const { backfillRevisorInitialTextBatch } = await import('../src/operations/revisor-initial-text-backfill.js');
    const { ensureProspectiveEvidenceForecasts } = await import('../src/operations/prospective-evidence.js');
    const { getMinnesotaHouseSession } = await import('../src/sources/minnesota/sessions.js');

    const prestart = await ensureOpeningDaySessionMetadata();
    assert.equal(prestart.slug, '2027-2028');
    assert.equal(prestart.isCurrent, false);

    await dbModule.pool.query(`
      INSERT INTO legislative_sessions (jurisdiction_id, slug, name, starts_on, ends_on, is_current)
      SELECT id, '2025-2026', '94th Legislature (2025-2026)', '2025-01-01', '2026-12-31', true
        FROM jurisdictions
       WHERE slug = 'us-mn'
      ON CONFLICT (jurisdiction_id, slug) DO UPDATE SET is_current = true
    `);

    const sourceReadiness = await probeOpeningDaySources(openingDay);
    assert.equal(sourceReadiness.readyForLiveBootstrap, true);
    assert.equal(sourceReadiness.failClosed, false);
    assert.equal(sourceReadiness.lrl.legislatorRefs, 201);
    assert.equal(sourceReadiness.revisor.houseBillsInFirst500, 2);
    assert.equal(sourceReadiness.revisor.senateBillsInFirst500, 1);

    const session = getMinnesotaHouseSession('2027-2028');
    const assertNoPartialRollover = async () => {
      const state = await dbModule.pool.query<{ slug: string; is_current: boolean; memberships: string }>(`
        SELECT s.slug, s.is_current, count(m.id)::text AS memberships
          FROM legislative_sessions s
          JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
          LEFT JOIN memberships m ON m.session_id = s.id
         WHERE s.slug IN ('2025-2026', '2027-2028')
         GROUP BY s.id ORDER BY s.slug
      `);
      assert.deepEqual(state.rows, [
        { slug: '2025-2026', is_current: true, memberships: '0' },
        { slug: '2027-2028', is_current: false, memberships: '0' },
      ]);
    };

    // Even after convening, the readiness probe only stages metadata.
    const readiness = await runOpeningDayReadiness(openingDay);
    assert.equal(readiness.sessionMetadata.isCurrent, false);
    assert.equal(readiness.sourceReadiness.readyForLiveBootstrap, true);
    await assertNoPartialRollover();

    // A plausible search result can hide missing current-session detail pages.
    sourceFixture.missingSenateDetails = 5;
    await assert.rejects(ingestLrlMembershipSession(session, openingDay), /implausible membership coverage: House=134, Senate=62/);
    await assertNoPartialRollover();
    sourceFixture.missingSenateDetails = 0;
    // A 201-person roster can still omit a seat or claim it twice.
    sourceFixture.duplicateHouseDistrict = true;
    await assert.rejects(ingestLrlMembershipSession(session, openingDay), /2027 opening roster integrity failed/);
    await assertNoPartialRollover();
    sourceFixture.duplicateHouseDistrict = false;

    // Force a database error after at least one membership write. The rollover
    // and all membership writes must roll back together in the disposable DB.
    await dbModule.pool.query(`
      CREATE FUNCTION preseason_reject_membership() RETURNS trigger LANGUAGE plpgsql AS $preseason$
      BEGIN
        IF NEW.district = '2A' THEN RAISE EXCEPTION 'synthetic membership write failure'; END IF;
        RETURN NEW;
      END; $preseason$;
      CREATE TRIGGER preseason_reject_membership BEFORE INSERT ON memberships
      FOR EACH ROW EXECUTE FUNCTION preseason_reject_membership();
    `);
    try {
      await assert.rejects(ingestLrlMembershipSession(session, openingDay), /synthetic membership write failure/);
      await assertNoPartialRollover();
    } finally {
      await dbModule.pool.query('DROP TRIGGER preseason_reject_membership ON memberships; DROP FUNCTION preseason_reject_membership()');
    }

    const roster = await ingestLrlMembershipSession(session, openingDay);
    assert.deepEqual(roster, { session: '2027-2028', records: 201, house: 134, senate: 67 });
    const rolled = await ensureOpeningDaySessionMetadata();
    assert.equal(rolled.isCurrent, true);
    const currentSessions = await dbModule.pool.query<{ slug: string }>(`
      SELECT s.slug
        FROM legislative_sessions s
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       WHERE s.is_current = true
       ORDER BY s.slug
    `);
    assert.deepEqual(currentSessions.rows.map((row) => row.slug), ['2027-2028']);

    const rosterAgain = await ingestLrlMembershipSession(session, openingDay);
    assert.deepEqual(rosterAgain, roster);
    // An out-of-order replay before term start must not deactivate the committed session.
    await ingestLrlMembershipSession(session, new Date('2027-01-03T12:00:00Z'));
    assert.equal((await ensureOpeningDaySessionMetadata()).isCurrent, true);

    const membershipCounts = await dbModule.pool.query<{ chamber: string; members: string }>(`
      SELECT c.slug AS chamber, count(*)::text AS members
        FROM memberships m
        JOIN legislative_sessions s ON s.id = m.session_id AND s.slug = '2027-2028'
        JOIN chambers c ON c.id = m.chamber_id
       GROUP BY c.slug
       ORDER BY c.slug
    `);
    assert.deepEqual(membershipCounts.rows, [
      { chamber: 'house', members: '134' },
      { chamber: 'senate', members: '67' },
    ]);

    const universe = await syncLiveRevisorUniverse();
    assert.equal(universe.discoveredBills, 3);
    assert.equal(universe.insertedBills, 3);
    assert.equal(universe.finalUniverse, false);
    const universeAgain = await syncLiveRevisorUniverse();
    assert.equal(universeAgain.insertedBills, 0);
    assert.equal(universeAgain.updatedBills, 3);

    // A wrong bill response is rejected, recorded as a failed attempt, and
    // does not keep an unattempted bill out of the next bounded batch.
    sourceFixture.wrongBillStatus = true;
    const rejected = await syncLiveRevisorStatusBatch(1);
    assert.equal(rejected.selected, 1);
    assert.equal(rejected.fetched, 0);
    assert.equal(rejected.failed, 1);
    assert.equal(rejected.failures[0].identifier, 'HF1');
    assert.match(rejected.failures[0].message, /does not identify the requested bill/);
    const rejectedState = await dbModule.pool.query<{ fetched: string|null; attempted: string|null; state: string|null }>(
      `SELECT metadata #>> '{revisorLiveStatus,fetchedAt}' AS fetched,
              metadata #>> '{revisorLiveStatusAttempt,attemptedAt}' AS attempted,
              metadata #>> '{revisorLiveStatusAttempt,state}' AS state FROM bills WHERE identifier='HF1'`);
    assert.equal(rejectedState.rows[0].fetched, null);
    assert.ok(rejectedState.rows[0].attempted);
    assert.equal(rejectedState.rows[0].state, 'failed');
    const healthy = await syncLiveRevisorStatusBatch(1);
    assert.equal(healthy.fetched, 1);
    assert.equal(healthy.failed, 0);
    sourceFixture.wrongBillStatus = false;
    const status = await syncLiveRevisorStatusBatch();
    assert.equal(status.selected, 3);
    assert.equal(status.fetched, 3);
    assert.equal(status.failed, 0);
    assert.equal(status.engrossedBills, 1);
    assert.equal(status.passageActionsObserved, 1);

    const firstBackfill = await backfillRevisorInitialTextBatch();
    assert.equal(firstBackfill.processed, 3);
    const secondBackfill = await backfillRevisorInitialTextBatch();
    assert.deepEqual(secondBackfill, { processed: 0, done: true });

    const billState = await dbModule.pool.query<{
      identifier: string;
      version_kind: string | null;
      passage_observed: string | null;
      outcome: string | null;
      initial_text_hash: string | null;
    }>(`
      SELECT b.identifier,
             b.metadata #>> '{revisorLiveStatus,currentVersionKind}' AS version_kind,
             b.metadata #>> '{revisorLiveStatus,passageActionObserved}' AS passage_observed,
             b.metadata #>> '{sourceChamberPassage,outcome}' AS outcome,
             bv.text_hash AS initial_text_hash
        FROM bills b
        JOIN legislative_sessions s ON s.id = b.session_id AND s.slug = '2027-2028'
        LEFT JOIN bill_versions bv
          ON bv.bill_id = b.id
         AND bv.version_key = b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
       ORDER BY b.identifier
    `);
    assert.deepEqual(billState.rows.map((row) => ({
      identifier: row.identifier,
      versionKind: row.version_kind,
      passageObserved: row.passage_observed,
      hasOutcome: row.outcome !== null,
      hasInitialTextHash: Boolean(row.initial_text_hash),
    })), [
      { identifier: 'HF1', versionKind: 'introduction', passageObserved: 'false', hasOutcome: false, hasInitialTextHash: true },
      { identifier: 'HF2', versionKind: 'engrossment', passageObserved: 'true', hasOutcome: false, hasInitialTextHash: true },
      { identifier: 'SF1', versionKind: 'introduction', passageObserved: 'false', hasOutcome: false, hasInitialTextHash: true },
    ]);

    const target = (await dbModule.pool.query<{id: string; session_id: string; originating_chamber_id: string; title: string}>(
      "SELECT id,session_id,originating_chamber_id,title FROM bills WHERE identifier='HF1' AND session_id=(SELECT id FROM legislative_sessions WHERE slug='2027-2028')"
    )).rows[0];
    const { forecastSourceChamberPassageAtIntroduction } = await import('../src/forecasting/introduction-runtime.js');
    const intro = await forecastSourceChamberPassageAtIntroduction(target.id);
    assert.equal(intro.targetKind, 'source_chamber_passage');
    assert.equal(intro.asOfIntroduction, '2027-01-12');
    assert.equal(intro.model.frozen, true);
    assert.ok(intro.probability >= 0 && intro.probability <= 1);
    assert.equal((await ensureProspectiveEvidenceForecasts()).seededForecasts, 0,
      'the separate introduction forecast does not enroll a pre-engrossment bill in the Quick cohort');

    sourceFixture.hf1Engrossment = 1;
    const firstEngrossment = await syncLiveRevisorStatusBatch();
    assert.equal(firstEngrossment.failed, 0);
    assert.equal(firstEngrossment.engrossedBills, 2);

    // A failed fresh observation must not seed a new forecast from an old
    // successful snapshot. After recovery the original valid bill is eligible.
    sourceFixture.wrongBillStatus = true;
    const failedRefresh = await syncLiveRevisorStatusBatch();
    assert.equal(failedRefresh.failed, 1);
    assert.equal((await ensureProspectiveEvidenceForecasts()).seededForecasts, 0);
    sourceFixture.wrongBillStatus = false;
    assert.equal((await syncLiveRevisorStatusBatch()).failed, 0);
    const seeded = await ensureProspectiveEvidenceForecasts();
    assert.equal(seeded.session, '2027-2028');
    assert.equal(seeded.seededForecasts, 1);
    assert.deepEqual(seeded.forecasts.map((row) => row.identifier), ['HF1']);
    const reseeded = await ensureProspectiveEvidenceForecasts();
    assert.equal(reseeded.seededForecasts, 0);

    const scheduled = await dbModule.pool.query<{
      identifier: string;
      enabled: boolean;
      cadence_hours: number;
      research_mode: string;
    }>(`
      SELECT b.identifier, fs.enabled, fs.cadence_hours, fs.research_mode
        FROM forecasts f
        JOIN forecast_schedules fs ON fs.forecast_id = f.id
        JOIN bills b ON b.id = f.bill_id
       WHERE f.owner_user_id = 'system:prospective-evidence-v1'
       ORDER BY b.identifier
    `);
    assert.deepEqual(scheduled.rows, [
      { identifier: 'HF1', enabled: true, cadence_hours: 24, research_mode: 'quick' },
    ]);

    // Continue in the SAME clean, migrated database. The historical analogy,
    // evidence and outcomes below are synthetic test records, not real votes.
    const db = dbModule.pool;
    const { executeQuickRuntimeForecast } = await import('../src/forecasting/quick-runtime.js');
    const { retainedTargetTextAsOf } = await import('../src/forecasting/runtime-bill-text.js');
    const { getQuickEvidenceProspectiveScorecard } = await import('../src/operations/quick-evidence-prospective-scorecard.js');
    const { resolveSafeForecastOutcome } = await import('../src/operations/safe-resolution.js');
    const priorSession = (await db.query<{id: string}>("SELECT id FROM legislative_sessions WHERE slug='2025-2026'")).rows[0].id;
    const chamber = target.originating_chamber_id;
    const firstText = ('Section 1. School districts shall establish a teacher education grant program. ' +
      'The commissioner of education shall report on student instruction, school grants, and teacher training. ').repeat(4);
    const secondText = firstText + 'Section 2. Each school district shall publish an additional annual grant report.';
    const historical = (await db.query<{id: string}>(`
      INSERT INTO bills(session_id,originating_chamber_id,identifier,title,status)
      VALUES($1,$2,'HF9000',$3,'Passed') RETURNING id`, [priorSession,chamber,target.title])).rows[0].id;
    const priorVersion = (await db.query<{id: string}>(`
      INSERT INTO bill_versions(bill_id,version_key,published_at,text_url,raw_text)
      VALUES($1,'synthetic-prior','2026-03-01T10:00:00Z','https://fixture.invalid/prior',$2) RETURNING id`,
      [historical,firstText])).rows[0].id;
    const storeFixtureObservation = async (billId: string, versionId: string, versionKey: string,
      text: string, published: string, observed: string) => {
      const digest = createHash('sha256').update(text).digest('hex');
      const sourceUrl = 'https://fixture.invalid/text/' + versionKey;
      await db.query(`INSERT INTO evidence_content_blobs(sha256,body,media_type)
        VALUES($1,$2,'text/plain; charset=utf-8') ON CONFLICT(sha256) DO NOTHING`, [digest,Buffer.from(text)]);
      // Both clocks are explicitly synthetic in this disposable database.
      // Keep the migrated acceptance-clock constraint intact.
      await db.query(`INSERT INTO forecast_bill_text_observations(bill_id,bill_version_id,version_key,source_url,
        text_sha256,claimed_published_at,observed_at,accepted_at,title)
        VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8)`, [billId,versionId,versionKey,sourceUrl,digest,published,observed,target.title]);
      return digest;
    };
    await storeFixtureObservation(historical,priorVersion,'synthetic-prior',firstText,
      '2026-03-01T10:00:00Z','2026-03-02T10:00:00Z');
    await db.query(`INSERT INTO memberships(session_id,chamber_id,legislator_id,district,party,title,starts_on,ends_on)
      SELECT $1,chamber_id,legislator_id,district,party,title,'2025-01-01','2026-12-31'
        FROM memberships WHERE session_id=$2 AND chamber_id=$3`, [priorSession,target.session_id,chamber]);
    const makeVote = async (sessionId: string, billId: string, key: string, occurredOn: string, yes: number) => {
      const sourceId = (await db.query<{id:string}>(`
        INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,fetched_at,content_sha256)
        SELECT jurisdiction_id,$1,$2,'house_vote_detail',$3,$4::date + interval '18 hours',$5
          FROM legislative_sessions WHERE id=$1 RETURNING id`, [sessionId,chamber,'https://fixture.invalid/vote/'+key,
            occurredOn,createHash('sha256').update(key).digest('hex')])).rows[0].id;
      const eventId = (await db.query<{id:string}>(`
        INSERT INTO vote_events(session_id,chamber_id,bill_id,source_document_id,external_key,vote_kind,motion_text,
          occurred_on,yea_count,nay_count,passed,is_passage)
        VALUES($1,$2,$3,$4,$5,'passage','Synthetic floor passage',$6,$7,$8,true,true) RETURNING id`,
        [sessionId,chamber,billId,sourceId,key,occurredOn,yes,134-yes])).rows[0].id;
      await db.query(`INSERT INTO member_votes(vote_event_id,membership_id,source_member_name,normalized_member_name,choice)
        SELECT $1,m.id,l.name,l.normalized_name,CASE WHEN row_number() OVER(ORDER BY m.district,l.id) <= $4 THEN 'yea' ELSE 'nay' END
          FROM memberships m JOIN legislators l ON l.id=m.legislator_id
         WHERE m.session_id=$2 AND m.chamber_id=$3`, [eventId,sessionId,chamber,yes]);
      return eventId;
    };
    const historicalVote = await makeVote(priorSession,historical,'synthetic-2026-passage','2026-03-05',80);
    const currentVersion = async (ordinal: number) => {
      const key = '2027.0-HF0001-'+ordinal;
      const result = await db.query<{id:string;version_key:string}>(
        'SELECT id,version_key FROM bill_versions WHERE bill_id=$1 AND version_key=$2',[target.id,key]);
      assert.equal(result.rows.length,1);
      return result.rows[0];
    };
    const initialVersion = await currentVersion(0);
    const version1 = await currentVersion(1);
    const initialHash = billState.rows.find(row=>row.identifier==='HF1')!.initial_text_hash;
    const hash1 = await storeFixtureObservation(target.id,version1.id,version1.version_key,firstText,
      '2027-01-20T10:00:00Z','2027-01-20T12:00:00Z');
    const request = {
      forecastId: seeded.forecasts[0].forecastId, chamberId: chamber, chamberSlug:'house', chamberName:'House',
      subject:{kind:'bill' as const,billId:target.id,identifier:'HF1',title:target.title,sessionId:target.session_id,sessionSlug:'2027-2028'},
      researchMode:'quick' as const, asOf:'2027-02-01T12:00:00Z',
    };
    // The real Quick runtime uses retained text and dated historical support,
    // not stubbed probabilities or an external model/API.
    const first = await executeQuickRuntimeForecast(request);
    assert.equal(first.revisionNumber,1);
    assert.equal(first.modelVersion,'member-eb-v1.2-decay180');
    assert.equal(first.members.length,134);
    assert.ok(first.members.every(m=>typeof m.yesProbability==='number'));
    assert.ok(first.analogues.some(item=>item.voteEventId===historicalVote));
    const sealedRevision = async (revisionId:string) => {
      const revision = (await db.query(`
        SELECT r.*,m.manifest_json,m.manifest_sha256 FROM forecast_revisions r
        JOIN forecast_input_manifests m ON m.revision_id=r.id WHERE r.id=$1`,[revisionId])).rows[0];
      const members = (await db.query('SELECT * FROM forecast_member_predictions WHERE revision_id=$1 ORDER BY membership_id',[revisionId])).rows;
      assert.equal(members.length,134);
      assert.equal(createHash('sha256').update(revision.manifest_json).digest('hex'),revision.manifest_sha256);
      const capture = (await db.query<{status:string}>(`SELECT status FROM forecast_capture_attempts
        WHERE revision_id=$1 AND capture_kind='quick_evidence' ORDER BY sequence DESC LIMIT 1`,[revisionId])).rows[0];
      assert.equal(capture?.status,'completed');
      assert.ok(members.every(row=>row.context.some((item:Record<string,unknown>)=>item.kind==='quick_evidence_shadow')));
      return {revision,members};
    };
    const sealedFirst = await sealedRevision(first.revisionId);
    assert.equal(sealedFirst.revision.bill_version_id,version1.id);
    assert.equal(JSON.parse(sealedFirst.revision.manifest_json).target.textSha256,hash1);
    assert.equal((await getQuickEvidenceProspectiveScorecard(db)).cohort.resolvedForecastsInScope,0);

    // Ingest a later official engrossment and retain distinct content.
    sourceFixture.hf1Engrossment = 2;
    assert.equal((await syncLiveRevisorStatusBatch()).failed,0);
    const version2 = await currentVersion(2);
    const hash2 = await storeFixtureObservation(target.id,version2.id,version2.version_key,secondText,
      '2027-02-02T10:00:00Z','2027-02-02T12:00:00Z');
    assert.notEqual(hash2,hash1);
    assert.equal((await retainedTargetTextAsOf(db,target.id,request.asOf))?.textSha256,hash1);
    assert.deepEqual(await forecastSourceChamberPassageAtIntroduction(target.id),intro,
      'an amendment must not change the frozen introduction-stage forecast');
    assert.equal((await db.query<{text_hash:string}>('SELECT text_hash FROM bill_versions WHERE id=$1',[initialVersion.id])).rows[0].text_hash,initialHash);
    assert.equal((await ensureProspectiveEvidenceForecasts()).seededForecasts,0);

    const second = await executeQuickRuntimeForecast({...request,asOf:'2027-02-03T12:00:00Z'});
    assert.equal(second.revisionNumber,2);
    assert.equal(second.modelVersion,first.modelVersion);
    const sealedSecond = await sealedRevision(second.revisionId);
    assert.equal(sealedSecond.revision.bill_version_id,version2.id);
    assert.equal(JSON.parse(sealedSecond.revision.manifest_json).target.textSha256,hash2);
    assert.deepEqual(await sealedRevision(first.revisionId),sealedFirst,
      'a later official version and revision must not rewrite the first revision, inputs or evidence');

    // Make a synthetic recorded final roll call only after the valid revisions.
    const outcome = await makeVote(target.session_id,target.id,'synthetic-2027-passage','2027-02-05',78);
    await resolveSafeForecastOutcome({forecastId:request.forecastId,ownerUserId:'system:prospective-evidence-v1',voteEventId:outcome});
    const scorecard = await getQuickEvidenceProspectiveScorecard(db);
    assert.equal(scorecard.cohort.selectedStrictlyPreVoteCases,1);
    assert.equal(scorecard.minimums.memberOutcomes.observed,134);
    assert.equal(scorecard.primaryScoringAllowed,false);
    assert.equal(scorecard.metrics,null);
    assert.equal((await db.query<{enabled:boolean}>('SELECT enabled FROM forecast_schedules WHERE forecast_id=$1',[request.forecastId])).rows[0].enabled,false);
    assert.deepEqual(await sealedRevision(first.revisionId),sealedFirst);
    assert.deepEqual(await sealedRevision(second.revisionId),sealedSecond);
    assert.equal((await ensureProspectiveEvidenceForecasts()).seededForecasts,0);
    // Synthetic replay metrics only: no serving or primary protocol change.
    assert.equal((await getQuickEvidenceProspectiveScorecard(db,{revealMetrics:true})).metrics?.memberOutcomes,134);
  } finally {
    restoreFetch?.();
    await appPool?.end().catch(() => undefined);
    await admin.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [databaseName],
    ).catch(() => undefined);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => undefined);
    await admin.end();
  }
});
