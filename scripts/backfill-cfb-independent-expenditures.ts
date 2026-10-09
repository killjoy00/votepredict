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

function currentReportLimit(): number {
  const requested = Number.parseInt(process.env.VOTEPREDICT_CFB_IE_CURRENT_REPORTS ?? '', 10);
  if (!Number.isFinite(requested)) return 6;
  return Math.min(20, Math.max(1, requested));
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
  const { acquireCfbCurrentReportProofs } =
    await import('../src/evidence/cfb-current-report-acquisition.js');
  const { firstProvenCfbFinanceAvailability } =
    await import('../src/evidence/cfb-report-finance-mapper.js');

  try {
    const urls = await discoverCampaignFinanceDownloadUrls();
    const text = await fetchCampaignFinanceBulkText(urls.independentExpenditures);
    const rows = parseCfbIndependentExpenditureCsv(text, { fromYear: 2021, toYear: 2026 });
    if (!rows.length) throw new Error('CFB historical IE parser returned zero 2021-2026 rows');

    const currentRegistrationNumbers = [...new Set(rows
      .filter(row => row.year === 2026)
      .map(row => row.spenderRegistrationNumber)
      .filter((value): value is string => Boolean(value?.trim()))
      .map(value => value.trim()))];
    const currentReports = await acquireCfbCurrentReportProofs({
      kind: 'pcf-reports',
      maxReports: currentReportLimit(),
      registrationNumbers: currentRegistrationNumbers,
    });
    const currentReportTexts = new Map<string, Array<{
      proof: (typeof currentReports.reports)[number]['proof'];
      text: string;
    }>>();
    for (const report of currentReports.reports) {
      const registrationNumber = report.proof.reference.registrationNumber;
      const values = currentReportTexts.get(registrationNumber) ?? [];
      values.push({ proof: report.proof, text: report.text });
      currentReportTexts.set(registrationNumber, values);
    }

    const sourceHash = createHash('sha256').update(text).digest('hex');
    const rowContentSha256 = independentExpenditureContentSha256(rows);
    const fetchedAt = new Date().toISOString();

    type DisclosureMapping = {
      rowKey: string;
      availableOn: string;
      disclosedOn: string | null;
      filedOn: string | null;
      dueOn: string | null;
      reportName: string;
      proofKind: 'cfb_public_disclosure' | 'cfb_report_filing';
      proofUrl: string;
      source: 'bulk_direct' | 'current_report_pdf';
      proofTextSha256: string | null;
      proofContentSha256: string | null;
      proofFetchedAt: string | null;
      proofBytes: number | null;
    };

    const disclosureMappings: DisclosureMapping[] = [];
    for (const row of rows) {
      const registrationNumber = row.spenderRegistrationNumber;
      if (!registrationNumber) continue;

      if (row.disclosedOn) {
        const proof = buildCfbPublicDisclosureProof({
          registrationNumber,
          reportName: row.reportName ?? 'CFB public disclosure',
          disclosedOn: row.disclosedOn,
          proofUrl: urls.independentExpenditures,
        });
        disclosureMappings.push({
          rowKey: row.rowKey,
          availableOn: proof.availableOn,
          disclosedOn: proof.disclosedOn,
          filedOn: row.filedOn,
          dueOn: row.dueOn,
          reportName: proof.reportName,
          proofKind: proof.proofKind,
          proofUrl: proof.proofUrl,
          source: 'bulk_direct',
          proofTextSha256: null,
          proofContentSha256: null,
          proofFetchedAt: null,
          proofBytes: null,
        });
        continue;
      }

      if (row.filedOn && row.dueOn && row.reportName) {
        const proof = buildCfbReportDisclosureProof({
          registrationNumber,
          reportName: row.reportName,
          filedOn: row.filedOn,
          dueOn: row.dueOn,
          proofUrl: urls.independentExpenditures,
        });
        disclosureMappings.push({
          rowKey: row.rowKey,
          availableOn: proof.availableOn,
          disclosedOn: null,
          filedOn: proof.filedOn,
          dueOn: proof.dueOn ?? null,
          reportName: proof.reportName,
          proofKind: 'cfb_report_filing',
          proofUrl: proof.proofUrl,
          source: 'bulk_direct',
          proofTextSha256: null,
          proofContentSha256: null,
          proofFetchedAt: null,
          proofBytes: null,
        });
        continue;
      }

      if (row.year === 2026) {
        const reports = currentReportTexts.get(registrationNumber);
        if (reports?.length) {
          const match = firstProvenCfbFinanceAvailability({
            registrationNumber,
            transactionDate: row.transactionDate,
            kind: 'expenditure',
            amount: row.amount,
            totalAmount: row.totalAmount,
            affectedCommitteeName: row.affectedCommitteeName,
            affectedCommitteeRegistrationNumber: row.affectedCommitteeRegistrationNumber,
          }, reports);
          if (match) {
            const acquiredProof = currentReports.reports.find(report =>
              report.proof.textSha256 === match.proof.textSha256
              && report.proof.window.proofUrl === match.window.proofUrl);
            disclosureMappings.push({
              rowKey: row.rowKey,
              availableOn: match.window.availableOn,
              disclosedOn: null,
              filedOn: match.proof.filedOn,
              dueOn: match.proof.dueOn,
              reportName: match.window.reportName,
              proofKind: 'cfb_report_filing',
              proofUrl: match.window.proofUrl,
              source: 'current_report_pdf',
              proofTextSha256: match.proof.textSha256,
              proofContentSha256: acquiredProof?.contentSha256 ?? null,
              proofFetchedAt: acquiredProof?.fetchedAt ?? null,
              proofBytes: acquiredProof?.bytes ?? null,
            });
          }
        }
      }
    }
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
          modelWeight: 0,
          asOfEligible: false,
          availabilityStatus: disclosure
            ? 'pending_regulatory_disclosure_promotion'
            : 'awaiting_regulatory_disclosure_proof',
          transactionDateIsAvailability: false,
          disclosureDateIsAvailability: disclosure?.proofKind === 'cfb_public_disclosure',
          filingDateDerivedAvailability: false,
          dueDateAndFilingBoundApplied: disclosure?.proofKind === 'cfb_report_filing',
          reportDueOn: disclosure?.dueOn ?? row.dueOn,
          transactionDate: row.transactionDate,
          reportName: disclosure?.reportName ?? row.reportName,
          filedOn: disclosure?.filedOn ?? row.filedOn,
          disclosedOn: disclosure?.disclosedOn ?? row.disclosedOn,
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
            ? 'official_disclosure_or_due_date_bounded_availability_when_row_level_proven'
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
          due_on: mapping.dueOn,
          report_name: mapping.reportName,
          proof_kind: mapping.proofKind,
          proof_url: mapping.proofUrl,
          proof_text_sha256: mapping.proofTextSha256,
          proof_content_sha256: mapping.proofContentSha256,
          proof_fetched_at: mapping.proofFetchedAt,
          proof_bytes: mapping.proofBytes,
        }));
        const promoted = await pool.query<{ row_key: string }>(`
          WITH disclosure AS (
            SELECT *
              FROM jsonb_to_recordset($1::jsonb) AS d(
                row_key text,
                available_on date,
                disclosed_on date,
                filed_on date,
                due_on date,
                report_name text,
                proof_kind text,
                proof_url text,
                proof_text_sha256 text,
                proof_content_sha256 text,
                proof_fetched_at timestamptz,
                proof_bytes integer
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
                   'reportDueOn', disclosure.due_on::text,
                   'reportName', disclosure.report_name,
                   'availabilityProofKind', disclosure.proof_kind,
                   'availabilityProofUrl', disclosure.proof_url,
                   'availabilityProofTextSha256', disclosure.proof_text_sha256,
                   'availabilityProofContentSha256', disclosure.proof_content_sha256,
                   'availabilityProofFetchedAt', disclosure.proof_fetched_at::text,
                   'availabilityProofBytes', disclosure.proof_bytes,
                   'disclosureDateIsAvailability', disclosure.proof_kind = 'cfb_public_disclosure',
                   'filingDateDerivedAvailability', false,
                   'dueDateAndFilingBoundApplied', disclosure.proof_kind = 'cfb_report_filing',
                   'transactionDateIsAvailability', false,
                   'contextOnly', true,
                   'mechanicallyActionable', false,
                   'modelWeight', 0
                 ))
            FROM source_documents sd, disclosure
           WHERE sd.id = ei.source_document_id
             AND sd.source_kind = 'campaign_finance_independent_expenditure_bulk'
             AND ei.metadata->>'rowKey' = disclosure.row_key
             AND (
               ei.published_at IS DISTINCT FROM (disclosure.available_on::text || 'T12:00:00Z')::timestamptz
               OR ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true'
               OR ei.metadata->>'availableOn' IS DISTINCT FROM disclosure.available_on::text
               OR (
                 disclosure.proof_content_sha256 IS NOT NULL
                 AND ei.metadata->>'availabilityProofContentSha256'
                   IS DISTINCT FROM disclosure.proof_content_sha256
               )
               OR (
                 disclosure.proof_text_sha256 IS NOT NULL
                 AND ei.metadata->>'availabilityProofTextSha256'
                   IS DISTINCT FROM disclosure.proof_text_sha256
               )
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
        dueDateBoundedReportRows: disclosureMappings.filter(row => row.proofKind === 'cfb_report_filing').length,
        currentReportMappedRows: disclosureMappings.filter(row => row.source === 'current_report_pdf').length,
        currentReportAcquisition: {
          reportLimit: currentReportLimit(),
          entitiesDiscovered: currentReports.entitiesDiscovered,
          referencesDiscovered: currentReports.referencesDiscovered,
          eligibleReferences: currentReports.eligibleReferences,
          selectedReports: currentReports.selectedReports,
          proofsParsed: currentReports.reports.length,
          failures: currentReports.failures.length,
          failureExamples: currentReports.failures.slice(0, 6),
        },
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