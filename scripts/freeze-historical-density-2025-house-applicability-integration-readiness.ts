import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const ISSUE = 718;
const SESSION = '2025-2026';
const CHAMBER = 'house';

const V17_SCHEMA = 'evidence-quality-historical-feature-matrix-v1.7-manifest';
const V17_MATRIX_SCHEMA = 'evidence-quality-historical-feature-matrix-v1.7';
const V17_ROWS = 135457;
const V17_EVENTS = 1339;
const V17_MEMBERSHIPS = 611;
const V17_ROW_KEY_SHA256 =
  '3aa47101f9e4a848e293fdaa89ef853919d49826b68ae90960370c5c19e9df72';
const V17_CANONICAL_SHA256 =
  'd681f257cdcded0d2cbebd68a93ea7edcab524863a68061a8059eca84963923a';
const V17_GZIP_SHA256 =
  'cc99480e9437fff9a09d7947b4e8728f872822cc86cf00d8edb8ecb925650664';
const V17_EXISTING_EXACT_ROWS = 38;
const V17_EXISTING_REVIEWED_ROWS = 6;
const V17_EXISTING_COMBINED_ROWS = 44;
const V17_EXISTING_2025_COMBINED_ROWS = 3;

const IDENTITY_SCHEMA =
  'historical-density-2025-house-replay-gap16-identity-v1';
const IDENTITY_CURRENT_ROSTER_SHA256 =
  'dccf018ae2a46d4232ae3a29b96c82d69536f7bfaf98de94676b42fe197cd40c';
const EXPECTED_CURRENT_IDENTITIES = 134;

const EXPECTED_APPLICABLE_CLAIM_EVENT_PAIRS = 48;
const EXPECTED_CANDIDATE_ARTIFACT_IDS = [
  11450382467,
  11451775355,
  11452236668,
  11453146518,
  11454147584,
  11454860978,
  11455338397,
  11454989971,
  11456955534,
  11456880675,
  11456386548,
] as const;

const DECISION_FILES = [
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-decisions-v1.json',
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranche-2-decisions-v1.json',
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranche-3-decisions-v1.json',
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranche-4-decisions-v1.json',
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranche-5-decisions-v1.json',
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranche-6-decisions-v1.json',
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranche-7-decisions-v1.json',
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranche-8-decisions-v1.json',
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranches-9-11-decisions-v1.json',
] as const;

type Json = Record<string, any>;

type DecisionSection = {
  decisionFile: string;
  trancheIndex: number;
  frozenCandidateArtifact: Json;
  overrides: Json[];
  policy: Json;
};

type MatrixState = {
  rowsByKey: Map<string, Json>;
  rowKeySha256: string;
  existingExactRows: number;
  existingReviewedRows: number;
  existingCombinedRows: number;
  existing2025CombinedRows: number;
};

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, 'utf8')) as Json;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function setSha(values: readonly string[]): string {
  return sha256(`${[...values].sort().join('\n')}\n`);
}

function exactNumberSet(values: readonly number[]): string {
  return JSON.stringify([...new Set(values)].sort((a, b) => a - b));
}

function anyNonzero(value: unknown): boolean {
  return Array.isArray(value)
    && value.some((entry) => Number(entry) !== 0);
}

function walkJsonFiles(dir: string): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...walkJsonFiles(path));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      output.push(path);
    }
  }
  return output.sort();
}

function loadCandidateAudits(root: string): Map<number, Json> {
  const audits = new Map<number, Json>();
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const artifactId = Number(entry.name);
    if (!Number.isInteger(artifactId)) {
      throw new Error(`Unexpected candidate artifact directory: ${entry.name}`);
    }
    const matches = walkJsonFiles(join(root, entry.name))
      .map((path) => ({ path, value: readJson(path) }))
      .filter(({ value }) =>
        typeof value.schemaVersion === 'string'
        && value.schemaVersion.startsWith(
          'historical-density-2025-house-applicability-candidate-audit',
        )
        && Array.isArray(value.candidateClaims)
        && Array.isArray(value.pairResults));

    if (matches.length !== 1) {
      throw new Error(
        `Expected one candidate audit in artifact ${artifactId}, found ${matches.length}`,
      );
    }
    audits.set(artifactId, matches[0]!.value);
  }

  const actual = exactNumberSet([...audits.keys()]);
  const expected = exactNumberSet(EXPECTED_CANDIDATE_ARTIFACT_IDS);
  if (actual !== expected) {
    throw new Error(`Candidate artifact set drifted: ${actual}`);
  }
  return audits;
}

