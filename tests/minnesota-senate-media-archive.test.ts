import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSenateMediaEventsJson,
  parseSenateMediaFilesHtml,
  senateMediaEventsUrl,
  senateMediaFilesUrl,
} from '../src/evidence/minnesota-senate-media-archive.js';

test('Senate media event parser accepts verified LRL ID/value rows',()=>{
  const rows=parseSenateMediaEventsJson(JSON.stringify([
    {ID:'23823-0-s',value:'Aging and Long-Term Care Policy'},
    {ID:'26138-0-s',value:'Capitol &amp; Report'},
    {ID:'not-senate',value:'Ignore'},
    {ID:'23823-0-s',value:'Duplicate'},
  ]));
  assert.deepEqual(rows,[
    {id:'23823-0-s',name:'Aging and Long-Term Care Policy'},
    {id:'26138-0-s',name:'Capitol & Report'},
  ]);
});

test('Senate media URL builders use verified body and machine event IDs',()=>{
  const events=new URL(senateMediaEventsUrl(2025));
  assert.equal(events.searchParams.get('type'),'comm');
  assert.equal(events.searchParams.get('body'),'senate');
  assert.equal(events.searchParams.get('y'),'2025');

  const files=new URL(senateMediaFilesUrl(2025,'26182-0-s'));
  assert.equal(files.searchParams.get('type'),'files');
  assert.equal(files.searchParams.get('body'),'senate');
  assert.equal(files.searchParams.get('comm'),'26182-0-s');
  assert.equal(files.searchParams.get('audio'),'n');
  assert.equal(files.searchParams.get('video'),'y');
});

test('Senate media files parser extracts and deduplicates official mtgid pages',()=>{
  const rows=parseSenateMediaFilesHtml({
    year:2021,
    event:{id:'23823-0-s',name:'Aging and Long-Term Care Policy'},
    html:[
      '<table>',
      '<tr><td><a href="/media/file.aspx?mtgid=1012066">Video</a></td></tr>',
      '<tr><td><a href="https://www.lrl.mn.gov/media/file?mtgid=1012114&amp;x=1">Video</a></td></tr>',
      '<tr><td><a href="/media/file.aspx?mtgid=1012066">Duplicate</a></td></tr>',
      '<tr><td><a href="https://example.com/media/file.aspx?mtgid=999">Offsite</a></td></tr>',
      '</table>',
    ].join(''),
  });
  assert.deepEqual(rows,[
    {
      year:2021,eventId:'23823-0-s',eventName:'Aging and Long-Term Care Policy',
      mtgid:'1012066',url:'https://www.lrl.mn.gov/media/file.aspx?mtgid=1012066',
    },
    {
      year:2021,eventId:'23823-0-s',eventName:'Aging and Long-Term Care Policy',
      mtgid:'1012114',url:'https://www.lrl.mn.gov/media/file.aspx?mtgid=1012114',
    },
  ]);
});
