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
  OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,
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
  const sworn=await fetch(OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,{
    method:'GET',redirect:'manual',signal:AbortSignal.timeout(18000),
    headers:{accept:'text/html','user-agent':'VotePredict/2.0 issue-864-public-Senate-service-audit'},
  });
  if(sworn.status!==200||new URL(sworn.url).hostname!=='www.lrl.mn.gov'
    ||!/text\/html/i.test(sworn.headers.get('content-type')??''))
    throw Error('Official LRL Senate swearing source unavailable/redirected');
  const swornBody=Buffer.from(await sworn.arrayBuffer());
  if(swornBody.byteLength<9000||swornBody.byteLength>5*1024*1024)
    throw Error('Original public LRL special-election swearing page exceeds source bounds');
  const swornObservedAt=new Date().toISOString();
  const report=parseOfficialMnSenateServiceDirectory(
    html,observedAt,swornBody,swornObservedAt);
  writeFileSync(join(root,'mn-lrl-official-senate-service-directory.html'),
    html,{flag:'wx',mode:0o600});
  writeFileSync(join(root,'mn-lrl-official-senate-special-swearing-history.html'),
    swornBody,{flag:'wx',mode:0o600});
  writeFileSync(join(root,'mn-lrl-official-senate-service-directory-audit.json'),
    JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('SENATOR-SERVICE-DIRECTORY '+JSON.stringify({
    sourceUrl:report.source.url,
    observedAt:report.source.observedAt,
    sourceBodySha256:report.source.sourceBytesSha256,
    sourceBytesLength:report.source.sourceBytesLength,
    independentlyDocumentedEverServedSenators:report.senators.length,
    officialSwearingSourceSha256:report.supplementalSwearingSource?.sourceBytesSha256??null,
    specialSwearingOriginalBytesObservedAt:report.supplementalSwearingSource?.observedAt??null,
    pre2026CampaignEvidenceCertified:false,
    resultIsOnlySenatorServiceNotCandidateFiling:true,
  }));
}
main().catch((error:unknown)=>{
  // Official public HTML parsing errors are safe to report with no secrets,
  // so reviewers can distinguish a real source access failure from a parser mismatch.
  const message=error instanceof Error?error.message.slice(0,220):'unknown_public_fetch_or_parser_error';
  console.error('SENATOR-SERVICE-DIRECTORY-FAILED '+JSON.stringify({
    kind:'unverified_official_senate_service_source',reason:message,
    candidateNamesReleased:false,personRecordsAdmitted:0,
  }));
  process.exitCode=1;
});
