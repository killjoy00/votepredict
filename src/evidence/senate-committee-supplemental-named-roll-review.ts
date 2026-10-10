/**
 * #864 OFFLINE-ONLY, non-serving supplemental named-roll candidate extractor.
 * Used only on independently verified 41 original Senate Minutes PDFs.
 *
 * Never use this directly as an ingestion/serving parser: extracts tentative
 * explicitly attributed YEA/NAY names, but a human must confirm exact motion,
 * committee membership and distinctness before any historical DB changes.
 */
import { createHash } from 'node:crypto';
import { normalizeMemberName } from '@/sources/minnesota/house-votes';

type Side='yea'|'nay';
export type SupplementalNamedVoteCandidate={
  sourceOffset:number;
  pattern:'opposing_named_lists'|'individual_named_directions';
  namedYeaCount:number;namedNayCount:number;
  sourceReportedYeaCount:number|null;sourceReportedNayCount:number|null;
  namesUniqueAndExclusive:boolean;
  numericTallyMatchesExplicitNamedList:boolean|null;
  choiceIdentitySha256:string[];
  sourcePassageSnippetSha256:string;
  motionContextWordsPresent:boolean;
  candidateNotVerifiedVote:true;finalFloorStanceInferred:false;
};

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const HEADER=/\b(ayes?|yeas?|yes|nays?|no)\s*[:\-–—]\s*/gi;
const ROLL=/\broll\s+call\b/i;
const ACTION=/\b(?:motion|amendment|vote|voting|requested|moved|recommended\s+to\s+pass)\b/i;
const ODD=/\b(?:absent|present|members|votes?|motion|senators?|committee|chair|failed|prevail|adopted|there|following|some|none|quorum|discussed)\b/i;
const SUFFIX=/\b(?:absent\s*[:\-–]|present\s*[:\-–]|motion\s+(?:failed|passed|prevails?|prevailed)|on\s+a\s+vote|by\s+a\s+roll\s+call|\-\-\s*\d+\s+of\s+\d+|Senator\s+[^.\n]{0,45}\s+moved)\b/i;

