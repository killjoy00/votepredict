import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { HistoricalDeepHouseJournalHoldoutCohort } from '../src/evaluation/historical-deep-house-journal-holdout-cohort';
import { buildHistoricalDeepHouseJournalHoldoutSourceBundle } from '../src/evaluation/historical-deep-house-journal-holdout-source-bundle';
import {
  collectHistoricalDeepHouseJournalSource,
  matchHistoricalDeepHouseJournalCases,
  parseHistoricalDeepHouseJournalDate,
  parseHistoricalDeepHouseJournalIndex,
  type HistoricalDeepHouseJournalCollectedSource,
  type HistoricalDeepHouseJournalSourceDiagnostic,
} from '../src/evaluation/historical-deep-house-journal-source-bundle';

interface FetchResult {
  status: number;
  url: string;
  contentType: string;
  bytes: Buffer;
}

const SESSION = '2025-2026';
const SESSION_INDEX_URL = 'https://www.house.mn.gov/Journals';
const USER_AGENT = 'VotePredict/2.0 historical-deep-house-journal-holdout-source-collector';
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
        throw new Error(`official House Journal source returned HTTP ${response.status}`);
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

function latestVoteDate(cohort: HistoricalDeepHouseJournalHoldoutCohort): string {
  const dates = cohort.cases.map((item) => item.occurredOn).sort();
  const latest = dates.at(-1);
  if (!latest) throw new Error('Frozen House Journal holdout cohort has no cases');
  return latest;
}

async function main(): Promise<void> {
  const cohortPath = resolve(requiredArgument('--cohort'));
  const outputPath = resolve(
    argumentValue('--output')
      ?? process.env.VOTEPREDICT_DEEP_HOUSE_JOURNAL_HOLDOUT_SOURCE_OUTPUT
      ?? 'artifacts/historical-deep-house-journal-holdout-source-bundle-v1.json',
  );
  const cohortHeadSha = requiredArgument('--cohort-head-sha');
  const cohortArtifactId = positiveInteger(requiredArgument('--cohort-artifact-id'), '--cohort-artifact-id');
  const cohortArtifactDigest = requiredArgument('--cohort-artifact-digest');
  const codeSha = argumentValue('--code-sha') ?? process.env.GITHUB_SHA ?? null;
  const cohort = JSON.parse(readFileSync(cohortPath, 'utf8')) as HistoricalDeepHouseJournalHoldoutCohort;

  if (cohort.schemaVersion !== 'historical-deep-house-journal-holdout-cohort-v1') {
    throw new Error(`Unexpected House Journal holdout cohort schema ${String(cohort.schemaVersion)}`);
  }
  if (!Array.isArray(cohort.cases) || cohort.cases.length !== 24) {
    throw new Error(`Expected the frozen 24-case House Journal holdout cohort, got ${cohort.cases?.length ?? 'unknown'}`);
  }
  if (cohort.metadata.chamber !== 'house') throw new Error('House Journal holdout collector requires a House cohort');
  if (cohort.cases.some((item) => item.session !== SESSION || item.chamber !== 'house')) {
    throw new Error('House Journal holdout collector accepts only the frozen 2025-2026 House cohort');
  }

  const diagnostics: HistoricalDeepHouseJournalSourceDiagnostic[] = [];
  const indexResponse = await fetchOfficialHtml(SESSION_INDEX_URL);
  if (!indexResponse || indexResponse.status < 200 || indexResponse.status >= 300 || !/text\/html/i.test(indexResponse.contentType)) {
    diagnostics.push({
      type: 'archive_index_unavailable',
      session: SESSION,
      url: SESSION_INDEX_URL,
      detail: `Current-session Journal index returned HTTP ${indexResponse?.status ?? 'unavailable'} / ${indexResponse?.contentType || 'unknown content type'}`,
      httpStatus: indexResponse?.status,
    });
    throw new Error(`Unable to prove House Journal current-session index for ${SESSION}`);
  }
  const finalIndexUrl = new URL(indexResponse.url);
  if (!['house.mn.gov', 'www.house.mn.gov'].includes(finalIndexUrl.hostname.toLowerCase()) || !/^\/journals\/?$/i.test(finalIndexUrl.pathname)) {
    throw new Error(`House Journal current-session index redirected away from the approved endpoint: ${indexResponse.url}`);
  }

  const parsed = parseHistoricalDeepHouseJournalIndex(indexResponse.bytes.toString('utf8'), SESSION);
  if (!parsed.sessionMatched) {
    diagnostics.push({
      type: 'archive_index_session_mismatch',
      session: SESSION,
      url: SESSION_INDEX_URL,
      detail: `Current-session Journal index did not prove the expected ${SESSION} regular session`,
    });
    throw new Error(`House Journal current-session index mismatch for ${SESSION}`);
  }

  const links = [...new Map(parsed.links.map((link) => [link.url, link] as const)).values()]
    .sort((left, right) => left.journalDate.localeCompare(right.journalDate)
      || left.legislativeDay - right.legislativeDay
      || left.fileName.localeCompare(right.fileName));
  if (links.length < 40) {
    throw new Error(`House Journal current-session index exposed only ${links.length} HTML Journal links for ${SESSION}; refusing incomplete enumeration`);
  }

  const cutoff = latestVoteDate(cohort);
  const eligibleLinks = links.filter((link) => link.journalDate < cutoff);
  if (eligibleLinks.length < 30) {
    throw new Error(`House Journal current-session index exposed only ${eligibleLinks.length} pre-cutoff Journal links; refusing incomplete enumeration`);
  }

  let journalPagesFetched = 0;
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
    journalPagesFetched += 1;
    const html = response.bytes.toString('utf8');
    const pageDate = parseHistoricalDeepHouseJournalDate(html);
    if (!pageDate) {
      diagnostics.push({
        type: 'journal_date_unresolved',
        session: link.session,
        url: link.url,
        journalDate: link.journalDate,
        legislativeDay: link.legislativeDay,
        detail: 'Could not prove Journal date from the exact official House Journal page',
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
        detail: `Journal index date ${link.journalDate} does not match exact page date ${pageDate}`,
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
    throw new Error('House Journal current-session enumeration found no exact pre-vote pages naming the frozen holdout bills');
  }

  const bundle = buildHistoricalDeepHouseJournalHoldoutSourceBundle({
    cohort,
    codeSha,
    cohortHeadSha,
    cohortArtifactId,
    cohortArtifactDigest,
    sessionIndexUrl: SESSION_INDEX_URL,
    sessionIndexesAttempted: 1,
    journalLinksDiscovered: links.length,
    journalPagesEligibleByIndexDate: eligibleLinks.length,
    journalPagesFetched,
    sources,
    diagnostics,
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
