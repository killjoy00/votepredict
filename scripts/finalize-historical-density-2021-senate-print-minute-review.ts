import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  buildSenatePrintMinuteReviewCompletionTemplate,
  finalizeSenatePrintMinuteReview,
  validateSenatePrintMinuteReviewPacket,
  type SenatePrintMinuteReviewCompletionManifest,
  type SenatePrintMinuteReviewPacket,
} from '../src/evaluation/historical-density-2021-senate-print-minute-review-handoff.js';
import type {
  SenatePrintMinuteIntakeBundle,
} from '../src/evaluation/historical-density-2021-senate-print-minute-intake.js';

type Args = {
  reviewPacket?: string;
  intakeBundle?: string;
  writeTemplate?: string;
  completionManifest?: string;
  outputDir?: string;
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
    if (key === '--review-packet') args.reviewPacket = value;
    else if (key === '--intake-bundle') args.intakeBundle = value;
    else if (key === '--write-template') args.writeTemplate = value;
    else if (key === '--completion-manifest') args.completionManifest = value;
    else if (key === '--output-dir') args.outputDir = value;
    else if (key === '--generated-at') args.generatedAt = value;
    else throw new Error(`Unknown argument: ${key}`);
    index += 1;
  }
  return args;
}

function generatedAt(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error('--generated-at must be an exact ISO-8601 UTC timestamp');
  }
  return value;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.reviewPacket || !args.intakeBundle) {
    throw new Error('--review-packet and --intake-bundle are required');
  }

  const packet = validateSenatePrintMinuteReviewPacket(
    JSON.parse(
      readFileSync(resolve(args.reviewPacket), 'utf8'),
    ) as SenatePrintMinuteReviewPacket,
  );
  const intakeBytes = readFileSync(resolve(args.intakeBundle));
  const intakeBundle = JSON.parse(
    intakeBytes.toString('utf8'),
  ) as SenatePrintMinuteIntakeBundle;
  const intakeBundleSha256 = sha256(intakeBytes);

  if (args.writeTemplate) {
    if (args.completionManifest || args.outputDir) {
      throw new Error(
        '--write-template cannot be combined with finalization arguments',
      );
    }
    const template = buildSenatePrintMinuteReviewCompletionTemplate({
      packet,
      intakeBundle,
      intakeBundleSha256,
    });
    const output = resolve(args.writeTemplate);
    mkdirSync(dirname(output), { recursive: true });
    const text = JSON.stringify(template, null, 2) + '\n';
    writeFileSync(output, text, 'utf8');
    console.log(JSON.stringify({
      senate2021PrintMinuteReviewCompletionTemplate: {
        output,
        reviewRows: packet.rows.length,
        documents: intakeBundle.documents.length,
        reviewKeySha256: packet.reviewKeySha256,
        reviewPacketProofSha256: packet.reviewPacketProofSha256,
        intakeBundleSha256,
        templateSha256: sha256(text),
      },
    }, null, 2));
    return;
  }

  if (!args.completionManifest || !args.outputDir) {
    throw new Error(
      'Finalization requires --completion-manifest and --output-dir',
    );
  }

  const completion = JSON.parse(
    readFileSync(resolve(args.completionManifest), 'utf8'),
  ) as SenatePrintMinuteReviewCompletionManifest;
  const result = finalizeSenatePrintMinuteReview({
    packet,
    intakeBundle,
    intakeBundleSha256,
    completion,
    generatedAt: generatedAt(args.generatedAt),
  });

  const outputDir = resolve(args.outputDir);
  mkdirSync(outputDir, { recursive: true });
  const semanticPath = resolve(
    outputDir,
    'historical-density-2021-senate-print-minute-semantic-review-bundle-v1.json',
  );
  const finalizationPath = resolve(
    outputDir,
    'historical-density-2021-senate-print-minute-review-finalization-v1.json',
  );
  const semanticText = JSON.stringify(result.semanticReview, null, 2) + '\n';
  const finalizationText = JSON.stringify(result.finalization, null, 2) + '\n';
  writeFileSync(semanticPath, semanticText, 'utf8');
  writeFileSync(finalizationPath, finalizationText, 'utf8');

  console.log(JSON.stringify({
    senate2021PrintMinuteReviewFinalization: {
      summary: result.finalization.summary,
      documentAttestationProofSha256:
        result.finalization.documentAttestationProofSha256,
      rowDecisionProofSha256: result.finalization.rowDecisionProofSha256,
      semanticReviewProofSha256:
        result.finalization.semanticReviewProofSha256,
      semanticReviewBundleSha256:
        result.finalization.semanticReviewBundleSha256,
      finalizationSha256: sha256(finalizationText),
      outcomeUse: 'none',
      mechanicallyActionable: false,
      modelWeight: 0,
    },
  }, null, 2));
}

main();
