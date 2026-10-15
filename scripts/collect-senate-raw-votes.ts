/**
 * Raw collection of Minnesota Senate votes that happen before final passage:
 * committee votes (from senate.mn hearing minutes) and floor roll calls on
 * amendments and motions (from Senate Journal PDFs). Records are stored as
 * found, partial or not, in source_documents.metadata.rawPrepassageVotes.
 * Nothing here writes vote_events or member_votes.
 *
 * Usage:
 *   npm run data:senate:raw-votes -- --session 2025-2026 [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *     [--source committee|floor|all] [--limit N] [--delay-ms 250] [--skip-existing]
 *     [--dry-run [--out records.jsonl]]
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { fetchSenateJournal, listSenateJournalLinks, parseSenateJournalText } from '../src/sources/minnesota/senate-journals.js';
import { parseSenateCommitteeMinutesRaw, SENATE_RAW_VOTE_PARSER_VERSION, senateJournalEventsToRaw, type RawSenateVoteRecord } from '../src/sources/minnesota/senate-raw-votes.js';
import {
  extractSenateMinutesText,
  fetchSenateMinutesHtml,
  listSenateHearingDates,
  listSenateHearingsOnDate,
  parseSenateMinutesPresent,
  sha256,
  type SenateHearing,
} from '../src/sources/minnesota/senate-schedule.js';
import { getMinnesotaHouseSession, type MinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';

const SOURCE_KIND = { committee: 'senate_committee_minutes_html', floor: 'senate_journal_pdf' } as const;

interface Options {
  session: MinnesotaHouseSession;
  from: string;
  to: string;
  source: 'committee' | 'floor' | 'all';
  limit?: number;
  delayMs: number;
  skipExisting: boolean;
  dryRun: boolean;
  out?: string;
}

interface RawDocument {
  sourceKind: string;
  sourceUrl: string;
  contentSha256: string;
  payload: {
    sourceType: 'mn_senate_committee_minutes_html' | 'mn_senate_journal';
    parserVersion: typeof SENATE_RAW_VOTE_PARSER_VERSION;
    sessionSlug: string;
    sourceDate: string | null;
    fetchedAt: string;
    hearing?: Omit<SenateHearing, 'minutesUrl'>;
    present?: string[];
    text: string;
    records: RawSenateVoteRecord[];
    stats: { records: number; rollCalls: number; withNames: number; namesMismatchTally: number };
  };
}

function argumentValue(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function isoDate(value: string | undefined, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be YYYY-MM-DD`);
  return value;
}

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const sessionSlug = argumentValue(args, '--session');
  if (!sessionSlug) throw new Error('--session is required (e.g. 2025-2026)');
  const session = getMinnesotaHouseSession(sessionSlug);
  const source = argumentValue(args, '--source') ?? 'all';
  if (source !== 'committee' && source !== 'floor' && source !== 'all') throw new Error('--source must be committee, floor or all');
  const limit = argumentValue(args, '--limit');
  const delay = argumentValue(args, '--delay-ms');
  return {
    session,
    from: isoDate(argumentValue(args, '--from'), '--from') ?? session.startsOn,
    to: isoDate(argumentValue(args, '--to'), '--to') ?? session.endsOn,
    source,
    limit: limit ? Math.max(1, Number.parseInt(limit, 10)) : undefined,
    delayMs: delay ? Math.max(0, Number.parseInt(delay, 10)) : 250,
    skipExisting: args.includes('--skip-existing'),
    dryRun: args.includes('--dry-run'),
    out: argumentValue(args, '--out'),
  };
}

function stats(records: RawSenateVoteRecord[]): RawDocument['payload']['stats'] {
  return {
    records: records.length,
    rollCalls: records.filter((record) => record.method === 'roll_call').length,
    withNames: records.filter((record) => record.memberVotes.length > 0).length,
    namesMismatchTally: records.filter((record) => record.namesMatchTally === false).length,
  };
}

class Store {
  private jurisdictionId?: string;
  private sessionId: string | null = null;
  private chamberId: string | null = null;

  constructor(private readonly pool: Pool | undefined, private readonly options: Options) {}

  async init(): Promise<void> {
    if (!this.pool) return;
    const result = await this.pool.query<{ jurisdiction_id: string; session_id: string | null; chamber_id: string | null }>(
      `SELECT j.id jurisdiction_id,
              (SELECT s.id FROM legislative_sessions s WHERE s.jurisdiction_id=j.id AND s.slug=$1) session_id,
              (SELECT c.id FROM chambers c WHERE c.jurisdiction_id=j.id AND c.slug='senate') chamber_id
         FROM jurisdictions j WHERE j.slug='us-mn'`,
      [this.options.session.slug],
    );
    if (!result.rows[0]) throw new Error("Jurisdiction 'us-mn' not found; run migrations and base ingestion first");
    this.jurisdictionId = result.rows[0].jurisdiction_id;
    this.sessionId = result.rows[0].session_id;
    this.chamberId = result.rows[0].chamber_id;
  }

  async hasCurrent(sourceUrl: string): Promise<boolean> {
    if (!this.pool || !this.options.skipExisting) return false;
    const result = await this.pool.query(
      `SELECT 1 FROM source_documents
        WHERE source_url=$1 AND metadata->'rawPrepassageVotes'->>'parserVersion'=$2 LIMIT 1`,
      [sourceUrl, SENATE_RAW_VOTE_PARSER_VERSION],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async save(document: RawDocument): Promise<void> {
    if (this.options.dryRun) {
      if (this.options.out) appendFileSync(this.options.out, `${JSON.stringify({ sourceKind: document.sourceKind, sourceUrl: document.sourceUrl, contentSha256: document.contentSha256, ...document.payload })}\n`);
      return;
    }
    if (!this.pool || !this.jurisdictionId) throw new Error('Database store is not initialized');
    // Only the rawPrepassageVotes key is written, so rows the existing journal
    // ingest created for the same PDF keep all of their own metadata.
    await this.pool.query(
      `INSERT INTO source_documents (jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,http_status,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,200,jsonb_build_object('rawPrepassageVotes',$7::jsonb))
       ON CONFLICT (source_url,content_sha256) DO UPDATE SET
         metadata=jsonb_set(source_documents.metadata,'{rawPrepassageVotes}',$7::jsonb,true)`,
      [this.jurisdictionId, this.sessionId, this.chamberId, document.sourceKind, document.sourceUrl, document.contentSha256, JSON.stringify(document.payload)],
    );
  }
}

interface Totals { documents: number; skipped: number; records: number; rollCalls: number; withNames: number; mismatches: number; failures: string[] }

function tally(totals: Totals, document: RawDocument): void {
  totals.documents += 1;
  totals.records += document.payload.stats.records;
  totals.rollCalls += document.payload.stats.rollCalls;
  totals.withNames += document.payload.stats.withNames;
  totals.mismatches += document.payload.stats.namesMismatchTally;
}

async function collectCommittee(store: Store, options: Options, totals: Totals): Promise<void> {
  const dates = await listSenateHearingDates(options.from, options.to);
  console.log(`[committee] ${dates.length} hearing dates between ${options.from} and ${options.to}`);
  let processed = 0;
  for (const date of dates) {
    if (options.limit && processed >= options.limit) break;
    let hearings: SenateHearing[];
    try {
      hearings = await listSenateHearingsOnDate(date);
    } catch (error) {
      totals.failures.push(`schedule ${date}: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    for (const hearing of hearings) {
      if (options.limit && processed >= options.limit) break;
      if (!hearing.minutesUrl || hearing.legislature !== options.session.legislature) continue;
      processed += 1;
      try {
        if (await store.hasCurrent(hearing.minutesUrl)) {
          totals.skipped += 1;
          continue;
        }
        const text = extractSenateMinutesText(await fetchSenateMinutesHtml(hearing.minutesUrl));
        const records = parseSenateCommitteeMinutesRaw(text);
        const { minutesUrl, ...hearingMetadata } = hearing;
        const document: RawDocument = {
          sourceKind: SOURCE_KIND.committee,
          sourceUrl: minutesUrl,
          // Hash the extracted minutes text, not the page HTML, so page chrome
          // changes don't create a new document version on every fetch.
          contentSha256: sha256(text),
          payload: {
            sourceType: 'mn_senate_committee_minutes_html',
            parserVersion: SENATE_RAW_VOTE_PARSER_VERSION,
            sessionSlug: options.session.slug,
            sourceDate: hearing.date,
            fetchedAt: new Date().toISOString(),
            hearing: hearingMetadata,
            present: parseSenateMinutesPresent(text),
            text,
            records,
            stats: stats(records),
          },
        };
        await store.save(document);
        tally(totals, document);
      } catch (error) {
        totals.failures.push(`${hearing.minutesUrl}: ${error instanceof Error ? error.message : error}`);
      }
      if (processed % 50 === 0) console.log(`[committee] ${processed} hearings; ${totals.records} records so far`);
      await sleep(options.delayMs);
    }
    await sleep(options.delayMs);
  }
}

async function collectFloor(store: Store, options: Options, totals: Totals): Promise<void> {
  const journals = (await listSenateJournalLinks(options.session.slug))
    .filter((journal) => !journal.date || (journal.date >= options.from && journal.date <= options.to));
  const selected = options.limit ? journals.slice(0, options.limit) : journals;
  console.log(`[floor] ${selected.length} of ${journals.length} journals selected`);
  for (const [index, journal] of selected.entries()) {
    try {
      if (await store.hasCurrent(journal.sourceUrl)) {
        totals.skipped += 1;
        continue;
      }
      const pdf = await fetchSenateJournal(journal.sourceUrl);
      const events = parseSenateJournalText({
        text: pdf.text,
        sessionKey: options.session.sessionKey,
        sourceUrl: journal.sourceUrl,
        occurredOn: journal.date,
        allowRosterMismatch: true,
      });
      const records = senateJournalEventsToRaw(events);
      const document: RawDocument = {
        sourceKind: SOURCE_KIND.floor,
        sourceUrl: journal.sourceUrl,
        contentSha256: pdf.pdfSha256,
        payload: {
          sourceType: 'mn_senate_journal',
          parserVersion: SENATE_RAW_VOTE_PARSER_VERSION,
          sessionSlug: options.session.slug,
          sourceDate: journal.date ?? null,
          fetchedAt: new Date().toISOString(),
          text: pdf.text,
          records,
          stats: stats(records),
        },
      };
      await store.save(document);
      tally(totals, document);
    } catch (error) {
      totals.failures.push(`${journal.sourceUrl}: ${error instanceof Error ? error.message : error}`);
    }
    if ((index + 1) % 20 === 0) console.log(`[floor] ${index + 1}/${selected.length} journals; ${totals.records} records so far`);
    await sleep(options.delayMs);
  }
}

async function main(): Promise<void> {
  const options = parseOptions();
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!options.dryRun && !connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required; use --dry-run to collect without a database');
  if (options.dryRun && options.out) writeFileSync(options.out, '');
  const pool = options.dryRun ? undefined : new Pool({ connectionString, max: 2 });
  const store = new Store(pool, options);
  const totals: Totals = { documents: 0, skipped: 0, records: 0, rollCalls: 0, withNames: 0, mismatches: 0, failures: [] };
  try {
    await store.init();
    if (options.source !== 'floor') await collectCommittee(store, options, totals);
    if (options.source !== 'committee') await collectFloor(store, options, totals);
  } finally {
    await pool?.end();
  }
  console.log(JSON.stringify({
    session: options.session.slug,
    from: options.from,
    to: options.to,
    source: options.source,
    dryRun: options.dryRun,
    parserVersion: SENATE_RAW_VOTE_PARSER_VERSION,
    documents: totals.documents,
    skippedExisting: totals.skipped,
    records: totals.records,
    rollCalls: totals.rollCalls,
    recordsWithNames: totals.withNames,
    namesMismatchTally: totals.mismatches,
    failures: totals.failures.length,
    firstFailures: totals.failures.slice(0, 10),
  }, null, 2));
  // Raw collection keeps going past individual failures; only fail the run if nothing was collected.
  if (totals.documents === 0 && totals.skipped === 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
