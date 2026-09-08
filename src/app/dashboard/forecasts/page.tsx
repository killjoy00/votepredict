import { requireOwner } from '@/lib/auth/guard';
import { listOwnedForecasts } from '@/forecasting/forecast-list';

export const dynamic = 'force-dynamic';

function probability(value: number | undefined) {
  return value === undefined ? '—' : `${Math.round(value * 100)}%`;
}

export default async function ForecastHistoryPage() {
  const user = await requireOwner();
  const forecasts = await listOwnedForecasts(user.id);

  return (
    <main className="history-shell">
      <header className="history-header">
        <a className="back" href="/dashboard">← Forecast desk</a>
        <div><span className="kicker">Private history</span><h1>Saved forecasts</h1><p>Every update stays under the same forecast identity as an immutable revision.</p></div>
      </header>

      <section className="history-list">
        {forecasts.length === 0 ? (
          <div className="empty"><strong>No saved forecasts yet.</strong><p>Run a forecast from the desk to start a revision history.</p></div>
        ) : forecasts.map((forecast) => (
          <a className="forecast-row" href={`/dashboard/forecasts/${forecast.id}`} key={forecast.id}>
            <div className="forecast-title"><span>{forecast.targetType === 'bill' ? 'Official' : 'Proposal'}</span><strong>{forecast.targetLabel}</strong><small>{forecast.chamberName} · updated {new Date(forecast.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div>
            <div><span>Latest</span><strong>{forecast.latestRevisionNumber ? `r${forecast.latestRevisionNumber}` : '—'}</strong></div>
            <div><span>Mode</span><strong>{forecast.latestResearchMode ? forecast.latestResearchMode === 'deep' ? 'Deep' : 'Quick' : '—'}</strong></div>
            <div><span>Floor estimate</span><strong>{probability(forecast.latestPassageProbability)}</strong></div>
            <div className="arrow" aria-hidden="true">→</div>
          </a>
        ))}
      </section>

      <style>{`
        :global(body) { background: #f5f6f2; }
        .history-shell { width: min(1050px, calc(100% - 28px)); margin: 0 auto; padding: 30px 0 60px; color: #17201b; }
        .history-header { display: grid; grid-template-columns: 150px 1fr; gap: 30px; align-items: start; margin-bottom: 24px; }
        .back { color: #476052; font-size: 10px; font-weight: 750; text-decoration: none; }
        .kicker { color: #7b857e; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        h1 { margin: 5px 0 6px; font-size: 32px; letter-spacing: -.04em; }
        .history-header p { margin: 0; color: #6e7871; font-size: 11px; }
        .history-list { overflow: hidden; border: 1px solid #dce1dc; border-radius: 14px; background: #fff; }
        .forecast-row { display: grid; grid-template-columns: minmax(260px, 1fr) 70px 70px 80px 22px; gap: 18px; align-items: center; padding: 15px 18px; border-bottom: 1px solid #edf0ed; color: inherit; text-decoration: none; }
        .forecast-row:last-child { border-bottom: 0; }
        .forecast-row:hover { background: #f9faf7; }
        .forecast-title { display: grid; gap: 3px; min-width: 0; }
        .forecast-title > span { color: #7c867f; font-size: 8px; font-weight: 800; text-transform: uppercase; }
        .forecast-title strong { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
        .forecast-title small { color: #858e88; font-size: 8.5px; }
        .forecast-row > div:not(.forecast-title):not(.arrow) span { display: block; color: #89918c; font-size: 8px; }
        .forecast-row > div:not(.forecast-title):not(.arrow) strong { display: block; margin-top: 3px; font-size: 11px; }
        .arrow { justify-self: end; color: #62816d; }
        .empty { padding: 36px 24px; text-align: center; }
        .empty p { color: #7e8881; font-size: 10px; }
        @media (max-width: 650px) {
          .history-shell { width: min(100% - 18px, 1050px); padding-top: 18px; }
          .history-header { grid-template-columns: 1fr; gap: 18px; }
          .forecast-row { grid-template-columns: minmax(0, 1fr) 55px 52px 18px; gap: 9px; padding-left: 12px; padding-right: 12px; }
          .forecast-row > div:nth-of-type(3) { display: none; }
        }
      `}</style>
    </main>
  );
}
