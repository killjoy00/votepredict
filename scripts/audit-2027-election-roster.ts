import { getMinnesotaHouseSession, minnesotaLocalDate } from '../src/sources/minnesota/sessions.js';
import { fetchLrlLegislatorRefs, fetchLrlSenatorDetail, parseLrlMembershipDetails, type HistoricalMembershipRecord } from '../src/sources/minnesota/lrl-members.js';
import { reconcile2027OpeningElection } from '../src/operations/2027-election-roster-reconciliation.js';
import { assess2027OpeningRoster } from '../src/operations/2027-opening-roster-audit.js';
import { fetchOpeningElectionDistrict } from '../src/operations/2027-opening-election-source.js';
import { setTimeout as pause } from 'node:timers/promises';
import { createHash } from 'node:crypto';

async function main() {
  const session = getMinnesotaHouseSession('2027-2028');
  const observedAt = new Date();
  const observedOn = minnesotaLocalDate(observedAt);
  const [house, senate, refs] = await Promise.all([
    fetchOpeningElectionDistrict('house'), fetchOpeningElectionDistrict('senate'),
    fetchLrlLegislatorRefs(session),
  ]);
  // This opening-only, one-pass audit must not turn an unexpected directory
  // into an unbounded crawl. Later replacements need a separate scoped audit.
  if (refs.length > 201) throw new Error(`Unexpected opening directory size: ${refs.length}; review before collecting more records`);
  const records: HistoricalMembershipRecord[] = [];
  const errors: Array<{ lrlId: string; sourceUrl: string; reason: string }> = [];
  const detailDigests: Array<{ lrlId: string; sourceUrl: string; fetchedAt: string; sha256: string; records: number }> = [];
  // Sequential and deliberately paced: only one LRL detail request in flight.
  for (const [index, ref] of refs.entries()) {
    try {
      const html = await fetchLrlSenatorDetail(ref.sourceUrl);
      const parsed = parseLrlMembershipDetails({ html, session, lrlId: ref.lrlId, fallbackName: ref.displayName, sourceUrl: ref.sourceUrl });
      detailDigests.push({ lrlId: ref.lrlId, sourceUrl: ref.sourceUrl, fetchedAt: new Date().toISOString(),
        sha256: createHash('sha256').update(html).digest('hex'), records: parsed.length });
      if (!parsed.length) throw new Error('No opening-session membership block parsed');
      records.push(...parsed);
    } catch (error) {
      errors.push({ lrlId: ref.lrlId, sourceUrl: ref.sourceUrl, reason: error instanceof Error ? error.message : String(error) });
    }
    // Stop on a sustained source failure instead of hammering the website.
    if (errors.length >= 5) break;
    if (index < refs.length - 1) await pause(150);
    if ((index + 1) % 50 === 0) console.log(`Observed ${index + 1}/${refs.length} public member detail pages`);
  }
  const roster = assess2027OpeningRoster(records, observedOn);
  const result = reconcile2027OpeningElection(records, house.rows, senate.rows, observedOn);
  const { rows: _houseRows, ...houseSource } = house;
  const { rows: _senateRows, ...senateSource } = senate;
  const counts: Record<string, number> = {};
  for (const row of result.results) counts[row.status] = (counts[row.status] ?? 0) + 1;
  const oathCounts: Record<string, number> = {};
  for (const row of roster.singleCandidates) oathCounts[row.oathDateStatus] = (oathCounts[row.oathDateStatus] ?? 0) + 1;
  console.log('OPENING_ROSTER_SUMMARY ' + JSON.stringify({
    observedAt: observedAt.toISOString(), directoryRefs: refs.length,
    detailPagesObserved: detailDigests.length, detailErrors: errors.length, membershipRecords: records.length,
    expectedSeats: roster.expectedSeats, singleCandidateSeats: roster.singleCandidateSeats,
    completeSourceTermCoverage: roster.completeSourceTermCoverage, counts, oathCounts,
    missingSeats: roster.missingSeats, conflictingSeats: roster.conflictingSeats,
    unresolvedTerms: roster.unresolvedTerms, invalidDistricts: roster.invalidDistricts,
    outsideOpeningTerm: roster.outsideOpeningTerm, multiSeatIdentities: roster.multiSeatIdentities,
    authoritativeRosterVerified: false, readyForActivation: false,
  }));
  console.log('OPENING_ROSTER_RECONCILIATION ' + JSON.stringify({
    sources: [houseSource, senateSource], observedAt: observedAt.toISOString(), errors,
    detailDigests, roster, ...result,
  }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
