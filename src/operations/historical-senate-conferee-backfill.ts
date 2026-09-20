import { pool } from '@/lib/db';
import { fetchPublicPage } from '@/evidence/public-http';
import { persistDurableEvidence, type DurableEvidenceDraft } from '@/evidence/durable-ingestion';
import {
  MN_SENATE_CONFERENCE_PARSER_VERSION,
  parseConferenceCommitteeAppointments,
  parseSenateJournalConferenceAppointments,
} from '@/evidence/minnesota-floor-conference';
import {
  fetchSenateJournal,
  listSenateJournalLinks,
  type SenateJournalLink,
} from '@/sources/minnesota/senate-journals';
import {
  resolveRevisorAuthor,
  type AuthorshipRosterMember,
} from '@/sources/minnesota/revisor-author-resolution';
import { verifyHistoricalHouseConferees } from '@/operations/historical-house-conferee-backfill';

export const HISTORICAL_SENATE_CONFEREE_BACKFILL_VERSION = 'historical-senate-conferee-v1' as const;

const SESSION_CONFERENCE_YEARS = {
  '2021-2022': ['2021-92', '2022-92'],
  '2023-2024': ['2023-93', '2024-93'],
} as const;

type SupportedSession = keyof typeof SESSION_CONFERENCE_YEARS;
type BillRow = { id: string; identifier: string };

interface HistoricalConferenceCrossCheck {
  sourceUrls: string[];
  pairByBillIdentifier: Map<string, string>;
  assignmentKeys: Set<string>;
  unresolvedMembers: number;
}

export interface HistoricalSenateConfereeBackfillResult {
  version: typeof HISTORICAL_SENATE_CONFEREE_BACKFILL_VERSION;
  parserVersion: typeof MN_SENATE_CONFERENCE_PARSER_VERSION;
  session: SupportedSession;
  totalJournalPages: number;
  batchStart: number;
  batchEnd: number;
  processedPages: number;
  appointmentRows: number;
  inserted: number;
  reused: number;
  unresolvedMembers: number;
  ambiguousMembers: number;
  unresolvedBills: number;
  unresolvedTargets: number;
  dateMismatches: number;
  fetchFailures: number;
  crossCheckExpectedAssignments: number;
  crossCheckMatched: number;
  crossCheckMisses: number;
  crossCheckUnresolvedMembers: number;
  unresolvedExamples: Array<Record<string, unknown>>;
  nextOffset: number | null;
  complete: boolean;
  allNewFeatureWeights: 0;
  servingProbabilityChange: 'none';
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .slice(0, 500);
}

async function loadRoster(session: SupportedSession): Promise<AuthorshipRosterMember[]> {
  const result = await pool.query<{
    membership_id: string;
    legislator_id: string;
    name: string;
    chamber: 'house' | 'senate';
    aliases: string[];
  }>(`
    SELECT m.id::text AS membership_id,
           l.id::text AS legislator_id,
           l.name,
           c.slug AS chamber,
           COALESCE(
             array_agg(DISTINCT msa.source_name) FILTER (WHERE msa.source_name IS NOT NULL),
             ARRAY[]::text[]
           ) AS aliases
      FROM memberships m
      JOIN legislators l ON l.id=m.legislator_id
      JOIN chambers c ON c.id=m.chamber_id
      JOIN legislative_sessions s ON s.id=m.session_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id
      LEFT JOIN membership_source_aliases msa ON msa.membership_id=m.id
     WHERE j.slug='us-mn' AND s.slug=$1
     GROUP BY m.id,l.id,l.name,c.slug,l.normalized_name
     ORDER BY c.slug,l.normalized_name,m.id
  `, [session]);
  return result.rows.map((row) => ({
    membershipId: row.membership_id,
    legislatorId: row.legislator_id,
    name: row.name,
    chamber: row.chamber,
    aliases: row.aliases,
  }));
}

async function loadBills(session: SupportedSession): Promise<Map<string, BillRow>> {
  const result = await pool.query<BillRow>(`
    SELECT b.id::text AS id,b.identifier
      FROM bills b
      JOIN legislative_sessions s ON s.id=b.session_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id
     WHERE j.slug='us-mn'
       AND s.slug=$1
       AND b.identifier ~ '^(HF|SF)[0-9]+$'
  `, [session]);
  return new Map(result.rows.map((row) => [row.identifier.toUpperCase().replace(/\s+/g, ''), row]));
}

function conferencePairKey(identifiers: readonly string[]): string {
  return [...new Set(identifiers.map((value) => value.toUpperCase().replace(/\s+/g, '')))]
    .sort()
    .join('/');
}

