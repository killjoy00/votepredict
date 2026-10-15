/**
 * #864 original public written Senate committee Minutes result/roll/voice cue
 * review. Returns distinct TEXT CUES, not counted vote events; source-person
 * names are redacted in every preview. Same slate or cue does not identify
 * an actual separately adopted parliamentary motion.
 */
import {createHash} from 'node:crypto';
export type OriginalCueKind=
 'formal_result'|'named_yes_no_label'|'voice_vote'|'roll_call'|'motion_introduction';
const CUES:Array<{kind:OriginalCueKind;pattern:RegExp}>=[
 {kind:'formal_result',pattern:/\b(?:MOTION|AMENDMENT)\s+(?:PREVAILED|FAILED|PASSED|CARRIED|ADOPTED|DID NOT PREVAIL)\b/giu},
 {kind:'named_yes_no_label',pattern:/\b(?:Ayes?|Nays?|Yea|Nay|Yes|No)\s*[:–-]\s*[A-Z][\p{L}\p{M}'-]*/giu},
 {kind:'voice_vote',pattern:/\bvoice[\s-]+vote\b/giu},
 {kind:'roll_call',pattern:/\broll[\s-]+call(?:\s+vote)?\b/giu},
 {kind:'motion_introduction',pattern:/\b(?:moved that|moved to|moves that|motion to|moved the|moves the|offered the|offers the)\b/giu}
];
const sha=(t:string)=>createHash('sha256').update(t).digest('hex');
export function redactOriginalSenateMotionPreview(raw:string){
 let s=raw.replace(/\s+/g,' ').trim();
 // Only the public parliamentary grammar/bill/amendment labels are relevant
 // to this QUEUE. Explicitly named sides are never exported by this reviewer.
 s=s.replace(/\b((?:Ayes?|Nays?|Yeas?|Yes|No|Absent)\s*[:–-])\s*([^);]{1,150})/gi,(_m,prefix:string)=>prefix+' [original choices redacted]');
 // The regex above is split for readability below; keep other formats safe.
 s=s.replace(/\b(?:Senator|Senators)\s+(?:[A-Z][\p{L}\p{M}.'-]*\s+){0,3}[A-Z][\p{L}\p{M}.'-]*/gu,
  'Senator [name redacted]');
 return s.slice(0,430);
}
export function identifyOriginalSourceMotionCues(text:string,maxCues=160){
 if(text.length<60||text.length>900000||
  !Number.isSafeInteger(maxCues)||maxCues<1||maxCues>250)
  throw Error('Bounded authentic committee-minute text required');
 const flat=text.replace(/\s+/g,' ').trim();
 const all:Array<{at:number;kind:OriginalCueKind;printedPhrase:string}>=[];
 for(const {kind,pattern} of CUES){
  for(const m of flat.matchAll(pattern)){
   all.push({at:m.index??0,kind,printedPhrase:m[0]});
   if(all.length>maxCues*6)throw Error('Original government source action cue limit exceeded');
  }
 }
 all.sort((a,b)=>a.at-b.at||a.kind.localeCompare(b.kind));
 const limited=all.slice(0,maxCues);
 const counts=Object.fromEntries(CUES.map(x=>[x.kind,all.filter(v=>v.kind===x.kind).length])) as
  Record<OriginalCueKind,number>;
 return {
  sourceTextSha256:sha(flat),sourceDocumentHasActionCue:all.length>0,
  sourceContainsMoreCuesThanBoundedPreview:all.length>maxCues,
  totalTextCuesAcrossKinds:all.length,byCueKind:counts,
  cues:limited.map((p,i)=>{
   const start=Math.max(0,p.at-190),end=Math.min(flat.length,p.at+230);
   const originalExcerpt=flat.slice(start,end);
   const billReferences=[...originalExcerpt.matchAll(/\b(?:S|H)\s*\.?\s*F\s*\.?\s*(\d{1,5})\b/gi)]
    .map(x=>x[0]!.replace(/[.\s]+/g,'').toUpperCase()).slice(-5);
   const amendmentReferences=[...originalExcerpt.matchAll(/\bA-?\d{1,3}(?:-\d{1,3})?\b/gi)]
    .map(x=>x[0]!.toUpperCase()).slice(-5);
   return {cueOrdinal:i,offsetInWhitespaceNormalizedSource:p.at,
    cueType:p.kind,originalExcerptSha256:sha(originalExcerpt),
    boundedRedactedPublicMotionPreview:redactOriginalSenateMotionPreview(originalExcerpt),
    nearbyPrintedBillReferences:billReferences,
    nearbyPrintedAmendmentReferences:amendmentReferences,
    distinctMotionNotIndependentlyCertified:true as const,
    memberSideIdentityRedacted:true as const};
  })
 };
}
