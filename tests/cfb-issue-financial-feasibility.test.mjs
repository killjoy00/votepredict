import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
 scoreFinanceIssueFeasibility,organizationNameHint
} from '../scripts/audit-cfb-issue-financial-feasibility-readonly.mjs';

test('read-only feasibility is source-conservative and does not expose donor names',()=>{
 const p=[
  {group_name:'Example Labor Association',bill_id:'sampleBill',
   group_position_raw:'Support',published_on:'2024-01-01'},
  {group_name:'Example Business League',bill_id:'sampleBill',
   group_position_raw:'Amendment A999; Chamber opposed',published_on:null}
 ];
 const rows=[
  {family:'candidate_contribution',row_key:'a'.repeat(64),reg:'12345',
   member_id:'sample',contributor_reg:'54321',
   contributor_name:'Example Labor Association',employer:'EXAMPLE HOSPITAL',
   transaction_date:'2023-12-01',amount:'125.00',
   as_of_eligible:'true',published_on:'2024-01-20',
   availability_proof:'unverified'},
  {family:'candidate_contribution',row_key:'a'.repeat(64),reg:'12345',
   member_id:'sample',contributor_reg:'54321',
   contributor_name:'Example Labor Association',employer:'EXAMPLE HOSPITAL',
   transaction_date:'2023-12-01',amount:'125.00',
   as_of_eligible:'true',published_on:'2024-01-20',
   availability_proof:'unverified'},
  {family:'candidate_contribution',row_key:'c'.repeat(64),reg:'12345',
   member_id:'sample',contributor_reg:null,
   contributor_name:'Unnamed Individual',transaction_date:'2024-01-10',
   amount:'100.00'},
  {family:'independent_expenditure',row_key:'b'.repeat(64),reg:'12345',
   spender_reg:'65432',direction:'for',transaction_date:'2024-01-01',
   amount:'250.00'}
 ];
 const s=scoreFinanceIssueFeasibility(rows,p,1);
 assert.equal(s.inputFinanceEvidenceCopies,4);
 assert.equal(s.uniqueCandidateContributionRows,2);
 assert.equal(s.uniqueIndependentExpenditureRows,1);
 assert.equal(s.candidateContributionRowsWithContributorRegistration,1);
 assert.equal(s.candidateContributionRowsWithNamedContributor,2);
 assert.equal(s.candidateContributionNamesExactlyMatchingPublisherGroups,1);
 assert.equal(s.distinctContributorRegistrations,1);
 assert.equal(s.independentExpenditureRowsWithSpenderRegistration,1);
 assert.equal(s.groupBillPositionsWithResolvedBill,2);
 assert.equal(s.groupBillPositionsWithExplicitWholeBillStance,1);
 assert.equal(s.candidateRowsWithCertifiedOrganizationIssueCrosswalk,0);
 assert.equal(s.existingExactCanonicalTransactionLinks,1);
 assert.ok(!JSON.stringify(s).includes('Labor'));
 assert.ok(!JSON.stringify(s).includes('HOSPITAL'));
});
test('publisher-to-donor name hints never certify affiliation',()=>{
 assert.equal(organizationNameHint('Example-Labor Association!'),
  organizationNameHint('Example Labor Association'));
 const s=scoreFinanceIssueFeasibility([{
  family:'candidate_contribution',row_key:'c'.repeat(64),reg:'12345',
  contributor_reg:'54321',contributor_name:'Example Labor Association',
  amount:'100.00'
 }],[{group_name:'Example Labor Association',bill_id:'a',
  group_position_raw:'Support'}],0);
 assert.equal(s.uniquePotentialDonorEntityNameHints,1);
 assert.equal(s.candidateRowsWithCertifiedOrganizationIssueCrosswalk,0);
});
test('same row hash conflicting across evidence copies quarantines row',()=>{
 const rows=[{
  family:'candidate_contribution',row_key:'b'.repeat(64),reg:'12345',
  contributor_reg:'54321',amount:'100.00'
 },{
  family:'candidate_contribution',row_key:'b'.repeat(64),reg:'12345',
  contributor_reg:'54321',amount:'200.00'
 }];
 const s=scoreFinanceIssueFeasibility(rows,[],0);
 assert.equal(s.canonicalRowKeyConflicts,1);
 assert.equal(s.uniqueCandidateContributionRows,0);
});

test('official current PAC IDs are leads only, never proof of historical affiliation',()=>{
 const s=scoreFinanceIssueFeasibility([
  {family:'candidate_contribution',row_key:'a'.repeat(64),reg:'12345',
   contributor_reg:'70001',amount:'250.00'},
  {family:'candidate_contribution',row_key:'b'.repeat(64),reg:'12345',
   contributor_reg:'30558',amount:'125.00'},
  {family:'candidate_contribution',row_key:'c'.repeat(64),reg:'12345',
   contributor_reg:'30025',amount:'75.00'}
 ],[],0);
 assert.equal(s.candidateRowsFromThreePublicPacResearchLeads,3);
 assert.equal(s.distinctPublicPacResearchLeadRegistrationsObserved,3);
 assert.equal(s.candidateRowsWithCertifiedOrganizationIssueCrosswalk,0);
});
