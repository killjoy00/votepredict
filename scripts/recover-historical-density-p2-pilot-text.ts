import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  EVIDENCE_QUALITY_SCHEMA_VERSION,
  EVIDENCE_QUALITY_TEXT_VERSION,
  sourceContentIdentityMatches,
} from '../src/evidence/evidence-quality.js';
import { evidenceQualitySourceAvailabilityDate } from '../src/evidence/evidence-quality-historical-availability.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const INVENTORY_SCHEMA_VERSION = 'historical-density-p2-recovery-inventory-v1';
const EXPECTED_INVENTORY_ARTIFACT_ID = 11382774063;
const EXPECTED_INVENTORY_ARTIFACT_DIGEST = 'sha256:0e5a737d7069bdc9c95f9a22caae7ebf48e1fa39b84c1fcaed344fdbd14b14cd';
const EXPECTED_CANDIDATE_INPUT_SHA256 = '706d0e910c84c85675f3ea1ebfb9c5290aadef1af0eb08acf609d09764b287fb';
const EXPECTED_PILOT_SIZE = 25;
const EXPECTED_PILOT_MEMBERSHIPS = 18;
const EXPECTED_PILOT_POTENTIAL_ROWS = 3923;
const SOURCE_SYSTEM = 'historical-density-p2-pilot-text-recovery-v1';
const OUTPUT_FILE = 'historical-density-p2-pilot-text-recovery-v1.json';
let secrets: string[] = [];

type PilotRow = {
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
  frozenBaseline: {
    targetUniverseArtifactId: number;
    targetUniverseArtifactDigest: string;
    targetSession: string;
    evidenceQualitySchemaVersion: string;
    evidenceQualityTextVersion: string;
  };
  sourceUniverse: {
    candidateInputSha256: string;
  };
  recommendedPilot: {
    selected: number;
    uniqueMemberships: number;
    uniquePotentialMemberEventRows: number;
    rows: PilotRow[];
  };
};

type SourceRow = {
  id: string;
  source_kind: string;
  source_url: string;
  content_sha256: string;
  metadata: Record<string, unknown> | null;
  has_text_snapshot: boolean;
  text_source_content_sha256: string | null;
  has_annotation: boolean;
};

