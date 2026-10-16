/**
 * #864 public Minnesota Campaign Finance Board source-only forensic work.
 * Compare original GET vs original POST official CFB PDFs for precisely TWO
 * already documented held 2023 finance references of actual 2022 senators.
 * No report bodies, donor names, third party identities, money or statements
 * get written to the JSON artifact. Any source drift fails closed.
 *
 * node --import tsx scripts/audit-cfb-2023-24-two-held-original-source-pdfs.ts
 *   --output artifacts/cfb-2023-24-two-held-source-diagnostics.json
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot}
  from '../../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText}
  from '../../src/evidence/cfb-current-report-acquisition.js';
import {
  selectTwoHeldOfficialCfbSourceDocuments,heldOfficialSourceRef,
  analyzeHeldCfbSourceBinary,compareHeldCfbGetPost,
  type HeldSourceFetch,
  CFB_TWO_HELD_SOURCE_DIAGNOSTICS_SCHEMA,
} from '../evidence/cfb-2023-24-held-source-pdf-diagnostics.js';
const P='docs/evaluation/source-proof/';
const names={
 lang16Psv:'cfb-2023-24-eight-more-16-original-yearend-pdf-source-ledger.psv',
 putnam16Psv:'cfb-2023-24-parent-authenticated-16-amendment-pdf-source-ledger.psv',
 langCheckpointJson:'cfb-2023-24-eight-more-16-original-pdf-source-checkpoint.json',
 putnamCheckpointJson:'cfb-2023-24-parent-authenticated-16-amendment-source-checkpoint.json',
} as const;
function sourceFailure(e:unknown):string{
 const msg=e instanceof Error?e.message:String(e);
 return /timeout|abort/i.test(msg)?'official_source_timeout'
  :/HTTP [45]\d\d/i.test(msg)?'official_source_http_failure'
  :/SHA|drift|changed|mismatch/i.test(msg)?'pinned_official_source_sha_changed'
  :'official_source_pdf_parse_or_reference_failure';
}
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==2||a[0]!=='--output'||!a[1])
  throw Error('Only --output artifacts/<new>.json is permitted');
 const out=resolve(a[1]);
 if(!out.startsWith(resolve('artifacts')+sep)||!out.endsWith('.json'))
  throw Error('Only artifact metadata JSON output permitted');
 const source=Object.fromEntries(Object.entries(names).map(([k,v])=>
   [k,readFileSync(P+v,'utf8')])) as {[K in keyof typeof names]:string};
 const targets=selectTwoHeldOfficialCfbSourceDocuments(source);
 const result=[];
 for(const target of targets){
  let viewer:Awaited<ReturnType<typeof fetchCfbCandidateHistoricalReportReferenceSnapshot>>|null=null;
  let viewerError:string|null=null;
  let post:HeldSourceFetch|null=null,get:HeldSourceFetch|null=null;
  let postErr:string|null=null,getErr:string|null=null;
  try{
   viewer=await fetchCfbCandidateHistoricalReportReferenceSnapshot(target.reg,2024);
   if(viewer.responseSha256!==target.viewerSha256
    ||viewer.sourceUrl!=='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+target.reg+'/2024/')
     throw Error('Previously source-authenticated original CFB candidate viewer response changed');
   const refs=viewer.references.filter(r=>r.registrationNumber===target.reg
     &&r.year==='23'&&r.type==='pcc'&&r.period==='YE'
     &&r.se==='0'&&r.amendment===target.amendmentIndex);
   if(refs.length!==1)throw Error('Exact previously held original CFB PDF reference absent');
   try{
    const item=await fetchCfbReportViewerText(refs[0]!,{
      method:'POST',referer:viewer.sourceUrl,searchType:'Candidate'});
    post={sourceUrl:item.sourceUrl,sha256:item.contentSha256,bytes:item.bytes,
      observedAt:item.fetchedAt,text:item.text};
   }catch(e){postErr=sourceFailure(e);}
   try{
    const item=await fetchCfbReportViewerText(refs[0]!,{
      method:'GET',referer:viewer.sourceUrl});
    get={sourceUrl:item.sourceUrl,sha256:item.contentSha256,bytes:item.bytes,
      observedAt:item.fetchedAt,text:item.text};
   }catch(e){getErr=sourceFailure(e);}
  }catch(e){viewerError=sourceFailure(e);postErr=viewerError;getErr=viewerError;}
  const p=analyzeHeldCfbSourceBinary(target,post,'POST',postErr);
  const g=analyzeHeldCfbSourceBinary(target,get,'GET',getErr);
  const cross=compareHeldCfbGetPost(target,p,g);
  result.push({referenceId:target.id,
   actual2022ServingSenator:target.actual2022ServingSenator,
   authenticOriginalCFBViewerSha256:target.viewerSha256,
   originalCFBViewerSourceRechecked:!!viewer&&viewerError===null
      &&viewer.responseSha256===target.viewerSha256,
   viewerFetchedAt:viewer?.fetchedAt??null,
   officialPdfPost:p,officialPdfGet:g,
   independentHttpMethodComparison:cross,
   sourceIdentityHoldRemain:true});
 }
 const summary={
  originalHeldSourceDocumentsRechecked:result.length,
  previouslyKnownExactPostBinaryShaBytesReproduced:result.filter(x=>
    x.independentHttpMethodComparison.postRetrievalAgainMatchesPinnedHeldPdf).length,
  originalGetVersionsAvailable:result.filter(x=>
    x.independentHttpMethodComparison.independentlyGetRetrieved).length,
  officialGetPostBinaryIdentical:result.filter(x=>
    x.independentHttpMethodComparison.independentGetAndPostBinariesIdentical===true).length,
  reviewedHeldOriginalDocumentCount:2,
  sourcePdfIdentityHoldsStillInForce:2,
  independentProofOfFinanceReportIdentity:0,
  legalFilingObligationsEstablished:null,
  historicalPublicByEstablished:0,
 };
 const payload={schemaVersion:CFB_TWO_HELD_SOURCE_DIAGNOSTICS_SCHEMA,
  dateObserved:new Date().toISOString(),issue:864,
  originalImmutableSourceInputs:Object.values(names).map(n=>P+n),
  result,summary,
  safety:{officialCFBSourceOnly:true,sourcePdfContentOrExtractedTextSaved:false,
   rawCFBReportsApiResponseSaved:false,foreignCommitteeIdentitiesSaved:false,
   onlyPreviouslyVerifiedServingSenatorNamesSaved:true,
   donorVendorContributionTransactionDataSaved:false,
   noPromotionOfHeldDocumentToValidFinanceReport:true,
   noProductionDbReadOrWrite:true,noModelForecastSchedulerOr2027Changes:true,
   keepIssue864Open:true},
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(payload,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({issue:864,sourceDocuments:2,...summary,output:out,
   productionWrites:0},null,2));
 if(summary.previouslyKnownExactPostBinaryShaBytesReproduced!==2
  ||result.some(x=>!x.originalCFBViewerSourceRechecked))process.exitCode=1;
}
main().catch(e=>{console.error(sourceFailure(e));process.exitCode=1;});
