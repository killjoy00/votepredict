import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  parseHistoricalDeepCommitteeHome,
  parseHistoricalDeepMinuteDate,
  type HistoricalDeepCommitteeMinuteLink,
} from '../src/evaluation/historical-deep-expansion-source-bundle.js';
import {
  FROZEN_LIFECYCLE_P3_CONTENT_SHA256,
  LIFECYCLE_P5_HOUSE_ADJOURNMENT,
  LIFECYCLE_P5_HOUSE_COMMITTEE_PLAN_VERSION,
  LIFECYCLE_P5_HOUSE_COMMITTEE_SOURCE_SCHEMA,
  matchFullUniverseHouseBills,
  type LifecycleP5HouseCommitteeManifest,
  type LifecycleP5HouseCommitteeSource,
  type LifecycleP5HouseCommitteeSourceBundle,
  type LifecycleP5HouseCommitteeSourceDiagnostic,
} from '../src/evaluation/lifecycle-p5-house-committee.js';

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
  { session: '2025-2026', committeeIdStart: 94001, committeeIdEnd: 94099 },
];
const USER_AGENT = 'VotePredict/2.0 lifecycle-p5-house-committee';
const CONCURRENCY = 8;
const DEFAULT_OUTPUT = 'artifacts/lifecycle-p5-house-committee-sources-v1.json';

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

function validateSourceIdentity(input: {
  committeeId: string;
  meetingId: string;
  finalUrl: string;
  bytes: Buffer;
}): void {
  if (input.bytes.length === 0 || input.bytes.length > 5_000_000) {
    throw new Error(
      `Lifecycle P5 minute ${input.committeeId}/${input.meetingId} has invalid byte length ${input.bytes.length}`,
    );
  }
  const finalUrl = new URL(input.finalUrl);
  if (!['house.mn.gov', 'www.house.mn.gov'].includes(finalUrl.hostname.toLowerCase())) {
    throw new Error(`Lifecycle P5 minute redirected to unapproved host ${finalUrl.hostname}`);
  }
  const canonical = finalUrl.pathname.match(/^\/committees\/minutes\/(\d+)\/(\d+)\/?$/i);
  if (!canonical || canonical[1] !== input.committeeId || canonical[2] !== input.meetingId) {
    throw new Error(`Lifecycle P5 minute redirected away from exact identity: ${input.finalUrl}`);
  }
}

