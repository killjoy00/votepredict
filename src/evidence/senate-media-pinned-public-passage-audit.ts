/**
 * #987/#946 PUBLIC follow-up to actual GitHub Actions run #38109279186.
 * Check the EXACT three indexed SHA1-consistent original HTML capture versions
 * again, matching the independently observed SHA256/bytes before looking at
 * any source text. No raw HTML saved or emitted; no direct senator quote
 * attribution or historical forecast eligibility is approved by string tests.
 */
import {createHash} from 'node:crypto';

export const MEDIA_PINNED_PASSAGE_AUDIT_VERSION='senate-media-2023-24-pinned-original-html-passages-v1' as const;
export const MEDIA_PINNED_ORIGINAL_MAX_BYTES=2_500_000;
export interface PinnedSenateMediaOriginal {
  id:string;
  archiveUrl:string;
  archivedCaptureUtc:string;
  expectedOriginalBodySha256:string;
  expectedOriginalBodyBytes:number;
  speakerFullName:string;
  excerptShortText:string;
  sourceMode:'first_party_mpr_episode_transcript'|'reformer_reporter_quote';
}
export const PINNED_PUBLIC_ORIGINAL_PAGES:readonly PinnedSenateMediaOriginal[]=[
  {
    id:'mn-reformer-2024-sanctuary-brief',
    archiveUrl:'https://web.archive.org/web/20240212221340id_/https://minnesotareformer.com/briefs/sanctuary-state-bill-already-dead-as-house-speaker-says-it-doesnt-have-the-votes/',
    archivedCaptureUtc:'2024-02-12T22:13:40Z',
    expectedOriginalBodySha256:'ad570161c43fad500dd8bc1dde593369703e1ccba6bb47b5ad6688865d15eed1',
    expectedOriginalBodyBytes:128637,
    speakerFullName:'Erin Murphy',
    excerptShortText:'I think it’s important that we rely on the committee process',
    sourceMode:'reformer_reporter_quote',
  },
  {
    id:'mpr-2024-hauschild-north-star-on-air-interview',
    archiveUrl:'https://web.archive.org/web/20240219225556id_/https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south',
    archivedCaptureUtc:'2024-02-19T22:55:56Z',
    expectedOriginalBodySha256:'a990fb4207938f11b58b787966f67f1cc9577fd5c1d4feafe081bd8f14242387',
    expectedOriginalBodyBytes:80716,
    speakerFullName:'Grant Hauschild',
    excerptShortText:'I feel that immigration is a federal issue.',
    sourceMode:'first_party_mpr_episode_transcript',
  },
  {
    id:'mpr-2023-kunesh-native-family-preservation',
    archiveUrl:'https://web.archive.org/web/20230210024030id_/https://www.mprnews.org/episode/2023/02/07/new-bill-would-keep-native-families-together-proponents-say',
    archivedCaptureUtc:'2023-02-10T02:40:30Z',
    expectedOriginalBodySha256:'091376b6f0a3a0a1104d9aa8bd4573212c2ba5953486c082df2877a8eb041f92',
    expectedOriginalBodyBytes:81419,
    speakerFullName:'Mary Kunesh',
    excerptShortText:'We want to make sure this is codified in our state legislature.',
    sourceMode:'first_party_mpr_episode_transcript',
  },
];
export type PinnedOriginalResponseStatus=
  |'exact_sha256_original_html_replayed'
  |'refused_noncanonical_archived_url'
  |'historical_body_http_unavailable'
  |'archive_content_type_mismatch'
  |'original_body_sha256_or_size_mismatch'
  |'original_body_size_limit'
  |'original_body_empty_or_short'
  |'network_or_archive_replay_error';

