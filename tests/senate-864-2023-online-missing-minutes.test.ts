import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {
 SENATE_864_ONLINE_MISSING_MINUTE_TARGETS,
 exactOfficialSenateOnlineMinutesURL,
 inspectOriginalSenateOnlineMinutes,
 validateOnline2023TargetsAgainstOfficialNoPdfCensus,
} from '../src/evidence/senate-864-2023-online-missing-minutes.js';

const target={committeeName:'Agriculture, Broadband and Rural Development' as const,
 day:'2023-03-20',hearingId:17807,minimumObservedMotions:3};
const sourceUrl=exactOfficialSenateOnlineMinutesURL(target);
const synthetic=(body:string,header='Agriculture, Broadband, and Rural Development Committee',
 day='Monday, March 20, 2023')=>[
 '<!DOCTYPE html><html><head><title>Original Minnesota Senate hearing</title>',
 '<style>'+'irrelevant '.repeat(180)+'</style></head>',
 '<body><h1>'+header+'</h1><p>'+day+'</p>',
 '<h2>Minutes</h2><p>Present: Senator Fictional Atlas - Chair</p>',
 '<p>Call to Order. Quorum is Present.</p>',
 body,'<p>The meeting was adjourned at 5:18PM.</p></body></html>'
].join('');

test('official source case URL is exact Minnesota Senate 2023 hearing-minutes path',()=>{
 assert.equal(sourceUrl,
  'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=17807&ls=93&type=minutes');
 assert.equal(SENATE_864_ONLINE_MISSING_MINUTE_TARGETS.length,14);
 assert.deepEqual(SENATE_864_ONLINE_MISSING_MINUTE_TARGETS.reduce((a,t)=>{
  a[t.committeeName]=(a[t.committeeName]??0)+1;return a;
 },{} as Record<string,number>),{
  Taxes:9,'Agriculture, Broadband and Rural Development':5,
 });
 assert.throws(()=>exactOfficialSenateOnlineMinutesURL({...target,hearingId:145}),/hearing-minute source identity/);
 assert.throws(()=>exactOfficialSenateOnlineMinutesURL({...target,day:'2023-02-30'}),/Invalid historical/);
});
test('conservatively isolates repeat amendment actions of one SF and separate SF recommendations',()=>{
 const html=synthetic([
  '<p>S.F. 2128: Senator Fictional Alpha: Restricted species.</p>',
  '<p>Senator Fictional Alpha moved to adopt the A-1 Amendment. MOTION PREVAILED.</p>',
  '<p>Senator Fictional Alpha moved to adopt the A-2 Amendment. MOTION PREVAILED.</p>',
  '<p>Senator Fictional Bravo moved to adopt the A-3 Amendment. MOTION FAILED.</p>',
  '<p>S.F. 2315: Senator Fictional Alpha: Phragmites.</p>',
  '<p>Senator Fictional Bravo moved that S.F. 2315 be recommended to pass. - MOTION PREVAILED.</p>',
 ].join(''));
 const x=inspectOriginalSenateOnlineMinutes(html,target,'2026-10-12T23:00:00Z');
 assert.equal(x.sourceOriginalHtmlBytes,Buffer.byteLength(html,'utf8'));
 assert.match(x.sourceOriginalHtmlSha256,/^[a-f0-9]{64}$/);
 assert.equal(x.hearingDate,'2023-03-20');
 assert.equal(x.parsedResultOnlyActionCandidates,4);
 assert.deepEqual(x.actions.map(a=>a.billReference),['SF2128','SF2128','SF2128','SF2315']);
 assert.deepEqual(x.actions.map(a=>a.amendmentReference),['A-1','A-2','A-3',null]);
 assert.deepEqual(x.actions.map(a=>a.outcome),['prevailed','prevailed','failed','prevailed']);
 assert.equal(x.actions[3]?.classification,'recommend_pass_result_only');
 assert.equal(x.actions.every(a=>a.individualVotesAvailable===false&&a.yeaCount===null&&a.nayCount===null),true);
 assert.equal(x.sourceIsNotOfficialLrlMinutesPdf,true);
 assert.equal(x.independentHtmlPublicationAt,null);
 assert.equal(x.transcriptParsingNotExhaustive,true);
 assert.equal(x.sourceHasPossibleNamedRollCallOrTallyCue,false);
 assert.equal(x.actions[0]?.originalMotionTextSha256.length,64);
 assert.ok(x.actions[0]?.sourceMotionText.includes('A-1 Amendment'));
});
test('motions without outcome and opening attendance never turn into member votes',()=>{
 const html=synthetic([
  '<p>S.F. 1234: Senator Fictional Alpha: A possible measure.</p>',
  '<p>Senator Fictional Alpha moved that S.F. 1234 be laid over for possible inclusion.</p>',
  '<p>S.F. 2128: Senator Fictional Bravo: Another bill.</p>',
  '<p>Senator Fictional Bravo moved the A-1 Amendment. The motion prevailed and the A-1 Amendment was adopted.</p>',
  '<p>The roll call tally for some OTHER action was described as Ayes: 4; Nays: 2.</p>',
 ].join(''));
 const x=inspectOriginalSenateOnlineMinutes(html,{...target,minimumObservedMotions:1},
  '2026-10-12T23:00:00Z');
 assert.equal(x.parsedResultOnlyActionCandidates,1);
 assert.equal(x.actions[0]?.billReference,'SF2128');
 assert.equal(x.actions[0]?.amendmentReference,'A-1');
 assert.equal(x.sourceHasPossibleNamedRollCallOrTallyCue,true);
 assert.equal(x.actions[0]?.individualVotesAvailable,false);
 assert.equal(x.actions[0]?.yeaCount,null);
 assert.equal(x.actions[0]?.nayCount,null);
 assert.equal(x.noIndividualChoicesInferredFromAttendanceOrMotionResult,true);
});
test('discussion-only source cannot certify no vote or no motion',()=>{
 const t={...target,minimumObservedMotions:0};
 const x=inspectOriginalSenateOnlineMinutes(synthetic(
  '<p>The committee heard testimony on S.F. 15. Discussion only.</p>'),
  t,'2026-10-12T23:00:00Z');
 assert.equal(x.actions.length,0);
 assert.equal(x.unrecognizedOfficialMotionCount,null);
 assert.equal(x.noVoteOrNoMotionInferredFromEmptyParserOutput,true);
});
test('rejects a same-day wrong committee or wrong hearing date and a short or stripped page',()=>{
 const good=synthetic('<p>Discussion only.</p>');
 assert.throws(()=>inspectOriginalSenateOnlineMinutes(
  good.replace('March 20, 2023','March 21, 2023'),target,'2026-10-12T23:00:00Z'),/committee\/day/);
 assert.throws(()=>inspectOriginalSenateOnlineMinutes(
  good.replace('Agriculture, Broadband, and Rural Development Committee','Transportation Committee'),
  target,'2026-10-12T23:00:00Z'),/committee\/day/);
 assert.throws(()=>inspectOriginalSenateOnlineMinutes('<html>404</html>',
  target,'2026-10-12T23:00:00Z'),/outside byte bounds/);
});
test('source 14 targets must match frozen official 64 no-PDF year cases exactly, not invented meetings',()=>{
 const rows:Array<{year:number;committeeName:string;meetingDate:string;minutesPdfUrls:string[];electronicMinutesStatus:string}>=
  SENATE_864_ONLINE_MISSING_MINUTE_TARGETS.map(t=>({
  year:2023,committeeName:t.committeeName,meetingDate:t.day,
  minutesPdfUrls:[],electronicMinutesStatus:'meeting_without_linked_minutes',
 }));
 for(let i=0;i<50;i++)rows.push({
  year:2023,committeeName:'Other Committee '+i,meetingDate:'2023-02-'+String(i%28+1).padStart(2,'0'),
  minutesPdfUrls:[],electronicMinutesStatus:'meeting_without_linked_minutes',
 });
 const x=validateOnline2023TargetsAgainstOfficialNoPdfCensus(
  SENATE_864_ONLINE_MISSING_MINUTE_TARGETS,rows);
 assert.deepEqual(x,{year:2023,indexedWithoutLrlMinutes:64,
  verifiedCandidateTargets:14,sourceEvidenceIsNotACompleteYear:true});
 const changed=rows.map((r,i)=>i===0?{...r,minutesPdfUrls:['https://lrl.mn.gov/other.pdf']}:r);
 assert.throws(()=>validateOnline2023TargetsAgainstOfficialNoPdfCensus(
  SENATE_864_ONLINE_MISSING_MINUTE_TARGETS,changed),/does not uniquely match/);
});

