/**
 * Issue #864. Read-only one-original Rules 2023-01-24 source re-fetch.
 * Download PDF bytes from LRL, require exact earlier independently proven
 * whole-original SHA; then inspect the two source-printed named choices
 * with source text only in memory. Never print original names/text/digests
 * of member choices or access a database. No legacy positional event replay.
 */
import {createHash} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fetchSenateCommitteeMinutePdf} from
 '../src/evidence/minnesota-senate-committee-source.js';
import {inspect2023RulesJanuary24OriginalNamedRolls,
 RULES_2023_JAN24_ORIGINAL} from
 '../src/evidence/senate-864-2023-rules-jan24-original-rolls.js';
const expected=RULES_2023_JAN24_ORIGINAL;
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
async function rehydrateSource(){
 const url=expected.sourceUrl;
 const u=new URL(url);
 if(u.protocol!=='https:'||u.hostname!=='www.lrl.mn.gov'||u.username||u.password||
  u.search||u.hash||
  u.pathname!=='/archive/minutes/senate/2023/rules/20230124/Rules_20230124_Minutes.pdf')
  throw Error('Official original file/source URL identity altered');
 const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(40_000),
  headers:{Accept:'application/pdf'}});
 if(response.status!==200||!response.body||response.url!==url||
  Number(response.headers.get('content-length')??0)>8_000_000)
  throw Error('Official original PDF unavailable or outside bounds');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];
 let size=0;
 try{for(;;){
  const x=await reader.read();if(x.done)break;
  size+=x.value.byteLength;
  if(size>8_000_000)throw Error('Original PDF raw byte cap exceeded');
  chunks.push(x.value);
 }}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 if(size<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-'||
  sha(bytes)!==expected.originalPdfSha256)
  throw Error('Original 2023 Rules independent raw source SHA mismatch');
 return fetchSenateCommitteeMinutePdf({
  url,fetchImpl:(async()=>
   new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}})) as typeof fetch
 });
}
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==2||a[0]!=='--output'||!a[1]||a[1]!.startsWith('-'))
  throw Error('Explicit only --output source-only receipt');
 const result=await rehydrateSource();
 if(result.contentSha256!==expected.originalPdfSha256)
  throw Error('Original PDF extractor did not preserve SHA');
 const audit=inspect2023RulesJanuary24OriginalNamedRolls({
  text:result.text,hearingDate:expected.hearingDate,
  committeeName:expected.committeeName,originalPdfSha256:result.contentSha256
 });
 const extra={
  ...audit,sourcePdfRawByteShaReverifiedThisRun:true,
  sourceTextReadOnlyInProcessMemory:true,extractionMethod:result.extractionMethod,
  originalSourceBytes:result.bytes,
  historicMemberNameVoteChoicesNotExported:true,
  deployedProductionDatabaseRowParityNotMeasured:true
 };
 const body=JSON.stringify(extra,null,2)+'\n';
 if(body.length>3500||/postgresql:|membershipId|choiceIdentitySha256|sourceName|sourceText|member_votes:/i.test(body))
  throw Error('No private original source member details may be serialized');
 const output=resolve(a[1]);mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,body);
 console.log('SENATE_864_RULES_2023_JAN24_ORIGINAL_NAMED_ROLLS='+JSON.stringify({
  officialYear:2023,originalPdfShaVerified:true,
  originalMotionCount:audit.originalSourceOfficialMotionCount,
  namesValidatedMotionCount:audit.originalNamedRollCandidatesVerified,
  sourcePrintedNamedChoiceOccurrences:audit.exactNamedChoicesSourceVerified,
  printedNamedVoteGrammarStatus:audit.status,noDataWrites:true
 }));
 if(audit.status!=='named_lists_exact_and_uniquely_counted')process.exitCode=1;
}
void main().catch(()=>{
 console.error('SENATE_864_RULES_2023_JAN24_SOURCE_PROOF_HOLD=original_sha_text_or_named_grammar');
 process.exitCode=1;
});
