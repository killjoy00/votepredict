import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  EVIDENCE_QUALITY_SCHEMA_VERSION,
  EVIDENCE_QUALITY_TEXT_VERSION,
} from '../src/evidence/evidence-quality.js';
import { evidenceQualitySourceAvailabilityDate } from '../src/evidence/evidence-quality-historical-availability.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const INVENTORY_SCHEMA_VERSION = 'historical-density-p2-recovery-inventory-v1';
const RECOVERY_SCHEMA_VERSION = 'historical-density-p2-pilot-text-recovery-v1';
const COHORT_VERSION = 'historical-density-p2-semantic-review-cohort-v1';
const COHORT_ID = 'EQV1-HISTORICAL-DENSITY-P2-001';
const INVENTORY_ARTIFACT_ID = 11382774063;
const INVENTORY_ARTIFACT_DIGEST = 'sha256:0e5a737d7069bdc9c95f9a22caae7ebf48e1fa39b84c1fcaed344fdbd14b14cd';
const RECOVERY_RUN_ID = 37396554165;
const RECOVERY_ARTIFACT_ID = 11383194456;
const RECOVERY_ARTIFACT_DIGEST = 'sha256:4b2ba6a1370ea08d22af8b0c377ca7374509695f3d7c1ecc709b2b607fb98f4f';
const CANDIDATE_INPUT_SHA256 = '706d0e910c84c85675f3ea1ebfb9c5290aadef1af0eb08acf609d09764b287fb';
const EXPECTED_DOCUMENTS = 25;
const EXPECTED_MEMBERSHIPS = 18;
const EXPECTED_POTENTIAL_ROWS = 3923;
let secrets: string[] = [];

type InventoryRow = {
  sourceDocumentId: string;
  sourceDocumentIds: string[];
  sourceKind: string;
  sourceUrl: string;
  contentSha256: string;
  membershipId: string;
  availabilityDate: string | null;
  duplicateDocuments: number;
  hasTextSnapshot: boolean;
  hasAnnotation: boolean;
  priorSnapshotAttempt: boolean;
  potentialRows: number;
  potentialEvents: number;
};

type Inventory = {
  schemaVersion: string;
  issue: number;
  sourceUniverse: { candidateInputSha256: string };
  recommendedPilot: {
    selected: number;
    uniqueMemberships: number;
    uniquePotentialMemberEventRows: number;
    rows: InventoryRow[];
  };
};

type RecoveryRow = {
  sourceDocumentId: string;
  sourceKind: string;
  membershipId: string;
  availabilityDate: string;
  potentialRows: number;
  status: string;
  sourceDocumentTextId?: string;
  textChars?: number;
};

type Recovery = {
  schemaVersion: string;
  issue: number;
  frozenInput: {
    inventoryArtifactId: number;
    inventoryArtifactDigest: string;
    candidateInputSha256: string;
    pilotSources: number;
    pilotMemberships: number;
    pilotPotentialMemberEventRows: number;
  };
  result: {
    inserted: number;
    alreadyPresent: number;
    recoveredSources: number;
    recoveredMemberships: number;
    fetchFailures: number;
    hashMismatches: number;
    shortText: number;
    unresolvedSources: number;
    rows: RecoveryRow[];
  };
};

type TextRow = {
  source_document_id: string;
  source_kind: string;
  source_url: string;
  content_sha256: string;
  source_metadata: Record<string, unknown> | null;
  source_document_text_id: string;
  source_content_sha256: string;
  text_sha256: string;
  normalized_text: string;
  snapshot_created_at: string;
  has_annotation: boolean;
};

type MembershipRow = {
  membership_id: string;
  member_name: string;
  session_slug: string;
  chamber_slug: string;
};

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1600);
}

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');
  async function works(value: string) {
    const candidate = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8000 });
    try {
      await candidate.query('select 1');
      return true;
    } catch {
      return false;
    } finally {
      await candidate.end().catch(() => undefined);
    }
  }

  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await works(value)) return value;
  }

  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET unavailable');
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + secret },
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + ' is required');
  return value;
}

