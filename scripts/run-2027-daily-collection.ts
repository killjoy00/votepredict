import { writeFileSync,mkdirSync } from 'node:fs';
import { COLLECTION_LIMITS,with2027ArchivedSources } from '../src/sources/minnesota/2027-collection-source.js';
import { DAILY_COLLECTION_PLAN,assertDailyCollectionRun,verifyCollectionTarget,archive2027Source,storeCollectionEvent,
  readCollectionEvents,assertDailyRunAvailable,readCollectionHealth,collectionAlerts,type CollectionReport } from '../src/operations/2027-daily-collection.js';

async function main(){
  if(process.argv.length===3&&process.argv[2]==='--plan'){console.log(JSON.stringify(DAILY_COLLECTION_PLAN,null,2));return;}
  if(process.argv.length!==3||process.argv[2]!=='--collect')throw Error('Use --plan or the guarded --collect workflow');
  const target=assertDailyCollectionRun(process.env,new Date());
  process.env.DATABASE_URL=target.databaseUrl;
  delete process.env.POSTGRES_URL;delete process.env.DATABASE_URL_UNPOOLED;delete process.env.POSTGRES_URL_NON_POOLING;
  process.env.VOTEPREDICT_REVISOR_FETCH_ATTEMPTS='1';
  const {pool,runtimeDatabaseTargetFingerprint}=await import('../src/lib/db/index.js');
  try{
    await verifyCollectionTarget(pool,target,runtimeDatabaseTargetFingerprint);
    const client=await pool.connect();let locked=false;
    try{
      const acquired=await client.query<{locked:boolean}>("SELECT pg_try_advisory_lock(hashtext('votepredict-2027-daily-collector')) AS locked");
      locked=acquired.rows[0]?.locked===true;
      if(!locked)throw Error('Another daily collector owns the DB lock');
      assertDailyRunAvailable(await readCollectionEvents(client,target.day),target.day,target.runId);
      const before=await readCollectionHealth(client);
      const startedAt=new Date().toISOString();
      await storeCollectionEvent(client,{schemaVersion:'2027-collection-event-v1',session:'2027-2028',runId:target.runId,day:target.day,state:'started',startedAt});
      const {syncLiveRevisorUniverse}=await import('../src/operations/live-revisor-universe.js');
      const {syncLiveRevisorStatusBatch}=await import('../src/operations/live-revisor-status.js');
      const {backfillRevisorInitialTextBatch}=await import('../src/operations/revisor-initial-text-backfill.js');
      const report=await with2027ArchivedSources(target.runId,(receipt,bytes)=>archive2027Source(pool,receipt,bytes),async counters=>{
        const stages:Record<string,unknown>={};let discovered:number|null=null;let phaseFailed=false;let after:Awaited<ReturnType<typeof readCollectionHealth>>|null=null;
        try{
          const catalog=await syncLiveRevisorUniverse();stages.catalog=catalog;discovered=catalog.discoveredBills;
          if(discovered<before.knownBills||discovered===0)throw Error('Catalog empty or regressed');
          const status=await syncLiveRevisorStatusBatch(COLLECTION_LIMITS.statusBatch);
          stages.status={selected:status.selected,fetched:status.fetched,failed:status.failed,versionsRecorded:status.versionsRecorded,sourceDocumentsRecorded:status.sourceDocumentsRecorded};
          if(status.failed>0||status.selected===0)throw Error('Status collection incomplete');
          stages.initialText=await backfillRevisorInitialTextBatch(COLLECTION_LIMITS.initialTextBatch,'2027-2028');
        }catch{phaseFailed=true;stages.error='BOUNDED_COLLECTION_STAGE_FAILED';}
        try{after=await readCollectionHealth(client);}catch{phaseFailed=true;}
        const alerts=collectionAlerts(before,after,discovered,counters,phaseFailed);
        const result:CollectionReport={schemaVersion:'2027-collection-report-v1',session:'2027-2028',runId:target.runId,day:target.day,startedAt,finishedAt:new Date().toISOString(),
          state:phaseFailed||counters.failed>0||counters.archived!==counters.requests?'partial_failure':'completed_batch',
          stages,before,after,counters,alerts,officialUniverseVerified:false,fullDailyCoverageVerified:false,productionForecastingActive:false};
        return result;
      });
      const reportSha=await storeCollectionEvent(client,report);
      mkdirSync('artifacts',{recursive:true});
      const output={...report,reportSha256:reportSha};
      writeFileSync('artifacts/2027-collection-report.json',JSON.stringify(output,null,2)+'\n');
      console.log(JSON.stringify(output));
      for(const alert of report.alerts)console.log('::warning::'+alert);
      if(report.state!=='completed_batch')process.exitCode=1;
    }finally{
      try{if(locked)await client.query("SELECT pg_advisory_unlock(hashtext('votepredict-2027-daily-collector'))");}finally{client.release(true);}
    }
  }finally{await pool.end();}
}
main().catch(()=>{console.error('2027 collection failed closed; review protected configuration or incomplete run record.');process.exitCode=1;});
