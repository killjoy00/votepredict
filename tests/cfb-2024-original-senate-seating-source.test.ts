/** #864: Senate's original 2024 seating table and map may contradict. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
 ORIGINAL_SENATE_2024_SEATING_PDF,ORIGINAL_LRL_93RD_SENATE_SEATING_ARCHIVE,
 selectPrior2023SOSRosterCfbPeople,inspect2024OriginalSenateSeatingPdf,
} from '../src/evidence/cfb-2024-original-senate-seating-source.js';
const p='docs/evaluation/source-proof/cfb-2023-original-sos-22-real-senators-roster-independent-service-proof.psv';
const source=readFileSync(p,'utf8');
const members=selectPrior2023SOSRosterCfbPeople(source);
function fake(withConflict=false){
 const table=members.map(m=>{
  const words=m.name.split(' '),first=words[0]!,surname=words.at(-1)!;
  const printed=withConflict&&m.district===20?'Duckworth, Steve':surname+', '+first;
  return String(m.district).padStart(2,'0')+printed+' (R) .......2207 MSB .........6-5555 ......49';
 }).join('\n');
 const map=members.map(m=>{
  const words=m.name.split(' ');
  return 'Seat 12\n'+words[0]+' '+words.at(-1)+'\nCity - '+m.district;
 }).join('\n');
 return 'The Minnesota Senate\nOffice of the Secretary of the Senate\nSeating Arrangement 2024\n'+
  map+'\nSenate Leadership\nSenate Members\n'+
  'Dist. Senator (Party) \tRoom \tPhone Seat\n'+table;
}
test('2024 Senate source must use both official government hosts and already authenticated 22 people',()=>{
 assert.equal(members.length,22);
 assert.equal(new Set(members.map(m=>m.reg)).size,22);
 assert.ok(members.some(m=>m.district===20&&m.name==='Steve Drazkowski'));
 assert.equal(ORIGINAL_SENATE_2024_SEATING_PDF,
 'https://www.senate.mn/members/2023-2024/info/seating-chart.pdf');
 assert.equal(ORIGINAL_LRL_93RD_SENATE_SEATING_ARCHIVE,
 'https://www.leg.mn.gov/archive/sessions/seatingcharts/93-s.pdf');
 assert.throws(()=>selectPrior2023SOSRosterCfbPeople(source.replace(
   'Andrew R. Lang','Never Served')),/changed/);
});
test('synthetic original 2024 member-table and seat-map consistent identity corroborates both within one document',()=>{
 const a=inspect2024OriginalSenateSeatingPdf({
   prior2023RosterPsv:source,original2024PdfExtractedText:fake()});
 assert.equal(a.counts.original2024SeatingArrangementTitleVerified,true);
 assert.equal(a.counts.originalTableSenateMembersSectionLocated,true);
 assert.equal(a.counts.originalMapSectionLocated,true);
 assert.equal(a.counts.exactSourceTableMatches,22);
 assert.equal(a.counts.independentMapCaptionMatches,22);
 assert.equal(a.counts.bothSourceSectionsMatched,22);
 assert.equal(a.counts.sourceTableAndMapConflicts.length,0);
 assert.equal(a.counts.legal2024CommitteeFilingDutyEstablishedCount,0);
 assert.equal(a.counts.originalCfbActualPublicByEstablishedCount,0);
});
test('the documented contradictory 2024 SD20 table/mapping is a HOLD even if elsewhere the correct senator appears',()=>{
 const a=inspect2024OriginalSenateSeatingPdf({
   prior2023RosterPsv:source,original2024PdfExtractedText:fake(true)});
 assert.equal(a.counts.exactSourceTableMatches,21);
 assert.equal(a.counts.independentMapCaptionMatches,22);
 assert.equal(a.counts.bothSourceSectionsMatched,21);
 assert.deepEqual(a.counts.sourceTableAndMapConflicts,[{reg:'18763',district:20}]);
 const held=a.entries.find(x=>x.priorDistrict===20);
 assert.ok(held);
 assert.equal(held.roster2024SourceStatus,'HOLD_source_2024_table_and_map_conflict');
 assert.equal(held.sourceTableAndMapConflict,true);
 assert.equal(a.counts.historicalVoteDayIn2024ServiceEstablishedCount,0);
});
test('source mismatch where map is absent cannot be upgraded just from CFB viewer/2023 roster',()=>{
 const a=inspect2024OriginalSenateSeatingPdf({prior2023RosterPsv:source,
 original2024PdfExtractedText:fake().replace('Jim Abeler\nCity - 35','Other Name\nCity - 35')});
 const person=a.entries.find(x=>x.priorDistrict===35);
 assert.ok(person);
 assert.equal(person.roster2024SourceStatus,'HOLD_2024_source_name_or_district_unverified');
 assert.equal(person.sameDocument2024MapNameDistrictMatched,false);
 assert.equal(a.counts.complete2024RosterIdentityAuthentication,false);
});

test('permanent 2024 Senate original government PDF SHA and 22 member-table/map crosswalk remain pinned',async()=>{
 const {createHash}=await import('node:crypto');
 const P='docs/evaluation/source-proof/';
 const ck=JSON.parse(readFileSync(P+
  'cfb-2024-original-senate-22-two-section-2024-service-checkpoint.json','utf8'));
 const raw=readFileSync(ck.exactMemberLedger.path,'utf8');
 const sha=createHash('sha1').update('blob '+Buffer.byteLength(raw,'utf8')+'\0')
  .update(raw).digest('hex');
 assert.equal(sha,ck.exactMemberLedger.gitBlobSha);
 assert.equal(Buffer.byteLength(raw,'utf8'),ck.exactMemberLedger.bytes);
 const r=raw.trimEnd().split('\n').map(x=>x.split('|'));
 assert.equal(r.length,22);
 const panel=new Map(members.map(x=>[x.reg,x]));
 for(const x of r){
  assert.equal(x.length,13);
  const m=panel.get(x[0]!);
  assert.ok(m);
  assert.equal(x[1],m.name);
  assert.equal(x[2],String(m.district));
  assert.equal(x[4],ck.originalDocument.originalPdfSha256);
  assert.equal(Number(x[5]),ck.originalDocument.originalPdfBytes);
  assert.equal(x[6],'match');
  assert.equal(x[7],'match');
  assert.equal(x[8],'independent_original_2024_senate_member_table_and_seating_map');
  assert.equal(x[9],'-');
  assert.equal(x[10],'-');
  assert.equal(x[11],'-');
  assert.equal(x[12],ORIGINAL_SENATE_2024_SEATING_PDF);
 }
 assert.equal(ck.originalDocument.originalPdfBytes,4444913);
 assert.equal(ck.originalDocument.sourceDocumentConflictingMemberIdentities,0);
 assert.equal(ck.scope.memberListReal2024SenatorsMatched,22);
 assert.equal(ck.scope.seatMap2024SenatorsMatched,22);
 assert.equal(ck.scope.exactArbitrary2024VoteDayServiceProvenCount,0);
 assert.equal(ck.scope.originalCFB2023And2024ReportVersionHistoricalPublicByProven,0);
 assert.equal(ck.scope.committeeLegallyOwedOriginalYearendDenominator,null);
 assert.equal(ck.officialSourceAcquisitions[0].verifiedRosterTableMemberMatches,22);
 assert.equal(ck.officialSourceAcquisitions[0].verifiedMapSeatCaptionMatches,22);
 assert.equal(ck.safeguards.noProductionDatabaseReadWrite,true);
 assert.equal(ck.safeguards.keepIssue864Open,true);
});
