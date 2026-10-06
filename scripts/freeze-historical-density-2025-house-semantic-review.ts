import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ISSUE = 718;
const SESSION = '2025-2026';
const BATCH_ID = 'EQV1-HISTORICAL-DENSITY-2025-HOUSE-001';
const COHORT_SCHEMA = 'historical-density-2025-house-semantic-review-cohort-v1';
const OUTPUT_SCHEMA = 'historical-density-2025-house-semantic-review-v1';
const COHORT_RUN_ID = 37528910948;
const COHORT_ARTIFACT_ID = 11442499885;
const COHORT_ARTIFACT_DIGEST = 'sha256:c8551e3690cb8d4a8a9cee2c0cc5b006a5b87d1e6c0baa6a7f6755aae2ee1662';
const COHORT_SELECTION_KEY_SHA256 = '984c1d1128968c0b22079421cbcdbf2580459622728efb01a030c461b99d3d62';
const EXPECTED_DOCUMENTS = 50;
const EXPECTED_DIRECTIONAL = 46;
const EXPECTED_NON_DIRECTIONAL = 4;
const EXPECTED_HEADER = ['row','decision','semanticKey','topics','claimType','stance','explicitness','normalizedClaim','excerptStart','excerptEnd','excerptSha256','reasonCode'];
const OUTPUT_FILE = 'historical-density-2025-house-semantic-review-v1.json';

type CohortDocument = {
  row: number; publicMemberKey: string; lrlId: string; memberName: string; districts: string[]; parties: string[];
  articleUrl: string; articleTitle: string; publishedOn: string; contentSha256: string; articleOwnedTextSha256: string;
  articleOwnedText: string; earliestStrictFutureTargetDate: string; candidateBillIdentifiers: string[];
};
type Cohort = {
  schemaVersion: string; issue: number; session: string;
  selection: {
    selectedDocuments: number; selectedMembers: number; maximumDocumentsPerMember: number; selectionKeySha256: string;
    targetBillTextUsed: boolean; targetBillIdentifiersUsedForSelection: boolean; targetVoteOutcomesUsed: boolean;
    targetEventIdentityUsedForSelection: boolean; strictFutureEventCountUsedForTieBreakOnly: boolean;
  };
  documents: CohortDocument[];
  policy: {
    outcomeBlind: boolean; outcomeUse: string; memberIssueOnlyAtThisStage: boolean; billInference: boolean;
    candidateBillIdentifiersRequiredEmpty: boolean; targetBillApplicabilityInferred: boolean; publicLrlIdentityOnly: boolean;
    internalMembershipIdentityResolved: boolean; productionDatabaseQueried: boolean; productionWrites: boolean; vercelUsed: boolean;
    sameDayEligible: boolean; contextOnly: boolean; mechanicallyActionable: boolean; modelWeight: number;
    featureRowsWritten: boolean; modelFitting: string; servingChanged: boolean;
  };
};
type DirectionalDecision = {
  row: number; decision: 'directional'; semanticKey: string; topics: string[];
  claimType: 'quoted_position' | 'explicit_position'; stance: 'supports' | 'opposes';
  explicitness: 'direct_quote' | 'document_position'; normalizedClaim: string;
  excerptStart: number; excerptEnd: number; excerptSha256: string;
};
type NonDirectionalDecision = { row: number; decision: 'non_directional'; reasonCode: string };
type Decision = DirectionalDecision | NonDirectionalDecision;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function parseDecisions(path: string): Decision[] {
  const lines = readFileSync(path, 'utf8').trimEnd().split(/\r?\n/);
  if (JSON.stringify(lines[0]!.split('\t')) !== JSON.stringify(EXPECTED_HEADER)) throw new Error('Semantic decision TSV header drifted');
  return lines.slice(1).map((line, index) => {
    const [rowRaw, decision, semanticKey, topicsRaw, claimType, stance, explicitness, normalizedClaim, startRaw, endRaw, excerptSha256, reasonCode] = line.split('\t');
    const row = Number(rowRaw);
    if (row !== index + 1) throw new Error(`Decision row order drifted at ${rowRaw}`);
    if (decision === 'non_directional') {
      if (!reasonCode || semanticKey || topicsRaw || claimType || stance || explicitness || normalizedClaim || startRaw || endRaw || excerptSha256) throw new Error(`Malformed non-directional row ${row}`);
      return { row, decision, reasonCode };
    }
    if (decision !== 'directional' || !semanticKey || !topicsRaw || !normalizedClaim || !excerptSha256) throw new Error(`Malformed directional row ${row}`);
    if (claimType !== 'quoted_position' && claimType !== 'explicit_position') throw new Error(`Invalid claim type row ${row}`);
    if (stance !== 'supports' && stance !== 'opposes') throw new Error(`Invalid stance row ${row}`);
    if (explicitness !== 'direct_quote' && explicitness !== 'document_position') throw new Error(`Invalid explicitness row ${row}`);
    const excerptStart = Number(startRaw), excerptEnd = Number(endRaw);
    if (!Number.isInteger(excerptStart) || !Number.isInteger(excerptEnd) || excerptStart < 0 || excerptEnd <= excerptStart) throw new Error(`Invalid excerpt offsets row ${row}`);
    return { row, decision, semanticKey, topics: topicsRaw.split(';'), claimType, stance, explicitness, normalizedClaim, excerptStart, excerptEnd, excerptSha256 };
  });
}

