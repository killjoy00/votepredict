import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCommitteeMotion,
  discoverHouseCommitteeMinuteIndexes,
  discoverHouseCommitteeMinutes,
  discoverSenateCommitteeIds,
  discoverSenateHearings,
  extractCommitteeBillRollCalls,
  extractCommitteeMeetingDate,
  senateHearingMinutesUrl,
} from '../src/sources/minnesota/committee-minutes.js';

test('discovers current House committee minute indexes and minute pages', () => {
  const list = `
    <a href="/Committees/minutes/94001">Agriculture minutes</a>
    <a href="https://www.house.mn.gov/Committees/minutes/94024/">Ways and Means minutes</a>
    <a href="/Committees/home/94024">not minutes</a>
  `;
  assert.deepEqual(discoverHouseCommitteeMinuteIndexes(list), [
    'https://www.house.mn.gov/Committees/minutes/94001',
    'https://www.house.mn.gov/Committees/minutes/94024/',
  ]);
  const index = `
    <a href="/Committees/minutes/94024/101803">Thirty-ninth meeting</a>
    <a href="/Committees/minutes/94024/101784">Thirty-seventh meeting</a>
  `;
  assert.deepEqual(discoverHouseCommitteeMinutes(index), [
    'https://www.house.mn.gov/Committees/minutes/94024/101784',
    'https://www.house.mn.gov/Committees/minutes/94024/101803',
  ]);
});

test('discovers Senate committee ids and hearing references', () => {
  const committeeIndex = `
    <a href="/committees/committee_bio.html?cmte_id=3123">Health and Human Services</a>
    <a href="/committees/committee_bio.html?cmte_id=3117">State and Local Government</a>
  `;
  assert.deepEqual(discoverSenateCommitteeIds(committeeIndex), ['3117', '3123']);
  const schedule = `
    <a href="/schedule/individual/19804/20260319">March 19</a>
    <a href="/schedule/individual/19955/20260428">April 28</a>
  `;
  assert.deepEqual(discoverSenateHearings(schedule), [
    {
      hearingId: '19955',
      meetingDate: '2026-04-28',
      detailUrl: 'https://www.senate.mn/schedule/individual/19955/20260428',
    },
    {
      hearingId: '19804',
      meetingDate: '2026-03-19',
      detailUrl: 'https://www.senate.mn/schedule/individual/19804/20260319',
    },
  ]);
  assert.equal(
    senateHearingMinutesUrl('19804', 94),
    'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=19804&ls=94&type=minutes',
  );
});

test('classifies bill-level committee motions without treating amendments as a motion type', () => {
  assert.equal(classifyCommitteeMotion('HF 24 be recommended to pass and re-referred to Judiciary'), 'recommend_pass');
  assert.equal(classifyCommitteeMotion('SF 3975 be placed on general orders'), 'general_orders');
  assert.equal(classifyCommitteeMotion('HF 16 be recommended to pass and placed on the General Register'), 'recommend_pass');
  assert.equal(classifyCommitteeMotion('HF 99 be laid over for possible inclusion'), 'lay_over');
});

test('extracts House-style separate-line recommendation roll calls', () => {
  const html = `
    <h1>Health Finance and Policy FIFTY-SEVENTH MEETING</h1>
    <h3>2021-2022 Regular Session - Tuesday, March 15, 2022</h3>
    <p>Representative Morrison renewed her motion that HF3871 be recommended to pass and be re-referred to the Committee on Judiciary Finance and Civil Law.</p>
    <p>Chair Liebling stated there would be a roll call vote. The results were as follows:</p>
    <p>AYE</p><p>LIEBLING, Tina</p><p>HUOT, John</p><p>MORRISON, Kelly</p>
    <p>NAY</p><p>GRUENHAGEN, Glenn</p><p>MUNSON, Jeremy</p>
    <p>On a vote of 3 AYES and 2 NAYS THE MOTION PREVAILED.</p>
  `;
  const rows = extractCommitteeBillRollCalls(html, ['HF3871']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].identifier, 'HF3871');
  assert.equal(rows[0].motionType, 'recommend_pass');
  assert.deepEqual(rows[0].ayes, ['LIEBLING, Tina', 'HUOT, John', 'MORRISON, Kelly']);
  assert.deepEqual(rows[0].nays, ['GRUENHAGEN, Glenn', 'MUNSON, Jeremy']);
  assert.equal(rows[0].result, 'prevailed');
  assert.equal(extractCommitteeMeetingDate(html), '2022-03-15');
});

