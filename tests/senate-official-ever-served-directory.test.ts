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
  ['Stewart, Ann Johnson','Senate 2025-Present (District 45)'],
  ['Heintzeman, Keri','House 2015-2024 (District 6B); Senate 2025-Present (District 6)'],
  ['Holmstrom, Michael Jr.','Senate 2025-Present (District 29)'],
  ['Kupec, Rob','Senate 2023-Present (District 4)'],
  ['Bohmer, Dan','House 2021-2022 (District 4A)'],
  ['Luthner, Kate','House 2021-2022 (District 32B)'],
  ['Future, Samuel','House 2020-2022 (District 12B); Senate 2025-Present (District 16)'],
  ['Anderson, Bruce Douglas','House 1995-2012 (District 19A); Senate 2013-2022 (District 29); Senate 2023-2025 (District 29)'],
 ];
 for(let i=0;i<305;i++)people.push(['OfficialTest, Person'+i,
  'Senate 1920-1922 (District '+(i%67+1)+')']);
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
 assert.ok(r.senators.some(x=>x.officialName==='Ann Johnson Stewart'));
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
  ['Ann Johnson Stewart','6',2024],
  ['Bruce Anderson','29',2025],
 ] as const){
  assert.equal(validateActualSenateServiceForElection(official,name,dist,year)
   .status,'not_yet_verified');
 }
 assert.equal(validateCandidateEverActuallyServed(official,'Samuel Future'),true);
 assert.equal(validateActualSenateServiceForElection(official,'Samuel Future','12',2022)
   .status,'not_yet_verified');
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
