import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

type SchedulerResponse = {
  generatedAt?: string;
  prospectiveEvidence?: {
    seededForecasts?: number;
    forecasts?: Array<{ forecastId: string; identifier: string; chamber: string }>;
    error?: string;
  };
  claimed?: number;
  completed?: number;
  failed?: number;
  resolved?: number;
};

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');

  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) throw new Error('CRON_SECRET is missing from the production environment');

  const baseUrl = process.env.VOTEPREDICT_PRODUCTION_BASE_URL ?? 'https://votepredict.vercel.app';
  const response = await fetch(`${baseUrl}/api/cron/forecasts`, {
    headers: { authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(300_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Production scheduler returned ${response.status}: ${body.slice(0, 500)}`);
  }

  let payload: SchedulerResponse;
  try {
    payload = JSON.parse(body) as SchedulerResponse;
  } catch {
    throw new Error('Production scheduler returned invalid JSON');
  }

  if (payload.prospectiveEvidence?.error) {
    throw new Error(`Prospective evidence seeding failed: ${payload.prospectiveEvidence.error}`);
  }
  if ((payload.failed ?? 0) > 0) {
    throw new Error(`Production scheduler reported ${payload.failed} failed forecast run(s)`);
  }

  console.log(JSON.stringify({
    generatedAt: payload.generatedAt ?? null,
    prospectiveSeeded: payload.prospectiveEvidence?.seededForecasts ?? 0,
    claimed: payload.claimed ?? 0,
    completed: payload.completed ?? 0,
    resolved: payload.resolved ?? 0,
    failed: payload.failed ?? 0,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Production scheduler failed');
  process.exitCode = 1;
});
