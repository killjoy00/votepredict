/**
 * Earlier, still conservative "public by" dates for evidence that senate_evidence_v
 * could only date by this project's fetch date.
 *
 * 1. Bill authors at introduction. Senate journals print
 *    "Senators A, B, and C introduced-- S.F. No. N: ..." on the day a bill is
 *    introduced. Every name on that line was an author of N on that journal date.
 *    The stored journal text is reused; nothing is refetched.
 * 2. Scorecards. The earliest Internet Archive capture of a scorecard URL is an
 *    upper bound on when it was public, but only if the URL holds one year's
 *    scorecard. A capture is used only when the URL contains the scorecard year.
 *
 * Writes only the two new tables. Source tables are never modified.
 */
import type { Pool } from 'pg';
import { canonicalBillIdentifier, resolveBill, resolveSenator, type SenateMember, type SessionBill } from './senate-identity-bill-resolvers.js';

const SESSIONS = ['2021-2022', '2023-2024', '2025-2026'] as const;
const CDX = 'https://web.archive.org/cdx/search/cdx';
const USER_AGENT = 'VotePredict/2.0 raw evidence dating';

export interface JournalIntroduction { billIdentifier: string; names: string[] }

/** Splits "Hoffman, Morrison, Abeler, Kupec, and Utke" into surnames as printed. */
export function splitIntroducerNames(list: string): string[] {
  return list
    .replace(/\s+/g, ' ')
    .split(/\s*,\s*(?:and\s+)?|\s+and\s+/i)
    .map((name) => name.trim())
    .filter((name) => /^[A-Z][A-Za-zÀ-ſ'’. -]{1,60}$/.test(name));
}

/** Every "Senator(s) ... introduced-- S.F. No. N" line in one journal's text. */
export function parseJournalIntroductions(text: string): JournalIntroduction[] {
  const flat = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  const out: JournalIntroduction[] = [];
  const seen = new Set<string>();
  // The name list may wrap onto two more lines, but holds only name characters,
  // commas and "and", so it cannot run into bill titles or other prose.
  const pattern = /\bSenators?\s+([A-Z][A-Za-z\u00C0-\u017F'\u2019., -]*(?:\n[A-Za-z\u00C0-\u017F'\u2019., -]+){0,2}?)\s+introduced\s*-{1,3}\s*S\s*\.\s*F\s*\.\s*No\s*\.\s*(\d{1,5})\b/g;
  for (const match of flat.matchAll(pattern)) {
    const bill = canonicalBillIdentifier('SF' + match[2]);
    const names = splitIntroducerNames(match[1].replace(/\n/g, ' '));
    if (!bill || !names.length || seen.has(bill)) continue;
    seen.add(bill);
    out.push({ billIdentifier: bill, names });
  }
  return out;
}

async function catalog(pool: Pool): Promise<{
  sessions: Map<string, string>; roster: SenateMember[]; bills: SessionBill[];
}> {
  const sessions = await pool.query<{ slug: string; id: string }>(
    `SELECT s.slug, s.id FROM legislative_sessions s JOIN jurisdictions j ON j.id = s.jurisdiction_id
      WHERE j.slug = 'us-mn' AND s.slug = ANY($1::text[])`, [SESSIONS]);
  const people = await pool.query<{
    id: string; session_slug: string; name: string; district: string;
    starts_on: string | null; ends_on: string | null; aliases: string[];
  }>(
    `SELECT m.id, s.slug AS session_slug, l.name, m.district, m.starts_on::text, m.ends_on::text,
            coalesce(array_agg(DISTINCT a.source_name) FILTER (WHERE a.source_name IS NOT NULL), ARRAY[]::text[]) AS aliases
       FROM memberships m
       JOIN legislative_sessions s ON s.id = m.session_id
       JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       JOIN chambers c ON c.id = m.chamber_id AND c.slug = 'senate'
       JOIN legislators l ON l.id = m.legislator_id
       LEFT JOIN membership_source_aliases a ON a.membership_id = m.id
      WHERE s.slug = ANY($1::text[])
      GROUP BY m.id, s.slug, l.name, m.district, m.starts_on, m.ends_on`, [SESSIONS]);
  const bills = await pool.query<{ id: string; session_slug: string; identifier: string }>(
    `SELECT b.id, s.slug AS session_slug, b.identifier FROM bills b
       JOIN legislative_sessions s ON s.id = b.session_id
       JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
      WHERE s.slug = ANY($1::text[]) AND b.identifier ~* '^SF[0-9]+$'`, [SESSIONS]);
  return {
    sessions: new Map(sessions.rows.map((row) => [row.slug, row.id])),
    roster: people.rows.map((p) => ({
      id: p.id, sessionSlug: p.session_slug, name: p.name, district: p.district,
      startsOn: p.starts_on, endsOn: p.ends_on, aliases: p.aliases,
    })),
    bills: bills.rows.map((row) => ({ id: row.id, sessionSlug: row.session_slug, identifier: row.identifier })),
  };
}

export interface IntroductionSummary { journals: number; introductions: number; authorRows: number; linkedAuthors: number; unlinkedBills: number }

export async function backfillIntroductionAuthors(pool: Pool): Promise<IntroductionSummary> {
  const cat = await catalog(pool);
  const summary: IntroductionSummary = { journals: 0, introductions: 0, authorRows: 0, linkedAuthors: 0, unlinkedBills: 0 };
  const docs = await pool.query<{ id: string; source_url: string; session_slug: string; source_date: string | null; text: string }>(
    `SELECT id, source_url, metadata->'rawPrepassageVotes'->>'sessionSlug' AS session_slug,
            metadata->'rawPrepassageVotes'->>'sourceDate' AS source_date,
            metadata->'rawPrepassageVotes'->>'text' AS text
       FROM source_documents
      WHERE metadata->'rawPrepassageVotes'->>'sourceType' = 'mn_senate_journal'
        AND metadata->'rawPrepassageVotes'->>'sessionSlug' = ANY($1::text[])
      ORDER BY id`, [SESSIONS]);
  const rows: Record<string, unknown>[] = [];
  for (const doc of docs.rows) {
    const date = doc.source_date && /^\d{4}-\d{2}-\d{2}$/.test(doc.source_date) ? doc.source_date : null;
    const sessionId = cat.sessions.get(doc.session_slug);
    if (!date || !sessionId || !doc.text) continue;
    summary.journals += 1;
    for (const intro of parseJournalIntroductions(doc.text)) {
      const bill = resolveBill({ printedIdentifier: intro.billIdentifier, sessionSlug: doc.session_slug }, cat.bills);
      if (!bill.billId) { summary.unlinkedBills += 1; continue; }
      summary.introductions += 1;
      for (const [index, name] of intro.names.entries()) {
        const member = resolveSenator({ printedName: name, sessionSlug: doc.session_slug, date }, cat.roster);
        if (member.membershipId) summary.linkedAuthors += 1;
        rows.push({
          bill_id: bill.billId, session_id: sessionId, author_order: index + 1, name_raw: name,
          membership_id: member.membershipId, match_method: member.matchMethod,
          introduced_on: date, source_document_id: doc.id, source_url: doc.source_url,
        });
      }
    }
  }
  for (let i = 0; i < rows.length; i += 400) {
    // A bill is introduced once; if two journals print the same line, keep the earliest date.
    await pool.query(
      `INSERT INTO senate_bill_introduction_authors
         (bill_id, session_id, author_order, name_raw, membership_id, match_method, introduced_on, source_document_id, source_url)
       SELECT v.bill_id, v.session_id, v.author_order, v.name_raw, v.membership_id, v.match_method,
              v.introduced_on, v.source_document_id, v.source_url
         FROM jsonb_to_recordset($1::jsonb) AS v(bill_id uuid, session_id uuid, author_order integer, name_raw text,
              membership_id uuid, match_method text, introduced_on date, source_document_id uuid, source_url text)
       ON CONFLICT (bill_id, author_order) DO UPDATE SET
         name_raw = CASE WHEN EXCLUDED.introduced_on < senate_bill_introduction_authors.introduced_on THEN EXCLUDED.name_raw ELSE senate_bill_introduction_authors.name_raw END,
         membership_id = CASE WHEN EXCLUDED.introduced_on < senate_bill_introduction_authors.introduced_on THEN EXCLUDED.membership_id ELSE COALESCE(senate_bill_introduction_authors.membership_id, EXCLUDED.membership_id) END,
         match_method = CASE WHEN EXCLUDED.introduced_on < senate_bill_introduction_authors.introduced_on THEN EXCLUDED.match_method ELSE senate_bill_introduction_authors.match_method END,
         introduced_on = LEAST(senate_bill_introduction_authors.introduced_on, EXCLUDED.introduced_on),
         source_document_id = CASE WHEN EXCLUDED.introduced_on < senate_bill_introduction_authors.introduced_on THEN EXCLUDED.source_document_id ELSE senate_bill_introduction_authors.source_document_id END,
         source_url = CASE WHEN EXCLUDED.introduced_on < senate_bill_introduction_authors.introduced_on THEN EXCLUDED.source_url ELSE senate_bill_introduction_authors.source_url END`,
      [JSON.stringify(rows.slice(i, i + 400))]);
  }
  summary.authorRows = rows.length;
  return summary;
}

/** True when the URL names exactly the scorecard's year, so its earliest capture is that year's scorecard. */
export function urlNamesScorecardYear(url: string, year: number): boolean {
  const years = [...decodeURIComponent(url).matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].map((m) => Number(m[1]));
  return years.length > 0 && years.every((value) => value === year);
}

/** Earliest successful capture timestamp (14 digits) from a CDX JSON response. */
export function earliestCdxCapture(payload: unknown): string | null {
  if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[0])) return null;
  const header = (payload[0] as unknown[]).map(String);
  const ts = header.indexOf('timestamp');
  const status = header.indexOf('statuscode');
  const stamps = (payload.slice(1) as unknown[][])
    .filter((row) => Array.isArray(row) && (status < 0 || String(row[status]) === '200' || String(row[status]) === '-'))
    .map((row) => String(row[ts] ?? ''))
    .filter((value) => /^\d{14}$/.test(value))
    .sort();
  return stamps[0] ?? null;
}

