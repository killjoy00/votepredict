/**
 * #864 Source-only official 2025 year-end reconciliation.
 * Rebuild all 109 new indexed versions directly from the immutable SHA-pinned
 * ORIGINAL Minnesota CFB 2026 segment viewer observations for all 70 2025-
 * serving senator committees. Previously signed 480 source PDFs remain.
 * A 2025 YE report downloaded/first visible in 2026 never becomes evidence
 * public during a 2025 vote merely from its calendar-year label.
 */
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{audit36NewOriginalCfbPdfBinaries}from'./audit-cfb-864-36-new-whole-pdfs-721-inventory-v36.mjs';
export const SCHEMA='cfb-864-830-indexed-official-2021to25-Senate-versions-95-actual-serving-v38';
const D='docs/evaluation/source-proof/';
const PATH={
 base:D+'cfb-2021-25-95-senators-721-indexed-480-PDF-bodies-v36.psv',
 group:D+'cfb-2025-70-serving-senators-130-original-government-viewer-versions-v38.psv',
 new:D+'cfb-2025-70-serving-senators-109-extra-original-indexed-YE-versions-v38.psv',
 all:D+'cfb-2021-25-95-senators-830-indexed-480-downloaded-v38.psv',
 checkpoint:D+'cfb-2025-70-original-viewer-109-new-versions-checkpoint-v38.json',
 priorJson:'data/cfb-senate-official-filings-2021-25-v36.json',
 json:'data/cfb-senate-official-filings-2021-25-v38.json'
};
const PIN={
 group:'c54937c330ddd439ae718d9e0ae88892021908c1',
 new:'86f3eb98e587f2cd41c8aa4431de9f4ec0de701d',
 all:'4104a96309ebe955f4e42c08807e15688646ddfc',
 checkpoint:'904e282beecefba60e6c62b6cc588fcf5e35762d',
 json:'4e05e3266c90c8b7f7eb32fda6b6a3fa24282446'
};
const sha=/^[a-f0-9]{64}$/;
const blob=x=>createHash('sha1').update('blob '+Buffer.byteLength(x)+'\0').update(x).digest('hex');
function psv(key,size,width){
 const s=readFileSync(PATH[key],'utf8');
 if(!s.endsWith('\n')||s.includes('\r')||(PIN[key]&&blob(s)!==PIN[key]))
  throw Error('Official 2025 CFB source metadata body altered '+key);
 const rows=s.trimEnd().split('\n').map(v=>v.split('|'));
 if(rows.length!==size||rows.some(x=>x.length!==width||x.some(y=>y==='')))
  throw Error('2025 CFB original-index report identity rows missing or malformed '+key);
 return{raw:s,rows};
}
export function audit830SenateIndexedOfficialReports(){
 const prior=audit36NewOriginalCfbPdfBinaries();
 if(prior.officialIndexed2021to25Versions!==721||prior.totalDownloadedSourcePDFVersionRefs!==480||prior.uniqueWholeOfficialPDFBodies!==476)
  throw Error('Earlier signed 721-index 480-downloaded PDF government source proof drift');
 const base=psv('base',721,19),sources=psv('group',70,9),
   added=psv('new',109,19),complete=psv('all',830,19);
 const sourceCp=readFileSync(PATH.checkpoint,'utf8');
 if(blob(sourceCp)!==PIN.checkpoint)throw Error('2025 original government candidate viewer checkpoint mutated');
 const cp=JSON.parse(sourceCp);
 if(cp.schema!=='cfb-864-2025-70-original-2026-viewer-109-new-YE-indexed-report-versions-v38'
   ||cp.originalGovernmentReadOnlyWorkflowRunId!==38645535219
   ||cp.originalGovernmentReadOnlyWorkflowJobId!==116131319722
   ||cp.original2025ActualServingSenatorsWithViewerResponse!==70
   ||cp.original2025ReportVersionReferences!==130||cp.old2025ReportVersionReferences!==21
   ||cp.newlyRecognized2025ReportVersionReferences!==109
   ||cp.new2025OriginalReferences!==66||cp.new2025AmendmentReferences!==43
   ||cp.numberOfOriginalPDFBodiesDownloadedForTheseNew109!==0
   ||cp.historicalExactPDFVersionPublicBefore2025VoteCertified!==0
   ||cp.statutoryRequiredReportDenominator!==null||cp.noHistoricalAsOfOrModelOrProductionDatabaseChanges!==true)
  throw Error('Original CFB source run or 2025 cutoff safety assertion drift');
 const prev=JSON.parse(readFileSync(PATH.priorJson,'utf8'));
 const persons=new Map(prev.senators.map(x=>[x.registrationNumber,x]));
 const priorIds=new Map(base.rows.map(x=>[x[0],x]));
 if(persons.size!==95||priorIds.size!==721)throw Error('Original CFB Senate roster/source ID duplicate');
 const wanted=new Map(),grouped=new Set();
 let expectedOld=0,expectedObserved=0;
 for(const row of sources.rows){
  const[person,reg,viewerSha,fetchAt,url,indexedCsv,oldCsv,newCsv,status]=row;
  const owner=persons.get(reg);
  if(!owner||owner.name!==person||!owner.servedYears.includes(2025)||grouped.has(reg)
    ||status!=='original_official_cfb_2026_viewer_source_verified'
    ||!sha.test(viewerSha)||!fetchAt.startsWith('2026-10-14T')
    ||url!=='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+reg+'/2026/')
   throw Error('Original official 2025 CFB viewer not actual 2025-serving senator');
  grouped.add(reg);
  const all=indexedCsv.split(','),old=oldCsv==='-'?[]:oldCsv.split(','),extra=newCsv==='-'?[]:newCsv.split(',');
  if(all.length!==new Set(all).size||all.length!==old.length+extra.length||all.length===0)
   throw Error('Original 2025 CFB report-indexed version count not exhaustive for candidate');
  expectedOld+=old.length;expectedObserved+=all.length;
  for(const id of old){
   const x=priorIds.get(id);
   if(!all.includes(id)||!x||x[1]!==person||x[3]!==reg||x[2]!=='2025'||x[12]!==viewerSha)
    throw Error('Previously reported full official CFB 2025 PDF viewer hash/source conflict '+id);
  }
  for(const id of extra){
   if(!all.includes(id)||priorIds.has(id)||wanted.has(id))throw Error('2025 official viewer new ID duplicates or conflicts '+id);
   const parts=id.split(':');
   const [num,yy,type,period,se,am]=parts;
   if(parts.length!==6||num!==reg||yy!=='25'||type!=='pcc'||period!=='YE'
      ||!['0','1'].includes(se)||!/^\d+$/.test(am))
    throw Error('Invalid 2025 original YE government viewer reference '+id);
   const exact='https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=25&type=pcc&period=YE&se='+se+'&regnum='+reg+'&amend='+am;
   const expected=[id,person,'2025',reg,'YE',am,am==='0'?'original':'amended',
    'official_indexed_pdf_not_yet_retrieved',
    owner.officialNameLink==='documented_official_name_variant'
     ?'official_candidate_documented_name_variant':'official_candidate_full_name',
    exact,'-','-',viewerSha,'-','-','-','official_2026_cfb_candidate_viewer_index_pdf_not_fetched',
    PATH.new,'UNKNOWN'];
   wanted.set(id,expected);
  }
 }
 if(grouped.size!==70||expectedOld!==21||expectedObserved!==130||wanted.size!==109)
  throw Error('70 original government 2025 candidate viewers missed a committee or indexed YE version');
 const newly=[...wanted.values()].sort((a,b)=>a[3].localeCompare(b[3])||a[0].localeCompare(b[0]));
 if(newly.map(v=>v.join('|')).join('\n')+'\n'!==added.raw)
  throw Error('Signed original government 2025 CFB report IDs have different PSV metadata');
 const combined=[...base.rows,...newly].sort((a,b)=>a[2].localeCompare(b[2])||a[1].localeCompare(b[1])||a[0].localeCompare(b[0]));
 if(combined.map(v=>v.join('|')).join('\n')+'\n'!==complete.raw
    ||new Set(combined.map(v=>v[0])).size!==830)
  throw Error('Previous 721 exact original CFB viewer versions lost on 830 integration');
 const raw=readFileSync(PATH.json,'utf8');
 if(blob(raw)!==PIN.json)throw Error('Profile-ready 830 government original CFB source file SHA changed');
 const current=JSON.parse(raw);
 const registered=new Map();
 for(const row of combined){const x=registered.get(row[3])||[];x.push(row);registered.set(row[3],x)}
 const recomputed=prev.senators.map(p=>{
  const rows=registered.get(p.registrationNumber)||[];
  if(rows.some(x=>x[1]!==p.name))throw Error('Government report belongs to a different historical Senate member');
  const filings=rows.map(x=>({id:x[0],year:Number(x[2]),kind:x[6],amendment:Number(x[5]),status:x[7],url:x[9]}));
  const max=Math.max(...filings.map(x=>x.year)),segment=2*Math.ceil(max/2);
  return{...p,observedVersions:rows.length,
   originalVersions:rows.filter(x=>x[6]==='original').length,
   amendedVersions:rows.filter(x=>x[6]==='amended').length,
   downloadedVersions:rows.filter(x=>x[10]!=='-').length,
   viewerUrl:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+p.registrationNumber+'/'+segment+'/',
   reportYears:Object.fromEntries([...new Set(filings.map(x=>x.year))].sort().map(year=>[year,filings.filter(x=>x.year===year).length])),
   filings};
 });
 const c=current.sourceVerifiedCounts;
 if(JSON.stringify(current.senators)!==JSON.stringify(recomputed)
    ||current.schemaVersion!=='cfb-senate-practical-830-2021to25-indexed-480-downloaded-v38'
    ||c.total!==830||c.original!==506||c.amended!==324||c.priorOfficialIndexed!==721
    ||c.additional2025GovernmentViewerReferences!==109||c.serving2025SenatorViewersScanned!==70
    ||c.distinct2025OfficialYearendIndexedVersions!==130||c.viewerOnlyNotYetDownloaded!==349
    ||c.versionsWithDownloadedPDF!==480||c.distinctDownloadedPDFBodies!==476
    ||complete.rows.filter(x=>x[10]!=='-').length!==480
    ||new Set(complete.rows.map(x=>x[10]).filter(x=>x!=='-')).size!==476
    ||complete.rows.filter(x=>x[7]==='official_filing_indexed_pdf_fetch_failed').length!==1)
  throw Error('Government source confidence/status/visitor profile 830-source reconstruction failed');
 const years={};for(const x of complete.rows){years[x[2]]=(years[x[2]]||0)+1}
 if(JSON.stringify([2021,2022,2023,2024,2025].map(x=>years[x]))!==JSON.stringify([121,346,110,123,130]))
  throw Error('Original 2025 report year/period source counts wrong');
 return{schema:SCHEMA,actualServingSenatorsWithOfficialIndexedReports:95,
  original2025ActualServingCandidateViewersFetched:70,
  official2025YEReportVersionRefsObserved:130,additional2025Versions:109,
  additional2025OriginalVersions:66,additional2025AmendedVersions:43,
  previouslyIndexedOfficialReportVersions:721,
  allOfficialCandidateReportVersionRefs:830,
  originalVersionReferences:506,amendedVersionReferences:324,
  originalReportVersionsWithDownloadedPDF:480,
  distinctOriginalWholeGovernmentPDFBodies:476,
  remainingViewerOnlyNotYetDownloaded:349,
  indexedPDFUnretrievablePrevious:1,
  oldScannedAndUnresolvedOriginalPdfProofRecordsPreserved:true,
  no2025VoteCutoffPublicByInferred:true,
  legalReportFilingObligationsUnresolved:true,
  noFinancialRowOrModelOrProductionDbChanges:true,
  yearTotals:[2021,2022,2023,2024,2025].map(year=>({year,versionReferences:years[year]}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('No private-source overrides or live DB inputs');
 console.log('CFB_864_830_SOURCE_ONLY_70_2025_GOV_VIEWERS_V38 '+JSON.stringify(audit830SenateIndexedOfficialReports()));
}
