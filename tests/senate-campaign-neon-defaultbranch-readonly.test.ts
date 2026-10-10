import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {Pool} from 'pg';
import {assertOwnerApprovedCampaignNeonRead,collectExistingCampaignNeonRows} from '../scripts/audit-senate-campaign-neon-defaultbranch-readonly.js';
const PROJECT='blue-fog-12345',BRANCH='br-quiet-hill-123',ENDPOINT='ep-small-moon-123';
const HOST='ep-small-moon-123.us-east-2.aws.neon.tech',ROOT='https://console.neon.tech/api/v2/projects/'+PROJECT;
const APIKEY='VERY_PRIVATE_TEST_KEY',PASS='VERY_PRIVATE_TEST_PASSWORD';
const CONFIG={apiKey:APIKEY,projectId:PROJECT};
const URI='postgresql://neondb_owner:'+PASS+'@'+HOST+'/neondb?sslmode=require&channel_binding=require';
function fakeNeon(url:string,init:RequestInit):Promise<Response>{
 assert.equal(init.method,'GET');
 let result:unknown;
 if(url===ROOT)result={project:{id:PROJECT,name:'VotePredict',default_branch_id:BRANCH}};
 else if(url===ROOT+'/branches?limit=100')result={branches:[{
   id:BRANCH,project_id:PROJECT,default:true,name:'main',
 }],pagination:{next:null}};
 else if(url===ROOT+'/branches/'+BRANCH+'/databases')result={databases:[{
   name:'neondb',owner_name:'neondb_owner',branch_id:BRANCH,
 }]};
 else if(url===ROOT+'/endpoints')result={endpoints:[{
   id:ENDPOINT,host:HOST,project_id:PROJECT,branch_id:BRANCH,type:'read_write',
 }]};
 else if(url.startsWith(ROOT+'/connection_uri?'))result={uri:URI};
 else throw Error('Unexpected management API URL');
 return Promise.resolve(new Response(JSON.stringify(result),{status:200}));
}
const ownerEnv={
 GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_REF:'refs/heads/main',
 GITHUB_EVENT_NAME:'issue_comment',
 VOTEPREDICT_CAMPAIGN_RO_APPROVAL:'[campaign-864-neon-readonly-evidence]',
};
const event={issue:{number:864},comment:{user:{login:'killjoy00'},body:'[campaign-864-neon-readonly-evidence]'}};
test('owner exact GitHub main-branch source gate blocks wrong issue, user, comment and PR',()=>{
 assert.doesNotThrow(()=>assertOwnerApprovedCampaignNeonRead(ownerEnv,event));
 for(const invalid of [
  [{...ownerEnv,GITHUB_REF:'refs/heads/a-pr'},event],
  [{...ownerEnv,GITHUB_EVENT_NAME:'pull_request'},event],
  [ownerEnv,{...event,issue:{number:847}}],
  [ownerEnv,{...event,comment:{...event.comment,user:{login:'somebody'}}}],
  [ownerEnv,{...event,comment:{...event.comment,body:'[campaign-864-neon-readonly-evidence] please run twice'}}],
 ] as const){
  assert.throws(()=>assertOwnerApprovedCampaignNeonRead(invalid[0],invalid[1]),/approval|command/);
 }
});
test('existing Neon default-branch named senator reconciliation remains a bounded single READ ONLY transaction',async()=>{
 const queries:string[]=[];let released=0,closed=0;
 const uuids=[
   '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000003',
 ];
 const fakePool=(options:ConstructorParameters<typeof Pool>[0])=>{
  assert.deepEqual(options?.ssl,{rejectUnauthorized:true});
  assert.equal(options?.user,'neondb_owner');
  assert.equal(options?.host,HOST);
  assert.match(String(options?.options),/default_transaction_read_only=on/);
  return {
   connect:async()=>({
    query:async(sql:string,params?:unknown[])=>{
     queries.push(sql);
     if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return {rows:[]};
     if(sql.includes('current_database()'))
       return {rows:[{db:'neondb',role:'neondb_owner',ro:'on'}]};
     if(sql.includes('to_regclass'))
       return {rows:(params?.[0] as string[]).map(table=>({table_name:table,present:true,readable:true}))};
     if(sql.includes('GROUP BY m.id'))return {rows:[
       {membershipId:uuids[0],senatorName:'Ann Johnson Stewart',sessionSlug:'2025-2026',
        district:'45',startsOn:'2025-01-07',endsOn:null,party:'DFL',recordedIssuePositionItems:2},
       {membershipId:uuids[1],senatorName:'Keri Heintzeman',sessionSlug:'2025-2026',
        district:'6',startsOn:'2025-05-01',endsOn:null,party:'R',recordedIssuePositionItems:1},
       {membershipId:uuids[2],senatorName:'Michael Holmstrom, Jr.',sessionSlug:'2025-2026',
        district:'29',startsOn:'2025-11-05',endsOn:null,party:'R',recordedIssuePositionItems:0},
     ]};
     if(sql.includes('ei.id::text'))return {rows:[{
       evidenceItemId:'20000000-0000-4000-8000-000000000001',
       membershipId:uuids[0],
       sourceDocumentId:'30000000-0000-4000-8000-000000000001',
       sourceUrl:'https://annjohnsonstewart.com/priorities/?private=token',
       sourceContentSha256:'c06cf92b63e2785504115cc618dedad6518052bb176ba29a0eb75d4cb6d2ac5e',
       sourceKind:'campaign_site',sourceSubtype:'campaign_site_page',
       contextType:'issue_position',issueFamily:'health',stance:'supports',
       publishedAt:'2024-09-04T05:28:50.000Z',
       privateExcerptForInMemoryComparisonOnly:'Vigorously defend abortion care for constituents',
     }]};
     throw Error('Unknown test SQL issued '+sql);
    },
    release:()=>{released++},
   }),
   end:async()=>{closed++},
  } as unknown as Pick<Pool,'connect'|'end'>;
 };
 const phases:string[]=[];
 const report=await collectExistingCampaignNeonRows(CONFIG,fakeNeon,fakePool,s=>phases.push(s));
 assert.equal(report.joined.totals.uniquelyJoinedRestrictedSandboxMemberships,3);
 assert.equal(report.joined.totals.loserIssueExcerptLeads,3);
 assert.equal(report.joined.totals.restrictedSandboxExistingExactExcerptSpanHits,1);
 assert.equal(report.exported.members.length,3);
 assert.equal(report.exported.evidence.length,1);
 assert.equal(report.exported.evidence[0].sourceUrl,'https://annjohnsonstewart.com/priorities/');
 assert.equal(report.exported.evidence[0].excerptMatches[0].exactExcerptPresent,true);
 assert.equal(report.exported.scope.kind,'existing_votepredict_default_branch_read_only');
 assert.equal(report.exported.scope.restrictedDatabaseRoleValidated,false);
 assert.equal(report.joined.scope.actualProductionDBEvidenceAudited,false);
 assert.equal(report.joined.scope.authorizedProductionEvidenceReconciliationComplete,false);
 assert.equal(JSON.stringify(report).includes('private=token'),false);
 assert.equal(JSON.stringify(report).includes('constituents'),false);
 assert.equal(queries[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert.equal(queries[queries.length-1],'ROLLBACK');
 assert.equal(released,1);assert.equal(closed,1);
 assert.deepEqual(phases,[
  'verified_project','opened_sql','readonly_transaction_verified','tables_checked',
  'membership_queried','evidence_queried','rolled_back',
 ]);
});
test('no SQL source/evidence SELECT on transaction role mismatch, always rollback',async()=>{
 const sql:string[]=[];let rolledBack=0;
 const fakePool=()=>({
  connect:async()=>({
   query:async(stmt:string)=>{
    sql.push(stmt);
    if(stmt==='ROLLBACK'){rolledBack++;return {rows:[]};}
    if(stmt.startsWith('BEGIN'))return {rows:[]};
    return {rows:[{db:'another-db',role:'neondb_owner',ro:'on'}]};
   },
   release:()=>{},
  }),
  end:async()=>{},
 }) as unknown as Pick<Pool,'connect'|'end'>;
 await assert.rejects(()=>collectExistingCampaignNeonRows(CONFIG,fakeNeon,fakePool),/identity\/read-only/);
 assert.equal(rolledBack,1);
 assert.equal(sql.length,3);
});
test('workflow is protected owner-only, never runs from push/schedule/PR and uses no Vercel or DB write',()=>{
 const workflow=readFileSync('.github/workflows/audit-senate-campaign-neon-readonly-once.yml','utf8');
 assert.match(workflow,/issue_comment:/);
 assert.match(workflow,/evidence-readonly-sandbox/);
 assert.match(workflow,/github\.event\.issue\.number == 864/);
 assert.match(workflow,/github\.event\.comment\.user\.login == 'killjoy00'/);
 assert.match(workflow,/secrets\.NEON_API_KEY/);
 assert.match(workflow,/vars\.VOTEPREDICT_NEON_PROJECT_ID/);
 assert.doesNotMatch(workflow,/^\s+(?:push|pull_request|schedule|workflow_dispatch):/m);
 const operative=workflow.split('\n').filter(line=>!/^\s*#/.test(line)).join('\n');
 assert.doesNotMatch(operative,/vercel|DATABASE_URL_UNPOOLED|cron|INSERT INTO|DELETE FROM|UPDATE public\./i);
 const src=readFileSync('scripts/audit-senate-campaign-neon-defaultbranch-readonly.ts','utf8');
 assert.match(src,/BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
 assert.match(src,/ROLLBACK/);
 assert.doesNotMatch(src,/INSERT INTO|DELETE FROM|CREATE TABLE|ALTER TABLE|UPDATE public\./i);
});