function captureIso(stamp: string): string {
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}Z`;
}

export interface ScorecardArchiveSummary { snapshots: number; checked: number; captured: number; notArchived: number; sourceErrors: number; stoppedForThrottle: boolean }

export async function backfillScorecardArchiveDates(
  pool: Pool,
  options: { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; intervalMs?: number } = {},
): Promise<ScorecardArchiveSummary> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const interval = Math.max(options.intervalMs ?? 1200, 0);
  const pending = await pool.query<{ id: string; url: string; year: number }>(
    `SELECT s.id, s.url, s.year FROM senate_scorecard_snapshots s
       LEFT JOIN senate_scorecard_archive_dates d ON d.snapshot_id = s.id
      WHERE d.snapshot_id IS NULL OR d.result = 'source_error'
      ORDER BY s.id`);
  const summary: ScorecardArchiveSummary = { snapshots: pending.rows.length, checked: 0, captured: 0, notArchived: 0, sourceErrors: 0, stoppedForThrottle: false };
  for (const snapshot of pending.rows) {
    const query = `${CDX}?url=${encodeURIComponent(snapshot.url)}&output=json&fl=timestamp,statuscode&filter=statuscode:200&limit=5`;
    let result: 'captured' | 'not_archived' | 'source_error' = 'source_error';
    let stamp: string | null = null;
    try {
      const response = await fetchImpl(query, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
      if (response.status === 429 || response.status === 503) { summary.stoppedForThrottle = true; break; }
      if (response.ok) {
        const text = await response.text();
        stamp = earliestCdxCapture(text.trim() ? JSON.parse(text) : []);
        result = stamp ? 'captured' : 'not_archived';
      }
    } catch {
      result = 'source_error';
    }
    summary.checked += 1;
    if (result === 'captured') summary.captured += 1;
    else if (result === 'not_archived') summary.notArchived += 1;
    else summary.sourceErrors += 1;
    await pool.query(
      `INSERT INTO senate_scorecard_archive_dates (snapshot_id, url, url_names_year, first_captured_at, capture_url, result)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (snapshot_id) DO UPDATE SET url_names_year = EXCLUDED.url_names_year,
         first_captured_at = EXCLUDED.first_captured_at, capture_url = EXCLUDED.capture_url,
         result = EXCLUDED.result, checked_at = now()`,
      [snapshot.id, snapshot.url, urlNamesScorecardYear(snapshot.url, snapshot.year),
        stamp ? captureIso(stamp) : null, stamp ? `https://web.archive.org/web/${stamp}/${snapshot.url}` : null, result]);
    if (interval) await sleep(interval);
  }
  return summary;
}
