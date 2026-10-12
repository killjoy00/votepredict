/**
 * #864 report-VERSION only statewide actual senator source-panel CROSSWALK.
 * This 95-person in-scope service population is NOT a legal filer/report
 * obligation denominator, and unknown panel rows are never treated as proof
 * no campaign finance report exists.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {parseOfficialMnSenateServiceDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';

export const SCHEMA='cfb-864-exact-report-version-95-served-person-source-crosswalk-v14';
export const MARKER='SENATE_864_CFB_95_ACTUALLY_SERVED_REPORT_VERSION_CROSSWALK_V14_20261012';
const PANEL='docs/evaluation/source-proof/cfb-2021-25-served-25-panel-229-exact-version-ledger.psv';
const DIRECTORY='https://www.lrl.mn.gov/legdb/senate_dir';
const SWEARING='https://www.lrl.mn.gov/history/caucus?body=s';
const YEARS=[2021,2022,2023,2024,2025];
const MAX_ORIGINAL_BYTES=4500000;
const knownSha=s=>/^[a-f0-9]{64}$/.test(s);
function publicSourcePanel(){
 const lines=readFileSync(PANEL,'utf8').trimEnd().split('\n');
 if(lines.length!==229)throw Error('Expected 229 source-authenticated original/amended versions');
 const panel=new Map();let actualPublicBy=0;
 for(const line of lines){
  const cols=line.split('|');
  if(cols.length!==22||!knownSha(cols[10])||!knownSha(cols[17]))
   throw Error('Original exact report-version identity/hash shape changed');
  const reg=cols[4],name=cols[2];
  if(!/^\d{4,8}$/.test(reg)||!name||!/^20(2[1-5])$/.test(cols[1]))
   throw Error('Untrusted candidate source-person registration');
  if(cols[19]!=='-')actualPublicBy++;
  if(!panel.has(reg))panel.set(reg,{name,registration:reg,versions:0,
   reportingYears:new Set()});
  const p=panel.get(reg);
  if(p.name!==name)throw Error('Conflicting original official CFB committee identity');
  p.versions++;
  p.reportingYears.add(Number(cols[1]));
 }
 if(panel.size!==25||actualPublicBy!==0)
  throw Error('Source panel changed / historic public-by gate needs independent review');
 return [...panel.values()];
}
/** First-plus-surname key supports ONLY existing separately verified source
 * registrations. A matching name is not an independent committee filing
 * discovery or a 2021–25 day-precise membership proof.
 */
