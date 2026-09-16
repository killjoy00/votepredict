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
  const evidenceState: State = readiness.evidence.currentCampaignFinanceItems > 0 ? 'ready' : 'attention';
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
          <div><span>Durable external evidence</span><strong>{readiness.evidence.currentCampaignFinanceItems.toLocaleString()} current finance items</strong><small>{readiness.evidence.campaignFinanceMembers} members · {readiness.evidence.currentCuratedItems} curated items · {readiness.evidence.mechanicallyActionableItems} mechanical</small></div>
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
        @media (max-width: 980px) { .readiness-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 560px) { .readiness-heading { display: grid; } .overall-state { width: fit-content; } .readiness-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
