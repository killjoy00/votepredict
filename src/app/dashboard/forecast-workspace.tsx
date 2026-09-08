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
type SortMode = 'yes' | 'uncertainty' | 'name';

type DeepEvidence = {
  sourceUrl: string;
  publishedAt?: string;
  kind: string;
  stance: string;
  claim: string;
  excerpt?: string;
  sourceQuality: string;
  relevance: string;
  freshness: string;
  confidence?: number;
  disposition: 'included' | 'excluded';
  rationale: string;
};

type ForecastMember = {
  membershipId: string;
  legislatorId: string;
  memberName: string;
  party: string;
  district: string;
  yesProbability?: number;
  cannotPredictReason?: string;
  evidenceQuality: 'strong' | 'moderate' | 'limited';
  uncertainty?: number;
  support: {
    global: number;
    party: number;
    member: number;
    analogue: number;
  };
  analogue?: {
    identifier: string;
    voteEventId: string;
    occurredOn: string;
    score: number;
    memberChoice: 'yea' | 'nay';
    reasons: string[];
  };
  strongestReason: string;
  researched: boolean;
  deepResearch?: {
    targeted: boolean;
    rank?: number;
    rationale?: string;
    pivotality?: number;
    uncertainty?: number;
    evidenceGap?: number;
    priorityScore?: number;
    probabilityBefore?: number;
    probabilityAfter?: number;
    appliedEvidenceCount: number;
    excludedEvidenceCount: number;
    evidence: DeepEvidence[];
  };
};

type ForecastAnalogue = {
  voteEventId: string;
  billId: string;
  identifier: string;
  title: string;
  chamber: string;
  occurredOn: string;
  score: number;
  similarity: number;
  relationship?: string;
  reasons: string[];
  yeaCount: number;
  nayCount: number;
  passed: boolean | null;
};

type ForecastResult = {
  forecastId: string;
  revisionId: string;
  revisionNumber: number;
  researchMode: ResearchMode;
  modelVersion: string;
  asOf: string;
  chamber: {
    id: string;
    slug: string;
    name: string;
    activeMembers: number;
    requiredYes: number;
    passageProbability?: number;
    expectedYes?: number;
    yesLow?: number;
    yesHigh?: number;
  };
  supportState: 'supported' | 'partial';
  members: ForecastMember[];
  analogues: ForecastAnalogue[];
  diagnostics: {
    prefilteredEvents: number;
    safeCandidateEvents: number;
    selectedAnalogues: number;
    directAnalogueMembers: number;
    cannotPredictMembers: number;
  };
  research?: {
    baseRevisionId: string;
    researchRunId: string;
    provider: string;
    providerVersion?: string;
    targetCount: number;
    evidenceCount: number;
    includedEvidenceCount: number;
    excludedEvidenceCount: number;
    contradictions: number;
    duplicates: number;
    chamberPassageMovement?: number;
    sources: Array<{ id: string; url: string; title?: string }>;
  };
};

type ForecastResponse = {
  forecastId?: string;
  status?: string;
  researchMode?: ResearchMode;
  result?: ForecastResult;
  deepError?: string;
  errorCode?: string;
  error?: string;
};

function modeDescription(mode: ResearchMode) {
  if (mode === 'deep') {
    return 'Adds targeted current-source research for the members who are both consequential and uncertain.';
  }
  return 'Uses the historical model, bill analogues, and evidence already stored in VotePredict.';
}

function formatProbability(value: number | undefined): string {
  if (value === undefined) return '—';
  if (value >= 0.995) return '>99%';
  if (value <= 0.005) return '<1%';
  return `${Math.round(value * 100)}%`;
}

function formatExpectedYes(value: number | undefined): string {
  if (value === undefined) return '—';
  return value.toFixed(1);
}

function formatRange(low: number | undefined, high: number | undefined): string {
  if (low === undefined || high === undefined) return '—';
  return `${low}–${high}`;
}

