import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const REPAIR_VERSION = 'cfb-ie-2021-new-proof-repair-v1';
const SEGMENT_END_YEAR = 2022;
const MAX_REPORTS_PER_GROUP = 24;
const EXPECTED_MAPPED_ROW_KEYS = 120;
const EXPECTED_UNPROVEN_BEFORE = 127;
const EXPECTED_UNPROVEN_AFTER = 7;
const TARGETS = [
  { registrationNumber: '30037', label: 'SEIU Minn State Council Political Fund', expectedDebtRows: 42, expectedMappedRows: 40 },
  { registrationNumber: '41185', label: 'Right Now MN', expectedDebtRows: 34, expectedMappedRows: 34 },
  { registrationNumber: '41192', label: 'ColorOfChange PAC', expectedDebtRows: 26, expectedMappedRows: 22 },
  { registrationNumber: '41281', label: 'Faith in Minnesota Action', expectedDebtRows: 13, expectedMappedRows: 13 },
  { registrationNumber: '30204', label: 'AFSCME Working Families Fund', expectedDebtRows: 7, expectedMappedRows: 7 },
  { registrationNumber: '30011', label: 'Minneapolis Regional Labor Federation', expectedDebtRows: 3, expectedMappedRows: 3 },
  { registrationNumber: '41291', label: 'All of Mpls', expectedDebtRows: 2, expectedMappedRows: 1 },
] as const;
let secrets: string[] = [];

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
    .replace(/https?:\/\/\S+/gi, '[source URL]')
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

type DebtRow = {
  row_key: string;
  registration_number: string;
};

type Mapping = {
  rowKey: string;
  registrationNumber: string;
  availableOn: string;
  filedOn: string;
  reportName: string;
  proofUrl: string;
  proofTextSha256: string;
  proofContentSha256: string;
  proofFetchedAt: string;
  proofBytes: number;
};

