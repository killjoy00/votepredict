import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  fetchHouseVoteDetail,
  parseHouseVoteDetailHtml,
} from '../src/sources/minnesota/house-votes.js';
import {
  fetchRevisorBill,
  fetchRevisorBillVersion,
  type RevisorBillMetadata,
  type RevisorBillVersionMetadata,
} from '../src/sources/minnesota/revisor.js';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';
import {
  parseHistoricalDeepHouseJournalDate,
  parseHistoricalDeepHouseJournalIndex,
} from '../src/evaluation/historical-deep-house-journal-source-bundle.js';
import {
  historicalDeepExpansionHtmlText,
} from '../src/evaluation/historical-deep-expansion-source-bundle.js';
import {
  parseHouseJournalOutcomes,
  type HouseJournalOutcome,
} from '../src/sources/minnesota/house-outcomes.js';

const SESSION = '2025-2026';
const SESSION_INDEX_URL = 'https://www.house.mn.gov/Journals';
const UNIVERSE_AUDIT_RUN_ID = 37563491641;
const UNIVERSE_AUDIT_ARTIFACT_ID = 11457484096;
const UNIVERSE_AUDIT_ARTIFACT_DIGEST =
  'sha256:9047ac177fcabc03b2b80662ca0a2475d07fef1e4ea8a828643c1f8aeb6020e1';
const EXPECTED_CANDIDATES = 16;
const EXPECTED_CANDIDATE_SET_SHA256 =
  'c756fa9d80e7914e579d1bb43e2dc3c3d730ad221e0f8185dc2de2ccffc2c37a';
const EXPECTED_REPLAYABLE = 15;
const EXPECTED_REPLAYABLE_SET_SHA256 =
  'e7b97f3662dd5519c1ff3c2e19e264ffb940e1a63e309ac1fb760af98fe7a0e4';
const EXPECTED_UNRESOLVED = 1;
const EXPECTED_UNRESOLVED_SET_SHA256 =
  '5ba2565066c226be105d45c477280f491b91608066ea95c76bcd52bf1c838903';
const EXPECTED_MEMBER_VOTE_ROWS = 2125;
const EXPECTED_PASSED = 15;
const EXPECTED_FAILED = 0;
const USER_AGENT = 'VotePredict/2.0 2025-house-public-replay-gap-proof';

type Json = Record<string, any>;
type ParsedHouseEvent = ReturnType<typeof parseHouseVoteDetailHtml>[number];

type FetchedHtml = {
  status: number;
  url: string;
  contentType: string;
  bytes: Buffer;
};

type Candidate = {
  compositeKey: string;
  identifier: string;
  occurredOn: string;
  expectedExternalKey: string;
};

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalBillIdentifier(value: string): string {
  const match = value.replace(/\s+/g, '').toUpperCase().match(/^(HF|SF)0*(\d+)$/);
  if (!match) throw new Error(`Unsupported bill identifier: ${value}`);
  return `${match[1]}${Number(match[2])}`;
}

function houseVoteQueryIdentifier(value: string): string {
  const canonical = canonicalBillIdentifier(value);
  const match = canonical.match(/^(HF|SF)(\d+)$/);
  if (!match) throw new Error(`Unsupported House vote query identifier: ${value}`);
  return `${match[1]}${match[2].padStart(4, '0')}`;
}

function candidateSetSha(values: readonly string[]): string {
  return sha256(`${[...values].sort().join('\n')}\n`);
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

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
          setTimeout(resolveDelay, attempt * 700),
        );
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

async function fetchOfficialHtml(url: string): Promise<FetchedHtml> {
  return retry(async () => {
    const response = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(45_000),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`Official source returned HTTP ${response.status}: ${url}`);
    }
    return {
      status: response.status,
      url: response.url,
      contentType: response.headers.get('content-type') ?? '',
      bytes,
    };
  });
}

