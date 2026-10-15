import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLrlSenateRoles, statedRoleDates } from '../src/sources/minnesota/lrl-members';
import { parseSenateCommitteeRoles, parseSenateLeadershipRoles } from '../src/sources/minnesota/senate-roles';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions';
import { parseSenateAssignmentPdfText } from '../src/sources/minnesota/senate-assignment-pdf';

const session = getMinnesotaHouseSession('2025-2026');

test('LRL Senate session role capture keeps unspecified dates null', () => {
  const html = `<h1>Julia E. Coleman - Legislator Record</h1>
    <h3>94th Legislative Session (2025-2026)</h3>
    <div>Body: Senate</div><div>Committees:</div>
    <ul><li>Education Policy [She was co-chair from 1/14/2025 to 2/3/2025.]</li>
    <li>Rules and Administration: Subcommittee on Committees</li></ul>
    <div>Leadership Position: Assistant Minority Leader - She was Assistant Minority Leader starting February 3, 2025.</div>
    <h3>93rd Legislative Session (2023-2024)</h3><div>Body: Senate</div>
    <div>Committees:</div><ul><li>Transportation</li></ul>`;
  const result = parseLrlSenateRoles({ html, session, lrlId: '15556', fallbackName: 'Julia Coleman' });
  assert.ok(result.some((entry) => entry.committee === 'Rules and Administration: Subcommittee on Committees' && entry.startsOn === null && entry.endsOn === null));
  assert.ok(result.some((entry) => /co-chair/i.test(entry.role) && entry.startsOn === '2025-01-14' && entry.endsOn === '2025-02-03'));
  assert.ok(result.some((entry) => entry.role === 'Assistant Minority Leader' && entry.startsOn === '2025-02-03'));
  assert.equal(result.some((entry) => entry.committee === 'Transportation'), false);
});

test('official Senate committee page yields leaders and remaining members for its session', () => {
  const html = `<h1>Agriculture, Veterans, Broadband, and Rural Development Committee</h1>
  <p>2025 - 2026 Biennium Ninety-fourth Legislature</p>
  <h2>Committee Leadership</h2><div>Chair</div><h5>Aric Putnam, 14, DFL</h5>
  <div>Vice Chair</div><h5>Robert J. Kupec, 04, DFL</h5>
  <div>Ranking Minority Member</div><h5>Torrey N. Westrom, 12, R</h5>
  <h3>Committee Members</h3><h5>Gary H. Dahms, 15, R</h5><h4>Staff:</h4>`;
  const result = parseSenateCommitteeRoles(html, session);
  assert.equal(result.filter((role) => role.role === 'Committee Member').length, 4);
  assert.equal(result.filter((role) => role.role === 'Chair').length, 1);
  assert.equal(result.filter((role) => role.role === 'Vice Chair').length, 1);
  assert.equal(result.filter((role) => role.role === 'Ranking Minority Member').length, 1);
  assert.equal(parseSenateCommitteeRoles(html, getMinnesotaHouseSession('2023-2024')).length, 0);
});

test('Senate leadership listing reads roles without inventing tenure dates', () => {
  const html = `<h1>Senate Member Information 2025 - 2026</h1>
  <p>Majority Leader</p><h2>Erin P. Murphy (64, DFL)</h2>
  <p>President of the Senate</p><h2>Bobby Joe Champion (59, DFL)</h2>`;
  const result = parseSenateLeadershipRoles(html, session);
  assert.deepEqual(result.map((record) => record.role), ['Majority Leader', 'President of the Senate']);
  assert.ok(result.every((record) => record.startsOn === null && record.endsOn === null));
  assert.deepEqual(statedRoleDates('No dates are stated.'), { startsOn: null, endsOn: null });
});

test('dated Senate PDF assignments yield raw chair, vice chair and minority names', () => {
  const text = `Minnesota Senate
2024 Committee Assignments
As of: 06/11/2024
Capital Investment
Chair: Pappas Vice Chair: Pha
Office: Room 2113 MSB
Members: 11
Housley (L) Dibble Frentz Jasinski
Agriculture, Broadband, and Rural Development
Chair: Putnam Vice Chair: Kupec
Members: 9
Westrom (L) Anderson Dahms`;
  const result = parseSenateAssignmentPdfText(text, getMinnesotaHouseSession('2023-2024'));
  assert.equal(result.sourceDate, '2024-06-11');
  assert.ok(result.roles.some((role) => role.role === 'Vice Chair' && role.senatorName === 'Pha' && role.committee === 'Capital Investment'));
  assert.ok(result.roles.some((role) => role.role === 'Ranking Minority Member' && role.senatorName === 'Westrom'));
  assert.ok(result.roles.every((role) => role.startsOn === null && role.endsOn === null));
});
