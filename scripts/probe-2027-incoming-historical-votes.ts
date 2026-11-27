import {createHash} from 'node:crypto';
import {OLD_SESSIONS,OLD_TARGETS,OLD_VOTE_LIMITS,confirmHistoricalIndex,selectHistoricalBills,verifyHistoricalTarget,pickHistoricalNamedVotes} from '../src/evidence/2027-incoming-historical-vote-pilot.js';
import {buildHouseVoteDetailUrl,parseHouseVoteDetailHtml} from '../src/sources/minnesota/house-votes.js';
import {buildLrlSessionSearchUrl} from '../src/sources/minnesota/lrl-members.js';
const INDEX='https://www.house.mn.gov/Votes',API=INDEX+'/GetVoteSummary';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const allowed=new Set([INDEX,API,...OLD_SESSIONS.map(buildLrlSessionSearchUrl),...OLD_TARGETS.map(t=>'https://www.lrl.mn.gov/legdb/fulldetail?ID='+t.lrlId)]);
const started=Date.now();let requests=0,bytes=0;
// Exact failed bills from the first pilot; retain successful results without
// recollecting them. The third session had no valid summary in run 45934541467.
const retryBills:Readonly<Record<string,readonly string[]>>={
  '2013-2014':['HF5','HF215','HF580','HF767','HF976','SF422','SF840'],
  '2017-2018':['HF1','HF234','HF678','HF890','HF3548','HF3873','SF359','SF893','SF2809','SF3245','SF4075'],
};
function failureCode(error:unknown){
  const s=error instanceof Error?error.message:'';
  if(s.startsWith('Unexpected historical summary'))return s.includes('identifier')?'summary_identifier_unrecognized':'summary_row_shape_unrecognized';
  if(s.startsWith('Invalid historical summary'))return 'summary_invalid_or_empty';
  if(s.includes('roster mismatch'))return 'roll_parser_tally_mismatch';
  if(s.includes('roll scope or tally mismatch'))return 'roll_scope_or_tally_unverified';
  if(s.includes('No roll calls parsed'))return 'no_roll_calls_parsed';
  if(s.includes('Source size')||s.includes('budget'))return 'source_budget_exceeded';
  if(s.includes('Unexpected source media'))return 'source_media_type_unexpected';
  if(s.includes('Unverified source response'))return 'source_response_unverified';
  if(s.includes('Historical native session key'))return 'native_session_key_mismatch';
  if(s.includes('Historical surname')||s.includes('Historical membership')||s.includes('Historical LRL'))return 'identity_unverified';
  if(error instanceof SyntaxError)return 'summary_json_invalid';
  if(/timeout|aborted/i.test(s))return 'source_timeout';
  return 'unclassified_failure';
}
function summaryShape(raw:unknown){
  if(!Array.isArray(raw))return {array:false};
  const prefixes:Record<string,number>={};let unknownIdentifiers=0,nonStringNumbers=0;
  for(const x of raw){
    if(!x||typeof x.Number!=='string'){nonStringNumbers++;continue;}
    const v=x.Number.replace(/\s+/g,'').toUpperCase();
    const match=/^([A-Z]{1,3})(\d{1,5})$/.exec(v);
    if(!match||Number(match[2])<1){unknownIdentifiers++;continue;}
    prefixes[match[1]]=(prefixes[match[1]]??0)+1;
  }
  return {array:true,rows:raw.length,prefixes,unknownIdentifiers,nonStringNumbers};
}
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
  if(process.env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||process.env.GITHUB_EVENT_NAME!=='pull_request'||process.env.GITHUB_HEAD_REF!=='research/2027-incoming-historical-vote-recovery'||process.env.GITHUB_RUN_ATTEMPT!=='1'||process.env.VERCEL)
    throw Error('Historical public proof is PR-only');
  const index=await fetchOriginal(INDEX);let failed=0,documents=0,eventsCount=0,votesCount=0;
  console.log('OLD_VOTE_INDEX '+JSON.stringify(index.receipt));
  for(const session of [...OLD_SESSIONS].sort((a,b)=>b.slug.localeCompare(a.slug))){
    let stage='index';
    try{
      confirmHistoricalIndex(index.text,session);
      stage='registry';
      const registry=await fetchOriginal(buildLrlSessionSearchUrl(session));const verified=[];
      stage='identity';
      for(const target of OLD_TARGETS.filter(t=>t.slug===session.slug)){
        const profile=await fetchOriginal('https://www.lrl.mn.gov/legdb/fulldetail?ID='+target.lrlId);
        const v=verifyHistoricalTarget(session,target,registry.text,profile.text);
        verified.push(v.target);
        console.log('OLD_VOTE_IDENTITY '+JSON.stringify({...v,registryReceipt:registry.receipt,profileReceipt:profile.receipt}));
      }
      stage='summary_fetch';
      const summary=await fetchOriginal(API,JSON.stringify({SessionKey:Number(session.sessionKey),sortOption:'BillNumber'}));
      stage='summary_parse';
      const raw:unknown=JSON.parse(summary.text);
      console.log('OLD_VOTE_SUMMARY_SHAPE '+JSON.stringify({session:session.slug,receipt:summary.receipt,...summaryShape(raw)}));
      const scope=selectHistoricalBills(raw,retryBills[session.slug]?16:OLD_VOTE_LIMITS.billsPerSession);
      const retry=retryBills[session.slug];
      // Do not silently change the old selection if the upstream index changed.
      if(retry?.some(b=>!scope.selected.includes(b)))throw Error('Historical retry inventory changed');
      const selected=retry?[...retry]:scope.selected;
      console.log('OLD_VOTE_SCOPE '+JSON.stringify({session:session.slug,sessionKey:session.sessionKey,summaryReceipt:summary.receipt,...scope,selected,fullDeterministicSelection:scope.selected,priorRunId:45934541467}));
      for(const bill of selected){
        try{
          const url=buildHouseVoteDetailUrl(session.sessionKey,bill);allowed.add(url);
          const doc=await fetchOriginal(url);
          const events=parseHouseVoteDetailHtml({html:doc.text,sessionKey:session.sessionKey,sourceUrl:url});
          if(!events.length)throw Error('No roll calls parsed');
          const named=pickHistoricalNamedVotes(events,session,bill,verified);
          documents++;eventsCount+=events.length;votesCount+=named.length;
          console.log('OLD_VOTE_DOCUMENT '+JSON.stringify({session:session.slug,bill,receipt:doc.receipt,events:events.length,namedVotes:named}));
        }catch(error){failed++;console.log('OLD_VOTE_GAP '+JSON.stringify({session:session.slug,bill,reason:failureCode(error)}));}
      }
    }catch(error){failed++;console.log('OLD_VOTE_GAP '+JSON.stringify({session:session.slug,stage,reason:failureCode(error)}));}
  }
  console.log('OLD_VOTE_SUMMARY '+JSON.stringify({requests,bytes,documents,eventsCount,votesCount,failed,completeCoverageVerified:false,originalBytesRetained:0,canonicalWrites:0,modelChanges:0}));
  if(documents===0)process.exitCode=1;
}
main().catch(()=>{console.error('Historical public proof failed closed');process.exitCode=1;});