async function loadHistoricalConferenceCrossCheck(
  session: SupportedSession,
  roster: readonly AuthorshipRosterMember[],
): Promise<HistoricalConferenceCrossCheck> {
  const sourceUrls = SESSION_CONFERENCE_YEARS[session]
    .map((year) => 'https://www.leg.mn.gov/leg/cc/?year=' + year);
  const pages = [];
  for (const sourceUrl of sourceUrls) {
    pages.push(await fetchPublicPage(sourceUrl, {
      timeoutMs: 20_000,
      maxBytes: 3_000_000,
      userAgent: 'VotePredict/2.0 historical-senate-conferee-cross-check',
    }));
  }

  const pairByBillIdentifier = new Map<string, string>();
  const assignmentKeys = new Set<string>();
  let unresolvedMembers = 0;
  let parsedSenateRows = 0;

  for (const page of pages) {
    const appointments = parseConferenceCommitteeAppointments(page.rawContent)
      .filter((row) => row.chamber === 'senate');
    parsedSenateRows += appointments.length;
    for (const appointment of appointments) {
      const pairKey = conferencePairKey(appointment.billIdentifiers);
      if (!pairKey) continue;
      for (const identifier of appointment.billIdentifiers) {
        pairByBillIdentifier.set(identifier.toUpperCase().replace(/\s+/g, ''), pairKey);
      }
      const resolution = resolveRevisorAuthor(appointment.memberName, 'senate', roster);
      if (resolution.status !== 'resolved' || !resolution.membershipId) {
        unresolvedMembers += 1;
        continue;
      }
      assignmentKeys.add(pairKey + '|' + resolution.membershipId);
    }
  }

  if (parsedSenateRows === 0 || assignmentKeys.size === 0) {
    throw new Error('Historical conference-committee cross-check parsed no Senate assignments for ' + session);
  }

  return {
    sourceUrls,
    pairByBillIdentifier,
    assignmentKeys,
    unresolvedMembers,
  };
}

const MONTHS: Readonly<Record<string, string>> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

function parseSenateJournalDay(text: string): string | undefined {
  const header = text.slice(0, 8000).replace(/\u200B/g, ' ').replace(/\s+/g, ' ');
  const match = header.match(/St\.\s*Paul,\s*Minnesota,\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})/i);
  if (!match) return undefined;
  const month = MONTHS[match[1].toLowerCase()];
  return month ? match[3] + '-' + month + '-' + match[2].padStart(2, '0') : undefined;
}

async function fetchJournalWithRetry(link: SenateJournalLink) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetchSenateJournal(link.sourceUrl);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Senate Journal fetch failed');
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

