import test from 'node:test';
import assert from 'node:assert/strict';
import { MN_LEGISLATORS } from '../src/data/legislators.js';
import { parseHouseRoster, parseSenateRoster, validateRoster } from '../src/services/openStates.js';

test('verified roster has every House and Senate district exactly once', () => {
  assert.equal(MN_LEGISLATORS.filter((member) => member.chamber === 'house').length, 134);
  assert.equal(MN_LEGISLATORS.filter((member) => member.chamber === 'senate').length, 67);
  assert.deepEqual(validateRoster(MN_LEGISLATORS), []);
});

test('official House roster parser limits itself to the alphabetical panel', () => {
  const html = `
    <!-- Begin New Row for Alphabetical members -->
    <a href="/members/profile/123"><b>Alex Example (01a, DFL)</b></a>
    <!-- Begin New Row for Members by District Order -->
    <a href="/members/profile/999"><b>Old Member (2B, R)</b></a>`;
  assert.deepEqual(parseHouseRoster(html), [{
    id: 'mn-house-123',
    name: 'Alex Example',
    party: 'DFL',
    chamber: 'house',
    district: '1A',
    title: 'Representative',
  }]);
});

test('official Senate API parser normalizes member fields', () => {
  const members = parseSenateRoster({ members: [{
    mem_id: 42,
    preferred_full_name: 'Pat Example',
    party: 'R',
    dist: '03',
    mem_bio_pic: '03Example.jpg',
    email: 'pat@example.test',
  }] });

  assert.equal(members[0].id, 'mn-senate-42');
  assert.equal(members[0].party, 'Republican');
  assert.equal(members[0].district, '3');
});