test('source-exact April 17 Taxes separate A138 amendment and SF73 recommendation are COUNT ONLY 6-3 rolls, with one explicitly absent',()=>{
 const april=SENATE_864_ONLINE_MISSING_MINUTE_TARGETS.find(t=>
  t.day==='2023-04-17'&&t.committeeName==='Taxes')!;
 const body=[
  '<p>S.F. 73: Senator Fictional Port: Cannabis provisions modification.</p>',
  '<p>Senator Fictional Klein moved the A128 Technical Amendment. The motion prevailed and the A128 Technical Amendment was adopted.</p>',
  '<p>Senator Fictional Klein moved the A138 DE Amendment. Senator Fictional Rest requested a roll call. With a roll call vote of 6 yay, 3 nay, and with 1 member absent, the motion prevailed and the A138 DE Amendment was adopted.</p>',
  '<p>Senator Fictional Klein moved that SF 73 be recommended to pass and referred to the Finance Committee and requested a roll call. From a roll call vote of 6 yay, 3 nay, and with 1 member absent, the motion prevailed.</p>',
 ].join('');
 const html=synthetic(body,'Taxes Committee','Monday, April 17, 2023');
 const result=inspectOriginalSenateOnlineMinutes(html,april,'2026-10-13T03:15:00Z');
 assert.equal(result.parsedActionCandidates,3);
 assert.equal(result.parsedResultOnlyActionCandidates,1);
 assert.equal(result.parsedCountOnlyRollCallCandidates,2);
 const rolls=result.actions.filter(a=>a.classification==='count_only_roll_call');
 assert.equal(rolls.length,2);
 assert.deepEqual(rolls.map(a=>[a.billReference,a.amendmentReference,a.yeaCount,a.nayCount,a.absentCount]),
  [['SF73','A138',6,3,1],['SF73',null,6,3,1]]);
 assert.deepEqual(rolls.map(a=>a.outcome),['prevailed','prevailed']);
 assert.ok(rolls.every(a=>a.individualVotesAvailable===false&&
  a.namedMemberIdentitiesInferred===false&&a.persistedEventIdentity===null));
 assert.notEqual(rolls[0]!.originalMotionTextSha256,rolls[1]!.originalMotionTextSha256);
 assert.equal(result.actions[0]!.classification,'amendment_motion_result_only');
 assert.equal(result.actions[0]!.yeaCount,null);
 assert.equal(result.actions[0]!.nayCount,null);
});
test('mere roll-call phrase, opening attendance and unlinked numeric tallies cannot manufacture count-only choice sides',()=>{
 const t={...target,minimumObservedMotions:1};
 const body=[
  '<p>Present: Senator Fictional Alpha, Senator Fictional Bravo.</p>',
  '<p>The records mention a roll call vote of 4 yay, 2 nay in an earlier session.</p>',
  '<p>S.F. 2128: Senator Fictional Alpha: Bill topic.</p>',
  '<p>Senator Fictional Bravo moved the A-2 Amendment. The motion prevailed.</p>',
 ].join('');
 const x=inspectOriginalSenateOnlineMinutes(synthetic(body),t,'2026-10-13T03:15:00Z');
 assert.equal(x.parsedActionCandidates,1);
 assert.equal(x.parsedCountOnlyRollCallCandidates,0);
 assert.equal(x.actions[0]?.yeaCount,null);
 assert.equal(x.actions[0]?.absentCount,null);
 assert.equal(x.sourceHasPossibleNamedRollCallOrTallyCue,true);
});

