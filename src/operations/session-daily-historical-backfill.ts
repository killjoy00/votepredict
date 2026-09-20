import { pool } from '@/lib/db';
import { persistDurableEvidence, type DurableEvidenceDraft } from '@/evidence/durable-ingestion';
import { fetchPublicPage, type PublicPage } from '@/evidence/public-http';
import {
  extractSessionDailyArchiveMaxPage,
  extractSessionDailyStoryLinks,
  sessionDailyArchiveUrl,
  sessionDailyPublishedDay,
  SESSION_DAILY_HISTORICAL_BACKFILL_VERSION,
} from '@/evidence/session-daily-archive';
import {
  extractLegislativeSpeechMentions,
  LEGISLATIVE_SPEECH_EXTRACTOR_VERSION,
} from '@/evidence/legislative-speech';

const START_YEAR = 2021;
const END_YEAR = 2024;
const DEFAULT_PAGES_PER_BATCH = 3;
const MAX_PAGES_PER_BATCH = 4;
const STORY_CONCURRENCY = 4;

type SessionRow = { id: string; slug: string };
type MemberRow = {
  membership_id: string;
  name: string;
  chamber_slug: 'house' | 'senate';
};
type BillRow = { bill_id: string; identifier: string };
type Cursor = { year: number; page: number; done: boolean };

export interface SessionDailyHistoricalBackfillBatchResult {
  version: typeof SESSION_DAILY_HISTORICAL_BACKFILL_VERSION;
  start: { year: number; page: number };
  next: { year: number; page: number };
  pagesProcessed: number;
  archivePagesFetched: number;
  storiesScanned: number;
  storiesWithBills: number;
  storiesWithMentions: number;
  evidenceInserted: number;
  evidenceReused: number;
  unresolvedTargets: number;
  storyFailures: number;
  missingPublicationDay: number;
  done: boolean;
  servingProbabilityChange: 'none';
  allNewFeatureWeights: 0;
}

function emptyTotals() {
  return {
    archivePagesFetched: 0,
    storiesScanned: 0,
    storiesWithBills: 0,
    storiesWithMentions: 0,
    evidenceInserted: 0,
    evidenceReused: 0,
    unresolvedTargets: 0,
    storyFailures: 0,
    missingPublicationDay: 0,
  };
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .slice(0, 500);
}

function sessionSlugForYear(year: number): '2021-2022' | '2023-2024' {
  if (year === 2021 || year === 2022) return '2021-2022';
  if (year === 2023 || year === 2024) return '2023-2024';
  throw new Error('Unsupported Session Daily historical year: ' + year);
}

async function loadCursor(): Promise<Cursor> {
  const result = await pool.query<{
    next_year: string | null;
    next_page: string | null;
    done: boolean | null;
  }>(`
    SELECT metadata->>'nextYear' AS next_year,
           metadata->>'nextPage' AS next_page,
           COALESCE((metadata->>'done')::boolean,false) AS done
      FROM ingestion_runs
     WHERE source_system='session-daily-historical-backfill'
       AND status='complete'
       AND metadata->>'version'=$1
     ORDER BY finished_at DESC NULLS LAST, started_at DESC
     LIMIT 1
  `, [SESSION_DAILY_HISTORICAL_BACKFILL_VERSION]);
  const row = result.rows[0];
  if (!row) return { year: START_YEAR, page: 1, done: false };
  if (row.done) return { year: END_YEAR + 1, page: 1, done: true };
  const year = Number(row.next_year);
  const page = Number(row.next_page);
  return {
    year: Number.isInteger(year) ? year : START_YEAR,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    done: false,
  };
}

async function startRun(cursor: Cursor, pages: number): Promise<string> {
  const result = await pool.query<{ id: string }>(`
    INSERT INTO ingestion_runs (source_system,scope,status,metadata)
    VALUES (
      'session-daily-historical-backfill',
      $1,
      'running',
      jsonb_build_object(
        'version',$2::text,
        'startYear',$3::int,
        'startPage',$4::int,
        'requestedPages',$5::int
      )
    )
    RETURNING id::text
  `, [
    'years:' + START_YEAR + '-' + END_YEAR,
    SESSION_DAILY_HISTORICAL_BACKFILL_VERSION,
    cursor.year,
    cursor.page,
    pages,
  ]);
  return result.rows[0].id;
}

