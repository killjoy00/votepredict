import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {createHash} from 'node:crypto';
import { selectCfb2025DatedSenateRegistrationTargets } from
  '../../src/evidence/cfb-2025-dated-senate-registration-cohort.js';

const viewerFile='docs/evaluation/source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json';
const datedFile='docs/evaluation/source-proof/cfb-2026-public-current-senate-registration-dates.psv';
const viewer=JSON.parse(readFileSync(viewerFile,'utf8'));
const dated=readFileSync(datedFile,'utf8');
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');

test('actual regulator-source cohort is 41 2025 dated registrations, not the 78 registered in 2026',()=>{
  assert.equal(hash(dated.trimEnd()),
    '31376fef8883e40d86091632b7d0581ee034553f56f43d56744ebe7c3c9a94ec');
  const selected=selectCfb2025DatedSenateRegistrationTargets(viewer,dated);
  assert.equal(selected.observedOnlyOn2026ElectionSegment,134);
  assert.equal(selected.datedRegistration2025.length,41);
  assert.equal(selected.datedRegistration2026Excluded.length,78);
  assert.equal(selected.registrationDateStillUnverified.length,15);
  assert.equal(selected.otherDatedRegistrationYearsNotAutoAssigned.length,0);
  assert.ok(selected.datedRegistration2025.includes('19205'));
  assert.ok(selected.datedRegistration2026Excluded.includes('19563'));
  assert.ok(selected.registrationDateStillUnverified.includes('19209'));
  assert.equal(selected.candidateReportYear,2025);
  assert.equal(selected.candidateViewerSegmentEndYear,2026);
  assert.equal(selected.reportRequirementProved,false);
  assert.equal(selected.actualOriginalReportFilingProved,false);
  assert.equal(selected.pdfContentsOrHistoricalPublicByProved,false);
});
test('malformed duplicate or contradictory registry dates cannot produce report targets',()=>{
  assert.throws(()=>selectCfb2025DatedSenateRegistrationTargets(viewer,
    '19205|2025-03-20|\n19205|2025-03-20|\n'),/source row/);
  assert.throws(()=>selectCfb2025DatedSenateRegistrationTargets(viewer,
    '19205|2025-02-29|\n'),/source row/);
  assert.throws(()=>selectCfb2025DatedSenateRegistrationTargets(viewer,
    '19205|2026-03-20|2025-11-01\n'),/source row/);
  assert.throws(()=>selectCfb2025DatedSenateRegistrationTargets(viewer,
    '19205|2025-03-20|\n18443|2019-10-02|\n'),/source row/);
  assert.throws(()=>selectCfb2025DatedSenateRegistrationTargets(viewer,
    '19205|2025-03-20|contact@example.com\n'),/source row/);
});
test('viewer segment masks must be complete, sorted and tied to real IDs',()=>{
  const invalid=JSON.parse(JSON.stringify(viewer));
  invalid.observedCandidateRegistrationIndex.segmentMembershipMaskHex='8';
  assert.throws(()=>selectCfb2025DatedSenateRegistrationTargets(invalid,dated),/viewer registration/);
  const duplicated=JSON.parse(JSON.stringify(viewer));
  duplicated.observedCandidateRegistrationIndex.registrationIdsCsv='19205,19205';
  duplicated.observedCandidateRegistrationIndex.distinctRegistrations=2;
  duplicated.observedCandidateRegistrationIndex.segmentMembershipMaskHex='88';
  assert.throws(()=>selectCfb2025DatedSenateRegistrationTargets(duplicated,dated),/viewer registration/);
});
