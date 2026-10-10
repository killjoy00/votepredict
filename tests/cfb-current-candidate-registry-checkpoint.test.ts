import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const ROOT = 'docs/evaluation/source-proof/';
const metaFile = ROOT + 'cfb-2026-public-current-senate-registry-checkpoint.json';
const datedFile = ROOT + 'cfb-2026-public-current-senate-registration-dates.psv';
const priorFile = ROOT + 'cfb-2021-25-senate-district-registration-source-checkpoint.json';

function sourceProof() {
  return JSON.parse(readFileSync(metaFile,'utf8')) as Record<string,any>;
}
function datedRows() {
  const raw = readFileSync(datedFile,'utf8');
  const canonical = raw.endsWith('\n') ? raw.slice(0,-1) : raw;
  const rows = canonical.split('\n').map(line => {
    const fields = line.split('|');
    assert.equal(fields.length,3,'id|registered|terminated');
    return {id:fields[0]!,registered:fields[1]!,terminated:fields[2]!};
  });
  return {raw,canonical,rows};
}
function sha256(s:string) {
  return createHash('sha256').update(s,'utf8').digest('hex');
}

test('historical Senate source registry checkpoint is only a 2026 public snapshot with pinned source bytes',()=>{
  const p=sourceProof();
  assert.equal(p.provenance.artifactId,11682175090);
  assert.equal(p.provenance.artifactZipSha256,'f3a3dcdeca4756e9d92a2f474e08aea5e00cdb25a2d6faceea3ac08a39ab788d');
  assert.equal(p.provenance.uncompressedMetadataJsonSha256,'5a2cd6634ffe84318e2313ad7a16005964c9ee7ce947ed821142cd2db5010f47');
  assert.equal(p.provenance.allRegisteredCandidates.originalResponseSha256,
    'ed1666be22ecfb3bb1f550e33e2704c720c563bc7f99bc5bcfc440c4d6062a12');
  assert.equal(p.provenance.recentCandidateTerminations.originalResponseSha256,
    '41e0a0e0e31f7eb7d7289260f4137e81da714f3025b633adc8fd8b2505dafb1d');
  assert.deepEqual(p.scope.studyReportYears,[2021,2022,2023,2024,2025]);
  assert.equal(p.historicalDenominator.historicalFilingDenominatorCertified,false);
});

test('all 230 currently listed Senate registered IDs and their 2026-current dates remain immutable',()=>{
  const p=sourceProof(), {canonical,rows}=datedRows();
  assert.equal(rows.length,230);
  assert.equal(p.provenance.normalizedPsvSha256WithoutFinalNewline,
    '31376fef8883e40d86091632b7d0581ee034553f56f43d56744ebe7c3c9a94ec');
  assert.equal(sha256(canonical),p.provenance.normalizedPsvSha256WithoutFinalNewline);
  const ids=rows.map(r=>r.id);
  assert.equal(new Set(ids).size,230);
  assert.deepEqual(ids,[...ids].sort());
  assert.ok(rows.every(x=>/^\d{3,8}$/.test(x.id) && /^\d{4}-\d{2}-\d{2}$/.test(x.registered) &&
    (!x.terminated || /^\d{4}-\d{2}-\d{2}$/.test(x.terminated))));
  assert.ok(rows.every(x=>x.registered<='2026-10-10' &&
    (!x.terminated || x.terminated>=x.registered)));
  assert.equal(rows.filter(x=>x.registered<='2025-12-31').length,152);
  assert.equal(rows.filter(x=>x.registered>='2026-01-01').length,78);
  assert.equal(rows.filter(x=>x.terminated).length,3);
  assert.ok(ids.includes('18443'));
  assert.ok(ids.includes('19205'));
});

test('2026 Senate candidate register observations are entirely contained in 494 source-viewer registrations',()=>{
  const p=sourceProof(), historical=JSON.parse(readFileSync(priorFile,'utf8'));
  const {rows}=datedRows();
  const viewerIds=new Set<string>(historical.observedCandidateRegistrationIndex.registrationIdsCsv.split(','));
  assert.equal(viewerIds.size,494);
  assert.ok(rows.every(x=>viewerIds.has(x.id)));
  assert.equal([...viewerIds].filter(id=>!rows.some(x=>x.id===id)).length,264);
  assert.equal(p.observedSourceSnapshot.senateCurrentRegistrationsMatchedToViewer,230);
  assert.equal(p.observedSourceSnapshot.currentSenateRegistrationsMissingFromViewer,0);
  assert.equal(p.observedSourceSnapshot.viewerRegistrationsNotOnOctober2026CurrentCandidateList,264);
  assert.equal(p.observedSourceSnapshot.allCurrentCandidateRegistrationsAllOffices,767);
  assert.equal(p.observedSourceSnapshot.currentlyListedSenateRegistrations,230);
  assert.equal(p.provenance.allRegisteredCandidates.parsedRows,767);
  assert.equal(p.provenance.recentCandidateTerminations.parsedRows,21);
  assert.equal(p.provenance.allRegisteredCandidates.rejectedRows,0);
  assert.equal(p.provenance.recentCandidateTerminations.rejectedRows,0);
});