async function finishRun(
  runId: string,
  status: 'complete' | 'failed',
  metadata: Record<string, unknown>,
  error?: string,
): Promise<void> {
  await pool.query(`
    UPDATE ingestion_runs
       SET status=$2,
           finished_at=now(),
           metadata=metadata || $3::jsonb,
           error_summary=$4
     WHERE id=$1::uuid
  `, [runId, status, JSON.stringify(metadata), error ?? null]);
}

async function loadSession(year: number): Promise<{
  session: SessionRow;
  members: MemberRow[];
  bills: BillRow[];
}> {
  const slug = sessionSlugForYear(year);
  const sessionResult = await pool.query<SessionRow>(`
    SELECT s.id::text,s.slug
      FROM legislative_sessions s
      JOIN jurisdictions j ON j.id=s.jurisdiction_id
     WHERE j.slug='us-mn' AND s.slug=$1
     LIMIT 2
  `, [slug]);
  if (sessionResult.rows.length !== 1) throw new Error('Minnesota session is not uniquely resolved: ' + slug);
  const session = sessionResult.rows[0];
  const [memberResult, billResult] = await Promise.all([
    pool.query<MemberRow>(`
      SELECT m.id::text AS membership_id,l.name,c.slug AS chamber_slug
        FROM memberships m
        JOIN legislators l ON l.id=m.legislator_id
        JOIN chambers c ON c.id=m.chamber_id
       WHERE m.session_id=$1::uuid
       ORDER BY c.slug,l.normalized_name,m.id
    `, [session.id]),
    pool.query<BillRow>(`
      SELECT b.id::text AS bill_id,b.identifier
        FROM bills b
       WHERE b.session_id=$1::uuid
         AND b.identifier ~ '^(HF|SF)[0-9]+$'
       ORDER BY b.identifier
    `, [session.id]),
  ]);
  return { session, members: memberResult.rows, bills: billResult.rows };
}

function billsMentionedInText(text: string, allBills: ReadonlyMap<string, BillRow>): BillRow[] {
  const found = new Map<string, BillRow>();
  for (const match of text.matchAll(/\b(?:HF|SF)\s*\d+\b/gi)) {
    const identifier = match[0].toUpperCase().replace(/\s+/g, '');
    const bill = allBills.get(identifier);
    if (bill) found.set(identifier, bill);
  }
  return [...found.values()];
}