test('independently authenticated original 14 Senate HTML body SHA + 31/2 action receipt remains an immutable 64-no-LRL-PDF subset',()=>{
 const proof=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/senate-864-2023-14-senate-online-original-html-source-receipts.json','utf8'));
 assert.equal(proof.schemaVersion,'senate-864-2023-original-14-senate-clerk-minutes-sha-receipts-v1');
 assert.equal(proof.originalSenateOnlineMinutesSourceRun.runId,38339994639);
 assert.equal(proof.originalSenateOnlineMinutesSourceRun.sourceArtifactId,11786463448);
 assert.equal(proof.originalSenateOnlineMinutesSourceRun.sourceArtifactZipSha256,
  '8a0f31a90127ad099ff8ab52e718bd13e586f3de08f94d2bbad9e2413c635518');
 assert.equal(proof.inheritedOfficialLrl2022To2025Census.year2023IndexedMeetingsWithoutLinkedMinutesPdf,64);
 assert.equal(proof.verifiedOriginals.length,14);
 assert.equal(proof.sourceProvenResultOnlyMotionCandidates,31);
 assert.equal(proof.sourceProvenCountOnlyRollCallCandidates,2);
 assert.equal(proof.verifiedOriginals.reduce((sum:number,x:any)=>
  sum+x.parsedResultOnlyActionCandidates,0),31);
 assert.equal(proof.verifiedOriginals.reduce((sum:number,x:any)=>
  sum+x.parsedCountOnlyRollCallCandidates,0),2);
 const known=new Set(SENATE_864_ONLINE_MISSING_MINUTE_TARGETS.map(t=>
  [t.committeeName,t.day,t.hearingId].join('|')));
 const seen=new Set();
 for(const source of proof.verifiedOriginals){
  const key=[source.committeeName,source.hearingDate,source.officialSenateHearingId].join('|');
  assert.ok(known.has(key));
  assert.ok(!seen.has(key));seen.add(key);
  assert.match(source.originalSourceUrl,/^https:\/\/www\.senate\.mn\/schedule\/hearing_minutes\.html\?/);
  assert.match(source.sourceOriginalHtmlSha256,/^[0-9a-f]{64}$/);
  assert.match(source.normalizedOriginalTextSha256,/^[0-9a-f]{64}$/);
  assert.equal(source.independentHtmlPublicationAt,null);
  assert.equal(source.namedMemberVotesInferred,0);
  assert.ok(source.sourceOriginalHtmlBytes>=1500);
 }
 assert.equal(seen.size,14);
 assert.equal(proof.independentlyEstablishedHistoricalHtmlPublishedAtCount,0);
 assert.equal(proof.allParsedCandidatesExhaustiveOfOriginalOfficialMotions,false);
 assert.equal(proof.currentPersistedEventChoiceEqualityCertified,false);
 const publicBody=JSON.stringify(proof);
 assert.doesNotMatch(publicBody,/choiceIdentitySha256|normalized_member_name|membership_id|originalSourceHtmlBody/);
});

