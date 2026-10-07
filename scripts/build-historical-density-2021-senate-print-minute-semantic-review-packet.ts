import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const INTAKE_BUNDLE_SCHEMA =
  'historical-density-2021-senate-print-minute-intake-bundle-v1';
const SOURCE_LEDGER_SCHEMA =
  'historical-density-2021-senate-print-minute-local-source-ledger-v1';
const REVIEW_PACKET_SCHEMA =
  'historical-density-2021-senate-print-minute-semantic-review-packet-v1';
const DECISION_TEMPLATE_SCHEMA =
  'historical-density-2021-senate-print-minute-semantic-review-decisions-template-v1';

type Json = Record<string, any>;

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
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as Json;
}

function main(): void {
  const bundle = readJson(env('VOTEPREDICT_SENATE_2021_INTAKE_BUNDLE_PATH'));
  const ledger = readJson(env('VOTEPREDICT_SENATE_2021_SOURCE_LEDGER_PATH'));
  const outputDir = resolve(
    process.env.VOTEPREDICT_SENATE_2021_REVIEW_PACKET_OUTPUT_DIR
      ?? 'tmp/senate-2021-print-minute-semantic-review-packet',
  );

  if (
    bundle.schemaVersion !== INTAKE_BUNDLE_SCHEMA
    || ledger.schemaVersion !== SOURCE_LEDGER_SCHEMA
    || bundle.requestPackage?.artifactId !== 11496898656
    || ledger.requestPackage?.artifactId !== 11496898656
    || bundle.requestPackage?.artifactDigest
      !== 'sha256:c7d6d274dd734878efbb830a1c8c17a35afb1503e30ca4917cefc8e1d39fb26e'
    || ledger.requestPackage?.artifactDigest
      !== 'sha256:c7d6d274dd734878efbb830a1c8c17a35afb1503e30ca4917cefc8e1d39fb26e'
    || bundle.requestPackage?.sourceCommitSha
      !== '39360a45fa9f8856e26001e4b005246c51467bcf'
    || ledger.requestPackage?.sourceCommitSha
      !== '39360a45fa9f8856e26001e4b005246c51467bcf'
    || bundle.requestPackage?.requestAssociationProofSha256
      !== '6d3ecfa7d433e8a3f3c835ecc9934a0b68cab53f213501b333e873d32d29a1d0'
    || ledger.requestPackage?.requestAssociationProofSha256
      !== '6d3ecfa7d433e8a3f3c835ecc9934a0b68cab53f213501b333e873d32d29a1d0'
    || bundle.policy?.targetVoteOutcomesRead !== false
    || bundle.policy?.returnedMinuteAutomaticallyEvidence !== false
    || bundle.policy?.featureRowsWritten !== false
    || bundle.policy?.modelFitting !== 'none'
    || bundle.policy?.servingChanged !== false
    || ledger.policy?.successfulIntakeCreatesEvidence !== false
    || ledger.policy?.targetVoteOutcomesRead !== false
    || ledger.policy?.featureRowsWritten !== false
    || ledger.policy?.modelFitting !== 'none'
    || ledger.policy?.servingChanged !== false
  ) {
    throw new Error('Senate print-minute intake lineage/policy drifted');
  }

  if (
    bundle.summary?.documents !== bundle.documents?.length
    || ledger.summary?.documents !== ledger.sources?.length
    || bundle.documents?.length !== ledger.sources?.length
  ) {
    throw new Error('Intake bundle/source-ledger document cardinality drifted');
  }

  const ledgerByDocument = new Map<string, Json>();
  for (const source of ledger.sources as Json[]) {
    if (
      !source.documentId?.trim()
      || !/^[a-f0-9]{64}$/.test(source.contentSha256)
      || !source.archivedRelativePath?.startsWith('sources/')
      || ledgerByDocument.has(source.documentId)
    ) {
      throw new Error(`Invalid source-ledger row: ${String(source.documentId)}`);
    }
    ledgerByDocument.set(source.documentId, source);
  }

  const rows: Json[] = [];
  for (const document of bundle.documents as Json[]) {
    const source = ledgerByDocument.get(document.id);
    if (
      !source
      || source.contentSha256 !== document.contentSha256
      || source.committeeEventId !== document.committeeEventId
      || source.committeeName !== document.committeeName
      || source.documentDate !== document.documentDate
      || document.semanticStatus !== 'unreviewed'
      || document.evidenceStatus !== 'not_evidence'
      || document.mechanicallyActionable !== false
      || document.modelWeight !== 0
      || !Array.isArray(document.candidateTargets)
      || document.candidateTargets.length === 0
    ) {
      throw new Error(`Unsafe or mismatched intake document: ${String(document.id)}`);
    }

    for (const target of document.candidateTargets as Json[]) {
      if (
        !target.voteEventId?.trim()
        || !target.billId?.trim()
        || !target.identifier?.trim()
        || !(document.documentDate < target.targetVoteDate)
        || target.targetVoteDate !== target.requestWindowEndExclusive
      ) {
        throw new Error(
          `Unsafe candidate target ${String(document.id)}|${String(target.voteEventId)}`,
        );
      }

      const reviewKey = [
        document.contentSha256,
        target.voteEventId,
        target.billId,
      ].join('|');

      rows.push({
        row: 0,
        reviewKey,
        documentId: document.id,
        sourceContentSha256: document.contentSha256,
        archivedRelativePath: source.archivedRelativePath,
        committeeEventId: document.committeeEventId,
        committeeName: document.committeeName,
        documentDate: document.documentDate,
        sourceTitle: document.title,
        lrlReference: document.provenance?.lrlReference ?? null,
        acquisitionMethod: document.provenance?.acquisitionMethod ?? null,
        candidateTarget: {
          voteEventId: target.voteEventId,
          billId: target.billId,
          identifier: target.identifier,
          targetVoteDate: target.targetVoteDate,
          requestWindowStart: target.requestWindowStart,
          requestWindowEndExclusive: target.requestWindowEndExclusive,
          referralDates: [...target.referralDates].sort(),
        },
        review: {
          decision: null,
          reasonCode: null,
          billMentionExcerpt: null,
          billMentionPage: null,
          attributedMemberName: null,
          memberStance: null,
          normalizedClaim: null,
          supportingExcerpt: null,
          supportingPage: null,
          notes: null,
        },
      });
    }
  }

  rows.sort((a, b) =>
    String(a.documentDate).localeCompare(String(b.documentDate))
    || String(a.committeeName).localeCompare(String(b.committeeName))
    || String(a.candidateTarget.targetVoteDate).localeCompare(
      String(b.candidateTarget.targetVoteDate),
    )
    || String(a.candidateTarget.identifier).localeCompare(
      String(b.candidateTarget.identifier),
    )
    || String(a.reviewKey).localeCompare(String(b.reviewKey)));

  rows.forEach((row, index) => {
    row.row = index + 1;
  });

  const reviewKeys = rows.map((row) => String(row.reviewKey));
  if (new Set(reviewKeys).size !== reviewKeys.length) {
    throw new Error('Duplicate semantic-review key');
  }

  const reviewKeySha256 = setSha(reviewKeys);
  const sourceSha256Set = [...new Set(
    rows.map((row) => String(row.sourceContentSha256)),
  )].sort();

  const packet = {
    schemaVersion: REVIEW_PACKET_SCHEMA,
    generatedAt: new Date().toISOString(),
    issue: 718,
    sourceIntake: {
      requestPackageArtifactId: 11496898656,
      documents: bundle.summary.documents,
      sourceLedgerProofSha256: ledger.sourceLedgerProofSha256,
      sourceContentSha256Set,
    },
    summary: {
      reviewRows: rows.length,
      documents: new Set(rows.map((row) => row.documentId)).size,
      committees: new Set(rows.map((row) => row.committeeEventId)).size,
      candidateTargetEvents: new Set(
        rows.map((row) => row.candidateTarget.voteEventId),
      ).size,
      candidateBills: new Set(
        rows.map((row) => row.candidateTarget.billId),
      ).size,
      completedDecisions: 0,
    },
    reviewKeySha256,
    allowedDecisionValues: [
      'not_applicable_to_candidate_bill',
      'bill_context_only_no_member_direction',
      'directional_member_statement',
      'ambiguous_fail_closed',
    ],
    requiredForDirectionalDecision: [
      'billMentionExcerpt',
      'attributedMemberName',
      'memberStance',
      'normalizedClaim',
      'supportingExcerpt',
    ],
    rows,
    policy: {
      sourceDocumentContentReadByGenerator: false,
      targetVoteOutcomesRead: false,
      outcomeUse: 'none',
      decisionsAutoFilled: false,
      billApplicabilityInferred: false,
      memberAttributionInferred: false,
      memberStanceInferred: false,
      ambiguousDefaultsToFailClosed: true,
      reviewOutputCreatesEvidence: false,
      productionDatabaseQueried: false,
      productionWrites: false,
      featureRowsWritten: false,
      modelFitting: 'none',
      modelWeightChanged: false,
      servingChanged: false,
      vercelUsed: false,
    },
  };

  const decisions = {
    schemaVersion: DECISION_TEMPLATE_SCHEMA,
    generatedAt: new Date().toISOString(),
    issue: 718,
    frozenReviewPacket: {
      reviewKeySha256,
      reviewRows: rows.length,
      sourceLedgerProofSha256: ledger.sourceLedgerProofSha256,
    },
    instructions: {
      defaultDisposition: 'ambiguous_fail_closed',
      directionalDecision:
        'Use directional_member_statement only when the minute itself contains an attributable member statement tied to the candidate bill and a clear direction.',
      billContextOnly:
        'Use bill_context_only_no_member_direction when the candidate bill is present but no target-member directional statement is established.',
      notApplicable:
        'Use not_applicable_to_candidate_bill when the candidate bill is not supported by the source content.',
      excerpts:
        'Copy exact source excerpts and page numbers. Do not infer from committee membership, referral metadata, attendance, or vote outcome.',
    },
    decisions: rows.map((row) => ({
      row: row.row,
      reviewKey: row.reviewKey,
      decision: null,
      reasonCode: null,
      billMentionExcerpt: null,
      billMentionPage: null,
      attributedMemberName: null,
      memberStance: null,
      normalizedClaim: null,
      supportingExcerpt: null,
      supportingPage: null,
      notes: null,
    })),
    policy: {
      targetVoteOutcomesRead: false,
      outcomeUse: 'none',
      defaultFailClosedUntilExplicitDecision: true,
      noAutomaticDirectionalDecision: true,
      productionDatabaseQueried: false,
      productionWrites: false,
      featureRowsWritten: false,
      modelFitting: 'none',
      servingChanged: false,
      vercelUsed: false,
    },
  };

  mkdirSync(outputDir, { recursive: true });
  const packetPath = resolve(
    outputDir,
    'historical-density-2021-senate-print-minute-semantic-review-packet-v1.json',
  );
  const decisionsPath = resolve(
    outputDir,
    'historical-density-2021-senate-print-minute-semantic-review-decisions-template-v1.json',
  );
  writeFileSync(packetPath, JSON.stringify(packet, null, 2) + '\n', 'utf8');
  writeFileSync(
    decisionsPath,
    JSON.stringify(decisions, null, 2) + '\n',
    'utf8',
  );

  console.log(JSON.stringify({
    senate2021PrintMinuteSemanticReviewPacket: {
      ...packet.summary,
      reviewKeySha256,
      sourceLedgerProofSha256: ledger.sourceLedgerProofSha256,
      packetSha256: sha256(readFileSync(packetPath, 'utf8')),
      decisionsTemplateSha256: sha256(readFileSync(decisionsPath, 'utf8')),
      targetVoteOutcomesRead: false,
      decisionsAutoFilled: false,
      evidenceCreated: false,
    },
  }, null, 2));
}

main();