export async function backfillHistoricalSenateConferees(input: {
  session: SupportedSession;
  offset?: number;
  limit?: number;
}): Promise<HistoricalSenateConfereeBackfillResult> {
  const { session } = input;
  if (!SESSION_CONFERENCE_YEARS[session]) {
    throw new Error('Unsupported historical Senate conferee session: ' + session);
  }
  const offset = Math.max(0, Math.trunc(input.offset ?? 0));
  const limit = Math.min(10, Math.max(1, Math.trunc(input.limit ?? 8)));

  const [roster, bills, journalLinks] = await Promise.all([
    loadRoster(session),
    loadBills(session),
    listSenateJournalLinks(session),
  ]);
  const crossCheck = await loadHistoricalConferenceCrossCheck(session, roster);
  const batch = journalLinks.slice(offset, offset + limit);
  const totals: HistoricalSenateConfereeBackfillResult = {
    version: HISTORICAL_SENATE_CONFEREE_BACKFILL_VERSION,
    parserVersion: MN_SENATE_CONFERENCE_PARSER_VERSION,
    session,
    totalJournalPages: journalLinks.length,
    batchStart: offset,
    batchEnd: offset + batch.length,
    processedPages: batch.length,
    appointmentRows: 0,
    inserted: 0,
    reused: 0,
    unresolvedMembers: 0,
    ambiguousMembers: 0,
    unresolvedBills: 0,
    unresolvedTargets: 0,
    dateMismatches: 0,
    fetchFailures: 0,
    crossCheckExpectedAssignments: crossCheck.assignmentKeys.size,
    crossCheckMatched: 0,
    crossCheckMisses: 0,
    crossCheckUnresolvedMembers: crossCheck.unresolvedMembers,
    unresolvedExamples: [],
    nextOffset: offset + batch.length < journalLinks.length ? offset + batch.length : null,
    complete: offset + batch.length >= journalLinks.length,
    allNewFeatureWeights: 0,
    servingProbabilityChange: 'none',
  };

  const results = await mapConcurrent(batch, 1, async (link) => {
    try {
      const journal = await fetchJournalWithRetry(link);
      const journalDate = parseSenateJournalDay(journal.text);
      if (!link.date || journalDate !== link.date) {
        return {
          kind: 'date_mismatch' as const,
          expected: link.date,
          observed: journalDate,
          url: link.sourceUrl,
        };
      }

      const appointments = parseSenateJournalConferenceAppointments(journal.text);
      if (appointments.length === 0) return { kind: 'empty' as const };
      const drafts: DurableEvidenceDraft[] = [];
      const unresolved: Array<Record<string, unknown>> = [];
      let unresolvedMembers = 0;
      let ambiguousMembers = 0;
      let unresolvedBills = 0;
      let crossCheckMatched = 0;
      let crossCheckMisses = 0;

      for (const appointment of appointments) {
        const bill = bills.get(appointment.billIdentifier);
        if (!bill) {
          unresolvedBills += 1;
          unresolved.push({
            session,
            journalDate: link.date,
            bill: appointment.billIdentifier,
            member: appointment.memberName,
            reason: 'bill_not_found',
          });
          continue;
        }

        const resolution = resolveRevisorAuthor(appointment.memberName, 'senate', roster);
        if (resolution.status !== 'resolved' || !resolution.membershipId || !resolution.memberName) {
          if (resolution.status === 'ambiguous') ambiguousMembers += 1;
          else unresolvedMembers += 1;
          unresolved.push({
            session,
            journalDate: link.date,
            bill: appointment.billIdentifier,
            member: appointment.memberName,
            reason: resolution.status,
            candidates: resolution.candidates ?? [],
          });
          continue;
        }

        const pairKey = crossCheck.pairByBillIdentifier.get(appointment.billIdentifier);
        const crossCheckMatch = Boolean(
          pairKey && crossCheck.assignmentKeys.has(pairKey + '|' + resolution.membershipId),
        );
        if (crossCheckMatch) crossCheckMatched += 1;
        else {
          crossCheckMisses += 1;
          unresolved.push({
            session,
            journalDate: link.date,
            bill: appointment.billIdentifier,
            member: appointment.memberName,
            reason: 'conference_activity_cross_check_miss',
          });
        }

        drafts.push({
          target: { membershipId: resolution.membershipId, billId: bill.id },
          kind: 'context',
          stance: 'neutral',
          claim: resolution.memberName + ' was appointed as a Senate conferee for ' + appointment.billIdentifier + '.',
          excerpt: 'Senate Journal conference committee appointment for ' + appointment.billIdentifier + ': ' + appointment.memberName,
          publishedAt: link.date + 'T12:00:00.000Z',
          sourceQuality: 'official',
          relevance: 'high',
          freshness: 'stale',
          extractionMethod: 'deterministic-senate-journal-conference-appointment',
          extractionVersion: MN_SENATE_CONFERENCE_PARSER_VERSION,
          confidence: crossCheckMatch ? 1 : 0.98,
          metadata: {
            contextType: 'structured_public',
            subtype: 'conference_conferee',
            chamber: 'senate',
            rawMemberName: appointment.memberName,
            historicalBackfill: true,
            journalDate: link.date,
            legislativeDay: link.legislativeDay,
            asOfEligible: true,
            dateGranularity: 'day',
            sourceRecordFinalAuthority: 'senate_journal',
            crossCheckSource: 'minnesota_legislature_conference_committee_activity',
            crossCheckMatched: crossCheckMatch,
            crossCheckPair: pairKey ?? null,
            contextOnly: true,
            mechanicallyActionable: false,
            quickEvidenceStructured: true,
            modelWeight: 0,
            evidenceSeriesKey:
              'conference_conferee:' + session + ':' + appointment.billIdentifier + ':' + resolution.membershipId,
          },
        });
      }

      if (drafts.length === 0) {
        return {
          kind: 'resolved' as const,
          appointments: appointments.length,
          inserted: 0,
          reused: 0,
          unresolvedTargets: 0,
          unresolvedMembers,
          ambiguousMembers,
          unresolvedBills,
          crossCheckMatched,
          crossCheckMisses,
          unresolved,
        };
      }

      const persisted = await persistDurableEvidence({
        sourceKind: 'senate_journal_conference_appointment',
        sourceUrl: link.sourceUrl,
        contentSha256: journal.pdfSha256,
        sessionSlug: session,
        chamberSlug: 'senate',
        fetchedAt: new Date().toISOString(),
        httpStatus: 200,
        metadata: {
          historicalBackfill: true,
          journalDate: link.date,
          legislativeDay: link.legislativeDay,
          parserVersion: MN_SENATE_CONFERENCE_PARSER_VERSION,
          sourcePolicy: 'senate-journal-index-with-legislature-cross-check-v1',
          byteLength: journal.byteLength,
          crossCheckSources: crossCheck.sourceUrls,
        },
      }, drafts);

      return {
        kind: 'resolved' as const,
        appointments: appointments.length,
        inserted: persisted.inserted,
        reused: persisted.reused,
        unresolvedTargets: persisted.unresolvedTargets.length,
        unresolvedMembers,
        ambiguousMembers,
        unresolvedBills,
        crossCheckMatched,
        crossCheckMisses,
        unresolved,
      };
    } catch (error) {
      return { kind: 'fetch_failure' as const, url: link.sourceUrl, error: safeMessage(error) };
    }
  });

  for (const row of results) {
    if (row.kind === 'date_mismatch') {
      totals.dateMismatches += 1;
      totals.unresolvedExamples.push(row);
    } else if (row.kind === 'fetch_failure') {
      totals.fetchFailures += 1;
      totals.unresolvedExamples.push(row);
    } else if (row.kind === 'resolved') {
      totals.appointmentRows += row.appointments;
      totals.inserted += row.inserted;
      totals.reused += row.reused;
      totals.unresolvedTargets += row.unresolvedTargets;
      totals.unresolvedMembers += row.unresolvedMembers;
      totals.ambiguousMembers += row.ambiguousMembers;
      totals.unresolvedBills += row.unresolvedBills;
      totals.crossCheckMatched += row.crossCheckMatched;
      totals.crossCheckMisses += row.crossCheckMisses;
      totals.unresolvedExamples.push(...row.unresolved);
    }
  }

  totals.unresolvedExamples = totals.unresolvedExamples.slice(0, 100);
  if (totals.dateMismatches > 0 || totals.fetchFailures > 0) {
    throw new Error(
      'Historical Senate conferee source integrity failure: dateMismatches='
      + totals.dateMismatches
      + ', fetchFailures='
      + totals.fetchFailures
      + ', samples='
      + totals.unresolvedExamples.slice(0, 6).map((row) => JSON.stringify(row)).join(' | '),
    );
  }
  return totals;
}

