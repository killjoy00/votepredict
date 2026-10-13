import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 SCHEMA,MARKER,CROSSWALK_PSV,CROSSWALK_CHECKPOINT,CROSSWALK_FIELDS,
 serializeOfficialReportPanelCrosswalk,buildSourceVerifiedSenatorReportCrosswalk,
 sourceVerified95ServedReportVersionAudit,
} from '../scripts/audit-cfb-864-95-served-report-version-crosswalk-v14.mjs';
const LRL='https://www.lrl.mn.gov/legdb/senate_dir';
const SWEAR='https://www.lrl.mn.gov/history/caucus?body=s';
const names=[...new Map(readFileSync(
 'docs/evaluation/source-proof/cfb-2021-25-served-25-panel-229-exact-version-ledger.psv','utf8')
 .trim().split('\n').map(r=>r.split('|')).map(r=>[r[4],r[2]]))].map(x=>x[1]);
function fakeRow(name,i,served=true){
 return{
  officialName:name,officialNameRaw:name,
  officialSourceUrl:LRL,
  senateServiceTerms:[{startsYear:served?2022:2018,
    endsYear:served?2025:2020,district:String(1+i%67)}],
 };
}
function synthetic(){
 const senators=[
  ...names.map((name,i)=>fakeRow(name,i)),
  ...Array.from({length:70},(_,i)=>fakeRow('Synthetic Official'+i+' Senator'+i,i+25)),
  ...Array.from({length:10},(_,i)=>fakeRow('Historical Only'+i+' Servant'+i,i+95,false)),
 ];
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:LRL,observedAt:'2026-10-12T00:00:00.000Z',
   sourceBytesSha256:'a'.repeat(64),
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true},
  supplementalSwearingSource:{
   url:SWEAR,observedAt:'2026-10-12T00:00:00.000Z',
   sourceBytesSha256:'b'.repeat(64),
   swearingDateIndependentlyDocumentedForNamedSpecialMembers:true,
   websitePublicationDateBackdated:false},
  senators,
 };
}
test('exact 25 already-proved Senate CFB panel principal names distinct',()=>{
 assert.equal(names.length,25);
 assert.equal(new Set(names).size,25);
 assert.equal(SCHEMA,'cfb-864-exact-report-version-95-served-person-source-crosswalk-v14');
 assert.equal(MARKER,
  'SENATE_864_CFB_95_ACTUALLY_SERVED_REPORT_VERSION_CROSSWALK_V14_20261012');
});
test('95 official serving people are not 95 legal filer obligations',()=>{
 const result=buildSourceVerifiedSenatorReportCrosswalk(synthetic());
 assert.equal(result.statewideActuallyServed2021to25People,95);
 assert.equal(result.results.length,95);
 assert.equal(result.previouslyProvenCFBReportPanelRegistrationCount,25);
 assert.equal(result.uniqueSourceJoinedCFBReportRegistrations,25);
 assert.equal(result.sourcePanelsStillNeedingOfficialNameReview.length,0);
 assert.equal(result.results.filter(r=>r.matchedAlreadySourceProvenCFBRegistration).length,25);
 assert.equal(result.results.filter(r=>!r.matchedAlreadySourceProvenCFBRegistration).length,70);
 assert.equal(result.results.reduce((n,r)=>n+r.existingAuthenticatedSourceVersionReferences,0),229);
 assert.equal(result.existingExactPdfHistoricalPublicByVerified,0);
 assert.equal(result.noReportObligationDenominatorOrAbsenceClaim,true);
 assert.equal(result.noPrivateDatabaseOrFinancialTransactions,true);
 assert.equal(result.nameJoinDoesNotIndependentlyProveCommitteeRegistration,true);
});
test('unknown source panel row cannot be classified as no official campaign report',()=>{
 const result=buildSourceVerifiedSenatorReportCrosswalk(synthetic());
 const unknown=result.results.filter(r=>r.matchedAlreadySourceProvenCFBRegistration===null);
 assert.equal(unknown.length,70);
 assert.ok(unknown.every(r=>
  r.reportVersionCoverageState==='no_CFB_version_identity_join_yet_not_proof_no_report'));
 assert.ok(unknown.every(r=>r.noLegalReportFilingDutyConclusion));
 assert.ok(unknown.every(r=>r.existingAuthenticatedSourceVersionReferences===0));
});
test('wrong 105-person official source, duplicate official people or drift does not pass',()=>{
 const source=synthetic();
 assert.throws(()=>buildSourceVerifiedSenatorReportCrosswalk(
  {...source,senators:source.senators.slice(0,104)}));
 assert.throws(()=>buildSourceVerifiedSenatorReportCrosswalk(
  {...source,senators:[...source.senators.slice(0,94),
   source.senators[0],...source.senators.slice(95)]}));
 assert.throws(()=>buildSourceVerifiedSenatorReportCrosswalk(
  {...source,source:{...source.source,url:'https://attacker.example/'}}));
 assert.throws(()=>buildSourceVerifiedSenatorReportCrosswalk(
  {...source,supplementalSwearingSource:{
   ...source.supplementalSwearingSource,websitePublicationDateBackdated:true}}));
});
test('without official original Senate source data network HOLD cannot become no report claim',async()=>{
 const calls=[];
 const result=await sourceVerified95ServedReportVersionAudit(async(url,opts)=>{
  calls.push([String(url),opts.method,opts.redirect]);
  throw Error('Synthetic government source network error');
 });
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>x[1]==='GET'&&x[2]==='manual'));
 assert.equal(result.status,'official_original_service_source_or_join_hold');
 assert.equal(result.data,null);
 assert.equal(result.noAbsenceOrUnregisteredCommitteeInferred,true);
});
test('public-only senate service and CFB panel source workflow has no protected writes',()=>{
 const workflow=readFileSync(
  '.github/workflows/senate-864-cfb-95-served-report-crosswalk-v14.yml','utf8');
 assert.match(workflow,/pull_request:/);
 assert.match(workflow,/node --import tsx --test tests\/cfb-864-95-served-report-version-crosswalk-v14\.test\.mjs/);
 assert.match(workflow,/node --import tsx scripts\/audit-cfb-864-95-served-report-version-crosswalk-v14\.mjs/);
 assert.match(workflow,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(workflow,/secrets\.|NEON|upload-artifact|issues: write|workflow_dispatch|schedule:|environment:/);
});

test('immutable 95 original LRL serving senator source-panel rows are preserved without false filing absence',()=>{
 const rows=readFileSync(CROSSWALK_PSV,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 const checkpoint=JSON.parse(readFileSync(CROSSWALK_CHECKPOINT,'utf8'));
 assert.equal(rows.length,95);
 assert.equal(CROSSWALK_FIELDS.length,10);
 assert.ok(rows.every(r=>r.length===10));
 assert.equal(new Set(rows.map(r=>r[0])).size,95);
 assert.equal(rows.filter(r=>r[4]!=='-').length,25);
 assert.equal(rows.filter(r=>r[4]==='-').length,70);
 assert.equal(rows.reduce((n,r)=>n+Number(r[5]),0),229);
 assert.ok(rows.every(r=>r[8]==='false'&&r[9]==='true'));
 assert.ok(rows.filter(r=>r[4]==='-').every(r=>
  r[7]==='no_CFB_version_identity_join_yet_not_proof_no_report'));
 assert.equal(checkpoint.actualServedPersonRows,95);
 assert.equal(checkpoint.originalCFBSourceProvenReportPrincipals,25);
 assert.equal(checkpoint.notAlreadyRepresentedBySelectedCFBReportSourceVersionPanel,70);
 assert.equal(checkpoint.exactHistoricallyPublicByPDFVersionCapturesProved,0);
 assert.match(checkpoint.originalFullOfficialSenateDirectorySha256,/^[a-f0-9]{64}$/);
 assert.match(checkpoint.originalFullSpecialSwearingSha256,/^[a-f0-9]{64}$/);
});
test('crosswalk serializer prints 95 public official identities only with no raw government HTML',()=>{
 const mock=buildSourceVerifiedSenatorReportCrosswalk(synthetic());
 const serialized=serializeOfficialReportPanelCrosswalk(mock.results);
 assert.equal(serialized.trimEnd().split('\n').length,95);
 assert.doesNotMatch(serialized,/donor|contributor|transaction|<html|<script/i);
});
