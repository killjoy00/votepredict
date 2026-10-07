import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  fetchRevisorBill,
  fetchRevisorBillVersion,
  type RevisorBillMetadata,
  type RevisorBillVersionMetadata,
} from '../src/sources/minnesota/revisor.js';

const ISSUE = 718;
const SESSION = '2025-2026';
const CHAMBER = 'house';

const UNIVERSE_AUDIT_SCHEMA =
  'historical-density-2025-house-vote-universe-gap-audit-v1';
const UNIVERSE_AUDIT_RUN_ID = 37563491641;
const UNIVERSE_AUDIT_ARTIFACT_ID = 11457484096;
const UNIVERSE_AUDIT_ARTIFACT_DIGEST =
  'sha256:9047ac177fcabc03b2b80662ca0a2475d07fef1e4ea8a828643c1f8aeb6020e1';

const ORIGINAL_MATRIX_ARTIFACT_ID = 11252079484;
const ORIGINAL_MATRIX_ARTIFACT_DIGEST =
  'sha256:22e8944cffc6fda553b05ea6ad5e92400d35fc01d83177efdd5d1204dd3c5a6f';
const ORIGINAL_MATRIX_MANIFEST_SCHEMA = 'historical-as-of-matrix-v1-manifest';
const ORIGINAL_MATRIX_ROWS = 135457;
const ORIGINAL_MATRIX_EVENTS = 1339;
const ORIGINAL_MATRIX_GZIP_SHA256 =
  'd8a9735a514f427508a7a37303ba312dcac3f929a51aa05a1aba32a76b384637';
const ORIGINAL_MATRIX_CANONICAL_SHA256 =
  'c97ac50c8c89ae0548cc48bed65a42c22f332e2977b33173619c9e258c09a4d0';

const EXPECTED_CANDIDATES = 16;
const EXPECTED_COMPOSITE_KEY_SHA256 =
  'c756fa9d80e7914e579d1bb43e2dc3c3d730ad221e0f8185dc2de2ccffc2c37a';
const EXPECTED_EXTERNAL_KEY_SHA256 =
  '0b4e9af1eb5af5d9677035238ac7315d2e318f790d1ef53a3944a988978b7063';

const EXPECTED_COMPOSITE_KEYS = [
  'HF1354|2025-04-25',
  'HF1606|2026-04-23',
  'HF1837|2025-05-01',
  'HF2354|2026-05-17',
  'HF3521|2026-05-04',
  'HF3718|2026-04-20',
  'HF3802|2026-03-23',
  'HF3908|2026-04-23',
  'HF3917|2026-04-27',
  'HF4242|2026-05-06',
  'HF475|2025-05-13',
  'HF944|2025-03-17',
  'SF2511|2026-04-13',
  'SF2814|2026-05-06',
  'SF2884|2025-05-19',
  'SF3720|2026-05-14',
] as const;

const EXPECTED_EXTERNAL_KEYS = [
  '302:HF1354:2025-04-25:2646:1',
  '302:HF1606:2026-04-23:6139:2',
  '302:HF1837:2025-05-01:2913:1',
  '302:HF2354:2026-05-17:7723:2',
  '302:HF3521:2026-05-04:6475:1',
  '302:HF3718:2026-04-20:5836:1',
  '302:HF3802:2026-03-23:5082:1',
  '302:HF3908:2026-04-23:6144:1',
  '302:HF3917:2026-04-27:6163:1',
  '302:HF4242:2026-05-06:6558:1',
  '302:HF475:2025-05-13:3512:1',
  '302:HF944:2025-03-17:817:1',
  '302:SF2511:2026-04-13:5696:1',
  '302:SF2814:2026-05-06:6582:1',
  '302:SF2884:2025-05-19:4435:1',
  '302:SF3720:2026-05-14:7379:1',
] as const;

type Json = Record<string, any>;

