import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  discoverHouseVoteBillLinks,
  fetchHouseVoteDetail,
  fetchHouseVoteSummary,
  parseHouseVoteDetailHtml,
} from '../src/sources/minnesota/house-votes.js';
import {
  fetchRevisorBill,
  fetchRevisorBillVersion,
  type RevisorBillMetadata,
  type RevisorBillVersionMetadata,
} from '../src/sources/minnesota/revisor.js';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';

const SESSION = '2025-2026';
const MATRIX_ARTIFACT_ID = 11436413885;
const MATRIX_ARTIFACT_DIGEST =
  'sha256:fc1d77ccc51bc33f3e3f1c0dd6622c0f2a9797d62a8d54bcb65906de30228e44';
const MATRIX_GZIP_SHA256 =
  'cc99480e9437fff9a09d7947b4e8728f872822cc86cf00d8edb8ecb925650664';
const MATRIX_CANONICAL_SHA256 =
  'd681f257cdcded0d2cbebd68a93ea7edcab524863a68061a8059eca84963923a';
const EXPECTED_MATRIX_ROWS = 135457;
const EXPECTED_MATRIX_EVENT_COUNT = 1339;
const EXPECTED_2025_HOUSE_MATRIX_EVENTS = 264;

type ParsedEvent = ReturnType<typeof parseHouseVoteDetailHtml>[number];

type RevisorSourceResult = {
  identifier: string;
  occurredOn: string;
  status:
    | 'verified'
    | 'no_strict_prevote_version'
    | 'status_fetch_failed'
    | 'version_fetch_failed'
    | 'version_too_short';
  versionPostedOn?: string;
  versionKey?: string;
  versionTextSha256?: string;
  error?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function anyNonzero(value: unknown): boolean {
  return Array.isArray(value)
    && value.some((item) => typeof item === 'number' && Math.abs(item) > 1e-12);
}

function countBy<T extends string>(values: readonly T[]): Record<T, number> {
  const result = {} as Record<T, number>;
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function selectStrictPreVoteVersion(
  metadata: RevisorBillMetadata,
  occurredOn: string,
): RevisorBillVersionMetadata | undefined {
  return [...metadata.versions]
    .filter((version) => version.postedOn < occurredOn)
    .sort((a, b) =>
      b.postedOn.localeCompare(a.postedOn) || b.ordinal - a.ordinal,
    )[0];
}

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (attempt < attempts) {
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, 650 * attempt),
        );
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

async function mapLimit<T, R>(
  values: readonly T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]!, index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return results;
}

function compositeKey(identifier: string, occurredOn: string): string {
  return `${identifier}|${occurredOn}`;
}

function multiplicities(keys: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const key of keys) result.set(key, (result.get(key) ?? 0) + 1);
  return result;
}

function compareMultiplicities(
  officialKeys: readonly string[],
  matrixKeys: readonly string[],
) {
  const official = multiplicities(officialKeys);
  const matrix = multiplicities(matrixKeys);
  const keys = [...new Set([...official.keys(), ...matrix.keys()])].sort();
  let matchedEvents = 0;
  let officialOutsideMatrix = 0;
  let matrixWithoutOfficial = 0;
  const mismatches: Array<{
    compositeKey: string;
    officialEvents: number;
    matrixEvents: number;
  }> = [];
  for (const key of keys) {
    const officialCount = official.get(key) ?? 0;
    const matrixCount = matrix.get(key) ?? 0;
    matchedEvents += Math.min(officialCount, matrixCount);
    officialOutsideMatrix += Math.max(0, officialCount - matrixCount);
    matrixWithoutOfficial += Math.max(0, matrixCount - officialCount);
    if (officialCount !== matrixCount) {
      mismatches.push({
        compositeKey: key,
        officialEvents: officialCount,
        matrixEvents: matrixCount,
      });
    }
  }
  return {
    matchedEvents,
    officialOutsideMatrix,
    matrixWithoutOfficial,
    exactMultiplicityParity:
      officialOutsideMatrix === 0 && matrixWithoutOfficial === 0,
    mismatchGroups: mismatches,
  };
}

