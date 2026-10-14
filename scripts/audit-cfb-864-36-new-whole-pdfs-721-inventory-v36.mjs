/**
 * #864 strict about truthful fields, not about throwing out scanned PDFs.
 * Independently replay 36 original CFB indexed version refs to full government
 * source PDF byte/hash metadata. No PDF text parsing, no donors, no guessed
 * financial numbers, no as-of eligibility or production DB changes.
 */
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{audit721OfficialCFBSenateReports}from'./audit-cfb-864-721-official-senate-filing-refs-v33.mjs';
export const SCHEMA='cfb-864-721-indexed-version-480-downloaded-476-distinct-original-PDF-sources-v36';
const DIR='docs/evaluation/source-proof/';
const FILE={
 prior:DIR+'cfb-2021-25-95-senators-721-indexed-original-and-amended-reports-v33.psv',
 source:DIR+'cfb-2022-24-36-serving-priority-original-PDF-binaries-v36.psv',
 checkpoint:DIR+'cfb-2022-24-36-source-original-PDF-byte-SHA-checkpoint-v36.json',
 all:DIR+'cfb-2021-25-95-senators-721-indexed-480-PDF-bodies-v36.psv',
 oldJson:'data/cfb-senate-official-filings-2021-25-v33.json',
 json:'data/cfb-senate-official-filings-2021-25-v36.json'
};
const PIN={
 source:'eba517be95031060913005ff47efd6becf63095a',
 checkpoint:'34c75df54f386b1d00538627863f1c6a37621db7',
 all:'21aa2af62a724e0e652de3b6408388ee6172d235',
 json:'9cb18fabe335c903c707ee948e8a9923a3975f04'
};
const SHA=/^[a-f0-9]{64}$/;
const git=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
function psv(k,n,w){
 const raw=readFileSync(FILE[k],'utf8');
 if(!raw.endsWith('\n')||raw.includes('\r')||(PIN[k]&&git(raw)!==PIN[k]))
  throw Error('Government original source metadata bytes changed: '+k);
 const rows=raw.trimEnd().split('\n').map(x=>x.split('|'));
 if(rows.length!==n||rows.some(x=>x.length!==w||x.some(y=>y==='')))
  throw Error('Original indexed report proof/number of records changed: '+k);
 return{raw,rows};
}
export function audit36NewOriginalCfbPdfBinaries(){
 const old=audit721OfficialCFBSenateReports();
 if(old.officialIndexedReportVersions!==721||old.distinctDownloadedCompletePDFBytesSHA256!==440
    ||old.sourceIndexOnlyPdfNotFetchedYet!==276)
  throw Error('Previous 721-version original government index proof changed');
 const before=psv('prior',721,19),sources=psv('source',36,16),after=psv('all',721,19);
 const cpRaw=readFileSync(FILE.checkpoint,'utf8');
 if(git(cpRaw)!==PIN.checkpoint)throw Error('Source-only original PDF SHA official run checkpoint altered');
 const cp=JSON.parse(cpRaw);
 if(cp.schema!=='cfb-864-36-source-original-government-PDF-body-SHA-2022-to-24-v36'
  ||cp.sourceGovReadOnlyRunId!==38644113636||cp.sourceGovReadOnlyJobId!==116126626082
  ||cp.all36OfficialPDFsSucceeded!==true||cp.completeOriginalPublicPDFsReclaimed!==36
  ||cp.originalSourcePeriodSelection.original2022PreElection!==24
  ||cp.originalSourcePeriodSelection.original2023To24YearEnd!==12
  ||cp.totalDownloadedIndexedReportVersionsAfterAddition!==480
  ||cp.uniqueWholePDFSourceShaBodiesAfterAddition!==476
  ||cp.rawPdfBodiesNotExported!==true||cp.dateOf2026SourceDownloadNotEarlierPublicBy!==true
  ||cp.statutoryOwedOriginalFilingDenominator!==null)
  throw Error('2026 official original government PDF download/replay scope unverifiable');
 const olderById=new Map(before.rows.map(x=>[x[0],x]));
 const oldPdfHash=new Set(before.rows.map(x=>x[10]).filter(x=>x!=='-'));
 const extras=new Map(),newPdfHashes=new Set();
 for(const v of sources.rows){
  const[id,name,year,reg,period,viewer,wholePdfSha,bytes,url,method,when,status,run,job,publishedAt,financialTotals]=v;
  const src=olderById.get(id);
  if(!src||extras.has(id)||src[1]!==name||src[2]!==year||src[3]!==reg||src[4]!==period
    ||src[5]!=='0'||src[6]!=='original'||src[7]!=='official_indexed_pdf_not_yet_retrieved'
    ||src[10]!=='-'||src[11]!=='-'||src[12]!==viewer||src[9]!==url
    ||!SHA.test(viewer)||!SHA.test(wholePdfSha)||oldPdfHash.has(wholePdfSha)||newPdfHashes.has(wholePdfSha)
    ||!Number.isSafeInteger(Number(bytes))||Number(bytes)<300
    ||!['2022','2023','2024'].includes(year)||method!=='GET'
    ||!when.startsWith('2026-10-14T')||status!=='whole_official_pdf_binary_2026_retrieved_unparsed'
    ||run!=='38644113636'||job!=='116126626082'||publishedAt!=='-'||financialTotals!=='-')
   throw Error('Original 2022/23/24 government report URL/PDF body/size/hash/identity missing '+id);
  if((year==='2022'&&!['C','E'].includes(period))||(year!=='2022'&&period!=='YE'))
   throw Error('Wrong ordinary pre-election/annual PDF type');
  newPdfHashes.add(wholePdfSha);extras.set(id,v);
 }
 if(extras.size!==36||newPdfHashes.size!==36)throw Error('Do not drop official original PDFs');
 const rebuilt=before.rows.map(x=>{
  const v=extras.get(x[0]);if(!v)return[...x];
  const y=[...x];y[7]='official_pdf_downloaded_unparsed';
  y[10]=v[6];y[11]=v[7];y[16]='pdf_magic_and_full_sha_verified_text_not_checked';y[17]=FILE.source;
  return y;
 });
 if(rebuilt.map(x=>x.join('|')).join('\n')+'\n'!==after.raw
  ||after.rows.filter(x=>x[7]==='official_pdf_downloaded_unparsed').length!==36)
  throw Error('721 official source references and exact 36 pdf upgrade not bytewise reproducible');
 const oldJson=JSON.parse(readFileSync(FILE.oldJson,'utf8'));
 const jsonRaw=readFileSync(FILE.json,'utf8');
 if(git(jsonRaw)!==PIN.json)throw Error('Member profile source JSON original Git bytes drift');
 const json=JSON.parse(jsonRaw);
 if(oldJson.senators.length!==95||json.senators.length!==95)throw Error('Historical member roster shrank');
 const byReg=new Map();
 for(const row of rebuilt){
  const list=byReg.get(row[3])??[];list.push(row);byReg.set(row[3],list);
 }
 const projected=oldJson.senators.map(p=>{
  const rows=byReg.get(p.registrationNumber)||[];
  const f=rows.map(x=>({id:x[0],year:Number(x[2]),kind:x[6],amendment:Number(x[5]),status:x[7],url:x[9]}));
  return{...p,observedVersions:rows.length,
   originalVersions:rows.filter(x=>x[6]==='original').length,
   amendedVersions:rows.filter(x=>x[6]==='amended').length,
   downloadedVersions:rows.filter(x=>x[10]!=='-').length,
   filings:f};
 });
 if(JSON.stringify(projected)!==JSON.stringify(json.senators))
  throw Error('Original 95 serving senators profile data changed apart from newly acquired 36 PDFs');
 const pdfHashes=new Set(after.rows.map(x=>x[10]).filter(x=>x!=='-'));
 const s=json.sourceVerifiedCounts;
 if(json.schemaVersion!=='cfb-senate-practical-721-indexed-480-downloaded-476-whole-gov-PDFs-v36'
  ||s.total!==721||s.original!==440||s.amended!==281
  ||s.versionsWithDownloadedPDF!==480||s.distinctDownloadedPDFBodies!==476
  ||s.viewerOnlyNotYetDownloaded!==240||s.newWholePdfBinarySources!==36
  ||s.unparsedDownloadedSourcePDFBodies!==36||pdfHashes.size!==476
  ||after.rows.filter(x=>x[10]!=='-').length!==480
  ||json.senators.reduce((n,x)=>n+x.observedVersions,0)!==721)
  throw Error('Inaccurate whole PDF source records counted or old ones erased');
 return{schema:SCHEMA,officialIndexed2021to25Versions:721,
  actualServingSenatorsWithIndexedRecords:95,
  previouslySourceIndexedPDFRecs:445,extraSourceIndexRefs:276,
  previouslyDownloadedVersionRefs:444,addedOriginalWholePDFs:36,
  totalDownloadedSourcePDFVersionRefs:480,uniqueWholeOfficialPDFBodies:476,
  furtherIndexedPDFsToDownload:240,
  earlierScannedOrUnreadablePDFsRetained:14,originalPDFDateAnomaliesRetained:1,
  priorPdfFetchFailuresRetained:1,aliasReportViewerVersionsRetained:4,
  actualOriginalGovernment2026PdfHashesOnlyNoContentRowProof:true,
  historicalExactPdfVersionPublicByNotProven:true,
  legallyRequiredReportsUnknown:true,
  noProductionDBOrAsOfFinancialForecastModelChanges:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Source auditor takes no production database/source overrides');
 console.log('CFB_864_721_480_COMPLETE_GOV_PDF_BODIES_V36 '+JSON.stringify(audit36NewOriginalCfbPdfBinaries()));
}
