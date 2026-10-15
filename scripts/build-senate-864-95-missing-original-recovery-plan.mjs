/** #864: reproducible PUBLIC source plan for V2's 72 original-page gaps.
 * This script never connects to Neon or promotes quotes into forecast evidence.
 * References are pinned public research receipts; ZIP bytes are NOT inferred.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {SOURCE_LEDGER_FILES,canonicalKey,extractAuthenticatedPageLeads,assertManifest}
 from '../src/evidence/senate-864-95-historical-source-neon-parity.mjs';
const MANIFEST='data/evaluation/senate-864-95-served-historical-candidate-research-manifest-v1.json';
export const OUT='artifacts/senate-864-95-72-original-pages-acquisition-plan-v1.json';
export const V2_RECEIPT='https://github.com/killjoy00/votepredict/issues/864#issuecomment-6197764255';
export const MISSING=Object.freeze(Object.fromEntries([
 ['Alice Mann',3],['Bill G. Ingebrigtsen',1],['Bill Weber',1],['Bobby Joe Champion',4],
 ['Bruce Douglas Anderson',1],['Carrie L. Ruud',1],['D. Scott Dibble',4],
 ['David H. Senjem',4],['Doron Clark',1],['Eric R. Pratt',1],
 ['Erin K. Maye Quade',1],['Gary H. Dahms',2],['Gene Dornink',3],
 ['Jason Isaacson',2],['Jeff R. Howe',1],['Jennifer A McEwen',1],
 ['Jeremy R. Miller',1],['Jim Carlson',1],['Julie A. Rosen',1],
 ['Justin D. Eichorn',2],['Kent Eken',4],['Mark T. Johnson',1],
 ['Mary K. Kunesh',3],['Mary Kiffmeyer',2],['Melissa Halvorson Wiklund',4],
 ['Michael E. Kreun',1],['Omar Fateh',4],['Rich Draheim',4],
 ['Roger C. Chamberlain',2],['Sandra L. Pappas',4],['Scott J. Newman',1],
 ['Steve A. Cwodzinski',2],['Steve Drazkowski',2],['Susan Pha',2]
 ].map(([n,count])=>[canonicalKey(n),count])));
const URL_KEYS=['sourceOriginalUrl','archivedOriginalSiteUrl','originalUrl','originalURL','originalPageUrl','originalSiteUrl','url'];
const HASH_KEYS=['actualOriginalHtmlSha256','originalHtmlSha256','originalHTMLSHA256',
 'originalFullHtmlSHA256','originalRawHtmlSha256','fullHtmlSha256','originalBodySha256',
 'htmlSha256','sourceSHA256','sha256','sha'];
const PERSON_KEYS=['officialSenateDirectoryName','officialSenatorName','person','senator',
 'servingSenator','attributedTo'];
const FILE_KEYS=['originalSourceFile','originalHtmlFilename','originalHtmlFile','originalFile',
 'originalRawHtmlFile','rawHtmlFile','htmlFile','file','originalRawCompleteHTMLFile',
 'originalRawHTMLFile','originalFullHTMLFile','originalHtmlFileName'];
const CDX_KEYS=['originalCdxIndexedSha1Base32','originalCdxSHA1Base32','originalCdxSha1Base32',
 'archiveOriginalCdxDigestSha1Base32','independentlyIndexedCdxPayloadSha1Base32',
 'originalArchiveCdxSha1Base32','independentOriginalCDXSHA1Base32',
 'independentIndexedCdxPayloadSha1Base32','originalIndexedSha1Base32',
 'originalHistoricalCdxIndexBase32Sha1','originalCdxDigestSha1Base32',
 'independentOriginalCdxDigestSha1Base32','cdxSha1Base32','cdxSha1','cdxSHA1',
 'sha1','digest'];
const CDX_FILE_KEYS=['sourceIndexFile','sourceWindowCdxFile','indexFile',
 'completeOriginalCdxFilename','independentOriginalFullCDXFile',
 'originalCdxFile','sourceCdxFile','cdxFile'];
const DATE_KEYS=['originalCampaignSiteCaptureAtUtc','originalArchiveCaptureAtUtc',
 'archiveCapturedAtUtc','actualArchiveCaptureUtc','archivedOriginalCapturedAtUtc',
 'archiveCapturePublicByUTC','archiveCaptureUTC','archiveCaptureUtc',
 'archivePublicByUtc','archivePublicByUTC','archiveCapturedAtUtc',
 'archiveCapturedAt','archiveCapturedUTC','historicOriginalArchivedUTC',
 'originalCapturedAtUtc','captureUtc','capturedAtUtc','observedUTC',
 'observedUtc','publicByUtc','capture','observed','captureTime','captureAtUtc'];
const DIRECT_PAGE_KEYS=new Set([
 'pages','year2022OriginalPages','originalAuthenticatedPageReceipts',
 'fullOriginalArchivedSourceReceipts','fullOriginalPageSHAReceipts',
 'fullOriginalPageReceipts','fullOriginalArchivedPageReceipts','sourcePages',
 'originalCandidateIssueSourcePages','candidateOwnedOriginalIssueSourceSections',
 'originalFullPageSourceReceipts','originalFullHTMLReceipts','originalFullPageReceipts','originalPageReceipts',
 'verifiedOriginals','originals'
].map(k=>k.toLowerCase()));
function value(obj,keys){
 const lower=new Map(Object.entries(obj||{}).map(([k,v])=>[k.toLowerCase(),v]));
 for(const key of keys){
  const v=lower.get(key.toLowerCase());
  if(typeof v==='string'&&v.trim())return v.trim();
 }
 return null;
}
function simpleName(value){
 if(typeof value!=='string'||value.length>255||value.includes('/')||value.includes('\\')
  ||value==='.'||value==='..'||/[\r\n\x00-\x1f]/.test(value))return null;
 return value;
}
function date(value){
 if(typeof value!=='string')return null;
 if(/^\d{14}$/.test(value)){
  const t=value;
  value=t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8)+'T'
   +t.slice(8,10)+':'+t.slice(10,12)+':'+t.slice(12)+'Z';
 }
 if(!/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|\+00:00)$/.test(value))return null;
 const ms=Date.parse(value);
 return Number.isFinite(ms)&&ms<=Date.parse('2026-10-15T00:00:00Z')&&ms>0
  ?new Date(ms).toISOString():null;
}
function candidateArtifacts(doc,record,captureUtc){
 const directKeys=['sourceArchiveArtifactId','originalArchiveArtifactId',
  'originalSourceArtifactId','originalCandidateSiteArtifactId'];
 for(const k of directKeys){
  const n=Number(record[k]);
  if(Number.isSafeInteger(n)&&n>=10000000)return {artifactId:n,reason:'source_page_explicit'};
 }
 const options=[];
 for(const group of [doc.provenance,doc.source,doc.sources,doc.scope]){
  if(!group||typeof group!=='object'||Array.isArray(group))continue;
  for(const [k,v] of Object.entries(group)){
   const n=Number(v);
   if(!Number.isSafeInteger(n)||n<10000000||n>9999999999)continue;
   if(!/artifact/i.test(k)||/government|official|sos|lrl|report|outcome/i.test(k))continue;
   if(!/original|acquisit|candidate|first.?party|archive|site|html|source20\d\d/i.test(k))continue;
   if(/source2020/i.test(k)&&captureUtc&&!captureUtc.startsWith('2020-'))continue;
   if(/source2022/i.test(k)&&captureUtc&&!captureUtc.startsWith('2022-'))continue;
   options.push(n);
  }
 }
 const ids=[...new Set(options)];
 return ids.length===1?{artifactId:ids[0],reason:'unique_research_source_artifact'}:
  {artifactId:null,reason:ids.length?'ambiguous_source_artifact':'source_artifact_not_pinned'};
}
function possibleDetails(doc,obj){
 const captureUtc=date(value(obj,DATE_KEYS));
 const digest=value(obj,CDX_KEYS);
 const archiveIndexedSha1=/^[A-Z2-7]{32}$/.test(digest||'')?digest:null;
 const sourceFile=simpleName(value(obj,FILE_KEYS));
 const cdxFile=simpleName(value(obj,CDX_FILE_KEYS));
 const artifact=candidateArtifacts(doc,obj,captureUtc);
 return {captureUtc,archiveIndexedSha1,sourceFile,cdxFile,
  sourceArtifactId:artifact.artifactId,sourceArtifactResolution:artifact.reason};
}
function planState(w){
 if(!w.captureUtc)return 'HOLD_CAPTURE_DATE';
 if(!w.archiveIndexedSha1)return 'HOLD_CDX_SHA1';
 if(!w.sourceFile||!w.sourceFile.toLowerCase().endsWith('.html'))return 'HOLD_ORIGINAL_HTML_FILE';
 if(!w.sourceArtifactId)return 'HOLD_SOURCE_ARTIFACT';
 return 'READY_FOR_INDEPENDENT_BYTE_VERIFICATION';
}
export function buildRecoveryPlan(read=readFileSync){
 const manifest=assertManifest(JSON.parse(read(MANIFEST,'utf8')));
 const files=new Map(SOURCE_LEDGER_FILES.map(p=>[p,JSON.parse(read(p,'utf8'))]));
 const research=extractAuthenticatedPageLeads(manifest,files);
 const cohort=manifest.people.map((p,i)=>({ordinal:i+1,officialName:p.officialName,
  count:MISSING[canonicalKey(p.officialName)]??0,research:research.pages[i]}))
  .filter(p=>p.count>0);
 if(cohort.length!==34||cohort.reduce((n,p)=>n+p.count,0)!==72
  ||cohort.some(p=>p.research.length!==p.count))
  throw Error('V2 34-person / 72-page wholly-unmatched gap no longer stable');
 const receipts=new Map();
 for(const [path,doc] of files){
  for(const [section,arr] of Object.entries(doc)){
   if(!DIRECT_PAGE_KEYS.has(section.toLowerCase())||!Array.isArray(arr))continue;
   for(const obj of arr){
    if(!obj||typeof obj!=='object'||Array.isArray(obj)
     ||['candidateOwnedPoliticalAttributionAllowed','candidateOwnedOriginalSite',
      'originalCandidateWebsiteTextDirectlyProvenAsOfCapture','candidateOwnedSite']
     .some(flag=>obj[flag]===false))continue;
    const url=value(obj,URL_KEYS),sha=value(obj,HASH_KEYS),name=value(obj,PERSON_KEYS);
    const key=canonicalKey(name);
    if(!key||!url||!sha||!/^[a-f0-9]{64}$/i.test(sha)
      ||!/^https?:\/\/[^/\s]+/.test(url))continue;
    const identity=key+'|'+url+'|'+sha.toLowerCase();
    const row={ledgerPath:path,ledgerSection:section,...possibleDetails(doc,obj)};
    const prev=receipts.get(identity)||[];
    prev.push(row);receipts.set(identity,prev);
   }
  }
 }
 const witnesses=[];
 for(const person of cohort){
  for(let i=0;i<person.research.length;i++){
   const source=person.research[i];
   const ref=canonicalKey(person.officialName)+'|'+source.url+'|'+source.sha;
   const candidates=receipts.get(ref)||[];
   if(!candidates.length)throw Error('Pinned original page missing in fixed authenticated ledgers');
   const variants=candidates.map(row=>({...row,readiness:planState(row)}));
   variants.sort((a,b)=>Number(b.readiness==='READY_FOR_INDEPENDENT_BYTE_VERIFICATION')
     -Number(a.readiness==='READY_FOR_INDEPENDENT_BYTE_VERIFICATION')
     ||Number(!!b.cdxFile)-Number(!!a.cdxFile)
     ||a.ledgerPath.localeCompare(b.ledgerPath));
   const chosen=variants[0];
   const conflicts=variants.filter(x=>x.captureUtc&&chosen.captureUtc
     &&x.captureUtc!==chosen.captureUtc);
   const recoveryState=conflicts.length?'HOLD_CONFLICTING_RESEARCH_CAPTURE':chosen.readiness;
   witnesses.push({
    senatorOrdinal:person.ordinal,pageOrdinalWithinSenator:i+1,
    officialName:person.officialName,originalUrl:source.url,originalHtmlSha256:source.sha,
    originalArchiveCapturedAtUtc:chosen.captureUtc,
    originalArchiveCdxSha1Base32:chosen.archiveIndexedSha1,
    originalHtmlArtifactFile:chosen.sourceFile,
    originalCdxIndexArtifactFile:chosen.cdxFile,
    historicalSourceArtifactId:chosen.sourceArtifactId,
    originalResearchLedgerPath:chosen.ledgerPath,
    recoveryState
   });
  }
 }
 if(witnesses.length!==72||new Set(witnesses.map(w=>w.senatorOrdinal+'|'+w.originalUrl+'|'+w.originalHtmlSha256)).size!==72)
  throw Error('Historical 72-page original recovery scope inconsistent');
 const stateCounts=Object.fromEntries([...new Set(witnesses.map(w=>w.recoveryState))]
  .sort().map(k=>[k,witnesses.filter(x=>x.recoveryState===k).length]));
 const report={
  schema:'senate-864-95-72-original-historical-page-acquisition-plan-v1',
  previousV2Receipt:V2_RECEIPT,sourceResearchLedgerCount:29,cohortPersons:34,
  previouslyUnmatchedPageWitnesses:72,automaticallyTrustedBytes:0,
  sourceArtifactsNotYetDownloadedOrVerified:true,
  historicalArchiveCaptureDateNotFirstPublicationDate:true,
  exactResearchQuotesNotIndependentlyReverifiedByThisPlan:true,
  productionDatabaseWrites:0,forecastFeaturePromotions:0,
  recoveryStates:stateCounts,witnesses
 };
 if(JSON.stringify(report).length>120000)throw Error('Unbounded public source plan');
 return report;
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/build-senate-864-95-missing-original-recovery-plan.mjs')){
 try{
  if(process.argv.length!==2)throw Error('No CLI selectors allowed');
  const plan=buildRecoveryPlan();
  mkdirSync('artifacts',{recursive:true});
  writeFileSync(OUT,JSON.stringify(plan,null,2)+'\n');
  console.log('SENATE_864_72_PUBLIC_ARCHIVE_ACQUISITION_PLAN='+JSON.stringify({
   persons:plan.cohortPersons,pages:plan.witnesses.length,recoveryStates:plan.recoveryStates,
   containsOriginalHtmlBytes:false,productionWrites:0
  }));
 }catch{console.error('SENATE_864_72_ORIGINAL_ARCHIVE_PLAN_FAIL_CLOSED');process.exitCode=1}
}
