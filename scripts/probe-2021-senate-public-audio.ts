/**
 * Issue #718 — narrowly bounded public-source accessibility evidence.
 * Three already-indexed Granicus candidate MP3 URLs only. This does not crawl
 * the archive, download full recordings, read a database or infer testimony.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

export const AUDIO_PROBE_VERSION = 'historical-2021-senate-audio-byteprobe-v1';
export const MAX_SAMPLE_BYTES = 65536;
export const SOURCE_LEADS = Object.freeze([
  {
    meetingDate: '2021-02-04',
    committee: 'Civil Law and Data Practices Policy',
    agendaClipId: '6032',
    candidateUrl: 'https://archive-video.granicus.com/mnsenate/mnsenate_7edfc4ff-545c-4f41-af4c-53476171dbe1.mp3',
  },
  {
    meetingDate: '2021-04-13',
    committee: 'Finance',
    agendaClipId: '6960',
    candidateUrl: 'https://archive-video.granicus.com/mnsenate/mnsenate_91f9beb5-353d-4047-be35-4bb7f4803654.mp3',
  },
  {
    meetingDate: '2021-04-21',
    committee: 'Finance (part 1 candidate)',
    agendaClipId: '7022',
    candidateUrl: 'https://archive-video.granicus.com/mnsenate/mnsenate_1e0d21bb-646c-489e-bdef-fe7ee6ad4c29.mp3',
  },
] as const);

export interface AudioLeadResult {
  meetingDate: string;
  committee: string;
  agendaClipId: string;
  candidateUrl: string;
  state: 'audio_prefix_retrieved' | 'http_unavailable' | 'network_error' | 'non_audio_or_empty';
  httpStatus: number | null;
  declaredContentType: string | null;
  declaredContentLength: string | null;
  rangeHonored: boolean;
  sampledBytes: number;
  sampledPrefixSha256: string | null;
  signature: 'id3' | 'mpeg_frame' | 'not_mp3' | 'unknown';
  failureCode: string | null;
  fullRecordingVerified: false;
  sourceToAgendaIdentityVerified: false;
  historicalAvailabilityVerified: false;
  speakerAttributionVerified: false;
  directionalMemberStatementVerified: false;
}
const knownFetchErrors = new Set([
  'ENOTFOUND','EAI_AGAIN','ETIMEDOUT','ECONNRESET','ECONNREFUSED',
  'UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_SOCKET',
]);
function failureCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'unknown';
  const obj = error as { code?: unknown; cause?: { code?: unknown } };
  const code = obj.cause?.code ?? obj.code;
  return typeof code === 'string' && knownFetchErrors.has(code) ? code : 'unknown';
}
function signature(bytes: Buffer): AudioLeadResult['signature'] {
  if (bytes.length < 3) return 'unknown';
  if (bytes.subarray(0,3).toString('ascii') === 'ID3') return 'id3';
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'mpeg_frame';
  return 'not_mp3';
}
async function boundedSample(response: Response): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while(size < MAX_SAMPLE_BYTES) {
      const next = await reader.read();
      if (next.done) break;
      const remainder = MAX_SAMPLE_BYTES - size;
      if (next.value.length > 0) {
        const fragment = next.value.subarray(0,remainder);
        chunks.push(fragment);
        size += fragment.length;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks,size);
}
export async function probeSenateAudioLead(
  lead: typeof SOURCE_LEADS[number],
  fetchImpl: typeof fetch = fetch,
): Promise<AudioLeadResult> {
  // No dynamic URLs or redirects: never transmit cookies or credentials.
  const result: AudioLeadResult = {
    ...lead, state:'network_error', httpStatus:null,
    declaredContentType:null,declaredContentLength:null,
    rangeHonored:false,sampledBytes:0,sampledPrefixSha256:null,
    signature:'unknown',failureCode:null,
    fullRecordingVerified:false,sourceToAgendaIdentityVerified:false,
    historicalAvailabilityVerified:false,speakerAttributionVerified:false,
    directionalMemberStatementVerified:false,
  };
  let response: Response;
  try {
    response = await fetchImpl(lead.candidateUrl,{
      method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
      headers:{
        Accept:'audio/mpeg,application/octet-stream;q=0.5',
        Range:'bytes=0-65535',
        'user-agent':'VotePredict/2.0 evidence-718-bounded-public-source-audit',
      },
      signal:AbortSignal.timeout(12000),
    });
  } catch(error) {
    result.failureCode = failureCode(error);
    return result;
  }
  result.httpStatus=response.status;
  result.declaredContentType=response.headers.get('content-type');
  result.declaredContentLength=response.headers.get('content-length');
  result.rangeHonored=response.status===206 &&
    /^bytes 0-\d+\/(?:\d+|\*)$/i.test(response.headers.get('content-range')??'');
  if (![200,206].includes(response.status)) {
    result.state='http_unavailable';
    await response.body?.cancel().catch(()=>undefined);
    return result;
  }
  let bytes: Buffer;
  try {
    bytes=await boundedSample(response);
  } catch(error) {
    result.failureCode=failureCode(error);
    return result;
  }
  result.sampledBytes=bytes.length;
  result.sampledPrefixSha256=bytes.length?createHash('sha256').update(bytes).digest('hex'):null;
  result.signature=signature(bytes);
  result.state=(bytes.length>=512 && ['id3','mpeg_frame'].includes(result.signature))
    ? 'audio_prefix_retrieved' : 'non_audio_or_empty';
  return result;
}
export async function auditSenateAudioPublicLeads(
  fetchImpl: typeof fetch = fetch,
): Promise<{
  schemaVersion:string;
  scope:string;
  leads:AudioLeadResult[];
  audioPrefixesRetrieved:number;
  fullRecordingsVerified:0;
  directionalEvidenceRowsAdded:0;
  nextGate:string;
}> {
  const leads:AudioLeadResult[]=[];
  // Sequential, not a bulk crawl. Exactly three pinned source URLs.
  for (const lead of SOURCE_LEADS) leads.push(await probeSenateAudioLead(lead,fetchImpl));
  return {
    schemaVersion:AUDIO_PROBE_VERSION,
    scope:'three_frozen_indexed_candidate_mp3_urls_only',
    leads,
    audioPrefixesRetrieved:leads.filter(x=>x.state==='audio_prefix_retrieved').length,
    fullRecordingsVerified:0,
    directionalEvidenceRowsAdded:0,
    nextGate:'No feature can be added without full original audio bytes and digest, exact meeting identity, strict historical availability, verified speaker, and explicit directional member/bill statement',
  };
}
async function cli() {
  const args=process.argv.slice(2);
  if(args.length===0||(args.length===1&&args[0]==='--offline')) {
    console.log(JSON.stringify({
      schemaVersion:AUDIO_PROBE_VERSION,
      mode:'offline',
      remoteSourcesContacted:0,
      newDirectionalEvidenceRows:0,
    }));
    return;
  }
  if(args.length!==1||args[0]!=='--probe')throw new Error('Only --offline and --probe are allowed');
  const report=await auditSenateAudioPublicLeads();
  const output=JSON.stringify(report,null,2)+'\n';
  if(process.env.VOTEPREDICT_AUDIO_REPORT_FILE) {
    writeFileSync(process.env.VOTEPREDICT_AUDIO_REPORT_FILE,output,{encoding:'utf8',mode:0o600});
  }
  console.log(output);
}
if(process.argv[1]?.endsWith('/probe-2021-senate-public-audio.ts')) {
  cli().catch(()=>{console.error('Bounded public-source probe failed internally; no evidence changed');process.exitCode=1;});
}
