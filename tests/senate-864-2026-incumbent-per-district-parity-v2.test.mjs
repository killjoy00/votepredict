import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import c from '../data/evaluation/senate-864-2026-49-incumbent-public-source-reference-crosswalk-v1.json' with {type:'json'};
import d from '../data/evaluation/senate-864-2026-incumbent-duckworth-exact-speaker-leads-v1.json' with {type:'json'};
import raw from '../data/evaluation/senate-864-2026-duckworth-four-live-publisher-original-sha-receipts-v1.json' with {type:'json'};
import {compare49IncumbentSourcesV2,V2_MEMBER_METRICS} from '../src/evidence/senate-864-2026-incumbent-source-parity.mjs';
import {
 ONE_SHOT_COMMENT_V2,assertOwnerCommentV2,SOURCE_SQL_V2,MEMBER_CAMPAIGN_COUNTS_SQL,
 auditExisting49CurrentMembershipV2,validateSanitizedV2
} from '../scripts/audit-senate-864-2026-49-incumbent-existing-neon-parity-v2.mjs';
import {MEMBERSHIPS_SQL,CATALOG_SQL,IDENTITY_SQL,REQUIRED}
 from '../scripts/audit-senate-864-2026-49-incumbent-existing-neon-parity.mjs';

const member=r=>({district:String(r.district),senatorName:r.senator,
 membershipId:'member'+String(r.district).padStart(3,'0')});
