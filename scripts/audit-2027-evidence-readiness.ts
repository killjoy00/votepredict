import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { getQuickEvidenceProspectiveScorecard } from '../src/operations/quick-evidence-prospective-scorecard.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const PROSPECTIVE_CUTOFF = '2027-01-01T00:00:00.000Z';
const PROSPECTIVE_SESSION = '2027-2028';
let secrets: string[] = [];

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
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
  const response = await fetch(DATABASE_BRIDGE_URL, { method: 'POST', headers: { authorization: 'Bearer ' + secret } });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const outputPath = process.env.VOTEPREDICT_2027_EVIDENCE_READINESS_OUTPUT;
  if (!envFile || !outputPath) throw new Error('Production env file and output path required');

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
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '60s'");

    const evidenceSummary = await client.query(`
      WITH superseded AS (
        SELECT DISTINCT to_evidence_id
          FROM evidence_relationships
         WHERE relation_kind='supersedes'
      ), classified AS (
        SELECT
          ei.id,
          ei.membership_id,
          ei.bill_id,
          ei.evidence_kind,
          ei.stance,
          ei.source_quality,
          ei.relevance,
          ei.confidence,
          ei.published_at,
          ei.metadata,
          sd.source_kind,
          sd.fetched_at,
          m.legislator_id,
          member_session.slug AS membership_session,
          bill_session.slug AS bill_session,
          (superseded.to_evidence_id IS NOT NULL) AS is_superseded,
          (
            sd.fetched_at <= $1::timestamptz
            AND (ei.published_at IS NULL OR ei.published_at <= $1::timestamptz)
          ) AS timestamp_eligible_2027
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        LEFT JOIN memberships m ON m.id=ei.membership_id
        LEFT JOIN legislative_sessions member_session ON member_session.id=m.session_id
        LEFT JOIN bills b ON b.id=ei.bill_id
        LEFT JOIN legislative_sessions bill_session ON bill_session.id=b.session_id
        LEFT JOIN superseded ON superseded.to_evidence_id=ei.id
      )
      SELECT
        count(*)::int AS total_items,
        count(*) FILTER (WHERE timestamp_eligible_2027)::int AS timestamp_eligible_2027,
        count(*) FILTER (WHERE NOT timestamp_eligible_2027)::int AS timestamp_ineligible_2027,
        count(*) FILTER (WHERE fetched_at > $1::timestamptz)::int AS fetched_after_2027_start,
        count(*) FILTER (WHERE published_at > $1::timestamptz)::int AS published_after_2027_start,
        count(*) FILTER (WHERE timestamp_eligible_2027 AND NOT is_superseded)::int AS current_query_time_and_version_eligible,
        count(*) FILTER (WHERE timestamp_eligible_2027 AND is_superseded)::int AS timestamp_eligible_but_superseded,
        count(*) FILTER (WHERE membership_id IS NULL)::int AS missing_membership,
        count(*) FILTER (WHERE membership_id IS NOT NULL)::int AS member_linked,
        count(*) FILTER (WHERE membership_id IS NOT NULL AND legislator_id IS NOT NULL)::int AS stable_legislator_resolvable,
        count(*) FILTER (WHERE membership_session=$2)::int AS already_linked_to_2027_membership,
        count(*) FILTER (WHERE membership_id IS NOT NULL AND membership_session IS DISTINCT FROM $2)::int AS linked_to_non_2027_membership,
        count(*) FILTER (WHERE bill_id IS NULL)::int AS missing_bill,
        count(*) FILTER (WHERE bill_id IS NOT NULL)::int AS bill_linked,
        count(*) FILTER (WHERE bill_session=$2)::int AS already_linked_to_2027_bill,
        count(*) FILTER (
          WHERE metadata->>'quickEvidenceCandidate'='true'
            AND stance IN ('supports','opposes')
        )::int AS quick_evidence_candidate_directional,
        count(*) FILTER (
          WHERE timestamp_eligible_2027
            AND is_superseded
            AND evidence_kind IN ('direct_statement','related_statement')
            AND stance IN ('supports','opposes','mixed')
        )::int AS superseded_directional_statements,
        count(DISTINCT legislator_id) FILTER (WHERE legislator_id IS NOT NULL)::int AS distinct_legislators,
        count(DISTINCT source_kind)::int AS distinct_source_kinds
      FROM classified
    `, [PROSPECTIVE_CUTOFF, PROSPECTIVE_SESSION]);

    const bySourceKind = await client.query(`
      WITH superseded AS (
        SELECT DISTINCT to_evidence_id
          FROM evidence_relationships
         WHERE relation_kind='supersedes'
      ), classified AS (
        SELECT
          ei.id,
          ei.membership_id,
          ei.bill_id,
          ei.evidence_kind,
          ei.stance,
          sd.source_kind,
          sd.fetched_at,
          ei.published_at,
          (superseded.to_evidence_id IS NOT NULL) AS is_superseded
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        LEFT JOIN superseded ON superseded.to_evidence_id=ei.id
      )
      SELECT source_kind,
             count(*)::int AS total_items,
             count(*) FILTER (
               WHERE fetched_at <= $1::timestamptz
                 AND (published_at IS NULL OR published_at <= $1::timestamptz)
             )::int AS timestamp_eligible_2027,
             count(*) FILTER (WHERE is_superseded)::int AS superseded_items,
             count(*) FILTER (
               WHERE is_superseded
                 AND evidence_kind IN ('direct_statement','related_statement')
                 AND stance IN ('supports','opposes','mixed')
             )::int AS superseded_directional_statements,
             count(*) FILTER (WHERE membership_id IS NULL)::int AS missing_membership,
             count(*) FILTER (WHERE bill_id IS NULL)::int AS missing_bill
        FROM classified
       GROUP BY source_kind
       ORDER BY total_items DESC, source_kind
    `, [PROSPECTIVE_CUTOFF]);

    const supersession = await client.query(`
      SELECT
        count(*)::int AS supersedes_edges,
        count(*) FILTER (
          WHERE old_item.evidence_kind IN ('direct_statement','related_statement')
            AND old_item.stance IN ('supports','opposes','mixed')
        )::int AS edges_with_old_directional_statement,
        count(*) FILTER (
          WHERE old_item.evidence_kind IN ('direct_statement','related_statement')
            AND new_item.evidence_kind IN ('direct_statement','related_statement')
            AND old_item.stance IN ('supports','opposes','mixed')
            AND new_item.stance IN ('supports','opposes','mixed')
        )::int AS directional_statement_to_directional_statement,
        count(*) FILTER (
          WHERE old_item.evidence_kind IN ('direct_statement','related_statement')
            AND new_item.evidence_kind IN ('direct_statement','related_statement')
            AND old_item.stance IN ('supports','opposes','mixed')
            AND new_item.stance IN ('supports','opposes','mixed')
            AND old_item.stance IS DISTINCT FROM new_item.stance
        )::int AS directional_stance_changed,
        count(*) FILTER (
          WHERE old_item.evidence_kind IN ('direct_statement','related_statement')
            AND old_item.stance IN ('supports','opposes','mixed')
            AND new_item.stance NOT IN ('supports','opposes','mixed')
        )::int AS directional_to_nondirectional
      FROM evidence_relationships er
      JOIN evidence_items new_item ON new_item.id=er.from_evidence_id
      JOIN evidence_items old_item ON old_item.id=er.to_evidence_id
      WHERE er.relation_kind='supersedes'
    `);

    const supersededDirectionalExamples = await client.query(`
      SELECT
        er.id::text AS relationship_id,
        old_item.id::text AS old_evidence_id,
        new_item.id::text AS new_evidence_id,
        old_item.evidence_kind AS old_kind,
        old_item.stance AS old_stance,
        new_item.evidence_kind AS new_kind,
        new_item.stance AS new_stance,
        old_item.claim AS old_claim,
        new_item.claim AS new_claim,
        old_sd.source_kind AS old_source_kind,
        old_sd.fetched_at::text AS old_fetched_at,
        new_sd.fetched_at::text AS new_fetched_at,
        old_item.published_at::text AS old_published_at,
        new_item.published_at::text AS new_published_at
      FROM evidence_relationships er
      JOIN evidence_items new_item ON new_item.id=er.from_evidence_id
      JOIN evidence_items old_item ON old_item.id=er.to_evidence_id
      JOIN source_documents old_sd ON old_sd.id=old_item.source_document_id
      JOIN source_documents new_sd ON new_sd.id=new_item.source_document_id
      WHERE er.relation_kind='supersedes'
        AND old_item.evidence_kind IN ('direct_statement','related_statement')
        AND old_item.stance IN ('supports','opposes','mixed')
      ORDER BY old_sd.fetched_at DESC, er.id
      LIMIT 25
    `);

    const membershipPortability = await client.query(`
      SELECT
        ls.slug AS membership_session,
        count(*)::int AS evidence_items,
        count(DISTINCT m.legislator_id)::int AS legislators,
        count(*) FILTER (
          WHERE sd.fetched_at <= $1::timestamptz
            AND (ei.published_at IS NULL OR ei.published_at <= $1::timestamptz)
        )::int AS timestamp_eligible_2027
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      JOIN memberships m ON m.id=ei.membership_id
      JOIN legislative_sessions ls ON ls.id=m.session_id
      GROUP BY ls.slug
      ORDER BY ls.slug
    `, [PROSPECTIVE_CUTOFF]);

    const evidenceQuality = await client.query(`
      WITH rows AS (
        SELECT
          eqa.id,
          eqa.source_document_id,
          eqa.annotation,
          eqa.outcome_blind,
          eqa.context_only,
          eqa.mechanically_actionable,
          eqa.model_weight,
          sd.fetched_at,
          sd.metadata
        FROM evidence_quality_annotations eqa
        JOIN source_documents sd ON sd.id=eqa.source_document_id
        WHERE eqa.schema_version='evidence-quality-v1'
          AND eqa.prompt_version='evidence-quality-prompt-v1'
          AND eqa.classifier_provider='manual-openai'
      )
      SELECT
        count(*)::int AS documents,
        count(*) FILTER (WHERE fetched_at <= $1::timestamptz)::int AS fetched_before_2027,
        count(*) FILTER (
          WHERE COALESCE(metadata->>'availableAt',metadata->>'availableOn',metadata->>'archiveCapturedAt') IS NOT NULL
        )::int AS with_explicit_historical_availability_proof,
        count(*) FILTER (
          WHERE outcome_blind AND context_only AND NOT mechanically_actionable AND model_weight=0
        )::int AS policy_invariant_rows,
        sum((
          SELECT count(*) FROM jsonb_array_elements(annotation->'claims') claim
           WHERE claim->>'stance' IN ('supports','opposes','mixed')
             AND jsonb_array_length(COALESCE(claim->'billIdentifiers','[]'::jsonb)) > 0
        ))::int AS exact_bill_directional_claims,
        sum((
          SELECT count(*) FROM jsonb_array_elements(annotation->'claims') claim
           WHERE claim->>'stance' IN ('supports','opposes','mixed')
             AND claim->>'linkage'='member_issue'
             AND jsonb_array_length(COALESCE(claim->'billIdentifiers','[]'::jsonb)) = 0
        ))::int AS member_issue_directional_claims
      FROM rows
    `, [PROSPECTIVE_CUTOFF]);

    const prospectiveScorecard = await getQuickEvidenceProspectiveScorecard(client);

    const audit = {
      schemaVersion: 'evidence-2027-readiness-audit-v1',
      generatedAt: new Date().toISOString(),
      prospectiveSession: PROSPECTIVE_SESSION,
      prospectiveCutoff: PROSPECTIVE_CUTOFF,
      currentProspectiveRule: {
        durableEvidence: 'source_documents.fetched_at <= forecast as-of AND (evidence_items.published_at IS NULL OR published_at <= forecast as-of)',
        currentEvidenceView: 'additionally excludes evidence that is the to_evidence_id of a supersedes relationship',
        quickDirectionalLookup: 'requires current forecast membership_id and current bill_id exact match',
      },
      durableEvidence: evidenceSummary.rows[0],
      bySourceKind: bySourceKind.rows,
      membershipPortability: membershipPortability.rows,
      supersession: {
        summary: supersession.rows[0],
        directionalExamples: supersededDirectionalExamples.rows,
      },
      manualEvidenceQuality: evidenceQuality.rows[0],
      prospectiveScorecard,
      designFindings: {
        supersedesIsVersionLineageNotNecessarilyInvalidation: true,
        oldDirectionalStatementsShouldNotBeAssumedSemanticallyDead: true,
        currentQuickMembershipLookupIsSessionSpecific: true,
        priorSessionEvidenceRequiresStableLegislatorIdentityCarryForwardFor2027: true,
        exactBillEvidenceStillRequiresCurrentBillRelevanceOrASeparateCrossBillIssuePolicy: true,
        memberIssueEvidenceCanBePubliclyAvailableWithoutBeingBillApplicable: true,
      },
      policy: {
        readOnly: true,
        outcomeUse: 'none',
        servingChanged: false,
        modelWeightChanged: false,
      },
    };

    writeFileSync(resolve(outputPath), JSON.stringify(audit, null, 2) + '\n');

    console.log(JSON.stringify({
      evidence2027ReadinessAudit: {
        prospectiveCutoff: PROSPECTIVE_CUTOFF,
        durableEvidence: evidenceSummary.rows[0],
        supersession: supersession.rows[0],
        manualEvidenceQuality: evidenceQuality.rows[0],
        prospectiveScorecard: {
          status: prospectiveScorecard.status,
          resolvedForecasts: prospectiveScorecard.resolvedForecasts,
          selectedRevisions: prospectiveScorecard.selectedRevisions,
          minimums: prospectiveScorecard.minimums,
          primaryScoringAllowed: prospectiveScorecard.primaryScoringAllowed,
          metricsSealed: prospectiveScorecard.metrics === null,
          servingBaseline: prospectiveScorecard.metadata.servingBaseline,
          experiment: prospectiveScorecard.metadata.experiment,
          productionAction: prospectiveScorecard.productionAction,
        },
        outcomeUse: 'none',
        servingChanged: false,
      },
    }, null, 2));

    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
