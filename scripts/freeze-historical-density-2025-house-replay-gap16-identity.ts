import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  fetchHouseVoteDetail,
  parseHouseVoteDetailHtml,
  normalizeMemberName,
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

const MATRIX_GZIP_SHA256 =
  'd8a9735a514f427508a7a37303ba312dcac3f929a51aa05a1aba32a76b384637';
const MATRIX_CANONICAL_SHA256 =
  'c97ac50c8c89ae0548cc48bed65a42c22f332e2977b33173619c9e258c09a4d0';
const EXPECTED_MATRIX_ROWS = 135457;
const EXPECTED_MATRIX_EVENTS = 1339;
const EXPECTED_2025_HOUSE_MEMBERSHIPS = 137;

const GAP16_RUN_ID = 37572160059;
const GAP16_ARTIFACT_ID = 11461161724;
const GAP16_ARTIFACT_DIGEST =
  'sha256:637969cb94bf331382bd896a3ad81f9d1650531da2050f641002403e7c6b14e9';
const GAP16_COMPOSITE_SHA =
  'c756fa9d80e7914e579d1bb43e2dc3c3d730ad221e0f8185dc2de2ccffc2c37a';
const GAP16_EXTERNAL_SHA =
  '0b4e9af1eb5af5d9677035238ac7315d2e318f790d1ef53a3944a988978b7063';
const GAP16_VERSION_SHA =
  '6ae078583c0bc7171ee83a7ae1193c4321b5b7a8bfb9aa3489ac4cc19d9f16ee';

const COMMITTEE_ARTIFACT_ID = 10652783041;
const COMMITTEE_ARTIFACT_DIGEST =
  'sha256:0fdea28f30cb88f4d0df30e567f694d8c7ae124515a65ece802c871518c71f92';
const DEEP_OUTCOME_ARTIFACT_ID = 10304963037;
const DEEP_OUTCOME_ARTIFACT_DIGEST =
  'sha256:a2ec289b7bd58a2d996739ac91df64601f91e3888a00e2bf97a7b9d8f6bc4fff';
const PUBLIC_INVENTORY_ARTIFACT_ID = 11440840273;
const PUBLIC_INVENTORY_ARTIFACT_DIGEST =
  'sha256:07ee41210122f42716269ab56f8775d78e10d00df39740315acc1ce055937c20';

const EXPECTED_DIRECT_2025_IDENTITIES = 112;
const EXPECTED_STABLE_PRIOR_SESSION_IDENTITIES = 18;
const EXPECTED_PRE_SIGNATURE_IDENTITIES = 130;
const EXPECTED_PUBLIC_CURRENT_MEMBERS = 134;
const EXPECTED_KNOWN_CURRENT_IDENTITIES = 127;
const EXPECTED_SIGNATURE_IDENTITIES = 7;
const EXPECTED_EXTRA_HISTORICAL_IDENTITIES = 3;

const BRIDGE_START = '2025-03-20';
const BRIDGE_END = '2026-03-11';
const MIN_USABLE_BRIDGE_EVENTS = 40;
const CONCURRENCY = 6;

const EXPECTED_UNRESOLVED_PUBLIC_NAMES = [
  'Alexander Falconer',
  'David Gottfried',
  'Huldah Momanyi-Hiltsley',
  'James Gordon',
  'Peter Johnson',
  'Steve Gander',
  'Wayne A. Johnson',
] as const;

const EXPECTED_EXTRA_HISTORICAL_NAMES = [
  'Meg Luger-Nikolai',
  'Shelley Buck',
  'Xp Lee',
] as const;

type Json = Record<string, any>;

type MatrixEvent = {
  voteEventId: string;
  identifier: string;
  occurredOn: string;
  actualYes: number;
  rows: Map<string, 0 | 1 | null>;
};

type InternalIdentity = {
  membershipId: string;
  legislatorId: string;
  memberName: string;
  canonicalName: string;
  method: '2025_committee_artifact' | 'stable_legislator_from_2023';
};

type PublicIdentity = {
  lrlId: string;
  memberName: string;
  canonicalName: string;
  districts: string[];
  parties: string[];
};

