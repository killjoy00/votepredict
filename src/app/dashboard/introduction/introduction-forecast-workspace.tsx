'use client';

import { useEffect, useState } from 'react';

type BillResult = {
  id: string;
  identifier: string;
  title: string;
  status: string | null;
  sourceUrl: string | null;
};

type IntroductionForecast = {
  targetKind: 'source_chamber_passage';
  modelVersion: 'intro-title-text-eb-v4';
  probability: number;
  asOfIntroduction: string;
  bill: {
    id: string;
    identifier: string;
    title: string;
  };
  sourceChamber: {
    id: string;
    slug: 'house' | 'senate';
    name: string;
  };
  model: {
    trainingBills: number;
    trainingPasses: number;
    historicalBaseRate: number;
    trainingSessions: string[];
    initialTextAvailableAtIntroduction: boolean;
    purposeTextOnly: true;
  };
};

function formatProbability(value: number): string {
  const points = value * 100;
  return `${points < 10 ? points.toFixed(1) : points.toFixed(0)}%`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

export function IntroductionForecastWorkspace() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BillResult[]>([]);
  const [selected, setSelected] = useState<BillResult | null>(null);
  const [forecast, setForecast] = useState<IntroductionForecast | null>(null);
  const [searching, setSearching] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2 || selected?.identifier === query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const response = await fetch(`/api/bills/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Bill search failed.');
        const payload = await response.json() as { bills?: BillResult[] };
        setResults(payload.bills ?? []);
      } catch (caught) {
        if ((caught as Error).name !== 'AbortError') {
          setError('Could not search the current Minnesota bill store.');
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 240);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, selected]);

  function chooseBill(bill: BillResult) {
    setSelected(bill);
    setQuery(bill.identifier);
    setResults([]);
    setForecast(null);
    setError(null);
  }

  async function runForecast() {
    if (!selected || running) return;
    setRunning(true);
    setForecast(null);
    setError(null);
    try {
      const response = await fetch('/api/introduction-forecast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ billId: selected.id }),
      });
      const payload = await response.json() as { result?: IntroductionForecast; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || 'Could not run introduction forecast.');
      setForecast(payload.result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not run introduction forecast.');
    } finally {
      setRunning(false);
    }
  }

  const probabilityCall = !forecast
    ? null
    : forecast.probability >= 0.1
      ? 'Meaningfully above the historical introduction baseline.'
      : forecast.probability >= 0.04
        ? 'Above the historical introduction baseline.'
        : 'Most introduced bills do not pass their originating chamber.';

  return (
    <main className="intro-shell">
      <header className="intro-header">
        <a href="/dashboard" className="back-link">← Forecast desk</a>
        <div>
          <span className="eyebrow">VotePredict · validated introduction model</span>
          <h1>Will it pass its originating chamber?</h1>
          <p>Probability measured at introduction, before committees, amendments, floor scheduling, or later legislative signals can leak into the forecast.</p>
        </div>
      </header>

      <section className="intro-grid">
        <article className="search-card">
          <span className="eyebrow">Official Minnesota bill</span>
          <h2>Find a bill</h2>
          <label htmlFor="intro-bill-search">Bill number or title</label>
          <div className="search-wrap">
            <input
              id="intro-bill-search"
              value={query}
              onChange={(event) => {
                const next = event.target.value;
                setQuery(next);
                if (selected && next.trim() !== selected.identifier) setSelected(null);
                setForecast(null);
                setError(null);
              }}
              placeholder="HF 1234 or a few words"
              autoComplete="off"
            />
            <span>{searching ? 'Searching…' : ''}</span>
          </div>

          {results.length > 0 ? (
            <div className="result-list" role="listbox" aria-label="Bill search results">
              {results.map((bill) => (
                <button key={bill.id} type="button" onClick={() => chooseBill(bill)}>
                  <strong>{bill.identifier}</strong>
                  <span>{bill.title}</span>
                </button>
              ))}
            </div>
          ) : null}

          {selected ? (
            <div className="selected-bill">
              <span>Selected</span>
              <strong>{selected.identifier}</strong>
              <p>{selected.title}</p>
              {selected.sourceUrl ? <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Official source ↗</a> : null}
            </div>
          ) : null}

          <button className="run-button" type="button" disabled={!selected || running} onClick={runForecast}>
            {running ? 'Running introduction model…' : 'Run introduction forecast'} <span aria-hidden="true">→</span>
          </button>
          {error ? <p className="error" role="alert">{error}</p> : null}
        </article>

        <article className={`forecast-card ${forecast ? 'ready' : ''}`}>
          {!forecast ? (
            <div className="empty">
              <span className="eyebrow">Source-chamber passage</span>
              <strong>Choose an official bill.</strong>
              <p>The model will use only information that was available when that bill was introduced.</p>
            </div>
          ) : (
            <>
              <div className="forecast-heading">
                <div>
                  <span className="eyebrow">{forecast.bill.identifier} · {forecast.sourceChamber.name}</span>
                  <h2>Originating-chamber passage</h2>
                </div>
                <span className="model-chip">v4</span>
              </div>
              <div className="probability">{formatProbability(forecast.probability)}</div>
              <p className="call">{probabilityCall}</p>
              <p className="definition">This means the probability, assessed at introduction, that the bill eventually passes its originating chamber. It is not conditional on reaching a floor vote and it is not an enactment probability.</p>

              <dl className="facts">
                <div><dt>As of</dt><dd>{formatDate(forecast.asOfIntroduction)}</dd></div>
                <div><dt>Source chamber</dt><dd>{forecast.sourceChamber.name}</dd></div>
                <div><dt>Historical training bills</dt><dd>{forecast.model.trainingBills.toLocaleString()}</dd></div>
                <div><dt>Historical base rate</dt><dd>{formatProbability(forecast.model.historicalBaseRate)}</dd></div>
              </dl>

              <div className="method">
                <span className="eyebrow">What v4 uses</span>
                <p>Official Revisor title plus the zero-engrossment opening purpose statement, with strongly shrunk empirical-Bayes token effects. Training is limited to earlier biennia only.</p>
                <div className="method-tags">
                  <span>{forecast.model.trainingSessions.join(' + ')}</span>
                  <span>{forecast.model.initialTextAvailableAtIntroduction ? 'Initial text available at introduction' : 'Title-only fallback'}</span>
                  <span>{forecast.modelVersion}</span>
                </div>
              </div>
            </>
          )}
        </article>
      </section>

      <section className="validation-note">
        <strong>Why this is the production introduction model</strong>
        <p>On the locked 2023–26 chronological holdout, v4 beat the title-only v1 model on Brier score, log loss, calibration error, average precision, and ROC-AUC overall. The floor-vote model remains separate because it answers a different question.</p>
      </section>

      <style>{`
        .intro-shell { min-height: 100vh; padding: 42px clamp(18px, 5vw, 72px) 70px; background: #f4f6f1; color: #17231c; }
        .intro-header { max-width: 1160px; margin: 0 auto 26px; }
        .back-link { display: inline-block; margin-bottom: 30px; color: #496557; font-size: 12px; font-weight: 750; text-decoration: none; }
        .eyebrow { color: #6d7e74; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
        .intro-header h1 { max-width: 760px; margin: 8px 0 10px; font-size: clamp(34px, 5vw, 62px); line-height: .98; letter-spacing: -.045em; }
        .intro-header p { max-width: 740px; margin: 0; color: #607066; font-size: 14px; line-height: 1.55; }
        .intro-grid { display: grid; grid-template-columns: minmax(320px, .8fr) minmax(420px, 1.2fr); gap: 18px; max-width: 1160px; margin: 0 auto; }
        .search-card, .forecast-card, .validation-note { border: 1px solid #d4dbd5; border-radius: 18px; background: rgba(255,255,255,.88); box-shadow: 0 18px 60px rgba(40,61,49,.07); }
        .search-card { padding: 24px; }
        .search-card h2, .forecast-heading h2 { margin: 5px 0 20px; font-size: 22px; letter-spacing: -.025em; }
        .search-card label { display: block; margin-bottom: 7px; color: #526459; font-size: 11px; font-weight: 750; }
        .search-wrap { position: relative; }
        .search-wrap input { box-sizing: border-box; width: 100%; min-height: 46px; border: 1px solid #c8d1ca; border-radius: 11px; padding: 0 110px 0 13px; background: white; color: #17231c; font: inherit; font-size: 13px; outline: none; }
        .search-wrap input:focus { border-color: #668873; box-shadow: 0 0 0 3px rgba(80,118,94,.12); }
        .search-wrap > span { position: absolute; right: 12px; top: 15px; color: #7c8981; font-size: 10px; }
        .result-list { display: grid; gap: 5px; margin-top: 7px; }
        .result-list button { display: grid; gap: 3px; width: 100%; border: 1px solid #e0e5e1; border-radius: 9px; padding: 10px 11px; background: #fff; color: inherit; text-align: left; cursor: pointer; }
        .result-list button:hover { background: #f5f8f5; }
        .result-list strong { font-size: 11px; }
        .result-list span { overflow: hidden; color: #67756d; font-size: 10px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
        .selected-bill { margin-top: 14px; border-left: 3px solid #567663; padding: 4px 0 4px 12px; }
        .selected-bill > span { display: block; color: #7a887f; font-size: 9px; font-weight: 800; text-transform: uppercase; }
        .selected-bill > strong { display: block; margin-top: 2px; font-size: 14px; }
        .selected-bill p { margin: 5px 0; color: #56675d; font-size: 11px; line-height: 1.45; }
        .selected-bill a { color: #446854; font-size: 10px; font-weight: 750; text-decoration: none; }
        .run-button { display: flex; justify-content: space-between; width: 100%; margin-top: 22px; border: 0; border-radius: 11px; padding: 13px 14px; background: #264d38; color: white; font-size: 12px; font-weight: 800; cursor: pointer; }
        .run-button:disabled { opacity: .45; cursor: not-allowed; }
        .error { margin: 10px 0 0; color: #9c3e35; font-size: 11px; line-height: 1.45; }
        .forecast-card { min-height: 420px; padding: 28px; }
        .forecast-card.ready { background: #fbfdf9; }
        .empty { display: grid; place-content: center; min-height: 360px; text-align: center; }
        .empty strong { margin-top: 12px; font-size: 24px; }
        .empty p { max-width: 360px; margin: 8px auto 0; color: #69776e; font-size: 12px; line-height: 1.5; }
        .forecast-heading { display: flex; justify-content: space-between; gap: 20px; align-items: start; }
        .model-chip { border-radius: 999px; padding: 6px 9px; color: #315a43; background: #e4eee7; font-size: 10px; font-weight: 850; }
        .probability { margin-top: 4px; font-size: clamp(66px, 9vw, 110px); font-weight: 820; line-height: .9; letter-spacing: -.07em; font-variant-numeric: tabular-nums; }
        .call { margin: 14px 0 0; color: #315a43; font-size: 13px; font-weight: 760; }
        .definition { max-width: 660px; margin: 8px 0 0; color: #637268; font-size: 11px; line-height: 1.55; }
        .facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; overflow: hidden; margin: 24px 0 0; border: 1px solid #dfe5e0; border-radius: 11px; background: #dfe5e0; }
        .facts > div { padding: 11px; background: white; }
        .facts dt { color: #7b8980; font-size: 8.5px; }
        .facts dd { margin: 3px 0 0; font-size: 11px; font-weight: 780; }
        .method { margin-top: 22px; border-top: 1px solid #e0e5e1; padding-top: 17px; }
        .method p { max-width: 680px; margin: 7px 0 10px; color: #5d6e63; font-size: 11px; line-height: 1.55; }
        .method-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .method-tags span { border: 1px solid #d9e0da; border-radius: 999px; padding: 5px 8px; color: #55675c; background: #fff; font-size: 9px; }
        .validation-note { max-width: 1110px; margin: 18px auto 0; padding: 18px 24px; }
        .validation-note strong { font-size: 11px; }
        .validation-note p { margin: 5px 0 0; color: #66756c; font-size: 10.5px; line-height: 1.5; }
        @media (max-width: 820px) {
          .intro-shell { padding-top: 26px; }
          .intro-grid { grid-template-columns: 1fr; }
          .forecast-card { min-height: 0; }
          .empty { min-height: 220px; }
          .facts { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 520px) {
          .intro-header h1 { font-size: 40px; }
          .search-card, .forecast-card { padding: 20px; border-radius: 15px; }
          .probability { font-size: 72px; }
        }
      `}</style>
    </main>
  );
}
