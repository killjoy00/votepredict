/**
 * #864 guarded one-shot VotePredict ORIGINAL-PUBLISHER 13-quote reconciliation.
 *
 * --dry-run: one repeatable READ ONLY snapshot and ROLLBACK.
 * --apply: only from exact owner #864 issue-comment, reviewed main commit,
 * after separately green local CI. Transaction-scoped, 13 fixed originals,
 * no discovery, redirects, external media fetch, or model updates.
 *
 * Source page publication labels are NOT used as the availability date.
 * One exact GitHub Actions public original HTML GET per record was verified
 * on 2026-10-14 UTC. Its actual observed UTC instant is the evidence clock.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  verifiedSenate864,APPLY_COMMENT,assertVerifiedSenate864Ledger,
  buildSenate864ReconciliationPlan,safeSenate864Summary,
  originalUrlVariants,fullBillIdentifiers,
} from '../src/evidence/senate-864-2026-verified-positions.mjs';

const CANDIDATES=['DATABASE_URL_UNPOOLED','POSTGRES_URL_NON_POOLING','DATABASE_URL','POSTGRES_URL'];
const BRIDGE='https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const VERSION='senate-864-2026-verified-original-13-v1';
const MEMBERS_SQL=[
  'SELECT m.id::text AS "membershipId",m.district::integer AS district,l.name AS name',
  'FROM memberships m',
  'JOIN legislative_sessions s ON s.id=m.session_id',
  'JOIN chambers c ON c.id=m.chamber_id',
  'JOIN legislators l ON l.id=m.legislator_id',
  "WHERE s.slug='2025-2026' AND c.slug='senate'",
  'AND m.district::integer=ANY($1::integer[])',
  "AND COALESCE(m.starts_on,s.starts_on)<=DATE '2026-10-14'",
  "AND (COALESCE(m.ends_on,s.ends_on) IS NULL OR COALESCE(m.ends_on,s.ends_on)>=DATE '2026-10-14')",
  'ORDER BY m.district,m.id LIMIT 100',
].join(' ');
const EXISTING_SQL=[
  'SELECT sd.id::text AS "sourceDocumentId",sd.source_url AS "sourceUrl",',
  'sd.content_sha256 AS "sourceSha",sd.fetched_at::text AS "sourceFetchedAt",',
  'ei.id::text AS "evidenceId",ei.membership_id::text AS "membershipId",',
  'ei.bill_id::text AS "billId",ei.excerpt AS excerpt,ei.claim AS claim,',
  'ei.published_at::text AS "publishedAt",ei.metadata AS metadata',
  'FROM source_documents sd',
  'LEFT JOIN evidence_items ei ON ei.source_document_id=sd.id',
  'WHERE sd.source_url=ANY($1::text[])',
  'ORDER BY sd.source_url,sd.id,ei.id LIMIT 1201',
].join(' ');
const BILL_SQL=[
  'SELECT b.id::text AS "billId",b.identifier AS identifier',
  'FROM bills b JOIN legislative_sessions s ON s.id=b.session_id',
  "WHERE s.slug='2025-2026' AND upper(b.identifier)=ANY($1::text[])",
  'ORDER BY b.identifier,b.id LIMIT 26',
].join(' ');
const SCOPE_SQL=[
  'SELECT j.id::text AS "jurisdictionId",s.id::text AS "sessionId",c.id::text AS "chamberId"',
  'FROM jurisdictions j',
  "JOIN legislative_sessions s ON s.jurisdiction_id=j.id AND s.slug='2025-2026'",
  "JOIN chambers c ON c.jurisdiction_id=j.id AND c.slug='senate'",
  "WHERE j.slug='us-mn' LIMIT 2",
].join(' ');

export function requireReviewedOwnerApply(env,apply){
  if(!apply)return true;
  if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
    || env.GITHUB_EVENT_NAME!=='issue_comment'
    || env.GITHUB_REF!=='refs/heads/main'
    || env.GITHUB_RUN_ATTEMPT!=='1'
    || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')
    || env.VOTEPREDICT_864_13_APPROVAL!==APPLY_COMMENT
    || env.VOTEPREDICT_864_13_INDEPENDENT_CI!=='true'
    || env.VOTEPREDICT_864_13_EXACT_OWNER_COMMENT!=='true')
    throw Error('Only independently reviewed owner comment on main may apply the bounded 13-quote ledger');
  return true;
}
async function useDatabaseUrl(env){
  const {Pool}=await import('pg');
  for(const key of CANDIDATES){
    const url=env[key]?.trim();
    if(!url)continue;
    if(!url.startsWith('postgresql://')&&!url.startsWith('postgres://'))continue;
    const probe=new Pool({connectionString:url,max:1,connectionTimeoutMillis:7000});
    try{
      await probe.query('SELECT 1');
      return url;
    }catch{
      // Do not print candidate credentials, hosts or error details.
    }finally{await probe.end().catch(()=>undefined)}
  }
  const secret=env.CRON_SECRET?.trim();
  if(!secret)throw Error('No validated VotePredict production SQL connection from trusted environment');
  const response=await fetch(BRIDGE,{
    method:'POST',headers:{authorization:'Bearer '+secret},
    signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)throw Error('Authenticated production DB bridge did not return usable SQL access');
  const url=(await response.text()).trim();
  if(!url.startsWith('postgresql://')&&!url.startsWith('postgres://'))
    throw Error('Authenticated production bridge returned invalid database address');
  const probe=new Pool({connectionString:url,max:1,connectionTimeoutMillis:7000});
  try{await probe.query('SELECT 1')}finally{await probe.end()}
  return url;
}
function originalProvenance(c){
  return {
    schema:VERSION,contextType:'senator_public_position',
    subtype:'2026_original_caucus_personally_attributed_quote',
    verifiedStatementId:c.id,
    statementScope:c.scope,
    sourcePositionAssessment:c.sourcePositionAssessment,
    sourceBillAssociationType:c.billAssociationType,
    relatedBillIdentifier:c.relatedBillIdentifier,
    speakerAttributionCue:c.speakerAttributionCue,
    speakerAttributionMode:c.attributionMode,
    originalPublisherDisplayedDay:c.displayedPublisherDay,
    verifiedFirstPublicByUtc:c.firstIndependentlyObservedPublicAtUtc,
    firstIndependentWholeOriginalHtmlObservationUtc:c.firstIndependentlyObservedPublicAtUtc,
    verifiedOriginalWholeHtmlSha256:c.verifiedWholePublisherHtmlSha256,
    verifiedOriginalWholeHtmlBytes:c.verifiedWholePublisherHtmlBytes,
    publisherDisplayedDayNotOriginalPublicationProof:true,
    historicalOriginalPublicationTimeAuthenticated:false,
    earlierHistoricalReplayEligible:false,
    sourceVerified:true,contextOnly:true,mechanicallyActionable:false,modelWeight:0,
    exactNamedVoteIndependentlyConfirmed:false,
    qualification:c.scopeQualification,
    evidenceSeriesKey:'senate864:original_2026_direct_position:'+c.id,
  };
}
export function buildStatementRecord(item){
  const c=item.claim;
  assert.equal(item.status,'INSERT_VERIFIED_QUOTE');
  const action=c.stance==='supports'?'supported':
    c.stance==='opposes'?'opposed':
    c.stance==='mixed'?'expressed qualified or mixed views about':'commented on';
  const claim='Sen. '+c.senator+' '+action+' '+c.scope+'.';
  return {
    sourceKind:c.sourceKind,
    sourceUrl:c.sourceUrl,
    contentSha256:c.verifiedWholePublisherHtmlSha256,
    fetchedAt:c.firstIndependentlyObservedPublicAtUtc,
    membershipId:item.member.membershipId,
    billId:item.billId,
    kind:'direct_statement',stance:c.stance,claim,excerpt:c.quote,
    publishedAt:c.firstIndependentlyObservedPublicAtUtc,
    sourceQuality:'member_primary',
    relevance:item.billId?'direct':'high',
    freshness:'current',
    confidence:c.stance==='mixed'||c.stance==='unclear'?0.95:0.98,
    extractionMethod:'human-reviewed-original-caucus-direct-quote',
    extractionVersion:VERSION,
    metadata:originalProvenance(c),
  };
}
async function persistNewPosition(client,item,scope){
  const row=buildStatementRecord(item);
  const source=await client.query([
    'INSERT INTO source_documents',
    '(jurisdiction_id,session_id,chamber_id,source_kind,source_url,fetched_at,content_sha256,http_status,metadata)',
    'VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::timestamptz,$7,200,$8::jsonb)',
    'ON CONFLICT (source_url,content_sha256) DO UPDATE SET',
    'metadata=source_documents.metadata || EXCLUDED.metadata',
    'RETURNING id::text AS id',
  ].join(' '),[
    scope.jurisdictionId,scope.sessionId,scope.chamberId,
    row.sourceKind,row.sourceUrl,row.fetchedAt,row.contentSha256,
    JSON.stringify({
      sourceCohort:VERSION,firstOriginalWholeHtmlObservedAtUtc:row.fetchedAt,
      liveWholeHtmlSha256Verified:true,verifiedHtmlByteCount:item.claim.verifiedWholePublisherHtmlBytes,
      noArchivedVersionBeforeObservation:true,reviewedOriginalSpeakerQuote:true,
      publisherDisplayedDay:item.claim.displayedPublisherDay,
      noOriginalRawPublisherHtmlPersisted:true,
    }),
  ]);
  assert.equal(source.rows.length,1);
  const key=createHash('sha256').update(VERSION+'|'+row.metadata.verifiedStatementId+'|'+row.membershipId+'|'+row.contentSha256).digest('hex');
  const duplicate=await client.query([
    'SELECT id::text FROM evidence_items',
    "WHERE membership_id=$1::uuid AND metadata->>'verifiedStatementId'=$2",
    'LIMIT 2',
  ].join(' '),[row.membershipId,row.metadata.verifiedStatementId]);
  if(duplicate.rows.length)throw Error('Concurrent or historic verified statement identity exists; refuse second item');
  const result=await client.query([
    'INSERT INTO evidence_items',
    '(source_document_id,bill_id,membership_id,evidence_kind,stance,claim,excerpt,published_at,',
    'source_quality,relevance,freshness,extraction_method,extraction_version,confidence,metadata)',
    'VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::timestamptz,$9,$10,$11,$12,$13,$14,$15::jsonb)',
    'RETURNING id::text',
  ].join(' '),[
    source.rows[0].id,row.billId,row.membershipId,row.kind,row.stance,
    row.claim,row.excerpt,row.publishedAt,row.sourceQuality,row.relevance,
    row.freshness,row.extractionMethod,row.extractionVersion,row.confidence,
    JSON.stringify({...row.metadata,ingestionKey:key,durableIngestion:true}),
  ]);
  assert.equal(result.rows.length,1);
}
async function repairOneExistingTimestamp(client,item){
  assert.equal(item.status,'REPAIR_EXISTING_VERIFIED_TIMESTAMP');
  const c=item.claim,prior=item.existing;
  if(prior.sourceSha!==c.verifiedWholePublisherHtmlSha256)
    throw Error('Timestamp repair required pinned exact original source SHA');
  const result=await client.query([
    'UPDATE evidence_items',
    "SET published_at=$2::timestamptz,metadata=metadata || $3::jsonb",
    'WHERE id=$1::uuid AND source_document_id=$4::uuid',
    'AND membership_id=$5::uuid',
    'AND (published_at IS NULL OR published_at<$2::timestamptz)',
    'RETURNING id::text',
  ].join(' '),[
    prior.evidenceId,c.firstIndependentlyObservedPublicAtUtc,
    JSON.stringify({
      ...originalProvenance(c),
      previousUncertifiedStoredPublicationDate:prior.publishedAt??null,
      publicationAvailabilityRepair:'verified_original_html_oct14_2026_not_publisher_display_day',
    }),
    prior.sourceDocumentId,item.member.membershipId,
  ]);
  assert.equal(result.rows.length,1);
}

export async function reconcileVerifiedStatements(client,{apply=false}={}){
  assertVerifiedSenate864Ledger();
  const districtIds=verifiedSenate864.claims.map(x=>x.district);
  const variants=[...new Set(verifiedSenate864.claims.flatMap(c=>originalUrlVariants(c.sourceUrl)))];
  if(variants.length>110)throw Error('Too many original source lookup variants');
  await client.query(apply?
    'BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE':
    'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  let transactionOpen=true;
  try{
    await client.query("SET LOCAL statement_timeout='26000ms'");
    await client.query("SET LOCAL lock_timeout='2000ms'");
    if(apply)await client.query("SELECT pg_advisory_xact_lock(hashtextextended('votepredict-864-2026-original-13-v1',0))");
    const [membersResult,evidenceResult,billsResult,scopeResult]=await Promise.all([
      client.query(MEMBERS_SQL,[districtIds]),
      client.query(EXISTING_SQL,[variants]),
      client.query(BILL_SQL,[fullBillIdentifiers()]),
      client.query(SCOPE_SQL),
    ]);
    if(membersResult.rows.length>99||evidenceResult.rows.length>1200||
       billsResult.rows.length>25||scopeResult.rows.length!==1)
      throw Error('Refusing unexpected protected source/member catalog size');
    const plan=buildSenate864ReconciliationPlan({
      members:membersResult.rows,existingEvidence:evidenceResult.rows,
      bills:billsResult.rows,
    });
    let inserted=0,repaired=0,already=0,held=0;
    for(const item of plan){
      if(item.status==='INSERT_VERIFIED_QUOTE'){
        if(apply)await persistNewPosition(client,item,scopeResult.rows[0]);
        inserted++;
      }else if(item.status==='REPAIR_EXISTING_VERIFIED_TIMESTAMP'){
        if(apply)await repairOneExistingTimestamp(client,item);
        repaired++;
      }else if(item.status.startsWith('HOLD_'))held++;
      else already++;
    }
    if(apply){
      // A skipped HOLD is never silently written. Report exact bounded counts.
      await client.query('COMMIT');
    }else await client.query('ROLLBACK');
    transactionOpen=false;
    return {
      ...safeSenate864Summary(plan),
      mode:apply?'applied_to_vote_predict_evidence_store':'read_only_database_reconciliation_preview',
      plannedOrApplied:{inserted,repaired,already,held},
      productionEvidenceRowsActuallyUpdated:apply?inserted+repaired:0,
      originalSourceBytesCopied:0,
      forecastingOrModelChanged:false,
    };
  }catch(e){
    if(transactionOpen)await client.query('ROLLBACK').catch(()=>undefined);
    throw e;
  }
}

export async function main(){
  const apply=process.argv.includes('--apply');
  if(process.argv.some(x=>x.startsWith('--') && !['--apply','--dry-run'].includes(x)))
    throw Error('Unknown reconciliation option');
  if(apply&&process.argv.includes('--dry-run'))throw Error('Select apply OR dry run');
  requireReviewedOwnerApply(process.env,apply);
  assertVerifiedSenate864Ledger();
  const envFile=process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if(!envFile)throw Error('Trusted production environment file required for database reconciliation');
  const {parseRuntimeEnvironment}=await import('../src/operations/environment-file.js');
  const runtime=parseRuntimeEnvironment(readFileSync(envFile,'utf8'));
  const dbUrl=await useDatabaseUrl(runtime);
  const {Pool}=await import('pg');
  const pool=new Pool({connectionString:dbUrl,max:1,
    connectionTimeoutMillis:9000,statement_timeout:27000,
    application_name:'votepredict-864-original-13-reviewed-positions'});
  try{
    const client=await pool.connect();
    try{
      const report=await reconcileVerifiedStatements(client,{apply});
      console.log(JSON.stringify(report));
    }finally{client.release()}
  }finally{await pool.end()}
}

const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked)main().catch(()=>{
  // Do not print database/credential/error context into an issue or CI log.
  console.error('Verified Senate #864 13-position reconciliation stopped safely; no diagnostic data exported.');
  process.exitCode=1;
});
