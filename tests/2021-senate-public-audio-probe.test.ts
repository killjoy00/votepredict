import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  AUDIO_PROBE_VERSION,
  MAX_SAMPLE_BYTES,
  SOURCE_LEADS,
  auditSenateAudioPublicLeads,
  probeSenateAudioLead,
} from '../scripts/probe-2021-senate-public-audio.js';

const first = SOURCE_LEADS[0];
const mp3Bytes = Buffer.concat([
  Buffer.from('ID3', 'ascii'),
  Buffer.alloc(1600, 0x19),
]);

test('source scope is exactly three historically indexed public Granicus MP3 leads', () => {
  assert.equal(SOURCE_LEADS.length, 3);
  assert.deepEqual(SOURCE_LEADS.map(x => x.agendaClipId), ['6032','6960','7022']);
  assert.deepEqual(SOURCE_LEADS.map(x => x.meetingDate),
    ['2021-02-04','2021-04-13','2021-04-21']);
  for (const lead of SOURCE_LEADS) {
    const url = new URL(lead.candidateUrl);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'archive-video.granicus.com');
    assert.match(url.pathname, /^\/mnsenate\/mnsenate_[a-z0-9-]+\.mp3$/);
    assert.equal(url.search, '');
  }
});

test('a genuine partial MP3 signature produces only a prefix proof, not a statement or recording', async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const mock: typeof fetch = async (url, init) => {
    calls.push({url: String(url), init});
    return new Response(mp3Bytes, {
      status:206,
      headers:{
        'content-type':'audio/mpeg',
        'content-length': String(mp3Bytes.length),
        'content-range':'bytes 0-1602/25000000',
      },
    });
  };
  const r=await probeSenateAudioLead(first,mock);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,first.candidateUrl);
  assert.equal(calls[0].init?.method,'GET');
  assert.equal(calls[0].init?.redirect,'error');
  assert.equal((calls[0].init?.headers as Record<string,string>).Range,'bytes=0-65535');
  assert.equal(calls[0].init?.credentials,'omit');
  assert.equal(r.state,'audio_prefix_retrieved');
  assert.equal(r.rangeHonored,true);
  assert.equal(r.signature,'id3');
  assert.equal(r.sampledBytes,mp3Bytes.length);
  assert.equal(r.sampledPrefixSha256,
    createHash('sha256').update(mp3Bytes).digest('hex'));
  assert.equal(r.fullRecordingVerified,false);
  assert.equal(r.sourceToAgendaIdentityVerified,false);
  assert.equal(r.historicalAvailabilityVerified,false);
  assert.equal(r.speakerAttributionVerified,false);
  assert.equal(r.directionalMemberStatementVerified,false);
});

test('an unbounded 200 response is sampled at no more than 65536 bytes', async () => {
  const source=Buffer.concat([Buffer.from('ID3'), Buffer.alloc(MAX_SAMPLE_BYTES*3,0x41)]);
  const mock: typeof fetch = async () => new Response(source,{
    status:200,
    headers:{'content-type':'application/octet-stream'},
  });
  const r=await probeSenateAudioLead(first,mock);
  assert.equal(r.state,'audio_prefix_retrieved');
  assert.equal(r.rangeHonored,false);
  assert.equal(r.sampledBytes,MAX_SAMPLE_BYTES);
  assert.equal(r.sampledPrefixSha256,
    createHash('sha256').update(source.subarray(0,MAX_SAMPLE_BYTES)).digest('hex'));
  assert.equal(r.fullRecordingVerified,false);
});

test('HTTP errors, HTML bodies, and empty bodies never count as audio', async () => {
  const notFound:typeof fetch=async()=>new Response('not found',{status:404});
  const unavailable=await probeSenateAudioLead(first,notFound);
  assert.equal(unavailable.state,'http_unavailable');
  assert.equal(unavailable.httpStatus,404);
  assert.equal(unavailable.sampledBytes,0);
  const html:typeof fetch=async()=>new Response('<html>MP3 missing</html>',{
    status:200,headers:{'content-type':'text/html'},
  });
  const webpage=await probeSenateAudioLead(first,html);
  assert.equal(webpage.state,'non_audio_or_empty');
  assert.equal(webpage.signature,'not_mp3');
  const empty:typeof fetch=async()=>new Response(null,{status:200});
  const blank=await probeSenateAudioLead(first,empty);
  assert.equal(blank.state,'non_audio_or_empty');
  assert.equal(blank.sampledPrefixSha256,null);
});

test('DNS error is a transport failure, not evidence that a recording never existed', async () => {
  const broken:typeof fetch=async()=>{throw {cause:{code:'ENOTFOUND'}}};
  const r=await probeSenateAudioLead(first,broken);
  assert.equal(r.state,'network_error');
  assert.equal(r.failureCode,'ENOTFOUND');
  assert.equal(r.httpStatus,null);
  assert.equal(r.fullRecordingVerified,false);
});

test('one bounded audit checks exactly three pinned URLs sequentially with no directional admission', async () => {
  const seen:string[]=[];
  const mock:typeof fetch=async url=>{
    seen.push(String(url));
    return new Response(mp3Bytes,{status:206,headers:{'content-range':'bytes 0-1602/100000'}});
  };
  const out=await auditSenateAudioPublicLeads(mock);
  assert.equal(out.schemaVersion,AUDIO_PROBE_VERSION);
  assert.deepEqual(seen,SOURCE_LEADS.map(x=>x.candidateUrl));
  assert.equal(out.leads.length,3);
  assert.equal(out.audioPrefixesRetrieved,3);
  assert.equal(out.fullRecordingsVerified,0);
  assert.equal(out.directionalEvidenceRowsAdded,0);
  assert.match(out.nextGate,/full original audio bytes and digest/);
});

test('CLI defaults to offline, with no GitHub credentials, Neon or production dependencies', () => {
  for (const args of [[],['--offline']]) {
    const p=spawnSync(process.execPath,[
      '--import','tsx','scripts/probe-2021-senate-public-audio.ts',...args,
    ],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH??'',NODE_ENV:'test'}});
    assert.equal(p.status,0,p.stderr);
    assert.equal(JSON.parse(p.stdout).remoteSourcesContacted,0);
    assert.equal(JSON.parse(p.stdout).newDirectionalEvidenceRows,0);
  }
});

test('one-shot public-source workflow is own-path-filtered and has no database, secrets, or Vercel', () => {
  const src=readFileSync('.github/workflows/historical-2021-senate-public-audio-byteprobe.yml','utf8');
  assert.match(src,/^  push:\n    branches: \[main\]\n    paths:\n      - \.github\/workflows\/historical-2021-senate-public-audio-byteprobe\.yml$/m);
  assert.match(src,/^  workflow_dispatch:\s*$/m);
  assert.doesNotMatch(src,/^\s+(?:schedule|pull_request|workflow_run|issue_comment):/m);
  assert.match(src,/persist-credentials: false/);
  assert.match(src,/scripts\/probe-2021-senate-public-audio\.ts --probe/);
  assert.doesNotMatch(src,/secrets\.|DATABASE_URL|NEON_API_KEY|VERCEL_TOKEN|vercel|psql|runPublicEvidenceRefresh|--create|--connect|deploy --prod|id-token: write/i);
});