test('recent terminations stay 2026 source evidence, never fabricated historical termination or reports',()=>{
  const p=sourceProof(), {rows}=datedRows();
  assert.deepEqual(p.observedSourceSnapshot.viewerRegistrationIdsOnOctober2026RecentTerminationList,
    ['17854','18694','18763','19362','19422','19563']);
  assert.deepEqual(rows.filter(x=>x.terminated).map(x=>x.id),
    ['17854','18694','19563']);
  assert.equal(p.historicalDenominator.totalCandidateCommitteesLegallyActiveIn2021to2025,null);
  assert.equal(p.historicalDenominator.yearByYearRegisteredCommitteeFilerYears,null);
  assert.equal(p.historicalDenominator.statutoryReportsRequiredForSenate2021to2025,null);
  assert.equal(p.historicalDenominator.actuallyFiledOriginalReportCount,null);
  assert.equal(p.historicalDenominator.auditedExemptionsNonfilersTerminations,null);
  assert.equal(p.historicalDenominator.completeHistoricalLifeCycleVerified,false);
  assert.equal(p.observedSourceSnapshot.viewerOnlyDoesNotImplyTerminated,true);
  assert.equal(p.observedSourceSnapshot.registrationDatedBefore2026DoesNotImplyEveryAnnualReportDue,true);
  assert.equal(p.boundaries.noProductionDatabaseReadWrite,true);
  assert.equal(p.boundaries.noTrainingServingOr2027Changes,true);
});

test('2026 election-viewer-only candidate registration IDs split into 2025/2026/unknown by independent official date source',()=>{
  const current=sourceProof();
  const historical=JSON.parse(readFileSync(priorFile,'utf8')) as Record<string,any>;
  const ids=historical.observedCandidateRegistrationIndex.registrationIdsCsv.split(',') as string[];
  const masks=historical.observedCandidateRegistrationIndex.segmentMembershipMaskHex as string;
  assert.equal(ids.length,494);
  assert.equal(masks.length,494);
  const only2026=new Set(ids.filter((_id,i)=>masks[i]==='8'));
  assert.equal(only2026.size,134);
  const currentRows=new Map(datedRows().rows.map(r=>[r.id,r]));
  const date2025=[...only2026].filter(id=>{
    const d=currentRows.get(id)?.registered;
    return d && d>='2025-01-01' && d<='2025-12-31';
  });
  const date2026=[...only2026].filter(id=>{
    const d=currentRows.get(id)?.registered;
    return d && d>='2026-01-01' && d<='2026-12-31';
  });
  const stillUnresolved=[...only2026].filter(id=>!currentRows.has(id));
  assert.equal(date2025.length,41);
  assert.equal(date2026.length,78);
  assert.equal(stillUnresolved.length,15);
  assert.ok(date2025.includes('19205'));
  assert.deepEqual(current.observedSourceSnapshot.viewerOnly2026SegmentRegistrationCohorts, {
    totalCandidateRegistrationsObservedOnlyIn2026ElectionSegment:134,
    listedInOctober2026CurrentSenateRegistryWithRegistrationDuring2025:41,
    listedInOctober2026CurrentSenateRegistryWithRegistrationDuring2026:78,
    absentFromOctober2026CurrentRegistryNoDatedRegistrationProof:15,
    accounting:'41+78+15=134. 2026 election-viewer year is NOT the registration year; 2025-dated observations are leads, not legal filing obligations.',
  });
  assert.equal(current.observedSourceSnapshot.viewerIdsObservedIn2020or2022or2024Cohorts.total,360);
  assert.equal(current.observedSourceSnapshot.viewerIdsObservedIn2020or2022or2024Cohorts.alsoListedInOctober2026CurrentRegistry,111);
  assert.equal(current.observedSourceSnapshot.viewerIdsObservedIn2020or2022or2024Cohorts.notListedInCurrentRegistry,249);
  assert.equal(current.historicalDenominator.statutoryReportsRequiredForSenate2021to2025,null);
});
