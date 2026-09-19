import { pool } from '@/lib/db';
import { persistDurableEvidence, type DurableEvidenceDraft } from '@/evidence/durable-ingestion';
import { fetchPublicPage, type PublicPage } from '@/evidence/public-http';
import {
  committeeBillIdentifiers,
  discoverHouseCommitteeMinuteIndexes,
  discoverHouseCommitteeMinutes,
  discoverSenateCommitteeIds,
  discoverSenateHearings,
  extractCommitteeBillRollCalls,
  extractCommitteeMeetingDate,
  senateHearingMinutesUrl,
  type CommitteeRollCall,
} from '@/sources/minnesota/committee-minutes';
import {
  resolveRevisorAuthor,
  type AuthorshipRosterMember,
  type RevisorAuthorResolution,
} from '@/sources/minnesota/revisor-author-resolution';

export const COMMITTEE_EVIDENCE_PIPELINE_VERSION = 'committee-evidence-v1' as const;
const HOUSE_COMMITTEES_PER_RUN = 6;
const SENATE_COMMITTEES_PER_RUN = 6;
const MEETINGS_PER_COMMITTEE = 3;
const FETCH_CONCURRENCY = 4;

type SessionContext = {
  sessionId: string;
  sessionSlug: string;
  startsOn: string;
  legislatureNumber: number;
};

type BillRow = { id: string; identifier: string; chamber_slug: 'house' | 'senate' };
type PageSource = {
  chamber: 'house' | 'senate';
  url: string;
  fallbackDate?: string;
  sourceStatus: 'house_official_minutes' | 'senate_hosted_minutes';
  historicalBackfill?: boolean;
};

type RunState = {
  nextHouseOffset: number;
  nextSenateOffset: number;
};

type PageOutcome = {
  sourceUrl: string;
  chamber: 'house' | 'senate';
  rollCalls: number;
  inserted: number;
  reused: number;
  resolvedVotes: number;
  unresolvedVotes: number;
  ambiguousVotes: number;
  skippedUnknownBills: number;
  errors: string[];
};

export interface CommitteeEvidenceRefreshResult {
  pipelineVersion: typeof COMMITTEE_EVIDENCE_PIPELINE_VERSION;
  session: string;
  houseCommittees: number;
  senateCommittees: number;
  pagesAttempted: number;
  pagesSucceeded: number;
  rollCalls: number;
  inserted: number;
  reused: number;
  resolvedVotes: number;
  unresolvedVotes: number;
  ambiguousVotes: number;
  skippedUnknownBills: number;
  nextHouseOffset: number;
  nextSenateOffset: number;
  warnings: string[];
}

function legislatureNumber(startsOn: string): number {
  const year = Number(startsOn.slice(0, 4));
  const value = (year - 1837) / 2;
  if (!Number.isInteger(value) || value < 1) throw new Error(`Cannot derive Minnesota Legislature number from ${startsOn}`);
  return value;
}

async function sessionBySlug(slug: string): Promise<SessionContext> {
  const result = await pool.query<{
    id: string;
    slug: string;
    starts_on: string;
  }>(`
    SELECT id::text,slug,starts_on::text
      FROM legislative_sessions
     WHERE jurisdiction_id=(SELECT id FROM jurisdictions WHERE slug='us-mn')
       AND slug=$1
     ORDER BY starts_on DESC
     LIMIT 1`, [slug]);
  const row = result.rows[0];
  if (!row) throw new Error(`Minnesota session ${slug} is unavailable`);
  return {
    sessionId: row.id,
    sessionSlug: row.slug,
    startsOn: row.starts_on,
    legislatureNumber: legislatureNumber(row.starts_on),
  };
}

