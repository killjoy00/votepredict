/** #864 V2: classify original live URLs versus archived replay and stored metadata.
 * A source URL/hash is matched only to evidence linked to this exact member.
 * All private SQL URLs, source identifiers and SHA remain strictly in-memory.
 */
import {assertManifest,canonicalKey} from './senate-864-95-historical-source-neon-parity.mjs';
export const DIAGNOSTIC_STATES=[
 'direct_url_exact','direct_url_normalized',
 'metadata_original_exact','metadata_original_normalized',
 'wayback_embedded_exact','wayback_embedded_normalized',
 'same_host_path_unverified','no_same_host_in_selected_linked_sources'
];
export const SOURCE_FAMILIES=[
 'archived_campaign','campaign_registry','campaign_other',
 'archived_member','member_primary','member_registry',
 'news_context','other_context'
];
const MAX_SOURCE=30000,MAX_GLOBAL=2000;
function emptyCounters(keys){return Object.fromEntries(keys.map(k=>[k,0]));}
function limited(v,max){return Number.isSafeInteger(v)&&v>=0&&v<=max;}
function checkUrl(value){
 if(typeof value!=='string'||value.length>2200)return null;
 let u;try{u=new URL(value);}catch{return null;}
 if(!['http:','https:'].includes(u.protocol)||!u.hostname
 ||u.username||u.password||u.hostname.length>255||u.pathname.length>1500)return null;
 return u;
}
export function waybackOriginal(value){
 const u=checkUrl(value);
 if(!u||u.hostname.toLowerCase()!=='web.archive.org')return null;
 const match=u.pathname.match(/^\/web\/\d{8,14}(?:[a-z]{1,4}_)?\/(https?:\/\/.*)$/i);
 if(!match)return null;
 // Original site's query follows the snapshot wrapper; never use Wayback timestamps as original authorship.
 const original=match[1]+u.search;
 return checkUrl(original)?original:null;
}
export function siteParts(value){
 const u=checkUrl(value);
 if(!u)return null;
 // Do not erase meaningful query params; only default port, www and scheme differences are ignored.
 const host=u.hostname.toLowerCase().replace(/^www\./,'');
 const pathname=u.pathname.replace(/\/+$/,'')||'/';
 const entries=[...u.searchParams.entries()].sort(([a,b],[c,d])=>a.localeCompare(c)||b.localeCompare(d));
 const query=new URLSearchParams(entries).toString();
 return {host,path:pathname, key:host+pathname+'?'+query,
  hadQuery:!!u.search,protocol:u.protocol,archived:u.hostname.toLowerCase()==='web.archive.org'};
}
export function originalSiteVariants(value){
 const u=checkUrl(value);if(!u)return [];
 if(u.hostname.toLowerCase()==='web.archive.org')return [u.toString()];
 const base=u.hostname.replace(/^www\./,'');
 const hosts=[base,'www.'+base].filter((h,i,a)=>a.indexOf(h)===i);
 const paths=[u.pathname,u.pathname==='/'?'/':u.pathname.endsWith('/')?u.pathname.replace(/\/+$/,''):u.pathname+'/'];
 const variants=[];
 for(const protocol of ['https:','http:'])for(const host of hosts)for(const path of paths){
  const v=protocol+'//'+host+path+u.search;
  if(!variants.includes(v))variants.push(v);
 }
 return variants.slice(0,8);
}
export function familyOf(kind){
 const k=String(kind||'');
 if(k==='wayback_campaign_site')return 'archived_campaign';
 if(k==='campaign_site_registry')return 'campaign_registry';
 if(k==='campaign_site')return 'campaign_other';
 if(k==='wayback_member_primary')return 'archived_member';
 if(k==='member_primary_article'||k==='senate_member_primary_historical_article')return 'member_primary';
 if(k==='member_primary_registry')return 'member_registry';
 if(k==='public_news_article'||k==='wayback_local_trade_news')return 'news_context';
 return 'other_context';
}
function sourceUrls(row){
 return [
  {location:'direct',value:row.sourceUrl},
  {location:'meta',value:row.storedOriginalUrl},
  {location:'meta',value:row.evidenceOriginalUrl},
  {location:'embedded',value:waybackOriginal(row.sourceUrl)}
 ].filter(r=>checkUrl(r.value));
}
function evidenceState(publicUrl,privateRow){
 const publicSite=siteParts(publicUrl);
 if(!publicSite)return null;
 let best=null;
 for(const candidate of sourceUrls(privateRow)){
  let status=null,priority=100;
  if(candidate.value===publicUrl){
   status=candidate.location==='direct'?'direct_url_exact':
    candidate.location==='meta'?'metadata_original_exact':'wayback_embedded_exact';
   priority=candidate.location==='direct'?0:candidate.location==='meta'?2:4;
  }else{
   const c=siteParts(candidate.value);
   if(c?.key===publicSite.key){
    status=candidate.location==='direct'?'direct_url_normalized':
     candidate.location==='meta'?'metadata_original_normalized':'wayback_embedded_normalized';
    priority=candidate.location==='direct'?1:candidate.location==='meta'?3:5;
   }else if(c?.host===publicSite.host){
    status='same_host_path_unverified';priority=6;
   }
  }
  if(status&&(!best||priority<best.priority))
   best={status,priority,family:familyOf(privateRow.sourceKind),
    sha:String(privateRow.contentSha256||'').toLowerCase()};
 }
 return best;
}
function personKeys(manifest,roster){
 const indexed=new Map();
 for(const r of roster){
  if(typeof r.membershipId!=='string'||typeof r.legislatorId!=='string')throw Error('Untrusted SQL membership result');
  const key=canonicalKey(r.name);
  if(!key)continue;
  const rec=indexed.get(key)||{legislators:new Set(),memberships:new Set()};
  rec.legislators.add(r.legislatorId);rec.memberships.add(r.membershipId);
  indexed.set(key,rec);
 }
 return manifest.people.map(p=>{
  const v=indexed.get(canonicalKey(p.officialName));
  return v&&v.legislators.size===1?v.memberships:null;
 });
}
export function compareOriginalArchiveUrlV2(manifest,research,roster,sourceRows,globalDocuments){
 assertManifest(manifest);
 if(!Array.isArray(research?.pages)||research.pages.length!==95||research.ledgersRead!==29
 ||!Array.isArray(roster)||roster.length>1000
 ||!Array.isArray(sourceRows)||sourceRows.length>MAX_SOURCE
 ||!Array.isArray(globalDocuments)||globalDocuments.length>MAX_GLOBAL)
 throw Error('Unbounded original vs archive database comparison');
 const memberships=personKeys(manifest,roster);
 const familyRows=emptyCounters(SOURCE_FAMILIES);
 let archiveAddressRows=0,archivedWithOriginalMetadata=0,liveAddressRows=0;
 const indexed=new Map();
 for(const s of sourceRows){
  if(typeof s.membershipId!=='string'||typeof s.sourceUrl!=='string'
   ||typeof s.sourceKind!=='string'||typeof s.sourceDocumentId!=='string')
   throw Error('Malformed private source metadata row');
  const arr=indexed.get(s.membershipId)||[];
  arr.push(s);indexed.set(s.membershipId,arr);
  familyRows[familyOf(s.sourceKind)]++;
  if(siteParts(s.sourceUrl)?.archived){archiveAddressRows++;
   if(checkUrl(s.storedOriginalUrl)||checkUrl(s.evidenceOriginalUrl))archivedWithOriginalMetadata++;
  }else liveAddressRows++;
 }
 const states=emptyCounters(DIAGNOSTIC_STATES);
 const matchedFamilies=emptyCounters(SOURCE_FAMILIES);
 const hashes={whole_sha_equal:0,whole_sha_differs:0,whole_sha_unavailable:0};
 const perPerson=[],globalExactPresence={pagesWithGlobalDirectUrl:0,pagesWithGlobalOriginalMetadata:0};
 let total=0,globalDocsRead=globalDocuments.length,siteObservedPages=0,unresolved=0;
 for(let i=0;i<95;i++){
  const memberIds=memberships[i];
  const pages=research.pages[i];
  const rowCounts=emptyCounters(DIAGNOSTIC_STATES);
  const person={ordinal:i+1,status:memberIds?'unique_member':'hold_member_identity',
    originalPages:pages.length,states:rowCounts};
  perPerson.push(person);
  if(!memberIds){unresolved++;continue;}
  const own=[...memberIds].flatMap(id=>indexed.get(id)||[]);
  for(const p of pages){
   if(!checkUrl(p.url)||! /^(?:[0-9a-f]{64})$/i.test(p.sha))
    throw Error('Invalid public original archive page metadata');
   total++;
   let best=null;
   for(const candidate of own){
    const possible=evidenceState(p.url,candidate);
    if(possible&&(!best||possible.priority<best.priority))
     best=possible;
   }
   const state=best?.status||'no_same_host_in_selected_linked_sources';
   states[state]++;rowCounts[state]++;
   if(best&&best.priority<=5){
    siteObservedPages++;
    matchedFamilies[best.family]++;
    if(!best.sha||!/^[0-9a-f]{64}$/.test(best.sha))hashes.whole_sha_unavailable++;
    else if(best.sha===p.sha.toLowerCase())hashes.whole_sha_equal++;
    else hashes.whole_sha_differs++;
   }
   let globalDirect=false,globalMeta=false;
   for(const gd of globalDocuments){
    if(typeof gd.sourceUrl!=='string')throw Error('Malformed global original document row');
    if(siteParts(gd.sourceUrl)?.key===siteParts(p.url)?.key)globalDirect=true;
    if(siteParts(gd.storedOriginalUrl)?.key===siteParts(p.url)?.key)globalMeta=true;
   }
   if(globalDirect)globalExactPresence.pagesWithGlobalDirectUrl++;
   if(globalMeta)globalExactPresence.pagesWithGlobalOriginalMetadata++;
  }
 }
 if(unresolved)throw Error('Identity HOLD: historical original URL diagnosis requires all 95 unique senators');
 if(total!==research.pages.reduce((a,b)=>a+b.length,0)||total!==130)
  throw Error('Public archive URL witness denominator unexpectedly changed');
 const report={
  schema:'senate-864-95-original-live-archive-url-classification-v2',
  historicalPersons:95,originalPageWitnesses:total,sourceLedgers:29,
  checkedExistingDefaultNeon:true,readOnlyTransaction:true,explicitRollback:true,
  productionWrites:0,notExactExcerptCompleteness:true,
  memberEvidenceRowsExamined:sourceRows.length,
  storedSourceAddressForms:{archiveReplayRows:archiveAddressRows,
   archiveReplayRowsWithOriginalMetadata:archivedWithOriginalMetadata,nonArchiveRows:liveAddressRows},
  memberLinkedStoredFamilyRows:familyRows,
  originalPagesWithPageLevelSourceIdentity:siteObservedPages,
  originalPagesWithSameHostButNoPageIdentity:states.same_host_path_unverified,
  sourceKindOfPageLevelMatches:matchedFamilies,
  wholeOriginalHtmlShaComparison:hashes,
  globalCandidateUrlPresence:globalExactPresence,globalSourceDocumentsRead:globalDocsRead,
  pageResolutionStates:states,perPerson
 };
 return validateV2Report(report);
}
export function validateV2Report(r){
 const top=['schema','historicalPersons','originalPageWitnesses','sourceLedgers',
  'checkedExistingDefaultNeon','readOnlyTransaction','explicitRollback','productionWrites',
  'notExactExcerptCompleteness','memberEvidenceRowsExamined','storedSourceAddressForms',
  'memberLinkedStoredFamilyRows','originalPagesWithPageLevelSourceIdentity',
  'originalPagesWithSameHostButNoPageIdentity','sourceKindOfPageLevelMatches',
  'wholeOriginalHtmlShaComparison','globalCandidateUrlPresence','globalSourceDocumentsRead',
  'pageResolutionStates','perPerson'].sort();
 if(!r||JSON.stringify(Object.keys(r).sort())!==JSON.stringify(top)
 ||r.schema!=='senate-864-95-original-live-archive-url-classification-v2'
 ||r.historicalPersons!==95||r.originalPageWitnesses!==130||r.sourceLedgers!==29
 ||r.checkedExistingDefaultNeon!==true||r.readOnlyTransaction!==true
 ||r.explicitRollback!==true||r.productionWrites!==0||r.notExactExcerptCompleteness!==true
 ||!Array.isArray(r.perPerson)||r.perPerson.length!==95
 ||!limited(r.memberEvidenceRowsExamined,MAX_SOURCE)
 ||!limited(r.globalSourceDocumentsRead,MAX_GLOBAL))
 throw Error('Untrusted historical V2 report envelope');
 const groups=[
  [r.pageResolutionStates,DIAGNOSTIC_STATES,130],
  [r.memberLinkedStoredFamilyRows,SOURCE_FAMILIES,r.memberEvidenceRowsExamined],
  [r.sourceKindOfPageLevelMatches,SOURCE_FAMILIES,r.originalPagesWithPageLevelSourceIdentity],
  [r.storedSourceAddressForms,['archiveReplayRows','archiveReplayRowsWithOriginalMetadata','nonArchiveRows'],null],
  [r.wholeOriginalHtmlShaComparison,['whole_sha_equal','whole_sha_differs','whole_sha_unavailable'],r.originalPagesWithPageLevelSourceIdentity],
  [r.globalCandidateUrlPresence,['pagesWithGlobalDirectUrl','pagesWithGlobalOriginalMetadata'],null]
 ];
 for(const [obj,keys,sum] of groups){
  if(!obj||JSON.stringify(Object.keys(obj).sort())!==JSON.stringify([...keys].sort())
   ||keys.some(k=>!limited(obj[k],MAX_SOURCE))
   ||(sum!==null&&keys.reduce((n,k)=>n+obj[k],0)!==sum))
   throw Error('Invalid protected aggregate classification');
 }
 if(r.storedSourceAddressForms.archiveReplayRows+r.storedSourceAddressForms.nonArchiveRows!==r.memberEvidenceRowsExamined
 ||r.storedSourceAddressForms.archiveReplayRowsWithOriginalMetadata>r.storedSourceAddressForms.archiveReplayRows
 ||r.originalPagesWithSameHostButNoPageIdentity!==r.pageResolutionStates.same_host_path_unverified
 ||r.originalPagesWithPageLevelSourceIdentity!==DIAGNOSTIC_STATES.slice(0,6).reduce((n,k)=>n+r.pageResolutionStates[k],0))
 throw Error('Inconsistent source address/candidate page partitions');
 let part=0;
 for(let i=0;i<95;i++){
  const row=r.perPerson[i];
  if(!row||JSON.stringify(Object.keys(row).sort())!==
     JSON.stringify(['ordinal','status','originalPages','states'].sort())
   ||row.ordinal!==i+1||row.status!=='unique_member'
   ||!limited(row.originalPages,130)
   ||!row.states||JSON.stringify(Object.keys(row.states).sort())!==JSON.stringify([...DIAGNOSTIC_STATES].sort())
   ||DIAGNOSTIC_STATES.some(k=>!limited(row.states[k],130))
   ||DIAGNOSTIC_STATES.reduce((n,k)=>n+row.states[k],0)!==row.originalPages)
    throw Error('Invalid ordinal-only private-safe per-person diagnostic');
  part+=row.originalPages;
 }
 if(part!==130||r.globalCandidateUrlPresence.pagesWithGlobalDirectUrl>130
   ||r.globalCandidateUrlPresence.pagesWithGlobalOriginalMetadata>130
   ||JSON.stringify(r).length>45000
   ||/(?:https?:\/\/|postgres(?:ql)?:|neon\.tech|@[\w.]+|password|NEON_API_KEY|sourceDocumentId|membershipId|sourceUrl|contentSha256|[a-f0-9]{64})/i.test(JSON.stringify(r)))
  throw Error('Private source identifiers or incorrect witness count leaked');
 return r;
}
