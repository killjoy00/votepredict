import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {audit141NoLinkedMinuteMeetings,type GapLedger} from
 '../src/evidence/senate-864-committee-coverage-gap-gates.js';

const path='docs/evaluation/source-proof/senate-committee-141-unlinked-original-meeting-roster.json';
function original():GapLedger{return JSON.parse(readFileSync(path,'utf8')) as GapLedger;}
test('#864 exact existing 141 official no-Minutes roster validates by year and print holds',()=>{
 const got=audit141NoLinkedMinuteMeetings(original());
 assert.deepEqual(got.yearCounts,{2022:12,2023:64,2024:42,2025:23});
 assert.equal(got.noLinkedMinutesMeetingEntries,141);
 assert.equal(got.datedMediaPageLeadsNotActualVotes,138);
 assert.equal(got.noDatedMediaPageLeads,3);
 assert.equal(got.year2022PrintAndElectronicParity,'UNVERIFIED');
 assert.equal(got.official2021PrintMinutesMeetingAndVoteDenominator,'UNKNOWN');
 assert.equal(got.noPrivateDatabaseReadOrWrite,true);
});
test('three precise original missing-lead identities cannot be swapped for another committee',()=>{
 const changed=original();
 changed.datedMediaCandidateTriage.threeNoMediaCandidates[2]!.committeeName='Rules and Administration';
 assert.throws(()=>audit141NoLinkedMinuteMeetings(changed));
});
test('missing or duplicated official meeting dates fail closed',()=>{
 const missing=original();
 missing.meetingGroups[0]!.missingMinutesMeetingDates.pop();
 assert.throws(()=>audit141NoLinkedMinuteMeetings(missing));
 const duplicate=original();
 duplicate.meetingGroups[0]!.missingMinutesMeetingDates.push(
  duplicate.meetingGroups[0]!.missingMinutesMeetingDates[0]!);
 assert.throws(()=>audit141NoLinkedMinuteMeetings(duplicate));
});
test('2021/2022 printed Minutes cannot be promoted from electronic leads',()=>{
 const edited=original();
 edited.limitations.years2021PrintOnlyMeetingVoteDenominator=0 as never;
 assert.throws(()=>audit141NoLinkedMinuteMeetings(edited));
 const changed=original();
 changed.limitations.year2022PrintAndElectronicCollectionsMayDiffer=false;
 assert.throws(()=>audit141NoLinkedMinuteMeetings(changed));
});