export async function verifyHistoricalSenateConferees(
  options: { includeReplayCoverage?: boolean } = {},
) {
  const result = await pool.query<{
    session_slug: SupportedSession;
    evidence_rows: string;
    assignment_series: string;
    cross_check_matched: string;
    members: string;
    bills: string;
    source_pages: string;
  }>(`
    SELECT s.slug AS session_slug,
           count(ei.id)::text AS evidence_rows,
           count(DISTINCT ei.metadata->>'evidenceSeriesKey')::text AS assignment_series,
           count(DISTINCT ei.metadata->>'evidenceSeriesKey')
             FILTER (WHERE ei.metadata->>'crossCheckMatched'='true')::text AS cross_check_matched,
           count(DISTINCT ei.membership_id)::text AS members,
           count(DISTINCT ei.bill_id)::text AS bills,
           count(DISTINCT ei.source_document_id)::text AS source_pages
      FROM evidence_items ei
      JOIN memberships m ON m.id=ei.membership_id
      JOIN legislative_sessions s ON s.id=m.session_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id
     WHERE j.slug='us-mn'
       AND ei.metadata->>'subtype'='conference_conferee'
       AND ei.metadata->>'historicalBackfill'='true'
       AND ei.metadata->>'chamber'='senate'
       AND ei.extraction_version=$1
       AND s.slug IN ('2021-2022','2023-2024')
     GROUP BY s.slug,s.starts_on
     ORDER BY s.starts_on
  `, [MN_SENATE_CONFERENCE_PARSER_VERSION]);

  const rows = [];
  for (const session of ['2021-2022', '2023-2024'] as const) {
    const roster = await loadRoster(session);
    const crossCheck = await loadHistoricalConferenceCrossCheck(session, roster);
    const row = result.rows.find((candidate) => candidate.session_slug === session);
    rows.push({
      session,
      evidenceRows: Number(row?.evidence_rows ?? 0),
      assignmentSeries: Number(row?.assignment_series ?? 0),
      crossCheckMatchedAssignments: Number(row?.cross_check_matched ?? 0),
      crossCheckExpectedAssignments: crossCheck.assignmentKeys.size,
      crossCheckUnresolvedMembers: crossCheck.unresolvedMembers,
      members: Number(row?.members ?? 0),
      bills: Number(row?.bills ?? 0),
      sourcePages: Number(row?.source_pages ?? 0),
      crossCheckComplete:
        crossCheck.assignmentKeys.size > 0
        && Number(row?.cross_check_matched ?? 0) >= crossCheck.assignmentKeys.size,
    });
  }

  const combined = options.includeReplayCoverage
    ? await verifyHistoricalHouseConferees({ includeReplayCoverage: true })
    : undefined;
  return {
    version: HISTORICAL_SENATE_CONFEREE_BACKFILL_VERSION,
    parserVersion: MN_SENATE_CONFERENCE_PARSER_VERSION,
    coverage: rows,
    combinedReplayCoverage: combined?.replayCoverage,
    allNewFeatureWeights: 0 as const,
    servingProbabilityChange: 'none' as const,
  };
}
