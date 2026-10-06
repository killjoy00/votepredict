import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ISSUE = 718;
const SESSION = '2025-2026';
const BODY_ARTIFACT_ID = 11440172805;
const BODY_ARTIFACT_DIGEST = 'sha256:d8cbfbf993eae23e0608badfe996d985d57b1ff04effcc8b41c38bd39b3e9e5e';
const INVENTORY_ARTIFACT_ID = 11440840273;
const INVENTORY_ARTIFACT_DIGEST = 'sha256:07ee41210122f42716269ab56f8775d78e10d00df39740315acc1ce055937c20';
const EXPECTED_BODIES = 1340;
const EXPECTED_BODY_IDENTITY_SHA = '54aa275ba01df592d59da941fd4b7896f749b124532e10c46c736399dda8f7f5';
const EXPECTED_SOURCE_KEY_SHA = '191f9eb9e70a0a7601c5cab29470f22eec0e7340f4feab60bbe3f74a457db7e7';
const EXPECTED_ROSTER_KEY_SHA = '0d105aa62156c9d1d6a88e09388e92e62866234bb784a7b7d354d88873bff2b2';
const EXPECTED_TARGET_EVENT_KEY_SHA = 'c4189c9a5321be8062b53b0f94f36c5ab4b195050777ef8b7f1487e6bbb63811';
const EXPECTED_UNIQUE_BODIES = 1319;
const EXPECTED_SIGNAL_DOCUMENTS = 400;
const EXPECTED_SIGNAL_MEMBERS = 123;
const SELECTED_DOCUMENTS = 50;
const EXPECTED_SELECTION_KEY_SHA = '984c1d1128968c0b22079421cbcdbf2580459622728efb01a030c461b99d3d62';
const OUTPUT_FILE = 'historical-density-2025-house-semantic-review-cohort-v1.json';

type Body = {
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
  httpStatus: number;
  text: string;
};

type BodiesArtifact = {
  schemaVersion: string;
  issue: number;
  session: string;
  frozenInput: {
    artifactId: number;
    artifactDigest: string;
    sourceKeySha256: string;
    rosterKeySha256: string;
    targetEventKeySha256: string;
    sourceEntries: number;
    targetEvents: number;
    targetBills: number;
  };
  recovery: {
    attemptedArticleBodies: number;
    fetchedArticleBodies: number;
    failedArticleBodies: number;
    bodyIdentitySha256: string;
    bodies: Body[];
  };
  exactBillScreen: {
    exactStatementCandidates: number;
    candidateArticles: number;
    candidateMembers: number;
    candidateBills: number;
    candidateTargetEvents: number;
  };
  policy: {
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    vercelUsed: boolean;
    targetVoteOutcomesRead: boolean;
    outcomeUse: string;
    sameDayEligible: boolean;
    allFetchedBodiesRetainedForSemanticReview: boolean;
    memberIssueApplicabilityInferred: boolean;
    contextOnly: boolean;
    mechanicallyActionable: boolean;
    modelWeight: number;
    featureRowsWritten: boolean;
    modelFitting: string;
    servingChanged: boolean;
  };
};

type InventoryEntry = {
  lrlId: string;
  memberName: string;
  articleUrl: string;
  publishedOn: string;
  strictFutureTargetEvents: Array<{
    voteEventId: string;
    billId: string;
    identifier: string;
    occurredOn: string;
  }>;
};

