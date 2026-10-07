import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  fetchHouseVoteDetail,
  normalizeMemberName,
  parseHouseVoteDetailHtml,
} from '../src/sources/minnesota/house-votes.js';
import {
  reconcileHouseMemberName,
  type MembershipCandidate,
} from '../src/sources/minnesota/member-reconciliation.js';
import { officialMembershipAliasesForLrlId } from '../src/sources/minnesota/official-member-aliases.js';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';

const ISSUE = 718;
const SESSION = '2025-2026';
const CHAMBER = 'house';

const GAP16_RUN_ID = 37572160059;
const GAP16_ARTIFACT_ID = 11461161724;
const GAP16_ARTIFACT_DIGEST =
  'sha256:637969cb94bf331382bd896a3ad81f9d1650531da2050f641002403e7c6b14e9';
const GAP16_COMPOSITE_SHA256 =
  'c756fa9d80e7914e579d1bb43e2dc3c3d730ad221e0f8185dc2de2ccffc2c37a';
const GAP16_EXTERNAL_KEY_SHA256 =
  '0b4e9af1eb5af5d9677035238ac7315d2e318f790d1ef53a3944a988978b7063';
const GAP16_STRICT_VERSION_SHA256 =
  '6ae078583c0bc7171ee83a7ae1193c4321b5b7a8bfb9aa3489ac4cc19d9f16ee';

const IDENTITY_RUN_ID = 37618812260;
const IDENTITY_ARTIFACT_ID = 11480438899;
const IDENTITY_ARTIFACT_DIGEST =
  'sha256:a932390e813ae038b15fe4b24218755bc706c33d43f7b2c2a9aa9836e0ca51f6';
const IDENTITY_BRIDGE_EVENT_SHA256 =
  'd2e681055f5d684ac18649207c480b42ac0073bdff9f789dc7cb19308ee53f53';
const IDENTITY_BRIDGE_SOURCE_SHA256 =
  '828283c4ff6744eb5dc53cfdcbf8a4740a5ae14662cc7517993a3ecdf434a9f1';
const IDENTITY_SIGNATURE_MAPPING_SHA256 =
  '26e0d18d8c43f8ca3775ed971809bdf3e14b474d7f54d5c96355e3f4fc4950a8';
const IDENTITY_CURRENT_ROSTER_SHA256 =
  'dccf018ae2a46d4232ae3a29b96c82d69536f7bfaf98de94676b42fe197cd40c';

const EXPECTED_EVENTS = 16;
const EXPECTED_CURRENT_IDENTITIES = 134;
const EXPECTED_EXTRA_HISTORICAL_IDENTITIES = 3;
const CONCURRENCY = 4;

const PERSON_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);

type Json = Record<string, any>;

type FrozenCandidate = {
  compositeKey: string;
  identifier: string;
  occurredOn: string;
  externalKey: string;
  journalPage: string;
  decisiveVotes: number;
  motionText: string;
};

type ResolvedIdentity = {
  membershipId: string;
  legislatorId: string;
  memberName: string;
  lrlId?: string;
  method: string;
};

type ReconstructedVote = {
  membershipId: string;
  legislatorId: string;
  memberName: string;
  sourceName: string;
  normalizedSourceName: string;
  choice: 'yea' | 'nay';
  sourceOrdinal: number;
};

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, 'utf8')) as Json;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function setSha(values: readonly string[]): string {
  return sha256(`${[...values].sort().join('\n')}\n`);
}

function canonicalIdentifier(value: string): string {
  const match = value.replace(/\s+/g, '').toUpperCase().match(/^(HF|SF)0*(\d+)$/);
  if (!match) throw new Error(`Unsupported bill identifier: ${value}`);
  return `${match[1]}${Number(match[2])}`;
}

function frozenJournalPage(externalKey: string): string {
  const parts = externalKey.split(':');
  if (parts.length !== 5 || !parts[3]) {
    throw new Error(`Malformed frozen House external key: ${externalKey}`);
  }
  return parts[3];
}

