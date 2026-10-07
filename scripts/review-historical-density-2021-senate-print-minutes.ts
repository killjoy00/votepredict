import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  buildSenatePrintMinuteSemanticReviewBundle,
  SENATE_PRINT_MINUTE_SEMANTIC_REVIEW_MANIFEST_SCHEMA,
  type SenatePrintMinuteSemanticReviewManifest,
} from '../src/evaluation/historical-density-2021-senate-print-minute-semantic-review.js';
import type {
  SenatePrintMinuteIntakeBundle,
} from '../src/evaluation/historical-density-2021-senate-print-minute-intake.js';

const TEMPLATE_SCHEMA =
  'historical-density-2021-senate-print-minute-semantic-review-template-v1';
const EXPECTED_SYNTHETIC_TEMPLATE_SHA256 =
  '03d77d2daf7551bbc3ec95e6d698735fcb832b66bf8f3f60c86c91de3ccad19d';

type Args = {
  intakeBundle?: string;
  reviewManifest?: string;
  output?: string;
  writeTemplate?: string;
  generatedAt?: string;
};

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}
function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]!;
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    if (key === '--intake-bundle') args.intakeBundle = value;
    else if (key === '--review-manifest') args.reviewManifest = value;
    else if (key === '--output') args.output = value;
    else if (key === '--write-template') args.writeTemplate = value;
    else if (key === '--generated-at') args.generatedAt = value;
    else throw new Error(`Unknown argument: ${key}`);
    index += 1;
  }
  return args;
}
function readBundle(path: string): {
  bundle: SenatePrintMinuteIntakeBundle;
  sha256: string;
} {
  const bytes = readFileSync(resolve(path));
  return {
    bundle: JSON.parse(bytes.toString('utf8')) as SenatePrintMinuteIntakeBundle,
    sha256: sha256(bytes),
  };
}
function validateGeneratedAt(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error('--generated-at must be an exact ISO-8601 UTC timestamp');
  }
  return value;
}
function writeTemplate(
  path: string,
  bundle: SenatePrintMinuteIntakeBundle,
  bundleSha256: string,
): void {
  const template = {
    schemaVersion: TEMPLATE_SCHEMA,
    intakeBundleSha256: bundleSha256,
    instructions: {
      reviewCoverage: 'Every intake document must be reviewed exactly once.',
      directionalRule:
        'Use directional_claims only for explicit whole-bill member positions grounded to a transcribed source-page excerpt that contains the exact candidate bill identifier and explicit member attribution.',
      failClosedRule:
        'Committee membership, attendance, procedural activity, motions, bill discussion, or unclear language are not directional stance.',
      identityBoundary:
        'Do not resolve public or internal membership identity in this stage.',
    },
    manifestSkeleton: {
      schemaVersion: SENATE_PRINT_MINUTE_SEMANTIC_REVIEW_MANIFEST_SCHEMA,
      batchId: 'REPLACE_WITH_BATCH_ID',
      intakeBundleSha256: bundleSha256,
      reviewedOn: 'YYYY-MM-DD',
      reviewMethod: 'human_manual_full_document',
      policy: {
        outcomeUse: 'none',
        targetVoteOutcomesConsulted: false,
        partyOrIdeologyUsed: false,
        committeeMembershipUsedAsStance: false,
        attendanceUsedAsStance: false,
        proceduralActionUsedAsDirectionalStance: false,
        exactBillMentionRequired: true,
        explicitNamedMemberAttributionRequired: true,
        wholeBillPositionRequired: true,
      },
      reviews: bundle.documents.map((document) => ({
        documentId: document.id,
        sourceContentSha256: document.contentSha256,
        committeeName: document.committeeName,
        documentDate: document.documentDate,
        pageCount: document.pageCount,
        candidateBillIdentifiers: document.candidateBillIdentifiers,
        candidateTargetEventIds: document.candidateTargetEventIds,
        fullDocumentReviewed: false,
        decision: null,
        reasonCode: null,
        notes: [],
        claims: [],
      })),
    },
  };
  const output = resolve(path);
  mkdirSync(dirname(output), { recursive: true });
  const text = JSON.stringify(template, null, 2) + '\n';
  if (
    bundle.documents.length === 1
    && bundle.documents[0]?.id
      === 'senate-print-minute-23837-0-s-2021-02-20-ab8a84192fa1ea47'
    && sha256(text) !== EXPECTED_SYNTHETIC_TEMPLATE_SHA256
  ) {
    throw new Error(`Pinned synthetic semantic-review template drifted: ${sha256(text)}`);
  }
  writeFileSync(output, text, 'utf8');
  console.log(JSON.stringify({
    senate2021PrintMinuteSemanticReviewTemplate: {
      path: output,
      intakeBundleSha256: bundleSha256,
      documents: bundle.documents.length,
      templateSha256: sha256(text),
    },
  }, null, 2));
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.intakeBundle) throw new Error('--intake-bundle is required');
  const { bundle, sha256: intakeBundleSha256 } = readBundle(args.intakeBundle);
  if (args.writeTemplate) {
    if (args.reviewManifest || args.output) {
      throw new Error('--write-template cannot be combined with review output arguments');
    }
    writeTemplate(args.writeTemplate, bundle, intakeBundleSha256);
    return;
  }
  if (!args.reviewManifest || !args.output) {
    throw new Error('Review requires --review-manifest and --output');
  }
  const manifest = JSON.parse(
    readFileSync(resolve(args.reviewManifest), 'utf8'),
  ) as SenatePrintMinuteSemanticReviewManifest;
  const review = buildSenatePrintMinuteSemanticReviewBundle({
    intakeBundle: bundle,
    intakeBundleSha256,
    manifest,
    generatedAt: validateGeneratedAt(args.generatedAt),
  });
  const output = resolve(args.output);
  mkdirSync(dirname(output), { recursive: true });
  const text = JSON.stringify(review, null, 2) + '\n';
  writeFileSync(output, text, 'utf8');
  console.log(JSON.stringify({
    senate2021PrintMinuteSemanticReview: {
      output,
      intakeBundleSha256,
      summary: review.summary,
      documentReviewProofSha256: review.documentReviewProofSha256,
      semanticClaimProofSha256: review.semanticClaimProofSha256,
      reviewProofSha256: review.reviewProofSha256,
      outputSha256: sha256(text),
      outcomeUse: 'none',
      mechanicallyActionable: false,
      modelWeight: 0,
    },
  }, null, 2));
}
main();
