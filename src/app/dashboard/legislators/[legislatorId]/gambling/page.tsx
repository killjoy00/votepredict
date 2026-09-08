import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guard';
import { gamblingTopicLabel } from '@/gambling/policy';
import { loadLegislatorGamblingProfile } from '@/gambling/intelligence';
import styles from './gambling-profile.module.css';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ legislatorId: string }> };

function date(value: string | undefined): string {
  if (!value) return '—';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function recordKind(value: string): string {
  return value.replaceAll('_', ' ');
}

export default async function LegislatorGamblingPage({ params }: PageProps) {
  await requireOwner();
  const { legislatorId } = await params;
  const profile = await loadLegislatorGamblingProfile(legislatorId);
  if (!profile) notFound();

  const alignment = profile.tribalGamingAlignment;
  const directVotes = profile.votes.filter((vote) => vote.scope === 'direct');
  const embeddedVotes = profile.votes.filter((vote) => vote.scope === 'embedded');

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brandLink}><span className={styles.brandMark}>VP</span><span>VotePredict</span></Link>
        <nav className={styles.topLinks} aria-label="Workspace navigation">
          <Link href="/dashboard/gambling">Gambling intelligence</Link>
          <Link href={`/dashboard/legislators/${legislatorId}`}>Legislator profile</Link>
          <Link href="/dashboard/legislators">All legislators</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.kicker}>Gaming & gambling profile</span>
          <h1>{profile.name}</h1>
          <p>{profile.party && profile.chamberName ? `${profile.party} · ${profile.chamberName} · District ${profile.district}` : 'Historical Minnesota legislator'}</p>
        </div>
        <div className={styles.ratingCard}>
          <span>Tribal gaming alignment</span>
          <strong>{alignment.score ?? '—'}</strong>
          <small>{alignment.confidence === 'none' ? 'No documented benchmark signal' : `${alignment.confidence} confidence · ${alignment.signals.length} signal${alignment.signals.length === 1 ? '' : 's'} · ${alignment.observedWeight.toFixed(2)} evidence weight`}</small>
        </div>
      </section>

      <section className={styles.disclaimer}>
        <strong>What this rating means</strong>
        <span>
          Agreement with specific public gaming-policy positions documented by MIGA and SMSC. It does not measure tribal identity,
          personal relationships, campaign support, or this legislator&apos;s views on tribal policy outside gaming. Sparse records are shrunk toward neutral.
        </span>
      </section>

      <section className={styles.metrics}>
        <article><span>Direct gambling votes</span><strong>{directVotes.length}</strong><small>Dedicated gambling legislation</small></article>
        <article><span>Embedded-bill votes</span><strong>{embeddedVotes.length}</strong><small>Shown as context, not automatic stance</small></article>
        <article><span>Public-position records</span><strong>{profile.publicRecord.length}</strong><small>Votes, sponsorships and sourced statements</small></article>
        <article><span>Gaming finance matches</span><strong>{profile.gamingFinance.length}</strong><small>Keyword-matched disclosure context only</small></article>
      </section>

      <div className={styles.grid}>
        <div className={styles.mainStack}>
          <section className={styles.panel}>
            <header className={styles.panelHeader}><div><span className={styles.kicker}>Public record</span><h2>Position by gambling topic</h2></div><span>Statements stay separate from inferred positions</span></header>
            {profile.topicSummaries.length > 0 ? (
              <div className={styles.topicGrid}>
                {profile.topicSummaries.map((topic) => (
                  <article key={topic.topic}>
                    <span>{topic.label}</span>
                    <strong>{topic.summary}</strong>
                    <small>{topic.signals} public-record signal{topic.signals === 1 ? '' : 's'}</small>
                  </article>
                ))}
              </div>
            ) : <p className={styles.note}>No clear gambling-position record is available for this legislator yet.</p>}
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}><div><span className={styles.kicker}>Recorded votes</span><h2>Gambling roll-call history</h2></div><span>Direct bills first · broader provisions labeled</span></header>
            {profile.votes.length > 0 ? (
              <div className={styles.voteList}>
                {profile.votes.map((vote) => (
                  <article className={styles.voteRow} key={vote.voteEventId}>
                    <span className={`${styles.choice} ${vote.choice === 'nay' ? styles.choiceNo : ''}`}>{vote.choice === 'yea' ? 'YES' : 'NO'}</span>
                    <div className={styles.voteIdentity}>
                      <div className={styles.tags}><span>{vote.scope}</span><span>{gamblingTopicLabel(vote.topic)}</span><span>{date(vote.occurredOn)}</span></div>
                      <strong>{vote.identifier} · {vote.title}</strong>
                      <small>{vote.chamberName} · {vote.yeaCount}-{vote.nayCount} · {recordKind(vote.voteKind)}</small>
                    </div>
                    {vote.sourceUrl ? <a href={vote.sourceUrl} target="_blank" rel="noreferrer">Bill ↗</a> : null}
                  </article>
                ))}
              </div>
            ) : <p className={styles.note}>No direct or embedded gambling roll-call votes are recorded for this legislator.</p>}
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}><div><span className={styles.kicker}>Views & actions</span><h2>Sourced public-position record</h2></div><span>Official votes, sponsorships and statements</span></header>
            {profile.publicRecord.length > 0 ? (
              <div className={styles.recordList}>
                {profile.publicRecord.map((record, index) => (
                  <article key={`${record.kind}-${record.sourceUrl}-${index}`}>
                    <div className={styles.tags}><span>{record.kind}</span><span>{gamblingTopicLabel(record.topic)}</span>{record.occurredOn ? <span>{date(record.occurredOn)}</span> : null}</div>
                    <strong>{record.label}</strong>
                    <p>{record.detail}</p>
                    <a href={record.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>
                  </article>
                ))}
              </div>
            ) : <p className={styles.note}>No sourced gambling position has been attached yet.</p>}
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}><div><span className={styles.kicker}>Recent coverage</span><h2>Gambling news leads</h2></div><span>Discovery leads only · not model evidence until reviewed</span></header>
            {profile.recentNews.length > 0 ? (
              <div className={styles.newsList}>
                {profile.recentNews.map((item) => (
                  <a href={item.url} target="_blank" rel="noreferrer" key={item.url}>
                    <strong>{item.title}</strong>
                    <span>{item.domain ?? 'news source'}{item.publishedAt ? ` · ${date(item.publishedAt)}` : ''}</span>
                  </a>
                ))}
              </div>
            ) : <p className={styles.note}>{profile.newsStatus === 'unavailable' ? 'Live news search is temporarily unavailable.' : 'No recent gambling-related coverage was found.'}</p>}
          </section>
        </div>

        <aside className={styles.sideStack}>
          <section className={styles.panel}>
            <header className={styles.panelHeader}><div><span className={styles.kicker}>Auditable rating</span><h3>Tribal gaming signals</h3></div></header>
            {alignment.signals.length > 0 ? (
              <div className={styles.signalList}>
                {alignment.signals.map((signal) => (
                  <article key={signal.benchmarkKey}>
                    <div className={styles.signalTop}>
                      <span className={signal.aligned ? styles.aligned : styles.opposed}>{signal.aligned ? 'ALIGNED' : 'NOT ALIGNED'}</span>
                      <small>weight {signal.weight}</small>
                    </div>
                    <strong>{signal.label}</strong>
                    <p>{signal.detail}</p>
                    <span>{signal.sourceOrganization}</span>
                    <a href={signal.sourceUrl} target="_blank" rel="noreferrer">Benchmark source ↗</a>
                  </article>
                ))}
              </div>
            ) : <p className={styles.note}>No benchmark signal is available, so VotePredict does not assign a tribal gaming alignment score.</p>}
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}><div><span className={styles.kicker}>Campaign finance</span><h3>Gaming-related disclosure matches</h3></div></header>
            {profile.gamingFinance.length > 0 ? (
              <div className={styles.financeList}>
                {profile.gamingFinance.map((item, index) => (
                  <article key={`${item.kind}-${item.name}-${index}`}>
                    <span>{recordKind(item.kind)}</span>
                    <strong>{item.name}</strong>
                    <small>{money(item.amount)}{item.count ? ` · ${item.count} record${item.count === 1 ? '' : 's'}` : ''}{item.direction ? ` · ${item.direction}` : ''}</small>
                    <a href={item.sourceUrl} target="_blank" rel="noreferrer">CFB source ↗</a>
                  </article>
                ))}
              </div>
            ) : <p className={styles.note}>No gaming/tribal/casino keyword match appears among the top items in the bundled 2025–26 CFB snapshot.</p>}
            <p className={styles.note}>Finance matches are context only. They do not count toward the tribal alignment score or establish a policy position.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
