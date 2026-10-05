import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { CFB_IE_HISTORICAL_PROOF_TARGET_REGISTRATIONS } from '../src/evidence/cfb-ie-historical-targets.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
let secrets: string[] = [];

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(name + '='));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function mask(value: string) {
  if (value.length > 3) {
    console.log(
      '::add-mask::'
      + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'),
    );
  }
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .slice(0, 1800);
}

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');

  async function works(value: string) {
    const candidate = new Pool({
      connectionString: value,
      max: 1,
      connectionTimeoutMillis: 8_000,
    });
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
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

function segmentEndYear(year: number | null): number | null {
  if (year === 2021 || year === 2022) return 2022;
  if (year === 2023 || year === 2024) return 2024;
  if (year === 2025 || year === 2026) return 2026;
  return null;
}

function sessionFromYear(year: number | null): string {
  if (year === 2021 || year === 2022) return '2021-2022';
  if (year === 2023 || year === 2024) return '2023-2024';
  if (year === 2025 || year === 2026) return '2025-2026';
  return 'unknown';
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('Production env file required');
  const env = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  secrets = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secrets.forEach(mask);

  process.env.DATABASE_URL = await chooseDb(env);
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');

  try {
    const candidateSummary = await pool.query(`
      WITH identities AS (
        SELECT
          ei.metadata->>'rowKey' AS row_key,
          ei.metadata->>'filerRegistrationNumber' AS registration_number,
          max(ei.metadata->>'candidateName') AS candidate_name,
          max((ei.metadata->>'year')::int) AS year,
          max(ei.metadata->>'subtype') AS subtype,
          CASE
            WHEN max((ei.metadata->>'year')::int) IN (2021,2022) THEN 2022
            WHEN max((ei.metadata->>'year')::int) IN (2023,2024) THEN 2024
            WHEN max((ei.metadata->>'year')::int) IN (2025,2026) THEN 2026
            ELSE NULL
          END AS segment_end_year,
          s.slug AS session_slug,
          c.slug AS chamber_slug,
          bool_or(ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL) AS eligible
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        JOIN memberships m ON m.id=ei.membership_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
        WHERE sd.source_kind IN (
          'campaign_finance_candidate_contribution_bulk',
          'campaign_finance_candidate_expenditure_bulk'
        )
          AND ei.membership_id IS NOT NULL
          AND ei.metadata->>'rowKey' IS NOT NULL
          AND ei.metadata->>'filerRegistrationNumber' IS NOT NULL
          AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025','2026')
        GROUP BY
          ei.metadata->>'rowKey',
          ei.metadata->>'filerRegistrationNumber',
          s.slug,
          c.slug
      )
      SELECT
        count(*)::int AS "persistedRowKeys",
        count(*) FILTER (WHERE eligible)::int AS "eligibleRowKeys",
        count(*) FILTER (WHERE NOT eligible)::int AS "timingUnprovenRowKeys",
        count(DISTINCT registration_number)::int AS "registrationsWithRows",
        count(DISTINCT registration_number) FILTER (WHERE NOT eligible)::int AS "registrationsWithTimingDebt"
      FROM identities
    `);

    const candidateGroups = await pool.query(`
      WITH identities AS (
        SELECT
          ei.metadata->>'rowKey' AS row_key,
          ei.metadata->>'filerRegistrationNumber' AS registration_number,
          max(ei.metadata->>'candidateName') AS candidate_name,
          max((ei.metadata->>'year')::int) AS year,
          max(ei.metadata->>'subtype') AS subtype,
          CASE
            WHEN max((ei.metadata->>'year')::int) IN (2021,2022) THEN 2022
            WHEN max((ei.metadata->>'year')::int) IN (2023,2024) THEN 2024
            WHEN max((ei.metadata->>'year')::int) IN (2025,2026) THEN 2026
            ELSE NULL
          END AS segment_end_year,
          s.slug AS session_slug,
          c.slug AS chamber_slug,
          bool_or(ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL) AS eligible
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        JOIN memberships m ON m.id=ei.membership_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
        WHERE sd.source_kind IN (
          'campaign_finance_candidate_contribution_bulk',
          'campaign_finance_candidate_expenditure_bulk'
        )
          AND ei.membership_id IS NOT NULL
          AND ei.metadata->>'rowKey' IS NOT NULL
          AND ei.metadata->>'filerRegistrationNumber' IS NOT NULL
          AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025','2026')
        GROUP BY
          ei.metadata->>'rowKey',
          ei.metadata->>'filerRegistrationNumber',
          s.slug,
          c.slug
      ),
      debt AS (
        SELECT
          registration_number,
          max(candidate_name) AS candidate_name,
          max(year)::int AS latest_year,
          segment_end_year,
          session_slug,
          chamber_slug,
          count(*)::int AS persisted_row_keys,
          count(*) FILTER (WHERE eligible)::int AS eligible_row_keys,
          count(*) FILTER (WHERE NOT eligible)::int AS timing_unproven_row_keys,
          count(*) FILTER (WHERE NOT eligible AND subtype='candidate_contribution_record')::int AS unproven_contribution_rows,
          count(*) FILTER (WHERE NOT eligible AND subtype='candidate_expenditure_record')::int AS unproven_expenditure_rows
        FROM identities
        GROUP BY registration_number,segment_end_year,session_slug,chamber_slug
        HAVING count(*) FILTER (WHERE NOT eligible)>0
      ),
      checkpoints AS (
        SELECT
          metadata->>'registrationNumber' AS registration_number,
          (metadata->>'segmentEndYear')::int AS segment_end_year,
          max((metadata->>'referencesDiscovered')::int) AS references_discovered,
          max((metadata->>'selectedReports')::int) AS selected_reports,
          max((metadata->>'proofsParsed')::int) AS proofs_parsed,
          max((metadata->>'proofFailures')::int) AS proof_failures,
          max((metadata->>'disclosureMappedRows')::int) AS disclosure_mapped_rows,
          bool_or(metadata->>'checkpointVersion'='membership-tail-group-v2-row-identity') AS checkpointed
        FROM ingestion_runs
        WHERE source_system='cfb-candidate-finance-membership-tail-group'
          AND status='complete'
          AND metadata->>'registrationNumber' IS NOT NULL
        GROUP BY metadata->>'registrationNumber',(metadata->>'segmentEndYear')::int
      )
      SELECT
        d.registration_number AS "registrationNumber",
        d.candidate_name AS "candidateName",
        d.latest_year AS "latestYear",
        d.segment_end_year AS "segmentEndYear",
        d.session_slug AS "session",
        d.chamber_slug AS "chamber",
        d.persisted_row_keys AS "persistedRowKeys",
        d.eligible_row_keys AS "eligibleRowKeys",
        d.timing_unproven_row_keys AS "timingUnprovenRowKeys",
        d.unproven_contribution_rows AS "unprovenContributionRows",
        d.unproven_expenditure_rows AS "unprovenExpenditureRows",
        coalesce(c.checkpointed,false) AS "proofCheckpointPresent",
        coalesce(c.references_discovered,0)::int AS "referencesDiscovered",
        coalesce(c.selected_reports,0)::int AS "selectedReports",
        coalesce(c.proofs_parsed,0)::int AS "proofsParsed",
        coalesce(c.proof_failures,0)::int AS "proofFailures",
        coalesce(c.disclosure_mapped_rows,0)::int AS "disclosureMappedRows"
      FROM debt d
      LEFT JOIN checkpoints c
        ON c.registration_number=d.registration_number
       AND c.segment_end_year=d.segment_end_year
      ORDER BY d.timing_unproven_row_keys DESC,d.segment_end_year,d.registration_number
    `);

    const ieSummary = await pool.query(`
      WITH identities AS (
        SELECT
          ei.metadata->>'rowKey' AS row_key,
          ei.metadata->>'spenderRegistrationNumber' AS registration_number,
          max(ei.metadata->>'spender') AS spender,
          max((ei.metadata->>'year')::int) AS year,
          CASE
            WHEN max((ei.metadata->>'year')::int) IN (2021,2022) THEN 2022
            WHEN max((ei.metadata->>'year')::int) IN (2023,2024) THEN 2024
            WHEN max((ei.metadata->>'year')::int) IN (2025,2026) THEN 2026
            ELSE NULL
          END AS segment_end_year,
          bool_or(ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL) AS eligible,
          bool_or(ei.membership_id IS NOT NULL) AS membership_resolved,
          bool_or(coalesce(ei.metadata->>'reportName','') <> '') AS has_report_name,
          bool_or(coalesce(ei.metadata->>'filedOn','') <> '') AS has_filed_on,
          bool_or(coalesce(ei.metadata->>'disclosedOn','') <> '') AS has_disclosed_on
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
          AND ei.metadata->>'subtype'='independent_expenditure_record'
          AND ei.metadata->>'rowKey' IS NOT NULL
          AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025','2026')
        GROUP BY ei.metadata->>'rowKey',ei.metadata->>'spenderRegistrationNumber'
      )
      SELECT
        count(*)::int AS "persistedRowKeys",
        count(*) FILTER (WHERE eligible)::int AS "eligibleRowKeys",
        count(*) FILTER (WHERE NOT eligible)::int AS "timingUnprovenRowKeys",
        count(*) FILTER (WHERE NOT eligible AND membership_resolved)::int AS "timingUnprovenMembershipResolvedRowKeys",
        count(*) FILTER (WHERE NOT eligible AND has_report_name)::int AS "unprovenWithReportName",
        count(*) FILTER (WHERE NOT eligible AND has_filed_on)::int AS "unprovenWithFiledOn",
        count(*) FILTER (WHERE NOT eligible AND has_disclosed_on)::int AS "unprovenWithDisclosedOn",
        count(DISTINCT registration_number) FILTER (WHERE NOT eligible)::int AS "registrationsWithTimingDebt"
      FROM identities
    `);

    const ieGroupsResult = await pool.query<{
      registrationNumber: string | null;
      spender: string | null;
      latestYear: number | null;
      segmentEndYear: number | null;
      persistedRowKeys: number;
      eligibleRowKeys: number;
      timingUnprovenRowKeys: number;
      membershipResolvedDebt: number;
      unprovenWithReportName: number;
      unprovenWithFiledOn: number;
      unprovenWithDisclosedOn: number;
    }>(`
      WITH identities AS (
        SELECT
          ei.metadata->>'rowKey' AS row_key,
          ei.metadata->>'spenderRegistrationNumber' AS registration_number,
          max(ei.metadata->>'spender') AS spender,
          max((ei.metadata->>'year')::int) AS year,
          CASE
            WHEN max((ei.metadata->>'year')::int) IN (2021,2022) THEN 2022
            WHEN max((ei.metadata->>'year')::int) IN (2023,2024) THEN 2024
            WHEN max((ei.metadata->>'year')::int) IN (2025,2026) THEN 2026
            ELSE NULL
          END AS segment_end_year,
          bool_or(ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL) AS eligible,
          bool_or(ei.membership_id IS NOT NULL) AS membership_resolved,
          bool_or(coalesce(ei.metadata->>'reportName','') <> '') AS has_report_name,
          bool_or(coalesce(ei.metadata->>'filedOn','') <> '') AS has_filed_on,
          bool_or(coalesce(ei.metadata->>'disclosedOn','') <> '') AS has_disclosed_on
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
          AND ei.metadata->>'subtype'='independent_expenditure_record'
          AND ei.metadata->>'rowKey' IS NOT NULL
          AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025','2026')
        GROUP BY ei.metadata->>'rowKey',ei.metadata->>'spenderRegistrationNumber'
      )
      SELECT
        registration_number AS "registrationNumber",
        max(spender) AS "spender",
        max(year)::int AS "latestYear",
        segment_end_year AS "segmentEndYear",
        count(*)::int AS "persistedRowKeys",
        count(*) FILTER (WHERE eligible)::int AS "eligibleRowKeys",
        count(*) FILTER (WHERE NOT eligible)::int AS "timingUnprovenRowKeys",
        count(*) FILTER (WHERE NOT eligible AND membership_resolved)::int AS "membershipResolvedDebt",
        count(*) FILTER (WHERE NOT eligible AND has_report_name)::int AS "unprovenWithReportName",
        count(*) FILTER (WHERE NOT eligible AND has_filed_on)::int AS "unprovenWithFiledOn",
        count(*) FILTER (WHERE NOT eligible AND has_disclosed_on)::int AS "unprovenWithDisclosedOn"
      FROM identities
      GROUP BY registration_number,segment_end_year
      HAVING count(*) FILTER (WHERE NOT eligible)>0
      ORDER BY "timingUnprovenRowKeys" DESC,"membershipResolvedDebt" DESC,segment_end_year,registration_number
    `);

    const ieAttempted = new Set(CFB_IE_HISTORICAL_PROOF_TARGET_REGISTRATIONS.map((value) => value.trim()));
    const ieGroups = ieGroupsResult.rows.map((row) => ({
      ...row,
      session: sessionFromYear(row.latestYear),
      historicalReportProofTargetedPreviously:
        Boolean(row.registrationNumber && ieAttempted.has(row.registrationNumber.trim())),
      candidateNewProofSurface:
        Boolean(row.registrationNumber && !ieAttempted.has(row.registrationNumber.trim())),
    }));

    const candidateGroupsRows = candidateGroups.rows as Array<Record<string, unknown>>;
    const candidateUntouched = candidateGroupsRows.filter(
      (row) => row.proofCheckpointPresent !== true,
    );
    const candidateAttemptedNoYield = candidateGroupsRows.filter(
      (row) =>
        row.proofCheckpointPresent === true
        && Number(row.timingUnprovenRowKeys ?? 0) > 0
        && Number(row.disclosureMappedRows ?? 0) === 0,
    );

    const output = {
      cfbAvailabilityDebtAudit: {
        schemaVersion: 'cfb-availability-debt-audit-v1',
        candidateFinance: {
          summary: candidateSummary.rows[0],
          groups: candidateGroupsRows,
          groupsWithoutProofCheckpoint: candidateUntouched.length,
          timingDebtRowsWithoutProofCheckpoint: candidateUntouched.reduce(
            (sum, row) => sum + Number(row.timingUnprovenRowKeys ?? 0),
            0,
          ),
          groupsCheckpointedWithZeroMappedRows: candidateAttemptedNoYield.length,
          timingDebtRowsCheckpointedWithZeroMappedRows: candidateAttemptedNoYield.reduce(
            (sum, row) => sum + Number(row.timingUnprovenRowKeys ?? 0),
            0,
          ),
        },
        independentExpenditures: {
          summary: ieSummary.rows[0],
          historicalReportTargetRegistrationCount: ieAttempted.size,
          groups: ieGroups,
          groupsNotPreviouslyTargeted: ieGroups.filter(
            (row) => row.candidateNewProofSurface,
          ).length,
          timingDebtRowsNotPreviouslyTargeted: ieGroups
            .filter((row) => row.candidateNewProofSurface)
            .reduce((sum, row) => sum + Number(row.timingUnprovenRowKeys ?? 0), 0),
        },
        policy: {
          readOnly: true,
          exactRowOrReportContainmentRequired: true,
          transactionDateIsAvailability: false,
          reportingPeriodOrDueDateIsAvailability: false,
          conservativeUpperBoundAllowedOnlyWithIndependentProof: true,
          sameDayEligible: false,
          repeatExhaustedArchiveUniverseByDefault: false,
          contextOnly: true,
          mechanicallyActionable: false,
          modelWeight: 0,
          servingChanged: false,
          productionAction: 'none',
        },
      },
    };

    const outputPath = argumentValue('--output');
    if (outputPath) {
      mkdirSync(dirname(resolve(outputPath)), { recursive: true });
      writeFileSync(resolve(outputPath), JSON.stringify(output, null, 2) + '\n', 'utf8');
    }
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
