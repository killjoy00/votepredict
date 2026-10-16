/**
 * Read-only #864 original-state-source provenance. Exactly two Minnesota
 * Department of Revenue dated mandated reports; no CFB version/transaction
 * downloads or uploads, no production/database/model/scheduler operations.
 * Only source SHA256/bytes and committee identity outcomes reach artifacts.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {
 select22AuthenticSenatorRegistrationTargets,
} from '../evidence/cfb-2023-24-official-committee-status-proof.js';
import {
 inspectOriginalRevenuePcrReport,ORIGINAL_REVENUE_PCR_ANNUAL_SOURCES,
 type OriginalPcrPeriod,
} from '../evidence/cfb-2023-24-original-revenue-pcr-proof.js';

const LEDGER='docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv';
const UA='VotePredict/2.0 original Minnesota government public finance source research';
async function getOriginalGovernmentPDF(year:OriginalPcrPeriod){
 const url=ORIGINAL_REVENUE_PCR_ANNUAL_SOURCES[year].url;
 if(!/^https:\/\/www\.lrl\.mn\.gov\/docs\/20\d{2}\/mandated\/\d+\.pdf$/.test(url))
  throw Error('Source URL must be an explicitly permitted original Minnesota government document');
 const res=await fetch(url,{
  headers:{accept:'application/pdf','user-agent':UA},
  signal:AbortSignal.timeout(65_000),redirect:'follow',
 });
 if(!res.ok)throw Error('Minnesota government original source HTTP '+res.status);
 const final=new URL(res.url);
 if(final.protocol!=='https:'||!['www.lrl.mn.gov','lrl.mn.gov'].includes(final.hostname))
  throw Error('Minnesota original source unexpectedly redirected outside state archive');
 const data=new Uint8Array(await res.arrayBuffer());
 if(data.byteLength<30_000||data.byteLength>10_000_000
   ||new TextDecoder().decode(data.subarray(0,5))!=='%PDF-')
  throw Error('State report missing an authentic bounded original PDF body');
 return{
   data,sourceURL:url,finalOriginalURL:res.url,
   originalPDFBytes:data.byteLength,
   originalPDFSHA256:createHash('sha256').update(data).digest('hex'),
   retrievedAtUTC:new Date().toISOString(),
 };
}
async function inspectReport(year:OriginalPcrPeriod,senators:ReturnType<typeof select22AuthenticSenatorRegistrationTargets>){
 const original=await getOriginalGovernmentPDF(year);
 const pinned=ORIGINAL_REVENUE_PCR_ANNUAL_SOURCES[year];
 if(original.originalPDFSHA256!==pinned.originalPdfSha256
   ||original.originalPDFBytes!==pinned.originalPdfBytes)
  throw Error('Original full Minnesota Revenue PDF body no longer matches independently authenticated source SHA256/bytes');
 const {PDFParse}=await import('pdf-parse');
 const {CanvasFactory}=await import('pdf-parse/worker');
 const parser=new PDFParse({data:original.data,CanvasFactory});
 let extracted='';
 try{extracted=(await parser.getText()).text??'';}
 finally{await parser.destroy();}
 if(extracted.length<5000)throw Error('Original Department of Revenue PDF text unextractable');
 const audit=inspectOriginalRevenuePcrReport({
  extractedOriginalPDFText:extracted,
  refundYear:year,senators,
 });
 // The bounded source must genuinely contain many of the previously confirmed
 // Senate committees. Unknowns/identity holds stay explicit; no inference.
 if(audit.independentRetrospectivePcrIdentities<14)
  throw Error('Original Minnesota Revenue report did not authenticate an adequate Senate subset');
 return{
  reportedRefundYear:year,
  documentedReportDate:ORIGINAL_REVENUE_PCR_ANNUAL_SOURCES[year].reportDate,
  original:{
   sourceURL:original.sourceURL,
   finalGovernmentURL:original.finalOriginalURL,
   sha256:original.originalPDFSHA256,
   bytes:original.originalPDFBytes,
   retrievedAtUTC:original.retrievedAtUTC,
  },
  independentlyAuthenticatedOfficialReport:true,
  namedSenatorCommitteeRegistrations:audit.independentRetrospectivePcrIdentities,
  heldNameOrDuplicateRows:audit.unresolvedPcrNameHolds,
  notObservedInThisRetrospectiveReport:audit.notObservedInRetrospectiveReport,
  onlyMetadataStored:true,
  senatorRows:audit.rows,
 };
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output')throw Error('Usage: --output artifacts/<name>.json');
 const path=resolve(args[1]!);
 if(!path.startsWith(resolve('artifacts')+sep)||!path.endsWith('.json'))
  throw Error('Output must be a fresh metadata JSON in artifacts/');
 const original71=readFileSync(LEDGER,'utf8');
 const senators=select22AuthenticSenatorRegistrationTargets(original71);
 const reports=[];
 for(const year of [2023,2024] as const)reports.push(await inspectReport(year,senators));
 const output={
  schema:'original-state-revenue-PCR-2023-24-dated-senate-committee-identities-v1',
  issue:864,
  originalSenatorReference:{path:LEDGER,exactYearEndVersionRefs:71,persons:22},
  originalAnnualReports:reports,
  scopeLimits:{
   retrospectiveRefundListNotIndividualCFBRegistrationRecord:true,
   subsidyBeginDateNotCommitteeRegistrationDate:true,
   absenceNotProofUnregisteredOrNoYearendObligation:true,
   blankTermDateNotProofCommitteeNeverTerminated:true,
   noSpecific2023Or2024RegistrationStatusEstablished:true,
   original2023Or2024LegallyOwedYearEndReports:null,
   individualAdministrativeOrVoluntaryTerminationDate:null,
   newlyIndependentlyProvenExactHistoricalCFBReportPublicBy:0,
   existing71VersionEvidenceUnmodified:true,
  },
  safeguards:{
   originalPDFBytesNotPersisted:true,
   donorNamesRefundAmountsOrTransactionRowsNotPersisted:true,
   rawPDFExtractedTextNotPersisted:true,
   noProductionDBOrMLServingModelForecastSchedulerOr2027Changes:true,
   issue864RemainsOpen:true,
  },
 };
 mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path,JSON.stringify(output,null,2)+'\n',{flag:'wx'});
 const log=reports.map(r=>({
   period:r.reportedRefundYear,
   originalURL:r.original.sourceURL,sha256:r.original.sha256,
   bytes:r.original.bytes,
   reportDate:r.documentedReportDate,
   matched:r.namedSenatorCommitteeRegistrations,
   holds:r.heldNameOrDuplicateRows,
   unobserved:r.notObservedInThisRetrospectiveReport,
   matchedReg:r.senatorRows.filter(s=>s.proof==='independent_named_PCR_register_row').map(s=>s.registrationNumber),
   holdsReg:r.senatorRows.filter(s=>s.proof.startsWith('HOLD_')).map(s=>s.registrationNumber),
   notObservedReg:r.senatorRows.filter(s=>s.proof==='not_observed_in_this_retrospective_PCR_list').map(s=>s.registrationNumber),
 }));
 console.log('ORIGINAL_REVENUE_PCR_22_SENATORS_PROOF='+JSON.stringify(log));
 console.log('Source-authenticated official metadata-only output: '+path);
}
main().catch(e=>{
 console.error('Original government source authentication FAILED: '+
   (e instanceof Error?e.message:String(e)));
 process.exitCode=1;
});