/**
 * CFB issue-specific finance feature feasibility (read-only protected runner).
 * Identifies available donor registration IDs and literal bill-position overlaps.
 * "Name hints" are NEVER source-certified PAC/parent-organization identities.
 * Logs only aggregate integers; no private or identifying donation details.
 */
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection}
 from '../src/operations/senate-media-neon-api-readonly.js';
import {
 classifyLiteralPublisherBillPosition
} from '../src/evidence/cfb-issue-financial-relationships-shadow.mjs';

const MARKER='SENATE_864_CFB_ISSUE_FINANCE_FEASIBILITY_V1';
const MAX_FINANCE=250000;
const HASH=/^[a-f0-9]{64}$/;
const REG=/^[0-9]{3,8}$/;
// Contemporary CFB publicly registered committee IDs: 70001 Chamber
// Leadership Fund, 30558 Education Minn PAC, 30025 MN AFL-CIO.
// Official CFB list + publisher links in the v1 research document. These are
// *source-verification leads*, NOT a PAC↔publisher affiliation crosswalk.
const PUBLIC_ORGANIZATION_PAC_LEAD_REGISTRATIONS=new Set(['70001','30558','30025']);
const moneyString=x=>Number.isFinite(Number(x))&&Number(x)>0;
export function organizationNameHint(value){
 // Candidate lead ONLY. The exact same spelling does not establish legal
 // entity identity, committee affiliation, or a contribution relationship.
 return String(value??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function safeRecordKey(x){
 const family=x.family;
 const k=x.row_key;
 const reg=x.reg;
 if(!family||!HASH.test(k??''))return null;
 if(family==='candidate_contribution')
  return REG.test(reg??'')?family+'|'+reg+'|'+k:null;
 // Independent expenditures affect a candidate; their filer is the SPENDER,
 // never a contribution received by the candidate. Preserve resolved member
 // identity when the affected candidate's committee registration is absent.
 if(family==='independent_expenditure'){
  const target=REG.test(reg??'')?reg:x.member_id;
  return target?family+'|'+target+'|'+k:null;
 }
 return null;
}
export function scoreFinanceIssueFeasibility(financeRows,positions,knownExactCount){
 if(!Number.isSafeInteger(knownExactCount)||knownExactCount<0||
  !Array.isArray(financeRows)||financeRows.length>MAX_FINANCE||
  !Array.isArray(positions)||positions.length>5000)
  throw Error('Finance issue feasibility inputs exceed approved bounds');
 const stats={
  schema:'cfb-864-issue-finance-crosswalk-feasibility-v1',
  inputFinanceEvidenceCopies:financeRows.length,
  uniqueCandidateContributionRows:0,
  uniqueIndependentExpenditureRows:0,
  candidateContributionRowsWithContributorRegistration:0,
  candidateContributionRowsWithNamedContributor:0,
  candidateContributionRowsWithEmployer:0,
  candidateContributionRowsWithMember:0,
  candidateContributionRowsWithTransactionDate:0,
  candidateContributionRowsWithStoredAsOfLabel:0,
  candidateContributionRowsWithIndependentArchiveProofLabel:0,
  independentExpenditureRowsWithSpenderRegistration:0,
  independentExpenditureRowsWithSupportOpposeDirection:0,
  distinctContributorRegistrations:0,
  distinctSpenderRegistrations:0,
  candidateContributionNamesExactlyMatchingPublisherGroups:0,
  candidateRowsFromThreePublicPacResearchLeads:0,
  distinctPublicPacResearchLeadRegistrationsObserved:0,
  uniquePotentialDonorEntityNameHints:0,
  organizationPublisherGroups:0,
  groupBillPositionRows:positions.length,
  groupBillPositionsWithResolvedBill:0,
  groupBillPositionsWithExplicitWholeBillStance:0,
  groupBillPositionsWithSourcePublishedDate:0,
  distinctBillsWithExplicitGroupStances:0,
  distinctGroupsWithExplicitBillStances:0,
  publicationDatedWholeBillPositions:0,
  candidateRowsWithCertifiedOrganizationIssueCrosswalk:0,
  canonicalRowKeyConflicts:0,
  existingExactCanonicalTransactionLinks:knownExactCount,
  historicalAsOfEligibilityUnchanged:true,
  forecastingInputsUnchanged:true,
  privateNamesExposed:false
 };
 const groups=new Set(positions.map(p=>p.group_name).filter(Boolean));
 const normalized=new Set([...groups].map(organizationNameHint).filter(Boolean));
 const billIds=new Set(),stanceGroups=new Set();
 for(const p of positions){
  if(p.bill_id)stats.groupBillPositionsWithResolvedBill++;
  if(p.published_on)stats.groupBillPositionsWithSourcePublishedDate++;
  const stance=classifyLiteralPublisherBillPosition(p.group_position_raw);
  if(!stance||!p.bill_id)continue;
  stats.groupBillPositionsWithExplicitWholeBillStance++;
  billIds.add(p.bill_id);stanceGroups.add(p.group_name);
  if(p.published_on)stats.publicationDatedWholeBillPositions++;
 }
 stats.organizationPublisherGroups=groups.size;
 stats.distinctBillsWithExplicitGroupStances=billIds.size;
 stats.distinctGroupsWithExplicitBillStances=stanceGroups.size;
 const unique=new Map(),conflict=new Set();
 for(const row of financeRows){
  const k=safeRecordKey(row);
  if(!k)continue;
  const old=unique.get(k);
  if(!old){unique.set(k,row);continue;}
  const fields=['family','reg','member_id','contributor_reg','contributor_name',
   'spender_reg','transaction_date','amount','direction'];
  if(fields.some(x=>String(old[x]??'')!==String(row[x]??'')))conflict.add(k);
 }
 for(const k of conflict)unique.delete(k);
 stats.canonicalRowKeyConflicts=conflict.size;
 const donorRegs=new Set(),spenderRegs=new Set(),nameHints=new Set(),leadRegs=new Set();
 for(const row of unique.values()){
  if(row.family==='candidate_contribution'){
   stats.uniqueCandidateContributionRows++;
   if(REG.test(row.contributor_reg??'')){
    stats.candidateContributionRowsWithContributorRegistration++;
    donorRegs.add(row.contributor_reg);
    if(PUBLIC_ORGANIZATION_PAC_LEAD_REGISTRATIONS.has(row.contributor_reg)){
     stats.candidateRowsFromThreePublicPacResearchLeads++;
     leadRegs.add(row.contributor_reg);
    }
   }
   if(row.contributor_name)stats.candidateContributionRowsWithNamedContributor++;
   if(row.employer)stats.candidateContributionRowsWithEmployer++;
   if(row.member_id)stats.candidateContributionRowsWithMember++;
   if(/^20\d\d-\d\d-\d\d$/.test(row.transaction_date??''))
    stats.candidateContributionRowsWithTransactionDate++;
   if(row.as_of_eligible==='true'&&row.published_on)
    stats.candidateContributionRowsWithStoredAsOfLabel++;
   if(row.availability_proof==='independent_archive_capture_exact_row')
    stats.candidateContributionRowsWithIndependentArchiveProofLabel++;
   // Just identify same-letter potential organization name leads; PAC legal
   // identities are never auto-matched, regardless of these counts.
   const hint=organizationNameHint(row.contributor_name);
   if(hint&&normalized.has(hint)&&REG.test(row.contributor_reg??'')){
    stats.candidateContributionNamesExactlyMatchingPublisherGroups++;
    nameHints.add(hint);
   }
  }else if(row.family==='independent_expenditure'){
   stats.uniqueIndependentExpenditureRows++;
   if(REG.test(row.spender_reg??'')){
    stats.independentExpenditureRowsWithSpenderRegistration++;
    spenderRegs.add(row.spender_reg);
   }
   if(/^(for|against)$/i.test(row.direction??''))
    stats.independentExpenditureRowsWithSupportOpposeDirection++;
  }
 }
 stats.distinctContributorRegistrations=donorRegs.size;
 stats.distinctPublicPacResearchLeadRegistrationsObserved=leadRegs.size;
 stats.distinctSpenderRegistrations=spenderRegs.size;
 stats.uniquePotentialDonorEntityNameHints=nameHints.size;
 // No official affiliation crosswalk is assumed merely because two names
 // resemble one another. Separate source-backed crosswalk project required.
 const numeric=Object.values(stats).filter(x=>typeof x==='number');
 if(numeric.some(n=>!Number.isSafeInteger(n)||n<0||n>MAX_FINANCE))
  throw Error('Unsafe issue feasibility summary');
 return stats;
}

const SQL_FINANCE=[
 "SELECT ei.metadata->>'rowKey' AS row_key,",
 "CASE WHEN ei.metadata->>'subtype'='independent_expenditure_record'",
 "THEN ei.metadata->>'affectedCommitteeRegistrationNumber'",
 "ELSE ei.metadata->>'filerRegistrationNumber' END AS reg,",
 'ei.membership_id::text AS member_id,',
 "ei.metadata->>'contributorRegistrationNumber' AS contributor_reg,",
 "ei.metadata->>'contributor' AS contributor_name,",
 "ei.metadata->>'contributorType' AS contributor_type,",
 "ei.metadata->>'employer' AS employer,",
 "ei.metadata->>'spenderRegistrationNumber' AS spender_reg,",
 "ei.metadata->>'direction' AS direction,",
 "ei.metadata->>'transactionDate' AS transaction_date,",
 "ei.metadata->>'amount' AS amount,",
 "ei.metadata->>'asOfEligible' AS as_of_eligible,",
 "ei.metadata->>'availabilityProof' AS availability_proof,",
 'ei.published_at::date::text AS published_on,',
 "CASE",
 "WHEN sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk')",
 "AND ei.metadata->>'subtype'='candidate_contribution_record' THEN 'candidate_contribution'",
 "WHEN sd.source_kind='campaign_finance_independent_expenditure_bulk'",
 "AND ei.metadata->>'subtype'='independent_expenditure_record' THEN 'independent_expenditure'",
 'ELSE NULL END AS family',
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 'LEFT JOIN memberships m ON m.id=ei.membership_id',
 'LEFT JOIN chambers c ON c.id=m.chamber_id',
 "WHERE sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk',",
 "'campaign_finance_independent_expenditure_bulk')",
 "AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025')",
 "AND (c.slug='senate' OR (c.slug IS NULL AND ei.metadata->>'chamber'='senate'))",
 "AND ei.metadata->>'rowKey' ~ '^[a-f0-9]{64}$'"
].join(' ');
const SQL_POSITIONS=[
 'SELECT p.group_name,p.bill_id::text,p.group_position_raw,',
 's.published_on::text AS published_on',
 'FROM senate_scorecard_vote_positions p',
 'JOIN senate_scorecard_snapshots s ON s.id=p.snapshot_id',
 'WHERE p.year BETWEEN 2021 AND 2025'
].join(' ');
function assertProductionGuard(env){
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_REF!=='refs/heads/main'||
  env.GITHUB_RUN_ATTEMPT!=='1'||!(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''))||
  env.VOTEPREDICT_CFB_ISSUE_FEASIBILITY_KEYLESS_PASSED!=='true'||
  env.VOTEPREDICT_CFB_ISSUE_FEASIBILITY_MARKER!=='true')
  throw Error('Reviewed first-attempt main issue-finance audit required');
}
export async function main(){
 assertProductionGuard(process.env);
 const existing=await discoverExistingVotePredictNeonConnection({
  apiKey:process.env.NEON_API_KEY,
  projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID,
  preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,
  requirePrimary:true
 });
 const pool=new Pool({host:existing.host,port:existing.port,user:existing.role,
  password:existing.password,database:existing.database,
  ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:15000,statement_timeout:180000,query_timeout:180000,
  application_name:'votepredict-cfb-issue-finance-readonly',
  options:'-c statement_timeout=180000 -c lock_timeout=4000'});
 const client=await pool.connect();let opened=false;
 try{
  const who=(await client.query('SELECT current_database() AS db,current_user AS role')).rows[0];
  if(who?.db!==existing.database||who?.role!==existing.role)
   throw Error('Unexpected existing primary database identity');
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  opened=true;
  const state=(await client.query(
   "SELECT current_setting('transaction_read_only') AS read_only"
  )).rows[0];
  if(state.read_only!=='on')throw Error('Expected repeatable read-only transaction');
  const registry=(await client.query([
   'SELECT count(*)::int AS report_versions,',
   'count(DISTINCT full_original_pdf_sha256)::int AS bodies',
   'FROM cfb_official_senate_pdf_versions'
  ].join(' '))).rows[0];
  if(registry.report_versions!==830||registry.bodies!==813)
   throw Error('Unexpected official 830-report/813-body CFB source census');
  const [finance,positions,oldExact]=await Promise.all([
   client.query(SQL_FINANCE),
   client.query(SQL_POSITIONS),
   client.query([
    'SELECT count(DISTINCT (family,committee_registration,transaction_year,canonical_row_key))::int AS linked',
    'FROM cfb_finance_report_transaction_links',
    "WHERE match_status='exact'"
   ].join(' '))
  ]);
  if(finance.rows.length>MAX_FINANCE||positions.rows.length>5000)
   throw Error('Unexpected candidate source census');
  const result=scoreFinanceIssueFeasibility(finance.rows,positions.rows,
   oldExact.rows[0]?.linked??0);
  await client.query('ROLLBACK');opened=false;
  console.log('CFB_ISSUE_FINANCE_FEASIBILITY_SAFE_COUNTS '+JSON.stringify(result));
 }finally{
  if(opened)await client.query('ROLLBACK').catch(()=>{});
  client.release(true);await pool.end();
 }
}
if(import.meta.url==='file://'+process.argv[1]||
 process.argv[1]?.endsWith('/audit-cfb-issue-financial-feasibility-readonly.mjs'))
 main().catch(()=>{console.error('CFB_ISSUE_FINANCE_FEASIBILITY_HELD');process.exitCode=1;});
