import { requireOwner } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireOwner();

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">VotePredict V2</p>
          <h1>Forecast workspace</h1>
        </div>
        <div className="owner-chip">{user.email}</div>
      </header>

      <section className="hero-card">
        <div>
          <p className="eyebrow">New forecast</p>
          <h2>What do you want to forecast?</h2>
          <p className="muted">The V2 shell is live. Historical ingestion and the evaluation harness come next, before numerical forecasts are enabled.</p>
        </div>
        <div className="forecast-grid">
          <article className="choice-card">
            <span className="choice-number">01</span>
            <h3>Actual bill</h3>
            <p>Find an official bill, choose the chamber, then run Quick or Deep research.</p>
            <span className="status-pill">Data ingestion next</span>
          </article>
          <article className="choice-card">
            <span className="choice-number">02</span>
            <h3>Proposed bill</h3>
            <p>Paste text, describe a proposal, or upload a draft and choose a target chamber.</p>
            <span className="status-pill">Foundation ready</span>
          </article>
          <article className="choice-card">
            <span className="choice-number">03</span>
            <h3>Committee / subset</h3>
            <p>Choose a defined group of legislators and get the same member-level forecast table.</p>
            <span className="status-pill">Planned</span>
          </article>
        </div>
      </section>

      <section className="two-column">
        <article className="panel">
          <p className="eyebrow">Forecast modes</p>
          <div className="mode-row"><strong>Quick</strong><span>Stored legislative data + existing evidence</span></div>
          <div className="mode-row"><strong>Deep</strong><span>Targeted current-source research + recalculation</span></div>
          <div className="mode-row"><strong>Update</strong><span>New revision of the same forecast</span></div>
        </article>
        <article className="panel">
          <p className="eyebrow">Foundation status</p>
          <ul className="status-list">
            <li><span>✓</span> Private owner authentication</li>
            <li><span>✓</span> Persistent forecast/revision schema</li>
            <li><span>✓</span> Session-aware legislative entities</li>
            <li><span>→</span> Minnesota historical roll-call ingestion</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
