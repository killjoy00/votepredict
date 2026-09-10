import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guard';
import { loadLegislatorGamblingSummary } from '@/gambling/intelligence';
import { loadLegislatorIssueSummaries } from '@/legislators/issue-summary';
import { loadLegislatorProfile } from '@/legislators/profile';
import gamblingStyles from './gambling-summary.module.css';
import issueStyles from './issue-summary.module.css';
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
  const [profile, issueSummaries, gambling] = await Promise.all([
    loadLegislatorProfile(legislatorId),
    loadLegislatorIssueSummaries(legislatorId),
    loadLegislatorGamblingSummary(legislatorId),
  ]);
  if (!profile) notFound();

  const member = profile.currentMembership;
  const finance = profile.campaignFinance;
  const financeSource = finance?.contributions?.sourceUrl
    ?? finance?.expenditures?.sourceUrl
    ?? finance?.independentExpenditures?.sourceUrl;

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brandLink}>
          <span className={styles.brandMark}>VP</span>
          <span>VotePredict</span>
        </Link>
        <nav className={styles.topLinks} aria-label="Workspace navigation">
          <Link href="/dashboard/gambling" className={styles.backLink}>Gambling intelligence</Link>
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
            <span className={styles.badge}>{profile.voteSummary.recordedVotes} roll calls recorded</span>
            {profile.evidence.length > 0 ? <span className={styles.badge}>Stored source evidence</span> : null}
          </div>
        </div>
        <div className={styles.heroAside}>
          {member?.sourceUrl ? <a href={member.sourceUrl} target="_blank" rel="noreferrer">Official legislator page ↗</a> : null}
          {financeSource ? <a href={financeSource} target="_blank" rel="noreferrer">Campaign finance source ↗</a> : null}
          <Link href="/dashboard/legislators">← Back to chamber directory</Link>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Legislator vote metrics">
        <article className={styles.metricCard}>
          <span>Recorded roll calls</span>
          <strong>{profile.voteSummary.recordedVotes}</strong>
          <small>{profile.voteSummary.passageVotes} final-passage votes</small>
        </article>
        <article className={styles.metricCard}>
          <span>Passage Yes rate</span>
          <strong>{percent(profile.voteSummary.yesRate)}</strong>
          <small>{profile.voteSummary.yesVotes} Yes · {profile.voteSummary.noVotes} No</small>
        </article>
        <article className={styles.metricCard}>
          <span>Party alignment</span>
          <strong>{percent(profile.voteSummary.partyAlignment)}</strong>
          <small>{profile.voteSummary.partyAlignedVotes}/{profile.voteSummary.partyComparableVotes} comparable roll calls</small>
        </article>
        <article className={styles.metricCard}>
          <span>Primary issue areas</span>
          <strong>{issueSummaries.length}</strong>
          <small>Top classified policy areas · “Other” excluded</small>
        </article>
      </section>

      {gambling ? (
        <Link href={`/dashboard/legislators/${legislatorId}/gambling`} className={gamblingStyles.card}>
          <div className={gamblingStyles.heading}>
            <span>Priority issue · specialized intelligence</span>
            <h2>Gaming & gambling</h2>
            <p>{gambling.sportsBettingPosition}</p>
          </div>
          <div className={gamblingStyles.stats}>
            <div>
              <span>Direct gambling votes</span>
              <strong>{gambling.directVotes}</strong>
              <small>{gambling.latestVoteOn ? `latest ${date(gambling.latestVoteOn)}` : 'no recorded direct vote'}</small>
            </div>
            <div>
              <span>Tribal gaming alignment</span>
              <strong>{gambling.tribalGamingAlignment.score ?? '—'}</strong>
              <small>{gambling.tribalGamingAlignment.score === undefined ? 'no benchmark signal' : `${gambling.tribalGamingAlignment.confidence} confidence`}</small>
            </div>
            <div>
              <span>Rating evidence</span>
              <strong>{gambling.tribalGamingAlignment.signals.length}</strong>
              <small>{gambling.tribalGamingAlignment.observedWeight.toFixed(2)} evidence weight</small>
            </div>
            <span className={gamblingStyles.open}>Open gambling dossier →</span>
          </div>
        </Link>
      ) : null}

      <div className={styles.profileGrid}>
        <div className={styles.mainStack}>
          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Issue intelligence</span>
                <h2>How this legislator behaves by issue</h2>
              </div>
              <span>Voting patterns, party breaks, cross-party overlap and sourced evidence · tap for full dossier</span>
            </header>
            {issueSummaries.length > 0 ? (
              <div className={issueStyles.summaryList}>
                {issueSummaries.map((issue) => {
                  const peer = issue.strongestCrossParty;
                  return (
                    <Link
                      className={issueStyles.summaryCard}
                      href={`/dashboard/legislators/${legislatorId}/issues/${encodeURIComponent(issue.area)}`}
                      key={issue.area}
                    >
                      <div className={issueStyles.summaryTop}>
                        <div className={issueStyles.identity}>
                          <strong>{issueName(issue.area)}</strong>
                          <span>{issue.rollCallVotes} roll calls · {issue.distinctBills} bills · latest {date(issue.latestVoteOn)}</span>
                        </div>
                        <div className={issueStyles.yesRate}>
                          {percent(issue.yesRate)}
                          <small>Yes activity</small>
                        </div>
                      </div>

                      <div className={issueStyles.bar} aria-label={`${percent(issue.yesRate)} Yes activity`}>
                        <span style={{ width: `${Math.round((issue.yesRate ?? 0) * 100)}%` }} />
                      </div>

                      <div className={issueStyles.stats}>
                        <div className={issueStyles.stat}>
                          <span>Party alignment</span>
                          <strong>{percent(issue.partyAlignment)}</strong>
                        </div>
                        <div className={issueStyles.stat}>
                          <span>Party breaks</span>
                          <strong>{issue.partyBreaks}</strong>
                        </div>
                        <div className={issueStyles.stat}>
                          <span>Closest margin</span>
                          <strong>{issue.closestMargin ?? '—'}</strong>
                        </div>
                        <div className={issueStyles.stat}>
                          <span>Sourced evidence</span>
                          <strong>{issue.evidenceCount}</strong>
                        </div>
                      </div>

                      <div className={issueStyles.signalRow}>
                        {issue.partyBreaks > 0 ? (
                          <span className={issueStyles.signalStrong}>
                            {issue.partyBreaks} party break{issue.partyBreaks === 1 ? '' : 's'} worth reviewing
                          </span>
                        ) : (
                          <span className={issueStyles.signal}>No recorded party breaks</span>
                        )}
                        {issue.closestMargin !== undefined && issue.closestMargin <= 3 ? (
                          <span className={issueStyles.signalStrong}>Close chamber vote in record</span>
                        ) : null}
                        {issue.evidenceCount > 0 ? (
                          <span className={issueStyles.signalEvidence}>
                            {issue.evidenceCount} sourced item{issue.evidenceCount === 1 ? '' : 's'}
                          </span>
                        ) : null}
                      </div>

                      {peer ? (
                        <div className={issueStyles.crossParty}>
                          <span>Strongest current-session cross-party overlap: {peer.name} ({peer.party} · {peer.district})</span>
                          <strong>{percent(peer.agreement)} · {peer.sharedVotes} shared</strong>
                        </div>
                      ) : (
                        <div className={issueStyles.crossParty}>
                          <span>No cross-party comparison with at least 8 shared issue votes</span>
                          <strong className={issueStyles.openCue}>Open dossier →</strong>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className={styles.note}>No classified bill-linked roll-call history is available for this legislator yet.</p>
            )}
            <p className={styles.note}>
              Issue categories are derived from bill titles. Yes activity is descriptive, not an ideology or support score. Party alignment compares each vote with the member’s party majority on that roll call; cross-party overlap is descriptive co-voting, not evidence of coordination.
            </p>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Voting alignment</span>
                <h2>Closest voting partners</h2>
              </div>
              <span>Current-session recorded roll calls</span>
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
            ) : <p className={styles.note}>Not enough shared current-session roll calls to calculate alignment.</p>}
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
              <span>Accumulates as Deep research finds usable sources</span>
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
                <h3>Current 2025–26 CFB disclosure</h3>
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
                    <span>Candidate committee spending</span>
                    <strong>{money(finance.expenditures?.totalAmount)}</strong>
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
                {finance.expenditures?.topPayees.length ? (
                  <>
                    <p className={styles.note}>Top candidate-committee payees</p>
                    <div className={styles.financeList}>
                      {finance.expenditures.topPayees.slice(0, 5).map((item) => (
                        <div className={styles.financeItem} key={`${item.name}-${item.amount}`}>
                          <strong>{item.name}</strong>
                          <span>{money(item.amount)} · {item.count} item{item.count === 1 ? '' : 's'}{item.type ? ` · ${item.type}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </>
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
                <p className={styles.note}>Current records come from the persisted CFB evidence refresh. Campaign-finance relationships are context only and are not treated as evidence that a legislator supports or opposes a bill.</p>
              </>
            ) : <p className={styles.note}>No current 2025–26 campaign-finance evidence is available for this legislator.</p>}
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
