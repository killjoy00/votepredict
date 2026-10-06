import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchLrlLegislatorRefs, parseLrlMembershipDetails, type HistoricalMembershipRecord } from '../src/sources/minnesota/lrl-members.js';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';
import { fetchPublicPage } from '../src/evidence/public-http.js';
import { houseMemberNewsUrl, parseHouseMemberNewsArchiveEntries } from '../src/evidence/member-primary.js';

const ISSUE = 718;
const SESSION = '2025-2026';
const SOURCE_ARTIFACT_ID = 11438825044;
const SOURCE_ARTIFACT_DIGEST = 'sha256:d240cb90db62b1c1f86e81a36d09e4cf766186d0ba3570d83eeb6c6eaee8c8c2';
const EXPECTED_GAP_ROWS = 50117;
const EXPECTED_COVERED_ROWS = 3;
const EXPECTED_TARGET_EVENTS = 25;
const OUTPUT_FILE = 'historical-density-2025-house-member-primary-inventory-v1.json';
const CONCURRENCY = 8;

type GapEvent = {
  voteEventId: string;
  billId: string;
  identifier: string;
  occurredOn: string;
  chamber: string;
  uncoveredRows: number;
  uncoveredMemberships: number;
};

type GapArtifact = {
  schemaVersion: string;
  issue: number;
  source: {
    artifactId: number;
    artifactDigest: string;
    matrixGzipSha256: string;
    matrixCanonicalNdjsonSha256: string;
    targetRows: number;
    targetRowKeySha256: string;
  };
  summary: {
    combinedCoveredRows: number;
    combinedUncoveredRows: number;
    bySession: Record<string, {
      rows: number;
      coveredRows: number;
      uncoveredRows: number;
      uncoveredMemberships: number;
      uncoveredEvents: number;
      uncoveredBills: number;
      topUncoveredEvents: GapEvent[];
    }>;
  };
  policy: {
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    vercelUsed: boolean;
    targetVoteOutcomesRead: boolean;
    outcomeUse: string;
    applicabilityInferred: boolean;
    modelFitting: string;
    servingChanged: boolean;
  };
};

type MemberGroup = {
  lrlId: string;
  name: string;
  records: HistoricalMembershipRecord[];
  detailSourceUrls: string[];
  detailContentSha256: string[];
};

type InventoryEntry = {
  lrlId: string;
  memberName: string;
  districts: string[];
  parties: string[];
  archiveUrl: string;
  archiveIndexSha256: string;
  archiveIndexFetchedAt: string;
  articleUrl: string;
  articleTitle: string;
  publishedOn: string;
  titleMatchedTargetIdentifiers: string[];
  strictFutureTargetEvents: Array<{
    voteEventId: string;
    billId: string;
    identifier: string;
    occurredOn: string;
  }>;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
function activeOn(record: HistoricalMembershipRecord, date: string): boolean {
  const start = record.startsOn ?? '0000-00-00';
  const end = record.endsOn ?? '9999-99-99';
  return date >= start && date <= end;
}
function memberActiveOn(group: MemberGroup, date: string): boolean {
  return group.records.some((record) => activeOn(record, date));
}
function membershipForDate(group: MemberGroup, date: string): HistoricalMembershipRecord | undefined {
  const matches = group.records.filter((record) => activeOn(record, date));
  return matches.length === 1 ? matches[0] : undefined;
}
function exactTitleBillMentions(title: string, targetIdentifiers: ReadonlySet<string>): string[] {
  const found = new Set<string>();
  for (const match of title.matchAll(/\b(?:(HF|SF)|(H\s*\.?\s*F\s*\.?)|(S\s*\.?\s*F\s*\.?)|(House|Senate)\s+File)\s*(?:No\.?\s*)?(\d(?:\s*\d){0,5})\b/gi)) {
    const prefix = match[1]?.toUpperCase() === 'HF' || Boolean(match[2]) || match[4]?.toLowerCase() === 'house' ? 'HF' : 'SF';
    const identifier = `${prefix}${match[5].replace(/\s+/g, '')}`;
    if (targetIdentifiers.has(identifier)) found.add(identifier);
  }
  return [...found].sort();
}
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return output;
}
async function fetchWithRetry(url: string, userAgent: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetchPublicPage(url, {
        timeoutMs: 20_000,
        maxBytes: 3_000_000,
        userAgent,
      });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 750));
    }
  }
  throw lastError;
}

