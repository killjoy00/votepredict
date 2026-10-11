import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {select22AuthenticSenatorRegistrationTargets} from
 '../src/evidence/cfb-2023-24-official-committee-status-proof.js';
import {inspectOriginalRevenuePcrReport,ORIGINAL_REVENUE_PCR_ANNUAL_SOURCES}
 from '../src/evidence/cfb-2023-24-original-revenue-pcr-proof.js';
const SOURCE='docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv';
const originals=readFileSync(SOURCE,'utf8');
const senators=select22AuthenticSenatorRegistrationTargets(originals);
function syntheticOriginal(y:2023|2024){
 const meta=ORIGINAL_REVENUE_PCR_ANNUAL_SOURCES[y];
 const irrelevant=Array.from({length:55},(_,i)=>
  String(20000+i)+' Example Candidate Committee Example Candidate 1/1/2023 12/31/2026 5 $100.00');
 return [
  'Annual Report on Political Contribution Refunds',
  meta.reportingPeriodText,
  'Date: '+meta.reportDatePrinted,
  'Minnesota Department of Revenue',
  'Dear Jeff Sigurdson: The report on political contribution refunds made on behalf of each candidate',
  'Campaign Finance PCR Report',meta.filingPeriodText,
  'Reg Number Committee Name Candidate First Name Candidate Last Name',
  'Subsidy Begin Date Subsidy End Date Term Date Number of Requests Amount Refunded',
  ...irrelevant,
  '17362 Friends of Bruce D Anderson Bruce Anderson 1/26/2023 12/31/2026 7 $900.00',
  '18430 Aric (Putnam) for MN Aric Putnam 3/28/2024 12/31/2026 16 $1,315.00',
  '18763 Drazkowski Volunteer Committee Steve Drazkowski 3/6/2023 12/31/2026 2 $137.50',
 ].join('\n');
}
test('official government annual sources explicitly dated, 2023 and 2024 refund periods',()=>{
 assert.equal(ORIGINAL_REVENUE_PCR_ANNUAL_SOURCES[2023].url,
  'https://www.lrl.mn.gov/docs/2024/mandated/241110.pdf');
 assert.equal(ORIGINAL_REVENUE_PCR_ANNUAL_SOURCES[2024].url,
  'https://www.lrl.mn.gov/docs/2025/mandated/251307.pdf');
 assert.equal(senators.length,22);
 assert.ok(senators.some(x=>x.registrationNumber==='18763'&&x.senator==='Steve Drazkowski'));
 assert.ok(senators.some(x=>x.registrationNumber==='17362'&&x.senator==='Bruce Douglas Anderson'));
 assert.ok(senators.some(x=>x.registrationNumber==='18430'&&x.senator==='Aric Putnam'));
});
test('the named registrations in an original retrospective state refund report do not establish 2023 registration, legal duty or PDF public-by',()=>{
 for(const year of [2023,2024] as const){
  const r=inspectOriginalRevenuePcrReport({
   extractedOriginalPDFText:syntheticOriginal(year),refundYear:year,senators,
  });
  assert.equal(r.rows.length,22);
  assert.equal(r.independentRetrospectivePcrIdentities,3);
  assert.equal(r.unresolvedPcrNameHolds,0);
  assert.equal(r.notObservedInRetrospectiveReport,19);
  for(const id of ['18763','17362','18430']){
   const p=r.rows.find(x=>x.registrationNumber===id)!;
   assert.equal(p.proof,'independent_named_PCR_register_row');
   assert.equal(p.sourceSurnameRepeatedInSameRow,true);
   assert.equal(p.candidateGivenNameInSameRow,true);
   assert.equal(p.actual2023CommitteeRegistrationState,null);
   assert.equal(p.actual2024CommitteeRegistrationState,null);
   assert.equal(p.originalCommitteeRegistrationDate,null);
   assert.equal(p.originalVoluntaryOrAdministrativeTerminationDate,null);
   assert.equal(p.legallyOwedYearEnd2023,null);
   assert.equal(p.legallyOwedYearEnd2024,null);
   assert.equal(p.exactReportVersionHistoricalPublicBy,null);
   assert.equal(p.sourceHasSubsidyDatesButTheseAreNotRegistrationDates,true);
  }
  assert.equal(r.rows.find(x=>x.registrationNumber==='17994')!.proof,
   'not_observed_in_this_retrospective_PCR_list');
 }
});
test('fail closed if the original state agency, report date or filing period differs',()=>{
 for(const bad of [
  syntheticOriginal(2023).replace('Minnesota Department of Revenue','Test Analyst'),
  syntheticOriginal(2023).replace('Date: July 18, 2024','Date: June 18, 2024'),
  syntheticOriginal(2023).replace('Filing Period: 31-Dec-2023','Filing Period: 31-Dec-2024'),
  syntheticOriginal(2023).replace('Term Date','Random Column'),
  syntheticOriginal(2023).replace('Annual Report on Political Contribution Refunds','Unverified PDF'),
 ]){
  assert.throws(()=>inspectOriginalRevenuePcrReport({
   extractedOriginalPDFText:bad,refundYear:2023,senators}),/not authenticated/);
 }
});
test('exact registration without matching candidate surname twice is an explicit hold, never a source identity match',()=>{
 const text=syntheticOriginal(2024).replace(
  '17362 Friends of Bruce D Anderson Bruce Anderson 1/26/2023',
  '17362 Friends of Bruce D Anderson Alex Johnson 1/26/2023');
 const r=inspectOriginalRevenuePcrReport({
  extractedOriginalPDFText:text,refundYear:2024,senators});
 const anderson=r.rows.find(x=>x.registrationNumber==='17362')!;
 assert.equal(anderson.proof,'HOLD_unmatched_candidate_identity');
 assert.equal(anderson.exactRegistrationPresent,true);
 assert.equal(anderson.sourceSurnameRepeatedInSameRow,false);
 assert.equal(anderson.actual2024CommitteeRegistrationState,null);
 assert.equal(r.unresolvedPcrNameHolds,1);
});
test('duplicate exact registration rows hold instead of choosing a favorable one',()=>{
 const text=syntheticOriginal(2024)+
  '\n18763 Drazkowski Volunteer Committee Steve Drazkowski 3/6/2023 12/31/2026 2 $137.50';
 const r=inspectOriginalRevenuePcrReport({
  extractedOriginalPDFText:text,refundYear:2024,senators});
 assert.equal(r.rows.find(x=>x.registrationNumber==='18763')!.proof,
  'HOLD_multiple_PCR_rows_for_registration');
});
test('a tampered 71-version source or unproved senator denominator never passes',()=>{
 assert.throws(()=>select22AuthenticSenatorRegistrationTargets(
  originals.replace('18430:23:pcc:YE:0:0','99999:23:pcc:YE:0:0')),/changed/);
 assert.throws(()=>inspectOriginalRevenuePcrReport({
  extractedOriginalPDFText:syntheticOriginal(2023),refundYear:2023,
  senators:senators.slice(0,21)}),/22 previously authenticated/);
});