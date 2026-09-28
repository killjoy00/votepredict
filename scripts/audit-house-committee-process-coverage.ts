import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

export {};

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const STRUCTURED_SUBTYPES = [
  'committee_archive_agenda',
  'committee_archive_amendment',
  'committee_archive_bill_summary',
  'committee_archive_committee_rollcall',
  'committee_archive_fiscal_note',
  'committee_archive_minutes',
  'committee_archive_testifier_list',
  'committee_archive_testimony_handout',
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

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');
  async function works(value: string) {
    const candidate = new Pool({
      connectionString: value,
      max: 1,
      connectionTimeoutMillis: 8000,
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

type KindCoverageRow = {
  session_slug: string;
  subtype: string;
  rows: string;
  unique_attachments: string;
  bill_targeted_rows: string;
  distinct_bill_targets: string;
  pre_first_recorded_vote_rows: string;
  pre_first_recorded_vote_bills: string;
  pre_first_passage_rows: string;
  pre_first_passage_bills: string;
  missing_published_at: string;
  unsafe_same_day_flags: string;
  missing_official_availability_proof: string;
};

type SessionCoverageRow = {
  session_slug: string;
  target_bills_any_vote: string;
  target_bills_passage: string;
  bills_with_any_structured_archive: string;
  bills_with_pre_first_vote_structured_archive: string;
  bills_with_pre_first_passage_structured_archive: string;
  pre_vote_bills_with_2plus_kinds: string;
  pre_vote_bills_with_3plus_kinds: string;
  pre_vote_bills_with_4plus_kinds: string;
  max_pre_vote_kinds: string;
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
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  try {
    const kindCoverage = await pool.query<KindCoverageRow>(`
      WITH target AS (
        SELECT s.slug AS session_slug,
               b.id AS bill_id,
               min(ve.occurred_on)::date AS first_recorded_vote_on,
               min(ve.occurred_on) FILTER (WHERE ve.is_passage=true)::date AS first_passage_on
          FROM bills b
          JOIN legislative_sessions s ON s.id=b.session_id
          JOIN jurisdictions j ON j.id=s.jurisdiction_id
          JOIN vote_events ve ON ve.bill_id=b.id
         WHERE j.slug='us-mn'
           AND s.slug IN ('2021-2022','2023-2024','2025-2026')
           AND b.identifier ~ '^(HF|SF)[0-9]+$'
         GROUP BY s.slug,b.id
      ),
      archive AS (
        SELECT s.slug AS session_slug,
               ei.id,
               ei.bill_id,
               ei.published_at::date AS published_on,
               ei.metadata->>'subtype' AS subtype,
               ei.metadata->>'attachmentUrl' AS attachment_url,
               ei.metadata
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
          JOIN legislative_sessions s ON s.id=sd.session_id
         WHERE sd.source_kind='house_committee_archive_page'
           AND s.slug IN ('2021-2022','2023-2024','2025-2026')
           AND ei.metadata->>'subtype' = ANY($1::text[])
      )
      SELECT a.session_slug,
             a.subtype,
             count(*)::text AS rows,
             count(DISTINCT a.attachment_url) FILTER (WHERE a.attachment_url IS NOT NULL)::text AS unique_attachments,
             count(*) FILTER (WHERE a.bill_id IS NOT NULL)::text AS bill_targeted_rows,
             count(DISTINCT a.bill_id) FILTER (WHERE a.bill_id IS NOT NULL)::text AS distinct_bill_targets,
             count(*) FILTER (
               WHERE a.bill_id IS NOT NULL
                 AND a.published_on IS NOT NULL
                 AND t.first_recorded_vote_on IS NOT NULL
                 AND a.published_on < t.first_recorded_vote_on
             )::text AS pre_first_recorded_vote_rows,
             count(DISTINCT a.bill_id) FILTER (
               WHERE a.bill_id IS NOT NULL
                 AND a.published_on IS NOT NULL
                 AND t.first_recorded_vote_on IS NOT NULL
                 AND a.published_on < t.first_recorded_vote_on
             )::text AS pre_first_recorded_vote_bills,
             count(*) FILTER (
               WHERE a.bill_id IS NOT NULL
                 AND a.published_on IS NOT NULL
                 AND t.first_passage_on IS NOT NULL
                 AND a.published_on < t.first_passage_on
             )::text AS pre_first_passage_rows,
             count(DISTINCT a.bill_id) FILTER (
               WHERE a.bill_id IS NOT NULL
                 AND a.published_on IS NOT NULL
                 AND t.first_passage_on IS NOT NULL
                 AND a.published_on < t.first_passage_on
             )::text AS pre_first_passage_bills,
             count(*) FILTER (WHERE a.published_on IS NULL)::text AS missing_published_at,
             count(*) FILTER (
               WHERE COALESCE(a.metadata->>'sameDayEligible','false') <> 'false'
             )::text AS unsafe_same_day_flags,
             count(*) FILTER (
               WHERE a.metadata->>'availabilityProof' IS DISTINCT FROM 'official_publication_timestamp'
             )::text AS missing_official_availability_proof
        FROM archive a
        LEFT JOIN target t ON t.bill_id=a.bill_id
       GROUP BY a.session_slug,a.subtype
       ORDER BY a.session_slug,a.subtype
    `, [[...STRUCTURED_SUBTYPES]]);

    const sessionCoverage = await pool.query<SessionCoverageRow>(`
      WITH target AS (
        SELECT s.slug AS session_slug,
               b.id AS bill_id,
               min(ve.occurred_on)::date AS first_recorded_vote_on,
               min(ve.occurred_on) FILTER (WHERE ve.is_passage=true)::date AS first_passage_on
          FROM bills b
          JOIN legislative_sessions s ON s.id=b.session_id
          JOIN jurisdictions j ON j.id=s.jurisdiction_id
          JOIN vote_events ve ON ve.bill_id=b.id
         WHERE j.slug='us-mn'
           AND s.slug IN ('2021-2022','2023-2024','2025-2026')
           AND b.identifier ~ '^(HF|SF)[0-9]+$'
         GROUP BY s.slug,b.id
      ),
      archive AS (
        SELECT s.slug AS session_slug,
               ei.bill_id,
               ei.published_at::date AS published_on,
               ei.metadata->>'subtype' AS subtype
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
          JOIN legislative_sessions s ON s.id=sd.session_id
         WHERE sd.source_kind='house_committee_archive_page'
           AND s.slug IN ('2021-2022','2023-2024','2025-2026')
           AND ei.bill_id IS NOT NULL
           AND ei.metadata->>'subtype' = ANY($1::text[])
      ),
      per_bill AS (
        SELECT t.session_slug,
               t.bill_id,
               t.first_recorded_vote_on,
               t.first_passage_on,
               count(DISTINCT a.subtype) FILTER (WHERE a.bill_id IS NOT NULL)::int AS any_kinds,
               count(DISTINCT a.subtype) FILTER (
                 WHERE a.published_on IS NOT NULL
                   AND a.published_on < t.first_recorded_vote_on
               )::int AS pre_vote_kinds,
               count(DISTINCT a.subtype) FILTER (
                 WHERE t.first_passage_on IS NOT NULL
                   AND a.published_on IS NOT NULL
                   AND a.published_on < t.first_passage_on
               )::int AS pre_passage_kinds
          FROM target t
          LEFT JOIN archive a ON a.bill_id=t.bill_id
         GROUP BY t.session_slug,t.bill_id,t.first_recorded_vote_on,t.first_passage_on
      )
      SELECT session_slug,
             count(*)::text AS target_bills_any_vote,
             count(*) FILTER (WHERE first_passage_on IS NOT NULL)::text AS target_bills_passage,
             count(*) FILTER (WHERE any_kinds > 0)::text AS bills_with_any_structured_archive,
             count(*) FILTER (WHERE pre_vote_kinds > 0)::text AS bills_with_pre_first_vote_structured_archive,
             count(*) FILTER (
               WHERE first_passage_on IS NOT NULL AND pre_passage_kinds > 0
             )::text AS bills_with_pre_first_passage_structured_archive,
             count(*) FILTER (WHERE pre_vote_kinds >= 2)::text AS pre_vote_bills_with_2plus_kinds,
             count(*) FILTER (WHERE pre_vote_kinds >= 3)::text AS pre_vote_bills_with_3plus_kinds,
             count(*) FILTER (WHERE pre_vote_kinds >= 4)::text AS pre_vote_bills_with_4plus_kinds,
             max(pre_vote_kinds)::text AS max_pre_vote_kinds
        FROM per_bill
       GROUP BY session_slug
       ORDER BY session_slug
    `, [[...STRUCTURED_SUBTYPES]]);

    const byKind = kindCoverage.rows.map(row => ({
      session: row.session_slug,
      subtype: row.subtype,
      rows: Number(row.rows),
      uniqueAttachments: Number(row.unique_attachments),
      billTargetedRows: Number(row.bill_targeted_rows),
      distinctBillTargets: Number(row.distinct_bill_targets),
      preFirstRecordedVoteRows: Number(row.pre_first_recorded_vote_rows),
      preFirstRecordedVoteBills: Number(row.pre_first_recorded_vote_bills),
      preFirstPassageRows: Number(row.pre_first_passage_rows),
      preFirstPassageBills: Number(row.pre_first_passage_bills),
      missingPublishedAt: Number(row.missing_published_at),
      unsafeSameDayFlags: Number(row.unsafe_same_day_flags),
      missingOfficialAvailabilityProof: Number(row.missing_official_availability_proof),
    }));

    const bySession = sessionCoverage.rows.map(row => {
      const anyVote = Number(row.target_bills_any_vote);
      const passage = Number(row.target_bills_passage);
      const preVote = Number(row.bills_with_pre_first_vote_structured_archive);
      const prePassage = Number(row.bills_with_pre_first_passage_structured_archive);
      return {
        session: row.session_slug,
        targetBillsAnyVote: anyVote,
        targetBillsPassage: passage,
        billsWithAnyStructuredArchive: Number(row.bills_with_any_structured_archive),
        billsWithPreFirstVoteStructuredArchive: preVote,
        preFirstVoteCoverageShare: anyVote > 0 ? preVote / anyVote : null,
        billsWithPreFirstPassageStructuredArchive: prePassage,
        preFirstPassageCoverageShare: passage > 0 ? prePassage / passage : null,
        preVoteBillsWith2PlusKinds: Number(row.pre_vote_bills_with_2plus_kinds),
        preVoteBillsWith3PlusKinds: Number(row.pre_vote_bills_with_3plus_kinds),
        preVoteBillsWith4PlusKinds: Number(row.pre_vote_bills_with_4plus_kinds),
        maxPreVoteKinds: Number(row.max_pre_vote_kinds),
      };
    });

    const qualityTotals = byKind.reduce((acc, row) => {
      acc.rows += row.rows;
      acc.missingPublishedAt += row.missingPublishedAt;
      acc.unsafeSameDayFlags += row.unsafeSameDayFlags;
      acc.missingOfficialAvailabilityProof += row.missingOfficialAvailabilityProof;
      return acc;
    }, {
      rows: 0,
      missingPublishedAt: 0,
      unsafeSameDayFlags: 0,
      missingOfficialAvailabilityProof: 0,
    });

    const totalTargets = bySession.reduce((sum, row) => sum + row.targetBillsAnyVote, 0);
    const totalPassageTargets = bySession.reduce((sum, row) => sum + row.targetBillsPassage, 0);
    const totalPreVote = bySession.reduce(
      (sum, row) => sum + row.billsWithPreFirstVoteStructuredArchive,
      0,
    );
    const totalPrePassage = bySession.reduce(
      (sum, row) => sum + row.billsWithPreFirstPassageStructuredArchive,
      0,
    );

    console.log(JSON.stringify({
      houseCommitteeProcessCoverageAudit: {
        structuredSubtypes: [...STRUCTURED_SUBTYPES],
        bySession,
        byKind,
        totals: {
          targetBillsAnyVote: totalTargets,
          targetBillsPassage: totalPassageTargets,
          billsWithPreFirstVoteStructuredArchive: totalPreVote,
          preFirstVoteCoverageShare: totalTargets > 0 ? totalPreVote / totalTargets : null,
          billsWithPreFirstPassageStructuredArchive: totalPrePassage,
          preFirstPassageCoverageShare:
            totalPassageTargets > 0 ? totalPrePassage / totalPassageTargets : null,
          ...qualityTotals,
        },
        interpretation: {
          positiveEvidenceOnly: true,
          absenceIsNotNegativeEvidence: true,
          availabilityBound: 'official House committee archive attachment posted date',
          sameDayExcluded: true,
          genericUnclassifiedAttachmentsExcludedFromStructuredCoverage: true,
          attachmentBodiesNotRequiredForMetadataExistenceSignals: true,
          stoppedAttachmentWaybackBacklogExcluded: true,
        },
        policy: {
          readOnly: true,
          contextOnly: true,
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
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(item => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  console.error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]'));
  process.exitCode = 1;
});
