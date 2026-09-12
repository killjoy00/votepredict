import { requireOwner } from '@/lib/auth/guard';
import { getIntroductionServingScorecard } from '@/operations/introduction-scorecard';
import { getOperationalHealth } from '@/operations/health';
import { listResolutionQueue } from '@/operations/resolution';
import { getLeakageSafeProductionScorecard } from '@/operations/safe-scorecard';
import { OutcomeResolutionQueue } from './operations-desk';

export const dynamic = 'force-dynamic';

function metric(value: number | undefined, digits = 3) {
  return value === undefined ? '—' : value.toFixed(digits);
}

function percent(value: number | undefined) {
  return value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
}

function hours(value: number) {
  if (value < 1) return `${Math.round(value * 60)}m`;
  if (value < 48) return `${value.toFixed(1)}h`;
  return `${(value / 24).toFixed(1)}d`;
}

function shortHash(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export default async function OperationsPage() {
  const user = await requireOwner();
  const [health, floorScorecard, queue, introductionResult] = await Promise.all([
    getOperationalHealth(),
    getLeakageSafeProductionScorecard(user.id),
    listResolutionQueue(user.id),
    getIntroductionServingScorecard()
      .then((scorecard) => ({ scorecard, error: null as string | null }))
      .catch((error) => ({ scorecard: null, error: error instanceof Error ? error.message : 'Introduction scorecard failed.' })),
  ]);
  const introduction = introductionResult.scorecard;

  return (
    <main className="ops-shell">
      <header className="ops-header">
        <a href="/dashboard">← Forecast desk</a>
        <div><span className="kicker">Production operations</span><h1>Health + scorecards</h1><p>Freshness, serving integrity, official outcome reconciliation, and forecast performance by stage.</p></div>
        <div className={`health-chip ${health.warnings.length || introductionResult.error ? 'warning' : 'clear'}`}>{health.warnings.length || introductionResult.error ? 'Review warnings' : 'No active warnings'}</div>
      </header>

      <section className={`panel intro-scorecard ${introductionResult.error ? 'intro-failed' : ''}`}>
        <div className="panel-heading">
          <div><span className="kicker">Introduction stage · source_chamber_passage</span><h2>Frozen v4 serving accountability</h2></div>
          <span>{introduction ? `${introduction.targetSession} · ${introduction.modelVersion}` : 'integrity check failed'}</span>
        </div>
        {introductionResult.error ? (
          <div className="intro-error"><strong>Introduction serving verification failed.</strong><p>{introductionResult.error}</p></div>
        ) : introduction ? (
          <>
            <p className="panel-copy intro-copy">Replays the exact frozen 2025–26 prediction set against authoritative source-chamber outcomes. The prediction digest must match the promotion artifact before metrics are shown.</p>
            <div className="intro-strip">
              <div><span>Prediction integrity</span><strong className={introduction.predictionIntegrity.verified ? 'good' : 'bad'}>{introduction.predictionIntegrity.verified ? 'Verified' : 'Mismatch'}</strong></div>
              <div><span>Corpus</span><strong>{introduction.corpus.observedBills.toLocaleString()} / {introduction.corpus.expectedBills.toLocaleString()}</strong></div>
              <div><span>Outcomes labeled</span><strong>{introduction.corpus.labeledBills.toLocaleString()}</strong></div>
              <div><span>Brier</span><strong>{metric(introduction.metrics.brier, 5)}</strong></div>
              <div><span>Log loss</span><strong>{metric(introduction.metrics.logLoss, 5)}</strong></div>
              <div><span>ECE</span><strong>{metric(introduction.metrics.expectedCalibrationError, 5)}</strong></div>
              <div><span>Avg precision</span><strong>{metric(introduction.metrics.averagePrecision, 4)}</strong></div>
              <div><span>ROC-AUC</span><strong>{metric(introduction.metrics.rocAuc, 4)}</strong></div>
            </div>
            <div className="intro-details">
              <div>
                <span className="kicker">Corpus + inputs</span>
                <p><strong>{introduction.corpus.textEligibleBills.toLocaleString()}</strong> title + purpose-text · <strong>{introduction.corpus.titleOnlyFallbackBills}</strong> title-only fallback · <strong>{introduction.corpus.unlabeledBills}</strong> unresolved outcomes</p>
                <p>Observed pass rate {percent(introduction.metrics.observedRate)} · mean predicted {percent(introduction.metrics.meanProbability)}</p>
              </div>
              <div>
                <span className="kicker">Chamber slices</span>
                <p>House · {introduction.byChamber.house.bills.toLocaleString()} bills · Brier {metric(introduction.byChamber.house.brier, 5)} · AP {metric(introduction.byChamber.house.averagePrecision, 4)}</p>
                <p>Senate · {introduction.byChamber.senate.bills.toLocaleString()} bills · Brier {metric(introduction.byChamber.senate.brier, 5)} · AP {metric(introduction.byChamber.senate.averagePrecision, 4)}</p>
              </div>
              <div>
                <span className="kicker">Frozen provenance</span>
                <p>Trained through {introduction.trainedThroughSession} · {introduction.provenance.trainingRows.toLocaleString()} bills / {introduction.provenance.trainingPositives} passes</p>
                <p title={introduction.provenance.predictionSha256}>Prediction set {shortHash(introduction.provenance.predictionSha256)} · eval {introduction.provenance.evaluationCommit.slice(0, 8)}</p>
              </div>
            </div>
            <div className="context-note"><strong>Not a new independent test set.</strong> {introduction.evidenceContext.note}</div>
          </>
        ) : null}
      </section>

      <section className="score-strip" aria-label="Current floor production scorecard">
        <div><span>Resolved floor forecasts</span><strong>{floorScorecard.resolvedForecasts}</strong></div>
        <div><span>Passage Brier</span><strong>{metric(floorScorecard.aggregate.passageBrier)}</strong></div>
        <div><span>Yes MAE</span><strong>{metric(floorScorecard.aggregate.expectedYesMae, 1)}</strong></div>
        <div><span>Range coverage</span><strong>{percent(floorScorecard.aggregate.rangeCoverage)}</strong></div>
        <div><span>Member accuracy</span><strong>{percent(floorScorecard.aggregate.memberAccuracy)}</strong></div>
        <div><span>Member Brier</span><strong>{metric(floorScorecard.aggregate.memberBrier)}</strong></div>
      </section>

      <div className="ops-grid">
        <section className="panel">
          <div className="panel-heading"><div><span className="kicker">Official floor truth</span><h2>Outcome reconciliation</h2></div><span>{queue.length} open</span></div>
          <p className="panel-copy">VotePredict never guesses which passage event is the final floor scorecard outcome. Review matching official bill/chamber passage votes and explicitly link the right one.</p>
          <OutcomeResolutionQueue rows={queue} />
        </section>

        <section className="panel">
          <div className="panel-heading"><div><span className="kicker">System state</span><h2>Operational health</h2></div><span>as of {new Date(health.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span></div>
          {health.warnings.length ? <div className="warning-list">{health.warnings.map((warning) => <div key={warning}>{warning}</div>)}</div> : <div className="clear-state">No ingestion, source, or Deep research warnings are active.</div>}
          <div className="health-block"><h3>Latest ingestion runs</h3>{health.ingestion.length === 0 ? <p>No ingestion run history recorded.</p> : health.ingestion.map((run) => <div className="health-row" key={`${run.sourceSystem}-${run.scope}`}><div><strong>{run.sourceSystem}</strong><small>{run.scope}</small></div><span className={`status ${run.status}`}>{run.status}</span><span>{hours(run.ageHours)} ago</span><small>{run.voteEvents} votes · {run.memberVotes} member votes</small></div>)}</div>
          <div className="health-block"><h3>Source freshness</h3>{health.sourceFreshness.map((source) => <div className="health-row" key={source.sourceKind}><div><strong>{source.sourceKind}</strong><small>{source.documents} documents</small></div><span>{hours(source.ageHours)} ago</span><small>{source.recentHttpFailures ? `${source.recentHttpFailures} recent HTTP failures` : 'no recent HTTP failures'}</small></div>)}</div>
          <div className="research-line"><span>Deep research, last 24h</span><strong>{health.research.completed} completed · {health.research.failed} failed · {health.research.running} active</strong></div>
          <div className="research-line"><span>Daily forecast snapshots</span><strong>{health.continuousForecasting.enabledSchedules} enabled · {health.continuousForecasting.completed24Hours} completed · {health.continuousForecasting.failed24Hours} failed</strong></div>
          <div className="research-line"><span>Model monitoring</span><strong>{health.continuousForecasting.openDriftAlerts} open drift alerts · {health.continuousForecasting.dueSchedules} overdue</strong></div>
        </section>
      </div>

      <section className="panel revisions-panel">
        <div className="panel-heading"><div><span className="kicker">Current/floor frozen predictions vs actuals</span><h2>Scored revisions</h2></div><span>{floorScorecard.scoredRevisions} revision{floorScorecard.scoredRevisions === 1 ? '' : 's'}</span></div>
        {floorScorecard.revisions.length === 0 ? <div className="empty-score"><strong>No production floor outcomes have been reconciled yet.</strong><p>The scorecard starts only after you explicitly link a saved bill forecast to its official passage vote. Revisions generated on the same calendar date as the official vote are excluded because the source data does not establish which came first.</p></div> : <div className="revision-table"><div className="revision-head"><span>Forecast</span><span>Revision</span><span>Passage</span><span>Brier</span><span>Yes error</span><span>Members</span></div>{floorScorecard.revisions.map((row) => <div className="revision-score" key={row.revisionId}><div><strong>{row.targetLabel}</strong><small>{row.chamberName} · actual {row.actualYes} Yes on {row.actualOccurredOn}</small></div><span>r{row.revisionNumber} · {row.researchMode}</span><span>{percent(row.passageProbability)} → {row.actualPassed === null ? '—' : row.actualPassed ? 'pass' : 'fail'}</span><span>{metric(row.passageBrier)}</span><span>{row.yesAbsoluteError === undefined ? '—' : row.yesAbsoluteError.toFixed(1)}</span><span>{percent(row.memberAccuracy)}<small>{row.memberResolved} scored</small></span></div>)}</div>}
      </section>

      <footer>Introduction scoring verifies the frozen session prediction digest before showing retrospective metrics. Current/floor scoring uses only unambiguously pre-vote frozen revisions. The two targets remain separate.</footer>

      <style>{`
        :global(body) { background: #f5f6f2; }
        .ops-shell { width: min(1180px, calc(100% - 28px)); margin: 0 auto; padding: 24px 0 54px; color: #17201b; }
        .ops-header { display: grid; grid-template-columns: 130px minmax(0,1fr) auto; gap: 24px; align-items: start; margin-bottom: 18px; }
        .ops-header > a { color: #52675a; font-size: 9px; font-weight: 760; text-decoration: none; }
        .kicker { color: #7f8882; font-size: 8px; font-weight: 820; letter-spacing: .08em; text-transform: uppercase; }
        h1 { margin: 4px 0 6px; font-size: 32px; letter-spacing: -.04em; }
        .ops-header p, .panel-copy { margin: 0; color: #707a73; font-size: 9.5px; line-height: 1.45; }
        .health-chip { border-radius: 999px; padding: 6px 10px; font-size: 8.5px; font-weight: 800; white-space: nowrap; }
        .health-chip.clear { color: #2f5c43; background: #eaf3ed; }
        .health-chip.warning { color: #725526; background: #f4ead7; }
        .panel { border: 1px solid #dce1dc; border-radius: 12px; padding: 16px; background: #fff; }
        .panel-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; }
        .panel-heading h2 { margin: 4px 0 0; font-size: 16px; letter-spacing: -.025em; }
        .panel-heading > span { color: #858e88; font-size: 8px; }
        .panel-copy { margin: 8px 0 12px; }
        .intro-scorecard { margin-bottom: 16px; }
        .intro-scorecard.intro-failed { border-color: #dfb6b0; background: #fff9f8; }
        .intro-copy { max-width: 820px; }
        .intro-strip { display: grid; grid-template-columns: repeat(8, 1fr); gap: 1px; overflow: hidden; margin-top: 12px; border: 1px solid #dce1dc; border-radius: 10px; background: #dce1dc; }
        .intro-strip > div { padding: 10px; background: #fafbf9; }
        .intro-strip span { display: block; color: #818b84; font-size: 7px; }
        .intro-strip strong { display: block; margin-top: 4px; font-size: 11px; }
        .intro-strip .good { color: #2f6846; }
        .intro-strip .bad { color: #9a4138; }
        .intro-details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 14px; }
        .intro-details p { margin: 5px 0 0; color: #66736b; font-size: 8.5px; line-height: 1.45; }
        .intro-details p strong { color: #24352b; }
        .context-note { margin-top: 12px; border-left: 2px solid #a8864e; padding: 7px 9px; color: #75613f; background: #fbf7ef; font-size: 8.5px; line-height: 1.45; }
        .context-note strong { color: #5d4b2f; }
        .intro-error { margin-top: 12px; border-left: 3px solid #b85b50; padding: 10px; color: #873f37; background: #fdf0ee; font-size: 9px; }
        .intro-error p { margin: 4px 0 0; }
        .score-strip { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1px; overflow: hidden; border: 1px solid #dce1dc; border-radius: 12px; background: #dce1dc; }
        .score-strip > div { padding: 11px 12px; background: #fff; }
        .score-strip span { display: block; color: #818b84; font-size: 7.5px; }
        .score-strip strong { display: block; margin-top: 4px; font-size: 13px; }
        .ops-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 16px; margin-top: 16px; }
        .warning-list { display: grid; gap: 5px; margin: 11px 0; }
        .warning-list > div { border-left: 2px solid #c0924b; padding: 5px 8px; color: #6f552e; background: #faf5eb; font-size: 8.5px; line-height: 1.4; }
        .clear-state { margin: 11px 0; border-left: 2px solid #6f9b80; padding: 6px 8px; color: #40624e; background: #f0f6f2; font-size: 8.5px; }
        .health-block { margin-top: 14px; border-top: 1px solid #e8ebe8; padding-top: 11px; }
        .health-block h3 { margin: 0 0 6px; color: #657169; font-size: 8px; text-transform: uppercase; letter-spacing: .05em; }
        .health-block > p { color: #858e88; font-size: 8.5px; }
        .health-row { display: grid; grid-template-columns: minmax(110px,1fr) auto auto minmax(100px,auto); gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f2f0; font-size: 8px; }
        .health-row > div { display: grid; gap: 1px; }
        .health-row strong { font-size: 8.8px; }
        .health-row small, .health-row > span { color: #7c867f; }
        .status { border-radius: 999px; padding: 2px 5px; font-weight: 800; }
        .status.completed, .status.success { color: #315b43; background: #ebf4ed; }
        .status.failed { color: #8a4f45; background: #f7ecea; }
        .research-line { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; border-top: 1px solid #e8ebe8; padding-top: 10px; font-size: 8px; }
        .research-line span { color: #7b857e; }
        .research-line strong { text-align: right; }
        .revisions-panel { margin-top: 16px; }
        .revision-table { margin-top: 11px; overflow-x: auto; }
        .revision-head, .revision-score { display: grid; grid-template-columns: minmax(250px,1fr) 90px 120px 65px 70px 80px; gap: 10px; min-width: 760px; align-items: center; }
        .revision-head { padding: 6px 8px; color: #89928c; background: #fafbf9; font-size: 7.5px; font-weight: 800; text-transform: uppercase; }
        .revision-score { padding: 9px 8px; border-bottom: 1px solid #edf0ed; font-size: 8.5px; }
        .revision-score > div { display: grid; gap: 2px; min-width: 0; }
        .revision-score > div strong { overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
        .revision-score small { display: block; color: #838c86; font-size: 7.5px; }
        .empty-score { margin-top: 11px; padding: 20px; border: 1px dashed #d8ddd8; border-radius: 9px; text-align: center; }
        .empty-score strong { font-size: 10px; }
        .empty-score p { margin: 5px 0 0; color: #808a83; font-size: 8.5px; }
        footer { padding: 14px 2px 0; color: #818a84; font-size: 8px; }
        @media (max-width: 980px) {
          .intro-strip { grid-template-columns: repeat(4, 1fr); }
          .intro-details { grid-template-columns: 1fr; gap: 10px; }
        }
        @media (max-width: 760px) {
          .ops-shell { width: min(100% - 18px, 1180px); padding-top: 14px; }
          .ops-header { grid-template-columns: 1fr auto; gap: 14px; }
          .ops-header > a { grid-column: 1 / -1; }
          .ops-grid { grid-template-columns: 1fr; }
          .score-strip { grid-template-columns: repeat(3, 1fr); }
          .intro-strip { grid-template-columns: repeat(2, 1fr); }
          .health-row { grid-template-columns: 1fr auto auto; }
          .health-row > small:last-child { display: none; }
        }
      `}</style>
    </main>
  );
}
