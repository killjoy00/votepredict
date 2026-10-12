/**
 * #864: original public pages only for serving 2021-22 Senator Charles Wiger,
 * who remains one of THREE WITHOUT authenticated candidate-owned Senate
 * campaign site excerpts. These are caucus PUBLISHER statements, not sites.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {sha1Base32,validCdxEntries,decodeVisibleOriginal}
 from './probe-senate-864-substantive-new-originals.mjs';
const MAX=2_500_000;
const sha=b=>createHash('sha256').update(b).digest('hex');
const norm=x=>String(x).normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
export function validateWiger(m) {
 if(m?.schema!=='senate-864-2021-22-charles-wiger-bill-provision-original-recovery-leads-v1'||
  m.issue!==864||m.senatorOfficialServiceName!=='Sr., Charles W. Wiger'||
  m.official2021District!=='43'||m.sources?.length!==3||
  m.officialRosterFirstPartyWebsiteExcerptCount!==0||
  m.doNotCountPublisherAsCampaignSite!==true||m.noOutreachNoProductionDbNoModelChange!==true)
  throw Error('unapproved official 95 person / original publisher research scope');
 const years=['2021-04-22','2021-06-22','2022-04-01'];
 for(const [i,r] of m.sources.entries()){
  const u=new URL(r.url);
  if(r.date!==years[i]||u.hostname!=='senatedfl.mn'||u.protocol!=='https:'||
    u.search||u.hash||!r.url.includes('wiger')||
    r.reportedSpeakerKind!=='signed_individual_original_first_party_written_statement')
   throw Error('wrong first-party Wiger original URI, year or speaker');
  if(i===0&&(r.bill!=='SF960'||r.cues?.length!==3))throw Error('2021 SF960 original bill cue drift');
  if(i>0&&(r.bill!==null||r.cues?.length!==0))
   throw Error('uncertified standalone new quote or bill inferred from live site');
 }
 return true;
}
export function boundSF960WigerSignedOriginal(body,source){
 const t=decodeVisibleOriginal(body.toString('utf8'));
 const cue=source.cues.map(norm);
 const locations=cue.map(c=>t.indexOf(c));
 const once=cue.every((c,i)=>locations[i]>=0&&t.indexOf(c,locations[i]+1)<0);
 const first=locations[0],last=locations.at(-1);
 const introduction=first<0?'':t.slice(Math.max(0,first-1600),first);
 const signed=last<0?'':t.slice(last+cue.at(-1).length,last+cue.at(-1).length+500);
 const hasIssuer=/senator chuck wiger.{0,400}released the following statement/i.test(introduction);
 const signature=/senator chuck wiger/.test(signed);
 const onSource=t.includes('senate wiger statement on omnibus education bill')||
  t.includes('senate wiger statement');
 const correctOrder=first>=0&&last>first&&locations[1]>first&&last>locations[1]&&last-first<5000;
 const verified=once&&hasIssuer&&signature&&onSource&&correctOrder;
 return {verified,sourcePageIsIndependentMinnesotaSenateDFLPublisher:true,
  allThreeSpecificIssueCuesPresentExactlyOnce:once,
  candidateOriginalSignedSpeakerIntroBoundedToChuckWiger:hasIssuer,
  originalShortQuoteSpanFollowedByOriginalChuckWigerSignature:signature,
  allThreePolicyClausesInActualOriginalPassageSequence:correctOrder,
  originalSelectedBoundedExcerptSha256:verified?cue.map(q=>sha(Buffer.from(q))):[],
  firstAuthoredOriginalTimestampIndependentlyProved:false,
  officialSF960PersonalVoteOrPolicyVersionNotInferred:true,
  thisIsNotCandidateOwnedWebsite:false};
}
async function fetchBounded(r,limit){
 if(r.status!==200||!r.body)throw Error('non200');
 let n=0,parts=[];const rd=r.body.getReader();
 while(true){const x=await rd.read();if(x.done)break;n+=x.value.byteLength;
  if(n>limit){await rd.cancel().catch(()=>{});throw Error('too large');}
  parts.push(Buffer.from(x.value));
 }
 return Buffer.concat(parts,n);
}
export async function probeWiger(s,fetcher=fetch){
 const result={id:s.id,primaryOriginalUrl:s.url,publisherDisplayDayNotVerifiedFirstPublication:s.date,
   sourceKind:'caucus_owned_wiger_signed_statement_not_candidate_website',
   status:'UNAVAILABLE_UNKNOWN',originalCapturedPublicByUtc:null,originalIndexedSha1Base32:null,
   originalRawHtmlSha256:null,originalBytes:null,
   originalHtmlVerified:false,originalWigerNamedIssuePositionVerified:false,
   originalQuoteProof:null,originalWasBefore2021June22:false,
   originalWasBefore2022May03:false,
   doesNotProve2020ElectionCandidateOriginalSite:true,
   noFullOriginalBodySaved:true,errors:[]};
 const cd=new URL('https://web.archive.org/cdx/search/cdx');
 for(const [key,val] of Object.entries({url:s.url,output:'json',from:'2021',to:'2023',
   filter:'statuscode:200',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'60'}))
  cd.searchParams.set(key,val);
 cd.searchParams.append('filter','mimetype:text/html');
 try{
  const q=await fetcher(cd,{method:'GET',redirect:'manual',headers:{accept:'application/json'},
   signal:AbortSignal.timeout(20000)});
  if(q.status!==200){result.status='CDX_HTTP_'+q.status+'_UNKNOWN';return result;}
  const data=await fetchBounded(q,180000);
  let entries;
  try{entries=validCdxEntries(JSON.parse(data.toString('utf8')),s.url,s.date);}
  catch{result.status='CDX_INVALID_UNKNOWN';return result;}
  if(!entries.length){result.status='INDEX_NO_QUALIFIED_SNAPSHOTS_IN_BOUNDED_QUERY_UNKNOWN';return result;}
  for(const e of entries){
   try{
    const re=await fetcher('https://web.archive.org/web/'+e.timestamp+'id_/'+e.archiveOriginalUrl,
      {method:'GET',redirect:'manual',headers:{accept:'text/html','accept-encoding':'identity'},
        signal:AbortSignal.timeout(30000)});
    if(re.status!==200||(re.headers.get('content-type')||'').toLowerCase().split(';')[0]!=='text/html'){
     result.errors.push('original_replay_http_or_mime_invalid');continue;}
    const bytes=await fetchBounded(re,MAX);
    if(bytes.length<2000||sha1Base32(bytes)!==e.indexedSha1Base32){
     result.errors.push('raw_original_html_does_not_match_entire_CDX_SHA1');continue;}
    const visible=decodeVisibleOriginal(bytes.toString('utf8'));
    if(!visible.includes('chuck wiger')){result.errors.push('original_body_does_not_name_wiger');continue;}
    const proof=s.cues.length>0?boundSF960WigerSignedOriginal(bytes,s):null;
    result.originalRawHtmlSha256=sha(bytes);
    result.originalIndexedSha1Base32=e.indexedSha1Base32;
    result.originalBytes=bytes.length;
    result.originalHtmlVerified=true;
    result.originalCapturedPublicByUtc=e.timestamp.replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/,'$1-$2-$3T$4:$5:$6Z');
    result.originalWigerNamedIssuePositionVerified=proof?.verified===true;
    result.originalQuoteProof=proof;
    result.originalWasBefore2021June22=e.timestamp<'20210622000000';
    result.originalWasBefore2022May03=e.timestamp<'20220503000000';
    result.status=proof?.verified?'WHOLE_INDEXED_ORIGINAL_AND_SIGNED_WIGER_SF960_CUES_MATCH':
      'WHOLE_WIGER_ORIGINAL_HTML_VERIFIED_NOT_QUOTE_BOUND';
    break;
   }catch{result.errors.push('original_raw_replay_unavailable_unknown');}
  }
  if(!result.originalHtmlVerified)result.status='INDEX_ONLY_RAW_REPLAY_OR_SHA_UNAVAILABLE_UNKNOWN';
 }catch{result.status='CDX_NETWORK_OR_PROVIDER_ERROR_UNKNOWN';}
 return result;
}
export async function run(m,fetcher=fetch){
 validateWiger(m);
 const results=[];
 for(const s of m.sources)results.push(await probeWiger(s,fetcher));
 return {schema:'senate-864-wiger-2021-22-original-firstparty-specific-education-release-v1',
  issue:864,person:'Sr., Charles W. Wiger',
  originalSenateCandidateCampaignSitePeopleIncrement:0,
  distinctWholeOriginalFirstPartyPublisherPagesVerified:results.filter(x=>x.originalHtmlVerified).length,
  exactIndividuallySignedSF960OriginalQuoteBlocksVerified:results.filter(x=>x.originalWigerNamedIssuePositionVerified).length,
  firstPartyOriginalsPubliclyAuthenticatedBefore2022May03:results.filter(x=>x.originalHtmlVerified&&x.originalWasBefore2022May03).length,
  verifiedOriginals:results,
  noVotesClassifiedFromAuthorshipOrPartyContext:true,
  noFullOriginalHtmlPersisted:true,noProductionChanges:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const m=JSON.parse(readFileSync('data/evaluation/senate-864-wiger-2021-22-direct-legislative-education-original-leads-v1.json','utf8'));
 const out=resolve(process.argv[2]||'/tmp/senate-864-wiger-original-2021-22.json'),r=await run(m);
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(r,null,2)+'\n');
 console.log(JSON.stringify({out,originals:r.distinctWholeOriginalFirstPartyPublisherPagesVerified,
  exactSignedSF960:r.exactIndividuallySignedSF960OriginalQuoteBlocksVerified,
  results:r.verifiedOriginals.map(x=>[x.id,x.status,x.originalCapturedPublicByUtc])}));
}
