import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_BATCH_SIZE = 100;
let secrets: string[] = [];

function mask(value: string) {
  if (value.length > 3) {
    console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
  }
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(item => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]');
}

function batchSize(): number {
  const requested = Number.parseInt(process.env.VOTEPREDICT_CFB_IE_BATCH_SIZE ?? '', 10);
  if (!Number.isFinite(requested)) return DEFAULT_BATCH_SIZE;
  return Math.min(500, Math.max(25, requested));
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

function freshness(date: string | null) {
  if (!date) return 'unknown' as const;
  const age = (Date.now() - new Date(date + 'T00:00:00Z').getTime()) / 86400000;
  return age <= 365 ? 'current' as const : age <= 1095 ? 'recent' as const : 'stale' as const;
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
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  const { persistDurableEvidence } = await import('../src/evidence/durable-ingestion.js');
  const {
    CFB_REPORT_AVAILABILITY_VERSION,
    buildCfbPublicDisclosureProof,
    buildCfbReportDisclosureProof,
  } = await import('../src/evidence/cfb-report-availability.js');
  const { discoverCampaignFinanceDownloadUrls, fetchCampaignFinanceBulkText } =
    await import('../src/evidence/campaign-finance-live.js');
  const {
    parseCfbIndependentExpenditureCsv,
    sessionForIndependentExpenditureYear,
    independentExpenditureContentSha256,
    CFB_INDEPENDENT_EXPENDITURE_HISTORY_VERSION,
  } = await import('../src/evidence/cfb-independent-expenditure-history.js');

  try {
    const urls = await discoverCampaignFinanceDownloadUrls();
    const text = await fetchCampaignFinanceBulkText(urls.independentExpenditures);
    const rows = parseCfbIndependentExpenditureCsv(text, { fromYear: 2021, toYear: 2026 });
    if (!rows.length) throw new Error('CFB historical IE parser returned zero 2021-2026 rows');

    const sourceHash = createHash('sha256').update(text).digest('hex');
    const rowContentSha256 = independentExpenditureContentSha256(rows);
    const fetchedAt = new Date().toISOString();

    type DisclosureMapping = {
      rowKey: string;
      availableOn: string;
      disclosedOn: string | null;
      filedOn: string | null;
      reportName: string;
      proofKind: 'cfb_public_disclosure' | 'cfb_report_filing';
      proofUrl: string;
    };

    const disclosureMappings: DisclosureMapping[] = rows.flatMap<DisclosureMapping>(row => {
      const registrationNumber = row.spenderRegistrationNumber;
      if (!registrationNumber) return [];

      if (row.disclosedOn) {
        const proof = buildCfbPublicDisclosureProof({
          registrationNumber,
          reportName: row.reportName ?? 'CFB public disclosure',
          disclosedOn: row.disclosedOn,
          proofUrl: urls.independentExpenditures,
        });
        return [{
          rowKey: row.rowKey,
          availableOn: proof.availableOn,
          disclosedOn: proof.disclosedOn,
          filedOn: row.filedOn,
          reportName: proof.reportName,
          proofKind: proof.proofKind,
          proofUrl: proof.proofUrl,
        }];
      }

      if (row.filedOn && row.reportName) {
        const proof = buildCfbReportDisclosureProof({
          registrationNumber,
          reportName: row.reportName,
          filedOn: row.filedOn,
          proofUrl: urls.independentExpenditures,
        });
        return [{
          rowKey: row.rowKey,
          availableOn: proof.availableOn,
          disclosedOn: null,
          filedOn: proof.filedOn,
          reportName: proof.reportName,
          proofKind: proof.proofKind,
          proofUrl: proof.proofUrl,
        }];
      }

      return [];
    });
    const disclosureByRowKey = new Map(disclosureMappings.map(mapping => [mapping.rowKey, mapping]));

    const drafts = rows.map(row => {
      const disclosure = disclosureByRowKey.get(row.rowKey);
      const session = sessionForIndependentExpenditureYear(row.year);
      return {
        target: row.candidateName && row.chamber && session ? {
          memberName: row.candidateName,
          sessionSlug: session,
          chamberSlug: row.chamber,
          occurredOn: row.transactionDate ?? undefined,
        } : undefined,
        kind: 'context' as const,
        stance: 'neutral' as const,
        claim: `Minnesota CFB reports ${row.direction === 'for' ? 'supporting' : row.direction === 'against' ? 'opposing' : 'independent'} expenditure of $${row.totalAmount.toFixed(2)} by ${row.spender} affecting ${row.affectedCommitteeName}.`,
        publishedAt: undefined,
        sourceQuality: 'official' as const,
        relevance: 'low' as const,
        freshness: freshness(row.transactionDate),
        extractionMethod: 'deterministic-cfb-independent-expenditure-row',
        extractionVersion: CFB_INDEPENDENT_EXPENDITURE_HISTORY_VERSION,
        confidence: 1,
        metadata: {
          contextType: 'campaign_finance',
          subtype: 'independent_expenditure_record',
          contextOnly: true,
          mechanicallyActionable: false,
          asOfEligible: false,
          availabilityStatus: disclosure
            ? 'pending_regulatory_disclosure_promotion'
            : 'awaiting_regulatory_disclosure_proof',
          transactionDateIsAvailability: false,
          disclosureDateIsAvailability: Boolean(disclosure),
          transactionDate: row.transactionDate,
          reportName: row.reportName,
          filedOn: row.filedOn,
          disclosedOn: row.disclosedOn,
          year: row.year,
          spender: row.spender,
          spenderRegistrationNumber: row.spenderRegistrationNumber,
          affectedCommitteeName: row.affectedCommitteeName,
          affectedCommitteeRegistrationNumber: row.affectedCommitteeRegistrationNumber,
          candidateName: row.candidateName,
          chamber: row.chamber,
          direction: row.direction,
          amount: row.amount,
          unpaidAmount: row.unpaidAmount,
          totalAmount: row.totalAmount,
          rowKey: row.rowKey,
          evidenceSeriesKey: `cfb_ie_row:${row.rowKey}`,
        },
      };
    });

    const size = batchSize();
    const totalBatches = Math.ceil(drafts.length / size);
    let inserted = 0;
    let reused = 0;
    let unresolved = 0;
    let sourceDocumentId: string | null = null;

    for (let offset = 0, batchNumber = 1; offset < drafts.length; offset += size, batchNumber += 1) {
      const batch = drafts.slice(offset, offset + size);
      const persisted = await persistDurableEvidence({
        sourceKind: 'campaign_finance_independent_expenditure_bulk',
        sourceUrl: urls.independentExpenditures,
        contentSha256: sourceHash,
        fetchedAt,
        metadata: {
          publisher: 'Minnesota Campaign Finance and Public Disclosure Board',
          dataset: 'independent_expenditures',
          years: [2021, 2022, 2023, 2024, 2025, 2026],
          rowCount: rows.length,
          rowContentSha256,
          historicalAvailability: disclosureMappings.length
            ? 'official_disclosure_date_when_row_level_proven'
            : 'pending_disclosure_proof',
          availabilityPolicyVersion: CFB_REPORT_AVAILABILITY_VERSION,
        },
      }, batch);

      sourceDocumentId ??= persisted.sourceDocumentId;
      inserted += persisted.inserted;
      reused += persisted.reused;
      unresolved += persisted.unresolvedTargets.length;

      console.log(JSON.stringify({
        cfbIndependentExpenditureProgress: {
          batch: batchNumber,
          totalBatches,
          batchRows: batch.length,
          processedRows: Math.min(offset + batch.length, drafts.length),
          totalRows: drafts.length,
          inserted,
          reused,
          unresolved,
        },
      }));
    }

    let promotedThisRun = 0;
    if (disclosureMappings.length > 0) {
      const promotionBatchSize = 500;
      for (let offset = 0; offset < disclosureMappings.length; offset += promotionBatchSize) {
        const batch = disclosureMappings.slice(offset, offset + promotionBatchSize).map(mapping => ({
          row_key: mapping.rowKey,
          available_on: mapping.availableOn,
          disclosed_on: mapping.disclosedOn,
          filed_on: mapping.filedOn,
          report_name: mapping.reportName,
          proof_kind: mapping.proofKind,
          proof_url: mapping.proofUrl,
        }));
        const promoted = await pool.query<{ row_key: string }>(`
          WITH disclosure AS (
            SELECT *
              FROM jsonb_to_recordset($1::jsonb) AS d(
                row_key text,
                available_on date,
                disclosed_on date,
                filed_on date,
                report_name text,
                proof_kind text,
                proof_url text
              )
          )
          UPDATE evidence_items ei
             SET published_at = (disclosure.available_on::text || 'T12:00:00Z')::timestamptz,
                 metadata = ei.metadata || jsonb_strip_nulls(jsonb_build_object(
                   'asOfEligible', true,
                   'availabilityStatus', 'regulatory_disclosure_date_proven',
                   'availabilityPolicyVersion', $2::text,
                   'availableOn', disclosure.available_on::text,
                   'disclosedOn', disclosure.disclosed_on::text,
                   'filedOn', disclosure.filed_on::text,
                   'reportName', disclosure.report_name,
                   'availabilityProofKind', disclosure.proof_kind,
                   'availabilityProofUrl', disclosure.proof_url,
                   'disclosureDateIsAvailability', true,
                   'transactionDateIsAvailability', false
                 ))
            FROM source_documents sd, disclosure
           WHERE sd.id = ei.source_document_id
             AND sd.source_kind = 'campaign_finance_independent_expenditure_bulk'
             AND ei.metadata->>'rowKey' = disclosure.row_key
             AND (
               ei.published_at IS DISTINCT FROM (disclosure.available_on::text || 'T12:00:00Z')::timestamptz
               OR ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true'
               OR ei.metadata->>'availableOn' IS DISTINCT FROM disclosure.available_on::text
             )
          RETURNING ei.metadata->>'rowKey' AS row_key
        `, [JSON.stringify(batch), CFB_REPORT_AVAILABILITY_VERSION]);
        promotedThisRun += promoted.rowCount ?? promoted.rows.length;
      }
    }

    const eligible = await pool.query<{ count: number }>(`
      SELECT count(DISTINCT ei.metadata->>'rowKey')::int AS count
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id = ei.source_document_id
       WHERE sd.source_kind = 'campaign_finance_independent_expenditure_bulk'
         AND ei.metadata->>'asOfEligible' = 'true'
         AND ei.published_at IS NOT NULL
         AND ei.metadata->>'transactionDateIsAvailability' = 'false'
    `);

    console.log(JSON.stringify({
      cfbIndependentExpenditureBackfill: {
        rows: rows.length,
        rowContentSha256,
        sourceSha256: sourceHash,
        batchSize: size,
        batches: totalBatches,
        inserted,
        reused,
        unresolved,
        sourceDocumentId,
        disclosureMappedRows: disclosureMappings.length,
        directDisclosureRows: disclosureMappings.filter(row => row.proofKind === 'cfb_public_disclosure').length,
        filingDerivedRows: disclosureMappings.filter(row => row.proofKind === 'cfb_report_filing').length,
        promotedThisRun,
        asOfEligibleRows: eligible.rows[0]?.count ?? 0,
        policy: {
          directOfficialDisclosureDateIsAvailability: true,
          exactFilingTimestampRequiredWhenDisclosureDateKnown: false,
          transactionDateIsAvailability: false,
          servingChanged: false,
          productionAction: 'none',
        },
      },
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});
