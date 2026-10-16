import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { selectCfb2025DatedSenateRegistrationTargets } from
  '../../src/evidence/cfb-2025-dated-senate-registration-cohort.js';

const ROOT='docs/evaluation/source-proof/';
const LEDGER=ROOT+'cfb-2025-dated-senate-85-reference-versions.psv';
const CHECKPOINT=ROOT+'cfb-2025-dated-senate-85-reference-source-checkpoint.json';
const VIEWER=ROOT+'cfb-2021-25-senate-district-registration-source-checkpoint.json';
const DATED=ROOT+'cfb-2026-public-current-senate-registration-dates.psv';
function sha256(value:string) {
  return createHash('sha256').update(value,'utf8').digest('hex');
}
function checkpoint() {
  return JSON.parse(readFileSync(CHECKPOINT,'utf8')) as Record<string,any>;
}
function parsedRows() {
  const raw=readFileSync(LEDGER,'utf8');
  assert.ok(raw.endsWith('\n'));
  const canonical=raw.slice(0,-1);
  const rows=canonical.split('\n').map(line=>{
    const parts=line.split('|');
    assert.equal(parts.length,3,'registration|originalApiSha256|versionCodes');
    const [registrationNumber,sourceSha256,tokensText]=parts as [string,string,string];
    assert.match(registrationNumber,/^\d{3,8}$/);
    assert.match(sourceSha256,/^[0-9a-f]{64}$/);
    assert.ok(tokensText);
    const tokens=tokensText.split(',');
    assert.equal(new Set(tokens).size,tokens.length);
    const reportIds=tokens.map(token=>{
      const m=/^(YE|C|E)([01])\.([0-4])$/.exec(token);
      assert.ok(m,'Malformed source 2025 report identity '+token);
      return registrationNumber+':25:pcc:'+m![1]+':'+m![2]+':'+m![3];
    });
    assert.deepEqual(reportIds,[...reportIds].sort());
    return {registrationNumber,sourceSha256,reportIds};
  });
  return {canonical,rows};
}
test('original one-time source artifact and version-ledger hashes remain pinned',()=>{
  const p=checkpoint(), {canonical,rows}=parsedRows();
  assert.equal(p.provenance.sourceArtifactId,11682530876);
  assert.equal(p.provenance.runId,38085296709);
  assert.equal(p.provenance.sourceZipSha256,
    'f66f717162ccc2d0f9d84cb939c37fe3a45fcd49cc83dbad562647f88b9d2027');
  assert.equal(p.provenance.originalUncompressedJsonSha256,
    '279cf523e15487bac3ad4e295a806d046bffbd26d67a60e4b3b55f4b7af90ce7');
  assert.equal(p.provenance.originalUncompressedJsonBytes,133650);
  assert.equal(sha256(canonical),
    'd34bb475cccd94481fd2f2215bf47e3c9695ad328e06bed2475967add067f0d0');
  assert.equal(sha256(canonical),p.provenance.canonicalVersionLedgerSha256WithoutFinalNewline);
  assert.equal(sha256(rows.map(x=>x.sourceSha256).join('\n')),
    '27b914d4094f18cbc359995b4edb9b32dc70e0ec4e75484e2273582c3d3dd201');
});

test('41 source-confirmed 2025 registrations have 85 exact original/amendment version refs',()=>{
  const p=checkpoint(), {rows}=parsedRows();
  const ids=rows.map(x=>x.registrationNumber);
  assert.equal(rows.length,41);
  assert.deepEqual(ids,[...ids].sort());
  assert.equal(new Set(ids).size,41);
  assert.ok(ids.includes('19205'));
  const refs=rows.flatMap(r=>r.reportIds);
  assert.equal(refs.length,85);
  assert.equal(new Set(refs).size,85);
  assert.equal(sha256([...refs].sort().join('\n')),
    'e2d650a432620738a8cfcb68ce794ad9007353e93608cd7850cb1ce465011ece');
  const original=refs.filter(x=>x.endsWith(':0'));
  const amendments=refs.filter(x=>!x.endsWith(':0'));
  assert.equal(original.length,60);
  assert.equal(amendments.length,25);
  const count=(period:string,versions:readonly string[])=>versions.filter(x=>x.includes(':pcc:'+period+':')).length;
  assert.deepEqual([count('YE',original),count('C',original),count('E',original)],[48,7,5]);
  assert.deepEqual([count('YE',amendments),count('C',amendments),count('E',amendments)],[19,3,3]);
  assert.deepEqual(p.observedReportReferences.byReportPeriod,{
    YE:{originalReferences:48,amendmentReferences:19},
    C:{originalReferences:7,amendmentReferences:3},
    E:{originalReferences:5,amendmentReferences:3},
  });
  assert.equal(p.observedReportReferences.malformedReportReferences,0);
  assert.equal(p.observedReportReferences.sourceFailures,0);
});

test('85 reference IDs come only from independent 41 Senate registrations dated during 2025',()=>{
  const {rows}=parsedRows();
  const viewer=JSON.parse(readFileSync(VIEWER,'utf8'));
  const dated=readFileSync(DATED,'utf8');
  const cohort=selectCfb2025DatedSenateRegistrationTargets(viewer,dated);
  assert.equal(cohort.datedRegistration2025.length,41);
  assert.equal(cohort.datedRegistration2026Excluded.length,78);
  assert.equal(cohort.registrationDateStillUnverified.length,15);
  assert.deepEqual(rows.map(x=>x.registrationNumber),cohort.datedRegistration2025);
  assert.deepEqual(rows.find(x=>x.registrationNumber==='19205')?.reportIds,[
    '19205:25:pcc:C:1:0','19205:25:pcc:E:1:0',
    '19205:25:pcc:YE:0:0','19205:25:pcc:YE:0:1','19205:25:pcc:YE:1:0',
  ]);
  const p=checkpoint();
  assert.equal(p.scope.reportYear,2025);
  assert.equal(p.scope.candidateViewerSegmentEndYear,2026);
  assert.equal(p.scope.registeredDuring2025Scoped,41);
  assert.equal(p.scope.registeredDuring2026Excluded,78);
  assert.equal(p.scope.registrationDateUnknownExcluded,15);
});

test('reference metadata is never elevated into a filed PDF, historical availability or complete report denominator',()=>{
  const p=checkpoint(),d=p.historicalFinanceDenominator;
  assert.equal(d.committeesLegallyActiveIn2025,null);
  assert.equal(d.required2025ReportCount,null);
  assert.equal(d.actuallyFiledOriginalReportCount,null);
  assert.equal(d.newPdfVerificationsInThisSourceReferenceCheckpoint,0);
  assert.equal(d.priorOriginalPdfControlProofsExist,true);
  assert.equal(d.historicalPublicByVerifiedReportCount,0);
  assert.equal(d.sourceToDbRowContainmentProved,false);
  assert.equal(d.statutoryDeadlineAndFilingDatesReconciled,false);
  assert.equal(d.completeStatewide2021to2025SenateCoverageCertified,false);
  assert.equal(p.boundaries.noRawPdfBytesInThisCheckpoint,true);
  assert.equal(p.boundaries.noAutomatedBackfillOrNewScheduler,true);
  assert.equal(p.boundaries.issue864MustRemainOpen,true);
});
