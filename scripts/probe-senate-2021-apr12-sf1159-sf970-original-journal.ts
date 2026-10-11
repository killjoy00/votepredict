/** Original large April12 2021 daily Senate Journal; discovery, not vote import. */
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {APR12_2021_RULE1210,discoverOriginalApril12Rule1210Leads} from '../src/evidence/senate-2021-apr12-rule1210-sf1159-sf970-lead-probe.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const MAX=15_000_000;
async function bounded(input:string|URL|Request,init?:RequestInit):Promise<Response>{
 const url=input instanceof Request?input.url:String(input);
 if(url!==APR12_2021_RULE1210.originalURL)
  throw Error('April12 original source URL not allowlisted');
 const res=await fetch(url,{...init,redirect:'manual'});
 if(res.status!==200||res.url!==url||!/^application\/pdf\b/i.test(res.headers.get('content-type')??''))
  throw Error('Original April12 PDF status, MIME or redirect mismatch');
 const header=res.headers.get('content-length');
 if(header!==null&&(!Number.isSafeInteger(Number(header))||
     Number(header)<300||Number(header)>MAX))
  throw Error('Original April12 PDF declared size is invalid');
 const reader=res.body?.getReader();if(!reader)throw Error('PDF body stream unavailable');
 const chunks:Uint8Array[]=[];let n=0;
 try{
  for(;;){
   const item=await reader.read();if(item.done)break;
   n+=item.value.byteLength;
   if(n>MAX){await reader.cancel();throw Error('Original PDF streaming byte limit exceeded')}
   chunks.push(item.value);
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(n);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 if(n<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
  throw Error('Not original PDF signature');
 return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Expected --output PATH');
 const out=resolve(args[1]);
 let original:Awaited<ReturnType<typeof fetchSenateCommitteeMinutePdf>>|null=null;
 let discovery:ReturnType<typeof discoverOriginalApril12Rule1210Leads>|null=null;
 const errors:string[]=[];
 try{
  original=await fetchSenateCommitteeMinutePdf({
   url:APR12_2021_RULE1210.originalURL,fetchImpl:bounded as typeof fetch
  });
  if(original.extractionMethod!=='embedded_text')
   throw Error('Cannot obtain embedded text from original 2021 daily journal');
  discovery=discoverOriginalApril12Rule1210Leads(original.text);
 }catch(e){
  errors.push(String(e instanceof Error?e.message:e)
   .replace(/https?:\/\/\S+/gi,'[original Senate Journal URL]').slice(0,220));
 }
 const report={
  schemaVersion:'senate-2021-apr12-sf1159-sf970-original-source-probe-v1',
  issue:864,
  sourceOfficialURL:APR12_2021_RULE1210.originalURL,
  journalReportDate:'2021-04-12',
  originalPdfReceived:original!==null,originalPdfBytes:original?.bytes??null,
  originalPdfSHA256:original?.contentSha256??null,
  originalEmbeddedTextSHA256:original?sha(original.text):null,
  originalSourceLeadDiscovery:discovery,
  errorCount:errors.length,errors,
  originalBinaryAcquiredNotEquivalentToNamedVoteCertification:true,
  allProvisionalMemberSHARequireSecondPass:true,
  noHistoricalMemberSidesOrFullPDFCommitted:true,
  noMemberVoteImportOrFloorOrModelChanges:true,
  noActualCommitteeMeetingDateOrFirstPublicByInferred:true,
  issue864RemainsOpen:true
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({originalPdfFetched:original!==null,
  originalSourceLeadPassagesFound:discovery?.committeeLeads.filter(x=>x.motionContextValid).length??0,
  noNamedRollCertified:true,errors:errors.length}));
 if(errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(String(e).slice(0,220));process.exitCode=1});
