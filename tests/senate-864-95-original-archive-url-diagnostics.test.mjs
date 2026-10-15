import assert from 'node:assert/strict';
import test from 'node:test';
import {readPublicInputs,SOURCE_CLASS_SQL,GLOBAL_SOURCE_CLASS_SQL} from '../scripts/audit-senate-864-95-historical-source-neon-readonly.mjs';
import {compareOriginalArchiveUrlV2,validateV2Report,siteParts,waybackOriginal,originalSiteVariants}
 from '../src/evidence/senate-864-95-original-archive-url-diagnostics.mjs';
const SHA='a'.repeat(64), DIFFERENT='b'.repeat(64);
function fixture(){
 const {manifest}=readPublicInputs();
 const pages=manifest.people.map((p,i)=>[
  {url:'https://candidate'+i+'.example/issues/'+i,sha:SHA},
  ...(i<35?[{url:'https://candidate'+i+'.example/topics/'+i,sha:SHA}]:[])
 ]);
 const research={pages,ledgersRead:29};
 const roster=manifest.people.map((p,i)=>({
  name:p.officialName,legislatorId:'fake_legi_'+i,membershipId:'fake_member_'+i
 }));
 const sources=[];
 function add(i,data){
  sources.push({membershipId:'fake_member_'+i,sourceDocumentId:'fake_doc_'+sources.length,
   sourceKind:'campaign_site',sourceUrl:'https://unrelated'+i+'.example/safe',
   contentSha256:SHA,storedOriginalUrl:null,evidenceOriginalUrl:null,...data});
 }
 add(0,{sourceUrl:pages[0][0].url});
 add(1,{sourceUrl:'http://www.candidate1.example/issues/1/',contentSha256:DIFFERENT});
 add(2,{sourceKind:'wayback_campaign_site',
  sourceUrl:'https://web.archive.org/web/20220102030405id_/https://not2.example/other',
  storedOriginalUrl:pages[2][0].url,contentSha256:null});
 add(3,{sourceKind:'wayback_campaign_site',
  sourceUrl:'https://web.archive.org/web/20220102030405id_/https://not3.example/other',
  evidenceOriginalUrl:'http://www.candidate3.example/issues/3/'});
 add(4,{sourceKind:'wayback_campaign_site',
  sourceUrl:'https://web.archive.org/web/20220102030405id_/https://candidate4.example/issues/4'});
 add(5,{sourceUrl:'https://candidate5.example/unrelated/path'});
 const global=[
  {sourceUrl:pages[0][0].url,sourceDocumentId:'fake_global_0',sourceKind:'campaign_site'},
  {sourceUrl:'https://different.example/',storedOriginalUrl:pages[2][0].url,sourceDocumentId:'fake_global_2',sourceKind:'wayback_campaign_site'}
 ];
 return {manifest,research,roster,sources,global};
}
test('URL normalization preserves meaningful path/query and separates Wayback replay',()=>{
 const u='https://example.com/issues?q=roads&a=1';
 assert.equal(siteParts(u).key,siteParts('http://www.example.com/issues/?a=1&q=roads').key);
 assert.notEqual(siteParts(u).key,siteParts('http://example.com/issues?A=1&q=roads').key);
 assert.notEqual(siteParts(u).key,siteParts('http://example.com/issue?q=roads&a=1').key);
 assert.equal(waybackOriginal('https://web.archive.org/web/20200101010101id_/https://example.com/issues'),'https://example.com/issues');
 assert.equal(waybackOriginal('https://web.archive.org/web/not-a-date/https://example.com/issues'),null);
 assert.ok(originalSiteVariants(u).length>1);
 assert.equal(waybackOriginal('https://not-archive.example/web/20200101010101id_/https://example.com/issues'),null);
});
test('exact member-linked page classification is distinct from site-only and global records',()=>{
 const {manifest,research,roster,sources,global}=fixture();
 const r=compareOriginalArchiveUrlV2(manifest,research,roster,sources,global);
 assert.equal(r.historicalPersons,95);
 assert.equal(r.originalPageWitnesses,130);
 assert.equal(r.pageResolutionStates.direct_url_exact,1);
 assert.equal(r.pageResolutionStates.direct_url_normalized,1);
 assert.equal(r.pageResolutionStates.metadata_original_exact,1);
 assert.equal(r.pageResolutionStates.metadata_original_normalized,1);
 assert.equal(r.pageResolutionStates.wayback_embedded_exact,1);
 assert.equal(r.pageResolutionStates.same_host_path_unverified,1);
 assert.equal(r.pageResolutionStates.no_same_host_in_selected_linked_sources,124);
 assert.equal(r.originalPagesWithPageLevelSourceIdentity,5);
 assert.deepEqual(r.wholeOriginalHtmlShaComparison,{
  whole_sha_equal:2,whole_sha_differs:2,whole_sha_unavailable:1
 });
 assert.equal(r.globalCandidateUrlPresence.pagesWithGlobalDirectUrl,1);
 assert.equal(r.globalCandidateUrlPresence.pagesWithGlobalOriginalMetadata,1);
 assert.equal(r.storedSourceAddressForms.archiveReplayRows,3);
 assert.equal(r.memberEvidenceRowsExamined,6);
 assert.equal(r.pageResolutionStates.direct_url_exact+r.pageResolutionStates.direct_url_normalized+r.pageResolutionStates.metadata_original_exact+r.pageResolutionStates.metadata_original_normalized+r.pageResolutionStates.wayback_embedded_exact+r.pageResolutionStates.wayback_embedded_normalized+r.pageResolutionStates.same_host_path_unverified+r.pageResolutionStates.no_same_host_in_selected_linked_sources,130);
 assert.doesNotThrow(()=>validateV2Report(r));
});
test('never export private source or membership IDs, URLs or any SHA digest',()=>{
 const {manifest,research,roster,sources,global}=fixture();
 const r=compareOriginalArchiveUrlV2(manifest,research,roster,sources,global);
 const output=JSON.stringify(r);
 for(const secret of [sources[0].membershipId,sources[0].sourceUrl,global[0].sourceUrl,SHA]){
  assert.equal(output.includes(secret),false);
 }
 const attack=structuredClone(r);
 attack.perPerson[0].url=sources[0].sourceUrl;
 assert.throws(()=>validateV2Report(attack));
 const attack2=structuredClone(r);
 attack2.pageResolutionStates.direct_url_exact=130;
 assert.throws(()=>validateV2Report(attack2));
 const attack3=structuredClone(r);
 attack3.globalSourceDocumentsRead=2001;
 assert.throws(()=>validateV2Report(attack3));
});
test('source V2 SQL remains fixed, bounded SELECT with metadata/original capture families',()=>{
 for(const sql of [SOURCE_CLASS_SQL,GLOBAL_SOURCE_CLASS_SQL]){
  assert.match(sql,/^SELECT /);
  assert.match(sql,/LIMIT (30001|2001)$/);
  assert.doesNotMatch(sql,/\b(?:insert|update|delete|alter|create|truncate|drop)\b/i);
 }
 assert.match(SOURCE_CLASS_SQL,/wayback_campaign_site/);
 assert.match(SOURCE_CLASS_SQL,/originalUrl/);
 assert.match(GLOBAL_SOURCE_CLASS_SQL,/ANY\(\$1::text\[\]\)/);
});
