import test from 'node:test';
import assert from 'node:assert/strict';
import {
 APR08_LRL_ORIGINAL_PLAYER_SOURCES as original,
 inspectApril08PlayerHTML,
 examinePinnedApril08LrlOriginalPlayerHTML
} from '../../src/evidence/senate-2021-apr08-lrl-original-media-player-sources.js';
import {APR08_ORIGINAL_MEDIA} from
 '../../src/evidence/senate-2021-apr08-original-media-source-gates.js';

function fictionalOriginalPage(spec:(typeof APR08_ORIGINAL_MEDIA.cases)[number]){
 const isJud=spec.bill==='SF970';
 const audio=isJud?3:1,video=isJud?2:1;
 const sounds=Array.from({length:audio},(_,i)=>
  '<audio controls><source src="/media/audio/2021/fictional_'+i+'.mp3" type="audio/mpeg"></audio>'
 ).join('');
 const images=Array.from({length:video},(_,i)=>
  '<video controls><source src="https://www.lrl.mn.gov/media/video/2021/fictional_'+i+
  '.mp4" type="video/mp4"></video>'
 ).join('');
 return '<html><head><title>Fictional April 2021 Senate hearing media</title></head>'+
  '<body><h1>'+spec.committee+' (Senate)</h1><h2>04/08/2021</h2>'+
  '<p>Fictional archived media page. All identities, links and times here are test data, '+
  'not a historical source. No named votes or actual speakers are asserted.</p>'+
  sounds+images+
  '<iframe src="https://outside.example.com/senate/2021/archived_fictional.mp4"></iframe>'+
  '</body></html>';
}

test('real first original 2021 LRL dated page byte+SHA pins are immutable',()=>{
 assert.deepEqual(original.cases.map(x=>x.bill),['SF1159','SF970']);
 assert.deepEqual(original.cases.map(x=>x.exactOriginalHTMLBytes),[89044,96070]);
 assert.deepEqual(original.cases.map(x=>x.exactOriginalHTMLSHA256),[
  'a204640dcc0ea751fc867ae673492302a48b3dac4c0747475fab1c1ecc2291ce',
  '98d4a9be8e08963121f332dcda6fbc602a07dc4a237b633011fc40a1ca2a4194'
 ]);
 assert.equal(original.originalSourceRun,38177903789);
 for(const spec of APR08_ORIGINAL_MEDIA.cases){
  assert.throws(()=>examinePinnedApril08LrlOriginalPlayerHTML(
   Buffer.from(fictionalOriginalPage(spec)),spec.bill),/source byte count mismatch/);
  const actual=original.cases.find(x=>x.bill===spec.bill)!;
  assert.throws(()=>examinePinnedApril08LrlOriginalPlayerHTML(
   Buffer.alloc(actual.exactOriginalHTMLBytes,0x41),spec.bill),/source SHA-256 mismatch/);
 }
});

test('fictional official LRL audio/video srcs are only media-access leads and do not authenticate motion times',()=>{
 for(const spec of APR08_ORIGINAL_MEDIA.cases){
  const parsed=inspectApril08PlayerHTML(fictionalOriginalPage(spec),spec);
  const aud=spec.bill==='SF970'?3:1,vid=spec.bill==='SF970'?2:1;
  assert.equal(parsed.originalSourceContainsAudioMediaTags,aud);
  assert.equal(parsed.originalSourceContainsVideoMediaTags,vid);
  assert.equal(parsed.originalSourceIframeTags,1);
  assert.equal(parsed.indexedHearingDate,'04/08/2021');
  assert.equal(parsed.totalEmbeddedMediaSourceLeads,aud+vid+1);
  const approved=parsed.embeddedPlayerMediaSourceLeads.filter(
   x=>x.origin==='official_lrl_host');
  assert.equal(approved.length,aud+vid);
  assert.equal(parsed.embeddedPlayerMediaSourceLeads.filter(
   x=>x.origin==='other_public_host').length,1);
  for(const item of parsed.embeddedPlayerMediaSourceLeads){
   assert.equal(item.urlForExactOfficialPrefixProbe===null,
    item.origin!=='official_lrl_host');
   assert.match(item.pathSHA256,/^[a-f0-9]{64}$/);
   assert.match(item.originalReferenceSHA256,/^[a-f0-9]{64}$/);
  }
  assert.equal(parsed.completeOriginalRecordingAuthenticated,false);
  assert.equal(parsed.spokenAmendmentOrMemberVotesVerified,false);
  assert.equal(parsed.originalJournalAmendmentDayVerified,null);
  assert.equal(parsed.historicalFirstPublishedBy,null);
 }
});

test('media page committee and exact date cannot be swapped to unrelated content',()=>{
 for(const spec of APR08_ORIGINAL_MEDIA.cases){
  assert.throws(()=>inspectApril08PlayerHTML(
   fictionalOriginalPage(spec).replace(spec.committee,'Imaginary Nonmatching Committee'),
   spec),/exact historical committee/);
  assert.throws(()=>inspectApril08PlayerHTML(
   fictionalOriginalPage(spec).replace('04\/08\/2021','04\/12\/2021'),spec),
   /meeting date/);
 }
});
