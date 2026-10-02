import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSenateCaptionRequests,
  extractSenateCaptionRows,
  extractSenateCaptionSourceCandidates,
  summarizeSenateCaptionPayload,
} from '../src/evidence/minnesota-senate-media.js';

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

test('caption request extractor reproduces the official showcaptions endpoint contract', () => {
  const rows=extractSenateCaptionRequests(
    [
      "<span class='btn showcaptions mt-1' data-id='cmte_fin_050426.mp4' data-num='1'>Show captions</span>",
      "<span data-num='2' data-id='cmte_fin_050426a.mp4' class='showcaptions'>Show captions</span>",
      "<span class='showcaptions' data-id='not-video.txt' data-num='3'>Ignore</span>",
    ].join('\n'),
    'https://www.lrl.mn.gov/media/file?body=s&cid=1007&date=05%2F04%2F2026',
  );
  assert.deepEqual(rows,[
    {
      mp4:'cmte_fin_050426.mp4',
      videoIndex:1,
      endpointUrl:'https://www.lrl.mn.gov/media/media_functions?type=getCaption&captionid=&strmp4=cmte_fin_050426.mp4',
    },
    {
      mp4:'cmte_fin_050426a.mp4',
      videoIndex:2,
      endpointUrl:'https://www.lrl.mn.gov/media/media_functions?type=getCaption&captionid=&strmp4=cmte_fin_050426a.mp4',
    },
  ]);
});

test('caption payload summary records timing structure without logging transcript text', () => {
  const summary=summarizeSenateCaptionPayload([
    '<table>',
    '<tr><td><a data-time="00:00:12.340">jump</a></td><td>Hello &amp; welcome.</td></tr>',
    '<tr><td><a data-time="00:00:18.000">jump</a></td><td>Second caption.</td></tr>',
    '</table>',
  ].join(''));
  assert.equal(summary.dataTimeCount,2);
  assert.equal(summary.tableRowCount,2);
  assert.equal(summary.tableCellCount,4);
  assert.deepEqual(summary.firstDataTimeValues,['00:00:12.340','00:00:18.000']);
  assert.ok(summary.textChars>0);
  assert.ok(!('captionText' in summary));
});


test('caption row parser preserves official timestamps and explicit Senator labels', () => {
  const rows=extractSenateCaptionRows([
    '<table>',
    '<tr><th>Time</th><th>Caption</th></tr>',
    '<tr><td><a data-time="4">00:04</a></td><td>&gt;&gt; SENATOR MURPHY: Thank you, Madam Chair.</td></tr>',
    '<tr><td><a data-time="5.5">00:05</a></td><td>We will proceed to the next item.</td></tr>',
    '</table>',
  ].join(''));
  assert.deepEqual(rows,[
    {
      rawTime:'4',
      startSeconds:4,
      text:'>> SENATOR MURPHY: Thank you, Madam Chair.',
      explicitSpeaker:'MURPHY',
      utteranceText:'Thank you, Madam Chair.',
    },
    {
      rawTime:'5.5',
      startSeconds:5.5,
      text:'We will proceed to the next item.',
      utteranceText:'We will proceed to the next item.',
    },
  ]);
});

test('caption row parser supports clock timestamps and explicit chair labels', () => {
  const rows=extractSenateCaptionRows(
    '<tr><td><a data-time="00:01:12.250">jump</a></td><td>CHAIR WIKLUND: Members, the bill is before us.</td></tr>',
  );
  assert.equal(rows.length,1);
  assert.equal(rows[0].startSeconds,72.25);
  assert.equal(rows[0].explicitSpeaker,'WIKLUND');
  assert.equal(rows[0].utteranceText,'Members, the bill is before us.');
});

test('caption row parser does not infer speakers from unlabeled names or malformed rows', () => {
  const rows=extractSenateCaptionRows([
    '<tr><td><a data-time="18">jump</a></td><td>Murphy: this label lacks an explicit Senate role.</td></tr>',
    '<tr><td><a data-time="bad">jump</a></td><td>SENATOR MURPHY: invalid time.</td></tr>',
    '<tr><td>No timestamp</td><td>SENATOR MURPHY: ignored.</td></tr>',
  ].join(''));
  assert.equal(rows.length,1);
  assert.equal(rows[0].explicitSpeaker,undefined);
  assert.equal(rows[0].utteranceText,'Murphy: this label lacks an explicit Senate role.');
});
