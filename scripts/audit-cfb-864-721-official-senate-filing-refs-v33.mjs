/**
 * #864: Fully offline rejoin of ALL 276 previously omitted original government
 * 2021-24 CFB report viewer version references for actual-serving senators.
 * A viewer reference is evidence a filing is listed; NOT a successful
 * download, PDF contents, a statutorily owed report or historical public-by.
 */
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{auditPracticalCFBSourceAcceptance}from'./audit-cfb-864-practical-official-filing-inventory-v32.mjs';
export const SCHEMA='cfb-864-official-senate-all-95-serving-721-indexed-versions-v33';
const DIR='docs/evaluation/source-proof/';
const FILE={
 source:DIR+'cfb-2021-24-senate-396-original-viewer-source-observations.psv',
 old:DIR+'cfb-2021-25-95-senators-445-official-filing-version-inventory-v32.psv',
 people:DIR+'cfb-2021-25-95-serving-senators-86-authentic-90-viewer-principals-v28.psv',
 new:DIR+'cfb-2021-24-95-serving-senators-276-more-official-indexed-period-references-v33.psv',
 all:DIR+'cfb-2021-25-95-senators-721-indexed-original-and-amended-reports-v33.psv',
 oldJson:'data/cfb-senate-official-filings-2021-25-v32.json',
 json:'data/cfb-senate-official-filings-2021-25-v33.json'
};
const PIN={
 source:'964dfe239d96a72964185f0492c62663f6f7c8e6',
 new:'f23d68ac7cf7c721e734c786962e13101953e38a',
 all:'136d516b3acc7c594422b138ff7bafd882198f46',
 json:'4a0c78ebb395d8e07767bd17e727449625e11a4e'
};
const blob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const SHA=/^[a-f0-9]{64}$/;
function source(k,count,width){
 const raw=readFileSync(FILE[k],'utf8');
 // The 396-line original government-viewer source was committed without a final LF.
 // Preserve its exact Git blob bytes instead of normalizing it or rejecting it.
 if((k!=='source'&&!raw.endsWith('\n'))||raw.includes('\r')||(PIN[k]&&blob(raw)!==PIN[k]))
  throw Error('Official CFB viewer archive and derived 95-senator evidence blob drift '+k);
 const rows=raw.trimEnd().split('\n').map(x=>x.split('|'));
 // An authentic CFB viewer may return zero reports for a registered candidate;
 // the original 396-source archive contains 14 such empty final PSV cells.
 // An empty index is NOT evidence that a report was legally owed or not filed.
 if(rows.length!==count||rows.some(x=>x.length!==width||
   (k==='source'?x.slice(0,3).some(z=>z===''):x.some(z=>z===''))))
  throw Error('Official CFB original source ledger count or delimiters drift '+k);
 return{raw,rows};
}
export function audit721OfficialCFBSenateReports(){
 const oldAudit=auditPracticalCFBSourceAcceptance();
 if(oldAudit.indexedOfficialReportVersions!==445||oldAudit.distinctDownloadedGovernmentPDFs!==440)
  throw Error('Original practical Senate filing inventory changed');
 const archive=source('source',396,4),old=source('old',445,19),people=source('people',95,17),
  next=source('new',276,19),all=source('all',721,19);
 const prior=JSON.parse(readFileSync(FILE.oldJson,'utf8'));
 const raw=readFileSync(FILE.json,'utf8');
 if(blob(raw)!==PIN.json)throw Error('Profile input government viewer-source JSON drift');
 const output=JSON.parse(raw);
 const principals=new Map(people.rows.map(x=>[x[4],x]));
 if(principals.size!==95||output.senators?.length!==95||prior.senators?.length!==95)
  throw Error('Historic original Senate committee/person registrations not unique');
 const previous=new Set(old.rows.map(x=>x[0])), additional=new Map();
 for(const [segment,reg,viewHash,versions]of archive.rows){
  const p=principals.get(reg);
  if(!p)continue; // original archive covers many candidates who never served, excluded
  if(!versions)continue; // valid original empty viewer response: no observed report, not a nonfiler finding
  if(!['2022','2024'].includes(segment)||!SHA.test(viewHash))
   throw Error('Previously authenticated original CFB candidate report viewer malformed');
  for(const rawVersion of versions.split(',')){
   const m=rawVersion.match(/^(2[1-4]):pcc:(C|E|YE):(\d+):(\d+)$/);
   if(!m)throw Error('Unexpected source-indexed original candidate report type '+rawVersion);
   const id=reg+':'+rawVersion;
   if(previous.has(id))continue;
   const [_,yy,period,se,amend]=m;
   const url='https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year='+yy+
    '&type=pcc&period='+period+'&se='+se+'&regnum='+reg+'&amend='+amend;
   const row=[id,p[0],'20'+yy,reg,period,amend,amend==='0'?'original':'amended',
    'official_indexed_pdf_not_yet_retrieved',p[5]==='ALIAS_HOLD'?'official_candidate_documented_name_variant':'official_candidate_full_name',
    url,'-','-',viewHash,'-','-','-','pdf_not_requested_original_government_viewer_reference',FILE.new,'UNKNOWN'];
   if(additional.has(id)){
    if(additional.get(id).join('|')!==row.join('|'))throw Error('Two original government viewer sources disagree on same version '+id);
    continue;
   }
   additional.set(id,row);
  }
 }
 const newRows=[...additional.values()].sort((a,b)=>a[2].localeCompare(b[2])||a[1].localeCompare(b[1])||a[0].localeCompare(b[0]));
 if(newRows.length!==276||newRows.map(x=>x.join('|')).join('\n')+'\n'!==next.raw)
  throw Error('276 original viewer references not reproducible or omitted');
 const combined=[...old.rows,...newRows].sort((a,b)=>a[2].localeCompare(b[2])||a[1].localeCompare(b[1])||a[0].localeCompare(b[0]));
 if(combined.length!==721||combined.map(x=>x.join('|')).join('\n')+'\n'!==all.raw
  ||new Set(combined.map(x=>x[0])).size!==721)
  throw Error('721 full original government CFB official indexed reference rows not reproducible');
 const byReg=new Map();
 for(const row of combined){
  const x=byReg.get(row[3])??[];x.push(row);byReg.set(row[3],x);
 }
 const projected=prior.senators.map(s=>{
  const parts=byReg.get(s.registrationNumber)??[];
  if(!parts.length||parts.some(p=>p[1]!==s.name))
   throw Error('Government indexed filing version attached to wrong actual-service Senate person');
  const filings=parts.map(r=>({
   id:r[0],year:Number(r[2]),kind:r[6],amendment:Number(r[5]),status:r[7],url:r[9]}));
  const maxYear=Math.max(...filings.map(f=>f.year)),segment=2*Math.ceil(maxYear/2);
  const years=[...new Set(filings.map(f=>f.year))].sort();
  return{...s,
   observedVersions:parts.length,originalVersions:parts.filter(r=>r[6]==='original').length,
   amendedVersions:parts.filter(r=>r[6]==='amended').length,
   downloadedVersions:parts.filter(r=>r[10]!=='-').length,
   viewerUrl:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+s.registrationNumber+'/'+segment+'/',
   reportYears:Object.fromEntries(years.map(year=>[year,filings.filter(f=>f.year===year).length])),
   filings};
 });
 if(JSON.stringify(projected)!==JSON.stringify(output.senators))
  throw Error('Server-side 95 member official candidate filing profile JSON data not an exact original source reconstruction');
 const s=output.sourceVerifiedCounts;
 if(output.schemaVersion!=='cfb-senate-practical-721-indexed-report-versions-95-senators-v33'
  ||s.total!==721||s.original!==440||s.amended!==281||s.priorOfficialIndexed!==445
  ||s.additionalViewerReferences!==276||s.versionsWithDownloadedPDF!==444
  ||s.distinctDownloadedPDFBodies!==440||s.readableSourcePdfForms!==425
  ||s.scannedOrUnreadableSourceForms!==14||s.dateAnomaly!==1
  ||s.pdfFetchFailed!==1||s.indexAliases!==4||s.viewerOnlyNotYetDownloaded!==276
  ||s.senatorsCovered!==95)
  throw Error('Practical Senate government report-viewer inclusion does not match exact observed evidence');
 const years={};for(const row of combined){years[row[2]]=(years[row[2]]??0)+1;}
 if(JSON.stringify([2021,2022,2023,2024,2025].map(y=>years[y]))!==JSON.stringify([121,346,110,123,21]))
  throw Error('CFB version cross-year original viewer reconciliation dropped reports');
 return{
  schema:SCHEMA,sourceOriginalGovernmentViewerObservationRows:396,
  independentActualServingSenatePersonRegistrations:95,
  officialIndexedReportVersions:721,
  originalReportVersionRefs:440,amendedVersionRefs:281,
  previousKnownFilingVersionIdsKept:445,additionalOfficialCFBViewerVersionIds:276,
  officialVersionRefsWithOriginalWholePDFDownloaded:444,
  distinctDownloadedCompletePDFBytesSHA256:440,
  sourceIndexOnlyPdfNotFetchedYet:276,
  senatorsWithAtLeastOneSourceIndexedCFBReport:95,
  previouslyUnresolvedPDFParsingStillListed:15,
  missingPreviouslyIndexedPDFCount:1,
  historicalPreVoteExactVersionPublicationNotInferred:true,
  originalStatutorilyOwedReportsNotCounted:true,
  noExistingAsOfEligibilityOrModelOrProductionDatabaseChange:true,
  byReportYear:[2021,2022,2023,2024,2025].map(y=>({year:y,versions:years[y]})),
  newPeriodClassCounts:{C:48,E:52,YE:176}
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('No external file, DB or runtime source overrides');
 console.log('CFB_864_ARCHIVED_GOV_VIEWER_721_INDEXED_V33 '+JSON.stringify(audit721OfficialCFBSenateReports()));
}
