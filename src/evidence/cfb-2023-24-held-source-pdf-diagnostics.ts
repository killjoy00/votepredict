/**
 * #864 finance-only forensic source diagnostics. Never equate a CFB viewer
 * PDF with a year-end finance original or amendment if the printed registration
 * / office / coverage and Board receipt conflict with source report identity.
 * Separate official GET and official POST responses, store bounded flags only.
 */
import {createHash} from 'node:crypto';
import {cfbReportViewerUrl} from './cfb-current-report-acquisition.js';
import type {CfbReportViewerReference} from './cfb-report-pdf-proof.js';

export const CFB_TWO_HELD_SOURCE_DIAGNOSTICS_SCHEMA=
  'cfb-2023-24-held-two-original-pdf-binary-identity-diagnostic-v1' as const;
export interface HeldCfbTarget{
 id:string;parentOriginalId:string;actual2022ServingSenator:string;
 district2022:number;reg:string;viewerSha256:string;year:2023;amendmentIndex:0|1;
 expectedPdfSha256:string;expectedPdfBytes:number;
 expectedCoverageStart:'2023-01-01';expectedCoverageEnd:'2023-12-31';
 knownBoardReceipt:string;knownParentSha256:string|null;
 currentSourceStatus:string;
}
const SHA=/^[a-f0-9]{64}$/;
function gitBlobSha(s:string){return createHash('sha1').update(
  'blob '+Buffer.byteLength(s,'utf8')+'\0').update(s,'utf8').digest('hex');}
