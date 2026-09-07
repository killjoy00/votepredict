'use client';

import { useEffect, useMemo, useState } from 'react';

type ChamberOption = {
  id: string;
  name: string;
  kind: string;
};

type SessionSummary = {
  id: string;
  name: string;
};

type BillResult = {
  id: string;
  identifier: string;
  title: string;
  status: string | null;
  sourceUrl: string | null;
};

type ForecastWorkspaceProps = {
  ownerEmail: string;
  session: SessionSummary | null;
  chambers: ChamberOption[];
};

type SourceMode = 'official' | 'proposal';
type ResearchMode = 'quick' | 'deep';

function modeDescription(mode: ResearchMode) {
  if (mode === 'deep') {
    return 'Adds targeted current-source research for the members who are both consequential and uncertain.';
  }
  return 'Uses the historical model, bill analogues, and evidence already stored in VotePredict.';
}

export function ForecastWorkspace({ ownerEmail, session, chambers }: ForecastWorkspaceProps) {
  const [sourceMode, setSourceMode] = useState<SourceMode>('official');
  const [researchMode, setResearchMode] = useState<ResearchMode>('quick');
  const [selectedChamberId, setSelectedChamberId] = useState(chambers[0]?.id ?? '');
  const [billQuery, setBillQuery] = useState('');
  const [billResults, setBillResults] = useState<BillResult[]>([]);
  const [selectedBill, setSelectedBill] = useState<BillResult | null>(null);
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalText, setProposalText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isCreatingForecast, setIsCreatingForecast] = useState(false);
  const [createdForecastId, setCreatedForecastId] = useState<string | null>(null);
  const [runNotice, setRunNotice] = useState<string | null>(null);

  useEffect(() => {
    if (sourceMode !== 'official' || billQuery.trim().length < 2) {
      setBillResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    if (selectedBill?.identifier === billQuery.trim()) {
      setBillResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);

      try {
        const response = await fetch(`/api/bills/search?q=${encodeURIComponent(billQuery.trim())}`, {
          signal: controller.signal,
        });

        if (!response.ok) throw new Error('Bill search failed');

        const data = (await response.json()) as { bills?: BillResult[] };
        setBillResults(data.bills ?? []);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setSearchError('Could not search the bill store.');
          setBillResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [billQuery, selectedBill, sourceMode]);

  const selectedChamber = useMemo(
    () => chambers.find((chamber) => chamber.id === selectedChamberId) ?? null,
    [chambers, selectedChamberId],
  );

  const canPrepareForecast = Boolean(
    selectedChamberId
      && (sourceMode === 'official' ? selectedBill : proposalText.trim().length >= 20),
  );

  function resetCreatedForecast() {
    setCreatedForecastId(null);
    setRunNotice(null);
  }

  function selectSourceMode(mode: SourceMode) {
    setSourceMode(mode);
    resetCreatedForecast();
  }

  function chooseBill(bill: BillResult) {
    setSelectedBill(bill);
    setBillQuery(bill.identifier);
    setBillResults([]);
    resetCreatedForecast();
  }

  async function handleRun() {
    if (!canPrepareForecast || isCreatingForecast) return;

    setIsCreatingForecast(true);
    setCreatedForecastId(null);
    setRunNotice(null);

    try {
      const response = await fetch('/api/forecasts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceMode,
          researchMode,
          chamberId: selectedChamberId,
          billId: sourceMode === 'official' ? selectedBill?.id : undefined,
          proposalTitle: sourceMode === 'proposal' ? proposalTitle : undefined,
          proposalText: sourceMode === 'proposal' ? proposalText : undefined,
        }),
      });
      const data = (await response.json()) as { forecastId?: string; error?: string };

      if (!response.ok || !data.forecastId) {
        throw new Error(data.error || 'Could not create the forecast.');
      }

      setCreatedForecastId(data.forecastId);
      setRunNotice(
        `Forecast ${data.forecastId.slice(0, 8)} is saved privately as a draft. The numerical execution route is the next slice; no placeholder probability has been generated.`,
      );
    } catch (error) {
      setRunNotice(error instanceof Error ? error.message : 'Could not create the forecast.');
    } finally {
      setIsCreatingForecast(false);
    }
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <a className="brand" href="/dashboard" aria-label="VotePredict home">
          <span className="brand-mark" aria-hidden="true">VP</span>
          <span>
            <strong>VotePredict</strong>
            <small>Private forecast desk</small>
          </span>
        </a>
        <div className="workspace-meta">
          <span className="session-chip">{session?.name ?? 'Minnesota'}</span>
          <span className="owner-chip" title={ownerEmail}>{ownerEmail}</span>
        </div>
      </header>

      <div className="workspace-grid">
        <section className="composer" aria-labelledby="new-forecast-heading">
          <div className="section-kicker">New forecast</div>
          <div className="composer-heading">
            <h1 id="new-forecast-heading">Run the vote.</h1>
            <p>Start with an official Minnesota bill or paste a proposal. The forecast stays private.</p>
          </div>

          <div className="field-group">
            <span className="field-label">Source</span>
            <div className="segmented-control" aria-label="Forecast source">
              <button
                type="button"
                className={sourceMode === 'official' ? 'active' : ''}
                aria-pressed={sourceMode === 'official'}
                onClick={() => selectSourceMode('official')}
              >
                Official bill
              </button>
              <button
                type="button"
                className={sourceMode === 'proposal' ? 'active' : ''}
                aria-pressed={sourceMode === 'proposal'}
                onClick={() => selectSourceMode('proposal')}
              >
                Proposed text
              </button>
            </div>
          </div>

          {sourceMode === 'official' ? (
            <div className="field-group bill-search-group">
              <label className="field-label" htmlFor="bill-search">Bill</label>
              <div className="search-field">
                <input
                  id="bill-search"
                  value={billQuery}
                  onChange={(event) => {
                    const next = event.target.value;
                    setBillQuery(next);
                    if (selectedBill && next.trim() !== selectedBill.identifier) setSelectedBill(null);
                    resetCreatedForecast();
                  }}
                  placeholder="HF 1234 or a few words from the title"
                  autoComplete="off"
                  aria-describedby="bill-search-help"
                />
                <span className="search-status" aria-live="polite">{isSearching ? 'Searching…' : ''}</span>
              </div>
              <p id="bill-search-help" className="field-help">Searches the current-session bill store by identifier or title.</p>

              {searchError ? <p className="inline-error" role="alert">{searchError}</p> : null}

              {billResults.length > 0 ? (
                <div className="bill-results" role="listbox" aria-label="Bill search results">
                  {billResults.map((bill) => (
                    <button key={bill.id} type="button" role="option" onClick={() => chooseBill(bill)}>
                      <span className="bill-result-id">{bill.identifier}</span>
                      <span className="bill-result-title">{bill.title}</span>
                      <span className="bill-result-arrow" aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {selectedBill ? (
                <article className="selected-bill">
                  <div>
                    <span className="selected-label">Selected</span>
                    <strong>{selectedBill.identifier}</strong>
                  </div>
                  <p>{selectedBill.title}</p>
                  <div className="selected-bill-meta">
                    <span>{selectedBill.status || 'Status unavailable'}</span>
                    {selectedBill.sourceUrl ? (
                      <a href={selectedBill.sourceUrl} target="_blank" rel="noreferrer">Official source ↗</a>
                    ) : null}
                  </div>
                </article>
              ) : null}
            </div>
          ) : (
            <div className="proposal-fields">
              <div className="field-group">
                <label className="field-label" htmlFor="proposal-title">Working title <span>optional</span></label>
                <input
                  id="proposal-title"
                  value={proposalTitle}
                  onChange={(event) => {
                    setProposalTitle(event.target.value);
                    resetCreatedForecast();
                  }}
                  placeholder="e.g. Property tax levy cap"
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="proposal-text">Proposal</label>
                <textarea
                  id="proposal-text"
                  value={proposalText}
                  onChange={(event) => {
                    setProposalText(event.target.value);
                    resetCreatedForecast();
                  }}
                  placeholder="Paste bill language or describe the proposal precisely enough to compare it with historical legislation."
                  rows={8}
                />
                <p className="field-help">At least 20 characters. The original text is preserved with the forecast.</p>
              </div>
            </div>
          )}

          <div className="field-row">
            <div className="field-group">
              <label className="field-label" htmlFor="target-chamber">Chamber</label>
              <select
                id="target-chamber"
                value={selectedChamberId}
                onChange={(event) => {
                  setSelectedChamberId(event.target.value);
                  resetCreatedForecast();
                }}
                disabled={chambers.length === 0}
              >
                {chambers.length === 0 ? <option value="">No chamber available</option> : null}
                {chambers.map((chamber) => (
                  <option key={chamber.id} value={chamber.id}>{chamber.name}</option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <span className="field-label">Mode</span>
              <div className="segmented-control compact" aria-label="Research mode">
                <button
                  type="button"
                  className={researchMode === 'quick' ? 'active' : ''}
                  aria-pressed={researchMode === 'quick'}
                  onClick={() => {
                    setResearchMode('quick');
                    resetCreatedForecast();
                  }}
                >Quick</button>
                <button
                  type="button"
                  className={researchMode === 'deep' ? 'active' : ''}
                  aria-pressed={researchMode === 'deep'}
                  onClick={() => {
                    setResearchMode('deep');
                    resetCreatedForecast();
                  }}
                >Deep</button>
              </div>
            </div>
          </div>

          <div className={`mode-note ${researchMode === 'deep' ? 'deep' : ''}`}>
            <span className="mode-dot" aria-hidden="true" />
            <p><strong>{researchMode === 'deep' ? 'Deep research' : 'Quick forecast'}</strong>{modeDescription(researchMode)}</p>
          </div>

          <button
            className="primary-action"
            type="button"
            disabled={!canPrepareForecast || isCreatingForecast}
            onClick={handleRun}
          >
            <span>{isCreatingForecast ? 'Creating forecast…' : researchMode === 'deep' ? 'Create Deep forecast' : 'Create Quick forecast'}</span>
            <span aria-hidden="true">→</span>
          </button>

          {runNotice ? <div className="run-notice" role="status">{runNotice}</div> : null}

          <div className="composer-footnote">
            <span>Model</span>
            <strong>member-eb-v1</strong>
            <span>Calibration</span>
            <strong>off by default</strong>
          </div>
        </section>

        <section className="result-pane" aria-labelledby="forecast-result-heading">
          <div className="result-toolbar">
            <div>
              <span className="section-kicker">Forecast result</span>
              <h2 id="forecast-result-heading">{createdForecastId ? 'Forecast created' : 'No forecast run yet'}</h2>
            </div>
            <span className="private-badge">Private</span>
          </div>

          <article className="outcome-card empty-outcome">
            <div className="outcome-copy">
              <span className="outcome-label">Passage probability</span>
              <strong className="outcome-value">—</strong>
              <p>
                {createdForecastId
                  ? `Draft ${createdForecastId.slice(0, 8)} is persisted. Numerical output remains intentionally blank until the validated execution route is connected.`
                  : 'Select a bill or proposal and create a forecast. VotePredict will show the chamber conclusion first, with uncertainty one layer below.'}
              </p>
            </div>
            <div className="metric-strip" aria-label="Forecast metrics">
              <div><span>Expected Yes</span><strong>—</strong></div>
              <div><span>Central range</span><strong>—</strong></div>
              <div><span>Required Yes</span><strong>—</strong></div>
              <div><span>As of</span><strong>—</strong></div>
            </div>
          </article>

          <div className="result-grid">
            <article className="result-panel member-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Members</span>
                  <h3>Vote probabilities</h3>
                </div>
                <button type="button" className="quiet-button" disabled>Filter</button>
              </div>

              <div className="member-table-shell">
                <div className="member-table-head" aria-hidden="true">
                  <span>Member</span>
                  <span>Support</span>
                  <span>Yes</span>
                </div>
                <div className="table-empty-state">
                  <div className="empty-rule" />
                  <strong>Member calls will appear here.</strong>
                  <p>Sort by probability or uncertainty, isolate parties, researched members, and cannot-predict cases, then open a member for the evidence trail.</p>
                </div>
              </div>
            </article>

            <aside className="result-panel diagnostic-panel">
              <span className="section-kicker">{researchMode === 'deep' ? 'Deep research' : 'Diagnostics'}</span>
              <h3>{researchMode === 'deep' ? 'Research only where it matters.' : 'Evidence without the clutter.'}</h3>
              <p>
                {researchMode === 'deep'
                  ? 'Deep mode ranks members by exact pivotality, uncertainty, and evidence need instead of researching the entire chamber.'
                  : 'The result view will keep model support, analogues, direct evidence, exclusions, and source provenance inspectable without crowding the chamber call.'}
              </p>
              <dl className="diagnostic-list">
                <div><dt>Target chamber</dt><dd>{selectedChamber?.name ?? 'Not selected'}</dd></div>
                <div><dt>Research mode</dt><dd>{researchMode === 'deep' ? 'Deep' : 'Quick'}</dd></div>
                <div><dt>As-of policy</dt><dd>Locked</dd></div>
                <div><dt>Abstention</dt><dd>Shown explicitly</dd></div>
              </dl>
            </aside>
          </div>

          <footer className="provenance-bar">
            <span>Historical votes + as-of-safe bill analogues</span>
            <span>Source-backed evidence</span>
            <span>No inferred certainty</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
