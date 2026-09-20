import { pool } from '@/lib/db';
import { fetchPublicPage } from '@/evidence/public-http';
import { persistDurableEvidence, type DurableEvidenceDraft } from '@/evidence/durable-ingestion';
import {
  parseHistoricalDeepHouseJournalDate,
  parseHistoricalDeepHouseJournalIndex,
} from '@/evaluation/historical-deep-house-journal-source-bundle';
import {
  MN_FLOOR_CONFERENCE_PARSER_VERSION,
  parseHouseJournalConferenceAppointments,
} from '@/evidence/minnesota-floor-conference';
import {
  resolveRevisorAuthor,
  type AuthorshipRosterMember,
} from '@/sources/minnesota/revisor-author-resolution';

export const HISTORICAL_HOUSE_CONFEREE_BACKFILL_VERSION = 'historical-house-conferee-v2' as const;

const SESSION_ARCHIVES = {
  '2021-2022': 257,
  '2023-2024': 300,
} as const;

type SupportedSession = keyof typeof SESSION_ARCHIVES;
type BillRow = { id: string; identifier: string };

export interface HistoricalHouseConfereeBackfillResult {
  version: typeof HISTORICAL_HOUSE_CONFEREE_BACKFILL_VERSION;
  session: SupportedSession;
  archivePages: number;
  appointmentRows: number;
  inserted: number;
  reused: number;
  unresolvedMembers: number;
  ambiguousMembers: number;
  unresolvedBills: number;
  unresolvedTargets: number;
  dateMismatches: number;
  fetchFailures: number;
  unresolvedExamples: Array<Record<string, unknown>>;
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

async function fetchJournal(url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetchPublicPage(url, {
        timeoutMs: 45_000,
        maxBytes: 16_000_000,
        userAgent: 'VotePredict/2.0 historical-house-conferee-backfill',
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('House Journal fetch failed');
}

export async function backfillHistoricalHouseConferees(
  session: SupportedSession,
): Promise<HistoricalHouseConfereeBackfillResult> {
  const archiveId = SESSION_ARCHIVES[session];
  if (!archiveId) throw new Error('Unsupported historical House conferee session: ' + session);

  const [roster, bills] = await Promise.all([loadRoster(session), loadBills(session)]);
  const archiveUrl = 'https://www.house.mn.gov/Journals/' + archiveId;
  const archive = await fetchJournal(archiveUrl);
  const parsedIndex = parseHistoricalDeepHouseJournalIndex(archive.rawContent, session);
  if (!parsedIndex.sessionMatched || parsedIndex.links.length < 40) {
    throw new Error('House Journal archive enumeration incomplete for ' + session);
  }

  const totals: HistoricalHouseConfereeBackfillResult = {
    version: HISTORICAL_HOUSE_CONFEREE_BACKFILL_VERSION,
    session,
    archivePages: parsedIndex.links.length,
    appointmentRows: 0,
    inserted: 0,
    reused: 0,
    unresolvedMembers: 0,
    ambiguousMembers: 0,
    unresolvedBills: 0,
    unresolvedTargets: 0,
    dateMismatches: 0,
    fetchFailures: 0,
    unresolvedExamples: [],
    allNewFeatureWeights: 0,
    servingProbabilityChange: 'none',
  };

  const results = await mapConcurrent(parsedIndex.links, 2, async (link) => {
    try {
      const page = await fetchJournal(link.url);
      const pageDate = parseHistoricalDeepHouseJournalDate(page.rawContent);
      if (pageDate !== link.journalDate) {
        return {
          kind: 'date_mismatch' as const,
          expected: link.journalDate,
          observed: pageDate,
          url: link.url,
        };
      }

      const appointments = parseHouseJournalConferenceAppointments(page.text);
      if (appointments.length === 0) return { kind: 'empty' as const };

      const drafts: DurableEvidenceDraft[] = [];
      const unresolved: Array<Record<string, unknown>> = [];
      let unresolvedMembers = 0;
      let ambiguousMembers = 0;
      let unresolvedBills = 0;

      for (const appointment of appointments) {
        const bill = bills.get(appointment.billIdentifier);
        if (!bill) {
          unresolvedBills += 1;
          unresolved.push({
            session,
            journalDate: link.journalDate,
            bill: appointment.billIdentifier,
            member: appointment.memberName,
            reason: 'bill_not_found',
          });
          continue;
        }

        const resolution = resolveRevisorAuthor(appointment.memberName, 'house', roster);
        if (resolution.status !== 'resolved' || !resolution.membershipId || !resolution.memberName) {
          if (resolution.status === 'ambiguous') ambiguousMembers += 1;
          else unresolvedMembers += 1;
          unresolved.push({
            session,
            journalDate: link.journalDate,
            bill: appointment.billIdentifier,
            member: appointment.memberName,
            reason: resolution.status,
            candidates: resolution.candidates ?? [],
          });
          continue;
        }

        drafts.push({
          target: { membershipId: resolution.membershipId, billId: bill.id },
          kind: 'context',
          stance: 'neutral',
          claim: resolution.memberName + ' was appointed by the Speaker as a House conferee for ' + appointment.billIdentifier + '.',
          excerpt: 'House Journal conference committee appointment for ' + appointment.billIdentifier + ': ' + appointment.memberName,
          publishedAt: link.journalDate + 'T12:00:00.000Z',
          sourceQuality: 'official',
          relevance: 'high',
          freshness: 'stale',
          extractionMethod: 'deterministic-house-journal-conference-appointment',
          extractionVersion: MN_FLOOR_CONFERENCE_PARSER_VERSION,
          confidence: 1,
          metadata: {
            contextType: 'structured_public',
            subtype: 'conference_conferee',
            chamber: 'house',
            rawMemberName: appointment.memberName,
            historicalBackfill: true,
            journalDate: link.journalDate,
            legislativeDay: link.legislativeDay,
            asOfEligible: true,
            dateGranularity: 'day',
            sourceRecordFinalAuthority: 'house_journal',
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
          unresolved,
        };
      }

      const persisted = await persistDurableEvidence({
        sourceKind: 'house_journal_conference_appointment',
        sourceUrl: page.canonicalUrl,
        contentSha256: page.contentSha256,
        sessionSlug: session,
        chamberSlug: 'house',
        fetchedAt: page.fetchedAt,
        httpStatus: page.httpStatus,
        metadata: {
          historicalBackfill: true,
          journalDate: link.journalDate,
          legislativeDay: link.legislativeDay,
          parserVersion: MN_FLOOR_CONFERENCE_PARSER_VERSION,
          sourcePolicy: 'house-journal-archive-enumeration-v1',
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
        unresolved,
      };
    } catch (error) {
      return { kind: 'fetch_failure' as const, url: link.url, error: safeMessage(error) };
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
      totals.unresolvedExamples.push(...row.unresolved);
    }
  }

  totals.unresolvedExamples = totals.unresolvedExamples.slice(0, 100);

  if (totals.dateMismatches > 0 || totals.fetchFailures > 0) {
    const diagnostics = totals.unresolvedExamples
      .filter((row) => row.kind === 'date_mismatch' || row.kind === 'fetch_failure')
      .slice(0, 6)
      .map((row) => JSON.stringify(row))
      .join(' | ');
    throw new Error(
      'Historical House conferee source integrity failure: dateMismatches='
      + totals.dateMismatches
      + ', fetchFailures='
      + totals.fetchFailures
      + (diagnostics ? ', samples=' + diagnostics : ''),
    );
  }

  return totals;
}

export async function verifyHistoricalHouseConferees() {
  const result = await pool.query<{
    session_slug: SupportedSession;
    evidence_rows: string;
    members: string;
    bills: string;
    source_pages: string;
  }>(`
    SELECT s.slug AS session_slug,
           count(ei.id)::text AS evidence_rows,
           count(DISTINCT ei.membership_id)::text AS members,
           count(DISTINCT ei.bill_id)::text AS bills,
           count(DISTINCT ei.source_document_id)::text AS source_pages
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      JOIN legislative_sessions s ON s.id=sd.session_id
     WHERE sd.source_kind='house_journal_conference_appointment'
       AND ei.metadata->>'historicalBackfill'='true'
       AND s.slug IN ('2021-2022','2023-2024')
     GROUP BY s.slug,s.starts_on
     ORDER BY s.starts_on
  `);
  return {
    version: HISTORICAL_HOUSE_CONFEREE_BACKFILL_VERSION,
    coverage: result.rows.map((row) => ({
      session: row.session_slug,
      evidenceRows: Number(row.evidence_rows),
      members: Number(row.members),
      bills: Number(row.bills),
      sourcePages: Number(row.source_pages),
    })),
    allNewFeatureWeights: 0 as const,
    servingProbabilityChange: 'none' as const,
  };
}
