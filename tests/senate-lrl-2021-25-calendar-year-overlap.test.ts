import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,existsSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import type {AuditedOfficialSenateDirectory,SenateServedRecord} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {buildActualSenatorOfficialYearOverlapResearch} from
 '../src/evidence/senate-lrl-2021-25-calendar-year-service-window.js';
const url='https://www.lrl.mn.gov/legdb/senate_dir';
function official():AuditedOfficialSenateDirectory{
 // Explicitly synthetic structural fixtures. Passing these is NOT proof of
 // actual public Senate service: only the real original source CI proves that.
 const senators:SenateServedRecord[]=Array.from({length:65},(_,i)=>({
  officialName:'Synthetic Test Senator '+i,
  officialNameRaw:'TEST-SENATE-ROW-'+i,
  officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
  senateServiceTerms:[{startsYear:2019,endsYear:2023,district:String(i+1)}],
 }));
 senators[0]={
  officialName:'Ann M Johnson Stewart',officialNameRaw:'Johnson Stewart, Ann M',
  officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
  senateServiceTerms:[{startsYear:2024,endsYear:null,district:'45'}],
 };
 senators[1]={
  officialName:'Keri Heintzeman',officialNameRaw:'Heintzeman, Keri',
  officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
  senateServiceTerms:[{startsYear:2025,endsYear:null,district:'6'}],
 };
 senators[2]={
  officialName:'Nicole Mitchell',officialNameRaw:'Mitchell, Nicole',
  officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
  senateServiceTerms:[{startsYear:2023,endsYear:2025,district:'47'}],
 };
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url:'https://www.lrl.mn.gov/legdb/senate_dir',
   observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'a'.repeat(64),sourceBytesLength:320000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  supplementalSwearingSource:{
   url:'https://www.lrl.mn.gov/history/caucus?body=s',
   observedAt:'2026-10-10T23:26:11.100Z',
   sourceBytesSha256:'b'.repeat(64),sourceBytesLength:26000,
   swearingDateIndependentlyDocumentedForNamedSpecialMembers:true,
   websitePublicationDateBackdated:false,
  },
  senators,
 };
}
test('2021–25 source-year overlaps are not Jan-1/Dec-31 continuous-service assertions',()=>{
 const x=buildActualSenatorOfficialYearOverlapResearch(official());
 assert.equal(x.byYear.length,5);
 assert.equal(x.totals.officialServedSenatorDirectoryRowsRead,65);
 assert.equal(x.totals.distinctOfficialDirectoryPeopleRepresentedDuring2021to25,65);
 assert.equal(x.byYear[0].year,2021);
 assert.equal(x.byYear[0].people.some(p=>p.officialPersonName==='Nicole Mitchell'),false);
 const nicole=x.byYear[2].people.find(p=>p.officialPersonName==='Nicole Mitchell');
 assert.equal(nicole?.originalOfficialServiceYearTerms[0].fromYear,2023);
 assert.equal(nicole?.exactWithinYearActualServiceStartDate,null);
 assert.equal(nicole?.exactWithinYearActualServiceEndDate,null);
 assert.equal(nicole?.fullCalendarYearContinuousOccupancyProven,false);
 assert.equal(x.byYear[4].people.some(p=>p.officialPersonName==='Nicole Mitchell'),true);
 assert.equal(x.totals.exactStartEndMembershipIntervalsCertified,0);
 assert.equal(x.byYear[0].reportedDistrictLabelDiagnostics.missingLabelIsNotProofOfVacancyOrNeverServing,true);
 assert.ok(x.byYear[0].reportedDistrictLabelDiagnostics.noOfficialServiceYearRowForTheseLabels.includes('15')===false);
});
test('original district source labels expose overlapping occupancy and uncovered labels without guessing who served',()=>{
 const d=official();
 d.senators[3].senateServiceTerms[0].district='7';
 d.senators[4].senateServiceTerms[0].district='7';
 const years=buildActualSenatorOfficialYearOverlapResearch(d).byYear;
 const conflicts=years[0].reportedDistrictLabelDiagnostics;
 assert.ok(conflicts.labelsWithMultipleObservedSenateServicePeople.some(x=>x.district==='7'));
 assert.equal(conflicts.overlappingLabelMayBeRealMidyearTransitionOrSourceError,true);
 assert.ok(conflicts.noOfficialServiceYearRowForTheseLabels.length>0);
});
test('original official 2024/25 Senate oath dates are preserved as oath events, not falsely as generic term start',()=>{
 const x=buildActualSenatorOfficialYearOverlapResearch(official());
 const ann=x.byYear[3].people.find(p=>p.officialPersonName==='Ann M Johnson Stewart');
 const keri=x.byYear[4].people.find(p=>p.officialPersonName==='Keri Heintzeman');
 assert.equal(ann?.distinctDatedSpecialSenateOathEvents[0]?.swornOn,'2024-11-25');
 assert.equal(keri?.distinctDatedSpecialSenateOathEvents[0]?.swornOn,'2025-05-06');
 assert.equal(ann?.exactWithinYearActualServiceStartDate,null);
 assert.equal(keri?.exactWithinYearActualServiceStartDate,null);
 assert.equal(ann?.distinctDatedSpecialSenateOathEvents[0]?.exactFirstEverServiceDayEstablishedByThisOathAlone,false);
 assert.equal(x.byYear[2].people.some(p=>p.officialPersonName==='Keri Heintzeman'),false);
});
test('do not merge ambiguous same official raw person, invent district, or omit independent oath source',()=>{
 const d=official();
 d.senators[3].officialNameRaw=d.senators[4].officialNameRaw;
 assert.throws(()=>buildActualSenatorOfficialYearOverlapResearch(d),/ambiguous identical/);
 const e=official();e.senators[3].senateServiceTerms[0].district='68';
 assert.throws(()=>buildActualSenatorOfficialYearOverlapResearch(e),/invalid district/);
 const f=official();delete f.supplementalSwearingSource;
 assert.throws(()=>buildActualSenatorOfficialYearOverlapResearch(f),/special-oath/);
});
test('original source chronology and SHA presence are mandatory',()=>{
 const d=official();
 d.source.observedAt='2022-01-01T00:00:00Z';
 assert.throws(()=>buildActualSenatorOfficialYearOverlapResearch(d),/official LRL/);
 const x=official();
 x.supplementalSwearingSource!.sourceBytesSha256='not-a-hash';
 assert.throws(()=>buildActualSenatorOfficialYearOverlapResearch(x),/special-oath/);
});
test('offline command requires distinct real original LRL and sworn-source paths',()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-year-original-source-'));
 try{
  const out=join(dir,'report.json');
  const command=['--import','tsx','scripts/audit-senate-lrl-2021-25-calendar-year-overlap-offline.ts'];
  assert.throws(()=>execFileSync('node',[...command,'--output',out],
   {stdio:'pipe',timeout:15000}));
  const stub=join(dir,'bad.html');writeFileSync(stub,'bogus source');
  assert.throws(()=>execFileSync('node',[...command,
   '--official-lrl-original',stub,'--official-lrl-metadata',stub,
   '--official-lrl-swearing',stub,'--output',out],
  {stdio:'pipe',timeout:15000}));
  assert.equal(existsSync(out),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
