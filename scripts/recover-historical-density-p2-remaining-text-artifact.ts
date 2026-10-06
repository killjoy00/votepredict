import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchPublicPage } from '../src/evidence/public-http.js';
import { sourceContentIdentityMatches } from '../src/evidence/evidence-quality.js';

const INVENTORY_SCHEMA = 'historical-density-p2-recovery-inventory-v1';
const INVENTORY_ARTIFACT_ID = 11382774063;
const INVENTORY_DIGEST =
  'sha256:0e5a737d7069bdc9c95f9a22caae7ebf48e1fa39b84c1fcaed344fdbd14b14cd';
const CANDIDATE_INPUT_SHA256 =
  '706d0e910c84c85675f3ea1ebfb9c5290aadef1af0eb08acf609d09764b287fb';
const COHORT_ARTIFACT_ID = 11383404277;
const COHORT_DIGEST =
  'sha256:bc0c274ecc7705a47dda26f97d2f2c0a09643ac77b0a585ed63e0402ee4bd51c';
const COHORT_INTEGRITY_SHA256 =
  '2cf9cd2a80a5586570aa67063dc34bc443748c5bbef2fa5dcc9b5c0ea33f0e2c';
const EXPECTED_FRESH_GROUPS = 65;
const EXPECTED_PRIOR_PILOT = 25;
const EXPECTED_REMAINING = 40;
const EXPECTED_REMAINING_MEMBERSHIPS = 13;
const OUTPUT_FILE = 'historical-density-p2-remaining-text-recovery-v1.json';

type RecoveryRow = {
  sourceDocumentId: string;
  sourceDocumentIds: string[];
  sourceKind: string;
  sourceUrl: string;
  contentSha256: string;
  membershipId: string;
  availabilityDate: string | null;
  duplicateDocuments: number;
  hasTextSnapshot: boolean;
  hasAnnotation: boolean;
  priorSnapshotAttempt: boolean;
  potentialRows: number;
  potentialEvents: number;
};

type Inventory = {
  schemaVersion: string;
  issue: number;
  frozenBaseline: {
    targetUniverseArtifactId: number;
    targetUniverseArtifactDigest: string;
    targetSession: string;
  };
  sourceUniverse: {
    freshRecoverableGroups: number;
    freshRecoverableMemberships: number;
    freshPotentialMemberEventRows: number;
    candidateInputSha256: string;
  };
  diagnostics: {
    topFreshRecoverable: RecoveryRow[];
  };
  recommendedPilot: {
    selected: number;
    uniqueMemberships: number;
    uniquePotentialMemberEventRows: number;
    rows: RecoveryRow[];
  };
};

type CohortDocument = {
  membershipId: string;
  candidateMemberNames: string[];
};

type Cohort = {
  artifactVersion: string;
  issue: number;
  membershipsExpected: number;
  selectedDocuments: number;
  integritySha256: string;
  sourceInventoryArtifactId: number;
  sourceInventoryArtifactDigest: string;
  documents: CohortDocument[];
};

type RecoveredRow = RecoveryRow & {
  memberName: string;
  status: 'recovered';
  fetchedAt: string;
  normalizedText: string;
  normalizedTextSha256: string;
  textChars: number;
};

type FailedRow = RecoveryRow & {
  memberName: string;
  status: 'fetch_failure' | 'hash_mismatch' | 'short_text';
  failure?: string;
  fetchedContentSha256?: string;
  textChars?: number;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function safe(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 800);
}

