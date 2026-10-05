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

const TARGETS = [
  ['30037','SEIU Minn State Council Political Fund'],
  ['41243','Conservation Minnesota Voter Project'],
  ['41185','Right Now MN'],
  ['41192','ColorOfChange PAC'],
  ['41257','Unidos We Win PAC'],
  ['41281','Faith in Minnesota Action'],
  ['30204','AFSCME Working Families Fund'],
  ['30011','Minneapolis Regional Labor Federation'],
  ['20946','45th Senate District DFL'],
  ['20003','MN DFL State Central Committee'],
  ['41291','All of Mpls'],
  ['30025','MN AFL-CIO'],
] as const;

const SEGMENT_END_YEAR = 2022;
const MAX_REPORTS_PER_GROUP = 24;
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
  year: number;
  membership_resolved: boolean;
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
    cfbPcfSegmentEndYear,
  } = await import('../src/evidence/cfb-pcf-report-history.js');
  const { firstProvenCfbFinanceAvailability } =
    await import('../src/evidence/cfb-report-finance-mapper.js');

  try {
    const targetRegs = TARGETS.map(([registrationNumber]) => registrationNumber);

    const debt = (await pool.query<DebtRow>(`
      WITH row_identity AS (
        SELECT
          ei.metadata->>'rowKey' AS row_key,
          ei.metadata->>'spenderRegistrationNumber' AS registration_number,
          max((ei.metadata->>'year')::int) AS year,
          bool_or(ei.membership_id IS NOT NULL) AS membership_resolved,
          bool_or(ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL) AS eligible
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
          AND ei.metadata->>'subtype'='independent_expenditure_record'
          AND ei.metadata->>'rowKey' IS NOT NULL
          AND ei.metadata->>'spenderRegistrationNumber'=ANY($1::text[])
          AND ei.metadata->>'year' IN ('2021','2022')
        GROUP BY ei.metadata->>'rowKey',ei.metadata->>'spenderRegistrationNumber'
      )
      SELECT
        row_key,
        registration_number,
        year::int,
        membership_resolved
      FROM row_identity
      WHERE NOT eligible
      ORDER BY registration_number,row_key
    `, [targetRegs])).rows;

    if (debt.length !== 191) {
      throw new Error('Expected 191 current 2021-22 IE timing-debt row keys; found ' + debt.length);
    }

    const debtByKey = new Map(debt.map((row) => [row.row_key, row]));
    const debtByRegistration = new Map<string, DebtRow[]>();
    for (const row of debt) {
      const list = debtByRegistration.get(row.registration_number) ?? [];
      list.push(row);
      debtByRegistration.set(row.registration_number, list);
    }

    const urls = await discoverCampaignFinanceDownloadUrls();
    const text = await fetchCampaignFinanceBulkText(urls.independentExpenditures);
    const liveRows = parseCfbIndependentExpenditureCsv(text, { fromYear: 2021, toYear: 2022 });
    const liveByRowKey = new Map(liveRows.map((row) => [row.rowKey, row]));

    const groups: Array<Record<string, unknown>> = [];
    const exactMappings: Array<Record<string, unknown>> = [];
    let totalProofFailures = 0;

    for (const [registrationNumber, label] of TARGETS) {
      const targetDebt = debtByRegistration.get(registrationNumber) ?? [];
      const targetLiveRows = targetDebt
        .map((row) => liveByRowKey.get(row.row_key))
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .filter((row) => cfbPcfSegmentEndYear(row.year) === SEGMENT_END_YEAR);

      const missingFromCurrentBulk = targetDebt.length - targetLiveRows.length;
      let referencesDiscovered = 0;
      let selectedReports = 0;
      let proofsParsed = 0;
      let proofFailures = 0;
      let mappedRows = 0;

      try {
        const acquired = await acquireCfbPcfHistoricalReportProofs({
          registrationNumber,
          segmentEndYear: SEGMENT_END_YEAR,
          maxReports: MAX_REPORTS_PER_GROUP,
        });
        referencesDiscovered = acquired.referencesDiscovered;
        selectedReports = acquired.selectedReports;
        proofsParsed = acquired.reports.length;
        proofFailures = acquired.failures.length;
        totalProofFailures += proofFailures;

        const reports = acquired.reports.map((report) => ({
          proof: report.proof,
          text: report.text,
        }));

        for (const row of targetLiveRows) {
          const debtRow = debtByKey.get(row.rowKey);
          if (!debtRow) continue;

          const match = firstProvenCfbFinanceAvailability({
            registrationNumber,
            transactionDate: row.transactionDate,
            kind: 'expenditure',
            amount: row.amount,
            totalAmount: row.totalAmount,
            affectedCommitteeName: row.affectedCommitteeName,
            affectedCommitteeRegistrationNumber: row.affectedCommitteeRegistrationNumber,
          }, reports);
          if (!match) continue;

          const acquiredProof = acquired.reports.find((report) =>
            report.proof.textSha256 === match.proof.textSha256
            && report.proof.window.proofUrl === match.window.proofUrl);
          if (!acquiredProof) {
            throw new Error(
              'Exact mapping lacked acquired report-body provenance for '
              + registrationNumber + '/' + row.rowKey,
            );
          }

          mappedRows += 1;
          exactMappings.push({
            rowKey: row.rowKey,
            registrationNumber,
            label,
            year: row.year,
            membershipResolved: debtRow.membership_resolved,
            transactionDate: row.transactionDate,
            availableOn: match.window.availableOn,
            filedOn: match.proof.filedOn,
            reportName: match.window.reportName,
            proofUrl: match.window.proofUrl,
            proofTextSha256: match.proof.textSha256,
            proofContentSha256: acquiredProof.contentSha256,
            proofFetchedAt: acquiredProof.fetchedAt,
            proofBytes: acquiredProof.bytes,
          });
        }

        groups.push({
          registrationNumber,
          label,
          segmentEndYear: SEGMENT_END_YEAR,
          persistedTimingDebtRowKeys: targetDebt.length,
          membershipResolvedDebtRowKeys: targetDebt.filter((row) => row.membership_resolved).length,
          currentBulkRowsLocated: targetLiveRows.length,
          missingFromCurrentBulk,
          referencesDiscovered,
          selectedReports,
          proofsParsed,
          proofFailures,
          exactMappedPersistedDebtRowKeys: mappedRows,
          failClosedPersistedDebtRowKeys: targetDebt.length - mappedRows,
        });
      } catch (error) {
        groups.push({
          registrationNumber,
          label,
          segmentEndYear: SEGMENT_END_YEAR,
          persistedTimingDebtRowKeys: targetDebt.length,
          membershipResolvedDebtRowKeys: targetDebt.filter((row) => row.membership_resolved).length,
          currentBulkRowsLocated: targetLiveRows.length,
          missingFromCurrentBulk,
          referencesDiscovered,
          selectedReports,
          proofsParsed,
          proofFailures,
          exactMappedPersistedDebtRowKeys: 0,
          failClosedPersistedDebtRowKeys: targetDebt.length,
          targetFailure: safe(error),
        });
      }
    }

    const mappedKeySet = new Set(exactMappings.map((row) => String(row.rowKey)));
    if (mappedKeySet.size !== exactMappings.length) {
      throw new Error('Duplicate exact mapped IE row keys in read-only probe');
    }

    const output = {
      cfbIe2021UntouchedProofProbe: {
        schemaVersion: 'cfb-ie-2021-untouched-proof-probe-v1',
        segmentEndYear: SEGMENT_END_YEAR,
        targetRegistrations: TARGETS.map(([registrationNumber, label]) => ({
          registrationNumber,
          label,
        })),
        groups,
        exactMappings,
        totals: {
          targetGroups: TARGETS.length,
          persistedTimingDebtRowKeys: debt.length,
          membershipResolvedDebtRowKeys: debt.filter((row) => row.membership_resolved).length,
          currentBulkRowsLocated: groups.reduce((sum, row) => sum + Number(row.currentBulkRowsLocated ?? 0), 0),
          referencesDiscovered: groups.reduce((sum, row) => sum + Number(row.referencesDiscovered ?? 0), 0),
          selectedReports: groups.reduce((sum, row) => sum + Number(row.selectedReports ?? 0), 0),
          proofsParsed: groups.reduce((sum, row) => sum + Number(row.proofsParsed ?? 0), 0),
          proofFailures: totalProofFailures,
          exactMappedPersistedDebtRowKeys: exactMappings.length,
          exactMappedMembershipResolvedDebtRowKeys: exactMappings.filter(
            (row) => row.membershipResolved === true,
          ).length,
          failClosedPersistedDebtRowKeys: debt.length - exactMappings.length,
        },
        policy: {
          readOnly: true,
          officialCfbOnly: true,
          exactPersistedDebtRowKeyRequired: true,
          exactReportRowContainmentRequired: true,
          reportBodyProvenanceRequired: true,
          transactionDateIsAvailability: false,
          reportingPeriodOrDueDateIsAvailability: false,
          filingDerivedAvailabilityUsesExistingConservativePolicy: true,
          sameDayReplayExcluded: true,
          evidenceWrites: false,
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
