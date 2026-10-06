import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchPublicPage } from '../src/evidence/public-http.js';
import { sourceContentIdentityMatches } from '../src/evidence/evidence-quality.js';

const ISSUE = 718;
const INVENTORY_ARTIFACT_ID = 11380604012;
const INVENTORY_ARTIFACT_DIGEST =
  'sha256:c3cbd57573598c36071afb7c4de84ce15a334972ee75c0accdcea93317a93450';
const EXPECTED_SOURCE_ID = 'e7c86e77-31bb-422e-9569-4c9e98f7fdbe';
const EXPECTED_SOURCE_KIND = 'member_primary_article';
const EXPECTED_SOURCE_URL = 'https://www.house.mn.gov/members/profile/news/15613/50492';
const EXPECTED_CONTENT_SHA256 =
  '46d09d251af2e80d349e339364201d339d858c16fcd0df20201a358ad7ab84db';
const EXPECTED_AVAILABLE_ON = '2025-02-17';
const EXPECTED_SESSION = '2025-2026';
const OUTPUT_FILE = 'historical-density-2025-single-official-source-recovery-v1.json';

type Candidate = {
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  contentSha256: string;
  availableOn: string;
  sourceSession: string | null;
  sourceDocumentTextId: string | null;
  textReady: boolean;
  targetPairs: number;
  potentialCoverageRows: number;
  newCoverageRows: number;
  newCoverageEvents: number;
  newCoverageMemberships: number;
  newCoverageBySession: Record<string, number>;
};

type Inventory = {
  schemaVersion: string;
  issue: number;
  targetUniverse: {
    rows: number;
    currentCoveredRows: number;
    currentCoveredBySession: Record<string, number>;
  };
  candidates: {
    freshDedupedSourceDocuments: number;
    bySourceKind: Record<string, { sources: number; newCoverageRows: number; textReady: number }>;
  };
  allCandidates: Candidate[];
  policy: {
    outcomeUse: string;
    strictPreVoteAvailability: boolean;
    sameDayExcluded: boolean;
    alreadyAnnotatedSourcesExcluded: boolean;
    exactContentDedup: boolean;
    modelFitting: string;
    servingChanged: boolean;
  };
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safe(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 800);
}

