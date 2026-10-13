import test from 'node:test';
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
 const rows=SENATE_864_ONLINE_MISSING_MINUTE_TARGETS.map(t=>({
  year:2023,committeeName:t.committeeName,meetingDate:t.day,
  minutesPdfUrls:[],electronicMinutesStatus:'meeting_without_linked_minutes',
 }));
 for(let i=0;i<50;i++)rows.push({
  year:2023,committeeName:'Other Committee',meetingDate:'2023-02-'+String(i%28+1).padStart(2,'0'),
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
