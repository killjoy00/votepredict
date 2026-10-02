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
const SESSIONS = ['2021-2022','2023-2024','2025-2026'] as const;
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
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 2400);
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
    const sourceInventory = await pool.query(`
      SELECT
        sd.source_kind AS "sourceKind",
        coalesce(s.slug,'unscoped') AS "session",
        count(DISTINCT sd.id)::int AS "sourceDocuments",
        count(ei.id)::int AS "evidenceItems",
        count(DISTINCT ei.membership_id)::int AS "memberships",
        count(DISTINCT ei.bill_id)::int AS "bills",
        count(*) FILTER (WHERE ei.published_at IS NOT NULL)::int AS "itemsWithPublishedAt",
        count(*) FILTER (WHERE ei.metadata->>'asOfEligible'='true')::int AS "explicitlyEligibleItems",
        count(*) FILTER (
          WHERE coalesce(ei.metadata->>'availabilityProof','') <> ''
             OR coalesce(ei.metadata->>'availableAt','') <> ''
        )::int AS "itemsWithAvailabilityProof",
        count(*) FILTER (
          WHERE ei.id IS NOT NULL
            AND (
              ei.metadata->>'asOfEligible'='false'
              OR (
                ei.published_at IS NULL
                AND coalesce(ei.metadata->>'availabilityProof','')=''
                AND coalesce(ei.metadata->>'availableAt','')=''
              )
            )
        )::int AS "itemsWithoutProvenHistoricalTiming"
      FROM source_documents sd
      LEFT JOIN legislative_sessions s ON s.id=sd.session_id
      LEFT JOIN evidence_items ei ON ei.source_document_id=sd.id
      WHERE s.slug IS NULL OR s.slug IN ('2021-2022','2023-2024','2025-2026')
      GROUP BY sd.source_kind,coalesce(s.slug,'unscoped')
      ORDER BY sd.source_kind,coalesce(s.slug,'unscoped')
    `);

    const senateCommittee2021 = await pool.query(`
      SELECT
        count(DISTINCT sd.id)::int AS "documents",
        count(DISTINCT ve.id)::int AS "voteEvents",
        count(mv.id)::int AS "memberVotes",
        count(mv.id) FILTER (WHERE mv.membership_id IS NULL)::int AS "unresolvedMemberVotes"
      FROM source_documents sd
      LEFT JOIN vote_events ve ON ve.source_document_id=sd.id
      LEFT JOIN member_votes mv ON mv.vote_event_id=ve.id
      WHERE sd.source_kind='senate_committee_minutes'
        AND (
          sd.metadata->>'meetingDate' LIKE '2021-%'
          OR sd.metadata->>'year'='2021'
        )
    `);

    const senateCommitteeBoundary = await pool.query(`
      SELECT
        started_at AS "startedAt",
        finished_at AS "finishedAt",
        metadata
      FROM ingestion_runs
      WHERE source_system='mn_senate_committee_minutes'
        AND status='complete'
        AND metadata->>'selectionPass'='senator-corpus-v3'
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 1
    `);

    const senateRemarks = await pool.query(`
      WITH senate_memberships AS (
        SELECT m.id,s.slug session_slug
        FROM memberships m
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
        WHERE c.slug='senate'
          AND s.slug IN ('2021-2022','2023-2024','2025-2026')
      ),
      remarks AS (
        SELECT ei.membership_id,count(*)::int n
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        WHERE ei.membership_id IS NOT NULL
          AND (
            sd.source_kind ILIKE '%caption%'
            OR ei.metadata->>'contextType' IN ('senate_floor_remark','senate_committee_remark')
            OR ei.metadata->>'subtype' ILIKE '%caption%'
          )
        GROUP BY ei.membership_id
      )
      SELECT
        sm.session_slug AS "session",
        count(*)::int AS "memberships",
        count(*) FILTER (WHERE coalesce(r.n,0)>0)::int AS "membershipsWithRemarks",
        count(*) FILTER (WHERE coalesce(r.n,0)=0)::int AS "membershipsWithoutRemarks",
        coalesce(sum(r.n),0)::int AS "remarkItems"
      FROM senate_memberships sm
      LEFT JOIN remarks r ON r.membership_id=sm.id
      GROUP BY sm.session_slug
      ORDER BY sm.session_slug
    `);

    const finance = await pool.query(`
      SELECT
        s.slug AS "session",
        c.slug AS "chamber",
        count(DISTINCT ei.metadata->>'rowKey')::int AS "persistedRowKeys",
        count(DISTINCT ei.metadata->>'rowKey') FILTER (
          WHERE ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL
        )::int AS "eligibleRowKeys",
        count(DISTINCT ei.metadata->>'rowKey') FILTER (
          WHERE ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true' OR ei.published_at IS NULL
        )::int AS "timingUnprovenRowKeys",
        count(DISTINCT ei.membership_id)::int AS "memberships"
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      JOIN memberships m ON m.id=ei.membership_id
      JOIN legislative_sessions s ON s.id=m.session_id
      JOIN chambers c ON c.id=m.chamber_id
      WHERE ei.metadata->>'subtype' IN ('candidate_contribution_record','candidate_expenditure_record')
        AND ei.metadata->>'rowKey' IS NOT NULL
        AND s.slug IN ('2021-2022','2023-2024','2025-2026')
      GROUP BY s.slug,c.slug
      ORDER BY s.slug,c.slug
    `);

    const financeTimingDebt = await pool.query(`
      WITH identities AS (
        SELECT
          ei.metadata->>'rowKey' AS row_key,
          ei.metadata->>'filerRegistrationNumber' AS registration_number,
          max(ei.metadata->>'candidateName') AS candidate_name,
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
          AND ei.metadata->>'rowKey' IS NOT NULL
          AND ei.metadata->>'filerRegistrationNumber' IS NOT NULL
          AND s.slug IN ('2021-2022','2023-2024','2025-2026')
        GROUP BY
          ei.metadata->>'rowKey',
          ei.metadata->>'filerRegistrationNumber',
          s.slug,
          c.slug
      )
      SELECT
        session_slug AS "session",
        chamber_slug AS "chamber",
        registration_number AS "registrationNumber",
        max(candidate_name) AS "candidateName",
        count(*)::int AS "persistedRowKeys",
        count(*) FILTER (WHERE eligible)::int AS "eligibleRowKeys",
        count(*) FILTER (WHERE NOT eligible)::int AS "timingUnprovenRowKeys"
      FROM identities
      GROUP BY session_slug,chamber_slug,registration_number
      HAVING count(*) FILTER (WHERE NOT eligible)>0
      ORDER BY "timingUnprovenRowKeys" DESC,session_slug,chamber_slug,registration_number
      LIMIT 60
    `);

    const financeCompletion = await pool.query(`
      SELECT
        count(*)::int AS "checkpointRows",
        count(DISTINCT scope)::int AS "checkpointedGroups",
        coalesce(sum((metadata->>'resolvedRows')::int),0)::int AS "resolvedRows",
        coalesce(sum((metadata->>'unresolvedRows')::int),0)::int AS "unresolvedRows",
        coalesce(sum((metadata->>'proofFailures')::int),0)::int AS "proofFailures",
        count(*) FILTER (
          WHERE metadata->>'disposition'='complete_with_fail_closed_proof_exclusions'
        )::int AS "groupsWithProofExclusions"
      FROM ingestion_runs
      WHERE source_system='cfb-candidate-finance-membership-tail-group'
        AND status='complete'
        AND metadata->>'checkpointVersion'='membership-tail-group-v2-row-identity'
    `);

    const independentExpenditures = await pool.query(`
      SELECT
        count(DISTINCT ei.metadata->>'rowKey')::int AS "persistedRowKeys",
        count(DISTINCT ei.metadata->>'rowKey') FILTER (
          WHERE ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL
        )::int AS "eligibleRowKeys",
        count(DISTINCT ei.metadata->>'rowKey') FILTER (
          WHERE ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true' OR ei.published_at IS NULL
        )::int AS "timingUnprovenRowKeys",
        count(DISTINCT ei.membership_id)::int AS "memberships",
        count(*) FILTER (WHERE ei.membership_id IS NULL)::int AS "itemsWithoutResolvedMembership"
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
        AND ei.metadata->>'subtype'='independent_expenditure_record'
    `);

    const independentExpenditureTimingDebt = await pool.query(`
      WITH identities AS (
        SELECT
          ei.metadata->>'rowKey' AS row_key,
          ei.metadata->>'spenderRegistrationNumber' AS spender_registration_number,
          max(ei.metadata->>'spender') AS spender,
          max(ei.metadata->>'year') AS year,
          bool_or(ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL) AS eligible,
          bool_or(ei.membership_id IS NOT NULL) AS membership_resolved
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
          AND ei.metadata->>'subtype'='independent_expenditure_record'
          AND ei.metadata->>'rowKey' IS NOT NULL
        GROUP BY
          ei.metadata->>'rowKey',
          ei.metadata->>'spenderRegistrationNumber'
      )
      SELECT
        coalesce(spender_registration_number,'unresolved') AS "spenderRegistrationNumber",
        max(spender) AS "spender",
        max(year) AS "latestYear",
        count(*)::int AS "persistedRowKeys",
        count(*) FILTER (WHERE eligible)::int AS "eligibleRowKeys",
        count(*) FILTER (WHERE NOT eligible)::int AS "timingUnprovenRowKeys",
        count(*) FILTER (WHERE NOT membership_resolved)::int AS "membershipUnresolvedRowKeys"
      FROM identities
      GROUP BY spender_registration_number
      HAVING count(*) FILTER (WHERE NOT eligible)>0
      ORDER BY "timingUnprovenRowKeys" DESC,"membershipUnresolvedRowKeys" DESC
      LIMIT 60
    `);

    const lobbying = await pool.query(`
      SELECT
        count(DISTINCT sd.id)::int AS "sourceDocuments",
        count(ei.id)::int AS "evidenceItems",
        count(DISTINCT ei.membership_id)::int AS "memberships",
        count(*) FILTER (WHERE ei.published_at IS NOT NULL)::int AS "itemsWithPublishedAt",
        count(*) FILTER (
          WHERE ei.metadata->>'asOfEligible'='true'
             AND ei.published_at IS NOT NULL
        )::int AS "explicitlyEligibleItems",
        count(*) FILTER (
          WHERE coalesce(ei.metadata->>'availabilityProof','') <> ''
             OR coalesce(ei.metadata->>'proofKind','') <> ''
        )::int AS "itemsWithAvailabilityProof"
      FROM source_documents sd
      LEFT JOIN evidence_items ei ON ei.source_document_id=sd.id
      WHERE sd.source_kind ILIKE '%lobby%'
         OR ei.metadata->>'contextType' ILIKE '%lobby%'
         OR ei.metadata->>'subtype' ILIKE '%lobby%'
    `);

    const houseAttachments = await pool.query(`
      WITH archive AS (
        SELECT
          ei.id,
          ei.bill_id,
          ei.metadata->>'subtype' AS subtype,
          ei.metadata->>'attachmentUrl' AS attachment_url,
          ei.metadata->>'officialPostedOn' AS official_posted_on
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        WHERE sd.source_kind='house_committee_archive_page'
          AND ei.extraction_version='house-committee-archive-v1'
          AND ei.metadata->>'subtype' LIKE 'committee_archive_%'
          AND coalesce(ei.metadata->>'attachmentUrl','') <> ''
      ),
      pdf_candidates AS (
        SELECT *
        FROM archive
        WHERE bill_id IS NOT NULL
          AND official_posted_on IS NOT NULL
          AND lower(split_part(attachment_url,'?',1)) LIKE '%.pdf'
      ),
      current_body AS (
        SELECT DISTINCT sd.metadata->>'archiveEvidenceId' AS archive_evidence_id
        FROM source_documents sd
        WHERE sd.source_kind='house_committee_attachment_pdf'
          AND sd.metadata->>'attachmentContentVersion'='house-committee-attachment-content-v1'
          AND coalesce(sd.metadata->>'archiveEvidenceId','') <> ''
      ),
      wayback_body AS (
        SELECT DISTINCT sd.metadata->>'archiveEvidenceId' AS archive_evidence_id
        FROM source_documents sd
        WHERE sd.source_kind='house_committee_attachment_wayback_pdf'
          AND sd.metadata->>'attachmentWaybackVersion'='house-committee-attachment-wayback-bulk-v1'
          AND coalesce(sd.metadata->>'archiveEvidenceId','') <> ''
      ),
      wayback_markers AS (
        SELECT DISTINCT ei.metadata->>'archiveEvidenceId' AS archive_evidence_id
        FROM evidence_items ei
        WHERE ei.metadata->>'subtype'='committee_attachment_wayback_scan_marker'
          AND ei.extraction_version='house-committee-attachment-wayback-bulk-v1'
          AND coalesce(ei.metadata->>'archiveEvidenceId','') <> ''
      )
      SELECT
        (SELECT count(*)::int FROM archive) AS "archiveAttachmentItems",
        (SELECT count(DISTINCT attachment_url)::int FROM archive) AS "uniqueAttachmentUrls",
        (SELECT count(DISTINCT bill_id)::int FROM archive) AS "distinctBills",
        (SELECT count(*)::int FROM archive WHERE subtype='committee_archive_fiscal_note') AS "fiscalNoteItems",
        (SELECT count(*)::int FROM pdf_candidates) AS "billTargetedPdfCandidates",
        (SELECT count(*)::int FROM current_body) AS "currentBodySources",
        (SELECT count(*)::int FROM wayback_body) AS "waybackBodySources",
        (SELECT count(*)::int FROM wayback_markers) AS "waybackScanMarkers",
        (
          SELECT count(*)::int
          FROM pdf_candidates p
          WHERE EXISTS (
            SELECT 1 FROM current_body b WHERE b.archive_evidence_id=p.id::text
          )
        ) AS "pdfCandidatesWithCurrentBody",
        (
          SELECT count(*)::int
          FROM pdf_candidates p
          WHERE EXISTS (
            SELECT 1 FROM wayback_body b WHERE b.archive_evidence_id=p.id::text
          )
        ) AS "pdfCandidatesWithWaybackBody",
        (
          SELECT count(*)::int
          FROM pdf_candidates p
          WHERE EXISTS (
            SELECT 1 FROM wayback_markers m WHERE m.archive_evidence_id=p.id::text
          )
        ) AS "pdfCandidatesWithWaybackScanMarker",
        (
          SELECT count(*)::int
          FROM pdf_candidates p
          WHERE NOT EXISTS (
            SELECT 1 FROM wayback_body b WHERE b.archive_evidence_id=p.id::text
          )
            AND NOT EXISTS (
              SELECT 1 FROM wayback_markers m WHERE m.archive_evidence_id=p.id::text
            )
        ) AS "waybackCandidatesRemaining",
        (
          SELECT count(*)::int
          FROM pdf_candidates p
          WHERE NOT EXISTS (
            SELECT 1 FROM current_body b WHERE b.archive_evidence_id=p.id::text
          )
        ) AS "currentBodyCandidatesRemaining"
    `);

    const fiscalNotes = await pool.query(`
      WITH fiscal AS (
        SELECT
          ei.id,
          ei.bill_id,
          ei.published_at,
          ei.metadata
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        WHERE sd.source_kind='house_committee_archive_page'
          AND ei.metadata->>'subtype'='committee_archive_fiscal_note'
      )
      SELECT
        count(*)::int AS "items",
        count(DISTINCT metadata->>'attachmentUrl')::int AS "uniqueAttachmentUrls",
        count(*) FILTER (WHERE bill_id IS NOT NULL)::int AS "billTargetedItems",
        count(DISTINCT bill_id)::int AS "distinctBills",
        count(*) FILTER (WHERE published_at IS NULL)::int AS "missingPublishedAt"
      FROM fiscal
    `);

    const publicArchiveCoverage = await pool.query(`
      SELECT
        CASE
          WHEN sd.source_kind='wayback_organization_publication' THEN 'organization_publications'
          WHEN sd.source_kind='house_member_primary_historical_article' THEN 'house_member_publications'
          WHEN sd.source_kind='wayback_member_primary' THEN 'wayback_member_primary'
          WHEN sd.source_kind='wayback_campaign_site' THEN 'wayback_campaign_site'
          WHEN sd.source_kind='wayback_local_trade_news' THEN 'local_trade_news'
          ELSE 'other_public_archive'
        END AS "family",
        coalesce(s.slug,'unscoped') AS "session",
        count(DISTINCT sd.id)::int AS "sourceDocuments",
        count(ei.id)::int AS "evidenceItems",
        count(DISTINCT ei.membership_id)::int AS "memberships",
        count(DISTINCT ei.bill_id)::int AS "bills",
        count(*) FILTER (
          WHERE ei.published_at IS NOT NULL
            AND (
              coalesce(ei.metadata->>'availabilityProof','') <> ''
              OR coalesce(ei.metadata->>'archiveCapturedAt','') <> ''
              OR sd.source_kind='house_member_primary_historical_article'
            )
        )::int AS "itemsWithHistoricalTimingProof"
      FROM source_documents sd
      LEFT JOIN legislative_sessions s ON s.id=sd.session_id
      LEFT JOIN evidence_items ei ON ei.source_document_id=sd.id
      WHERE sd.source_kind IN (
        'wayback_organization_publication',
        'house_member_primary_historical_article',
        'wayback_member_primary',
        'wayback_campaign_site',
        'wayback_local_trade_news'
      )
      GROUP BY
        CASE
          WHEN sd.source_kind='wayback_organization_publication' THEN 'organization_publications'
          WHEN sd.source_kind='house_member_primary_historical_article' THEN 'house_member_publications'
          WHEN sd.source_kind='wayback_member_primary' THEN 'wayback_member_primary'
          WHEN sd.source_kind='wayback_campaign_site' THEN 'wayback_campaign_site'
          WHEN sd.source_kind='wayback_local_trade_news' THEN 'local_trade_news'
          ELSE 'other_public_archive'
        END,
        coalesce(s.slug,'unscoped')
      ORDER BY 1,2
    `);

    const organizationPublicationCoverage = await pool.query(`
      SELECT
        coalesce(sd.metadata->>'sector',ei.metadata->>'sector','legacy_unclassified') AS "sector",
        count(DISTINCT sd.metadata->>'seedId')::int AS "seeds",
        count(DISTINCT sd.id)::int AS "sourceDocuments",
        count(ei.id)::int AS "evidenceItems",
        count(*) FILTER (
          WHERE ei.published_at IS NOT NULL
            AND (
              coalesce(ei.metadata->>'availabilityProof','') <> ''
              OR coalesce(ei.metadata->>'archiveCapturedAt','') <> ''
            )
        )::int AS "itemsWithHistoricalTimingProof"
      FROM source_documents sd
      LEFT JOIN evidence_items ei ON ei.source_document_id=sd.id
      WHERE sd.source_kind='wayback_organization_publication'
      GROUP BY coalesce(sd.metadata->>'sector',ei.metadata->>'sector','legacy_unclassified')
      ORDER BY 1
    `);

    const memberPublicationGaps = await pool.query(`
      WITH target AS (
        SELECT m.id,l.name,s.slug session_slug,c.slug chamber
        FROM memberships m
        JOIN legislators l ON l.id=m.legislator_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
        WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
          AND c.slug IN ('house','senate')
      ),
      pub AS (
        SELECT ei.membership_id,count(*)::int n
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        WHERE ei.membership_id IS NOT NULL
          AND sd.source_kind IN (
            'house_member_primary_historical_article',
            'wayback_member_primary',
            'wayback_campaign_site'
          )
        GROUP BY ei.membership_id
      )
      SELECT
        session_slug AS "session",
        chamber,
        count(*)::int AS "memberships",
        count(*) FILTER (WHERE coalesce(pub.n,0)=0)::int AS "zeroCoverageMemberships",
        count(*) FILTER (WHERE coalesce(pub.n,0) BETWEEN 1 AND 4)::int AS "lowCoverageMemberships",
        count(*) FILTER (WHERE coalesce(pub.n,0)>=5)::int AS "fivePlusItemMemberships"
      FROM target
      LEFT JOIN pub ON pub.membership_id=target.id
      GROUP BY session_slug,chamber
      ORDER BY session_slug,chamber
    `);

    const lowCoverageMembers = await pool.query(`
      WITH target AS (
        SELECT m.id,l.name,s.slug session_slug,c.slug chamber
        FROM memberships m
        JOIN legislators l ON l.id=m.legislator_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
        WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
          AND c.slug IN ('house','senate')
      ),
      pub AS (
        SELECT ei.membership_id,count(*)::int n
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        WHERE ei.membership_id IS NOT NULL
          AND sd.source_kind IN (
            'house_member_primary_historical_article',
            'wayback_member_primary',
            'wayback_campaign_site'
          )
        GROUP BY ei.membership_id
      )
      SELECT
        name,
        session_slug AS "session",
        chamber,
        coalesce(pub.n,0)::int AS "items"
      FROM target
      LEFT JOIN pub ON pub.membership_id=target.id
      WHERE coalesce(pub.n,0)<5
      ORDER BY coalesce(pub.n,0),session_slug,chamber,name
      LIMIT 80
    `);

    const latestFailureRuns = await pool.query(`
      WITH latest AS (
        SELECT DISTINCT ON (source_system,scope)
          source_system,
          scope,
          status,
          finished_at,
          metadata
        FROM ingestion_runs
        WHERE status='complete'
        ORDER BY source_system,scope,finished_at DESC NULLS LAST
      )
      SELECT
        source_system AS "sourceSystem",
        scope,
        finished_at AS "finishedAt",
        CASE
          WHEN metadata->>'failures' ~ '^[0-9]+$' THEN (metadata->>'failures')::int
          ELSE 0
        END AS failures,
        metadata->'failureSamples' AS "failureSamples"
      FROM latest
      WHERE metadata->>'failures' ~ '^[0-9]+$'
        AND (metadata->>'failures')::int > 0
        AND (
          source_system ILIKE '%wayback%'
          OR source_system ILIKE '%organization%'
          OR source_system ILIKE '%news%'
          OR source_system ILIKE '%member%'
          OR source_system ILIKE '%finance%'
          OR source_system ILIKE '%committee%'
        )
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 40
    `);

    console.log(JSON.stringify({
      evidenceGapInventoryV1: {
        generatedAt: new Date().toISOString(),
        sessions: SESSIONS,
        workstreams: {
          A_2021SenateCommittee: {
            observed: senateCommittee2021.rows[0],
            latestElectronicCorpusBoundary: senateCommitteeBoundary.rows[0] ?? null,
            gapClass: 'source_exists_outside_current_electronic_corpus',
          },
          B_senateRemarks: {
            coverage: senateRemarks.rows,
            gapClass: 'source_collected_speaker_attribution_unproven',
          },
          C_lobbyingPublicationTiming: {
            observed: lobbying.rows[0],
            gapClass: 'source_structure_known_historical_publication_timing_unproven',
          },
          D_candidateFinance: {
            bySessionChamber: finance.rows,
            topTimingDebtGroups: financeTimingDebt.rows,
            completionAuthority: financeCompletion.rows[0],
            gapClass: 'collected_with_partial_historical_timing_and_identity_gaps',
          },
          E_independentExpenditures: {
            observed: independentExpenditures.rows[0],
            topTimingDebtGroups: independentExpenditureTimingDebt.rows,
            gapClass: 'collected_with_partial_historical_disclosure_proof',
          },
          F_houseAttachmentBodies: {
            observed: houseAttachments.rows[0],
            gapClass: 'metadata_collected_body_archive_backlog_deferred',
          },
          G_fiscalNotes: {
            observed: fiscalNotes.rows[0],
            gapClass: 'positive_official_archive_coverage_only_missingness_unknown',
          },
          H_I_J_publicArchives: {
            byFamilySession: publicArchiveCoverage.rows,
            organizationPublicationBySector: organizationPublicationCoverage.rows,
            memberPublicationCoverage: memberPublicationGaps.rows,
            lowCoverageMembers: lowCoverageMembers.rows,
            gapClass: 'bounded_curated_coverage_not_exhaustive',
          },
          K_failedSnapshots: {
            latestFailureRuns: latestFailureRuns.rows,
            gapClass: 'retry_only_when_failure_remains_on_latest_scope_state',
          },
        },
        sourceInventory: sourceInventory.rows,
        interpretation: {
          readOnly: true,
          noEvidenceWrites: true,
          missingMeans: 'unknown_or_unavailable_not_negative_evidence',
          timingUnprovenMeans: 'not_historically_usable_until_independent_availability_proof_exists',
          sameDayPolicy: 'excluded_when_ordering_is_not_independently_proven',
          ambiguousIdentityPolicy: 'fail_closed',
          ambiguousSpeakerPolicy: 'fail_closed',
          committeeVoiceCountOnlyPolicy: 'never_member_resolved',
          mechanicallyActionable: false,
          modelWeight: 0,
          servingChanged: false,
          productionAction: 'none',
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
