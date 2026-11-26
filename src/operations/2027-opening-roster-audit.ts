import type { HistoricalMembershipRecord } from '@/sources/minnesota/lrl-members';

export const OPENING_ROSTER_TARGET_ON = '2027-01-04' as const;

type Seat = string;
const EXPECTED: readonly Seat[] = Array.from({ length: 67 }, (_, index) => index + 1)
  .flatMap((district) => [`house:${district}A`, `house:${district}B`, `senate:${district}`]);
const EXPECTED_SET = new Set(EXPECTED);

function seatKey(record: HistoricalMembershipRecord): Seat {
  return `${record.chamber}:${record.district.trim().toUpperCase().replace(/^0+(?=\d)/, '')}`;
}

function validDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Audit the 201 opening-term seats using source-reported terms, not just the
 * number of legislators in an index. This is a single-source planning audit,
 * never proof of certification, occupancy, or actual swearing-in.
 * An unaccounted seat is unresolved, never an inferred vacancy.
 */
export function assess2027OpeningRoster(
  records: readonly HistoricalMembershipRecord[],
  observedOn: string,
) {
  if (!validDate(observedOn)) throw new Error('Invalid roster observation date');
  const candidates = new Map<Seat, Map<string, HistoricalMembershipRecord>>();
  const invalidDistricts: Array<{ seat: string; lrlId: string }> = [];
  const unresolvedTerms: Array<{ seat: string; lrlId: string }> = [];
  const outsideOpeningTerm: Array<{ seat: string; lrlId: string }> = [];
  for (const record of records) {
    const seat = seatKey(record);
    if (!EXPECTED_SET.has(seat)) {
      invalidDistricts.push({ seat, lrlId: record.lrlId });
      continue;
    }
    if (!validDate(record.startsOn) || !validDate(record.endsOn) || record.startsOn > record.endsOn) {
      unresolvedTerms.push({ seat, lrlId: record.lrlId });
      continue;
    }
    if (record.startsOn > OPENING_ROSTER_TARGET_ON || record.endsOn < OPENING_ROSTER_TARGET_ON) {
      outsideOpeningTerm.push({ seat, lrlId: record.lrlId });
      continue;
    }
    const members = candidates.get(seat) ?? new Map();
    // Preserve separate overlapping term blocks: conflicting dates or oath
    // data must not silently disappear through a last-write-wins identity.
    const key = JSON.stringify([record.lrlId, record.party, record.startsOn, record.endsOn, record.oathOn]);
    members.set(key, record);
    candidates.set(seat, members);
  }

  const missingSeats: Seat[] = [];
  const conflictingSeats: Array<{ seat: Seat; lrlIds: string[] }> = [];
  const singleCandidates: Array<{ seat: Seat; lrlId: string; party: string; sourceUrl: string; oathDateStatus: 'not_reported' | 'future_reported_date' | 'reported_on_or_before_observation' }> = [];
  const seatsByIdentity = new Map<string, Set<Seat>>();
  for (const seat of EXPECTED) {
    const members = [...(candidates.get(seat)?.values() ?? [])];
    for (const member of members) {
      const seats = seatsByIdentity.get(member.lrlId) ?? new Set<Seat>();
      seats.add(seat);
      seatsByIdentity.set(member.lrlId, seats);
    }
    if (!members.length) { missingSeats.push(seat); continue; }
    if (members.length > 1) {
      conflictingSeats.push({ seat, lrlIds: [...new Set(members.map((member) => member.lrlId))] });
      continue;
    }
    const member = members[0];
    singleCandidates.push({
      seat,
      lrlId: member.lrlId,
      party: member.party,
      sourceUrl: member.sourceUrl,
      oathDateStatus: !validDate(member.oathOn) ? 'not_reported' :
        member.oathOn > observedOn ? 'future_reported_date' : 'reported_on_or_before_observation',
    });
  }
  const multiSeatIdentities = [...seatsByIdentity]
    .filter(([, seats]) => seats.size > 1)
    .map(([lrlId, seats]) => ({ lrlId, seats: [...seats] }));
  const completeSourceTermCoverage = singleCandidates.length === EXPECTED.length &&
    !invalidDistricts.length && !unresolvedTerms.length && !multiSeatIdentities.length;
  return {
    session: '2027-2028',
    targetOn: OPENING_ROSTER_TARGET_ON,
    observedOn,
    expectedSeats: { house: 134, senate: 67, total: 201 },
    singleCandidateSeats: {
      house: singleCandidates.filter((candidate) => candidate.seat.startsWith('house:')).length,
      senate: singleCandidates.filter((candidate) => candidate.seat.startsWith('senate:')).length,
    },
    completeSourceTermCoverage,
    // Independent election/chamber reconciliation, vacancy evidence and
    // actual oath confirmation are separate, even for 201/201 coverage.
    authoritativeRosterVerified: false as const,
    missingSeats,
    conflictingSeats,
    multiSeatIdentities,
    invalidDistricts,
    unresolvedTerms,
    outsideOpeningTerm,
    singleCandidates,
  };
}

/**
 * Opening import integrity, not independent election certification.
 * Never infer a vacancy from a missing record. A genuine vacancy requires
 * a separate authoritative reconciliation path before activation.
 */
export function assert2027OpeningRosterIntegrity(records: readonly HistoricalMembershipRecord[], observedOn: string): void {
  const audit = assess2027OpeningRoster(records, observedOn);
  if (!audit.completeSourceTermCoverage || audit.outsideOpeningTerm.length || records.length !== audit.expectedSeats.total) {
    throw new Error(`2027 opening roster integrity failed: ${JSON.stringify({
      records: records.length, singleCandidateSeats: audit.singleCandidateSeats,
      missingSeats: audit.missingSeats, conflictingSeats: audit.conflictingSeats,
      unresolvedTerms: audit.unresolvedTerms, invalidDistricts: audit.invalidDistricts,
      outsideOpeningTerm: audit.outsideOpeningTerm, multiSeatIdentities: audit.multiSeatIdentities,
    })}`);
  }
}
