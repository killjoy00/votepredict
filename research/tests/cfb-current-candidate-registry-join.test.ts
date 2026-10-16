import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditCfbCurrentCandidateRegistryAgainstSenateViewer,
  parseCfbCandidateRegistryGrid,
  type CfbCandidateRegistrySource,
  type CfbCandidateRegistryListAction,
} from '../evidence/cfb-current-candidate-registry-join.js';

const allCols=[
  'RegisteredEntityID','RegisteredEntityFullName','OfficeSoughtFullName',
  'District','RegistrationDate','TerminationDate'
];
const termCols=[
  'RegisteredEntityID','OfficeKey','District','RegistrationDate','TerminationDate'
];
function grid(action:CfbCandidateRegistryListAction,rows:unknown[][]): CfbCandidateRegistrySource {
  const columns=action==='all-registered-candidates'?allCols:termCols;
  const payload={cols:columns,data:Object.fromEntries(rows.map((row,i)=>[String(i),[row]]))};
  return {
    action,
    apiUrl:'https://register.cfb.mn.gov/reports/api/',
    fetchedAt:'2026-10-10T21:00:00.000Z',
    responseSha256:'b'.repeat(64),
    grid:parseCfbCandidateRegistryGrid(payload,action),
  };
}
function viewer(ids:string[]) {
  return {observedCandidateRegistrationIndex:{
    registrationIdsCsv:ids.join(','),
    distinctRegistrations:ids.length,
    knownOriginalReportControlIds:['18443','19205'],
  }};
}
const allRows=[
  ['18443','Murphy, Erin','Senate','64','2019-10-15 08:26:00.000',''],
  ['19205','Heintzeman, Keri','Senate','6','2025-02-20 00:00:00.000',null],
  ['19600','Other public name','Senate','61','2026-10-03 00:00:00.000',null],
  ['17686','Current House candidate','House','22A','2013-12-21 08:46:00.000',''],
];
const termRows=[
  ['18937','Senate','64','2020-08-01 09:00:00.000','2026-09-18 00:00:00.000'],
];

test('parse official current registry date fields, exclude names and accept only typed public IDs',()=>{
  const s=grid('all-registered-candidates',allRows);
  assert.equal(s.grid.rawRowCount,4);
  assert.equal(s.grid.rejectedRowCount,0);
  assert.deepEqual(s.grid.rows[0],{
    registrationNumber:'18443',
    office:'Senate',district:'64',
    registrationDate:'2019-10-15',terminationDate:null,
  });
  assert.ok(!JSON.stringify(s.grid).includes('Heintzeman'));
  assert.ok(!JSON.stringify(s.grid).includes('Murphy'));
});

test('2026 public list overlap is NOT historical registered-committee or report denominator',()=>{
  const a=auditCfbCurrentCandidateRegistryAgainstSenateViewer(
    viewer(['18443','18937','19205']),
    grid('all-registered-candidates',allRows),
    grid('recent-candidate-terminations',termRows),
  );
  assert.equal(a.snapshot.viewerCandidateIdsObserved,3);
  assert.equal(a.snapshot.viewerIdsListedOnCurrentSource,2);
  assert.equal(a.snapshot.viewerIdsNotListedOnCurrentSource,1);
  assert.deepEqual(a.snapshot.viewerIdsInRecentTerminationListing,['18937']);
  assert.deepEqual(a.snapshot.currentSenateIdsAbsentFromElectionSegmentViewer,['19600']);
  assert.equal(a.snapshot.currentListedSenateRegistrationIds,3);
  assert.equal(a.snapshot.bothKnownOriginalReportControlsInCurrentList,true);
  const absent=a.viewerRegistrationCrosscheck.find(x=>x.registrationNumber==='18937');
  assert.equal(absent?.currentPublicListStatus,'not_listed_in_2026_current_source');
  assert.equal(absent?.committeeActivity2021to2025,null);
  assert.equal(a.historicalFinanceDenominator.committeeRegistrationsLegallyActiveIn2021to2025,null);
  assert.equal(a.historicalFinanceDenominator.legallyRequiredCandidateReportCount,null);
  assert.equal(a.historicalFinanceDenominator.originalReportsFiledCount,null);
  assert.equal(a.historicalFinanceDenominator.absentFrom2026ListImpliesHistoricallyTerminated,false);
  assert.equal(a.historicalFinanceDenominator.fullStatewideHistoricalFilingDenominatorCertified,false);
});

test('same ID with different office/date rows does not silently count as Senate',()=>{
  const a=auditCfbCurrentCandidateRegistryAgainstSenateViewer(
    viewer(['18443','19205']),
    grid('all-registered-candidates', [
      allRows[0]!,
      ['18443','Alias','House','42A','2023-01-01 00:00:00.000',null],
      allRows[1]!,
    ]),
    grid('recent-candidate-terminations',termRows),
  );
  assert.deepEqual(a.snapshot.currentSourceRegistrationIdConflicts,['18443']);
  assert.equal(a.snapshot.currentListedSenateRegistrationIds,1);
  assert.equal(a.viewerRegistrationCrosscheck.find(x=>x.registrationNumber==='18443')?.listedRegistrationDate,null);
  assert.equal(a.viewerRegistrationCrosscheck.find(x=>x.registrationNumber==='18443')?.currentPublicListStatus,'source_registration_conflict');
});

test('malformed dates, reversed dates, missing official schema and IDs fail safely',()=>{
  const bad=grid('all-registered-candidates', [
    ['not-a-reg','Bad name','Senate','64','2023-01-01 00:00:00.000',null],
    ['18443','Invalid date','Senate','64','2025-02-29 00:00:00.000',null],
    ['19205','Before start','Senate','6','2025-01-01 00:00:00.000','2024-12-31 00:00:00.000'],
    allRows[0]!,
  ]);
  assert.equal(bad.grid.rawRowCount,4);
  assert.equal(bad.grid.rows.length,1);
  assert.equal(bad.grid.rejectedRowCount,3);
  assert.throws(()=>parseCfbCandidateRegistryGrid({cols:['RegisteredEntityID'],data:{}},'all-registered-candidates'),/columns absent/);
  assert.throws(()=>parseCfbCandidateRegistryGrid([], 'recent-candidate-terminations'),/column schema/);
});

test('source hash, timestamp, endpoint and input target fingerprint must be official and well-formed',()=>{
  const all=grid('all-registered-candidates',allRows);
  const recent=grid('recent-candidate-terminations',termRows);
  assert.throws(()=>auditCfbCurrentCandidateRegistryAgainstSenateViewer(
    viewer(['18443','19205']),{...all,responseSha256:'BAD'},recent,
  ),/source identity/);
  assert.throws(()=>auditCfbCurrentCandidateRegistryAgainstSenateViewer(
    viewer(['18443','19205']),{...all,apiUrl:'https://example.org/reports/api/'},recent,
  ),/source identity/);
  assert.throws(()=>auditCfbCurrentCandidateRegistryAgainstSenateViewer(
    viewer(['19205','18443']),all,recent,
  ),/reference inventory/);
  assert.throws(()=>auditCfbCurrentCandidateRegistryAgainstSenateViewer(
    {observedCandidateRegistrationIndex:{
      registrationIdsCsv:'18937',distinctRegistrations:1,
      knownOriginalReportControlIds:['18937'],
    }},all,recent,
  ),/controls/);
});
