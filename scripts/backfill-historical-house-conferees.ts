import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const SESSION_ARCHIVES = [
  { session: '2021-2022', archiveId: 257 },
  { session: '2023-2024', archiveId: 300 },
] as const;
const CONCURRENCY = 6;

type MemberRow = { id: string; name: string };
type BillRow = { id: string; identifier: string };

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .slice(0, 1000);
}

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’]/g, "'").trim().toLowerCase();
}

function lastName(fullName: string): string {
  return normalize(fullName).split(/\s+/).at(-1) ?? '';
}

function resolveMember(raw: string, members: readonly MemberRow[]): MemberRow | undefined {
  const compact = raw.trim().replace(/[.;]+$/, '');
  const comma = compact.match(/^([^,]+),\s*([A-Z])\.?$/i);
  let candidates: MemberRow[];
  if (comma) {
    const surname = normalize(comma[1]);
    const initial = comma[2].toLowerCase();
    candidates = members.filter((member) => {
      const parts = normalize(member.name).split(/\s+/);
      return parts.at(-1) === surname && (parts[0]?.[0] ?? '') === initial;
    });
  } else if (/\s/.test(compact)) {
    candidates = members.filter((member) => normalize(member.name) === normalize(compact));
  } else {
    const surname = normalize(compact);
    candidates = members.filter((member) => lastName(member.name) === surname);
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

async function mapConcurrent<T, R>(items: readonly T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
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

async function main() {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  if (!env.DATABASE_URL) throw new Error('Production DATABASE_URL is unavailable');
  process.env.DATABASE_URL = env.DATABASE_URL;

  const [
    { pool },
    { fetchPublicPage },
    { persistDurableEvidence },
    { parseHistoricalDeepHouseJournalIndex, parseHistoricalDeepHouseJournalDate },
    { parseHouseJournalConferenceAppointments, MN_FLOOR_CONFERENCE_PARSER_VERSION },
  ] = await Promise.all([
    import('../src/lib/db/index.js'),
    import('../src/evidence/public-http.js'),
    import('../src/evidence/durable-ingestion.js'),
    import('../src/evaluation/historical-deep-house-journal-source-bundle.js'),
    import('../src/evidence/minnesota-floor-conference.js'),
  ]);

  const totals = {
    archiveIndexes: 0,
    journalPages: 0,
    appointmentsParsed: 0,
    inserted: 0,
    reused: 0,
    unresolvedMembers: 0,
    unresolvedBills: 0,
    dateMismatches: 0,
    fetchFailures: 0,
  };
  const unresolved: Array<Record<string, unknown>> = [];

  for (const config of SESSION_ARCHIVES) {
    const [memberResult, billResult] = await Promise.all([
      pool.query<MemberRow>(`
        SELECT m.id::text AS id,l.name
          FROM memberships m
          JOIN legislators l ON l.id=m.legislator_id
          JOIN legislative_sessions s ON s.id=m.session_id
          JOIN chambers c ON c.id=m.chamber_id
          JOIN jurisdictions j ON j.id=s.jurisdiction_id
         WHERE j.slug='us-mn' AND s.slug=$1 AND c.slug='house'
         ORDER BY l.normalized_name,m.id
      `, [config.session]),
      pool.query<BillRow>(`
        SELECT b.id::text AS id,b.identifier
          FROM bills b
          JOIN legislative_sessions s ON s.id=b.session_id
          JOIN jurisdictions j ON j.id=s.jurisdiction_id
         WHERE j.slug='us-mn' AND s.slug=$1
      `, [config.session]),
    ]);
    const members = memberResult.rows;
    const billMap = new Map(billResult.rows.map((bill) => [bill.identifier.toUpperCase().replace(/\s+/g, ''), bill]));

    const archiveUrl = 'https://www.house.mn.gov/Journals/' + config.archiveId;
    const archive = await fetchPublicPage(archiveUrl, {
      timeoutMs: 45_000,
      maxBytes: 3_000_000,
      userAgent: 'VotePredict/2.0 historical-house-conferee-backfill',
    });
    totals.archiveIndexes += 1;
    const parsedIndex = parseHistoricalDeepHouseJournalIndex(archive.rawContent, config.session);
    if (!parsedIndex.sessionMatched || parsedIndex.links.length < 40) {
      throw new Error('House Journal archive enumeration incomplete for ' + config.session);
    }

    const pageResults = await mapConcurrent(parsedIndex.links, CONCURRENCY, async (link) => {
      try {
        const page = await fetchPublicPage(link.url, {
          timeoutMs: 45_000,
          maxBytes: 3_000_000,
          userAgent: 'VotePredict/2.0 historical-house-conferee-backfill',
        });
        const pageDate = parseHistoricalDeepHouseJournalDate(page.rawContent);
        if (pageDate !== link.journalDate) {
          return { type: 'date_mismatch' as const, link, pageDate };
        }
        const appointments = parseHouseJournalConferenceAppointments(page.text);
        if (appointments.length === 0) return { type: 'empty' as const };

        const drafts = [];
        let unresolvedMembers = 0;
        let unresolvedBills = 0;
        const pageUnresolved: Array<Record<string, unknown>> = [];
        for (const appointment of appointments) {
          const bill = billMap.get(appointment.billIdentifier);
          if (!bill) {
            unresolvedBills += 1;
            pageUnresolved.push({ session: config.session, date: link.journalDate, bill: appointment.billIdentifier, member: appointment.memberName, reason: 'bill' });
            continue;
          }
          const member = resolveMember(appointment.memberName, members);
          if (!member) {
            unresolvedMembers += 1;
            pageUnresolved.push({ session: config.session, date: link.journalDate, bill: appointment.billIdentifier, member: appointment.memberName, reason: 'member' });
            continue;
          }
          drafts.push({
            target: { membershipId: member.id, billId: bill.id },
            kind: 'context' as const,
            stance: 'neutral' as const,
            claim: member.name + ' was appointed by the Speaker as a House conferee for ' + appointment.billIdentifier + '.',
            excerpt: 'House Journal conference committee appointment for ' + appointment.billIdentifier + ': ' + appointment.memberName,
            publishedAt: link.journalDate + 'T12:00:00.000Z',
            sourceQuality: 'official' as const,
            relevance: 'high' as const,
            freshness: 'stale' as const,
            extractionMethod: 'deterministic-house-journal-conference-appointment',
            extractionVersion: MN_FLOOR_CONFERENCE_PARSER_VERSION,
            confidence: 1,
            metadata: {
              contextType: 'structured_public',
              subtype: 'conference_conferee',
              chamber: 'house',
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
              evidenceSeriesKey: 'conference_conferee:' + config.session + ':' + appointment.billIdentifier + ':' + member.id,
            },
          });
        }

        if (drafts.length === 0) {
          return { type: 'resolved' as const, appointments: appointments.length, inserted: 0, reused: 0, unresolvedMembers, unresolvedBills, pageUnresolved };
        }
        const persisted = await persistDurableEvidence({
          sourceKind: 'house_journal_conference_appointment',
          sourceUrl: page.canonicalUrl,
          contentSha256: page.contentSha256,
          sessionSlug: config.session,
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
          type: 'resolved' as const,
          appointments: appointments.length,
          inserted: persisted.inserted,
          reused: persisted.reused,
          unresolvedMembers,
          unresolvedBills,
          pageUnresolved,
        };
      } catch (error) {
        return { type: 'failure' as const, link, error: safeMessage(error) };
      }
    });

    for (const row of pageResults) {
      totals.journalPages += 1;
      if (row.type === 'failure') {
        totals.fetchFailures += 1;
        unresolved.push({ session: config.session, url: row.link.url, reason: row.error });
      } else if (row.type === 'date_mismatch') {
        totals.dateMismatches += 1;
        unresolved.push({ session: config.session, url: row.link.url, expected: row.link.journalDate, observed: row.pageDate, reason: 'date_mismatch' });
      } else if (row.type === 'resolved') {
        totals.appointmentsParsed += row.appointments;
        totals.inserted += row.inserted;
        totals.reused += row.reused;
        totals.unresolvedMembers += row.unresolvedMembers;
        totals.unresolvedBills += row.unresolvedBills;
        unresolved.push(...row.pageUnresolved);
      }
    }
  }

  console.log(JSON.stringify({
    historicalHouseConfereeBackfill: {
      version: 'historical-house-conferee-v1',
      totals,
      unresolved: unresolved.slice(0, 100),
      allNewFeatureWeights: 0,
      servingProbabilityChange: 'none',
    },
  }, null, 2));

  if (totals.dateMismatches > 0 || totals.fetchFailures > 0) {
    throw new Error('Historical House conferee backfill had source integrity failures');
  }
  if (totals.inserted + totals.reused < 20) {
    throw new Error('Historical House conferee backfill produced unexpectedly low yield');
  }
  await pool.end();
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