async function fetchStory(url: string): Promise<PublicPage> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetchPublicPage(url, {
        timeoutMs: 20_000,
        maxBytes: 2_000_000,
        userAgent: 'VotePredict/2.0 session-daily-historical-backfill',
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Session Daily story fetch failed');
}

async function processStory(input: {
  url: string;
  year: number;
  session: SessionRow;
  members: readonly MemberRow[];
  billMap: ReadonlyMap<string, BillRow>;
}) {
  const page = await fetchStory(input.url);
  const publicationDay = sessionDailyPublishedDay(page.text, page.publishedAt, page.title);
  if (!publicationDay) {
    return { missingPublicationDay: 1, storiesWithBills: 0, storiesWithMentions: 0, inserted: 0, reused: 0, unresolved: 0 };
  }
  if (Number(publicationDay.slice(0, 4)) !== input.year) {
    return { missingPublicationDay: 0, storiesWithBills: 0, storiesWithMentions: 0, inserted: 0, reused: 0, unresolved: 0 };
  }

  const scopedBills = billsMentionedInText(page.text, input.billMap);
  if (scopedBills.length === 0) {
    return { missingPublicationDay: 0, storiesWithBills: 0, storiesWithMentions: 0, inserted: 0, reused: 0, unresolved: 0 };
  }

  const mentions = extractLegislativeSpeechMentions({
    text: page.text,
    bills: scopedBills.map((bill) => ({ id: bill.bill_id, identifier: bill.identifier })),
    members: input.members.map((member) => ({
      membershipId: member.membership_id,
      name: member.name,
      chamber: member.chamber_slug,
    })),
  });
  if (mentions.length === 0) {
    return { missingPublicationDay: 0, storiesWithBills: 1, storiesWithMentions: 0, inserted: 0, reused: 0, unresolved: 0 };
  }

  const publishedAt = publicationDay + 'T12:00:00.000Z';
  const drafts: DurableEvidenceDraft[] = mentions.map((mention) => ({
    target: { membershipId: mention.membershipId, billId: mention.billId },
    kind: 'context',
    stance: 'neutral',
    claim: mention.memberName + ' was attributed remarks in official Session Daily coverage discussing ' + mention.billIdentifier + '.',
    excerpt: mention.excerpt,
    publishedAt,
    sourceQuality: 'official',
    relevance: 'high',
    freshness: 'stale',
    extractionMethod: 'deterministic-official-legislative-speech-attribution',
    extractionVersion: LEGISLATIVE_SPEECH_EXTRACTOR_VERSION,
    confidence: 0.95,
    metadata: {
      contextType: 'structured_public',
      subtype: 'legislative_speech',
      extractedDirectionalLanguage: mention.stance,
      transcriptKind: 'official_session_daily_reporting',
      historicalBackfill: true,
      publicationDay,
      dateGranularity: 'day',
      sameDayAsTargetExcluded: true,
      asOfEligible: false,
      asOfEligibilityReason: 'historical archive page has publication day but no immutable revision history',
      historicalPageReconstruction: true,
      contextOnly: true,
      mechanicallyActionable: false,
      quickEvidenceStructured: true,
      modelWeight: 0,
    },
  }));

  const persisted = await persistDurableEvidence({
    sourceKind: 'house_session_daily',
    sourceUrl: page.canonicalUrl,
    contentSha256: page.contentSha256,
    sessionSlug: input.session.slug,
    fetchedAt: page.fetchedAt,
    httpStatus: page.httpStatus,
    metadata: {
      pipelineVersion: SESSION_DAILY_HISTORICAL_BACKFILL_VERSION,
      title: page.title,
      publicationDay,
      dateGranularity: 'day',
      historicalBackfill: true,
      extractorVersion: LEGISLATIVE_SPEECH_EXTRACTOR_VERSION,
      directionalLanguageStoredAsContextOnly: true,
      sameDayAsTargetExcluded: true,
      historicalPageReconstruction: true,
      retrospectivelyModelEligible: false,
    },
  }, drafts);

  return {
    missingPublicationDay: 0,
    storiesWithBills: 1,
    storiesWithMentions: 1,
    inserted: persisted.inserted,
    reused: persisted.reused,
    unresolved: persisted.unresolvedTargets.length,
  };
}

async function processArchivePage(year: number, pageNumber: number) {
  const archive = await fetchPublicPage(sessionDailyArchiveUrl(year, pageNumber), {
    timeoutMs: 20_000,
    maxBytes: 2_500_000,
    userAgent: 'VotePredict/2.0 session-daily-historical-backfill',
  });
  const maxPage = extractSessionDailyArchiveMaxPage(archive.rawContent);
  const storyLinks = extractSessionDailyStoryLinks(archive.links);
  const { session, members, bills } = await loadSession(year);
  const billMap = new Map(bills.map((bill) => [bill.identifier.toUpperCase(), bill]));
  const totals = emptyTotals();
  totals.archivePagesFetched = 1;
  totals.storiesScanned = storyLinks.length;
  const failures: Array<{ url: string; error: string }> = [];

  for (let offset = 0; offset < storyLinks.length; offset += STORY_CONCURRENCY) {
    const chunk = storyLinks.slice(offset, offset + STORY_CONCURRENCY);
    const results = await Promise.all(chunk.map(async (url) => {
      try {
        return { ok: true as const, result: await processStory({ url, year, session, members, billMap }) };
      } catch (error) {
        return { ok: false as const, url, error: safeMessage(error) };
      }
    }));
    for (const row of results) {
      if (!row.ok) {
        totals.storyFailures += 1;
        failures.push({ url: row.url, error: row.error });
        continue;
      }
      totals.storiesWithBills += row.result.storiesWithBills;
      totals.storiesWithMentions += row.result.storiesWithMentions;
      totals.evidenceInserted += row.result.inserted;
      totals.evidenceReused += row.result.reused;
      totals.unresolvedTargets += row.result.unresolved;
      totals.missingPublicationDay += row.result.missingPublicationDay;
    }
  }

  return { maxPage, totals, failures };
}

function addTotals(
  target: ReturnType<typeof emptyTotals>,
  source: ReturnType<typeof emptyTotals>,
): void {
  for (const key of Object.keys(target) as Array<keyof typeof target>) target[key] += source[key];
}

export async function backfillSessionDailyHistoricalBatch(
  requestedPages = DEFAULT_PAGES_PER_BATCH,
): Promise<SessionDailyHistoricalBackfillBatchResult> {
  const pages = Math.min(MAX_PAGES_PER_BATCH, Math.max(1, Math.trunc(requestedPages)));
  const cursor = await loadCursor();
  if (cursor.done || cursor.year > END_YEAR) {
    return {
      version: SESSION_DAILY_HISTORICAL_BACKFILL_VERSION,
      start: { year: END_YEAR + 1, page: 1 },
      next: { year: END_YEAR + 1, page: 1 },
      pagesProcessed: 0,
      ...emptyTotals(),
      done: true,
      servingProbabilityChange: 'none',
      allNewFeatureWeights: 0,
    };
  }

  const runId = await startRun(cursor, pages);
  const start = { year: cursor.year, page: cursor.page };
  const totals = emptyTotals();
  const failures: Array<{ url: string; error: string }> = [];
  let year = cursor.year;
  let page = cursor.page;
  let pagesProcessed = 0;

  try {
    while (pagesProcessed < pages && year <= END_YEAR) {
      const result = await processArchivePage(year, page);
      addTotals(totals, result.totals);
      failures.push(...result.failures);
      pagesProcessed += 1;
      if (page >= result.maxPage) {
        year += 1;
        page = 1;
      } else {
        page += 1;
      }
    }
    const done = year > END_YEAR;
    const metadata = {
      version: SESSION_DAILY_HISTORICAL_BACKFILL_VERSION,
      startYear: start.year,
      startPage: start.page,
      nextYear: year,
      nextPage: page,
      pagesProcessed,
      ...totals,
      failures: failures.slice(0, 20),
      done,
      servingProbabilityChange: 'none',
      allNewFeatureWeights: 0,
    };
    await finishRun(runId, 'complete', metadata);
    return {
      version: SESSION_DAILY_HISTORICAL_BACKFILL_VERSION,
      start,
      next: { year, page },
      pagesProcessed,
      ...totals,
      done,
      servingProbabilityChange: 'none',
      allNewFeatureWeights: 0,
    };
  } catch (error) {
    await finishRun(runId, 'failed', {
      version: SESSION_DAILY_HISTORICAL_BACKFILL_VERSION,
      startYear: start.year,
      startPage: start.page,
      nextYear: year,
      nextPage: page,
      pagesProcessed,
      ...totals,
      failures: failures.slice(0, 20),
      done: false,
      servingProbabilityChange: 'none',
      allNewFeatureWeights: 0,
    }, safeMessage(error)).catch(() => undefined);
    throw error;
  }
}

export async function verifySessionDailyHistoricalBackfill() {
  const [cursor, coverage] = await Promise.all([
    loadCursor(),
    pool.query<{
      session_slug: string;
      evidence_rows: string;
      members: string;
      bills: string;
      documents: string;
    }>(`
      SELECT s.slug AS session_slug,
             count(ei.id)::text AS evidence_rows,
             count(DISTINCT ei.membership_id)::text AS members,
             count(DISTINCT ei.bill_id)::text AS bills,
             count(DISTINCT ei.source_document_id)::text AS documents
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        JOIN legislative_sessions s ON s.id=sd.session_id
       WHERE sd.source_kind='house_session_daily'
         AND ei.metadata->>'historicalBackfill'='true'
         AND s.slug IN ('2021-2022','2023-2024')
       GROUP BY s.slug,s.starts_on
       ORDER BY s.starts_on
    `),
  ]);
  return {
    version: SESSION_DAILY_HISTORICAL_BACKFILL_VERSION,
    done: cursor.done,
    next: { year: cursor.year, page: cursor.page },
    coverage: coverage.rows.map((row) => ({
      session: row.session_slug,
      evidenceRows: Number(row.evidence_rows),
      members: Number(row.members),
      bills: Number(row.bills),
      documents: Number(row.documents),
    })),
    servingProbabilityChange: 'none',
    allNewFeatureWeights: 0,
  };
}
