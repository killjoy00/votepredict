import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const SESSIONS = ['2021-2022', '2023-2024', '2025-2026'] as const;
let secrets: string[] = [];

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find(arg => arg.startsWith(name + '='));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function mask(value: string): void {
  if (value.length > 3) {
    console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
  }
}

function safe(error: unknown): string {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(item => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1800);
}

async function chooseDb(env: Record<string, string | undefined>): Promise<string> {
  const { Pool } = await import('pg');
  async function works(value: string): Promise<boolean> {
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
  mask(secret);
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + secret },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

function familyClause(family: 'candidate_finance' | 'independent_expenditure'): string {
  if (family === 'candidate_finance') {
    return `
      sd.source_kind IN (
        'campaign_finance_candidate_contribution_bulk',
        'campaign_finance_candidate_expenditure_bulk'
      )
      AND ei.metadata->>'subtype' IN (
        'candidate_contribution_record',
        'candidate_expenditure_record'
      )
      AND ei.metadata->>'transactionDateIsAvailability'='false'
    `;
  }
  return `
    sd.source_kind='campaign_finance_independent_expenditure_bulk'
    AND ei.metadata->>'subtype'='independent_expenditure_record'
    AND ei.metadata->>'transactionDateIsAvailability'='false'
  `;
}

function sessionOrder(alias: string): string {
  return `CASE ${alias}.slug
    WHEN '2021-2022' THEN 1
    WHEN '2023-2024' THEN 2
    WHEN '2025-2026' THEN 3
    ELSE 99 END`;
}

async function eligibleCarry(pool: import('pg').Pool, family: 'candidate_finance' | 'independent_expenditure') {
  const clause = familyClause(family);
  return pool.query(`
    WITH source_rows AS (
      SELECT DISTINCT ON (
               ei.metadata->>'rowKey',
               m.legislator_id,
               s.slug
             )
             ei.metadata->>'rowKey' AS row_key,
             m.legislator_id,
             s.slug AS source_session,
             ${sessionOrder('s')} AS source_order,
             ei.published_at::date AS available_on
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        JOIN memberships m ON m.id=ei.membership_id
        JOIN legislative_sessions s ON s.id=m.session_id
       WHERE ${clause}
         AND ei.membership_id IS NOT NULL
         AND ei.metadata->>'rowKey' IS NOT NULL
         AND ei.metadata->>'asOfEligible'='true'
         AND ei.published_at IS NOT NULL
         AND s.slug=ANY($1::text[])
       ORDER BY
         ei.metadata->>'rowKey',
         m.legislator_id,
         s.slug,
         ei.published_at,
         ei.id
    ),
    target_memberships AS (
      SELECT m.id AS target_membership_id,
             m.legislator_id,
             s.slug AS target_session,
             c.slug AS chamber,
             ${sessionOrder('s')} AS target_order,
             s.starts_on::date AS target_start,
             s.ends_on::date AS target_end
        FROM memberships m
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
       WHERE s.slug=ANY($1::text[])
         AND c.slug IN ('house','senate')
    )
    SELECT sr.source_session AS "sourceSession",
           tm.target_session AS "targetSession",
           tm.chamber,
           count(DISTINCT sr.row_key)::int AS "priorRowKeys",
           count(DISTINCT sr.row_key) FILTER (
             WHERE sr.available_on < tm.target_start
           )::int AS "rowKeysAvailableBeforeSessionStart",
           count(DISTINCT sr.row_key) FILTER (
             WHERE sr.available_on >= tm.target_start
               AND (tm.target_end IS NULL OR sr.available_on < tm.target_end)
           )::int AS "rowKeysBecomingAvailableDuringSession",
           count(DISTINCT sr.row_key) FILTER (
             WHERE tm.target_end IS NULL OR sr.available_on < tm.target_end
           )::int AS "rowKeysPotentiallyUsableBySessionEnd",
           count(DISTINCT tm.target_membership_id) FILTER (
             WHERE tm.target_end IS NULL OR sr.available_on < tm.target_end
           )::int AS "targetMembershipsWithCarry",
           min(sr.available_on)::text AS "earliestProvenAvailableOn",
           max(sr.available_on)::text AS "latestProvenAvailableOn"
      FROM source_rows sr
      JOIN target_memberships tm ON tm.legislator_id=sr.legislator_id
     WHERE tm.target_order > sr.source_order
     GROUP BY sr.source_session,tm.target_session,tm.chamber
     ORDER BY sr.source_session,tm.target_session,tm.chamber
  `, [SESSIONS]);
}

async function timingDebtCarry(pool: import('pg').Pool, family: 'candidate_finance' | 'independent_expenditure') {
  const clause = familyClause(family);
  return pool.query(`
    WITH source_rows AS (
      SELECT DISTINCT ON (
               ei.metadata->>'rowKey',
               m.legislator_id,
               s.slug
             )
             ei.metadata->>'rowKey' AS row_key,
             m.legislator_id,
             s.slug AS source_session,
             ${sessionOrder('s')} AS source_order
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        JOIN memberships m ON m.id=ei.membership_id
        JOIN legislative_sessions s ON s.id=m.session_id
       WHERE ${clause}
         AND ei.membership_id IS NOT NULL
         AND ei.metadata->>'rowKey' IS NOT NULL
         AND (
           ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true'
           OR ei.published_at IS NULL
         )
         AND s.slug=ANY($1::text[])
       ORDER BY
         ei.metadata->>'rowKey',
         m.legislator_id,
         s.slug,
         ei.id
    ),
    target_memberships AS (
      SELECT m.id AS target_membership_id,
             m.legislator_id,
             s.slug AS target_session,
             c.slug AS chamber,
             ${sessionOrder('s')} AS target_order
        FROM memberships m
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
       WHERE s.slug=ANY($1::text[])
         AND c.slug IN ('house','senate')
    )
    SELECT sr.source_session AS "sourceSession",
           tm.target_session AS "targetSession",
           tm.chamber,
           count(DISTINCT sr.row_key)::int AS "priorTimingUnprovenRowKeys",
           count(DISTINCT tm.target_membership_id)::int AS "targetMembershipsPotentiallyAffected"
      FROM source_rows sr
      JOIN target_memberships tm ON tm.legislator_id=sr.legislator_id
     WHERE tm.target_order > sr.source_order
     GROUP BY sr.source_session,tm.target_session,tm.chamber
     ORDER BY sr.source_session,tm.target_session,tm.chamber
  `, [SESSIONS]);
}

async function main(): Promise<void> {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  secrets = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secrets.forEach(mask);

  const databaseUrl = await chooseDb(env);
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 3,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const [
      candidateEligible,
      candidateDebt,
      ieEligible,
      ieDebt,
      lobbying,
      lobbyingSessionUse,
    ] = await Promise.all([
      eligibleCarry(pool, 'candidate_finance'),
      timingDebtCarry(pool, 'candidate_finance'),
      eligibleCarry(pool, 'independent_expenditure'),
      timingDebtCarry(pool, 'independent_expenditure'),
      pool.query(`
        SELECT (ei.metadata->>'reportYear')::int AS "reportYear",
               count(DISTINCT ei.metadata->>'rowKey')::int AS "eligibleRowKeys",
               min(ei.published_at::date)::text AS "earliestProvenAvailableOn",
               max(ei.published_at::date)::text AS "latestProvenAvailableOn",
               count(DISTINCT ei.metadata->>'rowKey') FILTER (
                 WHERE ei.metadata->>'availabilityBoundKind'='conservative_upper_bound'
               )::int AS "upperBoundRowKeys"
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
         WHERE sd.source_kind='campaign_finance_lobbying_principal_bulk'
           AND ei.metadata->>'subtype'='principal_annual_expenditure'
           AND ei.metadata->>'rowKey' IS NOT NULL
           AND ei.metadata->>'asOfEligible'='true'
           AND ei.published_at IS NOT NULL
         GROUP BY (ei.metadata->>'reportYear')::int
         ORDER BY "reportYear"
      `),
      pool.query(`
        WITH lobbying_rows AS (
          SELECT DISTINCT ON (ei.metadata->>'rowKey')
                 ei.metadata->>'rowKey' AS row_key,
                 (ei.metadata->>'reportYear')::int AS report_year,
                 ei.published_at::date AS available_on
            FROM evidence_items ei
            JOIN source_documents sd ON sd.id=ei.source_document_id
           WHERE sd.source_kind='campaign_finance_lobbying_principal_bulk'
             AND ei.metadata->>'subtype'='principal_annual_expenditure'
             AND ei.metadata->>'rowKey' IS NOT NULL
             AND ei.metadata->>'asOfEligible'='true'
             AND ei.published_at IS NOT NULL
           ORDER BY ei.metadata->>'rowKey',ei.published_at,ei.id
        ),
        sessions AS (
          SELECT slug,
                 starts_on::date AS starts_on,
                 ends_on::date AS ends_on
            FROM legislative_sessions
           WHERE slug=ANY($1::text[])
        )
        SELECT s.slug AS session,
               count(DISTINCT l.row_key) FILTER (
                 WHERE l.available_on < s.starts_on
               )::int AS "rowKeysAvailableBeforeSessionStart",
               count(DISTINCT l.row_key) FILTER (
                 WHERE l.available_on >= s.starts_on
                   AND (s.ends_on IS NULL OR l.available_on < s.ends_on)
               )::int AS "rowKeysBecomingAvailableDuringSession",
               min(l.available_on)::text AS "earliestProvenAvailableOn",
               max(l.available_on)::text AS "latestProvenAvailableOn"
          FROM sessions s
          LEFT JOIN lobbying_rows l
            ON s.ends_on IS NULL OR l.available_on < s.ends_on
         GROUP BY s.slug,s.starts_on
         ORDER BY s.starts_on
      `, [SESSIONS]),
    ]);

    const report = {
      schemaVersion: 'prior-cycle-evidence-carry-forward-audit-v1',
      generatedAt: new Date().toISOString(),
      issue: 287,
      purpose:
        'Read-only audit of historically proven prior-cycle evidence that could remain available in later legislative sessions without inventing publication dates.',
      candidateFinance: {
        eligiblePriorCycleCarry: candidateEligible.rows,
        timingUnprovenPriorCycleDebt: candidateDebt.rows,
      },
      independentExpenditures: {
        eligiblePriorCycleCarry: ieEligible.rows,
        timingUnprovenPriorCycleDebt: ieDebt.rows,
      },
      lobbying: {
        eligibleByReportYear: lobbying.rows,
        laterSessionUsability: lobbyingSessionUse.rows,
        linkageNote:
          'Lobbying principal rows are issue/principal context, not member-linked vote evidence; this audit reports availability only and does not attribute them to legislators.',
      },
      interpretation: {
        stableLegislatorIdentityMayCarryMemberLinkedContextAcrossSessions: true,
        oldMembershipIdShouldNotByItselfErasePreviouslyPublicEvidence: true,
        targetVoteStillRequiresProvenAvailabilityStrictlyBeforeItsCutoff: true,
        sessionStartCountsAreConservativeConvenienceSummariesNotPublicationClaims: true,
        timingUnprovenRowsRemainUnavailable: true,
        arbitraryCalendarYearEndIsNotAvailabilityProof: true,
        transactionDateIsAvailability: false,
        lobbyingActivityDateIsAvailability: false,
        noStanceInferenceFromFinanceOrLobbying: true,
        readOnly: true,
        evidenceWrites: false,
        mechanicallyActionable: false,
        modelWeight: 0,
        servingChanged: false,
        productionAction: 'none',
      },
    };

    const serialized = JSON.stringify(report, null, 2) + '\n';
    const output = argumentValue('--output');
    if (output) {
      const outputPath = resolve(output);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, serialized, { mode: 0o600 });
    }
    console.log(serialized.trimEnd());
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});
