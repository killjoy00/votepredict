import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 type OtherOriginalTarget,checkedOtherTarget,otherCalendarUrl,otherClerkUrl,
 inspectOtherCalendar,inspectOtherClerkOriginal
} from '../src/evidence/senate-864-other-24-original-clerk-probe.js';

const energy:OtherOriginalTarget={year:2022,committeeName:'Energy and Utilities Finance and Policy',
 officialIndexCommitteeId:'23834-0',hearingDate:'2022-04-21',originalLrlMinutesPdfLinked:false};
const jobs:OtherOriginalTarget={year:2024,committeeName:'Jobs and Economic Development',
 officialIndexCommitteeId:'26153-0',hearingDate:'2024-02-19',originalLrlMinutesPdfLinked:false};
const rules:OtherOriginalTarget={year:2025,committeeName:'Rules and Administration - Subcommittee on Committees',
 officialIndexCommitteeId:'10000-0',hearingDate:'2025-02-21',originalLrlMinutesPdfLinked:false};
const filler='q'.repeat(18000);
function calendar(t:OtherOriginalTarget,id:number,opt:{wrongDay?:boolean;dupe?:boolean;omitCard?:boolean;canceled?:boolean;house?:boolean}={}){
 const name=t.committeeName;
 const date=opt.wrongDay?'4/22/2022':Number(t.hearingDate.slice(5,7))+'/'+Number(t.hearingDate.slice(8,10))+'/'+t.year;
 const card=(c:number)=>"<div class='card border-dark senate_item cal_item' id='s_"+c+"'>"+
  "<div class='card-header'><h3>"+name+"</h3>"+(opt.canceled?' Canceled':'')+
  "</div></div>";
 return '<html><body>'+filler+
  '<h2>Combined Legislative Meeting Calendar - '+date+'</h2>'+
  "<a class='cal_anchor_link "+(opt.house?'text-house':'text-senate')+
   "' href='#s_"+id+"'>"+name+"</a>"+
  (opt.dupe?"<a class='cal_anchor_link text-senate' href='#s_"+(id+1)+"'>"+name+"</a>":'')+
  (opt.omitCard?'':card(id))+(opt.dupe?card(id+1):'')+'</body></html>';
}
function clerk(t:OtherOriginalTarget,body:string){
 const day=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',
  day:'numeric',year:'numeric'}).format(new Date(t.hearingDate+'T12:00:00Z'));
 return '<html><body><p>'+filler.slice(0,2000)+'</p><h1>'+
  t.committeeName+' Committee</h1><p>'+day+'</p><h2>Minutes</h2>'+
  '<p>Present: Senator Fictional Atlas and Senator Fictional Birch</p>'+body+
  '<p>Adjourned</p></body></html>';
}
test('government original 141 index minus 64 old 2023 and 53 large 2024/25 leaves exact 12+6+6 other-day cohort',()=>{
 const all=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/senate-committee-141-unlinked-original-meeting-roster.json','utf8'));
 const large=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-53-no-pdf-official-index.json','utf8'));
 assert.equal(all.originalIndexedCensus.originalJsonSha256,
  'ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0');
 const rows=all.meetingGroups.flatMap((g:any)=>g.missingMinutesMeetingDates.map((x:string)=>({
  year:g.year,committeeName:g.committeeName,date:g.year+'-'+x
 })));
 const key=(x:any)=>x.year+'|'+x.committeeName+'|'+(x.date??x.hearingDate);
 const excludes=new Set(large.meetings.map(key));
 const other=rows.filter((r:any)=>r.year!==2023&&!excludes.has(key(r)));
 assert.equal(rows.length,141);
 assert.equal(new Set(rows.map(key)).size,141);
 assert.equal(excludes.size,53);
 assert.equal(other.length,24);
 assert.deepEqual([2022,2024,2025].map(y=>other.filter((x:any)=>x.year===y).length),[12,6,6]);
 assert.equal(other.some((x:any)=>x.year===2021),false);
});
test('strict 2022-25 source targets use Senate-specific year, legal date, ls session and no 2021',()=>{
 assert.equal(checkedOtherTarget(energy),energy);
 assert.equal(otherCalendarUrl(energy),'https://www.leg.mn.gov/cal?d1=4%2F21%2F2022');
 assert.equal(otherClerkUrl(energy,16342),
  'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=16342&ls=92&type=minutes');
 assert.match(otherClerkUrl(jobs,18482),/hearing_id=18482&ls=93/);
 assert.match(otherClerkUrl(rules,19100),/hearing_id=19100&ls=94/);
 assert.throws(()=>checkedOtherTarget({...energy,year:2021} as unknown as OtherOriginalTarget),/Not an exact/);
 assert.throws(()=>otherClerkUrl(energy,18532),/Out-of-year/);
});
test('exact original Senate anchor plus matching government detail card, not same-day House or other committee',()=>{
 const d=inspectOtherCalendar(calendar(energy,16342),energy);
 assert.equal(d.verifiedHearingId,16342);
 assert.equal(d.soloAnchorPendingOriginalBody,null);
 assert.match(d.originalCalendarHtmlSha256,/^[a-f0-9]{64}$/);
 assert.throws(()=>inspectOtherCalendar(calendar(energy,16342,{wrongDay:true}),energy),/Wrong original legislative day/);
 const house=inspectOtherCalendar(calendar(energy,16342,{house:true}),energy);
 assert.equal(house.verifiedHearingId,null);
 const dupe=inspectOtherCalendar(calendar(energy,16342,{dupe:true}),energy);
 assert.equal(dupe.verifiedHearingId,null);
 const solo=inspectOtherCalendar(calendar(energy,16342,{omitCard:true}),energy);
 assert.equal(solo.soloAnchorPendingOriginalBody,16342);
});
test('separate Clerk HTML proves exact committee/day, named original printed tally, motion cues, but zero member votes asserted',()=>{
 const cal=inspectOtherCalendar(calendar(energy,16342,{canceled:true}),energy);
 const html=clerk(energy,[
  '<p>S.F. 4300: Senator Fictional Atlas: Bill item.</p>',
  '<p>Senator Fictional Birch moved A1. 2/1 (Ayes: FictionalAtlas, FictionalBirch; Nays: FictionalCedar) MOTION PREVAILED.</p>',
  '<p>Senator Fictional Birch moved the bill. MOTION FAILED.</p>',
 ].join(''));
 const r=inspectOtherClerkOriginal(html,energy,16342,cal,'2026-10-14T03:40:00Z');
 assert.equal(r.year,2022);assert.equal(r.originalSenateHearingId,16342);
 assert.equal(r.originalRecordedOutcomeTextSignals,2);
 assert.equal(r.separatelyPrintedNamedYeaNayBlocks,1);
 assert.equal(r.originalPrintedNamedChoiceOccurrences,3);
 assert.equal(r.resultSignals.length,2);
 assert.ok(r.resultSignals.every(a=>a.memberSideIdentitiesNotExported&&
  a.parliamentaryMotionIdentityNotYetEstablished));
 assert.equal(r.noMemberVotesOrStoredRowsAsserted,true);
 assert.equal(r.originalClerkHistoricalFirstPublicAt,null);
 assert.equal(r.notAnOfficialRecordedMotionsDenominator,true);
});
test('reject wrong Senate hearing ID, wrong original printed date or duplicate individual side; no-motion text never means no vote',()=>{
 const cal=inspectOtherCalendar(calendar(energy,16342),energy);
 assert.throws(()=>inspectOtherClerkOriginal(clerk(energy,'<p>Discussion only</p>'),energy,16343,cal,
  '2026-10-14T03:40:00Z'),/not independently source proven/);
 assert.throws(()=>inspectOtherClerkOriginal(
  clerk(energy,'<p>Discussion only</p>').replace('Thursday, April 21, 2022','Friday, April 22, 2022'),
  energy,16342,cal,'2026-10-14T03:40:00Z'),/exact committee minutes header/);
 const dup=clerk(energy,
  '<p>2/1 (Ayes: FictionalAtlas, FictionalBirch; Nays: FictionalAtlas) MOTION PREVAILED.</p>');
 assert.throws(()=>inspectOtherClerkOriginal(dup,energy,16342,cal,'2026-10-14T03:40:00Z'),
  /source integrity HOLD/);
 const noMotion=inspectOtherClerkOriginal(clerk(energy,'<p>Informational only</p>'),
  energy,16342,cal,'2026-10-14T03:40:00Z');
 assert.equal(noMotion.originalRecordedOutcomeTextSignals,0);
 assert.equal(noMotion.notAnOfficialRecordedMotionsDenominator,true);
});
