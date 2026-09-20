import { pool } from '@/lib/db';
import { persistDurableEvidence, type DurableEvidenceDraft, type DurableEvidencePersistResult } from './durable-ingestion';
import { fetchPublicPage } from './public-http';
import {
  parseSosLegislativeByDistrict,
  summarizeLegislativeDistrict,
  MN_SOS_LEGISLATIVE_RESULTS_PARSER_VERSION,
  type MinnesotaLegislativeOffice,
} from './minnesota-election-context';
import {
  extractHouseRecordedVoteLinks,
  parseConferenceCommitteeAppointments,
  parseHouseRecordedFloorVotes,
  MN_FLOOR_CONFERENCE_PARSER_VERSION,
} from './minnesota-floor-conference';
import {
  parseHouseResearchSummaryIndex,
  summarizeFiscalNoteSearch,
  MN_BILL_CONTEXT_PARSER_VERSION,
} from './minnesota-bill-context';
import {
  extractLegislativeSpeechMentions,
  LEGISLATIVE_SPEECH_EXTRACTOR_VERSION,
} from './legislative-speech';
import { resolveRevisorAuthor, type AuthorshipRosterMember } from '@/sources/minnesota/revisor-author-resolution';

export const STRUCTURED_PUBLIC_REFRESH_VERSION = 'structured-public-v4' as const;

const CONFERENCE_URL = 'https://www.leg.mn.gov/leg/cc/';
const SESSION_DAILY_URL = 'https://www.house.mn.gov/SessionDaily';
const DEFAULT_BILL_BATCH = 6;
const MAX_BILL_BATCH = 12;
const SESSION_DAILY_PAGES = 3;
const SESSION_DAILY_ARTICLES = 24;

type CurrentSession = { id: string; slug: string; starts_on: string };
type MemberRow = {
  membership_id: string;
  legislator_id: string;
  name: string;
  chamber_slug: 'house' | 'senate';
  district: string;
};
type BillRow = {
  bill_id: string;
  identifier: string;
  session_slug: string;
  session_start_year: number;
};
type StreamCounts = { attempted: number; inserted: number; reused: number; unresolved: number; failures: number };

export interface StructuredPublicRefreshOptions {
  now?: Date;
  billBatchSize?: number;
}

function emptyCounts(): StreamCounts {
  return { attempted: 0, inserted: 0, reused: 0, unresolved: 0, failures: 0 };
}

function addPersisted(target: StreamCounts, result: DurableEvidencePersistResult): void {
  target.inserted += result.inserted;
  target.reused += result.reused;
  target.unresolved += result.unresolvedTargets.length;
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 500);
}

function priorGeneralElectionDate(sessionStartYear: number): Date {
  const year = sessionStartYear - 1;
  const first = new Date(Date.UTC(year, 10, 1));
  const firstMonday = 1 + ((8 - first.getUTCDay()) % 7);
  return new Date(Date.UTC(year, 10, firstMonday + 1));
}

function yyyymmdd(value: Date): string {
  return String(value.getUTCFullYear())
    + String(value.getUTCMonth() + 1).padStart(2, '0')
    + String(value.getUTCDate()).padStart(2, '0');
}

async function loadCurrentSession(): Promise<CurrentSession> {
  const sql = "SELECT s.id::text, s.slug, s.starts_on::text FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id WHERE j.slug='us-mn' AND s.is_current=true ORDER BY s.starts_on DESC LIMIT 2";
  const result = await pool.query<CurrentSession>(sql);
  if (result.rows.length !== 1) throw new Error('Current Minnesota legislative session is not uniquely resolved');
  return result.rows[0];
}

async function loadHistoricalBackfillSessions(): Promise<CurrentSession[]> {
  const sql = "SELECT s.id::text,s.slug,s.starts_on::text FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id WHERE j.slug='us-mn' AND s.slug IN ('2021-2022','2023-2024') ORDER BY s.starts_on";
  return (await pool.query<CurrentSession>(sql)).rows;
}

