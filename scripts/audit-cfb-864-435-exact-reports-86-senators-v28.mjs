/** #864 SOURCE-ONLY V28. New Doron Clark YE is exact 2025 original CFB 
 * SHA authenticated on two separate Actions attempts; no finance row import,
 * historic as-of public-by promotion, production writes or legal duty assertion.
 */
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{verify434OriginalCfbSources}from'./audit-cfb-864-434-exact-report-versions-475-committee-years-v24.mjs';
export const SCHEMA='cfb-864-2021-25-86-senators-435-exact-version-416-original-PDFs-v28';
const D='docs/evaluation/source-proof/';
const FILE={
 old:D+'cfb-2021-25-85-serving-senators-434-exact-original-amended-report-versions-v24.psv',
 one:D+'cfb-2025-doron-clark-full-original-ye-PDF-source-v27.psv',
 proof:D+'cfb-2025-doron-clark-double-independent-2026-original-gov-PDF-checkpoint-v27.json',
 all:D+'cfb-2021-25-86-serving-senators-435-exact-original-amended-report-versions-v28.psv',
 oldPeople:D+'cfb-2021-25-95-serving-senators-85-authentic-89-viewer-principals-v24.psv',
 people:D+'cfb-2021-25-95-serving-senators-86-authentic-90-viewer-principals-v28.psv',
 matrix:D+'cfb-2021-25-95-serving-senators-475-committee-year-duty-unknown-v28.psv'
};
const BLOB={one:'6c7a30c22bc8576972e863cd8e87635d44cbda33',
 proof:'9b7d7796dc8d8131997561d42e701e8776eb8895',
 all:'fff8e56db6b142aaedc3ed357f3156e071e4cdf4',
 people:'81e1b4121625580c89acfdddba7e01c40b422b3f',
 matrix:'9924f88e11ad7004f5ed95ed999127e5676dfeed'};