function formatAsOf(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatMovement(value: number | undefined): string {
  if (value === undefined) return '—';
  const points = value * 100;
  const prefix = points > 0 ? '+' : '';
  return `${prefix}${points.toFixed(1)} pts`;
}

function supportLabel(quality: ForecastMember['evidenceQuality']): string {
  if (quality === 'strong') return 'Strong';
  if (quality === 'moderate') return 'Moderate';
  return 'Limited';
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
  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null);
  const [runNotice, setRunNotice] = useState<string | null>(null);
  const [deepWarning, setDeepWarning] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('yes');
  const [partyFilter, setPartyFilter] = useState('all');
  const [onlyResearched, setOnlyResearched] = useState(false);
  const [onlyCannotPredict, setOnlyCannotPredict] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

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

  const parties = useMemo(() => {
    if (!forecastResult) return [];
    return [...new Set(forecastResult.members.map((member) => member.party))].sort();
  }, [forecastResult]);

  const visibleMembers = useMemo(() => {
    if (!forecastResult) return [];
    const rows = forecastResult.members.filter((member) => {
      if (partyFilter !== 'all' && member.party !== partyFilter) return false;
      if (onlyResearched && !member.researched) return false;
      if (onlyCannotPredict && member.yesProbability !== undefined) return false;
      return true;
    });

    return [...rows].sort((a, b) => {
      if (sortMode === 'name') return a.memberName.localeCompare(b.memberName);
      if (sortMode === 'uncertainty') {
        const aValue = a.uncertainty ?? 1;
        const bValue = b.uncertainty ?? 1;
        return bValue - aValue || a.memberName.localeCompare(b.memberName);
      }
      const aValue = a.yesProbability ?? -1;
      const bValue = b.yesProbability ?? -1;
      return bValue - aValue || a.memberName.localeCompare(b.memberName);
    });
  }, [forecastResult, onlyCannotPredict, onlyResearched, partyFilter, sortMode]);

  const selectedMember = useMemo(
    () => forecastResult?.members.find((member) => member.membershipId === selectedMemberId) ?? null,
    [forecastResult, selectedMemberId],
  );

  const canPrepareForecast = Boolean(
    selectedChamberId
      && (sourceMode === 'official' ? selectedBill : proposalText.trim().length >= 20),
  );

  const outcomeSummary = useMemo(() => {
    const probability = forecastResult?.chamber.passageProbability;
    if (!forecastResult) return 'Select a measure and run a forecast. The chamber conclusion will appear here first.';
    if (probability === undefined) {
      return `Floor-vote estimate is withheld because ${forecastResult.diagnostics.cannotPredictMembers} member row${forecastResult.diagnostics.cannotPredictMembers === 1 ? '' : 's'} remain cannot-predict.`;
    }
    const call = probability >= 0.65 ? 'Passage is favored.' : probability <= 0.35 ? 'Passage is not favored.' : 'The chamber call is close.';
    return `${call} ${forecastResult.diagnostics.directAnalogueMembers} active members have direct votes on the selected historical analogues. This is an uncalibrated estimate conditional on the measure reaching this chamber's floor—not an enactment probability.`;
  }, [forecastResult]);

  function resetCreatedForecast() {
    setCreatedForecastId(null);
    setForecastResult(null);
    setRunNotice(null);
    setDeepWarning(null);
    setSelectedMemberId(null);
    setPartyFilter('all');
    setOnlyResearched(false);
    setOnlyCannotPredict(false);
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
    setForecastResult(null);
    setSelectedMemberId(null);
    setRunNotice(null);
    setDeepWarning(null);

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
      const data = (await response.json()) as ForecastResponse;

      if (!response.ok || !data.forecastId || !data.result) {
        throw new Error(data.error || 'Could not execute the forecast.');
      }

      setCreatedForecastId(data.forecastId);
      setForecastResult(data.result);
      setDeepWarning(data.deepError ?? null);
      setRunNotice(data.deepError
        ? `Deep research did not complete, so VotePredict is showing the persisted Quick baseline. ${data.deepError}`
        : `${data.result.researchMode === 'deep' ? 'Deep' : 'Quick'} revision ${data.result.revisionNumber} saved privately.`);
    } catch (error) {
      setRunNotice(error instanceof Error ? error.message : 'Could not execute the forecast.');
    } finally {
      setIsCreatingForecast(false);
    }
  }

  const resultTitle = forecastResult
    ? `${sourceMode === 'official' ? selectedBill?.identifier ?? 'Bill' : proposalTitle.trim() || 'Proposal'} · ${forecastResult.chamber.name}`
    : 'No forecast run yet';

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
                    <button key={bill.id} type="button" role="option" aria-selected="false" onClick={() => chooseBill(bill)}>
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
            <span>{isCreatingForecast
              ? researchMode === 'deep' ? 'Researching targeted members…' : 'Running forecast…'
              : researchMode === 'deep' ? 'Run Deep forecast' : 'Run Quick forecast'}</span>
            <span aria-hidden="true">→</span>
          </button>

          {runNotice ? <div className={`run-notice ${deepWarning ? 'warning' : ''}`} role="status">{runNotice}</div> : null}

          <div className="composer-footnote">
            <span>Model</span>
            <strong>{forecastResult?.modelVersion ?? 'member-eb-v1'}</strong>
            <span>Calibration</span>
            <strong>off by default</strong>
          </div>
        </section>

        <section className="result-pane" aria-labelledby="forecast-result-heading">
          <div className="result-toolbar">
            <div>
              <span className="section-kicker">Forecast result</span>
              <h2 id="forecast-result-heading">{resultTitle}</h2>
            </div>
            <div className="result-badges">
              {forecastResult ? <span className={`support-state ${forecastResult.supportState}`}>{forecastResult.supportState === 'supported' ? 'Supported' : 'Partial support'}</span> : null}
              <span className="private-badge">Private</span>
            </div>
          </div>

          <article className={`outcome-card ${forecastResult ? 'has-result' : 'empty-outcome'}`}>
            <div className="outcome-copy">
              <span className="outcome-label">Floor passage estimate · uncalibrated</span>
              <strong className="outcome-value">{formatProbability(forecastResult?.chamber.passageProbability)}</strong>
              <p>{outcomeSummary}</p>
            </div>
            <div className="metric-strip" aria-label="Forecast metrics">
              <div><span>Expected Yes</span><strong>{formatExpectedYes(forecastResult?.chamber.expectedYes)}</strong></div>
              <div><span>Vote range (uncalibrated)</span><strong>{formatRange(forecastResult?.chamber.yesLow, forecastResult?.chamber.yesHigh)}</strong></div>
              <div><span>Required Yes</span><strong>{forecastResult?.chamber.requiredYes ?? '—'}</strong></div>
              <div><span>As of</span><strong className="metric-date">{formatAsOf(forecastResult?.asOf)}</strong></div>
            </div>
          </article>

          <div className="result-grid">
            <article className="result-panel member-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Members</span>
                  <h3>Vote probabilities</h3>
                </div>
                {forecastResult ? <span className="member-count">{visibleMembers.length}/{forecastResult.members.length}</span> : null}
              </div>

              {forecastResult ? (
                <div className="member-controls" aria-label="Member table controls">
                  <label>
                    <span>Sort</span>
                    <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                      <option value="yes">Yes probability</option>
                      <option value="uncertainty">Uncertainty</option>
                      <option value="name">Name</option>
                    </select>
                  </label>
                  <label>
                    <span>Party</span>
                    <select value={partyFilter} onChange={(event) => setPartyFilter(event.target.value)}>
                      <option value="all">All parties</option>
                      {parties.map((party) => <option key={party} value={party}>{party}</option>)}
                    </select>
                  </label>
                  <label className="control-check">
                    <input type="checkbox" checked={onlyResearched} onChange={(event) => setOnlyResearched(event.target.checked)} />
                    <span>Researched</span>
                  </label>
                  <label className="control-check">
                    <input type="checkbox" checked={onlyCannotPredict} onChange={(event) => setOnlyCannotPredict(event.target.checked)} />
                    <span>Cannot predict</span>
                  </label>
                </div>
              ) : null}

              <div className="member-table-shell">
                <div className="member-table-head" aria-hidden="true">
                  <span>Member</span>
                  <span>Support</span>
                  <span>Yes</span>
                </div>
                {!forecastResult ? (
                  <div className="table-empty-state">
                    <div className="empty-rule" />
                    <strong>Member calls will appear here.</strong>
                    <p>Sort by probability or uncertainty, isolate parties, researched members, and cannot-predict cases, then open a member for the evidence trail.</p>
                  </div>
                ) : visibleMembers.length === 0 ? (
                  <div className="table-empty-state compact-empty">
                    <strong>No members match these filters.</strong>
                    <p>Clear a filter to return to the full chamber.</p>
                  </div>
                ) : (
                  <div className="member-rows">
                    {visibleMembers.map((member) => (
                      <button
                        key={member.membershipId}
                        type="button"
                        className={`member-row ${selectedMemberId === member.membershipId ? 'selected' : ''}`}
                        onClick={() => setSelectedMemberId(member.membershipId)}
                        aria-expanded={selectedMemberId === member.membershipId}
                      >
                        <span className="member-identity">
                          <strong>{member.memberName}</strong>
                          <small>{member.party} · {member.district}{member.researched ? ' · researched' : ''}</small>
                        </span>
                        <span className={`support-badge ${member.evidenceQuality}`}>{supportLabel(member.evidenceQuality)}</span>
                        <strong className={`yes-probability ${member.yesProbability === undefined ? 'withheld' : ''}`}>{formatProbability(member.yesProbability)}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedMember ? (
                <section className="member-detail" aria-label={`${selectedMember.memberName} forecast detail`}>
                  <div className="member-detail-heading">
                    <div>
                      <span className="section-kicker">Member detail</span>
                      <h4>{selectedMember.memberName} <small>{selectedMember.party} · {selectedMember.district}</small></h4>
                    </div>
                    <button type="button" className="quiet-button" onClick={() => setSelectedMemberId(null)}>Close</button>
                  </div>

                  <div className="detail-probability-line">
                    <div><span>Yes</span><strong>{formatProbability(selectedMember.yesProbability)}</strong></div>
                    <div><span>Support</span><strong>{supportLabel(selectedMember.evidenceQuality)}</strong></div>
                    <div><span>Uncertainty</span><strong>{selectedMember.uncertainty === undefined ? '—' : `${Math.round(selectedMember.uncertainty * 100)}%`}</strong></div>
                  </div>

                  {selectedMember.cannotPredictReason ? (
                    <div className="cannot-predict-note"><strong>Cannot predict</strong><span>{selectedMember.cannotPredictReason}</span></div>
                  ) : null}

                  <div className="detail-section">
                    <h5>Why this number</h5>
                    <p>{selectedMember.strongestReason}</p>
                    <dl className="support-trail">
                      <div><dt>Global history</dt><dd>{selectedMember.support.global}</dd></div>
                      <div><dt>Party history</dt><dd>{selectedMember.support.party}</dd></div>
                      <div><dt>Member history</dt><dd>{selectedMember.support.member}</dd></div>
                      <div><dt>Analogue weight</dt><dd>{selectedMember.support.analogue.toFixed(2)}</dd></div>
                    </dl>
                  </div>

                  <div className="detail-section">
                    <h5>Historical analogue</h5>
                    {selectedMember.analogue ? (
                      <div className="member-analogue">
                        <div><strong>{selectedMember.analogue.identifier}</strong><span>{selectedMember.analogue.occurredOn} · member voted {selectedMember.analogue.memberChoice === 'yea' ? 'Yes' : 'No'}</span></div>
                        <p>{selectedMember.analogue.reasons.join(' · ')}</p>
                      </div>
                    ) : <p>No direct member vote was found on the selected analogue set.</p>}
                  </div>

                  <div className="detail-section">
                    <h5>Deep research</h5>
                    {selectedMember.deepResearch ? (
                      <>
                        <div className="deep-target-note">
                          <strong>Target #{selectedMember.deepResearch.rank ?? '—'}</strong>
                          <span>{selectedMember.deepResearch.rationale}</span>
                        </div>
                        <div className="before-after">
                          <div><span>Before</span><strong>{formatProbability(selectedMember.deepResearch.probabilityBefore)}</strong></div>
                          <span aria-hidden="true">→</span>
                          <div><span>After</span><strong>{formatProbability(selectedMember.deepResearch.probabilityAfter)}</strong></div>
                        </div>
                        {selectedMember.deepResearch.evidence.length > 0 ? (
                          <div className="evidence-list">
                            {selectedMember.deepResearch.evidence.map((evidence, index) => (
                              <article key={`${evidence.sourceUrl}-${index}`} className="evidence-item">
                                <div className="evidence-meta">
                                  <span className={`disposition ${evidence.disposition}`}>{evidence.disposition}</span>
                                  <span>{evidence.kind.replaceAll('_', ' ')}</span>
                                  <span>{evidence.sourceQuality.replaceAll('_', ' ')}</span>
                                </div>
                                <strong>{evidence.claim}</strong>
                                {evidence.excerpt ? <p>“{evidence.excerpt}”</p> : null}
                                <small>{evidence.rationale}</small>
                                <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>
                              </article>
                            ))}
                          </div>
                        ) : <p>No source-backed evidence was returned for this target.</p>}
                      </>
                    ) : forecastResult?.researchMode === 'deep' ? (
                      <p>This member was not selected for Deep research; targeting was limited to the most pivotal, uncertain, under-evidenced members.</p>
                    ) : (
                      <p>Run Deep mode to target consequential uncertain members for current-source research.</p>
                    )}
                  </div>
                </section>
              ) : null}
            </article>

            <aside className="result-panel diagnostic-panel">
              <span className="section-kicker">{forecastResult?.researchMode === 'deep' ? 'Deep research' : 'Diagnostics'}</span>
              <h3>{forecastResult?.researchMode === 'deep' ? 'Research only where it matters.' : 'Evidence without the clutter.'}</h3>
              <p>
                {forecastResult
                  ? forecastResult.researchMode === 'deep'
                    ? 'Target selection, source-backed evidence, exclusions, contradictions, and chamber movement stay visible below the call.'
                    : 'Quick mode combines historical member tendencies with direct member votes on as-of-safe historical analogues. Historical backtesting shows a small member-level lift from the analogue layer, but not validated passage-odds skill.'
                  : researchMode === 'deep'
                    ? 'Deep mode ranks members by exact pivotality, uncertainty, and evidence need instead of researching the entire chamber.'
                    : 'The result view keeps model support, analogues, direct evidence, exclusions, and source provenance inspectable without crowding the chamber call.'}
              </p>
              <dl className="diagnostic-list">
                <div><dt>Target chamber</dt><dd>{forecastResult?.chamber.name ?? selectedChamber?.name ?? 'Not selected'}</dd></div>
                <div><dt>Research mode</dt><dd>{forecastResult ? forecastResult.researchMode === 'deep' ? 'Deep' : 'Quick' : researchMode === 'deep' ? 'Deep' : 'Quick'}</dd></div>
                <div><dt>As-of policy</dt><dd>Locked</dd></div>
                <div><dt>Selected analogues</dt><dd>{forecastResult?.diagnostics.selectedAnalogues ?? '—'}</dd></div>
                <div><dt>Direct member coverage</dt><dd>{forecastResult ? `${forecastResult.diagnostics.directAnalogueMembers}/${forecastResult.chamber.activeMembers}` : '—'}</dd></div>
                <div><dt>Cannot predict</dt><dd>{forecastResult?.diagnostics.cannotPredictMembers ?? '—'}</dd></div>
                {forecastResult?.research ? (
                  <>
                    <div><dt>Research targets</dt><dd>{forecastResult.research.targetCount}</dd></div>
                    <div><dt>Evidence included</dt><dd>{forecastResult.research.includedEvidenceCount}</dd></div>
                    <div><dt>Evidence excluded</dt><dd>{forecastResult.research.excludedEvidenceCount}</dd></div>
                    <div><dt>Contradictions</dt><dd>{forecastResult.research.contradictions}</dd></div>
                    <div><dt>Passage movement</dt><dd>{formatMovement(forecastResult.research.chamberPassageMovement)}</dd></div>
                  </>
                ) : null}
              </dl>

              {forecastResult?.analogues.length ? (
                <div className="diagnostic-section">
                  <h4>Strongest analogues</h4>
                  <div className="analogue-list">
                    {forecastResult.analogues.slice(0, 5).map((analogue) => (
                      <div key={analogue.voteEventId} className="analogue-row">
                        <div><strong>{analogue.identifier}</strong><span>{analogue.occurredOn} · {analogue.chamber}</span></div>
                        <small>{analogue.reasons.slice(0, 2).join(' · ')}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {forecastResult?.research?.sources.length ? (
                <div className="diagnostic-section">
                  <h4>Research sources</h4>
                  <div className="source-list">
                    {forecastResult.research.sources.slice(0, 8).map((source) => (
                      <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title || source.url} ↗</a>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>

          <footer className="provenance-bar">
            <span>Historical votes + dated as-of-safe bill analogues</span>
            <span>Source-backed Deep evidence</span>
            <span>Explicit cannot-predict</span>
          </footer>
        </section>
      </div>

      <style>{`
        .result-badges { display: flex; align-items: center; justify-content: flex-end; gap: 7px; flex-wrap: wrap; }
        .support-state { display: inline-flex; align-items: center; min-height: 30px; border-radius: 999px; padding: 5px 10px; font-size: 10px; font-weight: 760; white-space: nowrap; }
        .support-state.supported { color: var(--accent); background: var(--accent-soft); border: 1px solid #c9dbd2; }
        .support-state.partial { color: #725526; background: #f5eedf; border: 1px solid #e4d4b7; }
        .run-notice.warning { border-color: #e1d0b0; background: #f8f1e3; color: #6d5228; }
        .metric-date { font-size: 12px !important; line-height: 1.25; }
        .member-count { color: var(--muted); font-size: 10px; font-weight: 750; font-variant-numeric: tabular-nums; }
        .member-controls { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(100px, .8fr) auto auto; gap: 8px; align-items: end; padding: 10px 12px; border-bottom: 1px solid var(--line); background: #fafbf8; }
        .member-controls label { display: grid; gap: 4px; min-width: 0; color: var(--muted-light); font-size: 9px; font-weight: 720; }
        .member-controls select { min-height: 32px; padding: 5px 8px; border-radius: 8px; font-size: 10px; }
        .member-controls .control-check { display: flex; align-items: center; gap: 5px; min-height: 32px; color: var(--muted); white-space: nowrap; }
        .member-controls .control-check input { width: 14px; min-height: 14px; height: 14px; margin: 0; padding: 0; accent-color: var(--accent); }
        .member-rows { max-height: 530px; overflow: auto; }
        .member-row { display: grid; grid-template-columns: minmax(150px, 1fr) 86px 52px; gap: 12px; align-items: center; width: 100%; border: 0; border-bottom: 1px solid #edf0ed; padding: 11px 18px; color: var(--ink); background: #fff; text-align: left; transition: background 100ms ease; }
        .member-row:hover { background: #f7f9f6; }
        .member-row.selected { background: #f0f6f2; box-shadow: inset 3px 0 0 var(--accent); }
        .member-identity { display: grid; gap: 2px; min-width: 0; }
        .member-identity strong { overflow: hidden; text-overflow: ellipsis; font-size: 11px; white-space: nowrap; }
        .member-identity small { overflow: hidden; color: var(--muted-light); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
        .support-badge { justify-self: start; border-radius: 999px; padding: 4px 7px; font-size: 8.5px; font-weight: 780; }
        .support-badge.strong { color: var(--accent); background: var(--accent-soft); }
        .support-badge.moderate { color: #67532d; background: #f4eedf; }
        .support-badge.limited { color: var(--muted); background: #ecefeb; }
        .yes-probability { justify-self: end; font-size: 12px; font-variant-numeric: tabular-nums; }
        .yes-probability.withheld { color: var(--muted-light); }
        .compact-empty { padding-top: 24px; padding-bottom: 26px; }
        .member-detail { border-top: 1px solid var(--line-strong); padding: 18px; background: #fbfcf9; }
        .member-detail-heading { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
        .member-detail-heading h4 { margin: 5px 0 0; font-size: 16px; letter-spacing: -.02em; }
        .member-detail-heading h4 small { color: var(--muted); font-size: 10px; font-weight: 600; letter-spacing: 0; }
        .detail-probability-line { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; overflow: hidden; margin-top: 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--line); }
        .detail-probability-line > div { padding: 10px; background: #fff; }
        .detail-probability-line span { display: block; color: var(--muted-light); font-size: 8.5px; }
        .detail-probability-line strong { display: block; margin-top: 3px; font-size: 13px; }
        .cannot-predict-note { display: grid; gap: 3px; margin-top: 12px; border: 1px solid #ead0cb; border-radius: 9px; padding: 10px; color: var(--danger); background: var(--danger-soft); font-size: 10px; line-height: 1.4; }
        .detail-section { margin-top: 17px; padding-top: 15px; border-top: 1px solid var(--line); }
        .detail-section h5, .diagnostic-section h4 { margin: 0 0 8px; color: var(--ink-soft); font-size: 10px; font-weight: 820; letter-spacing: .04em; text-transform: uppercase; }
        .detail-section > p { margin: 0; color: var(--muted); font-size: 10.5px; line-height: 1.5; }
        .support-trail { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 11px 0 0; }
        .support-trail > div { border: 1px solid var(--line); border-radius: 8px; padding: 8px; background: #fff; }
        .support-trail dt { color: var(--muted-light); font-size: 8px; }
        .support-trail dd { margin: 3px 0 0; font-size: 11px; font-weight: 760; font-variant-numeric: tabular-nums; }
        .member-analogue { display: grid; gap: 6px; border-left: 2px solid #b9cabf; padding-left: 10px; }
        .member-analogue > div { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
        .member-analogue strong { font-size: 11px; }
        .member-analogue span { color: var(--muted); font-size: 9px; text-align: right; }
        .member-analogue p { margin: 0; color: var(--muted); font-size: 9.5px; line-height: 1.45; }
        .deep-target-note { display: grid; gap: 4px; border-radius: 9px; padding: 10px; background: var(--deep-soft); color: var(--deep); font-size: 9.5px; line-height: 1.45; }
        .before-after { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; margin-top: 9px; }
        .before-after > div { border: 1px solid var(--line); border-radius: 8px; padding: 8px; background: #fff; }
        .before-after span { color: var(--muted-light); font-size: 8px; }
        .before-after strong { display: block; margin-top: 2px; font-size: 12px; }
        .evidence-list { display: grid; gap: 8px; margin-top: 10px; }
        .evidence-item { display: grid; gap: 6px; border: 1px solid var(--line); border-radius: 9px; padding: 10px; background: #fff; }
        .evidence-meta { display: flex; flex-wrap: wrap; gap: 5px 8px; align-items: center; color: var(--muted-light); font-size: 8px; text-transform: capitalize; }
        .disposition { border-radius: 999px; padding: 3px 6px; font-weight: 800; }
        .disposition.included { color: var(--accent); background: var(--accent-soft); }
        .disposition.excluded { color: var(--muted); background: #ecefeb; }
        .evidence-item > strong { font-size: 10.5px; line-height: 1.4; }
        .evidence-item > p { margin: 0; color: var(--ink-soft); font-size: 9.5px; line-height: 1.45; }
        .evidence-item > small { color: var(--muted); font-size: 8.5px; line-height: 1.4; }
        .evidence-item > a { justify-self: start; color: var(--accent); font-size: 9px; font-weight: 750; text-decoration: none; }
        .evidence-item > a:hover { text-decoration: underline; }
        .diagnostic-section { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); }
        .analogue-list, .source-list { display: grid; gap: 7px; }
        .analogue-row { display: grid; gap: 3px; }
        .analogue-row > div { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .analogue-row strong { font-size: 9.5px; }
        .analogue-row span { color: var(--muted-light); font-size: 8px; text-align: right; }
        .analogue-row small { color: var(--muted); font-size: 8.5px; line-height: 1.35; }
        .source-list a { overflow: hidden; color: var(--accent); font-size: 8.5px; font-weight: 680; line-height: 1.35; text-decoration: none; text-overflow: ellipsis; }
        .source-list a:hover { text-decoration: underline; }
        @media (max-width: 1180px) {
          .member-controls { grid-template-columns: 1fr 1fr; }
          .control-check { justify-self: start; }
        }
        @media (max-width: 560px) {
          .result-badges { display: none; }
          .member-controls { grid-template-columns: 1fr 1fr; padding-left: 10px; padding-right: 10px; }
          .member-row { grid-template-columns: minmax(120px, 1fr) 68px 42px; padding-left: 14px; padding-right: 14px; }
          .support-badge { padding-left: 5px; padding-right: 5px; }
          .detail-probability-line { grid-template-columns: 1fr 1fr 1fr; }
          .support-trail { grid-template-columns: 1fr 1fr; }
          .member-analogue > div { display: grid; gap: 2px; }
          .member-analogue span { text-align: left; }
        }
      `}</style>
    </main>
  );
}
