import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guard';
import { loadLegislatorIssueDossier } from '@/legislators/issue-dossier';
import styles from './issue-dossier.module.css';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ legislatorId: string; issueArea: string }> };

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
  const parsed = new Date(value.length <= 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function displayKind(value: string): string {
  return value.replaceAll('_', ' ');
}

export default async function LegislatorIssueDossierPage({ params }: PageProps) {
  await requireOwner();
  const { legislatorId, issueArea } = await params;
  const dossier = await loadLegislatorIssueDossier(legislatorId, decodeURIComponent(issueArea));
  if (!dossier) notFound();

  const member = dossier.profile.currentMembership;
  const finance = dossier.profile.campaignFinance;
  const summary = dossier.summary;

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brandLink}>
          <span className={styles.brandMark}>VP</span>
          <span>VotePredict</span>
        </Link>
        <nav className={styles.topLinks} aria-label="Workspace navigation">
          <Link href={`/dashboard/legislators/${legislatorId}`}>Legislator profile</Link>
          <Link href="/dashboard/legislators">All legislators</Link>
          <Link href="/dashboard">Forecast desk</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.kicker}>Issue dossier</span>
          <h1>{dossier.label}</h1>
          <p className={styles.heroName}>{dossier.profile.name}</p>
          <p className={styles.heroMeta}>
            {member ? `${member.title} · ${member.chamberName} · District ${member.district} · ${member.party}` : 'Historical Minnesota legislator'}
          </p>
        </div>
        <div className={styles.heroAside}>
          <span>{summary.distinctBills} distinct bills</span>
          <span>{summary.rollCallVotes} bill-linked roll calls</span>
          <Link href={`/dashboard/legislators/${legislatorId}`}>← Back to full profile</Link>
        </div>
      </section>

      <section className={styles.metrics} aria-label={`${dossier.label} metrics`}>
        <article>
          <span>Issue roll calls</span>
          <strong>{summary.rollCallVotes}</strong>
          <small>{summary.passageVotes} final-passage votes</small>
        </article>
        <article>
          <span>Recorded Yes rate</span>
          <strong>{percent(summary.yesRate)}</strong>
          <small>{summary.yesVotes} Yes · {summary.noVotes} No</small>
        </article>
        <article>
          <span>Party-majority alignment</span>
          <strong>{percent(summary.partyAlignment)}</strong>
          <small>{summary.partyAlignedVotes}/{summary.partyComparableVotes} comparable roll calls</small>
        </article>
        <article>
          <span>Party breaks</span>
          <strong>{summary.partyBreaks}</strong>
          <small>Votes opposite the member&apos;s party majority</small>
        </article>
      </section>

      <div className={styles.grid}>
        <div className={styles.mainStack}>
          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Voting record</span>
                <h2>Where this member breaks from the party</h2>
              </div>
              <span>Descriptive roll-call behavior · not a policy-position score</span>
            </header>
            {dossier.partyBreakVotes.length > 0 ? (
              <div className={styles.voteList}>
                {dossier.partyBreakVotes.map((vote) => (
                  <article className={styles.voteRow} key={vote.voteEventId}>
                    <span className={`${styles.choice} ${vote.choice === 'nay' ? styles.choiceNo : ''}`}>{vote.choice === 'yea' ? 'YES' : 'NO'}</span>
                    <div className={styles.voteIdentity}>
                      <div className={styles.voteTags}>
                        <span>{displayKind(vote.voteKind)}</span>
                        {vote.isPassage ? <span>final passage</span> : null}
                        <span>party majority {vote.partyMajority === 'yea' ? 'Yes' : 'No'}</span>
                      </div>
                      <strong>{vote.identifier} · {vote.title}</strong>
                      <small>{date(vote.occurredOn)} · chamber tally {vote.yeaCount}–{vote.nayCount}</small>
                    </div>
                    {vote.sourceUrl ? <a href={vote.sourceUrl} target="_blank" rel="noreferrer">Official ↗</a> : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.note}>No recorded {dossier.label.toLowerCase()} roll call in the corpus puts this member opposite a non-tied party majority.</p>
            )}
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>High leverage</span>
                <h2>Closest roll calls on this issue</h2>
              </div>
              <span>Smallest chamber Yes–No margins first</span>
            </header>
            <div className={styles.voteList}>
              {dossier.closestVotes.map((vote) => (
                <article className={styles.voteRow} key={vote.voteEventId}>
                  <span className={`${styles.choice} ${vote.choice === 'nay' ? styles.choiceNo : ''}`}>{vote.choice === 'yea' ? 'YES' : 'NO'}</span>
                  <div className={styles.voteIdentity}>
                    <div className={styles.voteTags}>
                      <span>{displayKind(vote.voteKind)}</span>
                      {vote.isPassage ? <span>final passage</span> : null}
                      {vote.partyAligned === false ? <span className={styles.breakTag}>party break</span> : null}
                    </div>
                    <strong>{vote.identifier} · {vote.title}</strong>
                    <small>{date(vote.occurredOn)} · {vote.yeaCount}–{vote.nayCount} · margin {vote.margin}</small>
                  </div>
                  {vote.sourceUrl ? <a href={vote.sourceUrl} target="_blank" rel="noreferrer">Official ↗</a> : null}
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Source-backed intelligence</span>
                <h2>Evidence tied to {dossier.label.toLowerCase()} bills</h2>
              </div>
              <span>Only persisted evidence attached to this legislator and an issue bill</span>
            </header>
            {dossier.evidence.length > 0 ? (
              <div className={styles.evidenceList}>
                {dossier.evidence.map((item, index) => (
                  <article className={styles.evidenceItem} key={`${item.sourceUrl}-${index}`}>
                    <div className={styles.evidenceMeta}>
                      <span>{displayKind(item.kind)}</span>
                      {item.stance ? <span>{item.stance}</span> : null}
                      <span>{displayKind(item.sourceQuality)}</span>
                      {item.publishedAt ? <span>{date(item.publishedAt)}</span> : null}
                    </div>
                    <strong>{item.claim}</strong>
                    {item.excerpt ? <p>“{item.excerpt}”</p> : null}
                    <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.note}>No persisted Deep-research evidence is tied to this legislator and these issue bills yet. Future Deep forecasts on these measures will accumulate here.</p>
            )}
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Recent coverage</span>
                <h2>News leads for this member + issue</h2>
              </div>
              <span>GDELT article index · last 120 days</span>
            </header>
            {dossier.recentNews.length > 0 ? (
              <div className={styles.newsList}>
                {dossier.recentNews.map((article) => (
                  <a href={article.url} target="_blank" rel="noreferrer" className={styles.newsItem} key={article.url}>
                    <strong>{article.title}</strong>
                    <span>{article.domain ?? 'Source'}{article.publishedAt ? ` · ${date(article.publishedAt)}` : ''} ↗</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className={styles.note}>
                {dossier.newsStatus === 'unavailable'
                  ? 'The live news index was unavailable for this request. The voting and persisted-evidence sections are unaffected.'
                  : 'No recent indexed coverage matched this legislator and issue.'}
              </p>
            )}
            <p className={styles.note}>News-index results are research leads, not model evidence until a source is reviewed and persisted with provenance.</p>
          </section>
        </div>

        <aside className={styles.sideStack}>
          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Issue voting bloc</span>
                <h3>Closest current-session co-voters</h3>
              </div>
            </header>
            {dossier.closestAlignments.length > 0 ? (
              <div className={styles.alignmentList}>
                {dossier.closestAlignments.map((peer) => (
                  <Link href={`/dashboard/legislators/${peer.legislatorId}/issues/${issueArea}`} className={styles.alignmentRow} key={peer.membershipId}>
                    <div>
                      <strong>{peer.name}</strong>
                      <span>{peer.party} · District {peer.district} · {peer.sharedVotes} shared</span>
                    </div>
                    <b>{percent(peer.agreement)}</b>
                  </Link>
                ))}
              </div>
            ) : <p className={styles.note}>Not enough current-session shared issue roll calls to calculate a stable comparison.</p>}
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Cross-party overlap</span>
                <h3>Other-party co-voting on this issue</h3>
              </div>
            </header>
            {dossier.crossPartyAlignments.length > 0 ? (
              <div className={styles.alignmentList}>
                {dossier.crossPartyAlignments.map((peer) => (
                  <Link href={`/dashboard/legislators/${peer.legislatorId}/issues/${issueArea}`} className={styles.alignmentRow} key={peer.membershipId}>
                    <div>
                      <strong>{peer.name}</strong>
                      <span>{peer.party} · District {peer.district} · {peer.sharedVotes} shared</span>
                    </div>
                    <b>{percent(peer.agreement)}</b>
                  </Link>
                ))}
              </div>
            ) : <p className={styles.note}>No stable cross-party issue comparison is available.</p>}
            <p className={styles.note}>Co-voting is descriptive. It does not establish coordination, ideology, or membership in a formal voting bloc.</p>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Campaign finance context</span>
                <h3>Current 2025–26 CFB disclosure</h3>
              </div>
            </header>
            {finance ? (
              <>
                <div className={styles.financeSummary}>
                  <div><span>Committee receipts</span><strong>{money(finance.contributions?.totalAmount)}</strong></div>
                  <div><span>Candidate spending</span><strong>{money(finance.expenditures?.totalAmount)}</strong></div>
                  <div><span>Independent spending</span><strong>{money(finance.independentExpenditures?.totalAmount)}</strong></div>
                </div>
                {finance.contributions?.byContributorType.length ? (
                  <div className={styles.financeList}>
                    <h4>Contributor types</h4>
                    {finance.contributions.byContributorType.slice(0, 6).map((item) => (
                      <div key={`${item.name}-${item.amount}`}><strong>{item.name}</strong><span>{money(item.amount)} · {item.count} receipts</span></div>
                    ))}
                  </div>
                ) : null}
                {finance.contributions?.topEmployers.length ? (
                  <div className={styles.financeList}>
                    <h4>Top disclosed employers</h4>
                    {finance.contributions.topEmployers.slice(0, 6).map((item) => (
                      <div key={`${item.name}-${item.amount}`}><strong>{item.name}</strong><span>{money(item.amount)}</span></div>
                    ))}
                  </div>
                ) : null}
                {finance.expenditures?.topPayees.length ? (
                  <div className={styles.financeList}>
                    <h4>Top candidate-committee payees</h4>
                    {finance.expenditures.topPayees.slice(0, 5).map((item) => (
                      <div key={`${item.name}-${item.amount}`}><strong>{item.name}</strong><span>{money(item.amount)} · {item.count} items</span></div>
                    ))}
                  </div>
                ) : null}
                {finance.independentExpenditures?.topSpenders.length ? (
                  <div className={styles.financeList}>
                    <h4>Independent spenders affecting candidate</h4>
                    {finance.independentExpenditures.topSpenders.slice(0, 5).map((item) => (
                      <div key={`${item.name}-${item.amount}`}><strong>{item.name}</strong><span>{money(item.amount)}{item.direction ? ` · ${item.direction}` : ''}</span></div>
                    ))}
                  </div>
                ) : null}
                <p className={styles.note}>This current finance context comes from the persisted CFB evidence refresh. It is candidate-level, not issue-specific, and is never treated as proof of a policy position.</p>
              </>
            ) : <p className={styles.note}>No current 2025–26 campaign-finance evidence is available for this legislator.</p>}
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>Recent issue votes</span>
                <h3>Latest activity</h3>
              </div>
            </header>
            <div className={styles.compactVotes}>
              {dossier.recentVotes.slice(0, 10).map((vote) => (
                <div key={vote.voteEventId}>
                  <span className={vote.choice === 'yea' ? styles.yesText : styles.noText}>{vote.choice === 'yea' ? 'Yes' : 'No'}</span>
                  <strong>{vote.identifier}</strong>
                  <small>{date(vote.occurredOn)}</small>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
