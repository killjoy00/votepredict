import type { ProductionReadiness } from '@/operations/readiness';

type Props = {
  readiness: ProductionReadiness;
  servingModel: string;
  rollbackActive: boolean;
  introductionModel?: string;
  introductionVerified: boolean;
  scheduler: {
    enabledSchedules: number;
    dueSchedules: number;
    failed24Hours: number;
  };
  sourceWarningCount: number;
};

type State = 'ready' | 'attention' | 'planned';

function stateLabel(state: State) {
  if (state === 'ready') return 'Ready';
  if (state === 'planned') return 'Planned';
  return 'Attention';
}

function shortSha(value?: string) {
  return value ? value.slice(0, 10) : 'not exposed';
}

function ageLabel(value?: string) {
  if (!value) return 'no run yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'time unavailable';
  const hours = Math.max(0, (Date.now() - date.getTime()) / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  if (hours < 48) return `${hours.toFixed(1)}h ago`;
  return `${(hours / 24).toFixed(1)}d ago`;
}

export function ProductionReadinessPanel(props: Props) {
  const {
    readiness,
    servingModel,
    rollbackActive,
    introductionModel,
    introductionVerified,
    scheduler,
    sourceWarningCount,
  } = props;

  const runtimeState: State = introductionVerified && scheduler.dueSchedules === 0 && scheduler.failed24Hours === 0 && sourceWarningCount === 0
    ? 'ready'
    : 'attention';
  const quickState: State = 'ready';
  const introductionState: State = introductionVerified ? 'ready' : 'attention';
  const schedulerState: State = scheduler.dueSchedules === 0 && scheduler.failed24Hours === 0 ? 'ready' : 'attention';
  const deepState: State = readiness.deep.state === 'ready' ? 'ready' : 'attention';
  const evidenceState: State = readiness.evidence.currentCampaignFinanceItems > 0
    && readiness.evidence.latestPublicEvidenceStatus === 'complete'
    ? 'ready'
    : 'attention';
  const futureState: State = readiness.futureSession.exists && readiness.futureSession.memberships > 0 ? 'ready' : 'planned';

  const overall = runtimeState === 'ready' && deepState === 'ready' ? 'All production modes ready' : runtimeState === 'ready' ? 'Core ready · review optional modes' : 'Production review needed';

  return (
    <section className="readiness-panel" aria-label="Production readiness">
      <div className="readiness-heading">
        <div>
          <span>Production readiness</span>
          <h2>{overall}</h2>
          <p>One view of the live serving path, evidence substrate, and next-session preparation. A Deep warning does not imply the Quick model is unavailable.</p>
        </div>
        <div className={`overall-state ${runtimeState}`}>{stateLabel(runtimeState)}</div>
      </div>

      <div className="readiness-grid">
        <article>
          <div className={`state-dot ${runtimeState}`} />
          <div><span>Core runtime</span><strong>{stateLabel(runtimeState)}</strong><small>Deploy {shortSha(readiness.deploymentSha)} · DB-backed Operations loaded</small></div>
        </article>
        <article>
          <div className={`state-dot ${quickState}`} />
          <div><span>Current/floor Quick</span><strong>{servingModel}</strong><small>{rollbackActive ? 'Rollback arm is serving' : 'Primary serving model · rollback standby'}</small></div>
        </article>
        <article>
          <div className={`state-dot ${introductionState}`} />
          <div><span>Introduction forecast</span><strong>{introductionVerified ? 'Integrity verified' : 'Integrity failed'}</strong><small>{introductionModel ?? 'Serving artifact unavailable'}</small></div>
        </article>
        <article>
          <div className={`state-dot ${schedulerState}`} />
          <div><span>Forecast scheduler</span><strong>{stateLabel(schedulerState)}</strong><small>{scheduler.enabledSchedules} enabled · {scheduler.dueSchedules} overdue · {scheduler.failed24Hours} failed/24h</small></div>
        </article>
        <article>
          <div className={`state-dot ${deepState}`} />
          <div><span>Deep research</span><strong>{readiness.deep.billingBlocked ? 'Billing blocked' : readiness.deep.state === 'ready' ? 'Operational' : readiness.deep.state === 'blocked' ? 'Blocked' : 'Unverified'}</strong><small>{readiness.deep.completedRuns} completed · {readiness.deep.failedRuns} failed{readiness.deep.latestError ? ` · ${readiness.deep.latestError.slice(0, 95)}` : ''}</small></div>
        </article>
        <article>
          <div className={`state-dot ${evidenceState}`} />
          <div>
            <span>Public evidence pipeline</span>
            <strong>{readiness.evidence.latestPublicEvidenceStatus === 'complete' ? 'Crawler operational' : readiness.evidence.latestPublicEvidenceStatus === 'failed' ? 'Crawler failed' : 'Crawler not verified'}</strong>
            <small>{readiness.evidence.currentCampaignFinanceItems.toLocaleString()} finance · {readiness.evidence.campaignSiteItems} campaign-site · {readiness.evidence.memberPrimaryItems} member-primary · {readiness.evidence.publicNewsItems} news / {readiness.evidence.publicNewsMembers} members · {readiness.evidence.publicEvidenceMembers} web-covered members · {ageLabel(readiness.evidence.latestPublicEvidenceRun)}</small>
          </div>
        </article>
        <article>
          <div className={`state-dot ${sourceWarningCount === 0 ? 'ready' : 'attention'}`} />
          <div><span>Official-source health</span><strong>{sourceWarningCount === 0 ? 'Clear' : `${sourceWarningCount} warning${sourceWarningCount === 1 ? '' : 's'}`}</strong><small>Ingestion/source warnings excluding Deep research</small></div>
        </article>
        <article>
          <div className={`state-dot ${futureState}`} />
          <div><span>2027–28 opening day</span><strong>{futureState === 'ready' ? 'Provisioned' : 'Not provisioned yet'}</strong><small>{readiness.futureSession.memberships} memberships · {readiness.futureSession.bills} bills · session {readiness.futureSession.exists ? 'exists' : 'absent'}</small></div>
        </article>
      </div>

      <div className="evidence-footnote">
        Public evidence is stored independently of serving model impact. Quick Evidence candidate corpus: <strong>{readiness.evidence.quickEvidenceCandidateItems} items across {readiness.evidence.quickEvidenceCandidateMembers} members</strong>. Serving mechanical public-evidence items: <strong>{readiness.evidence.mechanicallyActionableItems}</strong>. Curated legacy items: <strong>{readiness.evidence.currentCuratedItems}</strong>. Campaign-finance members: <strong>{readiness.evidence.campaignFinanceMembers}</strong>. Member-primary source members: <strong>{readiness.evidence.memberPrimaryMembers}</strong>. Latest news batch: <strong>{readiness.evidence.latestNewsInserted} inserted</strong>, <strong>{readiness.evidence.latestNewsFailures} failures</strong>, <strong>{readiness.evidence.latestNewsNoLeadMembers} no-lead members</strong>. Prospective capture began <strong>{ageLabel(readiness.evidence.prospectiveEvidenceSince)}</strong>.
      </div>

      <div className="evidence-footnote structured-family-footnote">
        Current-session structured zero-weight corpus (historical backfills excluded):
        {' '}district <strong>{readiness.evidence.structuredFamilies.districtContext.items} items / {readiness.evidence.structuredFamilies.districtContext.members} members</strong>
        {' '}· floor <strong>{readiness.evidence.structuredFamilies.floorActivity.items} items / {readiness.evidence.structuredFamilies.floorActivity.members} members / {readiness.evidence.structuredFamilies.floorActivity.bills} bills</strong>
        {' '}· speech <strong>{readiness.evidence.structuredFamilies.sessionDailySpeech.items} items / {readiness.evidence.structuredFamilies.sessionDailySpeech.members} members / {readiness.evidence.structuredFamilies.sessionDailySpeech.bills} bills</strong>
        {' '}· conferees <strong>{readiness.evidence.structuredFamilies.conferenceConferee.items} items / {readiness.evidence.structuredFamilies.conferenceConferee.members} members / {readiness.evidence.structuredFamilies.conferenceConferee.bills} bills</strong>
        {' '}· bill context <strong>{readiness.evidence.structuredFamilies.billContext.items} items / {readiness.evidence.structuredFamilies.billContext.bills} bills</strong>.
      </div>

      <style>{`
        .readiness-panel { margin-bottom: 16px; border: 1px solid #d9dfda; border-radius: 14px; padding: 16px; background: #19251e; color: #f4f7f4; box-shadow: 0 10px 28px rgba(27, 40, 31, .08); }
        .readiness-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
        .readiness-heading span { color: #aebdb3; font-size: 8px; font-weight: 820; letter-spacing: .08em; text-transform: uppercase; }
        .readiness-heading h2 { margin: 4px 0 3px; font-size: 18px; letter-spacing: -.025em; }
        .readiness-heading p { max-width: 760px; margin: 0; color: #b9c5bd; font-size: 8.5px; line-height: 1.45; }
        .overall-state { border-radius: 999px; padding: 6px 9px; font-size: 8px; font-weight: 850; white-space: nowrap; }
        .overall-state.ready { color: #cbe9d4; background: #2e4b39; }
        .overall-state.attention { color: #f0d9a9; background: #59492d; }
        .readiness-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; overflow: hidden; margin-top: 14px; border: 1px solid #34453a; border-radius: 10px; background: #34453a; }
        .readiness-grid article { display: grid; grid-template-columns: 7px minmax(0, 1fr); gap: 8px; min-width: 0; padding: 10px; background: #223128; }
        .readiness-grid article > div:last-child { min-width: 0; }
        .readiness-grid span { display: block; color: #aab8ae; font-size: 7px; }
        .readiness-grid strong { display: block; overflow-wrap: anywhere; margin-top: 3px; color: #f3f6f3; font-size: 9.2px; }
        .readiness-grid small { display: block; overflow-wrap: anywhere; margin-top: 3px; color: #9eada3; font-size: 7.2px; line-height: 1.35; }
        .state-dot { width: 7px; height: 7px; margin-top: 2px; border-radius: 50%; background: #9d7740; }
        .state-dot.ready { background: #72aa83; box-shadow: 0 0 0 3px rgba(114,170,131,.08); }
        .state-dot.attention { background: #d1a45f; }
        .state-dot.planned { background: #87948b; }
        .evidence-footnote { margin-top: 10px; border-top: 1px solid #34453a; padding-top: 9px; color: #aab8ae; font-size: 7.5px; line-height: 1.4; }
        .evidence-footnote strong { color: #e7ede9; }
        .structured-family-footnote { margin-top: 6px; }
        @media (max-width: 980px) { .readiness-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 560px) { .readiness-heading { display: grid; } .overall-state { width: fit-content; } .readiness-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
