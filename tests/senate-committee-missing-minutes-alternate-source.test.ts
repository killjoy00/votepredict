import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SENATE_MISSING_MINUTES_SOURCE,
  officialMissingMinutesMeetingPage,
  selectMissingMinutesFromExactIndex,
  type IndexedMissingMinutes,
} from '../src/evidence/senate-committee-missing-minutes-official-queue.js';

const row: IndexedMissingMinutes = {
  year: 2022,
  committeeName:'Environment and Natural Resources Finance',
  committeeUrl:'https://www.lrl.mn.gov/minutes/comm.aspx?commid=23835-0&year=2022&body=senate',
  meetingDate:'2022-02-08',
  indexHeadingVerified:true,
  minutesPdfUrls:[],
  electronicMinutesStatus:'meeting_without_linked_minutes',
};

test('all 141 no-linked-minutes official indexed meetings are pinned to exact prior LRL audit',()=>{
  assert.equal(SENATE_MISSING_MINUTES_SOURCE.originalRunId,38065594898);
  assert.equal(SENATE_MISSING_MINUTES_SOURCE.originalArtifactId,11674762938);
  assert.equal(SENATE_MISSING_MINUTES_SOURCE.expectedTotalMeetingEntries,1592);
  assert.equal(SENATE_MISSING_MINUTES_SOURCE.expectedMissing,141);
  assert.equal(SENATE_MISSING_MINUTES_SOURCE.expectedCommitteePages,99);
  assert.deepEqual(SENATE_MISSING_MINUTES_SOURCE.perYear,{
    2022:12,2023:64,2024:42,2025:23,
  });
  assert.match(SENATE_MISSING_MINUTES_SOURCE.originalJsonSha256,/^[a-f0-9]{64}$/);
  assert.match(SENATE_MISSING_MINUTES_SOURCE.missingOrderedRowsSha256,/^[a-f0-9]{64}$/);
});

test('construct date-specific official Senate LRL pages only from verified meeting identity',()=>{
  assert.equal(officialMissingMinutesMeetingPage(row),
    'https://www.lrl.mn.gov/minutes/comm.aspx?commid=23835-0&year=2022&body=senate&date=2%2F8%2F2022');
  for(const changed of [
    {...row, committeeUrl:row.committeeUrl.replace('www.lrl.mn.gov','example.com')},
    {...row, committeeUrl:row.committeeUrl.replace('/comm.aspx','/other.aspx')},
    {...row, committeeUrl:row.committeeUrl.replace('body=senate','body=house')},
    {...row, committeeUrl:row.committeeUrl+'&extra=1'},
    {...row, meetingDate:'2021-02-08'},
    {...row, committeeName:''},
  ]) assert.throws(()=>officialMissingMinutesMeetingPage(changed as IndexedMissingMinutes),
    /Invalid original Senate indexed committee meeting identity/);
});

test('rejects unofficial source archive or modified index instead of inventing meeting rows',()=>{
  assert.throws(()=>selectMissingMinutesFromExactIndex('{}'),/index artifact SHA256/);
  assert.throws(()=>selectMissingMinutesFromExactIndex('[]'),/index artifact SHA256/);
});

test('missing minutes link is evidence-gap state, never an assertion of zero actions',()=>{
  assert.equal(row.electronicMinutesStatus,'meeting_without_linked_minutes');
  assert.deepEqual(row.minutesPdfUrls,[]);
  assert.equal(row.indexHeadingVerified,true);
  assert.equal(SENATE_MISSING_MINUTES_SOURCE.perYear[2022]+
    SENATE_MISSING_MINUTES_SOURCE.perYear[2023]+
    SENATE_MISSING_MINUTES_SOURCE.perYear[2024]+
    SENATE_MISSING_MINUTES_SOURCE.perYear[2025],141);
});
