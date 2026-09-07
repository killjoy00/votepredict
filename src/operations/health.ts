import { pool } from '@/lib/db';

export type OperationalHealth = {
  generatedAt: string;
  ingestion: Array<{
    sourceSystem: string;
    scope: string;
    status: string;
    startedAt: string;
    finishedAt?: string;
    ageHours: number;
    sourceDocuments: number;
    voteEvents: number;
    memberVotes: number;
    unresolvedMembers: number;
    errorSummary?: string;
  }>;
  sourceFreshness: Array<{
    sourceKind: string;
    latestFetchedAt: string;
    ageHours: number;
    documents: number;
    recentHttpFailures: number;
  }>;
  research: {
    last24Hours: number;
    completed: number;
    failed: number;
    running: number;
    latestFinishedAt?: string;
  };
  warnings: string[];
};

function ageHours(timestamp: string, now: number): number {
  return Math.max(0, (now - Date.parse(timestamp)) / 3_600_000);
}

export async function getOperationalHealth(): Promise<OperationalHealth> {
  const now = Date.now();
  const ingestionResult = await pool.query<{
    source_system: string;
    scope: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    source_documents: number;
    vote_events: number;
    member_votes: number;
    unresolved_members: number;
    error_summary: string | null;
  }>(`
    SELECT DISTINCT ON (source_system, scope)
           source_system,
           scope,
           status,
           started_at::text,
           finished_at::text,
           source_documents,
           vote_events,
           member_votes,
           unresolved_members,
           error_summary
      FROM ingestion_runs
     ORDER BY source_system, scope, started_at DESC`);

  const freshnessResult = await pool.query<{
    source_kind: string;
    latest_fetched_at: string;
    documents: number;
    recent_http_failures: number;
  }>(`
    SELECT source_kind,
           max(fetched_at)::text AS latest_fetched_at,
           count(*)::int AS documents,
           count(*) FILTER (
             WHERE fetched_at >= now() - interval '7 days'
               AND http_status IS NOT NULL
               AND http_status >= 400
           )::int AS recent_http_failures
      FROM source_documents
     GROUP BY source_kind
     ORDER BY max(fetched_at) DESC`);

  const researchResult = await pool.query<{
    last_24_hours: number;
    completed: number;
    failed: number;
    running: number;
    latest_finished_at: string | null;
  }>(`
    SELECT count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS last_24_hours,
           count(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND status = 'completed')::int AS completed,
           count(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND status = 'failed')::int AS failed,
           count(*) FILTER (WHERE status IN ('pending', 'running'))::int AS running,
           max(finished_at)::text AS latest_finished_at
      FROM research_runs`);

  const ingestion = ingestionResult.rows.map((row) => ({
    sourceSystem: row.source_system,
    scope: row.scope,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    ageHours: ageHours(row.finished_at ?? row.started_at, now),
    sourceDocuments: Number(row.source_documents),
    voteEvents: Number(row.vote_events),
    memberVotes: Number(row.member_votes),
    unresolvedMembers: Number(row.unresolved_members),
    errorSummary: row.error_summary ?? undefined,
  }));
  const sourceFreshness = freshnessResult.rows.map((row) => ({
    sourceKind: row.source_kind,
    latestFetchedAt: row.latest_fetched_at,
    ageHours: ageHours(row.latest_fetched_at, now),
    documents: Number(row.documents),
    recentHttpFailures: Number(row.recent_http_failures),
  }));
  const researchRow = researchResult.rows[0] ?? { last_24_hours: 0, completed: 0, failed: 0, running: 0, latest_finished_at: null };
  const research = {
    last24Hours: Number(researchRow.last_24_hours),
    completed: Number(researchRow.completed),
    failed: Number(researchRow.failed),
    running: Number(researchRow.running),
    latestFinishedAt: researchRow.latest_finished_at ?? undefined,
  };

  const warnings: string[] = [];
  for (const run of ingestion) {
    if (run.status === 'failed') warnings.push(`${run.sourceSystem}/${run.scope}: latest ingestion failed${run.errorSummary ? ` — ${run.errorSummary}` : ''}`);
    if (run.unresolvedMembers > 0) warnings.push(`${run.sourceSystem}/${run.scope}: ${run.unresolvedMembers} unresolved members in the latest run.`);
  }
  for (const source of sourceFreshness) {
    if (source.recentHttpFailures > 0) warnings.push(`${source.sourceKind}: ${source.recentHttpFailures} HTTP source failures recorded in the last 7 days.`);
  }
  if (research.failed > 0) warnings.push(`Deep research: ${research.failed} failed run${research.failed === 1 ? '' : 's'} in the last 24 hours.`);
  if (research.running > 0) warnings.push(`Deep research: ${research.running} run${research.running === 1 ? '' : 's'} still pending/running.`);

  return { generatedAt: new Date(now).toISOString(), ingestion, sourceFreshness, research, warnings };
}
