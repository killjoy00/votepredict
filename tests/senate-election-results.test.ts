import test from 'node:test';
import assert from 'node:assert/strict';
import {
  directSenateDistrictFileUrl, hasMissingRequiredSenateElections,
  isPost2022RedistrictedMap, parseSenateDistrictFile, senateElectionsForYear,
} from '../src/sources/minnesota/senate-election-results.js';

// Unmodified lines cut from the SOS 2020-11-03 State Senator by-district bulk file:
// https://electionresultsfiles.sos.mn.gov/20201103/stsenate.txt
const generalFixture = [
  'MN;;;0121;State Senator District 1;1;0301;Mark Johnson;;;R;277;277;27972;69.63;40171',
  'MN;;;0121;State Senator District 1;1;0401;Reed Perkins;;;DFL;277;277;12162;30.28;40171',
  'MN;;;0121;State Senator District 1;1;9901;WRITE-IN;;;WI;277;277;37;0.09;40171',
].join('\n');

// Unmodified lines cut from the SOS 2025-01-28 SD60 special bulk file:
// https://electionresultsfiles.sos.mn.gov/20250128_27/stsenate.txt
const specialFixture = [
  'MN;;;0180;State Senator District 60;60;0401;Doron Clark;;;DFL;25;25;7783;90.91;8561',
  'MN;;;0180;State Senator District 60;60;0302;Abigail Wolters;;;R;25;25;746;8.71;8561',
  'MN;;;0180;State Senator District 60;60;9901;WRITE-IN;;;WI;25;25;32;0.37;8561',
].join('\n');

// Unmodified lines cut from the SOS 2025-01-14 SD60 special-primary file:
// https://electionresultsfiles.sos.mn.gov/20250114/stsenate.txt
const primaryFixture = [
  'MN;;;0180;State Senator District 60;60;0301;Abigail Wolters;;;R;25;25;153;72.17;212',
  'MN;;;0180;State Senator District 60;60;0302;Christopher Robin Zimmerman;;;R;25;25;59;27.83;212',
  'MN;;;0180;State Senator District 60;60;0401;Doron Clark;;;DFL;25;25;2073;38.13;5436',
  'MN;;;0180;State Senator District 60;60;0402;Joshua Preston;;;DFL;25;25;29;0.53;5436',
].join('\n');

test('2020 general by-district candidates retain SOS party, votes, total, percent and leader', () => {
  const rows = parseSenateDistrictFile(generalFixture, 'general');
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map(({district,candidate,party,votes,totalVotes,voteShare,winner}) => ({
      district,candidate,party,votes,totalVotes,voteShare,winner,
    })),
    [
      {district:'1',candidate:'Mark Johnson',party:'R',votes:27972,totalVotes:40171,voteShare:69.63,winner:true},
      {district:'1',candidate:'Reed Perkins',party:'DFL',votes:12162,totalVotes:40171,voteShare:30.28,winner:false},
      {district:'1',candidate:'WRITE-IN',party:'WI',votes:37,totalVotes:40171,voteShare:0.09,winner:false},
    ],
  );
  assert.equal(rows[0].rawLine, generalFixture.split('\n')[0]);
  assert.equal(rows[0].sourceOrdinal, 1);
});

test('January 2025 Senate special parses the actual district 60 result', () => {
  const rows = parseSenateDistrictFile(specialFixture, 'special');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(x=>x.winner), [true,false,false]);
  assert.equal(rows[0].district, '60');
  assert.equal(rows[0].candidate, 'Doron Clark');
  assert.equal(rows[0].party, 'DFL');
  assert.equal(rows[0].votes, 7783);
  assert.equal(rows[0].totalVotes, 8561);
  assert.equal(rows[0].voteShare, 90.91);
});

test('special primary selects a leader within each party and preserves party-specific totals', () => {
  const rows = parseSenateDistrictFile(primaryFixture, 'special_primary');
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(x=>x.winner), [true,false,true,false]);
  assert.equal(rows[0].totalVotes, 212);
  assert.equal(rows[2].totalVotes, 5436);
  assert.equal(rows[0].voteShare, 72.17);
  assert.equal(rows[2].voteShare, 38.13);
  assert.equal(parseSenateDistrictFile(primaryFixture, 'primary')[0].winner, true);
});

test('SOS January 2025 special election uses its published _27 filename suffix', () => {
  const special = senateElectionsForYear(2025).find(e=>e.date==='2025-01-28');
  assert.ok(special);
  assert.equal(directSenateDistrictFileUrl(special),
    'https://electionresultsfiles.sos.mn.gov/20250128_27/stsenate.txt');
});

test('2020 is the first supported year; statewide 2020 and 2022 generals require 67 districts', () => {
  assert.throws(()=>senateElectionsForYear(2019), /between 2020/);
  assert.equal(senateElectionsForYear(2020).find(e=>e.type==='general')?.expectedDistricts,67);
  assert.equal(senateElectionsForYear(2022).find(e=>e.type==='general')?.expectedDistricts,67);
  assert.equal(isPost2022RedistrictedMap('2020-11-03'),false);
  assert.equal(isPost2022RedistrictedMap('2022-11-08'),true);
});

test('missing optional primary is allowed, while any missing general or special is fatal', () => {
  assert.equal(hasMissingRequiredSenateElections([{type:'primary'}]),false);
  assert.equal(hasMissingRequiredSenateElections([{type:'special_primary'}]),false);
  assert.equal(hasMissingRequiredSenateElections([{type:'primary'},{type:'special_primary'}]),false);
  assert.equal(hasMissingRequiredSenateElections([{type:'primary'},{type:'general'}]),true);
  assert.equal(hasMissingRequiredSenateElections([{type:'special'}]),true);
});
