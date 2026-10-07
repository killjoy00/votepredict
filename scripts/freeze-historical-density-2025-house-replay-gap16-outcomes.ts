import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fetchPublicPage } from '../src/evidence/public-http.js';
import {
  parseHistoricalDeepHouseJournalDate,
  parseHistoricalDeepHouseJournalIndex,
} from '../src/evaluation/historical-deep-house-journal-source-bundle.js';
import { parseHouseJournalOutcomes } from '../src/sources/minnesota/house-outcomes.js';

const ISSUE = 718;
const SESSION = '2025-2026';
const CHAMBER = 'house';
const JOURNAL_INDEX_URL = 'https://www.house.mn.gov/Journals';
const CONCURRENCY = 4;

const MEMBER_VOTES_RUN_ID = 37620464346;
const MEMBER_VOTES_ARTIFACT_ID = 11482176035;
const MEMBER_VOTES_ARTIFACT_DIGEST =
  'sha256:d87fe9e1d51ae9bacebe94e3c1b065675db42da011a72273cbb74a9e5d52e450';
const MEMBER_VOTES_EVENT_PROOF_SHA256 =
  '6f3846e9296385e83151008dcd977659604fbc3e3f3a4dd43e09270186e63dd5';
const MEMBER_VOTE_ROW_SHA256 =
  '721d748bacb74cd110380e233d7df101d044b5ad00d59bdf368ad39ecab9998b';
const EXPECTED_EVENTS = 16;
const EXPECTED_MEMBER_VOTES = 2125;
const EXPECTED_MEMBERSHIPS = 137;
const EXPECTED_JOURNAL_LINKS_DISCOVERED = 78;
const EXPECTED_JOURNAL_PAGES_FETCHED = 14;
const EXPECTED_RECOVERED_OUTCOMES = 15;
const EXPECTED_UNRESOLVED_OUTCOMES = 1;
const EXPECTED_PASSED_OUTCOMES = 15;
const EXPECTED_FAILED_OUTCOMES = 0;
const EXPECTED_UNRESOLVED_COMPOSITE_KEY = 'HF2354|2026-05-17';
const EXPECTED_SOURCE_PROOF_SHA256 =
  'e1a0abcc2970e7888021946dbe915aebf27077dafc4dfc7249b023339aad92d0';
const EXPECTED_OUTCOME_PROOF_SHA256 =
  'b7490e53daeff266d8c5d450ee428c018b1070dcf0e4ca8b91234b24bbb616db';

type Json = Record<string, any>;

type TargetEvent = {
  compositeKey: string;
  identifier: string;
  occurredOn: string;
  journalPage: string | null;
  yeaCount: number;
  nayCount: number;
  decisiveVotes: number;
  frozenOfficialExternalKey: string;
};

