import { setTimeout as sleep } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import { fetchSenateJournal, listSenateJournalLinks, parseSenateJournalText } from '../src/sources/minnesota/senate-journals.js';
import { activeMembershipCandidates, reconcileHouseMemberName, type MembershipCandidate } from '../src/sources/minnesota/member-reconciliation.js';
import { getMinnesotaHouseSession, MINNESOTA_HOUSE_HISTORICAL_SESSIONS, type MinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';

interface Options {
  sessions: MinnesotaHouseSession[];
  limit?: number;
  delayMs: number;
  dryRun: boolean;
  skipExisting: boolean;
}

interface Context {
  jurisdictionId: string;
  sessionId: string;
  chamberId: string;
}

function argumentValue(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function positiveInteger(value: string | undefined, label: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const requested = argumentValue(args, '--session');
  return {
    sessions: requested ? [getMinnesotaHouseSession(requested)] : [...MINNESOTA_HOUSE_HISTORICAL_SESSIONS],
    limit: positiveInteger(argumentValue(args, '--limit'), '--limit'),
    delayMs: positiveInteger(argumentValue(args, '--delay-ms'), '--delay-ms') ?? 150,
    dryRun: args.includes('--dry-run'),
    skipExisting: args.includes('--skip-existing'),
  };
}

async function ensureContext(client: PoolClient, session: MinnesotaHouseSession): Promise<Context> {
  const jurisdiction = await client.query<{ id: string }>(
    `INSERT INTO jurisdictions (slug,name,country_code) VALUES ('us-mn','Minnesota','US')
     ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
  );
  const jurisdictionId = jurisdiction.rows[0].id;
  const chamber = await client.query<{ id: string }>(
    `INSERT INTO chambers (jurisdiction_id,slug,name,kind) VALUES ($1,'senate','Minnesota Senate','upper')
     ON CONFLICT (jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind RETURNING id`,
    [jurisdictionId],
  );
  const legislativeSession = await client.query<{ id: string }>(
    `INSERT INTO legislative_sessions (jurisdiction_id,slug,name,starts_on,ends_on,is_current)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (jurisdiction_id,slug) DO UPDATE SET
       name=EXCLUDED.name,starts_on=EXCLUDED.starts_on,ends_on=EXCLUDED.ends_on,is_current=EXCLUDED.is_current
     RETURNING id`,
    [jurisdictionId, session.slug, session.name, session.startsOn, session.endsOn, session.isCurrent],
  );
  return { jurisdictionId, chamberId: chamber.rows[0].id, sessionId: legislativeSession.rows[0].id };
}

async function candidates(client: PoolClient, context: Context): Promise<MembershipCandidate[]> {
  const result = await client.query<{
    membership_id: string;
    legislator_id: string;
    name: string;
    normalized_name: string;
    starts_on: string | null;
    ends_on: string | null;
  }>(
    `SELECT m.id membership_id,l.id legislator_id,l.name,l.normalized_name,m.starts_on::text,m.ends_on::text
       FROM memberships m JOIN legislators l ON l.id=m.legislator_id
      WHERE m.session_id=$1 AND m.chamber_id=$2`,
    [context.sessionId, context.chamberId],
  );
  const aliases = await client.query<{ membership_id: string; source_name: string }>(
    `SELECT a.membership_id,a.source_name
       FROM membership_source_aliases a JOIN memberships m ON m.id=a.membership_id
      WHERE m.session_id=$1 AND m.chamber_id=$2`,
    [context.sessionId, context.chamberId],
  );
  const map = new Map<string, string[]>();
  for (const row of aliases.rows) map.set(row.membership_id, [...(map.get(row.membership_id) ?? []), row.source_name]);
  return result.rows.map((row) => ({
    membershipId: row.membership_id,
    legislatorId: row.legislator_id,
    name: row.name,
    normalizedName: row.normalized_name,
    aliases: map.get(row.membership_id),
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  }));
}

function senateJournalNameForms(candidate: MembershipCandidate): string[] {
  const forms = new Set<string>();
  for (const raw of [candidate.name, ...(candidate.aliases ?? [])]) {
    const value = raw.replace(/^spk\.?\s+/i, '').replace(/^speaker\s+/i, '').trim();
    const comma = value.match(/^([^,]+),/);
    if (comma) {
      forms.add(comma[1].trim());
      continue;
    }
    const tokens = value.replace(/\s*"[^"]*"\s*/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    for (let width = 1; width <= Math.min(3, tokens.length); width += 1) forms.add(tokens.slice(-width).join(' '));
  }
  return [...forms].filter(Boolean);
}

async function ensureBill(client: PoolClient, context: Context, identifier: string, sourceUrl: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO bills (session_id,identifier,title,source_url,metadata)
     VALUES ($1,$2,$2,$3,'{"seeded_from":"senate_journal_history"}'::jsonb)
     ON CONFLICT (session_id,identifier) DO UPDATE SET updated_at=now()
     RETURNING id`,
    [context.sessionId, identifier, sourceUrl],
  );
  return result.rows[0].id;
}

async function hasPersistedJournal(client: PoolClient, context: Context, sourceUrl: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM source_documents
        WHERE session_id=$1 AND chamber_id=$2 AND source_kind='senate_journal_pdf' AND source_url=$3
     ) AS exists`,
    [context.sessionId, context.chamberId, sourceUrl],
  );
  return result.rows[0]?.exists ?? false;
}

async function persistJournal(
  client: PoolClient,
  context: Context,
  session: MinnesotaHouseSession,
  roster: MembershipCandidate[],
  sourceUrl: string,
  occurredOn: string | undefined,
  text: string,
  pdfSha256: string,
  byteLength: number,
): Promise<{ votes: number; memberVotes: number; unresolved: number }> {
  const activeForJournal = occurredOn ? activeMembershipCandidates(roster, occurredOn) : roster;
  const knownMemberNames = [...new Set(activeForJournal.flatMap(senateJournalNameForms))];
  const events = parseSenateJournalText({ text, sessionKey: session.sessionKey, sourceUrl, occurredOn, knownMemberNames });

  await client.query('BEGIN');
  try {
    const source = await client.query<{ id: string }>(
      `INSERT INTO source_documents (
         jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,http_status,metadata
       ) VALUES ($1,$2,$3,'senate_journal_pdf',$4,$5,200,$6::jsonb)
       ON CONFLICT (source_url,content_sha256) DO UPDATE SET
         fetched_at=now(),metadata=source_documents.metadata||EXCLUDED.metadata
       RETURNING id`,
      [context.jurisdictionId, context.sessionId, context.chamberId, sourceUrl, pdfSha256, JSON.stringify({ sourceSystem: 'mn_senate_journals', byteLength, parsedPassageVotes: events.length })],
    );
    let memberVotes = 0;
    let unresolved = 0;
    for (const event of events) {
      const billId = await ensureBill(client, context, event.billIdentifier, sourceUrl);
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO vote_events (
           session_id,chamber_id,bill_id,source_document_id,external_key,vote_kind,motion_text,
           occurred_on,yea_count,nay_count,other_count,passed,is_passage,metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
         ON CONFLICT (session_id,chamber_id,external_key) DO UPDATE SET
           bill_id=EXCLUDED.bill_id,source_document_id=EXCLUDED.source_document_id,
           vote_kind=EXCLUDED.vote_kind,motion_text=EXCLUDED.motion_text,occurred_on=EXCLUDED.occurred_on,
           yea_count=EXCLUDED.yea_count,nay_count=EXCLUDED.nay_count,other_count=EXCLUDED.other_count,
           passed=EXCLUDED.passed,is_passage=EXCLUDED.is_passage,metadata=vote_events.metadata||EXCLUDED.metadata
         RETURNING id`,
        [
          context.sessionId,
          context.chamberId,
          billId,
          source.rows[0].id,
          event.externalKey,
          event.voteKind,
          event.motionText,
          event.occurredOn,
          event.yeaCount,
          event.nayCount,
          event.otherCount,
          event.passed ?? null,
          event.isPassage,
          JSON.stringify({ sourceSystem: 'mn_senate_journals' }),
        ],
      );
      await client.query('DELETE FROM member_votes WHERE vote_event_id=$1', [inserted.rows[0].id]);
      const active = activeMembershipCandidates(roster, event.occurredOn);
      for (const memberVote of event.memberVotes) {
        const resolution = reconcileHouseMemberName(memberVote.sourceName, active);
        const membershipId = resolution.status === 'matched' ? resolution.membershipId : null;
        if (!membershipId) unresolved += 1;
        await client.query(
          `INSERT INTO member_votes (
             vote_event_id,membership_id,source_member_name,normalized_member_name,choice,source_ordinal,metadata
           ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
          [inserted.rows[0].id, membershipId, memberVote.sourceName, memberVote.normalizedName, memberVote.choice, memberVote.sourceOrdinal, JSON.stringify({ reconciliation: resolution, termAware: true })],
        );
        memberVotes += 1;
      }
    }
    await client.query('COMMIT');
    return { votes: events.length, memberVotes, unresolved };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function runSession(pool: Pool | undefined, session: MinnesotaHouseSession, options: Options): Promise<number> {
  const allJournals = await listSenateJournalLinks(session.slug);
  const journals = options.limit ? allJournals.slice(0, options.limit) : allJournals;
  let votes = 0;
  let memberVotes = 0;
  let unresolved = 0;
  let skippedExisting = 0;
  const failures: string[] = [];
  const client = pool ? await pool.connect() : undefined;
  let context: Context | undefined;
  let roster: MembershipCandidate[] = [];
  let runId: string | undefined;

  try {
    if (client) {
      context = await ensureContext(client, session);
      roster = await candidates(client, context);
      const run = await client.query<{ id: string }>(
        `INSERT INTO ingestion_runs (source_system,scope,status,metadata)
         VALUES ('mn_senate_journals',$1,'running',$2::jsonb) RETURNING id`,
        [session.slug, JSON.stringify({ discoveredJournals: allJournals.length, selectedJournals: journals.length, skipExisting: options.skipExisting })],
      );
      runId = run.rows[0].id;
    }

    for (const [index, journal] of journals.entries()) {
      let fetched = false;
      try {
        if (!options.dryRun && options.skipExisting && client && context && await hasPersistedJournal(client, context, journal.sourceUrl)) {
          skippedExisting += 1;
        } else {
          fetched = true;
          const document = await fetchSenateJournal(journal.sourceUrl);
          if (options.dryRun) {
            const parsed = parseSenateJournalText({ text: document.text, sessionKey: session.sessionKey, sourceUrl: journal.sourceUrl, occurredOn: journal.date });
            votes += parsed.length;
            memberVotes += parsed.reduce((sum, vote) => sum + vote.memberVotes.length, 0);
          } else if (client && context) {
            const result = await persistJournal(client, context, session, roster, journal.sourceUrl, journal.date, document.text, document.pdfSha256, document.byteLength);
            votes += result.votes;
            memberVotes += result.memberVotes;
            unresolved += result.unresolved;
          }
        }
      } catch (error) {
        failures.push(`${journal.sourceUrl}: ${error instanceof Error ? error.message : error}`);
      }
      if ((index + 1) % 20 === 0 || index === journals.length - 1) {
        console.log(`[${session.slug}] ${index + 1}/${journals.length} journals; ${votes} new passage votes; ${skippedExisting} existing journals skipped; ${unresolved} unresolved new member votes`);
      }
      if (fetched && index < journals.length - 1) await sleep(options.delayMs);
    }

    if (client && runId) {
      await client.query(
        `UPDATE ingestion_runs SET
           status=$2,finished_at=now(),source_documents=$3,vote_events=$4,member_votes=$5,
           unresolved_members=$6,error_summary=$7,metadata=metadata||$8::jsonb
         WHERE id=$1`,
        [runId, failures.length ? 'failed' : 'complete', journals.length - failures.length, votes, memberVotes, unresolved, failures[0] ?? null, JSON.stringify({ failures: failures.slice(0, 100), skippedExisting })],
      );
    }
  } finally {
    client?.release();
  }

  console.log(JSON.stringify({ session: session.slug, journals: journals.length, votes, memberVotes, unresolved, skippedExisting, failures: failures.length }, null, 2));
  return failures.length;
}

async function main(): Promise<void> {
  const options = parseOptions();
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!options.dryRun && !connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required; use --dry-run for source-only inspection');
  const pool = options.dryRun ? undefined : new Pool({ connectionString, max: 2 });
  let failures = 0;
  try {
    for (const session of options.sessions) failures += await runSession(pool, session, options);
  } finally {
    await pool?.end();
  }
  if (failures) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
