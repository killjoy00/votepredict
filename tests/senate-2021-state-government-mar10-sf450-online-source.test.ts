import assert from 'node:assert/strict';
import test from 'node:test';
import {
 MAR10_2021_SF450_SOURCE,inspectSynthetic2021Mar10SF450OnlineHtml,
 inspectSenate2021Mar10SF450OnlineHtml
} from '../src/evidence/senate-2021-state-government-mar10-sf450-online-source.js';

const FAKE=['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel'] as const;
function fixture(){
 return '<html><head><title>Senate Minutes</title></head><body>'+
  '<h1>State Government Finance and Policy and Elections Committee</h1>'+
  '<p>Wednesday, March 10, 2021</p><div>'+('Archived online committee meeting. ').repeat(48)+'</div>'+
  '<h2>S.F. 450: Senator Mathews: bill and committee context.</h2>'+
  '<p>Senator Mathews presented SF 450. Senator Osmek moved that SF 450 be recommended to pass and be rereferred to the Finance Committee.</p>'+
  '<p>Senator Carlson requested a roll call vote.</p>'+
  '<div>Yay votes: Alpha, Bravo, Charlie, Delta, Echo</div>'+
  '<div>Nay votes: Foxtrot, Golf, Hotel</div>'+
  '<p>On a vote of 5 yays and 3 nays the motion prevailed.</p>'+
  '<p>Senator Rosen presented SF 1564.</p>'+
  '<p>Senator Osmek moved that S.F. 450, be recommended to pass and re-referred to the Finance Committee. - MOTION PREVAILED.</p>'+
  '<h2>S.F. 1564: Senator Rosen: another bill</h2>'+
  '<p>'+('Other hearing activity not part of the SF450 recorded roll. ').repeat(20)+'</p>'+
  '</body></html>';
}
const inspect=(s=fixture())=>inspectSynthetic2021Mar10SF450OnlineHtml(s,[...FAKE]);
test('2021 real Senate online page is NOT equivalent to 2021 original printed official record',()=>{
 assert.equal(MAR10_2021_SF450_SOURCE.hearingDate,'2021-03-10');
 assert.equal(MAR10_2021_SF450_SOURCE.originalSenateHearingId,16146);
 assert.equal(MAR10_2021_SF450_SOURCE.committee,
  'State Government Finance and Policy and Elections');
 assert.equal(MAR10_2021_SF450_SOURCE.originalOnlineMinutesURL,
  'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=16146&ls=92&type=minutes');
 assert.equal(MAR10_2021_SF450_SOURCE.senate2021PrintOriginalCompared,false);
 assert.equal(MAR10_2021_SF450_SOURCE.onlineMinutesNotEquivalentToOriginal2021PrintedOfficialMinutes,true);
});
test('single named roll 5/3 has eight exact fictional members, duplicate recap is not second vote',()=>{
 const r=inspect();
 assert.deepEqual([r.bill,r.originalIntroducedMotionMover,r.originalRequestForRollBy],
  ['SF450','Osmek','Carlson']);
 assert.equal(r.onlineOriginalNamedYeaCount,5);
 assert.equal(r.onlineOriginalNamedNayCount,3);
 assert.equal(r.onlineOriginalNamedAbsentCountPrinted,null);
 assert.equal(r.originalRollResult,'motion prevailed');
 assert.equal(r.exactOriginalRollParagraphCount,1);
 assert.equal(r.recapPrintedCount,1);
 assert.equal(r.duplicatePostRollRecapNotIndependentNamedVote,true);
 assert.ok(r.originalResultEndTextOffset>r.originalMotionStartTextOffset);
 assert.equal(r.onlineFullEightMemberNamedYeaNayPartition,true);
 assert.deepEqual(Object.values(r.namedMemberChoiceIdentitySHA256Only).map(x=>x.length),[5,3,0]);
 assert.ok(r.namedMemberChoiceIdentitySHA256Only.yea.every(h=>/^[a-f0-9]{64}$/.test(h)));
 assert.equal(r.printOriginalCrosscheckCompleted,false);
 assert.equal(r.historicalFullOfficialVoteCertification,false);
 assert.equal(r.sourceToPrivateMemberVoteParityVerified,false);
 assert.equal(r.noNewStatewide2021To2025DenominatorIncrement,true);
 assert.equal(r.noAutomaticIndividualVoteImport,true);
});
test('the actual source-only inspector rejects fabricated fixtures or changed real sides',()=>{
 assert.throws(()=>inspectSenate2021Mar10SF450OnlineHtml(fixture()),
  /do not exactly partition eight senators/);
});
test('reject second named roll cue rather than confuse recap with a second source roll',()=>{
 const f=fixture().replace('Senator Rosen presented SF 1564.',
  'Senator Carlson requested a roll call vote. Yay votes: Alpha, Bravo, Charlie, Delta, Echo Nay votes: Foxtrot, Golf, Hotel On a vote of 5 yays and 3 nays the motion prevailed. Senator Rosen presented SF 1564.');
 assert.throws(()=>inspect(f),/not uniquely isolated/);
});
test('reject altered absent, duplicate fake side, no motion, no true roll, changed tally',()=>{
 for(const change of [
  (s:string)=>s.replace('Yay votes: Alpha, Bravo','Yay votes: Alpha, Alpha'),
  (s:string)=>s.replace('Nay votes: Foxtrot, Golf, Hotel','Nay votes: Foxtrot, Golf'),
  (s:string)=>s.replace('5 yays and 3 nays','4 yays and 4 nays'),
  (s:string)=>s.replace('Senator Osmek moved that SF 450','Senator Pratt moved that SF 450'),
  (s:string)=>s.replace('Senator Carlson requested a roll call','Senator Carlson described a roll call'),
  (s:string)=>s.replace('March 10, 2021','March 11, 2021'),
  (s:string)=>s.replace('Committee</h1>','Caucus</h1>')
 ])assert.throws(()=>inspect(change(fixture())));
});
test('invalid fake roster with real Senator or duplicated name cannot seed certification',()=>{
 assert.throws(()=>inspectSynthetic2021Mar10SF450OnlineHtml(fixture(),
  ['Kiffmeyer',...FAKE.slice(1)]),/fully fictional/);
 assert.throws(()=>inspectSynthetic2021Mar10SF450OnlineHtml(fixture(),
  ['Alpha','Alpha',...FAKE.slice(2)]),/fully fictional/);
});
test('voice votes on other 2021 bills not transformed into 5/3 side votes',()=>{
 const f=fixture().replace('<h2>S.F. 1564: Senator Rosen: another bill</h2>',
  '<h2>S.F. 1564: Senator Rosen: another bill</h2><p>Motion prevailed on a voice vote.</p>');
 // An additional voice motion outside SF450 boundary is irrelevant.
 assert.equal(inspect(f).exactOriginalRollParagraphCount,1);
});
