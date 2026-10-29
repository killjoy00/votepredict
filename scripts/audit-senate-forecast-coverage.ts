/** Explicit invocation only; no imports from forecast serving or job scheduling. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {COVERAGE_VERSION,ISSUE_CROSSWALK,SENATE_COVERAGE_SQL,COVERAGE_DENOMINATORS_SQL,
 verifyCoverage,type CoverageCell,type CoverageDenominator} from '../src/operations/senate-forecast-coverage';
import {VOTE_TEXT_GAP_SQL,verifyVoteTextGapAudit,VOTE_TEXT_GAP_AUDIT_VERSION,
 type VoteTextGapAudit,type ExistingCoverageRow} from '../src/operations/senate-vote-text-gap-audit';

const BASELINE_SQL=`SELECT session,vote_kind,official_events::int,exact_question_links::int
 FROM senate_vote_paper_coverage_v ORDER BY session,vote_kind`;
const INVENTORY_SQL=`SELECT count(*)::int AS current_actions,
 count(*) FILTER(WHERE kind='amendment')::int AS amendment_actions,
 count(*) FILTER(WHERE complete_assembled_bill_text)::int AS assembled_states,
 (SELECT count(*)::int FROM senate_vote_paper_components_current_v) AS base_components
 FROM senate_vote_paper_current_v`;
const UNMAPPED_SQL=`SELECT e.metadata->>'issueTag' AS issue_tag,count(*)::int AS retained_copies
 FROM evidence_items e JOIN memberships m ON m.id=e.membership_id
 JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate'
 WHERE e.extraction_version='senate-864-literal-website-observed-asof-v1'
 AND e.metadata->>'issueTag' NOT IN (${Object.values(ISSUE_CROSSWALK).map(s=>`'${s}'`).join(',')})
 GROUP BY 1 ORDER BY 1`;
const queries=[VOTE_TEXT_GAP_SQL,BASELINE_SQL,SENATE_COVERAGE_SQL,COVERAGE_DENOMINATORS_SQL,INVENTORY_SQL,UNMAPPED_SQL];
const csv=(rows:Record<string,unknown>[])=>{
 if(!rows.length)return '';
 const keys=Object.keys(rows[0]!);const esc=(x:unknown)=>'"'+String(x??'').replaceAll('"','""')+'"';
 return [keys.map(esc).join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\n')+'\n';
};

async function main(){
 const args=process.argv.slice(2);
 if(args[0]==='--print-queries'){console.log(JSON.stringify(queries));return;}
 let results:unknown[][],snapshotAt:string;
 if(args[0]==='--input'){
  if(!args[1])throw Error('Missing connector readback file');
  const input=JSON.parse(readFileSync(args[1],'utf8'));
  if(input.transaction?.read_only!=='on'||input.transaction?.isolation!=='repeatable read'
   ||input.rollback!==true||!Number.isFinite(Date.parse(input.snapshotAt)))
   throw Error('Missing verified read-only transaction/rollback receipt');
  results=input.results;snapshotAt=input.snapshotAt;
 }else{
  const connectionString=process.env.DATABASE_URL_UNPOOLED??process.env.DATABASE_URL;
  if(!connectionString)throw Error('Existing database connection required');
  const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:10000}),db=await pool.connect();
  try{
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await db.query("SET LOCAL statement_timeout = '30000ms'");
   const tx=(await db.query(`SELECT current_setting('transaction_read_only') AS read_only,
    current_setting('transaction_isolation') AS isolation,transaction_timestamp()::text AS snapshot_at`)).rows[0];
   if(tx.read_only!=='on'||tx.isolation!=='repeatable read')throw Error('Read-only transaction not established');
   snapshotAt=tx.snapshot_at;results=[];
   for(const sql of queries)results.push((await db.query(sql)).rows);
  }finally{try{await db.query('ROLLBACK')}finally{db.release();await pool.end()}}
 }
 if(!Array.isArray(results)||results.length!==queries.length||results.some(r=>!Array.isArray(r)))
  throw Error('Incomplete coverage readback');
 const gapRow=results[0]![0] as {audited_events:number;gap_groups:VoteTextGapAudit['groups'];case_examples:VoteTextGapAudit['examples'];hf100_pilot:VoteTextGapAudit['hf100Pilot']};
 const gap:VoteTextGapAudit={schemaVersion:VOTE_TEXT_GAP_AUDIT_VERSION,auditedEvents:gapRow.audited_events,
  groups:gapRow.gap_groups,examples:gapRow.case_examples,hf100Pilot:gapRow.hf100_pilot};
 verifyVoteTextGapAudit(gap,results[1] as ExistingCoverageRow[]);
 const cells=results[2] as CoverageCell[],denominators=results[3] as CoverageDenominator[];
 verifyCoverage(cells,denominators);
 if(denominators.reduce((n,d)=>n+d.events,0)!==gap.auditedEvents)throw Error('Independent event population drift');
 const output=resolve(args.includes('--output')?args[args.indexOf('--output')+1]!:'docs/evaluation/source-proof');
 mkdirSync(output,{recursive:true});
 const day=new Date(snapshotAt!).toISOString().slice(0,10).replaceAll('-','');
 const mapName=`senate-person-session-issue-coverage-${day}.csv`;
 const mapText=csv(cells as unknown as Record<string,unknown>[]);
 writeFileSync(resolve(output,mapName),mapText);
 const issues=[...new Set(cells.map(c=>c.issue))].sort();
 const issueSummary=['2021-2022','2023-2024','2025-2026'].flatMap(session=>issues.map(issue=>{
  const selected=cells.filter(c=>c.session===session&&c.issue===issue);
  return {session,issue,memberships:selected.length,
   members_with_retained_website:selected.filter(c=>c.retained_website_literals>0).length,
   members_with_prevote_website:selected.filter(c=>c.member_events_with_prevote_website>0).length,
   recorded_member_events:selected.reduce((n,c)=>n+c.recorded_member_events,0),
   member_events_with_prevote_website:selected.reduce((n,c)=>n+c.member_events_with_prevote_website,0)};
 }));
 const summary={schemaVersion:COVERAGE_VERSION,snapshotAt,readOnly:true,rollback:true,
  queryBundleSha256:createHash('sha256').update(JSON.stringify(queries)).digest('hex'),
  aggregateReadbackSha256:createHash('sha256').update(JSON.stringify(results)).digest('hex'),
  scope:'retained_mn_senate_2021_2026',missingMeans:'unknown',servingAllowed:false,
  issueSemantics:'overlapping retained v2.1 bill policy tags; descriptive, not historically available features',
  evidenceSemantics:'stable-person retained literals repeated across session rows; pre-vote counts use each original Journal event midnight UTC; unmapped labels do not assert issue applicability',
  lanesExcluded:['finance','media','frozen_v1.8_directional','historical_quality_37_feature_matrix'],
  issueCrosswalk:ISSUE_CROSSWALK,map:{file:mapName,rows:cells.length,sha256:createHash('sha256').update(mapText).digest('hex')},
  denominators,issueSummary,unmappedWebsiteTags:results[5],paperInventory:results[4][0],voteText:gap};
 // A bounded investigation queue, not a claim that an earlier archive exists.
 // These existing literals are the best starting point for targeted clock
 // checks; no new crawl or reclassification is dispatched by this command.
 const eligible=cells.filter(c=>c.session==='2021-2022'&&c.issue!=='unmapped_issue'
  &&c.recorded_member_events>0&&c.retained_website_literals>0&&c.member_events_with_prevote_website===0)
  .sort((a,b)=>b.recorded_member_events-a.recorded_member_events||a.person_key.localeCompare(b.person_key));
 const rankedIssues=issueSummary.filter(r=>r.session==='2021-2022'&&r.issue!=='unmapped_issue')
  .sort((a,b)=>a.members_with_prevote_website-b.members_with_prevote_website||a.issue.localeCompare(b.issue));
 const priority=rankedIssues.flatMap(r=>eligible.filter(c=>c.issue===r.issue).slice(0,2))
  .slice(0,24).map(c=>({...c,next_source_needed:'authenticated original capture before relevant vote; retained later text alone is insufficient'}));
 writeFileSync(resolve(output,`senate-coverage-timing-priority-${day}.csv`),csv(priority as unknown as Record<string,unknown>[]));
 writeFileSync(resolve(output,`senate-forecast-coverage-${day}.json`),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({schemaVersion:COVERAGE_VERSION,snapshotAt,map:summary.map,denominators,exactQuestions:gap.groups.filter(g=>g.evidence_stage==='exact_question').reduce((n,g)=>n+g.event_count,0)}));
}
void main().catch(()=>{console.error('SENATE_COVERAGE_AUDIT_FAILED');process.exitCode=1});
