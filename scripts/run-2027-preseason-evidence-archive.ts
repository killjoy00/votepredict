import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {buildPreseasonTargets,fetchPreseasonTarget,assertPreseasonArchiveRun,verifyPreseasonArchiveRole,retainPreseasonSource,PRESEASON_LIMITS,PRESEASON_EVENT_TYPE,PRESEASON_RECEIPT_TYPE} from '../src/operations/2027-preseason-evidence-archive.js';
import {databaseTargetFingerprint} from '../src/operations/release-readiness.js';
import {storeBlob} from '../src/operations/2027-daily-collection.js';

const root='docs/evaluation/source-proof/';
const read=(name:string)=>readFileSync(root+name,'utf8');
const targets=buildPreseasonTargets(read('2027-preseason-roster-20261126.json'),JSON.parse(read('2027-incoming-evidence-manual-leads-20261126.json')),
  JSON.parse(read('2027-incoming-evidence-depth-review-20261126.json')),JSON.parse(read('2027-incoming-evidence-pilot-20261126-part1.json')));
const errorCode=(e:unknown)=>{const message=e instanceof Error?e.message:'';
  return /^SOURCE_[A-Z0-9_]+$/.test(message)?message:/timeout|aborted/i.test(message)?'TIMEOUT':'SOURCE_UNAVAILABLE_OR_UNVERIFIED';};
async function main(){
  const mode=process.argv[2];
  if(process.argv.length!==3||!['--plan','--probe','--archive'].includes(mode))throw Error('Use plan, bounded PR probe or protected archive');
  if(mode==='--plan'){console.log(JSON.stringify({targets:targets.length,members:new Set(targets.map(x=>x.lrlId)).size,limits:PRESEASON_LIMITS,productionScheduleEnabled:false,servingEligible:false}));return;}
  let db:Pool|undefined,lock:import('pg').PoolClient|undefined,runId:string,day:string|undefined,locked=false;
  if(mode==='--probe'){
    if(process.env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||process.env.GITHUB_EVENT_NAME!=='pull_request'||process.env.GITHUB_HEAD_REF!=='feat/2027-protected-preseason-evidence'||
      !/^\d{1,20}$/.test(process.env.GITHUB_RUN_ID??'')||process.env.GITHUB_RUN_ATTEMPT!=='1'||process.env.VERCEL)throw Error('Probe is not authorized');
    runId=process.env.GITHUB_RUN_ID+':1';
  }else{
    const target=assertPreseasonArchiveRun(process.env,new Date());
    runId=target.runId;day=target.day;
    db=new Pool({connectionString:target.databaseUrl,max:2,connectionTimeoutMillis:10000,options:'-c search_path=public -c statement_timeout=15000 -c lock_timeout=5000'});
  }
  try{
    const prior=new Set<string>();
    if(db){
      const target=assertPreseasonArchiveRun(process.env,new Date());
      await verifyPreseasonArchiveRole(db,target,databaseTargetFingerprint(target.databaseUrl));
      lock=await db.connect();
      locked=(await lock.query<{locked:boolean}>("SELECT pg_try_advisory_lock(hashtext('votepredict-2027-preseason-archive')) AS locked")).rows[0]?.locked===true;
      if(!locked)throw Error('Preseason archive locked');
      const starts=(await lock.query<{count:number}>(`SELECT count(*)::int AS count FROM evidence_content_blobs WHERE media_type=$1
        AND accepted_at>=($2::date::timestamp AT TIME ZONE 'America/Chicago') AND accepted_at<(($2::date+1)::timestamp AT TIME ZONE 'America/Chicago')
        AND convert_from(body,'UTF8')::jsonb->>'state'='started'`,[PRESEASON_EVENT_TYPE,day])).rows[0]?.count;
      if(starts!==0)throw Error('One preseason archive start permitted per day');
      const observed=(await lock.query<{url:string}>(`SELECT DISTINCT convert_from(body,'UTF8')::jsonb->>'sourceUrl' AS url FROM evidence_content_blobs WHERE media_type=$1 LIMIT 1001`,[PRESEASON_RECEIPT_TYPE])).rows;
      if(observed.length>1000)throw Error('Preseason archive inventory exceeds bound');
      for(const row of observed)prior.add(row.url);
      await storeBlob(lock,Buffer.from(JSON.stringify({schemaVersion:'2027-preseason-archive-event-v1',runId,day,state:'started'})),PRESEASON_EVENT_TYPE,true);
    }
    const budget={started:Date.now(),bytes:0,requests:0};
    const rows:Array<{lrlId:string;seat:string;sourceUrl:string;state:string;bodySha256?:string;bodyBytes?:number;observedAt?:string;identityNameMentioned?:boolean;claimedPublicationAt?:string|null;receiptSha256?:string}>=[];
    for(const target of targets){
      if(prior.has(target.url)){rows.push({lrlId:target.lrlId,seat:target.seat,sourceUrl:target.url,state:'previously_archived'});continue;}
      try{
        const {receipt,raw}=await fetchPreseasonTarget(target,budget,runId);
        const digest=db?await retainPreseasonSource(db,target,receipt,raw):undefined;
        rows.push({lrlId:target.lrlId,seat:target.seat,sourceUrl:target.url,state:db?'archived_review_required':'observed_metadata_only',
          bodySha256:receipt.bodySha256,bodyBytes:receipt.bodyBytes,observedAt:receipt.observedAt,identityNameMentioned:receipt.identityNameMentioned,
          claimedPublicationAt:receipt.claimedPublicationAt,receiptSha256:digest});
      }catch(e){rows.push({lrlId:target.lrlId,seat:target.seat,sourceUrl:target.url,state:errorCode(e)});}
    }
    const successful=rows.filter(r=>r.state==='observed_metadata_only'||r.state==='archived_review_required');
    const summary={mode,targets:targets.length,attempted:budget.requests,bytes:budget.bytes,observed:successful.length,
      identityNameMentioned:successful.filter(r=>r.identityNameMentioned).length,membersObserved:new Set(successful.map(r=>r.lrlId)).size,
      previouslyArchived:rows.filter(r=>r.state==='previously_archived').length,failed:rows.length-successful.length-rows.filter(r=>r.state==='previously_archived').length,
      rawBodiesRetained:db?successful.length:0,servingEvidenceCreated:0};
    if(lock)await storeBlob(lock,Buffer.from(JSON.stringify({schemaVersion:'2027-preseason-archive-event-v1',runId,day,state:summary.failed?'partial_failure':'completed',summary})),PRESEASON_EVENT_TYPE,true);
    console.log('PRESEASON_SOURCE_SUMMARY '+JSON.stringify(summary));
    // Only public source URLs, digests, timestamps, identity-hint booleans and counts.
    for(const row of rows)console.log('PRESEASON_SOURCE_RECEIPT '+JSON.stringify(row));
    if(db&&summary.failed)process.exitCode=1;
  }finally{
    try{if(lock&&locked)await lock.query("SELECT pg_advisory_unlock(hashtext('votepredict-2027-preseason-archive'))");}
    finally{lock?.release(true);await db?.end();}
  }
}
main().catch(()=>{console.error('Preseason evidence run failed closed; review protected configuration and sanitized run records.');process.exitCode=1;});
