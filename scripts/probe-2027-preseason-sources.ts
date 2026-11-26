import { fetchOpeningElectionDistrict } from '../src/operations/2027-opening-election-source.js';
import { reconcile2027OpeningElection } from '../src/operations/2027-election-roster-reconciliation.js';
import { buildLrlSessionSearchUrl, fetchLrlLegislatorRefs } from '../src/sources/minnesota/lrl-members.js';
import { probeHouseRegularSessionKey } from '../src/sources/minnesota/house-votes.js';
import { buildSenateJournalIndexUrl, discoverSenateJournalLinks } from '../src/sources/minnesota/senate-journals.js';
import { fetchRevisorBillSearchRangeDocument } from '../src/sources/minnesota/revisor-bill-search.js';
import { getMinnesotaHouseSession, minnesotaLocalDate } from '../src/sources/minnesota/sessions.js';

async function main() {
  const session = getMinnesotaHouseSession('2027-2028');
  const observedAt = new Date();
  // Seven bounded public requests; no detail-page crawl, credentials, database,
  // Vercel, forecast, or assumption that an empty index proves nonexistence.
  const tasks = {
    rosterIndex: (async () => ({ url: buildLrlSessionSearchUrl(session),
      refs: (await fetchLrlLegislatorRefs(session)).length }))(),
    houseVoteIndex: probeHouseRegularSessionKey(session.slug),
    senateJournalIndex: (async () => {
      const url = buildSenateJournalIndexUrl(session.slug);
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'error',
        headers: { 'User-Agent': 'VotePredict/2.0 preseason source readiness' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { url, matchingJournals: discoverSenateJournalLinks(await response.text(), session.slug).length };
    })(),
    houseBillIndex: fetchRevisorBillSearchRangeDocument({ sessionKey: session.slug, body: 'House', firstBill: 1, lastBill: 500 })
      .then(({ sourceUrl, contentSha256, results }) => ({ sourceUrl, contentSha256, bills: results.length })),
    senateBillIndex: fetchRevisorBillSearchRangeDocument({ sessionKey: session.slug, body: 'Senate', firstBill: 1, lastBill: 500 })
      .then(({ sourceUrl, contentSha256, results }) => ({ sourceUrl, contentSha256, bills: results.length })),
    houseElection: fetchOpeningElectionDistrict('house').then(({ rows, ...source }) => ({
      ...source, rows: rows.length, districts: new Set(rows.map(r => r.district)).size,
      tallies: summarizeElection(rows, [], observedAt, 'house'),
    })),
    senateElection: fetchOpeningElectionDistrict('senate').then(({ rows, ...source }) => ({
      ...source, rows: rows.length, districts: new Set(rows.map(r => r.district)).size,
      tallies: summarizeElection([], rows, observedAt, 'senate'),
    })),
  };
  const results = await Promise.allSettled(Object.values(tasks));
  const report = Object.fromEntries(Object.keys(tasks).map((name, index) => {
    const result = results[index];
    return [name, result.status === 'fulfilled'
      ? { status: 'observed', data: result.value }
      : { status: 'unverified', reason: result.reason instanceof Error ? result.reason.message : String(result.reason) }];
  }));
  console.log('PRESEASON_SOURCE_REPORT ' + JSON.stringify({
    session: session.slug, observedAt: observedAt.toISOString(), authoritativeRosterVerified: false,
    readyForActivation: false, report,
  }));
  // Unpublished or inaccessible sources are reportable blockers, not an
  // assertion that a job failed or the legislature is ready.
}

function summarizeElection(
  house: Parameters<typeof reconcile2027OpeningElection>[1],
  senate: Parameters<typeof reconcile2027OpeningElection>[2],
  observedAt: Date,
  chamber: 'house' | 'senate',
) {
  const counts: Record<string, number> = {};
  for (const row of reconcile2027OpeningElection([], house, senate, minnesotaLocalDate(observedAt)).results) {
    if (row.seat.startsWith(chamber + ':')) counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
