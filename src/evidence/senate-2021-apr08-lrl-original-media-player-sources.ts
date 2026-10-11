/**
 * #864 original Minnesota LRL 2021-04-08 Senate committee hearing media players.
 * This explores ONLY SOURCE ADDRESSES and bounded media access, not vote content.
 * Two exact original HTML SHA/byte pins came from the already independently
 * downloaded genuine first source, #38177903789. They are NOT print minutes.
 */
import {createHash} from 'node:crypto';
import {
 APR08_ORIGINAL_MEDIA,
 inspectApril08LrlMediaPage,
 type April08MediaCase
} from './senate-2021-apr08-original-media-source-gates.js';

export const APR08_LRL_ORIGINAL_PLAYER_SOURCES={
 version:'senate-2021-apr08-two-original-lrl-media-stream-player-sources-v1',
 originalSourceRun:38177903789,
 cases:[
  {
   bill:'SF1159',
   exactOriginalHTMLBytes:89044,
   exactOriginalHTMLSHA256:'a204640dcc0ea751fc867ae673492302a48b3dac4c0747475fab1c1ecc2291ce'
  },
  {
   bill:'SF970',
   exactOriginalHTMLBytes:96070,
   exactOriginalHTMLSHA256:'98d4a9be8e08963121f332dcda6fbc602a07dc4a237b633011fc40a1ca2a4194'
  }
 ]
} as const;

const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
function getAttr(tag:string,attr:string){
 const re=new RegExp('\\b'+attr+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')','i');
 const x=tag.match(re);
 return x?.[1]??x?.[2]??null;
}
function isMediaLike(x:string){
 return /(?:mp3|mp4|m3u8|\.wav|audio|video|stream|media_functions)/i.test(x);
}
export type MediaUrlLead={
 kind:'audio'|'video'|'iframe';
 origin:'official_lrl_host'|'other_public_host'|'invalid_or_relative';
 host:string|null;
 pathSHA256:string;
 urlForExactOfficialPrefixProbe:string|null;
 originalReferenceSHA256:string;
};

/** URL outputs are allowlisted and no signed query tokens from third parties leak. */
export function examinePinnedApril08LrlOriginalPlayerHTML(bytes:Buffer,bill:'SF1159'|'SF970'){
 const expected=APR08_LRL_ORIGINAL_PLAYER_SOURCES.cases.find(x=>x.bill===bill);
 const spec=APR08_ORIGINAL_MEDIA.cases.find(x=>x.bill===bill);
 if(!expected||!spec)throw Error('Unrecognized target Senate original 2021 bill/media page');
 if(bytes.length!==expected.exactOriginalHTMLBytes)
  throw Error('Original Senate LRL media page exact source byte count mismatch');
 const digest=hash(bytes);
 if(digest!==expected.exactOriginalHTMLSHA256)
  throw Error('Original Senate LRL media page exact source SHA-256 mismatch');
 return {matchedOriginalBytes:bytes.length,matchedOriginalSHA256:digest,
  ...inspectApril08PlayerHTML(bytes.toString('utf8'),spec)};
}

/** Pure parser, fictional unit tests; original strict source guard is separate. */
export function inspectApril08PlayerHTML(html:string,spec:April08MediaCase){
 const indexed=inspectApril08LrlMediaPage(html,spec);
 const leads:MediaUrlLead[]=[];
 const seen=new Set<string>();
 const add=(kind:MediaUrlLead['kind'],raw:string)=>{
  if(!raw||!isMediaLike(raw))return;
  let u:URL|null=null;
  try{u=new URL(raw.replace(/&amp;/g,'&'),spec.lrlURL);}catch{u=null;}
  const label=u?.hostname.toLowerCase()??null;
  const approved=!!u&&u.protocol==='https:'&&
    (label==='www.lrl.mn.gov'||label==='lrl.mn.gov');
  const identity=(u?.origin??'invalid')+(u?.pathname??raw);
  const key=kind+'|'+(u?.href??raw);
  if(seen.has(key))return;
  seen.add(key);
  // Keep original query only for fixed LRL official endpoints, never external.
  leads.push({
   kind,
   origin:approved?'official_lrl_host':u&&u.protocol==='https:'?
    'other_public_host':'invalid_or_relative',
   host:label,
   pathSHA256:hash(identity),
   urlForExactOfficialPrefixProbe:approved?u!.href:null,
   originalReferenceSHA256:hash(raw)
  });
 };
 const count={audioMediaTags:0,videoMediaTags:0,iframeMediaTags:0};
 for(const kind of ['audio','video','iframe'] as const){
  const re=kind==='iframe'
    ?/<iframe\b[^>]*>/gi
    :new RegExp('<'+kind+'\\b[^>]*>[\\s\\S]*?<\\/'+kind+'\\s*>','gi');
  for(const match of html.matchAll(re)){
   const segment=match[0];
   const start=segment.match(/^<[^>]+>/)?.[0]??segment;
   count[kind==='audio'?'audioMediaTags':kind==='video'?'videoMediaTags':'iframeMediaTags']++;
   const source=getAttr(start,'src')??getAttr(start,'data-src');
   if(source)add(kind,source);
   if(kind!=='iframe'){
    for(const x of segment.matchAll(/<source\b[^>]*>/gi)){
     const u=getAttr(x[0],'src')??getAttr(x[0],'data-src');
     if(u)add(kind,u);
    }
   }
  }
 }
 if(count.audioMediaTags!==indexed.audioTagCount||
    count.videoMediaTags!==indexed.videoTagCount)
  throw Error('Original LRL player tag counts disagreed with strict first source parse');
 return {
  sourceURL:spec.lrlURL,committee:spec.committee,
  indexedHearingDate:indexed.lrlDateHeading,
  originalSourceContainsAudioMediaTags:count.audioMediaTags,
  originalSourceContainsVideoMediaTags:count.videoMediaTags,
  originalSourceIframeTags:count.iframeMediaTags,
  embeddedPlayerMediaSourceLeads:leads.slice(0,25),
  totalEmbeddedMediaSourceLeads:leads.length,
  mediaSourceLeadOutputTruncated:leads.length>25,
  playerURLMetadataOnly:true,
  completeOriginalRecordingAuthenticated:false,
  spokenAmendmentOrMemberVotesVerified:false,
  originalJournalAmendmentDayVerified:null,
  historicalFirstPublishedBy:null
 };
}