function main(): void {
  const cohort = JSON.parse(readFileSync(requiredEnv('VOTEPREDICT_HISTORICAL_DENSITY_2025_HOUSE_SEMANTIC_COHORT_PATH'), 'utf8')) as Cohort;
  const decisions = parseDecisions(requiredEnv('VOTEPREDICT_HISTORICAL_DENSITY_2025_HOUSE_SEMANTIC_DECISION_PATH'));
  const outputDir = requiredEnv('VOTEPREDICT_HISTORICAL_DENSITY_2025_HOUSE_SEMANTIC_REVIEW_OUTPUT_DIR');

  if (
    cohort.schemaVersion !== COHORT_SCHEMA || cohort.issue !== ISSUE || cohort.session !== SESSION
    || cohort.selection.selectedDocuments !== EXPECTED_DOCUMENTS || cohort.selection.selectedMembers !== EXPECTED_DOCUMENTS
    || cohort.selection.maximumDocumentsPerMember !== 1 || cohort.selection.selectionKeySha256 !== COHORT_SELECTION_KEY_SHA256
    || cohort.selection.targetBillTextUsed || cohort.selection.targetBillIdentifiersUsedForSelection || cohort.selection.targetVoteOutcomesUsed
    || cohort.selection.targetEventIdentityUsedForSelection || !cohort.selection.strictFutureEventCountUsedForTieBreakOnly
    || cohort.documents.length !== EXPECTED_DOCUMENTS || !cohort.policy.outcomeBlind || cohort.policy.outcomeUse !== 'none'
    || !cohort.policy.memberIssueOnlyAtThisStage || cohort.policy.billInference || !cohort.policy.candidateBillIdentifiersRequiredEmpty
    || cohort.policy.targetBillApplicabilityInferred || !cohort.policy.publicLrlIdentityOnly || cohort.policy.internalMembershipIdentityResolved
    || cohort.policy.productionDatabaseQueried || cohort.policy.productionWrites || cohort.policy.vercelUsed || cohort.policy.sameDayEligible
    || !cohort.policy.contextOnly || cohort.policy.mechanicallyActionable || cohort.policy.modelWeight !== 0 || cohort.policy.featureRowsWritten
    || cohort.policy.modelFitting !== 'none' || cohort.policy.servingChanged
  ) throw new Error('2025 House semantic cohort identity or safety policy drifted');

  if (decisions.length !== EXPECTED_DOCUMENTS) throw new Error(`Expected ${EXPECTED_DOCUMENTS} decisions, got ${decisions.length}`);
  const directional = decisions.filter((d): d is DirectionalDecision => d.decision === 'directional');
  const nonDirectional = decisions.filter((d): d is NonDirectionalDecision => d.decision === 'non_directional');
  if (directional.length !== EXPECTED_DIRECTIONAL || nonDirectional.length !== EXPECTED_NON_DIRECTIONAL) throw new Error(`Semantic counts drifted ${directional.length}/${nonDirectional.length}`);

  const semanticKeys = new Set<string>();
  const publicMemberKeys = new Set<string>();
  const documentReviews = decisions.map((decision) => {
    const document = cohort.documents[decision.row - 1];
    if (!document || document.row !== decision.row || document.publicMemberKey !== `public-lrl:${SESSION}:${document.lrlId}`
      || document.candidateBillIdentifiers.length !== 0 || !(document.publishedOn < document.earliestStrictFutureTargetDate)) {
      throw new Error(`Frozen cohort document boundary drifted at row ${decision.row}`);
    }
    if (publicMemberKeys.has(document.publicMemberKey)) throw new Error(`Duplicate public member ${document.publicMemberKey}`);
    publicMemberKeys.add(document.publicMemberKey);
    const shared = {
      row: decision.row, publicMemberKey: document.publicMemberKey, lrlId: document.lrlId, memberName: document.memberName,
      districts: document.districts, parties: document.parties, sourceUrl: document.articleUrl, sourceTitle: document.articleTitle,
      sourceContentSha256: document.contentSha256, articleOwnedTextSha256: document.articleOwnedTextSha256, availableAt: document.publishedOn,
      candidateBillIdentifiers: [] as string[], internalMembershipId: null as null, internalLegislatorId: null as null,
    };
    if (decision.decision === 'non_directional') return { ...shared, decision: decision.decision, reasonCode: decision.reasonCode };
    if (semanticKeys.has(decision.semanticKey)) throw new Error(`Duplicate semantic key ${decision.semanticKey}`);
    semanticKeys.add(decision.semanticKey);
    const excerpt = document.articleOwnedText.slice(decision.excerptStart, decision.excerptEnd);
    if (!excerpt || sha256(excerpt) !== decision.excerptSha256) throw new Error(`Exact excerpt proof drifted at row ${decision.row}`);
    return { ...shared, decision: decision.decision, semanticKey: decision.semanticKey, topics: decision.topics, claimType: decision.claimType,
      stance: decision.stance, explicitness: decision.explicitness, normalizedClaim: decision.normalizedClaim, supportingExcerpt: excerpt };
  });
  if (semanticKeys.size !== EXPECTED_DIRECTIONAL || publicMemberKeys.size !== EXPECTED_DOCUMENTS) throw new Error('Semantic/public-member identity accounting drifted');

  const semanticGroups = documentReviews.flatMap((review) => review.decision !== 'directional' ? [] : [{
    semanticKey: review.semanticKey, publicMemberKey: review.publicMemberKey, lrlId: review.lrlId, memberName: review.memberName,
    internalMembershipId: null, internalLegislatorId: null, sourceRows: [review.row], sourceUrls: [review.sourceUrl],
    sourceContentSha256: [review.sourceContentSha256], earliestAvailability: review.availableAt, topics: review.topics,
    claimType: review.claimType, stance: review.stance, explicitness: review.explicitness, normalizedClaim: review.normalizedClaim,
    supportingExcerpt: review.supportingExcerpt, linkage: 'member_issue' as const, candidateBillIdentifiers: [] as string[],
    internalIdentityResolution: 'pending' as const, applicabilityDecision: 'not_evaluated' as const,
  }]).sort((a, b) => a.semanticKey.localeCompare(b.semanticKey));

  const decisionKeySha256 = sha256(`${decisions.map((d) => d.decision === 'directional'
    ? `${d.row}|${d.semanticKey}|${d.stance}|${d.excerptStart}|${d.excerptEnd}|${d.excerptSha256}`
    : `${d.row}|non_directional|${d.reasonCode}`).join('\n')}\n`);
  const report = {
    schemaVersion: OUTPUT_SCHEMA, generatedAt: new Date().toISOString(), batchId: BATCH_ID, issue: ISSUE, session: SESSION,
    frozenCohort: { runId: COHORT_RUN_ID, artifactId: COHORT_ARTIFACT_ID, digest: COHORT_ARTIFACT_DIGEST, selectionKeySha256: COHORT_SELECTION_KEY_SHA256 },
    decisionKeySha256,
    summary: { documents: EXPECTED_DOCUMENTS, publicMembers: EXPECTED_DOCUMENTS, directionalDocuments: directional.length,
      nonDirectionalDocuments: nonDirectional.length, uniqueSemanticGroups: semanticGroups.length, candidateBillIdentifiers: 0,
      internalMembershipMappings: 0, internalLegislatorMappings: 0 },
    documentReviews, semanticGroups,
    policy: { outcomeBlind: true, outcomeUse: 'none', publicLrlIdentityOnly: true, internalMembershipIdentityResolved: false,
      internalIdentityMustBeResolvedBeforeApplicabilityOrMatrixOverlay: true, memberIssueOnly: true, billInference: false,
      candidateBillIdentifiersRequiredEmpty: true, targetBillApplicabilityInferred: false, productionDatabaseQueried: false,
      productionWrites: false, vercelUsed: false, sameDayEligible: false, contextOnly: true, mechanicallyActionable: false,
      modelWeight: 0, featureRowsWritten: false, modelFitting: 'none', servingChanged: false,
      nextStepBoundary: 'Resolve public LRL identity to an outcome-blind internal membership mapping before any strict-pre-vote applicability audit or matrix overlay. Do not infer internal UUIDs from names or districts.' },
  };
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, OUTPUT_FILE), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ historicalDensity2025HouseSemanticReview: { ...report.summary, decisionKeySha256, outcomeUse: 'none', productionDatabaseQueried: false, vercelUsed: false } }, null, 2));
}

main();
