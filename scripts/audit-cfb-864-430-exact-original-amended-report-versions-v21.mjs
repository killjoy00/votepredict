/**
 * Issue #864 — version-PDF ONLY. Read-only OFFLINE and no private financial data.
 * Replay source-gated old V19 298 report versions and V20 132 new versions.
 * These are source OBSERVATIONS, not a Senate filing-duty or date-public census.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {verifyPermanent298SourceLedgers} from './audit-cfb-864-298-exact-reports-51-serving-principals-v19.mjs';
import {verifyPinned57AgainstOriginalSourceCheckpoint} from './audit-cfb-864-57-actual-serving-candidate-registration-leads-v17.mjs';

export const SCHEMA='cfb-864-2021-25-430-exact-report-version-observations-85-Senate-authentic-principals-v21';
export const PREFIX='docs/evaluation/source-proof/';
export const PATHS=Object.freeze({
 old:PREFIX+'cfb-2021-25-51-actually-serving-principals-298-exact-report-version-pdfs-v19.psv',
 new:PREFIX+'cfb-2021-22-38-actually-served-132-yearend-versions-v20.psv',
 viewer:PREFIX+'cfb-2021-22-38-actually-served-original-viewer-yearend-coverage-v20.psv',
 checkpoint:PREFIX+'cfb-2021-22-38-original-yearend-source-checkpoint-v20.json',
 combined:PREFIX+'cfb-2021-25-85-serving-senators-430-exact-official-original-amended-report-versions-v21.psv',
 coverage:PREFIX+'cfb-2021-25-95-serving-senators-85-authentic-89-viewer-principals-v21.psv',
 priorService:PREFIX+'cfb-2021-25-95-serving-senators-51-source-authentic-CFB-report-principals-v19.psv',
 registrationLeads:PREFIX+'cfb-2021-25-57-additional-serving-senator-original-candidate-registration-leads-v17.psv'
});
const IMMUTABLE_GIT_BLOBS=Object.freeze({
 new:'10c8c1424d73fa5ba80fbdd9690d0eecc440e185',
 viewer:'e67abc0ebd9636ac44429feb48d0ab00f2de569d',
 checkpoint:'7028c4acec73cb70e014c7458060c337b93a16c0',
 combined:'f43cc2987b71d08b886abde9192e2110d1ff9bb3',
 coverage:'f6acae55afea32084936258fca40abd481ebc1c0'
});
const SHA=/^[a-f0-9]{64}$/,DAY=/^20\d\d-\d\d-\d\d$/;
const ID=/^(\d{4,8}):(2[1-5]):pcc:(C|E|YE):([01]):(\d+)$/;
const sha=s=>createHash('sha256').update(s).digest('hex');
function blob(s){return createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex')}
function readPsv(path,width,rows){
 const s=readFileSync(path,'utf8');
 if(!s.endsWith('\n')||s.includes('\r'))throw Error('Immutable PSV must end LF without CR: '+path);
 const a=s.trimEnd().split('\n').map(l=>l.split('|'));
 if(a.length!==rows||a.some(r=>r.length!==width||r.some(x=>!x)))
  throw Error('Immutable source PSV count/width invalid: '+path);
 return{body:s,rows:a};
}
function validDay(s){return DAY.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s}
function nextDay(s){const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)}
function personKey(s){
 return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9 ]/g,' ').trim().split(/\s+/).filter(w=>!['sr','jr','ii','iii','iv'].includes(w)).join(' ');
}
function versionUrl(id){
 const a=ID.exec(id);if(!a)throw Error('Invalid version id '+id);
 return 'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year='+
  a[2]+'&type=pcc&period='+a[3]+'&se='+a[4]+'&regnum='+a[1]+'&amend='+a[5];
}
function versionRows(p){
 return p.map(a=>{
  const[id,year,person,district,reg,period,se,am,kind,status,pdf,bytes,start,end,received,due,floor,viewer,alias,historic,url,proof]=a;
  const match=ID.exec(id);
  if(!match||match[1]!==reg||2000+Number(match[2])!==Number(year)
    ||match[3]!==period||match[4]!==se||Number(match[5])!==Number(am)
    ||url!==versionUrl(id)||!SHA.test(viewer)||!person
    ||!Number.isInteger(Number(district))||Number(district)<1||Number(district)>67
    ||kind!==(Number(am)===0?'original':'amended')
    ||historic!=='-'||(!proof.startsWith(PREFIX))||!validDay(due))
   throw Error('Original government PDF version identity, legal date or historical public-by false: '+id);
  if(status.startsWith('authenticated_')){
   if(!['authenticated_original_pdf','authenticated_amendment_pdf'].includes(status)
      ||(am==='0')!==(status==='authenticated_original_pdf')
      ||!SHA.test(pdf)||!Number.isSafeInteger(Number(bytes))
      ||Number(bytes)<1000||Number(bytes)>30000000
      ||!validDay(start)||!validDay(end)||!validDay(received)||!validDay(floor)
      ||received<end||floor<[received,nextDay(due)].sort().at(-1)
      ||alias!=='-')
    throw Error('Source body/form/received due clock not valid '+id);
  }else if(status==='source_identity_hold'||status==='source_fetch_hold'){
   if(floor!=='-'||alias!=='-'\n      ||(start!=='-'&&!validDay(start))||(end!=='-'&&!validDay(end))\n      ||(received!=='-'&&!validDay(received))
      ||status==='source_identity_hold'&&(!SHA.test(pdf)||Number(bytes)<1000)
      ||status==='source_fetch_hold'&&(pdf!=='-'||bytes!=='-'))
    throw Error('Do not promote held report form/receipt/publication '+id);
  }else if(status==='exact_pdf_alias'){
   if(am==='0'||!SHA.test(pdf)||alias==='-'||!validDay(start)||!validDay(end)
     ||!validDay(received)||!validDay(floor)\n     ||floor<[received,nextDay(due)].sort().at(-1))
    throw Error('Aliased original government PDF without an authentic parent '+id);
  }else throw Error('Unsupported government report version proof status '+id+': '+status);
  return{id,year:Number(year),person,district:Number(district),reg,period,se,am:Number(am),kind,status,pdf,bytes:bytes==='-'?null:Number(bytes),start,end,received,due,floor,viewer,alias,historic,url,proof,row:a};
 });
}
function assertRebuiltData(old,newRows,viewers,checkpoint){
 if(checkpoint.schema!=='cfb-864-38-actual-senate-2021-22-132-version-two-independent-acquisition-source-proof-v20'
   ||checkpoint.firstRunId!==38459030827||checkpoint.verifiedRunId!==38500547770
   ||checkpoint.all132ExactPdfBytesAndHashesIdenticalBetweenOriginalSourceRuns!==true
   ||checkpoint.original268GovernmentRegistrySHAReplayPassed!==true
   ||checkpoint.original268GovernmentRegistryEntireSHA256!=='83770615658f7cf47802b05257bcbd45bed0c7c41ec19dfe99c31ca91b746c04'
   ||checkpoint.verifiedAuthenticDistinctFullPdfBodies!==123
   ||checkpoint.documentIdentityOrRetrievalHolds!==9
   ||checkpoint.historicalActualExactPdfPublicByIndependentlyDemonstrated!==0
   ||checkpoint.legalOwedReportFilingDutyDenominator!==null)
   throw Error('V20 independently acquired CFB original signed report source certificate drift');
 if(viewers.length!==38||newRows.length!==132
   ||new Set(viewers.map(x=>x[1])).size!==38
   ||viewers.reduce((a,x)=>a+Number(x[5]),0)!==136
   ||viewers.reduce((a,x)=>a+Number(x[6]),0)!==132
   ||viewers.reduce((a,x)=>a+Number(x[9]),0)!==123
   ||new Set(newRows.map(x=>x.person)).size!==38)
   throw Error('Exact CFB viewer source committee and PDF version coverage not reproducible');
 const reg=new Map(viewers.map(x=>[x[1],x]));
 const oldRegs=new Set(old.map(x=>x.reg));
 let auth=0,held=0,original=0,amended=0;
 for(const r of newRows){
  const candidate=reg.get(r.reg);
  if(!candidate||candidate[0]!==r.person||r.period!=='YE'||r.se!=='0'
    ||![2021,2022].includes(r.year)||r.proof!==PATHS.new
    ||oldRegs.has(r.reg)
    ||r.due!==(r.year===2021?'2022-01-31':'2023-01-31'))
    throw Error('New CFB principal/report/independent calendar outside original 38 source panel');
  if(r.kind==='original')original++;else amended++;
  if(r.status.startsWith('authenticated_'))auth++;
  else if(r.status==='source_identity_hold'||r.status==='source_fetch_hold')held++;
  else throw Error('Original 38 results must not silently add same-byte alias');
  if(r.status.startsWith('authenticated_')&&
     (r.start!==r.year+'-01-01'||r.end!==r.year+'-12-31'))
   throw Error('Strict original calendar-year report period not proven');
 }
 if(auth!==123||held!==9||original!==73||amended!==59)
  throw Error('V20 government PDF originals/amendments authentic totals invalid');
 for(const [regNumber,v] of reg){
  const rs=newRows.filter(x=>x.reg===regNumber);
  if(rs.length!==Number(v[6])||Number(v[11])!==rs.filter(x=>x.status==='authenticated_amendment_pdf').length
   ||Number(v[10])!==rs.filter(x=>x.status==='authenticated_original_pdf').length
   ||Number(v[12])!==rs.filter(x=>x.status.includes('hold')).length
   ||!SHA.test(v[2])||!SHA.test(v[3])
   ||!Number.isFinite(Date.parse(v[4]))||v[4].slice(0,4)!=='2026')
   throw Error('CFB principal report viewer hash/count/status discrepancy '+regNumber);
  const parentByYear=new Map(rs.filter(x=>x.am===0).map(x=>[x.year,x]));
  for(const x of rs.filter(x=>x.am>0&&x.status==='authenticated_amendment_pdf')){
   const parent=parentByYear.get(x.year);
   if(!parent||parent.status!=='authenticated_original_pdf'
     ||x.received<parent.received
     ||x.viewer!==parent.viewer)throw Error('Cannot credit edited PDF without original parent/chronology '+x.id);
  }
 }
}
export function verifyPermanent430SourceLedgers(){
 const previous=verifyPermanent298SourceLedgers();
 const registry=verifyPinned57AgainstOriginalSourceCheckpoint();
 if(previous.officialVersionReferences!==298||previous.independentlyAuthenticatedDistinctOriginalPdfBinaries!==288
   ||previous.sourceAuthenticatedCFBReportPrincipalSenators!==51||registry.servingSenators!==95)
  throw Error('Earlier original committee source proof panels changed');
 const p={};
 for(const k of ['old','new','viewer','combined','coverage','priorService','registrationLeads']){
  const widths={old:22,new:22,viewer:19,combined:22,coverage:17,priorService:10,registrationLeads:8};
  const lengths={old:298,new:132,viewer:38,combined:430,coverage:95,priorService:95,registrationLeads:57};
  p[k]=readPsv(PATHS[k],widths[k],lengths[k]);
  if(IMMUTABLE_GIT_BLOBS[k]&&blob(p[k].body)!==IMMUTABLE_GIT_BLOBS[k])
   throw Error('Permanent new original-source ledger Git blob changed '+k);
 }
 const checkpointBody=readFileSync(PATHS.checkpoint,'utf8');
 if(blob(checkpointBody)!==IMMUTABLE_GIT_BLOBS.checkpoint)
  throw Error('Independently verified PDF acquisition original SHA checkpoint changed');
 const checkpoint=JSON.parse(checkpointBody);
 const old=versionRows(p.old.rows),next=versionRows(p.new.rows),all=[...old,...next];
 const idSet=new Set(all.map(v=>v.id));
 if(idSet.size!==430||new Set(all.map(v=>v.reg)).size!==89)
  throw Error('Original 430 exact source version IDs or candidate committee principal registers duplicate');
 assertRebuiltData(old,next,p.viewer.rows,checkpoint);
 const uniqueSha=new Set(),byYear={},authPeople=new Set(),allPeople=new Set();
 const regs=new Map();let auth=0,holds=0,alias=0,orig=0,amend=0;
 for(const row of all){
  allPeople.add(personKey(row.person));
  const curr=regs.get(row.reg);
  if(curr&&curr!==personKey(row.person))throw Error('Same original candidate registration used for two senators');
  regs.set(row.reg,personKey(row.person));
  if(row.kind==='original')orig++;else amend++;
  if(row.status.startsWith('authenticated_')){
   auth++;authPeople.add(personKey(row.person));
   if(uniqueSha.has(row.pdf))throw Error('Claimed two distinct original official report PDF versions have same binary '+row.id);
   uniqueSha.add(row.pdf);
  }else if(row.status==='exact_pdf_alias')alias++;else holds++;
  let yr=byYear[row.year]??={year:row.year,versionReferences:0,original:0,amended:0,independentlyAuthenticatedWholeOriginalPDFs:0,documentOrFetchHolds:0,sameBinaryViewerIdAliases:0};
  yr.versionReferences++;yr[row.kind]++;
  if(row.status.startsWith('authenticated_'))yr.independentlyAuthenticatedWholeOriginalPDFs++;
  else if(row.status==='exact_pdf_alias')yr.sameBinaryViewerIdAliases++;
  else yr.documentOrFetchHolds++;
 }
 if(auth!==411||uniqueSha.size!==411||holds!==15||alias!==4||orig!==263||amend!==167
   ||authPeople.size!==85||allPeople.size!==89)
  throw Error('Aggregate 430 original CFB filing-version ledger/count identity drift');
 const aliasRows=all.filter(x=>x.status==='exact_pdf_alias');
 for(const x of aliasRows){
  const parent=all.find(p=>p.id===x.alias);
  if(!parent||!parent.status.startsWith('authenticated_')||parent.pdf!==x.pdf
   ||parent.reg!==x.reg||parent.year!==x.year)
   throw Error('Official alias viewer report did not return the same signed original report bytes '+x.id);
 }
 const sorted=all.sort((a,b)=>a.year-b.year||a.district-b.district||a.reg.localeCompare(b.reg)||a.id.localeCompare(b.id));
 const rebuild=sorted.map(r=>r.row.join('|')).join('\n')+'\n';
 if(rebuild!==p.combined.body)throw Error('430 permanent official report version ledger is not byte-exact old+new source regeneration');
 const roster=new Map(p.priorService.rows.map(x=>[personKey(x[0]),x]));
 if(roster.size!==95)throw Error('Original LRL actual senator directory not unique');
 const leads=new Map(p.registrationLeads.rows.map(x=>[x[0],x]));
 const expected=p.priorService.rows.map(oldMember=>{
  const name=oldMember[0],k=personKey(name);
  const rr=all.filter(x=>personKey(x.person)===k);
  const registrations=[...new Set(rr.map(x=>x.reg))];
  if(registrations.length>1)throw Error('Source showed more than one candidate principal for person: '+name);
  const lead=leads.get(name);
  if(lead&&registrations.length&&lead[1]!==registrations[0])
   throw Error('Archived candidate committee principal changed versus source registry '+name);
  const chosen=registrations[0]||lead?.[1]||'-';
  const authCount=rr.filter(x=>x.status.startsWith('authenticated_')).length;
  const statuses=authCount?
   'authenticated_source_report_PDF_in_selected_panel_not_legal_owed_completeness':
   rr.length?'held_source_report_versions_only_no_authentic_PDF':
   'no_exact_original_PDF_version_in_selected_source_panel_not_nonfiler';
  const identity=registrations.length?'official_original_source_verified_PDF_principal':
   lead?(lead[3]==='EXACT'?'original_registry_exact_name_source_lead_only':'official_registry_candidate_name_alias_hold_only'):
   'no_official_original_PDF_report_principal_in_selected_panel';
  return[name,oldMember[1],oldMember[2],oldMember[3],chosen,lead?.[3]||'prior_pdf_source_verified',
   String(rr.length),String(rr.filter(x=>x.kind==='original').length),
   String(rr.filter(x=>x.kind==='amended').length),String(authCount),
   String(rr.filter(x=>x.status==='source_identity_hold'||x.status==='source_fetch_hold').length),
   String(rr.filter(x=>x.status==='exact_pdf_alias').length),
   [...new Set(rr.map(x=>x.year))].sort().join(',')||'-',identity,statuses,'0','UNKNOWN'].join('|');
 }).join('\n')+'\n';
 if(expected!==p.coverage.body)throw Error('Complete 95 senator original source PDF panel not regenerated exactly');
 const coverage=p.coverage.rows;
 const verified=coverage.filter(x=>Number(x[9])>0).length;
 const heldOnly=coverage.filter(x=>Number(x[6])>0&&Number(x[9])===0).length;
 const leadOnly=coverage.filter(x=>Number(x[6])===0).length;
 const aliasHoldWithoutViewer=coverage.filter(x=>Number(x[6])===0&&x[5]==='ALIAS_HOLD').length;
 if(verified!==85||heldOnly!==4||leadOnly!==6||aliasHoldWithoutViewer!==5
   ||Object.keys(byYear).length!==5)
  throw Error('False complete statewide Senate candidate report inventory');
 return{schema:SCHEMA,issue:864,
  verifiedOriginalWholePdfBinaries:uniqueSha.size,officialSelectedVersionReferences:all.length,
  originalVersionReferences:orig,amendedVersionReferences:amend,
  sourceDocumentIdentityOrFetchHolds:holds,sourceIdenticalPdfViewerIndices:alias,
  authenticatedServingSenatorPrincipals:verified,otherServingSenatorsWithHeldOnlyPdfVersions:heldOnly,
  servingSenatorsWithCandidateRegistrationLeadButNoSelectedReportVersions:leadOnly,
  ofWhichFirstNameRegistryAliasIdentityHolds:aliasHoldWithoutViewer,
  actual2021to25ServingSenators:roster.size,
  sourceAuthenticatedViewerCandidatePrincipals:regs.size,
  byReportYear:Object.values(byYear).sort((a,b)=>a.year-b.year),
  independentlyHistoricalExactPdfPublicByProven:0,statutoryDueAndBoardReceiptNotActualHistoricalPublication:true,
  originalReviewedSourceAcquisitionRuns:[38459030827,38500547770],
  sourceOriginalArchiveIdentityReplayRequired:true,
  statewideLegalOwedReportVersionDenominator:null,notOfficialFilingObligationCompleteness:true,
  noPrivateDonorTransactionFinancialReconciliationClaimed:true,
  noProtectedDBOrProductionWriteOrForecastEligibilityUpdates:true,
  permanentCombined430GitBlobSha1:IMMUTABLE_GIT_BLOBS.combined,
  permanent95SourceCoverageGitBlobSha1:IMMUTABLE_GIT_BLOBS.coverage,
  permanentV20PdfSourceGitBlobSha1:IMMUTABLE_GIT_BLOBS.new,
  permanentV20OriginalArchiveViewerProofGitBlobSha1:IMMUTABLE_GIT_BLOBS.viewer,
  versionRows:all
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const out=verifyPermanent430SourceLedgers();
 const{versionRows,...safe}=out;
 console.log('CFB_864_430_ORIGINAL_AMENDED_REPORT_VERSION_V21 '+JSON.stringify(safe));
}
