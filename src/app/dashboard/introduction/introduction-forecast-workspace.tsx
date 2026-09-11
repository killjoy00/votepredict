'use client';

import { useEffect, useState } from 'react';

type BillResult = { id: string; identifier: string; title: string; status: string | null; sourceUrl: string | null };
type IntroductionForecast = {
  targetKind: 'source_chamber_passage';
  modelVersion: 'intro-title-text-eb-v4';
  probability: number;
  asOfIntroduction: string;
  bill: { id: string; identifier: string; title: string };
  sourceChamber: { id: string; slug: 'house' | 'senate'; name: string };
  model: {
    trainingBills: number;
    trainingPasses: number;
    historicalBaseRate: number;
    trainingSessions: string[];
    initialTextAvailableAtIntroduction: boolean;
    purposeTextOnly: true;
  };
};

const pct = (value: number) => `${value * 100 < 10 ? (value * 100).toFixed(1) : (value * 100).toFixed(0)}%`;
const date = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(parsed);
};

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
        if ((caught as Error).name !== 'AbortError') setError('Could not search the current Minnesota bill store.');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 240);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, selected]);

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

  return (
    <main className="intro-shell">
      <header className="intro-header">
        <a href="/dashboard">← Forecast desk</a>
        <span className="kicker">Validated introduction model · v4</span>
        <h1>Will it pass its originating chamber?</h1>
        <p>Probability measured at introduction, before later legislative activity can leak into the forecast.</p>
      </header>

      <div className="intro-grid">
        <section className="panel search-panel">
          <span className="kicker">Official Minnesota bill</span>
          <h2>Find a bill</h2>
          <label htmlFor="intro-search">Bill number or title</label>
          <div className="search-box">
            <input
              id="intro-search"
              value={query}
              placeholder="HF 1234 or a few words"
              autoComplete="off"
              onChange={(event) => {
                const next = event.target.value;
                setQuery(next);
                if (selected && next.trim() !== selected.identifier) setSelected(null);
                setForecast(null);
                setError(null);
              }}
            />
            <small>{searching ? 'Searching…' : ''}</small>
          </div>
          {results.length > 0 && (
            <div className="matches">
              {results.map((bill) => (
                <button key={bill.id} type="button" onClick={() => {
                  setSelected(bill);
                  setQuery(bill.identifier);
                  setResults([]);
                  setForecast(null);
                  setError(null);
                }}>
                  <strong>{bill.identifier}</strong><span>{bill.title}</span>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="selected">
              <small>Selected</small><strong>{selected.identifier}</strong><p>{selected.title}</p>
              {selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Official source ↗</a>}
            </div>
          )}
          <button className="run" type="button" disabled={!selected || running} onClick={runForecast}>
            <span>{running ? 'Running v4…' : 'Run introduction forecast'}</span><span>→</span>
          </button>
          {error && <p className="error" role="alert">{error}</p>}
        </section>

        <section className="panel result-panel">
          {!forecast ? (
            <div className="empty"><span className="kicker">Source-chamber passage</span><strong>Choose a bill to score.</strong><p>v4 uses only introduction-time information.</p></div>
          ) : (
            <>
              <div className="result-head"><div><span className="kicker">{forecast.bill.identifier} · {forecast.sourceChamber.name}</span><h2>Originating-chamber passage</h2></div><b>v4</b></div>
              <div className="probability">{pct(forecast.probability)}</div>
              <p className="definition">Probability, assessed at introduction, that this bill eventually passes its originating chamber. This is not conditional on reaching a floor vote and is not an enactment probability.</p>
              <dl className="facts">
                <div><dt>As of</dt><dd>{date(forecast.asOfIntroduction)}</dd></div>
                <div><dt>Source chamber</dt><dd>{forecast.sourceChamber.name}</dd></div>
                <div><dt>Training bills</dt><dd>{forecast.model.trainingBills.toLocaleString()}</dd></div>
                <div><dt>Historical base rate</dt><dd>{pct(forecast.model.historicalBaseRate)}</dd></div>
              </dl>
              <div className="method">
                <span className="kicker">What the model sees</span>
                <p>Official Revisor title plus the zero-engrossment opening purpose statement, with strongly shrunk empirical-Bayes token effects. Training is limited to earlier biennia only.</p>
                <div><span>{forecast.model.trainingSessions.join(' + ')}</span><span>{forecast.model.initialTextAvailableAtIntroduction ? 'Initial text available' : 'Title-only fallback'}</span><span>{forecast.modelVersion}</span></div>
              </div>
            </>
          )}
        </section>
      </div>

      <aside className="validation"><strong>Validated before promotion.</strong> On the locked 2023–26 chronological holdout, v4 improved Brier score, log loss, calibration error, average precision, and ROC-AUC overall. The existing floor-vote model remains separate because it answers a different question.</aside>

      <style>{`
        .intro-shell{min-height:100vh;padding:36px clamp(16px,5vw,70px) 70px;background:#f4f6f1;color:#18241d}.intro-header,.intro-grid,.validation{max-width:1120px;margin-left:auto;margin-right:auto}.intro-header>a{display:block;margin-bottom:28px;color:#456753;font-size:12px;font-weight:750;text-decoration:none}.kicker{display:block;color:#75837a;font-size:9px;font-weight:850;letter-spacing:.1em;text-transform:uppercase}.intro-header h1{max-width:780px;margin:8px 0 10px;font-size:clamp(36px,5vw,62px);line-height:.98;letter-spacing:-.045em}.intro-header>p{max-width:700px;margin:0 0 26px;color:#607067;font-size:13px;line-height:1.55}.intro-grid{display:grid;grid-template-columns:minmax(300px,.8fr) minmax(420px,1.2fr);gap:16px}.panel,.validation{border:1px solid #d6ddd7;border-radius:17px;background:rgba(255,255,255,.9);box-shadow:0 16px 55px rgba(36,60,45,.07)}.panel{padding:24px}.panel h2{margin:5px 0 18px;font-size:21px;letter-spacing:-.02em}.search-panel label{display:block;margin-bottom:7px;color:#56685d;font-size:10px;font-weight:800}.search-box{position:relative}.search-box input{box-sizing:border-box;width:100%;height:45px;border:1px solid #c8d2ca;border-radius:10px;padding:0 100px 0 12px;background:#fff;font:inherit;font-size:12px;outline:none}.search-box input:focus{border-color:#5d806a;box-shadow:0 0 0 3px rgba(70,111,84,.12)}.search-box small{position:absolute;right:11px;top:15px;color:#829087;font-size:9px}.matches{display:grid;gap:4px;margin-top:7px}.matches button{display:grid;gap:2px;border:1px solid #e0e5e1;border-radius:8px;padding:9px 10px;background:#fff;color:inherit;text-align:left;cursor:pointer}.matches button:hover{background:#f4f7f4}.matches strong{font-size:10px}.matches span{overflow:hidden;color:#67756d;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.selected{margin-top:14px;border-left:3px solid #52735f;padding-left:11px}.selected small{display:block;color:#7c8981;font-size:8px;font-weight:850;text-transform:uppercase}.selected strong{display:block;margin-top:2px;font-size:13px}.selected p{margin:4px 0;color:#5d6d63;font-size:10px;line-height:1.45}.selected a{color:#456b55;font-size:9px;font-weight:750;text-decoration:none}.run{display:flex;justify-content:space-between;width:100%;margin-top:20px;border:0;border-radius:10px;padding:12px 13px;background:#28503a;color:#fff;font-size:11px;font-weight:800;cursor:pointer}.run:disabled{opacity:.42;cursor:not-allowed}.error{margin:9px 0 0;color:#9a4138;font-size:10px;line-height:1.4}.result-panel{min-height:390px}.empty{display:grid;place-content:center;min-height:340px;text-align:center}.empty strong{margin-top:10px;font-size:23px}.empty p{margin:6px 0 0;color:#6b786f;font-size:11px}.result-head{display:flex;justify-content:space-between;align-items:start;gap:16px}.result-head b{border-radius:999px;padding:5px 8px;background:#e4eee7;color:#315b43;font-size:9px}.probability{margin-top:4px;font-size:clamp(70px,9vw,108px);font-weight:830;line-height:.9;letter-spacing:-.07em;font-variant-numeric:tabular-nums}.definition{max-width:650px;margin:14px 0 0;color:#5f6f65;font-size:10.5px;line-height:1.55}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;overflow:hidden;margin:22px 0 0;border:1px solid #dfe5e0;border-radius:10px;background:#dfe5e0}.facts>div{padding:10px;background:#fff}.facts dt{color:#7d8a82;font-size:8px}.facts dd{margin:3px 0 0;font-size:10px;font-weight:800}.method{margin-top:20px;padding-top:15px;border-top:1px solid #e1e6e2}.method p{margin:6px 0 9px;color:#5f6f65;font-size:10px;line-height:1.5}.method>div{display:flex;flex-wrap:wrap;gap:5px}.method>div span{border:1px solid #d9e0da;border-radius:999px;padding:4px 7px;color:#5c6c62;font-size:8.5px}.validation{margin-top:16px;padding:16px 20px;color:#66756c;font-size:10px;line-height:1.5}.validation strong{color:#23342a}@media(max-width:800px){.intro-grid{grid-template-columns:1fr}.result-panel{min-height:0}.empty{min-height:200px}.facts{grid-template-columns:1fr 1fr}}@media(max-width:520px){.intro-shell{padding-top:24px}.intro-header h1{font-size:40px}.panel{padding:19px}.probability{font-size:72px}}
      `}</style>
    </main>
  );
}
