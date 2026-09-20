import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const ENDPOINT = 'https://votepredict.vercel.app/api/operations/historical-senate-conferee-backfill';
const SESSIONS = ['2021-2022', '2023-2024'] as const;
const BATCH_SIZE = 8;
const MAX_BATCHES_PER_SESSION = 40;
const MAX_ATTEMPTS = 3;

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

async function post(secret: string, suffix: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(ENDPOINT + suffix, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(310_000),
      });
      if (response.status >= 500 && attempt < MAX_ATTEMPTS - 1) continue;
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS - 1) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Historical Senate conferee request failed');
}

async function verify(secret: string, includeReplayCoverage = false) {
  const response = await post(secret, includeReplayCoverage ? '?verify=1&replay=1' : '?verify=1');
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Historical Senate conferee verification HTTP ${response.status}: ${safeMessage(body).slice(0, 1800)}`);
  }
  return JSON.parse(body);
}

async function runSession(secret: string, session: typeof SESSIONS[number]) {
  let offset = 0;
  const batches = [];
  for (let batchNumber = 0; batchNumber < MAX_BATCHES_PER_SESSION; batchNumber += 1) {
    const response = await post(
      secret,
      '?session=' + encodeURIComponent(session)
        + '&offset=' + offset
        + '&limit=' + BATCH_SIZE,
    );
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Historical Senate conferee backfill ${session} offset ${offset} HTTP ${response.status}: ${safeMessage(body).slice(0, 1800)}`);
    }
    const result = JSON.parse(body);
    batches.push(result);
    console.log(JSON.stringify({ session, offset, result }));
    if (result.complete === true || result.nextOffset === null) return batches;
    const nextOffset = Number(result.nextOffset);
    if (!Number.isFinite(nextOffset) || nextOffset <= offset) {
      throw new Error(`Historical Senate conferee backfill ${session} returned invalid nextOffset: ${String(result.nextOffset)}`);
    }
    offset = nextOffset;
  }
  throw new Error(`Historical Senate conferee backfill ${session} exceeded ${MAX_BATCHES_PER_SESSION} batches`);
}

async function main() {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const secret = env.CRON_SECRET;
  if (!secret) throw new Error('Production CRON_SECRET is unavailable');
  console.log(`::add-mask::${secret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);

  const initial = await verify(secret);
  const initialCoverage = Array.isArray(initial.coverage) ? initial.coverage : [];
  const results: Array<{ session: string; skipped: boolean; batches?: unknown[] }> = [];

  for (const session of SESSIONS) {
    const row = initialCoverage.find((candidate: { session?: string }) => candidate.session === session);
    if (Number(row?.evidenceRows ?? 0) >= 100 && Number(row?.sourcePages ?? 0) >= 10) {
      results.push({ session, skipped: true });
      continue;
    }
    results.push({ session, skipped: false, batches: await runSession(secret, session) });
  }

  const verification = await verify(secret, true);
  console.log(JSON.stringify({ historicalSenateConfereeBackfill: { results, verification } }));

  const coverage = Array.isArray(verification.coverage) ? verification.coverage : [];
  for (const session of SESSIONS) {
    const row = coverage.find((candidate: { session?: string }) => candidate.session === session);
    if (!row || Number(row.evidenceRows ?? 0) <= 0) {
      throw new Error('Historical Senate conferee backfill produced no verified evidence for ' + session);
    }
    const matched = Number(row.crossCheckMatchedAssignments ?? 0);
    const expected = Number(row.crossCheckExpectedAssignments ?? 0);
    const evidenceRows = Number(row.evidenceRows ?? 0);
    if (matched <= 0 || expected <= 0) {
      throw new Error(
        'Historical Senate conferee cross-check produced no usable overlap for '
        + session
        + ': matched=' + matched
        + ', expected=' + expected,
      );
    }
    console.log(JSON.stringify({
      session,
      crossCheck: {
        role: 'diagnostic_only',
        matchedAssignments: matched,
        expectedAssignments: expected,
        journalEvidenceRows: evidenceRows,
        matchedShareOfJournalEvidence: evidenceRows > 0 ? matched / evidenceRows : 0,
        matchedShareOfCrossCheck: expected > 0 ? matched / expected : 0,
      },
    }));
  }
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
