import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchPublicPage } from '../src/evidence/public-http.js';
import { extractExplicitBillStatements, QUICK_EVIDENCE_STATEMENT_EXTRACTOR_VERSION } from '../src/evidence/bill-statement-extractor.js';

const ISSUE = 718;
const SESSION = '2025-2026';
const SOURCE_ARTIFACT_ID = 11440840273;
const SOURCE_ARTIFACT_DIGEST = 'sha256:07ee41210122f42716269ab56f8775d78e10d00df39740315acc1ce055937c20';
const EXPECTED_SOURCE_ENTRIES = 1340;
const EXPECTED_SOURCE_KEY_SHA = '191f9eb9e70a0a7601c5cab29470f22eec0e7340f4feab60bbe3f74a457db7e7';
const EXPECTED_ROSTER_KEY_SHA = '0d105aa62156c9d1d6a88e09388e92e62866234bb784a7b7d354d88873bff2b2';
const EXPECTED_TARGET_EVENT_KEY_SHA = 'c4189c9a5321be8062b53b0f94f36c5ab4b195050777ef8b7f1487e6bbb63811';
const EXPECTED_TARGET_EVENTS = 25;
const OUTPUT_FILE = 'historical-density-2025-house-member-primary-bodies-v1.json';
const CONCURRENCY = 6;

type TargetEvent = {
  voteEventId: string;
  billId: string;
  identifier: string;
  occurredOn: string;
  chamber: string;
  uncoveredRows: number;
  uncoveredMemberships: number;
};

type SourceEntry = {
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

type Inventory = {
  schemaVersion: string;
  issue: number;
  session: string;
  sourceGapArtifact: {
    artifactId: number;
    artifactDigest: string;
    matrixGzipSha256: string;
    matrixCanonicalNdjsonSha256: string;
    targetRowKeySha256: string;
  };
  target: {
    events: TargetEvent[];
    targetEventKeySha256: string;
    sameDayEligible: boolean;
  };
  publicRoster: {
    relevantHouseMembers: number;
    rosterKeySha256: string;
  };
  archiveInventory: {
    strictPreVoteSourceEntries: number;
    sourceKeySha256: string;
    sourceEntries: SourceEntry[];
  };
  policy: {
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    vercelUsed: boolean;
    targetVoteOutcomesRead: boolean;
    outcomeUse: string;
    articleBodiesFetched: boolean;
    exactBillLinkageInferredFromMemberIssueEvidence: boolean;
    applicabilityInferred: boolean;
    sameDayEligible: boolean;
    contextOnly: boolean;
    mechanicallyActionable: boolean;
    modelWeight: number;
    modelFitting: string;
    servingChanged: boolean;
  };
};

type FetchAudit = {
  lrlId: string;
  memberName: string;
  articleUrl: string;
  articleTitle: string;
  publishedOn: string;
  status: 'fetched' | 'failed';
  canonicalUrl?: string;
  contentSha256?: string;
  fetchedAt?: string;
  httpStatus?: number;
  textLength?: number;
  exactStatementCandidates?: number;
  error?: string;
};

type ExactStatementCandidate = {
  lrlId: string;
  memberName: string;
  districts: string[];
  parties: string[];
  articleUrl: string;
  articleTitle: string;
  publishedOn: string;
  canonicalUrl: string;
  contentSha256: string;
  fetchedAt: string;
  bodyText: string;
  billId: string;
  identifier: string;
  stance: 'supports' | 'opposes';
  kind: string;
  claim: string;
  excerpt?: string;
  extractionVersion: string;
  confidence: number;
  strictTargetEvents: Array<{
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
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function normalizePath(url: string): string {
  return new URL(url).pathname.replace(/\/+$/, '');
}
function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 500);
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
async function fetchWithRetry(url: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetchPublicPage(url, {
        timeoutMs: 20_000,
        maxBytes: 3_000_000,
        userAgent: 'VotePredict/2.0 historical-density 2025 House member-primary body recovery',
      });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((delay) => setTimeout(delay, attempt * 1_000));
    }
  }
  throw lastError;
}

