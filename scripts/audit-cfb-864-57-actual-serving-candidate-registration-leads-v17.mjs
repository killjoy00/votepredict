/**
 * #864 - selected actual-serving senator candidate-committee identity search,
 * NOT original/amended report-PDF proof, not an owed-report denominator.
 * Permanent government-source selected names/registrations are replayable
 * against the independently authenticated 2026-10-10 CFB original 268-page
 * source archive. No donor/finance rows, raw government HTML or production DB.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const SCHEMA='cfb-864-2021-25-57-serving-senator-cfb-candidate-registrations-v17';
export const SOURCE_PSV='docs/evaluation/source-proof/cfb-2021-25-57-additional-serving-senator-original-candidate-registration-leads-v17.psv';
export const SOURCE_CHECKPOINT='docs/evaluation/source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json';
export const SENATORS='docs/evaluation/source-proof/cfb-2021-25-95-served-senator-38-report-principal-crosswalk-v16.psv';
export const VERIFIED_REPORTS='docs/evaluation/source-proof/cfb-2021-25-38-served-principal-255-exact-report-version-ledger-v16.psv';
export const ORIGINAL_ARTIFACT='artifacts/official-268/cfb-senate-district-registrations.json';
const SHA=/^[a-f0-9]{64}$/;
const years=[2020,2022,2024,2026];
const SOURCE_ENDPOINT='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/districts-constitutional-offices/Senate/';
const PREFIX='CFB_864_57_OFFICIAL_SENATE_REGISTRATION_V17 ';
export const KNOWN_FIRST_NAME_FORMS=Object.freeze([
 ['Bill G. Ingebrigtsen','16311','Ingebrigtsen, William (Bill) G'],
 ['Gregory D. Clausen','17441','Clausen, Greg'],
 ['Jeff R. Howe','18337','Howe, Jeffrey R'],
 ['Jim Carlson','16246','Carlson, James'],
 ['Matt D. Klein','17924','Klein, Matthew D']
]);
const sha=s=>createHash('sha256').update(s).digest('hex');
const words=text=>String(text).normalize('NFKD')
 .replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/[^a-z0-9 ]/g,' ').trim().split(/\s+/)
 .filter(x=>x&&x!=='sr'&&x!=='jr'&&x!=='ii'&&x!=='iii'&&x!=='iv');
export function originalOfficialMemberNameKey(name){
 const w=words(name);return w.length>=2?w[0]+'|'+w.at(-1):null;
}
export function originalCfbCandidateLabelNameKey(label){
 const parts=String(label).split(',');if(parts.length!==2)return null;
 const s=words(parts[0]),f=words(parts[1]);
 return s.length&&f.length?f[0]+'|'+s.at(-1):null;
}
function allCurrentSourceRows(){
 const entries=readFileSync(SENATORS,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 if(entries.length!==95||entries.some(x=>x.length!==10))throw Error('LRL actual 95 serving-person source mismatch');
 const names=new Set(),registrations=new Set();
 for(const row of entries){
  if(names.has(row[0]))throw Error('Duplicate original LRL serving person');
  names.add(row[0]);
  if(row[4]!=='-'){
   if(!/^\d{4,8}$/.test(row[4])||registrations.has(row[4]))
    throw Error('Original 38 candidate committee source identities inconsistent');
   registrations.add(row[4]);
  }
 }
 if(registrations.size!==38)throw Error('Exactly 38 original already-PDF-proved committee identities required');
 return{rows:entries,registered:registrations};
}
export function sourceObservedDistrictsFromService(row){
 const segments=String(row[2]).split(';'),nums=new Set();
 for(const s of segments){
  const m=/^20(?:2[1-5]):(\d{1,2}(?:,\d{1,2})*)$/.exec(s);
  if(!m)throw Error('Government senator term-year district source invalid');
  for(const district of m[1].split(',')){
   const n=Number(district);if(n<1||n>67)throw Error('Government senator district out of range');
   nums.add(n);
  }
 }
 return nums;
}
export function parsePermanent57RegistrationLeadPsv(s=readFileSync(SOURCE_PSV,'utf8')){
 if(sha(s)!=='959b45dc978fc5ef962aba788d74caa76ce1ae474b69847ab21fec1934c9c0b2')
  throw Error('Original 57 serving-senator CFB candidate registration source metadata SHA256 drift');
 if(!s.endsWith('\n'))throw Error('Source ledger must retain exact LF final newline');
 const rows=s.trimEnd().split('\n').map(x=>x.split('|'));
 if(rows.length!==57||rows.some(x=>x.length!==8))throw Error('Expected 57 source-observed Senate person leads');
 const names=new Set(),regs=new Set(),counts={EXACT:0,ALIAS_HOLD:0};
 for(const r of rows){
  const [name,reg,label,status,segment,district,pageSha,segments]=r;
  if(!name||names.has(name)||regs.has(reg)||!/^\d{4,8}$/.test(reg)
   ||!label||!['EXACT','ALIAS_HOLD'].includes(status)
   ||!years.includes(Number(segment))||!Number.isInteger(Number(district))
   ||Number(district)<1||Number(district)>67||!SHA.test(pageSha)
   ||!/^20(?:20|22|24|26)(?:,20(?:20|22|24|26))*$/.test(segments))
   throw Error('Original 57 government CFB registration source identity malformed or duplicated');
  const seg=segments.split(',').map(Number);
  if(seg[0]!==Number(segment)||new Set(seg).size!==seg.length
   ||seg.some((x,i)=>i&&seg[i-1]>=x))throw Error('CFB source election-viewer segment not unique or earliest');
  const direct=originalOfficialMemberNameKey(name)===originalCfbCandidateLabelNameKey(label);
  const held=KNOWN_FIRST_NAME_FORMS.some(([n,rid,c])=>name===n&&reg===rid&&label===c);
  if(status==='EXACT'&&!direct||status==='ALIAS_HOLD'&&(!held||direct))
   throw Error('Unsupported government CFB first-name equivalence');
  names.add(name);regs.add(reg);counts[status]++;
 }
 if(counts.EXACT!==52||counts.ALIAS_HOLD!==5)throw Error('52 exact-name proofs / 5 aliases awaiting separate original proof');
 return rows.map(([name,reg,label,status,segment,district,pageSha,segments])=>({
  officialSenator:name,committeeRegistrationLead:reg,originalCfbCandidateLabel:label,
  identityStatus:status,earliestOriginalViewerSegment:Number(segment),
  originalCandidatePageDistrict:Number(district),
  originalCandidatePageSha256:pageSha,
  originalCandidatePageUrl:SOURCE_ENDPOINT+district+'/'+segment,
  observedCandidateViewerSegments:segments.split(',').map(Number)
 }));
}
export function verifyPinned57AgainstOriginalSourceCheckpoint(){
 const checkpoint=JSON.parse(readFileSync(SOURCE_CHECKPOINT,'utf8'));
 const p=checkpoint.provenance,index=checkpoint.observedCandidateRegistrationIndex;
 if(p?.runId!==38081628130||p.artifactId!==11680891630
  ||p.rawJsonSha256!=='83770615658f7cf47802b05257bcbd45bed0c7c41ec19dfe99c31ca91b746c04'
  ||p.rawJsonBytes!==264296||p.zipSha256!=='fe85e6d3e4ae64d24d3153ae23b976267769cea8e57400e8008f2daffbace5a1'
  ||checkpoint.sourceCoverage?.pagesAcquiredAndParsed!==268
  ||index?.distinctRegistrations!==494)
   throw Error('Independent official source archive original acquisition checkpoint drift');
 const all=index.registrationIdsCsv.split(',');
 const masks=index.segmentMembershipMaskHex;
 if(all.length!==494||masks.length!==494||new Set(all).size!==494
  ||index.bitBySegment['2020']!==1||index.bitBySegment['2022']!==2
  ||index.bitBySegment['2024']!==4||index.bitBySegment['2026']!==8)
   throw Error('Original 268-page source registration membership index changed');
 const map=new Map(all.map((reg,i)=>[reg,Number.parseInt(masks[i],16)]));
 const{rows,registered}=allCurrentSourceRows(),existing=new Set(rows.filter(x=>x[4]==='-').map(x=>x[0]));
 if(existing.size!==57)throw Error('Source-verified 95 minus 38 original PDF principals is not 57');
 const lead=parsePermanent57RegistrationLeadPsv();
 if(lead.length!==57)throw Error('Expected 57 CFB report-version registration leads');
 for(const l of lead){
  const original=rows.find(x=>x[0]===l.officialSenator);
  if(!existing.has(l.officialSenator)||!original
   ||registered.has(l.committeeRegistrationLead)
   ||!sourceObservedDistrictsFromService(original).has(l.originalCandidatePageDistrict))
    throw Error('Proposed CFB registration is not in actual serving member original district-years');
  const sourceMask=map.get(l.committeeRegistrationLead);
  if(sourceMask===undefined
   ||l.observedCandidateViewerSegments.some(y=>
      !(sourceMask&index.bitBySegment[String(y)])))
    throw Error('Candidate principal absent from originally authenticated election-segment source registry');
 }
 if(new Set(lead.map(r=>r.committeeRegistrationLead)).size!==57)
  throw Error('Original candidate source ID not unique across 57 serving people');
 return{
  schema:SCHEMA,sourceAcquisitionRun:38081628130,
  sourceArchiveOriginalJsonSha256:p.rawJsonSha256,
  sourceArchiveOriginalBytes:p.rawJsonBytes,
  permanentLeadSourcePsvSha256:sha(readFileSync(SOURCE_PSV,'utf8')),
  servingSenators:95,preexistingReportPdfVersionPrincipals:38,
  additionalCandidateRegistrationSourceLeads:57,
  exactOfficialCfbPersonNameMatches:52,
  originalFirstNameAliasIdentityHolds:5,
  possible95PersonRegistrationLeadsLocated:true,
  actuallyNewAuthenticatedReportPdfBodies:0,
  proofNoReportExistsForAnyPerson:false,
  legalReportFilingDutyDenominator:null,
  historicalExactReportPdfPublicByCount:0,
  noBulkTransactionOrOldEligibilityWork:true,
  noProductionReadsOrWrites:true
 };
}
export function replay57AgainstEntireOriginal268PageBody(buffer){
 const check=verifyPinned57AgainstOriginalSourceCheckpoint();
 if(buffer.byteLength!==check.sourceArchiveOriginalBytes
  ||sha(buffer)!==check.sourceArchiveOriginalJsonSha256)
  throw Error('Exact original entire 268 page government source JSON bytes SHA256 mismatch');
 const original=JSON.parse(buffer.toString('utf8'));
 if(original.schemaVersion!=='cfb-senate-district-registration-observed-v1'
  ||original.observations?.length!==268
  ||original.capturedAt!=='2026-10-10T19:56:34.348Z')
  throw Error('CFB source original full 268 page structure drift');
 const{nameRows,rows}=(()=>{
  const p=allCurrentSourceRows().rows;
  return{rows:p,nameRows:new Map(p.map(r=>[r[0],r]))};
 })();
 const pinned=parsePermanent57RegistrationLeadPsv();
 for(const lead of pinned){
  const actual=rows.find(x=>x[0]===lead.officialSenator);
  if(!actual)throw Error('Original actual serving Senate member source identity disappeared');
  const termDistricts=sourceObservedDistrictsFromService(actual);
  const matched=[];
  for(const o of original.observations){
   if(!termDistricts.has(o.district)
    ||o.status!=='candidate_labels_observed')continue;
   const candidate=(o.candidates??[]).filter(x=>{
    if(lead.identityStatus==='EXACT')
     return originalCfbCandidateLabelNameKey(x.candidateDisplayName)===
      originalOfficialMemberNameKey(lead.officialSenator);
    return x.registrationNumber===lead.committeeRegistrationLead
     &&x.candidateDisplayName===lead.originalCfbCandidateLabel;
   });
   matched.push(...candidate.map(c=>({o,c})));
  }
  if(!matched.length||new Set(matched.map(v=>v.c.registrationNumber)).size!==1
   ||matched.some(v=>v.c.registrationNumber!==lead.committeeRegistrationLead
    ||v.c.candidateDisplayName!==lead.originalCfbCandidateLabel))
   throw Error('Original source no longer uniquely attests exact candidate committee identity');
  const sorted=matched.sort((a,b)=>a.o.segmentEndYear-b.o.segmentEndYear
   ||a.o.district-b.o.district);
  const first=sorted[0];
  if(first.o.htmlSha256!==lead.originalCandidatePageSha256
   ||first.o.segmentEndYear!==lead.earliestOriginalViewerSegment
   ||first.o.district!==lead.originalCandidatePageDistrict
   ||first.o.sourceUrl!==lead.originalCandidatePageUrl
   ||sorted.some(x=>x.o.malformedCandidateLabels!==0))
    throw Error('Original CFB full source first candidate page/hash/office district differs');
  const segments=[...new Set(sorted.map(x=>x.o.segmentEndYear))].sort();
  if(segments.join(',')!==lead.observedCandidateViewerSegments.join(','))
   throw Error('Original CFB source repeated election segment evidence altered');
 }
 return{...check,entireOriginal268GovernmentPagesIndependentlyReplayed:true,
  selectedOriginalSourceLabelsAndPageHashesReverified:57};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2&&
  !(process.argv.length===4&&process.argv[2]==='--original-source'
   &&process.argv[3]===ORIGINAL_ARTIFACT))
  throw Error('Only fixed read-only CFB original archive artifact path accepted');
 const result=process.argv.length===4
  ?replay57AgainstEntireOriginal268PageBody(readFileSync(ORIGINAL_ARTIFACT))
  :verifyPinned57AgainstOriginalSourceCheckpoint();
 console.log(PREFIX+JSON.stringify(result));
}
