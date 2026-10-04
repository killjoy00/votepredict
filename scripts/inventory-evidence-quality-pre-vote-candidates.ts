import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { EVIDENCE_QUALITY_SOURCE_KINDS, EVIDENCE_QUALITY_TEXT_VERSION } from '../src/evidence/evidence-quality.js';
import { resolveEvidenceQualityAvailability } from '../src/evidence/evidence-quality-historical-availability.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const EXPECTED_TARGET_ROWS = 135457;
const EXPECTED_COVERED_ROWS = 17;
let secrets: string[] = [];

type TargetRow = {
  voteEventId: string;
  membershipId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
};

type MatrixRow = {
  voteEventId: string;
  membershipId: string;
  features: number[];
};

type CandidateRow = {
  source_document_id: string;
  source_kind: string;
  source_url: string;
  content_sha256: string;
  source_metadata: Record<string, unknown> | null;
  evidence_metadata: Record<string, unknown> | null;
  source_session: string | null;
  membership_id: string;
  bill_id: string;
  evidence_id: string;
  evidence_excerpt: string | null;
  published_at: string | null;
  source_document_text_id: string | null;
  extraction_version: string | null;
};

type SourceCandidate = {
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  contentSha256: string;
  availableOn: string;
  sourceSession: string | null;
  sourceDocumentTextId: string | null;
  textReady: boolean;
  coverageRowKeys: Set<string>;
  newCoverageRowKeys: Set<string>;
  newCoverageEvents: Set<string>;
  newCoverageMemberships: Set<string>;
  newCoverageBySession: Map<string, number>;
  targetPairs: Set<string>;
};

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 2400);
}

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');
  async function works(value: string) {
    const candidate = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8000 });
    try {
      await candidate.query('select 1');
      return true;
    } catch {
      return false;
    } finally {
      await candidate.end().catch(() => undefined);
    }
  }
  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await works(value)) return value;
  }
  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET unavailable');
  const response = await fetch(DATABASE_BRIDGE_URL, { method: 'POST', headers: { authorization: 'Bearer ' + secret } });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

function validDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0,10) === value;
}

function loadTargets(path: string): TargetRow[] {
  const rows = readFileSync(path,'utf8').split('\n').filter(Boolean).map((line)=>JSON.parse(line) as TargetRow);
  if (rows.length !== EXPECTED_TARGET_ROWS) throw new Error(`Target row count mismatch: ${rows.length}`);
  return rows;
}

function loadCovered(path: string): Set<string> {
  const raw = path.endsWith('.gz') ? gunzipSync(readFileSync(path)).toString('utf8') : readFileSync(path,'utf8');
  const rows = raw.split('\n').filter(Boolean).map((line)=>JSON.parse(line) as MatrixRow);
  if (rows.length !== EXPECTED_TARGET_ROWS) throw new Error(`Matrix row count mismatch: ${rows.length}`);
  const covered = new Set(rows.filter((row)=>Number(row.features?.[0] ?? 0) > 0).map((row)=>row.voteEventId+'|'+row.membershipId));
  if (covered.size !== EXPECTED_COVERED_ROWS) throw new Error(`Expected ${EXPECTED_COVERED_ROWS} covered rows, found ${covered.size}`);
  return covered;
}

function sourceSummary(candidate: SourceCandidate) {
  return {
    sourceDocumentId: candidate.sourceDocumentId,
    sourceKind: candidate.sourceKind,
    sourceUrl: candidate.sourceUrl,
    contentSha256: candidate.contentSha256,
    availableOn: candidate.availableOn,
    sourceSession: candidate.sourceSession,
    sourceDocumentTextId: candidate.sourceDocumentTextId,
    textReady: candidate.textReady,
    targetPairs: candidate.targetPairs.size,
    potentialCoverageRows: candidate.coverageRowKeys.size,
    newCoverageRows: candidate.newCoverageRowKeys.size,
    newCoverageEvents: candidate.newCoverageEvents.size,
    newCoverageMemberships: candidate.newCoverageMemberships.size,
    newCoverageBySession: Object.fromEntries([...candidate.newCoverageBySession.entries()].sort(([a],[b])=>a.localeCompare(b))),
  };
}