async function currentSession(): Promise<SessionContext> {
  const result = await pool.query<{
    id: string;
    slug: string;
    starts_on: string;
  }>(`
    SELECT id::text, slug, starts_on::text
      FROM legislative_sessions
     WHERE jurisdiction_id=(SELECT id FROM jurisdictions WHERE slug='us-mn')
       AND starts_on <= current_date
       AND (ends_on IS NULL OR ends_on >= current_date)
     ORDER BY starts_on DESC
     LIMIT 1`);
  const row = result.rows[0];
  if (!row) throw new Error('No active Minnesota legislative session');
  return {
    sessionId: row.id,
    sessionSlug: row.slug,
    startsOn: row.starts_on,
    legislatureNumber: legislatureNumber(row.starts_on),
  };
}

async function billsForSession(sessionId: string): Promise<Map<string, BillRow>> {
  const result = await pool.query<BillRow>(`
    SELECT b.id::text,
           upper(b.identifier) AS identifier,
           c.slug AS chamber_slug
      FROM bills b
      JOIN chambers c ON c.id=b.originating_chamber_id
     WHERE b.session_id=$1::uuid
  `, [sessionId]);
  return new Map(result.rows.map((row) => [row.identifier.replace(/\s+/g, ''), row]));
}

async function rosterForSession(sessionId: string): Promise<Record<'house' | 'senate', AuthorshipRosterMember[]>> {
  const result = await pool.query<{
    membership_id: string;
    legislator_id: string;
    name: string;
    chamber: 'house' | 'senate';
  }>(`
    SELECT m.id::text AS membership_id,
           l.id::text AS legislator_id,
           l.name,
           c.slug AS chamber
      FROM memberships m
      JOIN legislators l ON l.id=m.legislator_id
      JOIN chambers c ON c.id=m.chamber_id
     WHERE m.session_id=$1::uuid
       AND c.slug IN ('house','senate')
     ORDER BY c.slug,l.normalized_name,m.id
  `, [sessionId]);
  return {
    house: result.rows.filter((row) => row.chamber === 'house').map((row) => ({
      membershipId: row.membership_id,
      legislatorId: row.legislator_id,
      name: row.name,
      chamber: 'house',
    })),
    senate: result.rows.filter((row) => row.chamber === 'senate').map((row) => ({
      membershipId: row.membership_id,
      legislatorId: row.legislator_id,
      name: row.name,
      chamber: 'senate',
    })),
  };
}

async function previousState(): Promise<RunState> {
  const result = await pool.query<{ metadata: Record<string, unknown> }>(`
    SELECT metadata
      FROM ingestion_runs
     WHERE source_system='committee-evidence-pipeline'
       AND status='complete'
     ORDER BY started_at DESC
     LIMIT 1
  `);
  const metadata = result.rows[0]?.metadata ?? {};
  const number = (key: string) => {
    const parsed = Number(metadata[key]);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  };
  return { nextHouseOffset: number('nextHouseOffset'), nextSenateOffset: number('nextSenateOffset') };
}

function rotate<T>(values: readonly T[], offset: number, count: number): { selected: T[]; next: number } {
  if (values.length === 0) return { selected: [], next: 0 };
  const start = offset % values.length;
  const selected: T[] = [];
  for (let index = 0; index < Math.min(count, values.length); index += 1) {
    selected.push(values[(start + index) % values.length]);
  }
  return { selected, next: (start + selected.length) % values.length };
}

async function fetchPage(url: string): Promise<PublicPage> {
  return fetchPublicPage(url, {
    timeoutMs: 18_000,
    maxBytes: 2_500_000,
    userAgent: 'VotePredict/2.0 committee-evidence-v1',
  });
}

function minuteId(url: string): number {
  const match = new URL(url).pathname.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : 0;
}

async function discoverHouseSources(indexes: readonly string[]): Promise<PageSource[]> {
  const pages: PageSource[] = [];
  for (const indexUrl of indexes) {
    try {
      const index = await fetchPage(indexUrl);
      const recent = discoverHouseCommitteeMinutes(index.rawContent)
        .sort((a, b) => minuteId(b) - minuteId(a))
        .slice(0, MEETINGS_PER_COMMITTEE);
      for (const url of recent) pages.push({
        chamber: 'house',
        url,
        sourceStatus: 'house_official_minutes',
      });
    } catch {
      // Page-level failure is reported when source fetches run; discovery stays best-effort.
    }
  }
  return pages;
}

