import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Pool } from 'pg';

const integrationUrl = process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const openingDay = new Date('2027-01-01T12:00:00Z');
const preOpeningDay = new Date('2026-12-31T12:00:00Z');

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
    ...Array.from({ length: 195 }, (_, index) => {
      const id = 900001 + index;
      return `<a href="/legdb/fulldetail?id=${id}">Synthetic Legislator ${index + 1}</a>`;
    }),
    '</body></html>',
  ].join('\n');
}

function lrlDetailHtml(id: number): string {
  const index = id - 900001;
  if (index < 0 || index >= 195) throw new Error(`Unexpected synthetic LRL id ${id}`);
  const house = index < 130;
  const seat = house ? index + 1 : index - 129;
  return `<!doctype html><html><body>
    <h1>Synthetic Legislator ${index + 1} - Legislator Record</h1>
    <h2>95th Legislative Session (2027-2028)</h2>
    <p>Body</p><p>${house ? 'House' : 'Senate'}</p>
    <p>District</p><p>${seat}</p>
    <p>Party</p><p>${index % 2 === 0 ? 'Independent' : 'Republican'}</p>
    <p>Term of Office</p><p>01/01/2027 - 12/31/2028</p>
    <p>Oath Date</p><p>01/01/2027</p>
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

function statusXml(type: 'HF' | 'SF', number: number): string {
  const chamber = type === 'HF' ? 'HOUSE' : 'SENATE';
  const engrossed = type === 'HF';
  const passageObserved = type === 'HF' && number === 2;
  const padded = String(number).padStart(4, '0');
  return `<?xml version="1.0"?>
  <BILL>
    <FILE_TYPE>${type}</FILE_TYPE>
    <FILE_NUMBER>${number}</FILE_NUMBER>
    <TEXT_VERSION_LIST>
      <DOCUMENT>
        <HTML_URI>www.revisor.mn.gov/bills/95/${type}/${number}/versions/0/</HTML_URI>
        <DATE_INSERT>2027-01-01 08:00:00</DATE_INSERT>
        <DOCUMENT_NAME>2027.0-${type}${padded}-0</DOCUMENT_NAME>
        <DOCUMENT_TYPE>official</DOCUMENT_TYPE>
        <DOCUMENT_ENGROSSMENT>0</DOCUMENT_ENGROSSMENT>
      </DOCUMENT>
      ${engrossed ? `<DOCUMENT>
        <HTML_URI>www.revisor.mn.gov/bills/95/${type}/${number}/versions/1/</HTML_URI>
        <DATE_INSERT>2027-01-04 10:00:00</DATE_INSERT>
        <DOCUMENT_NAME>2027.0-${type}${padded}-1</DOCUMENT_NAME>
        <DOCUMENT_TYPE>official</DOCUMENT_TYPE>
        <DOCUMENT_ENGROSSMENT>1</DOCUMENT_ENGROSSMENT>
      </DOCUMENT>` : ''}
    </TEXT_VERSION_LIST>
    <ACTIONS>
      <${chamber}>
        <ACTION>
          <ACTION_NUMBER>1</ACTION_NUMBER>
          <ACTION_TEXT>Introduction and first reading, referred to committee</ACTION_TEXT>
          <ACTION_DATE>2027-01-02 00:00:00</ACTION_DATE>
        </ACTION>
        ${passageObserved ? `<ACTION>
          <ACTION_NUMBER>9</ACTION_NUMBER>
          <ACTION_TEXT>Bill was passed as amended</ACTION_TEXT>
          <ACTION_DATE>2027-01-05 00:00:00</ACTION_DATE>
        </ACTION>` : ''}
      </${chamber}>
    </ACTIONS>
  </BILL>`;
}

function billTextHtml(identifier: string): string {
  const text = `${identifier} synthetic legislative text for a disposable Opening Day rehearsal. `.repeat(4);
  return `<html><body><main><div id="document"><p>${text}</p></div></main></body></html>`;
}

function installSyntheticMinnesotaSources(): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(href);

    if (url.hostname === 'www.lrl.mn.gov' && url.pathname === '/legdb/results') {
      return new Response(lrlSearchHtml(), { status: 200, headers: { 'content-type': 'text/html' } });
    }
    if (url.hostname === 'www.lrl.mn.gov' && /\/legdb\/fulldetail(?:\.aspx)?$/i.test(url.pathname)) {
      const id = Number(url.searchParams.get('ID') ?? url.searchParams.get('id'));
      return new Response(lrlDetailHtml(id), { status: 200, headers: { 'content-type': 'text/html' } });
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
        return new Response(statusXml(type, Number(match[1])), {
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
    restoreFetch = installSyntheticMinnesotaSources();

    const dbModule = await import('../src/lib/db/index.js');
    appPool = dbModule.pool;
    const { ensureOpeningDaySessionMetadata, probeOpeningDaySources } = await import('../src/operations/opening-day-readiness.js');
    const { ingestLrlMembershipSession } = await import('../src/operations/lrl-membership-ingest.js');
    const { syncLiveRevisorUniverse } = await import('../src/operations/live-revisor-universe.js');
    const { syncLiveRevisorStatusBatch } = await import('../src/operations/live-revisor-status.js');
    const { backfillRevisorInitialTextBatch } = await import('../src/operations/revisor-initial-text-backfill.js');
    const { ensureProspectiveEvidenceForecasts } = await import('../src/operations/prospective-evidence.js');
    const { getMinnesotaHouseSession } = await import('../src/sources/minnesota/sessions.js');

    const prestart = await ensureOpeningDaySessionMetadata(preOpeningDay);
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
    assert.equal(sourceReadiness.lrl.legislatorRefs, 195);
    assert.equal(sourceReadiness.revisor.houseBillsInFirst500, 2);
    assert.equal(sourceReadiness.revisor.senateBillsInFirst500, 1);

    const rolled = await ensureOpeningDaySessionMetadata(openingDay);
    assert.equal(rolled.isCurrent, true);
    const currentSessions = await dbModule.pool.query<{ slug: string }>(`
      SELECT s.slug
        FROM legislative_sessions s
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       WHERE s.is_current = true
       ORDER BY s.slug
    `);
    assert.deepEqual(currentSessions.rows.map((row) => row.slug), ['2027-2028']);

    const session = getMinnesotaHouseSession('2027-2028');
    const roster = await ingestLrlMembershipSession(session, openingDay);
    assert.deepEqual(roster, { session: '2027-2028', records: 195, house: 130, senate: 65 });
    const rosterAgain = await ingestLrlMembershipSession(session, openingDay);
    assert.deepEqual(rosterAgain, roster);

    const membershipCounts = await dbModule.pool.query<{ chamber: string; members: string }>(`
      SELECT c.slug AS chamber, count(*)::text AS members
        FROM memberships m
        JOIN legislative_sessions s ON s.id = m.session_id AND s.slug = '2027-2028'
        JOIN chambers c ON c.id = m.chamber_id
       GROUP BY c.slug
       ORDER BY c.slug
    `);
    assert.deepEqual(membershipCounts.rows, [
      { chamber: 'house', members: '130' },
      { chamber: 'senate', members: '65' },
    ]);

    const universe = await syncLiveRevisorUniverse();
    assert.equal(universe.discoveredBills, 3);
    assert.equal(universe.insertedBills, 3);
    assert.equal(universe.finalUniverse, false);
    const universeAgain = await syncLiveRevisorUniverse();
    assert.equal(universeAgain.insertedBills, 0);
    assert.equal(universeAgain.updatedBills, 3);

    const status = await syncLiveRevisorStatusBatch();
    assert.equal(status.selected, 3);
    assert.equal(status.fetched, 3);
    assert.equal(status.failed, 0);
    assert.equal(status.engrossedBills, 2);
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
      { identifier: 'HF1', versionKind: 'engrossment', passageObserved: 'false', hasOutcome: false, hasInitialTextHash: true },
      { identifier: 'HF2', versionKind: 'engrossment', passageObserved: 'true', hasOutcome: false, hasInitialTextHash: true },
      { identifier: 'SF1', versionKind: 'introduction', passageObserved: 'false', hasOutcome: false, hasInitialTextHash: true },
    ]);

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
