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
const SEGMENT_END_YEAR = 2022;
const MAX_REPORTS_PER_GROUP = 24;
const TARGETS = [
  { registrationNumber: '30037', label: 'SEIU Minn State Council Political Fund', expectedDebtRows: 42 },
  { registrationNumber: '41243', label: 'Conservation Minnesota Voter Project', expectedDebtRows: 36 },
  { registrationNumber: '41185', label: 'Right Now MN', expectedDebtRows: 34 },
  { registrationNumber: '41192', label: 'ColorOfChange PAC', expectedDebtRows: 26 },
  { registrationNumber: '41257', label: 'Unidos We Win PAC', expectedDebtRows: 23 },
  { registrationNumber: '41281', label: 'Faith in Minnesota Action', expectedDebtRows: 13 },
  { registrationNumber: '30204', label: 'AFSCME Working Families Fund', expectedDebtRows: 7 },
  { registrationNumber: '30011', label: 'Minneapolis Regional Labor Federation', expectedDebtRows: 3 },
  { registrationNumber: '20946', label: '45th Senate District DFL', expectedDebtRows: 2 },
  { registrationNumber: '20003', label: 'MN DFL State Central Committee', expectedDebtRows: 2 },
  { registrationNumber: '41291', label: 'All of Mpls', expectedDebtRows: 2 },
  { registrationNumber: '30025', label: 'MN AFL-CIO', expectedDebtRows: 1 },
] as const;
const EXPECTED_TOTAL_DEBT_ROWS = TARGETS.reduce((sum, target) => sum + target.expectedDebtRows, 0);
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
  spender: string | null;
  transaction_date: string | null;
  amount: string | number | null;
  total_amount: string | number | null;
  affected_committee_name: string | null;
  affected_committee_registration_number: string | null;
};

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

  try {
    const targetRegistrations = TARGETS.map((target) => target.registrationNumber);
    const debt = (await pool.query<DebtRow>(`
      WITH debt AS (
        SELECT DISTINCT ON (ei.metadata->>'rowKey')
          ei.metadata->>'rowKey' AS row_key,
          ei.metadata->>'spenderRegistrationNumber' AS registration_number,
          ei.metadata->>'spender' AS spender,
          ei.metadata->>'transactionDate' AS transaction_date,
          ei.metadata->>'amount' AS amount,
          ei.metadata->>'totalAmount' AS total_amount,
          ei.metadata->>'affectedCommitteeName' AS affected_committee_name,
          ei.metadata->>'affectedCommitteeRegistrationNumber' AS affected_committee_registration_number
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
        ORDER BY ei.metadata->>'rowKey',ei.id
      )
      SELECT * FROM debt
      ORDER BY registration_number,row_key
    `, [targetRegistrations])).rows;

    if (debt.length !== EXPECTED_TOTAL_DEBT_ROWS) {
      throw new Error(
        'Expected exactly ' + EXPECTED_TOTAL_DEBT_ROWS
        + ' current 2021-22 timing-debt row keys in the bounded cohort; found ' + debt.length,
      );
    }

    for (const target of TARGETS) {
      const count = debt.filter((row) => row.registration_number === target.registrationNumber).length;
      if (count !== target.expectedDebtRows) {
        throw new Error(
          'Debt count drift for registration ' + target.registrationNumber
          + ': expected ' + target.expectedDebtRows + ', found ' + count,
        );
      }
    }

    const urls = await discoverCampaignFinanceDownloadUrls();
    const text = await fetchCampaignFinanceBulkText(urls.independentExpenditures);
    const bulkRows = parseCfbIndependentExpenditureCsv(text, { fromYear: 2021, toYear: 2022 });
    const bulkByRowKey = new Map(bulkRows.map((row) => [row.rowKey, row]));

    const results: Array<Record<string, unknown>> = [];
    let referencesDiscovered = 0;
    let selectedReports = 0;
    let proofsParsed = 0;
    let proofFailures = 0;
    let sourceRowsLocated = 0;
    let exactMappedRowKeys = 0;

    for (const target of TARGETS) {
      const targetDebt = debt.filter((row) => row.registration_number === target.registrationNumber);
      const missingFromBulk = targetDebt
        .filter((row) => !bulkByRowKey.has(row.row_key))
        .map((row) => row.row_key);

      sourceRowsLocated += targetDebt.length - missingFromBulk.length;

      const acquired = await acquireCfbPcfHistoricalReportProofs({
        registrationNumber: target.registrationNumber,
        segmentEndYear: SEGMENT_END_YEAR,
        maxReports: MAX_REPORTS_PER_GROUP,
      });

      referencesDiscovered += acquired.referencesDiscovered;
      selectedReports += acquired.selectedReports;
      proofsParsed += acquired.reports.length;
      proofFailures += acquired.failures.length;

      const reports = acquired.reports.map((report) => ({
        proof: report.proof,
        text: report.text,
      }));
      const mappings: Array<Record<string, unknown>> = [];

      for (const debtRow of targetDebt) {
        const sourceRow = bulkByRowKey.get(debtRow.row_key);
        if (!sourceRow) continue;

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
            'Mapped IE row lacked acquired report-body provenance for '
            + target.registrationNumber + '/' + debtRow.row_key,
          );
        }

        mappings.push({
          rowKey: debtRow.row_key,
          availableOn: match.window.availableOn,
          filedOn: match.proof.filedOn,
          reportName: match.window.reportName,
          proofUrl: match.window.proofUrl,
          proofTextSha256: match.proof.textSha256,
          proofContentSha256: acquiredProof.contentSha256,
          proofFetchedAt: acquiredProof.fetchedAt,
          proofBytes: acquiredProof.bytes,
          transactionDate: sourceRow.transactionDate,
          transactionDateIsAvailability: false,
        });
      }

      exactMappedRowKeys += mappings.length;
      results.push({
        registrationNumber: target.registrationNumber,
        label: target.label,
        segmentEndYear: SEGMENT_END_YEAR,
        persistedTimingDebtRows: targetDebt.length,
        sourceRowsLocated: targetDebt.length - missingFromBulk.length,
        missingFromCurrentBulkRows: missingFromBulk,
        referencesDiscovered: acquired.referencesDiscovered,
        selectedReports: acquired.selectedReports,
        proofsParsed: acquired.reports.length,
        proofFailures: acquired.failures.length,
        proofFailureSamples: acquired.failures.slice(0, 5),
        exactMappedRowKeys: mappings.length,
        failClosedRowKeys: targetDebt.length - mappings.length,
        mappings,
      });
    }

    const output = {
      cfbIe2021NewProofProbe: {
        schemaVersion: 'cfb-ie-2021-new-proof-probe-v1',
        segmentEndYear: SEGMENT_END_YEAR,
        targets: results,
        totals: {
          targetGroups: TARGETS.length,
          persistedTimingDebtRowKeys: debt.length,
          sourceRowsLocated,
          referencesDiscovered,
          selectedReports,
          proofsParsed,
          proofFailures,
          exactMappedRowKeys,
          failClosedRowKeys: debt.length - exactMappedRowKeys,
        },
        policy: {
          readOnly: true,
          officialCfbOnly: true,
          exactReportBodyProofRequired: true,
          exactRowContainmentRequired: true,
          transactionDateIsAvailability: false,
          reportPeriodOrDueDateIsAvailability: false,
          archiveOrReportProofIsConservativeUpperBound: true,
          sameDayEligible: false,
          noEvidenceWrites: true,
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
