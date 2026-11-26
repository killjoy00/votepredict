import { probeHouseRegularSessionKey } from '../src/sources/minnesota/house-votes.js';
import { buildSenateJournalIndexUrl, discoverSenateJournalLinks } from '../src/sources/minnesota/senate-journals.js';

const session = '2027-2028';

async function main() {
  const senateIndex = buildSenateJournalIndexUrl(session);
  const [house, senate] = await Promise.allSettled([
    probeHouseRegularSessionKey(session),
    (async () => {
      const response = await fetch(senateIndex, {
        headers: { 'User-Agent': 'VotePredict/2.0 session readiness probe' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`Senate index returned HTTP ${response.status}`);
      const links = discoverSenateJournalLinks(await response.text(), session);
      return { sourceUrl: senateIndex, matchingJournals: links.length, firstJournal: links[0] ?? null };
    })(),
  ]);
  console.log(JSON.stringify({ session, observedAt: new Date().toISOString(), house, senate }, (_key, value) => value instanceof Error ? value.message : value, 2));
  // No production activation or claims about the completeness of future votes.
  if (house.status === 'rejected' || senate.status === 'rejected') process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
