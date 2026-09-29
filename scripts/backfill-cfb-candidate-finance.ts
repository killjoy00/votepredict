import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
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
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1800);
}

function batchSize(): number {
  const requested = Number.parseInt(process.env.VOTEPREDICT_CFB_CANDIDATE_FINANCE_BATCH_SIZE ?? '', 10);
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
  const {
    cfbCandidateFinanceTargetBatchNames,
    resolveCfbCandidateFinanceTargetBatch,
  } = await import('../src/evidence/cfb-candidate-finance-target-batches.js');
  const {
    cfbCandidateFinanceTargetKey,
    isCfbCandidateFinanceMembershipTailRequest,
    selectCfbCandidateFinanceMembershipTail,
  } = await import('../src/evidence/cfb-candidate-finance-membership-tail.js');
  const targetRequest = process.env.VOTEPREDICT_CFB_CANDIDATE_FINANCE_BATCH_REQUEST ?? '';
  const membershipTailMode = isCfbCandidateFinanceMembershipTailRequest(targetRequest);
  const staticTargetBatch = membershipTailMode
    ? null
    : resolveCfbCandidateFinanceTargetBatch(targetRequest);
  let targetBatchName = staticTargetBatch?.name ?? 'membership-tail';
  let TARGETS: readonly { registrationNumber: string; segmentEndYear: number }[] =
    staticTargetBatch?.targets ?? [];
  let tailSelection: Record<string, unknown> | null = null;

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
  const { CFB_REPORT_AVAILABILITY_VERSION } = await import('../src/evidence/cfb-report-availability.js');
  const { discoverCampaignFinanceDownloadUrls, fetchCampaignFinanceBulkText } =
    await import('../src/evidence/campaign-finance-live.js');
  const {
    parseCfbCandidateContributionCsv,
    parseCfbCandidateExpenditureCsv,
    sessionForCandidateFinanceYear,
    candidateFinanceContentSha256,
    CFB_CANDIDATE_FINANCE_HISTORY_VERSION,
  } = await import('../src/evidence/cfb-candidate-finance-history.js');
  const { acquireCfbCandidateHistoricalReportProofs, cfbCandidateSegmentEndYear } =
    await import('../src/evidence/cfb-candidate-report-history.js');
  const { firstProvenCfbFinanceAvailability } =
    await import('../src/evidence/cfb-report-finance-mapper.js');
  const { resolveCandidateFinanceMembership } =
    await import('../src/evidence/cfb-candidate-membership-resolution.js');

  try {
    const urls = await discoverCampaignFinanceDownloadUrls();
    const [contributionText, expenditureText] = await Promise.all([
      fetchCampaignFinanceBulkText(urls.contributions),
      fetchCampaignFinanceBulkText(urls.expenditures),
    ]);
    const allRows = [
      ...parseCfbCandidateContributionCsv(contributionText, { fromYear: 2021, toYear: 2026 }),
      ...parseCfbCandidateExpenditureCsv(expenditureText, { fromYear: 2021, toYear: 2026 }),
    ].filter(row => Boolean(row.candidateName && row.chamber && row.filerRegistrationNumber));

    if (membershipTailMode) {
      type SelectionMembershipCandidate = {
        membershipId: string;
        memberName: string;
        sessionSlug: string;
        chamberSlug: string;
        membershipStartsOn: string | null;
        membershipEndsOn: string | null;
        sessionStartsOn: string | null;
        sessionEndsOn: string | null;
      };
      const selectionMembershipRows = await pool.query<SelectionMembershipCandidate>(`
        SELECT m.id::text AS "membershipId",
               l.name AS "memberName",
               s.slug AS "sessionSlug",
               c.slug AS "chamberSlug",
               m.starts_on::text AS "membershipStartsOn",
               m.ends_on::text AS "membershipEndsOn",
               s.starts_on::text AS "sessionStartsOn",
               s.ends_on::text AS "sessionEndsOn"
          FROM memberships m
          JOIN legislators l ON l.id=m.legislator_id
          JOIN legislative_sessions s ON s.id=m.session_id
          JOIN chambers c ON c.id=m.chamber_id
         WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
           AND c.slug IN ('house','senate')
      `);
      const persisted = await pool.query<{ rowKey: string }>(`
        SELECT DISTINCT ei.metadata->>'rowKey' AS "rowKey"
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
         WHERE sd.source_kind IN (
           'campaign_finance_candidate_contribution_bulk',
           'campaign_finance_candidate_expenditure_bulk'
         )
           AND ei.metadata->>'rowKey' IS NOT NULL
      `);
      const persistedRowKeys = new Set(persisted.rows.map(row => row.rowKey));

      type TailGroupInternal = {
        registrationNumber: string;
        segmentEndYear: number;
        candidateName: string;
        chamber: string;
        totalRows: number;
        resolvedRows: number;
        rowKeys: string[];
        resolvableRowKeys: string[];
      };
      const groups = new Map<string, TailGroupInternal>();
      for (const row of allRows) {
        const registrationNumber = row.filerRegistrationNumber;
        const segmentEndYear = cfbCandidateSegmentEndYear(row.year);
        if (!registrationNumber || segmentEndYear === null || !row.candidateName || !row.chamber) continue;
        const key = registrationNumber + ':' + segmentEndYear;
        let group = groups.get(key);
        if (!group) {
          group = {
            registrationNumber,
            segmentEndYear,
            candidateName: row.candidateName,
            chamber: row.chamber,
            totalRows: 0,
            resolvedRows: 0,
            rowKeys: [],
            resolvableRowKeys: [],
          };
          groups.set(key, group);
        }
        group.totalRows += 1;
        group.rowKeys.push(row.rowKey);
        const session = sessionForCandidateFinanceYear(row.year);
        if (!session || !row.transactionDate) continue;
        const candidates = selectionMembershipRows.rows.filter(candidate =>
          candidate.sessionSlug === session
          && candidate.chamberSlug === row.chamber
          && (!candidate.membershipStartsOn || candidate.membershipStartsOn <= row.transactionDate!)
          && (!candidate.membershipEndsOn || candidate.membershipEndsOn >= row.transactionDate!)
          && (!candidate.sessionStartsOn || candidate.sessionStartsOn <= row.transactionDate!)
          && (!candidate.sessionEndsOn || candidate.sessionEndsOn >= row.transactionDate!)
        );
        if (resolveCandidateFinanceMembership(row.candidateName, candidates)) {
          group.resolvedRows += 1;
          group.resolvableRowKeys.push(row.rowKey);
        }
      }

      const fullyPersistedKeys = new Set<string>();
      for (const group of groups.values()) {
        if (
          group.resolvableRowKeys.length > 0
          && group.resolvableRowKeys.every(rowKey => persistedRowKeys.has(rowKey))
        ) {
          fullyPersistedKeys.add(cfbCandidateFinanceTargetKey(group));
        }
      }
      const reviewedKeys = new Set<string>();
      for (const name of cfbCandidateFinanceTargetBatchNames()) {
        for (const target of resolveCfbCandidateFinanceTargetBatch('batch=' + name).targets) {
          reviewedKeys.add(cfbCandidateFinanceTargetKey(target));
        }
      }
      for (const key of reviewedKeys) {
        const group = groups.get(key);
        if (
          group?.resolvableRowKeys.length
          && group.resolvableRowKeys.every(rowKey => persistedRowKeys.has(rowKey))
        ) {
          fullyPersistedKeys.add(key);
        }
      }

      const targetableGroups = [...groups.values()].filter(group => group.resolvedRows > 0);
      const remainingBefore = targetableGroups.filter(group =>
        !fullyPersistedKeys.has(cfbCandidateFinanceTargetKey(group))).length;
      const requestedTailGroups = Number.parseInt(
        process.env.VOTEPREDICT_CFB_CANDIDATE_FINANCE_TAIL_GROUPS ?? '',
        10,
      );
      const tailGroupLimit = Number.isFinite(requestedTailGroups)
        ? Math.min(32, Math.max(1, requestedTailGroups))
        : 24;
      const selectedGroups = selectCfbCandidateFinanceMembershipTail(
        targetableGroups,
        fullyPersistedKeys,
        tailGroupLimit,
      );
      TARGETS = selectedGroups.map(group => ({
        registrationNumber: group.registrationNumber,
        segmentEndYear: group.segmentEndYear,
      }));
      const remainingAfter = Math.max(0, remainingBefore - selectedGroups.length);
      tailSelection = {
        tailGroupLimit,
        membershipRowsLoaded: selectionMembershipRows.rows.length,
        persistedRowKeys: persistedRowKeys.size,
        targetableGroups: targetableGroups.length,
        fullyPersistedGroups: targetableGroups.length - remainingBefore,
        remainingBefore,
        selectedGroups: selectedGroups.map(group => ({
          registrationNumber: group.registrationNumber,
          segmentEndYear: group.segmentEndYear,
          candidateName: group.candidateName,
          chamber: group.chamber,
          totalRows: group.totalRows,
          resolvedRows: group.resolvedRows,
        })),
        remainingAfter,
      };
      if (process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, 'tail_remaining_groups=' + remainingAfter + '\n');
        appendFileSync(process.env.GITHUB_OUTPUT, 'tail_selected_groups=' + selectedGroups.length + '\n');
      }
      if (!TARGETS.length) {
        console.log(JSON.stringify({
          cfbCandidateFinanceBackfill: {
            targetBatch: targetBatchName,
            tailSelection,
            collectionComplete: true,
            policy: {
              transactionDateIsAvailability: false,
              contextOnly: true,
              mechanicallyActionable: false,
              modelWeight: 0,
              servingChanged: false,
              productionAction: 'none',
            },
          },
        }, null, 2));
        return;
      }
    }

    const targetKeys = new Set(TARGETS.map(target => target.registrationNumber + ':' + target.segmentEndYear));
    const rows = allRows.filter(row => {
      const segmentEndYear = cfbCandidateSegmentEndYear(row.year);
      return segmentEndYear !== null
        && row.filerRegistrationNumber
        && targetKeys.has(row.filerRegistrationNumber + ':' + segmentEndYear);
    });
    if (!rows.length) throw new Error('Bounded CFB candidate-finance production set returned zero rows');

    type Acquired = Awaited<ReturnType<typeof acquireCfbCandidateHistoricalReportProofs>>;
    const acquiredByTarget = new Map<string, Acquired>();
    for (const target of TARGETS) {
      const acquired = await acquireCfbCandidateHistoricalReportProofs({
        registrationNumber: target.registrationNumber,
        segmentEndYear: target.segmentEndYear,
        maxReports: 12,
      });
      acquiredByTarget.set(target.registrationNumber + ':' + target.segmentEndYear, acquired);
    }

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
    const mappings: Mapping[] = [];
    for (const row of rows) {
      const registrationNumber = row.filerRegistrationNumber;
      const segmentEndYear = cfbCandidateSegmentEndYear(row.year);
      if (!registrationNumber || segmentEndYear === null) continue;
      const acquired = acquiredByTarget.get(registrationNumber + ':' + segmentEndYear);
      if (!acquired?.reports.length) continue;
      const match = firstProvenCfbFinanceAvailability({
        registrationNumber,
        transactionDate: row.transactionDate,
        kind: row.kind,
        amount: row.amount,
        totalAmount: row.kind === 'expenditure' ? row.totalAmount : undefined,
        contributor: row.kind === 'contribution' ? row.contributor : null,
        contributorRegistrationNumber: row.kind === 'contribution' ? row.contributorRegistrationNumber : null,
        vendorName: row.kind === 'expenditure' ? row.vendorName : null,
        affectedCommitteeName: row.kind === 'expenditure' ? row.affectedCommitteeName : null,
        affectedCommitteeRegistrationNumber:
          row.kind === 'expenditure' ? row.affectedCommitteeRegistrationNumber : null,
      }, acquired.reports.map(report => ({ proof: report.proof, text: report.text })));
      if (!match) continue;
      const proof = acquired.reports.find(report =>
        report.proof.textSha256 === match.proof.textSha256
        && report.proof.window.proofUrl === match.window.proofUrl);
      if (!proof) continue;
      mappings.push({
        rowKey: row.rowKey,
        availableOn: match.window.availableOn,
        filedOn: match.proof.filedOn,
        reportName: match.window.reportName,
        proofUrl: match.window.proofUrl,
        proofTextSha256: match.proof.textSha256,
        proofContentSha256: proof.contentSha256,
        proofFetchedAt: proof.fetchedAt,
        proofBytes: proof.bytes,
      });
    }
    const mappingByRowKey = new Map(mappings.map(mapping => [mapping.rowKey, mapping]));

    const contributionRows = rows.filter(row => row.kind === 'contribution');
    const expenditureRows = rows.filter(row => row.kind === 'expenditure');
    const contributionSourceSha256 = createHash('sha256').update(contributionText).digest('hex');
    const expenditureSourceSha256 = createHash('sha256').update(expenditureText).digest('hex');
    const fetchedAt = new Date().toISOString();

    type MembershipCandidate = {
      membershipId: string;
      memberName: string;
      sessionSlug: string;
      chamberSlug: string;
      membershipStartsOn: string | null;
      membershipEndsOn: string | null;
      sessionStartsOn: string | null;
      sessionEndsOn: string | null;
    };
    const membershipRows = await pool.query<MembershipCandidate>(`
      SELECT m.id::text AS "membershipId",
             l.name AS "memberName",
             s.slug AS "sessionSlug",
             c.slug AS "chamberSlug",
             m.starts_on::text AS "membershipStartsOn",
             m.ends_on::text AS "membershipEndsOn",
             s.starts_on::text AS "sessionStartsOn",
             s.ends_on::text AS "sessionEndsOn"
        FROM memberships m
        JOIN legislators l ON l.id=m.legislator_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND c.slug IN ('house','senate')
    `);

    function membershipForRow(row: (typeof rows)[number]) {
      const session = sessionForCandidateFinanceYear(row.year);
      if (!row.candidateName || !row.chamber || !session || !row.transactionDate) return null;
      const candidates = membershipRows.rows.filter(candidate =>
        candidate.sessionSlug === session
        && candidate.chamberSlug === row.chamber
        && (!candidate.membershipStartsOn || candidate.membershipStartsOn <= row.transactionDate!)
        && (!candidate.membershipEndsOn || candidate.membershipEndsOn >= row.transactionDate!)
        && (!candidate.sessionStartsOn || candidate.sessionStartsOn <= row.transactionDate!)
        && (!candidate.sessionEndsOn || candidate.sessionEndsOn >= row.transactionDate!)
      );
      return resolveCandidateFinanceMembership(row.candidateName, candidates);
    }

    const drafts = rows.map(row => {
      const disclosure = mappingByRowKey.get(row.rowKey);
      const membership = membershipForRow(row);
      const total = row.kind === 'expenditure' ? row.totalAmount : row.amount;
      const counterparty = row.kind === 'contribution'
        ? row.contributor
        : (row.vendorName ?? 'an expenditure recipient');
      return {
        row,
        sourceKind: row.kind === 'contribution'
          ? 'campaign_finance_candidate_contribution_bulk'
          : 'campaign_finance_candidate_expenditure_bulk',
        sourceUrl: row.kind === 'contribution' ? urls.contributions : urls.expenditures,
        sourceSha256: row.kind === 'contribution' ? contributionSourceSha256 : expenditureSourceSha256,
        draft: {
          target: membership ? {
            membershipId: membership.membershipId,
          } : undefined,
          kind: 'context' as const,
          stance: 'neutral' as const,
          claim: row.kind === 'contribution'
            ? `Minnesota CFB reports a $${total.toFixed(2)} contribution from ${counterparty} to ${row.committeeName}.`
            : `Minnesota CFB reports a $${total.toFixed(2)} candidate committee expenditure by ${row.committeeName} to ${counterparty}.`,
          publishedAt: undefined,
          sourceQuality: 'official' as const,
          relevance: 'low' as const,
          freshness: freshness(row.transactionDate),
          extractionMethod: row.kind === 'contribution'
            ? 'deterministic-cfb-candidate-contribution-row'
            : 'deterministic-cfb-candidate-expenditure-row',
          extractionVersion: CFB_CANDIDATE_FINANCE_HISTORY_VERSION,
          confidence: 1,
          metadata: {
            contextType: 'campaign_finance',
            subtype: row.kind === 'contribution'
              ? 'candidate_contribution_record'
              : 'candidate_expenditure_record',
            contextOnly: true,
            mechanicallyActionable: false,
            modelWeight: 0,
            asOfEligible: false,
            availabilityStatus: disclosure
              ? 'pending_regulatory_disclosure_promotion'
              : 'awaiting_regulatory_disclosure_proof',
            transactionDateIsAvailability: false,
            filingDateDerivedAvailability: Boolean(disclosure),
            transactionDate: row.transactionDate,
            year: row.year,
            committeeName: row.committeeName,
            filerRegistrationNumber: row.filerRegistrationNumber,
            candidateName: row.candidateName,
            chamber: row.chamber,
            amount: row.amount,
            ...(row.kind === 'contribution' ? {
              contributor: row.contributor,
              contributorRegistrationNumber: row.contributorRegistrationNumber,
              contributorType: row.contributorType,
              receiptType: row.receiptType,
              employer: row.employer,
            } : {
              unpaidAmount: row.unpaidAmount,
              totalAmount: row.totalAmount,
              vendorName: row.vendorName,
              purpose: row.purpose,
              expenditureType: row.expenditureType,
              affectedCommitteeName: row.affectedCommitteeName,
              affectedCommitteeRegistrationNumber: row.affectedCommitteeRegistrationNumber,
            }),
            rowKey: row.rowKey,
            evidenceSeriesKey: `cfb_candidate_finance_row:${row.rowKey}`,
          },
        },
      };
    });

    const size = batchSize();
    let inserted = 0;
    let reused = 0;
    let unresolved = 0;
    for (const kind of ['contribution', 'expenditure'] as const) {
      const selected = drafts.filter(item => item.row.kind === kind);
      for (let offset = 0; offset < selected.length; offset += size) {
        const batch = selected.slice(offset, offset + size);
        if (!batch.length) continue;
        const first = batch[0];
        const persisted = await persistDurableEvidence({
          sourceKind: first.sourceKind,
          sourceUrl: first.sourceUrl,
          contentSha256: first.sourceSha256,
          fetchedAt,
          metadata: {
            publisher: 'Minnesota Campaign Finance and Public Disclosure Board',
            dataset: kind === 'contribution' ? 'candidate_contributions' : 'candidate_expenditures',
            targetBatch: targetBatchName,
            boundedTargetRegistrations: [...new Set(TARGETS.map(target => target.registrationNumber))],
            years: [2021, 2022, 2023, 2024, 2025, 2026],
            boundedRowCount: selected.length,
            rowContentSha256: candidateFinanceContentSha256(selected.map(item => item.row)),
            historicalAvailability: 'official_report_filing_derived_availability_when_row_level_proven',
            availabilityPolicyVersion: CFB_REPORT_AVAILABILITY_VERSION,
          },
        }, batch.map(item => item.draft));
        inserted += persisted.inserted;
        reused += persisted.reused;
        unresolved += persisted.unresolvedTargets.length;
      }
    }

    let promotedThisRun = 0;
    const promotionBatchSize = 500;
    for (let offset = 0; offset < mappings.length; offset += promotionBatchSize) {
      const batch = mappings.slice(offset, offset + promotionBatchSize).map(mapping => ({
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
      const promoted = await pool.query<{ row_key: string }>(`
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
                 'filedOn', disclosure.filed_on::text,
                 'reportName', disclosure.report_name,
                 'availabilityProofKind', 'cfb_report_filing',
                 'availabilityProofUrl', disclosure.proof_url,
                 'availabilityProofTextSha256', disclosure.proof_text_sha256,
                 'availabilityProofContentSha256', disclosure.proof_content_sha256,
                 'availabilityProofFetchedAt', disclosure.proof_fetched_at::text,
                 'availabilityProofBytes', disclosure.proof_bytes,
                 'filingDateDerivedAvailability', true,
                 'transactionDateIsAvailability', false,
                 'contextOnly', true,
                 'mechanicallyActionable', false,
                 'modelWeight', 0
               ))
          FROM source_documents sd, disclosure
         WHERE sd.id = ei.source_document_id
           AND sd.source_kind IN (
             'campaign_finance_candidate_contribution_bulk',
             'campaign_finance_candidate_expenditure_bulk'
           )
           AND ei.metadata->>'rowKey' = disclosure.row_key
           AND (
             ei.published_at IS DISTINCT FROM (disclosure.available_on::text || 'T12:00:00Z')::timestamptz
             OR ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true'
             OR ei.metadata->>'availableOn' IS DISTINCT FROM disclosure.available_on::text
             OR ei.metadata->>'availabilityProofContentSha256' IS DISTINCT FROM disclosure.proof_content_sha256
             OR ei.metadata->>'availabilityProofTextSha256' IS DISTINCT FROM disclosure.proof_text_sha256
           )
        RETURNING ei.metadata->>'rowKey' AS row_key
      `, [JSON.stringify(batch), CFB_REPORT_AVAILABILITY_VERSION]);
      promotedThisRun += promoted.rowCount ?? promoted.rows.length;
    }

    const eligible = await pool.query<{ count: number }>(`
      SELECT count(DISTINCT ei.metadata->>'rowKey')::int AS count
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id = ei.source_document_id
       WHERE sd.source_kind IN (
         'campaign_finance_candidate_contribution_bulk',
         'campaign_finance_candidate_expenditure_bulk'
       )
         AND ei.metadata->>'asOfEligible' = 'true'
         AND ei.published_at IS NOT NULL
         AND ei.metadata->>'transactionDateIsAvailability' = 'false'
    `);

    const acquisition = TARGETS.map(target => {
      const acquired = acquiredByTarget.get(target.registrationNumber + ':' + target.segmentEndYear);
      return {
        ...target,
        referencesDiscovered: acquired?.referencesDiscovered ?? 0,
        selectedReports: acquired?.selectedReports ?? 0,
        proofsParsed: acquired?.reports.length ?? 0,
        failures: acquired?.failures.length ?? 0,
      };
    });

    console.log(JSON.stringify({
      cfbCandidateFinanceBackfill: {
        targetBatch: targetBatchName,
        boundedTargets: TARGETS,
        ...(tailSelection ? { tailSelection } : {}),
        rows: rows.length,
        contributionRows: contributionRows.length,
        expenditureRows: expenditureRows.length,
        disclosureMappedRows: mappings.length,
        inserted,
        reused,
        unresolved,
        promotedThisRun,
        asOfEligibleRows: eligible.rows[0]?.count ?? 0,
        membershipResolution: {
          rowsResolved: drafts.filter(item => Boolean(item.draft.target?.membershipId)).length,
          rowsUnresolved: drafts.filter(item => !item.draft.target?.membershipId).length,
          mappedRowsResolved: drafts.filter(item =>
            Boolean(mappingByRowKey.get(item.row.rowKey))
            && Boolean(item.draft.target?.membershipId)).length,
        },
        acquisition,
        policy: {
          transactionDateIsAvailability: false,
          reportMustDemonstrateRow: true,
          reportCoverageRequired: true,
          filingDerivedAvailabilityUsesDocumentedNextDayRule: true,
          sameDayReplayExcluded: true,
          contextOnly: true,
          mechanicallyActionable: false,
          modelWeight: 0,
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
