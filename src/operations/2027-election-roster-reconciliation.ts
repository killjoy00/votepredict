import { parseSosLegislativeByDistrict, normalizeMinnesotaDistrict, type SosLegislativeResultRow } from '@/evidence/minnesota-election-context';
import { normalizeMemberName } from '@/sources/minnesota/house-votes';
import type { HistoricalMembershipRecord } from '@/sources/minnesota/lrl-members';
import { assess2027OpeningRoster } from './2027-opening-roster-audit';
import { isObservedOpeningNameVariant, OPENING_ROSTER_NAME_VARIANT_SOURCE, acceptedRecountLeader, OPENING_RECOUNT_EVIDENCE } from './2027-opening-roster-name-variants';

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

export type OpeningElectionSeatResult = {
  seat: string;
  status: 'matched_reported_leader' | 'matched_name_variant' | 'accepted_recount_leader' | 'recount_requires_certification' | 'missing_election' | 'incomplete_election' | 'no_unique_named_leader' | 'missing_lrl' | 'identity_or_party_mismatch';
  leader?: string; leaderParty?: string; lrlId?: string; lrlName?: string; lrlParty?: string;
  variantSource?: typeof OPENING_ROSTER_NAME_VARIANT_SOURCE;
  recountEvidence?: typeof OPENING_RECOUNT_EVIDENCE;
  recountCertification?: 'county_certified_2026-11-19' | 'final_certification_unverified';
};

/** Classify a leader from an already validated district tally. */
export function resolve2027OpeningLeader(row: Omit<OpeningElectionSeatResult, 'status'>, observedOn: string): OpeningElectionSeatResult {
  const { seat, lrlId, leader, lrlName, leaderParty, lrlParty } = row;
  const identity = lrlId && leader && lrlName && leaderParty && lrlParty
    ? { seat, lrlId, electionName: leader, lrlName, electionParty: leaderParty, lrlParty } : undefined;
  if (RECOUNT_SEATS.has(seat)) {
    const assumed = identity && observedOn >= OPENING_RECOUNT_EVIDENCE.observedOn && acceptedRecountLeader(identity);
    return assumed ? { ...row, status: 'accepted_recount_leader', recountEvidence: OPENING_RECOUNT_EVIDENCE, recountCertification: assumed.certification }
      : { ...row, status: 'recount_requires_certification' };
  }
  if (!identity) return { ...row, status: 'missing_lrl' };
  if (normalizeMemberName(identity.electionName) === normalizeMemberName(identity.lrlName) && identity.electionParty === identity.lrlParty) {
    return { ...row, status: 'matched_reported_leader' };
  }
  if (observedOn >= OPENING_ROSTER_NAME_VARIANT_SOURCE.observedOn && isObservedOpeningNameVariant(identity)) {
    return { ...row, status: 'matched_name_variant', variantSource: OPENING_ROSTER_NAME_VARIANT_SOURCE };
  }
  return { ...row, status: 'identity_or_party_mismatch' };
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
  const results: OpeningElectionSeatResult[] = [];
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
    results.push(resolve2027OpeningLeader(common, observedOn));
  }
  return {
    session: '2027-2028', observedOn, expectedSeats: 201,
    lrlTermCoverage: roster.singleCandidateSeats,
    matchedReportedLeaders: results.filter(r => r.status === 'matched_reported_leader').length,
    resolvedNameVariants: results.filter(r => r.status === 'matched_name_variant').length,
    acceptedRecountLeaders: results.filter(r => r.status === 'accepted_recount_leader').length,
    preseasonPlan: build2027PreseasonRoster(roster, results),
    authoritativeRosterVerified: false as const,
    // Bulk tallies and LRL entries alone never prove the canvass, vacancies,
    // active membership, or that future reported oaths actually took place.
    results,
  };
}

type OpeningRosterAssessment = ReturnType<typeof assess2027OpeningRoster>;
const PLANNING_STATUSES = ['matched_reported_leader', 'matched_name_variant', 'accepted_recount_leader'] as const;
type PlanningStatus = typeof PLANNING_STATUSES[number];

/** Complete planning projection; never an authoritative or production roster. */
export function build2027PreseasonRoster(roster: OpeningRosterAssessment, results: readonly OpeningElectionSeatResult[]) {
  const lookup = new Map(roster.singleCandidates.map(candidate => [candidate.seat, candidate]));
  const members: Array<{
    seat: string; lrlId: string; name: string; electionName: string; party: string; sourceUrl: string;
    basis: PlanningStatus; recountCertification?: OpeningElectionSeatResult['recountCertification'];
    oathDateStatus: OpeningRosterAssessment['singleCandidates'][number]['oathDateStatus'];
  }> = [];
  const unresolvedSeats: string[] = [];
  const seen = new Set<string>();
  const identities = new Set<string>();
  for (const row of results) {
    const candidate = lookup.get(row.seat);
    const approved = PLANNING_STATUSES.find(status => status === row.status);
    if (!approved || !candidate || candidate.lrlId !== row.lrlId ||
        candidate.party !== row.leaderParty || candidate.party !== row.lrlParty ||
        !row.leader || !row.lrlName || seen.has(row.seat) || identities.has(candidate.lrlId)) {
      unresolvedSeats.push(row.seat);
      continue;
    }
    seen.add(row.seat);
    identities.add(candidate.lrlId);
    members.push({ seat: row.seat, lrlId: candidate.lrlId, name: row.lrlName,
      electionName: row.leader, party: candidate.party, sourceUrl: candidate.sourceUrl,
      basis: approved, ...(row.recountCertification ? {recountCertification: row.recountCertification} : {}),
      oathDateStatus: candidate.oathDateStatus });
  }
  for (const candidate of roster.singleCandidates) if (!seen.has(candidate.seat) && !unresolvedSeats.includes(candidate.seat)) unresolvedSeats.push(candidate.seat);
  const counts = {
    exact: members.filter(member => member.basis === 'matched_reported_leader').length,
    resolvedNameVariants: members.filter(member => member.basis === 'matched_name_variant').length,
    acceptedRecounts: members.filter(member => member.basis === 'accepted_recount_leader').length,
    house: members.filter(member => member.seat.startsWith('house:')).length,
    senate: members.filter(member => member.seat.startsWith('senate:')).length,
    total: members.length,
  };
  const complete = roster.completeSourceTermCoverage && roster.outsideOpeningTerm.length === 0 &&
    results.length === 201 && counts.house === 134 && counts.senate === 67 &&
    unresolvedSeats.length === 0 && identities.size === 201;
  return { session: roster.session, observedOn: roster.observedOn, targetOn: roster.targetOn,
    complete, counts, unresolvedSeats, members, authoritativeRosterVerified: false as const, readyForActivation: false as const };
}

/** Replay only the original audit's tally-validated rows, without network access. */
export function replay2027OpeningRosterCheckpoint(roster: OpeningRosterAssessment, original: readonly OpeningElectionSeatResult[]) {
  const candidates = new Map(roster.singleCandidates.map(candidate => [candidate.seat, candidate]));
  const results = original.map(row => {
    if (!['matched_reported_leader', 'identity_or_party_mismatch', 'recount_requires_certification'].includes(row.status)) return row;
    const candidate = candidates.get(row.seat);
    const { status: _status, ...observed } = row;
    return resolve2027OpeningLeader({ ...observed, lrlParty: candidate?.lrlId === row.lrlId ? candidate?.party : undefined }, roster.observedOn);
  });
  return build2027PreseasonRoster(roster, results);
}