const blob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
function ps(k,width,len){
 const raw=readFileSync(FILE[k],'utf8');
 if(!raw.endsWith('\n')||raw.includes('\r')||(BLOB[k]&&blob(raw)!==BLOB[k]))
  throw Error('Original source Git blob SHA or newline changed: '+k);
 const rows=raw.trimEnd().split('\n').map(x=>x.split('|'));
 if(rows.length!==len||rows.some(x=>x.length!==width||x.some(y=>!y)))
  throw Error('Original CFB ledger source rows/columns missing: '+k);
 return{raw,rows};
}
export function audit435FullOriginalReportSources(){
 const earlier=verify434OriginalCfbSources();
 if(earlier.officialExactReportVersionReferences!==434
   ||earlier.authenticatedDistinctOriginalFullGovernmentPDFs!==415
   ||earlier.verifiedOriginalPrincipalPdfSenators!==85)
  throw Error('Earlier V24 full original government PDF proof changed');
 const old=ps('old',22,434),n=ps('one',22,1),all=ps('all',22,435);
 const p=ps('oldPeople',17,95),updated=ps('people',17,95),matrix=ps('matrix',23,475);
 const proofBody=readFileSync(FILE.proof,'utf8');
 if(blob(proofBody)!==BLOB.proof)throw Error('Immutable original full PDF double-source checkpoint changed');
 const source=JSON.parse(proofBody),single=n.rows[0];
 if(source.schema!=='cfb-864-doron-clark-2025-original-official-candidate-yearend-PDF-v27'
  ||source.firstIndependentOriginalSourceRunId!==38507555080
  ||source.firstIndependentOriginalSourceJobId!==115668421613
  ||source.secondIndependentOriginalSourceJobId!==115669135235
  ||source.secondIndependentOriginalSourceAttempt!==2
  ||source.originalSourcePdfShaBytesViewerAndHeaderSameOnIndependentRun!==true
  ||source.actualHistoricalPublicAt2025VoteTimeNotProven!==true
  ||source.legalOwedReportDenominator!==null
  ||source.originalGovernment2024CandidateRegistryRegistration!=='19196'
  ||source.originalCandidateSourcePageSha256!=='72f5904924f6dd1fbbd5cf525116c84e7846b96c06d21c7ec4e0fa91765d2625'
  ||source.lrlOriginal2025SenateDistrict!==60||!source.candidateNameIdentityProvedWithoutNicknameEquivalence
  ||!source.sourceFullPdfFirstPageStrictVerified||source.historicalExactFullPDFPublicByOn!==null)
  throw Error('2025 Doron government candidate identity, source SHA or cutoff condition not independently verified');
 const[id,year,person,district,reg,period,se,am,kind,status,sha,bytes,start,end,receipt,due,floor,viewer,alias,pub,url,ledger]=single;
 if(id!=='19196:25:pcc:YE:0:0'||year!=='2025'||person!=='Doron Clark'||district!=='60'
  ||reg!=='19196'||period!=='YE'||se!=='0'||am!=='0'||kind!=='original'
  ||status!=='authenticated_original_pdf'||sha!==source.originalFullPdfSHA256
  ||sha!=='e6787a30a2aee8cd794255cc52b68d6ada9bc29daf22291c471b917d1c667a6b'
  ||bytes!==String(source.originalFullPdfBytes)||start!==source.actualPdfPeriodStart
  ||end!==source.actualPdfPeriodEnd||receipt!==source.boardOriginalReceivedOn
  ||start!=='2025-02-18'||end!=='2025-12-31'||receipt!=='2026-01-28'
  ||due!==source.independentOfficial2025CandidateAnnualYECalendarDueOn
  ||due!=='2026-02-02'||floor!==source.conservativeLegalNotBeforeOn||floor!=='2026-02-03'
  ||viewer!==source.sourceCfbCandidateViewer2026ResponseSHA256||alias!=='-'||pub!=='-'
  ||ledger!==FILE.one
  ||url!=='https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=25&type=pcc&period=YE&se=0&regnum=19196&amend=0')
  throw Error('Signed 2025 Doron CFB original government PDF version identity, legal NOT-BEFORE/receipt or SHA contradicted');
 const availableCal=old.rows.filter(v=>v[1]==='2025'&&v[5]==='YE'&&v[6]==='0'&&v[15]==='2026-02-02');
 if(availableCal.length<2||old.rows.some(v=>v[0]===id||v[10]===sha))
  throw Error('No independent prior 2025 YE original calendar basis or duplicate source PDF');
 const complete=[...old.rows,single].sort((a,b)=>Number(a[1])-Number(b[1])||Number(a[3])-Number(b[3])||a[4].localeCompare(b[4])||a[0].localeCompare(b[0]));
 if(complete.map(x=>x.join('|')).join('\n')+'\n'!==all.raw)throw Error('435 immutable original/amended government report source ledger not reproduced');
 const oldByName=new Map(p.rows.map(x=>[x[0],x]));
 const expected=p.rows.map(x=>[...x]),doron=expected.find(x=>x[0]==='Doron Clark');
 if(oldByName.size!==95||!doron||doron[1]!=='2025'||doron[2]!=='2025:60'
  ||doron[4]!=='19196'||doron[5]!=='EXACT'||doron[6]!=='0'
  ||doron[9]!=='0'||doron[13]!=='original_registry_exact_name_source_lead_only')
  throw Error('Original full LRL Senate service and 2024 candidate reg was not a direct name match');
 doron[6]='1';doron[7]='1';doron[9]='1';doron[12]='2025';
 doron[13]='official_original_source_verified_PDF_principal';
 doron[14]='authenticated_source_report_PDF_in_selected_panel_not_legal_owed_completeness';
 if(expected.map(x=>x.join('|')).join('\n')+'\n'!==updated.raw)
  throw Error('Updated 95 actually served senators report PDF evidence cohort drift');
 const reconstructed=[];const years={},shaBodies=new Set(),ids=new Set(),principals=new Set(),verifiedPersons=new Set();
 let original=0,amended=0,holds=0,aliases=0;
 for(const v of complete){
  if(ids.has(v[0]))throw Error('Duplicate exact official original/amended CFB report viewer version');
  ids.add(v[0]);principals.add(v[4]);
  if(v[8]==='original')original++;else amended++;
  if(v[9].startsWith('authenticated_')){
   if(shaBodies.has(v[10]))throw Error('Duplicate complete official PDF SHA not identified as identical alias');
   shaBodies.add(v[10]);verifiedPersons.add(v[2]);
  }else if(v[9]==='exact_pdf_alias')aliases++;
  else if(['source_identity_hold','source_fetch_hold'].includes(v[9]))holds++;
  else throw Error('Unknown source proof kind');
  const t=years[v[1]]??={year:Number(v[1]),versionReferences:0,original:0,amended:0,authenticated:0,holds:0,aliases:0};
  t.versionReferences++;t[v[8]]++;if(v[9].startsWith('authenticated_'))t.authenticated++;else if(v[9]==='exact_pdf_alias')t.aliases++;else t.holds++;
 }
 if(complete.length!==435||shaBodies.size!==416||original!==264||amended!==171
  ||holds!==15||aliases!==4||verifiedPersons.size!==86||principals.size!==90)
  throw Error('Result attempted to overstate actual whole government CFB signed report authenticity/coverage');
 for(const senator of expected){
  const[name,served,terms,,reg,regIdentity]=senator;
  const servedYears=new Set(served.split(',').map(Number));
  for(let y=2021;y<=2025;y++){
   const rs=complete.filter(q=>q[4]===reg&&q[1]===String(y));
   if(rs.some(q=>q[2]!==name))throw Error('CFB government report belongs to different Senate member');
   const district=terms.split(';').find(t=>t.startsWith(y+':'))?.split(':')[1]||'-';
   const original=rs.filter(q=>q[8]==='original').length;
   const authenticated=rs.filter(q=>q[9].startsWith('authenticated_')).length;
   const held=rs.filter(q=>['source_identity_hold','source_fetch_hold'].includes(q[9])).length;
   const alia=rs.filter(q=>q[9]==='exact_pdf_alias').length;
   const types=[...new Set(rs.map(q=>q[5]+':'+q[6]))].sort().join(',')||'-';
   const deadlines=[...new Set(rs.map(q=>q[5]+':'+q[6]+'@'+q[15]))].sort().join(',')||'-';
   const fields=[name,String(y),servedYears.has(y)?'actual_service_overlap':'not_served_in_this_calendar_year',
    district,reg,senator[13],senator[5],String(rs.length),String(original),String(rs.length-original),
    String(authenticated),String(held),String(alia),types,deadlines,
    rs.length?'official_viewer_versions_observed_selected_pdf_panel':'no_selected_official_viewer_version_not_a_nonfiler_finding',
    'UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','unverified',rs.map(q=>q[0]).join(',')||'-'];
   if(fields.some(t=>t.includes('|')||t.includes('\n')))throw Error('Unsafe committee/year source cell');
   reconstructed.push(fields.join('|'));
  }
 }
 if(reconstructed.length!==475||reconstructed.join('\n')+'\n'!==matrix.raw
  ||matrix.rows.some(r=>r[16]!=='UNKNOWN'||r[17]!=='UNKNOWN'||r[18]!=='UNKNOWN'||r[19]!=='UNKNOWN'||r[20]!=='UNKNOWN'||r[21]!=='unverified'))
  throw Error('Official 95-senator 475-year matrix does not prove statutory required filing counts');
 return{schema:SCHEMA,sourceVerifiedOriginalPdfVersions:416,sourceObservedOfficialExactReportVersions:435,
  originalVersionReferences:264,amendedVersionReferences:171,
  sourceDocumentIdentityOrFetchHolds:15,samePdfIndexedAliases:4,
  actualServing2021to25Senators:95,servingSenatorsWithFullOriginalPDFAuth:86,
  CfbSenatorPrincipalsWithExactViewerReportRefs:90,
  personYearSourceMatrixRows:475,
  historicalExactVersionPublicByVerified:0,statutoryReportObligationsUnknown:true,
  noFinancialSummaryTransactionImportOrProductionActions:true,
  sourceOriginal2025DoronShaVerifiedTwice:true,
  yearSummary:Object.values(years).sort((a,b)=>a.year-b.year)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Original source script accepts no override for protected/private database');
 console.log('CFB_864_435_416_86_SENATORS_V28 '+JSON.stringify(audit435FullOriginalReportSources()));
}
