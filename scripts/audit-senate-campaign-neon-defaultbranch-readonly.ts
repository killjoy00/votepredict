/**
 * #864 one-shot, owner-comment-triggered read-only VotePredict Neon audit.
 * Uses existing verified VotePredict Neon project/branch; no Vercel, mutation,
 * managed/scheduled ingestion, or claims about deployed production binding.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {Pool} from 'pg';
import original from '../data/evaluation/senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1.json' with {type:'json'};
import outcomeJson from '../data/evaluation/senate-targeted-official-general-election-outcomes-2022-25-v1.json' with {type:'json'};
import {strictCandidateKey} from '../src/evidence/sos-senate-historical-candidate-inventory.js';
import {
  reconcileHistoricalCampaignWinnerExcerpts,
  type RestrictedMemberExport,type OutcomeManifest,
} from '../src/evidence/senate-campaign-winner-membership-reconciliation.js';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';

const APPROVAL='[campaign-864-neon-readonly-evidence]';
const REQUIRED=['memberships','legislators','legislative_sessions','chambers','evidence_items','source_documents'] as const;
const MEMBERS_SQL=[
  'SELECT m.id::text AS "membershipId",l.name::text AS "senatorName",s.slug::text AS "sessionSlug",',
  'm.district::text AS "district",m.starts_on::text AS "startsOn",m.ends_on::text AS "endsOn",',
  'm.party::text AS "party",',
  "COUNT(ei.id) FILTER(WHERE ei.metadata->>'contextType'='issue_position'",
  "AND ei.metadata->>'sourceSubtype'='campaign_site_page'",
  "AND ei.published_at<TIMESTAMPTZ '2026-01-01T00:00:00Z')::integer AS \"recordedIssuePositionItems\"",
  'FROM memberships m JOIN legislators l ON l.id=m.legislator_id',
  'JOIN legislative_sessions s ON s.id=m.session_id JOIN chambers c ON c.id=m.chamber_id',
  'LEFT JOIN evidence_items ei ON ei.membership_id=m.id',
  "WHERE c.slug='senate' AND s.slug='2025-2026' AND m.district IN ('6','29','45')",
  'GROUP BY m.id,l.name,s.slug,m.district,m.starts_on,m.ends_on,m.party',
  'ORDER BY m.district,m.id LIMIT 13',
].join(' ');
const EVIDENCE_SQL=[
  'SELECT ei.id::text AS "evidenceItemId",ei.membership_id::text AS "membershipId",',
  'sd.id::text AS "sourceDocumentId",sd.source_url::text AS "sourceUrl",',
  'sd.content_sha256::text AS "sourceContentSha256",sd.source_kind::text AS "sourceKind",',
  "ei.metadata->>'sourceSubtype' AS \"sourceSubtype\",",
  "ei.metadata->>'contextType' AS \"contextType\",",
  "COALESCE(ei.metadata->>'issueFamily',ei.metadata->>'policyFamily') AS \"issueFamily\",",
  'ei.stance::text AS "stance",',
  "to_char(ei.published_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"publishedAt\",",
  'LEFT(COALESCE(ei.excerpt,\'\'),8192)::text AS "privateExcerptForInMemoryComparisonOnly"',
  'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
  'JOIN memberships m ON m.id=ei.membership_id',
  'JOIN legislative_sessions s ON s.id=m.session_id JOIN chambers c ON c.id=m.chamber_id',
  "WHERE c.slug='senate' AND s.slug='2025-2026' AND m.district IN ('6','29','45')",
  "AND ei.metadata->>'contextType'='issue_position'",
  "AND ei.metadata->>'sourceSubtype'='campaign_site_page'",
  "AND ei.published_at<TIMESTAMPTZ '2026-01-01T00:00:00Z'",
  'ORDER BY ei.id LIMIT 301',
].join(' ');
const CATALOG_SQL=[
  'SELECT names.name AS table_name,to_regclass(\'public.\'||names.name) IS NOT NULL AS present,',
  "COALESCE(has_table_privilege(current_user,to_regclass('public.'||names.name),'SELECT'),false) AS readable",
  'FROM unnest($1::text[]) AS names(name) ORDER BY names.name',
].join(' ');
export function assertOwnerApprovedCampaignNeonRead(env:Record<string,string|undefined>,event:unknown){
  if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||env.GITHUB_REF!=='refs/heads/main'
    ||env.GITHUB_EVENT_NAME!=='issue_comment'
    ||env.VOTEPREDICT_CAMPAIGN_RO_APPROVAL!==APPROVAL
    ||!event||typeof event!=='object'||Array.isArray(event))
    throw Error('Protected owner-only campaign evidence read approval missing');
  const e=event as Record<string,unknown>;
  const issue=e.issue as Record<string,unknown>|undefined;
  const comment=e.comment as Record<string,unknown>|undefined;
  const user=comment?.user as Record<string,unknown>|undefined;
  if(issue?.number!==864||user?.login!=='killjoy00'||comment?.body!==APPROVAL)
    throw Error('Only exact owner-issued #864 audit command is allowed');
}
function cleanUrl(url:string):string {
  let u:URL;
  try{u=new URL(url);}catch{throw Error('Invalid existing evidence source URL');}
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password
    ||u.hostname.length>253||u.pathname.length>512)
    throw Error('Unexpected existing evidence URL format');
  // Never export querystrings, which can contain tokens.
  return u.origin+u.pathname;
}
function n(value:unknown,max:number):number{
  const x=Number(value);
  if(!Number.isSafeInteger(x)||x<0||x>max)throw Error('Unexpected source count');
  return x;
}
type Phase='verified_project'|'opened_sql'|'readonly_transaction_verified'|
           'tables_checked'|'membership_queried'|'evidence_queried'|'rolled_back';
export async function collectExistingCampaignNeonRows(
  input:{apiKey:string;projectId:string;preferredDatabase?:string},
  request:Parameters<typeof discoverExistingVotePredictNeonConnection>[1]=fetch,
  poolFactory:(options:ConstructorParameters<typeof Pool>[0])=>Pick<Pool,'connect'|'end'>=
    options=>new Pool(options),
  phase:(step:Phase)=>void=()=>{},
){
  const target=await discoverExistingVotePredictNeonConnection(input,request);
  phase('verified_project');
  const pool=poolFactory({
    host:target.host,port:target.port,user:target.role,password:target.password,
    database:target.database,ssl:{rejectUnauthorized:true},max:1,
    connectionTimeoutMillis:8000,query_timeout:8000,statement_timeout:7000,
    application_name:'votepredict-864-campaign-source-readonly',
    options:'-c default_transaction_read_only=on -c statement_timeout=7000 -c lock_timeout=700',
  });
  try{
    const client=await pool.connect();
    phase('opened_sql');
    let open=false;
    try{
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      open=true;
      const id=await client.query(
        "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
      );
      if(id.rows.length!==1||id.rows[0].db!==target.database
        ||id.rows[0].role!==target.role||id.rows[0].ro!=='on')
        throw Error('Existing Neon identity/read-only transaction mismatch');
      phase('readonly_transaction_verified');
      const check=await client.query(CATALOG_SQL,[[...REQUIRED]]);
      if(check.rows.length!==REQUIRED.length||check.rows.some((row:Record<string,unknown>)=>
        !REQUIRED.includes(row.table_name as typeof REQUIRED[number])
        ||row.present!==true||row.readable!==true))
        throw Error('Existing VotePredict evidence tables not all readable');
      phase('tables_checked');
      const ms=await client.query(MEMBERS_SQL);
      if(ms.rows.length>=13)throw Error('Restricted membership query is truncated');
      phase('membership_queried');
      const es=await client.query(EVIDENCE_SQL);
      if(es.rows.length>=301)throw Error('Restricted evidence query is truncated');
      phase('evidence_queried');

      const official=outcomeJson as OutcomeManifest;
      const elected=new Set(official.candidates.filter(c=>c.generalElectionOutcome==='winner')
        .map(c=>strictCandidateKey(c.candidateName)+'|'+c.district));
      const memberToWinner=new Map<string,string>();
      const members=ms.rows.map((row:Record<string,unknown>)=>{
        if(typeof row.membershipId!=='string'||typeof row.senatorName!=='string'
          ||typeof row.sessionSlug!=='string'||typeof row.district!=='string')
          throw Error('Invalid source membership row');
        const k=strictCandidateKey(row.senatorName)+'|'+row.district;
        if(elected.has(k))memberToWinner.set(row.membershipId,k);
        return {
          membershipId:row.membershipId,senatorName:row.senatorName,
          sessionSlug:row.sessionSlug,district:row.district,
          startsOn:row.startsOn??null,endsOn:row.endsOn??null,
          party:row.party,recordedIssuePositionItems:n(row.recordedIssuePositionItems,100000),
        };
      });
      const known=original.candidates.filter(c=>
        elected.has(strictCandidateKey(c.candidateName)+'|'+c.district));
      const evidence=es.rows.map((row:Record<string,unknown>)=>{
        if(typeof row.membershipId!=='string'||typeof row.sourceUrl!=='string')
          throw Error('Invalid bounded historical source row');
        const membershipId=row.membershipId as string;
        const candidate=known.find(c=>
          strictCandidateKey(c.candidateName)+'|'+c.district===memberToWinner.get(membershipId));
        const comparison=typeof row.privateExcerptForInMemoryComparisonOnly==='string'
          ?row.privateExcerptForInMemoryComparisonOnly.replace(/\s+/g,' ').toLowerCase():'';
        // Never persist or log database excerpt text or original claim.
        return {
          evidenceItemId:row.evidenceItemId,membershipId:row.membershipId,
          sourceDocumentId:row.sourceDocumentId,sourceUrl:cleanUrl(row.sourceUrl),
          sourceContentSha256:row.sourceContentSha256,sourceKind:row.sourceKind,
          sourceSubtype:row.sourceSubtype,contextType:row.contextType,
          issueFamily:row.issueFamily,stance:row.stance,publishedAt:row.publishedAt,
          excerptMatches:(candidate?.excerpts??[]).map(e=>({
            excerptId:e.id,
            exactExcerptPresent:comparison.includes(
              e.exactShortExcerptFromOriginalArchivedPage.replace(/\s+/g,' ').toLowerCase(),
            ),
          })),
        };
      });
      const exported:RestrictedMemberExport={
        schema:'senate-campaign-membership-evidence-ro-export-v1',
        scope:{
          kind:'existing_votepredict_default_branch_read_only',
          defaultProductionFalse:true,readOnlyTransactionConfirmed:true,
          restrictedDatabaseRoleValidated:false,directNeonProjectIdentityVerified:true,
          declaredDatabaseOwnerRoleMayWrite:true,
          session:'2025-2026',checkedDistricts:['6','29','45'],
          completenessOfDistrictSnapshot:true,
          connectedToActualProductionEvidence:false,
          doesNotAssertProductionCompleteness:true,
        },
        exportedAt:new Date().toISOString(),
        members:members as RestrictedMemberExport['members'],
        evidence:evidence as RestrictedMemberExport['evidence'],
      };
      const joined=reconcileHistoricalCampaignWinnerExcerpts(official,undefined,exported);
      await client.query('ROLLBACK');open=false;
      phase('rolled_back');
      return {exported,joined};
    }finally{
      if(open)try{await client.query('ROLLBACK');}catch{/* never retry writes */}
      client.release(true);
    }
  }finally{await pool.end();}
}
async function main(){
  if(process.argv.length!==2||!process.env.GITHUB_EVENT_PATH)
    throw Error('Dedicated GitHub issue comment workflow only');
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')) as unknown;
  assertOwnerApprovedCampaignNeonRead(process.env,event);
  const result=await collectExistingCampaignNeonRows({
    apiKey:process.env.NEON_API_KEY?.trim()??'',
    projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
    preferredDatabase:process.env.VOTEPREDICT_CAMPAIGN_NEON_DATABASE?.trim()||undefined,
  },fetch,undefined,step=>console.log(JSON.stringify({campaignReadOnlyPhase:step,completed:true})));
  const path='artifacts/senate-campaign-2025-neon-readonly-reconciliation-v1.json';
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,JSON.stringify({
    reportSchema:'senate-2025-existing-neon-campaign-issue-reconciliation-v1',
    sourceKind:'existing_neon_default_branch_readonly_transaction',
    deployedProductionBindingIndependentlyVerified:false,
    existingOwnerRoleStrictlySelectOnlyClaimed:false,
    credentialsLogged:false,sourceExcerptTextExported:false,
    dbMutations:0,forecastFeaturesAdded:0,
    exported:result.exported,joined:result.joined,
  },null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({
    result:'existing_neon_default_branch_bounded_READ_ONLY_rows_exported',
    membershipRows:result.exported.members.length,evidenceRows:result.exported.evidence.length,
    joinedWinners:result.joined.totals.uniquelyJoinedRestrictedSandboxMemberships,
    loserExcerptsExcluded:3,sourceBodyTextLogged:false,modelUpdates:0,
  }));
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-campaign-neon-defaultbranch-readonly.ts')){
  main().catch(()=>{
    // No PG error objects, URLs or credentials in public CI logs.
    console.error('Protected campaign evidence Neon READ ONLY audit failed closed; no statement promotion');
    process.exitCode=1;
  });
}
