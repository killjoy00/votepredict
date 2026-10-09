/**
 * Issue #718: extract review-only audio excerpts from TWO previously verified
 * public House SF958 MP3s. No credentials, database, crawl, serving, or stance inference.
 */
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export const VERSION = 'sf958-2021-public-audio-excerpt-review-v1';
export const ORIGINS = Object.freeze([
  {
    id: 'SF0958050421', meetingDate: '2021-05-04',
    url: 'https://www.lrl.mn.gov/audio/house/2021/SF0958050421.mp3',
    expectedBytes: 68239104,
    expectedSha256: 'ab2a388980b3a673d6b3f997edae533d3b668b7d2af8826a37fe9b9f0eac18cf',
  },
  {
    id: 'SF0958050621', meetingDate: '2021-05-06',
    url: 'https://www.lrl.mn.gov/audio/house/2021/SF0958050621.mp3',
    expectedBytes: 72219840,
    expectedSha256: '78de2ae928e07ae63593db7b1a2f6784a71da5e678969e3129b8b7e04870767c',
  },
] as const);
export const CLIPS = Object.freeze([
  { sourceId: 'SF0958050421', startSeconds: 0, durationSeconds: 120, label: 'meeting opening and same-similar adoption context' },
  { sourceId: 'SF0958050421', startSeconds: 380, durationSeconds: 180, label: 'cottage-food rules discussion begins around archive 06:30' },
  { sourceId: 'SF0958050421', startSeconds: 1140, durationSeconds: 180, label: 'intermediate similar-policy discussion; precise topic unknown' },
  { sourceId: 'SF0958050421', startSeconds: 2200, durationSeconds: 210, label: 'House-only policy overview from archive 36:50' },
  { sourceId: 'SF0958050421', startSeconds: 3750, durationSeconds: 180, label: 'additional House-only policy discussion; precise topic unknown' },
  { sourceId: 'SF0958050621', startSeconds: 3770, durationSeconds: 210, label: 'compromise-language segment near archive 1:03:11; version mapping unproven' },
] as const);
type Origin = (typeof ORIGINS)[number];