test('extracts Senate inline Ayes/Nays roll calls and ignores an amendment roll call nearby', () => {
  const html = `
    <h2>State and Local Government Committee</h2>
    <p>Thursday, March 19, 2026</p>
    <p>S.F. 4379: Senator Maye Quade: Municipalities prohibition.</p>
    <p>Senator Mathews requested a roll call vote for the adoption of A3 amendment. 4/7 (Ayes: Bahr, Drazkowski, Koran, Mathews; Nays: Xiong, Gustafson, Maye Quade, Cwodzinski, Fateh, Hemmingsen-Jaeger, Johnson Stewart) MOTION FAILED</p>
    <p>Senator Mathews requested a roll call vote on the motion that SF 4379, as amended, be recommended to pass and re-referred to the Judiciary Committee. 7/4 (Ayes: Xiong, Gustafson, Maye Quade, Cwodzinski, Fateh, Hemmingsen-Jaeger, Johnson Stewart; Nays: Bahr, Drazkowski, Koran, Mathews) MOTION PREVAILED.</p>
  `;
  const rows = extractCommitteeBillRollCalls(html, ['SF4379']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].motionType, 'recommend_pass');
  assert.deepEqual(rows[0].ayes, [
    'Xiong',
    'Gustafson',
    'Maye Quade',
    'Cwodzinski',
    'Fateh',
    'Hemmingsen-Jaeger',
    'Johnson Stewart',
  ]);
  assert.deepEqual(rows[0].nays, ['Bahr', 'Drazkowski', 'Koran', 'Mathews']);
  assert.equal(rows[0].result, 'prevailed');
  assert.equal(extractCommitteeMeetingDate(html), '2026-03-19');
});

test('extracts Senate long-form recommendation roll calls', () => {
  const html = `
    <h2>Finance Committee</h2>
    <p>Tuesday, April 19, 2022</p>
    <p>Senator Ingebrigtsen moved that SF 3975, as amended, be recommended to pass and placed on general orders.</p>
    <p>A roll call vote was requested. The results were as follows:</p>
    <p>AYES: Rosen, Ingebrigtsen, Benson, Johnson, Kiffmeyer, Pratt</p>
    <p>NAYS: Marty, Kent</p>
    <p>ABSENT: Champion, Lopez Franzen</p>
    <p>On a vote of 6 AYES and 2 NAYS, the motion prevailed.</p>
  `;
  const rows = extractCommitteeBillRollCalls(html, ['SF3975']);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].ayes, ['Rosen', 'Ingebrigtsen', 'Benson', 'Johnson', 'Kiffmeyer', 'Pratt']);
  assert.deepEqual(rows[0].nays, ['Marty', 'Kent']);
});

test('extracts per-member Y/N Senate vote format', () => {
  const html = `
    <p>Monday, February 6, 2023</p>
    <p>Senator Murphy moved that SF 73 be recommended to pass.</p>
    <p>A roll call vote was requested.</p>
    <p>Chair Murphy - Y</p>
    <p>Senator Anderson - N</p>
    <p>Senator Champion - Y</p>
    <p>The motion prevailed.</p>
  `;
  const rows = extractCommitteeBillRollCalls(html, ['SF73']);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].ayes, ['Murphy', 'Champion']);
  assert.deepEqual(rows[0].nays, ['Anderson']);
});
