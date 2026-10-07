import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  SENATE_PRINT_MINUTE_ALLOWED_MIME_TYPES,
  buildSenatePrintMinuteIntakeBundle,
  validateSenatePrintMinuteRequestPackage,
  type SenatePrintMinuteRequestPackage,
} from '../src/evaluation/historical-density-2021-senate-print-minute-intake.js';

const REQUEST_RUN_ID = 37653754058;
const REQUEST_ARTIFACT_ID = 11496898656;
const REQUEST_ARTIFACT_DIGEST =
  'sha256:c7d6d274dd734878efbb830a1c8c17a35afb1503e30ca4917cefc8e1d39fb26e';
const REQUEST_SOURCE_COMMIT_SHA =
  '39360a45fa9f8856e26001e4b005246c51467bcf';
const REQUEST_ASSOCIATION_PROOF =
  '6d3ecfa7d433e8a3f3c835ecc9934a0b68cab53f213501b333e873d32d29a1d0';
const CSV_SHA256 =
  '323c8be6cd874115b4e8601343eebec96a705be2e1670ef360ca7c2970a334d9';
const MARKDOWN_SHA256 =
  '033e9d5c45abad9d378a4ad3d351b9299dc4f378bfe86fc791bd1cb666e83bc3';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const requestPath = env('VOTEPREDICT_SENATE_2021_REQUEST_PACKAGE_PATH');
const outputPath = resolve(
  process.env.VOTEPREDICT_SENATE_2021_INTAKE_PROTOCOL_OUTPUT
    ?? 'tmp/historical-density-2021-senate-print-minute-intake-protocol-v1.json',
);
const request = validateSenatePrintMinuteRequestPackage(
  JSON.parse(readFileSync(requestPath, 'utf8')) as SenatePrintMinuteRequestPackage,
);
if (request.request.requestAssociationProofSha256 !== REQUEST_ASSOCIATION_PROOF) {
  throw new Error('Canonical request association proof drifted');
}

const emptyBundle = buildSenatePrintMinuteIntakeBundle({
  request,
  requestPackageArtifactId: REQUEST_ARTIFACT_ID,
  requestPackageArtifactDigest: REQUEST_ARTIFACT_DIGEST,
  requestPackageSourceCommitSha: REQUEST_SOURCE_COMMIT_SHA,
  documents: [],
  generatedAt: '1970-01-01T00:00:00.000Z',
});

const protocol = {
  schemaVersion: 'historical-density-2021-senate-print-minute-intake-protocol-v1',
  generatedAt: new Date().toISOString(),
  issue: 718,
  frozenRequestPackage: {
    runId: REQUEST_RUN_ID,
    artifactId: REQUEST_ARTIFACT_ID,
    artifactDigest: REQUEST_ARTIFACT_DIGEST,
    sourceCommitSha: REQUEST_SOURCE_COMMIT_SHA,
    requestAssociationProofSha256: REQUEST_ASSOCIATION_PROOF,
    csvSha256: CSV_SHA256,
    markdownSha256: MARKDOWN_SHA256,
  },
  acceptedSource: {
    repository: 'Minnesota Legislative Reference Library',
    acquisitionMethods: ['lrl_supplied_copy', 'on_site_scan_of_lrl_holdings'],
    mimeTypes: [...SENATE_PRINT_MINUTE_ALLOWED_MIME_TYPES],
    maxBytesPerFile: 100000000,
  },
  intakeContract: {
    exactBytesSha256Required: true,
    documentDateRequired: true,
    committeeIdentityMustMatchFrozenRequest: true,
    documentDateMustFallInsideFrozenRequestWindow: true,
    sameDayTargetDocumentsExcluded: true,
    committeeAndDateMatchCreatesCandidateOnly: true,
    billMentionRequiredBeforeSemanticApplicability: true,
    memberAttributionRequiredBeforeDirectionalEvidence: true,
    semanticStatusAtIntake: 'unreviewed',
    evidenceStatusAtIntake: 'not_evidence',
    mechanicallyActionableAtIntake: false,
    modelWeightAtIntake: 0,
  },
  currentState: {
    authoritativeMinuteFilesReceived: 0,
    intakeDocuments: emptyBundle.summary.documents,
    candidateTargetEvents: emptyBundle.summary.candidateTargetEvents,
    candidateBills: emptyBundle.summary.candidateBills,
  },
  policy: emptyBundle.policy,
};
const proofPayload = {
  frozenRequestPackage: protocol.frozenRequestPackage,
  acceptedSource: protocol.acceptedSource,
  intakeContract: protocol.intakeContract,
  currentState: protocol.currentState,
  policy: protocol.policy,
};
const output = {
  ...protocol,
  protocolProofSha256: sha256(JSON.stringify(proofPayload)),
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ senate2021PrintMinuteIntakeProtocol: output }, null, 2));
