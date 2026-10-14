/**
 * #864 research-only V24 and V25: 430 old verified official version observations
 * plus FOUR independently twice-fetched actual CFB 2022 YE edited PDF binaries.
 * No financial transaction content, private DB, source write or historical
 * publication reclassification. 95 actual-serving persons x 5 years separately
 * documented; source-observed reports NEVER a statutory duty denominator.
 */
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{verifyPermanent430SourceLedgers}from'./audit-cfb-864-430-exact-original-amended-report-versions-v21.mjs';
export const SCHEMA='cfb-864-2021-25-434-exact-report-versions-415-PDFs-475-committee-years-v24';
const DIR='docs/evaluation/source-proof/';
export const FILES={
 new:DIR+'cfb-2022-four-extra-amended-original-PDF-SHA-source-v22.psv',
 source:DIR+'cfb-2022-four-extra-amended-independent-original-source-checkpoint-v22.json',
 combined:DIR+'cfb-2021-25-85-serving-senators-434-exact-original-amended-report-versions-v24.psv',
 people:DIR+'cfb-2021-25-95-serving-senators-85-authentic-89-viewer-principals-v24.psv',
 matrix:DIR+'cfb-2021-25-95-serving-senators-475-committee-year-duty-unknown-v25.psv',
 priorPeople:DIR+'cfb-2021-25-95-serving-senators-85-authentic-89-viewer-principals-v21.psv'
};
export const GIT_SHA={
 new:'11e6fcf5e27200f186f7dfc12232b8625012a2ef',
 source:'3b0ae268eee8a0fdc54fb78cdc36170aaf3a020f',
 combined:'3c5990fca86c22f37931d47c5d67ff52d3fbcf88',
 people:'42fb4fcfe6a0b27084f18196592e86db0665b303',
 matrix:'6766ed82dffa7254ded3fa43122906efb4894f62'
};
const sha=/^[a-f0-9]{64}$/,day=/^20\d\d-\d\d-\d\d$/;
const signedBlob=x=>createHash('sha1').update('blob '+Buffer.byteLength(x)+'\0').update(x).digest('hex');
function readPsv(k,width,rows){
 const s=readFileSync(FILES[k],'utf8');
 if(!s.endsWith('\n')||s.includes('\r')||(GIT_SHA[k]&&signedBlob(s)!==GIT_SHA[k]))
  throw Error('Source SHA/LF drift '+k);
 const v=s.trimEnd().split('\n').map(x=>x.split('|'));
 if(v.length!==rows||v.some(x=>x.length!==width||x.some(t=>!t)))
  throw Error('Source PSV width/rows drift '+k);
 return{source:s,rows:v};
}
function validDate(v){return day.test(v)&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v}
export function verify434OriginalCfbSources(){
 const prior=verifyPermanent430SourceLedgers();
 const added=readPsv('new',22,4),all=readPsv('combined',22,434);
 const people=readPsv('people',17,95),oldPeople=readPsv('priorPeople',17,95);
 const matrix=readPsv('matrix',23,475);
 const checkpointText=readFileSync(FILES.source,'utf8');
 if(signedBlob(checkpointText)!==GIT_SHA.source)throw Error('Two independent official original-body acquisition run checkpoint byte drift');
 const ck=JSON.parse(checkpointText);
 if(ck.schema!=='cfb-864-four-more-2022-ye-original-amendment-PDFs-full-sha-two-replays-v22'
  ||ck.sourceVersionCount!==4||ck.distinctAuthenticatedOriginalSignedPdfHashes!==4
  ||ck.firstLiveGovReadOnlyRunId!==38506846420||ck.secondLiveGovReadOnlyRunId!==38506867595
  ||ck.all13ExactOfficialRequestedPdfVersionsSameSourceShaAndSizeInBothSourceRuns!==true
  ||ck.firstpageHoldsStillUnresolved!==9||ck.zeroHistoricalExactOriginalPDFPublicBy!==true
  ||ck.legalObligationDenominator!==null||ck.sourcePDFs?.length!==4
  ||ck.noPrivateTransactionsOrDonorsExported!==true)
  throw Error('Two independent original PDF source run/full byte SHA proof checkpoint altered');
 const expectedNew=new Set([
  '17021:22:pcc:YE:0:3','17021:22:pcc:YE:0:4',
  '17316:22:pcc:YE:0:3','18500:22:pcc:YE:0:3']);
 const originals=prior.versionRows;
 const candidateRows=[];
 for(const row of added.rows){
  const[id,year,person,district,reg,period,se,index,kind,status,pdfSha,bytes,start,end,received,due,floor,viewer,alias,pub,url,proof]=row;
  if(!expectedNew.has(id)||row.length!==22||!/^(\d{4,8}):22:pcc:YE:0:([34])$/.test(id)
   ||id.split(':')[0]!==reg||Number(year)!==2022||period!=='YE'||se!=='0'
   ||Number(index)<3||kind!=='amended'||status!=='authenticated_amendment_pdf'
   ||!sha.test(pdfSha)||!sha.test(viewer)||!validDate(start)||!validDate(end)
   ||start!=='2022-01-01'||end!=='2022-12-31'||!validDate(received)
   ||due!=='2023-01-31'||!validDate(floor)||floor<received||floor<=due
   ||alias!=='-'||pub!=='-'||proof!==FILES.new
   ||!Number.isSafeInteger(Number(bytes))||Number(bytes)<1000)
   throw Error('New original government amended version not authentic-by-source '+id);
  const api='https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=22&type=pcc&period=YE&se=0&regnum='+reg+'&amend='+index;
  if(url!==api||originals.some(p=>p.id===id||p.pdf===pdfSha))
   throw Error('Duplicated old CFB amended official version or mismatched original API URL');
  const oldOriginal=originals.find(p=>p.reg===reg&&p.year===2022&&p.period==='YE'&&p.am===0);
  const checkpoint=ck.sourcePDFs.find(x=>x.versionId===id);
  if(!oldOriginal||oldOriginal.status!=='authenticated_original_pdf'
    ||oldOriginal.person!==person||oldOriginal.viewer!==viewer||oldOriginal.district!==Number(district)
    ||!checkpoint||checkpoint.sourcePdfSHA256!==pdfSha||checkpoint.sourcePdfBytes!==Number(bytes)
    ||checkpoint.fullOfficialViewerBodySHA256!==viewer
    ||checkpoint.originalParentId!==oldOriginal.id
    ||checkpoint.boardReceivedOn!==received
    ||checkpoint.yearEndFullPeriodVerified!==true
    ||checkpoint.exactHistoricalPdfPublicBy!==null)
    throw Error('Edited original report PDF source original parent/viewer/hash/period checkpoint mismatch');
  candidateRows.push({id,year:2022,person,district:Number(district),reg,period,se,am:Number(index),kind,
   status,pdf:pdfSha,bytes:Number(bytes),start,end,received,due,floor,viewer,
   alias,historic:pub,url,proof,row});
 }
 if(candidateRows.length!==4||new Set(candidateRows.map(x=>x.id)).size!==4||new Set(candidateRows.map(x=>x.pdf)).size!==4)
  throw Error('Four new source proofs are not unique');
 const combined=[...originals,...candidateRows].sort((a,b)=>a.year-b.year||a.district-b.district||a.reg.localeCompare(b.reg)||a.id.localeCompare(b.id));
 if(combined.map(x=>x.row.join('|')).join('\n')+'\n'!==all.source)
  throw Error('All 434 exact CFB report versions must be independently reconstructed byte-by-byte from 430 + 4');
 const indexed=new Map(combined.map(x=>[x.id,x]));
 for(const row of candidateRows){
  const cp=ck.sourcePDFs.find(x=>x.versionId===row.id);
  const predecessor=indexed.get(cp.immediatelyPriorKnownVersionId);
  if(!predecessor||predecessor.reg!==row.reg||predecessor.year!==2022||predecessor.period!=='YE'
   ||predecessor.am!==row.am-1||!predecessor.status.startsWith('authenticated_')
   ||predecessor.received!==cp.priorBoardReceivedOn||row.received<predecessor.received)
   throw Error('Original edited official version sequence is missing or receipt inversion '+row.id);
 }
 const originalShas=new Set(),counts={};let original=0,amended=0,holds=0,alias=0;
 for(const v of combined){
  if(v.kind==='original')original++;else amended++;
  if(v.status.startsWith('authenticated_')){
   if(originalShas.has(v.pdf))throw Error('Claiming two different authentic financial versions for one identical whole PDF hash');
   originalShas.add(v.pdf);
  }else if(v.status==='exact_pdf_alias')alias++;
  else if(['source_identity_hold','source_fetch_hold'].includes(v.status))holds++;
  else throw Error('Uncategorized government CFB source version HOLD');
  const k=counts[v.year]??={year:v.year,refs:0,original:0,amended:0,auth:0,holds:0,aliases:0};
  k.refs++;k[v.kind]++;if(v.status.startsWith('authenticated_'))k.auth++;
  else if(v.status==='exact_pdf_alias')k.aliases++;else k.holds++;
 }
 if(combined.length!==434||original!==263||amended!==171||originalShas.size!==415||holds!==15||alias!==4)
  throw Error('Combined exact government report version authenticity/alias/hold numbers drift');
 const oldByName=new Map(oldPeople.rows.map(x=>[x[0],x]));
 const intended=oldPeople.rows.map(x=>[...x]);
 const nextByName=new Map(intended.map(x=>[x[0],x]));
 if(oldByName.size!==95||nextByName.size!==95)throw Error('Actual 95 serving person source changed');
 for(const v of candidateRows){
  const target=nextByName.get(v.person);
  if(!target||target[4]!==v.reg||!target[12].split(',').includes('2022'))
   throw Error('Original candidate principal not matched to actual serving senator before version promotion');
  for(const i of [6,8,9])target[i]=String(Number(target[i])+1);
 }
 if(intended.map(x=>x.join('|')).join('\n')+'\n'!==people.source)
  throw Error('Permanent 95 member candidate source coverage changed absent newly signed original bytes');
 const output=[];
 const s=new Set();
 for(const p of intended){
  const[name,served,terms,,reg,sourceIdentity]=p;
  if(!reg||reg==='-'||s.has(reg))throw Error('Same official candidate committee identity assigned to multiple senators');
  s.add(reg);const servingYears=new Set(served.split(',').map(Number));
  for(let year=2021;year<=2025;year++){
   const parts=combined.filter(v=>v.reg===reg&&v.year===year);
   if(parts.some(v=>v.person!==name))throw Error('Original CFB report version not associated with verified actual member');
   const count=parts.length,originals=parts.filter(v=>v.kind==='original').length;
   const certified=parts.filter(v=>v.status.startsWith('authenticated_')).length;
   const held=parts.filter(v=>v.status==='source_identity_hold'||v.status==='source_fetch_hold').length;
   const aliased=parts.filter(v=>v.status==='exact_pdf_alias').length;
   const district=terms.split(';').find(x=>x.startsWith(year+':'))?.split(':')[1]||'-';
   const types=[...new Set(parts.map(v=>v.period+':'+v.se))].sort().join(',')||'-';
   const dates=[...new Set(parts.map(v=>v.period+':'+v.se+'@'+v.due))].sort().join(',')||'-';
   const status=count?'official_viewer_versions_observed_selected_pdf_panel':'no_selected_official_viewer_version_not_a_nonfiler_finding';
   const row=[name,String(year),servingYears.has(year)?'actual_service_overlap':'not_served_in_this_calendar_year',
    district,reg,p[13],p[5],String(count),String(originals),String(count-originals),
    String(certified),String(held),String(aliased),types,dates,status,
    'UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','unverified',parts.map(v=>v.id).join(',')||'-'];
   if(row.length!==23||row.some(x=>x.includes('|')||x.includes('\n')))
    throw Error('Invalid committee-year public source evidence row');
   output.push(row.join('|'));
  }
 }
 if(output.length!==475||output.join('\n')+'\n'!==matrix.source)
  throw Error('95 original Senate members × 5 report years not exact reproducible from 434 signed CFB sources');
 const peopleWithAuthenticatedPdf=new Set(combined.filter(v=>v.status.startsWith('authenticated_')).map(v=>v.person));
 if(peopleWithAuthenticatedPdf.size!==85||s.size!==95||counts[2022].refs!==202||counts[2022].auth!==197)
  throw Error('False complete original Senate report candidate/legal obligation census');
 return{schema:SCHEMA,officialExactReportVersionReferences:434,
  authenticatedDistinctOriginalFullGovernmentPDFs:415,originalReferences:263,amendedReferences:171,
  strictDocumentOrRetrievalHolds:15,officialViewerSameBinaryAliases:4,
  actualServing2021to25Senators:95,verifiedOriginalPrincipalPdfSenators:85,
  officialCandidatePrincipalRegistrationsWithVersionEvidence:89,
  originalCandidateCommitteeYearObservationRows:475,
  byReportYear:Object.values(counts).sort((a,b)=>a.year-b.year),
  additionalIndependentSourceRuns:[38506846420,38506867595],
  originalAfterAmendmentReplacementsVerified:4,
  separatelyVerifiedHistoricalPublicByExactPdfVersions:0,
  committeeLegallyRequiredReportDenominator:null,
  historicalCommitteeLifecycleAndTerminationsCertified:false,
  originalPDFContentSummaryReconciliationCertified:false,
  noDonorOrPrivateTransactionDetails:true,noNeonOrProductionReadWrites:true,
  noStoredForecastEligibilityRepair:true,versionRows:combined};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('No user-supplied candidate IDs, SQL or source overrides accepted');
 const{versionRows,...safe}=verify434OriginalCfbSources();
 console.log('CFB_864_434_EXACT_ORIGINAL_AMENDED_OFFICIAL_V24 '+JSON.stringify(safe));
}
