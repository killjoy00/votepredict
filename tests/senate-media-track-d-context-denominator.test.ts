import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
 TRACK_D_CONTEXT_DENOMINATOR_SQL,TRACK_D_DENOMINATOR_MARKER,
 assertTrackDDenominatorSQL,classifyTrackDScopedCoverageDenominator,
 type TrackDContextDenominator,
} from '../src/evaluation/senate-media-track-d-context-denominator.js';
import {TRACK_D_SCOPED_COVERAGE_SQL,
 type AggregatedSourceRow} from '../src/evaluation/senate-media-track-d-scoped-coverage.js';
import {pinnedTrackDPublicOriginals} from
 '../scripts/audit-senate-media-track-d-scoped-coverage-readonly.js';
import {runTrackDDenominatorV2,assertTrackDV2ReviewedMain} from
 '../scripts/audit-senate-media-track-d-denominator-readonly-v2.js';
const pins=pinnedTrackDPublicOriginals();
const originalRows=():AggregatedSourceRow[]=>pins.map(x=>({
 public_id:x.publicId,same_url_docs:0,exact_archive_link_docs:0,
 exact_source_docs:0,exact_context_items:0,
 exact_other_seed_docs:0,conflicting_digest_docs:0,
}));
const base=():TrackDContextDenominator=>({
 context_rows:794,source_documents:135,
 rows_with_original_url:725,rows_with_archive_url:710,
 rows_with_archive_utc:700,rows_with_archive_digest:700,
 rows_with_body_sha256:129,
 reformer_source_documents:14,mpr_source_documents:22,
 reformer_brief_url_rows:0,mpr_episode_url_rows:0,
});
test('new one-shot marker and single bounded strictly scalar denominator query',()=>{
 assert.equal(TRACK_D_DENOMINATOR_MARKER,
  'TRACK_D_946_987_READONLY_CONTEXT_DENOMINATOR_V2_20261018');
 assert.equal(assertTrackDDenominatorSQL(),true);
 assert.ok(TRACK_D_CONTEXT_DENOMINATOR_SQL.startsWith('SELECT '));
 assert.ok(TRACK_D_CONTEXT_DENOMINATOR_SQL.endsWith(' LIMIT 1'));
 assert.ok(TRACK_D_CONTEXT_DENOMINATOR_SQL.includes("sd.source_kind='wayback_local_trade_news'"));
 assert.ok(TRACK_D_CONTEXT_DENOMINATOR_SQL.includes("ei.metadata->>'contextType'='local_trade_news'"));
 assert.ok(!/\b(?:UPDATE|DELETE|INSERT|COPY|TRUNCATE|GRANT|DROP)\b/i.test(TRACK_D_CONTEXT_DENOMINATOR_SQL));
});
test('sample exact source absences do not prove missing original article, even with a live denominator',()=>{
 const report=classifyTrackDScopedCoverageDenominator(base(),pins,originalRows());
 assert.equal(report.safeAggregates.contextRows,794);
 assert.equal(report.safeAggregates.sourceDocuments,135);
 assert.equal(report.issues[0].publisherSourceDocumentsInContext,14);
 assert.equal(report.issues[1].publisherSourceDocumentsInContext,22);
 assert.equal(report.issues[0].notObservedInExactFilteredContext,12);
 assert.equal(report.issues[1].notObservedInExactFilteredContext,6);
 assert.equal(report.issues[0].coverageBasis,
  'nonempty_publisher_context_with_url_and_source_digest_columns');
 assert.equal(report.absenceFromAllOtherSourcesOrVotePredictNotEstablished,true);
 assert.equal(report.productionSourcesVotesOrModelsModified,false);
 const safe=JSON.stringify(report);
 for(const key of ['source_url','sourceDocumentId','evidenceId','archiveUrl','originalUrl',
  'rawSha256','archiveSha1','senatorName','memberVotes','storedSourceName'])
  assert.equal(safe.includes('"'+key+'"'),false);
});
test('empty source context and unavailable publication metadata are NOT falsely interpreted as no articles',()=>{
 const missing={...base(),context_rows:0,source_documents:0,
  rows_with_original_url:0,rows_with_archive_url:0,rows_with_archive_utc:0,
  rows_with_archive_digest:0,rows_with_body_sha256:0,
  reformer_source_documents:0,mpr_source_documents:0};
 const x=classifyTrackDScopedCoverageDenominator(missing,pins,originalRows());
 assert.ok(x.issues.every(i=>i.coverageBasis==='empty_filtered_context'));
 const incompatible={...base(),rows_with_original_url:0,rows_with_body_sha256:0};
 const y=classifyTrackDScopedCoverageDenominator(incompatible,pins,originalRows());
 assert.ok(y.issues.every(i=>i.coverageBasis==='insufficient_metadata_for_source_identity'));
 const noReformer={...base(),reformer_source_documents:0};
 const z=classifyTrackDScopedCoverageDenominator(noReformer,pins,originalRows());
 assert.equal(z.issues[0].coverageBasis,'no_publisher_records_in_filtered_context');
 assert.equal(z.issues[1].coverageBasis,
  'nonempty_publisher_context_with_url_and_source_digest_columns');
});
test('a malformed private aggregate count rejects receipt even if exact original samples are all zero',()=>{
 assert.throws(()=>classifyTrackDScopedCoverageDenominator({
  ...base(),rows_with_original_url:1000},pins,originalRows()),/Unexpected/);
 assert.throws(()=>classifyTrackDScopedCoverageDenominator({
  ...base(),reformer_source_documents:-1},pins,originalRows()),/Unexpected/);
});
test('both same-snapshot aggregate SELECT queries, private DB identity guard, explicit rollback',async()=>{
 const calls:string[]=[];
 const fake={query:async(sql:string,...args:unknown[])=>{
  calls.push(sql);
  if(sql.startsWith('SELECT current_database()'))return{
   rows:[{db:'valid',role:'readonly',ro:'on'}]};
  if(sql===TRACK_D_CONTEXT_DENOMINATOR_SQL)return{rows:[base()]};
  if(sql===TRACK_D_SCOPED_COVERAGE_SQL){
   assert.equal(args.length,1);
   const serialized=(args[0] as string[])[0]!;
   assert.equal(JSON.parse(serialized).length,18);
   return{rows:originalRows()};
  }
  return{rows:[]};
 }};
 const report=await runTrackDDenominatorV2(
  fake as Parameters<typeof runTrackDDenominatorV2>[0],
  {database:'valid',role:'readonly'},pins);
 assert.equal(report.issues.length,2);
 assert.equal(calls[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert.equal(calls.at(-1),'ROLLBACK');
 assert.ok(calls.indexOf(TRACK_D_CONTEXT_DENOMINATOR_SQL)<
  calls.indexOf(TRACK_D_SCOPED_COVERAGE_SQL));
 assert.equal(calls.filter(x=>x===TRACK_D_CONTEXT_DENOMINATOR_SQL).length,1);
});
test('wrong DB identity rejects even aggregate SQL and rolls back',async()=>{
 const calls:string[]=[];
 const fake={query:async(sql:string)=>{
  calls.push(sql);
  return sql.startsWith('SELECT current_database()')?
   {rows:[{db:'wrong',role:'readonly',ro:'on'}]}:{rows:[]};
 }};
 await assert.rejects(()=>runTrackDDenominatorV2(
  fake as Parameters<typeof runTrackDDenominatorV2>[0],
  {database:'valid',role:'readonly'},pins),/identity/);
 assert.equal(calls.at(-1),'ROLLBACK');
 assert.ok(!calls.includes(TRACK_D_CONTEXT_DENOMINATOR_SQL));
 assert.throws(()=>assertTrackDV2ReviewedMain({NODE_ENV:'test'}),/gate/);
});
test('unprivileged public-source preflight without private data or credentials',()=>{
 const output=execFileSync(process.execPath,['--import','tsx',
  'scripts/audit-senate-media-track-d-denominator-readonly-v2.ts','--preflight'],
  {encoding:'utf8'});
 assert.match(output,/V2_PUBLIC_SHA_AND_DENOMINATOR_SQL_OK/);
});
