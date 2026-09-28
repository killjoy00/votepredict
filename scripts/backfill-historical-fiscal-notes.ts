import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const FISCAL_SEARCH_BASE_URL = 'https://mn.gov/mmbapps/fnsearchlbo/';
const MAX_FISCAL_PAGE_BYTES = 20_000_000;
const TARGET_SESSIONS = [
  { slug: '2021-2022', startYear: 2021 },
  { slug: '2023-2024', startYear: 2023 },
  { slug: '2025-2026', startYear: 2025 },
] as const;
let secrets: string[] = [];

type TargetBill = {
  bill_id: string;
  identifier: string;
  session_slug: (typeof TARGET_SESSIONS)[number]['slug'];
  session_start_year: number;
  first_vote_on: string;
};

type FiscalHtmlPage = {
  sourceUrl: string;
  rawContent: string;
  contentSha256: string;
  fetchedAt: string;
  httpStatus: number;
  cookieHeader?: string;
};

function mask(value: string) {
  if (value.length > 3) {
    console.log(
      '::add-mask::'
      + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'),
    );
  }
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(item => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1800);
}

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');
  async function works(value: string) {
    const candidate = new Pool({
      connectionString: value,
      max: 1,
      connectionTimeoutMillis: 8000,
    });
    try {
      await candidate.query('select 1');
      return true;
    } catch {
      return false;
    } finally {
      await candidate.end().catch(() => undefined);
    }
  }

  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await works(value)) return value;
  }

  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET unavailable');
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + secret },
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

function freshness(date: string) {
  const ageDays = (Date.now() - new Date(date + 'T00:00:00.000Z').getTime()) / 86_400_000;
  return ageDays <= 365 ? 'current' as const : ageDays <= 1095 ? 'recent' as const : 'stale' as const;
}

function assertFiscalHost(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (!(host === 'mn.gov' || host.endsWith('.mn.gov'))) {
    throw new Error('Fiscal-note source redirected away from mn.gov to ' + host);
  }
  if (url.protocol !== 'https:') throw new Error('Fiscal-note source must use HTTPS');
  return url;
}

