/** #864: re-open original archived GitHub source ZIPs and validate exact RAW
 * HTML bytes against both independent research SHA256 and Wayback CDX SHA1,
 * plus the same exact capture/original URL from source CDX indexes.
 * NO Neon, production writes, model signals, private query rows or scraped live sites.
 */
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildRecoveryPlan} from './build-senate-864-95-missing-original-recovery-plan.mjs';
import {siteParts} from '../src/evidence/senate-864-95-original-archive-url-diagnostics.mjs';
export const OUT='artifacts/senate-864-95-72-original-pages-byte-verification-v1.json';
const HTTP_STATUS=new Set(['200']);
const VALID_INDEXED=new Set(['text/html','application/xhtml+xml']);
export const VERIFIED='VERIFIED_ORIGINAL_BYTES_SHA256_SHA1_AND_CDX_INDEX';
const MAX_PER_ZIP=25000000,MAX_HTML_BYTES=3000000;
function safeCount(n,max){return Number.isSafeInteger(n)&&n>=0&&n<=max;}
export function sha1Base32(bytes){
 const hash=createHash('sha1').update(bytes).digest();
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
 let bit=0,carry=0,out='';
 for(const octet of hash){
  carry=(carry<<8)|octet;bit+=8;
  while(bit>=5){bit-=5;out+=alphabet[(carry>>bit)&31];}
  carry&=(1<<bit)-1;
 }
 if(bit)out+=alphabet[(carry<<(5-bit))&31];
 return out;
}
export function sameOriginalSite(a,b){
 const x=siteParts(a),y=siteParts(b);
 return x!==null&&y!==null&&!x.archived&&!y.archived&&x.key===y.key;
}
export function exactOriginalCdxRow(payload,{originalUrl,archiveDate,digest}){
 if(!Array.isArray(payload)||!Array.isArray(payload[0]))return false;
 const header=payload[0].map(String);
 const index=new Map(header.map((v,i)=>[v.toLowerCase(),i]));
 for(const key of ['timestamp','original','digest','statuscode','mimetype'])
  if(!index.has(key))return false;
 const stamp=String(archiveDate).replace(/\D/g,'').slice(0,14);
 if(!/^\d{14}$/.test(stamp))return false;
 for(const row of payload.slice(1)){
  if(!Array.isArray(row))continue;
  const get=k=>String(row[index.get(k)]??'');
  if(get('timestamp')===stamp&&get('digest')===digest
   &&HTTP_STATUS.has(get('statuscode'))
   &&VALID_INDEXED.has(get('mimetype').toLowerCase())
   &&sameOriginalSite(get('original'),originalUrl))return true;
 }
 return false;
}
export function verifyWitnessBytes(witness,html,cdxIndexes){
 if(!witness||witness.recoveryState!=='READY_FOR_INDEPENDENT_BYTE_VERIFICATION')
  return 'HOLD_MISSING_PINNED_SOURCE_PROVENANCE';
 if(!Buffer.isBuffer(html)||!html.length||html.length>MAX_HTML_BYTES)
  return 'HOLD_ORIGINAL_HTML_NOT_READABLE';
 const actualSha=createHash('sha256').update(html).digest('hex');
 if(actualSha!==witness.originalHtmlSha256)
  return 'HOLD_ORIGINAL_HTML_SHA256_MISMATCH';
 if(sha1Base32(html)!==witness.originalArchiveCdxSha1Base32)
  return 'HOLD_INDEXED_WAYBACK_PAYLOAD_SHA1_MISMATCH';
 if(!Array.isArray(cdxIndexes)||!cdxIndexes.some(obj=>exactOriginalCdxRow(obj,{
  originalUrl:witness.originalUrl,archiveDate:witness.originalArchiveCapturedAtUtc,
  digest:witness.originalArchiveCdxSha1Base32
 })))
  return 'HOLD_NO_EXACT_ARCHIVE_DATE_URL_AND_DIGEST_IN_CDX_INDEX';
 return VERIFIED;
}
function selectedZipName(archiveFile,entries){
 if(typeof archiveFile!=='string'||archiveFile.includes('/')||archiveFile.includes('\\')
  ||!archiveFile.endsWith('.html')&& !archiveFile.endsWith('.json'))return null;
 const matches=entries.filter(x=>basename(x)===archiveFile && !x.includes('..'));
 return matches.length===1?matches[0]:null;
}
function zipEntries(zip){
 const names=execFileSync('unzip',['-Z1',zip],{timeout:8000,maxBuffer:300000}).toString().trim();
 const entries=names.split('\n').filter(Boolean);
 if(entries.length>2000||entries.some(x=>x.startsWith('/')||x.includes('..')||x.includes('\\')))
  throw Error('Invalid historical ZIP path inventory');
 return entries;
}
function zipEntry(zip,entry,maxBytes){
 const b=execFileSync('unzip',['-p',zip,entry],{timeout:10000,maxBuffer:maxBytes+4096});
 return b.length<=maxBytes?b:null;
}
async function downloadArtifact(id,token){
 if(!safeCount(id,99999999999999)||id<10000000)return null;
 let r;
 try{r=await fetch('https://api.github.com/repos/killjoy00/votepredict/actions/artifacts/'+id+'/zip',{
  headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28'},
  signal:AbortSignal.timeout(45000)
 });}catch{return null;}
 if(!r.ok)return null;
 const n=Number(r.headers.get('content-length')||'0');
 if(n>MAX_PER_ZIP)return null;
 try{
  const bytes=Buffer.from(await r.arrayBuffer());
  if(bytes.length<24||bytes.length>MAX_PER_ZIP||bytes[0]!==80||bytes[1]!==75)return null;
  return bytes;
 }catch{return null;}
}
export async function verify72ArtifactProvenance({token,repository,output=true}={}){
 if(repository!=='killjoy00/votepredict'||typeof token!=='string'||token.length<20)
  throw Error('GitHub same-repository read token is required for independently indexed original bytes');
 const plan=buildRecoveryPlan(),witnesses=plan.witnesses;
 if(witnesses.length!==72)throw Error('V2 original witness set changed');
 const ids=[...new Set(witnesses.filter(w=>
  w.recoveryState==='READY_FOR_INDEPENDENT_BYTE_VERIFICATION'
 ).flatMap(w=>[w.historicalSourceArtifactId,w.independentCdxArtifactId])
 .filter(id=>Number.isSafeInteger(id)&&id>=10000000))];
 if(ids.length>50)throw Error('Unbounded historical source artifact reads');
 const temp=mkdtempSync(join(tmpdir(),'vp-864-72-source-'));
 const cache=new Map();
 try{
  for(const id of ids){
   const bytes=await downloadArtifact(id,token);
   if(!bytes){cache.set(id,null);continue;}
   const zip=join(temp,'historical-'+id+'.zip');
   writeFileSync(zip,bytes,{mode:0o600});
   try{cache.set(id,{zip,entries:zipEntries(zip)});}catch{cache.set(id,null)}
  }
  const results=[];
  for(const w of witnesses){
   let status=w.recoveryState;
   if(status==='READY_FOR_INDEPENDENT_BYTE_VERIFICATION'){
    const archive=cache.get(w.historicalSourceArtifactId);
    if(!archive)status='HOLD_PINNED_SOURCE_ARTIFACT_UNAVAILABLE';
    else {
     const entry=selectedZipName(w.originalHtmlArtifactFile,archive.entries);
     if(!entry)status='HOLD_PINNED_ORIGINAL_HTML_FILE_UNAVAILABLE';
     else {
      try{
       const html=zipEntry(archive.zip,entry,MAX_HTML_BYTES);
       const cdx=[];
       // Some independent original CDX indexes were preserved as a separate
       // historical GitHub artifact. Never infer that the HTML artifact itself
       // is a sufficient independent Wayback index.
       const indexArchives=[archive,cache.get(w.independentCdxArtifactId)]
        .filter((a,i,arr)=>a&&arr.indexOf(a)===i);
       for(const indexArchive of indexArchives){
        const files=indexArchive.entries.filter(name=>/\.json$/i.test(name)
         &&/cdx|index/i.test(basename(name))).slice(0,120);
        for(const file of files){
         try{
          const json=zipEntry(indexArchive.zip,file,3000000);
          if(json)cdx.push(JSON.parse(json.toString('utf8')));
         }catch{/* Invalid/unrelated index never establishes a proof. */}
        }
       }
       status=verifyWitnessBytes(w,html,cdx);
      }catch{status='HOLD_HISTORICAL_ARCHIVE_ZIP_READ_ERROR'}
     }
    }
   }
   results.push({
    senatorOrdinal:w.senatorOrdinal,pageOrdinalWithinSenator:w.pageOrdinalWithinSenator,
    originalUrl:w.originalUrl,originalHtmlSha256:w.originalHtmlSha256,
    originalArchiveCapturedAtUtc:w.originalArchiveCapturedAtUtc,
    originalResearchLedgerPath:w.originalResearchLedgerPath,
    originalHtmlArtifactFile:w.originalHtmlArtifactFile,
    historicalSourceArtifactId:w.historicalSourceArtifactId,
    independentCdxArtifactId:w.independentCdxArtifactId,status
   });
  }
  const statuses=Object.fromEntries([...new Set(results.map(x=>x.status))].sort()
   .map(s=>[s,results.filter(x=>x.status===s).length]));
  if(results.length!==72||Object.values(statuses).reduce((n,x)=>n+x,0)!==72)
   throw Error('Incomplete original-byte verification');
  const report={schema:'senate-864-95-72-historic-original-html-cdx-verified-v1',
   senators:34,originalPages:72,originalArchiveArtifactsDownloaded:ids.filter(i=>cache.get(i)).length,
   selectedSourceArtifactIds:ids.length,statuses,results,
   readOnlyOriginalPublicSourceArtifactVerification:true,neonWrites:0,
   noProductionForecastOrSourcePromotion:true,
   proofOfFirstAuthorPublicationDate:false,
   originalBodiesStoredInArtifactOnlyNotExported:true
  };
  if(JSON.stringify(report).length>100000)throw Error('Unbounded public proof report');
  if(output)writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
  console.log('SENATE_864_72_VERIFIED_ORIGINAL_SOURCE_BYTES='+JSON.stringify({
   inspected:72,sourceArtifactsDownloaded:report.originalArchiveArtifactsDownloaded,
   strongOriginalIndexedProofs:statuses[VERIFIED]||0,
   held:72-(statuses[VERIFIED]||0),statusBuckets:statuses,noDatabaseChanges:true
  }));
  return report;
 }finally{rmSync(temp,{recursive:true,force:true})}
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/verify-senate-864-72-original-artifact-bytes.mjs')){
 verify72ArtifactProvenance({
  token:process.env.GH_TOKEN,
  repository:process.env.GITHUB_REPOSITORY
 }).catch(()=>{console.error('SENATE_864_72_ARCHIVE_PROOF_FAIL_CLOSED_NO_DB_CHANGES');process.exitCode=1});
}