function loadDecisionSections(): DecisionSection[] {
  const sections: DecisionSection[] = [];
  for (const file of DECISION_FILES) {
    const decision = readJson(resolve(file));
    if (
      decision.issue !== ISSUE
      || decision.session !== SESSION
      || decision.defaultDecision !== 'not_applicable'
      || decision.policy?.everyCandidateReviewed !== true
      || decision.policy?.applicableRequiresExplicitOverride !== true
      || decision.policy?.ambiguousRequiresExplicitOverride !== true
      || decision.policy?.outcomeUse !== 'none'
      || decision.policy?.targetVoteOutcomesRead !== false
      || decision.policy?.productionDatabaseQueried !== false
      || decision.policy?.productionWrites !== false
      || decision.policy?.vercelUsed !== false
      || decision.policy?.publicLrlIdentityOnly !== true
      || decision.policy?.internalMembershipIdentityResolved !== false
      || decision.policy?.internalIdentityRequiredBeforeFeatureIntegration !== true
      || decision.policy?.contextOnly !== true
      || decision.policy?.mechanicallyActionable !== false
      || decision.policy?.modelWeight !== 0
      || decision.policy?.featureRowsWritten !== false
      || decision.policy?.modelFitting !== 'none'
      || decision.policy?.servingChanged !== false
    ) {
      throw new Error(`Decision policy drifted: ${file}`);
    }

    if (Array.isArray(decision.tranches)) {
      for (const tranche of decision.tranches as Json[]) {
        sections.push({
          decisionFile: file,
          trancheIndex: Number(tranche.trancheIndex),
          frozenCandidateArtifact: tranche.frozenCandidateArtifact as Json,
          overrides: (tranche.overrides ?? []) as Json[],
          policy: decision.policy as Json,
        });
      }
    } else {
      const frozen = decision.frozenCandidateArtifact as Json;
      sections.push({
        decisionFile: file,
        trancheIndex: Number(frozen?.targetTrancheIndex ?? 1),
        frozenCandidateArtifact: frozen,
        overrides: (decision.overrides ?? []) as Json[],
        policy: decision.policy as Json,
      });
    }
  }

  const artifactIds = sections.map((section) =>
    Number(section.frozenCandidateArtifact?.artifactId));
  if (
    sections.length !== 11
    || exactNumberSet(artifactIds) !== exactNumberSet(EXPECTED_CANDIDATE_ARTIFACT_IDS)
  ) {
    throw new Error('Decision section/candidate artifact coverage drifted');
  }

  return sections.sort((a, b) => a.trancheIndex - b.trancheIndex);
}

