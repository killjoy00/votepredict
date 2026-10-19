/** One bounded maintained reconciliation; no source crawl, write, labels or outcome testing. */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.ts';
import {ROSTER_SQL,PUBLIC95} from './audit-senate-864-95-historical-source-neon-readonly.mjs';
import {SOURCE_LEDGER_FILES} from '../src/evidence/senate-864-95-historical-source-neon-parity.mjs';
import {buildRecoveryPlan} from './build-senate-864-95-missing-original-recovery-plan.mjs';
import {websiteExcerptPlan} from '../src/evidence/senate-864-historical-site-excerpt-asof.mjs';
import {candidateSiteDrafts,membershipIndex} from '../src/evidence/senate-864-website-signal-neon.mjs';
import {source830,QUERIES,safeCounts} from '../src/evidence/cfb-864-finance-db-reconciliation-v47.mjs';
import {registry830,VERIFY_SQL,REVALIDATE_SQL,safeRevalidation} from '../src/evidence/cfb-864-pdf-registry-eligibility-v48.mjs';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {getTrackDHistoricalShadowPins,getTrackDPublicSpeakerTimingQueue} from './audit-senate-media-track-d-cross-ingester-readonly-v3.ts';
import {TRACK_D_CROSS_SOURCE_SQL,summarizeTrackDCrossSource} from '../src/evaluation/senate-media-track-d-cross-ingester-audit.ts';
import {buildSenate864ReconciliationPlan,safeSenate864Summary,assertVerifiedSenate864Ledger} from '../src/evidence/senate-864-2026-verified-positions.mjs';
import {auditWebsiteReadback,mediaAccounting,sha,COMPLETION_WEBSITE_SQL,COHORT_COUNTS_SQL,MEDIA_CONTEXT_SQL,
 FINANCE_CANONICAL_SQL,FINANCE_REGISTRY_SQL,COMMITTEE_YEAR_SQL,DIRECT_STATEMENT_SQL,safeGroupedCounts} from '../src/evidence/senate-864-completion-audit.mjs';
