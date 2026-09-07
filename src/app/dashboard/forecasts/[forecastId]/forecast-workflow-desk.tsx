'use client';

import { useMemo, useState } from 'react';

type Revision = {
  id: string;
  revisionNumber: number;
  researchMode: 'quick' | 'deep';
  generatedAt: string | null;
  passageProbability?: number;
  expectedYes?: number;
  yesLow?: number;
  yesHigh?: number;
  modelVersion?: string;
  cannotPredictCount: number;
};

type Member = {
  membershipId: string;
  memberName: string;
  party: string;
  district: string;
  yesProbability?: number;
  evidenceQuality: string;
  cannotPredictReason?: string;
  reasoningSummary?: string;
};

type Detail = {
  forecastId: string;
  targetType: 'bill' | 'proposal';
  targetLabel: string;
  chamberName: string;
  revisions: Revision[];
  latestMembers: Member[];
};

type RevisionDiff = {
  from: Revision;
  to: Revision;
  passageProbabilityDelta?: number;
  expectedYesDelta?: number;
  memberChanges: Array<{
    membershipId: string;
    memberName: string;
    party: string;
    district: string;
    fromProbability?: number;
    toProbability?: number;
    delta?: number;
    fromCannotPredict: boolean;
    toCannotPredict: boolean;
  }>;
};

type ScenarioEvaluation = {
  scenarioId: string;
  name: string;
  baseRevisionNumber: number;
  base: { passageProbability?: number; expectedYes?: number; yesLow?: number; yesHigh?: number };
  scenario: { passageProbability?: number; expectedYes?: number; yesLow?: number; yesHigh?: number; requiredYes?: number; cannotPredictCount: number };
  members: Array<{ membershipId: string; memberName: string; baseProbability?: number; scenarioProbability?: number; overridden: boolean; rationale?: string }>;
};

type SubsetEvaluation = {
  subsetId: string;
  name: string;
  revisionNumber: number;
  aggregate: {
    memberCount: number;
    predictedMemberCount: number;
    cannotPredictCount: number;
    expectedYes?: number;
    yesLow?: number;
    yesHigh?: number;
    proceduralOutcome: null;
    proceduralNote: string;
  };
};

type ShareRow = {
  id: string;
  revisionId: string;
  revisionNumber: number;
  label?: string;
  revokedAt: string | null;
  createdAt: string;
};

function percent(value: number | undefined) {
  return value === undefined ? '—' : `${Math.round(value * 100)}%`;
}

function movement(value: number | undefined) {
  if (value === undefined) return '—';
  const points = value * 100;
  return `${points > 0 ? '+' : ''}${points.toFixed(1)} pts`;
}

function date(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

async function responseJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Request failed.');
  return payload;
}

