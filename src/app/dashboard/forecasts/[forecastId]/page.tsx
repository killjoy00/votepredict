import { notFound } from 'next/navigation';
import { ForecastWorkflowError, getForecastDetail } from '@/forecasting/workflows';
import { requireOwner } from '@/lib/auth/guard';
import { ForecastWorkflowDesk } from './forecast-workflow-desk';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ forecastId: string }> };

function probability(value: number | undefined) {
  return value === undefined ? '—' : `${Math.round(value * 100)}%`;
}

export default async function ForecastWorkflowPage({ params }: PageProps) {
  const user = await requireOwner();
  const { forecastId } = await params;
  let detail;
  try {
    detail = await getForecastDetail(forecastId, user.id);
  } catch (error) {
    if (error instanceof ForecastWorkflowError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  const latest = detail.revisions[0];

  return (
    <main className="forecast-shell">
      <header className="forecast-header">
        <a href="/dashboard/forecasts">← Forecast history</a>
        <div className="forecast-heading">
          <span className="kicker">{detail.targetType === 'bill' ? 'Official bill forecast' : 'Proposal forecast'}</span>
          <h1>{detail.targetLabel}</h1>
          <p>{detail.chamberName} · {detail.revisions.length} saved revision{detail.revisions.length === 1 ? '' : 's'}</p>
        </div>
        <div className="latest-call"><span>Floor estimate</span><strong>{probability(latest?.passageProbability)}</strong><small>{latest ? `uncalibrated · r${latest.revisionNumber} · ${latest.researchMode === 'deep' ? 'Deep' : 'Quick'}` : 'No revision'}</small></div>
      </header>

      <ForecastWorkflowDesk detail={detail} />

      <style>{`
        :global(body) { background: #f5f6f2; }
        .forecast-shell { width: min(1120px, calc(100% - 28px)); margin: 0 auto; padding: 24px 0 60px; color: #17201b; }
        .forecast-header { display: grid; grid-template-columns: 130px minmax(0, 1fr) 130px; gap: 26px; align-items: start; margin-bottom: 20px; }
        .forecast-header > a { color: #506559; font-size: 9.5px; font-weight: 760; text-decoration: none; }
        .forecast-heading .kicker { color: #7c867f; font-size: 8px; font-weight: 820; letter-spacing: .08em; text-transform: uppercase; }
        .forecast-heading h1 { margin: 5px 0 6px; font-size: clamp(22px, 4vw, 34px); line-height: 1.08; letter-spacing: -.04em; }
        .forecast-heading p { margin: 0; color: #737d76; font-size: 10px; }
        .latest-call { text-align: right; }
        .latest-call span, .latest-call small { display: block; color: #7d8780; font-size: 8px; }
        .latest-call strong { display: block; margin: 4px 0; font-size: 32px; line-height: 1; letter-spacing: -.04em; }
        @media (max-width: 680px) {
          .forecast-shell { width: min(100% - 18px, 1120px); padding-top: 14px; }
          .forecast-header { grid-template-columns: 1fr auto; gap: 16px; }
          .forecast-header > a { grid-column: 1 / -1; }
          .latest-call { align-self: end; }
        }
      `}</style>
    </main>
  );
}
