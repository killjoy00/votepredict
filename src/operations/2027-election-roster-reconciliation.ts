import { parseSosLegislativeByDistrict, normalizeMinnesotaDistrict, type SosLegislativeResultRow } from '@/evidence/minnesota-election-context';
import { normalizeMemberName } from '@/sources/minnesota/house-votes';
import type { HistoricalMembershipRecord } from '@/sources/minnesota/lrl-members';
import { assess2027OpeningRoster } from './2027-opening-roster-audit';
import { isObservedOpeningNameVariant, OPENING_ROSTER_NAME_VARIANT_SOURCE } from './2027-opening-roster-name-variants';

export const SOS_2026_DISTRICT_SOURCES = {
  house: 'https://electionresultsfiles.sos.mn.gov/20261103/LegislativeByDistrict.txt',
  senate: 'https://electionresultsfiles.sos.mn.gov/20261103/stsenate.txt',
} as const;
export type Chamber = keyof typeof SOS_2026_DISTRICT_SOURCES;
// SOS November 26 observation, not a prediction of later recount status.
// Require separate canvass evidence for all recount districts.
const RECOUNT_SEATS = new Set(['house:32A', 'senate:4', 'senate:33']);

function seat(chamber: Chamber, district: string): string {
  return `${chamber}:${normalizeMinnesotaDistrict(district)}`;
}

export function parseOpeningElectionRows(text: string, chamber: Chamber): SosLegislativeResultRow[] {
  const office = chamber === 'house' ? /^State Representative District\s+0*(\d+[AB])$/i : /^State Senator District\s+0*(\d+)$/i;
  const selected: string[] = [];
  for (const line of text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/)) {
    if (!line.trim()) continue;
    const fields = line.split(';').map(value => value.trim());
    const relevant = chamber === 'house' ? /^State Representative\b/i : /^State Senator\b/i;
    if (!relevant.test(fields[4] ?? '')) {
      // The district export may include rows for the other chamber; do not
      // silently accept HTML, malformed rows, or arbitrary different offices.
      if (!/^State (?:Representative|Senator) District\b/i.test(fields[4] ?? '')) throw new Error('Unexpected district export row');
      continue;
    }
    const title = office.exec(fields[4]);
    if (fields.length !== 16 || fields[0] !== 'MN' || fields[1] || fields[2] || !title ||
        normalizeMinnesotaDistrict(title[1]) !== normalizeMinnesotaDistrict(fields[5]) ||
        !fields[7] || !fields[10] ||
        ![6, 11, 12, 13, 15].every(i => /^\d+$/.test(fields[i]) && Number.isSafeInteger(Number(fields[i])))) {
      throw new Error(`Malformed ${chamber} district export row`);
    }
    const district = Number.parseInt(fields[5], 10);
    if (district < 1 || district > 67) throw new Error('Invalid legislative district');
    selected.push(line);
  }
  const rows = parseSosLegislativeByDistrict(selected.join('\n'));
  if (!rows.length) throw new Error(`No ${chamber} district results`);
  return rows;
}

export function reconcile2027OpeningElection(
  records: readonly HistoricalMembershipRecord[],
  houseRows: readonly SosLegislativeResultRow[],
  senateRows: readonly SosLegislativeResultRow[],
  observedOn: string,
) {
  const roster = assess2027OpeningRoster(records, observedOn);
  const members = new Map(roster.singleCandidates.map(c => [c.seat, c]));
  const recordsBySeat = new Map(records.map(r => [seat(r.chamber, r.district) + ':' + r.lrlId, r]));
  const groups = new Map<string, SosLegislativeResultRow[]>();
  for (const [chamber, rows] of [['house', houseRows], ['senate', senateRows]] as const) {
    for (const row of rows) {
      const key = seat(chamber, row.district);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
  }
  const results: Array<{ seat: string; status: 'matched_reported_leader' | 'observed_same_seat_name_variant' | 'recount_requires_certification' | 'missing_election' | 'incomplete_election' | 'no_unique_named_leader' | 'missing_lrl' | 'identity_or_party_mismatch'; leader?: string; leaderParty?: string; lrlId?: string; lrlName?: string; lrlParty?: string; variantSource?: typeof OPENING_ROSTER_NAME_VARIANT_SOURCE }> = [];
  const expected = Array.from({ length: 67 }, (_, i) => i + 1).flatMap(n => [`house:${n}A`, `house:${n}B`, `senate:${n}`]);
  for (const key of expected) {
    const rows = groups.get(key) ?? [];
    if (!rows.length) { results.push({ seat: key, status: 'missing_election' }); continue; }
    const total = rows[0].totalVotesForOffice;
    const officeIds = new Set(rows.map(r => r.officeId));
    const codes = new Set(rows.map(r => r.candidateOrder));
    if (officeIds.size !== 1 || codes.size !== rows.length || total <= 0 ||
        rows.some(r => r.totalVotesForOffice !== total || r.totalPrecincts <= 0 || r.precinctsReporting !== r.totalPrecincts || r.totalPrecincts !== rows[0].totalPrecincts) ||
        rows.reduce((sum, r) => sum + r.votes, 0) !== total) {
      results.push({ seat: key, status: 'incomplete_election' }); continue;
    }
    const top = Math.max(...rows.map(r => r.votes));
    const leaders = rows.filter(r => r.votes === top);
    const leader = leaders[0];
    if (leaders.length !== 1 || top <= 0 || leader.candidateOrder === 9901 || leader.party === 'WI' || /^WRITE[- ]?IN$/i.test(leader.candidateName)) {
      results.push({ seat: key, status: 'no_unique_named_leader' }); continue;
    }
    const name = [leader.candidateName, leader.suffix].filter(Boolean).join(' ');
    const candidate = members.get(key);
    const member = candidate ? recordsBySeat.get(key + ':' + candidate.lrlId) : undefined;
    const common = { seat: key, leader: name, leaderParty: leader.party, lrlId: member?.lrlId, lrlName: member?.name, lrlParty: member?.party };
    if (RECOUNT_SEATS.has(key)) { results.push({ ...common, status: 'recount_requires_certification' }); continue; }
    if (!member) { results.push({ ...common, status: 'missing_lrl' }); continue; }
    // Exact matches remain distinct from observed same-seat name variants.
    // Never fuzzy-match a changed name, party, seat or identity. Never certify
    // a recorded pairing or use it to resolve historical vote identity.
    const same = normalizeMemberName(name) === normalizeMemberName(member.name) && leader.party === member.party;
    if (same) { results.push({ ...common, status: 'matched_reported_leader' }); continue; }
    if (observedOn >= OPENING_ROSTER_NAME_VARIANT_SOURCE.observedOn && isObservedOpeningNameVariant({
      seat: key, lrlId: member.lrlId, electionName: name, lrlName: member.name,
      electionParty: leader.party, lrlParty: member.party,
    })) {
      results.push({ ...common, status: 'observed_same_seat_name_variant', variantSource: OPENING_ROSTER_NAME_VARIANT_SOURCE });
      continue;
    }
    results.push({ ...common, status: 'identity_or_party_mismatch' });
  }
  return {
    session: '2027-2028', observedOn, expectedSeats: 201,
    lrlTermCoverage: roster.singleCandidateSeats,
    matchedReportedLeaders: results.filter(r => r.status === 'matched_reported_leader').length,
    observedNameVariants: results.filter(r => r.status === 'observed_same_seat_name_variant').length,
    authoritativeRosterVerified: false as const,
    // Bulk tallies and LRL entries alone never prove the canvass, vacancies,
    // active membership, or that future reported oaths actually took place.
    results,
  };
}