function loadMatrix(manifestPath: string, matrixPath: string): MatrixState {
  const manifest = readJson(manifestPath);
  const gzipBytes = readFileSync(matrixPath);
  if (
    manifest.schemaVersion !== V17_SCHEMA
    || manifest.issue !== ISSUE
    || manifest.targetUniverse?.rows !== V17_ROWS
    || manifest.targetUniverse?.events !== V17_EVENTS
    || manifest.targetUniverse?.memberships !== V17_MEMBERSHIPS
    || manifest.targetUniverse?.rowKeySha256 !== V17_ROW_KEY_SHA256
    || manifest.featureFamilies?.exactBill?.nonzeroRows !== V17_EXISTING_EXACT_ROWS
    || manifest.featureFamilies?.reviewedApplicability?.nonzeroRows
      !== V17_EXISTING_REVIEWED_ROWS
    || manifest.coverage?.combinedNonzeroRows !== V17_EXISTING_COMBINED_ROWS
    || manifest.coverage?.bySession?.[SESSION]?.combinedNonzeroRows
      !== V17_EXISTING_2025_COMBINED_ROWS
    || manifest.digests?.matrixCanonicalNdjsonSha256 !== V17_CANONICAL_SHA256
    || manifest.digests?.matrixGzipSha256 !== V17_GZIP_SHA256
    || sha256(gzipBytes) !== V17_GZIP_SHA256
  ) {
    throw new Error('Historical feature matrix v1.7 manifest/gzip drifted');
  }

  const canonical = gunzipSync(gzipBytes).toString('utf8');
  if (sha256(canonical) !== V17_CANONICAL_SHA256) {
    throw new Error('Historical feature matrix v1.7 canonical digest drifted');
  }

  const rowsByKey = new Map<string, Json>();
  const rowKeys: string[] = [];
  let existingExactRows = 0;
  let existingReviewedRows = 0;
  let existingCombinedRows = 0;
  let existing2025CombinedRows = 0;

  for (const line of canonical.trimEnd().split('\n')) {
    const row = JSON.parse(line) as Json;
    if (row.schemaVersion !== V17_MATRIX_SCHEMA) {
      throw new Error('Unexpected v1.7 row schema');
    }
    const key = `${String(row.voteEventId)}|${String(row.membershipId)}`;
    if (rowsByKey.has(key)) throw new Error(`Duplicate v1.7 row key: ${key}`);
    rowsByKey.set(key, row);
    rowKeys.push(key);

    const exact = anyNonzero(row.features);
    const reviewed = anyNonzero(row.reviewedApplicabilityFeatures);
    if (exact) existingExactRows += 1;
    if (reviewed) existingReviewedRows += 1;
    if (exact || reviewed) {
      existingCombinedRows += 1;
      if (row.session === SESSION) existing2025CombinedRows += 1;
    }
  }

  const rowKeySha256 = setSha(rowKeys);
  if (
    rowsByKey.size !== V17_ROWS
    || rowKeySha256 !== V17_ROW_KEY_SHA256
    || existingExactRows !== V17_EXISTING_EXACT_ROWS
    || existingReviewedRows !== V17_EXISTING_REVIEWED_ROWS
    || existingCombinedRows !== V17_EXISTING_COMBINED_ROWS
    || existing2025CombinedRows !== V17_EXISTING_2025_COMBINED_ROWS
  ) {
    throw new Error('Historical feature matrix v1.7 row accounting drifted');
  }

  return {
    rowsByKey,
    rowKeySha256,
    existingExactRows,
    existingReviewedRows,
    existingCombinedRows,
    existing2025CombinedRows,
  };
}

function loadIdentity(path: string): Map<string, Json> {
  const identity = readJson(path);
  if (
    identity.schemaVersion !== IDENTITY_SCHEMA
    || identity.issue !== ISSUE
    || identity.session !== SESSION
    || identity.chamber !== CHAMBER
    || identity.identityCoverage?.currentPublicRosterIdentities
      !== EXPECTED_CURRENT_IDENTITIES
    || identity.identityCoverage?.unresolvedAfterSignature !== 0
    || identity.currentRoster?.mappingSha256 !== IDENTITY_CURRENT_ROSTER_SHA256
    || !Array.isArray(identity.currentRoster?.mappings)
    || identity.currentRoster.mappings.length !== EXPECTED_CURRENT_IDENTITIES
    || identity.policy?.productionDatabaseQueried !== false
    || identity.policy?.productionWrites !== false
    || identity.policy?.vercelUsed !== false
    || identity.policy?.semanticDecisionsUseOutcomes !== false
    || identity.policy?.featureRowsWritten !== false
    || identity.policy?.modelFitting !== 'none'
    || identity.policy?.servingChanged !== false
  ) {
    throw new Error('Frozen 2025 House identity artifact drifted');
  }

  const byLrl = new Map<string, Json>();
  for (const mapping of identity.currentRoster.mappings as Json[]) {
    const lrlId = String(mapping.lrlId);
    if (byLrl.has(lrlId)) throw new Error(`Duplicate LRL identity: ${lrlId}`);
    byLrl.set(lrlId, mapping);
  }
  return byLrl;
}

