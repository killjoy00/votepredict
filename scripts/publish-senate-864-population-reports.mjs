/** Publish fixed public reports to a new review branch. No Neon credentials. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const env=process.env,repo='killjoy00/votepredict',base=env.GITHUB_SHA,run=env.GITHUB_RUN_ID;
if(env.GITHUB_REPOSITORY!==repo||env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_REF!=='refs/heads/main'||!/^\d+$/.test(run||'')||!/^[a-f0-9]{40}$/.test(base||''))throw Error('Publisher scope changed');
const names=['senate-864-population-original-registry-20261023-explicit-labels.json','senate-864-population-original-inventory-20261023-explicit-labels.json','senate-864-population-summary-20261023-explicit-labels.json','senate-864-population-committee-before-20261023-explicit-labels.csv','senate-864-population-committee-after-20261023-explicit-labels.csv'];
const files=names.map(name=>{const text=readFileSync('public-reports/'+name,'utf8');
 if(text.length<10||text.length>15000000||/postgres(?:ql)?:\/\/|\.neon\.tech|gh[pousr]_[A-Za-z0-9]{20,}|"(?:(?:membership|vote_event|source_document|session|chamber|bill)_id|password|apiKey)"\s*:|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text))throw Error('Non-public data in fixed report');
 return {name,text};
});
const summary=JSON.parse(files.find(f=>f.name==='senate-864-population-summary-20261023-explicit-labels.json').text);
if(summary.reviewedCommit!==base||summary.runId!==run||summary.productionWrites!==0||summary.originals!==2860||summary.readOnlyRepeatableReadAndExplicitRollback!==true)throw Error('Same-run public receipt identity changed');
const inventory=JSON.parse(files[1].text);
if(JSON.parse(files[0].text).length!==2860||inventory.originals.length!==2860)throw Error('Population report truncated');
const named=inventory.originals.filter(d=>d.status==='named_candidate_original');
if(named.length!==summary.namedCandidateOriginals||named.some(d=>!d.candidateOriginalExtractedText||createHash('sha256').update(d.candidateOriginalExtractedText).digest('hex')!==d.extractedTextSha256))throw Error('Named-candidate complete original text missing or SHA drift');
async function api(path,method='GET',body){
 const r=await fetch('https://api.github.com/repos/'+repo+path,{method,headers:{authorization:'Bearer '+env.GH_TOKEN,accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error('Public review-branch publisher HTTP '+r.status);return r.json();
}
const commit=await api('/git/commits/'+base),tree=[];
for(const f of files){const blob=await api('/git/blobs','POST',{content:f.text,encoding:'utf-8'});tree.push({path:'docs/evaluation/source-proof/'+f.name,mode:'100644',type:'blob',sha:blob.sha});}
const t=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree}),c=await api('/git/commits','POST',{message:'Record public population inventory and paired committee readback for issue 864',tree:t.sha,parents:[base]});
const branch='work/864-population-results-'+run;await api('/git/refs','POST',{ref:'refs/heads/'+branch,sha:c.sha});
console.log('SENATE864_PUBLIC_REPORT_BRANCH='+JSON.stringify({branch,commit:c.sha,parent:base,run,files:names,productionWrites:0}));
