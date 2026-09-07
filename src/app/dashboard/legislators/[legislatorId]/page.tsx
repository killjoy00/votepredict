import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guard';
import { loadLegislatorProfile } from '@/legislators/profile';
import styles from '../legislators.module.css';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ legislatorId: string }> };

function percent(value: number | undefined): string {
  return value === undefined ? '—' : `${Math.round(value * 100)}%`;
}

function money(value: number | undefined): string {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function date(value: string | undefined): string {
  if (!value) return '—';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

function issueName(value: string): string {
  return value.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function sourceKind(value: string): string {
  return value.replaceAll('_', ' ');
}

export default async function LegislatorProfilePage({ params }: PageProps) {
  await requireOwner();
  const { legislatorId } = await params;
  const profile = await loadLegislatorProfile(legislatorId);
  if (!profile) notFound();

  const member = profile.currentMembership;
  const finance = profile.campaignFinance;

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brandLink}>
          <span className={styles.brandMark}>VP</span>
          <span>VotePredict</span>
        </Link>
        <nav className={styles.topLinks} aria-label="Workspace navigation">
          <Link href="/dashboard/legislators" className={styles.backLink}>All legislators</Link>
          <Link href="/dashboard" className={styles.backLink}>Forecast desk</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.kicker}>Legislator profile</span>
          <h1>{profile.name}</h1>
          <p className={styles.heroMeta}>
            {member
              ? `${member.title} · ${member.chamberName} · District ${member.district}`
              : 'Historical Minnesota legislator'}
          </p>
          <div className={styles.heroBadges}>
            {member ? <span className={styles.badge}>{member.party}</span> : null}
            {member ? <span className={styles.badge}>District {member.district}</span> : null}
            <span className={styles.badge}>{profile.voteSummary.passageVotes} passage votes recorded</span>
            {profile.evidence.length > 0 ? <span className={styles.badge}>{profile.evidence.length} stored evidence items</span> : null}
          </div>
        </div>
        <div className={styles.heroAside}>
          {member?.sourceUrl ? <a href={member.sourceUrl} target="_blank" rel="noreferrer">Official legislator page ↗</a> : null}
          {finance?.contributions?.sourceUrl ? <a href={finance.contributions.sourceUrl} target="_blank" rel="noreferrer">Campaign finance source ↗</a> : null}
          <Link href="/dashboard/legislators">← Back to chamber directory</Link>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Legislator vote metrics">
        <article className={styles.metricCard}>
          <span>Passage votes</span>
          <strong>{profile.voteSummary.passageVotes}</strong>
          <small>{profile.voteSummary.yesVotes} Yes · {profile.voteSummary.noVotes} No</small>
        </article>
        <article className={styles.metricCard}>
          <span>Yes rate</span>
          <strong>{percent(profile.voteSummary.yesRate)}</strong>
          <small>Recorded final-passage votes</small>
        </article>
        <article className={styles.metricCard}>
          <span>Party alignment</span>
          <strong>{percent(profile.voteSummary.partyAlignment)}</strong>
          <small>{profile.voteSummary.partyAlignedVotes}/{profile.voteSummary.partyComparableVotes} votes with a party majority</small>
        </article>
        <article className={styles.metricCard}>
          <span>Issue areas</span>
          <strong>{profile.issues.length}</strong>
          <small>Tagged areas with recorded passage votes</small>
        </article>
      </section>

      <div className={styles.profileGrid}>
        <div className={styles.mainStack}>
          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Issue record</span>
                <h2>Where the voting history is concentrated</h2>
              </div>
              <span>Bill-text tags · descriptive, not ideology scores</span>
            </header>
            {profile.issues.length > 0 ? (
              <div className={styles.issueList}>
                {profile.issues.map((issue) => (
                  <div className={styles.issueRow} key={issue.area}>
                    <div className={styles.issueName}>
                      <strong>{issueName(issue.area)}</strong>
                      <span>{issue.passageVotes} votes · latest {date(issue.latestVoteOn)}</span>
                    </div>
                    <div className={styles.issueBar} aria-label={`${percent(issue.yesRate)} Yes rate`}>
                      <span style={{ width: `${Math.round((issue.yesRate ?? 0) * 100)}%` }} />
                    </div>
                    <div className={styles.issueRate}>{percent(issue.yesRate)} Yes</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.note}>No tagged passage-vote history is available for this legislator yet.</p>
            )}
            <p className={styles.note}>
              “Yes rate” means the share of recorded passage votes tagged to that policy area that received a Yes vote. It does not mean support for every policy concept inside the category.
            </p>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Voting alignment</span>
                <h2>Closest voting partners</h2>
              </div>
              <span>Current-session passage votes</span>
            </header>
            {profile.closestAlignments.length > 0 ? (
              <div className={styles.alignmentList}>
                {profile.closestAlignments.map((peer) => (
                  <Link href={`/dashboard/legislators/${peer.legislatorId}`} className={styles.alignmentRow} key={peer.membershipId}>
                    <div className={styles.alignmentIdentity}>
                      <strong>{peer.name}</strong>
                      <span>{peer.party} · District {peer.district} · {peer.sharedVotes} shared votes</span>
                    </div>
                    <span className={styles.alignmentScore}>{percent(peer.agreement)}</span>
                  </Link>
                ))}
              </div>
            ) : <p className={styles.note}>Not enough shared current-session passage votes to calculate alignment.</p>}
            <p className={styles.note}>Alignment is descriptive co-voting, not evidence of coordination or a formal caucus bloc.</p>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>High-leverage history</span>
                <h2>Closest passage votes</h2>
              </div>
              <span>Smallest Yes–No margins first</span>
            </header>
            {profile.notableVotes.length > 0 ? (
              <div className={styles.voteList}>
                {profile.notableVotes.map((vote) => (
                  <div className={styles.voteRow} key={vote.voteEventId}>
                    <span className={`${styles.voteChoice} ${vote.choice === 'nay' ? styles.no : ''}`}>{vote.choice === 'yea' ? 'YES' : 'NO'}</span>
                    <div className={styles.voteIdentity}>
                      <strong>{vote.identifier ?? 'Recorded passage vote'}</strong>
                      <span>{vote.title ?? 'Bill title unavailable'} · {date(vote.occurredOn)}</span>
                    </div>
                    <div className={styles.voteTally}>{vote.yeaCount}–{vote.nayCount}<br />margin {vote.margin}</div>
                  </div>
                ))}
              </div>
            ) : <p className={styles.note}>No recorded passage votes are available.</p>}
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Source-backed intelligence</span>
                <h2>Stored evidence</h2>
              </div>
              <span>Populates as Deep research finds usable sources</span>
            </header>
            {profile.evidence.length > 0 ? (
              <div className={styles.evidenceList}>
                {profile.evidence.map((item, index) => (
                  <article className={styles.evidenceItem} key={`${item.sourceUrl}-${index}`}>
                    <div className={styles.evidenceMeta}>
                      <span>{sourceKind(item.kind)}</span>
                      {item.stance ? <span>{item.stance}</span> : null}
                      <span>{sourceKind(item.sourceQuality)}</span>
                      {item.publishedAt ? <span>{date(item.publishedAt)}</span> : null}
                    </div>
                    <strong>{item.claim}</strong>
                    {item.excerpt ? <p>“{item.excerpt}”</p> : null}
                    <a href={item.sourceUrl} target="_blank" rel="noreferrer" className={styles.sourceLink}>Open source ↗</a>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.note}>No persisted Deep-research evidence has been attached to this legislator yet. Future researched forecasts will accumulate here.</p>
            )}
          </section>
        </div>

        <aside className={styles.sideStack}>
          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Cross-party overlap</span>
                <h3>Most similar other-party voters</h3>
              </div>
            </header>
            {profile.crossPartyAlignments.length > 0 ? (
              <div className={styles.alignmentList}>
                {profile.crossPartyAlignments.map((peer) => (
                  <Link href={`/dashboard/legislators/${peer.legislatorId}`} className={styles.alignmentRow} key={peer.membershipId}>
                    <div className={styles.alignmentIdentity}>
                      <strong>{peer.name}</strong>
                      <span>{peer.party} · {peer.district} · {peer.sharedVotes} shared</span>
                    </div>
                    <span className={styles.alignmentScore}>{percent(peer.agreement)}</span>
                  </Link>
                ))}
              </div>
            ) : <p className={styles.note}>No cross-party comparison is available yet.</p>}
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Campaign finance</span>
                <h3>2025–26 disclosure snapshot</h3>
              </div>
            </header>
            {finance ? (
              <>
                <p className={styles.note}>{finance.committeeName}</p>
                <div className={styles.financeSummary}>
                  <div>
                    <span>Candidate committee receipts</span>
                    <strong>{money(finance.contributions?.totalAmount)}</strong>
                  </div>
                  <div>
                    <span>Independent expenditures</span>
                    <strong>{money(finance.independentExpenditures?.totalAmount)}</strong>
                  </div>
                </div>
                {finance.contributions?.topContributors.length ? (
                  <div className={styles.financeList}>
                    {finance.contributions.topContributors.slice(0, 6).map((item) => (
                      <div className={styles.financeItem} key={`${item.name}-${item.amount}`}>
                        <strong>{item.name}</strong>
                        <span>{money(item.amount)} · {item.count} disclosed receipt{item.count === 1 ? '' : 's'}{item.type ? ` · ${item.type}` : ''}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {finance.independentExpenditures?.topSpenders.length ? (
                  <>
                    <p className={styles.note}>Top independent spenders affecting this candidate</p>
                    <div className={styles.financeList}>
                      {finance.independentExpenditures.topSpenders.slice(0, 5).map((item) => (
                        <div className={styles.financeItem} key={`${item.name}-${item.amount}`}>
                          <strong>{item.name}</strong>
                          <span>{money(item.amount)}{item.direction ? ` · ${item.direction}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                <p className={styles.note}>Campaign-finance relationships are context only. They are not treated as evidence that a legislator supports or opposes a bill.</p>
              </>
            ) : <p className={styles.note}>No matched 2025–26 legislative candidate committee was found in the bundled CFB snapshot.</p>}
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Service history</span>
                <h3>Memberships in the corpus</h3>
              </div>
            </header>
            <div className={styles.membershipList}>
              {profile.memberships.map((membership) => (
                <div className={styles.membershipRow} key={membership.membershipId}>
                  <strong>{membership.sessionName}</strong>
                  <span>{membership.chamberName} · {membership.party} · District {membership.district}{membership.current ? ' · current' : ''}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
