/**
 * #864. Version 2 of the temporary 2025 original caption motion cue REVIEW
 * locator. Old v1 artifact/algorithm remains immutable historic provenance.
 *
 * Critical v1 issues corrected here:
 * - never begin a clip at the data-time ATTRIBUTE (which leaked HTML markup);
 * - "strategic move that" / "move to clean energy" do NOT imply formal motion.
 * No full transcript, side list, attributed speaker, vote or production action.
 */
import {createHash} from 'node:crypto';

export const SENATE_2025_CAPTION_CUE_V2=
  'senate-2025-22-original-auto-caption-procedural-cue-v2-structure-precise' as const;
const CAP=1_500_000,ROWS_MAX=20_000,OUTPUT_MAX=120;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
function visible(value:string):string{
 return value.replace(/<script\b[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<[^>]*>/g,' ')
  .replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
  .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&#(\d{1,7});/g,(_m,n:string)=>{
    const i=Number(n);return i>0&&i<=0x10ffff&&!Number.isNaN(i)?String.fromCodePoint(i):' ';
  })
  .replace(/&#x([a-f0-9]{1,6});/gi,(_m,n:string)=>{
    const i=Number.parseInt(n,16);return i>0&&i<=0x10ffff?String.fromCodePoint(i):' ';
  })
  .replace(/\s+/g,' ').replace(/^\d{1,2}:\d{2}:\d{2}(?:\.\d{1,3})?\s*/,'').trim();
}
function seconds(s:string):number|null{
 if(/^\d+(?:\.\d{1,4})?$/.test(s)){
  const n=Number(s);return n>=0&&n<=86400?n:null;
 }
 const m=/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(s);
 if(!m)return null;
 const h=Number(m[1]),min=Number(m[2]),sec=Number(m[3]);
 if(h>23||min>59||sec>59)return null;
 return h*3600+min*60+Number('0.'+(m[4]??'0'))+sec;
}

const CUE_RULES=[
 ['explicit_roll_request',/\b(?:call(?:ing)? the roll|roll[\s-]?call|take the (?:vote by )?roll|roll(?:\s+)?vote|recorded vote)\b/i],
 ['formal_motion_introduction',/\b(?:i (?:would )?move(?: that| to)?\b|make a motion\b|motion (?:to|that)\b|moved (?:that|to)\b|move to (?:adopt|pass|table|refer|recommend|re-?refer|amend|adjourn)\b|offer(?:ed)? an? amendment\b)\b/i],
 ['formal_motion_result',/\b(?:motion|amendment|resolution)\s+(?:prevail(?:s|ed)?|fail(?:s|ed)?|adopt(?:ed|s)?|pass(?:es|ed)?|carr(?:y|ied)|defeat(?:ed|s)?)\b/i],
 ['voice_vote_language',/\b(?:all those in favor|all those opposed|say aye|say nay|ayes have it|nays have it|voice vote|all in favor)\b/i],
 ['reported_tally_language',/\b(?:\d{1,2}\s*(?:ayes|yeas|in favor|votes in favor)\s*(?:and|,|to|versus|vs\.?)\s*\d{1,2}\s*(?:nays|noes|opposed|votes against)|(?:ayes|yeas)\s*\d{1,2}\s*(?:nays|noes)\s*\d{1,2})\b/i],
 ['committee_recommendation',/\b(?:recommend(?:ed|ation)?\s+(?:that|to)\s+(?:pass|be adopted)|pass and (?:be )?re-?referred|re-?refer(?:red)? to (?:the )?(?:finance|judiciary|rules|committee))\b/i],
] as const;
export type MotionCueV2Kind=(typeof CUE_RULES)[number][0];
export function findStrict2025OriginalAutoCaptionMotionCues(raw:string){
 const n=Buffer.byteLength(raw,'utf8');
 if(n<40||n>CAP)throw Error('Original auto-caption payload exceeded strict source cap');
 const sourceMarkers=[...raw.matchAll(/\bdata-time\s*=\s*["']([^"']+)["']/gi)];
 if(sourceMarkers.length>ROWS_MAX)throw Error('Original payload has unbounded caption markers');
 const tags=[...raw.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bdata-time\s*=\s*["']([^"']+)["'][^>]*>/gi)];
 if(tags.length!==sourceMarkers.length)
  throw Error('Original caption timestamp markers were not embedded in complete HTML opening tags');
 const rows=tags.map((m,i)=>{
  const until=i+1<tags.length?tags[i+1]!.index!:raw.length;
  const end=Math.min(until,(m.index??0)+m[0].length+2000);
  const rawFragment=raw.slice((m.index??0)+m[0].length,end);
  const content=visible(rawFragment).slice(0,260);
  return {ordinal:i,time:m[2]!,seconds:seconds(m[2]!),content};
 });
 const seen=new Map<string,{
  cueKind:MotionCueV2Kind;sourceCaptionRowOrdinal:number;
  originalCaptionTimeToken:string;candidateElapsedSeconds:number|null;
  originalNearbyVisibleTextSha256:string;repeatedSameCategoryNearbyHits:number;
  humanAudioAndSpeakerReviewRequired:true;
 }>();
 const occurrences:Record<string,number>={};
 let unmatched=0;
 for(let i=0;i<rows.length;i++){
  const row=rows[i]!;
  if(row.seconds===null)unmatched++;
  // Require actual visible words. A start-of-tag/HTML attribute can NEVER match.
  const neighborhood=rows.slice(Math.max(0,i-1),Math.min(rows.length,i+3))
    .map(x=>x.content).filter(Boolean).join(' ').slice(0,800).trim();
  if(!neighborhood)continue;
  for(const [cueKind,rule] of CUE_RULES){
   if(!rule.test(neighborhood))continue;
   occurrences[cueKind]=(occurrences[cueKind]??0)+1;
   const bucket=row.seconds===null?'unknown-'+Math.floor(i/12):String(Math.floor(row.seconds/30));
   const key=cueKind+'|'+bucket;
   const existing=seen.get(key);
   if(existing){existing.repeatedSameCategoryNearbyHits++;continue;}
   seen.set(key,{
    cueKind,sourceCaptionRowOrdinal:i,
    originalCaptionTimeToken:row.time,candidateElapsedSeconds:row.seconds,
    originalNearbyVisibleTextSha256:sha(neighborhood),
    repeatedSameCategoryNearbyHits:1,
    humanAudioAndSpeakerReviewRequired:true,
   });
  }
 }
 const candidates=[...seen.values()].sort((a,b)=>a.sourceCaptionRowOrdinal-b.sourceCaptionRowOrdinal
  ||a.cueKind.localeCompare(b.cueKind));
 return {
  originalTimestampAttributeMarkers:sourceMarkers.length,
  completeHtmlTaggedCaptionSegments:tags.length,
  captionSegmentsWithUnparseableTime:unmatched,
  matchedRowsByPhraseCategoryNotDistinctMotions:occurrences,
  categoryThirtySecondWindowsNotDistinctMotions:candidates.length,
  sourceReviewCueTimeWindows:candidates.slice(0,OUTPUT_MAX),
  cueWindowsAboveOutputCap:candidates.length-Math.min(candidates.length,OUTPUT_MAX),
  rawCaptionTextOrHtmlSaved:false,
  noOriginalAutoCaptionQuotesOrNamedMemberSidesSaved:true,
  noHumanAudioValidationPerformed:true,
  noUniqueMotionOrRecordedSenatorVoteCertified:true,
 };
}
