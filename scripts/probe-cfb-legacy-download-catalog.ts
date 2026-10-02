import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { WAYBACK_CDX_URL, waybackSnapshotUrl, type WaybackCapture } from '../src/evidence/wayback.js';
import { parseCfbIndependentExpenditureCsv } from '../src/evidence/cfb-independent-expenditure-history.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const LEGACY_PREFIX =
  'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/';
const MAX_ARCHIVED_CSV_BYTES = 120_000_000;
const CFB_IE_LEGACY_BULK_UPPER_BOUND_VERSION = 'cfb-ie-legacy-bulk-upper-bound-v1';
const ANCHORS = [
  '2022-03-01T00:00:00.000Z',
  '2022-07-01T00:00:00.000Z',
  '2022-11-15T00:00:00.000Z',
  '2023-03-01T00:00:00.000Z',
  '2023-08-01T00:00:00.000Z',
] as const;
let secrets: string[] = [];

function mask(value: string): void {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown): string {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(item => item.length > 3).sort((a,b) => b.length-a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1600);
}

async function chooseDb(env: Record<string, string | undefined>): Promise<string> {
  const { Pool } = await import('pg');
  async function works(value: string): Promise<boolean> {
    const candidate = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8000 });
    try { await candidate.query('select 1'); return true; }
    catch { return false; }
    finally { await candidate.end().catch(() => undefined); }
  }
  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await works(value)) return value;
  }
  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET unavailable');
  mask(secret);
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + secret },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

function captureIso(timestamp: string): string {
  const digits = timestamp.replace(/\D/g, '');
  if (digits.length !== 14) throw new Error('Wayback timestamp must have 14 digits');
  const parsed = new Date(
    digits.slice(0,4)+'-'+digits.slice(4,6)+'-'+digits.slice(6,8)+'T'
    +digits.slice(8,10)+':'+digits.slice(10,12)+':'+digits.slice(12,14)+'Z'
  );
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid Wayback timestamp');
  return parsed.toISOString();
}

