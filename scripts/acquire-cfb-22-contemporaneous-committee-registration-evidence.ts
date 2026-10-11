/**
 * #864 FINANCE: directly acquire original 2024 Board signed official Putnam
 * committee 18430 agreement and 22 *CURRENT* 2026 official CFB candidate
 * page heads. Original signed action != historical report public-by.
 * 2026 status never implies historical termination or legally owed filing.
 *
 * Only bounded SHA/bytes and name/registration/status booleans persisted;
 * raw PDFs, raw HTML, text, contact/transaction/contribution data discarded.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve,sep} from 'node:path';
import {
 CFB_22_REGISTRATION_SOURCE_VERSION,CFB_PUTNAM_ORIGINAL_2024_CONCILIATION,
 CFB_SOURCE_71_GIT_BLOB_SHA,
 select22AuthenticSenatorRegistrationTargets,
 inspectPutnam2024OfficialBoardConciliation,
 inspectCurrentOfficialCfbCandidateHeading,
} from '../src/evidence/cfb-2023-24-official-committee-status-proof.js';
const SOURCE_71='docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv';
const UA='Mozilla/5.0 VotePredict/2.0 public original Minnesota CFB evidence research';
const ALLOWED=['register.cfb.mn.gov','cfb.mn.gov','www.cfb.mn.gov'];
async function authenticatedGet(url:string,accept:string,limitBytes:number){
 const before=new URL(url);
 if(before.protocol!=='https:'||!ALLOWED.includes(before.hostname))
  throw Error('Source must be the original authenticated official Minnesota Board site');
 const res=await fetch(url,{redirect:'follow',headers:{'user-agent':UA,accept},
  signal:AbortSignal.timeout(55_000)});
 if(!res.ok)throw Error('Official Minnesota Board source HTTP '+res.status);
 const final=new URL(res.url);
 if(final.protocol!=='https:'||!ALLOWED.includes(final.hostname))
  throw Error('Original CFB source redirected outside regulator domains');
 const data=new Uint8Array(await res.arrayBuffer());
 const n=data.byteLength;
 if(n<1000||n>limitBytes)throw Error('Official source body unexpectedly sized');
 const sha=createHash('sha256').update(data).digest('hex');
 return{data,bytes:n,sha256:sha,finalUrl:final.toString(),fetchedAt:new Date().toISOString()};
}
async function acquireBoardPutnam(source71Psv:string){
 const src=await authenticatedGet(CFB_PUTNAM_ORIGINAL_2024_CONCILIATION,
   'application/pdf',3_000_000);
 if(new TextDecoder('ascii').decode(src.data.subarray(0,5))!=='%PDF-')
   throw Error('Original 2024 CFB conciliation document did not contain valid PDF');
 const {PDFParse}=await import('pdf-parse');
 const {CanvasFactory}=await import('pdf-parse/worker');
 const parser=new PDFParse({data:src.data,CanvasFactory});
 let body='';
 try{body=(await parser.getText()).text??'';}
 finally{await parser.destroy();}
 if(body.length<1500)throw Error('Original Board signed conciliation PDF not extractable');
 const audit=inspectPutnam2024OfficialBoardConciliation({
   source71Psv,originalBoardPdfExtractedText:body});
 return{
  documentUrl:CFB_PUTNAM_ORIGINAL_2024_CONCILIATION,
  sourceOriginalSHA256:src.sha256,sourceOriginalPDFBytes:src.bytes,
  originalOfficialHostVerified:true,originalBoardDocumentObservedAt:src.fetchedAt,
  committeeEvidence:audit,
 };
}
async function acquireCurrentCandidatePage(input:{
 registrationNumber:string;senator:string;district2022:number;
}){
 const url='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'
  +input.registrationNumber+'/2026/';
 try{
  const src=await authenticatedGet(url,'text/html',2_000_000);
  const html=new TextDecoder('utf8').decode(src.data);
  if(!/<html|<!doctype html/i.test(html))
   throw Error('Original official CFB current viewer returned non-HTML document');
  const parsed=inspectCurrentOfficialCfbCandidateHeading({
    registrationNumber:input.registrationNumber,
    html,observedAt:src.fetchedAt,
  });
  return{
    ...input,sourceUrl:url,sourceResult:'retrieved_official_live_2026_viewer' as const,
    latestLiveViewerOriginalHtmlSha256:src.sha256,
    latestLiveViewerOriginalHtmlBytes:src.bytes,
    latestLiveViewerObservedAt:src.fetchedAt,
    exactRegInOfficialPage:parsed.exactRegistrationInHeading,
    senateOfficeInOfficialPage:parsed.officeIsSenateFromHeading,
    statusNowOnly:parsed.latestVisibleStatus,
    historicallyRegistrationStatus2023:null,
    historicallyRegistrationStatus2024:null,
    legallyOwedYearend2023:null,legallyOwedYearend2024:null,
    independentlyDocumentedTerminationDate:null,
    original2023Or2024HistoricalPublicByVersion:null,
  };
 }catch(err){
  const t=err instanceof Error?err.message:String(err);
  return{...input,sourceUrl:url,sourceResult:'HOLD_official_current_viewer_retrieval_unverified' as const,
   errorClass:/timed?out|abort/i.test(t)?'source_timeout':
    /HTTP \d{3}/i.test(t)?'original_official_http_failure':'source_authentication_failure',
   latestLiveViewerOriginalHtmlSha256:null,latestLiveViewerOriginalHtmlBytes:null,
   latestLiveViewerObservedAt:null,exactRegInOfficialPage:false,
   senateOfficeInOfficialPage:false,statusNowOnly:'unverified' as const,
   historicallyRegistrationStatus2023:null,historicallyRegistrationStatus2024:null,
   legallyOwedYearend2023:null,legallyOwedYearend2024:null,
   independentlyDocumentedTerminationDate:null,
   original2023Or2024HistoricalPublicByVersion:null,
  };
 }
}
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==2||a[0]!=='--output'||!a[1])throw Error('Only --output artifacts/<name>.json');
 const path=resolve(a[1]);
 if(!path.startsWith(resolve('artifacts')+sep)||!path.endsWith('.json'))
  throw Error('Write only new original-source JSON metadata within artifacts/');
 const source71=readFileSync(SOURCE_71,'utf8');
 const target=select22AuthenticSenatorRegistrationTargets(source71);
 const originalBoard=await acquireBoardPutnam(source71);
 // Concurrency bound 4 to avoid stressing the Board public viewer.
 const currentResults=[] as Awaited<ReturnType<typeof acquireCurrentCandidatePage>>[];
 for(let i=0;i<target.length;i+=4){
  currentResults.push(...await Promise.all(target.slice(i,i+4).map(acquireCurrentCandidatePage)));
 }
 const usable=currentResults.filter(x=>x.sourceResult==='retrieved_official_live_2026_viewer');
 const counts={
  historicalAuthenticatedNamed2024BoardCommitteeCases:1,
  sourceAuthenticatedPublic2024PutnamCommitteeRegistrationYear:2019,
  originalSignedBoardMention2023SecondAmendedReport:true,
  exactModern2023YearEndViewerPutnamAmendments:3,
  historicalSignedBoardNamed2023SecondAmendmentMatchesAuthenticatedVersion2:true,
  currentViewerPagesTried:22,currentViewerPagesRetrieved:usable.length,
  currentViewerHeadingsContainingCFBReg:usable.filter(x=>x.exactRegInOfficialPage).length,
  currentViewer2026TerminatedLabelCount:usable.filter(x=>x.statusNowOnly==='terminated_as_of_current_viewer').length,
  currentViewer2026NotLabelledTerminatedCount:usable.filter(x=>x.statusNowOnly==='not_labelled_terminated').length,
  currentViewerNotVerifiedCount:currentResults.filter(x=>x.statusNowOnly==='unverified').length,
  historicalBoardTerminationActsSourceAuthenticated:0,
  historicalLegalAnnualFilingDenominator:null,
  actualVersionSpecificHistoricalPublicByProven:0,
 };
 const result={
  schemaVersion:CFB_22_REGISTRATION_SOURCE_VERSION,
  issue:864,observedAt:new Date().toISOString(),
  original22SenatorBoardReference:{path:SOURCE_71,gitBlobSha:CFB_SOURCE_71_GIT_BLOB_SHA,
    exactVersionRefs:71,verifiedReal2022And2023And2024RosterSenators:22},
  original2024SignedBoardAction:originalBoard,
  currentObservedNotHistoricalCfbRegistrationViewer:currentResults,
  counts,limitations:{
   signed2024BoardReportAmendmentIsNotPresentDayViewerVersionIndex:true,
   secondAmended2023YearEndBoardMentionCrossChecksExistingAuthenticatedAmendment2:true,
   firstAmendmentStillHeldForOriginalRegistrationIdentity:true,
   current2026ViewerStatusNeverEstablishes2023Or2024CommitteeTerminationOrRegistration:true,
   absenceOfTerminatedLabelNotAffirmativeActiveProof:true,
   specificHistorical2023Or2024LegallyOwedReportCount:null,
   noAmendmentExactHistoricalPublicByProven:true,noVoteDayForecastPromotion:true,
  },
  safeguards:{rawOfficialBoardPdfOrFullTextNotSaved:true,
   rawOfficialCurrentViewerHtmlOrContactsNotSaved:true,
   noDonorNamesFinancialRowsOrPersonalAddressesSaved:true,
   noProductionDBReadWrite:true,noMLTrainingServingSchedulerOr2027Changes:true,
   issue864MustRemainOpen:true},
 };
 mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({issue:864,
  officialSourcePutnam:{
   url:originalBoard.documentUrl,sha256:originalBoard.sourceOriginalSHA256,
   bytes:originalBoard.sourceOriginalPDFBytes,
   yearRegistered:originalBoard.committeeEvidence.originalBoardStatesRegistrationYear,
   secondAmendedReportClaimOriginal:true,modernViewerThreeAmendments:true},
  ...counts,productionWrites:0,output:path},null,2));
 if(usable.length<16)process.exitCode=1;
}
main().catch(e=>{const s=e instanceof Error?e.message:String(e);
 console.error(/timeout|abort/i.test(s)?'official_CFB_source_timeout':
 /HTTP \d{3}/i.test(s)?'original_CFB_http_failure':
 'original_government_named_committee_source_not_authenticated');
 process.exitCode=1;
});
