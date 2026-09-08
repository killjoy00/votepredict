import { notFound } from 'next/navigation';
import { loadSharedRevision } from '@/forecasting/workflows';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ token: string }> };

function probability(value: number | undefined) {
  if (value === undefined) return '—';
  if (value >= 0.995) return '>99%';
  if (value <= 0.005) return '<1%';
  return `${Math.round(value * 100)}%`;
}

function number(value: number | undefined) {
  return value === undefined ? '—' : value.toFixed(1);
}

export default async function SharedForecastPage({ params }: PageProps) {
  const { token } = await params;
  const shared = await loadSharedRevision(token);
  if (!shared) notFound();

  return (
    <main className="share-shell">
      <header className="share-header">
        <div className="share-brand"><span>VP</span><strong>VotePredict</strong></div>
        <span className="share-label">Read-only revision</span>
      </header>

      <section className="share-hero">
        <div>
          <span className="kicker">{shared.targetType === 'bill' ? 'Official bill forecast' : 'Proposal forecast'}</span>
          <h1>{shared.targetLabel}</h1>
          <p>{shared.chamberName} · revision {shared.revision.number} · {shared.revision.researchMode === 'deep' ? 'Deep' : 'Quick'}</p>
        </div>
        <div className="hero-probability">
          <span>Floor passage estimate · uncalibrated</span>
          <strong>{probability(shared.revision.passageProbability)}</strong>
        </div>
      </section>
      <p className="forecast-caveat">Conditional on the measure reaching this chamber&apos;s floor. This is not an enactment probability or calibrated wagering odds.</p>

      <section className="metrics" aria-label="Forecast metrics">
        <div><span>Expected Yes</span><strong>{number(shared.revision.expectedYes)}</strong></div>
        <div><span>Vote range (uncalibrated)</span><strong>{shared.revision.yesLow === undefined || shared.revision.yesHigh === undefined ? '—' : `${shared.revision.yesLow}–${shared.revision.yesHigh}`}</strong></div>
        <div><span>As of</span><strong>{shared.revision.generatedAt ? new Date(shared.revision.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</strong></div>
        <div><span>Model</span><strong>{shared.revision.modelVersion ?? '—'}</strong></div>
      </section>

      <section className="member-section">
        <div className="member-heading">
          <div><span className="kicker">Members</span><h2>Vote probabilities</h2></div>
          <span>{shared.members.length} members</span>
        </div>
        <div className="member-table">
          <div className="member-row member-head"><span>Member</span><span>Support</span><span>Yes</span></div>
          {shared.members.map((member) => (
            <div className="member-row" key={`${member.memberName}-${member.district}`}>
              <div className="member-name"><strong>{member.memberName}</strong><small>{member.party} · {member.district}</small>{member.reasoningSummary ? <p>{member.reasoningSummary}</p> : null}</div>
              <span className="quality">{member.evidenceQuality.replace('_', ' ')}</span>
              <strong className="member-probability">{probability(member.yesProbability)}</strong>
              {member.cannotPredictReason ? <div className="cannot-predict">Cannot predict: {member.cannotPredictReason}</div> : null}
            </div>
          ))}
        </div>
      </section>

      <footer>This link exposes only this saved revision. It does not grant access to the private VotePredict workspace. The passage estimate is experimental and the vote range is not historically calibrated.</footer>

      <style>{`
        :global(body) { margin: 0; background: #f5f6f2; color: #17201b; font-family: Arial, Helvetica, sans-serif; }
        .share-shell { width: min(960px, calc(100% - 28px)); margin: 0 auto; padding: 24px 0 48px; }
        .share-header { display: flex; align-items: center; justify-content: space-between; padding: 2px 2px 20px; }
        .share-brand { display: flex; align-items: center; gap: 8px; font-size: 13px; }
        .share-brand span { display: grid; place-items: center; width: 27px; height: 27px; border-radius: 8px; background: #1f5d45; color: white; font-size: 9px; font-weight: 800; }
        .share-label { border: 1px solid #d8ddd8; border-radius: 999px; padding: 6px 10px; color: #5f6a63; background: #fff; font-size: 10px; font-weight: 700; }
        .share-hero { display: grid; grid-template-columns: minmax(0, 1fr) 210px; gap: 28px; align-items: end; border: 1px solid #dce1dc; border-radius: 16px 16px 0 0; padding: 28px; background: #fff; }
        .kicker { color: #738077; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        h1 { margin: 7px 0 8px; font-size: clamp(22px, 4vw, 38px); line-height: 1.08; letter-spacing: -.04em; }
        .share-hero p { margin: 0; color: #6a746d; font-size: 11px; }
        .hero-probability { text-align: right; }
        .hero-probability span { display: block; color: #758078; font-size: 9px; }
        .hero-probability strong { display: block; margin-top: 5px; font-size: 46px; line-height: 1; letter-spacing: -.05em; }
        .forecast-caveat { margin: -8px 0 18px; color: #68736c; font-size: 10px; }
        .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; border: 1px solid #dce1dc; border-top: 0; background: #dce1dc; }
        .metrics div { padding: 14px 18px; background: #fbfcfa; }
        .metrics span { display: block; color: #7b857e; font-size: 8px; }
        .metrics strong { display: block; margin-top: 4px; font-size: 12px; }
        .member-section { margin-top: 20px; overflow: hidden; border: 1px solid #dce1dc; border-radius: 14px; background: #fff; }
        .member-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; padding: 18px; border-bottom: 1px solid #e3e6e3; }
        .member-heading h2 { margin: 4px 0 0; font-size: 17px; letter-spacing: -.02em; }
        .member-heading > span { color: #77817a; font-size: 9px; }
        .member-row { display: grid; grid-template-columns: minmax(170px, 1fr) 90px 52px; gap: 14px; align-items: start; padding: 12px 18px; border-bottom: 1px solid #eef0ee; }
        .member-row:last-child { border-bottom: 0; }
        .member-head { color: #8a938d; background: #fafbf9; font-size: 8px; font-weight: 800; text-transform: uppercase; }
        .member-name { display: grid; gap: 2px; }
        .member-name strong { font-size: 11px; }
        .member-name small { color: #818a84; font-size: 9px; }
        .member-name p { margin: 5px 0 0; color: #5d6860; font-size: 9px; line-height: 1.45; }
        .quality { justify-self: start; border-radius: 999px; padding: 4px 7px; background: #edf2ee; color: #41614e; font-size: 8px; font-weight: 800; text-transform: capitalize; }
        .member-probability { justify-self: end; font-size: 12px; }
        .cannot-predict { grid-column: 1 / -1; border-left: 2px solid #b76a5f; padding-left: 8px; color: #875248; font-size: 9px; }
        footer { padding: 18px 2px 0; color: #7c857f; font-size: 9px; line-height: 1.5; }
        @media (max-width: 620px) {
          .share-shell { width: min(100% - 18px, 960px); padding-top: 12px; }
          .share-hero { grid-template-columns: 1fr; gap: 18px; padding: 20px; }
          .hero-probability { text-align: left; }
          .metrics { grid-template-columns: 1fr 1fr; }
          .member-row { grid-template-columns: minmax(120px, 1fr) 66px 42px; gap: 8px; padding-left: 12px; padding-right: 12px; }
          .share-label { display: none; }
        }
      `}</style>
    </main>
  );
}
