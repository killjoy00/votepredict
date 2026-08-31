import test from 'node:test';
import assert from 'node:assert/strict';
import { MN_LEGISLATORS } from '../src/data/legislators.js';
import {
  buildOpenStatesBillSearchParams,
  mapOpenStatesBill,
  parseHouseRoster,
  parseSenateRoster,
  validateRoster,
} from '../src/services/openStates.js';

test('verified roster has every House and Senate district exactly once', () => {
  assert.equal(MN_LEGISLATORS.filter((member) => member.chamber === 'house').length, 134);
  assert.equal(MN_LEGISLATORS.filter((member) => member.chamber === 'senate').length, 67);
  assert.deepEqual(validateRoster(MN_LEGISLATORS), []);
  assert.equal(MN_LEGISLATORS.find((member) => member.district === '65B')?.name, 'María Isa Pérez-Vega');
  assert.equal(MN_LEGISLATORS.some((member) => /&(?:#\d+|#x[\da-f]+|\w+);/i.test(member.name)), false);
});

test('official House roster parser limits itself to the alphabetical panel', () => {
  const html = `
    <!-- Begin New Row for Alphabetical members -->
    <a href="/members/profile/123"><b>Mar&#237;a Example (01a, DFL)</b></a>
    <!-- Begin New Row for Members by District Order -->
    <a href="/members/profile/999"><b>Old Member (2B, R)</b></a>`;
  assert.deepEqual(parseHouseRoster(html), [{
    id: 'mn-house-123',
    name: 'María Example',
    party: 'DFL',
    chamber: 'house',
    district: '1A',
    title: 'Representative',
  }]);
});

test('OpenStates bill search stays in the active session and adds official text', () => {
  assert.equal(buildOpenStatesBillSearchParams('HF 10').session, '2025-2026');
  const bill = mapOpenStatesBill({
    id: 'ocd-bill/test',
    identifier: 'HF 10',
    title: 'Test bill',
    session: '2025-2026',
    openstates_url: 'https://openstates.org/example',
  });
  assert.equal(bill.textUrl, 'https://www.revisor.mn.gov/bills/94/2025/0/HF/10/versions/latest/');
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
