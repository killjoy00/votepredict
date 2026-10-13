/**
 * #864 - independently source-bound alternative written Clerk minutes for the
 * three owner-selected 2024/2025 Senate high-gap no-LRL-linked-PDF cohorts.
 * Only public official MN Legislature day calendar and official Senate HTML.
 *
 * This is NOT a private historic member vote importer. Minutes observations
 * are non-exhaustive parliamentary source candidates. Never infer members'
 * YEA/NAY from attendance, sponsor, mover, voice, aggregate result or party.
 */
import {createHash} from 'node:crypto';
import {normalizeOfficialMinutesHtml} from './senate-2023-transportation-apr03-sf3157-source.js';

export type HighGapYear=2024|2025;
export type HighGapCommittee=
 'Taxes'|'State and Local Government and Veterans'|
 'Energy, Utilities, Environment, and Climate';
export type HighGapTarget={
 year:HighGapYear;committeeName:HighGapCommittee;
 officialIndexCommitteeId:string;hearingDate:string;
 originalLrlMinutesPdfLinked:false;
};
export const HIGH_GAP_COHORTS=[
 {year:2024,committeeName:'Taxes',expected:23},
 {year:2024,committeeName:'State and Local Government and Veterans',expected:13},
 {year:2025,committeeName:'Energy, Utilities, Environment, and Climate',expected:17},
] as const;
export const HIGH_GAP_SCHEMA='senate-864-2024-25-three-committee-original-clerk-action-v1';
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
function cleanHtml(s:string){
 return s.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;|&#xA0;/gi,' ')
 .replace(/&amp;/gi,'&').replace(/&#(\\d+);/g,(_m,n:string)=>String.fromCodePoint(Number(n)))
 .replace(/\s+/g,' ').trim();
}
const groupFor=(t:HighGapTarget)=>HIGH_GAP_COHORTS.find(c=>c.year===t.year&&c.committeeName===t.committeeName);
export function validateHighGapTarget(t:HighGapTarget){
 if(!groupFor(t)||t.originalLrlMinutesPdfLinked!==false||
  !/^\d{1,6}-\d+$/.test(t.officialIndexCommitteeId)||
  !/^202[45]-\d\d-\d\d$/.test(t.hearingDate)||
  !t.hearingDate.startsWith(t.year+'-'))
  throw Error('Unreviewed official high-gap committee, indexed year or hearing day');
 const d=new Date(t.hearingDate+'T12:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==t.hearingDate)
  throw Error('Impossible official historical hearing calendar day');
 return true;
}
function dayText(day:string){
 const d=new Date(day+'T12:00:00Z');
 return new Intl.DateTimeFormat('en-US',{
  timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric',
 }).format(d);
}
export function legislatureCombinedCalendarUrl(t:HighGapTarget){
 validateHighGapTarget(t);
 const [y,m,d]=t.hearingDate.split('-');
 return 'https://www.leg.mn.gov/cal?d1='+Number(m)+'%2F'+Number(d)+'%2F'+y;
}
export function originalSenateClerkMinutesUrl(t:HighGapTarget,hearingId:number){
 validateHighGapTarget(t);
 if(!Number.isSafeInteger(hearingId)||hearingId<
    (t.year===2024?18000:18800)||hearingId>
    (t.year===2024?18999:19999))
  throw Error('Hearing id outside exact reviewed Senate official-year bounds');
 return 'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id='+
  hearingId+'&ls='+(t.year===2024?93:94)+'&type=minutes';
}
type OfficialDay={
 calendarOriginalHtmlSha256:string;calendarOriginalHtmlBytes:number;
 committeeName:HighGapCommittee;hearingDate:string;
 idsNamedByCommitteeAnchor:number[];
 idsNamedBySenateCard:number[];
 exactOfficialHearingId:number|null;
 calendarMarkedCanceled:boolean;
 status:'exact_original_calendar_committee_day_hearing_id'|'ambiguous_or_no_exact_calendar_hearing_id';
};
const attr=(s:string,k:string)=>{
 const m=s.match(new RegExp('\\b'+k+'\\s*=\\s*([\\x27\\x22])([\\s\\S]*?)\\1','i'));
 return m?.[2]??null;
};
export function inspectOriginalGovernmentCombinedDay(
 html:string,target:HighGapTarget
):OfficialDay{
 validateHighGapTarget(target);
 const size=Buffer.byteLength(html,'utf8');
 if(size<30_000||size>2_000_000||!/\bCombined Legislative Meeting Calendar\b/i.test(html))
  throw Error('Original Minnesota Legislature combined calendar missing or out of bounds');
 // Wrong-day reuse cannot silently associate unrelated meeting ID.
 const [y,m,d]=target.hearingDate.split('-');
 const dayPattern=new RegExp(
  'Combined Legislative Meeting Calendar\\s*-\\s*0?'+Number(m)+'\\/0?'+Number(d)+'\\/'+y,'i');
 if(!dayPattern.test(cleanHtml(html)))
  throw Error('Exact government combined calendar original day is not verified');
 const anchors=new Map<number,string>();
 for(const a of html.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/gi)){
  const at=attr(a[1]??'','href'),cls=attr(a[1]??'','class')??'';
  const match=at?.match(/^#s_(\d{5})$/);
  if(!match||!/\bcal_anchor_link\b/i.test(cls)||!/\btext-senate\b/i.test(cls))continue;
  const id=Number(match[1]),name=cleanHtml(a[2]??'');
  if(anchors.has(id)&&anchors.get(id)!==name)throw Error('Same Senate ID bound to different calendar committee headings');
  anchors.set(id,name);
 }
 const cards=new Map<number,{name:string,canceled:boolean}>();
 // Original government HTML day agenda cards have separate 'senate_item'
 // marker AND identical s_<id>. Never use another committee's anchor/card.
 for(const m of html.matchAll(/<div\b([^>]*\bid\s*=\s*["']s_(\d{5})["'][^>]*)>([\s\S]{0,1300}?)(?=<div\b[^>]*\bid\s*=\s*["'][shc]_\d{4,6}["']|$)/gi)){
  const attrs=m[1]??'',cls=attr(attrs,'class')??'';
  if(!/\bsenate_item\b/.test(cls))continue;
  const h3=m[3]?.match(/<h3\b[^>]*>([\s\S]{0,300}?)<\/h3>/i);
  if(!h3)continue;
  const id=Number(m[2]),name=cleanHtml(h3[1]);
  const canceled=/\bCanceled\b/i.test(cleanHtml(m[3].slice(0,600)));
  if(cards.has(id)&&cards.get(id)!.name!==name)
   throw Error('Original Legislature Senate card ID duplicated under different committees');
  cards.set(id,{name,canceled});
 }
 // A duplicate committee name on one day is not a unique meeting ID.
 const as=[...anchors.entries()].filter(([,v])=>v===target.committeeName).map(([id])=>id).sort();
 const cs=[...cards.entries()].filter(([,v])=>v.name===target.committeeName).map(([id])=>id).sort();
 const same=as.length===1&&cs.length===1&&as[0]===cs[0];
 return {
  calendarOriginalHtmlSha256:sha(html),calendarOriginalHtmlBytes:size,
  committeeName:target.committeeName,hearingDate:target.hearingDate,
  idsNamedByCommitteeAnchor:as,idsNamedBySenateCard:cs,
  exactOfficialHearingId:same?as[0]!:null,
  calendarMarkedCanceled:same?(cards.get(as[0]!)?.canceled??false):false,
  status:same?'exact_original_calendar_committee_day_hearing_id':'ambiguous_or_no_exact_calendar_hearing_id',
 };
}
type ChoiceStatus='never_inferred_no_explicit_named_vote_proof';
export type ClerkAction={
 sourceTextOffset:number;billReference:string|null;amendmentReference:string|null;
 observedMotionText:string;boundedOriginalMotionSha256:string;
 sourceResult:'prevailed'|'failed';
 evidenceClassification:'result_only'|'aggregate_count_only'|'voice_amendment';
 explicitYeaCount:number|null;explicitNayCount:number|null;
 explicitAbsentCount:number|null;namedMemberChoiceStatus:ChoiceStatus;
 isNotAnExhaustiveSourceMotionCensus:true;
};
const billHeading=/\bS\s*\.?\s*F\s*\.?\s*(\d{1,5})\s*:\s*Senator\b/giu;
const billMention=/\bS\s*\.?\s*F\s*\.?\s*(\d{1,5})\b/iu;
const amendment=/\b(A-?\d{1,3}(?:-\d{1,4})?)\s+(?:[A-Za-z]{1,16}\s+)?Amendment\b/giu;
const mover=/\bSenator\s+([\p{L}\p{M}.'-]+(?:\s+[\p{L}\p{M}.'-]+){0,6})\s+(?:moved|moves)\b/giu;
const result=/(?:\bMOTION\s+(PREVAILED|FAILED|ADOPTED|DID\s+NOT\s+PREVAIL)\b|\bthe\s+motion\s+(prevailed|failed|was\s+adopted|did\s+not\s+prevail)\b)/giu;
const localTally=/\b(?:roll\s+call\s+(?:vote\s+)?(?:of\s+)?)?(\d{1,2})\s*(?:yeas?|yays?|ayes?|yes)\s*,?\s*(?:and\s+)?(\d{1,2})\s*(?:nays?|no)\b/giu;
const aggregateShort=/\bmotion\s+prevails?\s+on\s+a\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\s+roll\s+call\b/giu;
function nearestBillInSource(text:string,at:number,heads:{at:number;bill:string}[]){
 const head=heads.filter(x=>x.at<at).at(-1);
 return head&&at-head.at<=5200?head.bill:null;
}
function checkedTally(y:number,n:number){
 return Number.isSafeInteger(y)&&Number.isSafeInteger(n)&&y>=0&&n>=0&&
  y+n>0&&y+n<=22;
}
export function inspectOriginalHighGapSenateClerkHtml(
 html:string,target:HighGapTarget,id:number,calendar:OfficialDay,retrievedAt:string
){
 validateHighGapTarget(target);
 if(calendar.status!=='exact_original_calendar_committee_day_hearing_id'||
  calendar.exactOfficialHearingId!==id||
  calendar.hearingDate!==target.hearingDate||
  calendar.committeeName!==target.committeeName)
  throw Error('Original Senate Clerk hearing ID not independently established by exact official calendar');
 originalSenateClerkMinutesUrl(target,id);
 if(!Number.isFinite(Date.parse(retrievedAt)))throw Error('No 2026 government source retrieval-time evidence');
 const size=Buffer.byteLength(html,'utf8');
 if(size<1500||size>1_200_000||!/<html\b/i.test(html))
  throw Error('Archived Minnesota Senate original Clerk minutes HTML byte/format HOLD');
 const text=normalizeOfficialMinutesHtml(html);
 const heading=target.committeeName+' Committee',day=dayText(target.hearingDate);
 const h=text.indexOf(heading),d=text.indexOf(day,h);
 if(h<0||d<0||d-h>390||!/\bMinutes\b/i.test(text.slice(d,d+400))||
  !/\bPresent\s*:\s*(?:Senator|No\s+Members)/i.test(text.slice(d,d+1700)))
  throw Error('Senate Clerk printed committee, actual date or Minutes body does not uniquely match government calendar');
 const headings=[...text.matchAll(billHeading)].map(m=>({at:m.index??0,bill:'SF'+Number(m[1])}));
 const actions:ClerkAction[]=[];
 const seen=new Set<number>();
 for(const res of text.matchAll(result)){
  const resultAt=res.index??0,left=Math.max(0,resultAt-650);
  const mov=[...text.slice(left,resultAt).matchAll(mover)].at(-1);
  if(!mov||mov.index===undefined)continue;
  const start=left+mov.index;
  if(seen.has(start)||resultAt-start>630||start<d)continue;
  const passage=text.slice(start,resultAt+res[0].length).trim();
  const inner=passage.slice(mov[0].length);
  // A competing motion/agenda/bill in the bounded result context fails closed.
  if([...inner.matchAll(mover)].length>0||
   /\bS\s*\.?\s*F\s*\.?\s*\d{1,5}\s*:\s*Senator\b/i.test(inner))
   continue;
  const verdict=(res[1]??res[2]??'').toLowerCase();
  const failed=/failed|did\s+not\s+prevail/.test(verdict);
  const ownBill=passage.match(billMention),bill=ownBill?
   'SF'+Number(ownBill[1]):nearestBillInSource(text,start,headings);
  const amend=[...passage.matchAll(amendment)].at(-1)?.[1]?.toUpperCase()??null;
  // The same committee may have multiple roll motions on the same bill,
  // so never match a nearby count unless it is uniquely tied to this action.
  const numbers=[...passage.matchAll(localTally)];
  let numeric:nulled={yea:null,nay:null,absent:null};
  if(numbers.length===1&&/\broll\s+call\b/i.test(passage)&&
    checkedTally(Number(numbers[0][1]),Number(numbers[0][2])))
   numeric={yea:Number(numbers[0][1]),nay:Number(numbers[0][2]),absent:null};
  // If a simple contemporary summary prints "motion prevails on a 6-5 roll
  // call" just ahead of its formal Clerk recap, copy ONLY when one unique
  // bill heading, no intervening other distinct motion or result.
  if(numeric.yea===null&&bill&&ownBill&&verdict==='prevailed'){
   const lead=text.slice(Math.max(0,start-300),start);
   const summaries=[...lead.matchAll(aggregateShort)];
   if(summaries.length===1&&
      checkedTally(Number(summaries[0][1]),Number(summaries[0][2]))&&
      !/\bS\s*\.?\s*F\s*\.?\s*\d+\s*:\s*Senator\b/i.test(lead.slice((summaries[0].index??0)))&&
      !/\bMOTION\s+(?:PREVAILED|FAILED)\b/i.test(lead.slice((summaries[0].index??0))))
    numeric={yea:Number(summaries[0][1]),nay:Number(summaries[0][2]),absent:null};
  }
  const absent=passage.match(/\b(?:with\s+)?(\d{1,2})\s+members?\s+absent\b/i);
  if(numeric.yea!==null&&absent)numeric.absent=Number(absent[1]);
  seen.add(start);
  actions.push({
   sourceTextOffset:start,billReference:bill,amendmentReference:amend,
   observedMotionText:passage.slice(0,510),boundedOriginalMotionSha256:sha(passage),
   sourceResult:failed?'failed':'prevailed',
   evidenceClassification:numeric.yea!==null?'aggregate_count_only':'result_only',
   explicitYeaCount:numeric.yea,explicitNayCount:numeric.nay,
   explicitAbsentCount:numeric.absent,
   namedMemberChoiceStatus:'never_inferred_no_explicit_named_vote_proof',
   isNotAnExhaustiveSourceMotionCensus:true,
  });
 }
 // Explicit voice amendments can be useful source decisions, BUT never
 // senator-side votes. Require bounded unique amendment label and result;
 // reject overlaps with an already captured formal motion passage.
 const voice=/(?:\bSenator\s+)?[\p{L}\p{M}.'-]{2,25}\s+(?:moved|moves|offered|offers)\s+(?:the\s+)?(A-?\d{1,3})\b[\s\S]{0,90}?\bamendment\b[\s;:,.–-]{0,16}adopted\s+(?:by|via|on)\s+(?:a\s+)?voice\s+vote\b/giu;
 for(const m of text.matchAll(voice)){
  const at=m.index??0;
  if(at<d||actions.some(a=>at>=a.sourceTextOffset &&
    at<a.sourceTextOffset+a.observedMotionText.length))continue;
  const p=m[0].replace(/\s+/g,' ').trim();
  const bill=nearestBillInSource(text,at,headings);
  if(!bill||p.length>300)continue;
  actions.push({
   sourceTextOffset:at,billReference:bill,
   amendmentReference:m[1].toUpperCase(),
   observedMotionText:p,boundedOriginalMotionSha256:sha(p),
   sourceResult:'prevailed',evidenceClassification:'voice_amendment',
   explicitYeaCount:null,explicitNayCount:null,explicitAbsentCount:null,
   namedMemberChoiceStatus:'never_inferred_no_explicit_named_vote_proof',
   isNotAnExhaustiveSourceMotionCensus:true
  });
 }
 actions.sort((a,b)=>a.sourceTextOffset-b.sourceTextOffset);
 const classifications={
  resultOnly:actions.filter(a=>a.evidenceClassification==='result_only').length,
  countOnly:actions.filter(a=>a.evidenceClassification==='aggregate_count_only').length,
  voiceAmendment:actions.filter(a=>a.evidenceClassification==='voice_amendment').length
 };
 if(actions.length!==classifications.resultOnly+classifications.countOnly+classifications.voiceAmendment)
  throw Error('Source action classification conservation failure');
 return {
  schemaVersion:HIGH_GAP_SCHEMA,
  originalLrlIndexedCommitteeId:target.officialIndexCommitteeId,
  year:target.year,hearingDate:target.hearingDate,committeeName:target.committeeName,
  exactCalendarOriginalSourceHtmlSha256:calendar.calendarOriginalHtmlSha256,
  exactCalendarMarkedCanceled:calendar.calendarMarkedCanceled,
  calendarCanceledAndSenateClerkMinutesBodyBothPresent:calendar.calendarMarkedCanceled,
  clerkOriginalSenateHearingId:id,clerkOriginalUrl:originalSenateClerkMinutesUrl(target,id),
  originalClerkHtmlBytes:size,originalClerkHtmlSha256:sha(html),
  normalizedOriginalClerkTextSha256:sha(text),
  retrievedAt,
  canonicalMotionCandidates:actions.length,
  classificationCounts:classifications,
  actions,
  ownerHearingDateHistoricalAvailableOnRule:target.hearingDate,
  originalClerkHtmlHistoricalFirstPublishedAt:null,
  sameDayEligibilityExcludedWithoutTimeProof:true,
  fullOfficialMotionUniverseCertified:false,
  originalLrlElectronicPdfAvailable:false,
  allIndividualVoterSidesUnknownInThisParser:true,
  noVoiceOrAttendanceInferredIndividualVotes:true,
  noSourceToPersistedVoteEventsOrMemberVotesPerformed:true,
  noProductionDatabaseModelOrSchedulerWrites:true,
 };
}
type nulled={yea:number|null;nay:number|null;absent:number|null};
export function reconcileExact53HighGapRoster(rows:readonly HighGapTarget[]){
 if(rows.length!==53)throw Error('Official selected three-group meeting denominator not exactly 53');
 const seen=new Set<string>();
 for(const row of rows){
  validateHighGapTarget(row);
  const k=[row.year,row.committeeName,row.hearingDate,row.officialIndexCommitteeId].join('|');
  if(seen.has(k))throw Error('Duplicate official indexed high-gap hearing');
  seen.add(k);
 }
 for(const group of HIGH_GAP_COHORTS)
  if(rows.filter(r=>r.year===group.year&&r.committeeName===group.committeeName).length!==group.expected)
   throw Error('Original three-group official indexed meeting count drifted');
 return {meetings:53,groups:HIGH_GAP_COHORTS.map(x=>({year:x.year,committeeName:x.committeeName,indexedWithoutPdf:x.expected})),exactlyThreeSelectedGroups:true};
}