type BridgeAudit = {
  compositeKey: string;
  identifier: string;
  occurredOn: string;
  voteEventId: string;
  officialExternalKey: string;
  yeaCount: number;
  nayCount: number;
  knownIdentityComparisons: number;
  publicChoices: Record<string, 0 | 1 | null>;
};

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function setSha(values: readonly string[]): string {
  return sha256(`${[...values].sort().join('\n')}\n`);
}

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, 'utf8')) as Json;
}

function canonicalIdentifier(value: string): string {
  const match = value.replace(/\s+/g, '').toUpperCase().match(/^(HF|SF)0*(\d+)$/);
  if (!match) throw new Error(`Unsupported bill identifier: ${value}`);
  return `${match[1]}${Number(match[2])}`;
}

function canonicalPersonName(value: string): string {
  const normalized = normalizeMemberName(value);
  const tokens = normalized.split(' ').filter(Boolean);
  const suffixes = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);
  const suffix = tokens.filter((token) => suffixes.has(token));
  const base = tokens.filter((token) => !suffixes.has(token));
  return [...base, ...suffix].join(' ');
}

function compositeKey(identifier: string, occurredOn: string): string {
  return `${canonicalIdentifier(identifier)}|${occurredOn}`;
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
          setTimeout(resolveDelay, attempt * 650),
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
  async function worker() {
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

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function assertExactStringSet(
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): void {
  const a = sortedUnique(actual);
  const e = sortedUnique(expected);
  if (JSON.stringify(a) !== JSON.stringify(e)) {
    throw new Error(`${label} drifted: ${JSON.stringify(a)}`);
  }
}

function mainMatrix() {
  const manifest = readJson(env('VOTEPREDICT_HISTORICAL_AS_OF_MANIFEST_PATH'));
  const gzipBytes = readFileSync(env('VOTEPREDICT_HISTORICAL_AS_OF_MATRIX_PATH'));
  if (
    manifest.schemaVersion !== 'historical-as-of-matrix-v1-manifest'
    || manifest.issue !== 459
    || manifest.rows !== EXPECTED_MATRIX_ROWS
    || manifest.events !== EXPECTED_MATRIX_EVENTS
    || manifest.matrixGzipSha256 !== MATRIX_GZIP_SHA256
    || manifest.matrixCanonicalNdjsonSha256 !== MATRIX_CANONICAL_SHA256
  ) {
    throw new Error('Original historical-as-of manifest drifted');
  }
  if (sha256(gzipBytes) !== MATRIX_GZIP_SHA256) {
    throw new Error('Original matrix gzip digest mismatch');
  }
  const canonical = gunzipSync(gzipBytes).toString('utf8');
  if (sha256(canonical) !== MATRIX_CANONICAL_SHA256) {
    throw new Error('Original matrix canonical digest mismatch');
  }

  const roster = new Map<string, string>();
  const events = new Map<string, MatrixEvent>();
  let rowCount = 0;
  for (const line of canonical.trimEnd().split('\n')) {
    rowCount += 1;
    const row = JSON.parse(line) as Json;
    if (row.session !== SESSION || row.chamber !== CHAMBER) continue;

    const membershipId = String(row.membershipId);
    const legislatorId = String(row.legislatorId);
    const priorLegislator = roster.get(membershipId);
    if (priorLegislator && priorLegislator !== legislatorId) {
      throw new Error(`Membership legislator identity drifted: ${membershipId}`);
    }
    roster.set(membershipId, legislatorId);

    const outcome = row.outcome;
    if (outcome !== null && outcome !== 0 && outcome !== 1) {
      throw new Error(`Unexpected member outcome encoding: ${String(outcome)}`);
    }

    const voteEventId = String(row.voteEventId);
    let event = events.get(voteEventId);
    if (!event) {
      event = {
        voteEventId,
        identifier: canonicalIdentifier(String(row.identifier)),
        occurredOn: String(row.occurredOn),
        actualYes: Number(row.actualYes),
        rows: new Map(),
      };
      events.set(voteEventId, event);
    }
    if (
      event.identifier !== canonicalIdentifier(String(row.identifier))
      || event.occurredOn !== String(row.occurredOn)
      || event.actualYes !== Number(row.actualYes)
    ) {
      throw new Error(`Matrix event identity drifted: ${voteEventId}`);
    }
    if (event.rows.has(membershipId)) {
      throw new Error(`Duplicate matrix membership row: ${voteEventId}|${membershipId}`);
    }
    event.rows.set(membershipId, outcome as 0 | 1 | null);
  }
  if (rowCount !== EXPECTED_MATRIX_ROWS) {
    throw new Error(`Original matrix row count drifted: ${rowCount}`);
  }
  if (roster.size !== EXPECTED_2025_HOUSE_MEMBERSHIPS) {
    throw new Error(`2025 House membership count drifted: ${roster.size}`);
  }

  // The replay matrix is not a complete chamber census for every event; some
  // events omit one or more memberships. Row-level outcome semantics are
  // validated later against the frozen public House vote source across all
  // already-known identities on each usable bridge event.
  return { roster, events };
}

function identitySources(roster: Map<string, string>) {
  const committee = readJson(env('VOTEPREDICT_COMMITTEE_CANDIDATES_PATH'));
  if (
    committee.schemaVersion !== 'quick-evidence-committee-rollcall-candidates-v1'
    || committee.metadata?.outcomeUse !== 'none'
    || !Array.isArray(committee.observations)
  ) {
    throw new Error('Committee identity artifact drifted');
  }

  const direct = new Map<string, InternalIdentity>();
  for (const observation of committee.observations as Json[]) {
    if (observation.session !== SESSION) continue;
    const membershipId = String(observation.membershipId);
    const legislatorId = String(observation.legislatorId);
    if (roster.get(membershipId) !== legislatorId) {
      throw new Error(`Committee identity is not in 2025 House roster: ${membershipId}`);
    }
    const identity: InternalIdentity = {
      membershipId,
      legislatorId,
      memberName: String(observation.memberName),
      canonicalName: canonicalPersonName(String(observation.memberName)),
      method: '2025_committee_artifact',
    };
    const prior = direct.get(membershipId);
    if (
      prior
      && (
        prior.legislatorId !== identity.legislatorId
        || prior.canonicalName !== identity.canonicalName
      )
    ) {
      throw new Error(`Committee member identity conflict: ${membershipId}`);
    }
    direct.set(membershipId, identity);
  }
  if (direct.size !== EXPECTED_DIRECT_2025_IDENTITIES) {
    throw new Error(`Direct 2025 identity count drifted: ${direct.size}`);
  }

  const deep = readJson(env('VOTEPREDICT_DEEP_OUTCOME_PATH'));
  if (
    deep.schemaVersion !== 'historical-deep-outcome-snapshot-v1'
    || !Array.isArray(deep.cases)
  ) {
    throw new Error('Historical deep identity artifact drifted');
  }
  const namesByLegislator = new Map<string, Set<string>>();
  for (const row of deep.cases as Json[]) {
    for (const member of (row.members ?? []) as Json[]) {
      const legislatorId = String(member.legislatorId);
      const names = namesByLegislator.get(legislatorId) ?? new Set<string>();
      names.add(String(member.memberName));
      namesByLegislator.set(legislatorId, names);
    }
  }

  const resolved = new Map(direct);
  let stableCount = 0;
  for (const [membershipId, legislatorId] of roster) {
    if (resolved.has(membershipId)) continue;
    const names = namesByLegislator.get(legislatorId);
    if (!names || names.size !== 1) continue;
    const memberName = [...names][0]!;
    resolved.set(membershipId, {
      membershipId,
      legislatorId,
      memberName,
      canonicalName: canonicalPersonName(memberName),
      method: 'stable_legislator_from_2023',
    });
    stableCount += 1;
  }
  if (stableCount !== EXPECTED_STABLE_PRIOR_SESSION_IDENTITIES) {
    throw new Error(`Stable-legislator identity count drifted: ${stableCount}`);
  }
  if (resolved.size !== EXPECTED_PRE_SIGNATURE_IDENTITIES) {
    throw new Error(`Pre-signature identity count drifted: ${resolved.size}`);
  }

  return resolved;
}

function publicRoster() {
  const inventory = readJson(env('VOTEPREDICT_PUBLIC_INVENTORY_PATH'));
  if (
    inventory.schemaVersion !== 'historical-density-2025-house-member-primary-inventory-v1'
    || inventory.issue !== ISSUE
    || inventory.session !== SESSION
    || inventory.publicRoster?.relevantHouseMembers !== EXPECTED_PUBLIC_CURRENT_MEMBERS
    || inventory.policy?.productionDatabaseQueried !== false
    || inventory.policy?.targetVoteOutcomesRead !== false
  ) {
    throw new Error('Frozen public House roster artifact drifted');
  }

  const byLrl = new Map<string, PublicIdentity>();
  for (const entry of inventory.archiveInventory?.sourceEntries ?? []) {
    const lrlId = String(entry.lrlId);
    const memberName = String(entry.memberName);
    const next: PublicIdentity = {
      lrlId,
      memberName,
      canonicalName: canonicalPersonName(memberName),
      districts: sortedUnique((entry.districts ?? []).map(String)),
      parties: sortedUnique((entry.parties ?? []).map(String)),
    };
    const prior = byLrl.get(lrlId);
    if (
      prior
      && (
        prior.canonicalName !== next.canonicalName
        || JSON.stringify(prior.districts) !== JSON.stringify(next.districts)
        || JSON.stringify(prior.parties) !== JSON.stringify(next.parties)
      )
    ) {
      throw new Error(`Public roster identity conflict for LRL ${lrlId}`);
    }
    byLrl.set(lrlId, next);
  }
  if (byLrl.size !== EXPECTED_PUBLIC_CURRENT_MEMBERS) {
    throw new Error(`Public roster size drifted: ${byLrl.size}`);
  }
  const canonicalNames = new Set([...byLrl.values()].map((row) => row.canonicalName));
  if (canonicalNames.size !== EXPECTED_PUBLIC_CURRENT_MEMBERS) {
    throw new Error('Public current roster does not have unique canonical names');
  }
  return byLrl;
}

async function main(): Promise<void> {
  const gap = readJson(env('VOTEPREDICT_GAP16_PATH'));
  if (
    gap.schemaVersion !== 'historical-density-2025-house-replay-gap16-v1'
    || gap.issue !== ISSUE
    || gap.session !== SESSION
    || gap.chamber !== CHAMBER
    || gap.identity?.candidateCount !== 16
    || gap.identity?.compositeKeySha256 !== GAP16_COMPOSITE_SHA
    || gap.identity?.officialExternalKeySha256 !== GAP16_EXTERNAL_SHA
    || gap.identity?.strictVersionProofSha256 !== GAP16_VERSION_SHA
    || gap.policy?.targetSelectionUsesOutcomes !== false
  ) {
    throw new Error('Canonical gap16 artifact drifted');
  }

  const gapIdentifiers = new Set(
    (gap.candidates as Json[]).map((row) => canonicalIdentifier(String(row.identifier))),
  );
  if (gapIdentifiers.size !== 16) {
    throw new Error(`Gap16 bill identifier count drifted: ${gapIdentifiers.size}`);
  }

  const { roster, events } = mainMatrix();
  const preSignature = identitySources(roster);
  const publicByLrl = publicRoster();
  const publicByCanonical = new Map(
    [...publicByLrl.values()].map((row) => [row.canonicalName, row] as const),
  );

  const knownCurrent = new Map<string, InternalIdentity>();
  const extraHistorical: InternalIdentity[] = [];
  for (const identity of preSignature.values()) {
    if (publicByCanonical.has(identity.canonicalName)) {
      if (knownCurrent.has(identity.canonicalName)) {
        throw new Error(`Duplicate known current identity: ${identity.memberName}`);
      }
      knownCurrent.set(identity.canonicalName, identity);
    } else {
      extraHistorical.push(identity);
    }
  }

  if (knownCurrent.size !== EXPECTED_KNOWN_CURRENT_IDENTITIES) {
    throw new Error(`Known-current identity count drifted: ${knownCurrent.size}`);
  }
  if (extraHistorical.length !== EXPECTED_EXTRA_HISTORICAL_IDENTITIES) {
    throw new Error(`Extra historical identity count drifted: ${extraHistorical.length}`);
  }
  assertExactStringSet(
    extraHistorical.map((row) => row.memberName),
    EXPECTED_EXTRA_HISTORICAL_NAMES,
    'Extra historical member names',
  );

  const unresolvedPublic = [...publicByCanonical.entries()]
    .filter(([canonical]) => !knownCurrent.has(canonical))
    .map(([, row]) => row)
    .sort((a, b) => a.memberName.localeCompare(b.memberName));
  assertExactStringSet(
    unresolvedPublic.map((row) => row.memberName),
    EXPECTED_UNRESOLVED_PUBLIC_NAMES,
    'Unresolved public member names',
  );

  const unresolvedInternal = [...roster.entries()]
    .filter(([membershipId]) => !preSignature.has(membershipId))
    .map(([membershipId, legislatorId]) => ({ membershipId, legislatorId }))
    .sort((a, b) => a.membershipId.localeCompare(b.membershipId));
  if (unresolvedInternal.length !== EXPECTED_SIGNATURE_IDENTITIES) {
    throw new Error(
      `Unresolved internal identity count drifted: ${unresolvedInternal.length}`,
    );
  }

  const sourceCandidates: MembershipCandidate[] = [...publicByLrl.values()].map((row) => ({
    membershipId: `public-lrl:${row.lrlId}`,
    legislatorId: `public-lrl:${row.lrlId}`,
    name: row.memberName,
    aliases: officialMembershipAliasesForLrlId(row.lrlId).map((alias) => alias.sourceName),
  }));
  const publicByFakeMembership = new Map(
    [...publicByLrl.values()].map((row) => [`public-lrl:${row.lrlId}`, row] as const),
  );

  const byComposite = new Map<string, MatrixEvent[]>();
  for (const event of events.values()) {
    if (event.occurredOn < BRIDGE_START || event.occurredOn > BRIDGE_END) continue;
    if (gapIdentifiers.has(event.identifier)) continue;
    const key = compositeKey(event.identifier, event.occurredOn);
    const rows = byComposite.get(key) ?? [];
    rows.push(event);
    byComposite.set(key, rows);
  }
  const bridgeTargets = [...byComposite.entries()]
    .filter(([, rows]) => rows.length === 1)
    .map(([key, rows]) => ({ compositeKey: key, event: rows[0]! }))
    .sort((a, b) => a.compositeKey.localeCompare(b.compositeKey));

  const identifiers = sortedUnique(bridgeTargets.map((row) => row.event.identifier));
  const session = getMinnesotaHouseSession(SESSION);
  const officialByIdentifier = new Map<string, ReturnType<typeof parseHouseVoteDetailHtml>>();
  const fetched = await mapLimit(identifiers, CONCURRENCY, async (identifier) => {
    const detail = await retry(() => fetchHouseVoteDetail(session.sessionKey, identifier));
    const parsed = parseHouseVoteDetailHtml({
      html: detail.html,
      sessionKey: session.sessionKey,
      sourceUrl: detail.sourceUrl,
    });
    return { identifier, parsed };
  });
  for (const row of fetched) officialByIdentifier.set(row.identifier, row.parsed);

  const skippedBridgeEvents: Array<{ compositeKey: string; reason: string }> = [];
  const knownMismatchDiagnostics = new Map<string, {
    memberName: string;
    method: string;
    mismatches: number;
    comparisons: number;
    valuePairs: Record<string, number>;
    examples: string[];
  }>();
  const usable: BridgeAudit[] = [];

  for (const target of bridgeTargets) {
    const matrixEvent = target.event;
    const official = (officialByIdentifier.get(matrixEvent.identifier) ?? []).filter(
      (row) =>
        row.isPassage
        && canonicalIdentifier(String(row.billIdentifier)) === matrixEvent.identifier
        && row.occurredOn === matrixEvent.occurredOn,
    );
    if (official.length !== 1) {
      skippedBridgeEvents.push({
        compositeKey: target.compositeKey,
        reason: `official passage multiplicity ${official.length}`,
      });
      continue;
    }
    const officialEvent = official[0]!;
    const publicChoices = new Map<string, 0 | 1>();
    let ambiguous = false;
    for (const vote of officialEvent.memberVotes) {
      const resolution = reconcileHouseMemberName(vote.sourceName, sourceCandidates);
      if (resolution.status === 'ambiguous') {
        ambiguous = true;
        break;
      }
      if (resolution.status !== 'matched') continue;
      const publicIdentity = publicByFakeMembership.get(resolution.membershipId);
      if (!publicIdentity) throw new Error('Public resolver emitted unknown fake membership');
      const value = vote.choice === 'yea' ? 1 : 0;
      const prior = publicChoices.get(publicIdentity.canonicalName);
      if (prior !== undefined && prior !== value) {
        throw new Error(
          `Conflicting official public vote for ${publicIdentity.memberName} on ${target.compositeKey}`,
        );
      }
      publicChoices.set(publicIdentity.canonicalName, value);
    }
    if (ambiguous) {
      skippedBridgeEvents.push({
        compositeKey: target.compositeKey,
        reason: 'ambiguous public member-name resolution',
      });
      continue;
    }

    let comparisons = 0;
    let mismatch = false;
    for (const [canonicalName, identity] of knownCurrent) {
      const internalValue = matrixEvent.rows.get(identity.membershipId) ?? null;
      const publicValue = publicChoices.get(canonicalName) ?? null;
      const diagnostic = knownMismatchDiagnostics.get(canonicalName) ?? {
        memberName: identity.memberName,
        method: identity.method,
        mismatches: 0,
        comparisons: 0,
        valuePairs: {},
        examples: [],
      };
      diagnostic.comparisons += 1;
      const pairKey = `${String(internalValue)}->${String(publicValue)}`;
      diagnostic.valuePairs[pairKey] = (diagnostic.valuePairs[pairKey] ?? 0) + 1;
      if (internalValue !== publicValue) {
        diagnostic.mismatches += 1;
        if (diagnostic.examples.length < 5) diagnostic.examples.push(target.compositeKey);
        mismatch = true;
      }
      knownMismatchDiagnostics.set(canonicalName, diagnostic);
      comparisons += 1;
    }
    if (mismatch) {
      skippedBridgeEvents.push({
        compositeKey: target.compositeKey,
        reason: 'known-identity signature mismatch',
      });
      continue;
    }

    const unresolvedChoices: Record<string, 0 | 1 | null> = {};
    for (const publicIdentity of unresolvedPublic) {
      unresolvedChoices[publicIdentity.canonicalName] =
        publicChoices.get(publicIdentity.canonicalName) ?? null;
    }
    usable.push({
      compositeKey: target.compositeKey,
      identifier: matrixEvent.identifier,
      occurredOn: matrixEvent.occurredOn,
      voteEventId: matrixEvent.voteEventId,
      officialExternalKey: officialEvent.externalKey,
      yeaCount: officialEvent.yeaCount,
      nayCount: officialEvent.nayCount,
      knownIdentityComparisons: comparisons,
      publicChoices: unresolvedChoices,
    });
  }

  usable.sort((a, b) => a.compositeKey.localeCompare(b.compositeKey));
  if (usable.length < MIN_USABLE_BRIDGE_EVENTS) {
    const reasonCounts = skippedBridgeEvents.reduce<Record<string, number>>(
      (acc, row) => {
        acc[row.reason] = (acc[row.reason] ?? 0) + 1;
        return acc;
      },
      {},
    );
    console.error(JSON.stringify({
      bridgeDiagnostics: {
        bridgeTargets: bridgeTargets.length,
        usable: usable.length,
        skipped: skippedBridgeEvents.length,
        reasonCounts,
        worstKnownIdentityMismatches: [...knownMismatchDiagnostics.values()]
          .filter((row) => row.mismatches > 0)
          .sort((a, b) => b.mismatches - a.mismatches || a.memberName.localeCompare(b.memberName))
          .slice(0, 30),
        examples: skippedBridgeEvents.slice(0, 20),
      },
    }, null, 2));
    throw new Error(`Insufficient clean bridge events: ${usable.length}`);
  }

  const signatureForInternal = (membershipId: string) =>
    usable.map((bridge) => {
      const event = events.get(bridge.voteEventId)!;
      const value = event.rows.get(membershipId) ?? null;
      return value === null ? 'x' : String(value);
    }).join('');

  const signatureForPublic = (canonicalName: string) =>
    usable.map((bridge) => {
      const value = bridge.publicChoices[canonicalName] ?? null;
      return value === null ? 'x' : String(value);
    }).join('');

  const publicSignatureRows = unresolvedPublic.map((row) => ({
    ...row,
    signature: signatureForPublic(row.canonicalName),
  }));
  const internalSignatureRows = unresolvedInternal.map((row) => ({
    ...row,
    signature: signatureForInternal(row.membershipId),
  }));

  if (
    new Set(publicSignatureRows.map((row) => row.signature)).size
      !== EXPECTED_SIGNATURE_IDENTITIES
    || new Set(internalSignatureRows.map((row) => row.signature)).size
      !== EXPECTED_SIGNATURE_IDENTITIES
  ) {
    throw new Error('Bridge signatures are not unique across the unresolved seven');
  }

  const signatureMappings = internalSignatureRows.map((internal) => {
    const matches = publicSignatureRows.filter(
      (publicRow) => publicRow.signature === internal.signature,
    );
    if (matches.length !== 1) {
      throw new Error(
        `Expected one public signature match for ${internal.membershipId}; got ${matches.length}`,
      );
    }
    const publicRow = matches[0]!;
    return {
      membershipId: internal.membershipId,
      legislatorId: internal.legislatorId,
      lrlId: publicRow.lrlId,
      memberName: publicRow.memberName,
      canonicalName: publicRow.canonicalName,
      districts: publicRow.districts,
      parties: publicRow.parties,
      method: 'frozen_non_gap_rollcall_signature' as const,
      bridgeEventCount: usable.length,
      signatureSha256: sha256(internal.signature),
    };
  }).sort((a, b) => a.memberName.localeCompare(b.memberName));

  assertExactStringSet(
    signatureMappings.map((row) => row.memberName),
    EXPECTED_UNRESOLVED_PUBLIC_NAMES,
    'Resolved signature member names',
  );

  const currentMappings = [
    ...knownCurrent.values().map((identity) => {
      const publicIdentity = publicByCanonical.get(identity.canonicalName)!;
      return {
        membershipId: identity.membershipId,
        legislatorId: identity.legislatorId,
        lrlId: publicIdentity.lrlId,
        memberName: publicIdentity.memberName,
        canonicalName: publicIdentity.canonicalName,
        districts: publicIdentity.districts,
        parties: publicIdentity.parties,
        method: identity.method,
      };
    }),
    ...signatureMappings.map(({ signatureSha256: _ignored, bridgeEventCount: _count, ...row }) => row),
  ].sort((a, b) => a.memberName.localeCompare(b.memberName));

  if (currentMappings.length !== EXPECTED_PUBLIC_CURRENT_MEMBERS) {
    throw new Error(`Resolved current roster count drifted: ${currentMappings.length}`);
  }
  if (
    new Set(currentMappings.map((row) => row.membershipId)).size
      !== EXPECTED_PUBLIC_CURRENT_MEMBERS
    || new Set(currentMappings.map((row) => row.legislatorId)).size
      !== EXPECTED_PUBLIC_CURRENT_MEMBERS
    || new Set(currentMappings.map((row) => row.canonicalName)).size
      !== EXPECTED_PUBLIC_CURRENT_MEMBERS
  ) {
    throw new Error('Resolved current roster is not one-to-one');
  }

  const bridgeEventKeySha256 = setSha(usable.map((row) => row.compositeKey));
  const bridgeSourceProofSha256 = setSha(
    usable.map(
      (row) =>
        `${row.compositeKey}|${row.officialExternalKey}|${row.yeaCount}|${row.nayCount}`,
    ),
  );
  const signatureMappingSha256 = setSha(
    signatureMappings.map(
      (row) =>
        `${row.membershipId}|${row.legislatorId}|${row.lrlId}|${row.canonicalName}|${row.signatureSha256}`,
    ),
  );
  const currentRosterMappingSha256 = setSha(
    currentMappings.map(
      (row) =>
        `${row.membershipId}|${row.legislatorId}|${row.lrlId}|${row.canonicalName}|${row.method}`,
    ),
  );

  const output = resolve(env('VOTEPREDICT_GAP16_IDENTITY_OUTPUT'));
  const report = {
    schemaVersion: 'historical-density-2025-house-replay-gap16-identity-v1',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    session: SESSION,
    chamber: CHAMBER,
    frozenInputs: {
      gap16: {
        runId: GAP16_RUN_ID,
        artifactId: GAP16_ARTIFACT_ID,
        artifactDigest: GAP16_ARTIFACT_DIGEST,
        compositeKeySha256: GAP16_COMPOSITE_SHA,
        officialExternalKeySha256: GAP16_EXTERNAL_SHA,
        strictVersionProofSha256: GAP16_VERSION_SHA,
      },
      historicalAsOfMatrix: {
        artifactId: 11252079484,
        artifactDigest:
          'sha256:22e8944cffc6fda553b05ea6ad5e92400d35fc01d83177efdd5d1204dd3c5a6f',
        matrixGzipSha256: MATRIX_GZIP_SHA256,
        matrixCanonicalNdjsonSha256: MATRIX_CANONICAL_SHA256,
      },
      committeeIdentityArtifact: {
        artifactId: COMMITTEE_ARTIFACT_ID,
        artifactDigest: COMMITTEE_ARTIFACT_DIGEST,
      },
      priorSessionIdentityArtifact: {
        artifactId: DEEP_OUTCOME_ARTIFACT_ID,
        artifactDigest: DEEP_OUTCOME_ARTIFACT_DIGEST,
        note: 'Only memberName + stable legislatorId metadata are consumed; outcome fields are ignored.',
      },
      publicRosterArtifact: {
        artifactId: PUBLIC_INVENTORY_ARTIFACT_ID,
        artifactDigest: PUBLIC_INVENTORY_ARTIFACT_DIGEST,
      },
    },
    identityCoverage: {
      internalHistoricalMemberships: roster.size,
      direct2025CommitteeIdentities: EXPECTED_DIRECT_2025_IDENTITIES,
      stablePriorSessionIdentities: EXPECTED_STABLE_PRIOR_SESSION_IDENTITIES,
      preSignatureIdentities: preSignature.size,
      knownCurrentRosterIdentities: knownCurrent.size,
      signatureResolvedIdentities: signatureMappings.length,
      currentPublicRosterIdentities: currentMappings.length,
      extraHistoricalIdentities: extraHistorical.length,
      unresolvedAfterSignature: 0,
    },
    bridge: {
      range: { start: BRIDGE_START, end: BRIDGE_END },
      excludedGapBillIdentifiers: [...gapIdentifiers].sort(),
      candidateUniqueCompositeEvents: bridgeTargets.length,
      usableEvents: usable.length,
      skippedEvents: skippedBridgeEvents.length,
      bridgeEventKeySha256,
      bridgeSourceProofSha256,
      knownIdentityComparisons:
        usable.reduce((sum, row) => sum + row.knownIdentityComparisons, 0),
      events: usable.map((row) => ({
        compositeKey: row.compositeKey,
        identifier: row.identifier,
        occurredOn: row.occurredOn,
        voteEventId: row.voteEventId,
        officialExternalKey: row.officialExternalKey,
        yeaCount: row.yeaCount,
        nayCount: row.nayCount,
      })),
      skipped: skippedBridgeEvents,
    },
    signatureResolution: {
      unresolvedPublicBeforeSignature: unresolvedPublic.map((row) => ({
        lrlId: row.lrlId,
        memberName: row.memberName,
        districts: row.districts,
        parties: row.parties,
      })),
      unresolvedInternalBeforeSignature: unresolvedInternal,
      mappingSha256: signatureMappingSha256,
      mappings: signatureMappings,
    },
    currentRoster: {
      mappingSha256: currentRosterMappingSha256,
      mappings: currentMappings,
    },
    extraHistoricalMemberships: extraHistorical
      .sort((a, b) => a.memberName.localeCompare(b.memberName))
      .map((row) => ({
        membershipId: row.membershipId,
        legislatorId: row.legislatorId,
        memberName: row.memberName,
        method: row.method,
      })),
    policy: {
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      gap16CandidateSelectionFrozenBeforeIdentityResolution: true,
      gap16CandidateVotePagesRequested: false,
      gap16CandidateVoteChoicesRead: false,
      gap16CandidateOutcomesRead: false,
      bridgeMemberVoteOutcomesUsed: true,
      bridgeOutcomeUse: 'identity_resolution_only',
      bridgeEventsExcludeAllGap16BillIdentifiers: true,
      priorSessionOutcomeFieldsConsumed: false,
      targetSelectionUsesOutcomes: false,
      semanticDecisionsUseOutcomes: false,
      featureRowsWritten: false,
      modelFitting: 'none',
      servingChanged: false,
      nextStep:
        'Freeze the bridge-event/signature hashes, then reconstruct the 16 candidate event member-vote rows from official House pages using this frozen 134-member identity map. Candidate vote choices may be read only after this identity map is immutable.',
    },
  };

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    historicalDensity2025HouseReplayGap16Identity: {
      currentRosterIdentities: currentMappings.length,
      signatureResolvedIdentities: signatureMappings.length,
      usableBridgeEvents: usable.length,
      bridgeEventKeySha256,
      bridgeSourceProofSha256,
      signatureMappingSha256,
      currentRosterMappingSha256,
      gap16CandidateVoteChoicesRead: false,
      productionDatabaseQueried: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
