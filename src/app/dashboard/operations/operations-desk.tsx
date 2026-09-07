'use client';

import { useState } from 'react';

type QueueRow = {
  forecastId: string;
  targetLabel: string;
  chamberName: string;
  latestRevisionNumber?: number;
  latestPassageProbability?: number;
  createdAt: string;
  candidateVotes: number;
};

type Candidate = {
  id: string;
  occurredOn: string;
  yeaCount: number;
  nayCount: number;
  passed: boolean | null;
  motionText: string;
  externalKey: string;
};

function percent(value: number | undefined) {
  return value === undefined ? '—' : `${Math.round(value * 100)}%`;
}

export function OutcomeResolutionQueue({ rows }: { rows: QueueRow[] }) {
  const [openForecastId, setOpenForecastId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function review(forecastId: string) {
    if (openForecastId === forecastId) {
      setOpenForecastId(null);
      setCandidates([]);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/operations/forecasts/${forecastId}/outcome`);
      const payload = await response.json() as { candidates?: Candidate[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not load official passage votes.');
      setOpenForecastId(forecastId);
      setCandidates(payload.candidates ?? []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load official passage votes.');
    } finally {
      setLoading(false);
    }
  }

  async function resolve(forecastId: string, voteEventId: string) {
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/operations/forecasts/${forecastId}/outcome`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voteEventId }),
      });
      const payload = await response.json() as { resolved?: boolean; error?: string };
      if (!response.ok || !payload.resolved) throw new Error(payload.error || 'Could not reconcile forecast.');
      setNotice('Official outcome linked. The frozen pre-vote revisions are now included in the scorecard.');
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not reconcile forecast.');
      setLoading(false);
    }
  }

  if (rows.length === 0) {
    return <div className="resolution-empty"><strong>No unresolved production bill forecasts.</strong><span>When an official passage vote becomes available, it will appear here for explicit reconciliation.</span></div>;
  }

  return (
    <div className="resolution-queue">
      {rows.map((row) => (
        <div className="resolution-row" key={row.forecastId}>
          <div className="resolution-summary">
            <div><strong>{row.targetLabel}</strong><small>{row.chamberName} · latest r{row.latestRevisionNumber ?? '—'}</small></div>
            <span>{percent(row.latestPassageProbability)}</span>
            <small>{row.candidateVotes} candidate passage vote{row.candidateVotes === 1 ? '' : 's'}</small>
            <button type="button" onClick={() => review(row.forecastId)} disabled={loading}>{openForecastId === row.forecastId ? 'Close' : 'Review outcome'}</button>
          </div>
          {openForecastId === row.forecastId ? (
            <div className="candidate-list">
              {candidates.length === 0 ? <p>No official passage votes are available for this bill/chamber yet.</p> : candidates.map((candidate) => (
                <div key={candidate.id} className="candidate-row">
                  <div><strong>{candidate.occurredOn} · {candidate.yeaCount}–{candidate.nayCount}</strong><small>{candidate.passed === null ? 'Outcome unresolved' : candidate.passed ? 'Passed' : 'Failed'} · {candidate.motionText}</small></div>
                  <button type="button" onClick={() => resolve(row.forecastId, candidate.id)} disabled={loading}>Use this vote</button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      {notice ? <div className="resolution-notice" role="status">{notice}</div> : null}
      <style>{`
        .resolution-queue { display: grid; gap: 8px; }
        .resolution-row { overflow: hidden; border: 1px solid #e0e5e0; border-radius: 10px; background: #fff; }
        .resolution-summary { display: grid; grid-template-columns: minmax(220px,1fr) 58px 130px auto; gap: 12px; align-items: center; padding: 10px 12px; }
        .resolution-summary > div { display: grid; gap: 2px; min-width: 0; }
        .resolution-summary strong { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
        .resolution-summary small { color: #7d8780; font-size: 8px; }
        .resolution-summary > span { justify-self: end; font-size: 12px; font-weight: 800; }
        button { min-height: 30px; border: 1px solid #cbd4ce; border-radius: 7px; padding: 5px 8px; color: #2b4e3b; background: #fff; font-size: 8.5px; font-weight: 760; cursor: pointer; }
        button:hover:not(:disabled) { background: #f2f6f3; }
        button:disabled { opacity: .55; cursor: wait; }
        .candidate-list { border-top: 1px solid #e8ebe8; background: #fafbf9; }
        .candidate-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; padding: 9px 12px; border-bottom: 1px solid #ecefec; }
        .candidate-row:last-child { border-bottom: 0; }
        .candidate-row > div { display: grid; gap: 2px; }
        .candidate-row strong { font-size: 9px; }
        .candidate-row small, .candidate-list p { color: #758078; font-size: 8px; line-height: 1.4; }
        .candidate-list p { margin: 0; padding: 12px; }
        .resolution-notice { border-radius: 8px; padding: 9px 10px; color: #315541; background: #edf5ef; font-size: 9px; }
        .resolution-empty { display: grid; gap: 3px; padding: 14px; border: 1px dashed #d8ddd8; border-radius: 9px; color: #68736c; }
        .resolution-empty strong { color: #34473b; font-size: 10px; }
        .resolution-empty span { font-size: 8.5px; }
        @media (max-width: 650px) {
          .resolution-summary { grid-template-columns: minmax(0,1fr) 45px auto; gap: 8px; }
          .resolution-summary > small { display: none; }
          .candidate-row { grid-template-columns: 1fr; }
          .candidate-row button { justify-self: start; }
        }
      `}</style>
    </div>
  );
}
