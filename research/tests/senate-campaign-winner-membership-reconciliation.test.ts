import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import officialJson from '../../data/evaluation/senate-targeted-official-general-election-outcomes-2022-25-v1.json' with {type:'json'};
import {
  reconcileHistoricalCampaignWinnerExcerpts,
  type OutcomeManifest,type RestrictedMemberExport,
} from '../../src/evidence/senate-campaign-winner-membership-reconciliation.js';
const official=officialJson as OutcomeManifest;
const ids=[
'10000000-0000-4000-8000-000000000001',
'10000000-0000-4000-8000-000000000002',
'10000000-0000-4000-8000-000000000003',
];
function fakeRestrictedSandbox():RestrictedMemberExport{
 return {
  schema:'senate-campaign-membership-evidence-ro-export-v1',
  scope:{
    kind:'direct_neon_protected_sandbox_read_only',
    defaultProductionFalse:true,readOnlyTransactionConfirmed:true,
    restrictedDatabaseRoleValidated:true,session:'2025-2026',
    checkedDistricts:['6','29','45'],
    completenessOfDistrictSnapshot:true,
    connectedToActualProductionEvidence:false,
    doesNotAssertProductionCompleteness:true,
  },exportedAt:'2026-10-10T21:00:00.000Z',
  members:[
    {membershipId:ids[0],senatorName:'Ann Johnson Stewart',sessionSlug:'2025-2026',
     district:'45',startsOn:'2025-01-07',endsOn:null,party:'DFL',recordedIssuePositionItems:2},
    {membershipId:ids[1],senatorName:'Keri Heintzeman',sessionSlug:'2025-2026',
     district:'6',startsOn:'2025-05-01',endsOn:null,party:'R',recordedIssuePositionItems:1},
    {membershipId:ids[2],senatorName:'Michael Holmstrom, Jr.',sessionSlug:'2025-2026',
     district:'29',startsOn:'2025-11-05',endsOn:null,party:'R',recordedIssuePositionItems:1},
  ],evidence:[
    {evidenceItemId:'20000000-0000-4000-8000-000000000001',membershipId:ids[0],
     sourceDocumentId:'30000000-0000-4000-8000-000000000001',
     sourceUrl:'https://annjohnsonstewart.com/priorities/',
     sourceContentSha256:'c06cf92b63e2785504115cc618dedad6518052bb176ba29a0eb75d4cb6d2ac5e',
     sourceKind:'campaign_site',sourceSubtype:'campaign_site_page',
     contextType:'issue_position',issueFamily:'health',stance:'supports',
     publishedAt:'2024-09-04T05:28:50.000Z',
     excerptMatches:[{excerptId:'ajs24-abortion-care',exactExcerptPresent:true}]},
  ]
 };
}
test('4 original candidates join only 3 winning people; 10 winning and 3 losing excerpts',()=>{
 const r=reconcileHistoricalCampaignWinnerExcerpts(official);
 assert.equal(r.totals.electionOutcomeRacesCrossChecked,6);
 assert.equal(r.totals.candidateIssuePageLeadsChecked,4);
 assert.equal(r.totals.winnerCandidateSources,3);
 assert.equal(r.totals.loserCandidateSources,1);
 assert.equal(r.totals.winnerIssueExcerptLeads,10);
 assert.equal(r.totals.loserIssueExcerptLeads,3);
 assert.equal(r.totals.uniquelyJoinedRestrictedSandboxMemberships,0);
 assert.equal(r.totals.restrictedSandboxExistingExactExcerptSpanHits,null);
 assert.equal(r.scope.actualProductionDBEvidenceAudited,false);
 assert.ok(r.sourceRows.every(c=>c.membershipId===null&&!c.eligibleForForecastNow));
 assert.equal(r.sourceRows.find(c=>c.candidateName==='Louis McNutt')?.membershipJoinStatus,
   'losing_opponent_excluded');
 assert.ok(r.sourceRows.filter(x=>x.electionOutcome==='winner').every(x=>
   x.membershipJoinStatus==='not_queried'));
});
test('sandbox-only read-only membership names, district and session join three winners, never loser',()=>{
 const r=reconcileHistoricalCampaignWinnerExcerpts(official,undefined,fakeRestrictedSandbox());
 assert.equal(r.totals.uniquelyJoinedRestrictedSandboxMemberships,3);
 assert.equal(r.totals.ambiguousMembershipCandidates,0);
 assert.equal(r.totals.restrictedSandboxSameOriginalHtmlHashEvidenceRows,1);
 assert.equal(r.totals.restrictedSandboxExistingExactExcerptSpanHits,1);
 assert.equal(r.sourceRows.find(x=>x.candidateName==='Michael Holmstrom Jr')?.membershipId,ids[2]);
 assert.equal(r.sourceRows.find(x=>x.candidateName==='Louis McNutt')?.membershipId,null);
 assert.equal(r.sourceRows.find(x=>x.candidateName==='Louis McNutt')?.existingCampaignSiteEvidenceRowsInExport,0);
 assert.ok(r.sourceRows.filter(x=>x.electionOutcome==='winner').every(x=>
   x.membershipJoinStatus==='unique_name_district_session_and_date_match'));
 assert.equal(r.scope.sandboxOnlyExportAccepted,true);
 assert.equal(r.scope.authorizedProductionEvidenceReconciliationComplete,false);
});
test('defeated opponent in same district cannot inherit elected senator evidence even when database lists that opponent',()=>{
 const input=fakeRestrictedSandbox();
 input.members[2].senatorName='Louis McNutt';
 const r=reconcileHistoricalCampaignWinnerExcerpts(official,undefined,input);
 const losing=r.sourceRows.find(x=>x.candidateName==='Louis McNutt')!;
 const winning=r.sourceRows.find(x=>x.candidateName==='Michael Holmstrom Jr')!;
 assert.equal(losing.membershipId,null);
 assert.equal(losing.membershipJoinStatus,'losing_opponent_excluded');
 assert.equal(winning.membershipId,null);
 assert.equal(winning.membershipJoinStatus,'member_not_in_restricted_snapshot');
 assert.equal(r.totals.uniquelyJoinedRestrictedSandboxMemberships,2);
});
test('exact observed 2025 SD45 Ann M Johnson Stewart initial is a single district/session-bound candidate identity alias',()=>{
 const x=fakeRestrictedSandbox();
 x.members[0].senatorName='Ann M Johnson Stewart';
 const report=reconcileHistoricalCampaignWinnerExcerpts(official,undefined,x);
 assert.equal(report.totals.uniquelyJoinedRestrictedSandboxMemberships,3);
 const ann=report.sourceRows.find(p=>p.candidateName==='Ann Johnson Stewart')!;
 assert.equal(ann.membershipJoinStatus,'unique_name_district_session_and_date_match');
 assert.equal(ann.membershipNameMatchBasis,'documented_2025_sd45_middle_initial_alias');
 assert.equal(ann.membershipId,ids[0]);
 const other=fakeRestrictedSandbox();
 other.members[0].senatorName='Ann Q Johnson Stewart';
 const unjoined=reconcileHistoricalCampaignWinnerExcerpts(official,undefined,other);
 assert.equal(unjoined.totals.uniquelyJoinedRestrictedSandboxMemberships,2);
 assert.equal(unjoined.sourceRows.find(p=>p.candidateName==='Ann Johnson Stewart')?.membershipId,null);
 const wrongDistrict=fakeRestrictedSandbox();
 wrongDistrict.members[0].district='29';
 const denied=reconcileHistoricalCampaignWinnerExcerpts(official,undefined,wrongDistrict);
 assert.equal(denied.totals.uniquelyJoinedRestrictedSandboxMemberships,2);
});
test('one documented SD45 middle initial maps to Ann Stewart only',()=>{
 const input=fakeRestrictedSandbox();
 input.members[0].senatorName='Ann M Johnson Stewart';
 const correct=reconcileHistoricalCampaignWinnerExcerpts(official,undefined,input);
 assert.equal(correct.totals.uniquelyJoinedRestrictedSandboxMemberships,3);
 assert.equal(correct.sourceRows[0].membershipNameMatchBasis,'documented_2025_sd45_middle_initial_alias');
 const fake=fakeRestrictedSandbox();
 fake.members[0].senatorName='Ann Q Johnson Stewart';
 assert.equal(reconcileHistoricalCampaignWinnerExcerpts(official,undefined,fake)
   .totals.uniquelyJoinedRestrictedSandboxMemberships,2);
});
test('post-election official winner data cannot be smuggled into forecast feature eligibility',()=>{
 const x=structuredClone(official);
 x.candidates.find(c=>c.candidateName==='Louis McNutt')!.generalElectionOutcome='winner';
 assert.throws(()=>reconcileHistoricalCampaignWinnerExcerpts(x),/Exactly one winner expected/);
 const y=structuredClone(official);
 y.candidates.find(c=>c.candidateName==='Michael Holmstrom Jr')!.earlyUseAsModelFeatureProhibited=false as true;
 assert.throws(()=>reconcileHistoricalCampaignWinnerExcerpts(y),/Invalid or backdated/);
});
test('mislabeled SOS publisher, wrong district, duplicate race and unknown year fail closed',()=>{
 const cases=[
   (x:OutcomeManifest)=>{x.sources[0].publisher='not SOS' as 'Minnesota Secretary of State';},
   (x:OutcomeManifest)=>{x.candidates[0].district='66';},
   (x:OutcomeManifest)=>{x.sources[1].id=x.sources[0].id;},
   (x:OutcomeManifest)=>{x.sources[0].electionOn='2026-11-03';},
 ];
 for(const corrupt of cases){
   const x=structuredClone(official);corrupt(x);
   assert.throws(()=>reconcileHistoricalCampaignWinnerExcerpts(x));
 }
});
test('a read-only sandbox export never certifies actual production evidence and requires exact role/transaction flags',()=>{
 const x=fakeRestrictedSandbox();
 x.scope.connectedToActualProductionEvidence=true as false;
 assert.throws(()=>reconcileHistoricalCampaignWinnerExcerpts(official,undefined,x),
   /Read-only sandbox source/);
 const y=fakeRestrictedSandbox();y.scope.readOnlyTransactionConfirmed=false as true;
 assert.throws(()=>reconcileHistoricalCampaignWinnerExcerpts(official,undefined,y),
   /Read-only sandbox source/);
 const z=fakeRestrictedSandbox();z.scope.checkedDistricts=['29','6'];
 assert.throws(()=>reconcileHistoricalCampaignWinnerExcerpts(official,undefined,z),
   /Read-only sandbox source/);
});
test('an ambiguous or wrong-session membership never becomes certified',()=>{
 const input=fakeRestrictedSandbox();
 input.members.push({...input.members[0],membershipId:'10000000-0000-4000-8000-000000000004'});
 const r=reconcileHistoricalCampaignWinnerExcerpts(official,undefined,input);
 assert.equal(r.totals.ambiguousMembershipCandidates,1);
 assert.equal(r.totals.uniquelyJoinedRestrictedSandboxMemberships,2);
 assert.equal(r.sourceRows[0].membershipId,null);
 const wrong=fakeRestrictedSandbox();
 wrong.members[0].sessionSlug='2023-2024';
 assert.throws(()=>reconcileHistoricalCampaignWinnerExcerpts(official,undefined,wrong),
   /Incorrect or duplicated member/);
});
test('campaign evidence with foreign membership, wrong digest or wrong source type fails closed',()=>{
 const x=fakeRestrictedSandbox();x.evidence[0].membershipId=ids[2].replace('000000000003','000000000009');
 assert.throws(()=>reconcileHistoricalCampaignWinnerExcerpts(official,undefined,x),/Unscoped or invalid/);
 const y=fakeRestrictedSandbox();y.evidence[0].sourceContentSha256='garbage';
 assert.throws(()=>reconcileHistoricalCampaignWinnerExcerpts(official,undefined,y),/Unscoped or invalid/);
 const z=fakeRestrictedSandbox();z.evidence[0].sourceSubtype='member_primary_article';
 assert.throws(()=>reconcileHistoricalCampaignWinnerExcerpts(official,undefined,z),/Unscoped or invalid/);
});
test('no-source-content match means unverified, never assert existing source statement absent from production',()=>{
 const x=fakeRestrictedSandbox();
 x.evidence[0].sourceContentSha256='b'.repeat(64);
 x.evidence[0].excerptMatches=[];
 const r=reconcileHistoricalCampaignWinnerExcerpts(official,undefined,x);
 assert.equal(r.totals.restrictedSandboxSameOriginalHtmlHashEvidenceRows,0);
 assert.equal(r.totals.restrictedSandboxExistingExactExcerptSpanHits,0);
 assert.equal(r.scope.authorizedProductionEvidenceReconciliationComplete,false);
});
test('offline CLI generates a small strictly read-only 0600 report and accepts bounded sandbox JSON',()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-winner-identity-'));
 try{
   const src=join(dir,'sandbox.json'),out=join(dir,'out.json'),dry=join(dir,'dry.json');
   const base=['--import','tsx','scripts/reconcile-senate-campaign-winners-offline.ts'];
   execFileSync('node',[...base,'--output',dry],{timeout:15000,stdio:'pipe'});
   const no=JSON.parse(readFileSync(dry,'utf8'));
   assert.equal(no.totals.winnerIssueExcerptLeads,10);
   assert.equal(no.scope.sandboxOnlyExportAccepted,false);
   writeFileSync(src,JSON.stringify(fakeRestrictedSandbox()));
   execFileSync('node',[...base,'--database-export',src,'--output',out],{timeout:15000,stdio:'pipe'});
   const yes=JSON.parse(readFileSync(out,'utf8'));
   assert.equal(yes.totals.uniquelyJoinedRestrictedSandboxMemberships,3);
   assert.equal(yes.totals.restrictedSandboxSameOriginalHtmlHashEvidenceRows,1);
   assert.equal(statSync(out).mode&0o777,0o600);
   assert.throws(()=>execFileSync('node',[...base,'--database-export',src,'--output',out],
     {timeout:15000,stdio:'pipe'}));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
