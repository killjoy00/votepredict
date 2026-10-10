import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyLrlMtgidHeadResponse,PINNED_ORIGINAL_MEDIA_YEAR,
  selectPinnedMtgidRecords,
} from '../src/evidence/senate-committee-138-mtgid-head-source.js';

test('all 138 original source-associated media/file mtgid URLs are independently pinned',()=>{
  assert.deepEqual(Object.values(PINNED_ORIGINAL_MEDIA_YEAR).map(x=>x.pages),[12,64,42,23]);
  assert.deepEqual(Object.values(PINNED_ORIGINAL_MEDIA_YEAR).map(x=>x.mediaRecords),[11,64,41,22]);
  assert.equal(Object.values(PINNED_ORIGINAL_MEDIA_YEAR).reduce((n,r)=>n+r.mediaRecords,0),138);
  for(const year of [2022,2023,2024,2025] as const){
    assert.match(PINNED_ORIGINAL_MEDIA_YEAR[year].jsonSha256,/^[a-f0-9]{64}$/);
    assert.throws(()=>selectPinnedMtgidRecords(year,'{}'),/href audit JSON SHA256 changed/);
    assert.throws(()=>selectPinnedMtgidRecords(year,'[]'),/href audit JSON SHA256 changed/);
  }
});

test('official LRL HEAD status is only availability metadata, never a video or vote certification',()=>{
  const original='https://www.lrl.mn.gov/media/file?mtgid=1045559';
  const ok=classifyLrlMtgidHeadResponse(original,200,null,'audio/mpeg','6000000');
  assert.equal(ok.discoveryCategory,'official_media_record_http_ok');
  assert.equal(ok.contentLengthBytes,6000000);
  assert.equal(ok.mediaPlaybackConfirmed,false);
  assert.equal(ok.recordedVoteConfirmed,false);
  const redirect=classifyLrlMtgidHeadResponse(original,302,
    'https://mnsenate.granicus.com/MediaPlayer.php?clip_id=55','text/html',null);
  assert.equal(redirect.discoveryCategory,'official_redirect_to_allowed_media_host');
  assert.equal(redirect.redirectHost,'mnsenate.granicus.com');
  assert.equal(redirect.mediaPlaybackConfirmed,false);
  const outsider=classifyLrlMtgidHeadResponse(original,302,
    'https://example.com/video','text/html','0');
  assert.equal(outsider.discoveryCategory,'redirect_not_verified');
  const notFound=classifyLrlMtgidHeadResponse(original,404,null,'text/html','0');
  assert.equal(notFound.discoveryCategory,'http_unavailable');
  assert.equal(notFound.recordedVoteConfirmed,false);
});

test('never probe unscoped or attacker-chosen source path',()=>{
  assert.throws(()=>classifyLrlMtgidHeadResponse(
    'https://example.com/media/file?mtgid=1045559',200,null,'text/html',null),
    /official LRL/);
  assert.throws(()=>classifyLrlMtgidHeadResponse(
    'https://www.lrl.mn.gov/media/search?mtgid=1045559',200,null,'text/html',null),
    /official LRL/);
});
