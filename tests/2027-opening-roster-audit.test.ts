import assert from 'node:assert/strict';
import test from 'node:test';
import { assess2027OpeningRoster } from '../src/operations/2027-opening-roster-audit.js';
import type { HistoricalMembershipRecord } from '../src/sources/minnesota/lrl-members.js';

function record(chamber: 'house' | 'senate', district: string, lrlId: string): HistoricalMembershipRecord {
  return {
    chamber, district, lrlId, name: `Synthetic ${lrlId}`, normalizedName: `synthetic ${lrlId}`,
    party: 'I', startsOn: '2027-01-04', endsOn: '2028-12-31',
    oathOn: '2027-01-12', sourceUrl: `https://www.lrl.mn.gov/legdb/fulldetail?ID=${lrlId}`,
  };
}
const full = Array.from({ length: 67 }, (_, index) => {
  const n = index + 1;
  return [record('house', `${n}A`, `100${n}`), record('house', `${n}B`, `200${n}`), record('senate', String(n), `300${n}`)];
}).flat();

test('all 201 seats are accounted for without claiming a future oath occurred', () => {
  const result = assess2027OpeningRoster(full, '2026-11-26');
  assert.deepEqual(result.singleCandidateSeats, { house: 134, senate: 67 });
  assert.equal(result.completeSourceTermCoverage, true);
  assert.equal(result.authoritativeRosterVerified, false);
  assert.ok(result.singleCandidates.every((member) => member.oathDateStatus === 'future_reported_date'));
});

test('a duplicate candidate cannot hide a missing district even when row count equals 201', () => {
  const source = full.filter((row) => row.lrlId !== '30067');
  source.push(record('house', '1A', '777'));
  const result = assess2027OpeningRoster(source, '2026-11-26');
  assert.equal(result.completeSourceTermCoverage, false);
  assert.deepEqual(result.missingSeats, ['senate:67']);
  assert.deepEqual(result.conflictingSeats, [{ seat: 'house:1A', lrlIds: ['1001', '777'] }]);
  assert.equal(result.authoritativeRosterVerified, false);
});

test('unknown dates, overlapping identities and invalid districts remain explicit', () => {
  const source = full.map((row) => row.lrlId === '3001' ? { ...row, lrlId: '1001' }
    : row.lrlId === '1002' ? { ...row, startsOn: undefined }
    : row.lrlId === '3002' ? { ...row, district: '99' }
    : row.lrlId === '3003' ? { ...row, startsOn: '2027-02-01' }
    : row);
  const result = assess2027OpeningRoster(source, '2027-01-12');
  assert.equal(result.completeSourceTermCoverage, false);
  assert.deepEqual(result.multiSeatIdentities, [{ lrlId: '1001', seats: ['house:1A', 'senate:1'] }]);
  assert.deepEqual(result.unresolvedTerms, [{ seat: 'house:2A', lrlId: '1002' }]);
  assert.deepEqual(result.invalidDistricts, [{ seat: 'senate:99', lrlId: '3002' }]);
  assert.deepEqual(result.outsideOpeningTerm, [{ seat: 'senate:3', lrlId: '3003' }]);
  assert.ok(result.singleCandidates.every((member) => member.oathDateStatus === 'reported_on_or_before_observation'));
  assert.equal(result.authoritativeRosterVerified, false);
});

test('conflicting blocks for the same person are not silently collapsed', () => {
  const result = assess2027OpeningRoster([...full, { ...full[0], party: 'R' }], '2026-11-26');
  assert.deepEqual(result.conflictingSeats, [{ seat: 'house:1A', lrlIds: ['1001'] }]);
  assert.equal(result.completeSourceTermCoverage, false);
});
