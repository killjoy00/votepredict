/**
 * #864 independent PUBLIC ONLY LRL HTTP/HTML original source diagnostic.
 * No Neon, tokens, person names, private source URLs or PDF text. A failed
 * source retrieval is a HOLD and must not trigger protected SQL.
 */
import {createHash} from 'node:crypto';
import {parseOfficialMnSenateServiceDirectory,
 OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL as URL_STRING} from
 '../src/evidence/senate-official-ever-served-directory.js';
const MAX=5*1024*1024;
async function main(){
 let phase='network';let status:number|null=null;let hostnameOk=false;
 let pathOk=false,htmlType=false,bytes=0;
 try{
  const res=await fetch(URL_STRING,{
   redirect:'manual',signal:AbortSignal.timeout(18_000),
   headers:{accept:'text/html',
    'user-agent':'VotePredict/2.0 issue-864-public-Senate-service-audit'},
  });
  status=res.status;
  phase='original_url_and_response';
  const effective=new URL(res.url);
  hostnameOk=effective.protocol==='https:'&&effective.hostname==='www.lrl.mn.gov';
  pathOk=effective.pathname.toLowerCase().replace(/\/$/,'')==='/legdb/senate_dir'&&
   !effective.search&&!effective.hash;
  htmlType=/text\/html/i.test(res.headers.get('content-type')??'');
  if(status!==200||!hostnameOk||!pathOk||!htmlType)
   throw Error('HTTP_SCOPE');
  const advertised=res.headers.get('content-length');
  if(advertised&&(!/^[0-9]+$/.test(advertised)||Number(advertised)>MAX))
   throw Error('BYTE_SIZE');
  phase='bounded_original_html';
  const reader=res.body?.getReader();
  if(!reader)throw Error('NO_BODY');
  const chunks:Uint8Array[]=[];
  try{
   for(;;){
    const part=await reader.read();if(part.done)break;
    bytes+=part.value.byteLength;
    if(bytes>MAX)throw Error('BYTE_SIZE');
    chunks.push(part.value);
   }
  }finally{reader.releaseLock()}
  if(bytes<9_000)throw Error('BYTE_SIZE');
  const original=Buffer.concat(chunks,bytes);
  phase='original_official_parser';
  const source=parseOfficialMnSenateServiceDirectory(original,new Date().toISOString());
  const year2024=source.senators.filter(x=>x.senateServiceTerms.some(t=>
   t.startsYear<=2024&&(t.endsYear===null||t.endsYear>=2024)));
  phase='year2024_service_census';
  if(year2024.length<67||year2024.length>90||
   new Set(year2024.map(x=>x.officialName)).size!==year2024.length)
   throw Error('YEAR_CENSUS');
  console.log('SENATE_864_LRL_2024_PUBLIC_ORIGINAL_PROBE='+JSON.stringify({
   schemaVersion:'senate-864-lrl-2024-public-original-probe-v12',
   sourceStatus:'ORIGINAL_SHA_VERIFIED',
   observedDirectoryPublishedIn2024IndependentlyProven:false,
   year2024ServiceNotExactHearingDate:true,
   bytes,
   originalSha256:createHash('sha256').update(original).digest('hex'),
   year2024NamedSenateServiceCount:year2024.length,
   noNameOrSourceBodyPublished:true,noDatabaseAccess:true,
  }));
 }catch{
  console.error('SENATE_864_LRL_2024_PUBLIC_ORIGINAL_HOLD='+JSON.stringify({
   schemaVersion:'senate-864-lrl-2024-public-original-probe-v12',
   safeFailurePhase:phase,
   originalHttpStatus:status,officialHostnameAndHttps:hostnameOk,
   exactOfficialOriginalPath:pathOk,contentTypeHtml:htmlType,
   bytesReadBounded:bytes<=MAX,
   noSenatorNameOrDataPublished:true,noDatabaseAccess:true,
   year2024SourcePersonServiceNotCertified:true,
  }));
  process.exitCode=1;
 }
}
void main();
