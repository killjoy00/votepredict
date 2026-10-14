import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 SCHEMA,SOURCE_PSV,SOURCE_CHECKPOINT,KNOWN_FIRST_NAME_FORMS,
 originalOfficialMemberNameKey,originalCfbCandidateLabelNameKey,
 parsePermanent57RegistrationLeadPsv,verifyPinned57AgainstOriginalSourceCheckpoint,
 replay57AgainstEntireOriginal268PageBody
}from '../scripts/audit-cfb-864-57-actual-serving-candidate-registration-leads-v17.mjs';
test('95 public-serving people yield exactly 57 unassigned source committee ID leads but NO additional PDF version certification',()=>{
 const output=verifyPinned57AgainstOriginalSourceCheckpoint();
 assert.equal(output.schema,SCHEMA);
 assert.equal(output.servingSenators,95);
 assert.equal(output.preexistingReportPdfVersionPrincipals,38);
 assert.equal(output.additionalCandidateRegistrationSourceLeads,57);
 assert.equal(output.exactOfficialCfbPersonNameMatches,52);
 assert.equal(output.originalFirstNameAliasIdentityHolds,5);
 assert.equal(output.actuallyNewAuthenticatedReportPdfBodies,0);
 assert.equal(output.historicalExactReportPdfPublicByCount,0);
 assert.equal(output.legalReportFilingDutyDenominator,null);
 assert.equal(output.proofNoReportExistsForAnyPerson,false);
 assert.equal(output.noBulkTransactionOrOldEligibilityWork,true);
 assert.equal(output.noProductionReadsOrWrites,true);
});
test('permanent 57 source-ledger uniquely fixes each candidate original registration, first page SHA and other observed election segments',()=>{
 const leads=parsePermanent57RegistrationLeadPsv();
 assert.equal(leads.length,57);
 assert.equal(new Set(leads.map(x=>x.officialSenator)).size,57);
 assert.equal(new Set(leads.map(x=>x.committeeRegistrationLead)).size,57);
 assert.ok(leads.every(x=>x.originalCandidatePageUrl.startsWith(
  'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/districts-constitutional-offices/Senate/')));
 assert.ok(leads.every(x=>/^[0-9a-f]{64}$/.test(x.originalCandidatePageSha256)));
 assert.equal(leads.filter(x=>x.identityStatus==='EXACT').length,52);
 assert.equal(leads.filter(x=>x.identityStatus==='ALIAS_HOLD').length,5);
 const rows=readFileSync(SOURCE_PSV,'utf8');
 assert.equal(createHash('sha256').update(rows).digest('hex'),
  '959b45dc978fc5ef962aba788d74caa76ce1ae474b69847ab21fec1934c9c0b2');
});
test('five original source first-name variants remain review HOLDS, not name-based source proofs',()=>{
 const actual=parsePermanent57RegistrationLeadPsv().filter(x=>x.identityStatus==='ALIAS_HOLD');
 assert.deepEqual(actual.map(x=>x.officialSenator),KNOWN_FIRST_NAME_FORMS.map(x=>x[0]));
 assert.equal(actual.length,5);
 assert.deepEqual(actual.map(x=>x.committeeRegistrationLead),['16311','17441','18337','16246','17924']);
 assert.ok(actual.every(x=>originalOfficialMemberNameKey(x.officialSenator)!==
  originalCfbCandidateLabelNameKey(x.originalCfbCandidateLabel)));
 assert.equal(originalCfbCandidateLabelNameKey('Mann, Alice'),
  originalOfficialMemberNameKey('Alice Mann'));
});
test('cannot silently replace original CFB display with a different registration or alias',()=>{
 const s=readFileSync(SOURCE_PSV,'utf8');
 assert.throws(()=>parsePermanent57RegistrationLeadPsv(
  s.replace('Alice Mann|18793|','Alice Mann|99999|')));
 assert.throws(()=>parsePermanent57RegistrationLeadPsv(
  s.replace('Ingebrigtsen, William (Bill) G|ALIAS_HOLD',
   'Ingebrigtsen, Will G|EXACT')));
 assert.throws(()=>parsePermanent57RegistrationLeadPsv(
  s.replace('|2022,2024,2026','|2024,2022,2026')));
 assert.throws(()=>parsePermanent57RegistrationLeadPsv(s.replace(
  '563b99a4da55db0fb0909343ce87ee5ca75937830f84ae2658ef0cc30a2a4aff',
  'not-original-government-source-hash')));
});
test('entire unaltered archived original JSON body needed for complete archived 268-page replay',()=>{
 const z=JSON.stringify({notRealGovernmentOriginal:true});
 assert.throws(()=>replay57AgainstEntireOriginal268PageBody(Buffer.from(z)),
  /original entire 268 page government source JSON bytes SHA256 mismatch/);
 const c=JSON.parse(readFileSync(SOURCE_CHECKPOINT,'utf8'));
 assert.equal(c.provenance.artifactId,11680891630);
 assert.equal(c.provenance.rawJsonBytes,264296);
 assert.equal(c.provenance.rawJsonSha256,
  '83770615658f7cf47802b05257bcbd45bed0c7c41ec19dfe99c31ca91b746c04');
 assert.equal(c.sourceCoverage.pagesAcquiredAndParsed,268);
 assert.equal(c.observedCandidateRegistrationIndex.distinctRegistrations,494);
});
test('original source archive replay is public-only and report PDF research scope not illegal filer assumptions',()=>{
 const y=readFileSync('.github/workflows/senate-864-57-serving-senator-cfb-registration-leads-v17.yml','utf8');
 assert.match(y,/pull_request:/);
 assert.match(y,/actions: read/);
 assert.match(y,/contents: read/);
 assert.match(y,/node --test tests\/cfb-864-57-candidate-registration-leads-v17.test.mjs/);
 assert.match(y,/node scripts\/audit-cfb-864-57-actual-serving-candidate-registration-leads-v17.mjs/);
 assert.match(y,/38081628130/);
 assert.doesNotMatch(y,/secrets\.|NEON|upload-artifact|issues: write|workflow_dispatch|schedule:|environment:/);
});