export const MARKER='SENATE_864_AUTHORITATIVE_COMPLETION_READBACK_20261019_V1';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
export function completionInputs(){
 const manifest=read(PUBLIC95),docs=new Map(SOURCE_LEDGER_FILES.map(p=>[p,read(p)]));
 const excerpts=websiteExcerptPlan(manifest,docs,buildRecoveryPlan().witnesses);
 if(excerpts.ready.length!==616||excerpts.holds.length!==581)throw Error('Fixed literal source cohort changed');
 const protocolPath='docs/evaluation/senate-864-website-experiment-protocol-v1.json';
 const protocol=read(protocolPath),protocolSha256=sha(readFileSync(protocolPath));
 if(!protocol.frozenBeforeOutcomeTesting||protocol.scope.provenanceReady!==616)throw Error('Protocol not frozen');
 const pins=getTrackDHistoricalShadowPins();
 return {manifest,excerpts,protocolSha256,pins,publicSpeakerReview:getTrackDPublicSpeakerTimingQueue(pins),source:source830(),
  seeds:read('data/sources/local-trade-news-v1.json').sources,claims:assertVerifiedSenate864Ledger()};
}
const integerRows=(rows,groups,metrics,allowed,max=100)=>safeGroupedCounts(rows,groups,metrics,{allowed,max});
export async function completionAudit(client,target,inputs){
 let active=false;
 try{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');active=true;
  const who=(await client.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];
  if(who?.db!==target.database||who.role!==target.role||who.ro!=='on'||who.isolation!=='repeatable read')throw Error('Verified RR read-only identity required');
  const roster=(await client.query(ROSTER_SQL)).rows;
  if(roster.length>=1001)throw Error('Truncated historic roster');
  const plans=candidateSiteDrafts(inputs.manifest,roster,inputs.excerpts);
  const personByMembership=new Map(roster.map(r=>[r.membershipId,r.legislatorId]));
  const stored=(await client.query(COMPLETION_WEBSITE_SQL,[plans.map(p=>p.key)])).rows;
  const website=auditWebsiteReadback(stored,plans,personByMembership);
  const qualified=website.privateDeduplicated;
  const cohort=integerRows((await client.query(COHORT_COUNTS_SQL,[JSON.stringify(qualified.map(p=>({person:p.legislatorId,observed_at:p.observedAt})))])).rows,
   ['year'],['target_member_bills','unknown_service_targets','qualified_member_bills','qualified_bills','qualified_people'],{year:[2021,2022,2023,2024,2025]},5);
  const finance={};
  const registry=registry830();
  const parity=(await client.query(VERIFY_SQL,[JSON.stringify(registry)])).rows;
  if(parity.length!==1||Object.keys(parity[0]).sort().join('|')!==['stored','indexed','exact','missing','distinct_bodies'].sort().join('|')||
   Object.values(parity[0]).some(n=>!/^\d+$/.test(n)))throw Error('Registry safe parity output invalid');
  finance.exactRegistryReadback=Object.fromEntries(Object.entries(parity[0]).map(([k,v])=>[k,Number(v)]));
  finance.legacyEligibilityTriage=safeRevalidation((await client.query(REVALIDATE_SQL,[JSON.stringify(registry)])).rows);
  for(const [name,sql] of Object.entries(QUERIES))finance[name]=safeCounts(name,(await client.query(sql,sql.includes('$1::jsonb')?[JSON.stringify(inputs.source)]:[])).rows);
  finance.canonical=integerRows((await client.query(FINANCE_CANONICAL_SQL)).rows,['year','family'],
   ['evidence_copies','canonical_transactions','copies_missing_canonical_identity','legacy_eligible_copies','unclassified_contributor_type_copies','copies_in_indexed_committee_years','canonical_in_indexed_committee_years'],
   {year:['2021','2022','2023','2024','2025'],family:['candidate_contribution','candidate_expenditure','independent_expenditure','category_mismatch']},20);
  finance.registry=integerRows((await client.query(FINANCE_REGISTRY_SQL)).rows,['year'],['versions','pdf_bodies','tracked_historical_version_public_by_proofs','versions_with_cached_bodies'],{year:[2021,2022,2023,2024,2025]},5);
  const committee=integerRows((await client.query(COMMITTEE_YEAR_SQL)).rows,['year'],['stored_events','declared_named_events','explicit_stored_choices','hearing_date_timing_events'],{year:[2021,2022,2023,2024,2025]},5);
  const mediaRows=(await client.query(MEDIA_CONTEXT_SQL)).rows;
  if(mediaRows.length>=2001)throw Error('Truncated media scope');
  const media=mediaAccounting(mediaRows,inputs.manifest,inputs.seeds);
  const params=JSON.stringify(inputs.pins.map(p=>({public_id:p.publicId,original_url:p.originalUrl,archive_url:p.archiveUrl,candidate_alias_url:p.candidateDatedAlias,raw_sha256:p.rawSha256})));
  const matched=(await client.query(TRACK_D_CROSS_SOURCE_SQL,[params])).rows;
  const denominators=(await client.query('SELECT (SELECT count(*)::int FROM source_documents) AS stored_source_documents,(SELECT count(DISTINCT source_kind)::int FROM source_documents) AS stored_source_kinds,(SELECT count(*)::int FROM evidence_items) AS stored_evidence_items LIMIT 1')).rows[0];
  media.existingSelectedOriginalCrosswalk=summarizeTrackDCrossSource(inputs.pins,denominators,matched);
  const direct=(await client.query(DIRECT_STATEMENT_SQL)).rows;
  if(direct.length>=10001)throw Error('Truncated declared direct statement scope');
  const peopleIndex=new Map();for(const [ordinal,copies] of membershipIndex(inputs.manifest,roster))for(const r of copies)peopleIndex.set(r.legislatorId,ordinal);
  // Keep observed declarations separate from independent source certifications.
  const declared=new Map();let unknownDeclaredIdentity=0;
  for(const d of direct){
   const ordinal=peopleIndex.get(d.legislatorId)||0;if(!ordinal)unknownDeclaredIdentity++;
   const year=new Date(d.publishedAt).getUTCFullYear();
   const source=['member_primary_article','senate_member_primary_historical_article','public_news_article','wayback_local_trade_news','wayback_member_primary'].includes(d.sourceKind)?d.sourceKind:'other';
   const k=[ordinal,year,source].join('|');if(!declared.has(k))declared.set(k,{personOrdinal:ordinal,storedAvailabilityYear:year,sourceFamily:source,declaredDirectRows:0});declared.get(k).declaredDirectRows++;
  }
  const members=(await client.query(`SELECT m.id::text AS "membershipId",m.district::int AS district,l.name FROM memberships m
   JOIN legislators l ON l.id=m.legislator_id JOIN legislative_sessions s ON s.id=m.session_id JOIN chambers c ON c.id=m.chamber_id
   WHERE s.slug='2025-2026' AND c.slug='senate' AND m.district::int=ANY($1::int[]) ORDER BY m.district LIMIT 151`,[inputs.claims.map(c=>c.district)])).rows;
  const bills=(await client.query(`SELECT b.id::text AS "billId",b.identifier FROM bills b JOIN legislative_sessions s ON s.id=b.session_id
   WHERE s.slug='2025-2026' AND b.identifier IN ('SF3602','SF5032','SF5101') LIMIT 26`)).rows;
  const currentPlan=buildSenate864ReconciliationPlan({members,bills,existingEvidence:direct.filter(d=>inputs.claims.some(c=>c.sourceUrl===d.sourceUrl)).map(d=>({...d,publishedAt:new Date(d.publishedAt).toISOString()}))});
  media.later2026SelectedImport=safeSenate864Summary(currentPlan);
  media.later2026LiteralAndFlagReadback=inputs.claims.filter(c=>{
   const got=direct.filter(d=>d.metadata?.verifiedStatementId===c.id);
   return got.length===1&&got[0].excerpt===c.quote&&got[0].sourceSha===c.verifiedWholePublisherHtmlSha256
    &&new Date(got[0].publishedAt).toISOString()===c.firstIndependentlyObservedPublicAtUtc
    &&got[0].metadata.contextOnly===true&&got[0].metadata.mechanicallyActionable===false&&got[0].metadata.modelWeight===0
    &&got[0].metadata.earlierHistoricalReplayEligible===false;
  }).length;
  media.later2026NotHistoricalPublicationProof=true;
  media.declaredDirectStatementCells=[...declared.values()];media.unknownDeclaredIdentity=unknownDeclaredIdentity;
  await client.query('ROLLBACK');active=false;
  return {version:'senate864-authoritative-readback-v1',auditedAt:new Date().toISOString(),reviewedCommit:process.env.GITHUB_SHA,
   protocolSha256:inputs.protocolSha256,verifiedRepeatableReadReadOnly:true,explicitRollback:true,noWritesOrOutcomeTesting:true,
   website:website.summary,websiteHoldReasons:inputs.excerpts.holdCounts,preparedCohort:cohort,finance,committee,media};
 }finally{if(active)await client.query('ROLLBACK')}
}
async function main(){
 let phase='fixed_public_sources_and_protocol',pool;
 try{
  if(!['--preflight','--protected'].includes(process.argv[2])||process.argv.length!==3)throw Error('Fixed modes only');
  const inputs=completionInputs();
  if(process.argv[2]==='--preflight'){console.log('SENATE864_FIXED_COMPLETION_INPUTS_OK protocol='+inputs.protocolSha256);return;}
  const e=process.env,event=read(e.GITHUB_EVENT_PATH||'');
  assertHistoricalMainPush({...e,VOTEPREDICT_864_72_INDEPENDENT_CI:e.SENATE864_INDEPENDENT_MAIN},event);
  if(!event.head_commit.message.includes(MARKER))throw Error('Reviewed scope marker absent');
  phase='existing_primary_neon_discovery';
  const target=await discoverExistingVotePredictNeonConnection({apiKey:e.NEON_API_KEY||'',projectId:e.VOTEPREDICT_NEON_PROJECT_ID||'',preferredDatabase:e.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,database:target.database,ssl:{rejectUnauthorized:true},max:1,
   connectionTimeoutMillis:10000,statement_timeout:85000,query_timeout:90000,options:'-c default_transaction_read_only=on -c lock_timeout=2500',application_name:'senate864-authoritative-readback'});
  phase='bounded_verified_readonly_reconciliation';const client=await pool.connect();let receipt;
  try{receipt=await completionAudit(client,target,inputs)}finally{client.release(true)}
  phase='allowlisted_aggregate_only_receipt';
  const body=JSON.stringify(receipt,null,2);
  if(body.length>400000||/(?:postgres(?:ql)?:\/\/|"(?:membershipId|legislatorId|sourceSha|excerpt|rawBody|password|sourceDocumentId)"\s*:)/i.test(body))throw Error('Private receipt field rejected');
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/senate864-completion-readback.json',body+'\n');
  console.log('SENATE864_COMPLETION_READBACK='+JSON.stringify({website:receipt.website,cohort:receipt.preparedCohort,
   financeYearFamilies:receipt.finance.canonical.length,committeeYears:receipt.committee.length,mediaContexts:receipt.media.rows,explicitRollback:true,protocolSha256:receipt.protocolSha256}));
 }catch{console.error('SENATE864_COMPLETION_HOLD_AT='+phase);process.exitCode=1}
 finally{if(pool)await pool.end()}
}
if(process.argv[1]?.endsWith('/audit-senate-864-completion-readonly.mjs'))void main();
