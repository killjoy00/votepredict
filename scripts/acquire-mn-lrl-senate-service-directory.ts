/**
 * #864 public one-shot retrieval of Minnesota Legislative Reference Library
 * SENATE SERVICE directory. A post-election ballot winner alone does not prove
 * that an individual was ever sworn in. This source resolves that distinction.
 *
 * Stores full original public HTML and SHA256, with actual retrieved-at date.
 * No credentials, candidate opponents, database, forecasts or remote writes.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {
  OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
  parseOfficialMnSenateServiceDirectory,
} from '../src/evidence/senate-official-ever-served-directory.js';
async function main(){
  const i=process.argv.indexOf('--output-dir');
  if(i<0||!process.argv[i+1]||process.argv.length!==4)
    throw Error('Provide --output-dir UNIQUE_NEW_DIRECTORY');
  const root=resolve(process.argv[i+1]);
  mkdirSync(root,{mode:0o700,recursive:false});
  const response=await fetch(OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,{
    method:'GET',redirect:'manual',signal:AbortSignal.timeout(18000),
    headers:{accept:'text/html','user-agent':'VotePredict/2.0 issue-864-public-Senate-service-audit'},
  });
  if(response.status!==200||new URL(response.url).hostname!=='www.lrl.mn.gov'
    ||!/text\/html/i.test(response.headers.get('content-type')??''))
    throw Error('Minnesota LRL official Senate directory unavailable or redirected');
  const size=response.headers.get('content-length');
  if(size&&Number(size)>5*1024*1024)throw Error('Official Senate service HTML too large');
  if(!response.body)throw Error('No Senate directory HTML response body');
  const reader=response.body.getReader();const pieces:Uint8Array[]=[];let count=0;
  while(true){
    const r=await reader.read();
    if(r.done)break;
    count+=r.value.length;
    if(count>5*1024*1024){await reader.cancel();throw Error('LRL page oversized');}
    pieces.push(r.value);
  }
  const html=Buffer.concat(pieces.map(x=>Buffer.from(x)),count);
  const observedAt=new Date().toISOString();
  const report=parseOfficialMnSenateServiceDirectory(html,observedAt);
  writeFileSync(join(root,'mn-lrl-official-senate-service-directory.html'),
    html,{flag:'wx',mode:0o600});
  writeFileSync(join(root,'mn-lrl-official-senate-service-directory-audit.json'),
    JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('SENATOR-SERVICE-DIRECTORY '+JSON.stringify({
    sourceUrl:report.source.url,
    observedAt:report.source.observedAt,
    sourceBodySha256:report.source.sourceBytesSha256,
    sourceBytesLength:report.source.sourceBytesLength,
    independentlyDocumentedEverServedSenators:report.senators.length,
    pre2026CampaignEvidenceCertified:false,
    resultIsOnlySenatorServiceNotCandidateFiling:true,
  }));
}
main().catch(()=>{
  console.error('Source retrieval/parser failed: NO senator identity automatically promoted');
  process.exitCode=1;
});
