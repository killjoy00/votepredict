/**
 * #864 primary-source research only: test four individually named 2023
 * conditional bargaining statements against contemporaneous ORIGINAL HTML.
 * No source text/audio stored, no network outside explicitly allowed hosts,
 * no model or production changes. Revisor/Journals independently classify votes.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validCdxEntries,sha1Base32,decodeVisibleOriginal}
 from './probe-senate-864-substantive-new-originals.mjs';

const CAP=2_500_000;
const own=x=>JSON.parse(JSON.stringify(x));
const digest=b=>createHash('sha256').update(b).digest('hex');
const norm=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();

export function validateManifest(m) {
 if(!m||m.schema!=='senate-864-2023-bonding-predecision-named-direct-statement-leads-v1'||
  m.issue!==864||m.distinctUnderlyingSpeakerStatements!==4||
  m.originalVerifiedHistoricalBodiesInThisManifestBeforeLiveProbe!==0||
  m.officialServiceRosterSha256!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'||
  m.sourceArticles?.length!==3||m.speakers?.length!==4||
  m.independentOfficialDecisionChronology?.length!==3||
  m.historicalPredictionOrSourceIngestionAuthorized!==false||m.noProductionDbWritesOrReads!==true)
  throw Error('untrusted scope or member/service denominator');
 const pages=new Map();
 for(const p of m.sourceArticles){
  const u=new URL(p.url);
  if(u.protocol!=='https:'||u.hostname!=='www.mnsenaterepublicans.com'||u.search||u.hash||
    !p.id.startsWith('bonding-202303')||!/^2023-03-0[67]$/.test(p.publisherDisplayedDay)||pages.has(p.id))
   throw Error('untrusted first-party historical publisher page');
  if(!Array.isArray(p.speakerIds)||p.speakerIds.length<1)throw Error('no named speaker in source');
  pages.set(p.id,p);
 }
 const names=new Set(),ids=new Set();
 for(const s of m.speakers){
  if(ids.has(s.id)||names.has(s.officialName)||s.stance!=='qualified_support'||
     !pages.has(s.sourcePrimaryPageId)||!pages.get(s.sourcePrimaryPageId).speakerIds.includes(s.id)||
     !['Mark T. Johnson','Karin Housley','Bill Weber','Nathan Wesenberg'].includes(s.officialName)||
     s.exactShortQuoteCue.length<40||s.exactShortQuoteCue.length>150||
     typeof s.condition!=='string'||s.condition.length<25||s.relevantDecisions.length!==3)
   throw Error('speaker identity/quote/condition mismatch');
  ids.add(s.id);names.add(s.officialName);
 }
 for(const p of m.sourceArticles)for(const id of p.speakerIds)if(!ids.has(id))
  throw Error('page references unknown speaker');
 const expected=[['2023-03-16','HF669',33,32],['2023-05-22','HF669',56,11],['2023-05-22','HF670',35,14]];
 for(const [i,d] of m.independentOfficialDecisionChronology.entries()){
  const [when,b,y,n]=expected[i];
  if(d.eventDate!==when||d.bill!==b||d.yeas!==y||d.nays!==n||d.chamber!=='Senate'||
     d.individualVoterRollUnverifiedInNewResearch!==true)
   throw Error('wrong official date/aggregate or falsified individual voter claim');
 }
 return {distinctSpeakers:4,distinctFirstPartyPublisherUrls:3,sourceToDecisionCount:12,
  HousleyRepeatedDifferentArticleIsNotAdditionalSpeech:true};
}
export function boundNamedOriginalQuote(rawOriginal,speaker) {
 if(!Buffer.isBuffer(rawOriginal)||rawOriginal.length>CAP||
    typeof speaker?.exactShortQuoteCue!=='string'||!speaker.onPublisherName)
  throw Error('untrusted original bytes or speaker');
 const t=decodeVisibleOriginal(rawOriginal.toString('utf8'));
 const cue=norm(speaker.exactShortQuoteCue);
 const first=t.indexOf(cue);
 if(first<0||t.indexOf(cue,first+1)>=0)
  return {verified:false,reason:'selected_cue_missing_or_duplicated',selectedCueOccurrences:first<0?0:2};
 const opener=Math.max(t.lastIndexOf('“',first),t.lastIndexOf('"',first));
 const closingMark=opener<0?'':t[opener]==='“'?'”':'"';
 const closing=closingMark?t.indexOf(closingMark,first+cue.length):-1;
 if(opener<0||first-opener>1800||closing<0||closing-opener>2800||
    t.indexOf(closingMark,opener+1)!==closing)
  return {verified:false,reason:'not_within_single_closed_direct_quote'};
 const after=t.slice(closing+1,closing+330);
 const name=norm(speaker.onPublisherName);
 const k=after.indexOf(name);
 if(k<0||k>210||after.slice(0,k).includes('“')||after.slice(0,k).includes('"')){
  // Observed first-party articles may use "Senator X said: [quotation]"
  // instead of "[quotation], Senator X said". Do not promote from mere
  // nearby names. Emit only safe booleans and lengths for a later audited
  // specific preceding-clause speaker rule; NEVER the publisher prose.
  const pre=t.slice(Math.max(0,opener-430),opener),needle=pre.lastIndexOf(name);
  const contextual=needle>=0?pre.slice(needle):'';
  const closestFullNameWithin180=needle>=0&&contextual.length<180;
  const directSpeechVerbAfterFullName=closestFullNameWithin180&&
    /\b(?:said|asked|stated|added|noted)\b/i.test(contextual);
  const interveningQuotation=/[“”"]/.test(contextual);
  const surname=name.split(' ').at(-1);
  const postSurnameAttribution=after.toLowerCase().slice(0,120).includes(surname)&&
    /\b(?:said|asked|stated|added|noted)\b/i.test(after.slice(0,120));
  return {verified:false,reason:'named_senator_missing_after_closed_quote',
    safeDiagnosticFullNameWithin180BeforeQuote:closestFullNameWithin180,
    safeDiagnosticBeforeQuoteDirectSpeechVerb:directSpeechVerbAfterFullName,
    safeDiagnosticInterveningQuoteAfterName:interveningQuotation,
    safeDiagnosticPostQuoteSurnameSpeechVerb:postSurnameAttribution,
    noPublisherTextExposedInDiagnostic:true};
 }
 const left=after.slice(0,k),right=after.slice(k+name.length,k+name.length+100);
 const attribution=/\b(?:said|asked|stated|added|noted)\b/i.test(left)||/\b(?:said|asked|stated|added|noted)\b/i.test(right);
 if(!attribution)return {verified:false,reason:'no_attribution_verb_next_to_full_speaker'};
 const quoted=t.slice(opener+1,closing),quoteHash=digest(Buffer.from(quoted,'utf8'));
 return {verified:true,reason:'bounded_short_cue_in_closed_original_quote_with_direct_full_named_speaker',
  normalizedBoundedOriginalQuotedPassageSha256:quoteHash,
  normalizedBoundedOriginalQuotedPassageChars:quoted.length,
  sourceQuoteBeginsAtOriginalVisibleChar:opener,
  completeHumanApprovedWholeSpeech:false,
  quotedPassageNotProofOfAnySpecificHF669OrHF670Vote:true,
  firstPublisherPostingMinuteUnknown:true};
}
async function getLimited(r,max){
 if(r.status!==200||!r.body)throw Error('archive_transport_unknown_'+r.status);
 let size=0,chunks=[];
 const rd=r.body.getReader();
 while(true){const x=await rd.read();if(x.done)break;size+=x.value.byteLength;
  if(size>max){await rd.cancel().catch(()=>{});throw Error('bounded_original_body_cap');}
  chunks.push(Buffer.from(x.value));
 }
 return Buffer.concat(chunks,size);
}
export async function checkOriginal(p,speakers,fetcher=fetch){
 const out={sourceId:p.id,url:p.url,publisherDayUnproven:p.publisherDisplayedDay,
   archivedOriginalStatus:'ARCHIVE_UNAVAILABLE_UNKNOWN',sourceOriginalPublicByUtc:null,
   originalRawHtmlSha256:null,originalIndexedSha1Base32:null,originalHtmlBytes:null,
   individuallyNamedShortOriginalQuotes:[],sourceIndexedShaAndDownloadedHtmlMatched:false,
   originalCapturePredatesMarch16VoteDay:false,originalCapturePredatesMay22VoteDay:false,
   errors:[],noFullSourceHtmlRetained:true};
 const cd=new URL('https://web.archive.org/cdx/search/cdx');
 for(const [k,v] of Object.entries({url:p.url,output:'json',from:'2023',to:'2024',
  filter:'statuscode:200',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'60'}))
  cd.searchParams.set(k,v);
 cd.searchParams.append('filter','mimetype:text/html');
 try{
  const r=await fetcher(cd,{method:'GET',redirect:'manual',headers:{accept:'application/json'},
    signal:AbortSignal.timeout(22000)});
  if(r.status!==200){out.archivedOriginalStatus='CDX_HTTP_'+r.status+'_UNKNOWN';return out;}
  const bytes=await getLimited(r,250000);
  let eligible;
  try{eligible=validCdxEntries(JSON.parse(bytes.toString('utf8')),p.url,p.publisherDisplayedDay);}
  catch{out.archivedOriginalStatus='CDX_SCHEMA_OR_PARSER_UNKNOWN';return out;}
  if(!eligible.length){out.archivedOriginalStatus='NO_MATCHING_INDEXED_CAPTURE_IN_BOUNDED_QUERY_UNKNOWN';return out;}
  out.cdxEligibleIndexedCaptureCount=eligible.length;
  for(const e of eligible){
   try{
    const url='https://web.archive.org/web/'+e.timestamp+'id_/'+e.archiveOriginalUrl;
    const x=await fetcher(url,{method:'GET',redirect:'manual',
      headers:{accept:'text/html','accept-encoding':'identity'},signal:AbortSignal.timeout(30000)});
    if(x.status!==200){out.errors.push('raw_archive_http_'+x.status);continue;}
    if(!(x.headers.get('content-type')||'').toLowerCase().startsWith('text/html')){
     out.errors.push('raw_archive_wrong_mime');continue;
    }
    const raw=await getLimited(x,CAP);
    if(raw.length<1800||sha1Base32(raw)!==e.indexedSha1Base32){
     out.errors.push('whole_raw_html_index_sha1_mismatch_or_short');continue;
    }
    const proofs=speakers.map(s=>({speakerId:s.id,officialName:s.officialName,
      shortOriginalQuoteCue:s.exactShortQuoteCue,...boundNamedOriginalQuote(raw,s)}));
    if(!proofs.some(x=>x.verified)){out.errors.push('valid_original_body_but_short_speaker_quote_not_verified');continue;}
    out.archivedOriginalStatus='MATCHED_WHOLE_ORIGINAL_SHA1_AND_PERSONALLY_NAMED_QUOTED_CUE';
    out.sourceOriginalPublicByUtc=e.timestamp.replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/,'$1-$2-$3T$4:$5:$6Z');
    out.originalRawHtmlSha256=digest(raw);
    out.originalIndexedSha1Base32=e.indexedSha1Base32;
    out.originalHtmlBytes=raw.length;
    out.sourceIndexedShaAndDownloadedHtmlMatched=true;
    out.individuallyNamedShortOriginalQuotes=proofs;
    out.originalCapturePredatesMarch16VoteDay=e.timestamp<'20230316000000';
    out.originalCapturePredatesMay22VoteDay=e.timestamp<'20230522000000';
    break;
   }catch{out.errors.push('bounded_raw_replay_unavailable_unknown');}
  }
  if(!out.sourceIndexedShaAndDownloadedHtmlMatched)
   out.archivedOriginalStatus='INDEX_KNOWN_BUT_RAW_OR_QUOTE_UNKNOWN';
 }catch{out.archivedOriginalStatus='CDX_ACCESS_OR_NETWORK_ERROR_UNKNOWN';out.errors.push('provider_or_timeout');}
 return out;
}
export async function run(manifest,fetcher=fetch) {
 validateManifest(manifest);
 const out=[];
 for(const p of manifest.sourceArticles){
  out.push(await checkOriginal(p,manifest.speakers.filter(s=>p.speakerIds.includes(s.id)),fetcher));
 }
 const direct=new Map();
 for(const x of out.filter(q=>q.sourceIndexedShaAndDownloadedHtmlMatched)){
  for(const s of x.individuallyNamedShortOriginalQuotes.filter(q=>q.verified)){
   const prev=direct.get(s.speakerId);
   if(!prev||x.sourceOriginalPublicByUtc<prev.capturedAtUtc)
    direct.set(s.speakerId,{speakerId:s.speakerId,senator:s.officialName,
      firstAuthenticatedPublicByUtc:x.sourceOriginalPublicByUtc,
      sourceOriginalUrl:x.url,htmlSha256:x.originalRawHtmlSha256,
      indexedSha1Base32:x.originalIndexedSha1Base32,
      normalizedBoundedQuoteSha256:s.normalizedBoundedOriginalQuotedPassageSha256,
      verifiedCaptureBefore2023March16:x.originalCapturePredatesMarch16VoteDay,
      verifiedCaptureBefore2023May22:x.originalCapturePredatesMay22VoteDay,
      quotationNotExactBillVersionOrPersonVote:true,
      originalFirstPublishedMinuteNotProven:true,
      productionOrBacktestSourcePresenceNotEstablished:true});
  }
 }
 return {schema:'senate-864-2023-bonding-original-conditional-speaker-verification-v1',
  issue:864,inputsSourceKinds:'current_named_first_party_pages_then_original_Wayback_CDX_SHA1_body_SHA256',
  results:out,uniqueSenatorIndividualOriginalQuoteProofs:[...direct.values()],
  uniqueAuthenticatedIndividualOriginalSpeakers:direct.size,
  authenticatedWholeOriginalPublisherArticleUrls:out.filter(x=>x.sourceIndexedShaAndDownloadedHtmlMatched).length,
  authenticBeforeMarch16Decision: [...direct.values()].filter(x=>x.verifiedCaptureBefore2023March16).length,
  authenticBeforeMay22Decision: [...direct.values()].filter(x=>x.verifiedCaptureBefore2023May22).length,
  totalQuoteEventsNeverDoubleCountSharedArticleOrRepost:true,
  sourceOriginalNotEqualOfficialBillVersionOrIndividualBallot:true,
  noRawOriginalPublisherBodyPersisted:true,noProductionDbOrModelChanges:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const inFile='data/evaluation/senate-864-2023-bonding-conditional-direct-speech-leads-v1.json';
 const manifest=JSON.parse(readFileSync(inFile,'utf8'));
 const output=resolve(process.argv[2]||'/tmp/senate-864-2023-bonding-originals.json');
 const r=await run(manifest);
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(r,null,2)+'\n');
 console.log(JSON.stringify({output,originals:r.authenticatedWholeOriginalPublisherArticleUrls,
   speakers:r.uniqueAuthenticatedIndividualOriginalSpeakers,
   prevoteMarch16:r.authenticBeforeMarch16Decision,
   beforeMay22:r.authenticBeforeMay22Decision,
   reasons:r.results.map(x=>[x.sourceId,x.archivedOriginalStatus])}));
}
