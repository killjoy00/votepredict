/**
 * Public-only exact 30 original LRL minutes PDF verification for #863.
 * Fixed review-set only, bounded network, no Neon, model, writes to corpus,
 * historical-availability inference or member-name publication.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fetchSenateCommitteeMinutePdf} from
  '../src/evidence/minnesota-senate-committee-source.js';
import {parseSenateCommitteeMinuteVotes} from
  '../src/evidence/minnesota-senate-committee-minutes.js';
import {
 SENATE863_ORIGINAL_MARKER,assertSenate863OfficialSourceUrl,
 validateSenate863SourceTargets,analyzeSenate863Original,
 summarizeSenate863OriginalProof,type OfficialSourceTarget863,
} from '../src/evaluation/historical-roster-863-official-minutes-proof.js';

const TARGET_PATH='data/evaluation/historical-roster-863-senate-50-public-source-targets.json';
type Json=Record<string,unknown>;
function loadTargets():OfficialSourceTarget863[]{
 const j=JSON.parse(readFileSync(TARGET_PATH,'utf8')) as Json;
 if(j.schemaVersion!=='historical-roster-863-senate-50-public-source-targets-v1' ||
   j.issue!==863||j.exactProductionReadOnlyRun!==39172012304||
   j.sourceMainSha!=='017805a9ba606496c0a4fc78640293123fc2f699' ||
   j.outcomesUsed!==false||j.voteDataModified!==false||
   j.eventCount!==50||j.uniqueOriginalPdfUrls!==30||
   !Array.isArray(j.targets))throw Error('Frozen 50-event public review scope drift');
 const targets=j.targets as OfficialSourceTarget863[];
 validateSenate863SourceTargets(targets);
 return targets;
}
async function boundedOfficialPdf(url:string) {
 assertSenate863OfficialSourceUrl(url);
 const safeFetch:typeof fetch=async(input,init)=>{
  if(String(input)!==url)throw Error('Unexpected source redirect or destination');
  const response=await fetch(url,{...init,
   redirect:'error',cache:'no-store',
   signal:AbortSignal.timeout(45000),
  });
  if(!response.ok||!response.body||
    Number(response.headers.get('content-length')??0)>3500000)
    throw Error('Original LRL PDF unavailable or too large');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];
  let total=0;
  try{
   for(;;){const {done,value}=await reader.read();if(done)break;
    total+=value.byteLength;
    if(total>3500000)throw Error('Original PDF exceeded byte bound');
    chunks.push(value);
   }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);let off=0;
  for(const c of chunks){bytes.set(c,off);off+=c.byteLength;}
  if(new TextDecoder('latin1').decode(bytes.subarray(0,5))!=='%PDF-')
    throw Error('Official LRL response is not PDF');
  return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
 };
 return fetchSenateCommitteeMinutePdf({url,fetchImpl:safeFetch});
}
async function main(){
 if(process.argv.length!==3||!['--preflight','--run'].includes(process.argv[2]))
  throw Error('Expected --preflight or --run');
 const targets=loadTargets();
 if(process.argv[2]==='--preflight'){
  console.log('SENATE_863_PUBLIC_ORIGINAL_50_SCOPE_OK sources=30 targets=50');
  return;
 }
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  process.env.GITHUB_EVENT_NAME!=='push' ||
  process.env.GITHUB_REF!=='refs/heads/main' ||
  process.env.GITHUB_RUN_ATTEMPT!=='1' ||
  process.env.SENATE863_PUBLIC_MAIN_CI_PASSED!=='true' ||
  process.env.SENATE863_PUBLIC_MARKER_PRESENT!=='true')
   throw Error('Public source job requires exact reviewed main trigger');
 const urls=[...new Set(targets.map(t=>t.sourceUrl))].sort();
 const docResults=new Map<string,Awaited<ReturnType<typeof boundedOfficialPdf>>|null>();
 const docRows:{sourceUrl:string;bytes:number;sha256:string;extractionMethod:string;status:string}[]=[];
 let next=0;
 const workers=Array.from({length:2},async()=>{
  while(next<urls.length){
   const index=next++;const url=urls[index]!;
   try{
    const captured=await boundedOfficialPdf(url);
    if(!/^[a-f0-9]{64}$/.test(captured.contentSha256))
      throw Error('Missing official source hash');
    docResults.set(url,captured);
    docRows.push({sourceUrl:url,bytes:captured.bytes,
     sha256:captured.contentSha256,extractionMethod:captured.extractionMethod,
     status:'verified_pdf'});
   }catch{
    docResults.set(url,null);
    docRows.push({sourceUrl:url,bytes:0,sha256:'',extractionMethod:'none',
     status:'fetch_or_parse_deferred'});
   }
  }
 });
 await Promise.all(workers);
 docRows.sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl));
 const rows=targets.map(t=>{
  const doc=docResults.get(t.sourceUrl);
  const row=analyzeSenate863Original(t,doc?parseSenateCommitteeMinuteVotes(doc.text):[]);
  return doc?row:{...row,originalTallyClass:'source_unavailable_or_unparseable'};
 });
 const report=summarizeSenate863OriginalProof(rows,docRows);
 const output=resolve(process.env.ROSTER863_ORIGINAL_OUTPUT||
   'tmp/roster-863-50-public-originals');
 mkdirSync(output,{recursive:true});
 writeFileSync(resolve(output,'historical-roster-863-50-official-pdf-proof.json'),
  JSON.stringify(report,null,2)+'\n');
 console.log('ROSTER_863_FIFTY_PUBLIC_ORIGINAL_SOURCE_PROOF='+JSON.stringify({
  marker:SENATE863_ORIGINAL_MARKER,documents:docRows.length,
  pdfsAuthenticated:report.sourceFetchSucceeded,
  eventClassifications:report.classificationCounts,
  documentDigestsRecorded:true,originalSourceVersionComparedToStoredDatabase:false,
  frozenPredictionsModified:false,productionDatabaseContacted:false,
  reportDigest:report.contentSha256,
 }));
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-roster-863-fifty-originals.ts'))
 void main().catch(()=>{console.error('ROSTER_863_ORIGINAL_PUBLIC_SOURCE_HOLD');process.exitCode=1});