const ms=c.rows.map(member);
const aggregate=m=>({
 membershipId:m.membershipId,
 campaignIssueRowsCurrentMembership:0,
 campaignDistinctDocumentsCurrentMembership:0,
 campaignIssueRowsRecorded2026:0,
 campaignIssueRowsRecordedPre2026:0,
 campaignIssueRowsUndated:0,
 allSourceIssueRowsRecorded2026:0,
 allSourceIssueRowsCurrentMembership:0
});
const aggs=ms.map(aggregate);
const src=(district,o={})=>{
 const person=c.rows.find(r=>r.district===district);
 return {
  sourceDocumentId:o.sourceDocumentId||'doc'+district,
  sourceUrl:o.sourceUrl||person.researchSourceUrl,
  sourceKind:o.sourceKind||'campaign_site',
  contentSha256:o.contentSha256===undefined?'a'.repeat(64):o.contentSha256,
  sourceEvidenceId:o.sourceEvidenceId===undefined?'evidence'+district:o.sourceEvidenceId,
  membershipId:o.membershipId===undefined?'member'+String(district).padStart(3,'0'):o.membershipId,
  excerpt:o.excerpt===undefined?'Senator policy statement':o.excerpt,
  contextType:o.contextType===undefined?'issue_position':o.contextType,
  sourceSubtype:o.sourceSubtype===undefined?'campaign_site_page':o.sourceSubtype,
  publishedAt:o.publishedAt===undefined?'2026-09-01 12:00:00+00':o.publishedAt
 };
};
const sample=(m=ms,e=[],a=aggs)=>compare49IncumbentSourcesV2(c,d,m,e,a,raw);
const dayCurrent=()=>({
 campaignIssueRowsCurrentMembership:1,campaignDistinctDocumentsCurrentMembership:1,
 campaignIssueRowsRecorded2026:1,campaignIssueRowsRecordedPre2026:0,
 campaignIssueRowsUndated:0,allSourceIssueRowsRecorded2026:1,
 allSourceIssueRowsCurrentMembership:1
});
test('protected V2 source remains a fixed 49-district reviewed public cohort, not all challengers',()=>{
 assert.equal(c.rows.length,49);
 assert.equal(c.rows.reduce((n,x)=>n+x.selectedOlderOriginalSiteExcerpts,0),716);
 assert.equal(d.duckworth.newDated2026SourceLeads.length,4);
 assert.equal(raw.sourcePages.length,4);
 assert.deepEqual(V2_MEMBER_METRICS,[
 'campaignIssueRowsCurrentMembership','campaignDistinctDocumentsCurrentMembership',
 'campaignIssueRowsRecorded2026','campaignIssueRowsRecordedPre2026',
 'campaignIssueRowsUndated','allSourceIssueRowsRecorded2026','allSourceIssueRowsCurrentMembership'
 ]);
});
test('zero selected URLs found does not mean senator has zero other evidence',()=>{
 const counts=aggs.map((a,i)=>i===0?{...a,...dayCurrent()}:a);
 const r=sample(ms,[],counts);
 assert.equal(r.perPublicDistrict.length,49);
 assert.equal(r.groupedStatusCounts.source_url_not_observed_in_bounded_lookup,49);
 assert.equal(r.perPublicDistrict[0].currentMembershipCampaignIssueRows,1);
 assert.equal(r.perPublicDistrict[0].currentMembershipCampaignIssueRowsRecorded2026,1);
 assert.equal(r.perPublicDistrict[0].selectedSourceIssuePositionLinked,false);
 assert.equal(r.candidateIssueEvidenceBeyondCurrentSenateMembershipNotEnumerated,true);
 assert.equal(r.calendarYearIsStoredPublishedAtMetadataNotIndependentOriginalPublication,true);
 assert.equal(r.outputContainsPrivateSourceRows,false);
 assert.doesNotMatch(JSON.stringify(r),/member001|evidence1|https?:\/\//);
});
test('true linked 2026 stored campaign-site issue text is separate from URL-only row and date metadata',()=>{
 const a=aggs.map((x,i)=>i===0?{...x,...dayCurrent()}:x);
 const r=sample(ms,[src(1)],a),x=r.perPublicDistrict[0];
 assert.equal(x.selectedSourceStatus,'matched_exact_url_with_named_senator_evidence');
 assert.equal(x.selectedSourceEvidenceLinked,true);
 assert.equal(x.selectedSourceIssuePositionLinked,true);
 assert.equal(x.selectedSourceCampaignSiteIssuePositionLinked,true);
 assert.equal(x.selectedSourceIssuePositionRecorded2026,true);
 assert.equal(x.currentMembershipCampaignDistinctDocuments,1);
 assert.equal(x.membershipHoldReason,'none');
 const v=validateSanitizedV2({...r,currentTransactionReadOnly:true,
  transactionRollbackCompleted:true,productionMutations:0});
 assert.equal(v.perPublicDistrict[0].currentMembershipCampaignIssueRowsRecorded2026,1);
});
test('stored linked URL with wrong context is NOT a personal issue-position source',()=>{
 const r=sample(ms,[src(2,{contextType:'article_context',sourceSubtype:'media',publishedAt:'2026-03-02 00:00:00+00'})]);
 const x=r.perPublicDistrict.find(p=>p.district===2);
 assert.equal(x.selectedSourceStatus,'matched_exact_url_with_named_senator_evidence');
 assert.equal(x.selectedSourceEvidenceLinked,true);
 assert.equal(x.selectedSourceIssuePositionLinked,false);
 assert.equal(x.selectedSourceIssuePositionRecorded2026,false);
 assert.equal(x.currentMembershipCampaignIssueRows,0);
});
test('2024 original capture is not a 2026 statement despite presence on live 2026 campaign URL',()=>{
 const counts=aggs.map((a,i)=>i===2?{...a,campaignIssueRowsCurrentMembership:1,
  campaignDistinctDocumentsCurrentMembership:1,
  campaignIssueRowsRecordedPre2026:1,allSourceIssueRowsCurrentMembership:1}:a);
 const r=sample(ms,[src(3,{publishedAt:'2024-10-02 08:00:00+00'})],counts);
 const x=r.perPublicDistrict[2];
 assert.equal(x.selectedSourceStatus,'matched_exact_url_with_named_senator_evidence');
 assert.equal(x.selectedSourceIssuePositionRecorded2026,false);
 assert.equal(x.currentMembershipCampaignIssueRowsRecordedPre2026,1);
 assert.equal(x.currentMembershipCampaignIssueRowsRecorded2026,0);
});
test('current senator missing in bounded membership SELECT is HOLD with null metrics, never counted as zero',()=>{
 const members=ms.filter(x=>x.district!=='14');
 const counts=aggs.filter(x=>x.membershipId!=='member014');
 const r=sample(members,[],counts);
 const x=r.perPublicDistrict.find(x=>x.district===14);
 assert.equal(x.selectedSourceStatus,'senator_membership_identity_unresolved');
 assert.equal(x.membershipHoldReason,'no_active_membership_in_stored_2025_26_session');
 assert.equal(x.currentMembershipCampaignIssueRows,null);
 assert.equal(x.currentMembershipCampaignIssueRowsRecorded2026,null);
 assert.equal(r.groupedStatusCounts.senator_membership_identity_unresolved,1);
});
test('suffix variation Holmstrom Jr may reconcile after standalone normalized public surname, but unrelated names remain HOLD',()=>{
 const changed=ms.map(x=>x.district==='29'?{...x,senatorName:'Michael Holmstrom'}:x);
 const r=sample(changed,[src(29)]);
 const x=r.perPublicDistrict.find(x=>x.district===29);
 assert.equal(x.selectedSourceStatus,'matched_exact_url_with_named_senator_evidence');
 const wrong=ms.map(x=>x.district==='29'?{...x,senatorName:'Unrelated Smith'}:x);
 const bad=sample(wrong,[src(29)]);
 const b=bad.perPublicDistrict.find(x=>x.district===29);
 assert.equal(b.selectedSourceStatus,'senator_membership_identity_unresolved');
 assert.equal(b.membershipHoldReason,'active_district_membership_name_does_not_match_public_incumbent');
});
test('ambiguous current senator candidates cannot absorb other person evidence',()=>{
 const other={...ms.find(x=>x.district==='1'),membershipId:'other-member-001'};
 const r=sample([...ms,other],[src(1)],[...aggs,aggregate(other)]);
 const x=r.perPublicDistrict[0];
 assert.equal(x.selectedSourceStatus,'senator_membership_identity_unresolved');
 assert.equal(x.membershipHoldReason,'multiple_active_current_senate_membership_identity_candidates');
 assert.equal(x.selectedSourceEvidenceLinked,false);
 assert.equal(x.currentMembershipCampaignIssueRows,null);
});
test('unbounded/private campaign aggregates or orphan aggregate ID fail CLOSED, not zero evidence',()=>{
 const zero=aggs.map((x,i)=>i===0?{...x,campaignIssueRowsRecorded2026:-1}:x);
 assert.throws(()=>sample(ms,[],zero));
 const wrong=[...aggs,{...aggs[0],membershipId:'otherprivateid'}];
 assert.throws(()=>sample(ms,[],wrong));
 const omitted=aggs.slice(0,-1);
 assert.throws(()=>sample(ms,[],omitted));
 assert.throws(()=>sample(ms,[{...src(1),publishedAt:'private invalid date'}]));
});
test('V2 three fixed SELECTs restrict to current member/selected public source and publication year metadata',()=>{
 assert.match(MEMBERSHIPS_SQL,/s.slug='2025-2026'/);
 assert.match(SOURCE_SQL_V2,/sd.source_url=ANY\(\$1::text\[\]\)/);
 assert.match(SOURCE_SQL_V2,/ei.metadata->>'contextType'/);
 assert.match(SOURCE_SQL_V2,/ei.published_at::text/);
 assert.match(SOURCE_SQL_V2,/LIMIT 1201/);
 assert.match(MEMBER_CAMPAIGN_COUNTS_SQL,/m.district::text=ANY\(\$1::text\[\]\)/);
 assert.match(MEMBER_CAMPAIGN_COUNTS_SQL,/s.slug='2025-2026'/);
 assert.match(MEMBER_CAMPAIGN_COUNTS_SQL,/ei.metadata->>'sourceSubtype'='campaign_site_page'/);
 assert.match(MEMBER_CAMPAIGN_COUNTS_SQL,/LIMIT 211/);
 assert.doesNotMatch(MEMBER_CAMPAIGN_COUNTS_SQL,/DELETE|TRUNCATE|INSERT INTO|UPDATE|DROP|CREATE/);
});
test('owner gate rejects untrusted PR, replay, unreviewed main and arbitrary issue comment',()=>{
 const env={GITHUB_REPOSITORY:'killjoy00/votepredict',
  GITHUB_EVENT_NAME:'issue_comment',GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'a'.repeat(40),
  VOTEPREDICT_864_2026_V2_APPROVAL:ONE_SHOT_COMMENT_V2,
  VOTEPREDICT_864_2026_V2_INDEPENDENT_CI:'true'};
 assert.doesNotThrow(()=>assertOwnerCommentV2(env));
 for(const [k,v]of Object.entries({GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'2',
   GITHUB_SHA:'junk',VOTEPREDICT_864_2026_V2_INDEPENDENT_CI:'false',
   VOTEPREDICT_864_2026_V2_APPROVAL:'[not the reviewed comment]'}))
  assert.throws(()=>assertOwnerCommentV2({...env,[k]:v}));
});
test('single mock existing-Neon three-SELECT read only repeatable snapshot and ROLLBACK yields safe 49 public district rows',async()=>{
 const statements=[];let closed=0,released=0;
 const fakePool=o=>{
  assert.equal(o.password,'NEVER_EXPORT_SECRET_PASSWORD');
  assert.match(o.options,/default_transaction_read_only=on/);
  return {
   connect:async()=>({
    query:async(sql,args)=>{
     statements.push(sql);
     if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return {rows:[]};
     if(sql===IDENTITY_SQL)return {rows:[{db:'neondb',role:'neondb_owner',ro:'on'}]};
     if(sql===CATALOG_SQL){
      assert.deepEqual(args,[REQUIRED]);
      return {rows:REQUIRED.map(name=>({table_name:name,present:true,readable:true}))};
     }
     if(sql===MEMBERSHIPS_SQL)return {rows:ms};
     if(sql===SOURCE_SQL_V2)return {rows:[src(1),src(2,{contextType:'context'})]};
     if(sql===MEMBER_CAMPAIGN_COUNTS_SQL)return {rows:aggs.map((a,i)=>i===0?{...a,...dayCurrent()}:a)};
     throw Error('Unexpected private SQL');
    },release:()=>{released++}
   }),
   end:async()=>{closed++}
  };
 };
 const r=await auditExisting49CurrentMembershipV2({apiKey:'do-not-log',projectId:'test'},
   async()=>({host:'private.neon.tech',port:5432,role:'neondb_owner',
    password:'NEVER_EXPORT_SECRET_PASSWORD',database:'neondb'}),fakePool);
 assert.equal(r.currentTransactionReadOnly,true);
 assert.equal(r.transactionRollbackCompleted,true);
 assert.equal(statements[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert.equal(statements.at(-1),'ROLLBACK');
 assert.equal(statements.filter(x=>[MEMBERSHIPS_SQL,SOURCE_SQL_V2,MEMBER_CAMPAIGN_COUNTS_SQL].includes(x)).length,3);
 assert.equal(r.groupedStatusCounts.matched_exact_url_with_named_senator_evidence,2);
 assert.equal(r.groupedStatusCounts.source_url_not_observed_in_bounded_lookup,47);
 assert.equal(r.perPublicDistrict[0].selectedSourceIssuePositionLinked,true);
 assert.equal(r.perPublicDistrict[1].selectedSourceIssuePositionLinked,false);
 assert.equal(released,1);assert.equal(closed,1);
 assert.doesNotMatch(JSON.stringify(r),/NEVER_EXPORT_SECRET_PASSWORD|private\.neon\.tech|sourceDocumentId|membershipId|https?:\/\//);
});
test('v2 validates 49 exact public district rows and rejects private source fields and fabricated counts',()=>{
 const safe={...sample(),currentTransactionReadOnly:true,transactionRollbackCompleted:true,
  productionMutations:0};
 assert.doesNotThrow(()=>validateSanitizedV2(safe));
 assert.throws(()=>validateSanitizedV2({...safe,secretUrl:'https://private.example.com'}));
 assert.throws(()=>validateSanitizedV2({...safe,
  perPublicDistrict:[...safe.perPublicDistrict.slice(0,48)]}));
 assert.throws(()=>validateSanitizedV2({...safe,perPublicDistrict:
  safe.perPublicDistrict.map((x,i)=>i===0?{...x,currentMembershipCampaignIssueRows:-1}:x)}));
});
test('workflow limited to one new owner exact trigger, presecret full CI, SHA original proof, no artifact/private rows',()=>{
 const y=readFileSync('.github/workflows/senate-864-2026-49-incumbent-existing-neon-parity-v2.yml','utf8');
 assert.match(y,/issue_comment:/);
 assert.match(y,/github.event.comment.user.login == 'killjoy00'/);
 assert.match(y,/github.event.issue.number == 864/);
 assert.match(y,/campaign-864-2026-49-incumbents-detail-readonly-20261013-v2/);
 assert.match(y,/evidence-readonly-sandbox/);
 assert.match(y,/needs.public-ci-verify.result == 'success'/);
 assert.match(y,/npm run db:migrate/);
 assert.match(y,/npm run check/);
 assert.match(y,/verify-senate-864-2026-incumbent-sql-local-v2.mjs/);
 assert.match(y,/issues: write/);
 assert.doesNotMatch(y,/^\s+schedule:/m);
 assert.doesNotMatch(y,/^\s+workflow_dispatch:/m);
 assert.doesNotMatch(y,/actions\/upload-artifact/);
 // Inspect only the legacy issue report job. New, separately gated jobs are
 // permitted after it, but may never leak credentials into the issue reporter.
 const report=y.split('  issue-keyless-report:')[1]?.split(/^  [a-z][a-z0-9-]*:/m)[0];
 assert.ok(report);
 assert.doesNotMatch(report,/secrets.NEON_API_KEY|environment: evidence-readonly-sandbox/);
});
