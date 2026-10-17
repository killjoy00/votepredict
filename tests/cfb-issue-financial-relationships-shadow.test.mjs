import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
 CFB_ISSUE_FINANCE_SHADOW_VERSION,classifyLiteralPublisherBillPosition,
 issueFinancialRelationshipFeatures,validAffiliation
} from '../src/evidence/cfb-issue-financial-relationships-shadow.mjs';

const SH='a'.repeat(64), FIRST='b'.repeat(64);
const affiliated={
 relationship:'verified_organizational_affiliation',
 contributorRegistrationNumber:'123456',
 groupName:'Example Health Advocates',
 officialCfbUrl:'https://cfb.mn.gov/official/report/123456',
 firstPartyAffiliationUrl:'https://example.org/official/our-committee',
 officialCfbSha256:SH,firstPartySha256:FIRST,
 validatedOn:'2025-05-01',relationshipPublicByOn:'2024-04-01',
 affiliationEffectiveOn:'2023-01-01',relationshipOriginalProof:true
};
const pos={
 billId:'00000000-1111-2222-3333-444444444444',
 groupName:'Example Health Advocates',
 groupPositionRaw:'Support',
 publishedOn:'2024-05-01',
 dateIsVerifiedPublication:true,
 snapshotSha256:SH,
 sourceUrl:'https://example.org/positions/health-bill'
};
const row=(changes={})=>({
 rowKey:'c'.repeat(64),kind:'candidate_contribution',
 filerRegistrationNumber:'765432',
 contributorRegistrationNumber:'123456',
 contributor:'Example Health Advocates PAC',
 employer:'A claimed hospital',
 amount:150,transactionDate:'2024-03-01',
 availableOn:'2024-03-10',asOfEligible:true,
 rowSpecificDisclosureProof:true,
 rowSpecificProofKind:'independent_archive_capture_exact_row',
 rowSpecificProofSha256:SH,
 rowSpecificProofUrl:'https://cfb.mn.gov/official/archived-source',
 ...changes
});
const base={
 billId:pos.billId,
 memberCommitteeRegistration:'765432',
 cutoffOn:'2024-08-01',
 mode:'strict_public_as_of',
 affiliations:[affiliated],
 groupBillPositions:[pos],
 financeRows:[row()]
};
test('only explicit full-bill literal organizational positions are accepted',()=>{
 assert.equal(classifyLiteralPublisherBillPosition('Support'),'support');
 assert.equal(classifyLiteralPublisherBillPosition('Oppose'),'oppose');
 assert.equal(classifyLiteralPublisherBillPosition('Bill passed, Chamber opposed'),'oppose');
 assert.equal(classifyLiteralPublisherBillPosition('Bill failed, Chamber supported'),'support');
 assert.equal(classifyLiteralPublisherBillPosition('Correct Vote: YES'),null);
 assert.equal(classifyLiteralPublisherBillPosition('Amendment A123; Chamber supported'),null);
 assert.equal(classifyLiteralPublisherBillPosition('Chamber supported some other issues'),null);
});
test('source-backed prior-date affiliation, bill stance, and disclosure produce one feature',()=>{
 assert.equal(validAffiliation(affiliated),true);
 const got=issueFinancialRelationshipFeatures(base);
 assert.equal(got.schema,CFB_ISSUE_FINANCE_SHADOW_VERSION);
 assert.equal(got.featureStatus,'source_qualified_relationships');
 assert.equal(got.features.contributingOrganizationsForBillSupport,1);
 assert.equal(got.features.preCutoffContributionsFromSupportingGroups,1);
 assert.equal(got.features.preCutoffContributionsFromOpposingGroups,0);
 assert.equal(got.features.log1pSupportingGroupDollars,Math.log1p(150));
 assert.equal(got.mechanicallyActionable,false);
 assert.equal(got.servingChanged,false);
});
test('unverified donors, employer coincidences and PAC names cannot create group ties',()=>{
 for(const override of [
  {affiliations:[]},
  {affiliations:[{...affiliated,relationship:'name_similarity'}]},
  {affiliations:[{...affiliated,firstPartySha256:'unverified'}]},
  {affiliations:[{...affiliated,officialCfbUrl:'https://unofficial.example.org/reports/123456'}]},
  {affiliations:[{...affiliated,relationshipOriginalProof:false}]},
  {affiliations:[{...affiliated,relationshipPublicByOn:'2025-01-01'}]},
  {financeRows:[row({contributorRegistrationNumber:null,
   contributor:'Example Health Advocates',employer:'Example Health Advocates'})]}
 ]){
  const got=issueFinancialRelationshipFeatures({...base,...override});
  assert.equal(got.features,null);
  assert.equal(got.featureStatus,'no_verified_issue_relationships');
 }
});
test('unknown availability, same-day and post-vote original positions fail closed',()=>{
 for(const changes of [
  {availableOn:null},{asOfEligible:false},{rowSpecificDisclosureProof:false},
  {rowSpecificProofSha256:null},{rowSpecificProofKind:'filing_estimate'},
  {availableOn:'2024-08-01'},{transactionDate:'2024-08-01'},
  {availableOn:'2024-02-01'}
 ])assert.equal(issueFinancialRelationshipFeatures({...base,financeRows:[row(changes)]}).features,null);
 for(const overrides of [
  {publishedOn:null},{publishedOn:'2024-08-01'},
  {dateIsVerifiedPublication:false},{groupPositionRaw:'Correct Vote: YES'},
  {groupPositionRaw:'Amendment A1; Chamber supported'}
 ])assert.equal(issueFinancialRelationshipFeatures({...base,groupBillPositions:[{...pos,...overrides}]}).features,null);
});
test('retrospective underlying activity can use later disclosure, not a later issue position',()=>{
 const got=issueFinancialRelationshipFeatures({...base,mode:'retrospective_activity',
  financeRows:[row({availableOn:'2024-10-01',asOfEligible:false,rowSpecificDisclosureProof:false})]});
 assert.equal(got.features.preCutoffContributionsFromSupportingGroups,1);
 const post=issueFinancialRelationshipFeatures({...base,mode:'retrospective_activity',
  groupBillPositions:[{...pos,publishedOn:'2024-09-01'}]});
 assert.equal(post.features,null);
});
test('contradictory group positions and affiliations are ambiguous, not directional',()=>{
 const reversed={...pos,groupPositionRaw:'Oppose'};
 assert.equal(issueFinancialRelationshipFeatures({...base,groupBillPositions:[pos,reversed]}).features,null);
 const duplicated={...affiliated,groupName:'Other Organization'};
 assert.equal(issueFinancialRelationshipFeatures({...base,affiliations:[affiliated,duplicated]}).features,null);
});
test('deduplicates repeated evidence copies, quarantines contradictions and excludes IE',()=>{
 const duplicate=issueFinancialRelationshipFeatures({...base,
  financeRows:[row(),row()]});
 assert.equal(duplicate.features.preCutoffContributionsFromSupportingGroups,1);
 const contradictory=issueFinancialRelationshipFeatures({...base,
  financeRows:[row(),row({amount:170})]});
 assert.equal(contradictory.features,null);
 assert.equal(contradictory.diagnostics.conflictingDuplicateRowKeys,1);
 const ie=issueFinancialRelationshipFeatures({...base,financeRows:[
  row({kind:'independent_expenditure'})]});
 assert.equal(ie.features,null);
 assert.equal(ie.diagnostics.excludedIndependentExpenditures,1);
});
test('unknown relationships must never be emitted as zero-dollar exposure',()=>{
 const got=issueFinancialRelationshipFeatures({...base,
  financeRows:[row({contributorRegistrationNumber:'999999'})]});
 assert.equal(got.features,null);
 assert.equal(got.featureStatus,'no_verified_issue_relationships');
});
