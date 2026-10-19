import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
 HISTORICAL_SHADOW_SOURCE_PROPOSAL,
 previewTrackDResearchOnlyShadow,validateTrackDHistoricalShadowPins,
} from '../src/evaluation/senate-media-track-d-historic-shadow.js';
import {
 TRACK_D_CROSS_INGESTER_MARKER,TRACK_D_CROSS_SOURCE_SQL,
 TRACK_D_CROSS_SOURCE_DENOMINATOR_SQL,assertTrackDCrossSourceStaticSQL,
 summarizeTrackDCrossSource,type CrossMatchRow,type CrossSourceContext,
} from '../src/evaluation/senate-media-track-d-cross-ingester-audit.js';
import {
 getTrackDHistoricalShadowPins,runTrackDCrossStoreReadOnly,
 assertTrackDCrossReviewedMain,
} from '../scripts/audit-senate-media-track-d-cross-ingester-readonly-v3.js';

const pins=getTrackDHistoricalShadowPins();
const allKinds=():CrossSourceContext=>({
 stored_source_documents:22100,stored_source_kinds:32,stored_evidence_items:75000,
});
const zeros=():CrossMatchRow[]=>
 pins.map(p=>({
  public_id:p.publicId,matching_body_sha_docs:0,exact_archive_body_docs:0,
  archive_link_docs:0,same_original_url_docs:0,
  same_original_url_and_sha_docs:0,
  potential_dated_alias_reference_docs:0,
  matching_other_source_kind_docs:0,
 }));
