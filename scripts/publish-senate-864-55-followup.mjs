/** Publish only SHA-validated public original review material to a new review branch. No database credentials. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const env=process.env,repo='killjoy00/votepredict',base=env.GITHUB_SHA,run=env.GITHUB_RUN_ID,root='artifacts/senate864-55-followup/';
if(env.GITHUB_REPOSITORY!==repo||env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_REF!=='refs/heads/main'||!/^[a-f0-9]{40}$/.test(base||'')||!/^\d+$/.test(run||''))throw Error('Publisher scope changed');
const sha=b=>createHash('sha256').update(b).digest('hex'),raw=readFileSync(root+'manifest.json'),m=JSON.parse(raw);
const pair=m.schemaVersion==='senate864-structured-pair-review-v1',expected=pair?2:58;
if(!pair&&m.schemaVersion!=='senate864-55-followup-review-v1')throw Error('Unknown source review schema');
if(m.reviewedCommit!==base||m.runId!==run||m.sourceOnly!==true||m.productionWrites!==0||m.originalsAuthenticated!==expected||m.remainingOcrOriginals!==(pair?0:55)||m.demonstratedParserMissOriginals!==(pair?2:3)||m.sources.length!==expected||m.renderedReview!=='pending'||m.pages<expected||m.pages>expected*40)throw Error('Same-run source review bounds changed');
const registry=readFileSync('docs/evaluation/source-proof/senate-864-population-original-registry-20261023-renewal-ocr.json');
if(sha(registry)!=='7fe7842dfcbf56d9c55200fc01034321af6a067cb921daac52aee29506e95acc')throw Error('Frozen registry drift');
const registered=JSON.parse(registry);
if(new Set(m.sources.map(d=>d.sourceId)).size!==expected||m.registrySha256!==sha(registry))throw Error('Unique source/registry proof drift');
for(const d of m.sources){const known=registered.find(x=>x.sourceId===d.sourceId);if(!known||['sourceUrl','originalSha256','date','committee'].some(k=>known[k]!==d[k]))throw Error('Source identity drift');}
if(pair&&m.sources.some(d=>!['b09b0b455312903eaa01defd0167b7bcf6fda405807352f2ff6739b1d59509f5','38c8be767d77dada704fac695980816414f9a5b13cc4aa9091abc9fc09a556d5'].includes(d.sourceId)))throw Error('Structured pair scope drift');
const paths=new Set(m.files.map(f=>f.path));if(paths.size!==m.files.length||paths.size>5000)throw Error('File scope changed');
let bytes=raw.length;
const entries=[{path:'manifest.json',data:raw}];
for(const f of m.files){
 if(!/^(?:[a-f0-9]{64}\/(?:source\.json|page-\d+\.(?:json|jpg))|clerk-probes\.json)$/.test(f.path)||f.bytes>4000000)throw Error('Unreviewed output path/size');
 const data=readFileSync(root+f.path);bytes+=data.length;
 if(data.length!==f.bytes||sha(data)!==f.sha256)throw Error('Output file hash drift');
 if(f.path.endsWith('.json'))JSON.parse(data);
 entries.push({path:f.path,data});
}
if(bytes>70000000)throw Error('Public source review byte bound');
for(const d of m.sources){
 if(!d.originalBytesAuthenticated||!paths.has(d.sourceId+'/source.json')||d.pages.length!==d.pageCount)throw Error('Original source incomplete');
 for(const p of d.pages){
  const prefix=d.sourceId+'/page-'+p.page;
  if(!paths.has(prefix+'.json')||!paths.has(prefix+'.jpg'))throw Error('Page evidence incomplete');
  const page=JSON.parse(readFileSync(root+prefix+'.json'));
  if(sha(readFileSync(root+prefix+'.jpg'))!==page.reviewImageSha256||page.raw300dpiPageSha256!==p.raw300dpiPageSha256)throw Error('Raster evidence drift');
 }
}
async function api(path,method='GET',body){
 const r=await fetch('https://api.github.com/repos/'+repo+path,{method,headers:{authorization:'Bearer '+env.GH_TOKEN,accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error('Public source publisher HTTP '+r.status);return r.json();
}
const c=await api('/git/commits/'+base),tree=[];
for(const e of entries){
 const blob=await api('/git/blobs','POST',{content:e.data.toString('base64'),encoding:'base64'});
 tree.push({path:'docs/evaluation/source-proof/senate-864-55-followup-review/'+e.path,mode:'100644',type:'blob',sha:blob.sha});
}
const t=await api('/git/trees','POST',{base_tree:c.tree.sha,tree}),commit=await api('/git/commits','POST',{message:'Preserve public SHA-pinned 55-original OCR follow-up and three parser-miss review materials',tree:t.sha,parents:[base]});
const branch=(pair?'work/864-structured-cell-review-':'work/864-55-source-review-')+run;await api('/git/refs','POST',{ref:'refs/heads/'+branch,sha:commit.sha});
console.log('SENATE864_PUBLIC_SOURCE_REVIEW='+JSON.stringify({branch,commit:commit.sha,parent:base,run,files:entries.length,originals:expected,pages:m.pages,renderedReview:'pending',productionWrites:0}));