function rows(s:string){return s.trimEnd().split('\n').filter(Boolean).map(x=>x.split('|'));}
export function selectTwoHeldOfficialCfbSourceDocuments(input:{
  lang16Psv:string;putnam16Psv:string;langCheckpointJson:string;
  putnamCheckpointJson:string;
}):HeldCfbTarget[]{
  const lc=JSON.parse(input.langCheckpointJson),pc=JSON.parse(input.putnamCheckpointJson);
  if(lc.schemaVersion!=='cfb-2023-24-eight-verified-2022-senators-16-ye-source-15-auth-one-hold-v1'
    ||pc.schemaVersion!=='cfb-2023-24-sixteen-amendment-14-distinct-1-alias-1-held-v1'
    ||gitBlobSha(input.lang16Psv)!=='25dd711af3e8fcc5647a5f28473c3b0804cc58a7'
    ||gitBlobSha(input.putnam16Psv)!=='249e105cdb9bb5dafaaae9acc17a73cdb8baecc3'
    ||lc.sourceHold.versionId!=='17994:23:pcc:YE:0:0'
    ||pc.hold.id!=='18430:23:pcc:YE:0:1'
    ||lc.results.authenticDistinctOriginalPdfForms!==15
    ||pc.results.distinctAuthenticatedAmendedPdfBinaries!==14)
    throw Error('Independent original CFB source PDF identity hold proof changed');
  const l=rows(input.lang16Psv).filter(x=>x[0]==='17994:23:pcc:YE:0:0');
  const p=rows(input.putnam16Psv).filter(x=>x[0]==='18430:23:pcc:YE:0:1');
  if(l.length!==1||p.length!==1||l[0]!.length!==12||p[0]!.length!==15)
    throw Error('Exactly one real senator version reference for each identity hold required');
  const lang=l[0]!,putnam=p[0]!;
  if(lang[1]!=='Andrew R. Lang'||lang[2]!=='16'||lang[3]!=='17994'
    ||lang[4]!=='868366a0649900b205b1b4248bbfaeaae7b8aae8fb8db321d7de6c3854fe2073'
    ||lang[5]!==lc.sourceHold.originalPdfSourceSha256
    ||Number(lang[6])!==lc.sourceHold.pdfBytes
    ||lang[7]!=='2023-01-01'||lang[8]!=='2023-12-31'
    ||lang[9]!==lc.sourceHold.boardReceived
    ||lang[10]!=='HOLD_source_pdf_not_authenticated'
    ||lang[9]!== '2023-12-29')
    throw Error('Lang official CFB source identity hold metadata changed');
  if(putnam[1]!=='Aric Putnam'||putnam[2]!=='14'||putnam[3]!=='18430'
    ||putnam[4]!=='f54b43ea2febe9db1407b23d64336da36ddfea53dc9bc633e2f64858ce61a833'
    ||putnam[5]!=='18430:23:pcc:YE:0:0'
    ||putnam[6]!=='c6b67bb11a29e56c7ba3675d4769ade759718af535f6b880b43908a8c5875b8c'
    ||putnam[7]!==pc.hold.sha256
    ||Number(putnam[8])!==pc.hold.bytes
    ||putnam[9]!=='2023-01-01'||putnam[10]!=='2023-12-31'
    ||putnam[12]!==pc.hold.boardReceived
    ||putnam[13]!=='HOLD_first_page_registration_unverified')
    throw Error('Putnam official CFB source identity hold metadata changed');
  return [{
      id:lang[0]!,parentOriginalId:lang[0]!,
      actual2022ServingSenator:lang[1]!,district2022:16,reg:'17994',
      viewerSha256:lang[4]!,year:2023,amendmentIndex:0,
      expectedPdfSha256:lang[5]!,expectedPdfBytes:Number(lang[6]),
      expectedCoverageStart:'2023-01-01',expectedCoverageEnd:'2023-12-31',
      knownBoardReceipt:lang[9]!,knownParentSha256:null,
      currentSourceStatus:lang[10]!,
    },{
      id:putnam[0]!,parentOriginalId:putnam[5]!,
      actual2022ServingSenator:putnam[1]!,district2022:14,reg:'18430',
      viewerSha256:putnam[4]!,year:2023,amendmentIndex:1,
      expectedPdfSha256:putnam[7]!,expectedPdfBytes:Number(putnam[8]),
      expectedCoverageStart:'2023-01-01',expectedCoverageEnd:'2023-12-31',
      knownBoardReceipt:putnam[12]!,knownParentSha256:putnam[6]!,
      currentSourceStatus:putnam[13]!,
    }];
}
export function heldOfficialSourceRef(t:HeldCfbTarget):CfbReportViewerReference{
 return{year:'23',filingYear:2023,type:'pcc',period:'YE',se:'0',
  registrationNumber:t.reg,amendment:t.amendmentIndex,
  reportName:'Original CFB held YE source identity check only'};
}
export interface HeldSourceFetch{
 sourceUrl:string;sha256:string;bytes:number;observedAt:string;text:string;
}
function date(s:string):string|null{
 const m=/^(\d\d?)\/(\d\d?)\/(\d{4})$/.exec(s);
 if(!m)return null;
 const d=m[3]+'-'+m[1]!.padStart(2,'0')+'-'+m[2]!.padStart(2,'0');
 const dt=new Date(d+'T00:00:00Z');
 return Number.isFinite(dt.getTime())&&dt.toISOString().slice(0,10)===d?d:null;
}
function englishDate(s:string):string|null{
 const m=/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/.exec(s);
 if(!m)return null;
 const n=['january','february','march','april','may','june',
  'july','august','september','october','november','december']
  .indexOf(m[1]!.toLowerCase())+1;
 return n?date(n+'/'+m[2]+'/'+m[3]):null;
}
export function analyzeHeldCfbSourceBinary(t:HeldCfbTarget,pdf:HeldSourceFetch|null,
  method:'GET'|'POST',error:string|null=null){
 const provenance=!!pdf&&pdf.sourceUrl===cfbReportViewerUrl(heldOfficialSourceRef(t))
   &&SHA.test(pdf.sha256)&&Number.isInteger(pdf.bytes)&&pdf.bytes>=300
   &&Number.isFinite(Date.parse(pdf.observedAt));
 const text=provenance?pdf!.text.replace(/\u0000/g,'').replace(/\s+/g,' ').trim():'';
 const first=text.slice(0,6500);
 const regHeads=[...first.matchAll(/Registration\s+Number\s*:?\s*(\d{4,8})\b/gi)]
   .map(m=>m[1]);
 const districts=[...first.matchAll(/Senat(?:e|or)\s+District\s*:?\s*(\d{1,2})\b/gi)]
   .map(m=>Number(m[1]));
 const range=first.match(/Period\s+Covered\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
 const receipt=first.match(/Received\s+by\s+the\s+Board\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i);
 const start=date(range?.[1]??''),end=date(range?.[2]??''),
   received=englishDate(receipt?.[1]??'');
 const same=provenance&&pdf!.sha256===t.expectedPdfSha256
   &&pdf!.bytes===t.expectedPdfBytes;
 return{
   originalSourceId:t.id,originalSourceUrl:cfbReportViewerUrl(heldOfficialSourceRef(t)),
   retrievalMethod:method,
   actualSenatorProvenServed2022:t.actual2022ServingSenator,
   senateDistrict2022:t.district2022,committeeRegistration:t.reg,
   officialViewerSha256:t.viewerSha256,
   pdfSha256:provenance?pdf!.sha256:null,
   pdfBytes:provenance?pdf!.bytes:null,
   sourceFetchedAt:provenance?pdf!.observedAt:null,
   samePdfAsPreviouslyHeldOfficialSource:!!same,
   exactOfficialSourceVersionUrlVerified:provenance,
   originalSourceFirst6500CharactersOnly:{
     principalCommitteeReportTitle:/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(first),
     registrationNumberFieldsPresent:regHeads.length,
     expectedRegistrationFieldMatches:regHeads.length>0&&regHeads.every(x=>x===t.reg),
     expectedRegistrationAppearsElsewhereInFullExtractedText:
       text.includes(t.reg),
     senateDistrictFieldCount:districts.length,
     expectedSenateDistrictFieldMatches:districts.length>0&&districts.every(x=>x===t.district2022),
     coveredPeriodStartOn:start,
     coveredPeriodEndOn:end,
     originalPeriodMatches:start===t.expectedCoverageStart&&end===t.expectedCoverageEnd,
     boardReceivedOn:received,
     boardReceiptMatchesPriorSource:received===t.knownBoardReceipt,
     receivedBeforeCoverageEnd:!!received&&received<t.expectedCoverageEnd,
     fullNormalizedTextLength:text.length,
     hasMultipleReportTitles:
       [...text.matchAll(/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/gi)].length>1,
     occurrencesExpectedRegistrationExact:
       [...text.matchAll(new RegExp('(?:^|\\D)'+t.reg+'(?:\\D|$)','g'))].length,
   },
   independentOriginalPdfFirstPageCertified:false,
   previouslyHeldIdentityStillHeld:true,
   legalDueDateIndependentlyVerified:null,
   historicalActualPublicByProven:null,
   rawReportTextPersisted:false,
   rawPdfBytesPersisted:false,
   sourceError:error,
 };
}
export function compareHeldCfbGetPost(t:HeldCfbTarget,
  post:ReturnType<typeof analyzeHeldCfbSourceBinary>,
  get:ReturnType<typeof analyzeHeldCfbSourceBinary>){
 const sourceRechecked=post.retrievalMethod==='POST'
   &&post.samePdfAsPreviouslyHeldOfficialSource
   &&post.exactOfficialSourceVersionUrlVerified&&!post.sourceError;
 return {
  versionId:t.id,
  postRetrievalAgainMatchesPinnedHeldPdf:sourceRechecked,
  independentlyGetRetrieved:get.exactOfficialSourceVersionUrlVerified&&!get.sourceError,
  independentGetAndPostBinariesIdentical:sourceRechecked
    &&get.exactOfficialSourceVersionUrlVerified
    ?get.pdfSha256===post.pdfSha256&&get.pdfBytes===post.pdfBytes:null,
  getSourceError:get.sourceError,
  sourceIdentityStillUnproven:true,
  mustRemainHeld:true,
 };
}
