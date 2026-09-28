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
const DEFAULT_BATCH_SIZE = 40;
const MAX_BATCH_SIZE = 80;
const TARGET_SESSIONS = ['2021-2022', '2023-2024', '2025-2026'] as const;
let secrets: string[] = [];

type TargetBill = {
  bill_id: string;
  identifier: string;
  session_slug: (typeof TARGET_SESSIONS)[number];
  session_start_year: number;
  first_vote_on: string;
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

function batchSize(): number {
  const requested = Number.parseInt(
    process.env.VOTEPREDICT_HISTORICAL_FISCAL_NOTE_BATCH_SIZE ?? '',
    10,
  );
  if (!Number.isFinite(requested)) return DEFAULT_BATCH_SIZE;
  return Math.min(MAX_BATCH_SIZE, Math.max(1, requested));
}

function freshness(date: string) {
  const ageDays = (Date.now() - new Date(date + 'T00:00:00.000Z').getTime()) / 86_400_000;
  return ageDays <= 365 ? 'current' as const : ageDays <= 1095 ? 'recent' as const : 'stale' as const;
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
  const { fetchPublicPage } = await import('../src/evidence/public-http.js');
  const { persistDurableEvidence } = await import('../src/evidence/durable-ingestion.js');
  const {
    HISTORICAL_FISCAL_NOTE_PARSER_VERSION,
    HISTORICAL_FISCAL_NOTE_PUBLICATION_POLICY_URL,
    HISTORICAL_FISCAL_NOTE_SOURCE_POLICY,
    parseHistoricalFiscalNoteRecordCount,
    parseHistoricalFiscalNoteSearch,
  } = await import('../src/evidence/historical-fiscal-note.js');

  try {
    const limit = batchSize();
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
         AND s.slug = ANY($1::text[])
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
       ORDER BY CASE s.slug
                  WHEN '2021-2022' THEN 1
                  WHEN '2023-2024' THEN 2
                  ELSE 3
                END,
                min(ve.occurred_on),
                b.identifier
       LIMIT $3
    `, [[...TARGET_SESSIONS], HISTORICAL_FISCAL_NOTE_SOURCE_POLICY, limit]);

    let processedBills = 0;
    let billsWithNotes = 0;
    let notes = 0;
    let preFirstVoteNotes = 0;
    let inserted = 0;
    let reused = 0;
    let unresolved = 0;
    let failures = 0;
    const failureExamples: Array<{ billIdentifier: string; error: string }> = [];
    const bySession: Record<string, {
      processedBills: number;
      billsWithNotes: number;
      notes: number;
      preFirstVoteNotes: number;
    }> = {};

    for (const bill of pending.rows) {
      try {
        const url = 'https://mn.gov/mmbapps/fnsearchlbo/?number='
          + encodeURIComponent(bill.identifier)
          + '&year='
          + bill.session_start_year;
        const page = await fetchPublicPage(url, {
          timeoutMs: 20_000,
          maxBytes: 2_500_000,
          userAgent: 'VotePredict/2.0 historical-fiscal-note-backfill',
        });
        const host = new URL(page.canonicalUrl).hostname.toLowerCase();
        if (!(host === 'mn.gov' || host.endsWith('.mn.gov'))) {
          throw new Error('Fiscal-note source redirected away from mn.gov to ' + host);
        }

        const recordCount = parseHistoricalFiscalNoteRecordCount(page.rawContent);
        if (recordCount === undefined) {
          throw new Error('Official fiscal-note search did not expose a Record Count');
        }
        const rows = parseHistoricalFiscalNoteSearch(page.rawContent, bill.identifier);
        if (rows.length !== recordCount) {
          throw new Error(
            'Historical fiscal-note parser resolved '
            + rows.length
            + '/'
            + recordCount
            + ' result rows for '
            + bill.identifier,
          );
        }

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
            extractionMethod: 'deterministic-lbo-historical-fiscal-note-search',
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
            recordCount,
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
          sourceKind: 'mn_lbo_historical_fiscal_note_search',
          sourceUrl: page.canonicalUrl,
          contentSha256: page.contentSha256,
          sessionSlug: bill.session_slug,
          fetchedAt: page.fetchedAt,
          httpStatus: page.httpStatus,
          metadata: {
            historicalBackfill: true,
            billIdentifier: bill.identifier,
            sessionStartYear: bill.session_start_year,
            recordCount,
            parserVersion: HISTORICAL_FISCAL_NOTE_PARSER_VERSION,
            sourcePolicy: HISTORICAL_FISCAL_NOTE_SOURCE_POLICY,
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

        const session = bySession[bill.session_slug] ?? {
          processedBills: 0,
          billsWithNotes: 0,
          notes: 0,
          preFirstVoteNotes: 0,
        };
        session.processedBills += 1;
        if (rows.length > 0) session.billsWithNotes += 1;
        session.notes += rows.length;
        session.preFirstVoteNotes += rows.filter(row => row.availableOn < bill.first_vote_on).length;
        bySession[bill.session_slug] = session;

        console.log(JSON.stringify({
          historicalFiscalNoteProgress: {
            session: bill.session_slug,
            billIdentifier: bill.identifier,
            recordCount,
            preFirstVoteNotes: rows.filter(row => row.availableOn < bill.first_vote_on).length,
            inserted: persisted.inserted,
            reused: persisted.reused,
            unresolved: persisted.unresolvedTargets.length,
          },
        }));
      } catch (error) {
        failures += 1;
        if (failureExamples.length < 12) {
          failureExamples.push({
            billIdentifier: bill.identifier,
            error: safe(error),
          });
        }
        console.warn(JSON.stringify({
          historicalFiscalNoteFailure: {
            session: bill.session_slug,
            billIdentifier: bill.identifier,
            error: safe(error),
          },
        }));
      }
    }

    const remainingResult = await pool.query<{ remaining: number }>(`
      SELECT count(*)::int AS remaining
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
    `, [[...TARGET_SESSIONS], HISTORICAL_FISCAL_NOTE_SOURCE_POLICY]);
    const remainingBills = remainingResult.rows[0]?.remaining ?? 0;

    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, 'remaining_bills=' + remainingBills + '\n');
      appendFileSync(process.env.GITHUB_OUTPUT, 'selected_bills=' + pending.rows.length + '\n');
    }

    console.log(JSON.stringify({
      historicalFiscalNoteBackfill: {
        parserVersion: HISTORICAL_FISCAL_NOTE_PARSER_VERSION,
        sourcePolicy: HISTORICAL_FISCAL_NOTE_SOURCE_POLICY,
        availabilityPolicyUrl: HISTORICAL_FISCAL_NOTE_PUBLICATION_POLICY_URL,
        selectedBills: pending.rows.length,
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
        bySession: Object.fromEntries(Object.entries(bySession).sort()),
        policy: {
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
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});