async function discoverSenateSources(
  committeeIds: readonly string[],
  legislature: number,
): Promise<PageSource[]> {
  const pages: PageSource[] = [];
  for (const committeeId of committeeIds) {
    try {
      const schedule = await fetchPage(`https://www.senate.mn/schedule/committee/${committeeId}`);
      for (const hearing of discoverSenateHearings(schedule.rawContent).slice(0, MEETINGS_PER_COMMITTEE)) {
        pages.push({
          chamber: 'senate',
          url: senateHearingMinutesUrl(hearing.hearingId, legislature),
          fallbackDate: hearing.meetingDate,
          sourceStatus: 'senate_hosted_minutes',
        });
      }
    } catch {
      // Best-effort discovery; source fetch diagnostics below remain authoritative.
    }
  }
  return pages;
}

async function mapConcurrent<T, R>(
  values: readonly T[],
  limit: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      output[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, run));
  return output;
}

function resolutionStats(rows: readonly RevisorAuthorResolution[]) {
  return {
    resolved: rows.filter((row) => row.status === 'resolved').length,
    unresolved: rows.filter((row) => row.status === 'unresolved').length,
    ambiguous: rows.filter((row) => row.status === 'ambiguous').length,
  };
}

function evidenceDrafts(input: {
  rollCalls: readonly CommitteeRollCall[];
  chamber: 'house' | 'senate';
  roster: readonly AuthorshipRosterMember[];
  bills: ReadonlyMap<string, BillRow>;
  meetingDate: string;
  sourceUrl: string;
  sourceStatus: PageSource['sourceStatus'];
  historicalBackfill?: boolean;
}): {
  drafts: DurableEvidenceDraft[];
  resolvedVotes: number;
  unresolvedVotes: number;
  ambiguousVotes: number;
  skippedUnknownBills: number;
} {
  const drafts: DurableEvidenceDraft[] = [];
  const resolutions: RevisorAuthorResolution[] = [];
  let skippedUnknownBills = 0;

  for (const rollCall of input.rollCalls) {
    const bill = input.bills.get(rollCall.identifier.replace(/\s+/g, '').toUpperCase());
    if (!bill) {
      skippedUnknownBills += 1;
      continue;
    }
    const sides = [
      ...rollCall.ayes.map((rawName) => ({ rawName, voteSide: 'aye' as const })),
      ...rollCall.nays.map((rawName) => ({ rawName, voteSide: 'nay' as const })),
    ];
    for (const side of sides) {
      const resolution = resolveRevisorAuthor(side.rawName, input.chamber, input.roster);
      resolutions.push(resolution);
      if (resolution.status !== 'resolved' || !resolution.membershipId) continue;
      drafts.push({
        target: {
          membershipId: resolution.membershipId,
          billId: bill.id,
          sessionSlug: undefined,
          chamberSlug: input.chamber,
          occurredOn: input.meetingDate,
        },
        kind: 'fact',
        stance: 'neutral',
        claim: `${resolution.memberName ?? side.rawName} cast a committee ${side.voteSide.toUpperCase()} vote on a ${rollCall.motionType.replaceAll('_', ' ')} motion for ${rollCall.identifier}.`,
        excerpt: rollCall.excerpt,
        publishedAt: `${input.meetingDate}T00:00:00.000Z`,
        sourceQuality: 'official',
        relevance: 'direct',
        freshness: 'current',
        extractionMethod: 'deterministic-committee-bill-roll-call',
        extractionVersion: COMMITTEE_EVIDENCE_PIPELINE_VERSION,
        confidence: 1,
        metadata: {
          contextType: 'committee_bill_vote',
          committeeMotionType: rollCall.motionType,
          committeeVoteSide: side.voteSide,
          committeeResult: rollCall.result,
          meetingDate: input.meetingDate,
          sourceRecordStatus: input.sourceStatus,
          historicalBackfill: input.historicalBackfill === true,
          sourceVerified: true,
          mechanicallyActionable: false,
          quickEvidenceCandidate: false,
          directionalInterpretation: 'none',
          evidenceSeriesKey: `committee_vote:${bill.id}:${resolution.membershipId}:${input.sourceUrl}:${rollCall.motionType}`,
        },
      });
    }
  }
  const stats = resolutionStats(resolutions);
  return {
    drafts,
    resolvedVotes: stats.resolved,
    unresolvedVotes: stats.unresolved,
    ambiguousVotes: stats.ambiguous,
    skippedUnknownBills,
  };
}

