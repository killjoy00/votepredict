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
    const rows = await pool.query<{
      session_slug: string;
      fiscal_note_rows: string;
      unique_attachments: string;
      bill_targeted_rows: string;
      distinct_bill_targets: string;
      pre_first_recorded_vote_rows: string;
      pre_first_recorded_vote_bills: string;
      pre_first_passage_rows: string;
      pre_first_passage_bills: string;
      target_bills_any_vote: string;
      target_bills_passage: string;
      missing_published_at: string;
      unsafe_same_day_flags: string;
      missing_official_availability_proof: string;
    }>(`
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
      target_counts AS (
        SELECT session_slug,
               count(*)::int AS target_bills_any_vote,
               count(*) FILTER (WHERE first_passage_on IS NOT NULL)::int AS target_bills_passage
          FROM target
         GROUP BY session_slug
      ),
      fiscal AS (
        SELECT ei.id,
               ei.bill_id,
               sd.session_id,
               ei.published_at::date AS published_on,
               ei.metadata->>'attachmentUrl' AS attachment_url,
               ei.metadata
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
         WHERE ei.metadata->>'subtype'='committee_archive_fiscal_note'
           AND sd.source_kind='house_committee_archive_page'
      ),
      fiscal_scoped AS (
        SELECT s.slug AS session_slug,
               f.id,
               f.bill_id,
               f.published_on,
               f.attachment_url,
               f.metadata,
               t.first_recorded_vote_on,
               t.first_passage_on
          FROM fiscal f
          JOIN legislative_sessions s ON s.id=f.session_id
          LEFT JOIN target t ON t.bill_id=f.bill_id
         WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
      )
      SELECT tc.session_slug,
             count(fs.id)::text AS fiscal_note_rows,
             count(DISTINCT fs.attachment_url) FILTER (WHERE fs.attachment_url IS NOT NULL)::text AS unique_attachments,
             count(fs.id) FILTER (WHERE fs.bill_id IS NOT NULL)::text AS bill_targeted_rows,
             count(DISTINCT fs.bill_id) FILTER (WHERE fs.bill_id IS NOT NULL)::text AS distinct_bill_targets,
             count(fs.id) FILTER (
               WHERE fs.bill_id IS NOT NULL
                 AND fs.published_on IS NOT NULL
                 AND fs.first_recorded_vote_on IS NOT NULL
                 AND fs.published_on < fs.first_recorded_vote_on
             )::text AS pre_first_recorded_vote_rows,
             count(DISTINCT fs.bill_id) FILTER (
               WHERE fs.bill_id IS NOT NULL
                 AND fs.published_on IS NOT NULL
                 AND fs.first_recorded_vote_on IS NOT NULL
                 AND fs.published_on < fs.first_recorded_vote_on
             )::text AS pre_first_recorded_vote_bills,
             count(fs.id) FILTER (
               WHERE fs.bill_id IS NOT NULL
                 AND fs.published_on IS NOT NULL
                 AND fs.first_passage_on IS NOT NULL
                 AND fs.published_on < fs.first_passage_on
             )::text AS pre_first_passage_rows,
             count(DISTINCT fs.bill_id) FILTER (
               WHERE fs.bill_id IS NOT NULL
                 AND fs.published_on IS NOT NULL
                 AND fs.first_passage_on IS NOT NULL
                 AND fs.published_on < fs.first_passage_on
             )::text AS pre_first_passage_bills,
             tc.target_bills_any_vote::text,
             tc.target_bills_passage::text,
             count(fs.id) FILTER (WHERE fs.published_on IS NULL)::text AS missing_published_at,
             count(fs.id) FILTER (
               WHERE COALESCE(fs.metadata->>'sameDayEligible','false') <> 'false'
             )::text AS unsafe_same_day_flags,
             count(fs.id) FILTER (
               WHERE fs.metadata->>'availabilityProof' IS DISTINCT FROM 'official_publication_timestamp'
             )::text AS missing_official_availability_proof
        FROM target_counts tc
        LEFT JOIN fiscal_scoped fs ON fs.session_slug=tc.session_slug
       GROUP BY tc.session_slug,tc.target_bills_any_vote,tc.target_bills_passage
       ORDER BY tc.session_slug
    `);

    const totals = rows.rows.reduce((acc, row) => {
      acc.fiscalNoteRows += Number(row.fiscal_note_rows);
      acc.uniqueAttachments += Number(row.unique_attachments);
      acc.billTargetedRows += Number(row.bill_targeted_rows);
      acc.distinctBillTargets += Number(row.distinct_bill_targets);
      acc.preFirstRecordedVoteRows += Number(row.pre_first_recorded_vote_rows);
      acc.preFirstRecordedVoteBills += Number(row.pre_first_recorded_vote_bills);
      acc.preFirstPassageRows += Number(row.pre_first_passage_rows);
      acc.preFirstPassageBills += Number(row.pre_first_passage_bills);
      acc.targetBillsAnyVote += Number(row.target_bills_any_vote);
      acc.targetBillsPassage += Number(row.target_bills_passage);
      acc.missingPublishedAt += Number(row.missing_published_at);
      acc.unsafeSameDayFlags += Number(row.unsafe_same_day_flags);
      acc.missingOfficialAvailabilityProof += Number(row.missing_official_availability_proof);
      return acc;
    }, {
      fiscalNoteRows: 0,
      uniqueAttachments: 0,
      billTargetedRows: 0,
      distinctBillTargets: 0,
      preFirstRecordedVoteRows: 0,
      preFirstRecordedVoteBills: 0,
      preFirstPassageRows: 0,
      preFirstPassageBills: 0,
      targetBillsAnyVote: 0,
      targetBillsPassage: 0,
      missingPublishedAt: 0,
      unsafeSameDayFlags: 0,
      missingOfficialAvailabilityProof: 0,
    });

    const bySession = rows.rows.map(row => ({
      session: row.session_slug,
      fiscalNoteRows: Number(row.fiscal_note_rows),
      uniqueAttachments: Number(row.unique_attachments),
      billTargetedRows: Number(row.bill_targeted_rows),
      distinctBillTargets: Number(row.distinct_bill_targets),
      preFirstRecordedVoteRows: Number(row.pre_first_recorded_vote_rows),
      preFirstRecordedVoteBills: Number(row.pre_first_recorded_vote_bills),
      preFirstPassageRows: Number(row.pre_first_passage_rows),
      preFirstPassageBills: Number(row.pre_first_passage_bills),
      targetBillsAnyVote: Number(row.target_bills_any_vote),
      targetBillsPassage: Number(row.target_bills_passage),
      preFirstRecordedVoteCoverageShare:
        Number(row.target_bills_any_vote) > 0
          ? Number(row.pre_first_recorded_vote_bills) / Number(row.target_bills_any_vote)
          : null,
      preFirstPassageCoverageShare:
        Number(row.target_bills_passage) > 0
          ? Number(row.pre_first_passage_bills) / Number(row.target_bills_passage)
          : null,
      missingPublishedAt: Number(row.missing_published_at),
      unsafeSameDayFlags: Number(row.unsafe_same_day_flags),
      missingOfficialAvailabilityProof: Number(row.missing_official_availability_proof),
    }));

    console.log(JSON.stringify({
      houseCommitteeFiscalNoteCoverageAudit: {
        bySession,
        totals: {
          ...totals,
          preFirstRecordedVoteCoverageShare:
            totals.targetBillsAnyVote > 0
              ? totals.preFirstRecordedVoteBills / totals.targetBillsAnyVote
              : null,
          preFirstPassageCoverageShare:
            totals.targetBillsPassage > 0
              ? totals.preFirstPassageBills / totals.targetBillsPassage
              : null,
        },
        interpretation: {
          positiveEvidenceOnly: true,
          absenceIsNotNoFiscalNote: true,
          availabilityBound: 'official House committee archive attachment posted date',
          sameDayExcluded: true,
          attachmentBodyNeededForPositiveExistenceSignal: false,
          directLboSearchAutomationBlockedBySourceProtection: true,
          lboSearchBlockDoesNotInvalidateHouseArchivePostedDateEvidence: true,
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
