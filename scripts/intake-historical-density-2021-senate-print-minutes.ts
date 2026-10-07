import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import {
  buildSenatePrintMinuteIntakeBundle,
  collectSenatePrintMinuteIntakeDocument,
  validateSenatePrintMinuteRequestPackage,
  type SenatePrintMinuteAcquisitionMethod,
  type SenatePrintMinuteMimeType,
  type SenatePrintMinuteRequestPackage,
} from '../src/evaluation/historical-density-2021-senate-print-minute-intake.js';

const REQUEST_ARTIFACT_ID = 11496898656;
const REQUEST_ARTIFACT_DIGEST =
  'sha256:c7d6d274dd734878efbb830a1c8c17a35afb1503e30ca4917cefc8e1d39fb26e';
const REQUEST_SOURCE_COMMIT_SHA =
  '39360a45fa9f8856e26001e4b005246c51467bcf';
const REQUEST_ASSOCIATION_PROOF =
  '6d3ecfa7d433e8a3f3c835ecc9934a0b68cab53f213501b333e873d32d29a1d0';
const REQUEST_CSV_SHA256 =
  '323c8be6cd874115b4e8601343eebec96a705be2e1670ef360ca7c2970a334d9';
const REQUEST_MARKDOWN_SHA256 =
  '033e9d5c45abad9d378a4ad3d351b9299dc4f378bfe86fc791bd1cb666e83bc3';

const MANIFEST_SCHEMA =
  'historical-density-2021-senate-print-minute-local-intake-manifest-v1';
const LEDGER_SCHEMA =
  'historical-density-2021-senate-print-minute-local-source-ledger-v1';
const TEMPLATE_SCHEMA =
  'historical-density-2021-senate-print-minute-local-intake-template-v1';

type Json = Record<string, any>;

interface LocalManifestDocument {
  relativePath: string;
  committeeEventId: string;
  committeeName: string;
  documentDate: string;
  mimeType: SenatePrintMinuteMimeType;
  pageCount?: number | null;
  title?: string;
  acquisitionMethod: SenatePrintMinuteAcquisitionMethod;
  lrlReference: string;
  acquiredOn: string;
  expectedSha256?: string;
}

interface LocalManifest {
  schemaVersion: typeof MANIFEST_SCHEMA;
  requestPackage: {
    artifactId: number;
    artifactDigest: string;
    sourceCommitSha: string;
    requestAssociationProofSha256: string;
  };
  documents: LocalManifestDocument[];
}