export function safeOrigin(url: string, id: string): boolean {
  const u = new URL(url);
  return u.protocol === 'https:' && u.hostname === 'www.lrl.mn.gov'
    && u.pathname === '/audio/house/2021/' + id + '.mp3'
    && u.search === '' && u.hash === '';
}
export function failClosedResponse(response: Response, origin: Origin): string | null {
  if (response.status !== 200) return 'unexpected_http_status_' + response.status;
  if (response.redirected || (response.url && response.url !== origin.url)) return 'redirect_or_url_mismatch';
  if (!/^(audio\/mpeg|audio\/mp3|application\/octet-stream)\b/i.test(response.headers.get('content-type') ?? '')) return 'non_audio_mime';
  if (response.headers.get('content-length') && Number(response.headers.get('content-length')) !== origin.expectedBytes) return 'unexpected_original_size';
  return null;
}
export async function retrieveExactOrigin(origin: Origin, dir: string, fetchImpl: typeof fetch = fetch) {
  if (!safeOrigin(origin.url, origin.id)) throw new Error('not allowed URL');
  const response = await fetchImpl(origin.url, {
    method: 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store',
    headers: { Accept: 'audio/mpeg', 'user-agent': 'VotePredict/2.0 issue-718-targeted-source-review' },
    signal: AbortSignal.timeout(160000),
  });
  const reject = failClosedResponse(response, origin);
  if (reject) { await response.body?.cancel().catch(() => undefined); throw new Error(reject); }
  if (!response.body) throw new Error('source_without_body');
  const path = join(dir, origin.id + '.mp3');
  const fd = openSync(path, 'wx', 0o600);
  const hash = createHash('sha256');
  const reader = response.body.getReader();
  let total = 0; let finished = false;
  try {
    while (true) {
      const x = await reader.read();
      if (x.done) { finished = true; break; }
      total += x.value.length;
      if (total > origin.expectedBytes) throw new Error('source_exceeds_verified_size');
      hash.update(x.value);
      writeSync(fd, x.value);
    }
  } finally {
    closeSync(fd);
    if (!finished) await reader.cancel().catch(() => undefined);
  }
  if (total !== origin.expectedBytes) throw new Error('source_size_mismatch');
  const digest = hash.digest('hex');
  if (digest !== origin.expectedSha256) throw new Error('original_full_source_hash_mismatch');
  return { path, bytes: total, sha256: digest, retrievedAt: new Date().toISOString() };
}
export function renderExactClip(source: string, dest: string, startSeconds: number, durationSeconds: number) {
  const args = ['-nostdin','-v','error','-i',source, '-ss', String(startSeconds),
    '-t',String(durationSeconds),'-map','0:a:0','-vn','-ar','16000',
    '-ac','1','-c:a','libmp3lame','-b:a','48k','-y',dest];
  const p = spawnSync('ffmpeg',args,{encoding:'utf8',timeout:45000,maxBuffer:65536});
  if(p.error || p.status !== 0) throw new Error('ffmpeg_excerpt_failed: ' + (p.stderr ?? '').slice(0,160));
  if(!existsSync(dest) || statSync(dest).size < 2000) throw new Error('empty_or_invalid_excerpt');
}
export async function extractSf958ReviewClips(outputDir: string, fetchImpl: typeof fetch = fetch) {
  mkdirSync(outputDir,{recursive:true});
  const temp = mkdtempSync(join(tmpdir(), 'sf958-evidence-review-'));
  const sources: Array<{ id:string; meetingDate:string; originalUrl:string; originalBytes:number; originalSha256:string; retrievedAt:string }> = [];
  const clips: Array<{ file:string; sourceId:string; startSeconds:number; durationSeconds:number; derivedClipSha256:string; derivedClipBytes:number; transcriptIsUnverified:true; speakerIsUnverified:true; publicPreVoteProofUnverified:true; directionalEvidence:false; scopeDescription:string }> = [];
  try {
    for (const origin of ORIGINS) {
      const source = await retrieveExactOrigin(origin,temp,fetchImpl);
      sources.push({id:origin.id, meetingDate:origin.meetingDate, originalUrl:origin.url,
        originalBytes:source.bytes, originalSha256:source.sha256, retrievedAt:source.retrievedAt});
      let i=0;
      for(const clip of CLIPS.filter(x=>x.sourceId===origin.id)) {
        i+=1;
        const basename = origin.id + '-review-' + String(i).padStart(2,'0') + '-t' + clip.startSeconds + '.mp3';
        const dest = join(outputDir,basename);
        renderExactClip(source.path,dest,clip.startSeconds,clip.durationSeconds);
        const buffer = readFileSync(dest);
        clips.push({file:basename,sourceId:origin.id,startSeconds:clip.startSeconds,
          durationSeconds:clip.durationSeconds,derivedClipSha256:createHash('sha256').update(buffer).digest('hex'),
          derivedClipBytes:buffer.length,transcriptIsUnverified:true,speakerIsUnverified:true,
          publicPreVoteProofUnverified:true,directionalEvidence:false,scopeDescription:clip.label});
      }
    }
    const audit = {version:VERSION,createdAtUtc:new Date().toISOString(),
      originalReferenceRun:'https://github.com/killjoy00/votepredict/actions/runs/37945317116',
      sources,clips,newAcceptedMemberDirectionalRows:0,
      notes:'Derived clips are review candidates only: no independent member identity, publication-before-vote timestamp, exact content transcript, position, or final May 17 SF958 policy-report applicability has been established.'};
    writeFileSync(join(outputDir,'manifest.json'),JSON.stringify(audit,null,2)+'\n',{encoding:'utf8',mode:0o600});
    return audit;
  } finally {
    rmSync(temp,{recursive:true,force:true});
  }
}
async function main() {
  const args=process.argv.slice(2);
  if (args.length===0 || (args.length===1 && args[0]==='--offline')) {
    console.log(JSON.stringify({version:VERSION,mode:'offline',publicRequests:0,newAcceptedRows:0}));
    return;
  }
  if (args.length!==1 || args[0]!=='--extract') throw new Error('Only --offline / --extract are supported');
  const dir=process.env.VOTEPREDICT_SF958_EXCERPTS_DIR;
  if(!dir || !dir.startsWith('artifacts/')) throw new Error('safe artifact path required');
  const result=await extractSf958ReviewClips(dir);
  console.log(JSON.stringify({version:result.version,clips:result.clips.length,downloadedOrigins:result.sources.length,newAcceptedRows:0}));
}
if (process.argv[1]?.endsWith('/review-2021-sf958-targeted-clips.ts')) {
  main().catch(e=>{console.error('Targeted public-audio review failed, no evidence changes: '+String(e?.message??'unknown'));process.exitCode=1;});
}
