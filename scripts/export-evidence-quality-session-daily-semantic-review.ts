import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const EXPECTED_ARCHIVE_SCHEMA = 'evidence-quality-pre-vote-archive-proof-v1';
const EXPECTED_SOURCES = 22;
const EXPECTED_VERIFIED_TARGET_RECORDS = 44;
const EXPECTED_UNIQUE_ROWS = 42;
const EXPECTED_DISTINCT_EXCERPTS = 22;
let secrets: string[] = [];

type VerifiedProof = {
  captureTimestamp: string;
  capturedAt: string;
  archiveUrl: string;
  archiveDigest: string;
  archiveContentSha256: string;
  matchedExcerpt: string;
  matchedExcerptFingerprint: string;
};

type ArchiveTarget = {
  rowKey: string;
  voteEventId: string;
  membershipId: string;
  billId: string;
  identifier: string;
  occurredOn: string;
  session: string;
  evidenceIds: string[];
  classification: string;
  verifiedProof: VerifiedProof | null;
};

type ArchiveSource = {
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  sourceContentSha256: string;
  storedPublishedOnDiagnosticOnly: string;
  targets: ArchiveTarget[];
};

type ArchiveReport = {
  schemaVersion: string;
  generatedAt: string;
  summary: {
    sourcesAudited: number;
    targetProofRowsAudited: number;
    uniquePotentialRows: number;
    verifiedSourcesWithAtLeastOneTarget: number;
    fullyVerifiedSources: number;
    verifiedUniquePotentialRows: number;
  };
  sources: ArchiveSource[];
  policy: Record<string, unknown>;
};