interface Args {
  requestPackage?: string;
  manifest?: string;
  sourceRoot?: string;
  outputDir?: string;
  writeTemplate?: string;
  generatedAt?: string;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]!;
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${key}`);
    }
    if (key === '--request-package') args.requestPackage = value;
    else if (key === '--manifest') args.manifest = value;
    else if (key === '--source-root') args.sourceRoot = value;
    else if (key === '--output-dir') args.outputDir = value;
    else if (key === '--write-template') args.writeTemplate = value;
    else if (key === '--generated-at') args.generatedAt = value;
    else throw new Error(`Unknown argument: ${key}`);
    index += 1;
  }
  return args;
}

function canonicalRequest(path: string): {
  request: SenatePrintMinuteRequestPackage;
  raw: Json;
} {
  const raw = JSON.parse(readFileSync(resolve(path), 'utf8')) as Json;
  const request = validateSenatePrintMinuteRequestPackage(
    raw as SenatePrintMinuteRequestPackage,
  );
  if (
    request.request.requestAssociationProofSha256 !== REQUEST_ASSOCIATION_PROOF
    || raw.outputs?.csvSha256 !== REQUEST_CSV_SHA256
    || raw.outputs?.markdownSha256 !== REQUEST_MARKDOWN_SHA256
  ) {
    throw new Error('Canonical Senate print-minute request package proof drifted');
  }
  return { request, raw };
}

function requestLineage() {
  return {
    artifactId: REQUEST_ARTIFACT_ID,
    artifactDigest: REQUEST_ARTIFACT_DIGEST,
    sourceCommitSha: REQUEST_SOURCE_COMMIT_SHA,
    requestAssociationProofSha256: REQUEST_ASSOCIATION_PROOF,
  };
}

function writeTemplate(path: string, request: SenatePrintMinuteRequestPackage): void {
  const template = {
    schemaVersion: TEMPLATE_SCHEMA,
    requestPackage: requestLineage(),
    instructions: {
      sourceRoot:
        'Place authoritative LRL files under one local source root. Every relativePath must remain inside that root.',
      provenance:
        'Use only lrl_supplied_copy or on_site_scan_of_lrl_holdings, with an LRL reference and acquisition date.',
      dates:
        'documentDate is the date printed on the authoritative committee minute. Intake only creates candidate targets whose frozen request window contains that date.',
      evidenceBoundary:
        'Successful intake does not make a file evidence. Bill mention and member attribution remain required before semantic/directional review.',
    },
    allowedCommittees: request.request.groups
      .map((group) => ({
        rank: group.rank,
        committeeEventId: group.committeeEventId,
        committeeName: group.committeeName,
      }))
      .sort((a, b) => a.rank - b.rank),
    documents: [] as LocalManifestDocument[],
  };
  const output = resolve(path);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(template, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    senate2021PrintMinuteIntakeTemplate: {
      path: output,
      committees: template.allowedCommittees.length,
      requestAssociationProofSha256: REQUEST_ASSOCIATION_PROOF,
      templateSha256: sha256(JSON.stringify(template)),
    },
  }, null, 2));
}

function validateLineage(manifest: LocalManifest): void {
  const expected = requestLineage();
  if (
    manifest.schemaVersion !== MANIFEST_SCHEMA
    || manifest.requestPackage?.artifactId !== expected.artifactId
    || manifest.requestPackage?.artifactDigest !== expected.artifactDigest
    || manifest.requestPackage?.sourceCommitSha !== expected.sourceCommitSha
    || manifest.requestPackage?.requestAssociationProofSha256
      !== expected.requestAssociationProofSha256
  ) {
    throw new Error('Local intake manifest request-package lineage drifted');
  }
  if (!Array.isArray(manifest.documents) || manifest.documents.length === 0) {
    throw new Error('Local intake manifest must contain at least one document');
  }
}

const MIME_EXTENSION: Record<SenatePrintMinuteMimeType, readonly string[]> = {
  'application/pdf': ['.pdf'],
  'image/tiff': ['.tif', '.tiff'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

function safeSourcePath(sourceRoot: string, relativePath: string): string {
  if (!relativePath.trim() || isAbsolute(relativePath)) {
    throw new Error(`Source relativePath must be relative: ${relativePath}`);
  }
  const root = realpathSync(resolve(sourceRoot));
  const candidate = resolve(root, relativePath);
  if (!existsSync(candidate)) {
    throw new Error(`Source file does not exist: ${relativePath}`);
  }
  const actual = realpathSync(candidate);
  const fromRoot = relative(root, actual);
  if (
    fromRoot === '..'
    || fromRoot.startsWith(`..${sep}`)
    || isAbsolute(fromRoot)
  ) {
    throw new Error(`Source path escapes source root: ${relativePath}`);
  }
  if (!statSync(actual).isFile()) {
    throw new Error(`Source path is not a regular file: ${relativePath}`);
  }
  return actual;
}

function assertMimeExtension(
  relativePath: string,
  mimeType: SenatePrintMinuteMimeType,
): void {
  const extension = extname(relativePath).toLowerCase();
  if (!MIME_EXTENSION[mimeType]?.includes(extension)) {
    throw new Error(
      `Source extension ${extension || '(none)'} does not match MIME type ${mimeType}`,
    );
  }
}

function validateGeneratedAt(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error('--generated-at must be an exact ISO-8601 UTC timestamp');
  }
  return value;
}

function runIntake(args: Args): void {
  if (!args.requestPackage || !args.manifest || !args.outputDir) {
    throw new Error(
      'Intake requires --request-package, --manifest, and --output-dir',
    );
  }
  const { request } = canonicalRequest(args.requestPackage);
  const manifestPath = resolve(args.manifest);
  const manifest = JSON.parse(
    readFileSync(manifestPath, 'utf8'),
  ) as LocalManifest;
  validateLineage(manifest);

  const sourceRoot = resolve(args.sourceRoot ?? dirname(manifestPath));
  const generatedAt = validateGeneratedAt(args.generatedAt);
  const relativePaths = new Set<string>();
  const prepared: Array<{
    metadata: LocalManifestDocument;
    sourcePath: string;
    sourceBytes: Buffer;
    intake: ReturnType<typeof collectSenatePrintMinuteIntakeDocument>;
  }> = [];

  for (const metadata of manifest.documents) {
    if (relativePaths.has(metadata.relativePath)) {
      throw new Error(`Duplicate manifest relativePath: ${metadata.relativePath}`);
    }
    relativePaths.add(metadata.relativePath);
    assertMimeExtension(metadata.relativePath, metadata.mimeType);
    const sourcePath = safeSourcePath(sourceRoot, metadata.relativePath);
    const sourceBytes = readFileSync(sourcePath);
    const actualSha256 = sha256(sourceBytes);
    if (
      metadata.expectedSha256 !== undefined
      && metadata.expectedSha256 !== actualSha256
    ) {
      throw new Error(
        `Source SHA-256 mismatch for ${metadata.relativePath}: expected `
        + `${metadata.expectedSha256}, got ${actualSha256}`,
      );
    }
    const intake = collectSenatePrintMinuteIntakeDocument({
      request,
      committeeEventId: metadata.committeeEventId,
      committeeName: metadata.committeeName,
      documentDate: metadata.documentDate,
      fileName: basename(metadata.relativePath),
      mimeType: metadata.mimeType,
      bytes: sourceBytes,
      pageCount: metadata.pageCount,
      title: metadata.title,
      provenance: {
        repository: 'Minnesota Legislative Reference Library',
        acquisitionMethod: metadata.acquisitionMethod,
        lrlReference: metadata.lrlReference,
        acquiredOn: metadata.acquiredOn,
      },
    });
    prepared.push({ metadata, sourcePath, sourceBytes, intake });
  }

  const bundle = buildSenatePrintMinuteIntakeBundle({
    request,
    requestPackageArtifactId: REQUEST_ARTIFACT_ID,
    requestPackageArtifactDigest: REQUEST_ARTIFACT_DIGEST,
    requestPackageSourceCommitSha: REQUEST_SOURCE_COMMIT_SHA,
    documents: prepared.map((row) => row.intake),
    generatedAt,
  });

  const outputDir = resolve(args.outputDir);
  const sourcesDir = resolve(outputDir, 'sources');
  const ledgerRows = prepared
    .map((row) => {
      const extension = MIME_EXTENSION[row.metadata.mimeType][0]!;
      const archivedFileName = `${row.intake.contentSha256}${extension}`;
      return {
        documentId: row.intake.id,
        originalRelativePath: row.metadata.relativePath,
        archivedRelativePath: `sources/${archivedFileName}`,
        bytes: row.intake.bytes,
        contentSha256: row.intake.contentSha256,
        committeeEventId: row.intake.committeeEventId,
        committeeName: row.intake.committeeName,
        documentDate: row.intake.documentDate,
        candidateTargetEventIds: row.intake.candidateTargetEventIds,
        candidateBillIdentifiers: row.intake.candidateBillIdentifiers,
      };
    })
    .sort((a, b) => a.documentId.localeCompare(b.documentId));

  const sourceLedgerProofSha256 = sha256(
    ledgerRows
      .map((row) => [
        row.documentId,
        row.originalRelativePath,
        row.archivedRelativePath,
        row.contentSha256,
        row.committeeEventId,
        row.documentDate,
        row.candidateTargetEventIds.join(','),
        row.candidateBillIdentifiers.join(','),
      ].join('|'))
      .join('\n') + '\n',
  );

  const ledger = {
    schemaVersion: LEDGER_SCHEMA,
    requestPackage: requestLineage(),
    summary: {
      documents: ledgerRows.length,
      archivedBytes: ledgerRows.reduce((sum, row) => sum + row.bytes, 0),
      committees: new Set(ledgerRows.map((row) => row.committeeEventId)).size,
      candidateTargetEvents: new Set(
        ledgerRows.flatMap((row) => row.candidateTargetEventIds),
      ).size,
      candidateBills: new Set(
        ledgerRows.flatMap((row) => row.candidateBillIdentifiers),
      ).size,
    },
    sourceLedgerProofSha256,
    sources: ledgerRows,
    policy: {
      sourcePathsMustRemainInsideSourceRoot: true,
      exactSourceBytesArchived: true,
      archivedSourceNamesAreContentAddressed: true,
      successfulIntakeCreatesEvidence: false,
      productionDatabaseQueried: false,
      productionWrites: false,
      targetVoteOutcomesRead: false,
      featureRowsWritten: false,
      modelFitting: 'none',
      servingChanged: false,
      vercelUsed: false,
    },
  };

  mkdirSync(sourcesDir, { recursive: true });
  for (const row of prepared) {
    const extension = MIME_EXTENSION[row.metadata.mimeType][0]!;
    const archivedPath = resolve(
      sourcesDir,
      `${row.intake.contentSha256}${extension}`,
    );
    if (existsSync(archivedPath)) {
      const existing = readFileSync(archivedPath);
      if (sha256(existing) !== row.intake.contentSha256) {
        throw new Error(`Archived source hash collision: ${archivedPath}`);
      }
    } else {
      writeFileSync(archivedPath, row.sourceBytes);
    }
  }

  const bundleText = JSON.stringify(bundle, null, 2) + '\n';
  const ledgerText = JSON.stringify(ledger, null, 2) + '\n';
  const bundlePath = resolve(
    outputDir,
    'historical-density-2021-senate-print-minute-intake-bundle-v1.json',
  );
  const ledgerPath = resolve(
    outputDir,
    'historical-density-2021-senate-print-minute-local-source-ledger-v1.json',
  );
  writeFileSync(bundlePath, bundleText, 'utf8');
  writeFileSync(ledgerPath, ledgerText, 'utf8');

  console.log(JSON.stringify({
    senate2021PrintMinuteLocalIntake: {
      bundlePath,
      ledgerPath,
      documents: bundle.summary.documents,
      committees: bundle.summary.committees,
      candidateTargetEvents: bundle.summary.candidateTargetEvents,
      candidateBills: bundle.summary.candidateBills,
      sourceLedgerProofSha256,
      bundleSha256: sha256(bundleText),
      ledgerSha256: sha256(ledgerText),
      productionDatabaseQueried: false,
      targetVoteOutcomesRead: false,
      evidenceCreated: false,
      modelFitting: 'none',
    },
  }, null, 2));
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.requestPackage) {
    throw new Error('--request-package is required');
  }
  const { request } = canonicalRequest(args.requestPackage);
  if (args.writeTemplate) {
    if (args.manifest || args.outputDir || args.sourceRoot) {
      throw new Error('--write-template cannot be combined with intake arguments');
    }
    writeTemplate(args.writeTemplate, request);
    return;
  }
  runIntake(args);
}

main();
