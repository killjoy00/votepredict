/**
 * Protected READ ONLY source-name affiliation audit after append-only capture.
 * Never prints finance transactions, identities, original HTML or source hashes.
 * Never writes/changes historical availability or models. Current evidence
 * may only be used for STRICTLY later forecast cutoffs.
 */
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection}
 from '../src/operations/senate-media-neon-api-readonly.js';
import {validateCfbIssueSourceManifest}
 from '../src/evidence/cfb-issue-source-observation-v1.mjs';
import {attestCurrentPacSourcePairs,literalBillMentionLeads}
 from '../src/evidence/cfb-issue-pac-original-attestations-v2.mjs';

const VERSION='cfb-issue-finance-original-pac-source-attribution-v2';
const SAFE_STATUSES=new Set([
 'current_dual_original_source_attested','held_no_explicit_first_party_pac_proof',
 'missing_or_invalid_original_source','official_registration_row_not_demonstrated',
 'first_party_pac_identity_not_demonstrated'
]);
const MAX_OBSERVATIONS=100;
const STATIC_SQL=[
 'SELECT source_id,organization_group,source_role,source_url,final_url,',
 'html_sha256,raw_html_bytes,observed_at,claim_status,',
 'historical_asof_eligible,mechanically_actionable,model_weight',
 'FROM cfb_issue_finance_source_observations',
 'WHERE source_id = ANY($1::text[])',
 'ORDER BY source_id,observed_at'
].join(' ');
const FINANCE_SQL=[
 "SELECT ei.metadata->>'contributorRegistrationNumber' AS reg,",
 "COUNT(DISTINCT (ei.metadata->>'filerRegistrationNumber',",
 "ei.metadata->>'rowKey'))::int AS distinct_rows,",
 'COUNT(DISTINCT ei.membership_id)::int AS senators',
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 'LEFT JOIN memberships m ON m.id=ei.membership_id',
 'LEFT JOIN chambers c ON c.id=m.chamber_id',
 "WHERE sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk')",
 "AND ei.metadata->>'subtype'='candidate_contribution_record'",
 "AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025')",
 "AND (c.slug='senate' OR (c.slug IS NULL AND ei.metadata->>'chamber'='senate'))",
 "AND ei.metadata->>'contributorRegistrationNumber' = ANY($1::text[])",
 "AND ei.metadata->>'rowKey' ~ '^[a-f0-9]{64}$'",
 'GROUP BY 1 ORDER BY 1'
].join(' ');
function approvedExecution(e){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  e.GITHUB_REF!=='refs/heads/main'||e.GITHUB_RUN_ATTEMPT!=='1'||
  !/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??'')||
  !['push','schedule','workflow_dispatch'].includes(e.GITHUB_EVENT_NAME)||
  e.VOTEPREDICT_CFB_ISSUE_CAPTURE_KEYLESS_PASSED!=='true'||
  (e.GITHUB_EVENT_NAME==='push'&&
   e.VOTEPREDICT_CFB_ISSUE_CAPTURE_MARKER!=='true'))
  throw Error('Keyless-reviewed main PAC source audit required');
}
export function safePacAttestationSummary(attestation,mentions,byReg,stored){
 const statuses=Object.create(null);
 for(const x of attestation.statuses){
  if(!SAFE_STATUSES.has(x.status))
   throw Error('Unrecognized original PAC source status');
  statuses[x.status]=(statuses[x.status]??0)+1;
 }
 const currentRegs=new Set(attestation.statuses
  .filter(x=>x.status==='current_dual_original_source_attested')
  .map(x=>x.registration));
 const heldRegs=new Set(attestation.statuses
  .filter(x=>x.status!=='current_dual_original_source_attested')
  .map(x=>x.registration));
 const uniqueBills=new Set(mentions.map(x=>x.billIdentifier));
 const rowsCurrent=byReg.filter(x=>currentRegs.has(x.reg))
  .reduce((a,x)=>a+x.distinct_rows,0);
 const rowsHeld=byReg.filter(x=>heldRegs.has(x.reg))
  .reduce((a,x)=>a+x.distinct_rows,0);
 const out={
  schema:VERSION,
  observedOriginalSourceVersions:stored,
  sourceAnchoredCurrentPacIdentities:currentRegs.size,
  currentAsOfDateOnlyEligibleRegisteredEntities:attestation.affiliations.length,
  pacIdentityDispositionCounts:Object.fromEntries(
   Object.entries(statuses).sort((a,b)=>a[0].localeCompare(b[0]))),
  historicalSenateContributionRowsBySourceAttestedContemporaryEntities:rowsCurrent,
  historicalSenateContributionRowsByHeldIdentityEntity:rowsHeld,
  firstPartyNeutralBillMentionLeads:mentions.length,
  distinctLiteralBillNumbersInOriginalFirstPartyIssuePublications:uniqueBills.size,
  literalBillMentionsCertifiedAsPublisherVoteStances:0,
  historicalPreVotePublisherPositionsCertified:0,
  originalHistoricallyExactRowLinksWritten:0,
  retrospectiveDateUpgrades:0,
  modelWeightChanged:false,servingChanged:false,
  originalDonorNamesOrHtmlLogged:false
 };
 for(const value of Object.values(out)){
  if(typeof value==='number'&&
   (!Number.isSafeInteger(value)||value<0||value>100000))
   throw Error('Unsafe PAC research diagnostic count');
 }
 return out;
}
export async function main(){
 approvedExecution(process.env);
 const manifest=validateCfbIssueSourceManifest(JSON.parse(readFileSync(
  'data/evidence/cfb-issue-finance-source-observation-manifest-v1.json','utf8')));
 const config=JSON.parse(readFileSync(
  'data/evidence/cfb-issue-pac-attestation-candidates-v2.json','utf8'));
 const target=await discoverExistingVotePredictNeonConnection({
  apiKey:process.env.NEON_API_KEY,
  projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID,
  preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,
  requirePrimary:true
 });
 const pool=new Pool({host:target.host,port:target.port,user:target.role,
  password:target.password,database:target.database,ssl:{rejectUnauthorized:true},
  max:1,connectionTimeoutMillis:15000,statement_timeout:180000,
  query_timeout:180000,application_name:'votepredict-cfb-current-pac-readonly',
  options:'-c statement_timeout=180000 -c lock_timeout=4000'});
 const client=await pool.connect();
 let open=false;
 try{
  const who=(await client.query(
   "SELECT current_database() AS db,current_user AS role"
  )).rows[0];
  if(who.db!==target.database||who.role!==target.role)
   throw Error('Unexpected existing Neon primary identity');
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  open=true;
  if((await client.query(
   "SELECT current_setting('transaction_read_only') AS ro"
  )).rows[0].ro!=='on')throw Error('Expected read-only transaction');
  const registry=(await client.query([
   'SELECT count(*)::int AS versions,count(DISTINCT full_original_pdf_sha256)::int AS hashes',
   'FROM cfb_official_senate_pdf_versions'
  ].join(' '))).rows[0];
  if(registry.versions!==830||registry.hashes!==813)
   throw Error('Canonical existing 830 original Senate finance reports required');
  const observations=(await client.query(STATIC_SQL,
   [manifest.map(x=>x.id)])).rows;
  if(observations.length>MAX_OBSERVATIONS)
   throw Error('Unexpected source observation history size');
  const rows=observations.map(s=>({
   sourceId:s.source_id,organizationGroup:s.organization_group,
   sourceRole:s.source_role,sourceUrl:s.source_url,finalUrl:s.final_url,
   htmlSha256:s.html_sha256,rawHtmlBytes:s.raw_html_bytes,
   observedAt:new Date(s.observed_at).toISOString(),
   claimStatus:s.claim_status,
   historicalAsOfEligible:s.historical_asof_eligible,
   mechanicallyActionable:s.mechanically_actionable,modelWeight:s.model_weight
  }));
  const cutoffOn=new Date().toISOString().slice(0,10);
  const attestation=attestCurrentPacSourcePairs({
   snapshots:rows,manifest,config,cutoffOn
  });
  const mentions=literalBillMentionLeads(rows,manifest);
  const regs=config.candidates.map(x=>x.contributorRegistrationNumber);
  const byReg=(await client.query(FINANCE_SQL,[regs])).rows;
  await client.query('ROLLBACK');open=false;
  const result=safePacAttestationSummary(
   attestation,mentions,byReg,rows.length);
  console.log('CFB_864_PAC_ATTESTATION_V2_SAFE_COUNTS '+JSON.stringify(result));
 }finally{
  if(open)await client.query('ROLLBACK').catch(()=>{});
  client.release(true);await pool.end();
 }
}
if(import.meta.url==='file://'+process.argv[1]||
 process.argv[1]?.endsWith('/audit-cfb-pac-original-attestations-readonly.mjs'))
 main().catch(()=>{console.error('CFB_864_PAC_ATTESTATION_V2_HELD');process.exitCode=1;});