type InventoryArtifact = {
  schemaVersion: string;
  issue: number;
  session: string;
  target: {
    targetEventKeySha256: string;
    sameDayEligible: boolean;
  };
  publicRoster: {
    rosterKeySha256: string;
  };
  archiveInventory: {
    strictPreVoteSourceEntries: number;
    sourceKeySha256: string;
    sourceEntries: InventoryEntry[];
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

type SignalKind =
  | 'direct_stance'
  | 'voting_position'
  | 'authorship'
  | 'commitment'
  | 'priority';

type SignalDefinition = {
  kind: SignalKind;
  weight: number;
  pattern: RegExp;
};

type SignalHit = {
  kind: SignalKind;
  match: string;
  excerpt: string;
};

type Candidate = {
  body: Body;
  articleOwnedText: string;
  articleOwnedTextSha256: string;
  signalScore: number;
  signalHits: SignalHit[];
  strictFutureTargetEventCount: number;
  earliestStrictFutureTargetDate: string;
  latestStrictFutureTargetDate: string;
};

const SIGNALS: readonly SignalDefinition[] = [
  {
    kind: 'direct_stance',
    weight: 12,
    pattern: /\b(?:I|we)\s+(?:support|oppose|back|reject|favor|stand\s+for|stand\s+against|cannot\s+support|can't\s+support|won't\s+support|will\s+not\s+support)\b/gi,
  },
  {
    kind: 'voting_position',
    weight: 10,
    pattern: /\b(?:I|we)\s+(?:voted|vote)\s+(?:yes|no|aye|nay|for|against)\b|\b(?:I\s+am|I'm|we\s+are|we're)\s+proud\s+to\s+vote\b/gi,
  },
  {
    kind: 'authorship',
    weight: 8,
    pattern: /\b(?:I|we)\s+(?:introduced|authored|coauthored|co-authored)\b|\b(?:I\s+am|I'm|we\s+are|we're)\s+proud\s+to\s+(?:introduce|author|coauthor|co-author)\b/gi,
  },
  {
    kind: 'commitment',
    weight: 6,
    pattern: /\b(?:I\s+am|I'm|I\s+remain|we\s+are|we're|we\s+remain)\s+committed\s+to\b|\b(?:I|we)\s+will\s+(?:fight|protect|oppose|support|work\s+to|continue\s+to)\b/gi,
  },
  {
    kind: 'priority',
    weight: 4,
    pattern: /\b(?:my|our)\s+(?:top\s+)?(?:priority|priorities|goal|goals|commitment|commitments)\b/gi,
  },
];

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function articleOwnedText(text: string): string | undefined {
  const startMarker = ' Tweet ';
  const endMarker = ' Recent News for ';
  const start = text.indexOf(startMarker);
  if (start < 0) return undefined;
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0 || end <= start) return undefined;
  const value = text
    .slice(start + startMarker.length, end)
    .replace(/\s+/g, ' ')
    .trim();
  return value.length >= 120 ? value : undefined;
}

function excerptAround(text: string, index: number, matchLength: number): string {
  const start = Math.max(0, index - 220);
  const end = Math.min(text.length, index + matchLength + 300);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function signalHits(text: string): { score: number; hits: SignalHit[] } {
  let score = 0;
  const hits: SignalHit[] = [];
  for (const definition of SIGNALS) {
    const pattern = new RegExp(definition.pattern.source, definition.pattern.flags);
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      score += definition.weight;
      hits.push({
        kind: definition.kind,
        match: match[0],
        excerpt: excerptAround(text, index, match[0].length),
      });
    }
  }
  return { score, hits };
}

function main(): void {
  const bodiesPath = requiredEnv('VOTEPREDICT_HISTORICAL_DENSITY_2025_HOUSE_BODIES_PATH');
  const inventoryPath = requiredEnv('VOTEPREDICT_HISTORICAL_DENSITY_2025_HOUSE_INVENTORY_PATH');
  const outputDir = requiredEnv('VOTEPREDICT_HISTORICAL_DENSITY_2025_HOUSE_SEMANTIC_COHORT_OUTPUT_DIR');

  const bodiesArtifact = JSON.parse(readFileSync(bodiesPath, 'utf8')) as BodiesArtifact;
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as InventoryArtifact;

  if (
    bodiesArtifact.schemaVersion !== 'historical-density-2025-house-member-primary-bodies-v1'
    || bodiesArtifact.issue !== ISSUE
    || bodiesArtifact.session !== SESSION
    || bodiesArtifact.frozenInput.artifactId !== INVENTORY_ARTIFACT_ID
    || bodiesArtifact.frozenInput.artifactDigest !== INVENTORY_ARTIFACT_DIGEST
    || bodiesArtifact.frozenInput.sourceKeySha256 !== EXPECTED_SOURCE_KEY_SHA
    || bodiesArtifact.frozenInput.rosterKeySha256 !== EXPECTED_ROSTER_KEY_SHA
    || bodiesArtifact.frozenInput.targetEventKeySha256 !== EXPECTED_TARGET_EVENT_KEY_SHA
    || bodiesArtifact.frozenInput.sourceEntries !== EXPECTED_BODIES
    || bodiesArtifact.recovery.attemptedArticleBodies !== EXPECTED_BODIES
    || bodiesArtifact.recovery.fetchedArticleBodies !== EXPECTED_BODIES
    || bodiesArtifact.recovery.failedArticleBodies !== 0
    || bodiesArtifact.recovery.bodies.length !== EXPECTED_BODIES
    || bodiesArtifact.recovery.bodyIdentitySha256 !== EXPECTED_BODY_IDENTITY_SHA
    || bodiesArtifact.exactBillScreen.exactStatementCandidates !== 0
    || bodiesArtifact.exactBillScreen.candidateArticles !== 0
    || bodiesArtifact.exactBillScreen.candidateMembers !== 0
    || bodiesArtifact.exactBillScreen.candidateBills !== 0
    || bodiesArtifact.exactBillScreen.candidateTargetEvents !== 0
    || bodiesArtifact.policy.productionDatabaseQueried
    || bodiesArtifact.policy.productionWrites
    || bodiesArtifact.policy.vercelUsed
    || bodiesArtifact.policy.targetVoteOutcomesRead
    || bodiesArtifact.policy.outcomeUse !== 'none'
    || bodiesArtifact.policy.sameDayEligible
    || !bodiesArtifact.policy.allFetchedBodiesRetainedForSemanticReview
    || bodiesArtifact.policy.memberIssueApplicabilityInferred
    || !bodiesArtifact.policy.contextOnly
    || bodiesArtifact.policy.mechanicallyActionable
    || bodiesArtifact.policy.modelWeight !== 0
    || bodiesArtifact.policy.featureRowsWritten
    || bodiesArtifact.policy.modelFitting !== 'none'
    || bodiesArtifact.policy.servingChanged
  ) throw new Error('2025 House body-recovery identity or safety policy drifted');

  if (
    inventory.schemaVersion !== 'historical-density-2025-house-member-primary-inventory-v1'
    || inventory.issue !== ISSUE
    || inventory.session !== SESSION
    || inventory.target.targetEventKeySha256 !== EXPECTED_TARGET_EVENT_KEY_SHA
    || inventory.publicRoster.rosterKeySha256 !== EXPECTED_ROSTER_KEY_SHA
    || inventory.archiveInventory.strictPreVoteSourceEntries !== EXPECTED_BODIES
    || inventory.archiveInventory.sourceKeySha256 !== EXPECTED_SOURCE_KEY_SHA
    || inventory.archiveInventory.sourceEntries.length !== EXPECTED_BODIES
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
  ) throw new Error('2025 House source-inventory identity or safety policy drifted');

  const inventoryByUrl = new Map(
    inventory.archiveInventory.sourceEntries.map((entry) => [entry.articleUrl, entry] as const),
  );
  if (inventoryByUrl.size !== EXPECTED_BODIES) throw new Error('Frozen inventory URL set drifted');

  const exactBodyHashes = new Set<string>();
  const candidates: Candidate[] = [];
  let parsedArticleOwnedBodies = 0;

  for (const body of bodiesArtifact.recovery.bodies) {
    const source = inventoryByUrl.get(body.articleUrl);
    if (
      !source
      || source.lrlId !== body.lrlId
      || source.memberName !== body.memberName
      || source.publishedOn !== body.publishedOn
      || body.canonicalUrl !== body.articleUrl
      || body.httpStatus !== 200
    ) throw new Error(`Frozen body/source identity drifted for ${body.articleUrl}`);

    const owned = articleOwnedText(body.text);
    if (!owned) continue;
    parsedArticleOwnedBodies += 1;

    const bodyHash = sha256(owned.toLowerCase());
    if (exactBodyHashes.has(bodyHash)) continue;
    exactBodyHashes.add(bodyHash);

    const signals = signalHits(owned);
    if (signals.hits.length === 0) continue;

    const dates = source.strictFutureTargetEvents.map((event) => event.occurredOn).sort();
    if (
      dates.length === 0
      || dates.some((date) => !(body.publishedOn < date))
    ) throw new Error(`Frozen strict-pre-vote chronology drifted for ${body.articleUrl}`);

    candidates.push({
      body,
      articleOwnedText: owned,
      articleOwnedTextSha256: bodyHash,
      signalScore: signals.score,
      signalHits: signals.hits,
      strictFutureTargetEventCount: dates.length,
      earliestStrictFutureTargetDate: dates[0]!,
      latestStrictFutureTargetDate: dates.at(-1)!,
    });
  }

  if (parsedArticleOwnedBodies !== EXPECTED_BODIES) {
    throw new Error(`Expected article-owned text for ${EXPECTED_BODIES} bodies, got ${parsedArticleOwnedBodies}`);
  }
  if (exactBodyHashes.size !== EXPECTED_UNIQUE_BODIES) {
    throw new Error(`Expected ${EXPECTED_UNIQUE_BODIES} unique article-owned bodies, got ${exactBodyHashes.size}`);
  }
  if (candidates.length !== EXPECTED_SIGNAL_DOCUMENTS) {
    throw new Error(`Expected ${EXPECTED_SIGNAL_DOCUMENTS} strong-signal documents, got ${candidates.length}`);
  }

  const signalMembers = new Set(candidates.map((candidate) => candidate.body.lrlId));
  if (signalMembers.size !== EXPECTED_SIGNAL_MEMBERS) {
    throw new Error(`Expected ${EXPECTED_SIGNAL_MEMBERS} strong-signal members, got ${signalMembers.size}`);
  }

  candidates.sort((left, right) =>
    right.signalScore - left.signalScore
    || right.strictFutureTargetEventCount - left.strictFutureTargetEventCount
    || left.body.publishedOn.localeCompare(right.body.publishedOn)
    || left.body.memberName.localeCompare(right.body.memberName)
    || left.body.articleUrl.localeCompare(right.body.articleUrl)
  );

  const selected: Candidate[] = [];
  const selectedMembers = new Set<string>();
  for (const candidate of candidates) {
    if (selectedMembers.has(candidate.body.lrlId)) continue;
    selectedMembers.add(candidate.body.lrlId);
    selected.push(candidate);
    if (selected.length === SELECTED_DOCUMENTS) break;
  }

  if (selected.length !== SELECTED_DOCUMENTS || selectedMembers.size !== SELECTED_DOCUMENTS) {
    throw new Error(`Expected ${SELECTED_DOCUMENTS} selected documents/members`);
  }

  const selectionKeySha256 = sha256(
    `${selected.map((candidate) =>
      `${candidate.body.lrlId}|${candidate.body.articleUrl}|${candidate.body.contentSha256}|${candidate.body.publishedOn}|${candidate.articleOwnedTextSha256}|${candidate.signalScore}`
    ).sort().join('\n')}\n`,
  );
  if (selectionKeySha256 !== EXPECTED_SELECTION_KEY_SHA) {
    throw new Error(`Semantic cohort selection drifted: ${selectionKeySha256}`);
  }

  const documents = selected.map((candidate, index) => ({
    row: index + 1,
    publicMemberKey: `public-lrl:${SESSION}:${candidate.body.lrlId}`,
    lrlId: candidate.body.lrlId,
    memberName: candidate.body.memberName,
    districts: candidate.body.districts,
    parties: candidate.body.parties,
    articleUrl: candidate.body.articleUrl,
    articleTitle: candidate.body.articleTitle,
    publishedOn: candidate.body.publishedOn,
    contentSha256: candidate.body.contentSha256,
    fetchedAt: candidate.body.fetchedAt,
    articleOwnedTextSha256: candidate.articleOwnedTextSha256,
    articleOwnedText: candidate.articleOwnedText,
    signalScore: candidate.signalScore,
    signalKinds: [...new Set(candidate.signalHits.map((hit) => hit.kind))].sort(),
    signalHits: candidate.signalHits,
    strictFutureTargetEventCount: candidate.strictFutureTargetEventCount,
    earliestStrictFutureTargetDate: candidate.earliestStrictFutureTargetDate,
    latestStrictFutureTargetDate: candidate.latestStrictFutureTargetDate,
    candidateBillIdentifiers: [] as string[],
  }));

  const report = {
    schemaVersion: 'historical-density-2025-house-semantic-review-cohort-v1',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    session: SESSION,
    frozenInputs: {
      bodyArtifact: {
        artifactId: BODY_ARTIFACT_ID,
        digest: BODY_ARTIFACT_DIGEST,
        bodyIdentitySha256: EXPECTED_BODY_IDENTITY_SHA,
      },
      inventoryArtifact: {
        artifactId: INVENTORY_ARTIFACT_ID,
        digest: INVENTORY_ARTIFACT_DIGEST,
        sourceKeySha256: EXPECTED_SOURCE_KEY_SHA,
        rosterKeySha256: EXPECTED_ROSTER_KEY_SHA,
        targetEventKeySha256: EXPECTED_TARGET_EVENT_KEY_SHA,
      },
    },
    selection: {
      recoveredBodies: EXPECTED_BODIES,
      parsedArticleOwnedBodies,
      uniqueArticleOwnedBodies: exactBodyHashes.size,
      strongSignalDocuments: candidates.length,
      strongSignalMembers: signalMembers.size,
      selectedDocuments: documents.length,
      selectedMembers: selectedMembers.size,
      maximumDocumentsPerMember: 1,
      minimumSelectedSignalScore: Math.min(...selected.map((row) => row.signalScore)),
      maximumSelectedSignalScore: Math.max(...selected.map((row) => row.signalScore)),
      selectionKeySha256,
      targetBillTextUsed: false,
      targetBillIdentifiersUsedForSelection: false,
      targetVoteOutcomesUsed: false,
      targetEventIdentityUsedForSelection: false,
      strictFutureEventCountUsedForTieBreakOnly: true,
    },
    documents,
    policy: {
      outcomeBlind: true,
      outcomeUse: 'none',
      sourceBodiesAreOfficialHouseMemberPrimary: true,
      articleOwnedTextOnlyForSignalSelection: true,
      memberIssueOnlyAtThisStage: true,
      billInference: false,
      candidateBillIdentifiersRequiredEmpty: true,
      targetBillApplicabilityInferred: false,
      publicLrlIdentityOnly: true,
      internalMembershipIdentityResolved: false,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      sameDayEligible: false,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      featureRowsWritten: false,
      modelFitting: 'none',
      servingChanged: false,
      nextStepBoundary: 'Manually review the 50 frozen article-owned texts for member-issue semantic claims. Keep candidate bill identifiers empty. Only after semantic review may a separate strict-pre-vote applicability audit compare novel semantic claims to official bill text.',
    },
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, OUTPUT_FILE), `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify({
    historicalDensity2025HouseSemanticReviewCohort: {
      recoveredBodies: report.selection.recoveredBodies,
      uniqueArticleOwnedBodies: report.selection.uniqueArticleOwnedBodies,
      strongSignalDocuments: report.selection.strongSignalDocuments,
      strongSignalMembers: report.selection.strongSignalMembers,
      selectedDocuments: report.selection.selectedDocuments,
      selectedMembers: report.selection.selectedMembers,
      minimumSelectedSignalScore: report.selection.minimumSelectedSignalScore,
      maximumSelectedSignalScore: report.selection.maximumSelectedSignalScore,
      selectionKeySha256: report.selection.selectionKeySha256,
      candidateBillIdentifiers: 0,
      internalMembershipIdentityResolved: false,
      outcomeUse: 'none',
      productionDatabaseQueried: false,
      vercelUsed: false,
    },
  }, null, 2));
}

main();
