import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import {
  discoverHouseVoteBillLinks,
  fetchHouseVoteDetail,
  fetchHouseVoteSummary,
  parseHouseVoteDetailHtml,
} from '../src/sources/minnesota/house-votes.js';
import { reconcileHouseMemberName, type MembershipCandidate } from '../src/sources/minnesota/member-reconciliation.js';
import {
  getMinnesotaHouseSession,
  MINNESOTA_HOUSE_HISTORICAL_SESSIONS,
  type MinnesotaHouseSession,
} from '../src/sources/minnesota/sessions.js';

interface CliOptions {
  sessions: MinnesotaHouseSession[];
  limit?: number;
  delayMs: number;
  dryRun: boolean;
  skipExisting: boolean;
}

interface SessionContext {
  jurisdictionId: string;
  sessionId: string;
  chamberId: string;
}

interface Counters {
  sourceDocuments: number;
  voteEvents: number;
  memberVotes: number;
  unresolvedMembers: number;
}

function argumentValue(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function positiveInteger(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function parseOptions(args = process.argv.slice(2)): CliOptions {
  const requestedSession = argumentValue(args, '--session');
  const sessions = requestedSession
    ? [getMinnesotaHouseSession(requestedSession)]
    : [...MINNESOTA_HOUSE_HISTORICAL_SESSIONS];
  const limit = positiveInteger(argumentValue(args, '--limit'), '--limit');
  const delayMs = positiveInteger(argumentValue(args, '--delay-ms'), '--delay-ms') ?? 100;
  return {
    sessions,
    limit,
    delayMs,
    dryRun: args.includes('--dry-run'),
    skipExisting: args.includes('--skip-existing'),
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function ensureSessionContext(client: PoolClient, session: MinnesotaHouseSession): Promise<SessionContext> {
  const jurisdiction = await client.query<{ id: string }>(
    `INSERT INTO jurisdictions (slug, name, country_code)
     VALUES ('us-mn', 'Minnesota', 'US')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
  );
  const jurisdictionId = jurisdiction.rows[0].id;

  const chamber = await client.query<{ id: string }>(
    `INSERT INTO chambers (jurisdiction_id, slug, name, kind)
     VALUES ($1, 'house', 'Minnesota House of Representatives', 'lower')
     ON CONFLICT (jurisdiction_id, slug) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind
     RETURNING id`,
    [jurisdictionId],
  );

  const legislativeSession = await client.query<{ id: string }>(
    `INSERT INTO legislative_sessions (jurisdiction_id, slug, name, starts_on, ends_on, is_current)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (jurisdiction_id, slug) DO UPDATE SET
       name = EXCLUDED.name,
       starts_on = EXCLUDED.starts_on,
       ends_on = EXCLUDED.ends_on,
       is_current = EXCLUDED.is_current
     RETURNING id`,
    [jurisdictionId, session.slug, session.name, session.startsOn, session.endsOn, session.isCurrent],
  );

  return { jurisdictionId, chamberId: chamber.rows[0].id, sessionId: legislativeSession.rows[0].id };
}

async function persistSourceDocument(
  client: PoolClient,
  context: SessionContext,
  sourceKind: string,
  sourceUrl: string,
  html: string,
  metadata: Record<string, unknown>,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO source_documents (
       jurisdiction_id, session_id, chamber_id, source_kind, source_url,
       content_sha256, http_status, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, 200, $7::jsonb)
     ON CONFLICT (source_url, content_sha256) DO UPDATE SET
       fetched_at = now(),
       http_status = EXCLUDED.http_status,
       metadata = source_documents.metadata || EXCLUDED.metadata
     RETURNING id`,
    [context.jurisdictionId, context.sessionId, context.chamberId, sourceKind, sourceUrl, sha256(html), JSON.stringify(metadata)],
  );
  return result.rows[0].id;
}

async function hasPersistedVoteDetail(client: PoolClient, context: SessionContext, sourceUrl: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM source_documents
        WHERE session_id=$1 AND chamber_id=$2 AND source_kind='house_vote_detail' AND source_url=$3
     ) AS exists`,
    [context.sessionId, context.chamberId, sourceUrl],
  );
  return result.rows[0]?.exists ?? false;
}

async function ensureBill(client: PoolClient, context: SessionContext, identifier: string, sourceUrl: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO bills (session_id, identifier, title, source_url, metadata)
     VALUES ($1, $2, $2, $3, '{"seeded_from":"house_vote_history"}'::jsonb)
     ON CONFLICT (session_id, identifier) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [context.sessionId, identifier, sourceUrl],
  );
  return result.rows[0].id;
}

async function loadMembershipCandidates(client: PoolClient, context: SessionContext): Promise<MembershipCandidate[]> {
  const result = await client.query<{
    membership_id: string;
    legislator_id: string;
    name: string;
    normalized_name: string;
  }>(
    `SELECT m.id AS membership_id, l.id AS legislator_id, l.name, l.normalized_name
       FROM memberships m
       JOIN legislators l ON l.id = m.legislator_id
      WHERE m.session_id = $1 AND m.chamber_id = $2`,
    [context.sessionId, context.chamberId],
  );
  return result.rows.map((row) => ({
    membershipId: row.membership_id,
    legislatorId: row.legislator_id,
    name: row.name,
    normalizedName: row.normalized_name,
  }));
}

async function persistVotePage(
  client: PoolClient,
  context: SessionContext,
  session: MinnesotaHouseSession,
  sourceUrl: string,
  html: string,
  candidates: MembershipCandidate[],
  counters: Counters,
): Promise<void> {
  const events = parseHouseVoteDetailHtml({ html, sessionKey: session.sessionKey, sourceUrl });
  if (events.length === 0) throw new Error(`No recorded vote events parsed from ${sourceUrl}`);

  await client.query('BEGIN');
  try {
    const sourceDocumentId = await persistSourceDocument(client, context, 'house_vote_detail', sourceUrl, html, {
      sourceSystem: 'mn_house_chamber_voting',
      sessionKey: session.sessionKey,
    });
    counters.sourceDocuments += 1;

    for (const event of events) {
      const billId = await ensureBill(client, context, event.billIdentifier, sourceUrl);
      const voteResult = await client.query<{ id: string }>(
        `INSERT INTO vote_events (
           session_id, chamber_id, bill_id, source_document_id, external_key, vote_kind,
           motion_text, amendment_ref, occurred_on, journal_page, yea_count, nay_count,
           other_count, passed, is_passage, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULL,$14,$15::jsonb)
         ON CONFLICT (session_id, chamber_id, external_key) DO UPDATE SET
           bill_id = EXCLUDED.bill_id,
           source_document_id = EXCLUDED.source_document_id,
           vote_kind = EXCLUDED.vote_kind,
           motion_text = EXCLUDED.motion_text,
           amendment_ref = EXCLUDED.amendment_ref,
           occurred_on = EXCLUDED.occurred_on,
           journal_page = EXCLUDED.journal_page,
           yea_count = EXCLUDED.yea_count,
           nay_count = EXCLUDED.nay_count,
           other_count = EXCLUDED.other_count,
           is_passage = EXCLUDED.is_passage,
           metadata = vote_events.metadata || EXCLUDED.metadata
         RETURNING id`,
        [
          context.sessionId,
          context.chamberId,
          billId,
          sourceDocumentId,
          event.externalKey,
          event.voteKind,
          event.motionText,
          event.amendmentRef ?? null,
          event.occurredOn,
          event.journalPage ?? null,
          event.yeaCount,
          event.nayCount,
          event.otherCount,
          event.isPassage,
          JSON.stringify({ sourceSystem: 'mn_house_chamber_voting' }),
        ],
      );
      const voteEventId = voteResult.rows[0].id;
      counters.voteEvents += 1;

      await client.query('DELETE FROM member_votes WHERE vote_event_id = $1', [voteEventId]);
      for (const memberVote of event.memberVotes) {
        const resolution = reconcileHouseMemberName(memberVote.sourceName, candidates);
        const membershipId = resolution.status === 'matched' ? resolution.membershipId : null;
        if (!membershipId) counters.unresolvedMembers += 1;

        await client.query(
          `INSERT INTO member_votes (
             vote_event_id, membership_id, source_member_name, normalized_member_name,
             choice, source_ordinal, metadata
           ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
          [
            voteEventId,
            membershipId,
            memberVote.sourceName,
            memberVote.normalizedName,
            memberVote.choice,
            memberVote.sourceOrdinal,
            JSON.stringify({ reconciliation: resolution }),
          ],
        );
        counters.memberVotes += 1;
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function runSession(pool: Pool | undefined, session: MinnesotaHouseSession, options: CliOptions): Promise<number> {
  const summary = await fetchHouseVoteSummary(session.sessionKey);
  const allLinks = discoverHouseVoteBillLinks(summary.html, session.sessionKey);
  if (allLinks.length === 0) throw new Error(`No House vote bill links found for ${session.slug}`);
  const links = options.limit ? allLinks.slice(0, options.limit) : allLinks;

  const counters: Counters = { sourceDocuments: 0, voteEvents: 0, memberVotes: 0, unresolvedMembers: 0 };
  const failures: Array<{ billIdentifier: string; error: string }> = [];

  if (options.dryRun) {
    console.log(`[${session.slug}] discovered ${allLinks.length} bills; inspecting ${links.length}`);
    for (const [index, link] of links.entries()) {
      try {
        const detail = await fetchHouseVoteDetail(session.sessionKey, link.billIdentifier);
        const events = parseHouseVoteDetailHtml({ html: detail.html, sessionKey: session.sessionKey, sourceUrl: detail.sourceUrl });
        counters.sourceDocuments += 1;
        counters.voteEvents += events.length;
        counters.memberVotes += events.reduce((sum, event) => sum + event.memberVotes.length, 0);
      } catch (error) {
        failures.push({ billIdentifier: link.billIdentifier, error: error instanceof Error ? error.message : String(error) });
      }
      if (index < links.length - 1) await sleep(options.delayMs);
    }
    console.log(JSON.stringify({ session: session.slug, counters, failures }, null, 2));
    return failures.length;
  }

  if (!pool) throw new Error('Database pool is required outside dry-run mode');
  const client = await pool.connect();
  try {
    const context = await ensureSessionContext(client, session);
    const candidates = await loadMembershipCandidates(client, context);
    const run = await client.query<{ id: string }>(
      `INSERT INTO ingestion_runs (source_system, scope, status, metadata)
       VALUES ('mn_house_chamber_voting', $1, 'running', $2::jsonb)
       RETURNING id`,
      [session.slug, JSON.stringify({ sessionKey: session.sessionKey, discoveredBills: allLinks.length, selectedBills: links.length, skipExisting: options.skipExisting })],
    );
    const runId = run.rows[0].id;
    let skippedExisting = 0;

    try {
      await persistSourceDocument(client, context, 'house_vote_summary', summary.sourceUrl, summary.html, {
        sourceSystem: 'mn_house_chamber_voting',
        sessionKey: session.sessionKey,
      });
      counters.sourceDocuments += 1;

      for (const [index, link] of links.entries()) {
        try {
          if (options.skipExisting && await hasPersistedVoteDetail(client, context, link.sourceUrl)) {
            skippedExisting += 1;
          } else {
            const detail = await fetchHouseVoteDetail(session.sessionKey, link.billIdentifier);
            await persistVotePage(client, context, session, detail.sourceUrl, detail.html, candidates, counters);
          }
        } catch (error) {
          failures.push({ billIdentifier: link.billIdentifier, error: error instanceof Error ? error.message : String(error) });
        }
        if ((index + 1) % 25 === 0 || index === links.length - 1) {
          console.log(`[${session.slug}] ${index + 1}/${links.length} bills; ${counters.voteEvents} new votes; ${skippedExisting} existing bill pages skipped; ${counters.unresolvedMembers} unresolved new member votes`);
        }
        if (!options.skipExisting && index < links.length - 1) await sleep(options.delayMs);
      }
    } finally {
      const status = failures.length === 0 ? 'complete' : 'failed';
      await client.query(
        `UPDATE ingestion_runs SET
           status = $2,
           finished_at = now(),
           source_documents = $3,
           vote_events = $4,
           member_votes = $5,
           unresolved_members = $6,
           error_summary = $7,
           metadata = metadata || $8::jsonb
         WHERE id = $1`,
        [
          runId,
          status,
          counters.sourceDocuments,
          counters.voteEvents,
          counters.memberVotes,
          counters.unresolvedMembers,
          failures.length ? `${failures.length} bill page(s) failed; first: ${failures[0].billIdentifier}: ${failures[0].error}` : null,
          JSON.stringify({ failures: failures.slice(0, 100), skippedExisting }),
        ],
      );
    }
  } finally {
    client.release();
  }

  console.log(JSON.stringify({ session: session.slug, counters, failures }, null, 2));
  return failures.length;
}

async function main(): Promise<void> {
  const options = parseOptions();
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!options.dryRun && !connectionString) {
    throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required. Use --dry-run to inspect official pages without persistence.');
  }

  const pool = options.dryRun ? undefined : new Pool({ connectionString, max: 3 });
  let failures = 0;
  try {
    for (const session of options.sessions) failures += await runSession(pool, session, options);
  } finally {
    await pool?.end();
  }

  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
