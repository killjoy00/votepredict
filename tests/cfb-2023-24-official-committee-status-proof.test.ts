/** #864 genuine contemporaneous CFB committee proof vs 2026 live viewer. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
 CFB_PUTNAM_ORIGINAL_2024_CONCILIATION,
 select22AuthenticSenatorRegistrationTargets,
 inspectPutnam2024OfficialBoardConciliation,
 inspectCurrentOfficialCfbCandidateHeading,
} from '../src/evidence/cfb-2023-24-official-committee-status-proof.js';
const SRC='docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv';
const ledger=readFileSync(SRC,'utf8');
const originalPutnamConciliation=[
 'STATE OF MINNESOTA',
 'CAMPAIGN FINANCE AND PUBLIC DISCLOSURE BOARD',
 'CONCILIATION AGREEMENT',
 'In the matter of the Aric (Putnam) for MN committee (18430);',
 '1. Aric (Putnam) for MN is the principal campaign committee of Senator Aric Putnam.',
 'The committee’s second amended 2023 year-end report of receipts and expenditures disclosed certain contributions.',
 'The committee’s original 2023 year-end report did not reflect the attempted return.',
 'The Putnam committee then filed an amended report as instructed by Board staff to include the contribution.',
 '3. The committee registered with the Board in 2019 and this is its first violation of the aggregate special source limit.',
 '/s/ Aric Putnam Dated: September 20, 2024',
 'Senator Aric Putnam Aric (Putnam) for MN',
 '/s/ David Asp Dated: September 4, 2024',
 'David Asp, Chair',
].join(' ');
test('22 original real source proven senator CFB principals and existing exact 71 version refs unchanged',()=>{
 const targets=select22AuthenticSenatorRegistrationTargets(ledger);
 assert.equal(targets.length,22);
 assert.equal(new Set(targets.map(x=>x.registrationNumber)).size,22);
 assert.ok(targets.some(x=>x.registrationNumber==='18430'
    &&x.senator==='Aric Putnam'&&x.district2022===14));
 assert.ok(targets.some(x=>x.registrationNumber==='17919'
    &&x.senator==='Nick A. Frentz'&&x.district2022===18));
 assert.throws(()=>select22AuthenticSenatorRegistrationTargets(
  ledger.replace('18430:23:pcc:YE:0:0','99999:23:pcc:YE:0:0')),/changed/);
});
test('historical signed original Board case identifies Putnam reg 18430 in 2019 and second amended 2023 YE but not another authentic current viewer report PDF',()=>{
 const proof=inspectPutnam2024OfficialBoardConciliation({
  source71Psv:ledger,originalBoardPdfExtractedText:originalPutnamConciliation});
 assert.equal(proof.committeeRegistration,'18430');
 assert.equal(proof.originalBoardStatesRegistrationYear,2019);
 assert.equal(proof.officialBoardSigningDate,'2024-09-20');
 assert.equal(proof.originalBoardDescribesSecondAmended2023YE,true);
 assert.deepEqual(proof.modernCfbViewer2023YearEndExactVersionRefs,
 ['18430:23:pcc:YE:0:0','18430:23:pcc:YE:0:1',
  '18430:23:pcc:YE:0:2','18430:23:pcc:YE:0:3']);
 assert.equal(proof.modernViewer2023AmendmentRefsCount,3);
 assert.equal(proof.secondAmended2023ReportDoesMatchExistingAmendment2Index,true);
 assert.equal(proof.secondAmended2023PdfVersionAuthenticFromSeparateCFBOriginal,true);
 assert.equal(proof.existingSecondAmendmentOriginalBoardReceiptOn,'2024-06-03');
 assert.equal(proof.firstAmendmentOriginalRegistrationIdentityStillHeld,true);
 assert.equal(proof.newHistorical2023PdfVersionAuthenticated,false);
 assert.equal(proof.actualPublicByForAny2023PdfVersionProven,false);
 assert.equal(proof.yearEnd2023Or2024LegallyOwed,null);
 assert.equal(proof.actualCommitteeRegistrationTerminationOnDate,null);
 assert.equal(CFB_PUTNAM_ORIGINAL_2024_CONCILIATION,
  'https://cfb.mn.gov/pdf/bdactions/1674_Conciliation_Agreement.pdf');
});
test('cannot infer source committee registration from a similar Senate name or different CFB number',()=>{
 assert.throws(()=>inspectPutnam2024OfficialBoardConciliation({
  source71Psv:ledger,originalBoardPdfExtractedText:originalPutnamConciliation.replace(
   'committee (18430)','committee (18431)')}),/not confirm/);
 assert.throws(()=>inspectPutnam2024OfficialBoardConciliation({
  source71Psv:ledger,originalBoardPdfExtractedText:originalPutnamConciliation.replace(
   'registered with the Board in 2019','registered with the Board in 2021')}),/not confirm/);
 assert.throws(()=>inspectPutnam2024OfficialBoardConciliation({
  source71Psv:ledger,originalBoardPdfExtractedText:originalPutnamConciliation.replace(
   'second amended 2023 year-end','initial amended 2023 year-end')}),/not confirm/);
});
test('current 2026 status is never historical proof of any 2023/24 registration or owed report',()=>{
 for(const [html,status] of [
  ['<html><h2>Frentz, Nick Andrew Senate Committee - 17919</h2></html>','not_labelled_terminated'],
  ['<html><h2>Frentz, Nick Andrew Senate Committee - 17919 (Terminated)</h2></html>','terminated_as_of_current_viewer'],
  ['<html><h2>Frentz, Nick Andrew House Committee - 17919 (Terminated)</h2></html>','unverified'],
  ['<html><h2>Different Senate Committee - 11111 (Terminated)</h2></html>','unverified'],
 ] as const){
  const parsed=inspectCurrentOfficialCfbCandidateHeading({
   registrationNumber:'17919',html,observedAt:'2026-10-11T20:30:00.000Z'});
  assert.equal(parsed.latestVisibleStatus,status);
  assert.equal(parsed.currentPageProvesRegistrationIn2023Or2024,false);
  assert.equal(parsed.original2023Or2024BoardTerminationDate,null);
  assert.equal(parsed.legalRequiredYearEndReportingCount,null);
  assert.equal(parsed.exact2023Or2024PdfPublicBy,null);
 }
 assert.throws(()=>inspectCurrentOfficialCfbCandidateHeading({
  registrationNumber:'bad',html:'',observedAt:'2026-10-11T20:30:00.000Z'}),/ID invalid/);
});
