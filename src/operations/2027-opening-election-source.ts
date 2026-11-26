import { createHash } from 'node:crypto';
import { parseOpeningElectionRows, SOS_2026_DISTRICT_SOURCES, type Chamber } from './2027-election-roster-reconciliation';

export async function fetchOpeningElectionDistrict(chamber: Chamber) {
  const sourceUrl = SOS_2026_DISTRICT_SOURCES[chamber];
  const response = await fetch(sourceUrl, {
    redirect: 'error', signal: AbortSignal.timeout(25_000),
    headers: { 'User-Agent': 'VotePredict/2.0 opening roster source audit' },
  });
  if (!response.ok) throw new Error(`SOS ${chamber} file HTTP ${response.status}`);
  const maxBytes = 2_000_000;
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new Error('District export exceeds size limit');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing district export body');
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('District export exceeds size limit');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const bytes = Buffer.concat(chunks);
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { text = new TextDecoder('windows-1252').decode(bytes); }
  return { sourceUrl, fetchedAt: new Date().toISOString(), sha256: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length, rows: parseOpeningElectionRows(text, chamber) };
}

