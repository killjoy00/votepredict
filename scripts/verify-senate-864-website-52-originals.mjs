/** Reopen four exact historical bodies and independent CDX indexes before credentials. */
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {execFileSync} from 'node:child_process';
import {expansionInputs,ADDITIONAL_ORIGINALS,verifyAddedLiterals} from '../src/evidence/senate-864-website-expansion.mjs';
import {verifyWitnessBytes,VERIFIED} from './verify-senate-864-72-original-artifact-bytes.mjs';
export async function verify52Originals(){
 const inputs=expansionInputs(),temp=mkdtempSync(join(tmpdir(),'senate864-52-'));
 if(process.env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||!process.env.GH_TOKEN)throw Error('Same repository read token required');
 const cache=new Map();
 try{
  for(const id of new Set(ADDITIONAL_ORIGINALS.map(p=>p.artifact))){
   const r=await fetch('https://api.github.com/repos/killjoy00/votepredict/actions/artifacts/'+id+'/zip',{headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(45000)});
   if(!r.ok||Number(r.headers.get('content-length'))>25000000)throw Error('Pinned source unavailable');
   const b=Buffer.from(await r.arrayBuffer());if(b.length>25000000||b[0]!==80||b[1]!==75)throw Error('Invalid source archive');
   const zip=join(temp,id+'.zip');writeFileSync(zip,b,{mode:0o600});
   const names=execFileSync('unzip',['-Z1',zip],{maxBuffer:300000,timeout:8000}).toString().trim().split('\n');
   if(names.length>2000||names.some(n=>n.startsWith('/')||n.includes('..')||n.includes('\\')))throw Error('Unsafe archive');
   const read=name=>execFileSync('unzip',['-p',zip,name],{maxBuffer:3000000,timeout:10000});
   const indexes=[];
   for(const name of names.filter(n=>/\.json$/i.test(n)&&/cdx|index/i.test(basename(n))).slice(0,120)){
    try{indexes.push(JSON.parse(read(name)))}catch{/* Unrelated JSON is not index proof. */}
   }
   cache.set(id,{names,read,indexes});
  }
  let verified=0;
  for(const pin of ADDITIONAL_ORIGINALS){
   const a=cache.get(pin.artifact),matches=a.names.filter(n=>basename(n)===pin.file);
   if(matches.length!==1)throw Error('Exact original file unavailable');
   const person=inputs.manifest.people.findIndex(p=>p.officialName===pin.ordinalName)+1;
   const groups=new Map();for(const r of inputs.added.filter(r=>r.ordinal===person)){const k=r.sourceSha;groups.set(k,[...(groups.get(k)||[]),r]);}
   const bytes=a.read(matches[0]);let matched=false;
   for(const rows of groups.values()){
    const p=rows[0],w={recoveryState:'READY_FOR_INDEPENDENT_BYTE_VERIFICATION',originalHtmlSha256:p.sourceSha,originalArchiveCdxSha1Base32:p.originalCdxSha1,originalUrl:p.sourceUrl,originalArchiveCapturedAtUtc:p.archiveCapturedAt};
    if(verifyWitnessBytes(w,bytes,a.indexes)===VERIFIED){
     if(!verifyAddedLiterals(bytes,rows))throw Error('Literal excerpt absent from original visible text');
     verified+=rows.length;matched=true;break;
    }
   }
   if(!matched)throw Error('Exact body/capture/digest original proof unavailable');
  }
  if(verified!==52)throw Error('Incomplete literal source verification');
  const receipt={originalBodies:4,sourceArtifacts:3,exactLiteralExcerpts:52,sha256Sha1AndIndependentCdx:true,observationNotAuthorship:true,sourcePlanSha256:inputs.sourcePlanSha256};
  console.log('SENATE864_WEBSITE52_ORIGINALS='+JSON.stringify(receipt));return receipt;
 }finally{rmSync(temp,{recursive:true,force:true})}
}
if(process.argv[1]?.endsWith('/verify-senate-864-website-52-originals.mjs'))verify52Originals().catch(()=>{console.error('SENATE864_WEBSITE52_ORIGINAL_SOURCE_HOLD');process.exitCode=1});
