/**
 * Read-only original June/July 2023 CFB Hoffman (#17319) signed official
 * principal campaign committee action. Store only bounded public metadata,
 * never the original full PDF, personal info or donor/contribution rows.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve,sep} from 'node:path';
import {HOFFMAN_2023_ORIGINAL_BOARD_AGREEMENT,
 inspectHoffman2023OriginalBoardAction} from
 '../src/evidence/cfb-2023-hoffman-original-board-committee-proof.js';
const FILE71='docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv';
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output')throw Error('Usage: --output artifacts/<source>.json');
 const path=resolve(args[1]!);
 if(!path.startsWith(resolve('artifacts')+sep)||!path.endsWith('.json'))
  throw Error('Original source metadata output must be new JSON in artifacts/');
 const url=HOFFMAN_2023_ORIGINAL_BOARD_AGREEMENT;
 const dest=new URL(url);
 if(dest.protocol!=='https:'||dest.hostname!=='cfb.mn.gov'
   ||dest.pathname!=='/pdf/bdactions/1641_Conciliation_Agreement.pdf')
  throw Error('Only preauthenticated CFB 2023 original Board document URL allowed');
 const res=await fetch(url,{
  redirect:'follow',headers:{accept:'application/pdf',
   'user-agent':'VotePredict/2.0 original Minnesota campaign finance public research'},
  signal:AbortSignal.timeout(60_000),
 });
 if(!res.ok)throw Error('Official CFB original 2023 agreement HTTP '+res.status);
 const final=new URL(res.url);
 if(final.protocol!=='https:'||!['cfb.mn.gov','www.cfb.mn.gov'].includes(final.hostname))
  throw Error('Official Board original redirected outside regulator domain');
 const bytes=new Uint8Array(await res.arrayBuffer());
 if(bytes.byteLength<10_000||bytes.byteLength>2_000_000
  ||new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')
  throw Error('Original signed CFB Hoffman 2023 document body not authenticated as a PDF');
 const originalByteCount=bytes.byteLength; // PDFParse may transfer and detach Uint8Array
 const originalSha=createHash('sha256').update(bytes).digest('hex');
 if(originalByteCount!==103913)throw Error('Original complete 2023 CFB Board PDF byte size drift');
 if(originalSha!=='14789ad9840503b963c6c1e9198fc6f05d5b096b9d7aea1487839847b71cbba9')
  throw Error('Original 2023 Board Hoffman PDF whole-body SHA256 drift from first authenticated source');
 const {PDFParse}=await import('pdf-parse');
 const {CanvasFactory}=await import('pdf-parse/worker');
 const pdf=new PDFParse({data:bytes,CanvasFactory});
 let fullText='';
 try{fullText=(await pdf.getText()).text??'';}finally{await pdf.destroy();}
 if(fullText.length<1300)throw Error('Original Board Hoffman signed action text unavailable');
 const psv=readFileSync(FILE71,'utf8');
 const proof=inspectHoffman2023OriginalBoardAction({
  original2023BoardPdfText:fullText,existingAuthenticated71VersionPSV:psv,
 });
 const result={
  schemaVersion:'cfb-signed-original-2023-hoffman-principal-committee-reg-17319-v1',
  issue:864,
  sourceOriginal:{url,originalPDFSha256:originalSha,
   originalPDFBytes:originalByteCount,
   fullOfficialPDFDownloadedAt:new Date().toISOString(),
   originalSourceHostVerified:true},
  independentOriginalBoardProof:proof,
  earlierOriginal71VersionsUnchanged:true,
  strictLimits:{
   officialActionNotRegistrationDateOrBoardTermination:true,
   noSpecific2023Or2024YearEndLegalFilingDutyProven:true,
   noSpecificReportAmendmentVersionHistoricallyPublicByProven:true,
   noRawPdfCommitteeContactsDonorsOrFinancialTransactionRowsStored:true,
   noProductionDataMLServingSchedulerOr2027Changes:true,
   issue864RemainsOpen:true},
 };
 mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log('ORIGINAL_2023_HOFFMAN_BOARD_ACTION_PROOF='+JSON.stringify({
  url,sha256:originalSha,bytes:originalByteCount,
  exactCommitteeReg:proof.principalCampaignCommitteeRegistration,
  originalDocumentSignedDateStrings:proof.originalSignatureDatesAsPrinted,
  verifiedOfficialBoardAction:proof.independentSourceNamedPrincipalCommitteeInSigned2023Action,
  originalPDFAndPersonalDataStored:false,
 }));
}
main().catch(e=>{
 console.error('Original 2023 signed government principal committee source not authenticated: '+
  (e instanceof Error?e.message:String(e)));
 process.exitCode=1;
});