function loadInputs(inventoryPath: string, recoveryPath: string) {
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as Inventory;
  const recovery = JSON.parse(readFileSync(recoveryPath, 'utf8')) as Recovery;

  if (inventory.schemaVersion !== INVENTORY_SCHEMA_VERSION
    || inventory.issue !== 718
    || inventory.sourceUniverse.candidateInputSha256 !== CANDIDATE_INPUT_SHA256
    || inventory.recommendedPilot.selected !== EXPECTED_DOCUMENTS
    || inventory.recommendedPilot.rows.length !== EXPECTED_DOCUMENTS
    || inventory.recommendedPilot.uniqueMemberships !== EXPECTED_MEMBERSHIPS
    || inventory.recommendedPilot.uniquePotentialMemberEventRows !== EXPECTED_POTENTIAL_ROWS) {
    throw new Error('Frozen P2 inventory identity drifted');
  }

  if (recovery.schemaVersion !== RECOVERY_SCHEMA_VERSION
    || recovery.issue !== 718
    || recovery.frozenInput.inventoryArtifactId !== INVENTORY_ARTIFACT_ID
    || recovery.frozenInput.inventoryArtifactDigest !== INVENTORY_ARTIFACT_DIGEST
    || recovery.frozenInput.candidateInputSha256 !== CANDIDATE_INPUT_SHA256
    || recovery.frozenInput.pilotSources !== EXPECTED_DOCUMENTS
    || recovery.frozenInput.pilotMemberships !== EXPECTED_MEMBERSHIPS
    || recovery.frozenInput.pilotPotentialMemberEventRows !== EXPECTED_POTENTIAL_ROWS
    || recovery.result.recoveredSources !== EXPECTED_DOCUMENTS
    || recovery.result.recoveredMemberships !== EXPECTED_MEMBERSHIPS
    || recovery.result.fetchFailures !== 0
    || recovery.result.hashMismatches !== 0
    || recovery.result.shortText !== 0
    || recovery.result.unresolvedSources !== 0
    || recovery.result.rows.length !== EXPECTED_DOCUMENTS) {
    throw new Error('Frozen P2 recovery identity/result drifted');
  }

  const inventoryById = new Map(inventory.recommendedPilot.rows.map((row) => [row.sourceDocumentId, row]));
  const seenTextIds = new Set<string>();
  for (const row of recovery.result.rows) {
    if (row.status !== 'inserted' && row.status !== 'already_present') throw new Error('Unrecovered source entered P2 review cohort');
    if (!row.sourceDocumentTextId) throw new Error('Recovered P2 source lacks sourceDocumentTextId');
    if (seenTextIds.has(row.sourceDocumentTextId)) throw new Error('Duplicate sourceDocumentTextId in P2 recovery');
    seenTextIds.add(row.sourceDocumentTextId);

    const original = inventoryById.get(row.sourceDocumentId);
    if (!original) throw new Error('Recovered P2 source is absent from frozen inventory');
    if (row.sourceKind !== original.sourceKind
      || row.membershipId !== original.membershipId
      || row.availabilityDate !== original.availabilityDate
      || row.potentialRows !== original.potentialRows) {
      throw new Error('Recovered P2 row disagrees with frozen inventory');
    }
  }
  return { inventory, recovery, inventoryById };
}