async function loadSessionMembers(sessionId: string): Promise<MemberRow[]> {
  const sql = "SELECT m.id::text AS membership_id,m.legislator_id::text AS legislator_id,l.name,c.slug AS chamber_slug,m.district FROM memberships m JOIN legislators l ON l.id=m.legislator_id JOIN chambers c ON c.id=m.chamber_id WHERE m.session_id=$1::uuid ORDER BY c.slug,l.normalized_name,m.id";
  return (await pool.query<MemberRow>(sql, [sessionId])).rows;
}

async function historicalElectionBackfillComplete(sessionId: string): Promise<boolean> {
  const sql = "SELECT count(*)::int AS rows FROM evidence_items ei JOIN memberships m ON m.id=ei.membership_id WHERE m.session_id=$1::uuid AND ei.metadata->>'subtype'='district_election_context' AND ei.extraction_version=$2";
  const result = await pool.query<{ rows: number }>(sql, [sessionId, MN_SOS_LEGISLATIVE_RESULTS_PARSER_VERSION]);
  return (result.rows[0]?.rows ?? 0) >= 100;
}

async function loadCurrentMembers(sessionId: string): Promise<MemberRow[]> {
  const sql = "SELECT m.id::text AS membership_id,m.legislator_id::text AS legislator_id,l.name,c.slug AS chamber_slug,m.district FROM memberships m JOIN legislators l ON l.id=m.legislator_id JOIN chambers c ON c.id=m.chamber_id WHERE m.session_id=$1::uuid AND (m.starts_on IS NULL OR m.starts_on<=current_date) AND (m.ends_on IS NULL OR m.ends_on>=current_date) ORDER BY c.slug,l.normalized_name,m.id";
  return (await pool.query<MemberRow>(sql, [sessionId])).rows;
}

async function loadRoster(sessionId: string): Promise<AuthorshipRosterMember[]> {
  const sql = "SELECT m.id::text AS membership_id,l.id::text AS legislator_id,l.name,c.slug AS chamber,COALESCE(array_agg(DISTINCT msa.source_name) FILTER (WHERE msa.source_name IS NOT NULL),ARRAY[]::text[]) AS aliases FROM memberships m JOIN legislators l ON l.id=m.legislator_id JOIN chambers c ON c.id=m.chamber_id LEFT JOIN membership_source_aliases msa ON msa.membership_id=m.id WHERE m.session_id=$1::uuid GROUP BY m.id,l.id,l.name,c.slug,l.normalized_name ORDER BY c.slug,l.normalized_name,m.id";
  const result = await pool.query<{
    membership_id: string;
    legislator_id: string;
    name: string;
    chamber: 'house' | 'senate';
    aliases: string[];
  }>(sql, [sessionId]);
  return result.rows.map((row) => ({
    membershipId: row.membership_id,
    legislatorId: row.legislator_id,
    name: row.name,
    chamber: row.chamber,
    aliases: row.aliases,
  }));
}

async function loadAllBills(session: CurrentSession): Promise<BillRow[]> {
  const year = Number(session.starts_on.slice(0, 4));
  const sql = "SELECT id::text AS bill_id,identifier FROM bills WHERE session_id=$1::uuid AND identifier ~ '^(HF|SF)[0-9]+$' ORDER BY COALESCE(latest_action_at,introduced_at,created_at) DESC,identifier";
  const rows = (await pool.query<{ bill_id: string; identifier: string }>(sql, [session.id])).rows;
  return rows.map((row) => ({
    ...row,
    session_slug: session.slug,
    session_start_year: year,
  }));
}