export function ForecastWorkflowDesk({ detail }: { detail: Detail }) {
  const latest = detail.revisions[0];
  const [updating, setUpdating] = useState<'quick' | 'deep' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [diffFrom, setDiffFrom] = useState(detail.revisions[1]?.id ?? latest?.id ?? '');
  const [diffTo, setDiffTo] = useState(latest?.id ?? '');
  const [diff, setDiff] = useState<RevisionDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [scenarioName, setScenarioName] = useState('Working scenario');
  const [scenarioOverrides, setScenarioOverrides] = useState<Record<string, number>>({});
  const [scenario, setScenario] = useState<ScenarioEvaluation | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [subsetName, setSubsetName] = useState('Selected members');
  const [subsetMembers, setSubsetMembers] = useState<Set<string>>(new Set());
  const [subset, setSubset] = useState<SubsetEvaluation | null>(null);
  const [subsetLoading, setSubsetLoading] = useState(false);
  const [shareRevisionId, setShareRevisionId] = useState(latest?.id ?? '');
  const [shareLabel, setShareLabel] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [sharesLoaded, setSharesLoaded] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  const overriddenMembers = useMemo(
    () => detail.latestMembers.filter((member) => scenarioOverrides[member.membershipId] !== undefined),
    [detail.latestMembers, scenarioOverrides],
  );

  async function updateForecast(mode: 'quick' | 'deep') {
    if (updating) return;
    setUpdating(mode);
    setNotice(null);
    try {
      const response = await fetch(`/api/forecasts/${detail.forecastId}/revisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ researchMode: mode }),
      });
      const payload = await responseJson<{ result: { revisionNumber: number; researchMode: string }; deepError?: string }>(response);
      setNotice(payload.deepError
        ? `Quick baseline saved as revision ${payload.result.revisionNumber}; Deep research did not complete: ${payload.deepError}`
        : `${payload.result.researchMode === 'deep' ? 'Deep' : 'Quick'} revision ${payload.result.revisionNumber} saved.`);
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Update failed.');
      setUpdating(null);
    }
  }

  async function loadDiff() {
    if (!diffFrom || !diffTo || diffFrom === diffTo) {
      setNotice('Choose two different revisions to compare.');
      return;
    }
    setDiffLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/forecasts/${detail.forecastId}/diff?from=${encodeURIComponent(diffFrom)}&to=${encodeURIComponent(diffTo)}`);
      const payload = await responseJson<{ diff: RevisionDiff }>(response);
      setDiff(payload.diff);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not compare revisions.');
    } finally {
      setDiffLoading(false);
    }
  }

  function setOverride(membershipId: string, probability: number | null) {
    setScenarioOverrides((current) => {
      const next = { ...current };
      if (probability === null) delete next[membershipId];
      else next[membershipId] = probability;
      return next;
    });
  }

  async function createScenario() {
    if (!latest || overriddenMembers.length === 0) {
      setNotice('Choose at least one member assumption for the scenario.');
      return;
    }
    setScenarioLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/forecasts/${detail.forecastId}/scenarios`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          baseRevisionId: latest.id,
          name: scenarioName,
          overrides: overriddenMembers.map((member) => ({
            membershipId: member.membershipId,
            yesProbability: scenarioOverrides[member.membershipId],
            rationale: 'User-controlled counterfactual assumption',
          })),
        }),
      });
      const payload = await responseJson<{ scenario: ScenarioEvaluation }>(response);
      setScenario(payload.scenario);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create scenario.');
    } finally {
      setScenarioLoading(false);
    }
  }

  function toggleSubsetMember(membershipId: string) {
    setSubsetMembers((current) => {
      const next = new Set(current);
      if (next.has(membershipId)) next.delete(membershipId);
      else next.add(membershipId);
      return next;
    });
  }

  async function createSubset() {
    if (!latest || subsetMembers.size === 0) {
      setNotice('Select at least one member for the subset.');
      return;
    }
    setSubsetLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/forecasts/${detail.forecastId}/subsets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revisionId: latest.id, name: subsetName, sourceKind: 'custom', membershipIds: [...subsetMembers] }),
      });
      const payload = await responseJson<{ subset: SubsetEvaluation }>(response);
      setSubset(payload.subset);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create subset.');
    } finally {
      setSubsetLoading(false);
    }
  }

  async function refreshShares() {
    const response = await fetch(`/api/forecasts/${detail.forecastId}/shares`);
    const payload = await responseJson<{ shares: ShareRow[] }>(response);
    setShares(payload.shares);
    setSharesLoaded(true);
  }

  async function createShare() {
    if (!shareRevisionId) return;
    setShareLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/forecasts/${detail.forecastId}/shares`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revisionId: shareRevisionId, label: shareLabel }),
      });
      const payload = await responseJson<{ share: { path: string } }>(response);
      setShareUrl(`${window.location.origin}${payload.share.path}`);
      await refreshShares();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create share link.');
    } finally {
      setShareLoading(false);
    }
  }

  async function revokeShare(shareId: string) {
    setNotice(null);
    try {
      const response = await fetch(`/api/shares/${shareId}`, { method: 'DELETE' });
      await responseJson<{ revoked: boolean }>(response);
      await refreshShares();
      setShareUrl(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not revoke share link.');
    }
  }

  return (
    <div className="workflow-desk">
      <section className="workflow-section revision-section">
        <div className="section-heading">
          <div><span className="kicker">Immutable history</span><h2>Revisions</h2></div>
          <div className="update-actions">
            <button type="button" onClick={() => updateForecast('quick')} disabled={Boolean(updating)}>{updating === 'quick' ? 'Updating…' : 'Update Quick'}</button>
            <button type="button" className="deep" onClick={() => updateForecast('deep')} disabled={Boolean(updating)}>{updating === 'deep' ? 'Researching…' : 'Update Deep'}</button>
          </div>
        </div>
        <div className="revision-timeline">
          {detail.revisions.map((revision) => (
            <div className="revision-row" key={revision.id}>
              <strong>r{revision.revisionNumber}</strong>
              <span>{revision.researchMode === 'deep' ? 'Deep' : 'Quick'}</span>
              <span>{date(revision.generatedAt)}</span>
              <span>{percent(revision.passageProbability)}</span>
              <small>{revision.cannotPredictCount ? `${revision.cannotPredictCount} cannot predict` : 'full chamber'}</small>
            </div>
          ))}
        </div>

        {detail.revisions.length >= 2 ? (
          <div className="diff-controls">
            <select value={diffFrom} onChange={(event) => setDiffFrom(event.target.value)} aria-label="Compare from revision">
              {detail.revisions.map((revision) => <option value={revision.id} key={revision.id}>r{revision.revisionNumber} · {revision.researchMode}</option>)}
            </select>
            <span>→</span>
            <select value={diffTo} onChange={(event) => setDiffTo(event.target.value)} aria-label="Compare to revision">
              {detail.revisions.map((revision) => <option value={revision.id} key={revision.id}>r{revision.revisionNumber} · {revision.researchMode}</option>)}
            </select>
            <button type="button" onClick={loadDiff} disabled={diffLoading}>{diffLoading ? 'Comparing…' : 'Compare'}</button>
          </div>
        ) : null}

        {diff ? (
          <div className="diff-result">
            <div className="diff-metrics"><div><span>Passage movement</span><strong>{movement(diff.passageProbabilityDelta)}</strong></div><div><span>Expected Yes</span><strong>{diff.expectedYesDelta === undefined ? '—' : `${diff.expectedYesDelta > 0 ? '+' : ''}${diff.expectedYesDelta.toFixed(1)}`}</strong></div><div><span>Members changed</span><strong>{diff.memberChanges.length}</strong></div></div>
            {diff.memberChanges.length ? <div className="change-list">{diff.memberChanges.slice(0, 15).map((change) => <div key={change.membershipId}><strong>{change.memberName}</strong><span>{percent(change.fromProbability)} → {percent(change.toProbability)}</span><small>{movement(change.delta)}</small></div>)}</div> : <p className="quiet">No member point probabilities changed between these revisions.</p>}
          </div>
        ) : null}
      </section>

      <section className="workflow-grid">
        <article className="workflow-section">
          <div className="section-heading"><div><span className="kicker">Counterfactual</span><h2>Scenario</h2></div></div>
          <p className="section-copy">Branch from the latest official revision. These assumptions never alter the saved forecast, evidence, or training truth.</p>
          <label className="text-field"><span>Name</span><input value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} /></label>
          <div className="member-picker scenario-picker">
            {detail.latestMembers.map((member) => {
              const override = scenarioOverrides[member.membershipId];
              return <div className="picker-row" key={member.membershipId}><div><strong>{member.memberName}</strong><small>{member.party} · {member.district} · base {percent(member.yesProbability)}</small></div><select value={override === undefined ? '' : String(override)} onChange={(event) => setOverride(member.membershipId, event.target.value === '' ? null : Number(event.target.value))}><option value="">No override</option><option value="1">Assume Yes</option><option value="0.75">75% Yes</option><option value="0.5">50 / 50</option><option value="0.25">25% Yes</option><option value="0">Assume No</option></select></div>;
            })}
          </div>
          <button className="primary" type="button" onClick={createScenario} disabled={scenarioLoading}>{scenarioLoading ? 'Calculating…' : `Create scenario${overriddenMembers.length ? ` · ${overriddenMembers.length} override${overriddenMembers.length === 1 ? '' : 's'}` : ''}`}</button>
          {scenario ? <div className="derived-result"><span>No official data changed</span><div><strong>{percent(scenario.base.passageProbability)}</strong><b>→</b><strong>{percent(scenario.scenario.passageProbability)}</strong></div><small>Expected Yes {scenario.base.expectedYes?.toFixed(1) ?? '—'} → {scenario.scenario.expectedYes?.toFixed(1) ?? '—'} · {scenario.scenario.cannotPredictCount} unresolved</small></div> : null}
        </article>

        <article className="workflow-section">
          <div className="section-heading"><div><span className="kicker">Selected members</span><h2>Subset</h2></div></div>
          <p className="section-copy">Analyze any named group against the latest revision. Vote distribution only—no procedural pass/fail threshold is inferred.</p>
          <label className="text-field"><span>Name</span><input value={subsetName} onChange={(event) => setSubsetName(event.target.value)} /></label>
          <div className="member-picker subset-picker">
            {detail.latestMembers.map((member) => <label className="picker-row subset-row" key={member.membershipId}><div><strong>{member.memberName}</strong><small>{member.party} · {member.district} · {percent(member.yesProbability)}</small></div><input type="checkbox" checked={subsetMembers.has(member.membershipId)} onChange={() => toggleSubsetMember(member.membershipId)} /></label>)}
          </div>
          <button className="primary" type="button" onClick={createSubset} disabled={subsetLoading}>{subsetLoading ? 'Calculating…' : `Analyze subset${subsetMembers.size ? ` · ${subsetMembers.size}` : ''}`}</button>
          {subset ? <div className="derived-result subset-result"><span>{subset.aggregate.proceduralNote}</span><div><strong>{subset.aggregate.expectedYes?.toFixed(1) ?? '—'} expected Yes</strong></div><small>80% member-count range {subset.aggregate.yesLow ?? '—'}–{subset.aggregate.yesHigh ?? '—'} · {subset.aggregate.cannotPredictCount} unresolved</small></div> : null}
        </article>
      </section>

      <section className="workflow-section share-section">
        <div className="section-heading"><div><span className="kicker">Explicit access</span><h2>Read-only share</h2></div><button type="button" className="quiet-button" onClick={refreshShares}>{sharesLoaded ? 'Refresh links' : 'Show existing links'}</button></div>
        <p className="section-copy">A link exposes one selected revision only. It does not grant workspace access, and it can be revoked here.</p>
        <div className="share-controls"><select value={shareRevisionId} onChange={(event) => setShareRevisionId(event.target.value)}>{detail.revisions.map((revision) => <option value={revision.id} key={revision.id}>Revision {revision.revisionNumber} · {revision.researchMode}</option>)}</select><input value={shareLabel} onChange={(event) => setShareLabel(event.target.value)} placeholder="Optional label" /><button type="button" onClick={createShare} disabled={shareLoading || !shareRevisionId}>{shareLoading ? 'Creating…' : 'Create link'}</button></div>
        {shareUrl ? <div className="share-url"><input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={() => navigator.clipboard?.writeText(shareUrl)}>Copy</button></div> : null}
        {sharesLoaded ? <div className="share-list">{shares.length === 0 ? <p className="quiet">No share links created yet.</p> : shares.map((share) => <div key={share.id}><span>r{share.revisionNumber}{share.label ? ` · ${share.label}` : ''}</span><small>{share.revokedAt ? 'Revoked' : `Created ${date(share.createdAt)}`}</small>{share.revokedAt ? null : <button type="button" onClick={() => revokeShare(share.id)}>Revoke</button>}</div>)}</div> : null}
      </section>

      {notice ? <div className="workflow-notice" role="status">{notice}</div> : null}

      <style>{`
        .workflow-desk { display: grid; gap: 18px; }
        .workflow-section { border: 1px solid #dce1dc; border-radius: 14px; padding: 18px; background: #fff; }
        .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .kicker { color: #7d8780; font-size: 8px; font-weight: 820; letter-spacing: .08em; text-transform: uppercase; }
        h2 { margin: 4px 0 0; font-size: 17px; letter-spacing: -.025em; }
        .section-copy { margin: 9px 0 14px; color: #707a73; font-size: 10px; line-height: 1.45; }
        button, select, input { font: inherit; }
        button { border: 1px solid #ccd4ce; border-radius: 8px; min-height: 32px; padding: 6px 10px; color: #24352b; background: #fff; font-size: 9px; font-weight: 760; cursor: pointer; }
        button:hover:not(:disabled) { background: #f2f6f3; }
        button:disabled { cursor: wait; opacity: .58; }
        .update-actions { display: flex; gap: 7px; }
        .update-actions .deep { color: #4b416e; border-color: #d8d0e9; background: #f5f1fb; }
        .revision-timeline { margin-top: 13px; overflow: hidden; border: 1px solid #e2e6e2; border-radius: 9px; }
        .revision-row { display: grid; grid-template-columns: 42px 54px 1fr 58px 110px; gap: 10px; align-items: center; padding: 9px 11px; border-bottom: 1px solid #eef0ee; font-size: 9px; }
        .revision-row:last-child { border-bottom: 0; }
        .revision-row strong { font-size: 10px; }
        .revision-row span, .revision-row small { color: #737d76; }
        .revision-row span:nth-of-type(3) { color: #26382d; font-weight: 760; text-align: right; }
        .revision-row small { text-align: right; }
        .diff-controls { display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 8px; align-items: center; margin-top: 10px; }
        select, input { min-height: 34px; border: 1px solid #d8ded9; border-radius: 8px; padding: 6px 9px; color: #26352c; background: #fff; font-size: 9px; }
        .diff-result { margin-top: 12px; border-top: 1px solid #e5e8e5; padding-top: 12px; }
        .diff-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
        .diff-metrics > div { border: 1px solid #e1e5e1; border-radius: 8px; padding: 8px; }
        .diff-metrics span { display: block; color: #808983; font-size: 8px; }
        .diff-metrics strong { display: block; margin-top: 3px; font-size: 11px; }
        .change-list { margin-top: 8px; max-height: 245px; overflow: auto; }
        .change-list > div { display: grid; grid-template-columns: 1fr 110px 70px; gap: 8px; padding: 7px 3px; border-bottom: 1px solid #eef0ee; font-size: 9px; }
        .change-list span, .change-list small { color: #707a73; text-align: right; }
        .workflow-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .text-field { display: grid; gap: 4px; margin-bottom: 9px; color: #7b847e; font-size: 8px; font-weight: 760; }
        .member-picker { max-height: 330px; overflow: auto; border: 1px solid #e2e6e2; border-radius: 9px; background: #fbfcfa; }
        .picker-row { display: grid; grid-template-columns: minmax(120px, 1fr) 112px; gap: 8px; align-items: center; padding: 8px 9px; border-bottom: 1px solid #ecefec; }
        .picker-row:last-child { border-bottom: 0; }
        .picker-row > div { display: grid; gap: 2px; min-width: 0; }
        .picker-row strong { overflow: hidden; font-size: 9.5px; text-overflow: ellipsis; white-space: nowrap; }
        .picker-row small { color: #858e88; font-size: 8px; }
        .picker-row select { min-height: 30px; padding: 4px 6px; }
        .subset-row { cursor: pointer; }
        .subset-row input { justify-self: end; width: 15px; min-height: 15px; height: 15px; accent-color: #275e47; }
        .primary { width: 100%; margin-top: 9px; border-color: #285c45; color: #fff; background: #285c45; }
        .primary:hover:not(:disabled) { background: #214e3b; }
        .derived-result { display: grid; gap: 6px; margin-top: 10px; border-left: 2px solid #8aa494; padding: 9px 0 9px 10px; }
        .derived-result > span { color: #78817b; font-size: 8px; }
        .derived-result > div { display: flex; align-items: center; gap: 9px; }
        .derived-result > div strong { font-size: 16px; }
        .derived-result b { color: #87918a; font-size: 10px; }
        .derived-result small { color: #667169; font-size: 8.5px; }
        .subset-result > span { line-height: 1.4; }
        .share-controls { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; }
        .share-url { display: grid; grid-template-columns: 1fr auto; gap: 7px; margin-top: 9px; }
        .share-url input { color: #24543f; background: #f2f7f3; }
        .share-list { margin-top: 11px; border-top: 1px solid #e8ebe8; }
        .share-list > div { display: grid; grid-template-columns: 1fr 150px auto; gap: 10px; align-items: center; padding: 8px 2px; border-bottom: 1px solid #eef0ee; font-size: 9px; }
        .share-list small { color: #808983; }
        .quiet-button { border-color: transparent; color: #627069; background: transparent; }
        .quiet { margin: 9px 0 0; color: #7d8780; font-size: 9px; }
        .workflow-notice { position: sticky; bottom: 12px; z-index: 4; border: 1px solid #cdd8d1; border-radius: 9px; padding: 10px 12px; color: #294b39; background: #f1f6f2; box-shadow: 0 8px 24px rgb(30 50 39 / 10%); font-size: 9.5px; }
        @media (max-width: 760px) {
          .workflow-grid { grid-template-columns: 1fr; }
          .revision-row { grid-template-columns: 34px 45px 1fr 50px; gap: 6px; }
          .revision-row small { display: none; }
          .diff-controls { grid-template-columns: 1fr auto 1fr; }
          .diff-controls button { grid-column: 1 / -1; }
          .share-controls { grid-template-columns: 1fr 1fr; }
          .share-controls button { grid-column: 1 / -1; }
          .share-list > div { grid-template-columns: 1fr auto; }
          .share-list small { display: none; }
        }
      `}</style>
    </div>
  );
}