type JournalPage = {
  journalDate: string;
  legislativeDay: number;
  url: string;
  finalUrl: string;
  contentSha256: string;
  rawContent: string;
};

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function setSha(values: readonly string[]): string {
  return sha256(`${[...values].sort().join('\n')}\n`);
}

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, 'utf8')) as Json;
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
          setTimeout(resolveDelay, attempt * 750),
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
  const output = new Array<R>(values.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      output[index] = await mapper(values[index]!, index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return output;
}

function verifyMemberVotes(value: Json): TargetEvent[] {
  if (
    value.schemaVersion !== 'historical-density-2025-house-replay-gap16-member-votes-v1'
    || value.issue !== ISSUE
    || value.session !== SESSION
    || value.chamber !== CHAMBER
    || value.reconstruction?.events !== EXPECTED_EVENTS
    || value.reconstruction?.totalMemberVotes !== EXPECTED_MEMBER_VOTES
    || value.reconstruction?.uniqueMembershipsObserved !== EXPECTED_MEMBERSHIPS
    || value.reconstruction?.eventProofSha256 !== MEMBER_VOTES_EVENT_PROOF_SHA256
    || value.reconstruction?.memberVoteRowSha256 !== MEMBER_VOTE_ROW_SHA256
    || value.policy?.candidateSetFrozenBeforeVoteChoiceRead !== true
    || value.policy?.identityMapFrozenBeforeVoteChoiceRead !== true
    || value.policy?.passFailOutcomeReadOrInferred !== false
    || value.policy?.productionDatabaseQueried !== false
  ) {
    throw new Error('Canonical member-vote reconstruction input drifted');
  }

  const events = (value.reconstruction.eventsData ?? []) as Json[];
  if (events.length !== EXPECTED_EVENTS) {
    throw new Error(`Expected 16 member-vote events, found ${events.length}`);
  }

  return events
    .map((event): TargetEvent => {
      if (
        event.passFailOutcome !== null
        || event.passFailOutcomeStatus !== 'not_read_or_inferred'
        || event.isPassage !== true
        || event.decisiveVotes !== event.yeaCount + event.nayCount
      ) {
        throw new Error(`Member-vote event boundary drifted for ${String(event.compositeKey)}`);
      }
      return {
        compositeKey: String(event.compositeKey),
        identifier: String(event.identifier),
        occurredOn: String(event.occurredOn),
        journalPage: event.journalPage === null ? null : String(event.journalPage),
        yeaCount: Number(event.yeaCount),
        nayCount: Number(event.nayCount),
        decisiveVotes: Number(event.decisiveVotes),
        frozenOfficialExternalKey: String(event.frozenOfficialExternalKey),
      };
    })
    .sort((a, b) => a.compositeKey.localeCompare(b.compositeKey));
}

async function main(): Promise<void> {
  const input = readJson(env('VOTEPREDICT_GAP16_MEMBER_VOTES_PATH'));
  const output = resolve(env('VOTEPREDICT_GAP16_OUTCOMES_OUTPUT'));
  const targets = verifyMemberVotes(input);
  const targetDates = [...new Set(targets.map((row) => row.occurredOn))].sort();

  const index = await retry(() =>
    fetchPublicPage(JOURNAL_INDEX_URL, {
      timeoutMs: 45_000,
      maxBytes: 3_000_000,
      userAgent: 'VotePredict/2.0 gap16 House Journal outcome freeze',
    })
  );
  const indexUrl = new URL(index.finalUrl);
  if (
    !['house.mn.gov', 'www.house.mn.gov'].includes(indexUrl.hostname.toLowerCase())
    || !/^\/journals\/?$/i.test(indexUrl.pathname)
  ) {
    throw new Error(`House Journal index redirected away from approved endpoint: ${index.finalUrl}`);
  }

  const parsed = parseHistoricalDeepHouseJournalIndex(index.rawContent, SESSION);
  if (!parsed.sessionMatched) {
    throw new Error(`House Journal index did not prove the ${SESSION} session`);
  }
  if (parsed.links.length < 40) {
    throw new Error(
      `House Journal index exposed only ${parsed.links.length} links; refusing incomplete enumeration`,
    );
  }

  const linksByDate = new Map<string, typeof parsed.links>();
  for (const date of targetDates) {
    const links = parsed.links.filter((link) => link.journalDate === date);
    if (links.length === 0) {
      throw new Error(`House Journal index has no exact journal link for target date ${date}`);
    }
    linksByDate.set(date, links);
  }

  const targetLinks = [...new Map(
    targetDates.flatMap((date) =>
      (linksByDate.get(date) ?? []).map((link) => [link.url, link] as const)
    ),
  ).values()].sort((a, b) =>
    a.journalDate.localeCompare(b.journalDate)
    || a.legislativeDay - b.legislativeDay
    || a.url.localeCompare(b.url)
  );

  const pages = await mapLimit(targetLinks, CONCURRENCY, async (link): Promise<JournalPage> => {
    const page = await retry(() =>
      fetchPublicPage(link.url, {
        timeoutMs: 45_000,
        maxBytes: 12_000_000,
        userAgent: 'VotePredict/2.0 gap16 House Journal outcome freeze',
      })
    );
    const final = new URL(page.finalUrl);
    if (
      !['house.mn.gov', 'www.house.mn.gov'].includes(final.hostname.toLowerCase())
      || !/^\/cco\/journals\/2025-26\/J\d+\.htm$/i.test(final.pathname)
    ) {
      throw new Error(`House Journal page redirected away from approved archive: ${page.finalUrl}`);
    }
    const pageDate = parseHistoricalDeepHouseJournalDate(page.rawContent);
    if (pageDate !== link.journalDate) {
      throw new Error(
        `House Journal index/page date mismatch for ${link.url}: ${link.journalDate} vs ${pageDate ?? 'unresolved'}`,
      );
    }
    return {
      journalDate: link.journalDate,
      legislativeDay: link.legislativeDay,
      url: link.url,
      finalUrl: page.finalUrl,
      contentSha256: page.contentSha256,
      rawContent: page.rawContent,
    };
  });

  const pagesByDate = new Map<string, JournalPage[]>();
  for (const page of pages) {
    const rows = pagesByDate.get(page.journalDate) ?? [];
    rows.push(page);
    pagesByDate.set(page.journalDate, rows);
  }

  const eventResults = targets.map((target) => {
    const candidates: Array<{
      passed: boolean;
      resultText: string;
      outcomeJournalPage?: string;
      sourceUrl: string;
      finalUrl: string;
      contentSha256: string;
      legislativeDay: number;
    }> = [];

    for (const page of pagesByDate.get(target.occurredOn) ?? []) {
      const outcomes = parseHouseJournalOutcomes(page.rawContent)
        .filter(
          (row) =>
            row.identifier === target.identifier
            && row.yeaCount === target.yeaCount
            && row.nayCount === target.nayCount,
        );
      for (const row of outcomes) {
        candidates.push({
          passed: row.passed,
          resultText: row.resultText,
          outcomeJournalPage: row.journalPage,
          sourceUrl: page.url,
          finalUrl: page.finalUrl,
          contentSha256: page.contentSha256,
          legislativeDay: page.legislativeDay,
        });
      }
    }

    let narrowed = candidates;
    if (narrowed.length > 1 && target.journalPage) {
      narrowed = narrowed.filter(
        (row) => row.outcomeJournalPage === target.journalPage,
      );
    }

    if (narrowed.length === 1) {
      const match = narrowed[0]!;
      return {
        ...target,
        status: 'recovered' as const,
        passed: match.passed,
        resultText: match.resultText,
        outcomeJournalPage: match.outcomeJournalPage ?? null,
        sourceUrl: match.sourceUrl,
        finalUrl: match.finalUrl,
        contentSha256: match.contentSha256,
        legislativeDay: match.legislativeDay,
        candidateMatchesBeforeJournalPageTieBreak: candidates.length,
      };
    }

    return {
      ...target,
      status: 'unresolved' as const,
      passed: null,
      resultText: null,
      outcomeJournalPage: null,
      sourceUrl: null,
      finalUrl: null,
      contentSha256: null,
      legislativeDay: null,
      candidateMatchesBeforeJournalPageTieBreak: candidates.length,
      candidateMatchesAfterJournalPageTieBreak: narrowed.length,
      unresolvedReason:
        candidates.length === 0
          ? 'no_exact_bill_tally_result_match'
          : 'multiple_indistinguishable_matches',
    };
  });

  const recovered = eventResults.filter((row) => row.status === 'recovered');
  const unresolved = eventResults.filter((row) => row.status === 'unresolved');
  const passed = recovered.filter((row) => row.passed === true).length;
  const failed = recovered.filter((row) => row.passed === false).length;

  const sourceProofSha256 = setSha(
    pages.map(
      (page) =>
        `${page.journalDate}|${page.legislativeDay}|${page.url}|${page.contentSha256}`,
    ),
  );
  const outcomeProofSha256 = setSha(
    recovered.map(
      (row) =>
        `${row.compositeKey}|${row.passed ? 'pass' : 'fail'}|${row.resultText}|${row.outcomeJournalPage ?? 'no-page'}|${row.sourceUrl}|${row.contentSha256}`,
    ),
  );

  if (parsed.links.length !== EXPECTED_JOURNAL_LINKS_DISCOVERED) {
    throw new Error(`House Journal link count drifted: ${parsed.links.length}`);
  }
  if (pages.length !== EXPECTED_JOURNAL_PAGES_FETCHED) {
    throw new Error(`Exact-date House Journal page count drifted: ${pages.length}`);
  }
  if (
    recovered.length !== EXPECTED_RECOVERED_OUTCOMES
    || unresolved.length !== EXPECTED_UNRESOLVED_OUTCOMES
    || passed !== EXPECTED_PASSED_OUTCOMES
    || failed !== EXPECTED_FAILED_OUTCOMES
  ) {
    throw new Error(
      `Outcome recovery counts drifted: ${JSON.stringify({ recovered: recovered.length, unresolved: unresolved.length, passed, failed })}`,
    );
  }
  if (
    unresolved.length !== 1
    || unresolved[0]?.compositeKey !== EXPECTED_UNRESOLVED_COMPOSITE_KEY
    || unresolved[0]?.unresolvedReason !== 'no_exact_bill_tally_result_match'
  ) {
    throw new Error(`Unresolved outcome identity drifted: ${JSON.stringify(unresolved)}`);
  }
  if (sourceProofSha256 !== EXPECTED_SOURCE_PROOF_SHA256) {
    throw new Error(`House Journal source proof drifted: ${sourceProofSha256}`);
  }
  if (outcomeProofSha256 !== EXPECTED_OUTCOME_PROOF_SHA256) {
    throw new Error(`House Journal outcome proof drifted: ${outcomeProofSha256}`);
  }

  const report = {
    schemaVersion: 'historical-density-2025-house-replay-gap16-outcomes-v1',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    session: SESSION,
    chamber: CHAMBER,
    frozenInput: {
      memberVotes: {
        runId: MEMBER_VOTES_RUN_ID,
        artifactId: MEMBER_VOTES_ARTIFACT_ID,
        artifactDigest: MEMBER_VOTES_ARTIFACT_DIGEST,
        eventProofSha256: MEMBER_VOTES_EVENT_PROOF_SHA256,
        memberVoteRowSha256: MEMBER_VOTE_ROW_SHA256,
        events: EXPECTED_EVENTS,
        memberVotes: EXPECTED_MEMBER_VOTES,
        memberships: EXPECTED_MEMBERSHIPS,
      },
    },
    journalSource: {
      indexUrl: JOURNAL_INDEX_URL,
      indexFinalUrl: index.finalUrl,
      indexContentSha256: index.contentSha256,
      sessionMatched: parsed.sessionMatched,
      indexLinksDiscovered: parsed.links.length,
      targetDates,
      exactDateJournalPagesFetched: pages.length,
      sourceProofSha256,
      pages: pages.map(({ rawContent: _raw, ...page }) => page),
    },
    outcomeRecovery: {
      events: eventResults.length,
      recovered: recovered.length,
      unresolved: unresolved.length,
      passed,
      failed,
      outcomeProofSha256,
      eventsData: eventResults,
    },
    interpretation: {
      established:
        'Outcome labels are accepted only from explicit Minnesota House Journal result text matched by frozen bill identifier and exact yea/nay tally, with journal page used only to disambiguate multiple matches.',
      unresolvedPolicy:
        'No tally threshold, majority assumption, current bill status, or agreement among multiple indistinguishable journal matches may fill an unresolved event.',
      nextStep:
        'If sufficient outcomes are recovered, audit the remaining full historical Quick replay state required by these events: prior passage-event/member-vote history, membership service metadata, strict pre-vote versions, and cutoff-safe companion references.',
    },
    policy: {
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      candidateSelectionFrozenBeforeOutcomeRead: true,
      identityMapFrozenBeforeOutcomeRead: true,
      memberVoteRowsFrozenBeforeOutcomeRead: true,
      passFailOutcomeRead: true,
      outcomeSource: 'official_minnesota_house_journal_explicit_result_text',
      outcomeUse: 'replay_extension_reconstruction_only',
      tallyInferenceAllowed: false,
      targetSelectionUsesOutcomes: false,
      semanticDecisionsUseOutcomes: false,
      featureRowsWritten: false,
      modelFitting: 'none',
      servingChanged: false,
      mechanicallyActionable: false,
    },
  };

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    historicalDensity2025HouseReplayGap16Outcomes: {
      events: eventResults.length,
      recovered: recovered.length,
      unresolved: unresolved.length,
      passed,
      failed,
      journalPagesFetched: pages.length,
      sourceProofSha256,
      outcomeProofSha256,
      productionDatabaseQueried: false,
      tallyInferenceAllowed: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