async function main(): Promise<void> {
  const manifestPath = resolve(requiredArgument('--manifest'));
  const outputPath = resolve(argumentValue('--output') ?? DEFAULT_OUTPUT);
  const codeSha = argumentValue('--code-sha') ?? process.env.GITHUB_SHA ?? null;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as LifecycleP5HouseCommitteeManifest;
  if (manifest.schemaVersion !== 'lifecycle-p5-house-committee-manifest-v1') {
    throw new Error(`Unexpected Lifecycle P5 House manifest schema: ${String(manifest.schemaVersion)}`);
  }
  if (manifest.planVersion !== LIFECYCLE_P5_HOUSE_COMMITTEE_PLAN_VERSION) {
    throw new Error(`Unexpected Lifecycle P5 plan: ${String(manifest.planVersion)}`);
  }
  if (manifest.frozenP3ContentSha256 !== FROZEN_LIFECYCLE_P3_CONTENT_SHA256) {
    throw new Error('Lifecycle P5 manifest does not reference the frozen P3 content hash');
  }
  if (manifest.metadata.selectionUsesFloorAccessOrOutcome !== false) {
    throw new Error('Lifecycle P5 House source collection requires a full-universe outcome-blind manifest');
  }

  const diagnostics: LifecycleP5HouseCommitteeSourceDiagnostic[] = [];
  const minuteLinks: Array<HistoricalDeepCommitteeMinuteLink & { session: string }> = [];
  let committeeHomeIdsAttempted = 0;
  let committeesDiscovered = 0;

  for (const config of SESSION_ARCHIVES) {
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
      const parsed = parseHistoricalDeepCommitteeHome(
        response.bytes.toString('utf8'),
        config.session,
        committeeId,
      );
      if (!parsed.sessionMatched) return [];
      return parsed.links.map((link) => ({ ...link, session: config.session }));
    });
    const sessionLinks = discovered.flat();
    const committeeCount = new Set(sessionLinks.map((item) => item.committeeId)).size;
    if (committeeCount < 8) {
      throw new Error(
        `Lifecycle P5 archive enumeration found only ${committeeCount} committees for ${config.session}`,
      );
    }
    committeesDiscovered += committeeCount;
    minuteLinks.push(...sessionLinks);
  }

  const dedupedLinks = [...new Map(
    minuteLinks.map((item) => [`${item.session}|${item.committeeId}|${item.meetingId}`, item] as const),
  ).values()].sort((left, right) =>
    left.session.localeCompare(right.session)
    || left.indexDate.localeCompare(right.indexDate)
    || left.committeeId.localeCompare(right.committeeId)
    || Number(left.meetingId) - Number(right.meetingId));

  if (dedupedLinks.length < 100) {
    throw new Error(`Lifecycle P5 archive enumeration found only ${dedupedLinks.length} minute links`);
  }

  const eligibleLinks = dedupedLinks.filter((item) => {
    const adjournment = LIFECYCLE_P5_HOUSE_ADJOURNMENT[item.session];
    if (!adjournment) throw new Error(`Missing lifecycle P5 adjournment for ${item.session}`);
    return item.indexDate <= adjournment;
  });

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
    const matchedBills = matchFullUniverseHouseBills(manifest.bills, {
      session: link.session,
      meetingDate,
      html,
    });
    if (matchedBills.length === 0) return undefined;
    validateSourceIdentity({
      committeeId: link.committeeId,
      meetingId: link.meetingId,
      finalUrl: response.url,
      bytes: response.bytes,
    });
    return {
      id: `house-minutes-${link.committeeId}-${link.meetingId}`,
      session: link.session,
      committeeId: link.committeeId,
      meetingId: link.meetingId,
      publishedOn: meetingDate,
      url: link.url,
      finalUrl: response.url,
      fetchedAt: new Date().toISOString(),
      contentSha256: createHash('sha256').update(response.bytes).digest('hex'),
      byteLength: response.bytes.length,
      matchedBills,
      content: html,
    } satisfies LifecycleP5HouseCommitteeSource;
  });

  const sources = fetched.filter((item): item is LifecycleP5HouseCommitteeSource => item !== undefined);
  if (sources.length === 0) throw new Error('Lifecycle P5 found no full-universe House committee-minute matches');

  const billIdsWithSource = new Set(sources.flatMap((source) => source.matchedBills.map((bill) => bill.billId)));
  const bySession = Object.fromEntries(
    Object.keys(LIFECYCLE_P5_HOUSE_ADJOURNMENT).sort().map((session) => [
      session,
      new Set(
        sources
          .filter((source) => source.session === session)
          .flatMap((source) => source.matchedBills.map((bill) => bill.billId)),
      ).size,
    ]),
  );

  const bundle: LifecycleP5HouseCommitteeSourceBundle = {
    schemaVersion: LIFECYCLE_P5_HOUSE_COMMITTEE_SOURCE_SCHEMA,
    planVersion: LIFECYCLE_P5_HOUSE_COMMITTEE_PLAN_VERSION,
    generatedAt: new Date().toISOString(),
    codeSha,
    manifestGeneratedAt: manifest.generatedAt,
    frozenP3ContentSha256: FROZEN_LIFECYCLE_P3_CONTENT_SHA256,
    summary: {
      manifestBills: manifest.bills.length,
      committeeHomeIdsAttempted,
      committeesDiscovered,
      minuteLinksDiscovered: dedupedLinks.length,
      minutePagesEligibleByIndexDate: eligibleLinks.length,
      minutePagesFetched: eligibleLinks.length,
      matchedSourcePages: sources.length,
      billSourceMatches: sources.reduce((sum, source) => sum + source.matchedBills.length, 0),
      billsWithAnySource: billIdsWithSource.size,
      billsWithoutSource: manifest.bills.length - billIdsWithSource.size,
      billsWithAnySourceBySession: bySession,
    },
    sources: sources.sort((left, right) =>
      left.session.localeCompare(right.session)
      || left.publishedOn.localeCompare(right.publishedOn)
      || left.id.localeCompare(right.id)),
    diagnostics: diagnostics.sort((left, right) =>
      left.session.localeCompare(right.session)
      || left.committeeId.localeCompare(right.committeeId)
      || (left.meetingId ?? '').localeCompare(right.meetingId ?? '')),
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    lifecycleP5HouseCommitteeSources: {
      outputPath,
      schemaVersion: bundle.schemaVersion,
      summary: bundle.summary,
      diagnostics: bundle.diagnostics.length,
    },
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
