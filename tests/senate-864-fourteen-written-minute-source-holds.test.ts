import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditRemainingSenate864FourteenWrittenMinuteHolds}
 from '../src/evidence/senate-864-fourteen-written-minute-source-holds.js';
const dir='docs/evaluation/source-proof/';
const base=JSON.parse(readFileSync(dir+
 'senate-864-2022-25-141-official-no-pdf-meeting-to-Clerk-crosswalk.json','utf8'));
const eight=JSON.parse(readFileSync(dir+
 'senate-864-2022-25-eight-alternate-lrl-original-pdf-sha-receipts.json','utf8'));
const eleven=JSON.parse(readFileSync(dir+
 'senate-864-eleven-original-same-day-LRL-minutes-recovery.json','utf8'));

test('all official 1592 indexed Senate committee dates reconciled 1563+4+11 = 1578, exactly 14 held by source date',()=>{
 const result=auditRemainingSenate864FourteenWrittenMinuteHolds(base,eight,eleven);
 assert.equal(result.source2022To2025OriginalIndexedMeetingDates,1592);
 assert.equal(result.authenticatedWrittenMinuteMeetingDates,1578);
 assert.equal(result.originalIndexedDatesStillWithoutAuthenticatedMinutes,14);
 assert.deepEqual(result.byYear,[{year:2022,sourceMeetingDatesStillHeld:3},
  {year:2023,sourceMeetingDatesStillHeld:2},
  {year:2024,sourceMeetingDatesStillHeld:4},
  {year:2025,sourceMeetingDatesStillHeld:5}]);
 assert.equal(new Set(result.held.map(v=>[v.year,v.hearingDate,v.committeeName].join('|'))).size,14);
 assert.equal(result.original2021PrintedMinutesCoverage,'UNKNOWN_NOT_DIGITALLY_AUTHENTICATED');
 assert.equal(result.original2022PrintedVsElectronicMinuteParity,'UNKNOWN_UNPROVEN');
 assert.ok(result.held.every(v=>v.recordedMotionsProvenAbsent===false&&
  v.namedMemberVotesProvenAbsent===false));
 assert.equal(result.noDatabaseOrProductionWrite,true);
});
test('source recoveries reject changed original SHA universe, duplicated dates, mismatched committees, 2021, and fabricated parity',()=>{
 const run=(a:any,b:any,c:any)=>()=>auditRemainingSenate864FourteenWrittenMinuteHolds(a,b,c);
 assert.throws(run({...base,originalLrlIndexSourceSha256:'f'.repeat(64)},eight,eleven));
 assert.throws(run(base,{...eight,originalFourMeetingDates:[
  eight.originalFourMeetingDates[0],...eight.originalFourMeetingDates.slice(0,3)]},eleven));
 assert.throws(run(base,{...eight,originalFourMeetingDates:[
  {...eight.originalFourMeetingDates[0],year:2021},...eight.originalFourMeetingDates.slice(1)]},eleven));
 assert.throws(run(base,eight,{...eleven,originalSources:[
  {...eleven.originalSources[0],committeeName:'Wrong committee'},...eleven.originalSources.slice(1)]}));
 assert.throws(run({...base,year2022PrintElectronicParityUnknown:false},eight,eleven));
 assert.throws(run(base,{...eight,exactCurrentStoredEventOrIndividualMemberParityPerformed:true},eleven));
 assert.throws(run(base,eight,{...eleven,authenticatedWrittenMinuteMeetingDates:1579}));
});
test('source-only remaining held-date code never turns missing Minutes into no parliamentary action or a database edit',()=>{
 const source=readFileSync('src/evidence/senate-864-fourteen-written-minute-source-holds.ts','utf8');
 assert.match(source,/recordedMotionsProvenAbsent:false/);
 assert.match(source,/UNKNOWN_NOT_DIGITALLY_AUTHENTICATED/);
 assert.match(source,/UNKNOWN_UNPROVEN/);
 assert.doesNotMatch(source,/\b(?:INSERT INTO|UPDATE vote_events|DELETE FROM|DROP TABLE)\b/i);
});
