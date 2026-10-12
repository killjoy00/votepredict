/**
 * VotePredict Issue #987 / Track D. Public 93rd Legislature 2024 bill-action
 * crosswalk pilot for a SHA-authenticated Hawj March 2024 *written* statement.
 * NO private production votes, labels, predictive features or senator vote
 * conclusions. The only primary official senator vote authority is the Senate
 * Journal; a secondary tracker is labeled as secondary/non-authoritative.
 * HTML probes are observation-time public status pages, NOT archived 2024 pages.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import quoteReceipts from '../docs/evaluation/senate-media-2024-hawj-mcewen-original-written-quote-receipts-20261012.json' with {type:'json'};
export const VERSION='track-d-hawj-hf5247-2024-public-omnibus-action-bridge-v1';
const MAX=5_000_000;
export const QUERIES=Object.freeze([
 Object.freeze({id:'sf1416-2023-24',chamber:'SF',num:'1416',url:'https://www.revisor.mn.gov/bills/93/2023/0/SF/1416/?body=Senate',expected:['SF 1416','2023 - 2024','02/08/2023','04/11/2023']}),
 Object.freeze({id:'sf3257-2023-24',chamber:'SF',num:'3257',url:'https://www.revisor.mn.gov/bills/93/2023/0/SF/3257/?body=Senate',expected:['SF 3257','2023 - 2024','04/13/2023']}),
 Object.freeze({id:'sf3250-2023-24',chamber:'SF',num:'3250',url:'https://www.revisor.mn.gov/bills/93/2023/0/SF/3250/?body=Senate',expected:['SF 3250','2023 - 2024','03/18/2024']}),
 Object.freeze({id:'sf4056-2023-24',chamber:'SF',num:'4056',url:'https://www.revisor.mn.gov/bills/93/2024/0/SF/4056/?body=Senate',expected:['SF 4056','2023 - 2024','02/22/2024','04/15/2024']}),
 Object.freeze({id:'hf5247-2023-24',chamber:'HF',num:'5247',url:'https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/?body=Senate',expected:['HF 5247','2023 - 2024','05/07/2024','05/19/2024','55-10','34-14','05/24/2024']}),
 Object.freeze({id:'hf5247-fourth-engrossment',chamber:'HF',num:'5247',url:'https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/versions/4/',expected:['HF 5247','2023 - 2024','Equivalent materials','1001 Johnson Parkway','competitive bidding']}),
 Object.freeze({id:'hawj-secondary-conservation-yes',chamber:'secondary',num:'5247',url:'https://www.conservationminnesota.org/legislation/tax-omnibus-bill-hf5247-senate',expected:['HF5247','May 19, 2024','Yes Votes','Foung Hawj']})
]);
const HASH=/^[a-f0-9]{64}$/;
export function quoteAnchor(receipts=quoteReceipts){
 if(receipts?.version!=='senate-media-2024-hawj-mcewen-historical-individually-bounded-written-quotes-receipts-v1')
  throw Error('not the merged personally attributed 2024 original quote source receipt');
 const hawj=receipts.sources.filter(x=>x.senator==='Foung Hawj');
 if(hawj.length!==2||hawj[0].sourceHistoricalArchiveUtc!=='2024-03-24T19:01:09Z'||
  hawj[0].rawOriginalHttpHtmlSha256!=='aa6da6e8722e33f2f692ba31bfd6699cf97768e74c788dbdb0786a75a3ad5743'||
  hawj[0].officialMemberHistoryUrl!=='https://www.lrl.mn.gov/legdb/fulldetail?ID=15380'||
  hawj.some(x=>!x.hasBoundedQuoteOwnedByNamedSenator||!x.ownNamedIntroImmediatelyBeforeQuote||
   !x.shortPolicyCueExactlyOnceInsideOpenAndClosedQuote))
  throw Error('different or unproven public original Hawj historical statement');
 return Object.freeze({senator:'Foung Hawj',originalPublisherUrl:hawj[0].exactOriginalUrl,
  earliestOriginalHtmlUtc:hawj[0].sourceHistoricalArchiveUtc,
  earliestOriginalHtmlSha256:hawj[0].rawOriginalHttpHtmlSha256,
  officialMemberHistoryUrl:hawj[0].officialMemberHistoryUrl});
}
export function validateQueries(sources=QUERIES){
 if(sources!==QUERIES||sources.length!==7||new Set(sources.map(x=>x.id)).size!==7||
  new Set(sources.map(x=>x.url)).size!==7)throw Error('public original bill action source allowlist changed');
 for(const src of sources){
  const u=new URL(src.url);
  if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash||
    (u.hostname!=='www.revisor.mn.gov'&&u.hostname!=='www.conservationminnesota.org'))
   throw Error('unexpected public legislative source host');
  if(src.chamber!=='secondary'){
   if(!/^\/bills\/93\/202[34]\/0\/(?:SF|HF)\/\d+\/(?:versions\/4\/)?$/.test(u.pathname)||
    u.pathname.includes('/2025/')||u.pathname.includes('/2026/')||
    (u.search!==''&&u.search!=='?body=Senate')||
    !u.pathname.includes('/'+src.chamber+'/'+src.num+'/')||
    src.expected[0]!==src.chamber+' '+src.num)throw Error('wrong Minnesota legislature session or bill identity');
  }else if(u.toString()!==QUERIES[6].url)throw Error('untrusted third-party source');
 }
 return true;
}
function visibleText(html){
 return html.replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(head|script|style|template|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
  .replace(/<[^>]*>/g,' ')
  .replace(/&(?:nbsp|#160);/gi,' ')
  .replace(/&(?:amp);/gi,'&')
  .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n)))
  .normalize('NFKC').replace(/\s+/g,' ').trim();
}
export function evaluateReadOnlyPublicStatus(html,query){
 if(typeof html!=='string'||html.length<500||html.length>MAX||!QUERIES.includes(query))throw Error('untrusted public legislative HTML');
 const t=visibleText(html),lower=t.toLowerCase();
 const terms=query.expected.map(value=>({value,found:lower.includes(value.toLowerCase())}));
 const sess=lower.includes('93rd legislature')&&lower.includes('2023 - 2024')&&
  !lower.includes('94th legislature (2025 - 2026)');
 const exactIdentity=query.chamber==='secondary'?true:sess&&lower.includes((query.chamber+' '+query.num).toLowerCase());
 const historicActions=Object.freeze({
  senateMay7FloorPassTallyMentioned:query.id==='hf5247-2023-24'&&lower.includes('05/07/2024')&&lower.includes('55-10'),
  senateMay19ThirdReadingTallyMentioned:query.id==='hf5247-2023-24'&&lower.includes('05/19/2024')&&lower.includes('34-14'),
  senateMay19ConferenceTallyMentioned:query.id==='hf5247-2023-24'&&lower.includes('05/19/2024')&&lower.includes('34-12'),
  laterMay24Chapter127Marker:query.id==='hf5247-2023-24'&&lower.includes('05/24/2024')&&lower.includes('chapter')&&lower.includes('127'),
  sectionTextContainsTranslatedMaterials:query.id==='hf5247-fourth-engrossment'&&lower.includes('equivalent materials')&&lower.includes('qualifying language'),
  sectionTextContainsBidding:query.id==='hf5247-fourth-engrossment'&&lower.includes('competitive bidding'),
  sectionTextContainsStPaulLocation:query.id==='hf5247-fourth-engrossment'&&lower.includes('1001 johnson parkway'),
  // Secondary is merely a tip for official Senate Journal verification.
  secondarySourceListsHawjUnderYesVotes:query.id==='hawj-secondary-conservation-yes'&&
   lower.includes('yes votes')&&lower.includes('foung hawj')&&
   lower.indexOf('foung hawj')>lower.indexOf('yes votes')&&
   (!lower.includes('no votes')||lower.indexOf('foung hawj')<lower.indexOf('no votes'))
 });
 return {exactSessionAndBillIdentity:exactIdentity,
  textMetadataTerms:terms,allSelectedMarkersVisible:terms.every(x=>x.found),
  publicSourceOriginalBodySha256:createHash('sha256').update(html,'utf8').digest('hex'),
  observedRenderedTextChars:t.length,
  actionMarkerObservations:historicActions,
  thisIsTodayObservedStatusHtmlNotAnAuthenticatedHistorical2024StatusSnapshot:true,
  thisIsNotOfficialIndividualSenateJournalVoteValidation:true};
}
async function responseBytes(r){
 const header=r.headers.get('content-length');
 if(header!==null&&(!/^\d+$/.test(header)||Number(header)>MAX))throw Error('oversized legislative public status source');
 if(!r.body)throw Error('empty public source');
 const reader=r.body.getReader(),parts=[];let n=0;
 while(true){
  const x=await reader.read();if(x.done)break;n+=x.value.byteLength;
  if(n>MAX){await reader.cancel().catch(()=>{});throw Error('oversized public status source');}
  parts.push(x.value);
 }
 if(n<500)throw Error('unreasonably short legislative source');
 const raw=Buffer.allocUnsafe(n);let offset=0;
 for(const x of parts){Buffer.from(x).copy(raw,offset);offset+=x.byteLength;}
 return raw;
}
export async function checkOne(q,f=fetch){
 validateQueries();
 const r={sourceId:q.id,url:q.url,kind:q.chamber==='secondary'?'independent_nonofficial_vote_tracker':'official_revisor_current_status_or_enacted_bill_text',
  observedStatus:'public_source_unavailable_unknown',downloadRawSha256:null,
  originalRawHttpBytes:null,metadata:null,originalSenateJournalMemberBallotAuthenticated:false};
 try{
  const resp=await f(q.url,{method:'GET',redirect:'manual',
   headers:{accept:'text/html','accept-encoding':'identity','user-agent':'VotePredict/2.0 public-93rd-legislature-bill-cutoff-research'},
   signal:AbortSignal.timeout(20000)});
  if(resp.status!==200){r.observedStatus=resp.status>=300&&resp.status<400?'redirect_refused_unknown':'http_unavailable_unknown';return r;}
  const mime=(resp.headers.get('content-type')||'').split(';')[0].toLowerCase().trim();
  if(mime!=='text/html'){r.observedStatus='not_original_public_html_unknown';return r;}
  const raw=await responseBytes(resp);r.originalRawHttpBytes=raw.byteLength;
  r.downloadRawSha256=createHash('sha256').update(raw).digest('hex');
  r.metadata=evaluateReadOnlyPublicStatus(raw.toString('utf8'),q);
  r.observedStatus=r.metadata.allSelectedMarkersVisible&&r.metadata.exactSessionAndBillIdentity?
   'exact_first_party_or_labeled_secondary_public_page_observed':'source_identity_or_expected_action_marker_missing_unknown';
 }catch{r.observedStatus='public_source_fetch_or_validation_unknown';}
 return r;
}
export async function run(f=fetch){
 validateQueries();const anchor=quoteAnchor();const sources=[];
 for(let i=0;i<QUERIES.length;i+=2)sources.push(...await Promise.all(QUERIES.slice(i,i+2).map(q=>checkOne(q,f))));
 const official=sources.filter(s=>s.kind==='official_revisor_current_status_or_enacted_bill_text'&&s.observedStatus==='exact_first_party_or_labeled_secondary_public_page_observed');
 const passage=sources.find(x=>x.sourceId==='hf5247-2023-24');
 const law=sources.find(x=>x.sourceId==='hf5247-fourth-engrossment');
 const tracker=sources.find(x=>x.sourceId==='hawj-secondary-conservation-yes');
 return {version:VERSION,observationDateLocal:'2026-10-12',historicalSpeakerAnchor:anchor,
  exactBillSession:'93rd Legislature (2023-2024)',
  selectedPublicSourceUrls:7,currentOfficialRevisorSources:6,independentNonOfficialMemberTrackerSources:1,
  officialRevisorPagesObservedWithSelectedMarkers:official.length,
  may7AndMay19SenateChamberAggregateVoteCandidate:
   passage?.metadata?.actionMarkerObservations?.senateMay7FloorPassTallyMentioned&&
   passage?.metadata?.actionMarkerObservations?.senateMay19ThirdReadingTallyMentioned||false,
  enactedBillFinalTextTopicConnectionsObserved:
   law?.metadata?.actionMarkerObservations?.sectionTextContainsTranslatedMaterials&&
   law?.metadata?.actionMarkerObservations?.sectionTextContainsBidding||false,
  secondaryHawjYesTipObserved:tracker?.metadata?.actionMarkerObservations?.secondarySourceListsHawjUnderYesVotes||false,
  officialIndividualSenateJournalHawjBallotVerified:false,
  exact2024BillVersionAvailableBeforeMay19VoteVerified:false,
  automaticSFToOmnibusLegislativeIdentityEquivalence:false,
  productionPredictionOrTrainingEligibilityProved:false,
  originalSenatorSourceStillEarliestMarch24RatherThanPublisherDisplayedMarch15:true,
  noHistoricGovWebPageOrCurrentSourceTextPersisted:true,
  noPrivateVotePredictRowsQueried:true,
  noProductionCollectorModelDatabaseServingOrVoteScoringChanged:true,
  sources};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const at=process.argv.indexOf('--output'),name=process.argv[at+1];
 if(at<0||!/^artifacts\/[a-z0-9._-]+\.json$/i.test(name||''))throw Error('safe public source metadata artifact destination required');
 const report=await run();
 mkdirSync('artifacts',{recursive:true});writeFileSync(name,JSON.stringify(report,null,2)+'\n');
 console.log('TRACK_D_HAWJ_HF5247_PUBLIC_ACTION_CUTOFF='+JSON.stringify({
  observedOfficialSources:report.officialRevisorPagesObservedWithSelectedMarkers,
  omnibusChamberVotesTip:report.may7AndMay19SenateChamberAggregateVoteCandidate,
  enactedTopicTextTip:report.enactedBillFinalTextTopicConnectionsObserved,
  nongovernmentalHawjYesTip:report.secondaryHawjYesTipObserved,
  officialIndividualVoteVerified:report.officialIndividualSenateJournalHawjBallotVerified,
  status:report.sources.map(s=>({id:s.sourceId,status:s.observedStatus,bytes:s.originalRawHttpBytes,sha256:s.downloadRawSha256,
   terms:s.metadata?.textMetadataTerms,observed:s.metadata?.actionMarkerObservations}))
 }));
}