type MembershipRow = { membership_id: string; member_name: string };
type BillRow = { bill_id: string; identifier: string };
type SourceRow = {
  source_document_id: string;
  title: string | null;
  existing_text_id: string | null;
  existing_text_sha256: string | null;
};

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 2400);
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
  const response = await fetch(DATABASE_BRIDGE_URL, { method: 'POST', headers: { authorization: 'Bearer ' + secret } });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const archivePath = process.env.VOTEPREDICT_EQ_ARCHIVE_PROOF_PATH;
  const outputDir = process.env.VOTEPREDICT_EQ_SESSION_DAILY_REVIEW_DIR;
  if (!envFile || !archivePath || !outputDir) {
    throw new Error('Production env, archive-proof artifact path, and output directory are required');
  }

  const archive = JSON.parse(readFileSync(archivePath, 'utf8')) as ArchiveReport;
  if (archive.schemaVersion !== EXPECTED_ARCHIVE_SCHEMA) {
    throw new Error('Unexpected archive-proof schema: ' + archive.schemaVersion);
  }

  const selected = archive.sources
    .map((source) => ({
      source,
      targets: source.targets.filter((target) => target.classification === 'verified_pre_vote_archive_match' && target.verifiedProof),
    }))
    .filter((entry) => entry.targets.length > 0);

  const verifiedTargets = selected.flatMap((entry) => entry.targets);
  const uniqueRows = new Set(verifiedTargets.map((target) => target.rowKey));
  const distinctExcerpts = new Set(verifiedTargets.map((target) => target.verifiedProof!.matchedExcerpt));

  if (selected.length !== EXPECTED_SOURCES) throw new Error('Expected 22 verified sources, found ' + selected.length);
  if (verifiedTargets.length !== EXPECTED_VERIFIED_TARGET_RECORDS) throw new Error('Expected 44 verified target records, found ' + verifiedTargets.length);
  if (uniqueRows.size !== EXPECTED_UNIQUE_ROWS) throw new Error('Expected 42 verified unique rows, found ' + uniqueRows.size);
  if (distinctExcerpts.size !== EXPECTED_DISTINCT_EXCERPTS) throw new Error('Expected 22 distinct verified excerpts, found ' + distinctExcerpts.size);

  const sourceIds = selected.map((entry) => entry.source.sourceDocumentId);
  const membershipIds = [...new Set(verifiedTargets.map((target) => target.membershipId))];
  const billIds = [...new Set(verifiedTargets.map((target) => target.billId))];

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
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');

    const [membershipResult, billResult, sourceResult] = await Promise.all([
      client.query<MembershipRow>(`
        SELECT m.id::text AS membership_id,l.name AS member_name
          FROM memberships m
          JOIN legislators l ON l.id=m.legislator_id
         WHERE m.id = ANY($1::uuid[])
         ORDER BY l.normalized_name,m.id
      `, [membershipIds]),
      client.query<BillRow>(`
        SELECT b.id::text AS bill_id,b.identifier
          FROM bills b
         WHERE b.id = ANY($1::uuid[])
         ORDER BY b.identifier,b.id
      `, [billIds]),
      client.query<SourceRow>(`
        SELECT sd.id::text AS source_document_id,
               NULLIF(trim(sd.metadata->>'title'),'') AS title,
               sdt.id::text AS existing_text_id,
               sdt.text_sha256 AS existing_text_sha256
          FROM source_documents sd
          LEFT JOIN source_document_texts sdt
            ON sdt.source_document_id=sd.id
           AND sdt.extraction_version='evidence-quality-text-v1'
         WHERE sd.id = ANY($1::uuid[])
         ORDER BY sd.id
      `, [sourceIds]),
    ]);

    if (membershipResult.rows.length !== membershipIds.length) throw new Error('Verified membership identity resolution is incomplete');
    if (billResult.rows.length !== billIds.length) throw new Error('Verified bill identity resolution is incomplete');
    if (sourceResult.rows.length !== sourceIds.length) throw new Error('Verified source metadata resolution is incomplete');

    const membershipName = new Map(membershipResult.rows.map((row) => [row.membership_id, row.member_name]));
    const billIdentifier = new Map(billResult.rows.map((row) => [row.bill_id, row.identifier]));
    const sourceMetadata = new Map(sourceResult.rows.map((row) => [row.source_document_id, row]));

    const documents = selected.map((entry, index) => {
      const excerpts = [...new Set(entry.targets.map((target) => target.verifiedProof!.matchedExcerpt))];
      if (excerpts.length !== 1) {
        throw new Error('Expected one distinct verified excerpt for source ' + entry.source.sourceDocumentId);
      }
      const reviewText = excerpts[0];
      const candidateMemberNames = [...new Set(entry.targets.map((target) => membershipName.get(target.membershipId)!))].sort();
      const candidateBillIdentifiers = [...new Set(entry.targets.map((target) => billIdentifier.get(target.billId)!))].sort();
      const dbSource = sourceMetadata.get(entry.source.sourceDocumentId)!;

      return {
        row: index + 1,
        sourceDocumentId: entry.source.sourceDocumentId,
        sourceKind: entry.source.sourceKind,
        sourceUrl: entry.source.sourceUrl,
        durableSourceContentSha256: entry.source.sourceContentSha256,
        title: dbSource.title,
        existingEvidenceQualitySourceTextId: dbSource.existing_text_id,
        existingEvidenceQualityTextSha256: dbSource.existing_text_sha256,
        reviewTextMode: 'archive_verified_excerpt',
        reviewText,
        reviewTextSha256: sha256(reviewText),
        candidateMemberNames,
        candidateBillIdentifiers,
        verifiedTargets: entry.targets.map((target) => ({
          rowKey: target.rowKey,
          voteEventId: target.voteEventId,
          membershipId: target.membershipId,
          memberName: membershipName.get(target.membershipId)!,
          billId: target.billId,
          identifier: billIdentifier.get(target.billId)!,
          occurredOn: target.occurredOn,
          session: target.session,
          evidenceIds: [...target.evidenceIds].sort(),
          archiveProof: target.verifiedProof,
        })),
      };
    });

    const sourcesWithExistingEvidenceQualityText = documents.filter((document) => document.existingEvidenceQualitySourceTextId).length;

    const report = {
      schemaVersion: 'evidence-quality-session-daily-semantic-review-cohort-v1',
      generatedAt: new Date().toISOString(),
      issue: 579,
      sourceArchiveProof: {
        runId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_PROOF_RUN_ID ?? 0) || null,
        artifactId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_PROOF_ARTIFACT_ID ?? 0) || null,
        artifactDigest: process.env.VOTEPREDICT_EQ_ARCHIVE_PROOF_ARTIFACT_DIGEST ?? null,
        schemaVersion: archive.schemaVersion,
        generatedAt: archive.generatedAt,
      },
      summary: {
        documents: documents.length,
        verifiedTargetRecords: verifiedTargets.length,
        verifiedUniqueRows: uniqueRows.size,
        distinctReviewExcerpts: new Set(documents.map((document) => document.reviewTextSha256)).size,
        candidateMemberships: new Set(documents.flatMap((document) => document.verifiedTargets.map((target) => target.membershipId))).size,
        candidateBills: new Set(documents.flatMap((document) => document.verifiedTargets.map((target) => target.billId))).size,
        sourcesWithExistingEvidenceQualityText,
      },
      documents,
      policy: {
        outcomeBlind: true,
        sourceKind: 'house_session_daily',
        archiveProofRequired: true,
        reviewTextMode: 'archive_verified_excerpt',
        storedPublishedAtUsedAsProof: false,
        proceduralActionIsDirectionalByDefault: false,
        sponsorshipIsDirectionalByDefault: false,
        committeeActionIsDirectionalByDefault: false,
        directionalStanceRequiresExplicitOrQuotedMemberPosition: true,
        billIdentityInference: 'none',
        contentIdentityCaveat: 'archive replay byte hash differs from durable later-fetched source byte hash; this cohort is excerpt-level semantic review, not verified_full_text',
        contextOnly: true,
        mechanicallyActionable: false,
        modelWeight: 0,
        productionWrites: false,
        modelFitting: 'none',
        servingChanged: false,
      },
    };

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(resolve(outputDir, 'evidence-quality-session-daily-semantic-review-cohort-v1.json'), JSON.stringify(report, null, 2) + '\n');

    console.log(JSON.stringify({ evidenceQualitySessionDailySemanticReviewCohort: report.summary }, null, 2));
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