async function main() {
  const apply = process.argv.includes('--apply');
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
  const { CFB_REPORT_AVAILABILITY_VERSION } =
    await import('../src/evidence/cfb-report-availability.js');
  const {
    discoverCampaignFinanceDownloadUrls,
    fetchCampaignFinanceBulkText,
  } = await import('../src/evidence/campaign-finance-live.js');
  const {
    parseCfbIndependentExpenditureCsv,
  } = await import('../src/evidence/cfb-independent-expenditure-history.js');
  const {
    acquireCfbPcfHistoricalReportProofs,
  } = await import('../src/evidence/cfb-pcf-report-history.js');
  const {
    firstProvenCfbFinanceAvailability,
  } = await import('../src/evidence/cfb-report-finance-mapper.js');

  const targetRegistrations = TARGETS.map((target) => target.registrationNumber);

  async function state(queryable: { query: typeof pool.query }) {
    const unproven = await queryable.query<{ row_key: string; registration_number: string }>(`
      SELECT DISTINCT
        ei.metadata->>'rowKey' AS row_key,
        ei.metadata->>'spenderRegistrationNumber' AS registration_number
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
        AND ei.metadata->>'subtype'='independent_expenditure_record'
        AND ei.metadata->>'spenderRegistrationNumber' = ANY($1::text[])
        AND ei.metadata->>'year' IN ('2021','2022')
        AND (
          ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true'
          OR ei.published_at IS NULL
        )
        AND ei.metadata->>'rowKey' IS NOT NULL
      ORDER BY registration_number,row_key
    `, [targetRegistrations]);

    const repaired = await queryable.query<{ count: number }>(`
      SELECT count(DISTINCT ei.metadata->>'rowKey')::int AS count
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
        AND ei.metadata->>'availabilityRepairVersion'=$1
        AND ei.metadata->>'rowKey' IS NOT NULL
    `, [REPAIR_VERSION]);

    const globalEligible = await queryable.query<{ count: number }>(`
      SELECT count(DISTINCT ei.metadata->>'rowKey')::int AS count
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
        AND ei.metadata->>'asOfEligible'='true'
        AND ei.published_at IS NOT NULL
        AND ei.metadata->>'transactionDateIsAvailability'='false'
    `);

    return {
      unproven: unproven.rows,
      repairedRowKeys: repaired.rows[0]?.count ?? 0,
      globalEligibleRowKeys: globalEligible.rows[0]?.count ?? 0,
    };
  }

  try {
    const before = await state(pool as unknown as { query: typeof pool.query });
    if (before.repairedRowKeys === EXPECTED_MAPPED_ROW_KEYS) {
      if (before.unproven.length !== EXPECTED_UNPROVEN_AFTER) {
        throw new Error(
          'Repair version is present on ' + EXPECTED_MAPPED_ROW_KEYS
          + ' row keys but expected ' + EXPECTED_UNPROVEN_AFTER
          + ' target row keys to remain fail-closed; found ' + before.unproven.length,
        );
      }
      console.log(JSON.stringify({
        cfbIe2021ProofRepair: {
          repairVersion: REPAIR_VERSION,
          alreadyApplied: true,
          applied: false,
          repairedRowKeys: before.repairedRowKeys,
          remainingFailClosedRowKeys: before.unproven.length,
          globalEligibleRowKeys: before.globalEligibleRowKeys,
          contextOnly: true,
          mechanicallyActionable: false,
          modelWeight: 0,
          servingChanged: false,
        },
      }, null, 2));
      return;
    }

    if (before.repairedRowKeys !== 0) {
      throw new Error('Unexpected partial repair state: ' + before.repairedRowKeys + '/' + EXPECTED_MAPPED_ROW_KEYS);
    }
    if (before.unproven.length !== EXPECTED_UNPROVEN_BEFORE) {
      throw new Error(
        'Expected exactly ' + EXPECTED_UNPROVEN_BEFORE
        + ' current target timing-debt row keys before repair; found ' + before.unproven.length,
      );
    }

    for (const target of TARGETS) {
      const count = before.unproven.filter((row) => row.registration_number === target.registrationNumber).length;
      if (count !== target.expectedDebtRows) {
        throw new Error(
          'Target debt count drift for registration ' + target.registrationNumber
          + ': expected ' + target.expectedDebtRows + ', found ' + count,
        );
      }
    }

    const debtKeys = new Set(before.unproven.map((row) => row.row_key));
    const urls = await discoverCampaignFinanceDownloadUrls();
    const text = await fetchCampaignFinanceBulkText(urls.independentExpenditures);
    const bulkRows = parseCfbIndependentExpenditureCsv(text, { fromYear: 2021, toYear: 2022 })
      .filter((row) => debtKeys.has(row.rowKey));
    const bulkByRowKey = new Map(bulkRows.map((row) => [row.rowKey, row]));
    if (bulkByRowKey.size !== EXPECTED_UNPROVEN_BEFORE) {
      throw new Error(
        'Expected all ' + EXPECTED_UNPROVEN_BEFORE
        + ' target debt row keys in current official bulk data; found ' + bulkByRowKey.size,
      );
    }

    const mappings = new Map<string, Mapping>();
    const groups: Array<Record<string, unknown>> = [];

    for (const target of TARGETS) {
      const targetRows = before.unproven.filter(
        (row) => row.registration_number === target.registrationNumber,
      );
      const acquired = await acquireCfbPcfHistoricalReportProofs({
        registrationNumber: target.registrationNumber,
        segmentEndYear: SEGMENT_END_YEAR,
        maxReports: MAX_REPORTS_PER_GROUP,
      });

      if (acquired.failures.length !== 0) {
        throw new Error(
          'Repair refuses writes because registration ' + target.registrationNumber
          + ' had ' + acquired.failures.length + ' report proof acquisition failure(s)',
        );
      }

      const reports = acquired.reports.map((report) => ({
        proof: report.proof,
        text: report.text,
      }));
      let mapped = 0;

      for (const debtRow of targetRows) {
        const sourceRow = bulkByRowKey.get(debtRow.row_key);
        if (!sourceRow) {
          throw new Error('Missing target row from current official bulk data: ' + debtRow.row_key);
        }
        const match = firstProvenCfbFinanceAvailability({
          registrationNumber: target.registrationNumber,
          transactionDate: sourceRow.transactionDate,
          kind: 'expenditure',
          amount: sourceRow.amount,
          totalAmount: sourceRow.totalAmount,
          affectedCommitteeName: sourceRow.affectedCommitteeName,
          affectedCommitteeRegistrationNumber: sourceRow.affectedCommitteeRegistrationNumber,
        }, reports);
        if (!match) continue;

        const acquiredProof = acquired.reports.find((report) =>
          report.proof.textSha256 === match.proof.textSha256
          && report.proof.window.proofUrl === match.window.proofUrl);
        if (!acquiredProof) {
          throw new Error(
            'Mapped IE row lacked acquired report body provenance for '
            + target.registrationNumber + '/' + debtRow.row_key,
          );
        }

        mappings.set(debtRow.row_key, {
          rowKey: debtRow.row_key,
          registrationNumber: target.registrationNumber,
          availableOn: match.window.availableOn,
          filedOn: match.proof.filedOn,
          reportName: match.window.reportName,
          proofUrl: match.window.proofUrl,
          proofTextSha256: match.proof.textSha256,
          proofContentSha256: acquiredProof.contentSha256,
          proofFetchedAt: acquiredProof.fetchedAt,
          proofBytes: acquiredProof.bytes,
        });
        mapped += 1;
      }

      if (mapped !== target.expectedMappedRows) {
        throw new Error(
          'Exact mapping count drift for registration ' + target.registrationNumber
          + ': expected ' + target.expectedMappedRows + ', found ' + mapped,
        );
      }

      groups.push({
        registrationNumber: target.registrationNumber,
        label: target.label,
        timingDebtRows: targetRows.length,
        referencesDiscovered: acquired.referencesDiscovered,
        selectedReports: acquired.selectedReports,
        proofsParsed: acquired.reports.length,
        proofFailures: acquired.failures.length,
        exactMappedRowKeys: mapped,
        failClosedRowKeys: targetRows.length - mapped,
      });
    }

    const mappedRows = [...mappings.values()].sort((a, b) => a.rowKey.localeCompare(b.rowKey));
    if (mappedRows.length !== EXPECTED_MAPPED_ROW_KEYS) {
      throw new Error(
        'Expected exactly ' + EXPECTED_MAPPED_ROW_KEYS
        + ' exact mapped row keys; found ' + mappedRows.length,
      );
    }

    if (!apply) {
      console.log(JSON.stringify({
        cfbIe2021ProofRepair: {
          repairVersion: REPAIR_VERSION,
          alreadyApplied: false,
          applied: false,
          safeToApply: true,
          targetTimingDebtRowKeys: EXPECTED_UNPROVEN_BEFORE,
          exactMappedRowKeys: mappedRows.length,
          remainingFailClosedRowKeys: EXPECTED_UNPROVEN_BEFORE - mappedRows.length,
          globalEligibleRowKeysBefore: before.globalEligibleRowKeys,
          groups,
          contextOnly: true,
          mechanicallyActionable: false,
          modelWeight: 0,
          servingChanged: false,
        },
      }, null, 2));
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const locked = await state(client as unknown as { query: typeof pool.query });
      if (locked.repairedRowKeys !== 0 || locked.unproven.length !== EXPECTED_UNPROVEN_BEFORE) {
        throw new Error('Target IE proof-repair state changed between preflight and locked transaction');
      }

      const batchSize = 300;
      for (let offset = 0; offset < mappedRows.length; offset += batchSize) {
        const batch = mappedRows.slice(offset, offset + batchSize).map((mapping) => ({
          row_key: mapping.rowKey,
          available_on: mapping.availableOn,
          filed_on: mapping.filedOn,
          report_name: mapping.reportName,
          proof_url: mapping.proofUrl,
          proof_text_sha256: mapping.proofTextSha256,
          proof_content_sha256: mapping.proofContentSha256,
          proof_fetched_at: mapping.proofFetchedAt,
          proof_bytes: mapping.proofBytes,
          registration_number: mapping.registrationNumber,
        }));

        const updated = await client.query<{ rowKey: string }>(`
          WITH disclosure AS (
            SELECT *
            FROM jsonb_to_recordset($1::jsonb) AS d(
              row_key text,
              available_on date,
              filed_on date,
              report_name text,
              proof_url text,
              proof_text_sha256 text,
              proof_content_sha256 text,
              proof_fetched_at timestamptz,
              proof_bytes integer,
              registration_number text
            )
          )
          UPDATE evidence_items ei
             SET published_at=(disclosure.available_on::text || 'T12:00:00Z')::timestamptz,
                 metadata=ei.metadata || jsonb_strip_nulls(jsonb_build_object(
                   'asOfEligible', true,
                   'availabilityStatus', 'regulatory_disclosure_date_proven',
                   'availabilityPolicyVersion', $2::text,
                   'availableOn', disclosure.available_on::text,
                   'filedOn', disclosure.filed_on::text,
                   'reportName', disclosure.report_name,
                   'availabilityProofKind', 'cfb_report_filing',
                   'availabilityProofUrl', disclosure.proof_url,
                   'availabilityProofTextSha256', disclosure.proof_text_sha256,
                   'availabilityProofContentSha256', disclosure.proof_content_sha256,
                   'availabilityProofFetchedAt', disclosure.proof_fetched_at::text,
                   'availabilityProofBytes', disclosure.proof_bytes,
                   'availabilityRepairVersion', $3::text,
                   'availabilityRepairRegistrationNumber', disclosure.registration_number,
                   'disclosureDateIsAvailability', false,
                   'filingDateDerivedAvailability', true,
                   'transactionDateIsAvailability', false,
                   'contextOnly', true,
                   'mechanicallyActionable', false,
                   'modelWeight', 0
                 ))
            FROM source_documents sd, disclosure
           WHERE sd.id=ei.source_document_id
             AND sd.source_kind='campaign_finance_independent_expenditure_bulk'
             AND ei.metadata->>'rowKey'=disclosure.row_key
             AND (ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true' OR ei.published_at IS NULL)
          RETURNING ei.metadata->>'rowKey' AS "rowKey"
        `, [
          JSON.stringify(batch),
          CFB_REPORT_AVAILABILITY_VERSION,
          REPAIR_VERSION,
        ]);

        const updatedKeys = new Set(updated.rows.map((row) => row.rowKey));
        const expectedKeys = new Set(batch.map((row) => row.row_key));
        if (
          updatedKeys.size !== expectedKeys.size
          || [...expectedKeys].some((rowKey) => !updatedKeys.has(rowKey))
        ) {
          throw new Error(
            'Repair update did not touch every expected row key in batch: '
            + updatedKeys.size + '/' + expectedKeys.size,
          );
        }
      }

      const after = await state(client as unknown as { query: typeof pool.query });
      if (after.repairedRowKeys !== EXPECTED_MAPPED_ROW_KEYS) {
        throw new Error(
          'Post-apply repair-version verification failed: '
          + after.repairedRowKeys + '/' + EXPECTED_MAPPED_ROW_KEYS,
        );
      }
      if (after.unproven.length !== EXPECTED_UNPROVEN_AFTER) {
        throw new Error(
          'Post-apply fail-closed remainder mismatch: expected '
          + EXPECTED_UNPROVEN_AFTER + ', found ' + after.unproven.length,
        );
      }
      if (after.globalEligibleRowKeys !== before.globalEligibleRowKeys + EXPECTED_MAPPED_ROW_KEYS) {
        throw new Error(
          'Global eligible IE row-key count did not increase by exactly '
          + EXPECTED_MAPPED_ROW_KEYS,
        );
      }

      await client.query('COMMIT');

      console.log(JSON.stringify({
        cfbIe2021ProofRepair: {
          repairVersion: REPAIR_VERSION,
          alreadyApplied: false,
          applied: true,
          repairedRowKeys: after.repairedRowKeys,
          remainingFailClosedRowKeys: after.unproven.length,
          globalEligibleRowKeysBefore: before.globalEligibleRowKeys,
          globalEligibleRowKeysAfter: after.globalEligibleRowKeys,
          groups,
          contextOnly: true,
          mechanicallyActionable: false,
          modelWeight: 0,
          servingChanged: false,
        },
      }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
