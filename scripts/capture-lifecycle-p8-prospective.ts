import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED','POSTGRES_URL_NON_POOLING','DATABASE_URL','POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_OUTPUT_DIR = 'artifacts/lifecycle-p8-daily-capture-v1';
const PLAN_PATH = 'data/evaluation/lifecycle-p8-prospective-plan-v1.json';
let secretValues: string[] = [];

type IntroRow = {
  bill_id:string; session_slug:string; session_start:string; chamber_slug:'house'|'senate';
  identifier:string; title:string; raw_text:string|null; text_hash:string|null;
  model_eligible:string|null; outcome:boolean;
};
type BillRow = {
  bill_id:string; session_id:string; session_slug:'2027-2028'; chamber_slug:'house'|'senate';
  identifier:string; title:string; introduced_on:string; adjournment_on:string;
  introduction_parser_version:string|null; process_parser_version:string|null;
  process_audit_version:string|null; process_status:string|null; authorship:unknown;
  model_eligible:string|null; initial_raw_text:string|null; initial_text_hash:string|null;
};
type EventRow = {
  id:string; bill_id:string; occurred_on:string; chamber_slug:'house'|'senate'|null;
  stage_kind:string; outcome:boolean|null; source_url:string|null; source_document_id:string|null;
  content_sha256:string|null; parser_version:string|null; companion_identifiers:unknown;
};
type VersionRow = {
  id:string; bill_id:string; version_key:string; published_on:string; published_at:string;
  created_at:string; text_hash:string|null; text_length_chars:number|null; raw_text:string|null;
};
type EvidenceRow = { bill_id:string; evidence_kind:string; fetched_on:string; published_on:string|null };
type RefRow = { session_slug:string; chamber_slug:'house'|'senate'; session_id:string; chamber_id:string };

function mask(value:string):void {
  if(value.length<=3)return;
  console.log('::add-mask::'+value.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));
}
function safeMessage(error:unknown):string {
  let message=error instanceof Error?(error.stack??error.message):String(error);
  for(const value of secretValues.filter(v=>v.length>3).sort((a,b)=>b.length-a.length)) message=message.split(value).join('[redacted]');
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi,'[redacted database URL]').replace(/https?:\/\/\S+/gi,'[source URL]');
}
async function canConnect(value:string):Promise<boolean>{
  const probe=new Pool({connectionString:value,max:1,connectionTimeoutMillis:8000});
  try{await probe.query('SELECT 1');return true;}catch{return false;}finally{await probe.end().catch(()=>undefined);}
}
async function chooseDatabaseUrl(env:Record<string,string|undefined>):Promise<string>{
  for(const key of DATABASE_CANDIDATES){const value=env[key]?.trim();if(value&&await canConnect(value))return value;}
  const secret=env.CRON_SECRET?.trim();if(!secret)throw new Error('CRON_SECRET is unavailable for authenticated Neon database bridge');
  const response=await fetch(DATABASE_BRIDGE_URL,{method:'POST',headers:{authorization:'Bearer '+secret}});
  if(!response.ok)throw new Error('Authenticated Neon database bridge returned HTTP '+response.status);
  const value=(await response.text()).trim();
  if(!value.startsWith('postgresql://')&&!value.startsWith('postgres://'))throw new Error('Authenticated Neon database bridge returned invalid database URL');
  secretValues.push(value);mask(value);
  if(!await canConnect(value))throw new Error('Authenticated Neon database bridge returned a non-portable database URL');
  return value;
}
function parseBillNumber(identifier:string):number|null{const match=identifier.match(/(\d+)\s*$/);return match?Number(match[1]):null;}
function groupByBill<T extends {bill_id:string}>(rows:readonly T[]):Map<string,T[]>{
  const out=new Map<string,T[]>();for(const row of rows){const bucket=out.get(row.bill_id)??[];bucket.push(row);out.set(row.bill_id,bucket);}return out;
}
function stringArray(value:unknown):string[]{return Array.isArray(value)?value.filter((v):v is string=>typeof v==='string'):[];}

