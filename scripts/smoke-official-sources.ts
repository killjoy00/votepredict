import { fetchHouseVoteDetail, fetchHouseVoteSummary, discoverHouseVoteBillLinks, parseHouseVoteDetailHtml } from '../src/sources/minnesota/house-votes.js';
import { buildLrlSessionSearchUrl, discoverLrlLegislators } from '../src/sources/minnesota/lrl-members.js';
import { fetchRevisorBill } from '../src/sources/minnesota/revisor.js';
import { fetchSenateJournal, listSenateJournalLinks, parseSenateJournalText } from '../src/sources/minnesota/senate-journals.js';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'VotePredict/2.0 official-source smoke test' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function main(): Promise<void> {
  const sessionKey = process.argv[2] ?? '302';
  const session = getMinnesotaHouseSession(sessionKey);
  const results: Record<string, unknown> = { session: session.slug };

  const houseSummary = await fetchHouseVoteSummary(sessionKey);
  const houseLinks = discoverHouseVoteBillLinks(houseSummary.html, sessionKey);
  if (houseLinks.length === 0) throw new Error('House smoke test found no recorded-vote bill links');
  const houseDetail = await fetchHouseVoteDetail(sessionKey, houseLinks[houseLinks.length - 1].billIdentifier);
  const houseVotes = parseHouseVoteDetailHtml({ html: houseDetail.html, sessionKey, sourceUrl: houseDetail.sourceUrl });
  results.house = { discoveredBills: houseLinks.length, sampledBill: houseLinks[houseLinks.length - 1].billIdentifier, parsedVotes: houseVotes.length };

  const senateLinks = await listSenateJournalLinks(session.slug);
  const senateJournal = senateLinks[senateLinks.length - 1];
  const senateDocument = await fetchSenateJournal(senateJournal.sourceUrl);
  const senateVotes = parseSenateJournalText({ text: senateDocument.text, sessionKey, sourceUrl: senateJournal.sourceUrl, occurredOn: senateJournal.date });
  results.senate = { discoveredJournals: senateLinks.length, sampledJournal: senateJournal.sourceUrl, pdfBytes: senateDocument.byteLength, parsedPassageVotes: senateVotes.length };

  const lrlSearchUrl = buildLrlSessionSearchUrl(session);
  const lrlRefs = discoverLrlLegislators(await fetchText(lrlSearchUrl));
  if (lrlRefs.length < 190) throw new Error(`LRL smoke test found only ${lrlRefs.length} legislators`);
  results.memberships = { discoveredLegislators: lrlRefs.length, sourceUrl: lrlSearchUrl };

  const sampledBill = houseLinks.find((link) => /^HF\d+$/.test(link.billIdentifier)) ?? houseLinks[0];
  const revisor = await fetchRevisorBill(sessionKey, sampledBill.billIdentifier, false);
  results.revisor = { sampledBill: revisor.identifier, legislature: revisor.legislature, sourceUrl: revisor.sourceUrl };

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
