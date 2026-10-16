/**
 * One-shot PR-only source acquisition for the two LRL-verified 2025 Senate
 * special-election members' ALREADY authenticated special-cycle final PDFs.
 * Outputs only official URL, byte SHA, dates and tightly WHITELISTED marker
 * vocabulary (never report text/PDF/donor data). No scheduled or DB changes.
 *
 * node --import tsx scripts/acquire-cfb-2025-served-termination-markers.ts
 *   --output artifacts/cfb-2025-served-original-termination-markers.json
 */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {
  parseOfficialMnSenateServiceDirectory,OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
  OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,
} from '../../src/evidence/senate-official-ever-served-directory.js';
import {
  cfbSenateDistrictPageUrl,parseCfbSenateDistrictCandidatePage,
} from '../../src/evidence/cfb-senate-district-registration-inventory.js';
import {
  selectServed2025SpecialFinalTargets,
} from '../evidence/cfb-2025-served-special-final-pdf-proof.js';
import {
  CFB_TWO_SERVED_SPECIAL_TERMINATION_PROBE_SCHEMA,
  probeServedSenatorSpecialFinalTerminationMarkers,
} from '../evidence/cfb-2025-served-special-final-termination-markers.js';
import {
  fetchCfbCandidateHistoricalReportReferenceSnapshot,
} from '../../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText}
  from '../../src/evidence/cfb-current-report-acquisition.js';
