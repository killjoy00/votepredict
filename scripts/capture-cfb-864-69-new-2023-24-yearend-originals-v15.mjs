/**
 * VotePredict #864 — bounded source-only original-PDF recovery.
 * For 35 separately identified Minnesota Senate-serving principals, recover
 * 69 exact original 2023/24 ordinary YE versions absent from authenticated V12.
 *
 * NEVER persist PDF bytes, extracted report body, contributor identities,
 * individual transaction rows, finance figures, or credentials.
 * Board receipt and legal release are NOT historical public-by dates.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot}
 from '../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText}
 from '../src/evidence/cfb-current-report-acquisition.js';
import {auditServed2023to24OriginalYearEnd}
 from '../src/evidence/cfb-2023-24-served-28-yearend-originals.js';
import {verifyPinnedServedExactLedger}
 from './audit-cfb-864-served-report-version-ledger-v12.mjs';

export const SCHEMA='cfb-864-35-served-senator-69-original-2023-24-annual-pdf-v15';
const D='docs/evaluation/source-proof/';
export const TARGET=D+'cfb-2023-24-35-senators-69-yearend-original-source-targets-v15.psv';
const VIEW=D+'cfb-2021-24-senate-396-original-viewer-source-observations.psv';
const CHECK=D+'cfb-2021-24-senate-396-source-viewer-count-checkpoint.json';
const V12=D+'cfb-2021-25-served-25-panel-229-exact-version-ledger.psv';
const HASH=/^[a-f0-9]{64}$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const onlyStatus=(value)=>['source_http_hold','source_timeout_hold',
 'official_api_sha_drift_hold','pdf_header_identity_hold',
 'source_identity_hold'].includes(value);
const sha=(s)=>createHash('sha256').update(s).digest('hex');

export function select69ServedOriginals({
 targetPsv,viewerPsv,viewerCheckpoint,v12Psv
}){
 const raw=Buffer.from(targetPsv,'utf8');
 const gitBlobSha=createHash('sha1').update('blob '+raw.byteLength+'\0').update(raw).digest('hex');
 if(gitBlobSha!=='779e581b74299533439939f6552672bb8b2f0c6d')
  throw Error('Original serving-senator source-target manifest git blob SHA mismatch');
 const checkpoint=JSON.parse(viewerCheckpoint);
 if(checkpoint.schemaVersion!=='cfb-2021to24-275-senate-registrations-396-official-viewer-source-count-checkpoint-v1'
  ||sha(viewerPsv.trimEnd())!==checkpoint.provenance.metadataOnly396SourceRowsCanonicalPsvSha256WithoutTrailingNewline)
  throw Error('Original 396 CFB viewer response metadata SHA mismatch');
 const viewer=new Map();
 const raw=viewerPsv.trimEnd().split('\n');
 if(raw.length!==396)throw Error('Official source 396-response completeness drift');
 for(const line of raw){
  const r=line.split('|');
  if(r.length!==4||!['2022','2024'].includes(r[0])||!HASH.test(r[2]))
   throw Error('Invalid original CFB report viewer source row');
  const key=r[0]+':'+r[1];
  if(viewer.has(key))throw Error('Duplicate official viewer');
  viewer.set(key,{sha:r[2],refs:new Set(r[3]?r[3].split(','):[])});
 }
 const existing=new Set(v12Psv.trimEnd().split('\n').map(line=>line.split('|')[0]));
 if(existing.size!==229)throw Error('Existing V12 original authentic source ledger not verified');
 const lines=targetPsv.trimEnd().split('\n');
 if(lines.length!==35)throw Error('Expected 35 selected committees');
 const unique=new Set(),targets=[],personNames=new Set();
 const variantIds=new Set(['16246','17924','18581','18778','18917']);
 for(const line of lines){
  const r=line.split('|');
  if(r.length!==6)throw Error('Malformed original senator target');
  const [reg,person,dist,originalSha,years,matchClass]=r;
  if(!/^\d{4,6}$/.test(reg)||!person||!Number.isInteger(+dist)
    ||Number(dist)<1||Number(dist)>67||!HASH.test(originalSha)
    ||!['2023,2024','2024'].includes(years)
    ||!['exact_first_last_same_office_district',
      'reviewed_name_variant_same_office_district'].includes(matchClass))
   throw Error('Invalid source-verified Senate candidate identity');
  if(variantIds.has(reg)!==(matchClass==='reviewed_name_variant_same_office_district'))
   throw Error('Known name variant must remain expressly qualified');
  if(unique.has(reg)||personNames.has(person))throw Error('Ambiguous original Senate person or committee');
  unique.add(reg);personNames.add(person);
  const observed=viewer.get('2024:'+reg);
  if(!observed||observed.sha!==originalSha)
   throw Error('Original CFB 2024 viewer full-body SHA mismatch for target');
  for(const y of years.split(',')){
   const id=reg+':'+y.slice(2)+':pcc:YE:0:0';
   if(!observed.refs.has(y.slice(2)+':pcc:YE:0:0')
     ||existing.has(id))throw Error('Selected version missing from official source or already authenticated');
   targets.push({id,reg,person,sourceDistrict:Number(dist),year:Number(y),
     sourceApiSha256:originalSha,matchingClass:matchClass});
  }
 }
 if(unique.size!==35||targets.length!==69
  ||targets.filter(x=>x.year===2023).length!==34
  ||targets.filter(x=>x.year===2024).length!==35
  ||new Set(targets.map(x=>x.id)).size!==69)
  throw Error('Exact original 2023/24 in-service proof selection changed');
 return targets.sort((a,b)=>a.reg.localeCompare(b.reg)||a.year-b.year);
}

function datePlusOne(date) {
 if(!DAY.test(date))throw Error('Bad date');
 const d=new Date(date+'T00:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)
  throw Error('Invalid date');
 d.setUTCDate(d.getUTCDate()+1);
 return d.toISOString().slice(0,10);
}
export function classifyPublicAvailability(year,received,headerValid){
 const due=year===2023?'2024-01-31':year===2024?'2025-01-31':null;
 if(!due)throw Error('Non-annual report date');
 if(!headerValid||!received)return{dueOn:due,notBeforeOn:null,publicByOn:null};
 const floor=datePlusOne(due);
 if(!DAY.test(received)||Number.isNaN(Date.parse(received+'T00:00:00Z')))
  throw Error('Untrusted Board receipt');
 // The date-only lower bound is NOT an exact time and NEVER a public-by.
 return{dueOn:due,notBeforeOn:received>floor?received:floor,publicByOn:null};
}
export function classifySourceFailure(e){
 const s=e instanceof Error?e.message:String(e);
 if(/timeout|abort/i.test(s))return'source_timeout_hold';
 if(/sha|drift|mismatch/i.test(s))return'official_api_sha_drift_hold';
 return'source_http_hold';
}

export function summarize69PdfProofs(rows){
 if(rows.length!==69||new Set(rows.map(r=>r.reportVersionId)).size!==69)
  throw Error('Expected 69 unique observed original report results');
 const auth=rows.filter(r=>r.status==='source_pdf_first_page_authenticated');
 const hold=rows.filter(r=>r.status!=='source_pdf_first_page_authenticated');
 const hashes=auth.map(r=>r.sourcePdfSha256);
 const dups=hashes.length-new Set(hashes).size;
 if(dups)throw Error('Two supposedly distinct originals have same PDF SHA');
 if(rows.some(r=>r.historicalPublicByOn!==null||r.legallyOwedReport===true
  ||r.pdfDataExported===true||r.sourcePdfBytes>30_000_000))
  throw Error('Historical cutoff/financial data or document size guard failed');
 return{
  expectedReferences:69,year2023Expected:34,year2024Expected:35,
  fetchedPdfBodies:rows.filter(r=>r.sourcePdfSha256!==null).length,
  strictFirstPageAuthenticated:auth.length,
  sourceIdentityOrTransportHolds:hold.length,
  authenticated2023:auth.filter(r=>r.reportYear===2023).length,
  authenticated2024:auth.filter(r=>r.reportYear===2024).length,
  matchedOriginalHashesDistinct:new Set(hashes).size,
  qualifiedCandidateNicknameRows:rows.filter(r=>r.candidateMatchClass==='reviewed_name_variant_same_office_district').length,
  exactHistoricalPublicByProven:0,
  officialLegallyOwedFilingDenominator:null,
  noFinancialRowsExported:true
 };
}
const errorCode=(e)=>{
 const code=classifySourceFailure(e);
 return onlyStatus(code)?code:'source_http_hold';
};

export async function capture69({targets,fetchSnapshot=fetchCfbCandidateHistoricalReportReferenceSnapshot,
 fetchPdf=fetchCfbReportViewerText}){
 const groups=new Map();
 for(const target of targets)groups.set(target.reg,[...(groups.get(target.reg)??[]),target]);
 const sourceChecks=[],results=[];
 const registrations=[...groups.keys()];
 let counter=0;
 async function worker(){
  while(counter<registrations.length){
   const reg=registrations[counter++];
   const items=groups.get(reg);
   const pinned=items[0].sourceApiSha256;
   let snap=null;
   try{
    snap=await fetchSnapshot(reg,2024);
    if(snap.responseSha256!==pinned||snap.sourceUrl!==
      'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+reg+'/2024/')
      throw Error('Original CFB viewer body sha/source URL changed');
    const refs=items.map(t=>{
     const found=snap.references.filter(r=>r.registrationNumber===t.reg
       &&r.year===String(t.year).slice(2)&&r.type==='pcc'
       &&r.period==='YE'&&r.se==='0'&&r.amendment===0);
     if(found.length!==1)throw Error('CFB exact original viewer key absent/ambiguous');
     return[t,found[0]];
    });
    sourceChecks.push({reg,originalApiSha256:pinned,
      refreshedApiSha256:snap.responseSha256,refCount:refs.length,
      status:'same_original_viewer_body_sha'});
    for(const [t,reference]of refs){
     let pdf=null,error=null;
     try{pdf=await fetchPdf(reference,
      {method:'POST',referer:snap.sourceUrl,searchType:'Candidate'});}
     catch(e){error=errorCode(e);}
     const audited=auditServed2023to24OriginalYearEnd({
      id:t.id,reg:t.reg,actualSenator:t.person,district2022:t.sourceDistrict,
      reportYear:t.year,originalViewerApiSha256:pinned,originalViewerSegment:2024,
      reportingPeriod:'YE',amendmentIndex:0,specialElectionFlag:'0'
     },pdf?{sourceUrl:pdf.sourceUrl,sha256:pdf.contentSha256,
      bytes:pdf.bytes,observedAt:pdf.fetchedAt,text:pdf.text}:null,error);
     const headerVerified=audited.status==='original_pdf_first_page_authenticated';
     const availability=classifyPublicAvailability(t.year,
       audited.header.boardReceivedOn,headerVerified);
     results.push({
      reportVersionId:t.id,committeeRegistration:reg,servingSenator:t.person,
      servicePanelDistrict:t.sourceDistrict,reportYear:t.year,
      candidateMatchClass:t.matchingClass,
      officialViewerApiSha256:pinned,
      status:headerVerified?'source_pdf_first_page_authenticated':
       pdf?'pdf_header_identity_hold':error??'source_identity_hold',
      sourcePdfSha256:audited.sourcePdfSha256,
      sourcePdfBytes:audited.sourcePdfByteCount,
      sourcePdfUrl:audited.sourcePdfUrl,
      pdfFetchedAt:audited.pdfFetchedAtUtc,
      headerPrincipalTitle:audited.header.principalReportTitle,
      headerCommitteeRegistrationMatches:audited.header.committeeRegistrationMatches,
      headerSenateDistrictMatches:audited.header.printedSenateDistrictMatches,
      reportingPeriodStartOn:audited.header.startOn,
      reportingPeriodEndOn:audited.header.endOn,
      boardReceivedOn:audited.header.boardReceivedOn,
      calendarDueOn:availability.dueOn,
      conservativeNotBeforeOn:availability.notBeforeOn,
      historicalPublicByOn:null,legallyOwedReport:null,
      pdfDataExported:false
     });
    }
   }catch(e){
    sourceChecks.push({reg,originalApiSha256:pinned,
      refreshedApiSha256:snap?.responseSha256??null,refCount:0,status:errorCode(e)});
    for(const t of items)results.push({
     reportVersionId:t.id,committeeRegistration:reg,servingSenator:t.person,
     servicePanelDistrict:t.sourceDistrict,reportYear:t.year,
     candidateMatchClass:t.matchingClass,officialViewerApiSha256:pinned,
     status:errorCode(e),sourcePdfSha256:null,sourcePdfBytes:null,
     sourcePdfUrl:null,pdfFetchedAt:null,headerPrincipalTitle:false,
     headerCommitteeRegistrationMatches:false,headerSenateDistrictMatches:false,
     reportingPeriodStartOn:null,reportingPeriodEndOn:null,boardReceivedOn:null,
     calendarDueOn:t.year===2023?'2024-01-31':'2025-01-31',
     conservativeNotBeforeOn:null,historicalPublicByOn:null,
     legallyOwedReport:null,pdfDataExported:false
    });
   }
   await new Promise(done=>setTimeout(done,125));
  }
 }
 await Promise.all([worker(),worker(),worker()]);
 results.sort((a,b)=>a.reportVersionId.localeCompare(b.reportVersionId));
 sourceChecks.sort((a,b)=>a.reg.localeCompare(b.reg));
 return{sourceChecks,results,receipt:summarize69PdfProofs(results)};
}

export function offlineTargets(){
 // Existing authenticated V12 PDF source identities must not be overwritten.
 verifyPinnedServedExactLedger();
 const original=select69ServedOriginals({
  targetPsv:readFileSync(TARGET,'utf8'),
  viewerPsv:readFileSync(VIEW,'utf8'),
  viewerCheckpoint:readFileSync(CHECK,'utf8'),
  v12Psv:readFileSync(V12,'utf8')
 });
 return original;
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'
   ||!/^[a-z0-9][a-z0-9_-]*\.json$/.test(args[1]))
  throw Error('Only --output <allowlisted-filename>.json accepted');
 const targets=offlineTargets();
 const source=await capture69({targets});
 const output=resolve('artifacts',args[1]);
 if(!output.startsWith(resolve('artifacts')+sep))
  throw Error('Only ephemeral artifacts/ path allowed');
 const artifact={
  schemaVersion:SCHEMA,runObservedAt:new Date().toISOString(),
  scope:{issue:864,sourceYear:[2023,2024],
   sourceVerifiedSenators:35,officialViewerSourceRows:35,
   expectedOriginalYearEndVersionReferences:69,
   liveHistoricalPublicBySourceProofs:0,legalObligationDenominator:null,
   reviewedCandidateIdentityClassMayBeQualified:true},
  immutableInputs:{sourceTargets:TARGET,pinnedViewer:VIEW,
   currentViewerBodyMustEqualPinned:true,v12OriginalPdfBaseline:V12,
   sourceOriginal95PeopleLRLArtifactId:11685387674,
   sourceOriginalCFBRegistrationArtifactId:11680891630,
   primary396SourceArchiveArtifactId:11683227803},
  sourceChecks:source.sourceChecks,sourcePdfResults:source.results,receipt:source.receipt,
  safeguards:{reportTextDonorRowsOrAmountsUploaded:false,
   historicalPublicByNeverDerivedFromBoardReceipt:true,
   specialReportsNotConflatedWithYearEnd:false,
   sourceObservation2026NotBackdated:true,
   noPrivateNeonOrProductionAccess:true,
   noForecastEligibilityRecalculation:true,noDeploymentScheduler2027OrOutreach:true}
 };
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
 console.log('CFB_864_69_NEW_YEAR_END_ORIGINALS '+JSON.stringify({
  ...source.receipt,sourceApiExactMatches:source.sourceChecks.filter(r=>
   r.status==='same_original_viewer_body_sha').length,
  officialViewerHoldCount:source.sourceChecks.filter(r=>
   r.status!=='same_original_viewer_body_sha').length,
  artifactPath:output,sourceOnlyNoFinancialRows:true
 }));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 main().catch(e=>{
  console.error('CFB_864_69_FATAL '+classifySourceFailure(e));
  process.exitCode=1;
 });
