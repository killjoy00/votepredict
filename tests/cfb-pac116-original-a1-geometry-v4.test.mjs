import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
 isOriginalA1PacPage,isOriginalA1RegisteredPacPage,
 exactPrintedPacReg,verifyOriginalA1PacTable,
 safeOriginalA1PacCohortSummary,PAC116_A1_GEOMETRY_SCHEMA
} from '../src/evidence/cfb-pac116-original-a1-geometry-v4.mjs';
import {geometryPagesForSource,safeOriginalPacPageFormatCensus}
 from '../scripts/audit-cfb-pac116-original-a1-geometry-readonly.mjs';

const SHA='c'.repeat(64),NAME='Education Minn PAC';
const report=(changes={})=>({
 reportVersionId:'18888:24:pcc:YE:0:0',committeeReg:'18888',
 reportYear:2024,pdfSha:SHA,pageNumber:3,...changes
});
const row=(i=0,changes={})=>({
 filerReg:'18888',year:2024,rowKey:(i+1).toString(16).padStart(64,'0'),
 contributorReg:'30558',contributor:NAME,transactionDate:'2024-04-10',
 amount:String(i+300)+'.00',...changes
});
const page='SCHEDULE A1 - PAC - Contributions from Political Committees and Political Funds\n'+
 '04/10/2024  30558  Education Minn PAC  300.00 300.00';
const table=[
 ['Date received','Comm./fund registration number REQUIRED',
  'Name and full address of political committee or fund',
  'Col. 1 Cash','Col. 2 In-kind','Col. 3 Total (cash & in-kind)'],
 ['04/10/2024','30558','Education Minn PAC','300.00','','300.00']
];
const registeredNames=new Map([['30558',NAME],['70001','MN Chamber of Commerce Leadership Fd']]);
function verify(over={}){
 return verifyOriginalA1PacTable({
  report:report(),pageText:page,tablePages:[table],
  allRows:[row()],registeredNames,sourceHashVerified:true,...over
 });
}
const cohort=Array.from({length:116},(_,i)=>row(i));
function summary(pageOutcomes,over={}){
 return safeOriginalA1PacCohortSummary({
  cohort,allRows:cohort,reports:[report()],pageOutcomes,
  pdfHashesChecked:1,pagesEligibleForGeometry:1,
  pagesSkippedByLimit:0,parseFailedPages:0,...over
 });
}
test('only original A1-PAC contribution pages are allowed, never instructions',()=>{
 assert.equal(isOriginalA1PacPage(page),true);
 assert.equal(isOriginalA1PacPage('INSTRUCTIONS FOR SCHEDULE A1 - PAC - Contributors'),false);
 assert.equal(isOriginalA1PacPage('SCHEDULE A1 - IND'),false);
 assert.equal(isOriginalA1PacPage('SCHEDULE B1 - PAC spending'),false);
 assert.equal(exactPrintedPacReg('30558','30558'),true);
 assert.equal(exactPrintedPacReg('305581','30558'),false);
 assert.equal(exactPrintedPacReg('130558','30558'),false);
});
test('complete CFB A1-PAC table row registers donor, date, name and TOTAL within geometry',()=>{
 const result=verify();
 assert.equal(result.a1Page,true);
 assert.equal(result.verifiedTableHeaders,1);
 assert.equal(result.privateHits.length,1);
 assert.equal(result.privateHits[0].pageNumber,3);
 const s=summary([result]);
 assert.equal(s.schema,PAC116_A1_GEOMETRY_SCHEMA);
 assert.equal(s.distinctContributionsWithExactSourceTableRow,1);
 assert.equal(s.uniqueSourceTableVersionRowPairs,1);
 assert.equal(s.sourceTablePACSameRowHitsBeforeComparator,1);
 assert.equal(s.unresolvedAmong116,115);
 assert.equal(s.historicalQualifiedPACFinanceFeatures,0);
 assert.equal(s.historicalOriginalVersionFirstPublicByProven,0);
 assert.equal(s.historicalAsOfEligibilityModified,false);
 assert.ok(!JSON.stringify(s).includes(NAME));
 assert.ok(!JSON.stringify(s).includes('18888'));
 assert.ok(!JSON.stringify(s).includes('30558'));
});
test('printed donor registration must be in the REGISTRATION column',()=>{
 const tampered=table.map(x=>[...x]);
 tampered[1][1]='';
 tampered[1][2]='Education Minn PAC 30558';
 assert.equal(verify({tablePages:[tampered]}).privateHits.length,0);
});
test('row date, monetary TOTAL and printed legal name must each corroborate',()=>{
 const alternatives=[
  ['2024/04/11','30558',NAME,'300.00','','300.00'],
  ['04/10/2024','30558',NAME,'300.00','','301.00'],
  ['04/10/2024','30558','Different political entity','300.00','','300.00'],
  ['04/10/2024','70001',NAME,'300.00','','300.00']
 ];
 for(const cells of alternatives)
  assert.equal(verify({tablePages:[[table[0],cells]]}).privateHits.length,0);
});
test('no original table means no verification, even if flattened text contains source words',()=>{
 assert.equal(verify({tablePages:[]}).privateHits.length,0);
 assert.equal(verify({pageText:'SCHEDULE B1 - CE',tablePages:[table]}).privateHits.length,0);
 assert.throws(()=>verify({sourceHashVerified:false}),/Unverified PDF/);
 assert.throws(()=>verify({report:report({pdfSha:'0'})}),/Unverified PDF/);
});
test('date/register/name/total headers must be distinct, not one ambiguous cell',()=>{
 const badHeader=[
  ['Date received registration number name and full address cash total','','',''],
  ['04/10/2024','30558',NAME,'300.00']
 ];
 assert.equal(verify({tablePages:[badHeader]}).verifiedTableHeaders,0);
});
test('a second canonical contribution competing for the same date, amount and registered PAC holds the match',()=>{
 const same={...row(1),amount:'300.00'};
 const s=summary([verify()],{allRows:[...cohort,same]});
 assert.equal(s.distinctContributionsWithExactSourceTableRow,0);
 assert.equal(s.collisionsWithOtherCanonicalContributionRows,1);
 assert.equal(s.sourceTablePACSameRowHitsBeforeComparator,1);
});
test('unknown contributor registration in same committee/year cannot disappear from comparator',()=>{
 const other={...row(999),contributorReg:'',sourceConflict:false};
 const s=summary([verify()],{allRows:[...cohort,other]});
 assert.equal(s.receivingCommitteeYearsWithUnusableComparator,1);
 assert.equal(s.distinctContributionsWithExactSourceTableRow,0);
});
test('multiple original/amended versions remain separate report source identities',()=>{
 const a=verify();
 const next=verify({report:report({reportVersionId:'18888:24:pcc:YE:0:1'})});
 const s=summary([a,next],{reports:[
  report(),report({reportVersionId:'18888:24:pcc:YE:0:1'})
 ]});
 assert.equal(s.withMultipleOriginalOrAmendedVersions,1);
 assert.equal(s.uniqueSourceTableVersionRowPairs,2);
 assert.equal(s.distinctContributionsWithExactSourceTableRow,1);
});
test('candidate page selection is a lexical triage, not a source identity proof',()=>{
 const reports=[{pdfSha:SHA,reportVersionId:'18888:24:pcc:YE:0:0'}];
 const pages=[
  {pdf_sha256:SHA,page_number:2,raw_page_text:'SCHEDULE A1 - IND 30558'},
  {pdf_sha256:SHA,page_number:3,raw_page_text:page},
  {pdf_sha256:SHA,page_number:4,raw_page_text:'SCHEDULE A1 - PAC Education Minn PAC 30558'},
  {pdf_sha256:SHA,page_number:5,raw_page_text:'Other source page'}
 ];
 const p=geometryPagesForSource({reports,pages,pacs:[
  {registration:'30558',officialName:NAME},
  {registration:'70001',officialName:'MN Chamber of Commerce Leadership Fd'}
 ],maxPages:1});
 assert.equal(p.selected.length,1);
 assert.equal(p.allEligible,2);
 assert.equal(p.deferred,1);
 assert.equal(p.originalPagesWithPACRegistration,2);
});