async function verifyStrictPreVoteText(
  events: readonly ParsedEvent[],
): Promise<RevisorSourceResult[]> {
  const statusCache = new Map<string, Promise<RevisorBillMetadata>>();
  const versionCache = new Map<
    string,
    Promise<Awaited<ReturnType<typeof fetchRevisorBillVersion>>>
  >();

  return mapLimit(events, 4, async (event) => {
    let metadata: RevisorBillMetadata;
    try {
      let pending = statusCache.get(event.billIdentifier);
      if (!pending) {
        pending = retry(() =>
          fetchRevisorBill(SESSION, event.billIdentifier, false)
        );
        statusCache.set(event.billIdentifier, pending);
      }
      metadata = await pending;
    } catch (error) {
      return {
        identifier: event.billIdentifier,
        occurredOn: event.occurredOn,
        status: 'status_fetch_failed',
        error: safeMessage(error),
      };
    }

    const selected = selectStrictPreVoteVersion(metadata, event.occurredOn);
    if (!selected) {
      return {
        identifier: event.billIdentifier,
        occurredOn: event.occurredOn,
        status: 'no_strict_prevote_version',
      };
    }

    try {
      let pending = versionCache.get(selected.textUrl);
      if (!pending) {
        pending = retry(() => fetchRevisorBillVersion(selected));
        versionCache.set(selected.textUrl, pending);
      }
      const version = await pending;
      if (version.text.length < 100) {
        return {
          identifier: event.billIdentifier,
          occurredOn: event.occurredOn,
          status: 'version_too_short',
          versionPostedOn: version.postedOn,
          versionKey: version.versionKey,
          versionTextSha256: version.textSha256,
        };
      }
      return {
        identifier: event.billIdentifier,
        occurredOn: event.occurredOn,
        status: 'verified',
        versionPostedOn: version.postedOn,
        versionKey: version.versionKey,
        versionTextSha256: version.textSha256,
      };
    } catch (error) {
      return {
        identifier: event.billIdentifier,
        occurredOn: event.occurredOn,
        status: 'version_fetch_failed',
        error: safeMessage(error),
      };
    }
  });
}

