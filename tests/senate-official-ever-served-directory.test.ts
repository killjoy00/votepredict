import test from 'node:test';
import assert from 'node:assert/strict';
import {
 OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
 parseOfficialMnSenateServiceDirectory,
 validateActualSenateServiceForElection,
 validateCandidateEverActuallyServed,
} from '../src/evidence/senate-official-ever-served-directory.js';
const DATE='2026-10-10T19:00:00.000Z';
function fixture():Uint8Array{
 const people=[
  ['Johnson Stewart, Ann M','Senate 2021-2022 (District 44); Senate 2024-Present (District 45)'],
  ['Heintzeman, Keri','House 2015-2024 (District 6B); Senate 2025-Present (District 6)'],
  ['Holmstrom, Michael Jr.','Senate 2025-Present (District 29)'],
  ['Kupec, Robert - "Rob"','Senate 2023-Present (District 04)'],
  ['Bohmer, Dan','House 2021-2022 (District 4A)'],
  ['Luthner, Kate','House 2021-2022 (District 32B)'],
  ['Future, Samuel','House 2020-2022 (District 12B); Senate 2025-Present (District 16)'],
  ['Anderson, Bruce Douglas','House 1995-2012 (District 19A); Senate 2013-2022 (District 29); Senate 2023-2025 (District 29)'],
  ['Relph, Jerry','Senate 2017-2020 (District 14)'],
  ['Dahms, Gary H.','Senate 2011-2012 (District 21); Senate 2013-2022 (District 16); 2023-Present (District 15)'],
 ];
 for(let i=0;i<305;i++)people.push(['OfficialTest, Person'+i,
  'Senate 2011-2025 (District '+(i%67+1)+')']);
 return Buffer.from('<!doctype html><h1>State Senators, 1849-2023</h1>'+
  '<h2>Service Information</h2><table><tbody>'+people.map(p=>
    '<tr><td>'+p[0]+'</td><td>Portrait</td><td>'+p[1]+'</td></tr>').join('')+'</tbody></table>');
}
test('official Minnesota LRL list requires observed retrieval timestamp and extracts actual Senate service, not House-only candidate',()=>{
 const r=parseOfficialMnSenateServiceDirectory(fixture(),DATE);
 assert.equal(r.schema,'mn-lrl-official-senate-ever-served-directory-v1');
 assert.equal(r.source.observedAt,DATE);
 assert.equal(r.source.url,OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL);
 assert.equal(r.source.originalHistoricDateForDisplayedDirectoryEstablished,false);
 assert.ok(r.senators.length>=300);
 assert.ok(r.senators.some(x=>x.officialName==='Ann M Johnson Stewart'));
 assert.ok(r.senators.some(x=>x.officialName==='Robert Kupec'));
 assert.ok(r.senators.some(x=>x.officialName==='Jerry Relph'));
 assert.equal(r.supplementalSwearingSource,undefined);
 assert.ok(!r.senators.some(x=>x.officialName==='Dan Bohmer'));
 assert.ok(!r.senators.some(x=>x.officialName==='Kate Luthner'));
});
test('actual Senate service requires name, district, 2020/22/24/25 term year; earlier losers later served remain eligible',()=>{
 const official=parseOfficialMnSenateServiceDirectory(fixture(),DATE);
 const correct=[
  ['Ann Johnson Stewart','45',2024],
  ['Keri Heintzeman','6',2025],
  ['Michael Holmstrom Jr','29',2025],
  ['Rob Kupec','4',2022],
 ] as const;
 for(const [name,dist,year] of correct){
  const out=validateActualSenateServiceForElection(official,name,dist,year);
  assert.equal(out.status,'verified_senate_service',name);
  assert.equal(out.officialName!==null,true);
 }
 for(const [name,dist,year] of [
  ['Dan Bohmer','4',2022],
  ['Kate Luthner','32',2022],
 ] as const){
  assert.equal(validateActualSenateServiceForElection(official,name,dist,year)
   .status,'not_yet_verified');
 }
 assert.equal(validateCandidateEverActuallyServed(official,'Samuel Future'),true);
 assert.equal(validateActualSenateServiceForElection(official,'Samuel Future','12',2022)
   .status,'verified_senate_service');
 assert.equal(validateActualSenateServiceForElection(official,'Samuel Future','12',2022)
   .serviceForThisElectionFollowingYearVerified,false);
 assert.equal(validateActualSenateServiceForElection(official,'Ann Johnson Stewart','6',2024)
   .serviceForThisElectionFollowingYearVerified,false);
 assert.equal(validateActualSenateServiceForElection(official,'Bruce Anderson','30',2025)
   .status,'verified_senate_service');
 // He died before the 2021 term but WAS previously a senator: user scope
 // includes actual former service, not only the following term.
 const relph=validateActualSenateServiceForElection(official,'Jerry Relph','14',2020);
 assert.equal(relph.status,'verified_senate_service');
 assert.equal(relph.serviceForThisElectionFollowingYearVerified,false);
 assert.equal(validateCandidateEverActuallyServed(official,'Dan Bohmer'),false);
 assert.equal(validateCandidateEverActuallyServed(official,'Kate Luthner'),false);
});
test('malformed directory HTML, invented date, or missing Senate service fails closed',()=>{
 assert.throws(()=>parseOfficialMnSenateServiceDirectory(fixture(),'2020-01-01'),/observed UTC/);
 const tampered=Buffer.from(fixture()).toString().replace('Service Information','Candidate Filing Information');
 assert.throws(()=>parseOfficialMnSenateServiceDirectory(Buffer.from(tampered),DATE),/heading/);
 assert.throws(()=>parseOfficialMnSenateServiceDirectory(Buffer.from('<html>nothing</html>'),DATE),/Incomplete/);
 const s=parseOfficialMnSenateServiceDirectory(fixture(),DATE);
 const bad={...s,source:{...s.source,sourceBytesSha256:'not-a-sha'}};
 assert.throws(()=>validateActualSenateServiceForElection(bad,'Ann Johnson Stewart','45',2024),/not authenticated/);
});

