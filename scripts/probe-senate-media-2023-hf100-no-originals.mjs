/**
 * Track D #987: new public-only HF100 2023 34-33 NO-roll research.
 * Publisher pages served today are only leads; an original is eligible only
 * when indexed SHA1 matches separately downloaded original archived bytes and
 * the capture precedes April 28. No source/vote/training DB access.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {probeWayback,probeCommonCrawl,probeCurrentFirstParty,simplify}
 from './probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';
import {ephemeralPDFText} from './probe-senate-media-2022-standalone-parents-bills-primary.mjs';

export const VERSION='track-d-2023-hf100-individual-no-public-original-audit-v1';
export const DATE='2023-04-28';
export const JOURNAL=Object.freeze({
  url:'https://www.senate.mn/journals/2023-2024/20230428059.pdf',
  date:DATE,senateDay:59,bill:'HF100',companion:'SF73',
  roll:[34,33],printedPage:6890,pdfPageOneBased:290
});
export const LEADS=Object.freeze([
 Object.freeze({
  id:'dahms-feb10-2023-cannabis-sf73',senator:'Gary Dahms',
  displayedDay:'2023-02-10',
  url:'https://www.mnsenaterepublicans.com/senator-dahms-the-democrats-proposal-to-legalize-recreational-marijuana-in-minnesota-contains-many-glaring-issues/',
  attribution:'individual_named_quoted_first_party_caucus_release_on_sf73',
  member:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15326',
  quoted:Object.freeze([{senator:'Gary Dahms',cue:'this legislation is far too broad'}]),
  ccCollections:Object.freeze(['CC-MAIN-2023-14','CC-MAIN-2023-23'])
 }),
 Object.freeze({
  id:'gruenhagen-feb10-2023-legal-cannabis',senator:'Glenn Gruenhagen',
  displayedDay:'2023-02-10',
  url:'https://www.mnsenaterepublicans.com/gruenhagen-the-destructiveness-of-legal-marijuana/',
  attribution:'first_person_signed_caucus_constituent_letter_no_exact_bill_number',
  member:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15333',
  quoted:Object.freeze([{senator:'Glenn Gruenhagen',cue:'one of the hot items on their to-do list is legalizing marijuana'}]),
  ccCollections:Object.freeze(['CC-MAIN-2023-14','CC-MAIN-2023-23'])
 })
]);
const sha256=b=>createHash('sha256').update(b).digest('hex');
const HEX=/^[0-9a-f]{64}$/,B32=/^[A-Z2-7]{32}$/;
const boundedTimestamp=t=>typeof t==='string'&&t.length===20&&t.endsWith('Z')&&t<DATE+'T00:00:00Z';
export function allowed(){
 if(LEADS.length!==2||JOURNAL.bill!=='HF100'||JOURNAL.companion!=='SF73'
 ||JOURNAL.url!=='https://www.senate.mn/journals/2023-2024/20230428059.pdf'
 ||JOURNAL.roll.join('-')!=='34-33')throw Error('wrong final passage source');
 for(const l of LEADS) {
  const u=new URL(l.url);
  if(u.protocol!=='https:'||u.hostname!=='www.mnsenaterepublicans.com'
    ||u.search||u.hash||u.port||u.username||u.password
    ||l.displayedDay!=='2023-02-10'||l.quoted.length!==1)throw Error('unapproved speaker source');
 }
 if(LEADS[0].senator!=='Gary Dahms'||LEADS[1].senator!=='Glenn Gruenhagen'
    ||new Set(LEADS.map(x=>x.url)).size!==2)throw Error('not two distinct personally attributed publisher URLs');
 return true;
}
export function recognizeRoll(text) {
 if(typeof text!=='string'||text.length>5_000_000)throw Error('invalid official PDF extraction');
 const p=/The question was taken on the final passage of H\.?\s*F\.?\s*No\.?\s*100,\s*as amended\.\s*The roll was called,?\s*and there were yeas 34 and nays 33,?\s*as follows:/gi;
 const matches=[...text.matchAll(p)];
 if(matches.length!==1)return {status:'final_passage_identity_or_tally_unknown',bill:'HF100',individualVotes:[],qualified:false};
 const m=matches[0],a=text.slice(m.index+m[0].length,m.index+m[0].length+11000);
 const y=/Those who voted in the affirmative were:/i.exec(a);
 const n=/Those who voted in the negative were:/i.exec(a);
 const end=/So the bill,\s*as amended,\s*was passed and its title was agreed to\./i.exec(a);
 if(!y||!n||!end||!(y.index<n.index&&n.index<end.index))return {
  status:'final_passage_named_roster_bounds_unknown',bill:'HF100',individualVotes:[],qualified:false};
 const affirmative=a.slice(y.index+y[0].length,n.index).split(/Pursuant to Rule 40\b/i)[0];
 const negative=a.slice(n.index+n[0].length,end.index).split(/Pursuant to Rule 40\b/i)[0];
 const names=['Dahms','Gruenhagen'];
 const results=names.map((name,i)=>{
  const yFound=new RegExp('\\b'+name+'\\b','i').test(affirmative);
  const nFound=new RegExp('\\b'+name+'\\b','i').test(negative);
  return {senator:LEADS[i].senator,bill:'HF100',vote:nFound&&!yFound?'nay':'UNKNOWN',
    inOriginalNegativeRoster:nFound,inOriginalAffirmativeRoster:yFound,
    noProxyOnlyNamePromotion:true,notSponsorOrAggregateInference:true};
 });
 return {status:results.every(x=>x.vote==='nay')?'official_named_no_roster_2of2':'named_vote_unknown',
  bill:'HF100',companionNotVotedOnDirectly:'SF73',rollCounts:{yeas:34,nays:33},
  passageAnchorTextPageOneBased:text.slice(0,m.index).split('\f').length,
  personallyNamedVotes:results,qualified:results.every(x=>x.vote==='nay')};
}
export function archivalStatus(capture,lead){
 if(!LEADS.includes(lead))throw Error('invalid source original lead');
 const historic=boundedTimestamp(capture.captureUtc);
 const indexed=B32.test(capture.indexedOriginalSha1??'');
 const raw=HEX.test(capture.rawOriginalSha256??'');
 const bytes=Number.isSafeInteger(capture.originalBytes)&&capture.originalBytes>1000;
 const validated=['sha1_authenticated_original_publisher_html','sha1_authenticated_original_commoncrawl_warc_html'].includes(capture.status);
 const issueCue=capture.shortCues?.some(c=>c.senator===lead.senator&&c.cueFound===true);
 return {captureUtc:capture.captureUtc??null,rawOriginalSha256:raw?capture.rawOriginalSha256:null,
  indexedOriginalSha1Base32:indexed?capture.indexedOriginalSha1:null,
  originalBytes:bytes?capture.originalBytes:null,
  exactOriginalIndexedHashAndRawBodyMatched:validated&&indexed&&raw&&bytes,
  historicOriginalPublicBeforeApril28:historic&&validated&&indexed&&raw&&bytes,
  selectedPolicyCueInOriginal:issueCue===true,
  individualSpeakerAttributionIndependentlyBounded:false,
  qualifiesAsAuthenticatedPrevoteSourceCue:historic&&validated&&indexed&&raw&&bytes&&issueCue===true};
}
export async function inspectSource(lead,f=fetch){
 if(!LEADS.includes(lead))throw Error('not allowed lead');
 const [current,wayback,cc]=await Promise.all([
  probeCurrentFirstParty(lead,f),probeWayback(lead,f),probeCommonCrawl(lead,f)
 ]);
 const versions=[
  ...wayback.originalHtmlReplayAttempts,
  ...cc.queriedCollections.flatMap(x=>x.originalWarcReplayAttempts)
 ].map(c=>archivalStatus(c,lead));
 const exact=versions.filter(v=>v.exactOriginalIndexedHashAndRawBodyMatched);
 const unique=[...new Map(exact.map(v=>v.captureUtc+'|'+v.rawOriginalSha256)).values()];
 return {senator:lead.senator,publisherUrl:lead.url,displayed2023PublisherDateNotAuthenticatedPostingMinute:true,
  currentHtmlIsHistoricalEvidence:false,
  currentReadStatus:current.status,
  waybackIndex:wayback.indexStatus,waybackCandidates:wayback.indexCandidates,
  cc:cc.queriedCollections.map(c=>({collection:c.collection,indexStatus:c.indexStatus,
   candidates:c.indexedCandidates,attempts:c.originalWarcReplayAttempts.length})),
  replayAttempts:versions,authenticatedDistinctOriginalVersions:unique,
  earliestAuthenticatedPreVoteCue:unique.filter(c=>c.qualifiesAsAuthenticatedPrevoteSourceCue)
    .sort((a,b)=>a.captureUtc.localeCompare(b.captureUtc))[0]??null,
  originalCompletePublisherQuotedTurnHumanApproved:false,underlyingVoiceAudioAuthenticated:false,
  noFailedArchiveRetrievalInterpretedAsNoSource:true};
}
async function getPDF(f){
 const r=await f(JOURNAL.url,{method:'GET',redirect:'manual',
  headers:{accept:'application/pdf','accept-encoding':'identity','user-agent':'VotePredict/2.0 public-2023-hf100-research'},
  signal:AbortSignal.timeout(80_000)});
 if(r.status!==200)throw Error(r.status>=300&&r.status<400?'journal_redirect_unknown':'journal_http_unknown');
 const type=(r.headers.get('content-type')||'').split(';')[0].toLowerCase();
 if(!['application/pdf','application/octet-stream'].includes(type))throw Error('journal_wrong_mime');
 const length=r.headers.get('content-length');
 if(length&&(!/^\d+$/.test(length)||+length>32_000_000))throw Error('journal_oversized');
 if(!r.body)throw Error('journal_no_body');
 const reader=r.body.getReader();let size=0,chunks=[];
 for(;;){const x=await reader.read();if(x.done)break;
  size+=x.value.byteLength;if(size>32_000_000)throw Error('journal_oversized');
  chunks.push(Buffer.from(x.value));}
 const out=Buffer.concat(chunks);
 if(size<50_000||!out.subarray(0,5).equals(Buffer.from('%PDF-'))||
   !out.subarray(-2048).toString('latin1').includes('%%EOF'))throw Error('incomplete_original_pdf');
 return out;
}
export async function inspectJournal(f=fetch,extract=ephemeralPDFText){
 allowed();const out={date:DATE,url:JOURNAL.url,bill:'HF100',source:'official_original_senate_journal',
  status:'official_original_journal_unknown',rawPdfSha256:null,rawPdfBytes:null,pages:null,
  namedFinalPassageBallot:null,originalBytesAndTextNotPersisted:true};
 try{
  const original=await getPDF(f),ex=await extract(original);
  out.rawPdfSha256=sha256(original);out.rawPdfBytes=original.length;out.pages=ex.pages;
  out.namedFinalPassageBallot=recognizeRoll(ex.text);
  out.status=out.namedFinalPassageBallot.qualified&&ex.pages===292
    ?'official_full_pdf_sha256_292pages_two_personal_no_votes'
    :'official_pdf_extracted_but_named_vote_or_pages_unknown';
 }catch(e){out.errorClass=String(e?.message||e).slice(0,120);}
 return out;
}
export async function run(f=fetch,extract=ephemeralPDFText){
 allowed();
 const journal=await inspectJournal(f,extract),sources=[];
 for(const lead of LEADS)sources.push(await inspectSource(lead,f));
 return {version:VERSION,readOnlyPublicSource:true,researchDate:'2026-10-12',
  journal,sources,
  officialPersonallyNamedFinalPassageNOCount:journal.namedFinalPassageBallot?.qualified?2:0,
  authenticatedPreVoteOriginalCueCount:sources.filter(x=>x.earliestAuthenticatedPreVoteCue).length,
  fullyQualifiedHistoricalQuoteVotePairs:0,
  distinction:'A published 2023 page, contemporary first-party quote or 34-33 aggregate cannot stand in for an indexed independently downloaded original and a named final passage roster.',
  holds:{original2023PublisherFirstPostingMinuteUnknown:true,
    GruenhagenDoesNotIdentifyExactBillInStatement:true,
    SF73WasCompanionNotRecordedFinalPassageBill:true,
    April28FloorAmendmentsAndAsOfVersionIdentityNotProved:true,
    privatelyIngestedAsOfSourceRecordsNotChecked:true,
    quoteBoundariesRequireSeparateAuthentication:true,
    noProductionChanges:true}};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const flag=process.argv.indexOf('--output'),out=process.argv[flag+1];
 if(flag<0||!/^artifacts\/[a-z0-9.-]+\.json$/.test(out||''))throw Error('metadata-only artifacts file required');
 const results=await run();
 mkdirSync('artifacts',{recursive:true});writeFileSync(out,JSON.stringify(results,null,2)+'\n');
 console.log('TRACK_D_2023_HF100_PUBLIC_PROBE='+JSON.stringify(results));
}
