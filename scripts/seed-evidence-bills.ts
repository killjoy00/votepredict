import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditBillFeature } from '../src/features/feature-audit.js';
import { BILL_FEATURE_SCHEMA_VERSION, DETERMINISTIC_EXTRACTOR_VERSION } from '../src/features/bills.js';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { fetchRevisorBill } from '../src/sources/minnesota/revisor.js';

type EvidenceManifest = {
  version: string;
  records: Array<{
    source?: { sourceKind?: string };
    target?: { billIdentifier?: string; sessionSlug?: string };
  }>;
};

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function configureProductionEnvironment(): void {
  const path = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!path) return;
  const parsed = parseRuntimeEnvironment(readFileSync(path, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) if (value !== undefined) process.env[key] = value;
}

function safeErrorText(error: unknown): string {
  let message = error instanceof Error ? error.stack ?? error.message : String(error);
  for (const [key, value] of Object.entries(process.env)) {
    if (!value || value.length < 4 || !/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key)) continue;
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

function billTargets(manifest: EvidenceManifest): Array<{ identifier: string; sessionSlug: string }> {
  const unique = new Map<string, { identifier: string; sessionSlug: string }>();
  for (const record of manifest.records) {
    if (record.source?.sourceKind !== 'official_bill_status') continue;
    const identifier = record.target?.billIdentifier?.trim().toUpperCase();
    const sessionSlug = record.target?.sessionSlug?.trim();
    if (!identifier || !sessionSlug) throw new Error('official_bill_status evidence requires billIdentifier and sessionSlug');
    if (!/^(HF|SF)\d+$/.test(identifier)) throw new Error(`Unsupported Minnesota bill identifier: ${identifier}`);
    unique.set(`${sessionSlug}:${identifier}`, { identifier, sessionSlug });
  }
  return [...unique.values()].sort((a, b) => `${a.sessionSlug}:${a.identifier}`.localeCompare(`${b.sessionSlug}:${b.identifier}`));
}

async function main(): Promise<void> {
  configureProductionEnvironment();
  const manifestPath = resolve(argumentValue('--manifest') ?? 'data/evidence/gambling-curated-v1.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as EvidenceManifest;
  if (!manifest.version || !Array.isArray(manifest.records)) throw new Error('Invalid evidence manifest');
  const targets = billTargets(manifest);
  if (targets.length === 0) {
    console.log(JSON.stringify({ manifest: manifest.version, bills: 0, inserted: 0, updated: 0 }));
    return;
  }

  const { pool } = await import('../src/lib/db/index.js');
  const run = await pool.query<{ id: string }>(`
    INSERT INTO ingestion_runs (source_system, scope, status, metadata)
    VALUES ('mn-revisor-evidence-bills', $1, 'running', $2::jsonb)
    RETURNING id::text`, [
    `manifest:${manifest.version}`,
    JSON.stringify({ manifestVersion: manifest.version, manifestPath, requestedBills: targets.length }),
  ]);
  const runId = run.rows[0].id;

  let inserted = 0;
  let updated = 0;
  try {
    for (const target of targets) {
      const official = await fetchRevisorBill(target.sessionSlug, target.identifier, true);
      if (!official.text || !official.textSha256) throw new Error(`Revisor text missing for ${target.identifier}`);
      const latestVersion = official.versions.at(-1);
      if (!latestVersion?.postedOn) throw new Error(`Revisor version date missing for ${target.identifier}`);
      const title = official.description || official.title;
      const chamberSlug = target.identifier.startsWith('HF') ? 'house' : 'senate';
      const scope = await pool.query<{ session_id: string; chamber_id: string }>(`
        SELECT s.id::text AS session_id, c.id::text AS chamber_id
          FROM legislative_sessions s
          JOIN jurisdictions j ON j.id=s.jurisdiction_id
          JOIN chambers c ON c.jurisdiction_id=j.id AND c.slug=$2
         WHERE j.slug='us-mn' AND s.slug=$1
         LIMIT 2`, [target.sessionSlug, chamberSlug]);
      if (scope.rows.length !== 1) throw new Error(`Session/chamber scope could not be resolved for ${target.sessionSlug} ${target.identifier}`);

      const existing = await pool.query<{ id: string }>(`SELECT id::text FROM bills WHERE session_id=$1::uuid AND identifier=$2`, [scope.rows[0].session_id, target.identifier]);
      const bill = await pool.query<{ id: string }>(`
        INSERT INTO bills (
          session_id, originating_chamber_id, identifier, title, status, source_url, metadata
        ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7::jsonb)
        ON CONFLICT (session_id, identifier) DO UPDATE SET
          originating_chamber_id=COALESCE(bills.originating_chamber_id, EXCLUDED.originating_chamber_id),
          title=EXCLUDED.title,
          status=EXCLUDED.status,
          source_url=EXCLUDED.source_url,
          metadata=(bills.metadata || (EXCLUDED.metadata - 'revisor')) || jsonb_build_object(
            'revisor', COALESCE(bills.metadata->'revisor','{}'::jsonb) || COALESCE(EXCLUDED.metadata->'revisor','{}'::jsonb)
          ),
          updated_at=now()
        RETURNING id::text`, [
        scope.rows[0].session_id,
        scope.rows[0].chamber_id,
        target.identifier,
        title,
        official.currentVersion || 'Official Revisor record',
        official.sourceUrl,
        JSON.stringify({
          revisor: {
            legislature: official.legislature,
            sessionStartYear: official.sessionStartYear,
            currentVersion: official.currentVersion,
            latestTextUrl: official.latestTextUrl,
            companionIdentifier: official.companionIdentifier,
            versionCount: official.versions.length,
          },
          evidenceBillSeed: {
            manifestVersion: manifest.version,
            source: 'official_bill_status',
          },
        }),
      ]);
      if (existing.rows.length === 0) inserted += 1;
      else updated += 1;

      const versionKey = official.currentVersion || latestVersion.versionKey;
      const billVersion = await pool.query<{ id: string }>(`
        INSERT INTO bill_versions (
          bill_id, version_key, published_at, text_url, text_hash, raw_text, source_url
        ) VALUES ($1::uuid,$2,$3::date,$4,$5,$6,$4)
        ON CONFLICT (bill_id, version_key) DO UPDATE SET
          published_at=EXCLUDED.published_at,
          text_url=EXCLUDED.text_url,
          text_hash=EXCLUDED.text_hash,
          raw_text=EXCLUDED.raw_text,
          source_url=EXCLUDED.source_url
        RETURNING id::text`, [
        bill.rows[0].id,
        versionKey,
        latestVersion.postedOn,
        official.latestTextUrl,
        official.textSha256,
        official.text,
      ]);

      const audited = auditBillFeature({
        id: billVersion.rows[0].id,
        bill_id: bill.rows[0].id,
        identifier: target.identifier,
        session_slug: target.sessionSlug,
        title,
        version_key: versionKey,
        published_at: latestVersion.postedOn,
        raw_text: official.text,
        source_url: official.latestTextUrl,
      });
      await pool.query(`
        INSERT INTO bill_feature_sets (
          bill_version_id, feature_schema_version, extractor_kind, extractor_version,
          features, confidence, provenance, generated_at
        ) VALUES ($1::uuid,$2,'deterministic',$3,$4::jsonb,'{}'::jsonb,$5::jsonb,now())
        ON CONFLICT (bill_version_id, feature_schema_version, extractor_kind, extractor_version)
        DO UPDATE SET features=EXCLUDED.features, provenance=EXCLUDED.provenance, generated_at=now()`, [
        billVersion.rows[0].id,
        BILL_FEATURE_SCHEMA_VERSION,
        DETERMINISTIC_EXTRACTOR_VERSION,
        JSON.stringify(audited.features),
        JSON.stringify(audited.provenance),
      ]);
    }

    await pool.query(`
      UPDATE ingestion_runs
         SET status='complete', finished_at=now(),
             metadata=metadata || $2::jsonb
       WHERE id=$1::uuid`, [runId, JSON.stringify({ insertedBills: inserted, updatedBills: updated, completedBills: targets.length })]);
    console.log(JSON.stringify({ runId, manifest: manifest.version, bills: targets.length, inserted, updated, extractorVersion: DETERMINISTIC_EXTRACTOR_VERSION }));
  } catch (error) {
    const message = safeErrorText(error);
    await pool.query(`UPDATE ingestion_runs SET status='failed', finished_at=now(), error_summary=$2 WHERE id=$1::uuid`, [runId, message.slice(0, 2000)]).catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safeErrorText(error));
  process.exitCode = 1;
});
