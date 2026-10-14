import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 type RemainingTarget,validate2023Target,governmentCalendarUrl,senateClerkUrl,
 inspectGovernment2023Calendar,inspect2023OriginalClerk
} from '../src/evidence/senate-864-2023-remaining-clerk-original-source.js';

const t:RemainingTarget={year:2023,committeeName:'Agriculture, Broadband and Rural Development',
 officialLrlCommitteeId:'26143-0',hearingDate:'2023-03-15',
 originalLrlElectronicMinutesPdfLinkAvailable:false};
const tax:RemainingTarget={year:2023,committeeName:'Taxes',
 officialLrlCommitteeId:'26142-0',hearingDate:'2023-01-05',
 originalLrlElectronicMinutesPdfLinkAvailable:false};
const filler='s'.repeat(20000);
function combined(target:RemainingTarget,id=17800,opts:{wrong?:boolean;duplicate?:boolean;missingCard?:boolean;canceled?:boolean;house?:boolean}={}){
 const comm=target.committeeName==='Agriculture, Broadband and Rural Development'?
  'Agriculture, Broadband, and Rural Development':target.committeeName;
 const label=opts.wrong?'3/16/2023':
  Number(target.hearingDate.slice(5,7))+'/'+Number(target.hearingDate.slice(8,10))+'/2023';
 const card=(num:number)=>"<div class='senate_item card' id='s_"+num+"'>"+
  "<div class='card-header'><h3>"+comm+"</h3>"+
  (opts.canceled?'<span>Canceled</span>':'')+"</div></div>";
 return '<html><body><div>'+filler+'</div>'+
  '<h1>Combined Legislative Meeting Calendar - '+label+'</h1>'+
  "<a class='cal_anchor_link "+(opts.house?'text-house':'text-senate')+"' href='#s_"+id+"'>"+comm+"</a>"+
  (opts.duplicate?"<a class='cal_anchor_link text-senate' href='#s_"+(id+1)+"'>"+comm+"</a>":'')+
  (opts.missingCard?'':card(id))+(opts.duplicate?card(id+1):'')+'</body></html>';
}
function minute(target:RemainingTarget,body:string){
 const comm=target.committeeName==='Agriculture, Broadband and Rural Development'?
  'Agriculture, Broadband, and Rural Development':target.committeeName;
 const date=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',
  month:'long',day:'numeric',year:'numeric'}).format(new Date(target.hearingDate+'T12:00:00Z'));
 return '<html><body><p>'+filler.slice(0,3000)+'</p><h1>'+comm+
  ' Committee</h1><p>'+date+'</p><h2>Minutes</h2>'+
  '<p>Present: Senator Fictional Atlas, Senator Fictional Birch</p>'+
  body+'<p>Committee adjourned.</p></body></html>';
}
test('official 2023 64-entry LRL index crosswalk selects exactly 50 unverified 2023 Clerk dates and 14 separate verified originals',()=>{
 const j=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/senate-864-2023-64-no-lrl-pdf-to-senate-clerk-original-html-crosswalk.json','utf8'));
 assert.equal(j.schemaVersion,'senate-864-2023-64-no-lrl-linked-pdf-alternate-clerk-html-source-status-v1');
 assert.equal(j.officialLrlOriginalIndexedCensus.originalJsonSha256,
  'ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0');
 assert.equal(j.perOfficiallyIndexedMeeting.length,64);
 const old=j.perOfficiallyIndexedMeeting.filter((x:any)=>
  x.onlineSenateClerkMinutesSourceStatus==='independently_authenticated_original_html');
 const remaining=j.perOfficiallyIndexedMeeting.filter((x:any)=>
  x.onlineSenateClerkMinutesSourceStatus==='not_yet_authenticated_by_this_alternate_source_route');
 assert.equal(old.length,14);assert.equal(remaining.length,50);
 const by=Object.fromEntries([...new Set(remaining.map((x:any)=>x.committeeName))].map(c=>
  [c,remaining.filter((x:any)=>x.committeeName===c).length]));
 assert.deepEqual(by,{
  'Taxes':28,'Agriculture, Broadband and Rural Development':17,
  'Education Finance':3,'Jobs and Economic Development':1,
  'Environment, Climate, and Legacy':1,
 });
 assert.equal(new Set(j.perOfficiallyIndexedMeeting.map((x:any)=>x.hearingDate+'|'+x.committeeName)).size,64);
 assert.ok(remaining.every((x:any)=>x.originalLrlElectronicMinutesPdfLinkAvailable===false&&
  x.originalSenateHearingId===null&&x.originalSenateHtmlSha256===null));
});
test('2022-25 research scope never requests 2021 and 2023 archived Clerk hearing ID must be government-backed',()=>{
 assert.equal(validate2023Target(t),true);
 assert.equal(governmentCalendarUrl(t),'https://www.leg.mn.gov/cal?d1=3%2F15%2F2023');
 assert.equal(senateClerkUrl(t,17800),
  'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=17800&ls=93&type=minutes');
 assert.throws(()=>validate2023Target({...t,year:2021} as RemainingTarget),/Unreviewed/);
 assert.throws(()=>senateClerkUrl(t,19995),/Non-2023-range/);
 const c=inspectGovernment2023Calendar(combined(t),t);
 assert.equal(c.matchedHearingId,17800);
 assert.equal(c.uniqueSenateAnchorWithoutCard,null);
 assert.equal(c.markedCanceled,false);
 assert.match(c.originalCalendarRawSha256,/^[0-9a-f]{64}$/);
});
test('calendar matches Senate-only exact named committee and date, not a same-day House card, duplicate Senate card or mismatched calendar day',()=>{
 assert.throws(()=>inspectGovernment2023Calendar(combined(t,17800,{wrong:true}),t),/exact 2023 day/);
 const house=inspectGovernment2023Calendar(combined(t,17800,{house:true}),t);
 assert.equal(house.matchedHearingId,null);
 assert.equal(house.uniqueSenateAnchorWithoutCard,null);
 const dup=inspectGovernment2023Calendar(combined(t,17800,{duplicate:true}),t);
 assert.equal(dup.matchedHearingId,null);
 assert.equal(dup.uniqueSenateAnchorWithoutCard,null);
 const anchor=inspectGovernment2023Calendar(combined(t,17800,{missingCard:true}),t);
 assert.equal(anchor.matchedHearingId,null);
 assert.equal(anchor.uniqueSenateAnchorWithoutCard,17800);
});
test('realistic Senate Clerk source grammar recognizes independent explicit named amendment and subsequent passage votes without inferring stored member identity',()=>{
 const d=inspectGovernment2023Calendar(combined(t,17800,{canceled:true}),t);
 const yes=['FictionalAtlas','FictionalBirch','FictionalCedar'];
 const no=['FictionalDalia','FictionalEcho'];
 const roll=(a:string[],b:string[])=>a.length+'/'+b.length+
  ' (Ayes: '+a.join(', ')+'; Nays: '+b.join(', ')+')';
 const html=minute(t,[
  '<p>S.F. 1955: Senator Fictional Atlas: Agriculture funding measure.</p>',
  '<p>Senator Fictional Birch moved A3 amendment. Senator Fictional Birch requested a roll call. '+
    roll(yes,no)+' MOTION PREVAILED.</p>',
  '<p>Senator Fictional Birch proposed A4 amendment, adopted on voice vote.</p>',
  '<p>Senator Fictional Birch requested a roll call vote for passage of S.F. 1955. '+
    roll(no,yes)+' MOTION FAILED.</p>',
  '<p>S.F. 2200: Senator Fictional Atlas: Small businesses.</p>',
  '<p>Senator Fictional Birch moved that S.F. 2200 be re-referred. MOTION PREVAILED.</p>'
 ].join(''));
 const out=inspect2023OriginalClerk(html,t,17800,d,'2026-10-14T03:00:00Z');
 assert.equal(out.calendarMarkedCanceled,true);
 assert.equal(out.sourceActionCandidates,3);
 assert.equal(out.namedRollCandidates,2);
 assert.equal(out.printedOriginalNamedChoices,10);
 assert.deepEqual(out.sourceActions.map(x=>[x.billReference,x.amendmentReference,
  x.kind,x.outcome,x.printedYea,x.printedNay]),[
  ['SF1955','A3','named_roll','prevailed',3,2],
  ['SF1955',null,'named_roll','failed',2,3],
  ['SF2200',null,'result_only','prevailed',null,null],
 ]);
 assert.ok(out.sourceActions.every(x=>x.originalNamedChoiceTextExcluded&&
  x.originalMemberIdAttribution===null&&x.historicalAvailableOnProvedFromPublication===false));
 assert.equal(out.historicalClerkFirstPublicAt,null);
 assert.equal(out.fullMotionDenominatorCertified,false);
 assert.equal(out.noProductionDbReadWrite,true);
});
test('wrong source committee/date, unsupported aliases and duplicate YEA/NAY name lists HOLD rather than manufacture votes',()=>{
 const d=inspectGovernment2023Calendar(combined(t),t);
 assert.throws(()=>inspect2023OriginalClerk(minute(t,'<p>Testimony.</p>'),tax,17800,d,
  '2026-10-14T03:00:00Z'),/Clerk ID not independently anchored/);
 assert.throws(()=>inspect2023OriginalClerk(minute(t,'<p>Testimony.</p>').replace('Wednesday, March 15, 2023','Thursday, March 16, 2023'),t,17800,d,
  '2026-10-14T03:00:00Z'),/heading\/date\/minutes\/attendance mismatch/);
 const duplicate=minute(t,
  '<p>S.F. 1955: Senator Fictional Atlas: Bill.</p>'+
  '<p>Senator Fictional Atlas requested a roll call. 2/1 (Ayes: FictionalAtlas, FictionalBirch; Nays: FictionalBirch) MOTION PREVAILED.</p>');
 assert.throws(()=>inspect2023OriginalClerk(duplicate,t,17800,d,
  '2026-10-14T03:00:00Z'),/uniqueness HOLD/);
 const noRoll=inspect2023OriginalClerk(minute(t,'<p>Testimony only without motions.</p>'),t,17800,d,
  '2026-10-14T03:00:00Z');
 assert.equal(noRoll.sourceActionCandidates,0);
 assert.equal(noRoll.fullMotionDenominatorCertified,false);
});
