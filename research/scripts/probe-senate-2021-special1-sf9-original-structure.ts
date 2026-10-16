/** Fail-closed metadata-only diagnostic for authentic PDF text STRUCTURE.
 * Original historical member identities are redacted before output; this
 * is a forensic source-shape probe, NOT a successful named roll verification.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fetchSenateCommitteeMinutePdf} from '../../src/evidence/minnesota-senate-committee-source.js';
import {MN_ORIGINAL_RULE1210_THREE} from '../evidence/senate-2021-22-rule1210-three-original-journal-rolls.js';
const SOURCE=MN_ORIGINAL_RULE1210_THREE.sf9ss1;

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const max=3_000_000;
async function bounded(input:string|URL|Request,init?:RequestInit):Promise<Response>{
 const url=input instanceof Request?input.url:String(input);
 if(url!==SOURCE.url)throw Error('Not allowlisted exact official original');
 const r=await fetch(url,{...init,redirect:'manual'});
 if(r.status!==200||r.url!==url||!/^application\/pdf\b/i.test(r.headers.get('content-type')??''))
  throw Error('Original source HTTP/MIME/redirect failed');
 const length=r.headers.get('content-length');
 if(length!==null&&(!Number.isSafeInteger(Number(length))||Number(length)<300||Number(length)>max))
  throw Error('Original source length header invalid');
 const reader=r.body?.getReader();if(!reader)throw Error('Source stream missing');
 const chunks:Uint8Array[]=[];let n=0;
 try{
  for(;;){
   const part=await reader.read();if(part.done)break;
   n+=part.value.byteLength;
   if(n>max){await reader.cancel();throw Error('Source exceeds PDF size cap')}
   chunks.push(part.value);
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(n);let k=0;
 for(const c of chunks){bytes.set(c,k);k+=c.byteLength}
 if(n<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
  throw Error('Invalid PDF signature');
 return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}
function structure(input:string){
 const flat=input.replace(/\u0000/g,' ').replace(/\s+/g,' ').trim();
 const motion=/Pursuant\s+to\s+Rule\s+12\.10,\s+upon\s+the\s+request\s+of\s+three\s+members,\s+a\s+roll\s+call\s+was\s+taken\s+on\s+the\s+second\s+portion\s+of\s+the\s+Marty\s+division\s+of\s+the\s+Pratt\s+amendment\s+to\s+S\.F\.\s+No\.\s+9\./ig;
 const matches=[...flat.matchAll(motion)];
 if(matches.length!==1||matches[0]!.index===undefined)
  throw Error('Exact source Rule12.10 committee motion missing/duplicated');
 const pos=matches[0]!.index!+matches[0]![0].length;
 const after=flat.slice(pos,pos+900);
 const allow=new Set([
 'There','were','yeas','and','nays','as','follows','Those','who','voted','in',
 'the','affirmative','negative','Senator','Senators','The','amendment','adopted',
 'JOURNAL','OF','SENATE','DAY','ST','MONDAY','MARCH','of','PAGE'
 ]);
 const redacted=after.slice(0,720)
  .replace(/\b[A-Za-z][A-Za-z'-]*\b/g,x=>allow.has(x)?x:'[REDACTED]');
 return {
  originalMotionOffset:matches[0]!.index,
  originalMotionSHA256:sha(matches[0]![0]),
  next720OriginalTextSHA256:sha(after.slice(0,720)),
  hasExactCount:/^\s*There\s+were\s+yeas\s+6\s+and\s+nays\s+4,\s+as\s+follows:/i.test(after),
  affirmativeLabel:/Those\s+who\s+voted\s+in\s+the\s+affirmative\s+were:/i.test(after),
  negativeLabel:/Those\s+who\s+voted\s+in\s+the\s+negative\s+were:/i.test(after),
  senateHeader156:/156\s*JOURNAL\s+OF\s+THE\s+SENATE\s*\[?\s*7TH\s+DAY/i.test(after),
  senateHeader157:/7TH\s+DAY\s*\]?\s*MONDAY,\s*JUNE\s+21,\s+2021\s*157/i.test(after),
  hasPrintedOutcome:/The\s+amendment\s+was\s+adopted\./i.test(after),
  first720TokensWithNamesRedacted:redacted,
  probeDoesNotAuthenticateIndividualNames:true
 };
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Expected --output file');
 const original=await fetchSenateCommitteeMinutePdf({
  url:SOURCE.url,fetchImpl:bounded as typeof fetch
 });
 if(original.extractionMethod!=='embedded_text')throw Error('Original embedded text missing');
 const probe=structure(original.text);
 const report={
  schemaVersion:'2021-special-sf9-rule1210-original-text-redacted-forensic-v1',
  originalOfficialPDFURL:SOURCE.url,originalPdfBytes:original.bytes,
  originalPdfSHA256:original.contentSha256,
  originalTextSHA256:sha(original.text),trace:probe,
  namesInDiagnosticRedacted:true,notSuccessfulNamedVoteAuthentication:true,
  preserveOriginalFailedRuns:[38168831620],
  noOriginalFileOrMemberNamesCommitted:true,
  noProductionOrPrivateDBAccess:true,issue864RemainsOpen:true
 };
 const out=resolve(args[1]);mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({sourceAcquired:true,redactedTrace:true,certified:false}));
}
main().catch(e=>{console.error(String(e instanceof Error?e.message:e).slice(0,200));process.exitCode=1});
