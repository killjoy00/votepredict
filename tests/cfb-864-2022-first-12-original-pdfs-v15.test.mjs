import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 SCHEMA,CROSSWALK,PDF_LEDGER,readPinnedActualSenatorRoster,
 readPinnedOriginal24ReportPdfs,joinOfficial2022DistrictLabelsToSenateService,
 acquireV15Source,
} from '../scripts/audit-cfb-864-2022-first-12-original-pdfs-v15.mjs';

function ideal(){
 const roster=readPinnedActualSenatorRoster();
 const {targets}=readPinnedOriginal24ReportPdfs();
 return Array.from({length:12},(_,i)=>{
  const district=i+1,group=targets.find(t=>t.district===district);
  const matched=[...roster.values()].filter(r=>r.districts.has('2023:'+district));
  assert.equal(matched.length,1,'Synthetic test needs exactly one verified 2023 actually-serving senator in SD'+district);
  const person=matched[0].name,parts=person.split(' ');
  const displayName=parts.at(-1)+', '+parts[0]+' M.';
  return{
   district,segmentEndYear:2022,sourceUrl:'https://register.cfb.mn.gov/source',
   status:'candidate_labels_observed',htmlSha256:'a'.repeat(64),
   candidates:[{registrationNumber:group.reg,candidateDisplayName:displayName},
    {registrationNumber:'99999',candidateDisplayName:'Never Served, Random'}]
  };
 });
}
test('original verified CFB C/E PDF evidence and 95 actually-serving Senate original roster pinned',()=>{
 assert.equal(SCHEMA,'cfb-864-2022-12-senator-official-report-pdf-service-source-crosswalk-v15');
 const p=readPinnedOriginal24ReportPdfs();
 assert.equal(p.targets.length,24);
 assert.equal(p.metadata.size,24);
 assert.equal(new Set(p.targets.map(t=>t.reg)).size,12);
 assert.equal(readPinnedActualSenatorRoster().size,95);
 assert.ok(readFileSync(CROSSWALK,'utf8').includes('Alice Mann'));
 assert.ok(readFileSync(PDF_LEDGER,'utf8').includes('17373:22:pcc:C:0:0'));
});
test('one CFB registered candidate uniquely matching independent actual service for each district gives 24 source report PDFs',()=>{
 const result=joinOfficial2022DistrictLabelsToSenateService(ideal());
 assert.equal(result.source2022Districts,12);
 assert.equal(result.actualSenatorPrincipalRegistrationsSourceRejoined,12);
 assert.equal(result.actualSenatorExactSourceReportPdfVersions,24);
 assert.equal(result.exactOriginalPDFVersionsIndependentlyAuthenticated,24);
 assert.equal(result.firstPublicDisplayOfExactReportPDFIndependentlyProven,0);
 assert.equal(result.noTransactionOrLegacyEligibilityWork,true);
 assert.equal(result.noFilingObligationDenominator,true);
 for(const r of result.rows){
  assert.equal(r.sourceStatus,'original_CFB_district_label_and_actual_Senate_service_verified');
  assert.equal(r.originalSourcePdfSha256s.length,2);
  assert.equal(r.exactHistoricalActualPublicByDates[0],null);
  assert.equal(r.exactHistoricalActualPublicByDates[1],null);
  assert.deepEqual(r.reportPeriodStarts,['2022-01-01','2022-01-01']);
  assert.deepEqual(r.calendarDueDates,['2022-07-25','2022-10-31']);
  assert.equal(r.legallyPossibleButNotProvenReleaseFloors[0]>'2022-07-25',true);
 }
});
test('never-serving candidate, missing label or conflicting page never promoted to senator',()=>{
 const pages=ideal();pages[2].candidates=[{
  registrationNumber:pages[2].candidates[0].registrationNumber,
  candidateDisplayName:'NoLegislative, Person'}];
 pages[8].status='source_fetch_failed';pages[8].candidates=[];
 pages[9].candidates=[];
 const result=joinOfficial2022DistrictLabelsToSenateService(pages);
 assert.equal(result.actualSenatorPrincipalRegistrationsSourceRejoined,9);
 assert.equal(result.actualSenatorExactSourceReportPdfVersions,18);
 assert.equal(result.rows.filter(r=>r.observedMatchedOfficialSenator===null).length,3);
 assert.ok(result.rows.filter(r=>r.observedMatchedOfficialSenator===null)
  .every(r=>r.legalReportObligationsInferred===false));
 assert.ok(!JSON.stringify(result).includes('NoLegislative'));
 assert.ok(!JSON.stringify(result).includes('Never Served'));
});
test('wrong CFB district-to-year actual Senate service match is HOLD',()=>{
 const pages=ideal();
 pages[0].candidates=[{
  registrationNumber:pages[0].candidates[0].registrationNumber,
  candidateDisplayName:pages[1].candidates[0].candidateDisplayName}];
 const result=joinOfficial2022DistrictLabelsToSenateService(pages);
 assert.equal(result.actualSenatorPrincipalRegistrationsSourceRejoined,11);
 assert.equal(result.rows[0].observedMatchedOfficialSenator,null);
 assert.equal(result.rows[0].sourceStatus,
  'name_matches_senator_but_district_service_year_unconfirmed_hold');
});
test('duplicated original 2022 source page or wrong report proof ledger scope fails closed',()=>{
 const all=ideal();
 assert.throws(()=>joinOfficial2022DistrictLabelsToSenateService([...all,all[0]]));
 const original=readFileSync(PDF_LEDGER,'utf8');
 assert.throws(()=>readPinnedOriginal24ReportPdfs(original.replace(
  '17373:22:pcc:C:0:0','17373:22:pcc:C:0:1')));
});
test('bounded 12 public CFB 2022 viewer fetch HTTP failure is not proof of report absence',async()=>{
 const r=await acquireV15Source(async()=>{throw Error('Synthetic original source outage')});
 assert.equal(r.source2022Districts,12);
 assert.equal(r.actualSenatorPrincipalRegistrationsSourceRejoined,0);
 assert.equal(r.actualSenatorExactSourceReportPdfVersions,0);
 assert.ok(r.rows.every(x=>x.sourceStatus==='official_page_or_candidate_labels_unverified_hold'));
 assert.equal(r.notJoinedToActualServiceNeverMeansNoCandidateReport,true);
});
test('PR source workflow is public read-only and never scheduled or database connected',()=>{
 const y=readFileSync('.github/workflows/senate-864-2022-first-12-original-pdf-serving-audit-v15.yml','utf8');
 assert.match(y,/pull_request:/);
 assert.match(y,/permissions:\s*\n\s*contents: read/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-2022-first-12-original-pdfs-v15.test.mjs/);
 assert.match(y,/node --import tsx scripts\/audit-cfb-864-2022-first-12-original-pdfs-v15.mjs/);
 assert.doesNotMatch(y,/secrets\.|NEON|upload-artifact|issues: write|workflow_dispatch|schedule:|environment:/);
});