function key(s){
 const arr=String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/)
  .filter(Boolean).filter(x=>!['jr','sr','ii','iii','iv'].includes(x));
 if(arr.length<2)throw Error('Official senator identity too short');
 return arr[0]+'|'+arr.at(-1);
}
export function buildSourceVerifiedSenatorReportCrosswalk(official){
 if(official?.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||official.source?.url!==DIRECTORY
  ||official.supplementalSwearingSource?.url!==SWEARING
  ||!knownSha(official.source.sourceBytesSha256)
  ||!knownSha(official.supplementalSwearingSource.sourceBytesSha256)
  ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false
  ||official.supplementalSwearingSource.websitePublicationDateBackdated!==false
  ||official.senators?.length!==105)
  throw Error('Not the independently evidenced 105-person official LRL service directory');

 const roster=official.senators.filter(person=>
  person.senateServiceTerms.some(t=>YEARS.some(year=>year>=t.startsYear
   &&(t.endsYear===null||year<=t.endsYear))));
 if(roster.length!==95)throw Error('Actual 2021-25 serving original directory population drift');

 const panel=publicSourcePanel(),byNameKey=new Map();
 for(const p of panel){
  const k=key(p.name);
  if(byNameKey.has(k))throw Error('Two previously proven CFB committee principal identities ambiguously matched');
  byNameKey.set(k,p);
 }
 const officialKeys=new Set();
 const usedReg=new Set();
 const rows=[];
 for(const person of roster){
  const k=key(person.officialName);
  if(officialKeys.has(k))throw Error('Two original official senators have same first/surname key');
  officialKeys.add(k);
  const termYears=YEARS.filter(y=>person.senateServiceTerms.some(t=>
   y>=t.startsYear&&(t.endsYear===null||y<=t.endsYear)));
  const districtsByYear=YEARS.map(y=>termYears.includes(y)
   ?y+':'+[...new Set(person.senateServiceTerms.filter(t=>
     y>=t.startsYear&&(t.endsYear===null||y<=t.endsYear))
     .map(t=>t.district))].sort((a,b)=>Number(a)-Number(b)).join(',')
   :null).filter(Boolean).join(';');
  const matched=byNameKey.get(k);
  if(matched)usedReg.add(matched.registration);
  rows.push({
   officialSenator:person.officialName,
   serviceYears:termYears.join(','),
   annualOfficialDistricts:districtsByYear,
   originalServiceSource:person.officialSourceUrl,
   matchedAlreadySourceProvenCFBRegistration:matched?.registration??null,
   existingAuthenticatedSourceVersionReferences:matched?.versions??0,
   originalReportYearsObservedInSelectedSourcePanel:
    matched?[...matched.reportingYears].sort().join(','):null,
   reportVersionCoverageState:matched
    ?'previously_proven_CFb_panel_reg_registration_not_all_report_years'
    :'no_CFB_version_identity_join_yet_not_proof_no_report',
   actualVersionHistoricalPublicByVerified:false,
   noLegalReportFilingDutyConclusion:true,
  });
 }
 if(usedReg.size>25||rows.length!==95)
  throw Error('Invalid original actual-served report-version panel join');
 rows.sort((a,b)=>a.officialSenator.localeCompare(b.officialSenator));
 const priorPanelStillNeedsNameReview=panel
  .filter(p=>!usedReg.has(p.registration))
  .map(p=>({sourceName:p.name,existingRegistration:p.registration,
   currentOfficialLrlNameProofReviewNeeded:true}));
 return{
  schema:SCHEMA,issue:864,
  originalOfficialSenateDirectorySha256:official.source.sourceBytesSha256,
  originalOfficialSpecialSwearingSha256:
   official.supplementalSwearingSource.sourceBytesSha256,
  sourceObservedAtUtc:official.source.observedAt,
  statewideActuallyServed2021to25People:95,
  previouslyProvenCFBReportPanelRegistrationCount:25,
  uniqueSourceJoinedCFBReportRegistrations:usedReg.size,
  sourcePanelsStillNeedingOfficialNameReview:priorPanelStillNeedsNameReview,
  currentPanelVersionReferences:229,
  existingExactPdfHistoricalPublicByVerified:0,
  noReportObligationDenominatorOrAbsenceClaim:true,
  noPrivateDatabaseOrFinancialTransactions:true,
  noForeignOfficeOrNonServingCandidatesInPanel:true,
  nameJoinDoesNotIndependentlyProveCommitteeRegistration:true,
  originalServingTermYearIsNotExactStartOrExitDay:true,
  results:rows,
 };
}
function safeUrl(response,url){
 if(response.url&&response.url!==url)throw Error('Public LRL original redirected');
 if(response.status!==200)throw Error('LRL original not HTTP 200');
}
async function boundedOfficialHtml(response){
 const claimed=response.headers.get('content-length');
 if(claimed!==null){
  const n=Number(claimed);
  if(!Number.isSafeInteger(n)||n<9000||n>MAX_ORIGINAL_BYTES)
   throw Error('Official html source length invalid');
 }
 if(!response.body)throw Error('No official original source stream');
 const parts=[];let length=0,reader=response.body.getReader();
 try{for(;;){
  const {done,value}=await reader.read();if(done)break;
  length+=value.byteLength;
  if(length>MAX_ORIGINAL_BYTES)throw Error('Official source HTML byte cap');
  parts.push(value);
 }}finally{await reader.cancel().catch(()=>undefined)}
 const b=Buffer.alloc(length);let at=0;
 for(const part of parts){Buffer.from(part).copy(b,at);at+=part.byteLength}
 return b;
}
export async function sourceVerified95ServedReportVersionAudit(fetchPublic=fetch){
 const request=async url=>{
  const response=await fetchPublic(url,{
   method:'GET',redirect:'manual',headers:{accept:'text/html'},
   signal:AbortSignal.timeout(30000),
  });
  safeUrl(response,url);
  return boundedOfficialHtml(response);
 };
 try{
  const [directory,swearing]=await Promise.all([
   request(DIRECTORY),request(SWEARING)]);
  const now=new Date().toISOString();
  const audit=parseOfficialMnSenateServiceDirectory(directory,now,swearing,now);
  return{status:'original_official_service_identity_and_CFb_source_panel_crosswalk',
   data:buildSourceVerifiedSenatorReportCrosswalk(audit)};
 }catch{
  return{status:'official_original_service_source_or_join_hold',data:null,
   noAbsenceOrUnregisteredCommitteeInferred:true};
 }
}
async function main(){
 if(process.argv.length!==2)throw Error('No source or roster CLI overrides');
 const receipt=await sourceVerified95ServedReportVersionAudit();
 const safe=JSON.stringify(receipt);
 if(safe.length>80000
  ||/\"(?:donor|contributor|transactionId|privateDatabase|NeonToken|candidateFinanceAmount)\"\s*:/i.test(safe))
  throw Error('Unsafe committee crosswalk publication output');
 console.log('CFB_864_OFFICIAL_95_SENATOR_VERSION_CROSSWALK_V14 '+safe);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 await main();