async function main(): Promise<void> {
  const matrixPath = resolve(requiredEnv('VOTEPREDICT_EQ_V17_MATRIX_PATH'));
  const outputPath = resolve(
    requiredEnv('VOTEPREDICT_2025_HOUSE_VOTE_UNIVERSE_AUDIT_OUTPUT'),
  );

  const gzipBytes = readFileSync(matrixPath);
  if (sha256(gzipBytes) !== MATRIX_GZIP_SHA256) {
    throw new Error('v1.7 matrix gzip identity drifted');
  }
  const canonical = gunzipSync(gzipBytes).toString('utf8');
  if (sha256(canonical) !== MATRIX_CANONICAL_SHA256) {
    throw new Error('v1.7 matrix canonical identity drifted');
  }

  const matrixEvents = new Map<string, {
    identifier: string;
    occurredOn: string;
    rows: number;
    coveredRows: number;
    uncoveredRows: number;
  }>();
  let matrixRows = 0;
  for (const line of canonical.trimEnd().split('\n')) {
    const row = JSON.parse(line) as Record<string, unknown>;
    matrixRows += 1;
    if (row.session !== SESSION || row.chamber !== 'house') continue;
    const voteEventId = String(row.voteEventId);
    const existing = matrixEvents.get(voteEventId) ?? {
      identifier: String(row.identifier),
      occurredOn: String(row.occurredOn),
      rows: 0,
      coveredRows: 0,
      uncoveredRows: 0,
    };
    if (
      existing.identifier !== String(row.identifier)
      || existing.occurredOn !== String(row.occurredOn)
    ) {
      throw new Error(`Matrix event identity drifted for ${voteEventId}`);
    }
    existing.rows += 1;
    const covered =
      anyNonzero(row.features) || anyNonzero(row.reviewedApplicabilityFeatures);
    if (covered) existing.coveredRows += 1;
    else existing.uncoveredRows += 1;
    matrixEvents.set(voteEventId, existing);
  }
  if (matrixRows !== EXPECTED_MATRIX_ROWS) {
    throw new Error(`Matrix row count drifted: ${matrixRows}`);
  }

  const allMatrixEventIds = new Set<string>();
  for (const line of canonical.trimEnd().split('\n')) {
    const row = JSON.parse(line) as Record<string, unknown>;
    allMatrixEventIds.add(String(row.voteEventId));
  }
  if (allMatrixEventIds.size !== EXPECTED_MATRIX_EVENT_COUNT) {
    throw new Error(
      `Matrix event count drifted: ${allMatrixEventIds.size}`,
    );
  }
  if (matrixEvents.size !== EXPECTED_2025_HOUSE_MATRIX_EVENTS) {
    throw new Error(
      `2025 House matrix event count drifted: ${matrixEvents.size}`,
    );
  }

  const session = getMinnesotaHouseSession(SESSION);
  const summary = await retry(() => fetchHouseVoteSummary(session.sessionKey));
  const links = discoverHouseVoteBillLinks(summary.html, session.sessionKey);
  if (links.length === 0) {
    throw new Error('Official House summary exposed no vote-detail bill pages');
  }

  const pageResults = await mapLimit(links, 4, async (link) => {
    const detail = await retry(() =>
      fetchHouseVoteDetail(session.sessionKey, link.billIdentifier)
    );
    const events = parseHouseVoteDetailHtml({
      html: detail.html,
      sessionKey: session.sessionKey,
      sourceUrl: detail.sourceUrl,
    });
    if (events.length === 0) {
      throw new Error(`No vote events parsed for ${link.billIdentifier}`);
    }
    if (events.some((event) => event.billIdentifier !== link.billIdentifier)) {
      throw new Error(
        `Vote-detail bill identity drifted for ${link.billIdentifier}`,
      );
    }
    return {
      billIdentifier: link.billIdentifier,
      sourceUrl: detail.sourceUrl,
      events,
    };
  });

  const officialEvents = pageResults.flatMap((row) => row.events);
  const externalKeys = officialEvents.map((event) => event.externalKey);
  if (new Set(externalKeys).size !== externalKeys.length) {
    throw new Error('Official House parser produced duplicate external keys');
  }

  const passageEvents = officialEvents.filter((event) => event.isPassage);
  const nonPassageEvents = officialEvents.filter((event) => !event.isPassage);
  const passageUnder20 = passageEvents.filter(
    (event) => event.yeaCount + event.nayCount < 20,
  );
  const passageAtLeast20 = passageEvents.filter(
    (event) => event.yeaCount + event.nayCount >= 20,
  );

  const versionProofs = await verifyStrictPreVoteText(passageAtLeast20);
  const degradedProofs = versionProofs.filter((row) =>
    row.status === 'status_fetch_failed'
    || row.status === 'version_fetch_failed'
  );
  if (degradedProofs.length > 0) {
    throw new Error(
      `Refusing to freeze degraded Revisor audit: ${degradedProofs.length} fetch failure(s)`,
    );
  }

  const publicReplayCandidates = passageAtLeast20.filter((event, index) =>
    versionProofs[index]?.status === 'verified'
  );
  const passageNoStrictText = passageAtLeast20.filter((event, index) =>
    versionProofs[index]?.status === 'no_strict_prevote_version'
    || versionProofs[index]?.status === 'version_too_short'
  );

  const matrixCompositeKeys = [...matrixEvents.values()].map((event) =>
    compositeKey(event.identifier, event.occurredOn)
  );
  const officialCandidateCompositeKeys = publicReplayCandidates.map((event) =>
    compositeKey(event.billIdentifier, event.occurredOn)
  );
  const comparison = compareMultiplicities(
    officialCandidateCompositeKeys,
    matrixCompositeKeys,
  );

  const matrixCoverage = {
    fullyUncoveredEvents: [...matrixEvents.values()].filter(
      (event) => event.coveredRows === 0,
    ).length,
    partiallyCoveredEvents: [...matrixEvents.values()].filter(
      (event) => event.coveredRows > 0 && event.uncoveredRows > 0,
    ).length,
    fullyCoveredEvents: [...matrixEvents.values()].filter(
      (event) => event.uncoveredRows === 0,
    ).length,
  };

  const report = {
    schemaVersion:
      'historical-density-2025-house-vote-universe-gap-audit-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    session: SESSION,
    chamber: 'house',
    purpose:
      'Measure the complete official House recorded-roll-call denominator and explain how the frozen historical replay target universe narrows it.',
    sources: {
      officialHouse: {
        sessionKey: session.sessionKey,
        summaryUrl: summary.sourceUrl,
        discoveredVoteDetailBills: links.length,
        fetchedVoteDetailBills: pageResults.length,
        sourceSystem: 'Minnesota House Votes',
      },
      revisor: {
        sourceSystem: 'Minnesota Revisor bill status/version pages',
        strictVersionRule:
          'latest bill version with postedOn strictly before vote date and fetched text length >= 100',
      },
      frozenMatrix: {
        artifactId: MATRIX_ARTIFACT_ID,
        artifactDigest: MATRIX_ARTIFACT_DIGEST,
        gzipSha256: MATRIX_GZIP_SHA256,
        canonicalNdjsonSha256: MATRIX_CANONICAL_SHA256,
        rows: matrixRows,
        events: allMatrixEventIds.size,
      },
    },
    officialRollCallUniverse: {
      voteEvents: officialEvents.length,
      billsWithRecordedVotes: new Set(
        officialEvents.map((event) => event.billIdentifier),
      ).size,
      minVoteDate: [...officialEvents]
        .map((event) => event.occurredOn)
        .sort()[0],
      maxVoteDate: [...officialEvents]
        .map((event) => event.occurredOn)
        .sort()
        .at(-1),
      byVoteKind: countBy(officialEvents.map((event) => event.voteKind)),
      passageVoteEvents: passageEvents.length,
      nonPassageVoteEvents: nonPassageEvents.length,
      passageBills: new Set(
        passageEvents.map((event) => event.billIdentifier),
      ).size,
      nonPassageByVoteKind: countBy(
        nonPassageEvents.map((event) => event.voteKind),
      ),
    },
    replayGate: {
      passageVoteEvents: passageEvents.length,
      excludedForUnder20DecisiveVotes: passageUnder20.length,
      passageWithAtLeast20DecisiveVotes: passageAtLeast20.length,
      excludedForNoStrictPreVoteTextAfter20VoteFloor:
        passageNoStrictText.length,
      verifiedStrictPreVoteTextAfter20VoteFloor:
        publicReplayCandidates.length,
      degradedSourceFetches: degradedProofs.length,
      versionProofStatusCounts: countBy(
        versionProofs.map((row) => row.status),
      ),
      publicSourceReplayCandidates: publicReplayCandidates.length,
      note:
        'The public-source lane intentionally does not infer per-event passed/failed outcomes. Frozen-matrix comparison below reveals whether any otherwise eligible official passage event is absent from the replay target set.',
    },
    frozen2025HouseReplayUniverse: {
      events: matrixEvents.size,
      ...matrixCoverage,
      meaning:
        'These are frozen historical replay target events, not the complete 2025-26 House roll-call universe.',
    },
    comparison: {
      identity:
        'source-neutral multiplicity by bill identifier + vote date; this avoids database UUID dependence while preserving repeated same-bill/same-day event counts',
      ...comparison,
      publicCandidateCoverageByFrozenMatrix:
        publicReplayCandidates.length > 0
          ? comparison.matchedEvents / publicReplayCandidates.length
          : null,
      frozenMatrixCoverageByPublicCandidates:
        matrixEvents.size > 0
          ? comparison.matchedEvents / matrixEvents.size
          : null,
    },
    gapAccounting: {
      officialRecordedRollCalls: officialEvents.length,
      excludedNonPassageRollCalls: nonPassageEvents.length,
      passageRollCalls: passageEvents.length,
      excludedPassageUnder20DecisiveVotes: passageUnder20.length,
      excludedPassageNoStrictPreVoteText: passageNoStrictText.length,
      publicSourceReplayCandidates: publicReplayCandidates.length,
      frozenReplayTargetEvents: matrixEvents.size,
      publicSourceCandidatesOutsideFrozenMatrix:
        comparison.officialOutsideMatrix,
      frozenMatrixEventsWithoutPublicCandidate:
        comparison.matrixWithoutOfficial,
    },
    policy: {
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      targetVoteOutcomesRead: false,
      outcomeUse: 'none',
      officialPublicSourcesOnly: true,
      frozenMatrixOutcomesIgnored: true,
      servingChanged: false,
      featureRowsWritten: false,
      modelFitting: 'none',
    },
  };

  mkdirSync(resolve(outputPath, '..'), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    historicalDensity2025HouseVoteUniverseGapAudit: {
      officialRecordedRollCalls: officialEvents.length,
      passageRollCalls: passageEvents.length,
      nonPassageRollCalls: nonPassageEvents.length,
      publicSourceReplayCandidates: publicReplayCandidates.length,
      frozenReplayTargetEvents: matrixEvents.size,
      exactMultiplicityParity: comparison.exactMultiplicityParity,
      publicSourceCandidatesOutsideFrozenMatrix:
        comparison.officialOutsideMatrix,
      frozenMatrixEventsWithoutPublicCandidate:
        comparison.matrixWithoutOfficial,
      matrixCoverage,
      productionDatabaseQueried: false,
      targetVoteOutcomesRead: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