function greedySelect(candidates: SourceCandidate[], limit: number) {
  const selected: Array<ReturnType<typeof sourceSummary> & { marginalRows: number; cumulativeRows: number }> = [];
  const covered = new Set<string>();
  const remaining = [...candidates];
  while (selected.length < limit && remaining.length) {
    remaining.sort((a,b)=>{
      const aMarginal=[...a.newCoverageRowKeys].filter((key)=>!covered.has(key)).length;
      const bMarginal=[...b.newCoverageRowKeys].filter((key)=>!covered.has(key)).length;
      if (bMarginal !== aMarginal) return bMarginal-aMarginal;
      const aTrain=[...a.newCoverageRowKeys].filter((key)=>!covered.has(key) && key.includes('')).length;
      void aTrain;
      return a.availableOn.localeCompare(b.availableOn) || a.sourceDocumentId.localeCompare(b.sourceDocumentId);
    });
    const candidate=remaining.shift()!;
    const marginal=[...candidate.newCoverageRowKeys].filter((key)=>!covered.has(key));
    if (!marginal.length) break;
    for(const key of marginal) covered.add(key);
    selected.push({...sourceSummary(candidate),marginalRows:marginal.length,cumulativeRows:covered.size});
  }
  return { selected, coveredRows: covered.size };
}

