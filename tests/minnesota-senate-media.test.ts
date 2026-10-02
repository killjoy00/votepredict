import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSenateCaptionSourceCandidates } from '../src/evidence/minnesota-senate-media.js';

test('caption source probe finds track and caption endpoint candidates', () => {
  const rows=extractSenateCaptionSourceCandidates(
    [
      '<video><track kind="captions" src="/media/captions/meeting-1.vtt"></video>',
      '<a data-caption-url="/media/caption?file=123">Show captions in separate window</a>',
      '<script>window.open("/media/subtitles?id=456")</script>',
    ].join('\n'),
    'https://www.lrl.mn.gov/media/file?mtgid=1',
  );
  assert.ok(rows.some(row=>row.kind==='track'&&row.value==='https://www.lrl.mn.gov/media/captions/meeting-1.vtt'));
  assert.ok(rows.some(row=>row.value==='https://www.lrl.mn.gov/media/caption?file=123'));
  assert.ok(rows.some(row=>row.value==='https://www.lrl.mn.gov/media/subtitles?id=456'));
});

test('caption source probe ignores unrelated media assets', () => {
  const rows=extractSenateCaptionSourceCandidates(
    '<video src="/media/video.mp4"></video><a href="/minutes/">Minutes</a>',
    'https://www.lrl.mn.gov/media/file?mtgid=1',
  );
  assert.deepEqual(rows,[]);
});