async function main() {
  const envFile = required('VOTEPREDICT_PRODUCTION_ENV_FILE');
  const inventoryPath = required('VOTEPREDICT_HISTORICAL_DENSITY_P2_INVENTORY_PATH');
  const recoveryPath = required('VOTEPREDICT_HISTORICAL_DENSITY_P2_RECOVERY_PATH');
  const outputPath = resolve(required('VOTEPREDICT_HISTORICAL_DENSITY_P2_REVIEW_OUTPUT'));
  const { recovery, inventoryById } = loadInputs(inventoryPath, recoveryPath);

  const env = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  secrets = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secrets.forEach(mask);
  process.env.DATABASE_URL = await chooseDb(env);
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  const sourceIds = recovery.result.rows.map((row) => row.sourceDocumentId);
  const textIds = recovery.result.rows.map((row) => row.sourceDocumentTextId!);
  const membershipIds = [...new Set(recovery.result.rows.map((row) => row.membershipId))].sort();

  const client = await pool.connect();
  let textRows: TextRow[] = [];
  let membershipRows: MembershipRow[] = [];
  try {
    await client.query('BEGIN READ ONLY');

    textRows = (await client.query<TextRow>(`
      SELECT sd.id::text AS source_document_id,
             sd.source_kind,
             sd.source_url,
             sd.content_sha256,
             sd.metadata AS source_metadata,
             sdt.id::text AS source_document_text_id,
             sdt.source_content_sha256,
             sdt.text_sha256,
             sdt.normalized_text,
             sdt.created_at::text AS snapshot_created_at,
             EXISTS (
               SELECT 1
                 FROM evidence_quality_annotations eqa
                WHERE eqa.source_document_id=sd.id
                  AND eqa.schema_version=$3
             ) AS has_annotation
        FROM source_documents sd
        JOIN source_document_texts sdt
          ON sdt.source_document_id=sd.id
         AND sdt.extraction_version=$4
       WHERE sd.id = ANY($1::uuid[])
         AND sdt.id = ANY($2::uuid[])
       ORDER BY sd.id
    `, [sourceIds, textIds, EVIDENCE_QUALITY_SCHEMA_VERSION, EVIDENCE_QUALITY_TEXT_VERSION])).rows;

    membershipRows = (await client.query<MembershipRow>(`
      SELECT m.id::text AS membership_id,
             l.name AS member_name,
             s.slug AS session_slug,
             c.slug AS chamber_slug
        FROM memberships m
        JOIN legislators l ON l.id=m.legislator_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
       WHERE m.id = ANY($1::uuid[])
       ORDER BY m.id
    `, [membershipIds])).rows;

    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (textRows.length !== EXPECTED_DOCUMENTS) throw new Error('Recovered P2 text row count drifted');
  if (membershipRows.length !== EXPECTED_MEMBERSHIPS) throw new Error('Recovered P2 membership count drifted');

  const textBySource = new Map(textRows.map((row) => [row.source_document_id, row]));
  const memberById = new Map(membershipRows.map((row) => [row.membership_id, row]));

  const documents = recovery.result.rows.map((recovered, index) => {
    const original = inventoryById.get(recovered.sourceDocumentId)!;
    const text = textBySource.get(recovered.sourceDocumentId);
    const membership = memberById.get(recovered.membershipId);
    if (!text) throw new Error('Recovered P2 text missing from production');
    if (!membership) throw new Error('Frozen P2 membership missing from production');
    if (membership.session_slug !== '2021-2022') throw new Error('P2 review membership session drifted');
    if (text.has_annotation) throw new Error('P2 source gained Evidence Quality annotation before review freeze');
    if (text.source_document_text_id !== recovered.sourceDocumentTextId
      || text.source_kind !== original.sourceKind
      || text.source_url !== original.sourceUrl
      || text.content_sha256.toLowerCase() !== original.contentSha256.toLowerCase()
      || text.source_content_sha256.toLowerCase() !== original.contentSha256.toLowerCase()
      || evidenceQualitySourceAvailabilityDate(text.source_metadata) !== original.availabilityDate) {
      throw new Error('P2 review source/text identity drifted');
    }
    if (!text.normalized_text.trim()) throw new Error('P2 review text is empty');

    return {
      row: index + 1,
      priorityTier: 'P2_member_strong',
      sourceDocumentId: recovered.sourceDocumentId,
      sourceDocumentTextId: recovered.sourceDocumentTextId,
      sourceKind: original.sourceKind,
      sourceUrl: original.sourceUrl,
      sourceContentSha256: original.contentSha256,
      textSha256: text.text_sha256,
      snapshotCreatedAt: text.snapshot_created_at,
      membershipId: recovered.membershipId,
      session: membership.session_slug,
      chamber: membership.chamber_slug,
      availableAt: original.availabilityDate,
      potential2021MemberEventRows: recovered.potentialRows,
      candidateMemberNames: [membership.member_name],
      candidateBillIdentifiers: [] as string[],
      normalizedText: text.normalized_text,
    };
  });

  if (new Set(documents.map((row) => row.sourceDocumentId)).size !== EXPECTED_DOCUMENTS) {
    throw new Error('P2 review cohort contains duplicate source documents');
  }
  if (new Set(documents.map((row) => row.sourceDocumentTextId)).size !== EXPECTED_DOCUMENTS) {
    throw new Error('P2 review cohort contains duplicate source text IDs');
  }
  if (new Set(documents.map((row) => row.membershipId)).size !== EXPECTED_MEMBERSHIPS) {
    throw new Error('P2 review cohort membership cardinality drifted');
  }
  if (documents.some((row) => row.candidateBillIdentifiers.length !== 0)) {
    throw new Error('P2 review cohort illegally contains candidate bill identifiers');
  }

  const integritySha256 = createHash('sha256').update(JSON.stringify(documents)).digest('hex');
  const artifact = {
    artifactVersion: COHORT_VERSION,
    batchId: COHORT_ID,
    issue: 718,
    sourceInventoryArtifactId: INVENTORY_ARTIFACT_ID,
    sourceInventoryArtifactDigest: INVENTORY_ARTIFACT_DIGEST,
    sourceRecoveryRunId: RECOVERY_RUN_ID,
    sourceRecoveryArtifactId: RECOVERY_ARTIFACT_ID,
    sourceRecoveryArtifactDigest: RECOVERY_ARTIFACT_DIGEST,
    candidateInputSha256: CANDIDATE_INPUT_SHA256,
    evidenceQualitySchemaVersion: EVIDENCE_QUALITY_SCHEMA_VERSION,
    sourceTextVersion: EVIDENCE_QUALITY_TEXT_VERSION,
    documentsExpected: EXPECTED_DOCUMENTS,
    membershipsExpected: EXPECTED_MEMBERSHIPS,
    potential2021MemberEventRowsUpperBound: EXPECTED_POTENTIAL_ROWS,
    selectedDocuments: documents.length,
    integritySha256,
    documents,
    policy: {
      productionReadOnly: true,
      outcomeBlind: true,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      billInferenceAllowed: false,
      candidateBillIdentifiersRequiredEmpty: true,
      targetMemberIdentityFrozen: true,
      semanticReviewScope: 'member/issue positions only; no target-bill applicability may be inferred from this cohort',
      outcomesQueried: false,
      modelFitting: false,
      servingChanged: false,
    },
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(artifact, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({
    historicalDensityP2SemanticReviewCohort: {
      batchId: COHORT_ID,
      selectedDocuments: documents.length,
      memberships: new Set(documents.map((row) => row.membershipId)).size,
      potential2021MemberEventRowsUpperBound: EXPECTED_POTENTIAL_ROWS,
      candidateBillIdentifiers: 0,
      integritySha256,
      productionReadOnly: true,
      outcomeUse: 'none',
      modelFitting: false,
      servingChanged: false,
    },
  }, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
