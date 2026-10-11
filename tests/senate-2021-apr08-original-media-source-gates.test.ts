import test from 'node:test';
import assert from 'node:assert/strict';
import {
 APR08_ORIGINAL_MEDIA,inspectApril08LrlMediaPage,
 inspectApril08OriginalAgenda,summarizeUntrustedOriginalCaption
} from '../src/evidence/senate-2021-apr08-original-media-source-gates.js';
import {APR12_THREE_STRICT_ORIGINAL} from
 '../src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.js';

function fictionalLrlPage(committee:string,date='04/08/2021'){
 return '<html><body><h1>'+committee+' (Senate)</h1><h2>'+date+
  '</h2><p>Historical Legislative Reference Library Senate media collection. '+
  'This is a wholly fictional test page with generic committee media only. '+
  'The presenter, time, event and audio text are not verified by this fixture.</p>'+
  '<audio controls><source src="fictional.mp3" type="audio/mpeg"></audio>'+
  '<video><source src="fictional.mp4"></video>'+
  '<a class="showcaptions" data-id="fictional-original.mp4" data-num="0">Show captions</a>'+
  '</body></html>';
}
function fictionalAgenda(committee:string,bill:string,date='Thursday, April 8th, 2021'){
 return '<html><body><h1>SENATE WEBCAST - '+date+'</h1><p>Thursday, April 8th, 2021 3 PM '+
  committee+'</p><p>S.F. '+bill+' Newman bill has an agenda item.</p>'+
  '<p>Fictional historical senate meeting agenda. The sole bill listed is a research lead, '+
  'and this page says nothing about any roll-call timing or named senator sides. '+
  'All facts herein are fixtures rather than historical originals.</p></body></html>';
}

test('two LRL 2021 media page targets carry correct date/committee and no verified motions',()=>{
 assert.equal(APR08_ORIGINAL_MEDIA.cases.length,2);
 assert.deepEqual(APR08_ORIGINAL_MEDIA.cases.map(x=>x.bill),['SF1159','SF970']);
 assert.deepEqual(APR08_ORIGINAL_MEDIA.cases.map(x=>x.sourceMovers),
  [['Dibble','McEwen'],['Pappas']]);
 let motions=0;
 for(const spec of APR08_ORIGINAL_MEDIA.cases){
  const info=inspectApril08LrlMediaPage(fictionalLrlPage(spec.committee),spec);
  motions+=info.distinctJournalReportedCommitteeAmendments;
  assert.equal(info.lrlPageCommitteeIdentityVerified,true);
  assert.equal(info.lrlPageMeetingDayVerified,true);
  assert.equal(info.lrlDateHeading,'04/08/2021');
  assert.equal(info.audioTagCount,1);
  assert.equal(info.videoTagCount,1);
  assert.equal(info.captionRequestCount,1);
  assert.equal(info.motionHeardOrTimestampVerified,false);
  assert.equal(info.independentOriginalMotionDate,null);
  assert.equal(info.historicalPublicBy,null);
 }
 assert.equal(motions,3);
 assert.equal(APR12_THREE_STRICT_ORIGINAL.journalReportDay,'2021-04-12');
});

test('wrong Senate committee or meeting day cannot be upgraded to media identity proof',()=>{
 for(const spec of APR08_ORIGINAL_MEDIA.cases){
  assert.throws(()=>inspectApril08LrlMediaPage(
   fictionalLrlPage('Unrelated Fictional Committee'),spec),/exact historical committee/);
  assert.throws(()=>inspectApril08LrlMediaPage(
   fictionalLrlPage(spec.committee,'04/12/2021'),spec),/meeting date/);
  assert.throws(()=>inspectApril08LrlMediaPage(
   '<html><body><h1>'+spec.committee+'</h1>04/08/2021</body></html>',spec),
   /bounded size/);
 }
});

test('three distinct Senate Granicus agendas are not motion-level authentication',()=>{
 let clips=0;
 for(const spec of APR08_ORIGINAL_MEDIA.cases){
  for(const clip of spec.agendas){
   const v=inspectApril08OriginalAgenda(
    fictionalAgenda(spec.committee,spec.bill.slice(2)),spec,clip);
   clips++;
   assert.equal(v.clipId,clip.clipId);
   assert.equal(v.exactOriginalAgendaDayCommitteeBillVerified,true);
   assert.equal(v.audioURLIsOnlyIndexLead,true);
   assert.equal(v.amendmentMotionHeard,false);
   assert.equal(v.independentMotionOccurredOn,null);
   assert.throws(()=>inspectApril08OriginalAgenda(
    fictionalAgenda('Different Fictional Committee',spec.bill.slice(2)),spec,clip),
    /wrong Senate committee/);
   assert.throws(()=>inspectApril08OriginalAgenda(
    fictionalAgenda(spec.committee,'9999'),spec,clip),/target bill/);
  }
 }
 assert.equal(clips,3);
 assert.deepEqual(APR08_ORIGINAL_MEDIA.cases.map(x=>x.agendas.map(c=>c.clipId)),
  [[6934],[6938,6939]]);
 assert.deepEqual(APR12_THREE_STRICT_ORIGINAL.motions.map(m=>m.mover),
  ['Dibble','McEwen','Pappas']);
});

test('automatic caption text never promotes a matched name/motion cue into vote/date',()=>{
 const fake='<table><tr><td data-time="1">Fictional Dibble amendment motion</td></tr>'+
 '<tr><td data-time="2">Fictional McEwen roll call</td></tr>'+
 '<tr><td data-time="3">Unrelated testimony only</td></tr></table>';
 const item=summarizeUntrustedOriginalCaption(fake,['Dibble','McEwen']);
 assert.equal(item.dataTimeCount,3);
 assert.equal(item.unverifiedSameRowMoverAndAmendmentOrRollCallCaptionCues,2);
 assert.equal(item.automaticCaptionIsNotVerifiedRecordingOrVote,true);
 assert.equal(item.captionTextOrNamedSidesNotPersisted,true);
 assert.equal(item.specificAmendmentDayProven,false);
 assert.throws(()=>summarizeUntrustedOriginalCaption('x'.repeat(5_000_001),[]),
  /source cap/);
});
