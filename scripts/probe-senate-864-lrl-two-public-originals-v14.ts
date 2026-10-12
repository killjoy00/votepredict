/**
 * #864 UNPRIVILEGED public-only two-original 2026-observed LRL directory test.
 * Do not export a Senator name, term row, source HTML, stored member identity,
 * private YEA choice or source-PDF URL; only original document SHA/digest and
 * yes/no equality of 2024-service-year facts.
 */
import {acquireOriginalLrl2024SenateYearServiceSemanticV14} from
 '../src/evidence/senate-864-2024-lrl-year-service-directory-semantic-v14.js';

async function main(){
 let phase='original_one_public_html';
 try{
  const first=await acquireOriginalLrl2024SenateYearServiceSemanticV14();
  phase='original_two_public_html';
  const second=await acquireOriginalLrl2024SenateYearServiceSemanticV14();
  phase='original_year_2024_semantic_comparison';
  if(first.semantic2024ServiceSha256!==second.semantic2024ServiceSha256||
   first.candidates.length!==second.candidates.length)
   throw Error('LRL year-2024 service facts changed between complete originals');
  console.log('SENATE_864_LRL_2024_TWO_ORIGINAL_SAFE='+JSON.stringify({
   schemaVersion:'senate-864-lrl-dual-public-original-semantic-v14',
   firstRawOriginalSha256:first.rawOriginalSha256,
   secondRawOriginalSha256:second.rawOriginalSha256,
   completeOriginalRawShaIdentical:
    first.rawOriginalSha256===second.rawOriginalSha256,
   same2024SenateServiceNameTermDistrictDigest:true,
   canonical2024ServiceSha256:first.semantic2024ServiceSha256,
   year2024PersonCount:first.candidates.length,
   firstOriginalBytes:first.bytes,
   secondOriginalBytes:second.bytes,
   sourceIsCurrentObservedDirectoryNot2024Contemporaneous:true,
   precise2024HearingDayServiceIndependentlyProven:false,
   publishedPrivateMemberNames:false,
   originalPublicHtmlUploaded:false,
   neonOrAnyDatabaseAccess:false,
   historicIngestionCauseInferred:false,
  }));
 }catch{
  console.error('SENATE_864_LRL_2024_TWO_ORIGINAL_HOLD='+JSON.stringify({
   schemaVersion:'senate-864-lrl-dual-public-original-semantic-v14',
   safePhase:['original_one_public_html','original_two_public_html',
    'original_year_2024_semantic_comparison'].includes(phase)?phase:'unclassified',
   official2024ServiceFactsAuthenticAcrossTwoOriginals:false,
   databaseAccess:false,
   memberNamesOrOriginalHtmlReleased:false,
  }));
  process.exitCode=1;
 }
}
void main();
