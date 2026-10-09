import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  VERSION,ORIGINS,CLIPS,safeOrigin,failClosedResponse,retrieveExactOrigin,
} from '../scripts/review-2021-sf958-targeted-clips.js';

test('scope is two original hash-pinned 2021 House SF958 public source recordings only',()=>{
  assert.equal(ORIGINS.length,2);
  assert.deepEqual(ORIGINS.map(x=>x.id),['SF0958050421','SF0958050621']);
  assert.deepEqual(ORIGINS.map(x=>x.meetingDate),['2021-05-04','2021-05-06']);
  for(const x of ORIGINS){
    assert.equal(x.url,'https://www.lrl.mn.gov/audio/house/2021/'+x.id+'.mp3');
    assert.equal(x.expectedSha256.length,64);
    assert.equal(safeOrigin(x.url,x.id),true);
    assert.ok(x.expectedBytes>50000000&&x.expectedBytes<100000000);
  }
});

test('the selected clips are small, fixed and based on official agenda timestamp neighborhoods',()=>{
  assert.equal(CLIPS.length,6);
  assert.equal(CLIPS.filter(x=>x.sourceId==='SF0958050421').length,5);
  assert.equal(CLIPS.filter(x=>x.sourceId==='SF0958050621').length,1);
  assert.equal(CLIPS.filter(x=>x.startSeconds===380).length,1);
  assert.equal(CLIPS.filter(x=>x.startSeconds===2200).length,1);
  assert.equal(CLIPS.filter(x=>x.startSeconds===3770).length,1);
  assert.ok(CLIPS.every(x=>x.durationSeconds<=210 && x.durationSeconds>=60));
  assert.ok(CLIPS.every(x=>ORIGINS.some(o=>o.id===x.sourceId)));
  assert.ok(CLIPS.reduce((sum,x)=>sum+x.durationSeconds,0)<=1080);
});

test('redirect, wrong host, query changes are prohibited',()=>{
  assert.equal(safeOrigin('https://example.com/audio/house/2021/SF0958050421.mp3','SF0958050421'),false);
  assert.equal(safeOrigin('http://www.lrl.mn.gov/audio/house/2021/SF0958050421.mp3','SF0958050421'),false);
  assert.equal(safeOrigin('https://www.lrl.mn.gov/audio/house/2021/SF0958050421.mp3?x=1','SF0958050421'),false);
  assert.equal(safeOrigin('https://www.lrl.mn.gov/audio/house/2021/SF0958050621.mp3','SF0958050421'),false);
});

test('source MIME/HTTP/size fail closed without touching audio content',()=>{
  const x=ORIGINS[0];
  assert.equal(failClosedResponse(new Response(null,{status:403}),x),'unexpected_http_status_403');
  assert.equal(failClosedResponse(new Response('error',{headers:{'content-type':'text/html'}}),x),'non_audio_mime');
  assert.equal(failClosedResponse(new Response('x',{headers:{'content-type':'audio/mpeg','content-length':'123'}}),x),'unexpected_original_size');
  assert.equal(failClosedResponse(new Response('x',{headers:{'content-type':'audio/mpeg'}}),x),null);
});

test('fake media cannot masquerade as hash-pinned originals',async()=>{
  const x=ORIGINS[0];
  const calls=[];
  const mock:typeof fetch=async (url,init)=>{
    calls.push({url,init});
    return new Response(Buffer.from('ID3fake short file'),{status:200,headers:{'content-type':'audio/mpeg'}});
  };
  const {mkdtempSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const tmp=mkdtempSync(join(tmpdir(),'vp-clips-test-'));
  try{
    await assert.rejects(retrieveExactOrigin(x,tmp,mock),/source_size_mismatch/);
    assert.equal(calls.length,1);
    assert.equal(String(calls[0].url),x.url);
    assert.equal(calls[0].init?.redirect,'error');
    assert.equal(calls[0].init?.credentials,'omit');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('command is offline by default and cannot make source requests',()=>{
  for(const args of [[],['--offline']]){
    const p=spawnSync(process.execPath,['--import','tsx','scripts/review-2021-sf958-targeted-clips.ts',...args],{
      encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH??'',NODE_ENV:'test'},
    });
    assert.equal(p.status,0,p.stderr);
    const d=JSON.parse(p.stdout);
    assert.equal(d.version,VERSION);
    assert.equal(d.publicRequests,0);
    assert.equal(d.newAcceptedRows,0);
  }
});

test('workflow only runs by its own new file path or manually, no production or schedules',()=>{
  const s=readFileSync('.github/workflows/historical-2021-sf958-targeted-excerpts.yml','utf8');
  assert.match(s,/^  push:\n    branches: \[main\]\n    paths:\n      - \.github\/workflows\/historical-2021-sf958-targeted-excerpts\.yml$/m);
  assert.match(s,/^  workflow_dispatch:/m);
  assert.match(s,/persist-credentials: false/);
  assert.match(s,/scripts\/review-2021-sf958-targeted-clips\.ts --extract/);
  assert.match(s,/python3 -m venv "\$RUNNER_TEMP\/one-time-asr"/);
  assert.match(s,/historical-2021-sf958-reviewed-clips-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_id \}\}/);
  assert.doesNotMatch(s,/^\s+(?:schedule|pull_request|workflow_run|issue_comment):/m);
  assert.doesNotMatch(s,/secrets\.|DATABASE_URL|NEON_API_KEY|VERCEL_TOKEN|vercel|psql|runPublicEvidenceRefresh|--connect|--create|deploy --prod|id-token: write/i);
});
