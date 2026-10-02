import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  CAMPAIGN_FINANCE_PAGE_URL,
} from '../src/evidence/campaign-finance-live.js';
import {
  discoverWaybackCaptures,
  fetchWaybackSnapshot,
  waybackSnapshotUrl,
  type WaybackCapture,
} from '../src/evidence/wayback.js';
import {
  parseCfbCandidateContributionCsv,
  parseCfbCandidateExpenditureCsv,
} from '../src/evidence/cfb-candidate-finance-history.js';
import {
  parseCfbIndependentExpenditureCsv,
} from '../src/evidence/cfb-independent-expenditure-history.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const PROBE_ANCHORS = [
  '2022-03-01T00:00:00.000Z',
  '2022-07-01T00:00:00.000Z',
  '2022-11-15T00:00:00.000Z',
  '2023-01-15T00:00:00.000Z',
  '2023-04-01T00:00:00.000Z',
  '2023-08-01T00:00:00.000Z',
] as const;
const MAX_ARCHIVED_CSV_BYTES = 120_000_000;
const CFB_CANDIDATE_BULK_UPPER_BOUND_VERSION = 'cfb-candidate-bulk-upper-bound-v1';
const LEGACY_OFFICIAL_DOWNLOADS = [
  {
    stream: 'contributions' as const,
    url: 'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-2113865252',
    documentedAt: '2023-02-27T16:38:25.000Z',
    documentationUrl: 'https://github.com/irworkshop/accountability_datacleaning/commit/13fc9173fd4fd586bceaa86be760cde0f4a7d3d2',
  },
  {
    stream: 'expenditures' as const,
    url: 'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-1890073264',
    documentedAt: '2023-02-27T17:18:19.000Z',
    documentationUrl: 'https://github.com/irworkshop/accountability_datacleaning/commit/4d94473193a14eb58bf4e689345a8bdaa45de5e5',
  },
] as const;
let secrets: string[] = [];

interface DataCapture extends WaybackCapture {
  landingCapturedAt: string;
  stream: 'contributions' | 'expenditures' | 'independentExpenditures';
}

function mask(value: string): void {
  if (value.length > 3) {
    console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
  }
}

