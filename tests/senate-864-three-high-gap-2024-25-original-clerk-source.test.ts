import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 reconcileExact53HighGapRoster,inspectOriginalGovernmentCombinedDay,
 inspectOriginalHighGapSenateClerkHtml,originalSenateClerkMinutesUrl,
 legislatureCombinedCalendarUrl,type HighGapTarget,
} from '../src/evidence/senate-864-2024-25-three-high-gap-clerk-source.js';

const energy:HighGapTarget={
 year:2025,committeeName:'Energy, Utilities, Environment, and Climate',
 hearingDate:'2025-03-19',officialIndexCommitteeId:'10074-0',
 originalLrlMinutesPdfLinked:false,
};
const state:HighGapTarget={
 year:2024,committeeName:'State and Local Government and Veterans',
 hearingDate:'2024-03-14',officialIndexCommitteeId:'3131-0',
 originalLrlMinutesPdfLinked:false,
};
const taxes:HighGapTarget={
 year:2024,committeeName:'Taxes',hearingDate:'2024-03-06',
 officialIndexCommitteeId:'26142-0',originalLrlMinutesPdfLinked:false,
};
const garbage='p'.repeat(40000);
function calendar(target:HighGapTarget,id:number,opts:{wrongDay?:boolean;canceled?:boolean;duplicate?:boolean}={}){
 const day=opts.wrongDay?'3/18/2025':[
  Number(target.hearingDate.slice(5,7)),Number(target.hearingDate.slice(8,10)),
  target.year
 ].join('/');
 const card=(id:number)=>[
  "<div class='card border-dark senate_item cal_item ml-lg-3' id='s_"+id+"'>",
  "<div class='card-header'><span>Senate</span><h3>"+target.committeeName+"</h3>",
  opts.canceled?"<span class='text-danger'>Canceled</span>":'',
  "</div><div class='meeting loading'></div></div>"
 ].join('');
 return '<html><body>'+garbage+
  '<h2>Combined Legislative Meeting Calendar - '+day+'</h2>'+
  "<a class='cal_anchor_link text-senate' href='#s_"+id+"'>"+target.committeeName+"</a>"+
  (opts.duplicate?"<a class='cal_anchor_link text-senate' href='#s_"+(id+1)+"'>"+target.committeeName+"</a>":'')+
  card(id)+(opts.duplicate?card(id+1):'')+'</body></html>';
}
function minute(t:HighGapTarget,body:string,dayLabel:string){
 return '<html><head><title>Official Minnesota Senate Minutes</title></head><body>'+
  '<p>'+garbage.slice(0,3500)+'</p>'+
  '<h1>'+t.committeeName+' Committee</h1><p>'+dayLabel+'</p>'+
  '<h2>Minutes</h2><p>Present: Senator Fictional Alpha - Chair; Senator Fictional Bravo</p>'+
  body+'<p>The meeting was adjourned.</p></body></html>';
}
test('exact 53 official indexed 2024/25 no-PDF hearings cover only owner-selected 3 groups',()=>{
 const r=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-53-no-pdf-official-index.json','utf8'));
 assert.equal(r.schemaVersion,'senate-864-2024-25-three-high-gap-official-unlinked-meeting-roster-v1');
 assert.equal(r.totalIndexedMissingOriginalMinutesLinkedPdf,53);
 assert.equal(r.original141NoMinutesRoster.originalCensusRunId,38065594898);
 assert.equal(r.original141NoMinutesRoster.originalCensusJsonSha256,
  'ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0');
 assert.deepEqual(r.userSelectedCohorts.map((x:any)=>[x.year,x.committeeName,x.want]),[
  [2024,'Taxes',23],[2024,'State and Local Government and Veterans',13],
  [2025,'Energy, Utilities, Environment, and Climate',17],
 ]);
 assert.equal(reconcileExact53HighGapRoster(r.meetings).meetings,53);
 const original=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/senate-committee-141-unlinked-original-meeting-roster.json','utf8'));
 const candidates=new Set(original.meetingGroups.flatMap((x:any)=>
  x.missingMinutesMeetingDates.map((d:string)=>[x.year,x.committeeName,x.officialIndexCommitteeId,x.year+'-'+d].join('|'))));
 for(const m of r.meetings){
  assert.ok(candidates.has([m.year,m.committeeName,m.officialIndexCommitteeId,m.hearingDate].join('|')));
  assert.equal(m.originalLrlMinutesPdfLinked,false);
  assert.equal(m.clerkMinutesSourceStatus,'not_yet_authenticated');
  assert.equal(m.sourceMotionResults,null);
  assert.equal(m.unavailableOrNoRecordedVoteClaim,false);
 }
 assert.throws(()=>reconcileExact53HighGapRoster(r.meetings.slice(1)),/53/);
 assert.throws(()=>reconcileExact53HighGapRoster([...r.meetings.slice(1),r.meetings[1]]),/Duplicate|count drift/);
});
test('the 2024/25 original government calendar alone supplies exact committee ID and matching Senate card',()=>{
 assert.equal(legislatureCombinedCalendarUrl(energy),'https://www.leg.mn.gov/cal?d1=3%2F19%2F2025');
 assert.equal(originalSenateClerkMinutesUrl(energy,19216),
  'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=19216&ls=94&type=minutes');
 assert.equal(originalSenateClerkMinutesUrl(state,18532),
  'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=18532&ls=93&type=minutes');
 assert.throws(()=>originalSenateClerkMinutesUrl(energy,18000),/outside exact reviewed/);
 const x=inspectOriginalGovernmentCombinedDay(calendar(energy,19216),energy);
 assert.equal(x.exactOfficialHearingId,19216);
 assert.equal(x.idsNamedByCommitteeAnchor.length,1);
 assert.equal(x.idsNamedBySenateCard.length,1);
 assert.equal(x.calendarMarkedCanceled,false);
 assert.match(x.calendarOriginalHtmlSha256,/^[0-9a-f]{64}$/);
});
test('original calendar canceled and historical archived Clerk Minutes can both be true and require source reconciliation',()=>{
 const day=inspectOriginalGovernmentCombinedDay(calendar(state,18532,{canceled:true}),state);
 assert.equal(day.exactOfficialHearingId,18532);
 assert.equal(day.calendarMarkedCanceled,true);
 const html=minute(state,
  '<p>S.F. 3787: Senator Fictional Beta: Sick time bill.</p>'+
  '<p>Senator Fictional Alpha moved that S.F. 3787 be recommended to pass and re-referred to the Finance Committee. - MOTION PREVAILED.</p>',
  'Thursday, March 14, 2024');
 const m=inspectOriginalHighGapSenateClerkHtml(html,state,18532,day,'2026-10-13T05:30:00Z');
 assert.equal(m.calendarCanceledAndSenateClerkMinutesBodyBothPresent,true);
 assert.equal(m.exactCalendarMarkedCanceled,true);
 assert.equal(m.canonicalMotionCandidates,1);
 assert.equal(m.actions[0]?.sourceResult,'prevailed');
 assert.equal(m.actions[0]?.billReference,'SF3787');
 assert.equal(m.actions[0]?.explicitYeaCount,null);
 assert.equal(m.originalClerkHtmlHistoricalFirstPublishedAt,null);
});
test('2025 source summary 6-5 roll call joins exactly one formal motion without duplicate member choice',()=>{
 const day=inspectOriginalGovernmentCombinedDay(calendar(energy,19216),energy);
 const html=minute(energy,
  '<p>S.F. 733: Senator Kunesh: Abandoned pipelines.</p>'+
  '<p>Senator Xiong moves to send SF733 to Environment with recommendation Motion prevails on a 6-5 roll call</p>'+
  '<p>Senator Xiong moved that S.F. 733, be recommended to pass and re-referred to the Environment Committee. - MOTION PREVAILED.</p>'+
  '<p>S.F. 2018: Senator Weber: Fuel technology. Senator Frentz moved that S.F. 2018, be laid over for inclusion in the omnibus bill. - MOTION PREVAILED.</p>',
  'Wednesday, March 19, 2025');
 const x=inspectOriginalHighGapSenateClerkHtml(html,energy,19216,day,'2026-10-13T05:35:00Z');
 assert.equal(x.canonicalMotionCandidates,2);
 assert.deepEqual(x.actions.map(a=>[a.billReference,a.evidenceClassification,a.explicitYeaCount,a.explicitNayCount]),[
  ['SF733','aggregate_count_only',6,5],['SF2018','result_only',null,null],
 ]);
 assert.ok(x.actions.every(a=>a.namedMemberChoiceStatus==='never_inferred_no_explicit_named_vote_proof'));
 assert.equal(x.allIndividualVoterSidesUnknownInThisParser,true);
 assert.equal(x.ownerHearingDateHistoricalAvailableOnRule,'2025-03-19');
 assert.equal(x.sameDayEligibilityExcludedWithoutTimeProof,true);
});
test('the same committee 2024 Taxes can have two distinct amendment decisions and voice cues without YEA/NAY assignment',()=>{
 const day=inspectOriginalGovernmentCombinedDay(calendar(taxes,18475),taxes);
 const html=minute(taxes,
  '<p>S.F. 4247: Senator Hauschild: Bill.</p>'+
  '<p>Senator Rest moved that S.F. 4247, be laid over. - MOTION PREVAILED.</p>'+
  '<p>S.F. 3757: Senator Hauschild: Another bill.</p>'+
  '<p>Senator Rest moved the A1 Amendment. The motion prevailed and the A1 Amendment was adopted.</p>'+
  '<p>Senator Weber offered the A2 amendment Adopted via voice vote.</p>',
  'Wednesday, March 6, 2024');
 const m=inspectOriginalHighGapSenateClerkHtml(html,taxes,18475,day,'2026-10-13T05:35:00Z');
 assert.deepEqual(m.actions.map(a=>[a.billReference,a.amendmentReference,a.evidenceClassification]),[
  ['SF4247',null,'result_only'],['SF3757','A1','result_only'],
  ['SF3757','A2','voice_amendment'],
 ]);
 assert.equal(m.actions.every(a=>a.explicitYeaCount===null&&a.explicitNayCount===null),true);
});
test('wrong day, committee, duplicated ID and false Clerk header never certify a government meeting',()=>{
 assert.throws(()=>inspectOriginalGovernmentCombinedDay(
  calendar(energy,19216,{wrongDay:true}),energy),/day is not verified/);
 const wrong=calendar(energy,19216).replaceAll(energy.committeeName,'Housing and Homelessness Prevention');
 const res=inspectOriginalGovernmentCombinedDay(wrong,energy);
 assert.equal(res.exactOfficialHearingId,null);
 assert.equal(res.status,'ambiguous_or_no_exact_calendar_hearing_id');
 const dup=inspectOriginalGovernmentCombinedDay(calendar(energy,19216,{duplicate:true}),energy);
 assert.equal(dup.exactOfficialHearingId,null);
 assert.equal(dup.idsNamedByCommitteeAnchor.length,2);
 const ok=inspectOriginalGovernmentCombinedDay(calendar(energy,19216),energy);
 assert.throws(()=>inspectOriginalHighGapSenateClerkHtml(
  minute(energy,'<p>Discussion only</p>','Tuesday, March 18, 2025'),
  energy,19216,ok,'2026-10-13T05:35:00Z'),/printed committee, actual date/);
 assert.throws(()=>inspectOriginalHighGapSenateClerkHtml(
  minute(energy,'<p>Discussion only</p>','Wednesday, March 19, 2025'),
  energy,19215,ok,'2026-10-13T05:35:00Z'),/not independently established/);
});
test('missing motion grammar, lack of clerk result and attendance never proves zero votes',()=>{
 const day=inspectOriginalGovernmentCombinedDay(calendar(energy,19216),energy);
 const x=inspectOriginalHighGapSenateClerkHtml(
  minute(energy,'<p>S.F. 19: Senator Fictional Alpha: Hearing presentation.</p><p>No vote list appears here.</p>',
   'Wednesday, March 19, 2025'),
  energy,19216,day,'2026-10-13T05:35:00Z');
 assert.equal(x.canonicalMotionCandidates,0);
 assert.equal(x.fullOfficialMotionUniverseCertified,false);
 assert.equal(x.allIndividualVoterSidesUnknownInThisParser,true);
});

