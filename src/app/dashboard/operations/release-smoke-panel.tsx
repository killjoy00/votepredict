'use client';

import { useState } from 'react';

type StepKey = 'auth' | 'quick' | 'revisions' | 'deep' | 'diff' | 'share' | 'revoke';
type StepStatus = 'pending' | 'running' | 'passed' | 'failed';
type SmokeStep = { key: StepKey; label: string; status: StepStatus; detail: string };

type Fixture = {
  forecastId: string;
  proposalId: string;
  reused: boolean;
  session: { id: string; slug: string; name: string };
  chamber: { id: string; slug: string; name: string; memberCount: number };
};

type Revision = {
  id: string;
  revisionNumber: number;
  researchMode: 'quick' | 'deep';
};

type UpdatePayload = {
  result: { revisionId: string; revisionNumber: number; researchMode: 'quick' | 'deep' };
  deepError?: string;
};

type SharePayload = { share: { id: string; path: string } };

type HealthPayload = {
  status: string;
  database: string;
  deploymentCommitSha?: string;
};

const INITIAL_STEPS: SmokeStep[] = [
  { key: 'auth', label: 'Owner auth + isolated fixture', status: 'pending', detail: 'Not run' },
  { key: 'quick', label: 'Quick revision', status: 'pending', detail: 'Not run' },
  { key: 'revisions', label: 'Revision persistence', status: 'pending', detail: 'Not run' },
  { key: 'deep', label: 'Deep revision', status: 'pending', detail: 'Not run' },
  { key: 'diff', label: 'Revision diff', status: 'pending', detail: 'Not run' },
  { key: 'share', label: 'Share create + public render', status: 'pending', detail: 'Not run' },
  { key: 'revoke', label: 'Share revoke + 404', status: 'pending', detail: 'Not run' },
];

