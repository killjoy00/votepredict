import { createHash } from 'node:crypto';
import { getMinnesotaHouseSession, minnesotaLocalDate } from '../src/sources/minnesota/sessions.js';
import { listLrlMemberships } from '../src/sources/minnesota/lrl-members.js';
import { parseOpeningElectionRows, reconcile2027OpeningElection, SOS_2026_DISTRICT_SOURCES, type Chamber } from '../src/operations/2027-election-roster-reconciliation.js';

async function fetchDistrict(chamber: Chamber) {
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

async function main() {
  // Source-only, bounded, never called automatically by production.
  const [house, senate] = await Promise.all([fetchDistrict('house'), fetchDistrict('senate')]);
  const records = await listLrlMemberships(getMinnesotaHouseSession('2027-2028'), { allowIncompleteForAudit: true });
  const result = reconcile2027OpeningElection(records, house.rows, senate.rows, minnesotaLocalDate(new Date()));
  const { rows: _houseRows, ...houseSource } = house;
  const { rows: _senateRows, ...senateSource } = senate;
  console.log(JSON.stringify({ sources: [houseSource, senateSource], ...result }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
