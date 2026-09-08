import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guard';
import { loadGamblingDashboard } from '@/gambling/intelligence';
import { SF3414_OSB_PROCEDURAL_VOTE } from '@/gambling/osb-procedural';
import { gamblingTopicLabel } from '@/gambling/policy';
import styles from './gambling.module.css';

export const dynamic = 'force-dynamic';

function date(value: string | undefined): string {
  if (!value) return '—';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

function confidenceLabel(value: string): string {
  return value === 'none' ? 'No rating' : `${value} confidence`;
}

export default async function GamblingDashboardPage() {
  await requireOwner();
  const data = await loadGamblingDashboard();
  const direct = data.bills.filter((bill) => bill.scope === 'direct');
  const embedded = data.bills.filter((bill) => bill.scope === 'embedded');
  const mentions = data.bills.filter((bill) => bill.scope === 'mention');
  const rated = data.members.filter((member) => member.tribalGamingAlignment.score !== undefined);
  const osbSupportNames = new Set<string>(SF3414_OSB_PROCEDURAL_VOTE.yesNames);
  const osbSupporters = data.members.filter((member) => osbSupportNames.has(member.name));

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brandLink}>
          <span className={styles.brandMark}>VP</span>
          <span>VotePredict</span>
        </Link>
        <nav className={styles.topLinks} aria-label="Workspace navigation">
          <Link href="/dashboard/legislators">Legislators</Link>
          <Link href="/dashboard">Forecast desk</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.kicker}>Priority vertical</span>
          <h1>Gaming & gambling intelligence</h1>
          <p>
            Every gambling-related bill found in the VotePredict corpus, direct voting records, public-position signals,
            and an auditable measure of alignment with documented Minnesota tribal gaming positions.
          </p>
        </div>
        <div className={styles.heroNote}>
          <strong>Tribal gaming alignment is narrow by design.</strong>
          <span>
            It measures agreement with specific public gaming positions documented by MIGA and SMSC. It is not a measure
            of tribal identity, relationships, campaign support, or a legislator&apos;s views on tribal policy generally.
          </span>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Gambling corpus metrics">
        <article><span>Direct gambling bills</span><strong>{data.directBillCount}</strong><small>Dedicated bill titles</small></article>
        <article><span>Embedded provisions</span><strong>{data.embeddedBillCount}</strong><small>Substantive gambling text inside broader bills</small></article>
        <article><span>Incidental mentions</span><strong>{data.mentionBillCount}</strong><small>Visible for research, excluded from scoring</small></article>
        <article><span>Rated current members</span><strong>{data.ratedMemberCount}</strong><small>At least one documented tribal-gaming signal</small></article>
      </section>

      <div className={styles.grid}>
        <div className={styles.mainStack}>
          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div><span className={styles.kicker}>Core record</span><h2>Direct gambling legislation</h2></div>
              <span>{direct.reduce((sum, bill) => sum + bill.voteEvents, 0)} recorded floor vote events</span>
            </header>
            <div className={styles.billList}>
              {direct.map((bill) => (
                <article className={styles.billRow} key={bill.billId}>
                  <div className={styles.billIdentity}>
                    <div className={styles.billTags}>
                      <span>{bill.sessionSlug}</span>
                      <span>{gamblingTopicLabel(bill.topic)}</span>
                      <span>{bill.voteEvents} vote event{bill.voteEvents === 1 ? '' : 's'}</span>
                    </div>
                    <strong>{bill.identifier} · {bill.title}</strong>
                    <small>{bill.firstVote ? `${date(bill.firstVote)}${bill.lastVote !== bill.firstVote ? ` – ${date(bill.lastVote)}` : ''}` : 'No recorded floor vote in corpus'}</small>
                  </div>
                  {bill.sourceUrl ? <a href={bill.sourceUrl} target="_blank" rel="noreferrer">Official bill ↗</a> : null}
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div><span className={styles.kicker}>High-value procedural signal</span><h2>2025 Senate OSB advancement vote</h2></div>
              <span>{SF3414_OSB_PROCEDURAL_VOTE.tally} · motion failed</span>
            </header>
            <div className={styles.billRow}>
              <div className={styles.billIdentity}>
                <div className={styles.billTags}>
                  <span>Apr 23, 2025</span>
                  <span>Senate procedural vote</span>
                  <span>Yes = OSB support</span>
                </div>
                <strong>{SF3414_OSB_PROCEDURAL_VOTE.identifier} · {SF3414_OSB_PROCEDURAL_VOTE.billTitle}</strong>
                <small>{SF3414_OSB_PROCEDURAL_VOTE.motion}. The motion failed 15–50.</small>
              </div>
              <div className={styles.topLinks}>
                <a href={SF3414_OSB_PROCEDURAL_VOTE.billUrl} target="_blank" rel="noreferrer">Bill ↗</a>
                <a href={SF3414_OSB_PROCEDURAL_VOTE.journalUrl} target="_blank" rel="noreferrer">Senate journal ↗</a>
              </div>
            </div>
            <div className={styles.memberTable}>
              <div className={`${styles.memberRow} ${styles.memberHead}`}>
                <span>Yes voter</span><span>Signal</span><span>Chamber</span><span>District</span>
              </div>
              {osbSupporters.map((member) => (
                <Link href={`/dashboard/legislators/${member.legislatorId}/gambling`} className={styles.memberRow} key={member.legislatorId}>
                  <span className={styles.memberIdentity}><strong>{member.name}</strong><small>{member.party}</small></span>
                  <strong className={styles.score}>OSB+</strong>
                  <span>{member.chamberName}</span>
                  <span>{member.district}</span>
                </Link>
              ))}
            </div>
            <p className={styles.note}>
              VotePredict treats a Yes vote on this motion as affirmative evidence of support for advancing online sports betting. A procedural No is retained in an individual dossier but is not, by itself, treated as proof of substantive opposition to OSB.
            </p>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div><span className={styles.kicker}>Current Legislature</span><h2>Tribal gaming alignment</h2></div>
              <span>Score 0–100 · confidence and evidence weight always shown</span>
            </header>
            <div className={styles.memberTable}>
              <div className={`${styles.memberRow} ${styles.memberHead}`}>
                <span>Legislator</span><span>Score</span><span>Evidence</span><span>Confidence</span>
              </div>
              {rated.map((member) => {
                const alignment = member.tribalGamingAlignment;
                return (
                  <Link href={`/dashboard/legislators/${member.legislatorId}/gambling`} className={styles.memberRow} key={member.legislatorId}>
                    <span className={styles.memberIdentity}><strong>{member.name}</strong><small>{member.party} · {member.chamberName} · {member.district}</small></span>
                    <strong className={styles.score}>{alignment.score}</strong>
                    <span>{alignment.signals.length} signal{alignment.signals.length === 1 ? '' : 's'} · {alignment.observedWeight.toFixed(2)} wt</span>
                    <span>{confidenceLabel(alignment.confidence)}</span>
                  </Link>
                );
              })}
            </div>
            <p className={styles.note}>
              Scores shrink toward 50 when evidence is sparse. A legislator with no documented benchmark signal receives no rating, not a neutral 50.
            </p>
          </section>

          {embedded.length > 0 ? (
            <section className={styles.panel}>
              <header className={styles.panelHeader}>
                <div><span className={styles.kicker}>Broader bills</span><h2>Embedded gambling provisions</h2></div>
                <span>Context only unless the gambling provision itself was isolated in a vote</span>
              </header>
              <div className={styles.billList}>
                {embedded.map((bill) => (
                  <article className={styles.billRow} key={bill.billId}>
                    <div className={styles.billIdentity}>
                      <div className={styles.billTags}><span>{bill.sessionSlug}</span><span>{gamblingTopicLabel(bill.topic)}</span><span>{bill.termHits} matched terms</span></div>
                      <strong>{bill.identifier} · {bill.title}</strong>
                      <small>{bill.voteEvents} recorded vote event{bill.voteEvents === 1 ? '' : 's'} · not used as a direct gambling-position signal</small>
                    </div>
                    {bill.sourceUrl ? <a href={bill.sourceUrl} target="_blank" rel="noreferrer">Official bill ↗</a> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {mentions.length > 0 ? (
            <details className={styles.details}>
              <summary>Show {mentions.length} bills with incidental gambling mentions</summary>
              <div className={styles.billList}>
                {mentions.map((bill) => (
                  <article className={styles.billRow} key={bill.billId}>
                    <div className={styles.billIdentity}>
                      <div className={styles.billTags}><span>{bill.sessionSlug}</span><span>{gamblingTopicLabel(bill.topic)}</span><span>{bill.termHits} matched term{bill.termHits === 1 ? '' : 's'}</span></div>
                      <strong>{bill.identifier} · {bill.title}</strong>
                    </div>
                    {bill.sourceUrl ? <a href={bill.sourceUrl} target="_blank" rel="noreferrer">Official bill ↗</a> : null}
                  </article>
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <aside className={styles.sideStack}>
          <section className={styles.panel}>
            <header className={styles.panelHeader}><div><span className={styles.kicker}>Methodology</span><h3>Tribal gaming benchmarks</h3></div></header>
            <div className={styles.benchmarkList}>
              {data.benchmarks.map((benchmark) => (
                <article key={benchmark.benchmarkKey}>
                  <strong>{benchmark.label}</strong>
                  <span>{benchmark.sourceOrganization} · weight {benchmark.weight}</span>
                  <p>{benchmark.explanation}</p>
                  <a href={benchmark.sourceUrl} target="_blank" rel="noreferrer">Open benchmark source ↗</a>
                </article>
              ))}
            </div>
            <p className={styles.note}>
              These sources do not establish a single consensus position for all 11 Minnesota tribal nations. They are the documented gaming-policy positions used by this rating and are shown so the metric can be audited.
            </p>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}><div><span className={styles.kicker}>Reading the corpus</span><h3>What counts</h3></div></header>
            <div className={styles.methodList}>
              <div><strong>Direct</strong><span>The bill title itself is about sports betting, wagering, lottery, racing, sweepstakes, prediction markets, or lawful gambling.</span></div>
              <div><strong>Embedded</strong><span>A broader bill contains multiple substantive gambling references. It is research context, not automatically a position signal.</span></div>
              <div><strong>Mention</strong><span>One or two gambling references in a broader bill. Searchable, but excluded from ratings.</span></div>
              <div><strong>Public view</strong><span>Recorded votes, sponsorships, official statements, and sourced news are kept distinct rather than collapsed into an inferred ideology.</span></div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
