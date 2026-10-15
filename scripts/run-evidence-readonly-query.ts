/**
 * Protected, named, bounded, aggregate-only, EXISTING Neon read-only query.
 * No arbitrary SQL input, no Neon creates/updates, no unredacted credentials.
 */
import { Pool } from 'pg';
import { discoverExistingVotePredictNeonConnection } from '../src/operations/senate-media-neon-api-readonly.js';
import { executeNamedReadOnlyEvidenceQuery, getReadonlyQuery } from '../src/operations/evidence-named-readonly-query.js';

async function main(): Promise<void> {
  if (process.env.GITHUB_ACTIONS!=='true' ||
      process.env.GITHUB_REPOSITORY!=='killjoy00/votepredict' ||
      process.env.GITHUB_REF!=='refs/heads/main' ||
      process.env.GITHUB_EVENT_NAME!=='workflow_dispatch' ||
      process.env.EVIDENCE_RO_RUN!=='true' ||
      process.env.EVIDENCE_RO_APPROVAL!=='READ_ONLY_SANDBOX_AUDIT')
    throw new Error('Protected main-branch read-only workflow approval required');
  // Fail closed before even fetching a Neon connection for invalid input.
  getReadonlyQuery(process.env.EVIDENCE_RO_QUERY ?? '', process.env.EVIDENCE_RO_SCOPE ?? '');
  const apiKey=process.env.NEON_API_KEY?.trim();
  const projectId=process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim();
  if(!apiKey || !projectId) throw new Error('Existing protected Neon credentials are unavailable');
  const target=await discoverExistingVotePredictNeonConnection({
    apiKey,projectId,preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim() || undefined,
  });
  const pool=new Pool({
    host:target.host,
    port:target.port,
    database:target.database,
    user:target.role,
    password:target.password,
    ssl:{rejectUnauthorized:true},
    max:1,
    connectionTimeoutMillis:8000,
    query_timeout:16000,
    statement_timeout:15000,
    application_name:'votepredict-evidence-named-readonly',
    options:'-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=4000',
  });
  try {
    const client=await pool.connect();
    try {
      const output=await executeNamedReadOnlyEvidenceQuery(
        client,
        process.env.EVIDENCE_RO_QUERY ?? '',
        process.env.EVIDENCE_RO_SCOPE ?? '',
        {database:target.database,role:target.role},
      );
      // The allow-list only returns bounded aggregate counts or fixed health.
      console.log(JSON.stringify({status:'bounded_read_only_query_complete',...output,databaseModified:false}));
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch(()=>{
  // Do not leak API errors, Postgres URIs, passwords or private row contents.
  console.error('Protected named read-only evidence query failed; see static checks, without credential details');
  process.exitCode=1;
});
