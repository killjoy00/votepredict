import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  MISSING_MEDIA_EXPECTED,MISSING_MEDIA_PRIOR_RUN,
  loadPinnedDatedMissingMediaYear,
  inspectPinnedDateMediaAnchors,
  type PriorMeetingSourceRow,
} from '../src/evidence/senate-committee-dated-media-link-proof.js';

const sha=(x:string)=>createHash('sha256').update(x).digest('hex');

test('141 exactly dated source pages and 138 alternate media links remain unverified, not vote counts',()=>{
  assert.deepEqual(MISSING_MEDIA_EXPECTED,{
    2022:{pages:12,mediaPages:11},2023:{pages:64,mediaPages:64},
    2024:{pages:42,mediaPages:41},2025:{pages:23,mediaPages:22},
  });
  assert.equal(MISSING_MEDIA_PRIOR_RUN,38076153790);
  assert.equal(Object.values(MISSING_MEDIA_EXPECTED).reduce((n,v)=>n+v.pages,0),141);
  assert.equal(Object.values(MISSING_MEDIA_EXPECTED).reduce((n,v)=>n+v.mediaPages,0),138);
  for(const y of [2022,2023,2024,2025] as const){
    assert.throws(()=>loadPinnedDatedMissingMediaYear(y,'{}'),/digest did not match/);
  }
});

test('meeting section rejects generic media elsewhere on page and detects only exact prior media href',()=>{
  const video='https://mnsenate.granicus.com/MediaPlayer.php?view_id=1&clip_id=55';
  const html='<html><nav><a href="https://example.com/video">Other Video</a></nav>'+
    '<h2>3/4/2023</h2><a href="'+video+'">Watch video</a>'+
    '<h2>3/5/2023</h2><a href="https://elsewhere.test/video">Wrong meeting video</a></html>';
  const section='<a href="'+video+'">Watch video</a>';
  const row:PriorMeetingSourceRow={
    year:2023,meetingDate:'2023-03-04',committeeName:'Taxes',
    canonicalOfficialMeetingPage:'https://www.lrl.mn.gov/minutes/comm?commid=11-0&year=2023&body=senate&date=3%2F4%2F2023',
    datePageHtmlSha256:sha(html),
    flags:{datedMeetingSectionHtmlSha256:sha(section),exactDatedMeetingSectionVerified:true,
      mediaAnchorCandidates:1},
    candidateLinkSha256:{media:[sha(video)]},
  };
  const x=inspectPinnedDateMediaAnchors(row,html,row.canonicalOfficialMeetingPage);
  assert.equal(x.anchors.length,1);
  assert.equal(x.anchors[0]?.href,video);
  assert.equal(x.anchors[0]?.category,'likely_specific_media_clip');
  assert.equal(x.anchors[0]?.recordingVerified,false);
  assert.equal(x.anchors[0]?.namedVoteVerified,false);
  assert.throws(()=>inspectPinnedDateMediaAnchors(row,html.replace('clip_id=55','clip_id=56'),
    row.canonicalOfficialMeetingPage),/source page changed/);
});

test('current original HTML SHA is required; a matching link on a different page is not acceptable',()=>{
  const h='<html><h2>3/4/2023</h2><a href="/media/">Watch video</a><h2>3/5/2023</h2></html>';
  const r:PriorMeetingSourceRow={
    year:2023,meetingDate:'2023-03-04',committeeName:'Taxes',
    canonicalOfficialMeetingPage:'https://www.lrl.mn.gov/minutes/comm?commid=11-0&year=2023&body=senate&date=3%2F4%2F2023',
    datePageHtmlSha256:sha(h),
    flags:{datedMeetingSectionHtmlSha256:sha('<a href="/media/">Watch video</a>'),
      exactDatedMeetingSectionVerified:true,mediaAnchorCandidates:1},
    candidateLinkSha256:{media:[sha('https://www.lrl.mn.gov/media/')]},
  };
  const x=inspectPinnedDateMediaAnchors(r,h,r.canonicalOfficialMeetingPage);
  assert.equal(x.anchors[0]?.category,'archive_or_publisher_landing');
  assert.equal(x.anchors[0]?.recordingVerified,false);
  assert.throws(()=>inspectPinnedDateMediaAnchors(r,h,r.canonicalOfficialMeetingPage+'#wrong'),
    /canonical official page/);
});