async function json<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed with ${response.status}.`);
  return payload;
}

function shortSha(value: string | undefined) {
  return value ? value.slice(0, 8) : 'unknown SHA';
}

export function ReleaseSmokePanel() {
  const [steps, setSteps] = useState<SmokeStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [verdict, setVerdict] = useState<'idle' | 'passed' | 'failed'>('idle');
  const [summary, setSummary] = useState('Runs against an archived proposal fixture, never a production bill forecast.');

  function mark(key: StepKey, status: StepStatus, detail: string) {
    setSteps((current) => current.map((step) => step.key === key ? { ...step, status, detail } : step));
  }

  async function runSmoke() {
    if (running) return;
    setRunning(true);
    setVerdict('idle');
    setSteps(INITIAL_STEPS.map((step) => ({ ...step })));
    setSummary('Authenticated smoke is running…');

    let active: StepKey = 'auth';
    let anyFailure = false;
    let shareId: string | null = null;
    let sharePath: string | null = null;
    let shareRevoked = false;

    try {
      mark('auth', 'running', 'Checking deployed SHA and preparing the archived smoke fixture…');
      const [health, fixture] = await Promise.all([
        fetch('/api/health', { cache: 'no-store' }).then((response) => json<HealthPayload>(response)),
        fetch('/api/operations/release-smoke', { method: 'POST' }).then((response) => json<Fixture>(response)),
      ]);
      if (health.status !== 'ok' || health.database !== 'ok') throw new Error('Production health check is not green.');
      mark('auth', 'passed', `${shortSha(health.deploymentCommitSha)} · ${fixture.session.name} · ${fixture.chamber.name} (${fixture.chamber.memberCount} members) · ${fixture.reused ? 'reused fixture' : 'created fixture'}`);

      active = 'quick';
      mark('quick', 'running', 'Calling the real authenticated Quick revision endpoint…');
      const quick = await fetch(`/api/forecasts/${fixture.forecastId}/revisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ researchMode: 'quick' }),
      }).then((response) => json<UpdatePayload>(response));
      const quickRevisionId = quick.result.revisionId;
      if (!quickRevisionId || quick.result.researchMode !== 'quick') throw new Error('Quick endpoint did not return a Quick revision.');
      mark('quick', 'passed', `Saved smoke revision r${quick.result.revisionNumber}.`);

      active = 'revisions';
      mark('revisions', 'running', 'Reading the owner-only immutable revision history…');
      const firstHistory = await fetch(`/api/forecasts/${fixture.forecastId}/revisions`, { cache: 'no-store' })
        .then((response) => json<{ revisions: Revision[] }>(response));
      if (!firstHistory.revisions.some((revision) => revision.id === quickRevisionId)) throw new Error('Quick revision was not returned by revision history.');
      mark('revisions', 'passed', `${firstHistory.revisions.length} smoke revision${firstHistory.revisions.length === 1 ? '' : 's'} persisted.`);

      active = 'deep';
      mark('deep', 'running', 'Calling the real Deep endpoint and research provider…');
      const deep = await fetch(`/api/forecasts/${fixture.forecastId}/revisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ researchMode: 'deep' }),
      }).then((response) => json<UpdatePayload>(response));
      const comparisonRevisionId = deep.result.revisionId;
      if (!comparisonRevisionId) throw new Error('Deep endpoint did not return a revision.');
      if (deep.deepError || deep.result.researchMode !== 'deep') {
        anyFailure = true;
        mark('deep', 'failed', deep.deepError ? `Quick fallback saved, but Deep failed: ${deep.deepError}` : 'Deep request returned a non-Deep revision.');
      } else {
        mark('deep', 'passed', `Saved Deep smoke revision r${deep.result.revisionNumber}.`);
      }

      active = 'diff';
      mark('diff', 'running', 'Comparing the Quick revision to the Deep request result…');
      if (comparisonRevisionId === quickRevisionId) throw new Error('Quick and comparison revision IDs unexpectedly match.');
      const diff = await fetch(`/api/forecasts/${fixture.forecastId}/diff?from=${encodeURIComponent(quickRevisionId)}&to=${encodeURIComponent(comparisonRevisionId)}`, { cache: 'no-store' })
        .then((response) => json<{ diff: { from: Revision; to: Revision; memberChanges: unknown[] } }>(response));
      mark('diff', 'passed', `r${diff.diff.from.revisionNumber} → r${diff.diff.to.revisionNumber} · ${diff.diff.memberChanges.length} member changes.`);

      active = 'share';
      mark('share', 'running', 'Creating a revision-specific share and rendering it without owner credentials…');
      const share = await fetch(`/api/forecasts/${fixture.forecastId}/shares`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revisionId: comparisonRevisionId, label: `Release smoke ${new Date().toISOString()}` }),
      }).then((response) => json<SharePayload>(response));
      shareId = share.share.id;
      sharePath = share.share.path;
      const shareList = await fetch(`/api/forecasts/${fixture.forecastId}/shares`, { cache: 'no-store' })
        .then((response) => json<{ shares: Array<{ id: string }> }>(response));
      if (!shareList.shares.some((row) => row.id === shareId)) throw new Error('Created share was not returned by the share list endpoint.');
      const publicPage = await fetch(sharePath, { cache: 'no-store', credentials: 'omit' });
      const publicHtml = await publicPage.text();
      if (!publicPage.ok || !publicHtml.includes('Read-only revision') || !publicHtml.includes('VotePredict release smoke')) {
        throw new Error(`Public share did not render the smoke revision (${publicPage.status}).`);
      }
      mark('share', 'passed', `Public read-only share rendered with no owner cookie (${publicPage.status}).`);

      active = 'revoke';
      mark('revoke', 'running', 'Revoking the share and verifying the public URL disappears…');
      await fetch(`/api/shares/${shareId}`, { method: 'DELETE' }).then((response) => json<{ revoked: boolean }>(response));
      shareRevoked = true;
      const revokedPage = await fetch(sharePath, { cache: 'no-store', credentials: 'omit' });
      if (revokedPage.status !== 404) throw new Error(`Revoked share returned ${revokedPage.status}, expected 404.`);
      mark('revoke', 'passed', 'Revoked share now returns 404.');

      if (anyFailure) {
        setVerdict('failed');
        setSummary(`Release smoke completed with a Deep failure on ${shortSha(health.deploymentCommitSha)}. Other authenticated workflow paths passed.`);
      } else {
        setVerdict('passed');
        setSummary(`Release smoke passed on ${shortSha(health.deploymentCommitSha)} using the isolated ${fixture.chamber.name} fixture.`);
      }
    } catch (error) {
      anyFailure = true;
      const message = error instanceof Error ? error.message : 'Release smoke failed.';
      mark(active, 'failed', message);
      setVerdict('failed');
      setSummary(`Release smoke stopped at ${INITIAL_STEPS.find((step) => step.key === active)?.label ?? active}: ${message}`);
    } finally {
      if (shareId && !shareRevoked) {
        try {
          await fetch(`/api/shares/${shareId}`, { method: 'DELETE' });
          if (active !== 'revoke') mark('revoke', 'passed', 'Cleanup revoked the temporary share after an earlier failure.');
        } catch {
          if (active !== 'revoke') mark('revoke', 'failed', `Temporary share cleanup failed${sharePath ? ` for ${sharePath}` : ''}.`);
          anyFailure = true;
          setVerdict('failed');
        }
      }
      setRunning(false);
    }
  }

  return (
    <section className={`release-smoke release-smoke-${verdict}`} aria-label="Authenticated release smoke">
      <div className="release-smoke-heading">
        <div><span>Owner-only production verification</span><strong>Authenticated release smoke</strong></div>
        <button type="button" onClick={runSmoke} disabled={running}>{running ? 'Running smoke…' : 'Run authenticated smoke'}</button>
      </div>
      <p className="release-smoke-summary">{summary}</p>
      <div className="release-smoke-steps">
        {steps.map((step) => (
          <div className={`release-smoke-step ${step.status}`} key={step.key}>
            <span aria-hidden="true">{step.status === 'passed' ? '✓' : step.status === 'failed' ? '!' : step.status === 'running' ? '…' : '·'}</span>
            <div><strong>{step.label}</strong><small>{step.detail}</small></div>
          </div>
        ))}
      </div>
      <p className="release-smoke-note">The fixture is an archived proposal forecast pinned to the current session, so it never appears in normal forecast history or bill scorecards. Quick/Deep revisions are intentionally retained as a smoke audit trail. Deep uses the real research provider and normal budget controls. Temporary share links are revoked automatically.</p>
      <style>{`
        .release-smoke { margin: 0 0 12px; border: 1px solid #d9e0da; border-radius: 10px; padding: 11px; background: #fbfcfa; }
        .release-smoke-passed { border-color: #b9d7c3; background: #f7fbf8; }
        .release-smoke-failed { border-color: #dfb6b0; background: #fff9f8; }
        .release-smoke-heading { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
        .release-smoke-heading > div { display: grid; gap: 2px; }
        .release-smoke-heading span { color: #7d8780; font-size: 7px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
        .release-smoke-heading strong { font-size: 10px; }
        .release-smoke-heading button { min-height: 30px; border: 1px solid #b9c9bf; border-radius: 7px; padding: 5px 9px; color: #234d36; background: #fff; font-size: 8px; font-weight: 800; cursor: pointer; }
        .release-smoke-heading button:disabled { opacity: .55; cursor: wait; }
        .release-smoke-summary { margin: 8px 0; color: #5f6d64; font-size: 8px; line-height: 1.4; }
        .release-smoke-steps { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
        .release-smoke-step { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 5px; align-items: start; border: 1px solid #e4e8e4; border-radius: 7px; padding: 7px; background: #fff; }
        .release-smoke-step > span { display: grid; place-items: center; width: 16px; height: 16px; border-radius: 999px; color: #738077; background: #eef1ee; font-size: 8px; font-weight: 900; }
        .release-smoke-step > div { display: grid; gap: 2px; min-width: 0; }
        .release-smoke-step strong { font-size: 8px; }
        .release-smoke-step small { color: #79837c; font-size: 7px; line-height: 1.35; overflow-wrap: anywhere; }
        .release-smoke-step.passed > span { color: #245c3c; background: #e5f2e9; }
        .release-smoke-step.failed > span { color: #8f3e36; background: #f8e8e6; }
        .release-smoke-step.running > span { color: #735a2d; background: #f4ecd9; }
        .release-smoke-note { margin: 8px 0 0; color: #818a84; font-size: 7px; line-height: 1.4; }
        @media (max-width: 650px) {
          .release-smoke-heading { display: grid; }
          .release-smoke-heading button { justify-self: start; }
          .release-smoke-steps { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