async function loadActivityBills(session: CurrentSession): Promise<BillRow[]> {
  const year = Number(session.starts_on.slice(0, 4));
  const sql = "WITH eligible AS (SELECT b.id::text AS bill_id,b.identifier,left(b.identifier,2) AS prefix,COALESCE((SELECT max(ve.occurred_on)::timestamptz FROM vote_events ve WHERE ve.bill_id=b.id),b.latest_action_at,b.introduced_at,b.created_at) AS activity_at FROM bills b WHERE b.session_id=$1::uuid AND b.identifier ~ '^(HF|SF)[0-9]+$' AND (EXISTS (SELECT 1 FROM vote_events ve WHERE ve.bill_id=b.id) OR b.latest_action_at >= current_date - interval '45 days')), ranked AS (SELECT bill_id,identifier,prefix,row_number() OVER (PARTITION BY prefix ORDER BY activity_at DESC,identifier) AS chamber_rank FROM eligible) SELECT bill_id,identifier FROM ranked ORDER BY chamber_rank,prefix,identifier";
  const rows = (await pool.query<{ bill_id: string; identifier: string }>(sql, [session.id])).rows;
  return rows.map((row) => ({
    ...row,
    session_slug: session.slug,
    session_start_year: year,
  }));
}

async function billBatch(allBills: readonly BillRow[], limit: number) {
  if (allBills.length === 0) return { rows: [] as BillRow[], offset: 0, nextOffset: 0, total: 0 };
  const sql = "SELECT CASE WHEN metadata->>'billRotationNextOffset' ~ '^[0-9]+$' THEN (metadata->>'billRotationNextOffset')::int ELSE 0 END AS next_offset FROM ingestion_runs WHERE source_system='structured-public-data' AND status='complete' ORDER BY finished_at DESC NULLS LAST LIMIT 1";
  const cursor = await pool.query<{ next_offset: number | null }>(sql);
  const requested = cursor.rows[0]?.next_offset ?? 0;
  const offset = ((requested % allBills.length) + allBills.length) % allBills.length;
  const rows = allBills.slice(offset, offset + limit);
  if (rows.length < Math.min(limit, allBills.length)) {
    rows.push(...allBills.slice(0, Math.min(limit, allBills.length) - rows.length));
  }
  return { rows, offset, nextOffset: (offset + rows.length) % allBills.length, total: allBills.length };
}

async function startRun(scope: string): Promise<string> {
  const sql = "INSERT INTO ingestion_runs(source_system,scope,status,metadata) VALUES ('structured-public-data',$1,'running',$2::jsonb) RETURNING id::text";
  const result = await pool.query<{ id: string }>(sql, [scope, JSON.stringify({ version: STRUCTURED_PUBLIC_REFRESH_VERSION })]);
  return result.rows[0].id;
}

async function finishRun(
  runId: string,
  status: 'complete' | 'failed',
  metadata: Record<string, unknown>,
  error?: string,
): Promise<void> {
  const sql = "UPDATE ingestion_runs SET status=$2,finished_at=now(),metadata=metadata || $3::jsonb,error_summary=$4 WHERE id=$1::uuid";
  await pool.query(sql, [runId, status, JSON.stringify(metadata), error ?? null]);
}