async function main():Promise<void>{
  const envPath=process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;if(!envPath)throw new Error('Production environment file is required');
  const env=parseRuntimeEnvironment(readFileSync(envPath,'utf8'));
  secretValues=Object.entries(env).filter(([k])=>/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(k)).map(([,v])=>v).filter((v):v is string=>typeof v==='string');
  for(const value of secretValues)mask(value);
  const databaseUrl=await chooseDatabaseUrl(env);secretValues.push(databaseUrl);process.env.DATABASE_URL=databaseUrl;
  delete process.env.POSTGRES_URL;delete process.env.DATABASE_URL_UNPOOLED;delete process.env.POSTGRES_URL_NON_POOLING;

  const {pool}=await import('../src/lib/db/index.js');
  const {buildLifecycleP3SnapshotDataset}=await import('../src/evaluation/lifecycle-p3-snapshot-dataset.js');
  const {buildLifecycleP8FrozenModelContent,LIFECYCLE_P8_FROZEN_PLAN_SHA256}=await import('../src/evaluation/lifecycle-p8-prospective.js');
  const {buildLifecycleP5Rows,buildLifecycleP5ProspectiveRow,predictLifecycleP5RetainedProspectiveModel}=await import('../src/evaluation/lifecycle-p5-evidence-allocation.js');
  const {predictLifecycleP4ProspectiveStageModel}=await import('../src/evaluation/lifecycle-p4-baselines.js');
  const {buildLifecycleP6ConditionalPredictions,combineLifecycleAndConditional}=await import('../src/evaluation/lifecycle-p6-end-to-end.js');
  const {trainIntroductionTextModel,predictIntroductionTextModel}=await import('../src/evaluation/introduction-text-model.js');
  const {serializeIntroductionPriorModelV4}=await import('../src/forecasting/introduction-prior-model.js');
  const {loadHistoricalQuickReplayDataset}=await import('../src/evaluation/historical-quick-replay-dataset.js');
  const {buildLifecycleP8FeatureSnapshot,lifecycleP8CaptureContentSha256,lifecycleP8ChicagoCutoffDate,lifecycleP8ProcessSourceCovered,LIFECYCLE_P8_CAPTURE_SCHEMA_VERSION}=await import('../src/evaluation/lifecycle-p8-capture.js');

  try{
    const cutoffDate=process.env.VOTEPREDICT_P8_CUTOFF_DATE?.trim()||lifecycleP8ChicagoCutoffDate(new Date());
    const planSha=createHash('sha256').update(readFileSync(PLAN_PATH,'utf8')).digest('hex');
    if(planSha!==LIFECYCLE_P8_FROZEN_PLAN_SHA256)throw new Error('P8 capture refuses prospective-plan drift');

    const [p3,intro]=await Promise.all([
      buildLifecycleP3SnapshotDataset(process.env.GITHUB_SHA??null),
      pool.query<IntroRow>(`
        SELECT b.id::text AS bill_id,s.slug AS session_slug,s.starts_on::text AS session_start,
               c.slug AS chamber_slug,b.identifier,COALESCE(b.title,'') AS title,
               bv.raw_text,bv.text_hash,
               b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' AS model_eligible,
               (b.metadata #>> '{sourceChamberPassage,outcome}')::boolean AS outcome
          FROM bills b
          JOIN legislative_sessions s ON s.id=b.session_id
          JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
          JOIN chambers c ON c.id=b.originating_chamber_id AND c.slug IN ('house','senate')
          JOIN bill_versions bv ON bv.bill_id=b.id
            AND bv.version_key=b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
         WHERE s.starts_on < '2027-01-01'::date
           AND b.metadata ? 'revisorUniverse'
           AND b.metadata #>> '{sourceChamberPassage,outcome}' IN ('true','false')
           AND b.metadata #>> '{sourceChamberPassage,targetStage}'='source_chamber_passage'
         ORDER BY s.starts_on,c.slug,substring(b.identifier from '[0-9]+$')::integer,b.identifier`)
    ]);
    if(intro.rows.length!==31010)throw new Error('P8 capture historical introduction population drift: '+intro.rows.length+'/31010');
    if(intro.rows.some(row=>!row.raw_text||!row.text_hash))throw new Error('P8 historical introduction corpus has missing text/hash');

    const observations=intro.rows.map(row=>({
      billId:row.bill_id,sessionSlug:row.session_slug,sessionStart:row.session_start,chamber:row.chamber_slug,
      title:row.title,billNumber:parseBillNumber(row.identifier),outcome:row.outcome?1 as const:0 as const,
      initialText:row.model_eligible==='true'?row.raw_text:null,initialTextAvailableAtIntroduction:row.model_eligible==='true',
    }));
    const corpusLines=intro.rows.map(row=>[row.bill_id,row.session_slug,row.chamber_slug,row.identifier,row.text_hash,row.model_eligible,row.outcome?'1':'0'].join(':'));
    const corpusSha=createHash('sha256').update(corpusLines.join('\n')).digest('hex');
    const introductionModel=trainIntroductionTextModel(observations);
    const serialized=serializeIntroductionPriorModelV4(introductionModel,{
      targetSessionSlug:'2027-2028',targetSessionStart:'2027-01-01',trainedThroughSessionSlug:'2025-2026',
      trainingSessions:['2021-2022','2023-2024','2025-2026'],trainingRows:intro.rows.length,
      trainingPositives:intro.rows.filter(row=>row.outcome).length,
      provenance:{authoritativeUniverse:intro.rows.length,generatedAt:'excluded-from-frozen-content',codeSha:null,evaluationCommit:'7826d9696e0766abce3b58bf4ae2e4a155b7a000'},
    });
    const {provenance:_provenance,...introductionModelContent}=serialized;
    const frozen=buildLifecycleP8FrozenModelContent({
      snapshots:p3.snapshots,p3ObservedSha256:p3.manifest.snapshotContentSha256,
      introductionModel:introductionModelContent,introductionTrainingCorpusSha256:corpusSha,
    });
    // Touch the retained rows here to keep the capture's P5 training dependency explicit and type-checked.
    void buildLifecycleP5Rows(p3.snapshots);

    const bills=await pool.query<BillRow>(`
      SELECT b.id::text AS bill_id,s.id::text AS session_id,s.slug AS session_slug,c.slug AS chamber_slug,
             b.identifier,COALESCE(b.title,'') AS title,
             COALESCE(b.metadata #>> '{revisorIntroduction,introducedOn}',b.introduced_at::date::text) AS introduced_on,
             COALESCE(s.ends_on::text,'2028-12-31') AS adjournment_on,
             b.metadata #>> '{revisorIntroduction,parserVersion}' AS introduction_parser_version,
             b.metadata #>> '{revisorProcessHistory,parserVersion}' AS process_parser_version,
             b.metadata #>> '{revisorProcessHistory,auditVersion}' AS process_audit_version,
             b.metadata #>> '{revisorProcessHistory,status}' AS process_status,
             b.metadata -> 'revisorAuthorship' AS authorship,
             b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' AS model_eligible,
             initial.raw_text AS initial_raw_text,initial.text_hash AS initial_text_hash
        FROM bills b
        JOIN legislative_sessions s ON s.id=b.session_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
        JOIN chambers c ON c.id=b.originating_chamber_id AND c.slug IN ('house','senate')
        LEFT JOIN bill_versions initial ON initial.bill_id=b.id
          AND initial.version_key=b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
       WHERE s.slug='2027-2028' AND b.metadata ? 'revisorUniverse'
         AND COALESCE(b.metadata #>> '{revisorIntroduction,introducedOn}',b.introduced_at::date::text) < $1::date
       ORDER BY c.slug,substring(b.identifier from '[0-9]+$')::integer,b.identifier`,[cutoffDate]);

    const outputDir=process.env.VOTEPREDICT_P8_CAPTURE_OUTPUT_DIR?.trim()||DEFAULT_OUTPUT_DIR;
    if(!bills.rows.length){
      const summary={schemaVersion:LIFECYCLE_P8_CAPTURE_SCHEMA_VERSION,cutoffDateExclusive:cutoffDate,eligibleBills:0,inserted:0,alreadyCapturedIdentically:0,frozenPlanSha256:planSha,frozenModelContentSha256:frozen.modelContentSha256,outcomeColumnsRead:false,productionAction:'none'};
      await mkdir(outputDir,{recursive:true});await writeFile(join(outputDir,'summary.json'),JSON.stringify(summary,null,2)+'\n','utf8');
      console.log(JSON.stringify({lifecycleP8DailyCapture:summary},null,2));return;
    }

    const [events,versions,evidence,refs,floorDataset]=await Promise.all([
      pool.query<EventRow>(`
        SELECT se.id::text,se.bill_id::text,se.occurred_at::date::text AS occurred_on,c.slug AS chamber_slug,
               se.stage_kind,se.outcome,se.source_url,se.source_document_id::text,sd.content_sha256,
               se.metadata ->> 'parserVersion' AS parser_version,se.metadata -> 'companionIdentifiers' AS companion_identifiers
          FROM legislative_stage_events se
          JOIN bills b ON b.id=se.bill_id JOIN legislative_sessions s ON s.id=b.session_id
          LEFT JOIN chambers c ON c.id=se.chamber_id LEFT JOIN source_documents sd ON sd.id=se.source_document_id
         WHERE s.slug='2027-2028' AND se.occurred_at::date < $1::date
         ORDER BY se.bill_id,se.occurred_at,se.stage_kind,se.id`,[cutoffDate]),
      pool.query<VersionRow>(`
        SELECT bv.id::text,bv.bill_id::text,bv.version_key,bv.published_at::date::text AS published_on,
               to_char(bv.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS published_at,
               to_char(bv.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
               bv.text_hash,CASE WHEN bv.raw_text IS NULL THEN NULL ELSE length(bv.raw_text) END::int AS text_length_chars,bv.raw_text
          FROM bill_versions bv JOIN bills b ON b.id=bv.bill_id JOIN legislative_sessions s ON s.id=b.session_id
         WHERE s.slug='2027-2028' AND bv.published_at IS NOT NULL ORDER BY bv.bill_id,bv.published_at,bv.version_key,bv.id`),
      pool.query<EvidenceRow>(`
        SELECT ei.bill_id::text,ei.evidence_kind,sd.fetched_at::date::text AS fetched_on,ei.published_at::date::text AS published_on
          FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id
          JOIN bills b ON b.id=ei.bill_id JOIN legislative_sessions s ON s.id=b.session_id
         WHERE s.slug='2027-2028' AND COALESCE(ei.metadata ->> 'asOfEligible','true') <> 'false'
         ORDER BY ei.bill_id,sd.fetched_at,ei.published_at,ei.evidence_kind`),
      pool.query<RefRow>(`
        SELECT s.slug AS session_slug,c.slug AS chamber_slug,s.id::text AS session_id,c.id::text AS chamber_id
          FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
          CROSS JOIN chambers c WHERE s.slug='2027-2028' AND c.jurisdiction_id=j.id AND c.slug IN ('house','senate')
         ORDER BY c.slug`),
      loadHistoricalQuickReplayDataset(pool),
    ]);

    const eventsByBill=groupByBill(events.rows), versionsByBillFeature=groupByBill(versions.rows), evidenceByBill=groupByBill(evidence.rows);
    const snapshots=bills.rows.map(bill=>buildLifecycleP8FeatureSnapshot({
      billId:bill.bill_id,sessionId:bill.session_id,sessionSlug:bill.session_slug,chamber:bill.chamber_slug,
      identifier:bill.identifier,title:bill.title,introducedOn:bill.introduced_on,adjournmentOn:bill.adjournment_on,
      introductionParserVersion:bill.introduction_parser_version,processParserVersion:bill.process_parser_version,
      processAuditVersion:bill.process_audit_version,processStatus:bill.process_status,authorship:bill.authorship as any,
      events:(eventsByBill.get(bill.bill_id)??[]).map(row=>({eventKey:row.id,occurredOn:row.occurred_on,chamber:row.chamber_slug,stageKind:row.stage_kind,outcome:row.outcome,sourceUrl:row.source_url,sourceDocumentId:row.source_document_id,sourceContentSha256:row.content_sha256,parserVersion:row.parser_version,companionIdentifiers:stringArray(row.companion_identifiers)})),
      versions:(versionsByBillFeature.get(bill.bill_id)??[]).map(row=>({id:row.id,versionKey:row.version_key,publishedOn:row.published_on,textHash:row.text_hash,textLengthChars:row.text_length_chars})),
      evidence:(evidenceByBill.get(bill.bill_id)??[]).map(row=>({evidenceKind:row.evidence_kind,fetchedOn:row.fetched_on,publishedOn:row.published_on})),
    },cutoffDate));

    const versionsByBill=new Map(floorDataset.versionsByBill);
    const known=new Set([...versionsByBill.values()].flatMap(rows=>rows.map(row=>row.id)));
    for(const row of versions.rows){if(!row.raw_text||row.raw_text.length<100||known.has(row.id))continue;const bucket=versionsByBill.get(row.bill_id)??[];bucket.push({id:row.id,billId:row.bill_id,publishedAt:row.published_at,createdAt:row.created_at,rawText:row.raw_text});versionsByBill.set(row.bill_id,bucket);known.add(row.id);}
    for(const rows of versionsByBill.values())rows.sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
    const sessionChamberRefs=new Map(refs.rows.map(row=>[row.session_slug+'|'+row.chamber_slug,{sessionSlug:row.session_slug,chamber:row.chamber_slug,sessionId:row.session_id,chamberId:row.chamber_id}]));
    const conditional=buildLifecycleP6ConditionalPredictions({snapshots,versionsByBill,passageEvents:floorDataset.events,memberships:floorDataset.memberships,historicalVotes:floorDataset.historicalVotes,sessionChamberRefs,targetSessions:['2027-2028']});
    const conditionalByBill=new Map(conditional.map(row=>[row.billId,row])), billById=new Map(bills.rows.map(row=>[row.bill_id,row]));

    const payloads=snapshots.map(snapshot=>{
      const bill=billById.get(snapshot.bill.billId)!;
      const introductionProbability=(bill.model_eligible==='true'&&(!bill.initial_raw_text||!bill.initial_text_hash))?null:
        (bill.model_eligible==='true'||bill.model_eligible==='false')?predictIntroductionTextModel(introductionModel,{title:bill.title,initialText:bill.model_eligible==='true'?bill.initial_raw_text:null,initialTextAvailableAtIntroduction:bill.model_eligible==='true'}):null;
      const p4=predictLifecycleP4ProspectiveStageModel(frozen.modelContent.p4Stage,snapshot);
      const direct=predictLifecycleP5RetainedProspectiveModel(frozen.modelContent.p5Retained,buildLifecycleP5ProspectiveRow(snapshot,'source_chamber_passage'));
      const reach=predictLifecycleP5RetainedProspectiveModel(frozen.modelContent.p5Retained,buildLifecycleP5ProspectiveRow(snapshot,'reach_source_chamber_passage_vote'));
      const cond=conditionalByBill.get(snapshot.bill.billId);if(!cond)throw new Error('Missing P6 conditional for '+snapshot.bill.identifier);
      const endToEnd=reach?combineLifecycleAndConditional(reach.candidateProbability,cond.probability):p4;
      const processCovered=lifecycleP8ProcessSourceCovered(snapshot);
      const capture={schemaVersion:LIFECYCLE_P8_CAPTURE_SCHEMA_VERSION,targetSession:'2027-2028',cutoff:snapshot.cutoff,bill:snapshot.bill,features:snapshot.features,lineage:snapshot.lineage,predictions:{introductionV4:introductionProbability,p4StageOnly:p4,p5DirectPassage:direct?.candidateProbability??null,p5ReachSourceChamberPassageVote:reach?.candidateProbability??null,p6ConditionalPassage:cond.probability,p6ConditionalSource:cond.source,p6ConditionalReason:cond.reason,p6EndToEnd:endToEnd,lifecycleCombinationSource:reach?'decomposed':'p4-stage-fallback'},frozenModelContentSha256:frozen.modelContentSha256,processSourceCovered:processCovered,outcomeColumnsRead:false,memberVoteLabel:null,servingChanged:false,productionAction:'none'};
      return {billId:snapshot.bill.billId,sessionId:bill.session_id,identifier:snapshot.bill.identifier,lifecycleState:snapshot.features.lifecycleState,introductionProbability,p4,p5Direct:direct?.candidateProbability??null,p5Reach:reach?.candidateProbability??null,p6Conditional:cond.probability,endToEnd,processCovered,capture,contentSha256:lifecycleP8CaptureContentSha256(capture)};
    });

    let inserted=0,identical=0;const client=await pool.connect();
    try{
      await client.query('BEGIN');
      for(const row of payloads){
        const result=await client.query(`
          INSERT INTO lifecycle_p8_prospective_captures (
            bill_id,session_id,cutoff_date,schema_version,model_content_sha256,lifecycle_state,
            introduction_probability,p4_stage_probability,p5_direct_probability,p5_reach_vote_probability,
            p6_conditional_probability,p6_end_to_end_probability,process_source_covered,capture,content_sha256
          ) VALUES ($1::uuid,$2::uuid,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)
          ON CONFLICT (bill_id,cutoff_date) DO NOTHING RETURNING content_sha256`,
          [row.billId,row.sessionId,cutoffDate,LIFECYCLE_P8_CAPTURE_SCHEMA_VERSION,frozen.modelContentSha256,row.lifecycleState,row.introductionProbability,row.p4,row.p5Direct,row.p5Reach,row.p6Conditional,row.endToEnd,row.processCovered,JSON.stringify(row.capture),row.contentSha256]);
        if(result.rowCount){inserted++;continue;}
        const existing=await client.query<{content_sha256:string}>('SELECT content_sha256 FROM lifecycle_p8_prospective_captures WHERE bill_id=$1::uuid AND cutoff_date=$2::date',[row.billId,cutoffDate]);
        if(existing.rows[0]?.content_sha256!==row.contentSha256)throw new Error('Immutable P8 capture drift for '+row.identifier+'/'+cutoffDate+'; refusing overwrite');
        identical++;
      }
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}

    const n=payloads.length, introCovered=payloads.filter(r=>r.introductionProbability!==null).length, processCovered=payloads.filter(r=>r.processCovered).length, directCovered=payloads.filter(r=>r.p5Direct!==null).length, reachCovered=payloads.filter(r=>r.p5Reach!==null).length;
    const summary={schemaVersion:LIFECYCLE_P8_CAPTURE_SCHEMA_VERSION,cutoffDateExclusive:cutoffDate,eligibleBills:n,inserted,alreadyCapturedIdentically:identical,introductionCoverage:n?introCovered/n:0,processSourceCoverage:n?processCovered/n:0,p5DirectCoverage:n?directCovered/n:0,p5ReachVoteCoverage:n?reachCovered/n:0,frozenPlanSha256:planSha,frozenModelContentSha256:frozen.modelContentSha256,outcomeColumnsRead:false,memberVoteLabelsManufactured:0,servingChanged:false,productionAction:'none'};
    await mkdir(outputDir,{recursive:true});await writeFile(join(outputDir,'summary.json'),JSON.stringify(summary,null,2)+'\n','utf8');console.log(JSON.stringify({lifecycleP8DailyCapture:summary},null,2));
  }finally{await pool.end();}
}
main().catch(error=>{console.error(safeMessage(error));process.exitCode=1;});