test('shadow original corpus is 23 independently pinned archive bodies/17 distinct original URLs',()=>{
 assert.equal(validateTrackDHistoricalShadowPins(pins),true);
 assert.equal(pins.length,23);
 assert.equal(pins.filter(x=>x.issue===946).length,17);
 assert.equal(pins.filter(x=>x.issue===987).length,6);
 assert.equal(new Set(pins.map(x=>x.originalUrl)).size,17);
 assert.equal(new Set(pins.filter(x=>x.candidateDatedAlias!==null).map(x=>x.originalUrl)).size,7);
 assert.equal(pins.filter(x=>x.sourceGroup==='additional_5_2021_2025_reformer_originals').length,5);
 assert.ok(pins.every(x=>Number(x.capturedUtc.slice(0,4))<=2025&&
  Number(x.capturedUtc.slice(0,4))>=2021));
 assert.ok(pins.every(x=>x.capturedUtc>=x.displayedPublisherDay+'T00:00:00Z'));
});
test('shadow proposed prefixes are research-only and fully separate from production',()=>{
 assert.equal(HISTORICAL_SHADOW_SOURCE_PROPOSAL.length,2);
 const preview=previewTrackDResearchOnlyShadow(pins);
 assert.equal(preview.verifiedInputOriginalVersions,23);
 assert.equal(preview.verifiedDistinctPublisherUrls,17);
 assert.equal(preview.possibleReformerOriginalArticleAliasPairs,7);
 assert.equal(preview.historicTwoSidedAliasProofs,0);
 assert.equal(preview.newResearchOnlyCandidateVersions,22);
 assert.equal(preview.issueSummaries[0].currentBothSelectionGatesAdmit,0);
 assert.equal(preview.issueSummaries[1].currentBothSelectionGatesAdmit,0);
 assert.equal(preview.issueSummaries[0].wouldEnterNewResearchOnlyUrlFamily,17);
 assert.equal(preview.issueSummaries[1].wouldEnterNewResearchOnlyUrlFamily,5);
 assert.equal(preview.actualProductionSeedCatalogChanged,false);
 assert.equal(preview.actualProductionCollectorPathPriorityChanged,false);
 assert.equal(preview.noDatabaseReadsOrWrites,true);
 assert.equal(preview.noNetworkReads,true);
 assert.equal(preview.noNewHistoricalAsOfOrMemberVoteLabels,true);
 assert.ok(preview.rows.every(x=>!x.proposedProductionIngestion&&!x.modelEligibility&&
  !x.fullSenatorQuoteHumanApproved&&!x.historicArticleAliasVerified));
});
test('Reformer brief dated-path alias remains unproven even for matching slug/date and multiple bodies',()=>{
 const preview=previewTrackDResearchOnlyShadow(pins);
 const candidates=preview.rows.filter(x=>x.potentialDatedPathAlias);
 assert.equal(candidates.length,10); // four pairs + three new, some multiple historical versions
 assert.ok(candidates.every(x=>x.historicArticleAliasVerified===false));
 assert.ok(preview.rows.filter(x=>x.publicOriginalId.includes('sanctuary')).length>=2);
 const bad=[...pins];
 const index=bad.findIndex(x=>x.candidateDatedAlias!==null);
 const item=bad[index]!;
 bad[index]={...item,candidateDatedAlias:
  'https://minnesotareformer.com/2026/02/12/other/'};
 assert.throws(()=>validateTrackDHistoricalShadowPins(bad),/historical article alias acceptance/);
});
test('adversarial 2026, false byte digest, wrong host and malicious MPR year are excluded before any SQL',()=>{
 const cases=[
  (p:typeof pins[number])=>({...p,originalUrl:'https://evil.test/briefs/different/'}),
  (p:typeof pins[number])=>({...p,capturedUtc:'2026-01-01T10:00:00Z'}),
  (p:typeof pins[number])=>({...p,rawSha256:'x'.repeat(64)}),
  (p:typeof pins[number])=>({...p,displayedPublisherDay:'2026-01-01'}),
  (p:typeof pins[number])=>({...p,archiveUrl:p.archiveUrl.replace('id_/','/')}),
 ];
 for(const alter of cases){
  const changed=[...pins]; changed[0]=alter(pins[0]!);
  assert.throws(()=>validateTrackDHistoricalShadowPins(changed));
 }
});
test('historical labeled transcript phrase must be captured in that same original; recorded audio and human quote remain unverified',()=>{
 const kunesh=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-mpr-kunesh-2023-original-in-turn-20261011.json','utf8'));
 assert.equal(kunesh.historicalCaptures.length,2);
 assert.ok(kunesh.historicalCaptures.every((v:Record<string,any>)=>
  v.studies.filter((s:Record<string,any>)=>s.selectedPhraseInsideSameExplicitMaryKuneshTranscriptTurn).length===2));
 const hauschild=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-mpr-hauschild-later-historical-transcript-cue-receipts-20261011.json','utf8'));
 assert.equal(hauschild.firstHistoricallyAuthenticatedSelectedTranscriptCuePresenceWithinFourIndexedCaptures,
  '2025-07-24T23:23:22Z');
 assert.equal(hauschild.cannotBackdate2025HtmlTranscriptTextTo2024Captures,true);
 assert.ok(previewTrackDResearchOnlyShadow(pins).rows
  .filter(x=>x.issue===987).every(x=>!x.currentAudioMatchedHistoricTranscript));
});
test('all source-kind SQL only projects public IDs plus counts and no private document/senator values',()=>{
 assert.equal(assertTrackDCrossSourceStaticSQL(),true);
 assert.equal(TRACK_D_CROSS_INGESTER_MARKER,
  'TRACK_D_946_987_CROSS_INGESTER_READONLY_SHADOW_V3_20261018');
 assert.ok(TRACK_D_CROSS_SOURCE_SQL.startsWith('WITH pins AS'));
 assert.ok(TRACK_D_CROSS_SOURCE_SQL.endsWith(' LIMIT 24'));
 assert.ok(TRACK_D_CROSS_SOURCE_SQL.includes('count(DISTINCT m.sid)'));
 assert.ok(TRACK_D_CROSS_SOURCE_SQL.includes('evidence_items ei'));
 assert.ok(TRACK_D_CROSS_SOURCE_DENOMINATOR_SQL.startsWith('SELECT '));
 assert.ok(!/\b(?:UPDATE|INSERT|DELETE|GRANT|DROP|CREATE|EXECUTE)\b/i.test(TRACK_D_CROSS_SOURCE_SQL));
});
test('no matching stored source documents is not absence of newspaper reporting anywhere',()=>{
 const report=summarizeTrackDCrossSource(pins,allKinds(),zeros());
 assert.equal(report.issues[0].sourceCaptureVersionsChecked,17);
 assert.equal(report.issues[1].sourceCaptureVersionsChecked,6);
 assert.equal(report.issues[0].noExactOriginalUrlOrShaSeenInStoredSourceKinds,17);
 assert.equal(report.issues[1].noExactOriginalUrlOrShaSeenInStoredSourceKinds,6);
 assert.equal(report.noGlobalArticleAbsenceClaim,true);
 assert.equal(report.historicallyIdenticalDatedVsBriefSourceBytesNotEstablished,true);
 assert.equal(report.noDatabaseWritesOrModelServingChanges,true);
 const serialized=JSON.stringify(report);
 for(const key of ['sourceDocumentId','evidenceId','originalUrl','archiveUrl','sourceUrl',
  'rawSha256','indexedSha1','sourceKind','personName']){
  assert.equal(serialized.includes('"'+key+'"'),false);
 }
});
test('exact original SHA+archive link, other version, digest-only and possible alias remain distinct',()=>{
 const rows=zeros();
 const i=rows.findIndex(x=>pins.find(p=>p.publicId===x.public_id)?.candidateDatedAlias!==null);
 rows[i]={...rows[i]!,matching_body_sha_docs:2,exact_archive_body_docs:1,
  archive_link_docs:1,same_original_url_docs:1,
  same_original_url_and_sha_docs:1,
  potential_dated_alias_reference_docs:1,matching_other_source_kind_docs:2};
 const p=rows.findIndex((x,j)=>j!==i);
 rows[p]={...rows[p]!,same_original_url_docs:1,
  same_original_url_and_sha_docs:0,archive_link_docs:0};
 const result=summarizeTrackDCrossSource(pins,allKinds(),rows);
 assert.equal(result.byPublicOriginal.filter(x=>
  x.disposition==='same_historic_archive_url_and_raw_body_sha_stored_in_a_source_kind').length,1);
 assert.equal(result.byPublicOriginal.filter(x=>
  x.disposition==='same_original_url_reference_but_original_archive_body_unverified').length,1);
 assert.ok(result.byPublicOriginal.some(x=>x.candidateDatedAliasReferenceDocs===1));
 assert.throws(()=>summarizeTrackDCrossSource(pins,allKinds(),
  [{...rows[0]!,exact_archive_body_docs:999},...rows.slice(1)]),/Malformed/);
});
test('existing default Neon project and REPEATABLE READ READ ONLY verification before both bounded source queries; ROLLBACK',async()=>{
 const calls:string[]=[];
 const fake={query:async(sql:string,...args:unknown[])=>{
  calls.push(sql);
  if(sql.startsWith('SELECT current_database()'))return{rows:[{db:'verified',role:'readonly',ro:'on'}]};
  if(sql===TRACK_D_CROSS_SOURCE_DENOMINATOR_SQL)return{rows:[allKinds()]};
  if(sql===TRACK_D_CROSS_SOURCE_SQL){
   assert.equal(args.length,1);
   assert.equal(JSON.parse((args[0] as string[])[0]!).length,23);
   return{rows:zeros()};
  }
  return{rows:[]};
 }};
 const result=await runTrackDCrossStoreReadOnly(
  fake as Parameters<typeof runTrackDCrossStoreReadOnly>[0],
  {database:'verified',role:'readonly'},pins);
 assert.equal(result.byPublicOriginal.length,23);
 assert.equal(calls[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert.equal(calls.at(-1),'ROLLBACK');
 assert.equal(calls.filter(x=>x===TRACK_D_CROSS_SOURCE_SQL).length,1);
});
test('wrong DB/role and incomplete source counts fail closed and ROLLBACK',async()=>{
 const calls:string[]=[];
 const fake={query:async(sql:string)=>{
  calls.push(sql);
  return sql.startsWith('SELECT current_database()')?
   {rows:[{db:'wrong',role:'readonly',ro:'on'}]}:{rows:[]};
 }};
 await assert.rejects(()=>runTrackDCrossStoreReadOnly(
  fake as Parameters<typeof runTrackDCrossStoreReadOnly>[0],
  {database:'verified',role:'readonly'},pins),/role\/transaction/);
 assert.equal(calls.at(-1),'ROLLBACK');
 assert.ok(!calls.includes(TRACK_D_CROSS_SOURCE_SQL));
 assert.throws(()=>assertTrackDCrossReviewedMain({NODE_ENV:'test'}),/gate absent/);
});
test('operator-free offline dry run and preflight use no credentials or DB',()=>{
 const r=execFileSync(process.execPath,['--import','tsx',
  'scripts/audit-senate-media-track-d-cross-ingester-readonly-v3.ts','--preflight'],
  {encoding:'utf8'});
 assert.match(r,/V3_ORIGINALS_AND_SQL_READY=23/);
 const p=execFileSync(process.execPath,['--import','tsx',
  'scripts/audit-senate-media-track-d-cross-ingester-readonly-v3.ts','--shadow-report'],
  {encoding:'utf8'});
 assert.match(p,/SHADOW_PREVIEW=/);
 const j=JSON.parse(p.split('SHADOW_PREVIEW=')[1]!);
 assert.equal(j.newResearchOnlyCandidateVersions,22);
});
