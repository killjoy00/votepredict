/**
 * #864 2022-25-only original Senate calendar/Clerk Minutes probe for the
 * 24 no-PDF meeting identities outside 2023's 64 and the selected 53
 * 2024-25 large no-PDF group. 2021 is explicitly out of scope.
 *
 * Strict source statuses, never absence-of-minutes => zero official votes.
 * A source motion clue is NOT a stable parliamentary event nor a member vote.
 */
import {createHash} from 'node:crypto';
import {normalizeOfficialMinutesHtml} from './senate-2023-transportation-apr03-sf3157-source.js';

export type OtherYear=2022|2024|2025;
export type OtherOriginalTarget={
 year:OtherYear;committeeName:string;officialIndexCommitteeId:string;
 hearingDate:string;originalLrlMinutesPdfLinked:false;
};
export const OTHER_24_SOURCE_SCHEMA='senate-864-2022-24-25-other-twenty-four-original-clerk-v1';
const sha=(x:string|Uint8Array)=>createHash('sha256').update(x).digest('hex');
const norm=(s:string)=>s.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;|&#xA0;/gi,' ')
 .replace(/&amp;/gi,'&').replace(/&#(\d+);/g,(_m,n:string)=>String.fromCodePoint(Number(n)))
 .replace(/\s+/g,' ').trim();
const committeeNorm=(s:string)=>norm(s).replace(/\s*&\s*/g,' and ')
 .replace(/,\s+and\b/gi,' and').replace(/,\s*/g,', ').replace(/\s+/g,' ').trim().toLowerCase();
const attribute=(s:string,k:string)=>
 s.match(new RegExp('\\b'+k+'\\s*=\\s*([\\x27\\x22])([\\s\\S]*?)\\1','i'))?.[2]??null;
export function checkedOtherTarget(t:OtherOriginalTarget){
 if(![2022,2024,2025].includes(t.year)||!t.hearingDate.startsWith(t.year+'-')||
  !/^20(22|24|25)-\d\d-\d\d$/.test(t.hearingDate)||
  !/^\d{4,6}-\d+$/.test(t.officialIndexCommitteeId)||
  t.originalLrlMinutesPdfLinked!==false||!t.committeeName||t.committeeName.length>120)
  throw Error('Not an exact approved 2022-25 non-2023 source target');
 const date=new Date(t.hearingDate+'T12:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==t.hearingDate)
  throw Error('Bad official source hearing day');
 return t;
}
function labelDate(t:OtherOriginalTarget){
 return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',
  weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(
   new Date(t.hearingDate+'T12:00:00Z'));
}
export function otherCalendarUrl(t:OtherOriginalTarget){
 checkedOtherTarget(t);
 const [y,m,d]=t.hearingDate.split('-');
 return 'https://www.leg.mn.gov/cal?d1='+Number(m)+'%2F'+Number(d)+'%2F'+y;
}
export function otherClerkUrl(t:OtherOriginalTarget,id:number){
 checkedOtherTarget(t);
 const range=t.year===2022?[15000,17500]:t.year===2024?[18000,18999]:[18800,19999];
 if(!Number.isSafeInteger(id)||id<range[0]||id>range[1])
  throw Error('Out-of-year original Senate hearing ID');
 const ls=t.year===2022?92:t.year===2024?93:94;
 return 'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id='+
  id+'&ls='+ls+'&type=minutes';
}
export type OtherCalendar={
 originalCalendarHtmlSha256:string;committeeName:string;hearingDate:string;
 senateAnchorIds:number[];senateCardIds:number[];verifiedHearingId:number|null;
 soloAnchorPendingOriginalBody:number|null;calendarMarkedCanceled:boolean;
};
export function inspectOtherCalendar(html:string,t:OtherOriginalTarget):OtherCalendar{
 checkedOtherTarget(t);
 if(Buffer.byteLength(html,'utf8')<15000||
  Buffer.byteLength(html,'utf8')>2_000_000||
  !/\bCombined Legislative Meeting Calendar\b/i.test(html))
  throw Error('Official day calendar source body integrity HOLD');
 const [y,m,d]=t.hearingDate.split('-');
 const rx=new RegExp('Combined Legislative Meeting Calendar\\s*-\\s*0?'+Number(m)+
  '\\/0?'+Number(d)+'\\/'+y,'i');
 if(!rx.test(norm(html)))throw Error('Wrong original legislative day');
 const anchors=new Map<number,string>();
 for(const a of html.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/gi)){
  const h=attribute(a[1]??'','href')?.match(/^#s_(\d{5})$/);
  const cls=attribute(a[1]??'','class')??'';
  if(!h||!/\bcal_anchor_link\b/.test(cls)||!/\btext-senate\b/.test(cls))continue;
  const id=Number(h[1]),name=committeeNorm(a[2]??'');
  if(anchors.has(id)&&anchors.get(id)!==name)
   throw Error('Senate original anchor same ID contradictory');
  anchors.set(id,name);
 }
 const cards=new Map<number,{name:string;canceled:boolean}>();
 for(const m of html.matchAll(/<div\b([^>]*\bid\s*=\s*["']s_(\d{5})["'][^>]*)>([\s\S]{0,1300}?)(?=<div\b[^>]*\bid\s*=\s*["'][shc]_\d{4,6}["']|$)/gi)){
  const cls=attribute(m[1]??'','class')??'';
  if(!/\bsenate_item\b/.test(cls))continue;
  const h3=m[3]?.match(/<h3\b[^>]*>([\s\S]{0,300}?)<\/h3>/i);
  if(!h3)continue;
  const id=Number(m[2]),name=committeeNorm(h3[1]);
  if(cards.has(id)&&cards.get(id)!.name!==name)
   throw Error('Senate original detail card contradictory');
  cards.set(id,{name,canceled:/\bCanceled\b/i.test(norm(m[3].slice(0,600)))});
 }
 const want=committeeNorm(t.committeeName);
 const a=[...anchors].filter(([,v])=>v===want).map(([id])=>id);
 const c=[...cards].filter(([,v])=>v.name===want).map(([id])=>id);
 const double=a.length===1&&c.length===1&&a[0]===c[0];
 const solo=a.length===1&&c.length===0&&!cards.has(a[0]!)?a[0]!:null;
 return {
  originalCalendarHtmlSha256:sha(html),committeeName:t.committeeName,
  hearingDate:t.hearingDate,senateAnchorIds:a,senateCardIds:c,
  verifiedHearingId:double?a[0]!:null,
  soloAnchorPendingOriginalBody:double?null:solo,
  calendarMarkedCanceled:double?(cards.get(a[0]!)?.canceled??false):false,
 };
}
export function inspectOtherClerkOriginal(html:string,t:OtherOriginalTarget,
 id:number,cal:OtherCalendar,retrievedAt:string){
 checkedOtherTarget(t);otherClerkUrl(t,id);
 const double=cal.verifiedHearingId===id;
 const solo=cal.soloAnchorPendingOriginalBody===id&&
  cal.senateAnchorIds.length===1&&cal.senateCardIds.length===0;
 if((!double&&!solo)||cal.hearingDate!==t.hearingDate||
  cal.committeeName!==t.committeeName)
  throw Error('Original hearing ID not independently source proven');
 if(!Number.isFinite(Date.parse(retrievedAt)))throw Error('Original receipt missing');
 const bytes=Buffer.byteLength(html,'utf8');
 if(bytes<1500||bytes>1_200_000||!/<html\b/i.test(html))
  throw Error('Original Senate Clerk HTML integrity HOLD');
 const text=normalizeOfficialMinutesHtml(html);
 const sourceDate=labelDate(t);
 const day=text.indexOf(sourceDate);
 const header=day>=0?text.slice(Math.max(0,day-380),day):'';
 if(day<0||!committeeNorm(header).includes(committeeNorm(t.committeeName+' Committee'))||
  !/\bMinutes\b/i.test(text.slice(day,day+450))||
  !/\bPresent\s*:\s*(?:Senator|No Members)/i.test(text.slice(day,day+1900)))
  throw Error('Original Clerk date and exact committee minutes header not supported');
 // These are conservative textual CUES only, not an all-motion enumeration.
 // No member identity is assigned from original YEA/NAY person names.
 const actionSignals=[...text.slice(day).matchAll(/\bMOTION\s+(PREVAILED|FAILED)\b/giu)];
 const originalNamedSignals=[...text.slice(day).matchAll(
  /\b(\d{1,2})\s*\/\s*(\d{1,2})\s*\(\s*Ayes?\s*:\s*([^;)]*?)\s*;\s*Nays?\s*:\s*([^)]*?)\s*\)/giu)];
 let validatedNamed=0,printedNamedEntries=0;
 for(const m of originalNamedSignals){
  const y=Number(m[1]),n=Number(m[2]);
  const a=m[3]?.trim()?m[3].trim().split(/\s*,\s*/):[];
  const b=m[4]?.trim()?m[4].trim().split(/\s*,\s*/):[];
  const all=[...a,...b];
  if(y<0||n<0||y+n<1||y+n>22||y!==a.length||n!==b.length||
   all.some(x=>!/^([\p{L}\p{M}][\p{L}\p{M}.' -]{0,85})$/u.test(x))||
   new Set(all.map(x=>x.toLowerCase())).size!==all.length)
   throw Error('Original named Clerk side/tally source integrity HOLD');
  validatedNamed++;printedNamedEntries+=all.length;
 }
 const resultSignals=actionSignals.map(m=>({
  sourceTextOffset:day+(m.index??0),observedOutcome:m[1]?.toLowerCase(),
  originalBoundedSourceSha256:sha(text.slice(Math.max(0,day+(m.index??0)-240),
   Math.min(text.length,day+(m.index??0)+m[0].length+30))),
  parliamentaryMotionIdentityNotYetEstablished:true,
  memberSideIdentitiesNotExported:true,
 }));
 return {
  schemaVersion:OTHER_24_SOURCE_SCHEMA,
  year:t.year,committeeName:t.committeeName,hearingDate:t.hearingDate,
  officialIndexCommitteeId:t.officialIndexCommitteeId,
  originalGovernmentCalendarHtmlSha256:cal.originalCalendarHtmlSha256,
  officialCalendarIdentityProof:double?'exact_senate_anchor_and_card_plus_clerk_body':
   'single_senate_anchor_plus_independently_verified_clerk_body',
  originalSenateHearingId:id,originalClerkUrl:otherClerkUrl(t,id),
  originalClerkHtmlSha256:sha(html),originalClerkTextSha256:sha(text),
  originalClerkHtmlBytes:bytes,retrievedAt,
  originalClerkHistoricalFirstPublicAt:null,
  originalRecordedOutcomeTextSignals:resultSignals.length,
  separatelyPrintedNamedYeaNayBlocks:validatedNamed,
  originalPrintedNamedChoiceOccurrences:printedNamedEntries,
  resultSignals,notAnOfficialRecordedMotionsDenominator:true,
  noMemberVotesOrStoredRowsAsserted:true,
  no2021SourcesOrDatabaseAccess:true,
 };
}
