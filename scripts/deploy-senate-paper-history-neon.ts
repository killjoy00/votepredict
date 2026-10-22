/** Guarded, research-only paper identity and historical source recovery. */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,appendFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {assertPaperHistoryRun} from '../src/operations/senate-paper-history-gate.js';
import {readVoteTextGapAudit,verifyVoteTextGapAudit} from '../src/operations/senate-vote-text-gap-audit.js';
import {readSameSourceQuestionRows,summarizeSameSourceFailures} from '../src/operations/senate-same-source-question-census.js';
import {readRepeatedPaperQuestionAudit} from '../src/operations/senate-repeated-paper-question-audit.js';
import {readRepeatedOriginalRollAudit} from '../src/operations/senate-repeated-paper-original-roll-audit.js';
import {readRepeatedAcceptedOriginalAudit} from '../src/operations/senate-repeated-accepted-original-audit.js';
import {readNamedMismatchOriginalAudit} from '../src/operations/senate-named-mismatch-original-audit.js';
import {readOrphanJournalOriginalAudit} from '../src/operations/senate-orphan-journal-original-audit.js';
import {readNoTallyOriginalCensus,type PreliminaryRawOriginalCandidate} from '../src/operations/senate-no-tally-original-census.js';
import {summarizeRawOriginalStrongSource} from '../src/operations/senate-raw-original-strong-source-audit.js';
import {repairNestedSenateExactLinks} from '../src/operations/senate-nested-question-exact-repair.js';
import {repairRawSenateExactLinks} from '../src/operations/senate-raw-question-exact-repair.js';
import {repairRepeatedOriginalSenateQuestions} from '../src/operations/senate-repeated-paper-exact-repair.js';
import {repairRepeatedAcceptedSenateQuestions} from '../src/operations/senate-repeated-accepted-exact-repair.js';
import {repairNamedMismatchOriginalSenateQuestions} from '../src/operations/senate-named-mismatch-exact-repair.js';
import {repairOrphanJournalOriginalQuestions} from '../src/operations/senate-orphan-journal-exact-repair.js';
import {read2022PassageRosterShadow} from '../src/operations/senate-2022-passage-roster-shadow.js';
import {repair2022UniquePassageLinks} from '../src/operations/senate-2022-passage-link-repair.js';
import {readSenateSourceCaseAudit} from '../src/operations/senate-vote-paper-case-audit.js';
import {readNestedAcceptedAudit} from '../src/operations/senate-nested-accepted-candidate-audit.js';
import {readHf100TextChainReadiness} from '../src/operations/senate-hf100-text-chain-readiness.js';
import {readSourceStateChainCensus} from '../src/operations/senate-amendment-state-chain-census.js';
import {appendHf100OriginalPrattProof,readCommittedHf100PrattShadow} from '../src/operations/senate-hf100-original-shadow.js';
import {backfillVotePapers,verifyPaperSources,connectExplicitBaseCaptures} from '../src/operations/senate-vote-paper-backfill.js';
import {stageHistoryJobs,recoverHistoricalArchives,recoverExplicitBaseBodies,collectDatedAssignmentFacts} from '../src/operations/senate-history-archive.js';
const MIGRATION='0035_senate_vote_papers_history.sql';
type Ledger={filename:string;checksum:string};
function inventory():Ledger[]{
 const files=readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort();
 if(files[34]!==MIGRATION)throw Error('Unexpected paper-history migration position');
 return files.map(filename=>({filename,checksum:createHash('sha256').update(readFileSync('migrations/'+filename)).digest('hex')}));
}
function present(rows:Ledger[],expected:Ledger[]):boolean{
 const same=(want:Ledger[])=>rows.length===want.length&&rows.every((r,i)=>r.filename===want[i]?.filename&&r.checksum===want[i]?.checksum);
 if(same(expected))return true;if(same(expected.filter(r=>r.filename!==MIGRATION)))return false;
 throw Error('Production migration checksum drift or another pending migration');
}
async function readOnly<T>(pool:Pool,identity:{database:string;role:string},fn:(db:PoolClient)=>Promise<T>){
 const db=await pool.connect();try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{const who=(await db.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro")).rows[0];
   if(who.db!==identity.database||who.role!==identity.role||who.ro!=='on')throw Error('Read-only primary identity mismatch');
   return await fn(db);
  }finally{await db.query('ROLLBACK')}
 }finally{db.release(true)}
}
async function migrate(pool:Pool,expected:Ledger[]){
 const db=await pool.connect();try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  try{
   await db.query("SET LOCAL lock_timeout='5s'");
   await db.query("SELECT pg_advisory_xact_lock(hashtext('votepredict-schema-migrations'))");
   const rows=(await db.query<Ledger>('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE')).rows;
   const already=present(rows,expected);
   if(!already){await db.query(readFileSync('migrations/'+MIGRATION,'utf8'));
    await db.query('INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES($1,$2)',[MIGRATION,expected.find(r=>r.filename===MIGRATION)!.checksum]);}
   await db.query('COMMIT');return !already;
  }catch(error){await db.query('ROLLBACK');throw error}
 }finally{db.release(true)}
}
async function main(){
 let phase='guard',pool:Pool|null=null;
 try{
  if(process.argv.length!==2||!process.env.GITHUB_EVENT_PATH)throw Error('No arguments; event payload required');
  assertPaperHistoryRun(process.env,JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')));
  const expected=inventory(),push=process.env.GITHUB_EVENT_NAME==='push';
  phase='existing_primary';
  const target=await discoverExistingVotePredictNeonConnection({apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,requirePrimary:true});
  pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,database:target.database,
   ssl:{rejectUnauthorized:true},max:2,connectionTimeoutMillis:15000,statement_timeout:180000,query_timeout:195000,
   options:'-c statement_timeout=180000 -c lock_timeout=5000',application_name:'votepredict-senate-paper-history'});
  phase='preflight';await readOnly(pool,target,async db=>{present((await db.query<Ledger>('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename')).rows,expected)});
  phase='migration';const migrationApplied=await migrate(pool,expected);
  const url=new URL('postgresql://placeholder/none');url.hostname=target.host;url.port=String(target.port);url.username=target.role;url.password=target.password;url.pathname='/'+target.database;url.searchParams.set('sslmode','verify-full');
  const drift=spawnSync('node',['--import','tsx','scripts/check-production-migration-drift.ts'],{env:{...process.env,DATABASE_URL_UNPOOLED:url.toString(),VOTEPREDICT_REQUIRE_MIGRATION_LEDGER:'1'},encoding:'utf8',maxBuffer:1024*1024});
  if(drift.error||drift.status!==0)throw Error('Production drift gate failed');
  const progress=(step:string,counts:unknown)=>console.log('SENATE_PAPER_HISTORY_PROGRESS='+JSON.stringify({step,counts}));
  progress('migration',{migrationApplied,driftPassed:true});
  phase='source_local_papers_and_dated_roles';const batches=[];
  for(let i=0;i<(push?4:1);i++){const batch=await backfillVotePapers(pool,push?1000:500);batches.push(batch);progress('paper_batch',batch);if(batch.documents===0)break;}
  phase='original_source_verification';const sourceVerification=await verifyPaperSources(pool,push?400:30,undefined,{budgetMs:push?600000:180000});progress(phase,sourceVerification);
  // The only permitted research promotion: 101 uniquely proved 2022 named
  // passage ballots, with all original-source and accepted-event identity
  // fields checked and one serializable all-or-nothing transaction.
  phase='2022_exact_original_passage_roll_repair';const passageRepair=await repair2022UniquePassageLinks(pool);progress(phase,passageRepair);
  phase='nested_original_question_exact_repair';const nestedQuestionRepair=await repairNestedSenateExactLinks(pool);progress(phase,nestedQuestionRepair);
  phase='raw_original_question_exact_repair';const rawQuestionRepair=await repairRawSenateExactLinks(pool);progress(phase,rawQuestionRepair);
  // Only 64 independently unique ORIGINAL question+complete-ballot identities
  // in the 210 duplicate-paper cohort may be appended, one atomic batch.
  phase='repeated_original_question_exact_repair';const repeatedOriginalQuestionRepair=await repairRepeatedOriginalSenateQuestions(pool);progress(phase,repeatedOriginalQuestionRepair);
  // Separate reviewed cohort: original full question+ballot uniquely
  // distinguishes accepted same-day events whose named choices repeat.
  phase='accepted_repeated_original_question_exact_repair';const repeatedAcceptedQuestionRepair=await repairRepeatedAcceptedSenateQuestions(pool);progress(phase,repeatedAcceptedQuestionRepair);
  // Protected #1498 original-source replay independently proved exactly
  // 55 source+accepted-unique named ballots despite 62 wrong stored papers.
  // This is a different, readback-bounded and SERIALIZABLE append-only batch.
  phase='original_full_named_ballot_mismatch_exact_repair';const namedMismatchRepair=await repairNamedMismatchOriginalSenateQuestions(pool);progress(phase,namedMismatchRepair);
  // Independently protected original government source audit proved exactly
  // 99 unique full question+member-ballot links from 150 entirely missing
  // bill papers; NO safe bill-ID promotions from 372 original nonbill events.
  phase='original_missing_paper_printed_bill_repair';const orphanJournalRepair=await repairOrphanJournalOriginalQuestions(pool);progress(phase,orphanJournalRepair);
  phase='explicit_base_bodies';const baseBodies=await recoverExplicitBaseBodies(pool,{max:push?60:30,retryFailedNow:push});progress(phase,baseBodies);
  phase='dated_assignment_facts';const datedAssignments=await collectDatedAssignmentFacts(pool,{retryUnavailableNow:push});progress(phase,datedAssignments);
  phase='stage_historical_sources';const historyJobs=await stageHistoryJobs(pool);progress(phase,{eligibleUrls:historyJobs});
  phase='historical_archived_bodies';const archives=await recoverHistoricalArchives(pool,{maxJobs:push?30:18});progress(phase,archives);
  phase='exact_base_connections';const baseConnections=await connectExplicitBaseCaptures(pool);
  phase='hf100_original_pratt_append_only_proof';const prattSupplement=await appendHf100OriginalPrattProof(pool);progress(phase,prattSupplement);
  phase='read_only_coverage';
  const coverage=await readOnly(pool,target,async db=>{
   const events=(await db.query('SELECT * FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind')).rows;
   const actions=(await db.query(`SELECT session_slug,kind,count(*)::int AS actions,count(proposed_text)::int AS literal_papers,
    count(*) FILTER(WHERE original_source_verified)::int AS original_verified,
    count(*) FILTER(WHERE explicit_base_locator IS NOT NULL)::int AS explicit_bases FROM senate_vote_paper_current_v GROUP BY session_slug,kind ORDER BY session_slug,kind`)).rows;
   const links=(await db.query(`SELECT (SELECT count(*)::int FROM senate_vote_paper_exact_raw_v) AS exact_raw_questions,
    (SELECT count(*)::int FROM senate_vote_paper_exact_event_v) AS exact_official_questions,
    (SELECT count(*)::int FROM senate_vote_paper_components_current_v) AS exact_base_components,
    (SELECT count(*)::int FROM senate_vote_paper_current_v WHERE complete_assembled_bill_text) AS complete_assembled_states,
    (SELECT count(*)::int FROM senate_role_history_v) AS historical_roles`)).rows[0];
   const gapAudit=await readVoteTextGapAudit(db);
   verifyVoteTextGapAudit(gapAudit,events);
   // Whole-population original-government source/day and complete-ballot
   // diagnosis of BOTH missing-bill-paper and unresolved-bill Journal cohorts.
   // Source-verified, read-only; proposals are NOT released as exact links.
   const orphanJournalAudit=await readOrphanJournalOriginalAudit(db,gapAudit);
   // All unmatched SAME original Journal URL/bill/day events: no guessed links.
   const populationRows=await readSameSourceQuestionRows(db);
   const sameSourceCensus=summarizeSameSourceFailures(
    populationRows.votes,populationRows.actions,gapAudit);
   // Protected READ ONLY question-plus-ballot disambiguation of repeated-paper holds.
   // Candidates are not links until independently replayed against original spans.
   const repeatedPaperQuestionAudit=await readRepeatedPaperQuestionAudit(db,
    populationRows.votes,populationRows.actions,sameSourceCensus);
   // Independently replay ALL physical named rolls in authenticated original
   // Journals, not the potentially lossy paper-v1 question alone. Read only.
   const repeatedPaperOriginalRollAudit=await readRepeatedOriginalRollAudit(db,
    populationRows.votes,populationRows.actions,sameSourceCensus);
   // The remaining accepted-side repeated full ballots require independent
   // physical original question identity. READ ONLY; no inferred matching.
   const repeatedAcceptedOriginalAudit=await readRepeatedAcceptedOriginalAudit(db,
    populationRows.votes,populationRows.actions,sameSourceCensus);
   // #1498: source-v1 named ballot mismatches are audited directly against
   // the entire authenticated physical original roll/printed question corpus.
   // Strictly read-only; do not assume that a tally is an event identity.
   const namedMismatchOriginalAudit=await readNamedMismatchOriginalAudit(db,
    populationRows.votes,populationRows.actions,sameSourceCensus);
   // Every unmatched source-day bill with no printed paper tally is
   // independently partitioned against authenticated ORIGINAL Journal text.
   // Entirely protected READ ONLY: no parsed actions, links or votes mutated.
   const rawPreliminary:PreliminaryRawOriginalCandidate[]=[];
   const noTallyOriginalCensus=await readNoTallyOriginalCensus(db,
    populationRows.votes,populationRows.actions,sameSourceCensus,undefined,
    candidate=>rawPreliminary.push(candidate));
   // Independent source-position + entire-original printed-ballot uniqueness.
   // This only measures raw-roll candidates; no source/action/link writes.
   const rawStrongSourceAudit=summarizeRawOriginalStrongSource(rawPreliminary,
    noTallyOriginalCensus.rawRollUniqueQuestionBallotCandidates);
   // Pure shadow reparse of independently verified, stored 2022 Journal text.
   // Strict source/ballot/question collisions must hold; NO link SQL is used.
   const passage2022RosterShadow=await read2022PassageRosterShadow(db,
    populationRows.votes,populationRows.actions,
    sameSourceCensus.focused2021Passage.passageActionWithTallyButNoBallot);
   const caseAudit=await readSenateSourceCaseAudit(db);
   const nestedCandidateAudit=await readNestedAcceptedAudit(db);
   const prattShadowReadback=await readCommittedHf100PrattShadow(db);
   const hf100TextChainReadiness=await readHf100TextChainReadiness(db);
   // #1498 next phase: complete source-local proposal/base/adoption prerequisites.
   // NOT a literal bill editor or an assembled-at-vote bill certification.
   const sourceStateChainCensus=await readSourceStateChainCensus(db);
   for(const nested of nestedCandidateAudit.cases){
    const stored=caseAudit.cases.find(c=>c.bill===nested.bill&&c.day===nested.day);
    if(!stored||stored.acceptedBillVotes!==nested.acceptedBillVotes
     ||stored.acceptedUnknownBillVotes!==nested.acceptedUnknownBillVotes)
     throw Error('Nested case audit failed original accepted vote source denominator parity');
   }

   const hf100Exact=gapAudit.hf100Pilot.filter(x=>x.evidence_stage==='exact_question')
    .reduce((n,x)=>n+x.event_count,0);
   if(caseAudit.cases.find(c=>c.bill==='HF100')?.exactBillLinks!==hf100Exact)
    throw Error('HF100 case audit failed independent exact-event parity');
   const roles=(await db.query(`SELECT s.slug AS session,h.observed_basis,count(*)::int AS observations,count(h.membership_id)::int AS linked_members,
    min(h.observed_on)::text AS first_observed,max(h.observed_on)::text AS last_observed
    FROM senate_role_history_v h JOIN legislative_sessions s ON s.id=h.session_id GROUP BY s.slug,h.observed_basis ORDER BY s.slug,h.observed_basis`)).rows;
   const roleCoverage=(await db.query(`WITH first_role AS MATERIALIZED(
    SELECT m.legislator_id,min(h.observed_on) AS first_seen,
    min(h.role_observed_on) FILTER(WHERE h.observed_basis='role.dated_roster_fetched_at') AS first_dated_fact
    FROM senate_role_history_v h JOIN memberships m ON m.id=h.membership_id GROUP BY m.legislator_id
   ), targets AS MATERIALIZED(SELECT DISTINCT v.session_id,m.id AS membership_id,m.legislator_id,v.occurred_on
    FROM member_votes mv JOIN vote_events v ON v.id=mv.vote_event_id JOIN memberships m ON m.id=mv.membership_id
    JOIN chambers c ON c.id=v.chamber_id AND c.slug='senate')
   SELECT s.slug AS session,count(*)::int AS senator_vote_days,count(*) FILTER(WHERE f.first_seen<t.occurred_on)::int AS with_earlier_dated_role_observation,
   count(*) FILTER(WHERE f.first_dated_fact<t.occurred_on)::int AS with_earlier_stated_roster_fact_without_publication_proof
   FROM targets t JOIN legislative_sessions s ON s.id=t.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
   LEFT JOIN first_role f ON f.legislator_id=t.legislator_id WHERE s.slug IN ('2021-2022','2023-2024','2025-2026') GROUP BY s.slug ORDER BY s.slug`)).rows;
   const texts=(await db.query(`SELECT s.slug AS session,c.family,count(*)::int AS captures,
    count(*) FILTER(WHERE c.archived_observed_at IS NOT NULL)::int AS archived_bodies,count(DISTINCT c.bill_id)::int AS bills
    FROM senate_official_bill_text_captures c JOIN legislative_sessions s ON s.id=c.session_id GROUP BY s.slug,c.family ORDER BY s.slug,c.family`)).rows;
   const archiveQueue=(await db.query(`SELECT s.slug AS session,q.kind,q.status,count(*)::int AS jobs,sum(q.captures)::int AS items
    FROM senate_historical_source_jobs q JOIN legislative_sessions s ON s.id=q.session_id GROUP BY s.slug,q.kind,q.status ORDER BY s.slug,q.kind,q.status`)).rows;
   const sourceAttempts=(await db.query('SELECT result,count(*)::int AS documents FROM senate_paper_source_attempts GROUP BY result ORDER BY result')).rows;
   if(!links.exact_raw_questions||!actions.some(a=>a.literal_papers>0)||!links.historical_roles)throw Error('Paper/history acceptance counts are empty');
   return {events,actions,links,gapAudit,orphanJournalAudit,sameSourceCensus,repeatedPaperQuestionAudit,repeatedPaperOriginalRollAudit,repeatedAcceptedOriginalAudit,namedMismatchOriginalAudit,noTallyOriginalCensus,rawStrongSourceAudit,passage2022RosterShadow,caseAudit,nestedCandidateAudit,prattShadowReadback,hf100TextChainReadiness,sourceStateChainCensus,roles,roleCoverage,texts,archiveQueue,sourceAttempts};
  });
  const report={status:'committed_and_readback_verified',migrationApplied,batches,sourceVerification,passageRepair,nestedQuestionRepair,rawQuestionRepair,repeatedOriginalQuestionRepair,repeatedAcceptedQuestionRepair,namedMismatchRepair,orphanJournalRepair,baseBodies,datedAssignments,historyJobs,archives,baseConnections,prattSupplement,coverage,
   officialVotesUnchanged:true,sourceBodiesUnchanged:true,servingModelsUnchanged:true,completeStateClaims:false};
  console.log('SENATE_PAPER_HISTORY_PRODUCTION='+JSON.stringify(report));
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'Senate paper identity and historical evidence coverage\n'+JSON.stringify(report,null,2)+'\n');
 }catch(error){
  const code=(error as {code?:unknown}).code;
  console.error('SENATE_PAPER_HISTORY_HELD='+JSON.stringify({phase,sqlState:typeof code==='string'&&/^[A-Z0-9]{5}$/.test(code)?code:'none'}));process.exitCode=1;
 }finally{if(pool)try{await pool.end()}catch{process.exitCode=1}}
}
void main();
