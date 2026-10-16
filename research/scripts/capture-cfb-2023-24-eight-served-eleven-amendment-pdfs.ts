/**
 * #864 finance-only: one-shot independent official 2024 CFB reports-tab
 * recheck then original 11 2023/2024 amended PDF body retrieval.
 * Bodies only in workflow memory; only SHA/byte/header/status are persisted.
 *
 * node --import tsx scripts/capture-cfb-2023-24-eight-served-eleven-amendment-pdfs.ts
 * --output artifacts/cfb-2023-24-eight-served-eleven-amendments.json
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot}
  from '../../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText}
  from '../../src/evidence/cfb-current-report-acquisition.js';
import {type CfbAmendedPdfSource}
  from '../../src/evidence/cfb-2023-24-sixteen-parent-authenticated-amendments.js';
import {
  ELEVEN_HISTORIC_YE_AMENDMENTS_VERSION,
  selectElevenIndependentlyParentAuthenticatedAmendments,
  auditElevenAmendedPdfs,
} from '../../src/evidence/cfb-2023-24-eight-served-eleven-amendments.js';
const P='docs/evaluation/source-proof/';
const inputFiles={
 firstCePsv:'cfb-2022-served-d13-24-original-ce-pdfs.psv',
 secondCePsv:'cfb-2022-served-d25-36-original-ce-pdfs.psv',
 previousViewerPsv:'cfb-2021-24-senate-396-original-viewer-source-observations.psv',
 sourceSnapshotPsv:'cfb-2024-eight-verified-senators-original-viewer-responses.psv',
 source27VersionPsv:'cfb-2023-24-eight-more-senators-27-source-report-reference-targets.psv',
 sourceCheckpointJson:'cfb-2024-eight-verified-senators-viewer-gap-source-checkpoint.json',
 original16SourcePsv:'cfb-2023-24-eight-more-16-original-yearend-pdf-source-ledger.psv',
 original16CheckpointJson:'cfb-2023-24-eight-more-16-original-pdf-source-checkpoint.json',
} as const;
function sourceFailure(e:unknown):string{
 const msg=e instanceof Error?e.message:String(e);
 return /timeout|abort/i.test(msg)?'official_source_timeout'
   :/HTTP [45]\d\d/i.test(msg)?'official_source_http_failure'
   :/sha|mismatch|changed|drift/i.test(msg)?'official_source_pinned_sha_mismatch'
   :'official_source_reference_or_pdf_validation_failure';
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])
   throw Error('Only --output artifacts/<new>.json is permitted');
 const output=resolve(args[1]);
 if(!output.startsWith(resolve('artifacts')+sep)||!output.endsWith('.json'))
   throw Error('Output must be metadata-only new JSON in artifacts/');
 const contents=Object.fromEntries(Object.entries(inputFiles).map(
   ([key,value])=>[key,readFileSync(P+value,'utf8')])) as
     {[K in keyof typeof inputFiles]:string};
 const selected=selectElevenIndependentlyParentAuthenticatedAmendments(contents);
 const regnums=[...new Set(selected.map(x=>x.registrationNumber))];
 const viewers:Array<{reg:string;officialUrl:string|null;
   earlierSha256:string;currentSha256:string|null;observedAt:string|null;
   matchedVersionIds:number;error:string|null}>=[];
 const pdfs=new Map<string,CfbAmendedPdfSource>();
 const failures=new Map<string,string>();
 let cursor=0;
 async function worker(){
   while(cursor<regnums.length){
     const reg=regnums[cursor++]!;
     const own=selected.filter(x=>x.registrationNumber===reg);
     const earlierSha=own[0]!.viewerApiSha256;
     let source:Awaited<ReturnType<typeof fetchCfbCandidateHistoricalReportReferenceSnapshot>>|null=null;
     try{
       source=await fetchCfbCandidateHistoricalReportReferenceSnapshot(reg,2024);
       const expectedUrl='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+reg+'/2024/';
       if(source.sourceUrl!==expectedUrl||source.responseSha256!==earlierSha)
         throw Error('Original official CFB candidate viewer source SHA or URL mismatch');
       const mapped=own.map(t=>{
         const matching=source!.references.filter(r=>r.registrationNumber===reg
           &&r.year===String(t.year).slice(2)&&r.type==='pcc'
           &&r.period==='YE'&&r.se==='0'&&r.amendment===t.amendmentIndex);
         if(matching.length!==1)
           throw Error('Expected exactly one source official report amendment version');
         return{t,r:matching[0]!};
       });
       viewers.push({reg,officialUrl:source.sourceUrl,earlierSha256:earlierSha,
         currentSha256:source.responseSha256,observedAt:source.fetchedAt,
         matchedVersionIds:mapped.length,error:null});
       for(const {t,r} of mapped){
         try{
           const pdf=await fetchCfbReportViewerText(r,
             {method:'POST',referer:source.sourceUrl,searchType:'Candidate'});
           pdfs.set(t.id,{sourceUrl:pdf.sourceUrl,sha256:pdf.contentSha256,
             bytes:pdf.bytes,observedAt:pdf.fetchedAt,text:pdf.text});
         }catch(e){failures.set(t.id,sourceFailure(e));}
       }
     }catch(e){
       const error=sourceFailure(e);
       viewers.push({reg,officialUrl:source?.sourceUrl??null,
         earlierSha256:earlierSha,currentSha256:source?.responseSha256??null,
         observedAt:source?.fetchedAt??null,matchedVersionIds:0,error});
       for(const t of own)failures.set(t.id,error);
     }
     await new Promise(ok=>setTimeout(ok,140));
   }
 }
 await Promise.all([worker(),worker()]);
 const result=auditElevenAmendedPdfs(selected,pdfs,failures);
 const viewerPass=viewers.length===6&&viewers.every(r=>r.error===null
   &&r.earlierSha256===r.currentSha256&&r.matchedVersionIds>0);
 const complete=result.summary.allElevenPdfsDistinctAndAuthenticated
   &&pdfs.size===11&&viewerPass;
 const artifact={
   schemaVersion:ELEVEN_HISTORIC_YE_AMENDMENTS_VERSION,
   retrievedAt:new Date().toISOString(),
   scope:{issue:864,publicSourceOnly:true,
     earlier2022ActuallyServingSenatorRegistrations:6,
     originalParentPdfVersionsIndependentlyAuthenticated:8,
     reportYear2023VersionCount:4,reportYear2024VersionCount:7,
     reportVersionKeys:11,historicAsOfPublicByNotProven:true,
     requiredStatutoryFilingDenominator:null,activeServiceAfter2022NotAssumed:true},
   originalSourceLedgers:Object.values(inputFiles).map(x=>P+x),
   viewerRechecks:viewers.sort((a,b)=>a.reg.localeCompare(b.reg)),
   sourceAmendmentReportProofs:result.reports,
   outcome:{...result.summary,originalCfbPdfsRetrieved:pdfs.size,
     allOfficialViewerResponsesStillAuthenticated:viewerPass,
     strictAllElevenUniquePdfs:complete},
   safeguards:{noSourcePdfBodiesSaved:true,noExtractedReportTextSaved:true,
     noDonorOrMoneyRowsPersisted:true,noProductionDatabaseReadWrite:true,
     noForecastServingSchedulerOr2027Change:true,
     legallyOwedDenominatorNotInferred:true,
     actualHistoricalPublicByUnproven:true,keepIssue864Open:true},
 };
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({issue:864,requested:11,
   pdfBodiesRetrieved:pdfs.size,verified:result.summary.authenticFirstPageAmendmentVersionReferences,
   unique:result.summary.uniqueAuthenticatedAmendedPdfs,
   duplicates:result.summary.documentedOrUnexpectedDuplicateVersionAliases,
   parentAliases:result.summary.identicalOriginalParentBinaryReferences,
   sourceHolds:result.summary.unverifiedSourceReferences,
   sourceViewersAllVerified:viewerPass,
   output,productionWrites:0},null,2));
 if(!complete)process.exitCode=1;
}
main().catch(e=>{console.error(sourceFailure(e));process.exitCode=1;});