function safe(error: unknown): string {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(item => item.length > 3).sort((a, b) => b.length - a.length)) {
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

function decodeHtml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function historicalDownloadUrls(html: string): {
  hrefCount: number;
  contributions: string | null;
  expenditures: string | null;
  independentExpenditures: string | null;
} {
  const hrefs = [...html.matchAll(/href=["']([^"']*\?download=[^"']+)["']/gi)]
    .map(match => {
      try {
        const decoded = decodeHtml(match[1] ?? '');
        const parsed = new URL(decoded, CAMPAIGN_FINANCE_PAGE_URL);
        if (parsed.hostname.toLowerCase() !== 'register.cfb.mn.gov') return null;
        return parsed.toString();
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value));
  return {
    hrefCount: hrefs.length,
    contributions: hrefs[1] ?? null,
    expenditures: hrefs[9] ?? null,
    independentExpenditures: hrefs[16] ?? null,
  };
}

function compactDate(value: Date): string {
  return value.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return compactDate(date);
}

function closestLandingCaptures(captures: readonly WaybackCapture[]): WaybackCapture[] {
  const selected: WaybackCapture[] = [];
  const used = new Set<string>();
  for (const anchor of PROBE_ANCHORS) {
    const anchorMs = new Date(anchor).getTime();
    const ranked = [...captures].sort((left, right) =>
      Math.abs(new Date(left.capturedAt).getTime() - anchorMs)
      - Math.abs(new Date(right.capturedAt).getTime() - anchorMs)
      || left.timestamp.localeCompare(right.timestamp));
    const capture = ranked.find(row => !used.has(row.digest + '|' + row.timestamp));
    if (!capture) continue;
    used.add(capture.digest + '|' + capture.timestamp);
    selected.push(capture);
  }
  return selected.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function captureIso(timestamp: string): string {
  const digits = timestamp.replace(/\D/g, '');
  if (digits.length !== 14) throw new Error('Wayback timestamp must have 14 digits');
  const iso =
    digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6, 8) + 'T'
    + digits.slice(8, 10) + ':' + digits.slice(10, 12) + ':' + digits.slice(12, 14) + 'Z';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid Wayback timestamp');
  return parsed.toISOString();
}

async function discoverDataCaptures(
  url: string,
  landingCapturedAt: string,
  stream: DataCapture['stream'],
  range?: { from: string; to: string },
): Promise<DataCapture[]> {
  const params = new URLSearchParams({
    url,
    output: 'json',
    fl: 'timestamp,original,mimetype,statuscode,digest,length',
    filter: 'statuscode:200',
    collapse: 'digest',
    limit: '30',
    from: range?.from ?? addDays(landingCapturedAt, -7),
    to: range?.to ?? addDays(landingCapturedAt, 45),
  });
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch('https://web.archive.org/cdx/search/cdx?' + params.toString(), {
        headers: { accept: 'application/json', 'user-agent': 'VotePredict/2.0 cfb-bulk-upper-bound-probe' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error('Wayback CDX data query HTTP ' + response.status);
      const payload = await response.json() as unknown;
      if (!Array.isArray(payload) || !Array.isArray(payload[0])) return [];
      const header = (payload[0] as unknown[]).map(String);
      const index = new Map(header.map((name, i) => [name, i]));
      const results: DataCapture[] = [];
      for (const raw of payload.slice(1)) {
        if (!Array.isArray(raw)) continue;
        const value = (name: string) => String(raw[index.get(name)!] ?? '').trim();
        const timestamp = value('timestamp');
        const original = value('original');
        if (!timestamp || !original || value('statuscode') !== '200') continue;
        const length = Number(value('length'));
        results.push({
          timestamp,
          original,
          mimetype: value('mimetype').toLowerCase(),
          statuscode: '200',
          digest: value('digest'),
          length: Number.isFinite(length) ? length : null,
          capturedAt: captureIso(timestamp),
          archiveUrl: waybackSnapshotUrl(timestamp, original),
          landingCapturedAt,
          stream,
        });
      }
      return results.sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(0, 4);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 1500 : 3500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Wayback data CDX discovery failed');
}

async function fetchArchivedCsv(capture: DataCapture): Promise<string> {
  const response = await fetch(capture.archiveUrl, {
    headers: { 'user-agent': 'VotePredict/2.0 cfb-bulk-upper-bound-probe' },
    redirect: 'follow',
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error('Wayback archived CFB data HTTP ' + response.status);
  const announced = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(announced) && announced > MAX_ARCHIVED_CSV_BYTES) {
    throw new Error('Archived CFB CSV exceeds byte cap');
  }
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_ARCHIVED_CSV_BYTES) {
    throw new Error('Archived CFB CSV exceeded byte cap after fetch');
  }
  if (text.length < 500) throw new Error('Archived CFB CSV returned too little content');
  return text;
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
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const [candidateDebtResult, ieDebtResult] = await Promise.all([
      pool.query<{ rowKey: string }>(`
        SELECT DISTINCT ei.metadata->>'rowKey' AS "rowKey"
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
          JOIN memberships m ON m.id=ei.membership_id
          JOIN legislative_sessions s ON s.id=m.session_id
         WHERE sd.source_kind IN (
                 'campaign_finance_candidate_contribution_bulk',
                 'campaign_finance_candidate_expenditure_bulk'
               )
           AND ei.membership_id IS NOT NULL
           AND ei.metadata->>'rowKey' IS NOT NULL
           AND ei.metadata->>'subtype' IN (
                 'candidate_contribution_record',
                 'candidate_expenditure_record'
               )
           AND s.slug='2021-2022'
           AND (
             ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true'
             OR ei.published_at IS NULL
           )
      `),
      pool.query<{ rowKey: string; membershipResolved: boolean }>(`
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
      `),
    ]);
    const candidateDebt = new Set(candidateDebtResult.rows.map(row => row.rowKey));
    const ieDebt = new Map(ieDebtResult.rows.map(row => [row.rowKey, row.membershipResolved]));

    const landing = await discoverWaybackCaptures({
      url: CAMPAIGN_FINANCE_PAGE_URL,
      from: '20220101',
      to: '20231231',
      limit: 200,
    });
    const selectedLanding = closestLandingCaptures(landing);
    const earliestCandidate = new Map<string, { capturedAt: string; stream: string; archiveUrl: string; digest: string; sourceUrl: string }>();
    const earliestIe = new Map<string, { capturedAt: string; archiveUrl: string }>();
    const probes: Array<Record<string, unknown>> = [];

    for (const landingCapture of selectedLanding) {
      let page;
      try {
        page = await fetchWaybackSnapshot(landingCapture);
      } catch (error) {
        probes.push({
          landingCapturedAt: landingCapture.capturedAt,
          status: 'landing_fetch_failed',
          error: safe(error),
        });
        continue;
      }
      const downloads = historicalDownloadUrls(page.rawContent);
      const streams: Array<[DataCapture['stream'], string | null]> = [
        ['contributions', downloads.contributions],
        ['expenditures', downloads.expenditures],
        ['independentExpenditures', downloads.independentExpenditures],
      ];
      const landingProbe: Record<string, unknown> = {
        landingCapturedAt: landingCapture.capturedAt,
        hrefCount: downloads.hrefCount,
        streams: [],
      };
      const streamResults: Array<Record<string, unknown>> = [];

      for (const [stream, url] of streams) {
        if (!url) {
          streamResults.push({ stream, status: 'historical_download_link_missing' });
          continue;
        }
        let captures: DataCapture[] = [];
        try {
          captures = await discoverDataCaptures(url, landingCapture.capturedAt, stream);
        } catch (error) {
          streamResults.push({ stream, status: 'data_cdx_failed', error: safe(error) });
          continue;
        }
        if (!captures.length) {
          streamResults.push({ stream, status: 'no_archived_data_capture', url });
          continue;
        }

        let accepted = false;
        const attempts: Array<Record<string, unknown>> = [];
        for (const capture of captures) {
          try {
            const csv = await fetchArchivedCsv(capture);
            if (stream === 'contributions' || stream === 'expenditures') {
              const rows = stream === 'contributions'
                ? parseCfbCandidateContributionCsv(csv, { fromYear: 2021, toYear: 2022 })
                : parseCfbCandidateExpenditureCsv(csv, { fromYear: 2021, toYear: 2022 });
              if (rows.length < 25) throw new Error('Archived candidate CSV parsed fewer than 25 2021-22 rows');
              let debtMatches = 0;
              for (const row of rows) {
                if (!candidateDebt.has(row.rowKey)) continue;
                debtMatches += 1;
                const prior = earliestCandidate.get(row.rowKey);
                if (!prior || capture.capturedAt < prior.capturedAt) {
                  earliestCandidate.set(row.rowKey, {
                    capturedAt: capture.capturedAt,
                    stream,
                    archiveUrl: capture.archiveUrl,
                    digest: capture.digest,
                    sourceUrl: url,
                  });
                }
              }
              attempts.push({
                capturedAt: capture.capturedAt,
                mimetype: capture.mimetype,
                parsedRows2021_22: rows.length,
                timingDebtExactMatches: debtMatches,
                status: 'parsed',
              });
              accepted = true;
              break;
            }

            const rows = parseCfbIndependentExpenditureCsv(csv, { fromYear: 2021, toYear: 2022 });
            if (rows.length < 10) throw new Error('Archived IE CSV parsed fewer than 10 2021-22 rows');
            let debtMatches = 0;
            let membershipResolvedMatches = 0;
            for (const row of rows) {
              if (!ieDebt.has(row.rowKey)) continue;
              debtMatches += 1;
              if (ieDebt.get(row.rowKey)) membershipResolvedMatches += 1;
              const prior = earliestIe.get(row.rowKey);
              if (!prior || capture.capturedAt < prior.capturedAt) {
                earliestIe.set(row.rowKey, {
                  capturedAt: capture.capturedAt,
                  archiveUrl: capture.archiveUrl,
                });
              }
            }
            attempts.push({
              capturedAt: capture.capturedAt,
              mimetype: capture.mimetype,
              parsedRows2021_22: rows.length,
              timingDebtExactMatches: debtMatches,
              membershipResolvedDebtMatches: membershipResolvedMatches,
              status: 'parsed',
            });
            accepted = true;
            break;
          } catch (error) {
            attempts.push({
              capturedAt: capture.capturedAt,
              mimetype: capture.mimetype,
              status: 'fetch_or_parse_failed',
              error: safe(error),
            });
          }
        }
        streamResults.push({
          stream,
          url,
          capturesDiscovered: captures.length,
          accepted,
          attempts,
        });
      }
      landingProbe.streams = streamResults;
      probes.push(landingProbe);
    }

    const legacyOfficialProbes: Array<Record<string, unknown>> = [];
    for (const legacy of LEGACY_OFFICIAL_DOWNLOADS) {
      let captures: DataCapture[] = [];
      try {
        captures = await discoverDataCaptures(
          legacy.url,
          legacy.documentedAt,
          legacy.stream,
          { from: '20220101', to: '20231231' },
        );
      } catch (error) {
        legacyOfficialProbes.push({
          stream: legacy.stream,
          url: legacy.url,
          documentedAt: legacy.documentedAt,
          documentationUrl: legacy.documentationUrl,
          status: 'legacy_data_cdx_failed',
          error: safe(error),
        });
        continue;
      }

      const attempts: Array<Record<string, unknown>> = [];
      let accepted = false;
      for (const capture of captures) {
        try {
          const csv = await fetchArchivedCsv(capture);
          const rows = legacy.stream === 'contributions'
            ? parseCfbCandidateContributionCsv(csv, { fromYear: 2021, toYear: 2022 })
            : parseCfbCandidateExpenditureCsv(csv, { fromYear: 2021, toYear: 2022 });
          if (rows.length < 25) throw new Error('Legacy archived candidate CSV parsed fewer than 25 2021-22 rows');
          let debtMatches = 0;
          for (const row of rows) {
            if (!candidateDebt.has(row.rowKey)) continue;
            debtMatches += 1;
            const prior = earliestCandidate.get(row.rowKey);
            if (!prior || capture.capturedAt < prior.capturedAt) {
              earliestCandidate.set(row.rowKey, {
                capturedAt: capture.capturedAt,
                stream: legacy.stream,
                archiveUrl: capture.archiveUrl,
                digest: capture.digest,
                sourceUrl: legacy.url,
              });
            }
          }
          attempts.push({
            capturedAt: capture.capturedAt,
            mimetype: capture.mimetype,
            parsedRows2021_22: rows.length,
            timingDebtExactMatches: debtMatches,
            status: 'parsed',
          });
          accepted = true;
        } catch (error) {
          attempts.push({
            capturedAt: capture.capturedAt,
            mimetype: capture.mimetype,
            status: 'fetch_or_parse_failed',
            error: safe(error),
          });
        }
      }
      legacyOfficialProbes.push({
        stream: legacy.stream,
        url: legacy.url,
        documentedAt: legacy.documentedAt,
        documentationUrl: legacy.documentationUrl,
        capturesDiscovered: captures.length,
        accepted,
        attempts,
      });
    }

    function byDate(values: Iterable<{ capturedAt: string }>) {
      const counts = new Map<string, number>();
      for (const value of values) {
        const date = value.capturedAt.slice(0, 10);
        counts.set(date, (counts.get(date) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([availableBy, rowKeys]) => ({ availableBy, rowKeys }));
    }

    const write = process.env.VOTEPREDICT_CFB_BULK_UPPER_BOUND_WRITE === '1';
    let promotedCandidateItemRows = 0;
    let promotedCandidateDistinctRowKeys = 0;
    if (write && earliestCandidate.size > 0) {
      if (earliestCandidate.size < 10_000 && candidateDebt.size >= 15_000) {
        throw new Error(
          'Refusing candidate upper-bound write because recoverable exact-row proof unexpectedly fell below 10,000 rows',
        );
      }
      const proofs = [...earliestCandidate.entries()].map(([rowKey, proof]) => ({
        rowKey,
        ...proof,
      }));
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(`
            WITH proof AS (
              SELECT *
                FROM jsonb_to_recordset($1::jsonb) AS p(
                  "rowKey" text,
                  "capturedAt" timestamptz,
                  stream text,
                  "archiveUrl" text,
                  digest text,
                  "sourceUrl" text
                )
            ), targets AS (
              SELECT ei.id,
                     p."rowKey",
                     p."capturedAt",
                     p.stream,
                     p."archiveUrl",
                     p.digest,
                     p."sourceUrl"
                FROM proof p
                JOIN evidence_items ei ON ei.metadata->>'rowKey'=p."rowKey"
                JOIN source_documents sd ON sd.id=ei.source_document_id
                JOIN memberships m ON m.id=ei.membership_id
                JOIN legislative_sessions s ON s.id=m.session_id
               WHERE s.slug='2021-2022'
                 AND ei.membership_id IS NOT NULL
                 AND ei.metadata->>'subtype' IN (
                       'candidate_contribution_record',
                       'candidate_expenditure_record'
                     )
                 AND (
                   (p.stream='contributions'
                    AND sd.source_kind='campaign_finance_candidate_contribution_bulk')
                   OR
                   (p.stream='expenditures'
                    AND sd.source_kind='campaign_finance_candidate_expenditure_bulk')
                 )
                 AND (
                   ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true'
                   OR ei.published_at IS NULL
                 )
            )
            UPDATE evidence_items ei
               SET published_at=t."capturedAt",
                   metadata=ei.metadata || jsonb_build_object(
                     'asOfEligible', true,
                     'availabilityStatus', 'proven_by_archived_official_bulk_upper_bound',
                     'availabilityProof', 'independent_archive_capture_exact_row',
                     'availableAt', t."capturedAt",
                     'availabilityBoundKind', 'conservative_upper_bound',
                     'exactFirstPublicationKnown', false,
                     'availabilityProofUrl', t."archiveUrl",
                     'availabilitySourceUrl', t."sourceUrl",
                     'archiveCapturedAt', t."capturedAt",
                     'archiveDigest', t.digest,
                     'transactionDateIsAvailability', false,
                     'sameDayEligible', false,
                     'contextOnly', true,
                     'mechanicallyActionable', false,
                     'modelWeight', 0,
                     'cfbCandidateBulkUpperBoundVersion', $2::text
                   )
              FROM targets t
             WHERE ei.id=t.id
            RETURNING ei.metadata->>'rowKey' AS "rowKey"
          `, [JSON.stringify(proofs), CFB_CANDIDATE_BULK_UPPER_BOUND_VERSION]);
        promotedCandidateItemRows += result.rowCount ?? result.rows.length;

        const verify = await client.query<{ rowKeys: number }>(`
          SELECT count(DISTINCT ei.metadata->>'rowKey')::int AS "rowKeys"
            FROM evidence_items ei
            JOIN source_documents sd ON sd.id=ei.source_document_id
            JOIN memberships m ON m.id=ei.membership_id
            JOIN legislative_sessions s ON s.id=m.session_id
           WHERE s.slug='2021-2022'
             AND sd.source_kind IN (
                   'campaign_finance_candidate_contribution_bulk',
                   'campaign_finance_candidate_expenditure_bulk'
                 )
             AND ei.metadata->>'cfbCandidateBulkUpperBoundVersion'=$1
             AND ei.metadata->>'asOfEligible'='true'
             AND ei.published_at IS NOT NULL
        `, [CFB_CANDIDATE_BULK_UPPER_BOUND_VERSION]);
        promotedCandidateDistinctRowKeys = verify.rows[0]?.rowKeys ?? 0;
        if (promotedCandidateDistinctRowKeys < proofs.length) {
          throw new Error(
            `Candidate upper-bound promotion invariant failed: expected at least ${proofs.length} exact row keys, found ${promotedCandidateDistinctRowKeys}`,
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

    const ieResolvedRecovered = [...earliestIe.keys()].filter(rowKey => ieDebt.get(rowKey));
    console.log(JSON.stringify({
      cfbBulkWaybackUpperBoundProbe: {
        landingPage: CAMPAIGN_FINANCE_PAGE_URL,
        landingCapturesDiscovered: landing.length,
        landingCapturesSelected: selectedLanding.map(row => ({
          capturedAt: row.capturedAt,
          archiveUrl: row.archiveUrl,
        })),
        targetDebt: {
          candidateFinanceMemberLinked2021_22RowKeys: candidateDebt.size,
          independentExpenditure2021_22RowKeys: ieDebt.size,
          independentExpenditureMembershipResolved2021_22RowKeys:
            [...ieDebt.values()].filter(Boolean).length,
        },
        write,
        candidatePromotion: {
          version: CFB_CANDIDATE_BULK_UPPER_BOUND_VERSION,
          promotedItemRows: promotedCandidateItemRows,
          promotedDistinctRowKeys: promotedCandidateDistinctRowKeys,
        },
        recoverableByArchivedOfficialBulkArtifact: {
          candidateFinanceExactRowKeys: earliestCandidate.size,
          candidateFinanceByEarliestUpperBoundDate: byDate(earliestCandidate.values()),
          independentExpenditureExactRowKeys: earliestIe.size,
          independentExpenditureMembershipResolvedExactRowKeys: ieResolvedRecovered.length,
          independentExpenditureByEarliestUpperBoundDate: byDate(earliestIe.values()),
        },
        probes,
        legacyOfficialProbes,
        policy: {
          exactRowContainmentRequired: true,
          archiveCaptureIsConservativeAvailableByBound: true,
          exactFirstPublicationRequired: false,
          arbitraryCalendarYearEndIsAvailability: false,
          transactionDateIsAvailability: false,
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