export interface PinnedArchiveVisiblePassageObservation {
  archivedVisibleArticleHasTranscriptHeading:boolean;
  archivedVisibleArticleMentionsNamedPerson:boolean;
  archivedVisibleArticleContainsExpectedShortExcerpt:boolean;
  archivedVisibleArticleContainsFullSpeakerLabelColon:boolean;
  excerptWithinBoundedSameNamedTurn:boolean;
  /** Observe text layout only. The true person/audio/semantic stance needs human review. */
  statementHumanSpeakerAuthenticated:false;
  originalAudioBytesIndependentlyCompared:false;
  priorBroadcastAvailabilityEstablished:false;
}
export interface PinnedArchivePassageResult {
  leadId:string;
  archiveUrl:string;
  archiveCapturedUtc:string;
  sourceMode:PinnedSenateMediaOriginal['sourceMode'];
  responseStatus:PinnedOriginalResponseStatus;
  sameExactOriginalHtmlSha256AsInitialActionsReplay:boolean;
  observedOriginalBodyBytes:number|null;
  visibleTextObservation:PinnedArchiveVisiblePassageObservation|null;
  originalPageAtCaptureProvenWhenMatched:boolean;
  actualSenatorDirectQuoteHumanReviewed:false;
  modelOrVoteEligibilityVerified:false;
}
function normal(value:string):string{
  return value
    .replace(/&(?:nbsp|#160);/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&(?:rsquo|lsquo|apos|#39);/gi,"'")
    .replace(/&(?:ldquo|rdquo);/gi,'"')
    .replace(/&#(\d+);/g,(_,n:string)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([a-f0-9]+);/gi,(_,n:string)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/[\u2018\u2019]/g,"'")
    .replace(/[\u201c\u201d]/g,'"')
    .replace(/\s+/g,' ').trim();
}
export function observePinnedArchivedHtmlVisibleText(
  rawHtml:string,
  target:PinnedSenateMediaOriginal,
):PinnedArchiveVisiblePassageObservation{
  // Ignore meta/JSON-LD/JS and hidden text: a search hit only in live client
  // scripts MUST NOT authenticate a historically visible speaker's words.
  const visible=normal(rawHtml.replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(?:script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg|template)\s*>/gi,' ')
    .replace(/<[^>]+>/g,' '));
  const low=visible.toLowerCase(),name=normal(target.speakerFullName).toLowerCase();
  const excerpt=normal(target.excerptShortText).toLowerCase();
  const named=low.includes(name);
  const text=low.includes(excerpt);
  const label=name+':';
  const nameStart=low.indexOf(label);
  const quoteAfter=nameStart<0?-1:low.indexOf(excerpt,nameStart+label.length);
  const span=nameStart>=0&&quoteAfter>=0?visible.slice(nameStart+label.length,quoteAfter):'';
  // Stop at first intervening next uppercase name label; never treat host/
  // guest speech after a speaker change as the senator's own words.
  const changed=/(?:^|\s)[\p{Lu}][\p{Lu}\p{M}.'’,-]{1,30}(?:\s+[\p{Lu}][\p{Lu}\p{M}.'’,-]{1,30}){0,6}:(?=\s|$)/u.test(span);
  const sameTurn=target.sourceMode==='first_party_mpr_episode_transcript'
    &&nameStart>=0&&quoteAfter>=0&&span.length<=1400&&!changed
    &&low.includes('audio transcript');
  return {
    archivedVisibleArticleHasTranscriptHeading:low.includes('audio transcript'),
    archivedVisibleArticleMentionsNamedPerson:named,
    archivedVisibleArticleContainsExpectedShortExcerpt:text,
    archivedVisibleArticleContainsFullSpeakerLabelColon:nameStart>=0,
    excerptWithinBoundedSameNamedTurn:sameTurn,
    statementHumanSpeakerAuthenticated:false,
    originalAudioBytesIndependentlyCompared:false,
    priorBroadcastAvailabilityEstablished:false,
  };
}
function validPinnedSource(c:PinnedSenateMediaOriginal):boolean{
  const m=/^https:\/\/web\.archive\.org\/web\/(\d{14})id_\/(https:\/\/.+)$/.exec(c.archiveUrl);
  if(!m || !/^20(?:21|22|23|24|25)/.test(m[1]!)
    || !/^https:\/\/(?:www\.mprnews\.org|minnesotareformer\.com)\//.test(m[2]!)
    || !/^[a-f0-9]{64}$/.test(c.expectedOriginalBodySha256)
    || !Number.isSafeInteger(c.expectedOriginalBodyBytes)
    || c.expectedOriginalBodyBytes<40
    || c.expectedOriginalBodyBytes>MEDIA_PINNED_ORIGINAL_MAX_BYTES)return false;
  const ts=m[1]!;
  const iso=ts.slice(0,4)+'-'+ts.slice(4,6)+'-'+ts.slice(6,8)
    +'T'+ts.slice(8,10)+':'+ts.slice(10,12)+':'+ts.slice(12,14)+'Z';
  const ms=Date.parse(iso);
  return Number.isFinite(ms)
    &&new Date(ms).toISOString()===iso.slice(0,-1)+'.000Z'
    &&c.archivedCaptureUtc===iso;
}
function outcome(c:PinnedSenateMediaOriginal,status:PinnedOriginalResponseStatus,
  bytes:number|null=null,
  observation:PinnedArchiveVisiblePassageObservation|null=null):PinnedArchivePassageResult{
  const matched=status==='exact_sha256_original_html_replayed';
  return {
    leadId:c.id,archiveUrl:c.archiveUrl,archiveCapturedUtc:c.archivedCaptureUtc,
    sourceMode:c.sourceMode,responseStatus:status,
    sameExactOriginalHtmlSha256AsInitialActionsReplay:matched,
    observedOriginalBodyBytes:bytes,
    visibleTextObservation:observation,originalPageAtCaptureProvenWhenMatched:matched,
    actualSenatorDirectQuoteHumanReviewed:false,modelOrVoteEligibilityVerified:false,
  };
}
async function bounded(response:Response):Promise<Uint8Array>{
  const len=response.headers.get('content-length');
  if(len!==null&&(!/^\d+$/.test(len)||Number(len)>MEDIA_PINNED_ORIGINAL_MAX_BYTES))
    throw Error('size');
  if(!response.body)throw Error('empty');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];
  let size=0;
  while(true){
    const item=await reader.read();
    if(item.done)break;
    size+=item.value.byteLength;
    if(size>MEDIA_PINNED_ORIGINAL_MAX_BYTES){
      await reader.cancel().catch(()=>undefined);throw Error('size');
    }
    chunks.push(item.value);
  }
  if(size<40)throw Error('empty');
  const out=new Uint8Array(size);
  let n=0;
  for(const item of chunks){out.set(item,n);n+=item.length;}
  return out;
}
export async function recheckPinnedOriginalHtml(
  candidate:PinnedSenateMediaOriginal,
  fetchImpl:typeof fetch=fetch,
):Promise<PinnedArchivePassageResult>{
  if(!validPinnedSource(candidate))
    return outcome(candidate,'refused_noncanonical_archived_url');
  try{
    const r=await fetchImpl(candidate.archiveUrl,{
      method:'GET',redirect:'manual',
      headers:{accept:'text/html','accept-encoding':'identity',
        'user-agent':'VotePredict/2.0 bounded-public-original-senate-passage-research'},
      signal:AbortSignal.timeout(20_000),
    });
    if(r.status!==200)return outcome(candidate,'historical_body_http_unavailable');
    const mime=(r.headers.get('content-type')??'').split(';')[0]!.trim().toLowerCase();
    if(!['text/html','application/xhtml+xml'].includes(mime))
      return outcome(candidate,'archive_content_type_mismatch');
    const bytes=await bounded(r);
    const hash=createHash('sha256').update(bytes).digest('hex');
    if(bytes.length!==candidate.expectedOriginalBodyBytes
      || hash!==candidate.expectedOriginalBodySha256)
      return outcome(candidate,'original_body_sha256_or_size_mismatch',bytes.length);
    const visible=observePinnedArchivedHtmlVisibleText(Buffer.from(bytes).toString('utf8'),candidate);
    return outcome(candidate,'exact_sha256_original_html_replayed',bytes.length,visible);
  }catch(e){
    return outcome(candidate,
      e instanceof Error&&e.message==='size'?'original_body_size_limit'
      :e instanceof Error&&e.message==='empty'?'original_body_empty_or_short'
      :'network_or_archive_replay_error');
  }
}
export async function runPinnedPublicPassageAudit(fetchImpl:typeof fetch=fetch){
  const items=await Promise.all(PINNED_PUBLIC_ORIGINAL_PAGES.map(c=>
    recheckPinnedOriginalHtml(c,fetchImpl)));
  return {
    version:MEDIA_PINNED_PASSAGE_AUDIT_VERSION,
    originalPublicArchivePilotRunId:38109279186,
    replayArchiveRecords:items,
    exactKnownOriginalHtmlBodiesReobserved:items.filter(x=>
      x.sameExactOriginalHtmlSha256AsInitialActionsReplay).length,
    foundSpeakerTurnAndExpectedExcerpt:items.filter(x=>
      x.visibleTextObservation?.excerptWithinBoundedSameNamedTurn).length,
    foundShortExcerptInOriginalVisibleHtml:items.filter(x=>
      x.visibleTextObservation?.archivedVisibleArticleContainsExpectedShortExcerpt).length,
    quoteHumanVerifiedCount:0,
    originalAudioValidatedCount:0,
    matchedPrivateSourceDocumentsCount:0,
    policy:{
      sourceBytesEverWrittenToArtifact:false,
      excerptTextEmittedToArtifact:false,
      privateUserCredentialsRequired:false,
      stringSearchIsNotHumanAttribution:true,
      htmlAtCaptureCannotBackdateTranscriptsBeforeCapture:true,
      noModelOrProductionChange:true,
      noPublisherStatementOrSourceCensus:true,
    },
  };
}
