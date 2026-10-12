/**
 * Evidence Track D, Issue #987: bounded eight exact first-party statement
 * URL leads, including two separately attributed senators in one DFL release.
 * No historic first-post clock, private source-document/row, original media,
 * human-approved quote, member vote, or forecast is inferred.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import discovery from '../docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json' with {type:'json'};
import {probeWayback,probeCommonCrawl,probeCurrentFirstParty,parseWaybackCdx,checkCues}
 from './probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';
export const VERSION='senate-media-eight-selected-caucus-original-body-source-proof-v1';
export const SELECTION=Object.freeze([
 {id:'public-2021-osmek-oath',speakers:[['David Osmek','there is no reason to raise taxes']],cc:['CC-MAIN-2021-10','CC-MAIN-2021-17'],policy:'prospective_budget_tax_emergency_policy',prospective:true},
 {id:'public-2021-koran-budget',speakers:[['Mark Koran','when crafting our two-year budget, we must show restraint']],cc:['CC-MAIN-2021-17','CC-MAIN-2021-25'],policy:'prospective_tax_budget_small_business',prospective:true},
 {id:'public-2022-bigham-eken-separated',speakers:[['Karla Bigham','unite the caucus around the important issues'],['Kent Eken','unique challenges our rural communities face']],cc:['CC-MAIN-2022-05','CC-MAIN-2022-21'],policy:'future_caucus_legislative_priorities_not_bill_specific',prospective:false},
 {id:'public-2023-nelson-rochester-schools',speakers:[['Carla Nelson','incredible budget pressures placed on the district by unfunded mandates']],cc:['CC-MAIN-2023-50','CC-MAIN-2024-10'],policy:'education_local_finance_reaction_after_school_proposal',prospective:false},
 {id:'public-2024-mcewen-mining',speakers:[['Jen McEwen','my support for prove it first legislation stems from a deep commitment']],cc:['CC-MAIN-2024-10','CC-MAIN-2024-18'],policy:'prospective_sulfide_mining_environmental_permitting',prospective:true},
 {id:'public-2024-hawj-transport',speakers:[['Foung Hawj','my legislative proposals are inclusive, improve quality of service']],cc:['CC-MAIN-2024-18','CC-MAIN-2024-22'],policy:'prospective_transportation_equity_bill_support',prospective:true},
 {id:'public-2025-farnsworth-mining',speakers:[['Robert Farnsworth','i have been in touch with cleveland cliffs leadership']],cc:['CC-MAIN-2025-13','CC-MAIN-2025-18'],policy:'reaction_to_announced_mine_layoffs',prospective:false},
 {id:'public-2025-clark-ice-student',speakers:[['Doron Clark','our campuses should be a safe place for all students']],cc:['CC-MAIN-2025-13','CC-MAIN-2025-18'],policy:'reaction_after_immigration_student_detention',prospective:false}
].map(Object.freeze));
const HOSTS=new Set(['senatedfl.mn','www.mnsenaterepublicans.com']);
export function exactLeads(ledger=discovery){
 if(ledger?.version!=='senate-media-2021-25-public-broader-source-discovery-v1'
  ||ledger.selectedPublicSourceLeads?.length!==25)throw Error('unexpected 25-original-source public discovery ledger');
 const selected=[],ids=new Set(),urls=new Set();
 for(const entry of SELECTION){
  const rows=ledger.selectedPublicSourceLeads.filter(x=>x.id===entry.id);
  if(rows.length!==1)throw Error('missing or ambiguous exact first-party source ID');
  const item=rows[0],u=new URL(item.url),day=item.currentPageDisplayedDates?.[0];
  if(ids.has(item.id)||urls.has(item.url)||item.attributionCategory!==(entry.speakers.length===2?'two_labeled_individuals':'individual')
   ||!Array.isArray(item.individuallyNamedSenatorSpeakers)||item.individuallyNamedSenatorSpeakers.length!==entry.speakers.length
   ||item.individuallyNamedSenatorSpeakers.some((x,i)=>x.name!==entry.speakers[i][0]||!/^https:\/\/www\.lrl\.mn\.gov\/legdb\/fulldetail\?ID=\d+$/.test(x.officialMemberHistoryUrl))
   ||!/^20(?:21|22|23|24|25)-\d\d-\d\d$/.test(day||'')
   ||day.slice(0,4)!==item.id.split('-')[1]
   ||u.protocol!=='https:'||!HOSTS.has(u.hostname)||u.port||u.username||u.password||u.search||u.hash||!item.url.endsWith('/')
   ||item.hasOriginalHistoricalArchivedBodySha256!==false
   ||item.namedSenatorQuotationApprovedForHistoricalEvidence!==false
   ||item.anyLegislativeVoteProvedByThisPage!==false)
   throw Error('untrusted source/senator/current date or prior original assertion');
  ids.add(item.id);urls.add(item.url);
  selected.push(Object.freeze({
   id:item.id,displayedDay:day,url:item.url,
   quoted:Object.freeze(entry.speakers.map(([senator,cue],i)=>Object.freeze({
    senator,cue,lrl:item.individuallyNamedSenatorSpeakers[i].officialMemberHistoryUrl,
    attribution:'current_party_caucus_named_individual_written_quotation_pending_original_turn_boundary'
   }))),
   ccCollections:entry.cc,policyTopic:entry.policy,possibleProspectivePolicyComment:entry.prospective,
   printedPublisherDateIsNotIndependentOriginalFirstPublishedUtc:true
  }));
 }
 if(selected.length!==8||selected.reduce((x,s)=>x+s.quoted.length,0)!==9
  ||new Set(selected.flatMap(x=>x.quoted.map(y=>y.senator))).size!==9
  ||new Set(selected.map(x=>x.displayedDay.slice(0,4))).size!==5)
  throw Error('unexpected eight-source nine-senator scope');
 return selected;
}
const trim=o=>({
 captureUtc:o.captureUtc||null,
 originalIndexedSha1:o.indexedOriginalSha1||null,
 rawOriginalHtmlSha256:o.rawOriginalSha256||null,
 rawOriginalHtmlBytes:o.originalBytes??o.rawBytes??null,
 archiveStatus:o.status,
 selectedNamedIndividualCues:o.shortCues?.map(q=>({
   name:q.senator,cuePresentInOriginalVisibleBody:q.cueFound,
   namedSenatorNearSelectedIssueCue:q.fullNameInNearbySourceText,
   completeIndividualQuotationApproved:false,
   printedQuoteTurnBoundedAndApproved:false
 }))??null
});
export async function probeOne(lead,f=fetch){
 const current=await probeCurrentFirstParty(lead,f);
 const [wayback,commonCrawl]=await Promise.all([probeWayback(lead,f),probeCommonCrawl(lead,f)]);
 const wb=wayback.originalHtmlReplayAttempts.map(trim);
 const cc=commonCrawl.queriedCollections.map(x=>({
  collection:x.collection,indexStatus:x.indexStatus,indexCandidates:x.indexedCandidates,
  originalWarcReplays:x.originalWarcReplayAttempts.map(trim)
 }));
 const proofs=[...wb,...cc.flatMap(x=>x.originalWarcReplays)].filter(x=>x.archiveStatus==='sha1_authenticated_original_publisher_html'
  ||x.archiveStatus==='sha1_authenticated_original_commoncrawl_warc_html');
 const originalVersionsByIdentity=[...new Map(proofs.map(x=>[x.captureUtc+'|'+x.rawOriginalHtmlSha256,x])).values()];
 return {id:lead.id,url:lead.url,publisherDisplayedDay:lead.displayedDay,
  policyTopic:lead.policyTopic,possibleProspectivePolicyComment:lead.possibleProspectivePolicyComment,
  individualNamedServingStateSenators:lead.quoted.map(x=>({name:x.senator,lrl:x.lrl})),
  currentPublisher:{status:current.status,selectedCueObservations:current.cues?.map(q=>({
   speaker:q.senator,selectedShortIssueFragmentOnCurrentPage:q.cueFound,fullNameNearby:q.fullNameInNearbySourceText
  }))??null,notHistoricalPageCapture:true},
  wayback:{indexStatus:wayback.indexStatus,indexCandidates:wayback.indexCandidates,
   firstIndexPagePossiblyTruncated:wayback.firstPagePossiblyTruncated,originalReplays:wb},
  commonCrawl:cc,authenticatedHistoricOriginalCaptureVersions:originalVersionsByIdentity.length,
  earliestAuthenticatedSourceBodyUtc:proofs.length?proofs.map(x=>x.captureUtc).sort()[0]:null,
  historicalCueInAtLeastOneAuthenticatedOriginalForEachNamedSenator:
   lead.quoted.map((q,i)=>({speaker:q.senator,foundInAnOriginal:proofs.some(x=>x.selectedNamedIndividualCues?.[i]?.cuePresentInOriginalVisibleBody===true)})),
  noSpecificNamedSpeakerVerbatimQuoteOrActualVotesCertified:true,
  noEvidenceThatPublisherDisplayedDateIsFirstOriginalUtc:true,
  noGlobalSourceAbsenceInferredFromEmptyOrUnavailableSelectedIndexes:true};
}
export async function run(f=fetch){
 const selected=exactLeads(),sources=[];
 for(let i=0;i<selected.length;i+=2){
  sources.push(...await Promise.all(selected.slice(i,i+2).map(x=>probeOne(x,f))));
 }
 return {version:VERSION,researchDateLocal:'2026-10-11',selection:'eight_newly_original_probed_page_urls_from_existing_25_current_publisher_discovery',
  selectedSourceUrls:selected.length,distinctNamedSenators:new Set(selected.flatMap(x=>x.quoted.map(q=>q.senator))).size,
  selectedIndividualPrintedSpeakerCandidates:selected.reduce((n,x)=>n+x.quoted.length,0),
  sourceYears:[2021,2022,2023,2024,2025],sources,
  authenticHistoricalOriginalHtmlBodies:sources.reduce((n,s)=>n+s.authenticatedHistoricOriginalCaptureVersions,0),
  distinctOriginalPublisherUrlsNewlyAuthenticated:sources.filter(s=>s.authenticatedHistoricOriginalCaptureVersions>0).length,
  actualHumanApprovedCompleteSenatorQuotes:0,originalAudioVoiceAuthenticationCount:0,memberVotesVerified:0,
  noOriginalHtmlAudioPdfWarcPersisted:true,noPrivateContextOrDbRead:true,noForecastCollectorOrModelChanges:true,
  sourcePresenceNotProductionCorpusOrPreVoteEligibility:true};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const pos=process.argv.indexOf('--output'),file=process.argv[pos+1];
 if(pos<0||!/^artifacts\/[A-Za-z0-9._-]+\.json$/.test(file||''))throw Error('safe metadata only artifact destination required');
 const result=await run();
 mkdirSync('artifacts',{recursive:true});
 writeFileSync(file,JSON.stringify(result,null,2)+'\n');
 console.log('TRACK_D_EIGHT_EXACT_HISTORICAL_ORIGINALS='+JSON.stringify({
  sourceVersions:result.authenticHistoricalOriginalHtmlBodies,
  distinctPublisherOriginalUrls:result.distinctOriginalPublisherUrlsNewlyAuthenticated,
  sourceSummaries:result.sources.map(x=>({id:x.id,publisherDisplayedDay:x.publisherDisplayedDay,
   speakerCues:x.historicalCueInAtLeastOneAuthenticatedOriginalForEachNamedSenator,
   earliest:x.earliestAuthenticatedSourceBodyUtc,
   matchedSources:x.wayback.originalReplays.concat(x.commonCrawl.flatMap(y=>y.originalWarcReplays)).filter(y=>y.rawOriginalHtmlSha256),
   indexStatus:x.wayback.indexStatus,ccStatuses:x.commonCrawl.map(y=>({collection:y.collection,indexStatus:y.indexStatus}))}))
 }));
}