test('independent 2023 64-meeting no-PDF -> 14 Clerk originals + 50 unverified crosswalk exactly matches official per-committee denominators',()=>{
 const ledger=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/senate-864-2023-64-no-lrl-pdf-to-senate-clerk-original-html-crosswalk.json','utf8'));
 assert.equal(ledger.schemaVersion,
  'senate-864-2023-64-no-lrl-linked-pdf-alternate-clerk-html-source-status-v1');
 assert.equal(ledger.perOfficiallyIndexedMeeting.length,64);
 assert.equal(ledger.indexedWithoutLrlElectronicPdf,64);
 assert.equal(ledger.authenticatedOnlineSenateClerkMinutes,14);
 assert.equal(ledger.remainingUnverifiedViaNewSourceRoute,50);
 assert.equal(ledger.perCommittee.length,5);
 assert.equal(ledger.perCommittee.reduce((s:number,c:any)=>s+c.indexed2023MeetingsWithoutLrlMinutesPdf,0),64);
 assert.equal(ledger.perCommittee.reduce((s:number,c:any)=>s+c.authenticatedOfficialSenateOnlineHtml,0),14);
 assert.equal(ledger.perCommittee.reduce((s:number,c:any)=>s+c.remainingWithoutAuthenticatedAlternateClerkHtml,0),50);
 assert.deepEqual(ledger.perCommittee.map((c:any)=>[c.committeeName,c.indexed2023MeetingsWithoutLrlMinutesPdf,
  c.authenticatedOfficialSenateOnlineHtml,c.remainingWithoutAuthenticatedAlternateClerkHtml]),[
   ['Agriculture, Broadband and Rural Development',22,5,17],
   ['Education Finance',3,0,3],['Environment, Climate, and Legacy',1,0,1],
   ['Jobs and Economic Development',1,0,1],['Taxes',37,9,28],
  ]);
 assert.equal(ledger.parserRecognizedResultOnlyActionCandidatesOnVerifiedAlternates,31);
 assert.equal(ledger.parserRecognizedCountOnlyRollCallCandidatesOnVerifiedAlternates,2);
 const sources=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/senate-864-2023-14-senate-online-original-html-source-receipts.json','utf8'));
 const expected=new Map(sources.verifiedOriginals.map((x:any)=>[
  x.committeeName+'|'+x.hearingDate,x]));
 const seen=new Set<string>();
 for(const meeting of ledger.perOfficiallyIndexedMeeting){
  const key=meeting.committeeName+'|'+meeting.hearingDate;
  assert.ok(!seen.has(key));seen.add(key);
  assert.equal(meeting.year,2023);
  assert.equal(meeting.originalLrlElectronicMinutesPdfLinkAvailable,false);
  assert.equal(meeting.historicalFirstOnlinePublicationDateProven,null);
  assert.equal(meeting.anyNamedMemberVotesInferred,false);
  assert.equal(meeting.noSourceVerifiedDoesNotProveNoMinutesOrNoVote,true);
  const source=expected.get(key);
  if(source){
   assert.equal(meeting.onlineSenateClerkMinutesSourceStatus,'independently_authenticated_original_html');
   assert.equal(meeting.originalSenateHtmlSha256,source.sourceOriginalHtmlSha256);
   assert.equal(meeting.originalSenateNormalizedTextSha256,source.normalizedOriginalTextSha256);
   assert.equal(meeting.originalSenateHearingId,source.officialSenateHearingId);
   assert.equal(meeting.parserRecognizedCountOnlyRollCallCandidates,source.parsedCountOnlyRollCallCandidates);
  }else{
   assert.equal(meeting.onlineSenateClerkMinutesSourceStatus,'not_yet_authenticated_by_this_alternate_source_route');
   assert.equal(meeting.originalSenateHtmlSha256,null);
   assert.equal(meeting.parserRecognizedCountOnlyRollCallCandidates,null);
   assert.equal(meeting.parserRecognizedResultOnlyMotionCandidates,null);
  }
 }
 assert.equal(seen.size,64);
 assert.equal(ledger.originalMinutesUnavailabilityMustNotBeConcludedFromAbsenceOfLrlPdfOrUnverifiedAlternateHtml,true);
 assert.equal(ledger.sourceToCurrentPrivatePersistedEventParityNotPerformed,true);
 assert.equal(ledger.productionOrSchedulerChanges,false);
});