async function main(): Promise<void> {
  const gapPath = requiredEnv('VOTEPREDICT_HISTORICAL_DENSITY_CROSS_SESSION_GAP_PATH');
  const outputDir = requiredEnv('VOTEPREDICT_HISTORICAL_DENSITY_2025_HOUSE_INVENTORY_OUTPUT_DIR');
  const gap = JSON.parse(readFileSync(gapPath, 'utf8')) as GapArtifact;
  const sessionGap = gap.summary.bySession[SESSION];

  if (
    gap.schemaVersion !== 'historical-density-cross-session-gap-inventory-v1'
    || gap.issue !== ISSUE
    || !sessionGap
    || sessionGap.uncoveredRows !== EXPECTED_GAP_ROWS
    || sessionGap.coveredRows !== EXPECTED_COVERED_ROWS
    || gap.policy.productionDatabaseQueried
    || gap.policy.productionWrites
    || gap.policy.vercelUsed
    || gap.policy.targetVoteOutcomesRead
    || gap.policy.outcomeUse !== 'none'
    || gap.policy.applicabilityInferred
    || gap.policy.modelFitting !== 'none'
    || gap.policy.servingChanged
  ) throw new Error('Cross-session gap artifact identity or safety policy drifted');

  const targetEvents = sessionGap.topUncoveredEvents.map((event) => ({ ...event }));
  if (
    targetEvents.length !== EXPECTED_TARGET_EVENTS
    || targetEvents.some((event) => event.chamber !== 'house' || event.uncoveredRows !== 134)
  ) throw new Error('Expected 25 top uncovered 2025-26 House events with 134 uncovered rows each');

  const targetEventKeySha256 = sha256(
    `${targetEvents.map((event) => `${event.voteEventId}|${event.billId}|${event.identifier}|${event.occurredOn}`).sort().join('\n')}\n`,
  );
  const targetIdentifiers = new Set(targetEvents.map((event) => event.identifier));
  const maxTargetDate = [...targetEvents].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn)).at(-1)!.occurredOn;

  const session = getMinnesotaHouseSession(SESSION);
  const refs = await fetchLrlLegislatorRefs(session);
  if (refs.length < 190) throw new Error(`LRL returned only ${refs.length} legislator references`);

  const detailResults = await mapLimit(refs, CONCURRENCY, async (ref) => {
    const page = await fetchWithRetry(ref.sourceUrl, 'VotePredict/2.0 historical-density 2025 public roster inventory');
    const records = parseLrlMembershipDetails({
      html: page.rawContent,
      session,
      lrlId: ref.lrlId,
      fallbackName: ref.displayName,
      sourceUrl: ref.sourceUrl,
    });
    return {
      ref,
      records,
      contentSha256: page.contentSha256,
      fetchedAt: page.fetchedAt,
      canonicalUrl: page.canonicalUrl,
    };
  });

  const groups = new Map<string, MemberGroup>();
  for (const result of detailResults) {
    for (const record of result.records.filter((row) => row.chamber === 'house')) {
      const existing = groups.get(record.lrlId) ?? {
        lrlId: record.lrlId,
        name: record.name,
        records: [],
        detailSourceUrls: [],
        detailContentSha256: [],
      };
      if (existing.name !== record.name) throw new Error(`LRL name drift for ${record.lrlId}`);
      existing.records.push(record);
      existing.detailSourceUrls.push(result.canonicalUrl);
      existing.detailContentSha256.push(result.contentSha256);
      groups.set(record.lrlId, existing);
    }
  }

  const relevantGroups = [...groups.values()]
    .filter((group) => targetEvents.some((event) => memberActiveOn(group, event.occurredOn)))
    .sort((a, b) => Number(a.lrlId) - Number(b.lrlId));

  if (relevantGroups.length < 130) throw new Error(`Expected at least 130 relevant House members, got ${relevantGroups.length}`);

  const archiveResults = await mapLimit(relevantGroups, CONCURRENCY, async (group) => {
    const externalKey = `lrl:${group.lrlId}`;
    const archiveUrl = houseMemberNewsUrl(externalKey);
    if (!archiveUrl) throw new Error(`Missing House archive URL for ${externalKey}`);
    const page = await fetchWithRetry(archiveUrl, 'VotePredict/2.0 historical-density 2025 House archive inventory');
    const entries = parseHouseMemberNewsArchiveEntries(page, externalKey);
    const candidates: InventoryEntry[] = [];

    for (const entry of entries) {
      if (entry.publishedOn > maxTargetDate) continue;
      const membership = membershipForDate(group, entry.publishedOn);
      if (!membership) continue;

      const strictFutureTargetEvents = targetEvents
        .filter((event) => entry.publishedOn < event.occurredOn && memberActiveOn(group, event.occurredOn))
        .map((event) => ({
          voteEventId: event.voteEventId,
          billId: event.billId,
          identifier: event.identifier,
          occurredOn: event.occurredOn,
        }));
      if (strictFutureTargetEvents.length === 0) continue;

      candidates.push({
        lrlId: group.lrlId,
        memberName: group.name,
        districts: unique(group.records.map((record) => record.district)).sort(),
        parties: unique(group.records.map((record) => record.party)).sort(),
        archiveUrl: page.canonicalUrl,
        archiveIndexSha256: page.contentSha256,
        archiveIndexFetchedAt: page.fetchedAt,
        articleUrl: entry.url,
        articleTitle: entry.title,
        publishedOn: entry.publishedOn,
        titleMatchedTargetIdentifiers: exactTitleBillMentions(entry.title, targetIdentifiers),
        strictFutureTargetEvents,
      });
    }

    return {
      lrlId: group.lrlId,
      memberName: group.name,
      archiveUrl: page.canonicalUrl,
      archiveIndexSha256: page.contentSha256,
      archiveIndexFetchedAt: page.fetchedAt,
      archiveEntries: entries.length,
      strictPreVoteEntries: candidates.length,
      candidates,
    };
  });

  const sourceEntries = archiveResults
    .flatMap((result) => result.candidates)
    .sort((a, b) =>
      b.titleMatchedTargetIdentifiers.length - a.titleMatchedTargetIdentifiers.length
      || b.strictFutureTargetEvents.length - a.strictFutureTargetEvents.length
      || b.publishedOn.localeCompare(a.publishedOn)
      || a.lrlId.localeCompare(b.lrlId)
      || a.articleUrl.localeCompare(b.articleUrl)
    );

  const rosterKeys = relevantGroups.flatMap((group) => group.records.map((record) =>
    `${group.lrlId}|${record.name}|${record.chamber}|${record.district}|${record.party}|${record.startsOn ?? ''}|${record.endsOn ?? ''}`
  ));
  const sourceKeys = sourceEntries.map((entry) =>
    `${entry.lrlId}|${entry.articleUrl}|${entry.publishedOn}|${entry.strictFutureTargetEvents.map((event) => event.voteEventId).sort().join(',')}`
  );
  const titleMatchedEntries = sourceEntries.filter((entry) => entry.titleMatchedTargetIdentifiers.length > 0);

  const report = {
    schemaVersion: 'historical-density-2025-house-member-primary-inventory-v1',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    session: SESSION,
    sourceGapArtifact: {
      artifactId: SOURCE_ARTIFACT_ID,
      artifactDigest: SOURCE_ARTIFACT_DIGEST,
      schemaVersion: gap.schemaVersion,
      matrixGzipSha256: gap.source.matrixGzipSha256,
      matrixCanonicalNdjsonSha256: gap.source.matrixCanonicalNdjsonSha256,
      targetRowKeySha256: gap.source.targetRowKeySha256,
    },
    target: {
      basis: 'top 25 frozen uncovered 2025-26 House vote events from the canonical cross-session gap artifact',
      events: targetEvents,
      targetEventKeySha256,
      identifiers: [...targetIdentifiers].sort(),
      maxTargetDate,
      sameDayEligible: false,
    },
    publicRoster: {
      authority: 'Minnesota Legislative Reference Library',
      sessionSearchUrl: `https://www.lrl.mn.gov/legdb/results?body=Both&gender=&q=&search=session&sess=${session.legislature}`,
      legislatorRefs: refs.length,
      relevantHouseMembers: relevantGroups.length,
      relevantHouseMembershipRecords: relevantGroups.reduce((sum, group) => sum + group.records.length, 0),
      rosterKeySha256: sha256(`${rosterKeys.sort().join('\n')}\n`),
      detailContentSha256: unique(relevantGroups.flatMap((group) => group.detailContentSha256)).sort(),
    },
    archiveInventory: {
      membersAttempted: archiveResults.length,
      membersSucceeded: archiveResults.length,
      archiveEntries: archiveResults.reduce((sum, row) => sum + row.archiveEntries, 0),
      strictPreVoteSourceEntries: sourceEntries.length,
      membersWithStrictPreVoteSourceEntries: new Set(sourceEntries.map((entry) => entry.lrlId)).size,
      titleMatchedTargetEntries: titleMatchedEntries.length,
      titleMatchedTargetIdentifiers: unique(titleMatchedEntries.flatMap((entry) => entry.titleMatchedTargetIdentifiers)).sort(),
      sourceKeySha256: sha256(`${sourceKeys.sort().join('\n')}\n`),
      byMember: archiveResults.map(({ candidates: _candidates, ...row }) => row),
      sourceEntries,
    },
    policy: {
      readOnly: true,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      targetVoteOutcomesRead: false,
      outcomeUse: 'none',
      archiveIndexesFetched: true,
      articleBodiesFetched: false,
      sourceDiscoveryLimitedToOfficialLrlAndHouseMemberArchive: true,
      exactBillLinkageInferredFromMemberIssueEvidence: false,
      titleBillMatchingIsMetadataOnly: true,
      applicabilityInferred: false,
      sameDayEligible: false,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      modelFitting: 'none',
      servingChanged: false,
      nextStepBoundary: 'Freeze a bounded article-body cohort from these official source entries before any body fetch or semantic extraction. Exact title matches may prioritize review but do not establish stance or applicability.',
    },
  };

  if (report.archiveInventory.strictPreVoteSourceEntries === 0) throw new Error('No strict-pre-vote House member-primary source entries found');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, OUTPUT_FILE), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    historicalDensity2025HouseMemberPrimaryInventory: {
      targetEvents: targetEvents.length,
      relevantHouseMembers: report.publicRoster.relevantHouseMembers,
      archiveEntries: report.archiveInventory.archiveEntries,
      strictPreVoteSourceEntries: report.archiveInventory.strictPreVoteSourceEntries,
      membersWithStrictPreVoteSourceEntries: report.archiveInventory.membersWithStrictPreVoteSourceEntries,
      titleMatchedTargetEntries: report.archiveInventory.titleMatchedTargetEntries,
      titleMatchedTargetIdentifiers: report.archiveInventory.titleMatchedTargetIdentifiers,
      outcomeUse: 'none',
      productionDatabaseQueried: false,
      vercelUsed: false,
      articleBodiesFetched: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
