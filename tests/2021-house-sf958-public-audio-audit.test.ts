import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  SOURCE_LEADS, HOUSE_AUDIO_PROBE_VERSION, auditHouseSf958Sources,
  probeHouseSf958Lead,
} from '../scripts/probe-2021-house-sf958-public-audio.js';

const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(1400, 0x22)]);
const decode = () => ({ format: 'mp3', durationSeconds: 60 });

test('only four exact publicly indexed 2021 House SF958 MP3 URLs are allowed', () => {
  assert.deepEqual(SOURCE_LEADS.map(x => x.id),
    ['SF0958050421', 'SF0958050621', 'SF0958051321', 'SF0958051521']);
  assert.deepEqual(SOURCE_LEADS.map(x => x.date),
    ['2021-05-04','2021-05-06','2021-05-13','2021-05-15']);
  assert.equal(SOURCE_LEADS.filter(x => x.retainShortAudio).length, 2);
  for (const lead of SOURCE_LEADS) {
    assert.equal(lead.url, 'https://www.lrl.mn.gov/audio/house/2021/' + lead.id + '.mp3');
    assert.ok(lead.maxBytes <= 100 * 1024 * 1024);
  }
});

test('complete decoded audio yields source SHA only, never directional evidence', async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const mock: typeof fetch = async (url, init) => {
    calls.push({url: String(url),init});
    return new Response(mp3, {status:200,headers:{
      'content-type':'audio/mpeg','content-length':String(mp3.length),
    }});
  };
  const result = await probeHouseSf958Lead(SOURCE_LEADS[2],mock,decode);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,SOURCE_LEADS[2].url);
  assert.equal(calls[0].init?.method,'GET');
  assert.equal(calls[0].init?.redirect,'error');
  assert.equal(calls[0].init?.credentials,'omit');
  assert.equal((calls[0].init?.headers as Record<string,string>).Accept.startsWith('audio/mpeg'),true);
  assert.equal(result.status,'verified_decodable_full_audio');
  assert.equal(result.bytesRead,mp3.length);
  assert.equal(result.fullAudioSha256,createHash('sha256').update(mp3).digest('hex'));
  assert.equal(result.audioFormat,'mp3');
  assert.equal(result.historicalPublicAvailabilityBeforeVoteProven,false);
  assert.equal(result.exactMemberBillDirectionVerified,false);
  assert.equal(result.eligibleDirectionalRowsAdded,0);
  assert.equal(result.savedShortAudio,false);
});

test('403 and DNS failures remain distinct from a removed or non-existent recording', async () => {
  const denied: typeof fetch=async()=>new Response('no',{status:403,headers:{'content-type':'text/html'}});
  const d=await probeHouseSf958Lead(SOURCE_LEADS[0],denied,decode);
  assert.equal(d.status,'http_denied');
  assert.equal(d.httpStatus,403);
  assert.equal(d.fullAudioSha256,null);
  const dns: typeof fetch=async()=>{throw {cause:{code:'ENOTFOUND'}};};
  const e=await probeHouseSf958Lead(SOURCE_LEADS[0],dns,decode);
  assert.equal(e.status,'network_failure');
  assert.equal(e.transportFailureCode,'ENOTFOUND');
});

test('HTML, empty audio, partial content, and undecodable fake MP3 cannot be verified', async () => {
  const html:typeof fetch=async()=>new Response('<html>denied</html>',{status:200,headers:{'content-type':'text/html'}});
  const h=await probeHouseSf958Lead(SOURCE_LEADS[0],html,decode);
  assert.equal(h.status,'non_audio');
  const partial:typeof fetch=async()=>new Response(mp3,{status:206,headers:{'content-type':'audio/mpeg'}});
  assert.equal((await probeHouseSf958Lead(SOURCE_LEADS[0],partial,decode)).status,'unexpected_partial_or_redirect');
  const short:typeof fetch=async()=>new Response(Buffer.from('ID3'),{status:200,headers:{'content-type':'audio/mpeg'}});
  assert.equal((await probeHouseSf958Lead(SOURCE_LEADS[0],short,decode)).status,'non_audio');
  const undecode:typeof fetch=async()=>new Response(mp3,{status:200,headers:{'content-type':'audio/mpeg'}});
  assert.equal((await probeHouseSf958Lead(SOURCE_LEADS[0],undecode,()=>null)).status,'undecodable_audio');
});

test('declared oversize and conflicting transfer length fail closed', async () => {
  const huge:typeof fetch=async()=>new Response(mp3,{status:200,headers:{
    'content-type':'audio/mpeg','content-length':String(105*1024*1024),
  }});
  const h=await probeHouseSf958Lead(SOURCE_LEADS[0],huge,decode);
  assert.equal(h.status,'size_limit');
  assert.equal(h.bytesRead,0);
  const tiny:typeof fetch=async()=>new Response(mp3,{status:200,headers:{
    'content-type':'audio/mpeg','content-length':String(mp3.length+1),
  }});
  const t=await probeHouseSf958Lead(SOURCE_LEADS[0],tiny,decode);
  assert.equal(t.status,'incomplete_download');
  assert.equal(t.fullAudioSha256,null);
});

test('the entire audit uses four precise URLs once each, sequentially', async () => {
  const seen:string[]=[];
  const mock:typeof fetch=async url=>{
    seen.push(String(url));
    return new Response(mp3,{status:200,headers:{'content-type':'audio/mpeg'}});
  };
  const out=await auditHouseSf958Sources(mock,decode);
  assert.equal(out.schemaVersion,HOUSE_AUDIO_PROBE_VERSION);
  assert.deepEqual(seen,SOURCE_LEADS.map(x=>x.url));
  assert.equal(out.completeDecodableRecordings,4);
  assert.equal(out.newDirectionalRows,0);
  assert.equal(out.historicallyEligiblePreVoteMemberStatements,0);
});

test('CLI defaults to offline without touching media, DB or credentials', () => {
  for (const args of [[], ['--offline']]) {
    const p=spawnSync(process.execPath,['--import','tsx',
      'scripts/probe-2021-house-sf958-public-audio.ts',...args],
    {encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH??'',NODE_ENV:'test'}});
    assert.equal(p.status,0,p.stderr);
    assert.equal(JSON.parse(p.stdout).publicRequests,0);
    assert.equal(JSON.parse(p.stdout).directionalRowsAdded,0);
  }
});

test('public-source workflow is one-time path-filtered, credential-free and nonserving', () => {
  const src=readFileSync('.github/workflows/historical-2021-house-sf958-audio-audit.yml','utf8');
  assert.match(src,/^  push:\n    branches: \[main\]\n    paths:\n      - \.github\/workflows\/historical-2021-house-sf958-audio-audit\.yml$/m);
  assert.match(src,/^  workflow_dispatch:/m);
  assert.match(src,/persist-credentials: false/);
  assert.match(src,/scripts\/probe-2021-house-sf958-public-audio\.ts --probe/);
  assert.doesNotMatch(src,/^\s+(?:schedule|pull_request|workflow_run|issue_comment):/m);
  assert.doesNotMatch(src,/secrets\.|DATABASE_URL|NEON_API_KEY|VERCEL_TOKEN|vercel|psql|runPublicEvidenceRefresh|--connect|--create|deploy --prod|id-token: write/i);
});