async function refreshElection(
  session: CurrentSession,
  members: readonly MemberRow[],
  counts: StreamCounts,
): Promise<void> {
  const electionDate = priorGeneralElectionDate(Number(session.starts_on.slice(0, 4)));
  const url = 'https://electionresultsfiles.sos.mn.gov/' + yyyymmdd(electionDate) + '/LegislativeByDistrict.txt';
  counts.attempted += 1;
  const page = await fetchPublicPage(url, {
    timeoutMs: 20_000,
    maxBytes: 8_000_000,
    userAgent: 'VotePredict/2.0 structured-public-data',
    allowContentTypes: ['text/plain', 'application/octet-stream'],
  });
  const rows = parseSosLegislativeByDistrict(page.rawContent);
  if (rows.length === 0) throw new Error('Minnesota SOS legislative result export parsed zero rows');
  const drafts: DurableEvidenceDraft[] = [];
  for (const member of members) {
    const office: MinnesotaLegislativeOffice = member.chamber_slug === 'house'
      ? 'State Representative'
      : 'State Senator';
    const context = summarizeLegislativeDistrict(rows, office, member.district);
    if (!context) continue;
    drafts.push({
      target: { membershipId: member.membership_id },
      kind: 'context',
      stance: 'neutral',
      claim: 'Official Minnesota election results describe the prior general-election contest for district ' + context.district + '.',
      sourceQuality: 'official',
      relevance: 'medium',
      freshness: 'recent',
      extractionMethod: 'deterministic-mn-sos-legislative-district-summary',
      extractionVersion: MN_SOS_LEGISLATIVE_RESULTS_PARSER_VERSION,
      confidence: 1,
      metadata: {
        contextType: 'structured_public',
        subtype: 'district_election_context',
        electionDate: electionDate.toISOString().slice(0, 10),
        office: context.office,
        district: context.district,
        candidateCount: context.candidateCount,
        totalVotes: context.totalVotes,
        topVotePct: context.topVotePct,
        secondVotePct: context.secondVotePct,
        topTwoMarginPct: context.topTwoMarginPct,
        uncontested: context.uncontested,
        precinctsReporting: context.precinctsReporting,
        totalPrecincts: context.totalPrecincts,
        contextOnly: true,
        mechanicallyActionable: false,
        quickEvidenceStructured: true,
        evidenceSeriesKey: 'district_election_context:membership:' + member.membership_id,
      },
    });
  }
  if (drafts.length === 0 && members.length > 0) {
    throw new Error('Minnesota SOS legislative results did not match any current memberships');
  }
  const persisted = await persistDurableEvidence({
    sourceKind: 'mn_sos_legislative_results',
    sourceUrl: page.canonicalUrl,
    contentSha256: page.contentSha256,
    sessionSlug: session.slug,
    fetchedAt: page.fetchedAt,
    httpStatus: page.httpStatus,
    metadata: {
      pipelineVersion: STRUCTURED_PUBLIC_REFRESH_VERSION,
      electionDate: electionDate.toISOString().slice(0, 10),
      parserVersion: MN_SOS_LEGISLATIVE_RESULTS_PARSER_VERSION,
      rowCount: rows.length,
    },
  }, drafts);
  addPersisted(counts, persisted);
}

