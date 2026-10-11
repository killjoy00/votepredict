import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HOFFMAN_2023_ORIGINAL_BOARD_AGREEMENT,inspectHoffman2023OriginalBoardAction}
 from '../src/evidence/cfb-2023-hoffman-original-board-committee-proof.js';
const original71=readFileSync(
 'docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv','utf8');
const syntheticOriginal=[
 'STATE OF MINNESOTA',
 'CAMPAIGN FINANCE AND PUBLIC DISCLOSURE BOARD',
 'CONCILIATION AGREEMENT',
 'In the matter of the Committee to Elect John Hoffman (17319)',
 'The Committee to Elect John Hoffman is the principal campaign committee of Senator John Hoffman.',
 'The committee’s 2021 and 2022 amended year-end reports of receipts and expenditures disclosed a combined total.',
 'The committee agrees it will transition to using the Board’s Campaign Finance Reporter Online application starting with the 2023 reporting year.',
 '/s/ John Hoffman Dated: June 7, 2023',
 '/s/ Board Chair Dated: June 7, 2023'
].join(' ');
test('source is exact original Minnesota Board signed committee action URL',()=>{
 assert.equal(HOFFMAN_2023_ORIGINAL_BOARD_AGREEMENT,
  'https://cfb.mn.gov/pdf/bdactions/1641_Conciliation_Agreement.pdf');
});
test('strict original signed 2023 action proves exactly Senator Hoffman registration 17319, not inferred 2023 registration/duty/publication',()=>{
 const p=inspectHoffman2023OriginalBoardAction({
  original2023BoardPdfText:syntheticOriginal,existingAuthenticated71VersionPSV:original71});
 assert.equal(p.principalCampaignCommitteeRegistration,'17319');
 assert.equal(p.authenticServingSenator,'John A. Hoffman');
 assert.equal(p.authenticSenateDistrict2022,34);
 assert.equal(p.independentSourceNamedPrincipalCommitteeInSigned2023Action,true);
 assert.equal(p.BoardDiscussedAmended2021and2022AnnualReports,true);
 assert.deepEqual(p.originalSignatureDatesAsPrinted,['June 7, 2023','June 7, 2023']);
 assert.equal(p.actualFirstRegistrationDate,null);
 assert.equal(p.committeeRegistrationStatusOnSpecific2023Or2024Date,null);
 assert.equal(p.originalBoardVoluntaryOrAdministrativeTermination,null);
 assert.equal(p.legal2023YearEndFilingObligation,null);
 assert.equal(p.legal2024YearEndFilingObligation,null);
 assert.equal(p.newlyProvenExact2023Or2024YEVersionHistoricalPublicBy,null);
 assert.equal(p.exact2021or2022CFBReportAmendmentMappingFromBoardWords,null);
});
test('never attribute a similar person/registration/document/report context to John Hoffman',()=>{
 for(const text of [
  syntheticOriginal.replace('(17319)','(17318)'),
  syntheticOriginal.replace('Senator John Hoffman','Senator Jane Hoffman'),
  syntheticOriginal.replace('The Committee to Elect John Hoffman is the principal campaign committee','Some other person is the principal campaign committee'),
  syntheticOriginal.replace('2021 and 2022 amended year-end','2021 and 2023 amended year-end'),
  syntheticOriginal.replace('2023 reporting year','2024 reporting year'),
  syntheticOriginal.replace('Dated: June 7, 2023','Dated: June 7, 2022').replace('Dated: June 7, 2023','Dated: June 7, 2022'),
 ]){
  assert.throws(()=>inspectHoffman2023OriginalBoardAction({
   original2023BoardPdfText:text,existingAuthenticated71VersionPSV:original71}),
   /not independently prove|lacks an independently readable/);
 }
});
test('cannot silently edit immutable preauthenticated 71-original financial disclosure references',()=>{
 assert.throws(()=>inspectHoffman2023OriginalBoardAction({
  original2023BoardPdfText:syntheticOriginal,
  existingAuthenticated71VersionPSV:original71.replace('17319:23:pcc:YE:0:0','99319:23:pcc:YE:0:0')
 }),/changed/);
});