async function discoverCatalog(): Promise<WaybackCapture[]> {
  const params = new URLSearchParams({
    url: LEGACY_PREFIX,
    matchType: 'prefix',
    output: 'json',
    fl: 'timestamp,original,mimetype,statuscode,digest,length',
    filter: 'statuscode:200',
    collapse: 'digest',
    from: '20210101',
    to: '20231231',
    limit: '2000',
  });
  const response = await fetch(WAYBACK_CDX_URL + '?' + params.toString(), {
    headers: { accept: 'application/json', 'user-agent': 'VotePredict/2.0 cfb-legacy-download-catalog' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error('Wayback catalog CDX HTTP ' + response.status);
  const payload = await response.json();
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return [];
  const header = (payload[0] as unknown[]).map(String);
  const index = new Map(header.map((name, i) => [name, i]));
  const value = (row: unknown[], name: string) => String(row[index.get(name)!] ?? '').trim();
  const captures: WaybackCapture[] = [];
  for (const raw of payload.slice(1)) {
    if (!Array.isArray(raw)) continue;
    const original = value(raw, 'original');
    if (!/[?&]download=/.test(original)) continue;
    const timestamp = value(raw, 'timestamp');
    const statuscode = value(raw, 'statuscode');
    if (!timestamp || statuscode !== '200') continue;
    const lengthText = value(raw, 'length');
    const length = Number(lengthText);
    captures.push({
      timestamp,
      original,
      mimetype: value(raw, 'mimetype').toLowerCase(),
      statuscode,
      digest: value(raw, 'digest'),
      length: Number.isFinite(length) ? length : null,
      capturedAt: captureIso(timestamp),
      archiveUrl: waybackSnapshotUrl(timestamp, original),
    });
  }
  return captures.sort((a,b) => a.timestamp.localeCompare(b.timestamp));
}

function selectCaptures(captures: readonly WaybackCapture[]): WaybackCapture[] {
  if (captures.length <= 5) return [...captures];
  const selected = new Map<string, WaybackCapture>();
  for (const anchor of ANCHORS) {
    const ms = new Date(anchor).getTime();
    const closest = [...captures].sort((a,b) =>
      Math.abs(new Date(a.capturedAt).getTime() - ms) - Math.abs(new Date(b.capturedAt).getTime() - ms)
      || a.timestamp.localeCompare(b.timestamp)
    )[0];
    if (closest) selected.set(closest.timestamp + '|' + closest.digest, closest);
  }
  return [...selected.values()].sort((a,b) => a.timestamp.localeCompare(b.timestamp));
}

async function fetchPrefix(capture: WaybackCapture): Promise<string> {
  const response = await fetch(capture.archiveUrl, {
    headers: {
      'user-agent': 'VotePredict/2.0 cfb-legacy-download-catalog',
      range: 'bytes=0-65535',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error('Wayback archived CFB prefix HTTP ' + response.status);
  if (!response.body) return (await response.text()).slice(0, 65_536);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (size < 65_536) {
      const { done, value } = await reader.read();
      if (done) break;
      const buffer = Buffer.from(value);
      chunks.push(buffer);
      size += buffer.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks).subarray(0, 65_536).toString('utf8');
}

function classifyPrefix(text: string): 'independentExpenditures' | 'contributions' | 'expenditures' | 'unknown' {
  const head = text.slice(0, 16_000).toLowerCase();
  if (head.includes('affected comte name') && head.includes('for /against')) return 'independentExpenditures';
  if (head.includes('recipient reg num') && head.includes('contributor') && head.includes('receipt date')) return 'contributions';
  if (head.includes('committee reg num') && head.includes('vendor') && head.includes('unpaid amount')) return 'expenditures';
  return 'unknown';
}

async function fetchArchivedCsv(capture: WaybackCapture): Promise<string> {
  const response = await fetch(capture.archiveUrl, {
    headers: { 'user-agent': 'VotePredict/2.0 cfb-legacy-ie-catalog' },
    redirect: 'follow',
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error('Wayback archived CFB data HTTP ' + response.status);
  const announced = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(announced) && announced > MAX_ARCHIVED_CSV_BYTES) {
    throw new Error('Archived CFB CSV exceeds byte cap');
  }
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_ARCHIVED_CSV_BYTES) throw new Error('Archived CFB CSV exceeded byte cap after fetch');
  if (text.length < 500) throw new Error('Archived CFB CSV returned too little content');
  return text;
}

function byDate(values: Iterable<{ capturedAt: string }>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const date = value.capturedAt.slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([availableBy, rowKeys]) => ({ availableBy, rowKeys }));
}

async function main(): Promise<void> {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  secrets = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secrets.forEach(mask);
  const databaseUrl = await chooseDb(env);
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: databaseUrl, max: 2, idleTimeoutMillis: 20_000, connectionTimeoutMillis: 10_000 });

  try {
    const debtResult = await pool.query<{ rowKey: string; membershipResolved: boolean }>(`
      SELECT ei.metadata->>'rowKey' AS "rowKey",
             bool_or(ei.membership_id IS NOT NULL) AS "membershipResolved"
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
       WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
         AND ei.metadata->>'subtype'='independent_expenditure_record'
         AND ei.metadata->>'rowKey' IS NOT NULL
         AND coalesce((ei.metadata->>'year')::int,0) IN (2021,2022)
         AND (
           ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true'
           OR ei.published_at IS NULL
         )
       GROUP BY ei.metadata->>'rowKey'
    `);
    const debt = new Map(debtResult.rows.map(row => [row.rowKey, row.membershipResolved]));
    const catalog = await discoverCatalog();
    const byUrl = new Map<string, WaybackCapture[]>();
    for (const capture of catalog) {
      const rows = byUrl.get(capture.original) ?? [];
      rows.push(capture);
      byUrl.set(capture.original, rows);
    }

    const earliest = new Map<string, { capturedAt: string; archiveUrl: string; original: string; digest: string }>();
    const classifications: Array<Record<string, unknown>> = [];
    for (const [url, captures] of [...byUrl.entries()].sort(([a],[b]) => a.localeCompare(b))) {
      const selected = selectCaptures(captures);
      let classification: ReturnType<typeof classifyPrefix> = 'unknown';
      const prefixAttempts: Array<Record<string, unknown>> = [];
      for (const capture of selected) {
        try {
          const prefix = await fetchPrefix(capture);
          classification = classifyPrefix(prefix);
          prefixAttempts.push({ capturedAt: capture.capturedAt, classification });
          if (classification !== 'unknown') break;
        } catch (error) {
          prefixAttempts.push({ capturedAt: capture.capturedAt, classification: 'fetch_failed', error: safe(error) });
        }
      }

      const parseAttempts: Array<Record<string, unknown>> = [];
      if (classification === 'independentExpenditures') {
        for (const capture of selected) {
          try {
            const csv = await fetchArchivedCsv(capture);
            const rows = parseCfbIndependentExpenditureCsv(csv, { fromYear: 2021, toYear: 2022 });
            if (rows.length < 10) throw new Error('Archived IE CSV parsed fewer than 10 2021-22 rows');
            let matches = 0;
            let membershipResolvedMatches = 0;
            for (const row of rows) {
              if (!debt.has(row.rowKey)) continue;
              matches += 1;
              if (debt.get(row.rowKey)) membershipResolvedMatches += 1;
              const prior = earliest.get(row.rowKey);
              if (!prior || capture.capturedAt < prior.capturedAt) {
                earliest.set(row.rowKey, {
                  capturedAt: capture.capturedAt,
                  archiveUrl: capture.archiveUrl,
                  original: capture.original,
                  digest: capture.digest,
                });
              }
            }
            parseAttempts.push({
              capturedAt: capture.capturedAt,
              parsedRows2021_22: rows.length,
              timingDebtExactMatches: matches,
              membershipResolvedDebtMatches: membershipResolvedMatches,
              status: 'parsed',
            });
          } catch (error) {
            parseAttempts.push({ capturedAt: capture.capturedAt, status: 'fetch_or_parse_failed', error: safe(error) });
          }
        }
      }

      classifications.push({
        url,
        capturesDiscovered: captures.length,
        capturesSelected: selected.length,
        classification,
        prefixAttempts,
        parseAttempts,
      });
    }

    const resolvedRecovered = [...earliest.keys()].filter(rowKey => debt.get(rowKey));
    const write = process.env.VOTEPREDICT_CFB_LEGACY_IE_UPPER_BOUND_WRITE === '1';
    let promotedItemRows = 0;
    let promotedDistinctRowKeys = 0;
    let promotedMembershipResolvedDistinctRowKeys = 0;

    if (write && earliest.size > 0) {
      if (debt.size >= 1600 && earliest.size < 1400) {
        throw new Error(
          'Refusing IE upper-bound write because exact-row recoverable proof unexpectedly fell below 1,400 rows',
        );
      }
      const proofs = [...earliest.entries()].map(([rowKey, proof]) => ({ rowKey, ...proof }));
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(`
            WITH proof AS (
              SELECT *
                FROM jsonb_to_recordset($1::jsonb) AS p(
                  "rowKey" text,
                  "capturedAt" timestamptz,
                  "archiveUrl" text,
                  original text,
                  digest text
                )
            ), targets AS (
              SELECT ei.id,
                     p."rowKey",
                     p."capturedAt",
                     p."archiveUrl",
                     p.original,
                     p.digest
                FROM proof p
                JOIN evidence_items ei ON ei.metadata->>'rowKey'=p."rowKey"
                JOIN source_documents sd ON sd.id=ei.source_document_id
               WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
                 AND ei.metadata->>'subtype'='independent_expenditure_record'
                 AND coalesce((ei.metadata->>'year')::int,0) IN (2021,2022)
                 AND (
                   ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true'
                   OR ei.published_at IS NULL
                 )
            )
            UPDATE evidence_items ei
               SET published_at=t."capturedAt",
                   metadata=ei.metadata || jsonb_build_object(
                     'asOfEligible', true,
                     'availabilityStatus', 'proven_by_archived_official_ie_bulk_upper_bound',
                     'availabilityProof', 'independent_archive_capture_exact_row',
                     'availableAt', t."capturedAt",
                     'availabilityBoundKind', 'conservative_upper_bound',
                     'exactFirstPublicationKnown', false,
                     'availabilityProofUrl', t."archiveUrl",
                     'availabilitySourceUrl', t.original,
                     'archiveCapturedAt', t."capturedAt",
                     'archiveDigest', t.digest,
                     'transactionDateIsAvailability', false,
                     'sameDayEligible', false,
                     'contextOnly', true,
                     'mechanicallyActionable', false,
                     'modelWeight', 0,
                     'cfbIeLegacyBulkUpperBoundVersion', $2::text
                   )
              FROM targets t
             WHERE ei.id=t.id
            RETURNING ei.metadata->>'rowKey' AS "rowKey"
          `, [JSON.stringify(proofs), CFB_IE_LEGACY_BULK_UPPER_BOUND_VERSION]);
        promotedItemRows += result.rowCount ?? result.rows.length;

        const verify = await client.query<{ rowKeys: number; memberResolvedRowKeys: number }>(`
          SELECT
            count(DISTINCT ei.metadata->>'rowKey')::int AS "rowKeys",
            count(DISTINCT ei.metadata->>'rowKey') FILTER (
              WHERE ei.membership_id IS NOT NULL
            )::int AS "memberResolvedRowKeys"
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
         WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
           AND ei.metadata->>'subtype'='independent_expenditure_record'
           AND ei.metadata->>'cfbIeLegacyBulkUpperBoundVersion'=$1
           AND ei.metadata->>'asOfEligible'='true'
           AND ei.published_at IS NOT NULL
        `, [CFB_IE_LEGACY_BULK_UPPER_BOUND_VERSION]);
        promotedDistinctRowKeys = verify.rows[0]?.rowKeys ?? 0;
        promotedMembershipResolvedDistinctRowKeys = verify.rows[0]?.memberResolvedRowKeys ?? 0;

        if (promotedDistinctRowKeys < proofs.length) {
          throw new Error(
            `IE upper-bound promotion invariant failed: expected at least ${proofs.length} exact row keys, found ${promotedDistinctRowKeys}`,
          );
        }
        if (promotedMembershipResolvedDistinctRowKeys < resolvedRecovered.length) {
          throw new Error(
            `IE member-resolved promotion invariant failed: expected at least ${resolvedRecovered.length}, found ${promotedMembershipResolvedDistinctRowKeys}`,
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log(JSON.stringify({
      cfbLegacyDownloadCatalogProbe: {
        catalogCapturesDiscovered: catalog.length,
        uniqueDownloadUrls: byUrl.size,
        targetDebt: {
          independentExpenditure2021_22RowKeys: debt.size,
          membershipResolvedRowKeys: [...debt.values()].filter(Boolean).length,
        },
        write,
        promotion: {
          version: CFB_IE_LEGACY_BULK_UPPER_BOUND_VERSION,
          promotedItemRows,
          promotedDistinctRowKeys,
          promotedMembershipResolvedDistinctRowKeys,
        },
        recoverable: {
          exactRowKeys: earliest.size,
          membershipResolvedExactRowKeys: resolvedRecovered.length,
          byEarliestUpperBoundDate: byDate(earliest.values()),
        },
        classifications,
        policy: {
          officialCfbArchiveOnly: true,
          exactRowContainmentRequired: true,
          archiveCaptureIsConservativeAvailableByBound: true,
          transactionDateIsAvailability: false,
          arbitraryCalendarYearEndIsAvailability: false,
          sameDayEligible: false,
          evidenceWrites: write,
          servingChanged: false,
          productionAction: 'none',
        },
      },
    }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});
