/**
 * #864 V40 independent OFFLINE source-only replay.
 * Government viewer presence, complete current PDF bytes, and historical
 * vote-cutoff published-by are separate evidence dimensions. Do not delete
 * original records due to a scanned PDF, unchanged amendment or nickname.
 */
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{audit830SenateIndexedOfficialReports}from'./audit-cfb-864-830-official-indexed-senate-reports-v38.mjs';
export const SCHEMA='cfb-864-830-original-indexed-590-downloaded-579-distinct-PDF-sources-v40';
const DIR='docs/evaluation/source-proof/';
const FILE={
 old:DIR+'cfb-2021-25-95-senators-830-indexed-480-downloaded-v38.psv',
 source:DIR+'cfb-2021-25-110-new-government-PDF-source-retrieval-v40.psv',
 checkpoint:DIR+'cfb-2021-25-110-government-PDF-source-recovery-checkpoint-v40.json',
 all:DIR+'cfb-2021-25-95-senators-830-indexed-590-downloaded-v40.psv',
 oldJson:'data/cfb-senate-official-filings-2021-25-v38.json',
 newJson:'data/cfb-senate-official-filings-2021-25-v40.json'
};
const PIN={
 source:'a1f6d1fc232fd230f3d7f1ac1be554511d0d50db',
 checkpoint:'e125e8b9669355602a996d2fb4590035c08026ba',
 all:'b61eee63cfed2791706a0b01a436a67d1b997c39',
 newJson:'f0297e6ee607a18f3d07e42c8163ed8077d88609'
};
const SHA=/^[a-f0-9]{64}$/;
const blob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
function readSource(key,rows,columns){
 const raw=readFileSync(FILE[key],'utf8');
 if(!raw.endsWith('\n')||raw.includes('\r')||(PIN[key]&&blob(raw)!==PIN[key]))
  throw Error('Original CFB government source metadata immutable git blob changed: '+key);
 const recs=raw.trimEnd().split('\n').map(x=>x.split('|'));
 if(recs.length!==rows||recs.some(x=>x.length!==columns||x.some(v=>v==='')))
  throw Error('Original CFB government source count or column structure altered: '+key);
 return{raw,rows:recs};
}
function parseJson(key){
 const raw=readFileSync(FILE[key],'utf8');
 if(PIN[key]&&blob(raw)!==PIN[key])throw Error('Source profile data SHA not pinned: '+key);
 return JSON.parse(raw);
}
export function verify830OriginalSenateCFBReportPdfBytes(){
 const earlier=audit830SenateIndexedOfficialReports();
 if(earlier.allOfficialCandidateReportVersionRefs!==830
  ||earlier.originalReportVersionsWithDownloadedPDF!==480
  ||earlier.distinctOriginalWholeGovernmentPDFBodies!==476)
  throw Error('Immutable V38 original government index/source metadata changed');
 const before=readSource('old',830,19), proof=readSource('source',110,16),
   after=readSource('all',830,19), checkpoint=parseJson('checkpoint');
 const oldJson=parseJson('oldJson'),fresh=parseJson('newJson');
 if(checkpoint.schema!=='cfb-864-full-official-source-830-indexed-590-PDF-version-579-distinct-v40'
  ||checkpoint.original109FullGovernmentPdfReadOnlyRunId!==38679551930
  ||checkpoint.original109ReadOnlyJobId!==116240727412
  ||checkpoint.source2025NewVersionPDFBinarySuccesses!==109
  ||checkpoint.source2025OriginalPDFDownloadHolds!==0
  ||checkpoint.source2025NewUniquePDFWholeBinaries!==102
  ||checkpoint.source2025NewSameRegBinaryVersionAliases!==7
  ||checkpoint.original2021NewtonOriginalDownloadSHAReproduced!==true
  ||checkpoint.original2021NewtonEntirePdfSha256!=='21537d694379020977f027e1a337c3f6d1d84d0c18cab9a708e7da73c6af6b97'
  ||checkpoint.original2021NewtonWholePDFBytes!==2660897
  ||checkpoint.combinedVersionReferencesWithWholePdfByteSHA!==590
  ||checkpoint.combinedDistinctOriginalPDFByteHashes!==579
  ||checkpoint.indexedOfficialReportVersionsStillWithoutAnyDownloadedPDF!==240
  ||checkpoint.originalExactHistoricalPdfPublicByVersionsProven!==0
  ||checkpoint.statuteOwedReportDenominator!==null
  ||checkpoint.bulkTransactionAndMonetaryAmountsReconciled!==false
  ||checkpoint.noDonorPrivateSourceRowsOrRawPdfBodiesStored!==true
  ||checkpoint.noProtectedProductionDBOrModelChanges!==true)
  throw Error('Independent original CFB PDF source run and scope checkpoint changed');
 if(JSON.stringify(checkpoint.original2021NewtonSourceRunIds)!==JSON.stringify([38665626124,38665734833])
  ||JSON.stringify(checkpoint.original2021NewtonSourceJobIds)!==JSON.stringify([116196808098,116197154059]))
  throw Error('Newton original PDF SHA not pinned to independent repeated govt sources');
 const priorIds=new Map(before.rows.map(x=>[x[0],x]));
 if(priorIds.size!==830)throw Error('Previously known 830 actual-serving senator indexed filing versions duplicated');
 const newSha=new Map([...new Set(before.rows.map(x=>x[10]).filter(x=>x!=='-'))].map(sha=>[sha,'earlier-gov-original-PDF']));
 const derived=new Map(before.rows.map(x=>[x[0],[...x]]));
 const proofIds=new Set(),expected2025=new Set(),verifiedSha=new Set();
 let newReal=0,newAliases=0,newtonCnt=0;
 for(const record of proof.rows){
  const[id,person,year,reg,period,am,status,sha,bytes,viewer,url,retrieved,method,run,job,historic]=record;
  const p=derived.get(id),original=priorIds.get(id);
  if(!p||proofIds.has(id)||p[1]!==person||p[2]!==year||p[3]!==reg
   ||p[4]!==period||p[5]!==am||p[9]!==url||p[12]!==viewer
   ||p[10]!=='-'||p[11]!=='-'||historic!=='UNKNOWN'
   ||!SHA.test(sha)||!Number.isSafeInteger(Number(bytes))||Number(bytes)<300
   ||!['GET','POST'].includes(method)||!retrieved.startsWith('2026-10-15T'))
   throw Error('Source CFB original signed PDF version, senator, bytes and public URL do not match original index '+id);
  proofIds.add(id);
  if(id==='18004:21:pcc:YE:0:0'){
   if(person!=='Jerry Newton'||reg!=='18004'||year!=='2021'
    ||p[7]!=='official_filing_indexed_pdf_fetch_failed'
    ||sha!==checkpoint.original2021NewtonEntirePdfSha256
    ||Number(bytes)!==checkpoint.original2021NewtonWholePDFBytes
    ||run!=='38665734833,38665626124'||job!=='116197154059,116196808098'
    ||status!=='official_pdf_downloaded_unparsed'
    ||newSha.has(sha))
    throw Error('Newly recovered Newton original filed report SHA not independently verified');
   p[7]=status;p[10]=sha;p[11]=bytes;
   p[16]='government_original_2021_complete_pdf_body_recovered_unparsed';
   p[17]=FILE.source;
   newSha.set(sha,id);newtonCnt++;
   continue;
  }
  const q=id.split(':');
  if(year!=='2025'||q[1]!=='25'||q[3]!=='YE'
   ||p[7]!=='official_indexed_pdf_not_yet_retrieved'
   ||run!=='38679551930'||job!=='116240727412'
   ||q[0]!==reg||q[5]!==am||q[2]!=='pcc')
   throw Error('Unexpected 2025 official government report indexed original/amended ref promotion');
  const duplicate=newSha.get(sha);
  if(duplicate&&duplicate.split(':')[0]!==reg)
   throw Error('CFB report full PDF binary duplicated across different Senate candidate committees');
  const expected=duplicate?'indexed_alias_of_same_pdf':'official_pdf_downloaded_unparsed';
  if(status!==expected)throw Error('Original government CFB same-body amendment alias status not truthful');
  p[7]=status;p[10]=sha;p[11]=bytes;
  p[16]=duplicate?'original_government_2025_amendment_same_binary_alias':
   'original_government_2025_full_pdf_bytes_source_unparsed';
  p[17]=FILE.source;
  newSha.set(sha,id);
  if(duplicate)newAliases++;else newReal++;
  expected2025.add(id);verifiedSha.add(sha);
 }
 if(proofIds.size!==110||expected2025.size!==109||newReal!==102||newAliases!==7||newtonCnt!==1
  ||verifiedSha.size!==102)
  throw Error('109 full current 2025 report originals and Newton recovered original not completely counted');
 const recombined=[...derived.values()].sort((a,b)=>a[2].localeCompare(b[2])||a[1].localeCompare(b[1])||a[0].localeCompare(b[0]));
 if(recombined.map(x=>x.join('|')).join('\n')+'\n'!==after.raw)
  throw Error('Full 830 original government report versions + 110 real source PDFs do not independently reconstruct byte-for-byte');
 const src=after.rows,downloaded=src.filter(x=>x[10]!=='-').length,
   distinct=new Set(src.map(x=>x[10]).filter(x=>x!=='-')).size,
   indexOnly=src.filter(x=>x[7]==='official_indexed_pdf_not_yet_retrieved').length,
   missing=src.filter(x=>x[7]==='official_filing_indexed_pdf_fetch_failed').length,
   aliases=src.filter(x=>x[7]==='indexed_alias_of_same_pdf').length,
   readable=src.filter(x=>x[7]==='readable_official_pdf').length;
 if(src.length!==830||downloaded!==590||distinct!==579||indexOnly!==240
  ||missing!==0||aliases!==11||readable!==425)
  throw Error('Government source original 830 version/download/cross-committee dedup counts changed');
 if(oldJson.senators?.length!==95||fresh.senators?.length!==95)
  throw Error('Original actual Senate served member committee source cohort missing');
 const byReg=new Map();
 for(const row of recombined){
  const rows=byReg.get(row[3])??[];rows.push(row);byReg.set(row[3],rows);
 }
 const expectedPeople=oldJson.senators.map(p=>{
  const rows=byReg.get(p.registrationNumber)??[];
  if(rows.length!==p.observedVersions||rows.some(x=>x[1]!==p.name))
   throw Error('Original official candidate name/registration source mismatched to serving senator');
  const filings=rows.map(x=>({id:x[0],year:Number(x[2]),kind:x[6],
   amendment:Number(x[5]),status:x[7],url:x[9]}));
  const years=[...new Set(filings.map(x=>x.year))].sort();
  return{...p,downloadedVersions:rows.filter(x=>x[10]!=='-').length,
   needsReportTextReview:rows.filter(x=>
    ['downloaded_pdf_details_unreadable_or_unresolved','downloaded_pdf_report_date_conflict',
     'official_pdf_downloaded_unparsed'].includes(x[7])).length,
   reportYears:Object.fromEntries(years.map(y=>[y,filings.filter(f=>f.year===y).length])),
   filings};
 });
 if(JSON.stringify(expectedPeople)!==JSON.stringify(fresh.senators))
  throw Error('Profile-facing 95 senators report existence, source status or original CFB links changed');
 const s=fresh.sourceVerifiedCounts;
 if(fresh.schemaVersion!=='cfb-senate-practical-830-indexed-590-downloaded-579-distinct-official-pdfs-v40'
  ||s.total!==830||s.original!==506||s.amended!==324||s.versionsWithDownloadedPDF!==590
  ||s.distinctDownloadedPDFBodies!==579||s.viewerOnlyNotYetDownloaded!==240
  ||s.pdfFetchFailed!==0||s.indexAliases!==11||s.unparsedDownloadedSourcePDFBodies!==139
  ||s.sourceRetrieved2025NewPDFVersions!==109||s.sourceDistinct2025NewPDFFiles!==102
  ||s.source2025SameBinaryAliases!==7||s.newton2021Recovered!==true||s.senatorsCovered!==95)
  throw Error('2025 source PDF and Newton recovery status not reflected in app source data');
 return{schema:SCHEMA,
  official2021to25IndexedReportVersions:830,originalReferences:506,amendedReferences:324,
  actualServingSenatorsWithOfficialSourceReportReferences:95,
  originalCompletePdfBytesDownloadedVersionRefs:590,
  independentlyDistinctWholeGovernmentPdfByteSha256Bodies:579,
  original2025NewlyDownloadedVersionReferences:109,
  additionalDistinct2025WholePdfBodies:102,
  additional2025SameBodyVersionAliases:7,
  original2021NewtonYearendPdfIndependentlyDownloadedTwice:true,
  indexedVersionsPendingAnyPdfDownload:240,
  original2021MissingPdfNowResolved:true,
  totalSameBodyVersionAliases:11,
  sourceUnreviewedDownloadedPdfVersionReferences:139,
  historicalExactlyDated2021to25PdfPublicByProven:0,
  statutoryRequiredOriginalReportDenominator:null,
  noPrivateFinancialTransactionOrDonationRowsExported:true,
  noProductionDbOrStoredHistoricalEligibilityModelChanges:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('No private DB or raw original PDF file inputs authorized');
 console.log('CFB_864_830_590_579_95_SERVING_V40 '+JSON.stringify(verify830OriginalSenateCFBReportPdfBytes()));
}
