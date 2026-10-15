import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 ORIGINAL_HOUSING_PDF,ORIGINAL_HOUSING_SCHEMA,inspectMarch24HousingOfficialOriginalPdfText
} from '../src/evidence/senate-864-2022-housing-orphan-minutes-original-pdf.js';

const pdfSha='e'.repeat(64);
const text=[
 'Minnesota State Senate',
 'Housing Finance and Policy Committee',
 'Thursday, March 24, 2022',
 '1:00 PM, Room 123, Capitol','Minutes',
 'Present: Senator Fictional Atlas, Fictional Birch',
 'Senator Fictional Atlas called the meeting to order.',
 'S.F. 4170: Senator Fictional Atlas: Housing Finance Agency sprinkler grants.',
 'Senator Fictional Atlas moved that S.F. 4170, be laid over for possible inclusion in the omnibus bill.',
 'S.F. 3994: Senator Fictional Birch: Housing program eligibility modifications.',
 'Senator Fictional Birch moved that S.F. 3994, be laid over.',
 'The meeting was adjourned at 2:20pm.',
 'Senator Fictional Atlas, Chair'
].join('\n')+'\n'.repeat(100)+'a'.repeat(600);
const reviewed=()=>{
 return inspectMarch24HousingOfficialOriginalPdfText(
  text,pdfSha,30000,2,text,'2026-10-14T04:00:00Z');
};
test('original LRL official orphan Minutes date, committee and two 2022 proposed layover motions independently source anchored, with no alleged results',()=>{
 const lrl=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/senate-committee-141-unlinked-original-meeting-roster.json','utf8'));
 assert.ok(lrl.meetingGroups.some((x:any)=>x.year===2022&&
  x.committeeName==='Housing Finance and Policy'&&x.missingMinutesMeetingDates.includes('03-24')));
 const r=reviewed();
 assert.equal(r.schemaVersion,ORIGINAL_HOUSING_SCHEMA);
 assert.equal(r.originalLrlOfficialMeetingIndexMinutesPdfLinked,false);
 assert.equal(r.originalPublicGovPdfUrl,ORIGINAL_HOUSING_PDF);
 assert.equal(r.hearingDate,'2022-03-24');
 assert.deepEqual(r.motionObservations.map(x=>[x.billReference,x.sourcePdfPage,x.officialActionOutcome]),[
  ['SF4170',1,null],['SF3994',1,null]
 ]);
 assert.equal(r.originalNamedYeaNayRollsProven,0);
 assert.equal(r.motionObservations.every(x=>x.namedIndividualYeaNayVotesProven===false),true);
 assert.equal(r.sourceOriginalPdfPublishedByDateIndependentlyProven,false);
 assert.equal(r.noSourceToStoredMemberVoteJoin,true);
 assert.equal(r.noProductionDatabaseOperations,true);
 assert.equal(r.no2021CommitteeRecordsUsed,true);
});
test('different date, committee, bill, proposed motion, invalid SHA or unverified PDF page fails closed',()=>{
 assert.throws(()=>inspectMarch24HousingOfficialOriginalPdfText(
  text.replace('Thursday, March 24, 2022','Wednesday, March 23, 2022'),
  pdfSha,30000,2,text,'2026-10-14T04:00:00Z'),/mismatch/);
 assert.throws(()=>inspectMarch24HousingOfficialOriginalPdfText(
  text,pdfSha,30000,2,text.replace('Housing Finance and Policy Committee',
  'Finance Committee'),'2026-10-14T04:00:00Z'),/mismatch/);
 assert.throws(()=>inspectMarch24HousingOfficialOriginalPdfText(
  text.replace('S.F. 4170, be laid over','S.F. 4170, be discussed'),
  pdfSha,30000,2,text.replace('S.F. 4170, be laid over','S.F. 4170, be discussed'),
  '2026-10-14T04:00:00Z'),/lacks separately anchored/);
 assert.throws(()=>inspectMarch24HousingOfficialOriginalPdfText(
  text,'invalidSha',30000,2,text,'2026-10-14T04:00:00Z'),/bounds failed/);
});
