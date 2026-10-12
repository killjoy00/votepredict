import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 CFB_864_TAP_V10_SCHEMA,CFB_864_TAP_V10_MARKER,
 TAP_PUBLIC_CONTRIBUTIONS,countPublicCleanedCfbRows,
 auditTapCleanedContributionBodyV10,reportIndependentPublisherV10,
} from '../scripts/verify-cfb-864-public-publisher-cleaned-v10.mjs';

const header=[
 'recipient_reg_num','recipient','recipient_type','amount','date','year',
 'contributor','contrib_reg_num','contrib_type','receipt_type','in_kind',
].join(',');
const rows=[
 '10001,Test Senate Committee,PCC,250,2021-04-01,2021,"Synthetic, Contributor",,Individual,Contribution,FALSE',
 '10002,Test Senate Committee,PCC,300,2022-02-11,2022,"Synthetic donor",,Individual,Contribution,FALSE',
 '40002,Test Committee,PCF,350,2022-03-07,2022,"Synthetic donor with',
 'multiline display",,Individual,Contribution,FALSE',
 '10003,Test Senate Committee,PCC,200,2023-01-02,2023,"Synthetic donor",,Individual,Contribution,FALSE',
];
// Join including intentionally quoted newline in the third record.
const fixture=Buffer.from([header,...rows].join('\n')+'\n');
function served(body,url,status=200,headers={}){
 const response=new Response(body,{status,headers});
 Object.defineProperty(response,'url',{value:url});
 return response;
}
test('pinned public S3 publisher object identity and non-original 2023 provenance boundary',()=>{
 assert.equal(CFB_864_TAP_V10_SCHEMA,
  'cfb-864-publisher-cleaned-csv-independent-corroboration-v10');
 assert.equal(CFB_864_TAP_V10_MARKER,
  'SENATE_864_CFB_INDEPENDENT_CLEANED_PUBLISHER_V10_20261012');
 assert.equal(TAP_PUBLIC_CONTRIBUTIONS.expectedV7HeadBytes,58871220);
 assert.equal(TAP_PUBLIC_CONTRIBUTIONS.publisherNotebookRows,359673);
 assert.equal(TAP_PUBLIC_CONTRIBUTIONS.documentedNotebookDate,'2023-02-27');
});
test('RFC-style quoted fields, embedded newline and escaped quote do not leak names',()=>{
 const result=countPublicCleanedCfbRows(fixture);
 assert.equal(result.schemaColumns,11);
 assert.equal(result.totalRows,4);
 assert.equal(result.yearCounts2015to2023['2021'],1);
 assert.equal(result.yearCounts2015to2023['2022'],2);
 assert.equal(result.yearCounts2015to2023['2023'],1);
 assert.equal(result.filerTypePcc2021,1);
 assert.equal(result.filerTypePcc2022,1);
 assert.equal(result.otherOrMissingYearCount,0);
 assert.equal(result.financeEntityClassNotSenateVerified,true);
 assert.doesNotMatch(JSON.stringify(result),/Synthetic|Test Senate Committee|"recipient"/);
 const escaped=Buffer.from([header,
  '10001,PCC,PCC,10,2021-01-01,2021,"Quote ""in"" name",,Individual,Contribution,FALSE',
 ].join('\n')+'\n');
 assert.equal(countPublicCleanedCfbRows(escaped).totalRows,1);
});
test('malformed source schema, row cardinality, invalid quote and overlong field reject',()=>{
 for(const csv of [
  'not,a,valid,publisher,header\n1,2,3,4,5\n',
  header+'\n1,2,3\n',
  header+'\n10001,Test Committee,PCC,10,2021-01-01,2021,"unterminated',
  header+'\n10001,Test Committee,PCC,10,2021-01-01,2021,Donor,,Individual,Contribution,FALSE,unexpected\n',
  header+'\n10001,Test Committee,PCC,10,2021-01-01,2021,"'+
   'a'.repeat(10010)+'",,Individual,Contribution,FALSE\n',
 ]){
  assert.throws(()=>countPublicCleanedCfbRows(Buffer.from(csv)));
 }
});
test('HEAD HTTP failure stops before GET and cannot imply no campaign finance records',async()=>{
 const calls=[];
 const r=await auditTapCleanedContributionBodyV10(async(url,opts)=>{
  calls.push({url:String(url),method:opts.method,redirect:opts.redirect});
  return served('',String(url),503);
 });
 assert.equal(calls.length,1);
 assert.equal(calls[0].method,'HEAD');
 assert.equal(calls[0].redirect,'manual');
 assert.equal(r.status,'head_http_hold');
 assert.equal(r.headHttpStatus,503);
 assert.equal(r.getHttpStatus,null);
 assert.equal(r.coverageCounts,null);
 assert.equal(r.entirePublisherCleanedBodySha256,null);
});
test('changed HEAD byte length cannot certify current S3 version',async()=>{
 const r=await auditTapCleanedContributionBodyV10(async(url,opts)=>{
  assert.equal(opts.method,'HEAD');
  return served(null,String(url),200,{'content-length':'58871219',
   'last-modified':'Wed, 01 Mar 2023 10:00:00 GMT'});
 });
 assert.equal(r.status,'publisher_object_size_changed_hold');
 assert.equal(r.observedHeadBytes,58871219);
 assert.equal(r.priorV7HeadBytesAgreement,false);
 assert.equal(r.objectHttpLastModifiedDay,'2023-03-01');
});
test('synthetic service refusal preserves no-private-DB, no-first-public inference',async()=>{
 const calls=[];
 const receipt=await reportIndependentPublisherV10(async(url,opts)=>{
  calls.push([String(url),opts.method]);
  throw Error('Synthetic public source unavailable');
 });
 assert.equal(calls.length,1);
 assert.equal(receipt.zeroDatabaseWrites,true);
 assert.equal(receipt.productionEligibilityUnmodified,true);
 assert.equal(receipt.publisherNotebookDateNotSnapshotPublicByProof,true);
 assert.equal(receipt.normalizedCleanedRowsNotOriginalCanonicalCsvKeys,true);
 assert.equal(receipt.currentlyReturnedS3ObjectNotVerifiedHistoricalJuneVersion,true);
 assert.equal(receipt.noDonorsRecipientsAmountsOrTransactionKeysLogged,true);
 assert.equal(receipt.publisher.status,'head_network_or_identity_hold');
 assert.doesNotMatch(JSON.stringify(receipt),/publicaccountability\.s3|cfb\.mn\.gov|Synthetic public/);
});
test('public CI no protected secrets, raw file uploads, scheduler or contacts',()=>{
 const workflow=readFileSync(
  '.github/workflows/senate-864-cfb-publisher-cleaned-full-body-v10.yml','utf8');
 assert.match(workflow,/pull_request:/);
 assert.match(workflow,/permissions:\s*\n\s*contents: read/);
 assert.match(workflow,/node --test tests\/cfb-864-public-publisher-cleaned-v10\.test\.mjs/);
 assert.match(workflow,/node scripts\/verify-cfb-864-public-publisher-cleaned-v10\.mjs/);
 assert.doesNotMatch(workflow,/NEON_API_KEY|secrets\.|upload-artifact|issues: write|workflow_dispatch|schedule:|environment:|email/);
});
