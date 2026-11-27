import {createHash} from 'node:crypto';
import {OLD_SESSIONS,OLD_TARGETS,OLD_VOTE_LIMITS,confirmHistoricalIndex,selectHistoricalBills,verifyHistoricalTarget,pickHistoricalNamedVotes} from '../src/evidence/2027-incoming-historical-vote-pilot.js';
import {buildHouseVoteDetailUrl,parseHouseVoteDetailHtml} from '../src/sources/minnesota/house-votes.js';
import {buildLrlSessionSearchUrl} from '../src/sources/minnesota/lrl-members.js';
const INDEX='https://www.house.mn.gov/Votes',API=INDEX+'/GetVoteSummary';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const allowed=new Set([INDEX,API,...OLD_SESSIONS.map(buildLrlSessionSearchUrl),...OLD_TARGETS.map(t=>'https://www.lrl.mn.gov/legdb/fulldetail?ID='+t.lrlId)]);
const started=Date.now();let requests=0,bytes=0;
async function fetchOriginal(url:string,post?:string){
  if(!allowed.has(url)||requests>=OLD_VOTE_LIMITS.requests||bytes>=OLD_VOTE_LIMITS.maxBytes||Date.now()-started>=OLD_VOTE_LIMITS.runMs)
    throw Error('Bounded historical source budget or scope exceeded');
  if((url===API)!==Boolean(post))throw Error('Invalid request method');
  requests++;
  const response=await fetch(url,{method:post?'POST':'GET',body:post,headers:{'user-agent':'VotePredict/2.0 bounded historical named vote proof',accept:post?'application/json':'text/html',...(post?{'content-type':'application/json; charset=utf-8'}:{})},
    credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(Math.min(15000,Math.max(1,OLD_VOTE_LIMITS.runMs-(Date.now()-started))))});
  if(response.status!==200||response.url!==url||!response.body){await response.body?.cancel();throw Error('Unverified source response');}
  const mime=response.headers.get('content-type')??'';
  if(post?!mime.includes('application/json'):!mime.includes('text/html')){await response.body.cancel();throw Error('Unexpected source media type');}
  const max=Math.min(OLD_VOTE_LIMITS.maxPageBytes,OLD_VOTE_LIMITS.maxBytes-bytes);
  if(Number(response.headers.get('content-length')??0)>max){await response.body.cancel();throw Error('Source size exceeded');}
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const x=await reader.read();if(x.done)break;size+=x.value.byteLength;if(size>max){await reader.cancel();throw Error('Source size exceeded');}chunks.push(x.value);}}
  finally{reader.releaseLock();}
  const raw=Buffer.concat(chunks);if(!raw.length)throw Error('Empty original source');bytes+=raw.length;
  return {text:raw.toString('utf8'),receipt:{url,method:post?'POST':'GET',requestBodySha256:post?sha(Buffer.from(post)):null,observedAt:new Date().toISOString(),bodySha256:sha(raw),bodyBytes:raw.length,rawBodyRetained:false}};
}
async function main(){
  if(process.env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||process.env.GITHUB_EVENT_NAME!=='pull_request'||process.env.GITHUB_HEAD_REF!=='research/2027-incoming-historical-vote-pilot'||process.env.GITHUB_RUN_ATTEMPT!=='1'||process.env.VERCEL)
    throw Error('Historical public proof is PR-only');
  const index=await fetchOriginal(INDEX);let failed=0,documents=0,eventsCount=0,votesCount=0;
  console.log('OLD_VOTE_INDEX '+JSON.stringify(index.receipt));
  for(const session of OLD_SESSIONS){
    try{
      confirmHistoricalIndex(index.text,session);
      const registry=await fetchOriginal(buildLrlSessionSearchUrl(session));const verified=[];
      for(const target of OLD_TARGETS.filter(t=>t.slug===session.slug)){
        const profile=await fetchOriginal('https://www.lrl.mn.gov/legdb/fulldetail?ID='+target.lrlId);
        const v=verifyHistoricalTarget(session,target,registry.text,profile.text);
        verified.push(v.target);
        console.log('OLD_VOTE_IDENTITY '+JSON.stringify({...v,registryReceipt:registry.receipt,profileReceipt:profile.receipt}));
      }
      const summary=await fetchOriginal(API,JSON.stringify({SessionKey:Number(session.sessionKey),sortOption:'BillNumber'}));
      const scope=selectHistoricalBills(JSON.parse(summary.text),OLD_VOTE_LIMITS.billsPerSession);
      console.log('OLD_VOTE_SCOPE '+JSON.stringify({session:session.slug,sessionKey:session.sessionKey,summaryReceipt:summary.receipt,...scope}));
      for(const bill of scope.selected){
        try{
          const url=buildHouseVoteDetailUrl(session.sessionKey,bill);allowed.add(url);
          const doc=await fetchOriginal(url);
          const events=parseHouseVoteDetailHtml({html:doc.text,sessionKey:session.sessionKey,sourceUrl:url});
          if(!events.length)throw Error('No roll calls parsed');
          const named=pickHistoricalNamedVotes(events,session,bill,verified);
          documents++;eventsCount+=events.length;votesCount+=named.length;
          console.log('OLD_VOTE_DOCUMENT '+JSON.stringify({session:session.slug,bill,receipt:doc.receipt,events:events.length,namedVotes:named}));
        }catch{failed++;console.log('OLD_VOTE_GAP '+JSON.stringify({session:session.slug,bill,reason:'source_or_parser_validation_failed'}));}
      }
    }catch{failed++;console.log('OLD_VOTE_GAP '+JSON.stringify({session:session.slug,reason:'index_identity_or_summary_validation_failed'}));}
  }
  console.log('OLD_VOTE_SUMMARY '+JSON.stringify({requests,bytes,documents,eventsCount,votesCount,failed,completeCoverageVerified:false,originalBytesRetained:0,canonicalWrites:0,modelChanges:0}));
  if(documents===0)process.exitCode=1;
}
main().catch(()=>{console.error('Historical public proof failed closed');process.exitCode=1;});