function canonicalPersonName(value: string): string {
  const normalized = normalizeMemberName(value);
  const tokens = normalized.split(' ').filter(Boolean);
  const suffix = tokens.filter((token) => PERSON_SUFFIXES.has(token));
  const base = tokens.filter((token) => !PERSON_SUFFIXES.has(token));
  return [...base, ...suffix].join(' ');
}

function suffixStrippedAlias(value: string): string | undefined {
  const normalized = normalizeMemberName(value);
  const tokens = normalized
    .split(' ')
    .filter(Boolean)
    .filter((token) => !PERSON_SUFFIXES.has(token));
  const alias = tokens.join(' ');
  return alias && alias !== normalized ? alias : undefined;
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

function verifyGap16(value: Json): FrozenCandidate[] {
  if (
    value.schemaVersion !== 'historical-density-2025-house-replay-gap16-v1'
    || value.issue !== ISSUE
    || value.session !== SESSION
    || value.chamber !== CHAMBER
    || value.identity?.candidateCount !== EXPECTED_EVENTS
    || value.identity?.compositeKeySha256 !== GAP16_COMPOSITE_SHA256
    || value.identity?.officialExternalKeySha256 !== GAP16_EXTERNAL_KEY_SHA256
    || value.identity?.strictVersionProofSha256 !== GAP16_STRICT_VERSION_SHA256
    || value.policy?.productionDatabaseQueried !== false
    || value.policy?.targetSelectionUsesOutcomes !== false
    || value.policy?.passFailOutcomeReadOrInferred !== false
  ) {
    throw new Error('Canonical gap16 input drifted');
  }

  const candidates = (value.candidates as Json[]).map((row): FrozenCandidate => ({
    compositeKey: String(row.compositeKey),
    identifier: canonicalIdentifier(String(row.identifier)),
    occurredOn: String(row.occurredOn),
    externalKey: String(row.externalKey),
    journalPage: frozenJournalPage(String(row.externalKey)),
    decisiveVotes: Number(row.decisiveVotes),
    motionText: String(row.motionText),
  }));
  if (candidates.length !== EXPECTED_EVENTS) {
    throw new Error(`Expected 16 gap events, found ${candidates.length}`);
  }
  if (new Set(candidates.map((row) => row.externalKey)).size !== EXPECTED_EVENTS) {
    throw new Error('Gap16 external keys are not unique');
  }
  return candidates.sort((a, b) => a.compositeKey.localeCompare(b.compositeKey));
}

function verifyIdentity(value: Json): ResolvedIdentity[] {
  if (
    value.schemaVersion !== 'historical-density-2025-house-replay-gap16-identity-v1'
    || value.issue !== ISSUE
    || value.session !== SESSION
    || value.chamber !== CHAMBER
    || value.frozenInputs?.gap16?.artifactId !== GAP16_ARTIFACT_ID
    || value.frozenInputs?.gap16?.artifactDigest !== GAP16_ARTIFACT_DIGEST
    || value.bridge?.usableEvents !== 71
    || value.bridge?.bridgeEventKeySha256 !== IDENTITY_BRIDGE_EVENT_SHA256
    || value.bridge?.bridgeSourceProofSha256 !== IDENTITY_BRIDGE_SOURCE_SHA256
    || value.signatureResolution?.mappingSha256 !== IDENTITY_SIGNATURE_MAPPING_SHA256
    || value.currentRoster?.mappingSha256 !== IDENTITY_CURRENT_ROSTER_SHA256
    || value.identityCoverage?.currentPublicRosterIdentities !== EXPECTED_CURRENT_IDENTITIES
    || value.identityCoverage?.extraHistoricalIdentities !== EXPECTED_EXTRA_HISTORICAL_IDENTITIES
    || value.identityCoverage?.unresolvedAfterSignature !== 0
    || value.policy?.gap16CandidateVoteChoicesRead !== false
    || value.policy?.productionDatabaseQueried !== false
  ) {
    throw new Error('Canonical identity input drifted');
  }

  const current = (value.currentRoster?.mappings ?? []) as Json[];
  const historical = (value.extraHistoricalMemberships ?? []) as Json[];
  if (
    current.length !== EXPECTED_CURRENT_IDENTITIES
    || historical.length !== EXPECTED_EXTRA_HISTORICAL_IDENTITIES
  ) {
    throw new Error('Identity roster cardinality drifted');
  }

  const rows: ResolvedIdentity[] = [
    ...current.map((row) => ({
      membershipId: String(row.membershipId),
      legislatorId: String(row.legislatorId),
      memberName: String(row.memberName),
      lrlId: String(row.lrlId),
      method: String(row.method),
    })),
    ...historical.map((row) => ({
      membershipId: String(row.membershipId),
      legislatorId: String(row.legislatorId),
      memberName: String(row.memberName),
      method: String(row.method),
    })),
  ];

  if (
    new Set(rows.map((row) => row.membershipId)).size !== rows.length
    || new Set(rows.map((row) => row.legislatorId)).size !== rows.length
    || new Set(rows.map((row) => canonicalPersonName(row.memberName))).size !== rows.length
  ) {
    throw new Error('Identity input is not one-to-one across 137 historical memberships');
  }
  return rows;
}

function sourceCandidates(identities: readonly ResolvedIdentity[]): MembershipCandidate[] {
  return identities.map((row) => {
    const aliases = [
      ...(row.lrlId
        ? officialMembershipAliasesForLrlId(row.lrlId).map((alias) => alias.sourceName)
        : []),
      ...(suffixStrippedAlias(row.memberName)
        ? [suffixStrippedAlias(row.memberName)!]
        : []),
    ];
    return {
      membershipId: row.membershipId,
      legislatorId: row.legislatorId,
      name: row.memberName,
      aliases,
    };
  });
}

async function main(): Promise<void> {
  const gap = readJson(env('VOTEPREDICT_GAP16_PATH'));
  const identity = readJson(env('VOTEPREDICT_GAP16_IDENTITY_PATH'));
  const output = resolve(env('VOTEPREDICT_GAP16_MEMBER_VOTES_OUTPUT'));

  const candidates = verifyGap16(gap);
  const identities = verifyIdentity(identity);
  const identityByMembership = new Map<string, ResolvedIdentity>(
    identities.map((row) => [row.membershipId, row]),
  );
  const candidatesForResolution = sourceCandidates(identities);
  const session = getMinnesotaHouseSession(SESSION);

  const detailByIdentifier = new Map<string, ReturnType<typeof parseHouseVoteDetailHtml>>();
  const identifiers = [...new Set(candidates.map((row) => row.identifier))].sort();
  const details = await mapLimit(identifiers, CONCURRENCY, async (identifier) => {
    const page = await retry(() => fetchHouseVoteDetail(session.sessionKey, identifier));
    return {
      identifier,
      events: parseHouseVoteDetailHtml({
        html: page.html,
        sessionKey: session.sessionKey,
        sourceUrl: page.sourceUrl,
      }),
    };
  });
  for (const row of details) detailByIdentifier.set(row.identifier, row.events);

  const reconstructed = candidates.map((candidate) => {
    const pageEvents = detailByIdentifier.get(candidate.identifier) ?? [];
    const exactExternalKey = pageEvents.filter(
      (event) => event.externalKey === candidate.externalKey,
    );
    const stableIdentity = pageEvents.filter(
      (event) =>
        event.isPassage
        && canonicalIdentifier(String(event.billIdentifier)) === candidate.identifier
        && event.occurredOn === candidate.occurredOn
        && String(event.journalPage ?? 'no-journal') === candidate.journalPage
        && event.yeaCount + event.nayCount === candidate.decisiveVotes
        && event.motionText === candidate.motionText,
    );
    const selected = exactExternalKey.length === 1 ? exactExternalKey : stableIdentity;
    if (selected.length !== 1) {
      throw new Error(
        `Expected one stable official event for ${candidate.compositeKey}; `
        + `exactExternalKey=${exactExternalKey.length}, stableIdentity=${stableIdentity.length}`,
      );
    }
    const event = selected[0]!;
    if (
      !event.isPassage
      || canonicalIdentifier(String(event.billIdentifier)) !== candidate.identifier
      || event.occurredOn !== candidate.occurredOn
      || String(event.journalPage ?? 'no-journal') !== candidate.journalPage
      || event.yeaCount + event.nayCount !== candidate.decisiveVotes
      || event.motionText !== candidate.motionText
    ) {
      throw new Error(`Official event identity drifted for ${candidate.compositeKey}`);
    }

    const votes: ReconstructedVote[] = [];
    const unmatched: string[] = [];
    const ambiguous: Array<{ sourceName: string; membershipIds: string[] }> = [];

    for (const vote of event.memberVotes) {
      if (vote.choice !== 'yea' && vote.choice !== 'nay') continue;
      const resolution = reconcileHouseMemberName(vote.sourceName, candidatesForResolution);
      if (resolution.status === 'unmatched') {
        unmatched.push(vote.sourceName);
        continue;
      }
      if (resolution.status === 'ambiguous') {
        ambiguous.push({
          sourceName: vote.sourceName,
          membershipIds: [...resolution.candidateMembershipIds].sort(),
        });
        continue;
      }
      const resolved = identityByMembership.get(resolution.membershipId);
      if (!resolved || resolved.legislatorId !== resolution.legislatorId) {
        throw new Error(`Resolved identity missing for House voter ${vote.sourceName}`);
      }
      votes.push({
        membershipId: resolved.membershipId,
        legislatorId: resolved.legislatorId,
        memberName: resolved.memberName,
        sourceName: vote.sourceName,
        normalizedSourceName: vote.normalizedName,
        choice: vote.choice,
        sourceOrdinal: vote.sourceOrdinal,
      });
    }

    if (unmatched.length > 0 || ambiguous.length > 0) {
      throw new Error(
        `Unresolved House voters for ${candidate.compositeKey}: `
        + JSON.stringify({ unmatched, ambiguous }),
      );
    }
    if (votes.length !== candidate.decisiveVotes) {
      throw new Error(
        `Resolved vote count drifted for ${candidate.compositeKey}: ${votes.length}`,
      );
    }
    if (new Set(votes.map((row) => row.membershipId)).size !== votes.length) {
      throw new Error(`Duplicate membership vote for ${candidate.compositeKey}`);
    }
    if (new Set(votes.map((row) => row.legislatorId)).size !== votes.length) {
      throw new Error(`Duplicate legislator vote for ${candidate.compositeKey}`);
    }

    const yea = votes.filter((row) => row.choice === 'yea').length;
    const nay = votes.filter((row) => row.choice === 'nay').length;
    if (yea !== event.yeaCount || nay !== event.nayCount) {
      throw new Error(`Reconstructed tally drifted for ${candidate.compositeKey}`);
    }

    return {
      compositeKey: candidate.compositeKey,
      identifier: candidate.identifier,
      occurredOn: candidate.occurredOn,
      frozenOfficialExternalKey: candidate.externalKey,
      currentParsedExternalKey: event.externalKey,
      externalKeyExactMatch: event.externalKey === candidate.externalKey,
      journalPage: event.journalPage ?? null,
      sourceUrl: event.sourceUrl,
      motionText: event.motionText,
      voteKind: event.voteKind,
      isPassage: event.isPassage,
      yeaCount: event.yeaCount,
      nayCount: event.nayCount,
      decisiveVotes: votes.length,
      passFailOutcome: null,
      passFailOutcomeStatus: 'not_read_or_inferred' as const,
      memberVotes: votes.sort((a, b) => a.sourceOrdinal - b.sourceOrdinal),
    };
  });

  const totalMemberVotes = reconstructed.reduce(
    (sum, event) => sum + event.memberVotes.length,
    0,
  );
  const eventProofSha256 = setSha(
    reconstructed.map(
      (event) =>
        `${event.compositeKey}|${event.frozenOfficialExternalKey}|${event.journalPage ?? 'no-journal'}|${event.yeaCount}|${event.nayCount}|${sha256(event.motionText)}`,
    ),
  );
  const memberVoteRowSha256 = setSha(
    reconstructed.flatMap((event) =>
      event.memberVotes.map(
        (vote) =>
          `${event.frozenOfficialExternalKey}|${vote.membershipId}|${vote.legislatorId}|${vote.choice}|${vote.sourceOrdinal}|${normalizeMemberName(vote.sourceName)}`,
      )
    ),
  );
  const membershipCoverage = new Set(
    reconstructed.flatMap((event) => event.memberVotes.map((vote) => vote.membershipId)),
  );
  const externalKeyOrdinalDriftEvents = reconstructed.filter(
    (event) => !event.externalKeyExactMatch,
  ).length;

  const report = {
    schemaVersion: 'historical-density-2025-house-replay-gap16-member-votes-v1',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    session: SESSION,
    chamber: CHAMBER,
    frozenInputs: {
      gap16: {
        runId: GAP16_RUN_ID,
        artifactId: GAP16_ARTIFACT_ID,
        artifactDigest: GAP16_ARTIFACT_DIGEST,
        compositeKeySha256: GAP16_COMPOSITE_SHA256,
        officialExternalKeySha256: GAP16_EXTERNAL_KEY_SHA256,
        strictVersionProofSha256: GAP16_STRICT_VERSION_SHA256,
      },
      identity: {
        runId: IDENTITY_RUN_ID,
        artifactId: IDENTITY_ARTIFACT_ID,
        artifactDigest: IDENTITY_ARTIFACT_DIGEST,
        bridgeEventKeySha256: IDENTITY_BRIDGE_EVENT_SHA256,
        bridgeSourceProofSha256: IDENTITY_BRIDGE_SOURCE_SHA256,
        signatureMappingSha256: IDENTITY_SIGNATURE_MAPPING_SHA256,
        currentRosterMappingSha256: IDENTITY_CURRENT_ROSTER_SHA256,
      },
    },
    reconstruction: {
      events: reconstructed.length,
      totalMemberVotes,
      uniqueMembershipsObserved: membershipCoverage.size,
      externalKeyOrdinalDriftEvents,
      unmatchedDecisiveVoters: 0,
      ambiguousDecisiveVoters: 0,
      tallyParityEvents: reconstructed.length,
      eventProofSha256,
      memberVoteRowSha256,
      eventsData: reconstructed,
    },
    interpretation: {
      established:
        'All 16 frozen replay-gap House passage events can be reconstructed from official House yea/nay rosters into the frozen internal historical membership identity space with exact event-level tally parity.',
      notEstablished:
        'This artifact does not establish bill pass/fail outcomes, database bill/vote-event UUIDs for the 16 missing events, companion-reference state, or a complete historical Quick replay dataset for the added events.',
      nextStep:
        'Audit what additional as-of replay state is required to evaluate these 16 events without mutable production data. Do not infer pass/fail from the roll-call tally.',
    },
    policy: {
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      candidateSetFrozenBeforeVoteChoiceRead: true,
      identityMapFrozenBeforeVoteChoiceRead: true,
      candidateMemberVoteChoicesRead: true,
      candidateVoteChoiceUse: 'replay_extension_reconstruction_only',
      passFailOutcomeReadOrInferred: false,
      passFailOutcomeUse: 'none',
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
    historicalDensity2025HouseReplayGap16MemberVotes: {
      events: reconstructed.length,
      totalMemberVotes,
      uniqueMembershipsObserved: membershipCoverage.size,
      externalKeyOrdinalDriftEvents,
      eventProofSha256,
      memberVoteRowSha256,
      passFailOutcomeReadOrInferred: false,
      productionDatabaseQueried: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