function main(): void {
  const candidateRoot = env('VOTEPREDICT_2025_HOUSE_CANDIDATE_ROOT');
  const output = resolve(
    process.env.VOTEPREDICT_2025_HOUSE_INTEGRATION_READINESS_OUTPUT
      ?? 'tmp/historical-density-2025-house-applicability-integration-readiness-v1.json',
  );

  const candidatesByArtifact = loadCandidateAudits(candidateRoot);
  const sections = loadDecisionSections();
  const matrix = loadMatrix(
    env('VOTEPREDICT_V17_MANIFEST_PATH'),
    env('VOTEPREDICT_V17_MATRIX_PATH'),
  );
  const identityByLrl = loadIdentity(
    env('VOTEPREDICT_2025_HOUSE_IDENTITY_PATH'),
  );

  const applicable: Array<{
    trancheIndex: number;
    decisionFile: string;
    decision: Json;
    candidate: Json;
  }> = [];

  for (const section of sections) {
    const frozen = section.frozenCandidateArtifact;
    const artifactId = Number(frozen.artifactId);
    const audit = candidatesByArtifact.get(artifactId);
    if (!audit) throw new Error(`Missing candidate artifact ${artifactId}`);

    if (
      audit.issue !== ISSUE
      || audit.session !== SESSION
      || audit.cohort?.internalMembershipIdentitiesResolved !== 0
      || audit.policy?.outcomeUse !== 'none'
      || audit.policy?.targetVoteOutcomesRead !== false
      || audit.policy?.productionDatabaseQueried !== false
      || audit.policy?.productionWrites !== false
      || audit.policy?.vercelUsed !== false
      || audit.policy?.publicLrlIdentityOnly !== true
      || audit.policy?.internalMembershipIdentityResolved !== false
      || audit.policy?.internalIdentityRequiredBeforeFeatureIntegration !== true
      || audit.policy?.featureRowsWritten !== false
      || audit.policy?.modelFitting !== 'none'
      || audit.policy?.servingChanged !== false
    ) {
      throw new Error(`Candidate audit policy drifted: artifact ${artifactId}`);
    }

    const candidateClaims = audit.candidateClaims as Json[];
    if (candidateClaims.length !== Number(frozen.candidatePairs)) {
      throw new Error(`Candidate count drifted: artifact ${artifactId}`);
    }
    const reviewKeys = candidateClaims.map((row) => String(row.reviewKey));
    if (
      new Set(reviewKeys).size !== candidateClaims.length
      || setSha(reviewKeys) !== String(frozen.reviewKeySha256)
    ) {
      throw new Error(`Candidate review-key proof drifted: artifact ${artifactId}`);
    }

    const candidateByKey = new Map(
      candidateClaims.map((row) => [String(row.reviewKey), row] as const),
    );

    for (const override of section.overrides) {
      if (override.decision !== 'applicable') continue;
      const reviewKey = String(override.reviewKey);
      const candidate = candidateByKey.get(reviewKey);
      if (!candidate) {
        throw new Error(`Applicable override missing candidate: ${reviewKey}`);
      }
      if (
        !String(override.billPolicyDirection ?? '').trim()
        || !['aligns', 'conflicts'].includes(String(override.alignmentDirection))
        || !String(override.reason ?? '').trim()
      ) {
        throw new Error(`Applicable override lacks directional review: ${reviewKey}`);
      }
      applicable.push({
        trancheIndex: section.trancheIndex,
        decisionFile: section.decisionFile,
        decision: override,
        candidate,
      });
    }
  }

  const reviewKeys = applicable.map((row) => String(row.candidate.reviewKey));
  if (
    applicable.length !== EXPECTED_APPLICABLE_CLAIM_EVENT_PAIRS
    || new Set(reviewKeys).size !== applicable.length
  ) {
    throw new Error(
      `Applicable claim-event count drifted: ${applicable.length}`,
    );
  }

  const integrationByRow = new Map<string, Json>();
  const applicablePublicMembers = new Set<string>();
  const applicableEvents = new Set<string>();
  const applicableBills = new Set<string>();

  for (const row of applicable) {
    const candidate = row.candidate;
    const decision = row.decision;
    const lrlId = String(candidate.lrlId);
    const identity = identityByLrl.get(lrlId);
    if (!identity) {
      throw new Error(
        `Applicable public member does not resolve through frozen identity map: ${lrlId}`,
      );
    }
    if (
      String(candidate.publicMemberKey) !== `public-lrl:${SESSION}:${lrlId}`
      || candidate.chamber !== CHAMBER
      || candidate.internalMembershipIdentityResolved !== false
      || !(String(candidate.claimAvailableAt) < String(candidate.occurredOn))
      || candidate.versionProof?.strictlyBeforeVoteDate !== true
      || !(String(candidate.versionProof?.postedOn) < String(candidate.occurredOn))
    ) {
      throw new Error(`Applicable candidate chronology/identity drifted: ${candidate.reviewKey}`);
    }

    const membershipId = String(identity.membershipId);
    const legislatorId = String(identity.legislatorId);
    const matrixKey = `${String(candidate.voteEventId)}|${membershipId}`;
    const matrixRow = matrix.rowsByKey.get(matrixKey);
    if (!matrixRow) {
      throw new Error(`Applicable member-event row missing from v1.7: ${matrixKey}`);
    }
    if (
      matrixRow.session !== SESSION
      || matrixRow.chamber !== CHAMBER
      || String(matrixRow.legislatorId) !== legislatorId
      || String(matrixRow.billId) !== String(candidate.billId)
      || String(matrixRow.identifier) !== String(candidate.identifier)
      || String(matrixRow.occurredOn) !== String(candidate.occurredOn)
    ) {
      throw new Error(`Applicable member-event row identity mismatch: ${matrixKey}`);
    }
    if (
      anyNonzero(matrixRow.features)
      || anyNonzero(matrixRow.reviewedApplicabilityFeatures)
      || matrixRow.reviewedApplicability !== null
    ) {
      throw new Error(
        `Applicable member-event overlaps existing directional evidence: ${matrixKey}`,
      );
    }

    const claim = {
      reviewKey: String(candidate.reviewKey),
      trancheIndex: row.trancheIndex,
      decisionFile: basename(row.decisionFile),
      semanticKey: String(candidate.semanticKey),
      publicMemberKey: String(candidate.publicMemberKey),
      lrlId,
      candidateMemberName: String(candidate.memberName),
      claimAvailableAt: String(candidate.claimAvailableAt),
      memberStance: String(candidate.memberStance),
      normalizedClaim: String(candidate.normalizedClaim),
      claimType: String(candidate.claimType),
      explicitness: String(candidate.explicitness),
      extractionConfidence: Number(candidate.extractionConfidence),
      sourceRows: [...(candidate.sourceRows ?? [])],
      sourceUrls: [...(candidate.sourceUrls ?? [])],
      billPolicyDirection: String(decision.billPolicyDirection),
      alignmentDirection: String(decision.alignmentDirection),
      reviewReason: String(decision.reason),
      versionProof: {
        versionUrl: String(candidate.versionProof?.versionUrl),
        postedOn: String(candidate.versionProof?.postedOn),
        ordinal: Number(candidate.versionProof?.ordinal),
        textSha256: String(candidate.versionProof?.textSha256),
      },
    };

    const existing = integrationByRow.get(matrixKey);
    if (existing) {
      existing.claims.push(claim);
      existing.claims.sort((a: Json, b: Json) =>
        String(a.reviewKey).localeCompare(String(b.reviewKey)));
    } else {
      integrationByRow.set(matrixKey, {
        rowKey: matrixKey,
        voteEventId: String(candidate.voteEventId),
        membershipId,
        legislatorId,
        identityMemberName: String(identity.memberName),
        lrlId,
        billId: String(candidate.billId),
        identifier: String(candidate.identifier),
        occurredOn: String(candidate.occurredOn),
        session: SESSION,
        chamber: CHAMBER,
        claims: [claim],
        contextOnly: true,
        mechanicallyActionable: false,
        modelWeight: 0,
        integrationReady: true,
      });
    }

    applicablePublicMembers.add(lrlId);
    applicableEvents.add(String(candidate.voteEventId));
    applicableBills.add(String(candidate.billId));
  }

  const integrationRows = [...integrationByRow.values()]
    .sort((a, b) => String(a.rowKey).localeCompare(String(b.rowKey)));
  const integrationRowKeys = integrationRows.map((row) => String(row.rowKey));

  const applicableReviewKeySha256 = setSha(reviewKeys);
  const integrationRowKeySha256 = setSha(integrationRowKeys);
  const integrationClaimProofSha256 = setSha(
    integrationRows.flatMap((row) =>
      (row.claims as Json[]).map((claim) =>
        [
          row.rowKey,
          row.legislatorId,
          claim.reviewKey,
          claim.lrlId,
          claim.claimAvailableAt,
          claim.memberStance,
          claim.billPolicyDirection,
          claim.alignmentDirection,
          claim.versionProof.textSha256,
        ].join('|')),
    ),
  );

  const report = {
    schemaVersion:
      'historical-density-2025-house-applicability-integration-readiness-v1',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    session: SESSION,
    chamber: CHAMBER,
    frozenInputs: {
      historicalFeatureMatrixV17: {
        artifactId: 11436413885,
        artifactDigest:
          'sha256:fc1d77ccc51bc33f3e3f1c0dd6622c0f2a9797d62a8d54bcb65906de30228e44',
        rows: V17_ROWS,
        rowKeySha256: matrix.rowKeySha256,
        matrixCanonicalNdjsonSha256: V17_CANONICAL_SHA256,
        matrixGzipSha256: V17_GZIP_SHA256,
      },
      currentHouseIdentityMap: {
        runId: 37618812260,
        artifactId: 11480438899,
        artifactDigest:
          'sha256:a932390e813ae038b15fe4b24218755bc706c33d43f7b2c2a9aa9836e0ca51f6',
        currentRosterMappingSha256: IDENTITY_CURRENT_ROSTER_SHA256,
        identities: EXPECTED_CURRENT_IDENTITIES,
      },
      candidateArtifacts: sections.map((section) => ({
        trancheIndex: section.trancheIndex,
        artifactId: Number(section.frozenCandidateArtifact.artifactId),
        digest: String(section.frozenCandidateArtifact.digest),
        reviewKeySha256: String(section.frozenCandidateArtifact.reviewKeySha256),
      })),
      decisionFiles: DECISION_FILES.map(basename),
    },
    review: {
      applicableClaimEventPairs: applicable.length,
      applicableReviewKeySha256,
      publicMembers: applicablePublicMembers.size,
      targetEvents: applicableEvents.size,
      bills: applicableBills.size,
    },
    identityResolution: {
      applicablePairsResolved: applicable.length,
      applicablePairsUnresolved: 0,
      identityMapCurrentMembers: identityByLrl.size,
      identityMapCoverageComplete: identityByLrl.size === EXPECTED_CURRENT_IDENTITIES,
    },
    matrixBoundary: {
      rows: matrix.rowsByKey.size,
      existingExactDirectionalRows: matrix.existingExactRows,
      existingReviewedApplicabilityRows: matrix.existingReviewedRows,
      existingCombinedDirectionalRows: matrix.existingCombinedRows,
      existing2025CombinedDirectionalRows: matrix.existing2025CombinedRows,
      applicableRowsMissingFromMatrix: 0,
      applicableRowsWithIdentityMismatch: 0,
      overlapWithExistingExactDirectionalRows: 0,
      overlapWithExistingReviewedApplicabilityRows: 0,
    },
    integration: {
      applicableClaimEventPairs: applicable.length,
      uniqueMemberEventRows: integrationRows.length,
      duplicateClaimEventPairs: applicable.length - integrationRows.length,
      rowKeySha256: integrationRowKeySha256,
      claimProofSha256: integrationClaimProofSha256,
      rows: integrationRows,
    },
    policy: {
      readOnly: true,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      targetVoteOutcomesRead: false,
      semanticDecisionsUseOutcomes: false,
      upstreamIdentityBridgeOutcomeUse: 'identity_resolution_only',
      strictPreEventAvailabilityRequired: true,
      sameDayEvidenceExcluded: true,
      internalIdentityRequiredAndResolved: true,
      existingDirectionalRowsMayBeOverwritten: false,
      featureRowsWritten: false,
      modelFitting: 'none',
      servingChanged: false,
      mechanicallyActionable: false,
      modelWeight: 0,
      nextAuthorizedStep:
        'strict-additive-v1.8-overlay-only-after-this-readiness-artifact-is-pinned',
    },
  };

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    historicalDensity2025HouseApplicabilityIntegrationReadiness: {
      applicableClaimEventPairs: report.review.applicableClaimEventPairs,
      publicMembers: report.review.publicMembers,
      targetEvents: report.review.targetEvents,
      bills: report.review.bills,
      uniqueMemberEventRows: report.integration.uniqueMemberEventRows,
      duplicateClaimEventPairs: report.integration.duplicateClaimEventPairs,
      applicableReviewKeySha256,
      integrationRowKeySha256,
      integrationClaimProofSha256,
      identityMapCoverageComplete:
        report.identityResolution.identityMapCoverageComplete,
      existingDirectionalOverlap: 0,
      productionDatabaseQueried: false,
      targetVoteOutcomesRead: false,
    },
  }, null, 2));
}

main();