test('source-page format census distinguishes A1, generic donation and unseen registrations safely',()=>{
 const pages=[
  {raw_page_text:'SCHEDULE A1 - PAC - Contributions from Political Committees\n Date Received 30558 Education PAC CASH IN-KIND TOTAL 04/10/2024 $300.00'},
  {raw_page_text:'SCHEDULE A1 - IND - Individuals 04/10/2024 $300.00'},
  {raw_page_text:'Contributions received Registration number 70001 Political Committee Cash in-kind total 04/10/2024 $300.00'},
  {raw_page_text:'Reference Education chamber year end (no A1 schedule)'},
  {raw_page_text:' '},
 ];
 const got=safeOriginalPacPageFormatCensus(pages,['30558','70001']);
 assert.equal(got.originalCachedPdfPages,5);
 assert.equal(got.cachedPagesWithoutReadableText,1);
 assert.equal(got.originalPagesWithAnyA1ScheduleHeading,2);
 assert.equal(got.originalPagesWithStrictA1PacHeading,1);
 assert.equal(got.originalPagesWithExactRegisteredPACNumber,2);
 assert.equal(got.originalPagesWithRegisteredPACNumberAndAnyA1,1);
 assert.equal(got.originalPagesWithRegisteredPACNumberAndDateAndMoney,2);
 assert.equal(got.originalPagesWithPACNumberOrNameWithoutA1,2);
 assert.ok(!JSON.stringify(got).includes('70001'));
 assert.ok(!JSON.stringify(got).includes('30558'));
 assert.throws(()=>safeOriginalPacPageFormatCensus(pages,['30558']),/Bounded/);
});

test('real original generic Schedule A1 pages admit PAC proof only with literal registered PAC ID',()=>{
 const original='SCHEDULE A1 - Contributions from Political Committees and Funds 30558 Date Received';
 assert.equal(isOriginalA1PacPage(original),false);
 assert.equal(isOriginalA1RegisteredPacPage(original,['30558','70001']),true);
 const r=verify({pageText:original});
 assert.equal(r.privateHits.length,1);
 for(const bad of [
  'SCHEDULE A1 - IND individuals 30558',
  'SCHEDULE B1 political committee 30558',
  'INSTRUCTIONS FOR SCHEDULE A1 contributions from Political Committees 30558',
  'SCHEDULE A1 Contributions from political committees 305581'
 ])assert.equal(isOriginalA1RegisteredPacPage(bad,['30558','70001']),false);
});