async function main() {
  const envFile=process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const targetPath=process.env.VOTEPREDICT_EQ_TARGET_UNIVERSE_PATH;
  const matrixPath=process.env.VOTEPREDICT_EQ_CURRENT_MATRIX_PATH;
  const outputDir=process.env.VOTEPREDICT_EQ_CANDIDATE_INVENTORY_DIR;
  if(!envFile||!targetPath||!matrixPath||!outputDir) throw new Error('Production env, target universe, current matrix, and output dir required');

  const targets=loadTargets(targetPath);
  const covered=loadCovered(matrixPath);
  const targetByPair=new Map<string,TargetRow[]>();
  for(const row of targets){
    const key=row.membershipId+'|'+row.billId;
    const values=targetByPair.get(key)??[];
    values.push(row);
    targetByPair.set(key,values);
  }

  const env=parseRuntimeEnvironment(readFileSync(envFile,'utf8'));
  secrets=Object.entries(env).filter(([key])=>/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key)).map(([,value])=>value).filter((value):value is string=>typeof value==='string');
  secrets.forEach(mask);
  process.env.DATABASE_URL=await chooseDb(env);
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool }=await import('../src/lib/db/index.js');
  const client=await pool.connect();
  try{
    await client.query('BEGIN READ ONLY');
    const result=await client.query<CandidateRow>(`
      SELECT sd.id::text AS source_document_id,
             sd.source_kind,
             sd.source_url,
             sd.content_sha256,
             sd.metadata AS source_metadata,
             ei.metadata AS evidence_metadata,
             ls.slug AS source_session,
             ei.membership_id::text,
             ei.bill_id::text,
             ei.id::text AS evidence_id,
             ei.excerpt AS evidence_excerpt,
             ei.published_at::text,
             sdt.id::text AS source_document_text_id,
             sdt.extraction_version
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        LEFT JOIN legislative_sessions ls ON ls.id=sd.session_id
        LEFT JOIN source_document_texts sdt
          ON sdt.source_document_id=sd.id
         AND sdt.extraction_version=$1
       WHERE ei.membership_id IS NOT NULL
         AND ei.bill_id IS NOT NULL
         AND sd.source_kind = ANY($2::text[])
         AND NOT EXISTS (
           SELECT 1 FROM evidence_quality_annotations eqa
            WHERE eqa.source_document_id=sd.id
              AND eqa.schema_version='evidence-quality-v1'
              AND eqa.prompt_version='evidence-quality-prompt-v1'
              AND eqa.classifier_provider='manual-openai'
         )
       ORDER BY sd.id,ei.membership_id,ei.bill_id`, [EVIDENCE_QUALITY_TEXT_VERSION,[...EVIDENCE_QUALITY_SOURCE_KINDS]]);

    const bySource=new Map<string,SourceCandidate>();
    let rowsMissingAvailability=0;
    let rowsOutsideTargetUniverse=0;
    let rowsOnlyPostOrSameDay=0;
    const missingAvailabilityBySourceKind:Record<string,number>={};
    const missingAvailabilityPotentialBySource=new Map<string,{sourceDocumentId:string;sourceKind:string;sourceUrl:string;contentSha256:string;publishedOn:string;rowKeys:Set<string>;sessions:Set<string>;targets:Map<string,{voteEventId:string;membershipId:string;billId:string;identifier:string;occurredOn:string;session:string;evidenceIds:Set<string>;excerpts:Set<string>}>}>();

    for(const row of result.rows){
      const availability=resolveEvidenceQualityAvailability({
        sourceMetadata:row.source_metadata,
        sourceUrl:row.source_url,
        sourceContentSha256:row.content_sha256,
        evidenceMetadata:row.evidence_metadata,
        evidenceExcerpt:row.evidence_excerpt,
      });
      const availableOn=availability.availableOn;
      if(!availableOn){
        rowsMissingAvailability+=1;
        missingAvailabilityBySourceKind[row.source_kind]=(missingAvailabilityBySourceKind[row.source_kind]??0)+1;
        const publishedOn=row.published_at && Number.isFinite(Date.parse(row.published_at)) ? row.published_at.slice(0,10) : null;
        const targetRows=targetByPair.get(row.membership_id+'|'+row.bill_id)??[];
        if(publishedOn && validDateOnly(publishedOn)){
          for(const target of targetRows){
            const rowKey=target.voteEventId+'|'+target.membershipId;
            if(publishedOn>=target.occurredOn || covered.has(rowKey)) continue;
            const current=missingAvailabilityPotentialBySource.get(row.source_document_id)??{
              sourceDocumentId:row.source_document_id,
              sourceKind:row.source_kind,
              sourceUrl:row.source_url,
              contentSha256:row.content_sha256,
              publishedOn,
              rowKeys:new Set<string>(),
              sessions:new Set<string>(),
              targets:new Map(),
            };
            current.rowKeys.add(rowKey);
            current.sessions.add(target.session);
            const targetProof=current.targets.get(rowKey)??{voteEventId:target.voteEventId,membershipId:target.membershipId,billId:target.billId,identifier:target.identifier,occurredOn:target.occurredOn,session:target.session,evidenceIds:new Set<string>(),excerpts:new Set<string>()};
            targetProof.evidenceIds.add(row.evidence_id);
            if(row.evidence_excerpt?.trim())targetProof.excerpts.add(row.evidence_excerpt.trim());
            current.targets.set(rowKey,targetProof);
            missingAvailabilityPotentialBySource.set(row.source_document_id,current);
          }
        }
        continue;
      }
      const targetRows=targetByPair.get(row.membership_id+'|'+row.bill_id)??[];
      if(!targetRows.length){rowsOutsideTargetUniverse+=1;continue;}
      const preVote=targetRows.filter((target)=>availableOn<target.occurredOn);
      if(!preVote.length){rowsOnlyPostOrSameDay+=1;continue;}

      let candidate=bySource.get(row.source_document_id);
      if(!candidate){
        candidate={
          sourceDocumentId:row.source_document_id,
          sourceKind:row.source_kind,
          sourceUrl:row.source_url,
          contentSha256:row.content_sha256,
          availableOn,
          sourceSession:row.source_session,
          sourceDocumentTextId:row.source_document_text_id,
          textReady:row.extraction_version===EVIDENCE_QUALITY_TEXT_VERSION,
          coverageRowKeys:new Set(),
          newCoverageRowKeys:new Set(),
          newCoverageEvents:new Set(),
          newCoverageMemberships:new Set(),
          newCoverageBySession:new Map(),
          targetPairs:new Set(),
        };
        bySource.set(row.source_document_id,candidate);
      } else if (availableOn < candidate.availableOn) {
        candidate.availableOn=availableOn;
      }
      candidate.targetPairs.add(row.membership_id+'|'+row.bill_id);
      for(const target of preVote){
        const rowKey=target.voteEventId+'|'+target.membershipId;
        candidate.coverageRowKeys.add(rowKey);
        if(covered.has(rowKey)) continue;
        if(!candidate.newCoverageRowKeys.has(rowKey)){
          candidate.newCoverageRowKeys.add(rowKey);
          candidate.newCoverageEvents.add(target.voteEventId);
          candidate.newCoverageMemberships.add(target.membershipId);
          candidate.newCoverageBySession.set(target.session,(candidate.newCoverageBySession.get(target.session)??0)+1);
        }
      }
    }

    const candidates=[...bySource.values()].filter((candidate)=>candidate.newCoverageRowKeys.size>0);

    const exactDedupGroups=new Map<string,SourceCandidate[]>();
    for(const candidate of candidates){
      const key=candidate.sourceKind+'|'+candidate.contentSha256;
      const values=exactDedupGroups.get(key)??[];
      values.push(candidate);
      exactDedupGroups.set(key,values);
    }

    const deduped:SourceCandidate[]=[];
    const duplicateGroups:Array<Record<string,unknown>>=[];
    for(const [key,values] of exactDedupGroups){
      values.sort((a,b)=>a.availableOn.localeCompare(b.availableOn)||a.sourceDocumentId.localeCompare(b.sourceDocumentId));
      const representative=values[0];
      if(values.length>1){
        for(const duplicate of values.slice(1)){
          for(const rowKey of duplicate.coverageRowKeys) representative.coverageRowKeys.add(rowKey);
          for(const rowKey of duplicate.newCoverageRowKeys) representative.newCoverageRowKeys.add(rowKey);
          for(const eventId of duplicate.newCoverageEvents) representative.newCoverageEvents.add(eventId);
          for(const membershipId of duplicate.newCoverageMemberships) representative.newCoverageMemberships.add(membershipId);
          for(const pair of duplicate.targetPairs) representative.targetPairs.add(pair);
          representative.textReady ||= duplicate.textReady;
          representative.sourceDocumentTextId ||= duplicate.sourceDocumentTextId;
        }
        duplicateGroups.push({dedupKey:key,representativeSourceDocumentId:representative.sourceDocumentId,sourceDocumentIds:values.map((value)=>value.sourceDocumentId)});
      }
      representative.newCoverageBySession=new Map();
      for(const target of targets){
        const rowKey=target.voteEventId+'|'+target.membershipId;
        if(representative.newCoverageRowKeys.has(rowKey)) representative.newCoverageBySession.set(target.session,(representative.newCoverageBySession.get(target.session)??0)+1);
      }
      deduped.push(representative);
    }

    const ordinary=deduped.filter((candidate)=>candidate.sourceKind!=='house_session_daily');
    const sessionDaily=deduped.filter((candidate)=>candidate.sourceKind==='house_session_daily');
    const ordinaryGreedy=greedySelect(ordinary,100);
    const sessionGreedy=greedySelect(sessionDaily,100);

    const sourceKindSummary:Record<string,{sources:number;newCoverageRows:number;textReady:number}>= {};
    for(const candidate of deduped){
      const summary=sourceKindSummary[candidate.sourceKind]??{sources:0,newCoverageRows:0,textReady:0};
      summary.sources+=1;
      summary.newCoverageRows+=candidate.newCoverageRowKeys.size;
      if(candidate.textReady) summary.textReady+=1;
      sourceKindSummary[candidate.sourceKind]=summary;
    }

    const report={
      schemaVersion:'evidence-quality-pre-vote-candidate-inventory-v1.3',
      generatedAt:new Date().toISOString(),
      issue:579,
      targetUniverse:{rows:targets.length,currentCoveredRows:covered.size},
      sourceRowsScanned:result.rows.length,
      exclusions:{rowsMissingAvailability,rowsOutsideTargetUniverse,rowsOnlyPostOrSameDay},
      missingAvailabilityDiagnostic:{
        bySourceKind:missingAvailabilityBySourceKind,
        sourcesWithStoredPublishedAtThatCouldAddRows:missingAvailabilityPotentialBySource.size,
        potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated:new Set([...missingAvailabilityPotentialBySource.values()].flatMap((candidate)=>[...candidate.rowKeys])).size,
        candidates:[...missingAvailabilityPotentialBySource.values()].map((candidate)=>({
          sourceDocumentId:candidate.sourceDocumentId,
          sourceKind:candidate.sourceKind,
          sourceUrl:candidate.sourceUrl,
          contentSha256:candidate.contentSha256,
          publishedOn:candidate.publishedOn,
          potentialNewRows:candidate.rowKeys.size,
          sessions:[...candidate.sessions].sort(),
          potentialTargets:[...candidate.targets.values()].map((target)=>({...target,evidenceIds:[...target.evidenceIds].sort(),excerpts:[...target.excerpts].sort()})).sort((a,b)=>a.occurredOn.localeCompare(b.occurredOn)||a.voteEventId.localeCompare(b.voteEventId)||a.membershipId.localeCompare(b.membershipId)),
        })).sort((a,b)=>b.potentialNewRows-a.potentialNewRows||a.publishedOn.localeCompare(b.publishedOn)||a.sourceDocumentId.localeCompare(b.sourceDocumentId)),
        interpretation:'diagnostic only: evidence_items.published_at is not promoted to historical availability proof without independent provenance validation',
      },
      candidates:{
        sourceDocumentsBeforeExactDedup:candidates.length,
        exactContentDuplicateGroups:duplicateGroups.length,
        dedupedSourceDocuments:deduped.length,
        ordinarySourceDocuments:ordinary.length,
        houseSessionDailySourceDocuments:sessionDaily.length,
        bySourceKind:sourceKindSummary,
      },
      recommendedOrdinaryCohort:{
        limit:100,
        sources:ordinaryGreedy.selected.length,
        potentialNewRows:ordinaryGreedy.coveredRows,
        rows:ordinaryGreedy.selected,
      },
      recommendedHouseSessionDailyCohort:{
        limit:100,
        sources:sessionGreedy.selected.length,
        potentialNewRows:sessionGreedy.coveredRows,
        rows:sessionGreedy.selected,
      },
      allCandidates:deduped.map(sourceSummary).sort((a,b)=>b.newCoverageRows-a.newCoverageRows||a.availableOn.localeCompare(b.availableOn)||a.sourceDocumentId.localeCompare(b.sourceDocumentId)),
      exactContentDuplicateGroups:duplicateGroups,
      policy:{
        outcomeUse:'none',
        strictPreVoteAvailability:true,
        availabilityResolution:'exact evidence_items.metadata excerpt proof first; source_documents.metadata fallback',
        evidenceItemScopedProofNeverPromotedSourceWide:true,
        sameDayExcluded:true,
        alreadyAnnotatedSourcesExcluded:true,
        currentV12CoveredRowsExcludedFromMarginalRanking:true,
        exactContentDedup:true,
        houseSessionDailySeparated:true,
        modelFitting:'none',
        servingChanged:false,
      },
    };

    mkdirSync(outputDir,{recursive:true});
    writeFileSync(resolve(outputDir,'evidence-quality-pre-vote-candidate-inventory-v1.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({
      evidenceQualityPreVoteCandidateInventory:{
        targetRows:targets.length,
        currentCoveredRows:covered.size,
        sourceRowsScanned:result.rows.length,
        candidateSources:candidates.length,
        dedupedCandidateSources:deduped.length,
        ordinarySources:ordinary.length,
        houseSessionDailySources:sessionDaily.length,
        ordinaryRecommendedSources:ordinaryGreedy.selected.length,
        ordinaryPotentialNewRows:ordinaryGreedy.coveredRows,
        houseSessionDailyRecommendedSources:sessionGreedy.selected.length,
        houseSessionDailyPotentialNewRows:sessionGreedy.coveredRows,
        bySourceKind:sourceKindSummary,
        missingAvailabilityBySourceKind,
        missingAvailabilitySourcesWithPotentialPublishedAtCoverage:missingAvailabilityPotentialBySource.size,
        missingAvailabilityPotentialNewRowsIfPublishedAtValidated:new Set([...missingAvailabilityPotentialBySource.values()].flatMap((candidate)=>[...candidate.rowKeys])).size,
        outcomeUse:'none',
        modelFitting:'none',
        servingChanged:false,
      }
    },null,2));

    await client.query('ROLLBACK');
  }finally{
    client.release();
    await pool.end();
  }
}

main().catch((error)=>{console.error(safe(error));process.exitCode=1;});
