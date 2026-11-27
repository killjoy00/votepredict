import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {buildPreseasonTargets,fetchPreseasonTarget,retainPreseasonSourceInTransaction,PRESEASON_LIMITS,PRESEASON_EVENT_TYPE,PRESEASON_RECEIPT_TYPE} from '../src/operations/2027-preseason-evidence-archive.js';
import {assertExistingArchiveRun,assertArchiveConnection,withRestrictedArchiveTransaction,addRonnenbergTarget,ARCHIVE_OWNER,ARCHIVE_ROLE,ARCHIVE_PROJECT} from '../src/operations/2027-preseason-existing-neon-archive.js';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {storeBlob} from '../src/operations/2027-daily-collection.js';
const read=(s:string)=>readFileSync('docs/evaluation/source-proof/'+s,'utf8');
const roster=read('2027-preseason-roster-20261126.json'),pilot=JSON.parse(read('2027-incoming-evidence-pilot-20261126-part1.json'));
const targets=addRonnenbergTarget(buildPreseasonTargets(roster,JSON.parse(read('2027-incoming-evidence-manual-leads-20261126.json')),JSON.parse(read('2027-incoming-evidence-depth-review-20261126.json')),pilot),roster,pilot);
async function main(){
  if(process.argv.length!==3||!['--plan','--archive'].includes(process.argv[2]))throw Error('Invalid archive mode');
  if(process.argv[2]==='--plan'){console.log(JSON.stringify({targets:targets.length,members:new Set(targets.map(t=>t.lrlId)).size,maxBytes:PRESEASON_LIMITS.maxBytes,archiveRole:ARCHIVE_ROLE,scheduleEnabled:false}));return;}
  const {day,runId}=assertExistingArchiveRun(process.env,JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!,'utf8')),new Date());
  const current=await fetch('https://api.github.com/repos/killjoy00/votepredict/git/ref/heads/main',{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!current.ok||(await current.json()).object?.sha!==process.env.GITHUB_SHA)throw Error('Reviewed archive revision is not current main');
  if(process.env.VOTEPREDICT_NEON_PROJECT_ID!==ARCHIVE_PROJECT)throw Error('Configured VotePredict project mismatch');
  // Capture untrusted public sources before obtaining owner DB credentials. No
  // body or response text enters public logs. Three-minute acquisition window
  // leaves time to commit inside the five-minute receipt acceptance guard.
  const budget={started:Date.now()-(PRESEASON_LIMITS.runMs-180000),bytes:0,requests:0};
  const captured:Array<{target:(typeof targets)[number];data:Awaited<ReturnType<typeof fetchPreseasonTarget>>}>=[];
  const failures:Array<{lrlId:string;seat:string;sourceUrl:string;state:string}>=[];
  for(const target of targets){
    try{captured.push({target,data:await fetchPreseasonTarget(target,budget,runId)});}
    catch(e){const m=e instanceof Error?e.message:'';failures.push({lrlId:target.lrlId,seat:target.seat,sourceUrl:target.url,state:/^SOURCE_[A-Z0-9_]+$/.test(m)?m:/timeout|aborted/i.test(m)?'TIMEOUT':'SOURCE_UNAVAILABLE_OR_UNVERIFIED'});}
  }
  if(!captured.length)throw Error('No verified source bodies captured');
  const neon=await discoverExistingVotePredictNeonConnection({apiKey:process.env.NEON_API_KEY??'',projectId:ARCHIVE_PROJECT,preferredDatabase:'votepredict',requirePrimary:true});
  assertArchiveConnection(neon);
  const db=new Pool({host:neon.host,port:neon.port,database:neon.database,user:neon.role,password:neon.password,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000});
  try{
    const result=await withRestrictedArchiveTransaction(db,ARCHIVE_OWNER,ARCHIVE_ROLE,async client=>{
      const starts=(await client.query<{count:number}>("SELECT count(*)::int AS count FROM evidence_content_blobs WHERE media_type=$1 AND accepted_at>=($2::date::timestamp AT TIME ZONE 'America/Chicago') AND accepted_at<(($2::date+1)::timestamp AT TIME ZONE 'America/Chicago') AND convert_from(body,'UTF8')::jsonb->>'state'='started'",[PRESEASON_EVENT_TYPE,day])).rows[0]?.count;
      if(starts!==0)throw Error('One preseason archive batch per day');
      const inventory=(await client.query<{url:string}>("SELECT DISTINCT convert_from(body,'UTF8')::jsonb->>'sourceUrl' AS url FROM evidence_content_blobs WHERE media_type=$1 LIMIT 1001",[PRESEASON_RECEIPT_TYPE])).rows;
      if(inventory.length>1000)throw Error('Archive receipt inventory exceeds bound');
      const prior=new Set(inventory.map(r=>r.url));
      await storeBlob(client,Buffer.from(JSON.stringify({schemaVersion:'2027-preseason-archive-event-v1',runId,day,state:'started',auth:'existing-protected-neon-role-switch'})),PRESEASON_EVENT_TYPE,true);
      const rows:Array<{lrlId:string;seat:string;sourceUrl:string;state:string;bodySha256?:string;bodyBytes?:number;observedAt?:string;identityNameMentioned?:boolean;claimedPublicationAt?:string|null;receiptSha256?:string}>=[];
      for(const {target,data:{receipt,raw}} of captured){
        const common={lrlId:target.lrlId,seat:target.seat,sourceUrl:target.url};
        if(prior.has(target.url)){rows.push({...common,state:'previously_archived'});continue;}
        const digest=await retainPreseasonSourceInTransaction(client,target,receipt,raw);
        rows.push({...common,state:'archived_review_required',bodySha256:receipt.bodySha256,bodyBytes:receipt.bodyBytes,observedAt:receipt.observedAt,identityNameMentioned:receipt.identityNameMentioned,claimedPublicationAt:receipt.claimedPublicationAt,receiptSha256:digest});
      }
      for(const failure of failures)rows.push(prior.has(failure.sourceUrl)?{...failure,state:'previously_archived'}:failure);
      const good=rows.filter(r=>r.state==='archived_review_required'),existing=rows.filter(r=>r.state==='previously_archived');
      const summary={targets:targets.length,attempted:budget.requests,bytes:budget.bytes,rawBodiesRetained:good.length,membersObserved:new Set(good.map(r=>r.lrlId)).size,previouslyArchived:existing.length,failed:rows.length-good.length-existing.length,servingEvidenceCreated:0};
      await storeBlob(client,Buffer.from(JSON.stringify({schemaVersion:'2027-preseason-archive-event-v1',runId,day,state:summary.failed?'partial_failure':'completed',summary})),PRESEASON_EVENT_TYPE,true);
      return {rows,summary};
    });
    // Only after commit; no credentials, raw text, or incidental contacts.
    console.log('PRESEASON_SOURCE_SUMMARY '+JSON.stringify(result.summary));
    for(const row of result.rows)console.log('PRESEASON_SOURCE_RECEIPT '+JSON.stringify(row));
    if(result.summary.failed)process.exitCode=1;
  }finally{await db.end();}
}
main().catch(()=>{console.error('Existing Neon preseason archive failed closed; no successful commit claimed.');process.exitCode=1;});