test('two original official LRL pages confirm special-election oath dates for senators missing from older directory',()=>{
 const swornRows=[
  ['11/18/2025','Rep. Amanda Hemmingsen-Jaeger (DFL, 47A) won the special election in District 47 and Michael Holmstrom (R) won in District 29 on November 4, 2025. They were sworn in on November 18, 2025.'],
  ['5/6/2025','Keri Heintzeman (R) won the special election in District 6 on April 29, 2025. She was sworn in on May 6, 2025.'],
  ['2/3/2025','Doron Clark (DFL) won the special election in District 60 on January 28, 2025. He was sworn in on February 3, 2025.'],
  ['11/25/2024','Sen. Ann Johnson Stewart (DFL) won the special election in District 45 on November 5, 2024. She was sworn in on November 25, 2024.'],
 ];
 const html=Buffer.from('<html><h1>Party Control of the Minnesota Senate</h1><table>'+
   swornRows.map(([date,note])=>'<tr><td>'+date+'</td><td>Special election</td><td>'+note+'</td></tr>').join('')+
   Array.from({length:25},(_,i)=>'<tr><td>1/'+(i+1)+'/2023</td><td>Convenes</td><td>Senate session</td></tr>').join('')+
   '</table>'+' '.repeat(9000));
 const r=parseOfficialMnSenateServiceDirectory(fixture(),DATE,html,DATE);
 assert.equal(r.supplementalSwearingSource?.observedAt,DATE);
 assert.equal(r.supplementalSwearingSource?.url,'https://www.lrl.mn.gov/history/caucus?body=s');
 for(const [name,dist,year] of [
  ['Ann Johnson Stewart','45',2024],
  ['Keri Heintzeman','6',2025],
  ['Michael Holmstrom Jr','29',2025],
  ['Amanda Hemmingsen-Jaeger','47',2025],
  ['Doron Clark','60',2025],
 ] as const) {
  const person=validateActualSenateServiceForElection(r,name,dist,year);
  assert.equal(person.status,'verified_senate_service',name);
  assert.equal(person.serviceForThisElectionFollowingYearVerified,true,name);
 }
 const manipulated=Buffer.from(html.toString('utf8').replace(
  'They were sworn in on November 18, 2025.','They were not sworn in.'));
 assert.throws(()=>parseOfficialMnSenateServiceDirectory(fixture(),DATE,manipulated,DATE),
  /Missing exact officially attested/);
});

test('exact original LRL Gary Dahms continuation without a repeated Senate prefix is not silently lost in 2023-2025',()=>{
 const official=parseOfficialMnSenateServiceDirectory(fixture(),DATE);
 const row=official.senators.find(p=>p.officialName==='Gary H. Dahms');
 assert.ok(row);
 assert.ok(row.senateServiceTerms.some(t=>
  t.startsYear===2023&&t.endsYear===null&&t.district==='15'));
 const service=validateActualSenateServiceForElection(official,'Gary H. Dahms','15',2022);
 assert.equal(service.status,'verified_senate_service');
 assert.equal(service.serviceForThisElectionFollowingYearVerified,true);
 const wrongDistrict=Buffer.from(fixture().toString().replace(
  '2023-Present (District 15)','2023-Present (District 14)'));
 const noPromotion=parseOfficialMnSenateServiceDirectory(wrongDistrict,DATE);
 assert.equal(noPromotion.senators.find(p=>p.officialName==='Gary H. Dahms')
  ?.senateServiceTerms.some(t=>t.startsYear===2023&&t.district==='15'),false);
});