function loadInputs() {
  const inventory = JSON.parse(
    readFileSync(requiredEnv('VOTEPREDICT_P2_INVENTORY_PATH'), 'utf8'),
  ) as Inventory;
  if (
    inventory.schemaVersion !== INVENTORY_SCHEMA
    || inventory.issue !== 718
    || inventory.frozenBaseline.targetUniverseArtifactId !== 11252079484
    || inventory.frozenBaseline.targetUniverseArtifactDigest
      !== 'sha256:22e8944cffc6fda553b05ea6ad5e92400d35fc01d83177efdd5d1204dd3c5a6f'
    || inventory.frozenBaseline.targetSession !== '2021-2022'
    || inventory.sourceUniverse.freshRecoverableGroups !== EXPECTED_FRESH_GROUPS
    || inventory.sourceUniverse.candidateInputSha256 !== CANDIDATE_INPUT_SHA256
    || inventory.diagnostics.topFreshRecoverable.length !== EXPECTED_FRESH_GROUPS
    || inventory.recommendedPilot.selected !== EXPECTED_PRIOR_PILOT
    || inventory.recommendedPilot.rows.length !== EXPECTED_PRIOR_PILOT
  ) {
    throw new Error('Frozen P2 inventory identity/count drifted');
  }

  const cohort = JSON.parse(
    readFileSync(requiredEnv('VOTEPREDICT_P2_COHORT_PATH'), 'utf8'),
  ) as Cohort;
  if (
    cohort.artifactVersion !== 'historical-density-p2-semantic-review-cohort-v1'
    || cohort.issue !== 718
    || cohort.membershipsExpected !== 18
    || cohort.selectedDocuments !== 25
    || cohort.integritySha256 !== COHORT_INTEGRITY_SHA256
    || cohort.sourceInventoryArtifactId !== INVENTORY_ARTIFACT_ID
    || cohort.sourceInventoryArtifactDigest !== INVENTORY_DIGEST
  ) {
    throw new Error('Frozen first P2 cohort identity drifted');
  }

  return { inventory, cohort };
}

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (attempt < attempts) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 700 * attempt));
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

async function mapLimit<T, R>(
  rows: readonly T[],
  limit: number,
  mapper: (row: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(rows.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= rows.length) return;
      output[index] = await mapper(rows[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, rows.length) }, () => worker()),
  );
  return output;
}