async function processSource(input: {
  source: PageSource;
  session: SessionContext;
  bills: ReadonlyMap<string, BillRow>;
  roster: Record<'house' | 'senate', AuthorshipRosterMember[]>;
}): Promise<PageOutcome> {
  const errors: string[] = [];
  try {
    const page = await fetchPage(input.source.url);
    const meetingDate = extractCommitteeMeetingDate(page.rawContent) ?? input.source.fallbackDate;
    if (!meetingDate) throw new Error('Committee meeting date could not be extracted');
    const identifiers = committeeBillIdentifiers(page.rawContent)
      .filter((identifier) => input.bills.has(identifier));
    if (identifiers.length === 0) {
      return {
        sourceUrl: input.source.url,
        chamber: input.source.chamber,
        rollCalls: 0,
        inserted: 0,
        reused: 0,
        resolvedVotes: 0,
        unresolvedVotes: 0,
        ambiguousVotes: 0,
        skippedUnknownBills: 0,
        errors: [],
      };
    }
    const rollCalls = extractCommitteeBillRollCalls(page.rawContent, identifiers);
    const extracted = evidenceDrafts({
      rollCalls,
      chamber: input.source.chamber,
      roster: input.roster[input.source.chamber],
      bills: input.bills,
      meetingDate,
      sourceUrl: page.canonicalUrl,
      sourceStatus: input.source.sourceStatus,
      historicalBackfill: input.source.historicalBackfill,
    });
    if (extracted.drafts.length === 0) {
      return {
        sourceUrl: page.canonicalUrl,
        chamber: input.source.chamber,
        rollCalls: rollCalls.length,
        inserted: 0,
        reused: 0,
        resolvedVotes: extracted.resolvedVotes,
        unresolvedVotes: extracted.unresolvedVotes,
        ambiguousVotes: extracted.ambiguousVotes,
        skippedUnknownBills: extracted.skippedUnknownBills,
        errors: [],
      };
    }
    const persisted = await persistDurableEvidence({
      sourceKind: input.source.chamber === 'house' ? 'house_committee_minutes' : 'senate_committee_minutes',
      sourceUrl: page.canonicalUrl,
      contentSha256: page.contentSha256,
      jurisdictionSlug: 'us-mn',
      sessionSlug: input.session.sessionSlug,
      chamberSlug: input.source.chamber,
      fetchedAt: page.fetchedAt,
      httpStatus: page.httpStatus,
      metadata: {
        pipelineVersion: COMMITTEE_EVIDENCE_PIPELINE_VERSION,
        meetingDate,
        sourceRecordStatus: input.source.sourceStatus,
        historicalBackfill: input.source.historicalBackfill === true,
        title: page.title,
      },
    }, extracted.drafts);
    return {
      sourceUrl: page.canonicalUrl,
      chamber: input.source.chamber,
      rollCalls: rollCalls.length,
      inserted: persisted.inserted,
      reused: persisted.reused,
      resolvedVotes: extracted.resolvedVotes,
      unresolvedVotes: extracted.unresolvedVotes,
      ambiguousVotes: extracted.ambiguousVotes,
      skippedUnknownBills: extracted.skippedUnknownBills,
      errors,
    };
  } catch (error) {
    errors.push((error instanceof Error ? error.message : String(error)).slice(0, 600));
    return {
      sourceUrl: input.source.url,
      chamber: input.source.chamber,
      rollCalls: 0,
      inserted: 0,
      reused: 0,
      resolvedVotes: 0,
      unresolvedVotes: 0,
      ambiguousVotes: 0,
      skippedUnknownBills: 0,
      errors,
    };
  }
}

