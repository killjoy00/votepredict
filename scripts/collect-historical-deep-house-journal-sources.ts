import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { HistoricalDeepExpansionCohort } from '../src/evaluation/historical-deep-expansion-cohort';
import {
  buildHistoricalDeepHouseJournalSourceBundle,
  collectHistoricalDeepHouseJournalSource,
  matchHistoricalDeepHouseJournalCases,
  parseHistoricalDeepHouseJournalDate,
  parseHistoricalDeepHouseJournalIndex,
  type HistoricalDeepHouseJournalCollectedSource,
  type HistoricalDeepHouseJournalLink,
  type HistoricalDeepHouseJournalSourceDiagnostic,
} from '../src/evaluation/historical-deep-house-journal-source-bundle';

interface SessionArchiveConfig {
  session: string;
  archiveId: number;
}

interface FetchResult {
  status: number;
  url: string;
  contentType: string;
  bytes: Buffer;
}

const SESSION_ARCHIVES: readonly SessionArchiveConfig[] = [
  { session: '2021-2022', archiveId: 257 },
  { session: '2023-2024', archiveId: 300 },
];
const USER_AGENT = 'VotePredict/2.0 historical-deep-house-journal-archive-collector';
const CONCURRENCY = 6;

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
      ?? process.env.VOTEPREDICT_DEEP_HOUSE_JOURNAL_SOURCE_OUTPUT
      ?? 'artifacts/historical-deep-house-journal-source-bundle.json',
  );
  const cohortHeadSha = requiredArgument('--cohort-head-sha');
  const cohortArtifactId = positiveInteger(requiredArgument('--cohort-artifact-id'), '--cohort-artifact-id');
  const cohortArtifactDigest = requiredArgument('--cohort-artifact-digest');
  const codeSha = argumentValue('--code-sha') ?? process.env.GITHUB_SHA ?? null;
  const cohort = JSON.parse(readFileSync(cohortPath, 'utf8')) as HistoricalDeepExpansionCohort;
  if (!Array.isArray(cohort.cases) || cohort.cases.length !== 24) {
    throw new Error(`Expected the frozen 24-event expansion cohort, got ${cohort.cases?.length ?? 'unknown'}`);
  }
  if (cohort.metadata.chamber !== 'house') throw new Error('House Journal collector requires a House evaluation cohort');

  const diagnostics: HistoricalDeepHouseJournalSourceDiagnostic[] = [];
  const links: HistoricalDeepHouseJournalLink[] = [];
  let archiveIndexesAttempted = 0;

  for (const config of SESSION_ARCHIVES) {
    if (!cohort.cases.some((item) => item.session === config.session)) continue;
    archiveIndexesAttempted += 1;
    const archiveUrl = `https://www.house.mn.gov/Journals/${config.archiveId}`;
    const response = await fetchOfficialHtml(archiveUrl);
    if (!response || response.status < 200 || response.status >= 300 || !/text\/html/i.test(response.contentType)) {
      diagnostics.push({
        type: 'archive_index_unavailable',
        session: config.session,
        url: archiveUrl,
        detail: `Journal archive index returned HTTP ${response?.status ?? 'unavailable'} / ${response?.contentType || 'unknown content type'}`,
        httpStatus: response?.status,
      });
      throw new Error(`Unable to prove House Journal archive index for ${config.session}`);
    }
    const parsed = parseHistoricalDeepHouseJournalIndex(response.bytes.toString('utf8'), config.session);
    if (!parsed.sessionMatched) {
      diagnostics.push({
        type: 'archive_index_session_mismatch',
        session: config.session,
        url: archiveUrl,
        detail: `Journal archive index did not prove the expected ${config.session} regular session`,
      });
      throw new Error(`House Journal archive session mismatch for ${config.session}`);
    }
    if (parsed.links.length < 40) {
      throw new Error(`House Journal archive exposed only ${parsed.links.length} HTML journal links for ${config.session}; refusing incomplete enumeration`);
    }
    links.push(...parsed.links);
  }

  const dedupedLinks = [...new Map(links.map((link) => [link.url, link] as const)).values()]
    .sort((left, right) => left.session.localeCompare(right.session)
      || left.journalDate.localeCompare(right.journalDate)
      || left.legislativeDay - right.legislativeDay);
  if (dedupedLinks.length < 100) {
    throw new Error(`House Journal archive enumeration found only ${dedupedLinks.length} links; refusing incomplete discovery`);
  }

  const eligibleLinks = dedupedLinks.filter((link) => link.journalDate < latestVoteDate(cohort, link.session));
  const fetched = await mapConcurrent(eligibleLinks, CONCURRENCY, async (link) => {
    const response = await fetchOfficialHtml(link.url, true);
    if (!response) {
      diagnostics.push({
        type: 'journal_unavailable',
        session: link.session,
        url: link.url,
        journalDate: link.journalDate,
        legislativeDay: link.legislativeDay,
        detail: 'Exact House Journal HTML URL returned HTTP 404',
        httpStatus: 404,
      });
      return undefined;
    }
    if (response.status < 200 || response.status >= 300 || !/text\/html/i.test(response.contentType)) {
      diagnostics.push({
        type: 'journal_unavailable',
        session: link.session,
        url: link.url,
        journalDate: link.journalDate,
        legislativeDay: link.legislativeDay,
        detail: `Exact House Journal HTML URL returned HTTP ${response.status} / ${response.contentType || 'unknown content type'}`,
        httpStatus: response.status,
      });
      return undefined;
    }
    const html = response.bytes.toString('utf8');
    const pageDate = parseHistoricalDeepHouseJournalDate(html);
    if (!pageDate) {
      diagnostics.push({
        type: 'journal_date_unresolved',
        session: link.session,
        url: link.url,
        journalDate: link.journalDate,
        legislativeDay: link.legislativeDay,
        detail: 'Could not prove journal date from exact official House Journal page',
      });
      return undefined;
    }
    if (pageDate !== link.journalDate) {
      diagnostics.push({
        type: 'journal_index_date_mismatch',
        session: link.session,
        url: link.url,
        journalDate: link.journalDate,
        legislativeDay: link.legislativeDay,
        detail: `Journal archive date ${link.journalDate} does not match page date ${pageDate}`,
      });
      return undefined;
    }
    const matchedCases = matchHistoricalDeepHouseJournalCases(cohort.cases, {
      session: link.session,
      journalDate: link.journalDate,
      html,
    });
    if (matchedCases.length === 0) return undefined;
    return collectHistoricalDeepHouseJournalSource({
      session: link.session,
      journalDate: link.journalDate,
      legislativeDay: link.legislativeDay,
      url: link.url,
      finalUrl: response.url,
      fetchedAt: new Date().toISOString(),
      httpStatus: response.status,
      contentType: response.contentType,
      bytes: response.bytes,
      matchedCases,
    });
  });
  const sources = fetched.filter((item): item is HistoricalDeepHouseJournalCollectedSource => item !== undefined);
  if (sources.length === 0) {
    throw new Error('House Journal archive enumeration found no exact pre-vote pages naming the frozen development-cohort bills');
  }

  const bundle = buildHistoricalDeepHouseJournalSourceBundle({
    cohort,
    codeSha,
    cohortHeadSha,
    cohortArtifactId,
    cohortArtifactDigest,
    archiveIndexesAttempted,
    journalLinksDiscovered: dedupedLinks.length,
    journalPagesEligibleByIndexDate: eligibleLinks.length,
    journalPagesFetched: eligibleLinks.length,
    sources,
    diagnostics: diagnostics.sort((left, right) => left.session.localeCompare(right.session)
      || (left.journalDate ?? '').localeCompare(right.journalDate ?? '')
      || left.url.localeCompare(right.url)),
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    outputPath,
    schemaVersion: bundle.schemaVersion,
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
      journalDate: source.journalDate,
      legislativeDay: source.legislativeDay,
      matchedCases: source.matchedCases.map((item) => item.stableKey),
      sha256: source.contentSha256,
    })),
    diagnosticCount: bundle.diagnostics.length,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