const LEDGER='docs/evaluation/source-proof/cfb-2025-dated-senate-85-reference-versions.psv';
const OLDSOURCE='docs/evaluation/source-proof/cfb-2025-served-senators-2-special-cycle-final-original-source-checkpoint.json';
function safeError(error:unknown):string{
  return (error instanceof Error?error.message:'unknown_source_failure')
    .replace(/https?:\/\/\S+/g,'[official original source]').slice(0,200);
}
async function officialSource(url:string,host:string){
  // Official sites can transiently fail TLS/DNS; retry only bounded
  // READS. Every accepted response still must pass exact origin/path/hash
  // and no last-failure response may enter the proof ledger.
  let response:Response|null=null;
  for(let attempt=0;attempt<3;attempt++){
    try{
      response=await fetch(url,{headers:{
        'user-agent':'VotePredict/2.0-original-2025-served-senator-termination-marker-audit',
        accept:'text/html',
      },signal:AbortSignal.timeout(45000),redirect:'follow'});
      break;
    }catch{
      if(attempt===2)throw Error('Original official source network fetch failed: '+host+new URL(url).pathname);
      await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
    }
  }
  if(!response)throw Error('Original official source did not return a response: '+host);
  const requested=new URL(url),actual=new URL(response.url);
  if(!response.ok||actual.protocol!=='https:'||actual.hostname!==host
    ||actual.pathname!==requested.pathname||actual.search!==requested.search)
    throw Error('Unexpected original official service/district source response');
  const n=Number(response.headers.get('content-length'));
  if(n>5000000)throw Error('Official source exceeds bounded metadata acquisition');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.byteLength<500||bytes.byteLength>5000000)
    throw Error('Unexpected official original source byte size');
  return {url,bytes,sha256:createHash('sha256').update(bytes).digest('hex'),
    observedAt:new Date().toISOString(),text:Buffer.from(bytes).toString('utf8')};
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!args[1])
    throw Error('Use --output artifacts/<one-shot-metadata>.json');
  const output=resolve(args[1]);
  if(!output.startsWith(resolve('artifacts')+sep)||!output.endsWith('.json'))
    throw Error('One-shot metadata must stay in artifacts directory');
  const prior=JSON.parse(readFileSync(OLDSOURCE,'utf8'));
  if(prior.schemaVersion!=='cfb-2025-ever-served-senators-2-special-final-original-pdf-source-checkpoint-v1'
    ||prior.sourceOriginalReports.length!==2||prior.sourceSummary.exactOriginalReportPdfBinaryAndFirstPageVerified!==2
    ||prior.sourceSummary.historicalPublicByVerified!==0)
    throw Error('Missing original externally independently authenticated 2025 source proof');
  const directory=await officialSource(OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,'www.lrl.mn.gov');
  const swearing=await officialSource(OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,'www.lrl.mn.gov');
  const official=parseOfficialMnSenateServiceDirectory(
    directory.bytes,directory.observedAt,swearing.bytes,swearing.observedAt);
  const rosters=await Promise.all(([29,47] as const).map(async district=>{
    const url=cfbSenateDistrictPageUrl(district,2026);
    const original=await officialSource(url,'register.cfb.mn.gov');
    return parseCfbSenateDistrictCandidatePage({
      district,segmentEndYear:2026,sourceUrl:url,fetchedAt:original.observedAt,
      htmlSha256:original.sha256,html:original.text,responseBytes:original.bytes.length,
    });
  }));
  const targets=selectServed2025SpecialFinalTargets(
    official,rosters,readFileSync(LEDGER,'utf8'));
  if(targets.length!==2)throw Error('Only two actually served Senate members may be acquired');

  const cases=[];let failures=0;
  for(const target of targets){
    const previously=prior.sourceOriginalReports.find((x:{
      registrationNumber:string;
    })=>x.registrationNumber===target.registrationNumber);
    if(!previously||previously.originalViewerApiSha256!==target.viewerSha256
      ||previously.reportId!==target.reportId)
      throw Error('Previous original PDF case not pinned to this genuine Senator');
    try{
      const viewer=await fetchCfbCandidateHistoricalReportReferenceSnapshot(
        target.registrationNumber,2026);
      if(viewer.responseSha256!==target.viewerSha256)
        throw Error('Previously pinned CFB original viewer response bytes drifted');
      const originals=viewer.references.filter(r=>
        r.registrationNumber===target.registrationNumber&&r.year==='25'
        &&r.type==='pcc'&&r.period==='YE'&&r.se==='1'&&r.amendment===0);
      if(originals.length!==1)throw Error('Original special cycle-final CFB viewer key missing');
      const acquired=await fetchCfbReportViewerText(originals[0]!,{
        method:'POST',referer:viewer.sourceUrl,searchType:'Candidate',
      });
      const evidence=probeServedSenatorSpecialFinalTerminationMarkers(target,{
        sourceUrl:acquired.sourceUrl,sha256:acquired.contentSha256,
        bytes:acquired.bytes,fetchedAt:acquired.fetchedAt,text:acquired.text,
      });
      if(evidence.originalPdfSha256!==previously.originalPdfBinarySha256)
        throw Error('Original previously source-authenticated special-final PDF changed');
      cases.push({...evidence,
        originalCandidateViewerApiObservedAt:viewer.fetchedAt,
        originalCandidateViewerApiUnchanged:true,
        previouslyVerifiedPdfSourceRun:prior.provenance.sourceRun,
      });
    }catch(e){
      failures++;
      cases.push({
        reportId:target.reportId,actualSenator:target.officialName,
        registrationNumber:target.registrationNumber,district:target.district,
        markerInspectionProven:false,originalTerminationCheckboxSelectionIndependentlyProven:null,
        originalBoardTerminationNoticeIndependentlyProven:null,
        legallyOwedYearEndReport:null,historicalPublicByOn:null,
        sourceError:safeError(e),
      });
    }
  }
  const body={
    schemaVersion:CFB_TWO_SERVED_SPECIAL_TERMINATION_PROBE_SCHEMA,
    acquiredAt:new Date().toISOString(),
    originalOfficialSenateMembership:{
      directoryUrl:directory.url,originalDirectorySha256:directory.sha256,
      directoryObservedAt:directory.observedAt,
      originalSwearingUrl:swearing.url,originalSwearingSha256:swearing.sha256,
      originalSwearingObservedAt:swearing.observedAt,
      genuinelyVerifiedSenators:2,
    },
    sourcePriorAuthenticatedFinalsCheckpoint:OLDSOURCE,
    sourceOriginal2025ViewerReferenceLedger:LEDGER,
    onlyServedSenatorsVerified:true,
    reports:cases,
    summary:{
      sourceTargetOriginalReports:2,
      originalPdfByteShaAndFirstPageReverified:cases.length-failures,
      originalPdfSourceAcquisitionFailures:failures,
      legalTerminationCheckboxSelectionsIndependentlyVerified:0,
      legalYearEndObligationsEstablished:null,
      historicallyPublicByIndependentlyProven:0,
      originalBoardTerminationNoticesIndependentlyAuthenticated:0,
      statewideSenateFilerYearCount:null,
      statewideLegallyOwedReportCount:null,
    },
    safeguards:{
      neverExposesOriginalPdfOrRawText:true,
      keywordVocabularyOnlyNoFinancialTransactionsOrDonors:true,
      noNonSenatorsIncluded:true,doNotTreatWordTerminationAsCheckedBox:true,
      noHistoricalForecastAdmission:true,
      noProductionDatabaseWritesReads:true,noRetrainingOrServingChanges:true,
      noSchedulerOr2027Actions:true,issue864Open:true,
    },
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(body,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({
    originalSourceRunSucceeded:failures===0,
    reverifiedOriginalPdfBinaryHashCount:cases.length-failures,
    verifiedRealSenators:2,
    observedOnlyCurrentRunOn:new Date().toISOString().slice(0,10),
    lexicalDiagnostics:cases.map(x=>({
      reportId:x.reportId,sourceError:'sourceError' in x?x.sourceError:null,
      terminationWordCount:'totalTerminationWordOccurrences' in x
        ?x.totalTerminationWordOccurrences:null,
      keywordSchematic:'terminationWordDiagnostics' in x
        ?x.terminationWordDiagnostics:[],
      firstPageTerminationLabel:'bareTerminationReportLabelPresentInFirst6500Characters' in x
        ?x.bareTerminationReportLabelPresentInFirst6500Characters:null,
      exactTextReportType:'explicitlyTextLabeledTerminationTypeInFirst6500Characters' in x
        ?x.explicitlyTextLabeledTerminationTypeInFirst6500Characters:null,
      independentTerminationBoxProved:null,
    })),
    legalOwedCount:null,
    originalPdfBodiesStored:false,output,
  },null,2));
  if(failures)process.exitCode=1;
}
main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