async function refreshConference(
  session: CurrentSession,
  roster: readonly AuthorshipRosterMember[],
  billIdByIdentifier: ReadonlyMap<string, string>,
  counts: StreamCounts,
): Promise<void> {
  counts.attempted += 1;
  const page = await fetchPublicPage(CONFERENCE_URL, {
    timeoutMs: 15_000,
    maxBytes: 2_500_000,
    userAgent: 'VotePredict/2.0 structured-public-data',
  });
  const appointments = parseConferenceCommitteeAppointments(page.rawContent);
  const drafts: DurableEvidenceDraft[] = [];
  for (const appointment of appointments) {
    const resolution = resolveRevisorAuthor(appointment.memberName, appointment.chamber, roster);
    if (resolution.status !== 'resolved' || !resolution.membershipId || !resolution.memberName) continue;
    for (const identifier of appointment.billIdentifiers) {
      const billId = billIdByIdentifier.get(identifier);
      if (!billId) continue;
      drafts.push({
        target: { membershipId: resolution.membershipId, billId },
        kind: 'context',
        stance: 'neutral',
        claim: resolution.memberName + ' is listed as a ' + appointment.chamber + ' conferee for ' + identifier + '.',
        sourceQuality: 'official',
        relevance: 'high',
        freshness: 'current',
        extractionMethod: 'deterministic-conference-committee-appointment',
        extractionVersion: MN_FLOOR_CONFERENCE_PARSER_VERSION,
        confidence: 1,
        metadata: {
          contextType: 'structured_public',
          subtype: 'conference_conferee',
          chamber: appointment.chamber,
          rawMemberName: appointment.memberName,
          contextOnly: true,
          mechanicallyActionable: false,
          quickEvidenceStructured: true,
          evidenceSeriesKey: 'conference_conferee:membership:' + resolution.membershipId + ':bill:' + billId,
        },
      });
    }
  }
  addPersisted(counts, await persistDurableEvidence({
    sourceKind: 'legislative_conference_committee',
    sourceUrl: page.canonicalUrl,
    contentSha256: page.contentSha256,
    sessionSlug: session.slug,
    fetchedAt: page.fetchedAt,
    httpStatus: page.httpStatus,
    metadata: {
      pipelineVersion: STRUCTURED_PUBLIC_REFRESH_VERSION,
      parserVersion: MN_FLOOR_CONFERENCE_PARSER_VERSION,
      appointmentRows: appointments.length,
    },
  }, drafts));
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

async function refreshSpeech(
  members: readonly MemberRow[],
  allBills: readonly BillRow[],
  counts: StreamCounts,
): Promise<void> {
  const storyLinks = new Set<string>();
  for (let pageNumber = 1; pageNumber <= SESSION_DAILY_PAGES; pageNumber += 1) {
    counts.attempted += 1;
    const indexUrl = pageNumber === 1 ? SESSION_DAILY_URL : SESSION_DAILY_URL + '/Page/' + pageNumber;
    const index = await fetchPublicPage(indexUrl, {
      timeoutMs: 15_000,
      maxBytes: 2_000_000,
      userAgent: 'VotePredict/2.0 structured-public-data',
    });
    for (const url of index.links) {
      if (/\/SessionDaily\/Story\/\d+/i.test(new URL(url).pathname)) storyLinks.add(url);
      if (storyLinks.size >= SESSION_DAILY_ARTICLES) break;
    }
    if (storyLinks.size >= SESSION_DAILY_ARTICLES) break;
  }

  const billMap = new Map(allBills.map((bill) => [bill.identifier.toUpperCase(), bill]));
  const speechMembers = members.map((member) => ({
    membershipId: member.membership_id,
    name: member.name,
    chamber: member.chamber_slug,
  }));
  for (const url of [...storyLinks].slice(0, SESSION_DAILY_ARTICLES)) {
    counts.attempted += 1;
    try {
      const page = await fetchPublicPage(url, {
        timeoutMs: 15_000,
        maxBytes: 1_750_000,
        userAgent: 'VotePredict/2.0 structured-public-data',
      });
      const scopedBills = billsMentionedInText(page.text, billMap);
      const mentions = scopedBills.length === 0 ? [] : extractLegislativeSpeechMentions({
        text: page.text,
        bills: scopedBills.map((bill) => ({ id: bill.bill_id, identifier: bill.identifier })),
        members: speechMembers,
      });
      const drafts: DurableEvidenceDraft[] = mentions.map((mention) => ({
        target: { membershipId: mention.membershipId, billId: mention.billId },
        kind: 'context',
        stance: 'neutral',
        claim: mention.memberName + ' was attributed remarks in official Session Daily coverage discussing ' + mention.billIdentifier + '.',
        excerpt: mention.excerpt,
        publishedAt: page.publishedAt,
        sourceQuality: 'official',
        relevance: 'high',
        freshness: 'current',
        extractionMethod: 'deterministic-official-legislative-speech-attribution',
        extractionVersion: LEGISLATIVE_SPEECH_EXTRACTOR_VERSION,
        confidence: 0.95,
        metadata: {
          contextType: 'structured_public',
          subtype: 'legislative_speech',
          extractedDirectionalLanguage: mention.stance,
          transcriptKind: 'official_session_daily_reporting',
          contextOnly: true,
          mechanicallyActionable: false,
          quickEvidenceStructured: true,
        },
      }));
      addPersisted(counts, await persistDurableEvidence({
        sourceKind: 'house_session_daily',
        sourceUrl: page.canonicalUrl,
        contentSha256: page.contentSha256,
        fetchedAt: page.fetchedAt,
        httpStatus: page.httpStatus,
        metadata: {
          pipelineVersion: STRUCTURED_PUBLIC_REFRESH_VERSION,
          title: page.title,
          publishedAt: page.publishedAt,
          extractorVersion: LEGISLATIVE_SPEECH_EXTRACTOR_VERSION,
          directionalLanguageStoredAsContextOnly: true,
          senateCaptionCompatibility: true,
        },
      }, drafts));
    } catch {
      counts.failures += 1;
    }
  }
}

async function refreshSummaryIndex(
  session: CurrentSession,
  bills: readonly BillRow[],
  counts: StreamCounts,
): Promise<void> {
  const startYear = Number(session.starts_on.slice(0, 4));
  const legislature = Math.round((startYear - 1837) / 2);
  const url = 'https://www.house.mn.gov/hrd/billsum.aspx?ls=' + legislature;
  counts.attempted += 1;
  const page = await fetchPublicPage(url, {
    timeoutMs: 15_000,
    maxBytes: 3_000_000,
    userAgent: 'VotePredict/2.0 structured-public-data',
  });
  const summaries = parseHouseResearchSummaryIndex(page.rawContent);
  const byBill = new Map(summaries.map((row) => [row.billIdentifier, row]));
  const drafts: DurableEvidenceDraft[] = [];
  for (const bill of bills) {
    const summary = byBill.get(bill.identifier.toUpperCase());
    if (!summary) continue;
    drafts.push({
      target: { billId: bill.bill_id },
      kind: 'context',
      stance: 'neutral',
      claim: 'Nonpartisan House Research lists a bill summary for ' + bill.identifier + ' at version ' + summary.latestVersion + '.',
      sourceQuality: 'official',
      relevance: 'high',
      freshness: 'current',
      extractionMethod: 'deterministic-house-research-summary-index',
      extractionVersion: MN_BILL_CONTEXT_PARSER_VERSION,
      confidence: 1,
      metadata: {
        contextType: 'structured_public',
        subtype: 'bill_summary',
        latestVersion: summary.latestVersion,
        subject: summary.subject,
        hasPriorSummaries: summary.hasPriorSummaries,
        contextOnly: true,
        mechanicallyActionable: false,
        quickEvidenceStructured: true,
        evidenceSeriesKey: 'bill_summary:bill:' + bill.bill_id,
      },
    });
  }
  addPersisted(counts, await persistDurableEvidence({
    sourceKind: 'house_research_bill_summary_index',
    sourceUrl: page.canonicalUrl,
    contentSha256: page.contentSha256,
    sessionSlug: session.slug,
    fetchedAt: page.fetchedAt,
    httpStatus: page.httpStatus,
    metadata: {
      pipelineVersion: STRUCTURED_PUBLIC_REFRESH_VERSION,
      parserVersion: MN_BILL_CONTEXT_PARSER_VERSION,
      legislature,
      summaryRows: summaries.length,
    },
  }, drafts));
}

async function refreshFloorAndSummary(
  bill: BillRow,
  roster: readonly AuthorshipRosterMember[],
  floor: StreamCounts,
): Promise<void> {
  if (!bill.identifier.startsWith('HF')) return;
  const infoUrl = 'https://www.house.mn.gov/bills/Info/' + bill.identifier;
  floor.attempted += 1;
  const info = await fetchPublicPage(infoUrl, {
    timeoutMs: 15_000,
    maxBytes: 2_000_000,
    userAgent: 'VotePredict/2.0 structured-public-data',
  });

  const voteLinks = extractHouseRecordedVoteLinks(info.rawContent, info.canonicalUrl).slice(0, 2);
  for (const voteUrl of voteLinks) {
    floor.attempted += 1;
    const page = await fetchPublicPage(voteUrl, {
      timeoutMs: 15_000,
      maxBytes: 2_000_000,
      userAgent: 'VotePredict/2.0 structured-public-data',
    });
    const rolls = parseHouseRecordedFloorVotes(page.rawContent, bill.identifier)
      .filter((roll) => Boolean(roll.amendmentRef) || /amendment/i.test(roll.description));
    const drafts: DurableEvidenceDraft[] = [];
    for (const roll of rolls) {
      if (!roll.proposerName) continue;
      const resolution = resolveRevisorAuthor(roll.proposerName, 'house', roster);
      if (resolution.status !== 'resolved' || !resolution.membershipId || !resolution.memberName) continue;
      drafts.push({
        target: { membershipId: resolution.membershipId, billId: bill.bill_id },
        kind: 'context',
        stance: 'neutral',
        claim: resolution.memberName + ' is identified as the proposer on recorded House floor amendment '
          + (roll.amendmentRef ?? '') + ' to ' + bill.identifier + '.',
        publishedAt: roll.occurredOn + 'T12:00:00.000Z',
        sourceQuality: 'official',
        relevance: 'high',
        freshness: 'current',
        extractionMethod: 'deterministic-house-recorded-floor-vote',
        extractionVersion: MN_FLOOR_CONFERENCE_PARSER_VERSION,
        confidence: 1,
        metadata: {
          contextType: 'structured_public',
          subtype: 'floor_amendment_offer',
          amendmentRef: roll.amendmentRef,
          yeas: roll.yeas,
          nays: roll.nays,
          journalPage: roll.journalPage,
          rollCallWon: roll.rollCallWon,
          outcomeMeaning: 'amendment roll-call disposition only; not a final-passage stance',
          contextOnly: true,
          mechanicallyActionable: false,
          quickEvidenceStructured: true,
        },
      });
    }
    addPersisted(floor, await persistDurableEvidence({
      sourceKind: 'house_floor_vote_page',
      sourceUrl: page.canonicalUrl,
      contentSha256: page.contentSha256,
      sessionSlug: bill.session_slug,
      chamberSlug: 'house',
      fetchedAt: page.fetchedAt,
      httpStatus: page.httpStatus,
      metadata: {
        pipelineVersion: STRUCTURED_PUBLIC_REFRESH_VERSION,
        parserVersion: MN_FLOOR_CONFERENCE_PARSER_VERSION,
        billIdentifier: bill.identifier,
        recordedRollCalls: rolls.length,
      },
    }, drafts));
  }

}

async function refreshFiscalNotes(bill: BillRow, counts: StreamCounts): Promise<void> {
  const url = 'https://mn.gov/mmbapps/fnsearchlbo/?number='
    + encodeURIComponent(bill.identifier)
    + '&year=' + bill.session_start_year;
  counts.attempted += 1;
  const page = await fetchPublicPage(url, {
    timeoutMs: 15_000,
    maxBytes: 2_000_000,
    userAgent: 'VotePredict/2.0 structured-public-data',
  });
  const fiscalHost = new URL(page.canonicalUrl).hostname.toLowerCase();
  if (!(fiscalHost === 'mn.gov' || fiscalHost.endsWith('.mn.gov'))) {
    throw new Error('Fiscal-note source redirected away from mn.gov to ' + fiscalHost);
  }
  const summary = summarizeFiscalNoteSearch(page.text, bill.identifier);
  const drafts: DurableEvidenceDraft[] = summary.noteCount > 0 ? [{
    target: { billId: bill.bill_id },
    kind: 'context',
    stance: 'neutral',
    claim: 'Official fiscal-note search reports fiscal-note material for ' + bill.identifier + '.',
    sourceQuality: 'official',
    relevance: 'high',
    freshness: 'current',
    extractionMethod: 'deterministic-legislative-budget-office-fiscal-note-summary',
    extractionVersion: MN_BILL_CONTEXT_PARSER_VERSION,
    confidence: 1,
    metadata: {
      contextType: 'structured_public',
      subtype: 'fiscal_note_context',
      noteCount: summary.noteCount,
      completedDates: summary.completedDates,
      contextOnly: true,
      mechanicallyActionable: false,
      quickEvidenceStructured: true,
      evidenceSeriesKey: 'fiscal_note_context:bill:' + bill.bill_id,
    },
  }] : [];
  addPersisted(counts, await persistDurableEvidence({
    sourceKind: 'mn_lbo_fiscal_notes',
    sourceUrl: page.canonicalUrl,
    contentSha256: page.contentSha256,
    sessionSlug: bill.session_slug,
    fetchedAt: page.fetchedAt,
    httpStatus: page.httpStatus,
    metadata: {
      pipelineVersion: STRUCTURED_PUBLIC_REFRESH_VERSION,
      parserVersion: MN_BILL_CONTEXT_PARSER_VERSION,
      billIdentifier: bill.identifier,
      noteCount: summary.noteCount,
      completedDates: summary.completedDates,
    },
  }, drafts));
}

async function backfillHistoricalElectionContexts(): Promise<Array<{
  session: string;
  skipped: boolean;
  counts: StreamCounts;
  warning?: string;
}>> {
  const sessions = await loadHistoricalBackfillSessions();
  const results: Array<{ session: string; skipped: boolean; counts: StreamCounts; warning?: string }> = [];
  for (const session of sessions) {
    const counts = emptyCounts();
    if (await historicalElectionBackfillComplete(session.id)) {
      results.push({ session: session.slug, skipped: true, counts });
      continue;
    }
    try {
      const members = await loadSessionMembers(session.id);
      await refreshElection(session, members, counts);
      results.push({ session: session.slug, skipped: false, counts });
    } catch (error) {
      counts.failures += 1;
      results.push({
        session: session.slug,
        skipped: false,
        counts,
        warning: safeMessage(error),
      });
    }
  }
  return results;
}

export async function runStructuredPublicRefresh(options: StructuredPublicRefreshOptions = {}) {
  const now = options.now ?? new Date();
  const billBatchSize = Math.min(MAX_BILL_BATCH, Math.max(1, Math.trunc(options.billBatchSize ?? DEFAULT_BILL_BATCH)));
  const session = await loadCurrentSession();
  const [members, roster, allBills, activityBills] = await Promise.all([
    loadCurrentMembers(session.id),
    loadRoster(session.id),
    loadAllBills(session),
    loadActivityBills(session),
  ]);
  const selection = await billBatch(activityBills, billBatchSize);
  const runId = await startRun('session:' + session.slug + ':bill-batch:' + billBatchSize);
  const election = emptyCounts();
  const conference = emptyCounts();
  const speech = emptyCounts();
  const floor = emptyCounts();
  const billContext = emptyCounts();
  const warnings: string[] = [];

  try {
    try {
      await refreshElection(session, members, election);
    } catch (error) {
      election.failures += 1;
      warnings.push('election context: ' + safeMessage(error));
    }
    const historicalElection = await backfillHistoricalElectionContexts();
    for (const row of historicalElection) {
      if (row.warning) warnings.push('historical election context ' + row.session + ': ' + row.warning);
    }
    try {
      await refreshConference(
        session,
        roster,
        new Map(allBills.map((bill) => [bill.identifier.toUpperCase(), bill.bill_id])),
        conference,
      );
    } catch (error) {
      conference.failures += 1;
      warnings.push('conference appointments: ' + safeMessage(error));
    }
    try {
      await refreshSpeech(members, allBills, speech);
    } catch (error) {
      speech.failures += 1;
      warnings.push('legislative speech: ' + safeMessage(error));
    }
    try {
      await refreshSummaryIndex(session, selection.rows, billContext);
    } catch (error) {
      billContext.failures += 1;
      warnings.push('House Research summaries: ' + safeMessage(error));
    }

    for (const bill of selection.rows) {
      try {
        await refreshFloorAndSummary(bill, roster, floor);
      } catch (error) {
        floor.failures += 1;
        warnings.push('floor/summary ' + bill.identifier + ': ' + safeMessage(error));
      }
      try {
        await refreshFiscalNotes(bill, billContext);
      } catch (error) {
        billContext.failures += 1;
        warnings.push('fiscal notes ' + bill.identifier + ': ' + safeMessage(error));
      }
    }

    const result = {
      version: STRUCTURED_PUBLIC_REFRESH_VERSION,
      generatedAt: now.toISOString(),
      session: session.slug,
      billRotationOffset: selection.offset,
      billRotationNextOffset: selection.nextOffset,
      totalBills: allBills.length,
      activityBills: selection.total,
      billBatch: selection.rows.map((bill) => bill.identifier),
      election,
      historicalElection,
      conference,
      speech,
      floor,
      billContext,
      warnings,
      servingProbabilityChange: 'none',
      allNewFeatureWeights: 0,
    };
    await finishRun(runId, 'complete', result);
    return result;
  } catch (error) {
    await finishRun(runId, 'failed', {
      billRotationNextOffset: selection.offset,
      election,
      conference,
      speech,
      floor,
      billContext,
      warnings,
    }, safeMessage(error)).catch(() => undefined);
    throw error;
  }
}