type ResultRow = {
  sourceDocumentId: string;
  sourceKind: string;
  membershipId: string;
  availabilityDate: string;
  potentialRows: number;
  status: 'inserted' | 'already_present' | 'fetch_failure' | 'hash_mismatch' | 'short_text';
  sourceDocumentTextId?: string;
  textChars?: number;
  failure?: string;
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
    .slice(0, 1200);
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

function loadInventory(path: string) {
  const inventory = JSON.parse(readFileSync(path, 'utf8')) as Inventory;
  if (inventory.schemaVersion !== INVENTORY_SCHEMA_VERSION) throw new Error('P2 inventory schema drifted');
  if (inventory.issue !== 718) throw new Error('P2 inventory issue identity drifted');
  if (inventory.frozenBaseline.targetUniverseArtifactId !== 11252079484
    || inventory.frozenBaseline.targetUniverseArtifactDigest !== 'sha256:22e8944cffc6fda553b05ea6ad5e92400d35fc01d83177efdd5d1204dd3c5a6f'
    || inventory.frozenBaseline.targetSession !== '2021-2022'
    || inventory.frozenBaseline.evidenceQualitySchemaVersion !== EVIDENCE_QUALITY_SCHEMA_VERSION
    || inventory.frozenBaseline.evidenceQualityTextVersion !== EVIDENCE_QUALITY_TEXT_VERSION) {
    throw new Error('P2 inventory frozen baseline drifted');
  }
  if (inventory.sourceUniverse.candidateInputSha256 !== EXPECTED_CANDIDATE_INPUT_SHA256) {
    throw new Error('P2 inventory candidate identity drifted');
  }
  if (inventory.recommendedPilot.selected !== EXPECTED_PILOT_SIZE
    || inventory.recommendedPilot.rows.length !== EXPECTED_PILOT_SIZE
    || inventory.recommendedPilot.uniqueMemberships !== EXPECTED_PILOT_MEMBERSHIPS
    || inventory.recommendedPilot.uniquePotentialMemberEventRows !== EXPECTED_PILOT_POTENTIAL_ROWS) {
    throw new Error('P2 inventory pilot shape drifted');
  }

  const ids = new Set<string>();
  for (const row of inventory.recommendedPilot.rows) {
    if (ids.has(row.sourceDocumentId)) throw new Error('Duplicate sourceDocumentId in frozen P2 pilot');
    ids.add(row.sourceDocumentId);
    if (!['wayback_member_primary', 'wayback_campaign_site'].includes(row.sourceKind)) {
      throw new Error('Unexpected P2 source kind');
    }
    if (!/^[a-f0-9]{64}$/i.test(row.contentSha256)) throw new Error('Invalid frozen content SHA');
    if (!row.availabilityDate) throw new Error('Frozen P2 pilot row lacks historical availability');
    if (row.hasTextSnapshot || row.hasAnnotation || row.priorSnapshotAttempt) {
      throw new Error('Frozen P2 pilot freshness invariant drifted');
    }
    if (row.potentialRows <= 0) throw new Error('Frozen P2 pilot row lacks target opportunity');
  }
  return inventory;
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const inventoryPath = process.env.VOTEPREDICT_HISTORICAL_DENSITY_P2_INVENTORY_PATH;
  const outputDir = process.env.VOTEPREDICT_HISTORICAL_DENSITY_P2_RECOVERY_OUTPUT_DIR;
  if (!envFile || !inventoryPath || !outputDir) {
    throw new Error('Production env, frozen P2 inventory, and output directory are required');
  }

  const inventory = loadInventory(inventoryPath);
  const pilot = inventory.recommendedPilot.rows;

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
  const { fetchPublicPage } = await import('../src/evidence/public-http.js');
  const { persistVerifiedSourceText } = await import('../src/evidence/evidence-quality-store.js');

  const ids = pilot.map((row) => row.sourceDocumentId);
  const client = await pool.connect();
  let sourceRows: SourceRow[] = [];
  try {
    await client.query('BEGIN READ ONLY');
    sourceRows = (await client.query<SourceRow>(`
      SELECT sd.id::text AS id,
             sd.source_kind,
             sd.source_url,
             sd.content_sha256,
             sd.metadata,
             (sdt.id IS NOT NULL) AS has_text_snapshot,
             sdt.source_content_sha256 AS text_source_content_sha256,
             EXISTS (
               SELECT 1
                 FROM evidence_quality_annotations eqa
                WHERE eqa.source_document_id=sd.id
                  AND eqa.schema_version=$2
             ) AS has_annotation
        FROM source_documents sd
        LEFT JOIN source_document_texts sdt
          ON sdt.source_document_id=sd.id
         AND sdt.extraction_version=$3
       WHERE sd.id = ANY($1::uuid[])
       ORDER BY sd.id
    `, [ids, EVIDENCE_QUALITY_SCHEMA_VERSION, EVIDENCE_QUALITY_TEXT_VERSION])).rows;
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }

  if (sourceRows.length !== EXPECTED_PILOT_SIZE) {
    await pool.end();
    throw new Error('Current production source count does not match frozen P2 pilot');
  }

  const currentById = new Map(sourceRows.map((row) => [row.id, row]));
  let alreadyPresentAtStart = 0;
  for (const frozen of pilot) {
    const current = currentById.get(frozen.sourceDocumentId);
    if (!current) throw new Error('Frozen P2 source missing from production');
    if (current.source_kind !== frozen.sourceKind
      || current.source_url !== frozen.sourceUrl
      || current.content_sha256.toLowerCase() !== frozen.contentSha256.toLowerCase()) {
      throw new Error('Frozen P2 source identity drifted');
    }
    const currentAvailability = evidenceQualitySourceAvailabilityDate(current.metadata);
    if (currentAvailability !== frozen.availabilityDate) {
      throw new Error('Frozen P2 source historical availability drifted');
    }
    if (current.has_annotation) {
      throw new Error('Frozen P2 source gained an Evidence Quality annotation before text recovery');
    }
    if (current.has_text_snapshot) {
      if (current.text_source_content_sha256?.toLowerCase() !== frozen.contentSha256.toLowerCase()) {
        throw new Error('Existing P2 text snapshot source identity conflicts with frozen content');
      }
      alreadyPresentAtStart += 1;
    }
  }

  const runRow = await pool.query<{ id: string }>(`
    INSERT INTO ingestion_runs(source_system,scope,status,metadata)
    VALUES($1,$2,'running',$3::jsonb)
    RETURNING id::text
  `, [
    SOURCE_SYSTEM,
    'issue:718:artifact:' + EXPECTED_INVENTORY_ARTIFACT_ID + ':pilot:25',
    JSON.stringify({
      issue: 718,
      inventoryArtifactId: EXPECTED_INVENTORY_ARTIFACT_ID,
      inventoryArtifactDigest: EXPECTED_INVENTORY_ARTIFACT_DIGEST,
      candidateInputSha256: EXPECTED_CANDIDATE_INPUT_SHA256,
      pilotSourceDocumentIds: ids,
      expectedMemberships: EXPECTED_PILOT_MEMBERSHIPS,
      expectedPotentialRows: EXPECTED_PILOT_POTENTIAL_ROWS,
      textVersion: EVIDENCE_QUALITY_TEXT_VERSION,
      classifierCalls: 0,
      billInference: false,
      stanceInference: false,
      outcomesUsed: false,
      servingChanged: false,
    }),
  ]);
  const runId = runRow.rows[0].id;

  const results: ResultRow[] = [];
  let inserted = 0;
  let alreadyPresent = 0;
  let fetchFailures = 0;
  let hashMismatches = 0;
  let shortText = 0;

  for (const frozen of pilot) {
    const current = currentById.get(frozen.sourceDocumentId)!;
    if (current.has_text_snapshot) {
      alreadyPresent += 1;
      results.push({
        sourceDocumentId: frozen.sourceDocumentId,
        sourceKind: frozen.sourceKind,
        membershipId: frozen.membershipId,
        availabilityDate: frozen.availabilityDate!,
        potentialRows: frozen.potentialRows,
        status: 'already_present',
      });
      continue;
    }

    try {
      const page = await fetchPublicPage(frozen.sourceUrl, {
        timeoutMs: 20_000,
        maxBytes: 2_500_000,
        userAgent: 'VotePredict/2.0 historical-density-p2-pilot-text-recovery-v1',
      });

      if (!sourceContentIdentityMatches(frozen.contentSha256, page.contentSha256)) {
        hashMismatches += 1;
        results.push({
          sourceDocumentId: frozen.sourceDocumentId,
          sourceKind: frozen.sourceKind,
          membershipId: frozen.membershipId,
          availabilityDate: frozen.availabilityDate!,
          potentialRows: frozen.potentialRows,
          status: 'hash_mismatch',
        });
        continue;
      }

      const normalizedText = page.text.replace(/\r\n?/g, '\n');
      const textChars = normalizedText.replace(/\s+/g, ' ').trim().length;
      if (textChars < 40) {
        shortText += 1;
        results.push({
          sourceDocumentId: frozen.sourceDocumentId,
          sourceKind: frozen.sourceKind,
          membershipId: frozen.membershipId,
          availabilityDate: frozen.availabilityDate!,
          potentialRows: frozen.potentialRows,
          status: 'short_text',
          textChars,
        });
        continue;
      }

      const persisted = await persistVerifiedSourceText(pool, {
        sourceDocumentId: frozen.sourceDocumentId,
        sourceContentSha256: frozen.contentSha256,
        normalizedText,
        extractionMethod: 'verified-refetch-content-hash-match',
        metadata: {
          sourceKind: frozen.sourceKind,
          historicalDensityIssue: 718,
          historicalDensityLane: 'p2-member-strong-no-bill',
          inventoryArtifactId: EXPECTED_INVENTORY_ARTIFACT_ID,
          inventoryArtifactDigest: EXPECTED_INVENTORY_ARTIFACT_DIGEST,
          candidateInputSha256: EXPECTED_CANDIDATE_INPUT_SHA256,
          frozenMembershipId: frozen.membershipId,
          frozenAvailabilityDate: frozen.availabilityDate,
          frozenPotentialRows: frozen.potentialRows,
          fetchedForEvidenceQualityAt: page.fetchedAt,
          classifierCalls: 0,
          billInference: false,
          stanceInference: false,
        },
      });
      if (persisted.inserted) inserted += 1;
      else alreadyPresent += 1;
      results.push({
        sourceDocumentId: frozen.sourceDocumentId,
        sourceKind: frozen.sourceKind,
        membershipId: frozen.membershipId,
        availabilityDate: frozen.availabilityDate!,
        potentialRows: frozen.potentialRows,
        status: persisted.inserted ? 'inserted' : 'already_present',
        sourceDocumentTextId: persisted.id,
        textChars,
      });
    } catch (error) {
      fetchFailures += 1;
      results.push({
        sourceDocumentId: frozen.sourceDocumentId,
        sourceKind: frozen.sourceKind,
        membershipId: frozen.membershipId,
        availabilityDate: frozen.availabilityDate!,
        potentialRows: frozen.potentialRows,
        status: 'fetch_failure',
        failure: safe(error),
      });
    }
  }

  const recoveredIds = new Set(
    results
      .filter((row) => row.status === 'inserted' || row.status === 'already_present')
      .map((row) => row.sourceDocumentId),
  );
  const recoveredMemberships = new Set(
    pilot
      .filter((row) => recoveredIds.has(row.sourceDocumentId))
      .map((row) => row.membershipId),
  );
  const recoveredPotentialRowsUpperBound = new Set(
    pilot
      .filter((row) => recoveredIds.has(row.sourceDocumentId))
      .flatMap((row) => Array.from({ length: row.potentialRows }, (_, i) => row.membershipId + ':' + i)),
  ).size;

  const report = {
    schemaVersion: SOURCE_SYSTEM,
    generatedAt: new Date().toISOString(),
    issue: 718,
    frozenInput: {
      inventoryArtifactId: EXPECTED_INVENTORY_ARTIFACT_ID,
      inventoryArtifactDigest: EXPECTED_INVENTORY_ARTIFACT_DIGEST,
      candidateInputSha256: EXPECTED_CANDIDATE_INPUT_SHA256,
      pilotSources: EXPECTED_PILOT_SIZE,
      pilotMemberships: EXPECTED_PILOT_MEMBERSHIPS,
      pilotPotentialMemberEventRows: EXPECTED_PILOT_POTENTIAL_ROWS,
    },
    preflight: {
      exactProductionSourcesRevalidated: sourceRows.length,
      alreadyPresentAtStart,
      annotationsPresentAtStart: 0,
      sourceIdentityDrift: 0,
      availabilityDrift: 0,
    },
    result: {
      inserted,
      alreadyPresent,
      recoveredSources: recoveredIds.size,
      recoveredMemberships: recoveredMemberships.size,
      recoveredPotentialRowsUpperBound,
      fetchFailures,
      hashMismatches,
      shortText,
      unresolvedSources: EXPECTED_PILOT_SIZE - recoveredIds.size,
      rows: results,
    },
    policy: {
      exactStoredSourceUrlOnly: true,
      exactStoredContentShaRequired: true,
      noArchiveDiscovery: true,
      noCurrentMutableSubstitution: true,
      sourceDocumentWrites: false,
      evidenceItemWrites: false,
      annotationWrites: false,
      sourceDocumentTextWrites: true,
      ingestionRunWrites: true,
      billInference: false,
      stanceInference: false,
      outcomeUse: 'none',
      classifierCalls: 0,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      modelFitting: 'none',
      featureFreeze: false,
      servingChanged: false,
      nextStep: 'freeze only successfully recovered exact texts into a separate P2 semantic-review cohort; candidate bill identifiers must remain empty',
    },
  };

  await pool.query(`
    UPDATE ingestion_runs
       SET status='complete',
           finished_at=now(),
           source_documents=$2,
           metadata=metadata || $3::jsonb
     WHERE id=$1::uuid
  `, [
    runId,
    recoveredIds.size,
    JSON.stringify({
      result: {
        inserted,
        alreadyPresent,
        recoveredSources: recoveredIds.size,
        recoveredMemberships: recoveredMemberships.size,
        fetchFailures,
        hashMismatches,
        shortText,
        unresolvedSources: EXPECTED_PILOT_SIZE - recoveredIds.size,
      },
    }),
  ]);

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, OUTPUT_FILE), JSON.stringify(report, null, 2) + '\n');

  console.log(JSON.stringify({
    historicalDensityP2PilotTextRecovery: {
      inventoryArtifactId: EXPECTED_INVENTORY_ARTIFACT_ID,
      pilotSources: EXPECTED_PILOT_SIZE,
      inserted,
      alreadyPresent,
      recoveredSources: recoveredIds.size,
      recoveredMemberships: recoveredMemberships.size,
      fetchFailures,
      hashMismatches,
      shortText,
      unresolvedSources: EXPECTED_PILOT_SIZE - recoveredIds.size,
      sourceDocumentWrites: false,
      evidenceItemWrites: false,
      annotationWrites: false,
      billInference: false,
      stanceInference: false,
      outcomesUsed: false,
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
