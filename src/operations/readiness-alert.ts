export const READINESS_ALERT_ISSUE = 1586;
const endpoint = `https://api.github.com/repos/killjoy00/votepredict/issues/${READINESS_ALERT_ISSUE}/comments`;
type CaptureHealth = { incomplete: number; failed: number; unsealed: number };

/** Repository-local alert delivery; no recipient addresses or arbitrary destinations. */
export async function deliverReadinessDrillAlert(health: CaptureHealth, runId: string, token: string,
  request: typeof fetch = fetch): Promise<{ commentId: number; state: 'failure' | 'recovered'; readbackVerified: true }> {
  if (!/^\d{1,20}$/.test(runId) || !token || Object.values(health).some(n => !Number.isSafeInteger(n) || n < 0))
    throw new Error('Invalid readiness drill alert');
  const state = Object.values(health).some(n => n > 0) ? 'failure' : 'recovered';
  const body = `[readiness-drill:${runId}:${state}]\n\nSynthetic capture ${state}. ` +
    `Incomplete: ${health.incomplete}; failed: ${health.failed}; unsealed: ${health.unsealed}. ` +
    'Disposable PostgreSQL fixture only; no production capture, forecast, score or model changed.';
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
  const response = await request(endpoint, { method: 'POST', headers, body: JSON.stringify({ body }), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Readiness alert delivery failed (${response.status})`);
  const created = await response.json() as { id?: number };
  if (!Number.isSafeInteger(created.id) || created.id! <= 0) throw new Error('Readiness alert has no receipt ID');
  const readback = await request(`https://api.github.com/repos/killjoy00/votepredict/issues/comments/${created.id}`,
    { headers, signal: AbortSignal.timeout(15_000) });
  if (!readback.ok || (await readback.json() as { body?: string }).body !== body) throw new Error('Readiness alert readback failed');
  return { commentId: created.id!, state, readbackVerified: true };
}

export function assertReadinessDrillRun(env: Record<string, string | undefined>, event: {
  after?: string; forced?: boolean; deleted?: boolean; head_commit?: { id?: string; message?: string };
}) {
  if (env.GITHUB_REPOSITORY !== 'killjoy00/votepredict' || env.GITHUB_EVENT_NAME !== 'push'
    || env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_RUN_ATTEMPT !== '1'
    || env.GITHUB_WORKFLOW_REF !== 'killjoy00/votepredict/.github/workflows/baseline-readiness.yml@refs/heads/main'
    || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') || event.after !== env.GITHUB_SHA || event.head_commit?.id !== env.GITHUB_SHA
    || !event.head_commit?.message?.includes('BASELINE_READINESS_CANARY_20261026') || event.forced || event.deleted)
    throw new Error('Readiness alert drill requires the reviewed one-shot main workflow');
}
