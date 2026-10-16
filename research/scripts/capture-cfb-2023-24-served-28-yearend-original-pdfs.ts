/**
 * #864 source-only, PR-triggered one-shot acquisition of 28 original PDF
 * versions from OFFICIAL CFB candidate viewer, for 14 people earlier proved
 * actually serving senators in 2022. No report bodies or donor text persisted.
 *
 * node --import tsx scripts/capture-cfb-2023-24-served-28-yearend-original-pdfs.ts
 *   --output artifacts/cfb-2023-24-served-28-yearend-original-source.json
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot}
  from '../../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText}
  from '../../src/evidence/cfb-current-report-acquisition.js';
import {
  VERIFIED_SERVING_2023_24_YE_SOURCE_VERSION,
  selectServed2023to24OriginalYearEnds,
  auditServed2023to24OriginalYearEnd,summarize28YearEndSource,
} from '../../src/evidence/cfb-2023-24-served-28-yearend-originals.js';

const P='docs/evaluation/source-proof/';
const VIEW=P+'cfb-2021-24-senate-396-original-viewer-source-observations.psv';
const QUEUE=P+'cfb-2021-25-served-senator-next-source-pdf-targets.psv';
const CE1=P+'cfb-2022-served-d13-24-original-ce-pdfs.psv';
const CE2=P+'cfb-2022-served-d25-36-original-ce-pdfs.psv';
function sourceError(e:unknown){
  const x=e instanceof Error?e.message:String(e);
  return /timeout|abort/i.test(x)?'official_source_http_timeout'
    :/HTTP [45]\d\d/i.test(x)?'official_source_http_failure'
    :/SHA|drift|changed|mismatch/i.test(x)?'pinned_official_api_or_original_source_changed'
    :'official_original_pdf_identity_or_source_failure';
}
async function main(){
  const a=process.argv.slice(2);
  if(a.length!==2||a[0]!=='--output'||!a[1])
    throw Error('Only --output artifacts/<new-json> permitted');
  const out=resolve(a[1]);
  if(!out.startsWith(resolve('artifacts')+sep)||!out.endsWith('.json'))
    throw Error('Only artifacts metadata JSON may be written');
  const targets=selectServed2023to24OriginalYearEnds({
    queuePsv:readFileSync(QUEUE,'utf8'),
    viewerPsv:readFileSync(VIEW,'utf8'),
    priorCeFirstPsv:readFileSync(CE1,'utf8'),
    priorCeSecondPsv:readFileSync(CE2,'utf8')});
  const registrations=[...new Set(targets.map(t=>t.reg))];
  const viewerProofs:Array<{registration:string;priorViewerBodySha256:string;
    currentBodySha256:string|null;url:string|null;obtainedAt:string|null;
    exactOriginalRefCount:number;error:string|null}>=[];
  const fetched=new Map<string,{sourceUrl:string;sha256:string;bytes:number;observedAt:string;text:string}>();
  const failures=new Map<string,string>();
  let next=0;
  async function worker(){
    while(next<registrations.length){
      const reg=registrations[next++]!;
      const group=targets.filter(t=>t.reg===reg);
      const pinnedSha=group[0]!.originalViewerApiSha256;
      let snap:Awaited<ReturnType<typeof fetchCfbCandidateHistoricalReportReferenceSnapshot>>|null=null;
      try{
        snap=await fetchCfbCandidateHistoricalReportReferenceSnapshot(reg,2024);
        if(snap.responseSha256!==pinnedSha||snap.sourceUrl!==
          'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+reg+'/2024/')
          throw Error('Previously source-pinned candidate viewer response changed');
        const exact=group.map(t=>{
          const matched=snap!.references.filter(r=>r.registrationNumber===reg
            &&r.year===String(t.reportYear).slice(2)&&r.type==='pcc'
            &&r.period==='YE'&&r.se==='0'&&r.amendment===0);
          if(matched.length!==1)
            throw Error('Original yearend CFB version reference not uniquely reverified');
          return{t,r:matched[0]!};
        });
        viewerProofs.push({registration:reg,priorViewerBodySha256:pinnedSha,
          currentBodySha256:snap.responseSha256,url:snap.sourceUrl,
          obtainedAt:snap.fetchedAt,exactOriginalRefCount:exact.length,error:null});
        for(const {t,r} of exact){
          try{
            const pdf=await fetchCfbReportViewerText(r,{
              method:'POST',referer:snap.sourceUrl,searchType:'Candidate'});
            fetched.set(t.id,{sourceUrl:pdf.sourceUrl,sha256:pdf.contentSha256,
              bytes:pdf.bytes,observedAt:pdf.fetchedAt,text:pdf.text});
          }catch(e){failures.set(t.id,sourceError(e));}
        }
      }catch(e){
        viewerProofs.push({registration:reg,priorViewerBodySha256:pinnedSha,
          currentBodySha256:snap?.responseSha256??null,url:snap?.sourceUrl??null,
          obtainedAt:snap?.fetchedAt??null,exactOriginalRefCount:0,
          error:sourceError(e)});
        for(const t of group)failures.set(t.id,sourceError(e));
      }
      await new Promise(done=>setTimeout(done,135));
    }
  }
  await Promise.all([worker(),worker(),worker()]);
  const rows=targets.map(t=>auditServed2023to24OriginalYearEnd(t,
    fetched.get(t.id)??null,failures.get(t.id)??null));
  const result=summarize28YearEndSource(rows);
  const payload={
    schemaVersion:VERIFIED_SERVING_2023_24_YE_SOURCE_VERSION,
    observedAt:new Date().toISOString(),
    scope:{issue:864,financeTrack:'original_verified_2023_24_yearend_pdf_proofs',
      sourceVerified2022ServingSenators:14,reportYear2023OriginalVersions:14,
      reportYear2024OriginalVersions:14,officialViewerSegment:2024,
      subsequent2023And2024SenateServiceNotAssumed:true,
      legallyRequiredReportDenominator:null},
    existingOriginalSourceEvidence:{candidateViewer394Plus2MetadataPsv:VIEW,
      originalVerified2022ServingSenatorFinanceRegistrations:[CE1,CE2],
      sourceVersionReferenceAcquisitionQueue:QUEUE,
      independentlyVerifiedHistoricalPublicBy:0},
    officialCandidateViewerApiChecks:viewerProofs.sort((a,b)=>a.registration.localeCompare(b.registration)),
    originalPdfReportHeaders:rows,
    result,
    originalPdfBinariesRetrievedOnlyIntoWorkflowMemory:fetched.size,
    safeguards:{noPDFBodiesOrDonorListsCommitted:true,
      candidateNamesWithoutProvedActualSenateServiceNotStored:true,
      no2023to24SenateServiceAssumed:true,
      applicableIndependentReportCalendarDueDateNotYetEstablished:true,
      historicPublicByUnproven:true,noProductionDBWritesOrReads:true,
      noBackfillModelServingSchedulerOr2027Scope:true,
      keepIssue864Open:true},
  };
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(payload,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({issue:864,targets:28,realSenators:14,
    sourcePdfsFetched:fetched.size,verifiedFirstPageIdentities:result.authenticatedReportReferences,
    uniquePdfBinaries:result.independentlyUniqueOriginalPdfBinaries,
    unexpectedDuplicates:result.unexpectedOriginalBinaryDuplicates,
    held:result.identityOrSourceHolds,all28Authenticated:result.all28OriginalsIndependentlyAuthenticated,
    output:out,productionChanges:false},null,2));
  if(!result.all28OriginalsIndependentlyAuthenticated||fetched.size!==28
    ||viewerProofs.filter(p=>p.exactOriginalRefCount===2).length!==14)
    process.exitCode=1;
}
main().catch(e=>{console.error(sourceError(e));process.exitCode=1;});
