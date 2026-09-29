import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED','POSTGRES_URL_NON_POOLING','DATABASE_URL','POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
let secrets: string[] = [];

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));
}
async function chooseDb(env: Record<string,string|undefined>) {
  const { Pool } = await import('pg');
  async function works(value: string) {
    const candidate = new Pool({ connectionString:value, max:1, connectionTimeoutMillis:8000 });
    try { await candidate.query('select 1'); return true; }
    catch { return false; }
    finally { await candidate.end().catch(()=>undefined); }
  }
  for (const key of DATABASE_CANDIDATES) {
    const value=env[key]?.trim();
    if (value && await works(value)) return value;
  }
  const secret=env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET unavailable');
  const response=await fetch(DATABASE_BRIDGE_URL,{method:'POST',headers:{authorization:'Bearer '+secret}});
  if (!response.ok) throw new Error('Database bridge HTTP '+response.status);
  const value=(await response.text()).trim();
  secrets.push(value); mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}
function safe(error: unknown) {
  let message=error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(x=>x.length>3).sort((a,b)=>b.length-a.length)) message=message.split(value).join('[redacted]');
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi,'[redacted database URL]').slice(0,1800);
}

async function main() {
  const envFile=process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('Production env file required');
  const env=parseRuntimeEnvironment(readFileSync(envFile,'utf8'));
  secrets=Object.entries(env)
    .filter(([key])=>/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([,value])=>value)
    .filter((value): value is string=>typeof value==='string');
  secrets.forEach(mask);
  process.env.DATABASE_URL=await chooseDb(env);
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  try {
    const bySourceKind=await pool.query(`
      SELECT
        sd.source_kind AS "sourceKind",
        count(*)::int AS "evidenceItems",
        count(DISTINCT ei.metadata->>'rowKey')::int AS "distinctRowKeys",
        count(DISTINCT CASE
          WHEN ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL
          THEN ei.metadata->>'rowKey' END)::int AS "eligibleRowKeys"
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      WHERE ei.metadata->>'subtype' IN ('candidate_contribution_record','candidate_expenditure_record')
        AND ei.metadata->>'rowKey' IS NOT NULL
      GROUP BY sd.source_kind
      ORDER BY sd.source_kind
    `);

    const totals=await pool.query(`
      SELECT
        count(DISTINCT ei.metadata->>'rowKey')::int AS "allCandidateRowKeys",
        count(DISTINCT CASE
          WHEN ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL
          THEN ei.metadata->>'rowKey' END)::int AS "allEligibleCandidateRowKeys",
        count(DISTINCT CASE
          WHEN sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_candidate_expenditure_bulk')
          THEN ei.metadata->>'rowKey' END)::int AS "candidateKindRowKeys",
        count(DISTINCT CASE
          WHEN sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_candidate_expenditure_bulk')
           AND ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL
          THEN ei.metadata->>'rowKey' END)::int AS "candidateKindEligibleRowKeys",
        count(DISTINCT CASE
          WHEN sd.source_kind='campaign_finance_bulk'
          THEN ei.metadata->>'rowKey' END)::int AS "legacyKindCandidateRowKeys",
        count(DISTINCT CASE
          WHEN sd.source_kind='campaign_finance_bulk'
           AND ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL
          THEN ei.metadata->>'rowKey' END)::int AS "legacyKindEligibleRowKeys",
        count(DISTINCT CASE
          WHEN sd.source_kind='campaign_finance_bulk'
           AND (ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true' OR ei.published_at IS NULL)
          THEN ei.metadata->>'rowKey' END)::int AS "legacyKindNotEligibleRowKeys"
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      WHERE ei.metadata->>'subtype' IN ('candidate_contribution_record','candidate_expenditure_record')
        AND ei.metadata->>'rowKey' IS NOT NULL
    `);

    const duplicatePlacement=await pool.query(`
      WITH placements AS (
        SELECT ei.metadata->>'rowKey' AS row_key,
               bool_or(sd.source_kind='campaign_finance_bulk') AS has_legacy,
               bool_or(sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_candidate_expenditure_bulk')) AS has_candidate_kind
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        WHERE ei.metadata->>'subtype' IN ('candidate_contribution_record','candidate_expenditure_record')
          AND ei.metadata->>'rowKey' IS NOT NULL
        GROUP BY ei.metadata->>'rowKey'
      )
      SELECT
        count(*) FILTER (WHERE has_legacy AND has_candidate_kind)::int AS "rowKeysInBoth",
        count(*) FILTER (WHERE has_legacy AND NOT has_candidate_kind)::int AS "legacyOnlyRowKeys",
        count(*) FILTER (WHERE NOT has_legacy AND has_candidate_kind)::int AS "candidateKindOnlyRowKeys"
      FROM placements
    `);

    const checkpoints=await pool.query(`
      SELECT
        count(*)::int AS "checkpointRows",
        count(DISTINCT scope)::int AS "checkpointedGroups",
        count(*) FILTER (WHERE metadata->>'disposition'='complete_with_fail_closed_proof_exclusions')::int AS "checkpointGroupsWithProofExclusions",
        coalesce(sum((metadata->>'disclosureMappedRows')::int),0)::int AS "checkpointDisclosureMappedRows"
      FROM ingestion_runs
      WHERE source_system='cfb-candidate-finance-membership-tail-group'
        AND status='complete'
        AND metadata->>'checkpointVersion'='membership-tail-group-v1'
    `);

    console.log(JSON.stringify({
      cfbCandidateFinanceEligibilityAudit: {
        bySourceKind: bySourceKind.rows,
        totals: totals.rows[0],
        duplicatePlacement: duplicatePlacement.rows[0],
        checkpoints: checkpoints.rows[0],
        interpretation: {
          readOnly: true,
          noEvidenceWrites: true,
          noServingChanges: true,
        },
      },
    },null,2));
  } finally {
    await pool.end();
  }
}
main().catch(error=>{ console.error(safe(error)); process.exitCode=1; });
