/**
 * #864 finance/public source-only: original 2024 Senate Secretary of Senate
 * seating chart, independently archived at Minnesota Legislative Reference
 * Library. Only hashes, URL, named 22 actual senators and yes/no identity
 * flags saved. No raw PDF, complete roster, staff, phone or seating maps.
 *
 * node --import tsx scripts/audit-cfb-2024-original-senate-seating-source.ts
 *   --output artifacts/cfb-2024-22-senator-seating-source-audit.json
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,sep} from 'node:path';
import {
 CFB_2024_ORIGINAL_SENATE_CHART_PROOF_VERSION,
 ORIGINAL_SENATE_2024_SEATING_PDF,
 ORIGINAL_LRL_93RD_SENATE_SEATING_ARCHIVE,
 inspect2024OriginalSenateSeatingPdf,
} from '../../src/evidence/cfb-2024-original-senate-seating-source.js';
const LEDGER='docs/evaluation/source-proof/cfb-2023-original-sos-22-real-senators-roster-independent-service-proof.psv';
type SourceDoc={
 url:string;sha256:string;bytes:number;retrievedAt:string;
 text:string;officialProvenance:true;
};
async function retrieve(url:string):Promise<SourceDoc>{
 const requested=new URL(url);
 if(requested.protocol!=='https:'
  ||!['www.senate.mn','www.leg.mn.gov'].includes(requested.hostname))
   throw Error('Only original Senate or official MN Legislative Archive permitted');
 const res=await fetch(url,{
   headers:{'user-agent':'Mozilla/5.0 VotePredict original MN Senate 2024 seating provenance',
     accept:'application/pdf'},redirect:'follow',signal:AbortSignal.timeout(60_000)});
 if(!res.ok)throw Error('Original Senate 2024 chart source HTTP '+res.status);
 const destination=new URL(res.url);
 if(destination.protocol!=='https:'||!['www.senate.mn','www.leg.mn.gov',
   'www.leg.state.mn.us'].includes(destination.hostname))
   throw Error('Original Senate seating PDF redirected outside official state hosts');
 const pdf=new Uint8Array(await res.arrayBuffer());
 const size=pdf.byteLength;
 if(size<10000||size>25_000_000
   ||new TextDecoder('ascii').decode(pdf.subarray(0,5))!=='%PDF-')
   throw Error('Original Senate chart did not return bounded PDF');
 const hash=createHash('sha256').update(pdf).digest('hex');
 const {CanvasFactory}=await import('pdf-parse/worker');
 const {PDFParse}=await import('pdf-parse');
 const parser=new PDFParse({data:pdf,CanvasFactory});
 let text:string;
 try{text=(await parser.getText()).text??'';}
 finally{await parser.destroy();}
 if(text.length<1000)throw Error('Original Senate chart no extractable text');
 return{url,sha256:hash,bytes:size,retrievedAt:new Date().toISOString(),
   text,officialProvenance:true};
}
function failure(err:unknown):string{
 const s=err instanceof Error?err.message:String(err);
 return /timeout|abort/i.test(s)?'official_2024_roster_source_timeout':
 /HTTP [45]\d\d/i.test(s)?'official_2024_roster_pdf_http_error':
 /text|PDF|extract|parse/i.test(s)?'official_2024_roster_pdf_text_unverified':
 'original_2024_senate_roster_identity_unverified';
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Only --output artifacts/<new>.json');
 const path=resolve(args[1]);
 if(!path.startsWith(resolve('artifacts')+sep)||!path.endsWith('.json'))
  throw Error('2024 roster source output must be new artifact JSON only');
 const initial=readFileSync(LEDGER,'utf8');
 const errors:Array<{url:string;kind:string}>=[];
 let doc:SourceDoc|null=null;
 for(const url of [ORIGINAL_SENATE_2024_SEATING_PDF,ORIGINAL_LRL_93RD_SENATE_SEATING_ARCHIVE]){
   try{doc=await retrieve(url);break;}catch(e){errors.push({url,kind:failure(e)});}
 }
 let status:ReturnType<typeof inspect2024OriginalSenateSeatingPdf>|null=null;
 if(doc){
   try{status=inspect2024OriginalSenateSeatingPdf({
     prior2023RosterPsv:initial,original2024PdfExtractedText:doc.text});
   }catch(e){errors.push({url:doc.url,kind:failure(e)});}
 }
 const summary={
  sourceRetrieved:!!doc,sourcePDFContentParsed:!!status,
  officialSourcePdfSHA256:doc?.sha256??null,originalPdfBytes:doc?.bytes??null,
  sourcePdfUrl:doc?.url??null,
  source2024TitleVerified:status?.counts.original2024SeatingArrangementTitleVerified??false,
  exactTable2024Members:status?.counts.exactSourceTableMatches??0,
  mapCaption2024Members:status?.counts.independentMapCaptionMatches??0,
  strictTwoComponentMemberIdentities:status?.counts.bothSourceSectionsMatched??0,
  exactSourceConflicts:status?.counts.sourceTableAndMapConflicts??[],
  sourceUnverified:status?.counts.unverified??[],
  prior2023Sos22RosterSourceCrosscheckCount:22,
  historicalExact2024VoteDayMembershipEstablished:0,
  committeeLegalFilingDutyKnown:null,
  actualOriginalCFBPublicByProven:0,
 };
 const artifact={
  schemaVersion:CFB_2024_ORIGINAL_SENATE_CHART_PROOF_VERSION,
  issueNumber:864,observedAt:new Date().toISOString(),
  actualOriginalSourcesTried:[ORIGINAL_SENATE_2024_SEATING_PDF,
    ORIGINAL_LRL_93RD_SENATE_SEATING_ARCHIVE],
  originalGovernmentSource:doc?{url:doc.url,pdfSha256:doc.sha256,bytes:doc.bytes,
    observedAt:doc.retrievedAt}:null,
  sourceFailedChecks:errors,
  sourcePanelFrom2023OriginalSecretaryOfState:{path:LEDGER,
    gitBlobSha:'d50a7049237a009820051cbb9a74ff185cc1115b',
    previouslyVerifiedActually2023SenateRosterMembers:22},
  report:status?{counts:status.counts,sourceRosterFlags:status.entries}:null,
  summary,
  limits:{twoSectionsInSameDocumentAreNotIndependentPublicDocuments:true,
    originalSeatingArrangementNotFullYearServiceProof:true,
    anySourceTableMapConflictKeptHeld:true,legalFilingDutiesNotInferred:true,
    originalReport2023Or2024PublicByNotInferred:true,
    historicalForecastEligible:false},
  safeguards:{noRawOriginalPDFOrFullExtractedTextStored:true,
   noStaffContactPhoneOrOfficerNamePersisted:true,
   noDonorTransactionsOrFinanceRows:true,
   noProductionDatabaseReadWrite:true,
   noTrainingModelForecastServingSchedulerOr2027Scope:true,
   keepIssue864Open:true},
 };
 mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path,JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({issue:864,...summary,output:path,sourceFailures:errors,
   productionWrites:0},null,2));
 if(!doc||!status||!status.counts.original2024SeatingArrangementTitleVerified
  ||!status.counts.originalTableSenateMembersSectionLocated
  ||status.counts.exactSourceTableMatches<17)
   process.exitCode=1;
}
main().catch(e=>{console.error(failure(e));process.exitCode=1;});