async function main() {
  const { inventory, cohort } = loadInputs();
  const outputDir = requiredEnv('VOTEPREDICT_P2_REMAINING_RECOVERY_OUTPUT_DIR');

  const pilotIds = new Set(
    inventory.recommendedPilot.rows.map((row) => row.sourceDocumentId),
  );
  if (pilotIds.size !== EXPECTED_PRIOR_PILOT) {
    throw new Error('Prior P2 pilot contains duplicate source ids');
  }

  const remaining = inventory.diagnostics.topFreshRecoverable.filter(
    (row) => !pilotIds.has(row.sourceDocumentId),
  );
  if (remaining.length !== EXPECTED_REMAINING) {
    throw new Error(
      `Expected ${EXPECTED_REMAINING} untouched P2 groups, found ${remaining.length}`,
    );
  }

  const memberNames = new Map<string, string>();
  for (const document of cohort.documents) {
    const names = document.candidateMemberNames;
    if (names.length !== 1) throw new Error('Frozen cohort member identity is ambiguous');
    const existing = memberNames.get(document.membershipId);
    if (existing && existing !== names[0]) {
      throw new Error('Frozen cohort membership name drifted');
    }
    memberNames.set(document.membershipId, names[0]!);
  }

  const remainingMemberships = new Set(remaining.map((row) => row.membershipId));
  if (remainingMemberships.size !== EXPECTED_REMAINING_MEMBERSHIPS) {
    throw new Error(
      `Expected ${EXPECTED_REMAINING_MEMBERSHIPS} remaining memberships, found ${remainingMemberships.size}`,
    );
  }
  for (const membershipId of remainingMemberships) {
    if (!memberNames.has(membershipId)) {
      throw new Error(`Remaining membership is absent from frozen first cohort: ${membershipId}`);
    }
  }

  const seenIds = new Set<string>();
  for (const row of remaining) {
    if (seenIds.has(row.sourceDocumentId)) throw new Error('Duplicate remaining source id');
    seenIds.add(row.sourceDocumentId);
    if (
      !['wayback_member_primary', 'wayback_campaign_site'].includes(row.sourceKind)
      || !row.sourceUrl.startsWith('https://web.archive.org/web/')
      || !/^[a-f0-9]{64}$/i.test(row.contentSha256)
      || !row.availabilityDate
      || row.hasTextSnapshot
      || row.hasAnnotation
      || row.priorSnapshotAttempt
      || row.potentialRows <= 0
    ) {
      throw new Error(`Remaining frozen source invariant drifted: ${row.sourceDocumentId}`);
    }
  }

  const results = await mapLimit(remaining, 4, async (row): Promise<RecoveredRow | FailedRow> => {
    const memberName = memberNames.get(row.membershipId)!;
    try {
      const page = await retry(() =>
        fetchPublicPage(row.sourceUrl, {
          timeoutMs: 20_000,
          maxBytes: 2_500_000,
          userAgent: 'VotePredict/2.0 historical-density-p2-remaining-text-recovery-v1',
        }),
      );

      if (!sourceContentIdentityMatches(row.contentSha256, page.contentSha256)) {
        return {
          ...row,
          memberName,
          status: 'hash_mismatch',
          fetchedContentSha256: page.contentSha256,
        };
      }

      const normalizedText = page.text.replace(/\r\n?/g, '\n');
      const textChars = normalizedText.replace(/\s+/g, ' ').trim().length;
      if (textChars < 40) {
        return {
          ...row,
          memberName,
          status: 'short_text',
          textChars,
        };
      }

      return {
        ...row,
        memberName,
        status: 'recovered',
        fetchedAt: page.fetchedAt,
        normalizedText,
        normalizedTextSha256: sha256(normalizedText),
        textChars,
      };
    } catch (error) {
      return {
        ...row,
        memberName,
        status: 'fetch_failure',
        failure: safe(error),
      };
    }
  });

  const recovered = results.filter(
    (row): row is RecoveredRow => row.status === 'recovered',
  );
  const fetchFailures = results.filter((row) => row.status === 'fetch_failure');
  const hashMismatches = results.filter((row) => row.status === 'hash_mismatch');
  const shortTexts = results.filter((row) => row.status === 'short_text');

  const report = {
    schemaVersion: 'historical-density-p2-remaining-text-recovery-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    frozenInputs: {
      inventoryArtifactId: INVENTORY_ARTIFACT_ID,
      inventoryArtifactDigest: INVENTORY_DIGEST,
      candidateInputSha256: CANDIDATE_INPUT_SHA256,
      firstCohortArtifactId: COHORT_ARTIFACT_ID,
      firstCohortArtifactDigest: COHORT_DIGEST,
      firstCohortIntegritySha256: COHORT_INTEGRITY_SHA256,
      freshRecoverableGroups: EXPECTED_FRESH_GROUPS,
      priorPilotSources: EXPECTED_PRIOR_PILOT,
      untouchedSources: EXPECTED_REMAINING,
      untouchedMemberships: EXPECTED_REMAINING_MEMBERSHIPS,
    },
    result: {
      recoveredSources: recovered.length,
      recoveredMemberships: new Set(recovered.map((row) => row.membershipId)).size,
      fetchFailures: fetchFailures.length,
      hashMismatches: hashMismatches.length,
      shortTexts: shortTexts.length,
      unresolvedSources:
        fetchFailures.length + hashMismatches.length + shortTexts.length,
      recovered,
      failures: results.filter((row) => row.status !== 'recovered'),
    },
    policy: {
      exactFrozenSourceUrlOnly: true,
      exactFrozenContentShaRequired: true,
      archiveDiscovery: false,
      currentMutableSubstitution: false,
      productionDatabaseQueried: false,
      productionWrites: false,
      sourceTextWrites: false,
      annotationWrites: false,
      candidateBillIdentifiers: [],
      billInference: false,
      stanceInference: false,
      semanticInference: false,
      outcomeUse: 'none',
      modelFitting: 'none',
      servingChanged: false,
      vercelUsed: false,
      nextStep:
        'freeze recovered texts into a second immutable semantic-review cohort; member/issue claims only, with candidate bill identifiers remaining empty',
    },
    contentSha256WithoutSelfField: null as string | null,
  };

  mkdirSync(outputDir, { recursive: true });
  const canonical = JSON.stringify(report, null, 2) + '\n';
  report.contentSha256WithoutSelfField = sha256(canonical);
  writeFileSync(resolve(outputDir, OUTPUT_FILE), JSON.stringify(report, null, 2) + '\n');

  console.log(
    JSON.stringify(
      {
        historicalDensityP2RemainingTextRecovery: {
          untouchedSources: EXPECTED_REMAINING,
          untouchedMemberships: EXPECTED_REMAINING_MEMBERSHIPS,
          recoveredSources: recovered.length,
          recoveredMemberships: report.result.recoveredMemberships,
          fetchFailures: fetchFailures.length,
          hashMismatches: hashMismatches.length,
          shortTexts: shortTexts.length,
          unresolvedSources: report.result.unresolvedSources,
          productionDatabaseQueried: false,
          productionWrites: false,
          outcomesUsed: false,
          billInference: false,
          stanceInference: false,
          vercelUsed: false,
          servingChanged: false,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