type Candidate = {
  compositeKey: string;
  identifier: string;
  occurredOn: string;
  externalKey: string;
  decisiveVotes: number;
  motionText: string;
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

function selectStrictPreVoteVersion(
  metadata: RevisorBillMetadata,
  occurredOn: string,
): RevisorBillVersionMetadata | undefined {
  return [...metadata.versions]
    .filter((version) => version.postedOn < occurredOn)
    .sort((a, b) =>
      b.postedOn.localeCompare(a.postedOn) || b.ordinal - a.ordinal
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

function canonicalIdentifier(value: string): string {
  const match = value.replace(/\s+/g, '').toUpperCase().match(/^(HF|SF)0*(\d+)$/);
  if (!match) throw new Error(`Unsupported bill identifier: ${value}`);
  return `${match[1]}${Number(match[2])}`;
}

function parseCompositeKey(value: string): { identifier: string; occurredOn: string } {
  const [identifier, occurredOn, ...rest] = value.split('|');
  if (!identifier || !occurredOn || rest.length > 0) {
    throw new Error(`Malformed composite key: ${value}`);
  }
  return {
    identifier: canonicalIdentifier(identifier),
    occurredOn,
  };
}

async function main(): Promise<void> {
  const audit = readJson(env('VOTEPREDICT_2025_HOUSE_UNIVERSE_AUDIT_PATH'));
  const manifest = readJson(env('VOTEPREDICT_HISTORICAL_AS_OF_MANIFEST_PATH'));
  const gzipBytes = readFileSync(env('VOTEPREDICT_HISTORICAL_AS_OF_MATRIX_PATH'));
  const output = resolve(
    env('VOTEPREDICT_2025_HOUSE_REPLAY_GAP16_OUTPUT'),
  );

  if (
    audit.schemaVersion !== UNIVERSE_AUDIT_SCHEMA
    || audit.issue !== ISSUE
    || audit.session !== SESSION
    || audit.chamber !== CHAMBER
    || audit.officialRollCallUniverse?.voteEvents !== 465
    || audit.officialRollCallUniverse?.passageVoteEvents !== 281
    || audit.replayGate?.publicSourceReplayCandidates !== 253
    || audit.replayGate?.degradedSourceFetches !== 0
    || audit.frozen2025HouseReplayUniverse?.events !== 264
    || audit.comparison?.matchedEvents !== 237
    || audit.comparison?.officialOutsideMatrix !== EXPECTED_CANDIDATES
    || audit.comparison?.matrixWithoutOfficial !== 27
    || audit.policy?.productionDatabaseQueried !== false
    || audit.policy?.passFailOutcomeReadOrInferred !== false
    || audit.policy?.outcomeUseForSemanticsOrModeling !== 'none'
  ) {
    throw new Error('Canonical House universe audit identity/policy drifted');
  }

  if (
    manifest.schemaVersion !== ORIGINAL_MATRIX_MANIFEST_SCHEMA
    || manifest.issue !== 459
    || manifest.rows !== ORIGINAL_MATRIX_ROWS
    || manifest.events !== ORIGINAL_MATRIX_EVENTS
    || manifest.matrixGzipSha256 !== ORIGINAL_MATRIX_GZIP_SHA256
    || manifest.matrixCanonicalNdjsonSha256 !== ORIGINAL_MATRIX_CANONICAL_SHA256
    || manifest.productionAction !== 'none'
  ) {
    throw new Error('Original historical-as-of matrix manifest drifted');
  }
  if (sha256(gzipBytes) !== ORIGINAL_MATRIX_GZIP_SHA256) {
    throw new Error('Original historical-as-of matrix gzip digest mismatch');
  }
  const canonical = gunzipSync(gzipBytes).toString('utf8');
  if (sha256(canonical) !== ORIGINAL_MATRIX_CANONICAL_SHA256) {
    throw new Error('Original historical-as-of matrix canonical digest mismatch');
  }

  const mismatchDetails = (audit.comparison?.mismatchDetails ?? []) as Json[];
  const missing = mismatchDetails
    .filter(
      (row) =>
        row.classification ===
        'public_replay_candidate_absent_from_frozen_matrix',
    )
    .sort((a, b) => String(a.compositeKey).localeCompare(String(b.compositeKey)));

  if (missing.length !== EXPECTED_CANDIDATES) {
    throw new Error(`Expected 16 public-only replay candidates, found ${missing.length}`);
  }

  const candidates: Candidate[] = missing.map((row) => {
    const compositeKey = String(row.compositeKey);
    const parsed = parseCompositeKey(compositeKey);
    if (row.officialEvents !== 1 || row.matrixEvents !== 0) {
      throw new Error(`Unexpected multiplicity for ${compositeKey}`);
    }
    const passageEvents = (row.currentOfficialEvents ?? []).filter(
      (event: Json) => event.isPassage === true,
    );
    if (passageEvents.length !== 1) {
      throw new Error(`Expected exactly one official passage event for ${compositeKey}`);
    }
    const event = passageEvents[0]!;
    if (
      event.voteKind !== 'passage'
      || event.strictVersionStatus !== 'verified'
      || Number(event.decisiveVotes) < 20
    ) {
      throw new Error(`Public replay eligibility drifted for ${compositeKey}`);
    }
    return {
      compositeKey,
      identifier: parsed.identifier,
      occurredOn: parsed.occurredOn,
      externalKey: String(event.externalKey),
      decisiveVotes: Number(event.decisiveVotes),
      motionText: String(event.motionText),
    };
  });

  const compositeKeys = candidates.map((row) => row.compositeKey);
  const externalKeys = candidates.map((row) => row.externalKey);
  if (
    setSha(compositeKeys) !== EXPECTED_COMPOSITE_KEY_SHA256
    || setSha(externalKeys) !== EXPECTED_EXTERNAL_KEY_SHA256
    || JSON.stringify([...compositeKeys].sort())
      !== JSON.stringify([...EXPECTED_COMPOSITE_KEYS].sort())
    || JSON.stringify([...externalKeys].sort())
      !== JSON.stringify([...EXPECTED_EXTERNAL_KEYS].sort())
  ) {
    throw new Error('Exact 16-event replay-gap identity drifted');
  }

  const targetSet = new Set(compositeKeys);
  const targetIdentifiers = new Set(candidates.map((row) => row.identifier));
  const exactOriginalMatches = new Map<string, number>(
    compositeKeys.map((key) => [key, 0]),
  );
  const originalSameBillEvents = new Map<
    string,
    Map<string, { voteEventId: string; occurredOn: string }>
  >(
    [...targetIdentifiers].map((identifier) => [identifier, new Map()]),
  );

  for (const line of canonical.trimEnd().split('\n')) {
    const row = JSON.parse(line) as Json;
    if (row.session !== SESSION || row.chamber !== CHAMBER) continue;
    const identifier = canonicalIdentifier(String(row.identifier));
    if (!targetIdentifiers.has(identifier)) continue;
    const compositeKey = `${identifier}|${String(row.occurredOn)}`;
    if (targetSet.has(compositeKey)) {
      exactOriginalMatches.set(
        compositeKey,
        (exactOriginalMatches.get(compositeKey) ?? 0) + 1,
      );
    }
    const events = originalSameBillEvents.get(identifier)!;
    const voteEventId = String(row.voteEventId);
    if (!events.has(voteEventId)) {
      events.set(voteEventId, {
        voteEventId,
        occurredOn: String(row.occurredOn),
      });
    }
  }

  if ([...exactOriginalMatches.values()].some((count) => count !== 0)) {
    throw new Error('At least one gap-16 event is present in original replay matrix');
  }

  const billsPresentElsewhere = [...originalSameBillEvents.entries()]
    .filter(([, events]) => events.size > 0)
    .map(([identifier]) => identifier)
    .sort();
  if (
    JSON.stringify(billsPresentElsewhere) !== JSON.stringify(['HF3718'])
  ) {
    throw new Error(
      `Original same-bill presence drifted: ${JSON.stringify(billsPresentElsewhere)}`,
    );
  }
  const hf3718Events = [
    ...originalSameBillEvents.get('HF3718')!.values(),
  ].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
  if (
    hf3718Events.length !== 1
    || hf3718Events[0]?.occurredOn !== '2026-04-09'
  ) {
    throw new Error(
      `HF3718 original replay presence drifted: ${JSON.stringify(hf3718Events)}`,
    );
  }

  const statusCache = new Map<string, Promise<RevisorBillMetadata>>();
  const versionCache = new Map<
    string,
    Promise<Awaited<ReturnType<typeof fetchRevisorBillVersion>>>
  >();

  const enriched = await mapLimit(candidates, 4, async (candidate) => {
    let pendingStatus = statusCache.get(candidate.identifier);
    if (!pendingStatus) {
      pendingStatus = retry(() =>
        fetchRevisorBill(SESSION, candidate.identifier, false),
      );
      statusCache.set(candidate.identifier, pendingStatus);
    }
    const metadata = await pendingStatus;
    const selected = selectStrictPreVoteVersion(metadata, candidate.occurredOn);
    if (!selected) {
      throw new Error(
        `No strict pre-vote Revisor version remains for ${candidate.compositeKey}`,
      );
    }

    let pendingVersion = versionCache.get(selected.textUrl);
    if (!pendingVersion) {
      pendingVersion = retry(() => fetchRevisorBillVersion(selected));
      versionCache.set(selected.textUrl, pendingVersion);
    }
    const version = await pendingVersion;
    if (version.text.length < 100 || version.postedOn >= candidate.occurredOn) {
      throw new Error(
        `Strict pre-vote version proof drifted for ${candidate.compositeKey}`,
      );
    }

    return {
      ...candidate,
      strictPreVoteVersion: {
        postedOn: version.postedOn,
        versionKey: version.versionKey,
        textUrl: selected.textUrl,
        textLength: version.text.length,
        textSha256: version.textSha256,
        strictlyBeforeVoteDate: true,
      },
      originalReplayMatrix: {
        exactEventPresent: false,
        sameBillEvents: [
          ...originalSameBillEvents.get(candidate.identifier)!.values(),
        ].sort((a, b) =>
          a.occurredOn.localeCompare(b.occurredOn)
          || a.voteEventId.localeCompare(b.voteEventId)
        ),
      },
      disposition: 'candidate_for_replay_corpus_rebuild_investigation',
    };
  });

  const versionProofSha256 = setSha(
    enriched.map(
      (row) =>
        `${row.compositeKey}|${row.strictPreVoteVersion.postedOn}|${row.strictPreVoteVersion.versionKey}|${row.strictPreVoteVersion.textSha256}`,
    ),
  );

  const report = {
    schemaVersion: 'historical-density-2025-house-replay-gap16-v1',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    session: SESSION,
    chamber: CHAMBER,
    frozenInputs: {
      universeAudit: {
        runId: UNIVERSE_AUDIT_RUN_ID,
        artifactId: UNIVERSE_AUDIT_ARTIFACT_ID,
        artifactDigest: UNIVERSE_AUDIT_ARTIFACT_DIGEST,
        schemaVersion: UNIVERSE_AUDIT_SCHEMA,
      },
      originalHistoricalAsOfMatrix: {
        artifactId: ORIGINAL_MATRIX_ARTIFACT_ID,
        artifactDigest: ORIGINAL_MATRIX_ARTIFACT_DIGEST,
        manifestSchemaVersion: ORIGINAL_MATRIX_MANIFEST_SCHEMA,
        rows: ORIGINAL_MATRIX_ROWS,
        events: ORIGINAL_MATRIX_EVENTS,
        matrixGzipSha256: ORIGINAL_MATRIX_GZIP_SHA256,
        matrixCanonicalNdjsonSha256: ORIGINAL_MATRIX_CANONICAL_SHA256,
      },
    },
    identity: {
      candidateCount: enriched.length,
      compositeKeySha256: EXPECTED_COMPOSITE_KEY_SHA256,
      officialExternalKeySha256: EXPECTED_EXTERNAL_KEY_SHA256,
      strictVersionProofSha256: versionProofSha256,
      exactOriginalReplayMatches: 0,
      candidateBillsPresentElsewhereInOriginalReplay: billsPresentElsewhere,
    },
    candidates: enriched,
    interpretation: {
      observed:
        'All 16 events are current official House passage roll calls with at least 20 decisive yea/nay votes and a currently verifiable strict pre-vote Revisor text version, but none is present as the same bill/date event in the original historical-as-of replay matrix.',
      upstreamLocalization:
        'The omission predates the Evidence Quality v1.7 tranche work because the same events are absent from historical-as-of-matrix-v1. Fifteen candidate bills have no 2025-26 House event in that original matrix; HF3718 has one earlier April 9 event but not the April 20 repassage.',
      notEstablished:
        'Without crossing the production-data boundary, this audit does not attribute the omission to historical vote-event ingestion, persisted pass/fail availability, persisted bill-version availability, or another database-state condition at the original freeze.',
      nextStep:
        'Evaluate a source-reconstructed replay-corpus extension for these 16 events as one outcome-blind batch before deciding whether to rebuild the historical replay universe.',
    },
    policy: {
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      officialVoteTalliesUsedOnlyForEligibilityFloor: true,
      passFailOutcomeReadOrInferred: false,
      outcomeUseForSemanticsOrModeling: 'none',
      targetSelectionUsesOutcomes: false,
      sameDayBillVersionsExcluded: true,
      featureRowsWritten: false,
      modelFitting: 'none',
      servingChanged: false,
      mechanicallyActionable: false,
    },
  };

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    historicalDensity2025HouseReplayGap16: {
      candidates: enriched.length,
      compositeKeySha256: EXPECTED_COMPOSITE_KEY_SHA256,
      officialExternalKeySha256: EXPECTED_EXTERNAL_KEY_SHA256,
      strictVersionProofSha256: versionProofSha256,
      exactOriginalReplayMatches: 0,
      billsPresentElsewhereInOriginalReplay,
      productionDatabaseQueried: false,
      passFailOutcomeReadOrInferred: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
