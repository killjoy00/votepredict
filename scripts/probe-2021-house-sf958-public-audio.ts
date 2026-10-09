/**
 * #718: bounded acquisition of four exact 2021 House conference-committee
 * SF958 public MP3s, independently linked from the House official archive.
 * No crawl, credentials, DB access, ingestion, forecast or semantic inference.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const HOUSE_AUDIO_PROBE_VERSION = 'historical-2021-sf958-house-conference-audio-v1';
export const SOURCE_LEADS = Object.freeze([
  { date: '2021-05-04', id: 'SF0958050421', durationLabel: '2h22m', maxBytes: 100 * 1024 * 1024, retainShortAudio: false,
    url: 'https://www.lrl.mn.gov/audio/house/2021/SF0958050421.mp3' },
  { date: '2021-05-06', id: 'SF0958050621', durationLabel: '2h30m', maxBytes: 100 * 1024 * 1024, retainShortAudio: false,
    url: 'https://www.lrl.mn.gov/audio/house/2021/SF0958050621.mp3' },
  { date: '2021-05-13', id: 'SF0958051321', durationLabel: '2m', maxBytes: 8 * 1024 * 1024, retainShortAudio: true,
    url: 'https://www.lrl.mn.gov/audio/house/2021/SF0958051321.mp3' },
  { date: '2021-05-15', id: 'SF0958051521', durationLabel: '1m', maxBytes: 8 * 1024 * 1024, retainShortAudio: true,
    url: 'https://www.lrl.mn.gov/audio/house/2021/SF0958051521.mp3' },
] as const);
export type SourceLead = (typeof SOURCE_LEADS)[number];
export type DecodeResult = { format: string; durationSeconds: number } | null;
export type Decoder = (body: Buffer) => DecodeResult;
export interface SourceResult {
  date: string; id: string; url: string; archiveDurationLabel: string;
  retrievalTimestampUtc: string; finalUrl: string | null;
  httpStatus: number | null; contentType: string | null;
  contentLength: string | null; bytesRead: number;
  status: 'verified_decodable_full_audio' | 'http_denied' | 'network_failure'
    | 'size_limit' | 'unexpected_partial_or_redirect' | 'non_audio'
    | 'undecodable_audio' | 'incomplete_download';
  fullAudioSha256: string | null; audioFormat: string | null;
  durationSeconds: number | null; savedShortAudio: boolean;
  historicalPublicAvailabilityBeforeVoteProven: false;
  exactMemberBillDirectionVerified: false;
  eligibleDirectionalRowsAdded: 0;
}
export function decodeMp3WithFfprobe(bytes: Buffer): DecodeResult {
  const p = spawnSync('ffprobe', [
    '-v', 'error', '-f', 'mp3', '-show_entries', 'format=format_name,duration',
    '-of', 'json', 'pipe:0',
  ], { input: bytes, encoding: 'utf8', timeout: 30000, maxBuffer: 65536 });
  if (p.status !== 0 || p.error) return null;
  try {
    const data = JSON.parse(p.stdout) as { format?: { format_name?: string; duration?: string } };
    const format = data.format?.format_name ?? '';
    const durationSeconds = Number(data.format?.duration);
    if (!format.includes('mp3') || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
    return { format, durationSeconds };
  } catch { return null; }
}
const errorCodes = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET',
  'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT']);
function errorCode(e: unknown) {
  if (!e || typeof e !== 'object') return 'unknown';
  const x = e as { code?: unknown; cause?: { code?: unknown } };
  const c = x.cause?.code ?? x.code;
  return typeof c === 'string' && errorCodes.has(c) ? c : 'unknown';
}
export async function probeHouseSf958Lead(
  lead: SourceLead, fetchImpl: typeof fetch = fetch,
  decoder: Decoder = decodeMp3WithFfprobe, shortAudioDirectory?: string,
): Promise<SourceResult & { transportFailureCode: string | null }> {
  const out: SourceResult & { transportFailureCode: string | null } = {
    date: lead.date, id: lead.id, url: lead.url,
    archiveDurationLabel: lead.durationLabel, retrievalTimestampUtc: new Date().toISOString(),
    finalUrl: null, httpStatus: null, contentType: null, contentLength: null,
    bytesRead: 0, status: 'network_failure', fullAudioSha256: null,
    audioFormat: null, durationSeconds: null, savedShortAudio: false,
    historicalPublicAvailabilityBeforeVoteProven: false,
    exactMemberBillDirectionVerified: false, eligibleDirectionalRowsAdded: 0,
    transportFailureCode: null,
  };
  const u = new URL(lead.url);
  if (u.protocol !== 'https:' || u.hostname !== 'www.lrl.mn.gov' ||
      u.pathname !== '/audio/house/2021/' + lead.id + '.mp3' || u.search) {
    throw new Error('Source URL outside exact public-audio allowlist');
  }
  let response: Response;
  try {
    response = await fetchImpl(lead.url, {
      method: 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store',
      headers: { Accept: 'audio/mpeg,application/octet-stream;q=0.5',
        'user-agent': 'VotePredict/2.0 bounded-2021-sf958-public-audio-research' },
      signal: AbortSignal.timeout(150000),
    });
  } catch (e) {
    out.transportFailureCode = errorCode(e);
    return out;
  }
  out.httpStatus = response.status;
  out.finalUrl = response.url || lead.url;
  out.contentType = response.headers.get('content-type');
  out.contentLength = response.headers.get('content-length');
  if (out.finalUrl !== lead.url || response.redirected || response.status === 206) {
    out.status = 'unexpected_partial_or_redirect';
    await response.body?.cancel().catch(() => undefined);
    return out;
  }
  if (response.status !== 200) {
    out.status = 'http_denied';
    await response.body?.cancel().catch(() => undefined);
    return out;
  }
  if (!/^(audio\/mpeg|audio\/mp3|application\/octet-stream)\b/i.test(out.contentType ?? '')) {
    out.status = 'non_audio';
    await response.body?.cancel().catch(() => undefined);
    return out;
  }
  if (out.contentLength && Number(out.contentLength) > lead.maxBytes) {
    out.status = 'size_limit';
    await response.body?.cancel().catch(() => undefined);
    return out;
  }
  if (!response.body) { out.status = 'incomplete_download'; return out; }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let ended = false;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) { ended = true; break; }
      out.bytesRead += next.value.length;
      if (out.bytesRead > lead.maxBytes) { out.status = 'size_limit'; break; }
      chunks.push(next.value);
    }
  } catch (e) {
    out.status = 'incomplete_download';
    out.transportFailureCode = errorCode(e);
  } finally {
    if (!ended) await reader.cancel().catch(() => undefined);
  }
  if (!ended) return out;
  if (out.contentLength && Number(out.contentLength) !== out.bytesRead) {
    out.status = 'incomplete_download';
    return out;
  }
  const bytes = Buffer.concat(chunks, out.bytesRead);
  if (bytes.length < 1024 || !(bytes.subarray(0, 3).toString('ascii') === 'ID3' ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))) {
    out.status = 'non_audio';
    return out;
  }
  out.fullAudioSha256 = createHash('sha256').update(bytes).digest('hex');
  const decoded = decoder(bytes);
  if (!decoded) { out.status = 'undecodable_audio'; return out; }
  out.status = 'verified_decodable_full_audio';
  out.audioFormat = decoded.format;
  out.durationSeconds = decoded.durationSeconds;
  if (lead.retainShortAudio && shortAudioDirectory) {
    mkdirSync(shortAudioDirectory, { recursive: true });
    writeFileSync(join(shortAudioDirectory, lead.id + '.mp3'), bytes, { mode: 0o600 });
    out.savedShortAudio = true;
  }
  return out;
}
export async function auditHouseSf958Sources(
  fetchImpl: typeof fetch = fetch, decoder: Decoder = decodeMp3WithFfprobe,
  shortAudioDirectory?: string,
) {
  const results: Array<Awaited<ReturnType<typeof probeHouseSf958Lead>>> = [];
  for (const lead of SOURCE_LEADS) {
    results.push(await probeHouseSf958Lead(lead, fetchImpl, decoder, shortAudioDirectory));
  }
  return {
    schemaVersion: HOUSE_AUDIO_PROBE_VERSION,
    scope: 'four_exact_public_House_SF958_conference_MP3_links',
    sources: results,
    completeDecodableRecordings: results.filter(x => x.status === 'verified_decodable_full_audio').length,
    historicallyEligiblePreVoteMemberStatements: 0,
    newDirectionalRows: 0,
    constraints: 'Media retrieval alone does NOT prove recording publication before target vote, exact speaker attribution, directional content, historical member identity, or applicability to May 17 conference version.',
  };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === '--offline')) {
    console.log(JSON.stringify({ schemaVersion: HOUSE_AUDIO_PROBE_VERSION, mode: 'offline',
      publicRequests: 0, directionalRowsAdded: 0 }));
    return;
  }
  if (args.length !== 1 || args[0] !== '--probe') throw new Error('Only --offline / --probe are supported');
  const report = await auditHouseSf958Sources(fetch, decodeMp3WithFfprobe,
    process.env.VOTEPREDICT_SF958_SHORT_AUDIO_DIR);
  const content = JSON.stringify(report, null, 2) + '\n';
  if (process.env.VOTEPREDICT_SF958_REPORT_FILE) {
    writeFileSync(process.env.VOTEPREDICT_SF958_REPORT_FILE, content, { encoding: 'utf8', mode: 0o600 });
  }
  console.log(content);
}
if (process.argv[1]?.endsWith('/probe-2021-house-sf958-public-audio.ts')) {
  main().catch(() => { console.error('Bounded source probe failed without evidence changes'); process.exitCode = 1; });
}