async function main(): Promise<void> {
  const inventoryPath = requiredEnv('VOTEPREDICT_HISTORICAL_DENSITY_2025_HOUSE_INVENTORY_PATH');
  const outputDir = requiredEnv('VOTEPREDICT_HISTORICAL_DENSITY_2025_HOUSE_BODIES_OUTPUT_DIR');
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as Inventory;

  if (
    inventory.schemaVersion !== 'historical-density-2025-house-member-primary-inventory-v1'
    || inventory.issue !== ISSUE
    || inventory.session !== SESSION
    || inventory.target.events.length !== EXPECTED_TARGET_EVENTS
    || inventory.target.targetEventKeySha256 !== EXPECTED_TARGET_EVENT_KEY_SHA
    || inventory.publicRoster.rosterKeySha256 !== EXPECTED_ROSTER_KEY_SHA
    || inventory.archiveInventory.strictPreVoteSourceEntries !== EXPECTED_SOURCE_ENTRIES
    || inventory.archiveInventory.sourceEntries.length !== EXPECTED_SOURCE_ENTRIES
    || inventory.archiveInventory.sourceKeySha256 !== EXPECTED_SOURCE_KEY_SHA
    || inventory.target.sameDayEligible
    || inventory.policy.productionDatabaseQueried
    || inventory.policy.productionWrites
    || inventory.policy.vercelUsed
    || inventory.policy.targetVoteOutcomesRead
    || inventory.policy.outcomeUse !== 'none'
    || inventory.policy.articleBodiesFetched
    || inventory.policy.exactBillLinkageInferredFromMemberIssueEvidence
    || inventory.policy.applicabilityInferred
    || inventory.policy.sameDayEligible
    || !inventory.policy.contextOnly
    || inventory.policy.mechanicallyActionable
    || inventory.policy.modelWeight !== 0
    || inventory.policy.modelFitting !== 'none'
    || inventory.policy.servingChanged
  ) throw new Error('2025 House inventory identity or safety policy drifted');

  const uniqueUrls = new Set(inventory.archiveInventory.sourceEntries.map((entry) => entry.articleUrl));
  if (uniqueUrls.size !== EXPECTED_SOURCE_ENTRIES) throw new Error(`Expected ${EXPECTED_SOURCE_ENTRIES} unique article URLs, got ${uniqueUrls.size}`);

  const targetBills = [...new Map(inventory.target.events.map((event) => [event.billId, {
    id: event.billId,
    identifier: event.identifier,
  }])).values()];
  if (targetBills.length !== EXPECTED_TARGET_EVENTS) throw new Error('Expected 25 unique target bills');

  const exactCandidates: ExactStatementCandidate[] = [];
  const fetchAudits = await mapLimit(inventory.archiveInventory.sourceEntries, CONCURRENCY, async (entry): Promise<FetchAudit> => {
    try {
      const page = await fetchWithRetry(entry.articleUrl);
      const parsed = new URL(page.canonicalUrl);
      if (parsed.hostname.toLowerCase() !== 'www.house.mn.gov' || normalizePath(page.canonicalUrl) !== normalizePath(entry.articleUrl)) {
        throw new Error('House article redirected outside its frozen member-specific path');
      }

      const drafts = extractExplicitBillStatements({
        membershipId: `public-lrl:${SESSION}:${entry.lrlId}`,
        memberName: entry.memberName,
        text: page.text,
        publishedAt: `${entry.publishedOn}T12:00:00.000Z`,
        fetchedAt: page.fetchedAt,
        bills: targetBills,
        sourceSubtype: 'member_primary_article',
      });

      let retained = 0;
      for (const draft of drafts) {
        const billId = draft.target?.billId;
        if (!billId || (draft.stance !== 'supports' && draft.stance !== 'opposes')) continue;
        const bill = targetBills.find((row) => row.id === billId);
        if (!bill) continue;
        const strictTargetEvents = entry.strictFutureTargetEvents.filter((event) => event.billId === billId);
        if (strictTargetEvents.length === 0) continue;
        if (strictTargetEvents.some((event) => !(entry.publishedOn < event.occurredOn))) throw new Error('Same-day or post-vote candidate escaped the frozen chronology gate');

        exactCandidates.push({
          lrlId: entry.lrlId,
          memberName: entry.memberName,
          districts: entry.districts,
          parties: entry.parties,
          articleUrl: entry.articleUrl,
          articleTitle: entry.articleTitle,
          publishedOn: entry.publishedOn,
          canonicalUrl: page.canonicalUrl,
          contentSha256: page.contentSha256,
          fetchedAt: page.fetchedAt,
          bodyText: page.text,
          billId,
          identifier: bill.identifier,
          stance: draft.stance,
          kind: draft.kind,
          claim: draft.claim,
          excerpt: draft.excerpt,
          extractionVersion: draft.extractionVersion ?? QUICK_EVIDENCE_STATEMENT_EXTRACTOR_VERSION,
          confidence: draft.confidence ?? 0,
          strictTargetEvents,
        });
        retained += 1;
      }

      return {
        lrlId: entry.lrlId,
        memberName: entry.memberName,
        articleUrl: entry.articleUrl,
        articleTitle: entry.articleTitle,
        publishedOn: entry.publishedOn,
        status: 'fetched',
        canonicalUrl: page.canonicalUrl,
        contentSha256: page.contentSha256,
        fetchedAt: page.fetchedAt,
        httpStatus: page.httpStatus,
        textLength: page.text.length,
        exactStatementCandidates: retained,
      };
    } catch (error) {
      return {
        lrlId: entry.lrlId,
        memberName: entry.memberName,
        articleUrl: entry.articleUrl,
        articleTitle: entry.articleTitle,
        publishedOn: entry.publishedOn,
        status: 'failed',
        error: safeError(error),
      };
    }
  });

  exactCandidates.sort((a, b) =>
    a.publishedOn.localeCompare(b.publishedOn)
    || a.memberName.localeCompare(b.memberName)
    || a.identifier.localeCompare(b.identifier)
    || a.articleUrl.localeCompare(b.articleUrl)
    || a.stance.localeCompare(b.stance)
  );

  const fetched = fetchAudits.filter((row) => row.status === 'fetched');
  const failed = fetchAudits.filter((row) => row.status === 'failed');
  if (fetched.length + failed.length !== EXPECTED_SOURCE_ENTRIES) throw new Error('Body fetch accounting does not cover the frozen source cohort');

  const candidateArticles = new Set(exactCandidates.map((row) => row.articleUrl));
  const candidateMembers = new Set(exactCandidates.map((row) => row.lrlId));
  const candidateBills = new Set(exactCandidates.map((row) => row.billId));
  const candidateEvents = new Set(exactCandidates.flatMap((row) => row.strictTargetEvents.map((event) => event.voteEventId)));
  const bodyIdentitySha256 = sha256(`${fetched.map((row) => `${row.articleUrl}|${row.contentSha256}`).sort().join('\n')}\n`);
  const candidateKeySha256 = sha256(`${exactCandidates.map((row) =>
    `${row.lrlId}|${row.articleUrl}|${row.contentSha256}|${row.billId}|${row.stance}|${row.strictTargetEvents.map((event) => event.voteEventId).sort().join(',')}`
  ).sort().join('\n')}\n`);

  const report = {
    schemaVersion: 'historical-density-2025-house-member-primary-bodies-v1',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    session: SESSION,
    frozenInput: {
      artifactId: SOURCE_ARTIFACT_ID,
      artifactDigest: SOURCE_ARTIFACT_DIGEST,
      inventorySchemaVersion: inventory.schemaVersion,
      sourceKeySha256: EXPECTED_SOURCE_KEY_SHA,
      rosterKeySha256: EXPECTED_ROSTER_KEY_SHA,
      targetEventKeySha256: EXPECTED_TARGET_EVENT_KEY_SHA,
      sourceEntries: EXPECTED_SOURCE_ENTRIES,
      targetEvents: EXPECTED_TARGET_EVENTS,
      targetBills: targetBills.length,
    },
    recovery: {
      attemptedArticleBodies: EXPECTED_SOURCE_ENTRIES,
      fetchedArticleBodies: fetched.length,
      failedArticleBodies: failed.length,
      bodyIdentitySha256,
      fetchAudits,
    },
    exactBillScreen: {
      extractorVersion: QUICK_EVIDENCE_STATEMENT_EXTRACTOR_VERSION,
      exactStatementCandidates: exactCandidates.length,
      candidateArticles: candidateArticles.size,
      candidateMembers: candidateMembers.size,
      candidateBills: candidateBills.size,
      candidateTargetEvents: candidateEvents.size,
      candidateKeySha256,
      candidates: exactCandidates,
    },
    policy: {
      readOnly: true,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      targetVoteOutcomesRead: false,
      outcomeUse: 'none',
      sameDayEligible: false,
      sourceBodiesFetched: true,
      nonCandidateBodiesRetained: false,
      candidateBodiesRetainedForReview: true,
      exactBillLinkageRequiresExplicitIdentifierInBody: true,
      exactBillStatementRequiresDeterministicMemberAttributionAndStance: true,
      memberIssueApplicabilityInferred: false,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      featureRowsWritten: false,
      modelFitting: 'none',
      servingChanged: false,
      nextStepBoundary: 'Review exact-bill candidates against source-body provenance and frozen chronology. If exact-bill yield is insufficient, create a separate outcome-blind semantic cohort from recovered bodies; do not infer applicability in this recovery artifact.',
    },
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, OUTPUT_FILE), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    historicalDensity2025HouseMemberPrimaryBodies: {
      attemptedArticleBodies: report.recovery.attemptedArticleBodies,
      fetchedArticleBodies: report.recovery.fetchedArticleBodies,
      failedArticleBodies: report.recovery.failedArticleBodies,
      exactStatementCandidates: report.exactBillScreen.exactStatementCandidates,
      candidateArticles: report.exactBillScreen.candidateArticles,
      candidateMembers: report.exactBillScreen.candidateMembers,
      candidateBills: report.exactBillScreen.candidateBills,
      candidateTargetEvents: report.exactBillScreen.candidateTargetEvents,
      outcomeUse: 'none',
      productionDatabaseQueried: false,
      vercelUsed: false,
      featureRowsWritten: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