async function readLimitedBody(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_FISCAL_PAGE_BYTES) {
    throw new Error('Fiscal-note response exceeds maximum expected size');
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.byteLength;
    if (total > MAX_FISCAL_PAGE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error('Fiscal-note response exceeds maximum expected size');
    }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function responseCookies(response: Response): string | undefined {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  let values = headers.getSetCookie?.() ?? [];
  if (values.length === 0) {
    const combined = response.headers.get('set-cookie');
    if (combined) values = combined.split(/,(?=\s*[^;,=]+=[^;,]+)/);
  }
  const pairs = values
    .map(value => value.split(';', 1)[0]?.trim())
    .filter((value): value is string => Boolean(value && value.includes('=')));
  return pairs.length > 0 ? pairs.join('; ') : undefined;
}

async function fetchFiscalHtml(input: {
  url: string;
  method: 'GET' | 'POST';
  body?: string;
  cookieHeader?: string;
  referer?: string;
}): Promise<FiscalHtmlPage> {
  const url = assertFiscalHost(input.url);
  const headers: Record<string, string> = {
    'user-agent': 'VotePredict/2.0 historical-fiscal-note-session-snapshot',
    accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
  };
  if (input.cookieHeader) headers.cookie = input.cookieHeader;
  if (input.referer) headers.referer = input.referer;
  if (input.method === 'POST') {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    headers.origin = 'https://mn.gov';
  }

  const response = await fetch(url, {
    method: input.method,
    headers,
    body: input.method === 'POST' ? input.body : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(45_000),
  });

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location) throw new Error('Fiscal-note source redirected without Location');
    const redirected = new URL(location, url).toString();
    assertFiscalHost(redirected);
    throw new Error('Fiscal-note search returned unexpected redirect');
  }
  if (!response.ok) throw new Error('Fiscal-note search returned HTTP ' + response.status);
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new Error('Fiscal-note search returned unexpected content type');
  }
  const bytes = await readLimitedBody(response);
  if (bytes.byteLength < 200) throw new Error('Fiscal-note search returned too little content');
  const rawContent = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes)
    .replace(/\u0000/g, '');
  return {
    sourceUrl: url.toString(),
    rawContent,
    contentSha256: createHash('sha256').update(bytes).digest('hex'),
    fetchedAt: new Date().toISOString(),
    httpStatus: response.status,
    cookieHeader: responseCookies(response),
  };
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('Production env file required');
  const env = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  secrets = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secrets.forEach(mask);

  process.env.DATABASE_URL = await chooseDb(env);
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  const { persistDurableEvidence } = await import('../src/evidence/durable-ingestion.js');
  const {
    HISTORICAL_FISCAL_NOTE_PARSER_VERSION,
    HISTORICAL_FISCAL_NOTE_PUBLICATION_POLICY_URL,
    HISTORICAL_FISCAL_NOTE_SOURCE_POLICY,
    buildHistoricalFiscalNoteSearchPostBody,
    parseHistoricalFiscalNoteRecordCount,
    parseHistoricalFiscalNoteSearchForm,
    parseHistoricalFiscalNoteSearchRows,
  } = await import('../src/evidence/historical-fiscal-note.js');

  try {
    let selected:
      | { config: (typeof TARGET_SESSIONS)[number]; bills: TargetBill[] }
      | undefined;

    for (const config of TARGET_SESSIONS) {
      const pending = await pool.query<TargetBill>(`
        SELECT b.id::text AS bill_id,
               b.identifier,
               s.slug AS session_slug,
               EXTRACT(YEAR FROM s.starts_on)::int AS session_start_year,
               min(ve.occurred_on)::date::text AS first_vote_on
          FROM bills b
          JOIN legislative_sessions s ON s.id=b.session_id
          JOIN jurisdictions j ON j.id=s.jurisdiction_id
          JOIN vote_events ve ON ve.bill_id=b.id
         WHERE j.slug='us-mn'
           AND s.slug=$1
           AND b.identifier ~ '^(HF|SF)[0-9]+$'
           AND NOT EXISTS (
             SELECT 1
               FROM evidence_items marker
              WHERE marker.bill_id=b.id
                AND marker.metadata->>'subtype'='fiscal_note_scan_marker'
                AND marker.metadata->>'historicalBackfill'='true'
                AND marker.metadata->>'sourcePolicy'=$2
           )
         GROUP BY b.id,b.identifier,s.slug,s.starts_on
         ORDER BY min(ve.occurred_on),b.identifier
      `, [config.slug, HISTORICAL_FISCAL_NOTE_SOURCE_POLICY]);
      if (pending.rows.length > 0) {
        selected = { config, bills: pending.rows };
        break;
      }
    }

    if (!selected) {
      if (process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, 'remaining_sessions=0\n');
        appendFileSync(process.env.GITHUB_OUTPUT, 'remaining_bills=0\n');
        appendFileSync(process.env.GITHUB_OUTPUT, 'selected_session=\n');
        appendFileSync(process.env.GITHUB_OUTPUT, 'failures=0\n');
      }
      console.log(JSON.stringify({
        historicalFiscalNoteBackfill: {
          parserVersion: HISTORICAL_FISCAL_NOTE_PARSER_VERSION,
          sourcePolicy: HISTORICAL_FISCAL_NOTE_SOURCE_POLICY,
          collectionComplete: true,
          remainingSessions: 0,
          remainingBills: 0,
          policy: {
            historicalAvailability: 'official Complete Date + 1 calendar day',
            sameDayEligible: false,
            contextOnly: true,
            mechanicallyActionable: false,
            modelWeight: 0,
            servingChanged: false,
            productionAction: 'none',
          },
        },
      }, null, 2));
      return;
    }

    const { config, bills } = selected;
    const initialUrl = FISCAL_SEARCH_BASE_URL + '?year=' + config.startYear;
    const initial = await fetchFiscalHtml({ url: initialUrl, method: 'GET' });
    const form = parseHistoricalFiscalNoteSearchForm(initial.rawContent, config.startYear);
    const postUrl = new URL(form.action, initial.sourceUrl).toString();
    assertFiscalHost(postUrl);
    const page = await fetchFiscalHtml({
      url: postUrl,
      method: 'POST',
      body: buildHistoricalFiscalNoteSearchPostBody(form),
      cookieHeader: initial.cookieHeader,
      referer: initial.sourceUrl,
    });

    const recordCount = parseHistoricalFiscalNoteRecordCount(page.rawContent);
    if (recordCount === undefined) {
      throw new Error('Official fiscal-note WebForms POST did not expose a Record Count');
    }
    if (recordCount === 0) {
      throw new Error(
        'Official fiscal-note session search returned an implausible zero-record result for '
        + config.slug,
      );
    }
    const sessionRows = parseHistoricalFiscalNoteSearchRows(page.rawContent);
    if (sessionRows.length !== recordCount) {
      throw new Error(
        'Historical fiscal-note session parser resolved '
        + sessionRows.length
        + '/'
        + recordCount
        + ' result rows for '
        + config.slug,
      );
    }

    const rowsByBill = new Map<string, typeof sessionRows>();
    for (const row of sessionRows) {
      const rows = rowsByBill.get(row.billIdentifier) ?? [];
      rows.push(row);
      rowsByBill.set(row.billIdentifier, rows);
    }

    let processedBills = 0;
    let billsWithNotes = 0;
    let notes = 0;
    let preFirstVoteNotes = 0;
    let inserted = 0;
    let reused = 0;
    let unresolved = 0;
    let failures = 0;
    const failureExamples: Array<{ billIdentifier: string; error: string }> = [];

    for (const bill of bills) {
      try {
        const rows = rowsByBill.get(bill.identifier.toUpperCase()) ?? [];
        const drafts = rows.map(row => {
          const preFirstVote = row.availableOn < bill.first_vote_on;
          return {
            target: { billId: bill.bill_id },
            kind: 'context' as const,
            stance: 'neutral' as const,
            claim: 'Official Minnesota fiscal-note records show '
              + bill.identifier
              + ' version '
              + row.version
              + ' complete on '
              + row.completeDate
              + '; the documented public-search lag makes '
              + row.availableOn
              + ' the conservative historical availability date.',
            publishedAt: row.availableOn + 'T12:00:00.000Z',
            sourceQuality: 'official' as const,
            relevance: 'high' as const,
            freshness: freshness(row.availableOn),
            extractionMethod: 'deterministic-lbo-historical-fiscal-note-webforms-session-snapshot',
            extractionVersion: HISTORICAL_FISCAL_NOTE_PARSER_VERSION,
            confidence: 1,
            metadata: {
              contextType: 'structured_public',
              subtype: 'fiscal_note_version',
              historicalBackfill: true,
              billIdentifier: row.billIdentifier,
              version: row.version,
              title: row.title,
              noteType: row.noteType,
              author: row.author,
              completeDate: row.completeDate,
              availableOn: row.availableOn,
              firstFloorVoteOn: bill.first_vote_on,
              preFirstFloorVote: preFirstVote,
              availabilityProof: 'official_completion_date_plus_documented_24h_publication_window',
              availabilityPolicyUrl: HISTORICAL_FISCAL_NOTE_PUBLICATION_POLICY_URL,
              publicAvailabilityLagDays: 1,
              sourcePolicy: HISTORICAL_FISCAL_NOTE_SOURCE_POLICY,
              sessionSnapshotRecordCount: recordCount,
              asOfEligible: true,
              dateGranularity: 'day',
              sameDayEligible: false,
              contextOnly: true,
              mechanicallyActionable: false,
              quickEvidenceStructured: true,
              modelWeight: 0,
              evidenceSeriesKey:
                'fiscal_note_version:bill:' + bill.bill_id + ':version:' + row.version,
            },
          };
        });

        const marker = {
          target: { billId: bill.bill_id },
          kind: 'context' as const,
          stance: 'neutral' as const,
          claim: 'Historical official fiscal-note coverage was checked for ' + bill.identifier + '.',
          publishedAt: page.fetchedAt,
          sourceQuality: 'official' as const,
          relevance: 'low' as const,
          freshness: 'current' as const,
          extractionMethod: 'deterministic-lbo-historical-fiscal-note-scan-marker',
          extractionVersion: HISTORICAL_FISCAL_NOTE_PARSER_VERSION,
          confidence: 1,
          metadata: {
            contextType: 'structured_public',
            subtype: 'fiscal_note_scan_marker',
            historicalBackfill: true,
            billIdentifier: bill.identifier,
            billRecordCount: rows.length,
            sessionRecordCount: recordCount,
            sourcePolicy: HISTORICAL_FISCAL_NOTE_SOURCE_POLICY,
            asOfEligible: false,
            contextOnly: true,
            mechanicallyActionable: false,
            quickEvidenceStructured: false,
            modelWeight: 0,
            evidenceSeriesKey: 'fiscal_note_scan_marker:bill:' + bill.bill_id,
          },
        };

        const persisted = await persistDurableEvidence({
          sourceKind: 'mn_lbo_historical_fiscal_note_session_search',
          sourceUrl: page.sourceUrl,
          contentSha256: page.contentSha256,
          sessionSlug: bill.session_slug,
          fetchedAt: page.fetchedAt,
          httpStatus: page.httpStatus,
          metadata: {
            historicalBackfill: true,
            sessionSlug: config.slug,
            sessionStartYear: config.startYear,
            sessionRecordCount: recordCount,
            targetBills: bills.length,
            parserVersion: HISTORICAL_FISCAL_NOTE_PARSER_VERSION,
            sourcePolicy: HISTORICAL_FISCAL_NOTE_SOURCE_POLICY,
            searchMethod: 'webforms_post',
            searchEventTarget: form.searchEventTarget,
            availabilityPolicyUrl: HISTORICAL_FISCAL_NOTE_PUBLICATION_POLICY_URL,
          },
        }, [...drafts, marker]);

        processedBills += 1;
        if (rows.length > 0) billsWithNotes += 1;
        notes += rows.length;
        preFirstVoteNotes += rows.filter(row => row.availableOn < bill.first_vote_on).length;
        inserted += persisted.inserted;
        reused += persisted.reused;
        unresolved += persisted.unresolvedTargets.length;
      } catch (error) {
        failures += 1;
        if (failureExamples.length < 12) {
          failureExamples.push({ billIdentifier: bill.identifier, error: safe(error) });
        }
      }
    }

    const remaining = await pool.query<{ remaining_bills: number; remaining_sessions: number }>(`
      SELECT count(*)::int AS remaining_bills,
             count(DISTINCT s.slug)::int AS remaining_sessions
        FROM bills b
        JOIN legislative_sessions s ON s.id=b.session_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id
       WHERE j.slug='us-mn'
         AND s.slug = ANY($1::text[])
         AND b.identifier ~ '^(HF|SF)[0-9]+$'
         AND EXISTS (SELECT 1 FROM vote_events ve WHERE ve.bill_id=b.id)
         AND NOT EXISTS (
           SELECT 1
             FROM evidence_items marker
            WHERE marker.bill_id=b.id
              AND marker.metadata->>'subtype'='fiscal_note_scan_marker'
              AND marker.metadata->>'historicalBackfill'='true'
              AND marker.metadata->>'sourcePolicy'=$2
         )
    `, [TARGET_SESSIONS.map(item => item.slug), HISTORICAL_FISCAL_NOTE_SOURCE_POLICY]);
    const remainingBills = remaining.rows[0]?.remaining_bills ?? 0;
    const remainingSessions = remaining.rows[0]?.remaining_sessions ?? 0;

    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, 'remaining_sessions=' + remainingSessions + '\n');
      appendFileSync(process.env.GITHUB_OUTPUT, 'remaining_bills=' + remainingBills + '\n');
      appendFileSync(process.env.GITHUB_OUTPUT, 'selected_session=' + config.slug + '\n');
      appendFileSync(process.env.GITHUB_OUTPUT, 'failures=' + failures + '\n');
    }

    console.log(JSON.stringify({
      historicalFiscalNoteBackfill: {
        parserVersion: HISTORICAL_FISCAL_NOTE_PARSER_VERSION,
        sourcePolicy: HISTORICAL_FISCAL_NOTE_SOURCE_POLICY,
        availabilityPolicyUrl: HISTORICAL_FISCAL_NOTE_PUBLICATION_POLICY_URL,
        selectedSession: config.slug,
        sessionStartYear: config.startYear,
        sessionRecordCount: recordCount,
        targetBills: bills.length,
        processedBills,
        billsWithNotes,
        notes,
        preFirstVoteNotes,
        inserted,
        reused,
        unresolved,
        failures,
        failureExamples,
        remainingBills,
        remainingSessions,
        policy: {
          acquisition: 'one official WebForms GET + one official WebForms POST per biennium',
          searchEventTarget: form.searchEventTarget,
          historicalAvailability: 'official Complete Date + 1 calendar day',
          publicationBasis:
            'official LBO procedure: regular fiscal notes become public-searchable within 24 hours of analyst signoff',
          sameDayEligible: false,
          contextOnly: true,
          mechanicallyActionable: false,
          modelWeight: 0,
          servingChanged: false,
          productionAction: 'none',
        },
      },
    }, null, 2));

    if (failures > 0) {
      throw new Error(
        'Historical fiscal-note persistence had '
        + failures
        + ' bill-level failures; automatic continuation stopped',
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});