async function beginRun(session: SessionContext): Promise<string> {
  const result = await pool.query<{ id: string }>(`
    INSERT INTO ingestion_runs (source_system,scope,status,metadata)
    VALUES ('committee-evidence-pipeline',$1,'running',$2::jsonb)
    RETURNING id::text
  `, [`session:${session.sessionSlug}`, JSON.stringify({
    pipelineVersion: COMMITTEE_EVIDENCE_PIPELINE_VERSION,
  })]);
  return result.rows[0].id;
}

function historicalHouseSessionForCommitteeId(committeeId: number): string | undefined {
  const legislature = Math.floor(committeeId / 1000);
  if (legislature === 92) return '2021-2022';
  if (legislature === 93) return '2023-2024';
  if (legislature === 94) return '2025-2026';
  return undefined;
}

export async function backfillHistoricalHouseCommitteeEvidence(committeeId: number): Promise<{
  committeeId: number;
  session?: string;
  found: boolean;
  pages: number;
  rollCalls: number;
  inserted: number;
  reused: number;
  resolvedVotes: number;
  unresolvedVotes: number;
  ambiguousVotes: number;
  skippedUnknownBills: number;
  warnings: string[];
}> {
  if (!Number.isInteger(committeeId)) throw new Error('committeeId must be an integer');
  const sessionSlug = historicalHouseSessionForCommitteeId(committeeId);
  if (!sessionSlug) {
    return {
      committeeId,
      found: false,
      pages: 0,
      rollCalls: 0,
      inserted: 0,
      reused: 0,
      resolvedVotes: 0,
      unresolvedVotes: 0,
      ambiguousVotes: 0,
      skippedUnknownBills: 0,
      warnings: ['unsupported committee legislature'],
    };
  }
  const session = await sessionBySlug(sessionSlug);
  let index: PublicPage;
  try {
    index = await fetchPage(`https://www.house.mn.gov/Committees/minutes/${committeeId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/HTTP 404/i.test(message) || /too little readable text/i.test(message)) {
      return {
        committeeId,
        session: sessionSlug,
        found: false,
        pages: 0,
        rollCalls: 0,
        inserted: 0,
        reused: 0,
        resolvedVotes: 0,
        unresolvedVotes: 0,
        ambiguousVotes: 0,
        skippedUnknownBills: 0,
        warnings: [],
      };
    }
    throw error;
  }
  const urls = discoverHouseCommitteeMinutes(index.rawContent);
  if (urls.length === 0) {
    return {
      committeeId,
      session: sessionSlug,
      found: true,
      pages: 0,
      rollCalls: 0,
      inserted: 0,
      reused: 0,
      resolvedVotes: 0,
      unresolvedVotes: 0,
      ambiguousVotes: 0,
      skippedUnknownBills: 0,
      warnings: ['committee minute index contained no minute detail links'],
    };
  }

  const [bills, roster] = await Promise.all([
    billsForSession(session.sessionId),
    rosterForSession(session.sessionId),
  ]);
  const outcomes = await mapConcurrent(
    urls.map((url): PageSource => ({
      chamber: 'house',
      url,
      sourceStatus: 'house_official_minutes',
      historicalBackfill: true,
    })),
    FETCH_CONCURRENCY,
    (source) => processSource({ source, session, bills, roster }),
  );
  return {
    committeeId,
    session: sessionSlug,
    found: true,
    pages: outcomes.length,
    rollCalls: outcomes.reduce((sum, row) => sum + row.rollCalls, 0),
    inserted: outcomes.reduce((sum, row) => sum + row.inserted, 0),
    reused: outcomes.reduce((sum, row) => sum + row.reused, 0),
    resolvedVotes: outcomes.reduce((sum, row) => sum + row.resolvedVotes, 0),
    unresolvedVotes: outcomes.reduce((sum, row) => sum + row.unresolvedVotes, 0),
    ambiguousVotes: outcomes.reduce((sum, row) => sum + row.ambiguousVotes, 0),
    skippedUnknownBills: outcomes.reduce((sum, row) => sum + row.skippedUnknownBills, 0),
    warnings: outcomes
      .flatMap((row) => row.errors.map((message) => `${row.sourceUrl}: ${message}`))
      .slice(0, 30),
  };
}

export async function refreshCommitteeEvidence(): Promise<CommitteeEvidenceRefreshResult> {
  const session = await currentSession();
  const runId = await beginRun(session);
  try {
    const [bills, roster, state, houseList, senateList] = await Promise.all([
      billsForSession(session.sessionId),
      rosterForSession(session.sessionId),
      previousState(),
      fetchPage('https://www.house.mn.gov/committees'),
      fetchPage('https://www.senate.mn/committees/index.html'),
    ]);
    const houseIndexes = discoverHouseCommitteeMinuteIndexes(houseList.rawContent);
    const senateIds = discoverSenateCommitteeIds(senateList.rawContent);
    const houseRotation = rotate(houseIndexes, state.nextHouseOffset, HOUSE_COMMITTEES_PER_RUN);
    const senateRotation = rotate(senateIds, state.nextSenateOffset, SENATE_COMMITTEES_PER_RUN);
    const [houseSources, senateSources] = await Promise.all([
      discoverHouseSources(houseRotation.selected),
      discoverSenateSources(senateRotation.selected, session.legislatureNumber),
    ]);
    const sources = [...new Map(
      [...houseSources, ...senateSources].map((source) => [source.url, source]),
    ).values()];
    const outcomes = await mapConcurrent(sources, FETCH_CONCURRENCY, (source) =>
      processSource({ source, session, bills, roster }));

    const result: CommitteeEvidenceRefreshResult = {
      pipelineVersion: COMMITTEE_EVIDENCE_PIPELINE_VERSION,
      session: session.sessionSlug,
      houseCommittees: houseRotation.selected.length,
      senateCommittees: senateRotation.selected.length,
      pagesAttempted: outcomes.length,
      pagesSucceeded: outcomes.filter((row) => row.errors.length === 0).length,
      rollCalls: outcomes.reduce((sum, row) => sum + row.rollCalls, 0),
      inserted: outcomes.reduce((sum, row) => sum + row.inserted, 0),
      reused: outcomes.reduce((sum, row) => sum + row.reused, 0),
      resolvedVotes: outcomes.reduce((sum, row) => sum + row.resolvedVotes, 0),
      unresolvedVotes: outcomes.reduce((sum, row) => sum + row.unresolvedVotes, 0),
      ambiguousVotes: outcomes.reduce((sum, row) => sum + row.ambiguousVotes, 0),
      skippedUnknownBills: outcomes.reduce((sum, row) => sum + row.skippedUnknownBills, 0),
      nextHouseOffset: houseRotation.next,
      nextSenateOffset: senateRotation.next,
      warnings: outcomes.flatMap((row) => row.errors.map((message) => `${row.sourceUrl}: ${message}`)).slice(0, 50),
    };
    await pool.query(`
      UPDATE ingestion_runs
         SET status='complete',
             finished_at=now(),
             source_documents=$2,
             unresolved_members=$3,
             metadata=$4::jsonb
       WHERE id=$1::uuid
    `, [
      runId,
      result.pagesSucceeded,
      result.unresolvedVotes + result.ambiguousVotes,
      JSON.stringify(result),
    ]);
    return result;
  } catch (error) {
    await pool.query(`
      UPDATE ingestion_runs
         SET status='failed',finished_at=now(),error_summary=$2
       WHERE id=$1::uuid
    `, [runId, (error instanceof Error ? error.message : String(error)).slice(0, 1200)]);
    throw error;
  }
}