function side(s:string):Side{return /^n|^no$/i.test(s)?'nay':'yea'}
function names(raw:string):string[]|null {
  const text=raw
    .replace(/\s+(?=Senator\s+[A-Z])/g,', ')
    .replace(/\s+and\s+(?=[A-Z][a-z])/g,', ');
  const result:string[]=[];
  for(let item of text.split(/[,;]/)){
    item=item.trim().replace(/^[-–:]+\s*/,'').replace(/[.;]+$/,'').trim();
    // A role prefix is source prose, not part of the senator's name.
    for(let i=0;i<3;i++)item=item.replace(
      /^(?:Senators?|Sens?\.?|Vice\s+Chair|Chair|Ranking\s+Member|Lead\s+Senator|Member)\s+/i,'').trim();
    if(!item || /^(?:0|none|no\s+one)$/i.test(item))continue;
    if(!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{1,65}$/.test(item) ||
      ODD.test(item) || item.split(/\s+/).length>5)
      return null;
    const normalized=normalizeMemberName(item);
    if(!normalized||normalized.length<2)return null;
    result.push(normalized);
  }
  return result.length<=35 ? result:null;
}
function tallyNear(text:string,at:number,through:number){
  const nearby=text.slice(Math.max(0,at-220),Math.min(text.length,through+200));
  // Exact arithmetic must come from source; first two numbers mean YEA/NAY
  // only in an explicit recorded vote/tally context.
  const pat=[
    /\b(?:vote\s+(?:was\s+)?(?:of\s+)?|roll\s+call\s*(?:vote\s*)?[-:]?\s*)(\d{1,2})\s*[/\-–]\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*[/\-–]\s*(\d{1,2})\s*roll\s+call/i,
    /\b(\d{1,2})\s*(?:yeas?|ayes?|yes)\s*(?:,|and)\s*(\d{1,2})\s*(?:nays?|no)/i,
  ];
  for(const p of pat){
    const m=nearby.match(p);
    if(m)return {yea:Number(m[1]),nay:Number(m[2])};
  }
  return null;
}
function build(
  text:string,at:number,through:number,pattern:SupplementalNamedVoteCandidate['pattern'],
  yes:string[],no:string[],
):SupplementalNamedVoteCandidate|null {
  const all=[...yes,...no];
  if(all.length<2||all.length>35)return null;
  const lower=all.map(n=>n.toLocaleLowerCase('en-US'));
  const unique=lower.length===new Set(lower).size;
  if(!unique)return null;
  const context=text.slice(Math.max(0,at-650),Math.min(text.length,through+200));
  if(!ROLL.test(context)||!ACTION.test(context))return null;
  const tally=tallyNear(text,at,through);
  return {
    sourceOffset:at,pattern,namedYeaCount:yes.length,namedNayCount:no.length,
    sourceReportedYeaCount:tally?.yea??null,
    sourceReportedNayCount:tally?.nay??null,
    namesUniqueAndExclusive:unique,
    numericTallyMatchesExplicitNamedList:tally?yes.length===tally.yea&&no.length===tally.nay:null,
    choiceIdentitySha256:[
      ...yes.map(n=>sha('yea:'+n)),...no.map(n=>sha('nay:'+n)),
    ].sort(),
    sourcePassageSnippetSha256:sha(context),
    motionContextWordsPresent:true,
    candidateNotVerifiedVote:true,finalFloorStanceInferred:false,
  };
}
export function extractSupplementalNamedSenateRollCandidates(text:string){
  if(text.length<40||text.length>1_000_000)
    throw Error('Source text not bounded for historical supplemental roll review');
  const hits=[...text.matchAll(HEADER)].map(m=>({
    at:m.index??0,end:(m.index??0)+m[0].length,side:side(m[1]!),
  }));
  const observations:SupplementalNamedVoteCandidate[]=[];
  for(let i=0;i<hits.length-1;i++){
    const left=hits[i]!,right=hits[i+1]!;
    if(left.side===right.side || right.at-left.end>520)continue;
    const firstRaw=text.slice(left.end,right.at).trim();
    let tail=text.slice(right.end,Math.min(right.end+360,text.length));
    const boundary=tail.search(SUFFIX);
    if(boundary>=0)tail=tail.slice(0,boundary);
    const lineEnd=tail.indexOf('\n');
    if(lineEnd>=0)tail=tail.slice(0,lineEnd);
    tail=tail.replace(/^\s*[-–:]+/,'').trim();
    // Many source PDFs keep names on one line. Do not bridge blank lines
    // into another unrelated motion/attendance block.
    const first=names(firstRaw),second=names(tail);
    if(!first||!second)continue;
    const yes=left.side==='yea'?first:second;
    const no=left.side==='nay'?first:second;
    const candidate=build(text,left.at,right.end+tail.length,
      'opposing_named_lists',yes,no);
    if(candidate)observations.push(candidate);
  }

  // Distinct fallback: explicit 'Senator NAME - Yea/Nay' rows. Group only
  // neighboring choice tokens; never infer choices from an attendance roster.
  const memberPattern=/(?:Senator\s+)?([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'-]{2,}(?:\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'-]{2,}){0,2})\s*[-–—]\s*(Yea|Nay|Yes|No)\b/g;
  const all=[...text.matchAll(memberPattern)].map(m=>({
    at:m.index??0,end:(m.index??0)+m[0].length,
    normalized:normalizeMemberName(m[1]!),choice:side(m[2]!),
  })).filter(x=>!ODD.test(x.normalized));
  let current:typeof all=[];
  const flush=()=>{
    if(current.length<3){current=[];return}
    const first=current[0]!,last=current[current.length-1]!;
    const yes=current.filter(x=>x.choice==='yea').map(x=>x.normalized);
    const no=current.filter(x=>x.choice==='nay').map(x=>x.normalized);
    const candidate=build(text,first.at,last.end,'individual_named_directions',yes,no);
    if(candidate && !observations.some(o=>
      Math.abs(o.sourceOffset-first.at)<130 && o.namedYeaCount===yes.length &&
      o.namedNayCount===no.length)) observations.push(candidate);
    current=[];
  };
  for(const hit of all){
    if(current.length&&hit.at-current[current.length-1]!.end>100)flush();
    current.push(hit);
  }
  flush();

  return observations.sort((a,b)=>a.sourceOffset-b.sourceOffset);
}