async function main(): Promise<void> {
  const inventoryPath = requiredEnv('VOTEPREDICT_EQ_V15_CANDIDATE_INVENTORY_PATH');
  const outputDir = requiredEnv('VOTEPREDICT_HISTORICAL_DENSITY_2025_RECOVERY_OUTPUT_DIR');
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as Inventory;

  if (
    inventory.schemaVersion !== 'evidence-quality-pre-vote-candidate-inventory-v1.5'
    || inventory.issue !== ISSUE
    || inventory.targetUniverse.rows !== 135457
    || inventory.targetUniverse.currentCoveredRows !== 38
    || inventory.targetUniverse.currentCoveredBySession['2021-2022'] !== 3
    || inventory.targetUniverse.currentCoveredBySession['2023-2024'] !== 32
    || inventory.targetUniverse.currentCoveredBySession['2025-2026'] !== 3
    || inventory.candidates.freshDedupedSourceDocuments !== 4
    || inventory.policy.outcomeUse !== 'none'
    || !inventory.policy.strictPreVoteAvailability
    || !inventory.policy.sameDayExcluded
    || !inventory.policy.alreadyAnnotatedSourcesExcluded
    || !inventory.policy.exactContentDedup
    || inventory.policy.modelFitting !== 'none'
    || inventory.policy.servingChanged
  ) {
    throw new Error('Frozen v1.5 candidate inventory identity or policy drifted');
  }

  const candidates = inventory.allCandidates.filter((candidate) =>
    candidate.sourceKind === EXPECTED_SOURCE_KIND
    && candidate.newCoverageBySession[EXPECTED_SESSION] === 1
  );
  if (candidates.length !== 1) {
    throw new Error(`Expected exactly one fresh 2025-26 ordinary candidate, found ${candidates.length}`);
  }
  const candidate = candidates[0]!;
  if (
    candidate.sourceDocumentId !== EXPECTED_SOURCE_ID
    || candidate.sourceUrl !== EXPECTED_SOURCE_URL
    || candidate.contentSha256 !== EXPECTED_CONTENT_SHA256
    || candidate.availableOn !== EXPECTED_AVAILABLE_ON
    || candidate.sourceDocumentTextId !== null
    || candidate.textReady
    || candidate.targetPairs !== 1
    || candidate.potentialCoverageRows !== 1
    || candidate.newCoverageRows !== 1
    || candidate.newCoverageEvents !== 1
    || candidate.newCoverageMemberships !== 1
    || Object.keys(candidate.newCoverageBySession).length !== 1
  ) {
    throw new Error('Frozen 2025-26 candidate identity/count drifted');
  }

  let status: 'recovered' | 'hash_mismatch' | 'fetch_failure' | 'short_text';
  let fetchedAt: string | null = null;
  let fetchedContentSha256: string | null = null;
  let normalizedText: string | null = null;
  let normalizedTextSha256: string | null = null;
  let textChars: number | null = null;
  let title: string | null = null;
  let fetchedPublishedAt: string | null = null;
  let failure: string | null = null;

  try {
    const page = await fetchPublicPage(candidate.sourceUrl, {
      timeoutMs: 25_000,
      maxBytes: 2_500_000,
      userAgent: 'VotePredict/2.0 historical-density-2025-single-official-source-v1',
    });
    fetchedAt = page.fetchedAt;
    fetchedContentSha256 = page.contentSha256;
    title = page.title ?? null;
    fetchedPublishedAt = page.publishedAt ?? null;

    if (!sourceContentIdentityMatches(candidate.contentSha256, page.contentSha256)) {
      status = 'hash_mismatch';
    } else {
      const text = page.text.replace(/\r\n?/g, '\n');
      const chars = text.replace(/\s+/g, ' ').trim().length;
      textChars = chars;
      if (chars < 40) {
        status = 'short_text';
      } else {
        status = 'recovered';
        normalizedText = text;
        normalizedTextSha256 = sha256(text);
      }
    }
  } catch (error) {
    status = 'fetch_failure';
    failure = safe(error);
  }

  const report = {
    schemaVersion: 'historical-density-2025-single-official-source-recovery-v1',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    frozenInput: {
      inventoryArtifactId: INVENTORY_ARTIFACT_ID,
      inventoryArtifactDigest: INVENTORY_ARTIFACT_DIGEST,
      inventorySchemaVersion: inventory.schemaVersion,
      sourceDocumentId: candidate.sourceDocumentId,
      sourceKind: candidate.sourceKind,
      sourceUrl: candidate.sourceUrl,
      frozenContentSha256: candidate.contentSha256,
      availableOn: candidate.availableOn,
      targetSession: EXPECTED_SESSION,
      targetPairs: candidate.targetPairs,
      potentialCoverageRows: candidate.potentialCoverageRows,
      newCoverageRows: candidate.newCoverageRows,
      newCoverageEvents: candidate.newCoverageEvents,
      newCoverageMemberships: candidate.newCoverageMemberships,
    },
    result: {
      status,
      fetchedAt,
      fetchedContentSha256,
      exactFrozenContentMatch:
        fetchedContentSha256 !== null
        && sourceContentIdentityMatches(candidate.contentSha256, fetchedContentSha256),
      title,
      fetchedPublishedAt,
      normalizedText,
      normalizedTextSha256,
      textChars,
      failure,
    },
    policy: {
      exactFrozenSourceUrlOnly: true,
      exactFrozenContentShaRequiredForReviewableText: true,
      mutableCurrentPageSubstitution: false,
      archiveDiscovery: false,
      productionDatabaseQueried: false,
      productionWrites: false,
      sourceTextWrites: false,
      annotationWrites: false,
      targetVoteOutcomesRead: false,
      outcomeUse: 'none',
      stanceInference: false,
      semanticApplicabilityInference: false,
      modelFitting: 'none',
      servingChanged: false,
      vercelUsed: false,
      nextStep:
        status === 'recovered'
          ? 'freeze this exact-hash text into a one-source semantic review artifact before any matrix change'
          : 'fail closed; do not substitute mutable current text. A separately justified exact archive/source recovery would be required to reopen this source.',
    },
    contentSha256WithoutSelfField: null as string | null,
  };

  mkdirSync(outputDir, { recursive: true });
  const canonical = JSON.stringify(report, null, 2) + '\n';
  report.contentSha256WithoutSelfField = sha256(canonical);
  writeFileSync(resolve(outputDir, OUTPUT_FILE), JSON.stringify(report, null, 2) + '\n');

  console.log(JSON.stringify({
    historicalDensity2025SingleOfficialSource: {
      sourceDocumentId: candidate.sourceDocumentId,
      status,
      exactFrozenContentMatch: report.result.exactFrozenContentMatch,
      textChars,
      targetSession: EXPECTED_SESSION,
      newCoverageRows: 1,
      productionDatabaseQueried: false,
      outcomesUsed: false,
      vercelUsed: false,
      modelFitting: 'none',
      servingChanged: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
