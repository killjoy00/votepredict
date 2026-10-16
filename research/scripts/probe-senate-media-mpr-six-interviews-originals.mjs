/**
 * Public-only 2021-25 MPR Senate interview follow-up, 6 exact first-party URLs.
 * Reuses verified original Wayback SHA1 and independent Common Crawl WARC
 * mechanisms rather than treating MPR live transcript text as original history.
 * No raw audio/PDF/HTML/WARC is saved; short cue flags not whole-quote approval.
 */
import {createHash} from 'node:crypto';
import {probeWayback,probeCommonCrawl} from '../../scripts/probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';
export const VERSION='senate-media-mpr-six-selected-interviews-original-history-and-public-coverage-v1';
export const LEADS=Object.freeze([
 {
  id:'mpr-2021-benson-vaccine-on-air',
  displayedDay:'2021-01-11',
  url:'https://www.mprnews.org/story/2021/01/11/state-sen-michelle-benson-on-vaccine-rollout',
  type:'publisher_audio_interview_description_without_transcript',
  issue:'covid_19_vaccine_rollout',
  quoted:[{senator:'Michelle Benson',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15322',
    cue:'state sen. michelle benson',kind:'reporter_context_only_not_senator_spoken_quote'}],
  ccCollections:['CC-MAIN-2021-10','CC-MAIN-2021-17'],
  previouslyPinned:true
 },
 {
  id:'mpr-2022-benson-kunesh-parental-curriculum',
  displayedDay:'2022-02-23',
  url:'https://www.mprnews.org/episode/2022/02/23/measures-give-parents-more-control-over-instruction-await-votes',
  type:'publisher_describes_two_senator_interviews_full_transcript_not_confirmed',
  issue:'curriculum_parental_oversight',
  quoted:[
   {senator:'Michelle Benson',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15322',cue:'michelle benson',kind:'publisher_named_interviewee_only'},
   {senator:'Mary Kunesh',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15466',cue:'mary kunesh',kind:'publisher_named_interviewee_only'},
  ],
  ccCollections:['CC-MAIN-2022-21','CC-MAIN-2022-49'],
  previouslyPinned:false,
  possibleSameDaySecondStoryUrl:'https://www.mprnews.org/episode/2022/02/23/a-closer-look-at-the-parents-bill-of-rights-at-the-minnesota-legislature'
 },
 {
  id:'mpr-2023-kunesh-native-family-preservation',
  displayedDay:'2023-02-07',
  url:'https://www.mprnews.org/episode/2023/02/07/new-bill-would-keep-native-families-together-proponents-say',
  type:'current_named_senator_audio_transcript',
  issue:'tribal_child_welfare',
  quoted:[
   {senator:'Mary Kunesh',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15466',cue:'mary kunesh:',kind:'speaker_turn_label_only'},
   {senator:'Mary Kunesh',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15466',cue:'we want to make sure this is codified in our state legislature',kind:'selected_contiguous_speech_fragment_only'},
  ],
  ccCollections:['CC-MAIN-2023-14','CC-MAIN-2023-23'],
  previouslyPinned:true
 },
 {
  id:'mpr-2024-kunesh-charter-school-oversight',
  displayedDay:'2024-10-22',
  url:'https://www.mprnews.org/episode/2024/10/22/a-21-million-deficit-at-step-academy-make-it-the-largest-charter-school-to-close-in-history',
  type:'current_named_senator_audio_transcript_with_another_separate_reporter_interview',
  issue:'charter_school_accountability',
  quoted:[
   {senator:'Mary Kunesh',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15466',cue:'mary kunesh:',kind:'speaker_turn_label_only'},
   {senator:'Mary Kunesh',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15466',cue:'we need to really look at probably some kind of reform',kind:'selected_contiguous_speech_fragment_only'},
  ],
  ccCollections:['CC-MAIN-2024-46','CC-MAIN-2025-05'],
  previouslyPinned:true
 },
 {
  id:'mpr-2025-pha-hmong-lao-veterans',
  displayedDay:'2025-04-24',
  url:'https://www.mprnews.org/episode/2025/04/24/bill-granting-benefits-to-hmong-lao-veterans-passes-minnesota-senate',
  type:'current_named_senator_audio_transcript',
  issue:'veterans_benefits',
  quoted:[
   {senator:'Susan Pha',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15583',cue:'susan pha:',kind:'speaker_turn_label_only'},
   {senator:'Susan Pha',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15583',cue:"veterans designation on driver's license",kind:'selected_contiguous_speech_fragment_only'},
  ],
  ccCollections:['CC-MAIN-2025-21','CC-MAIN-2025-26'],
  previouslyPinned:false
 },
 {
  id:'mpr-2025-coleman-civic-violence',
  displayedDay:'2025-09-11',
  url:'https://www.mprnews.org/episode/2025/09/11/we-cannot-let-evil-win-minnesota-sen-julia-coleman-on-uptick-in-political-violence',
  type:'current_named_senator_audio_transcript',
  issue:'public_safety_political_violence',
  quoted:[
   {senator:'Julia Coleman',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15556',cue:'julia coleman:',kind:'speaker_turn_label_only'},
   {senator:'Julia Coleman',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15556',cue:'we absolutely need to keep guns away from bad people',kind:'selected_contiguous_speech_fragment_only'},
  ],
  ccCollections:['CC-MAIN-2025-40','CC-MAIN-2025-47'],
  previouslyPinned:false
 }
]);
export function validateLeads(leads=LEADS){
 if(!Array.isArray(leads)||leads.length!==6)throw Error('unexpected MPR six interview sample');
 const years=new Set(),urls=new Set(),ids=new Set();
 for(let i=0;i<leads.length;i++){
  const x=leads[i],ref=LEADS[i];
  if(JSON.stringify(x)!==JSON.stringify(ref)||ids.has(x.id)||urls.has(x.url))throw Error('modified/repeated source');
  ids.add(x.id);urls.add(x.url);years.add(x.displayedDay.slice(0,4));
  const p=new URL(x.url);
  if(p.protocol!=='https:'||p.hostname!=='www.mprnews.org'||p.port||p.username||p.password||p.search||p.hash
    ||!p.pathname.startsWith((x.displayedDay==='2021-01-11'?'/story/':'/episode/')+x.displayedDay.replaceAll('-','/')+'/'))
   throw Error('untrusted publisher original');
  for(const q of x.quoted)
   if(!q.lrl.startsWith('https://www.lrl.mn.gov/legdb/fulldetail?ID=')
    ||q.cue!==q.cue.toLowerCase()||!q.kind)throw Error('untrusted member or selected short text');
 }
 if(years.size!==5||leads.reduce((n,x)=>n+new Set(x.quoted.map(q=>q.senator)).size,0)!==7
    ||leads.filter(x=>x.previouslyPinned).length!==3)throw Error('sample/reuse scope changed');
 return leads;
}
function normalized(html){
 return html.replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(?:script|style|head|svg|noscript|template)\b[^>]*>[\s\S]*?<\/(?:script|style|head|svg|noscript|template)>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&(?:rsquo|lsquo|apos|#39|#x27);/gi,"'").replace(/&(?:ldquo|rdquo|quot|#34);/gi,'"')
  .replace(/&(?:nbsp|#160);/gi,' ')
  .replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(Math.min(0x10ffff,Number(v))))
  .normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\s+/g,' ').trim().toLowerCase();
}
export function inspectShortSpeakerCues(html,lead){
 const text=normalized(html);
 const evidence=lead.quoted.map(q=>({
  senator:q.senator,kind:q.kind,shortSelectedCue:q.cue,cueFoundInVisibleApproxText:text.includes(q.cue),
  individualAuthenticatedFullSpeech:false
 }));
 const statements=[...new Set(lead.quoted.map(q=>q.senator))].map(name=>{
  const marks=evidence.filter(q=>q.senator===name);
  const label=marks.find(q=>q.kind==='speaker_turn_label_only');
  const speech=marks.find(q=>q.kind==='selected_contiguous_speech_fragment_only');
  return {senator:name,labelFound:label?.cueFoundInVisibleApproxText??false,
   passageFound:speech?.cueFoundInVisibleApproxText??false,
   twoIndependentVisibleCuesPresent:!!label?.cueFoundInVisibleApproxText&&!!speech?.cueFoundInVisibleApproxText,
   identicalSpeakerTurnProvenByThisStringTest:false,exactVerbatimSenatorQuoteApproved:false};
 });
 return {selectedTextCues:evidence,selectedSpeakerTurnCandidateObservations:statements,
  selectedCuesNotProofOfExactSpeakerTurnOrRecordedSpeech:true};
}
async function bounded(response,max){
 const hdr=response.headers.get('content-length');
 if(hdr!==null&&(!/^\d+$/.test(hdr)||+hdr>max))throw Error('body_limit');
 if(!response.body)throw Error('body_missing');
 const reader=response.body.getReader(),parts=[];let len=0;
 for(;;){const x=await reader.read();if(x.done)break;len+=x.value.byteLength;
  if(len>max){await reader.cancel().catch(()=>{});throw Error('body_limit');}parts.push(x.value);}
 if(len<50)throw Error('body_short');
 const raw=Buffer.allocUnsafe(len);let at=0;
 for(const x of parts){Buffer.from(x).copy(raw,at);at+=x.byteLength;}
 return raw;
}
export async function probeCurrentPublisher(lead,f=fetch){
 const result={status:'unknown',httpStatus:null,rawSha256:null,bytes:null,shortSpeechCues:null,notHistoricalProof:true};
 try{const r=await f(lead.url,{method:'GET',redirect:'manual',headers:{accept:'text/html','accept-encoding':'identity','user-agent':'VotePredict/2.0 public-mpr-interview-history'},signal:AbortSignal.timeout(25000)});
 result.httpStatus=r.status;
 if(r.status!==200){result.status=r.status>=300&&r.status<400?'publisher_redirect_unfollowed_unknown':'publisher_response_non_200_unknown';return result;}
 if((r.headers.get('content-type')||'').split(';')[0].toLowerCase()!=='text/html'){result.status='publisher_mime_unknown';return result;}
 const raw=await bounded(r,2_500_000);
 result.status='current_first_party_html_sha256_observed';result.rawSha256=createHash('sha256').update(raw).digest('hex');
 result.bytes=raw.length;result.shortSpeechCues=inspectShortSpeakerCues(raw.toString('utf8'),lead);
 return result;
 }catch{result.status='publisher_fetch_unknown';return result;}
}
function summarizeOriginalArchives(result,lead){
 const all=[...result.wayback.originalHtmlReplayAttempts,
  ...result.commonCrawl.queriedCollections.flatMap(c=>c.originalWarcReplayAttempts)];
 const original=all.filter(x=>x.status==='sha1_authenticated_original_publisher_html'
   ||x.status==='sha1_authenticated_original_commoncrawl_warc_html');
 return {historicallySha1AuthenticatedBodies:original.length,
  distinctOriginalSha256Bodies:new Set(original.map(x=>x.rawOriginalSha256)).size,
  originalArchivedCues:original.map(x=>({
   utc:x.captureUtc??x.captureUtc,sourceKind:x.collection?'commoncrawl_warc':'wayback_original',
   collection:x.collection??null,indexedSha1:x.indexedOriginalSha1??x.indexedOriginalSha1,
   rawSha256:x.rawOriginalSha256,rawBytes:x.originalBytes,
   selectedCues:x.shortCues?.map(q=>({senator:q.senator,cue:q.selectedShortCue,cueFound:q.cueFound,fullNameNearby:q.fullNameInNearbySourceText}))??null
  })),
  originalWithoutFullHumanApprovedAttribution:true,sourceOriginalDateNotFirstPublication:true};
}
export async function runSixMprInterviews(f=fetch){
 const leads=validateLeads(),sources=[];
 for(const lead of leads){
  const current=await probeCurrentPublisher(lead,f);
  const [wayback,commonCrawl]=await Promise.all([probeWayback(lead,f),probeCommonCrawl(lead,f)]);
  const historic=summarizeOriginalArchives({wayback,commonCrawl},lead);
  sources.push({
   leadId:lead.id,displayedPublisherDay:lead.displayedDay,url:lead.url,type:lead.type,issue:lead.issue,
   previouslyPinnedPublicSourceCandidate:lead.previouslyPinned,
   namedSenatorSpeechCandidates:[...new Set(lead.quoted.map(x=>x.senator))],
   current,waybackOriginal:wayback,commonCrawlOriginal:commonCrawl,historic,
   audioRecordingBinariesIndependentlyOriginalVerified:false,
   recordedLegislativeVoteCertified:false,wholeNamedSenatorQuoteApproved:false
  });
 }
 return {version:VERSION,researchDay:'2026-10-11',boundedSelectedInterviewUrls:leads.length,
  displayedOriginalPublisherYears:[2021,2022,2023,2024,2025],
  namedArticleSpeakerCandidateTurns:7,
  sourcePages:sources,historicallyAuthenticatedArchiveBodies:sources.reduce((n,x)=>n+x.historic.historicallySha1AuthenticatedBodies,0),
  independentOriginalAudioBinariesAuthenticated:0,privateSourceDocumentsMatched:0,
  humanVerifiedWholeSenatorQuotes:0,actualRecordedSenateVotesVerified:0,
  noRawPublisherHtmlOrAudioOrPdfOrWarcPersisted:true,noPrivateDatabaseReadsOrProductionCollectorChanges:true,
  noRetrospectiveModelCutoffBasedOnPublisherDisplayedDay:true,notMprOrStatewideMediaCensus:true};
}
