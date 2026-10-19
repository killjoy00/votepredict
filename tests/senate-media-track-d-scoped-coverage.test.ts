import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
 TRACK_D_946_987_MARKER,TRACK_D_SCOPED_COVERAGE_SQL,
 validateTrackDPins,assertTrackDCrosswalkSQL,
 summarizeTrackDProtectedAggregate,type AggregatedSourceRow,
} from '../src/evaluation/senate-media-track-d-scoped-coverage.js';
import {
 pinnedTrackDPublicOriginals,runReadOnlyTrackDCrosswalk,
 checkTrackDProtectedRun,
} from '../scripts/audit-senate-media-track-d-scoped-coverage-readonly.js';

const pins=pinnedTrackDPublicOriginals();
const rows=():AggregatedSourceRow[]=>
 pins.map(p=>({
  public_id:p.publicId,same_url_docs:0,exact_archive_link_docs:0,
  exact_source_docs:0,exact_context_items:0,
  exact_other_seed_docs:0,conflicting_digest_docs:0,
 }));

test('originals are distinct 2021-25 authenticated body SHAs from existing exact historic source receipts',()=>{
 assert.equal(validateTrackDPins(pins),true);
 assert.equal(pins.length,18);
 assert.equal(pins.filter(x=>x.issue===946).length,12);
 assert.equal(pins.filter(x=>x.issue===987).length,6);
 assert.equal(new Set(pins.filter(x=>x.issue===946).map(x=>x.originalUrl)).size,10);
 assert.equal(new Set(pins.filter(x=>x.issue===987).map(x=>x.originalUrl)).size,4);
 assert.ok(pins.every(x=>x.capturedUtc.startsWith('202')&&x.capturedUtc<'2026'));
 assert.ok(pins.filter(x=>x.issue===946).every(x=>x.originalUrl.includes('/briefs/')));
 assert.ok(pins.filter(x=>x.issue===987).some(x=>x.originalUrl.includes('/story/')));
 assert.ok(pins.filter(x=>x.issue===987).some(x=>x.originalUrl.includes('/episode/')));
 assert.equal(TRACK_D_946_987_MARKER,
  'TRACK_D_946_987_SCOPED_READONLY_COVERAGE_V1_20261018');
});
test('all URL fingerprints and index SHA are exact and fail closed on cross publisher, change or 2026',()=>{
 const a=pins[0]!;
 for(const invalid of [
  {...a,originalUrl:'https://evil.test/briefs/other/'},
  {...a,archiveUrl:a.archiveUrl.replace('id_/','/')},
  {...a,capturedUtc:'2026-01-01T00:00:00Z'},
  {...a,rawSha256:'a'.repeat(63)},
  {...a,indexedSha1:'SHORT'},
  {...a,seedId:'different'},
  {...a,publicId:'private-do-not-export'},
 ]){
  assert.throws(()=>validateTrackDPins([invalid,...pins.slice(1)]));
 }
 assert.throws(()=>validateTrackDPins([...pins.slice(1),pins[0]!]),
  /pinned coverage/);
});
test('static SQL is parameterized, bounded and only selects permitted public ID plus numeric aggregates',()=>{
 assert.equal(assertTrackDCrosswalkSQL(),true);
 assert.ok(TRACK_D_SCOPED_COVERAGE_SQL.startsWith('WITH pins AS '));
 assert.ok(TRACK_D_SCOPED_COVERAGE_SQL.endsWith(' LIMIT 19'));
 assert.ok(TRACK_D_SCOPED_COVERAGE_SQL.includes('$1::jsonb'));
 assert.ok(TRACK_D_SCOPED_COVERAGE_SQL.includes("ev.metadata->>'contextType'='local_trade_news'"));
 assert.ok(TRACK_D_SCOPED_COVERAGE_SQL.includes("sd.source_kind='wayback_local_trade_news'"));
 assert.ok(!/\b(?:UPDATE|DELETE|INSERT|TRUNCATE)\b/i.test(TRACK_D_SCOPED_COVERAGE_SQL));
});
test('zero observed does NOT become statewide or private-all-pipelines absence',()=>{
 const report=summarizeTrackDProtectedAggregate(pins,rows());
 assert.equal(report.issues[0].issue,946);
 assert.equal(report.issues[0].notObservedInBoundedContext,12);
 assert.equal(report.issues[1].notObservedInBoundedContext,6);
 assert.equal(report.localTradeNewsContextNotEveryMediaOrPredictionPipeline,true);
 assert.equal(report.forecastEligibilityEstablished,false);
 assert.equal(report.productionSourceMutation,false);
 assert.equal(report.privateIdentifiersSourceUrlsOrRawArticlesExcludedFromOutput,true);
 const text=JSON.stringify(report);
 for(const key of ['originalUrl','archiveUrl','archiveCapturedAt','sourceDocumentId','evidenceId','rawSha256','indexedSha1']){
  assert.equal(text.includes('"'+key+'"'),false);
 }
});
test('matching, cross-seed and conflicting private sources stay scope-limited',()=>{
 const r=rows();
 r[0]={...r[0]!,same_url_docs:2,exact_archive_link_docs:2,
  exact_source_docs:1,exact_context_items:3,exact_other_seed_docs:1,
  conflicting_digest_docs:1};
 r[1]={...r[1]!,same_url_docs:1,exact_archive_link_docs:0,
  exact_source_docs:0,exact_context_items:0,
  exact_other_seed_docs:0,conflicting_digest_docs:0};
 r[2]={...r[2]!,same_url_docs:1,exact_archive_link_docs:1,
  exact_source_docs:0,exact_context_items:0,
  exact_other_seed_docs:0,conflicting_digest_docs:1};
 const report=summarizeTrackDProtectedAggregate(pins,r);
 const flattened=report.issues.flatMap(x=>x.rows);
 assert.equal(flattened.filter(x=>x.status==='exact_original_in_bounded_local_media_context').length,1);
 assert.equal(flattened.filter(x=>x.status==='other_capture_or_metadata_of_same_original_url_only').length,1);
 assert.equal(flattened.filter(x=>x.status==='same_archive_link_conflicting_or_unproven_source_bytes').length,1);
 assert.equal(flattened.reduce((n,x)=>n+x.exactStoredUnderDifferentSeed,0),1);
 assert.throws(()=>summarizeTrackDProtectedAggregate(pins,[...r.slice(1),r[1]!]),/duplicated/);
 assert.throws(()=>summarizeTrackDProtectedAggregate(pins,
  [{...r[0]!,exact_source_docs:3},...r.slice(1)]),/unexpected/);
});
test('existing default Neon identity and REPEATABLE READ READ ONLY ROLLBACK must precede any receipt',async()=>{
 const calls:string[]=[];
 const fake={query:async(sql:string,...args:unknown[])=>{
  calls.push(sql);
  if(sql.startsWith('SELECT current_database()'))return{
   rows:[{db:'valid',role:'readonly',ro:'on'}]};
  if(sql===TRACK_D_SCOPED_COVERAGE_SQL){
   assert.equal(args.length,1);
   const passed=JSON.parse((args[0] as string[])[0]!) as Record<string,any>[];
   assert.equal(passed.length,18);
   assert.ok(passed.every(x=>x.public_id&&x.raw_sha256&&!x.sourceDocumentId));
   return{rows:rows()};
  }
  return{rows:[]};
 }};
 const report=await runReadOnlyTrackDCrosswalk(
  fake as Parameters<typeof runReadOnlyTrackDCrosswalk>[0],
  {database:'valid',role:'readonly'},pins);
 assert.equal(report.issues.length,2);
 assert.equal(calls[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert.equal(calls.at(-1),'ROLLBACK');
 assert.equal(calls.filter(x=>x===TRACK_D_SCOPED_COVERAGE_SQL).length,1);
});
test('wrong DB or non-readonly setting never runs even a bounded source query',async()=>{
 const calls:string[]=[];
 const fake={query:async(sql:string)=>{
  calls.push(sql);
  if(sql.startsWith('SELECT current_database()'))return{rows:[
   {db:'unexpected',role:'readonly',ro:'on'}]};
  return{rows:[]};
 }};
 await assert.rejects(()=>runReadOnlyTrackDCrosswalk(
  fake as Parameters<typeof runReadOnlyTrackDCrosswalk>[0],
  {database:'valid',role:'readonly'},pins),/Unexpected Neon/);
 assert.equal(calls.at(-1),'ROLLBACK');
 assert.ok(!calls.includes(TRACK_D_SCOPED_COVERAGE_SQL));
 assert.throws(()=>checkTrackDProtectedRun({NODE_ENV:'test'}),/gate absent/);
});
test('no private key needed for deterministic source-only preflight',()=>{
 const output=execFileSync(process.execPath,['--import','tsx',
  'scripts/audit-senate-media-track-d-scoped-coverage-readonly.ts','--preflight'],
  {encoding:'utf8'});
 assert.match(output,/PINNED_PUBLIC_ORIGINALS_VALID=18/);
});
