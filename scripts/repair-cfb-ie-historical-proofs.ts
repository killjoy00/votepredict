import { readFileSync } from 'node:fs';
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
const MAX_REPORTS_PER_GROUP = 24;
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
  for (const value of secrets.filter(item => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 2200);
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
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
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
    cfbPcfSegmentEndYear,
  } = await import('../src/evidence/cfb-pcf-report-history.js');
  const { firstProvenCfbFinanceAvailability } =
    await import('../src/evidence/cfb-report-finance-mapper.js');

  try {
    const urls = await discoverCampaignFinanceDownloadUrls();
    const text = await fetchCampaignFinanceBulkText(urls.independentExpenditures);
    const rows = parseCfbIndependentExpenditureCsv(text, { fromYear: 2021, toYear: 2026 });

    type Mapping = {
      rowKey: string;
      availableOn: string;
      filedOn: string;
      reportName: string;
      proofUrl: string;
      proofTextSha256: string;
      proofContentSha256: string;
      proofFetchedAt: string;
      proofBytes: number;
    };

    const mappings = new Map<string, Mapping>();
    const groups: Array<Record<string, unknown>> = [];
    let proofFailures = 0;

    for (const registrationNumber of CFB_IE_HISTORICAL_PROOF_TARGET_REGISTRATIONS) {
      const targetRows = rows.filter(
        row => row.spenderRegistrationNumber?.trim() === registrationNumber,
      );
      const segmentYears = [...new Set(
        targetRows
          .map(row => cfbPcfSegmentEndYear(row.year))
          .filter((value): value is 2022 | 2024 | 2026 => value !== null),
      )].sort((a, b) => a - b);

      for (const segmentEndYear of segmentYears) {
        const segmentRows = targetRows.filter(
          row => cfbPcfSegmentEndYear(row.year) === segmentEndYear,
        );
        const acquired = await acquireCfbPcfHistoricalReportProofs({
          registrationNumber,
          segmentEndYear,
          maxReports: MAX_REPORTS_PER_GROUP,
        });
        proofFailures += acquired.failures.length;

        const reports = acquired.reports.map(report => ({
          proof: report.proof,
          text: report.text,
        }));
        let matched = 0;

        for (const row of segmentRows) {
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

          const acquiredProof = acquired.reports.find(report =>
            report.proof.textSha256 === match.proof.textSha256
            && report.proof.window.proofUrl === match.window.proofUrl);
          if (!acquiredProof) {
            throw new Error(
              'Mapped IE row lacked acquired report body provenance for '
              + registrationNumber + '/' + segmentEndYear,
            );
          }
          if (
            acquiredProof.bytes <= 0
            || !/^[a-f0-9]{64}$/i.test(acquiredProof.contentSha256)
          ) {
            throw new Error(
              'Mapped IE row had invalid report body provenance for '
              + registrationNumber + '/' + segmentEndYear,
            );
          }

          mappings.set(row.rowKey, {
            rowKey: row.rowKey,
            availableOn: match.window.availableOn,
            filedOn: match.proof.filedOn,
            reportName: match.window.reportName,
            proofUrl: match.window.proofUrl,
            proofTextSha256: match.proof.textSha256,
            proofContentSha256: acquiredProof.contentSha256,
            proofFetchedAt: acquiredProof.fetchedAt,
            proofBytes: acquiredProof.bytes,
          });
          matched += 1;
        }

        groups.push({
          registrationNumber,
          segmentEndYear,
          sourceRows: segmentRows.length,
          referencesDiscovered: acquired.referencesDiscovered,
          selectedReports: acquired.selectedReports,
          proofsParsed: acquired.reports.length,
          proofFailures: acquired.failures.length,
          rowsMatched: matched,
          rowsFailClosed: segmentRows.length - matched,
        });
      }
    }

    if (proofFailures !== 0) {
      throw new Error(
        'Historical IE repair aborted before writes because report proof acquisition had '
        + proofFailures + ' failure(s)',
      );
    }

    const mappedRows = [...mappings.values()];
    if (!mappedRows.length) throw new Error('Historical IE repair produced zero exact row mappings');

    const mappedJson = JSON.stringify(mappedRows.map(row => ({ row_key: row.rowKey })));
    const coverageBeforeSql = [
      'WITH mapped AS (',
      '  SELECT DISTINCT row_key',
      '    FROM jsonb_to_recordset($1::jsonb) AS d(row_key text)',
      ')',
      'SELECT',
      '  (SELECT count(*)::int FROM mapped) AS "mappedRows",',
      "  count(DISTINCT CASE WHEN sd.source_kind='campaign_finance_independent_expenditure_bulk' THEN mapped.row_key END)::int AS \"persistedMappedRows\",",
      "  count(DISTINCT CASE WHEN sd.source_kind='campaign_finance_independent_expenditure_bulk' AND ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL THEN mapped.row_key END)::int AS \"eligibleMappedRows\",",
      "  count(CASE WHEN sd.source_kind='campaign_finance_independent_expenditure_bulk' AND (ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true' OR ei.published_at IS NULL) THEN 1 END)::int AS \"ineligibleMappedItemRows\"",
      'FROM mapped',
      "LEFT JOIN evidence_items ei ON ei.metadata->>'rowKey'=mapped.row_key",
      'LEFT JOIN source_documents sd ON sd.id=ei.source_document_id',
    ].join('\n');

    const coverageBefore = await pool.query<{
      mappedRows: number;
      persistedMappedRows: number;
      eligibleMappedRows: number;
      ineligibleMappedItemRows: number;
    }>(coverageBeforeSql, [mappedJson]);

    const before = coverageBefore.rows[0];
    if (!before) {
      throw new Error('Historical IE repair could not measure persisted exact mapped row keys');
    }
    if (before.persistedMappedRows <= 0) {
      throw new Error(
        'Historical IE repair aborted before writes because zero exact mapped row keys are persisted',
      );
    }
    const unpersistedMappedRowKeys = mappedRows.length - before.persistedMappedRows;

    const globalEligibleSql = [
      "SELECT count(DISTINCT ei.metadata->>'rowKey')::int AS count",
      '  FROM evidence_items ei',
      '  JOIN source_documents sd ON sd.id=ei.source_document_id',
      " WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'",
      "   AND ei.metadata->>'asOfEligible'='true'",
      '   AND ei.published_at IS NOT NULL',
      "   AND ei.metadata->>'transactionDateIsAvailability'='false'",
    ].join('\n');

    const globalEligibleBefore = await pool.query<{ count: number }>(globalEligibleSql);

    const promotedItemRowKeys = new Set<string>();
    const promotionBatchSize = 500;
    const promoteSql = [
      'WITH disclosure AS (',
      '  SELECT *',
      '    FROM jsonb_to_recordset($1::jsonb) AS d(',
      '      row_key text,',
      '      available_on date,',
      '      filed_on date,',
      '      report_name text,',
      '      proof_url text,',
      '      proof_text_sha256 text,',
      '      proof_content_sha256 text,',
      '      proof_fetched_at timestamptz,',
      '      proof_bytes integer',
      '    )',
      ')',
      'UPDATE evidence_items ei',
      "   SET published_at=(disclosure.available_on::text || 'T12:00:00Z')::timestamptz,",
      "       metadata=ei.metadata || jsonb_strip_nulls(jsonb_build_object(",
      "         'asOfEligible', true,",
      "         'availabilityStatus', 'regulatory_disclosure_date_proven',",
      "         'availabilityPolicyVersion', $2::text,",
      "         'availableOn', disclosure.available_on::text,",
      "         'filedOn', disclosure.filed_on::text,",
      "         'reportName', disclosure.report_name,",
      "         'availabilityProofKind', 'cfb_report_filing',",
      "         'availabilityProofUrl', disclosure.proof_url,",
      "         'availabilityProofTextSha256', disclosure.proof_text_sha256,",
      "         'availabilityProofContentSha256', disclosure.proof_content_sha256,",
      "         'availabilityProofFetchedAt', disclosure.proof_fetched_at::text,",
      "         'availabilityProofBytes', disclosure.proof_bytes,",
      "         'disclosureDateIsAvailability', false,",
      "         'filingDateDerivedAvailability', true,",
      "         'transactionDateIsAvailability', false,",
      "         'contextOnly', true,",
      "         'mechanicallyActionable', false,",
      "         'modelWeight', 0",
      '       ))',
      '  FROM source_documents sd, disclosure',
      ' WHERE sd.id=ei.source_document_id',
      "   AND sd.source_kind='campaign_finance_independent_expenditure_bulk'",
      "   AND ei.metadata->>'rowKey'=disclosure.row_key",
      "   AND (ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true' OR ei.published_at IS NULL)",
      "RETURNING ei.metadata->>'rowKey' AS \"rowKey\"",
    ].join('\n');

    for (let offset = 0; offset < mappedRows.length; offset += promotionBatchSize) {
      const batch = mappedRows.slice(offset, offset + promotionBatchSize).map(mapping => ({
        row_key: mapping.rowKey,
        available_on: mapping.availableOn,
        filed_on: mapping.filedOn,
        report_name: mapping.reportName,
        proof_url: mapping.proofUrl,
        proof_text_sha256: mapping.proofTextSha256,
        proof_content_sha256: mapping.proofContentSha256,
        proof_fetched_at: mapping.proofFetchedAt,
        proof_bytes: mapping.proofBytes,
      }));
      const promoted = await pool.query<{ rowKey: string }>(
        promoteSql,
        [JSON.stringify(batch), CFB_REPORT_AVAILABILITY_VERSION],
      );
      for (const row of promoted.rows) promotedItemRowKeys.add(row.rowKey);
    }

    const coverageAfterSql = [
      'WITH mapped AS (',
      '  SELECT DISTINCT row_key',
      '    FROM jsonb_to_recordset($1::jsonb) AS d(row_key text)',
      ')',
      'SELECT',
      "  count(DISTINCT CASE WHEN sd.source_kind='campaign_finance_independent_expenditure_bulk' AND ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL THEN mapped.row_key END)::int AS \"eligibleMappedRows\",",
      "  count(CASE WHEN sd.source_kind='campaign_finance_independent_expenditure_bulk' AND (ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true' OR ei.published_at IS NULL) THEN 1 END)::int AS \"ineligibleMappedItemRows\"",
      'FROM mapped',
      "LEFT JOIN evidence_items ei ON ei.metadata->>'rowKey'=mapped.row_key",
      'LEFT JOIN source_documents sd ON sd.id=ei.source_document_id',
    ].join('\n');

    const coverageAfter = await pool.query<{
      eligibleMappedRows: number;
      ineligibleMappedItemRows: number;
    }>(coverageAfterSql, [mappedJson]);
    const globalEligibleAfter = await pool.query<{ count: number }>(globalEligibleSql);

    console.log(JSON.stringify({
      cfbIeHistoricalProofRepair: {
        targetRegistrations: CFB_IE_HISTORICAL_PROOF_TARGET_REGISTRATIONS,
        groups,
        totals: {
          sourceRows: groups.reduce((sum, row) => sum + Number(row.sourceRows ?? 0), 0),
          exactMappedRowKeys: mappedRows.length,
          failClosedRows: groups.reduce((sum, row) => sum + Number(row.rowsFailClosed ?? 0), 0),
          proofFailures,
          persistedMappedRowKeys: before.persistedMappedRows,
          unpersistedMappedRowKeys,
          eligibleMappedRowKeysBefore: before.eligibleMappedRows,
          ineligibleMappedItemRowsBefore: before.ineligibleMappedItemRows,
          promotedDistinctRowKeysThisRun: promotedItemRowKeys.size,
          eligibleMappedRowKeysAfter: coverageAfter.rows[0]?.eligibleMappedRows ?? 0,
          ineligibleMappedItemRowsAfter: coverageAfter.rows[0]?.ineligibleMappedItemRows ?? 0,
          globalEligibleRowKeysBefore: globalEligibleBefore.rows[0]?.count ?? 0,
          globalEligibleRowKeysAfter: globalEligibleAfter.rows[0]?.count ?? 0,
        },
        policy: {
          officialCfbOnly: true,
          historicalAvailabilityRequiresOfficialReportProof: true,
          reportMustDemonstrateExactRow: true,
          transactionDateIsAvailability: false,
          sameDayReplayExcluded: true,
          unpersistedMappedRowsRemainFailClosed: true,
          alreadyEligibleRowsOverwritten: false,
          contextOnly: true,
          mechanicallyActionable: false,
          modelWeight: 0,
          servingChanged: false,
          productionAction: 'persisted_proof_promotion_only',
        },
      },
    }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});