test('one source-specific Senate anchor without detail card is PROVISIONAL until separate authenticated Clerk original agrees on day/committee',()=>{
 const apr05={...state,hearingDate:'2024-04-05'};
 const html=calendar(apr05,18636).replace(
  /<div class='card border-dark senate_item[\s\S]*?<\/div><\/div>/,'');
 const justAnchor=inspectOriginalGovernmentCombinedDay(html,apr05);
 assert.equal(justAnchor.exactOfficialHearingId,null);
 assert.equal(justAnchor.uniqueSenateAnchorHearingIdRequiringIndependentClerkBody,18636);
 assert.equal(justAnchor.idsNamedBySenateCard.length,0);
 assert.equal(justAnchor.status,'unique_exact_senate_anchor_without_card_needs_independent_clerk_body');
 const source=minute(state,
  '<p>S.F. 4738: Senator Fictional Alpha: Original bill hearing.</p>'+
  '<p>Senator Fictional Beta moved that S.F. 4738 be recommended to pass. - MOTION PREVAILED.</p>',
  'Friday, April 5, 2024');
 const actual=inspectOriginalHighGapSenateClerkHtml(source,
  apr05,18636,
  justAnchor,'2026-10-13T07:30:00Z');
 assert.equal(actual.hearingIdentityProofTier,
  'official_calendar_single_named_senate_anchor_plus_independently_authenticated_original_clerk_body');
 assert.equal(actual.allIndividualVoterSidesUnknownInThisParser,true);
 assert.equal(actual.canonicalMotionCandidates,1);
 assert.throws(()=>inspectOriginalHighGapSenateClerkHtml(
  source,apr05,18637,
  justAnchor,'2026-10-13T07:30:00Z'),/not independently established/);
 assert.throws(()=>inspectOriginalHighGapSenateClerkHtml(
  source,{...state,hearingDate:'2024-04-19'},18636,
  {...justAnchor,hearingDate:'2024-04-19'},'2026-10-13T07:30:00Z'),/printed committee, actual date/);
});
test('calendar lone Senate anchor is rejected when another card contradicts identity or when committee has duplicate anchors',()=>{
 const withCard=calendar(state,18636);
 const conflicting=withCard.replace("id='s_18636'","id='s_18637'");
 const x=inspectOriginalGovernmentCombinedDay(conflicting,state);
 assert.equal(x.exactOfficialHearingId,null);
 assert.equal(x.uniqueSenateAnchorHearingIdRequiringIndependentClerkBody,null);
 const dup=inspectOriginalGovernmentCombinedDay(calendar(state,18636,{duplicate:true}),state);
 assert.equal(dup.uniqueSenateAnchorHearingIdRequiringIndependentClerkBody,null);
});

test('distinct explicitly named amendment rolls with identical committees and same bill remain independent source records, NO DB member-vote import',()=>{
 const d=inspectOriginalGovernmentCombinedDay(calendar(state,18532,{canceled:true}),state);
 const yes=['FictionalAtlas','FictionalBirch','FictionalCedar','FictionalDalia',
  'FictionalEcho','FictionalFable','FictionalGrove'];
 const no=['FictionalHawk','FictionalIris','FictionalJuniper','FictionalKilo',
  'FictionalLotus','FictionalMaple'];
 const block=minute(state,
  '<p>S.F. 3787: Senator Fictional Atlas: Historic measure.</p>'+
  '<p>Senator Fictional Hawk moved the A11 amendment. Senator Fictional Birch requested a roll call vote for the adoption of A11 amendment. 7/6 (Ayes: '+yes.join(', ')+'; Nays: '+no.join(', ')+') MOTION PREVAILED.</p>'+
  '<p>Senator Fictional Birch moved the A10 amendment. Senator Fictional Maple requested a roll call vote. 6/7 (Ayes: '+no.join(', ')+'; Nays: '+yes.join(', ')+') MOTION FAILED.</p>',
  'Thursday, March 14, 2024');
 const x=inspectOriginalHighGapSenateClerkHtml(block,state,18532,d,'2026-10-13T07:55:00Z');
 assert.equal(x.canonicalMotionCandidates,2);
 assert.equal(x.classificationCounts.explicitNamedRolls,2);
 assert.equal(x.classificationCounts.sourceExplicitNamedYeaNayEntries,26);
 assert.deepEqual(x.actions.map(a=>[a.billReference,a.amendmentReference,
  a.evidenceClassification,a.explicitYeaCount,a.explicitNayCount,a.sourceResult]),[
   ['SF3787','A11','explicit_named_roll',7,6,'prevailed'],
   ['SF3787','A10','explicit_named_roll',6,7,'failed'],
 ]);
 assert.ok(x.actions.every(a=>a.originalExplicitNamedChoiceCount===13&&
  a.sourceExactNamedTallyAndUniqueNamesVerified===true&&
  a.namedMemberChoiceStatus==='explicitly_named_in_original_clerk_minutes_no_historical_day_roster_or_db_join'));
 assert.ok(x.actions.every(a=>a.originalMotionTextContainsNamedSidesButPublishedExcerptRedacted===true));
 assert.ok(x.actions.every(a=>!a.observedMotionText.includes('FictionalIris')&&
  !a.observedMotionText.includes('FictionalAtlas')&&a.observedMotionText.includes('redacted')));
 assert.notEqual(x.actions[0]?.boundedOriginalMotionSha256,x.actions[1]?.boundedOriginalMotionSha256);
 assert.equal(x.allIndividualVoterSidesUnknownInThisParser,false);
 assert.equal(x.noDirectSourceToMemberVoteImport,true);
});

test('March 14 2024 original Clerk grammar preserves five separately printed named rolls, including three without a nearby mover',()=>{
 const originalDay=inspectOriginalGovernmentCombinedDay(calendar(state,18532,{canceled:true}),state);
 // The real archived March 14 Clerk original prints SF3787 A11, A10 and
 // passage, then SF3986 and SF3561, five distinct 13-choice named blocks.
 // Use *fictional* names in synthetic tests; never publish actual choices.
 const yes=['FictionalAtlas','FictionalBirch','FictionalCedar','FictionalDalia',
  'FictionalEcho','FictionalFable','FictionalGrove'];
 const no=['FictionalHawk','FictionalIris','FictionalJuniper','FictionalKilo',
  'FictionalLotus','FictionalMaple'];
 const roll=(a:string[],b:string[])=>a.length+'/'+b.length+
  ' (Ayes: '+a.join(', ')+'; Nays: '+b.join(', ')+')';
 const html=minute(state,[
  '<p>S.F. 3787: Senator Fictional Alpha: Employment policy.</p>',
  '<p>Senator Fictional Hawk moved the A11 amendment. Senator Fictional Birch requested a roll call vote. '+roll(yes,no)+' MOTION PREVAILED.</p>',
  '<p>Senator Fictional Hawk moves the A10 amendment. Senator Fictional Maple requested the roll call. '+roll(no,yes)+' MOTION FAILED.</p>',
  '<p>Senator Fictional Hawk requested a roll call vote for the passage of S.F. 3787. '+roll(yes,no)+' MOTION PREVAILED.</p>',
  '<p>S.F. 3986: Senator Fictional Alpha: Public lands policy.</p>',
  '<p>Senator Fictional Hawk requested a roll call vote on S.F. 3986. '+roll(yes,no)+' MOTION PREVAILED.</p>',
  '<p>S.F. 3561: Senator Fictional Alpha: Packaging policy.</p>',
  '<p>Senator Fictional Alpha offered the A14 amendment, adopted by voice.</p>',
  '<p>Senator Fictional Hawk requested a roll call vote for the passage of S.F. 3561. '+roll(yes,no)+' MOTION PREVAILED.</p>'
 ].join(''),'Thursday, March 14, 2024');
 const x=inspectOriginalHighGapSenateClerkHtml(html,state,18532,originalDay,'2026-10-13T06:20:00Z');
 assert.equal(x.canonicalMotionCandidates,5);
 assert.equal(x.classificationCounts.explicitNamedRolls,5);
 assert.equal(x.schemaVersion,'senate-864-2024-25-three-committee-original-clerk-action-v2');
 assert.equal(x.classificationCounts.sourceExplicitNamedYeaNayEntries,65);
 assert.deepEqual(x.actions.map(a=>[
  a.billReference,a.amendmentReference,a.evidenceClassification,
  a.explicitYeaCount,a.explicitNayCount,a.sourceResult
 ]),[
  ['SF3787','A11','explicit_named_roll',7,6,'prevailed'],
  ['SF3787','A10','explicit_named_roll',6,7,'failed'],
  ['SF3787',null,'explicit_named_roll',7,6,'prevailed'],
  ['SF3986',null,'explicit_named_roll',7,6,'prevailed'],
  ['SF3561',null,'explicit_named_roll',7,6,'prevailed']
 ]);
 assert.equal(new Set(x.actions.map(a=>a.sourceTextOffset)).size,5);
 assert.ok(x.actions.every(a=>a.sourceExactNamedTallyAndUniqueNamesVerified&&
  a.originalExplicitNamedChoiceCount===13&&a.namedMemberChoiceStatus===
  'explicitly_named_in_original_clerk_minutes_no_historical_day_roster_or_db_join'));
 assert.ok(x.actions.every(a=>!a.observedMotionText.includes('FictionalAtlas')&&
  !a.observedMotionText.includes('FictionalHawk')&&a.observedMotionText.includes('redacted')));
 assert.equal(x.noDirectSourceToMemberVoteImport,true);
});

test('named source roll with duplicate voter, side mismatch or bad tally holds without inferring senator support',()=>{
 const d=inspectOriginalGovernmentCombinedDay(calendar(state,18532),state);
 const org=minute(state,
  '<p>S.F. 3787: Senator Fictional Atlas: Hearing item.</p>'+
  '<p>Senator Fictional Birch moved A11 amendment. 2/1 (Ayes: FictionalAtlas, FictionalBirch; Nays: FictionalBirch) MOTION FAILED.</p>',
  'Thursday, March 14, 2024');
 assert.throws(()=>inspectOriginalHighGapSenateClerkHtml(org,state,18532,d,
  '2026-10-13T07:55:00Z'),/mismatched tally.*duplicate identity|duplicate identity/);
 const fewer=org.replace('2/1 (Ayes:','3/1 (Ayes:');
 assert.throws(()=>inspectOriginalHighGapSenateClerkHtml(fewer,state,18532,d,
  '2026-10-13T07:55:00Z'),/mismatched tally/);
});
