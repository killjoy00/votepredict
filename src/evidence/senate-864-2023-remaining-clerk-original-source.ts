/**
 * #864 2022-25-only continuation: the 50 still-unverified 2023 Senate LRL
 * no-PDF meeting identities. Official LRL meeting/committee/date is immutable
 * input; only original state combined calendar may provide a hearing ID.
 * Archived Senate Clerk Minutes require independent exact original body proof.
 *
 * No 2021 sources, no database, production, imports or names/side exports.
 */
import {createHash} from 'node:crypto';
import {normalizeOfficialMinutesHtml} from './senate-2023-transportation-apr03-sf3157-source.js';

export const REMAINING_2023_SCHEMA='senate-864-2023-fifty-original-clerk-evidence-v1';
export const REMAINING_2023_COMMITTEES=[
 'Taxes','Agriculture, Broadband and Rural Development','Education Finance',
 'Environment, Climate, and Legacy','Jobs and Economic Development',
] as const;
export type RemainingCommittee=typeof REMAINING_2023_COMMITTEES[number];
export type RemainingTarget={year:2023;committeeName:RemainingCommittee;
 officialLrlCommitteeId:string;hearingDate:string;originalLrlElectronicMinutesPdfLinkAvailable:false};
export const hash=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const normalized=(s:string)=>s.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;|&#xA0;/gi,' ')
 .replace(/&amp;/gi,'&').replace(/&#(\d+);/g,(_x,n:string)=>String.fromCodePoint(Number(n)))
 .replace(/\s+/g,' ').trim();
const attr=(s:string,k:string)=>{
 const m=s.match(new RegExp('\\b'+k+'\\s*=\\s*([\\x27\\x22])([\\s\\S]*?)\\1','i'));
 return m?.[2]??null;
};
export function validate2023Target(t:RemainingTarget){
 if(t.year!==2023||!REMAINING_2023_COMMITTEES.includes(t.committeeName)||
  !/^\d{4,6}-\d$/.test(t.officialLrlCommitteeId)||
  t.originalLrlElectronicMinutesPdfLinkAvailable!==false||
  !/^2023-\d\d-\d\d$/.test(t.hearingDate))
  throw Error('Unreviewed 2023 official Senate missing-PDF target');
 const d=new Date(t.hearingDate+'T12:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==t.hearingDate)
  throw Error('Invalid original 2023 committee meeting date');
 return true;
}
const calendarName=(x:string)=>x.replace(/\s+/g,' ').replace(/,\s+and Rural Development\b/,' and Rural Development').trim();
const minuteTitle=(committee:RemainingCommittee)=>
 committee==='Agriculture, Broadband and Rural Development'?
 'Agriculture, Broadband, and Rural Development Committee':committee+' Committee';
function officialDate(day:string){
 return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',
  weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(
  new Date(day+'T12:00:00Z'));
}
export function governmentCalendarUrl(t:RemainingTarget){
 validate2023Target(t);
 const [y,m,d]=t.hearingDate.split('-');
 return 'https://www.leg.mn.gov/cal?d1='+Number(m)+'%2F'+Number(d)+'%2F'+y;
}
export function senateClerkUrl(t:RemainingTarget,id:number){
 validate2023Target(t);
 if(!Number.isSafeInteger(id)||id<16800||id>18500)
  throw Error('Non-2023-range Senate hearing ID');
 return 'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id='+
  id+'&ls=93&type=minutes';
}
export type CalendarProof={
 date:string;committeeName:RemainingCommittee;originalCalendarRawSha256:string;
 originalCalendarBytes:number;matchingSenateAnchorIds:number[];
 matchingSenateDetailCardIds:number[];matchedHearingId:number|null;
 uniqueSenateAnchorWithoutCard:number|null;markedCanceled:boolean;
 originalCalendarSource:'Minnesota Legislature 2023 combined calendar';
};
export function inspectGovernment2023Calendar(html:string,t:RemainingTarget):CalendarProof{
 validate2023Target(t);
 const bytes=Buffer.byteLength(html,'utf8');
 if(bytes<15000||bytes>2_000_000||!/\bCombined Legislative Meeting Calendar\b/i.test(html))
  throw Error('Wrong-sized/nonoriginal government day calendar');
 const [y,m,d]=t.hearingDate.split('-');
 const calendarDay=new RegExp('Combined Legislative Meeting Calendar\\s*-\\s*0?'+Number(m)+
  '\\/0?'+Number(d)+'\\/'+y,'i');
 if(!calendarDay.test(normalized(html)))
  throw Error('Combined government calendar is not exact 2023 day');
 const anchors=new Map<number,string>();
 for(const a of html.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/gi)){
  const href=attr(a[1]??'','href'),cls=attr(a[1]??'','class')??'';
  const id=href?.match(/^#s_(\d{5})$/);
  if(!id||!/\bcal_anchor_link\b/i.test(cls)||!/\btext-senate\b/i.test(cls))continue;
  const num=Number(id[1]),name=calendarName(normalized(a[2]??''));
  if(anchors.has(num)&&anchors.get(num)!==name)
   throw Error('Government Senate calendar same-ID contradictory committee anchor');
  anchors.set(num,name);
 }
 const cards=new Map<number,{name:string;canceled:boolean}>();
 for(const m of html.matchAll(/<div\b([^>]*\bid\s*=\s*["']s_(\d{5})["'][^>]*)>([\s\S]{0,1300}?)(?=<div\b[^>]*\bid\s*=\s*["'][shc]_\d{4,6}["']|$)/gi)){
  const cls=attr(m[1]??'','class')??'';
  if(!/\bsenate_item\b/.test(cls))continue;
  const h3=m[3]?.match(/<h3\b[^>]*>([\s\S]{0,300}?)<\/h3>/i);
  if(!h3)continue;
  const id=Number(m[2]),name=calendarName(normalized(h3[1]));
  if(cards.has(id)&&cards.get(id)!.name!==name)
   throw Error('Government Senate calendar contradictory detail card');
  cards.set(id,{name,canceled:/\bCanceled\b/i.test(normalized(m[3].slice(0,600)))});
 }
 const want=calendarName(t.committeeName);
 const as=[...anchors].filter(([,name])=>name===want).map(([id])=>id).sort();
 const cs=[...cards].filter(([,c])=>c.name===want).map(([id])=>id).sort();
 const matched=as.length===1&&cs.length===1&&as[0]===cs[0];
 const solo=as.length===1&&cs.length===0&&!cards.has(as[0]!)?as[0]!:null;
 return {
  date:t.hearingDate,committeeName:t.committeeName,originalCalendarRawSha256:hash(html),
  originalCalendarBytes:bytes,matchingSenateAnchorIds:as,
  matchingSenateDetailCardIds:cs,matchedHearingId:matched?as[0]!:null,
  uniqueSenateAnchorWithoutCard:matched?null:solo,
  markedCanceled:matched?(cards.get(as[0]!)?.canceled??false):false,
  originalCalendarSource:'Minnesota Legislature 2023 combined calendar',
 };
}
export type SourceAction={
 originalTextOffset:number;billReference:string|null;amendmentReference:string|null;
 outcome:'prevailed'|'failed';kind:'named_roll'|'count_only'|'result_only';
 printedYea:number|null;printedNay:number|null;originalNamedChoiceOccurrences:number;
 originalMotionContextSha256:string;
 originalNamedChoiceTextExcluded:true;
 originalMemberIdAttribution:null;historicalAvailableOnProvedFromPublication:false;
 sourceMotionIsOnlyParserCandidate:true;
};
const result=/\b(?:MOTION\s+(PREVAILED|FAILED)|the\s+motion\s+(prevailed|failed))\b/giu;
const namedRoll=/\b(\d{1,2})\s*\/\s*(\d{1,2})\s*\(\s*Ayes?\s*:\s*([^;)]*?)\s*;\s*Nays?\s*:\s*([^)]*?)\s*\)/giu;
const mover=/\bSenator\s+[\p{L}\p{M}.'-]+(?:\s+[\p{L}\p{M}.'-]+){0,6}\s+(?:moved|moves)\b/giu;
const billHeading=/\bS\s*\.?\s*F\s*\.?\s*(\d{1,5})\s*:\s*Senator\b/giu;
const amendment=/\b(A-?\d{1,3}(?:-\d{1,4})?)\s+(?:[A-Za-z]{1,16}\s+)?Amendment\b/giu;
function exactNamed(m:RegExpMatchArray){
 const y=Number(m[1]),n=Number(m[2]);
 const ay=m[3]?.trim()?m[3].trim().split(/\s*,\s*/):[];
 const an=m[4]?.trim()?m[4].trim().split(/\s*,\s*/):[];
 const names=[...ay,...an];
 if(!Number.isSafeInteger(y)||!Number.isSafeInteger(n)||y+n<1||y+n>22||
  y!==ay.length||n!==an.length||
  names.some(x=>!/^([\p{L}\p{M}][\p{L}\p{M}.' -]{0,85})$/u.test(x))||
  new Set(names.map(x=>x.toLocaleLowerCase('en-US'))).size!==names.length)
  throw Error('Original Senate Clerk named roll count/name/uniqueness HOLD');
 return {y,n,choices:names.length};
}
export function inspect2023OriginalClerk(html:string,t:RemainingTarget,id:number,
 cal:CalendarProof,retrievedAt:string){
 validate2023Target(t);senateClerkUrl(t,id);
 const primary=cal.matchedHearingId===id&&cal.date===t.hearingDate&&cal.committeeName===t.committeeName;
 const anchor=cal.uniqueSenateAnchorWithoutCard===id&&
  cal.matchingSenateAnchorIds.length===1&&cal.matchingSenateDetailCardIds.length===0&&
  cal.date===t.hearingDate&&cal.committeeName===t.committeeName;
 if(!primary&&!anchor)throw Error('Clerk ID not independently anchored to exact official calendar');
 if(!Number.isFinite(Date.parse(retrievedAt)))throw Error('Original Clerk retrieval receipt absent');
 const bytes=Buffer.byteLength(html,'utf8');
 if(bytes<1500||bytes>1_200_000||!/<html\b/i.test(html))
  throw Error('Original Clerk HTML body missing or wrong size');
 const text=normalizeOfficialMinutesHtml(html);
 const heading=minuteTitle(t.committeeName),day=officialDate(t.hearingDate);
 const h=text.indexOf(heading),d=text.indexOf(day,h);
 if(h<0||d<0||d-h>390||!/\bMinutes\b/i.test(text.slice(d,d+450))||
  !/\bPresent\s*:\s*(?:Senator|No Members)/i.test(text.slice(d,d+1900)))
  throw Error('Archived Clerk original heading/date/minutes/attendance mismatch');
 const heads=[...text.matchAll(billHeading)].map(m=>({at:m.index??0,bill:'SF'+Number(m[1])}));
 const actions:SourceAction[]=[];
 let boundary=d;
 for(const res of text.matchAll(result)){
  const at=res.index??0,end=at+res[0].length;
  const left=Math.max(d,boundary,at-900);
  const prior=text.slice(left,at);
  boundary=end;
  const named=[...prior.matchAll(namedRoll)].filter(x=>
   /^\s*[-–:;,.]?\s*$/.test(prior.slice((x.index??0)+x[0].length)));
  if(named.length>1)continue; // ambiguous source, do not infer multiple identities
  const sourceResult=(res[1]??res[2]??'').toLowerCase()==='failed'?'failed':'prevailed';
  if(named.length===1){
   const m=named[0]!,start=left+(m.index??0),vote=exactNamed(m);
   const head=heads.filter(x=>x.at<start).at(-1);
   const context=text.slice(Math.max(head?.at??left,start-330),start);
   const onBill=/\brequested\s+(?:a\s+)?roll\s+call\s+(?:vote\s+)?(?:for|on)\s+(?:the\s+)?(?:passage|recommendation)\b/i.test(context.slice(-240));
   const amend=onBill?null:([ ...context.matchAll(amendment)].at(-1)?.[1]?.toUpperCase()??null);
   actions.push({
    originalTextOffset:start,billReference:head&&start-head.at<=5200?head.bill:null,
    amendmentReference:amend,outcome:sourceResult,kind:'named_roll',
    printedYea:vote.y,printedNay:vote.n,originalNamedChoiceOccurrences:vote.choices,
    originalMotionContextSha256:hash(text.slice(Math.max(left,start-330),end)),
    originalNamedChoiceTextExcluded:true,originalMemberIdAttribution:null,
    historicalAvailableOnProvedFromPublication:false,sourceMotionIsOnlyParserCandidate:true,
   });
   continue;
  }
  const last=[...prior.matchAll(mover)].at(-1);
  if(!last||last.index===undefined)continue;
  const start=left+last.index;
  if(at-start>630)continue;
  const motion=text.slice(start,end);
  const inner=motion.slice(last[0].length);
  if([...inner.matchAll(mover)].length>0||
   /\bS\s*\.?\s*F\s*\.?\s*\d{1,5}\s*:\s*Senator\b/i.test(inner)||
   [...motion.matchAll(namedRoll)].length>0)continue;
  const head=heads.filter(x=>x.at<start).at(-1);
  const count=[...motion.matchAll(/\b(\d{1,2})\s*(?:yeas?|yays?|ayes?|yes)\s*,?\s*(?:and\s+)?(\d{1,2})\s*(?:nays?|no)\b/giu)];
  const aggregate=count.length===1&&/\broll\s+call\b/i.test(motion)&&
   Number(count[0]![1])+Number(count[0]![2])<=22;
  const amend=[...motion.matchAll(amendment)].at(-1)?.[1]?.toUpperCase()??null;
  actions.push({
   originalTextOffset:start,billReference:head&&start-head.at<=5200?head.bill:null,
   amendmentReference:amend,outcome:sourceResult,kind:aggregate?'count_only':'result_only',
   printedYea:aggregate?Number(count[0]![1]):null,
   printedNay:aggregate?Number(count[0]![2]):null,originalNamedChoiceOccurrences:0,
   originalMotionContextSha256:hash(motion),originalNamedChoiceTextExcluded:true,
   originalMemberIdAttribution:null,historicalAvailableOnProvedFromPublication:false,
   sourceMotionIsOnlyParserCandidate:true,
  });
 }
 if(new Set(actions.map(x=>x.originalTextOffset)).size!==actions.length)
  throw Error('Duplicate Clerk source action offset');
 return {
  schemaVersion:REMAINING_2023_SCHEMA,year:2023,committeeName:t.committeeName,
  officialLrlCommitteeId:t.officialLrlCommitteeId,hearingDate:t.hearingDate,
  originalSenateHearingId:id,originalSenateClerkSourceUrl:senateClerkUrl(t,id),
  originalClerkHtmlSha256:hash(html),originalClerkNormalizedTextSha256:hash(text),
  originalClerkHtmlBytes:bytes,retrievedAt,governmentCalendarRawSha256:cal.originalCalendarRawSha256,
  historicalClerkFirstPublicAt:null,calendarProofTier:primary?'matched_original_anchor_and_card':
   'original_single_senate_anchor_plus_exact_original_clerk_body',
  calendarMarkedCanceled:cal.markedCanceled,sourceActions:actions,
  sourceActionCandidates:actions.length,namedRollCandidates:actions.filter(x=>x.kind==='named_roll').length,
  printedOriginalNamedChoices:actions.reduce((n,x)=>n+x.originalNamedChoiceOccurrences,0),
  countOnlyCandidates:actions.filter(x=>x.kind==='count_only').length,
  resultOnlyCandidates:actions.filter(x=>x.kind==='result_only').length,
  fullMotionDenominatorCertified:false,storedMemberIdentitiesJoined:false,
  originalSourcePublicationDateVerified:false,noProductionDbReadWrite:true,
 };
}