async function mapLimit<T, R>(
  values: readonly T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker(): Promise<void> {
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

function loadCandidates(audit: Json): Candidate[] {
  if (
    audit.schemaVersion !== 'historical-density-2025-house-vote-universe-gap-audit-v1'
    || audit.issue !== 718
    || audit.session !== SESSION
    || audit.chamber !== 'house'
    || audit.sources?.frozenMatrix?.artifactId !== 11436413885
    || audit.officialRollCallUniverse?.voteEvents !== 465
    || audit.officialRollCallUniverse?.passageVoteEvents !== 281
    || audit.replayGate?.publicSourceReplayCandidates !== 253
    || audit.frozen2025HouseReplayUniverse?.events !== 264
    || audit.comparison?.officialOutsideMatrix !== 16
    || audit.comparison?.matrixWithoutOfficial !== 27
  ) {
    throw new Error('Canonical House universe audit identity/counts drifted');
  }

  const rows = (audit.comparison?.mismatchDetails ?? [])
    .filter(
      (row: Json) =>
        row.classification === 'public_replay_candidate_absent_from_frozen_matrix',
    )
    .map((row: Json) => {
      const passage = (row.currentOfficialEvents ?? []).filter(
        (event: Json) =>
          event.isPassage === true
          && event.strictVersionStatus === 'verified',
      );
      if (row.officialEvents !== 1 || row.matrixEvents !== 0 || passage.length !== 1) {
        throw new Error(
          `Public replay candidate mismatch shape drifted for ${String(row.compositeKey)}`,
        );
      }
      const [identifier, occurredOn] = String(row.compositeKey).split('|');
      if (!identifier || !occurredOn) {
        throw new Error(`Invalid composite key ${String(row.compositeKey)}`);
      }
      return {
        compositeKey: String(row.compositeKey),
        identifier: canonicalBillIdentifier(identifier),
        occurredOn,
        expectedExternalKey: String(passage[0].externalKey),
      };
    })
    .sort((a: Candidate, b: Candidate) =>
      a.compositeKey.localeCompare(b.compositeKey),
    );

  if (rows.length !== EXPECTED_CANDIDATES) {
    throw new Error(`Expected ${EXPECTED_CANDIDATES} candidates, got ${rows.length}`);
  }
  if (candidateSetSha(rows.map((row: Candidate) => row.compositeKey))
      !== EXPECTED_CANDIDATE_SET_SHA256) {
    throw new Error('Public replay gap candidate-set identity drifted');
  }
  return rows;
}

function eventMemberVoteSha(event: ParsedHouseEvent): string {
  const rows = event.memberVotes
    .map((vote) =>
      `${vote.sourceOrdinal}|${vote.normalizedName}|${vote.choice}`,
    )
    .sort();
  return sha256(`${rows.join('\n')}\n`);
}

function selectHouseEvent(
  candidate: Candidate,
  events: readonly ParsedHouseEvent[],
): { event: ParsedHouseEvent; externalKeyMatchedFrozenAudit: boolean } {
  const matches = events.filter(
    (event) =>
      canonicalBillIdentifier(event.billIdentifier ?? '') === candidate.identifier
      && event.occurredOn === candidate.occurredOn
      && event.isPassage === true,
  );
  const exact = matches.filter(
    (event) => event.externalKey === candidate.expectedExternalKey,
  );
  if (exact.length === 1) {
    return { event: exact[0]!, externalKeyMatchedFrozenAudit: true };
  }
  if (matches.length === 1) {
    // The universe audit deliberately froze candidate identity as bill + vote-date
    // multiplicity. House external keys include a page-derived ordinal, so preserve
    // ordinal drift as lineage instead of treating it as a different vote when the
    // source-neutral candidate identity remains unique.
    return { event: matches[0]!, externalKeyMatchedFrozenAudit: false };
  }
  throw new Error(
    `Expected one unique official passage event for ${candidate.compositeKey}; exact-key matches=${exact.length}, bill/date passage matches=${matches.length}`,
  );
}

function matchJournalOutcome(
  event: ParsedHouseEvent,
  outcomes: readonly HouseJournalOutcome[],
): HouseJournalOutcome[] {
  let matches = outcomes.filter(
    (row) =>
      canonicalBillIdentifier(row.identifier)
        === canonicalBillIdentifier(event.billIdentifier ?? '')
      && row.yeaCount === event.yeaCount
      && row.nayCount === event.nayCount,
  );
  if (matches.length > 1 && event.journalPage) {
    matches = matches.filter((row) => row.journalPage === event.journalPage);
  }
  return matches;
}

type ExplicitJournalOutcome = {
  identifier: string;
  yeaCount: number;
  nayCount: number;
  passed: boolean;
  resultText: string;
  journalPage: string | null;
};

function explicitJournalOutcomesForEvent(
  html: string,
  event: ParsedHouseEvent,
): ExplicitJournalOutcome[] {
  const identifier = canonicalBillIdentifier(event.billIdentifier ?? '');
  const text = historicalDeepExpansionHtmlText(html);
  const tally = new RegExp(
    `\\bThere were\\s+${event.yeaCount}\\s+yeas?\\s+and\\s+${event.nayCount}\\s+nays?\\b`,
    'gi',
  );
  const billMention =
    /\b([HS])\.?\s*F\.?\s*No\.?\s*(\d+)\b/gi;
  const pageMarker = /Top of Page\s+(\d+)/gi;
  const resultPattern =
    /The\s+(?:bill|resolution)(?:,\s+as amended)?\s+(?:was\s+(not\s+)?(?:repassed|passed|adopted)|did\s+(not\s+)?(?:pass|adopt))[^.]*\./i;
  const rows: ExplicitJournalOutcome[] = [];

  for (const tallyMatch of text.matchAll(tally)) {
    const tallyIndex = tallyMatch.index ?? -1;
    if (tallyIndex < 0) continue;
    const before = text.slice(Math.max(0, tallyIndex - 30_000), tallyIndex);
    const mentions = [...before.matchAll(billMention)];
    const nearest = mentions.at(-1);
    if (!nearest) continue;
    const nearestIdentifier = canonicalBillIdentifier(
      `${nearest[1]!.toUpperCase()}F${Number(nearest[2])}`,
    );
    if (nearestIdentifier !== identifier) continue;

    const after = text.slice(
      tallyIndex + tallyMatch[0].length,
      tallyIndex + tallyMatch[0].length + 16_000,
    );
    const result = resultPattern.exec(after);
    if (!result || result.index > 12_000) continue;

    const beforeResult = after.slice(0, result.index);
    const nextBillMentions = [...beforeResult.matchAll(billMention)];
    if (
      nextBillMentions.some((mention) =>
        canonicalBillIdentifier(
          `${mention[1]!.toUpperCase()}F${Number(mention[2])}`,
        ) !== identifier
      )
    ) {
      continue;
    }

    const pageMatches = [...before.matchAll(pageMarker)];
    const journalPage = pageMatches.at(-1)?.[1] ?? null;
    rows.push({
      identifier,
      yeaCount: event.yeaCount,
      nayCount: event.nayCount,
      passed: !(result[1] || result[2]),
      resultText: result[0],
      journalPage,
    });
  }

  return rows;
}

async function main(): Promise<void> {
  const auditPath = resolve(env('VOTEPREDICT_2025_HOUSE_UNIVERSE_AUDIT_PATH'));
  const outputPath = resolve(env('VOTEPREDICT_2025_HOUSE_PUBLIC_REPLAY_GAP_OUTPUT'));
  const audit = JSON.parse(readFileSync(auditPath, 'utf8')) as Json;
  const candidates = loadCandidates(audit);
  const session = getMinnesotaHouseSession(SESSION);

  const indexResponse = await fetchOfficialHtml(SESSION_INDEX_URL);
  if (
    indexResponse.status < 200
    || indexResponse.status >= 300
    || !/text\/html/i.test(indexResponse.contentType)
  ) {
    throw new Error(
      `House Journal index unavailable: HTTP ${indexResponse.status} / ${indexResponse.contentType}`,
    );
  }
  const parsedIndex = parseHistoricalDeepHouseJournalIndex(
    indexResponse.bytes.toString('utf8'),
    SESSION,
  );
  if (!parsedIndex.sessionMatched || parsedIndex.links.length < 40) {
    throw new Error(
      `House Journal index failed completeness/session guard: matched=${parsedIndex.sessionMatched} links=${parsedIndex.links.length}`,
    );
  }

  const candidateDates = [...new Set(candidates.map((row) => row.occurredOn))].sort();
  const linksByDate = new Map(
    candidateDates.map((date) => [
      date,
      parsedIndex.links.filter((link) => link.journalDate === date),
    ]),
  );
  for (const date of candidateDates) {
    if ((linksByDate.get(date) ?? []).length === 0) {
      throw new Error(`House Journal index exposed no exact journal page for ${date}`);
    }
  }

  const uniqueJournalLinks = [
    ...new Map(
      [...linksByDate.values()]
        .flat()
        .map((link) => [link.url, link] as const),
    ).values(),
  ].sort((a, b) => a.url.localeCompare(b.url));

  const journalPages = await mapLimit(uniqueJournalLinks, 4, async (link) => {
    const response = await fetchOfficialHtml(link.url);
    if (
      response.status < 200
      || response.status >= 300
      || !/text\/html/i.test(response.contentType)
    ) {
      throw new Error(
        `House Journal page unavailable: HTTP ${response.status} / ${response.contentType}: ${link.url}`,
      );
    }
    const html = response.bytes.toString('utf8');
    const pageDate = parseHistoricalDeepHouseJournalDate(html);
    if (pageDate !== link.journalDate) {
      throw new Error(
        `House Journal date mismatch for ${link.url}: ${String(pageDate)} != ${link.journalDate}`,
      );
    }
    return {
      ...link,
      finalUrl: response.url,
      contentSha256: sha256(response.bytes),
      html,
      outcomes: parseHouseJournalOutcomes(html),
    };
  });

  const journalByDate = new Map<string, typeof journalPages>();
  for (const page of journalPages) {
    const rows = journalByDate.get(page.journalDate) ?? [];
    rows.push(page);
    journalByDate.set(page.journalDate, rows);
  }

  const statusCache = new Map<string, Promise<RevisorBillMetadata>>();
  const versionCache = new Map<
    string,
    Promise<Awaited<ReturnType<typeof fetchRevisorBillVersion>>>
  >();

  const cases = await mapLimit(candidates, 4, async (candidate) => {
    const houseQueryIdentifier = houseVoteQueryIdentifier(candidate.identifier);
    const detail = await retry(() =>
      fetchHouseVoteDetail(session.sessionKey, houseQueryIdentifier)
    );
    const officialEvents = parseHouseVoteDetailHtml({
      html: detail.html,
      sessionKey: session.sessionKey,
      sourceUrl: detail.sourceUrl,
    });
    const selectedHouseEvent = selectHouseEvent(candidate, officialEvents);
    const event = selectedHouseEvent.event;
    if (event.yeaCount + event.nayCount < 20) {
      throw new Error(`Candidate fell below 20-vote floor: ${candidate.compositeKey}`);
    }
    if (event.memberVotes.length !== event.yeaCount + event.nayCount) {
      throw new Error(
        `Member-vote roster drifted for ${candidate.compositeKey}: ${event.memberVotes.length} != ${event.yeaCount + event.nayCount}`,
      );
    }

    let metadataPending = statusCache.get(candidate.identifier);
    if (!metadataPending) {
      metadataPending = retry(() =>
        fetchRevisorBill(SESSION, candidate.identifier, false)
      );
      statusCache.set(candidate.identifier, metadataPending);
    }
    const metadata = await metadataPending;
    const selected = selectStrictPreVoteVersion(metadata, candidate.occurredOn);
    if (!selected) {
      throw new Error(
        `Strict pre-vote Revisor version disappeared for ${candidate.compositeKey}`,
      );
    }
    let versionPending = versionCache.get(selected.textUrl);
    if (!versionPending) {
      versionPending = retry(() => fetchRevisorBillVersion(selected));
      versionCache.set(selected.textUrl, versionPending);
    }
    const version = await versionPending;
    if (version.text.length < 100 || version.postedOn >= candidate.occurredOn) {
      throw new Error(
        `Revisor version proof drifted for ${candidate.compositeKey}`,
      );
    }

    const pages = journalByDate.get(candidate.occurredOn) ?? [];
    const journalMatches = pages.flatMap((page) =>
      matchJournalOutcome(event, page.outcomes).map((outcome) => ({
        page,
        outcome,
      })),
    );
    const sameBillJournalOutcomes = pages.flatMap((page) =>
      page.outcomes
        .filter(
          (outcome) =>
            canonicalBillIdentifier(outcome.identifier) === candidate.identifier,
        )
        .map((outcome) => ({
          url: page.url,
          contentSha256: page.contentSha256,
          yeaCount: outcome.yeaCount,
          nayCount: outcome.nayCount,
          passed: outcome.passed,
          journalPage: outcome.journalPage ?? null,
          resultText: outcome.resultText,
        })),
    );
    const sameTallyJournalOutcomes = pages.flatMap((page) =>
      page.outcomes
        .filter(
          (outcome) =>
            outcome.yeaCount === event.yeaCount
            && outcome.nayCount === event.nayCount,
        )
        .map((outcome) => ({
          url: page.url,
          identifier: canonicalBillIdentifier(outcome.identifier),
          contentSha256: page.contentSha256,
          passed: outcome.passed,
          journalPage: outcome.journalPage ?? null,
          resultText: outcome.resultText,
        })),
    );

    const exactJournalMatches =
      journalMatches.length > 1 && event.journalPage
        ? journalMatches.filter(
            (row) => row.outcome.journalPage === event.journalPage,
          )
        : journalMatches;

    const scopedExplicitMatches = pages.flatMap((page) =>
      explicitJournalOutcomesForEvent(page.html, event).map((outcome) => ({
        page,
        outcome,
      })),
    );
    const exactScopedExplicitMatches =
      scopedExplicitMatches.length > 1 && event.journalPage
        ? scopedExplicitMatches.filter(
            (row) => row.outcome.journalPage === event.journalPage,
          )
        : scopedExplicitMatches;

    const journalResolved = exactScopedExplicitMatches.length === 1;
    const journal = journalResolved
      ? {
          status: 'resolved_explicit_outcome',
          resolutionMethod: 'exact_bill_tally_and_explicit_result_v1',
          url: exactScopedExplicitMatches[0]!.page.url,
          finalUrl: exactScopedExplicitMatches[0]!.page.finalUrl,
          journalDate: exactScopedExplicitMatches[0]!.page.journalDate,
          legislativeDay: exactScopedExplicitMatches[0]!.page.legislativeDay,
          contentSha256: exactScopedExplicitMatches[0]!.page.contentSha256,
          journalPage: exactScopedExplicitMatches[0]!.outcome.journalPage,
          passed: exactScopedExplicitMatches[0]!.outcome.passed,
          resultText: exactScopedExplicitMatches[0]!.outcome.resultText,
          legacyParserExactMatches: exactJournalMatches.length,
        }
      : {
          status:
            exactJournalMatches.length === 0
              ? 'unresolved_no_exact_outcome'
              : 'unresolved_multiple_exact_outcomes',
          candidateMatches: exactScopedExplicitMatches.length,
          legacyParserExactMatches: exactJournalMatches.length,
          scopedExplicitMatches: exactScopedExplicitMatches.length,
          pagesSearched: pages.map((page) => ({
            url: page.url,
            contentSha256: page.contentSha256,
            parsedOutcomeCount: page.outcomes.length,
          })),
          sameBillJournalOutcomes,
          sameTallyJournalOutcomes,
        };

    return {
      compositeKey: candidate.compositeKey,
      identifier: candidate.identifier,
      occurredOn: candidate.occurredOn,
      selection: {
        selectedWithoutPassFailOutcome: true,
        sourceAuditRunId: UNIVERSE_AUDIT_RUN_ID,
        sourceAuditArtifactId: UNIVERSE_AUDIT_ARTIFACT_ID,
        sourceAuditArtifactDigest: UNIVERSE_AUDIT_ARTIFACT_DIGEST,
        candidateSetSha256: EXPECTED_CANDIDATE_SET_SHA256,
      },
      officialHouseVote: {
        sourceUrl: detail.sourceUrl,
        queryIdentifier: houseQueryIdentifier,
        frozenAuditExternalKey: candidate.expectedExternalKey,
        externalKey: event.externalKey,
        externalKeyMatchedFrozenAudit:
          selectedHouseEvent.externalKeyMatchedFrozenAudit,
        voteKind: event.voteKind,
        motionText: event.motionText,
        journalPage: event.journalPage ?? null,
        yeaCount: event.yeaCount,
        nayCount: event.nayCount,
        decisiveVotes: event.yeaCount + event.nayCount,
        memberVoteCount: event.memberVotes.length,
        memberVoteSha256: eventMemberVoteSha(event),
      },
      revisor: {
        status: 'verified_strict_prevote_text',
        statusUrl: metadata.sourceUrl,
        versionUrl: version.textUrl,
        versionPostedOn: version.postedOn,
        versionOrdinal: version.ordinal,
        versionKey: version.versionKey,
        versionTextSha256: version.textSha256,
        textLength: version.text.length,
      },
      journal,
      sourceNativeReplayable: journalResolved,
      unresolvedReasons: journalResolved
        ? []
        : ['explicit House Journal passage result could not be uniquely matched'],
    };
  });

  cases.sort((a, b) => a.compositeKey.localeCompare(b.compositeKey));
  const replayable = cases.filter((row) => row.sourceNativeReplayable);
  const unresolved = cases.filter((row) => !row.sourceNativeReplayable);
  const memberVoteRows = cases.reduce(
    (sum, row) => sum + row.officialHouseVote.memberVoteCount,
    0,
  );
  const replayableSetSha256 = candidateSetSha(
    replayable.map((row) => row.compositeKey),
  );
  const unresolvedSetSha256 = candidateSetSha(
    unresolved.map((row) => row.compositeKey),
  );
  const passed = replayable.filter(
    (row) => 'passed' in row.journal && row.journal.passed === true,
  ).length;
  const failed = replayable.filter(
    (row) => 'passed' in row.journal && row.journal.passed === false,
  ).length;
  if (
    replayable.length !== EXPECTED_REPLAYABLE
    || replayableSetSha256 !== EXPECTED_REPLAYABLE_SET_SHA256
    || unresolved.length !== EXPECTED_UNRESOLVED
    || unresolvedSetSha256 !== EXPECTED_UNRESOLVED_SET_SHA256
    || memberVoteRows !== EXPECTED_MEMBER_VOTE_ROWS
    || passed !== EXPECTED_PASSED
    || failed !== EXPECTED_FAILED
  ) {
    throw new Error(
      `Frozen 16-case replay-gap result drifted: ${JSON.stringify({
        replayable: replayable.length,
        replayableSetSha256,
        unresolved: unresolved.length,
        unresolvedSetSha256,
        memberVoteRows,
        passed,
        failed,
      })}`,
    );
  }
  const unresolvedWithSameBillOutcome = unresolved.filter(
    (row) =>
      'sameBillJournalOutcomes' in row.journal
      && Array.isArray(row.journal.sameBillJournalOutcomes)
      && row.journal.sameBillJournalOutcomes.length > 0,
  ).length;
  const unresolvedWithNoSameBillOutcome =
    unresolved.length - unresolvedWithSameBillOutcome;

  const report = {
    schemaVersion: 'historical-density-2025-house-public-replay-gap-proof-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    session: SESSION,
    chamber: 'house',
    frozenSelection: {
      sourceAuditRunId: UNIVERSE_AUDIT_RUN_ID,
      sourceAuditArtifactId: UNIVERSE_AUDIT_ARTIFACT_ID,
      sourceAuditArtifactDigest: UNIVERSE_AUDIT_ARTIFACT_DIGEST,
      candidateCount: candidates.length,
      candidateSetSha256: EXPECTED_CANDIDATE_SET_SHA256,
      selectionRule:
        'public-source passage candidate with >=20 decisive votes and verified strict pre-vote Revisor text, absent from frozen v1.7 matrix; selected before pass/fail outcome recovery',
    },
    sourceProof: {
      officialHouseVotePagesFetched: candidates.length,
      journalIndexUrl: SESSION_INDEX_URL,
      journalLinksEnumerated: parsedIndex.links.length,
      exactCandidateDates: candidateDates.length,
      journalPagesFetched: journalPages.length,
      officialRevisorBillsVerified: new Set(candidates.map((row) => row.identifier)).size,
    },
    summary: {
      candidates: cases.length,
      sourceNativeReplayable: replayable.length,
      replayableSetSha256,
      explicitOutcomeUnresolved: unresolved.length,
      unresolvedSetSha256,
      unresolvedWithSameBillOutcome,
      unresolvedWithNoSameBillOutcome,
      memberVoteRows,
      passed,
      failed,
    },
    cases,
    policy: {
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      candidateSelectionUsedPassFailOutcome: false,
      passFailOutcomeReadOnlyAfterCandidateSetFrozen: true,
      outcomeSource: 'explicit Minnesota House Journal result only',
      outcomeResolutionMethod:
        'exact frozen bill identity + exact House yea/nay tally + explicit Journal pass/adopt result text',
      outcomeInferenceFromVoteThreshold: false,
      officialPublicSourcesOnly: true,
      sameDayRevisorVersionsExcluded: true,
      featureRowsWritten: false,
      modelFitting: 'none',
      servingChanged: false,
      integrationReady: false,
      nextStep:
        'Only sourceNativeReplayable cases are eligible for consideration in a rebuilt historical replay corpus. Rebuilding the corpus requires a separate immutable dataset/version decision and must not silently mutate v1.7.',
    },
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    historicalDensity2025HousePublicReplayGapProof: {
      candidates: cases.length,
      sourceNativeReplayable: replayable.length,
      replayableSetSha256,
      explicitOutcomeUnresolved: unresolved.length,
      unresolvedSetSha256,
      unresolvedWithSameBillOutcome,
      unresolvedWithNoSameBillOutcome,
      memberVoteRows,
      passed: report.summary.passed,
      failed: report.summary.failed,
      candidateSetSha256: EXPECTED_CANDIDATE_SET_SHA256,
      productionDatabaseQueried: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
