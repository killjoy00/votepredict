import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverSenateVideoRecordingPages,
  parseSenateMediaCommittees,
  parseSenateMediaRecordingPages,
  senateMediaCommitteeEndpoint,
  senateMediaFilesEndpoint,
} from '../src/evidence/minnesota-senate-media-source.js';

test('Senate media committee parser preserves machine IDs separately from labels', () => {
  const rows=parseSenateMediaCommittees(JSON.stringify([
    {ID:'26182-0-s',value:'Agriculture, Veterans, Broadband and Rural Development'},
    {ID:'26143-0-s',value:'Commerce and Consumer Protection'},
  ]));
  assert.deepEqual(rows,[
    {id:'26182-0-s',name:'Agriculture, Veterans, Broadband and Rural Development'},
    {id:'26143-0-s',name:'Commerce and Consumer Protection'},
  ]);
});

test('Senate media committee parser fails closed on malformed or empty official responses', () => {
  assert.throws(()=>parseSenateMediaCommittees('<option>not json</option>'),/not valid JSON/);
  assert.throws(()=>parseSenateMediaCommittees('[]'),/was empty/);
  assert.throws(
    ()=>parseSenateMediaCommittees(JSON.stringify([{ID:'Commerce and Consumer Protection',value:'Commerce'}])),
    /invalid ID or label/,
  );
});

test('Senate media endpoints use the verified full senate body value and machine committee ID', () => {
  assert.equal(
    senateMediaCommitteeEndpoint(2026),
    'https://www.lrl.mn.gov/media/media_functions?type=comm&sess=&body=senate&d1=&d2=&y=2026',
  );
  assert.equal(
    senateMediaFilesEndpoint({year:2026,committeeId:'26182-0-s'}),
    'https://www.lrl.mn.gov/media/media_functions?type=files&sess=&body=senate&comm=26182-0-s&d1=&d2=&y=2026&audio=n&video=y',
  );
  assert.throws(
    ()=>senateMediaFilesEndpoint({year:2026,committeeId:'Agriculture'}),
    /Invalid Senate media committee ID/,
  );
});

test('Senate media result parser extracts only official mtgid recording pages and deduplicates them', () => {
  const rows=parseSenateMediaRecordingPages({
    year:2026,
    committee:{id:'26182-0-s',name:'Agriculture, Veterans, Broadband and Rural Development'},
    sourceUrl:'https://www.lrl.mn.gov/media/media_functions?type=files',
    html:[
      '<table>',
      '<tr><td><a href="file.aspx?mtgid=1047001">Video</a></td></tr>',
      '<tr><td><a href="/media/file?mtgid=1047002&amp;foo=bar">Video</a></td></tr>',
      '<tr><td><a href="file.aspx?mtgid=1047001">Duplicate</a></td></tr>',
      '<tr><td><a href="https://example.com/media/file.aspx?mtgid=9">External</a></td></tr>',
      '<tr><td><a href="file.aspx?mtgid=bad">Malformed</a></td></tr>',
      '</table>',
    ].join(''),
  });
  assert.deepEqual(rows.map(row=>[row.mtgid,row.url]),[
    ['1047001','https://www.lrl.mn.gov/media/file.aspx?mtgid=1047001'],
    ['1047002','https://www.lrl.mn.gov/media/file?mtgid=1047002&foo=bar'],
  ]);
});

test('Senate media discovery uses returned machine IDs and deduplicates recordings across event rows', async () => {
  const seenUrls:string[]=[];
  const fetchImpl:typeof fetch=async (input)=>{
    const url=String(input);
    seenUrls.push(url);
    const parsed=new URL(url);
    if(parsed.searchParams.get('type')==='comm'){
      assert.equal(parsed.searchParams.get('body'),'senate');
      return new Response(JSON.stringify([
        {ID:'26182-0-s',value:'Committee One'},
        {ID:'26183-0-s',value:'Senate Floor Session'},
      ]),{status:200});
    }
    const comm=parsed.searchParams.get('comm');
    assert.ok(comm==='26182-0-s'||comm==='26183-0-s');
    const html=comm==='26182-0-s'
      ? '<a href="file.aspx?mtgid=1047001">One</a><a href="file.aspx?mtgid=1047002">Two</a>'
      : '<a href="file.aspx?mtgid=1047002">Two duplicate</a><a href="file.aspx?mtgid=1047003">Three</a>';
    return new Response(html,{status:200});
  };

  const result=await discoverSenateVideoRecordingPages({year:2026,fetchImpl});
  assert.deepEqual(result.committees,[
    {id:'26182-0-s',name:'Committee One'},
    {id:'26183-0-s',name:'Senate Floor Session'},
  ]);
  assert.deepEqual(result.recordings.map(row=>row.mtgid),['1047001','1047002','1047003']);
  assert.equal(seenUrls.length,3);
  assert.ok(seenUrls.slice(1).every(url=>new URL(url).searchParams.get('body')==='senate'));
});
