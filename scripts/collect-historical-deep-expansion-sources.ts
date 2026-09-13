import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  buildHistoricalDeepExpansionSourceBundle,
  collectHistoricalDeepExpansionSource,
  matchHistoricalDeepExpansionCases,
  parseHistoricalDeepCommitteeHome,
  parseHistoricalDeepMinuteDate,
  type HistoricalDeepCommitteeMinuteLink,
  type HistoricalDeepExpansionSourceDiagnostic,
} from '../src/evaluation/historical-deep-expansion-source-bundle.js';
import type { HistoricalDeepExpansionCohort } from '../src/evaluation/historical-deep-expansion-cohort.js';

interface SessionArchiveConfig {
  session: string;
  committeeIdStart: number;
  committeeIdEnd: number;
}

interface FetchResult {
  status: number;
  url: string;
  contentType: string;
  bytes: Buffer;
}

const SESSION_ARCHIVES: readonly SessionArchiveConfig[] = [
  { session: '2021-2022', committeeIdStart: 92001, committeeIdEnd: 92099 },
  { session: '2023-2024', committeeIdStart: 93001, committeeIdEnd: 93099 },
];
const USER_AGENT = 'VotePredict/2.0 historical-deep-expansion-archive-collector';
const CONCURRENCY = 8;

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requiredArgument(name: string): string {
  const value = argumentValue(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function fetchOfficialHtml(url: string, allow404 = false): Promise<FetchResult | undefined> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (response.status === 404 && allow404) return undefined;
      if (response.status === 429 || response.status >= 500) {
        if (attempt < 3) {
          await delay(attempt * 750);
          continue;
        }
        throw new Error(`official archive returned HTTP ${response.status}`);
      }
      return {
        status: response.status,
        url: response.url,
        contentType: response.headers.get('content-type') ?? '',
        bytes,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await delay(attempt * 750);
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Unable to fetch ${url}`);
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
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function committeeIds(config: SessionArchiveConfig): string[] {
  return Array.from(
    { length: config.committeeIdEnd - config.committeeIdStart + 1 },
    (_unused, offset) => String(config.committeeIdStart + offset),
  );
}

function latestVoteDate(cohort: HistoricalDeepExpansionCohort, session: string): string {
  const dates = cohort.cases.filter((item) => item.session === session).map((item) => item.occurredOn).sort();
  const latest = dates.at(-1);
  if (!latest) throw new Error(`Frozen expansion cohort has no cases for ${session}`);
  return latest;
}

async function main(): Promise<void> {
  const cohortPath = resolve(requiredArgument('--cohort'));
  const outputPath = resolve(
    argumentValue('--output')
      ?? process.env.VOTEPREDICT_DEEP_EXPANSION_SOURCE_OUTPUT
      ?? 'artifacts/historical-deep-expansion-source-bundle.json',
  );
  const cohortHeadSha = requiredArgument('--cohort-head-sha');
  const cohortArtifactId = positiveInteger(requiredArgument('--cohort-artifact-id'), '--cohort-artifact-id');
  const cohortArtifactDigest = requiredArgument('--cohort-artifact-digest');
  const codeSha = argumentValue('--code-sha') ?? process.env.GITHUB_SHA ?? null;
  const cohort = JSON.parse(readFileSync(cohortPath, 'utf8')) as HistoricalDeepExpansionCohort;
  if (!Array.isArray(cohort.cases) || cohort.cases.length !== 24) {
    throw new Error(`Expected the frozen 24-event expansion cohort, got ${cohort.cases?.length ?? 'unknown'}`);
  }
  if (cohort.metadata.chamber !== 'house') throw new Error('Expansion archive collector currently supports House only');

  const diagnostics: HistoricalDeepExpansionSourceDiagnostic[] = [];
  const minuteLinks: Array<HistoricalDeepCommitteeMinuteLink & { session: string }> = [];
  let committeeHomeIdsAttempted = 0;
  let committeesDiscovered = 0;
  const committeesBySession = new Map<string, number>();

  for (const config of SESSION_ARCHIVES) {
    if (!cohort.cases.some((item) => item.session === config.session)) continue;
    const ids = committeeIds(config);
    committeeHomeIdsAttempted += ids.length;
    const discovered = await mapConcurrent(ids, CONCURRENCY, async (committeeId) => {
      const url = `https://www.house.mn.gov/Committees/home/${committeeId}`;
      const response = await fetchOfficialHtml(url, true);
      if (!response) return [];
      if (response.status < 200 || response.status >= 300 || !/text\/html/i.test(response.contentType)) {
        diagnostics.push({
          type: 'committee_home_unavailable',
          session: config.session,
          committeeId,
          url,
          detail: `Committee home returned HTTP ${response.status} / ${response.contentType || 'unknown content type'}`,
          httpStatus: response.status,
        });
        return [];
      }
      const parsed = parseHistoricalDeepCommitteeHome(response.bytes.toString('utf8'), config.session, committeeId);
      if (!parsed.sessionMatched) return [];
      return parsed.links.map((link) => ({ ...link, session: config.session }));
    });
    const sessionLinks = discovered.flat();
    const committeeCount = new Set(sessionLinks.map((item) => item.committeeId)).size;
    if (committeeCount < 8) {
      throw new Error(`Archive enumeration found only ${committeeCount} committees for ${config.session}; refusing incomplete source discovery`);
    }
    committeesBySession.set(config.session, committeeCount);
    committeesDiscovered += committeeCount;
    minuteLinks.push(...sessionLinks);
  }

  const dedupedLinks = [...new Map(
    minuteLinks.map((item) => [`${item.session}|${item.committeeId}|${item.meetingId}`, item] as const),
  ).values()].sort((left, right) => left.session.localeCompare(right.session)
    || left.indexDate.localeCompare(right.indexDate)
    || left.committeeId.localeCompare(right.committeeId)
    || Number(left.meetingId) - Number(right.meetingId));
  if (dedupedLinks.length < 100) {
    throw new Error(`Archive enumeration found only ${dedupedLinks.length} minute links; refusing incomplete source discovery`);
  }

  const eligibleLinks = dedupedLinks.filter((item) => item.indexDate < latestVoteDate(cohort, item.session));
  const fetched = await mapConcurrent(eligibleLinks, CONCURRENCY, async (link) => {
    const response = await fetchOfficialHtml(link.url, true);
    if (!response) {
      diagnostics.push({
        type: 'minute_unavailable',
        session: link.session,
        committeeId: link.committeeId,
        meetingId: link.meetingId,
        url: link.url,
        detail: 'Exact committee-minutes URL returned HTTP 404',
        httpStatus: 404,
      });
      return undefined;
    }
    if (response.status < 200 || response.status >= 300 || !/text\/html/i.test(response.contentType)) {
      diagnostics.push({
        type: 'minute_unavailable',
        session: link.session,
        committeeId: link.committeeId,
        meetingId: link.meetingId,
        url: link.url,
        detail: `Exact committee-minutes URL returned HTTP ${response.status} / ${response.contentType || 'unknown content type'}`,
        httpStatus: response.status,
      });
      return undefined;
    }
    const html = response.bytes.toString('utf8');
    const meetingDate = parseHistoricalDeepMinuteDate(html, link.session);
    if (!meetingDate) {
      diagnostics.push({
        type: 'minute_date_unresolved',
        session: link.session,
        committeeId: link.committeeId,
        meetingId: link.meetingId,
        url: link.url,
        detail: `Could not prove a ${link.session} meeting date from the exact minutes page`,
      });
      return undefined;
    }
    if (meetingDate !== link.indexDate) {
      diagnostics.push({
        type: 'minute_index_date_mismatch',
        session: link.session,
        committeeId: link.committeeId,
        meetingId: link.meetingId,
        url: link.url,
        detail: `Committee-home date ${link.indexDate} does not match minutes-page date ${meetingDate}`,
      });
      return undefined;
    }
    const matchedCases = matchHistoricalDeepExpansionCases(cohort.cases, {
      session: link.session,
      meetingDate,
      html,
    });
    if (matchedCases.length === 0) return undefined;
    return collectHistoricalDeepExpansionSource({
      session: link.session,
      committeeId: link.committeeId,
      meetingId: link.meetingId,
      indexDate: link.indexDate,
      meetingDate,
      url: link.url,
      finalUrl: response.url,
      fetchedAt: new Date().toISOString(),
      httpStatus: response.status,
      contentType: response.contentType,
      bytes: response.bytes,
      matchedCases,
    });
  });
  const sources = fetched.filter((item): item is NonNullable<typeof item> => item !== undefined);
  if (sources.length === 0) {
    throw new Error('Archive enumeration found no exact pre-vote committee-minutes pages naming the frozen cohort bills');
  }

  const bundle = buildHistoricalDeepExpansionSourceBundle({
    cohort,
    codeSha,
    cohortHeadSha,
    cohortArtifactId,
    cohortArtifactDigest,
    committeeHomeIdsAttempted,
    committeesDiscovered,
    minuteLinksDiscovered: dedupedLinks.length,
    minutePagesEligibleByIndexDate: eligibleLinks.length,
    minutePagesFetched: eligibleLinks.length,
    sources,
    diagnostics: diagnostics.sort((left, right) => left.session.localeCompare(right.session)
      || left.committeeId.localeCompare(right.committeeId)
      || (left.meetingId ?? '').localeCompare(right.meetingId ?? '')),
  });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, { mode: 0o600 });

  console.log(JSON.stringify({
    outputPath,
    schemaVersion: bundle.schemaVersion,
    committeeHomeIdsAttempted,
    committeesBySession: Object.fromEntries(committeesBySession),
    summary: bundle.summary,
    cases: bundle.cases.map((item) => ({
      stableKey: item.stableKey,
      identifier: item.identifier,
      occurredOn: item.occurredOn,
      tranche: item.tranche,
      sourceCount: item.sourceIds.length,
    })),
    sources: bundle.sources.map((source) => ({
      id: source.id,
      publishedAt: source.publishedAt,
      matchedCases: source.matchedCases.map((item) => item.stableKey),
      sha256: source.contentSha256,
    })),
    diagnosticCount: bundle.diagnostics.length,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
