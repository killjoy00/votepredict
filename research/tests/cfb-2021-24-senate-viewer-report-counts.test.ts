import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CFB_SENATE_2021_24_REPORT_REFERENCE_COUNT_VERSION,
  CFB_SENATE_SOURCE_VIEWER_CHECKPOINT_PATH,
  auditCfb2021to24SenateViewerReferenceCounts,
  deriveCfb2021to24SenateViewerCohort,
} from '../evidence/cfb-2021-24-senate-viewer-report-counts.js';
import type { CfbCandidateInventorySnapshot } from '../../src/evidence/cfb-candidate-report-inventory.js';
import type { CfbReportViewerReference } from '../../src/evidence/cfb-report-pdf-proof.js';

function cohort() {
  return deriveCfb2021to24SenateViewerCohort(
    JSON.parse(readFileSync(CFB_SENATE_SOURCE_VIEWER_CHECKPOINT_PATH,'utf8')));
}
function snap(registrationNumber:string,segmentEndYear:2022|2024,
  refs:CfbReportViewerReference[]):CfbCandidateInventorySnapshot {
  return {
    status:'acquired',registrationNumber,segmentEndYear,
    sourceUrl:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'
      +registrationNumber+'/'+segmentEndYear+'/',
    apiUrl:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/api',
    fetchedAt:'2026-10-10T22:00:00.000Z',
    responseSha256:'a'.repeat(64),
    references:refs,
  };
}
function ref(registrationNumber:string,year:number,period:string,amendment:number):
CfbReportViewerReference {
  return {filingYear:year,reportName:'Official report period '+period,
    year:String(year).slice(2),registrationNumber,
    type:'pcc',period,se:'0',amendment};
}
test('hash-pinned independent 494-ID district viewer yields exactly 396 historical segment targets, 275 IDs',()=>{
  const c=cohort();
  assert.equal(c.sourcePinnedTotalRegistrationNumbers,494);
  assert.equal(c.targets.length,396);
  assert.equal(c.scopedDistinctRegistrationNumbers.length,275);
  assert.equal(c.targets.filter(t=>t.segmentEndYear===2022).length,270);
  assert.equal(c.targets.filter(t=>t.segmentEndYear===2024).length,126);
  assert.equal(c.notSelectedViewer2020Only,84);
  assert.equal(c.notSelectedViewer2026Only,134);
  assert.equal(c.notSelectedViewer2020And2026ButNoMidSegment,1);
  assert.equal(c.legalRegistrationAndFilingDenominator,null);
  assert.deepEqual(c.targets.map(t=>t.registrationNumber+':'+t.segmentEndYear),
    [...c.targets].sort((a,b)=>a.segmentEndYear-b.segmentEndYear
      || a.registrationNumber.localeCompare(b.registrationNumber))
      .map(t=>t.registrationNumber+':'+t.segmentEndYear));
  assert.equal(new Set(c.targets.map(t=>t.registrationNumber+':'+t.segmentEndYear)).size,396);
  assert.ok(c.targets.some(x=>x.registrationNumber==='18443'&&x.segmentEndYear===2022));
  assert.ok(!c.targets.some(x=>x.registrationNumber==='19205'));
});
test('source checkpoint must not silently accept shifted/missing/distorted registrations and masks',()=>{
  const source=JSON.parse(readFileSync(CFB_SENATE_SOURCE_VIEWER_CHECKPOINT_PATH,'utf8'));
  source.observedCandidateRegistrationIndex.segmentMembershipMaskHex='8'
    +source.observedCandidateRegistrationIndex.segmentMembershipMaskHex.slice(1);
  assert.throws(()=>deriveCfb2021to24SenateViewerCohort(source),
    /source checkpoint changed/);
  const source2=JSON.parse(readFileSync(CFB_SENATE_SOURCE_VIEWER_CHECKPOINT_PATH,'utf8'));
  source2.observedCandidateRegistrationIndex.registrationIdsCsv
    =source2.observedCandidateRegistrationIndex.registrationIdsCsv.replace('11829','11828');
  assert.throws(()=>deriveCfb2021to24SenateViewerCohort(source2),
    /source checkpoint changed/);
  const source3=JSON.parse(readFileSync(CFB_SENATE_SOURCE_VIEWER_CHECKPOINT_PATH,'utf8'));
  source3.provenance.runId=0;
  assert.throws(()=>deriveCfb2021to24SenateViewerCohort(source3),
    /source checkpoint changed/);
});
test('bounded official viewer reference counts split years, original version keys and amendments, not obligations',()=>{
  const c=cohort();
  const a=c.targets.find(x=>x.segmentEndYear===2022)!;
  const b=c.targets.find(x=>x.segmentEndYear===2024)!;
  const captured:CfbCandidateInventorySnapshot[]=[
    snap(a.registrationNumber,2022,[
      ref(a.registrationNumber,2021,'YE',0),
      ref(a.registrationNumber,2021,'YE',1),
      ref(a.registrationNumber,2022,'C',0),
    ]),
    snap(b.registrationNumber,2024,[
      ref(b.registrationNumber,2023,'YE',0),
      ref(b.registrationNumber,2024,'E',0),
    ]),
  ];
  const audited=auditCfb2021to24SenateViewerReferenceCounts([a,b],captured);
  assert.equal(audited.version,CFB_SENATE_2021_24_REPORT_REFERENCE_COUNT_VERSION);
  assert.deepEqual(audited.byYear.map(r=>r.reportYear),[2021,2022,2023,2024]);
  assert.deepEqual(audited.byYear.map(r=>r.sourceScopedCandidateRegistrations),[1,1,1,1]);
  assert.deepEqual(audited.byYear.map(r=>r.originalViewerVersionReferences),[1,1,1,1]);
  assert.deepEqual(audited.byYear.map(r=>r.amendedViewerVersionReferences),[1,0,0,0]);
  assert.deepEqual(audited.byYear.map(r=>r.observedDistinctViewerReportGroups),[1,1,1,1]);
  assert.equal(audited.totals.viewerReportVersionReferences,5);
  assert.equal(audited.totals.originalViewerVersionReferences,4);
  assert.equal(audited.totals.amendmentVersionReferences,1);
  for(const yr of audited.byYear){
    assert.equal(yr.originalPdfAuthenticatedInThisAudit,0);
    assert.equal(yr.legallyRequiredSenateCandidateReportCount,null);
    assert.equal(yr.statewideLegallyActiveSenateCommitteeCount,null);
    assert.equal(yr.actuallyFiledOriginalReportsIndependentlyConfirmed,null);
    assert.equal(yr.historicPublicByVerifiedCount,0);
  }
  assert.equal(audited.totals.historicCommitteeYearRequiredReportDenominator,null);
  assert.equal(audited.exclusions.zeroViewerReferencesIsNotProofOfZeroFilings,true);
  assert.equal(audited.safeguards.noProductionDatabaseReadOrWrite,true);
  assert.equal(audited.safeguards.issue864Open,true);
});
test('missing current source is an explicit failure, never a proven nonfiler',()=>{
  const a=cohort().targets[0]!;
  const audited=auditCfb2021to24SenateViewerReferenceCounts([a],[
    {status:'fetch_failed',registrationNumber:a.registrationNumber,
    segmentEndYear:a.segmentEndYear,sourceUrl:'https://register.cfb.mn.gov/',
    errorKind:'timeout_or_abort'},
  ]);
  assert.equal(audited.totals.sourceSegmentFailures,1);
  assert.deepEqual(audited.byYear.slice(0,2).map(x=>x.viewerSourceFailures),[1,1]);
  assert.ok(audited.results.slice(0,2).every(x=>x.status==='source_fetch_failed'));
  assert.equal(audited.totals.actuallyFiledOriginalReportsVerified,null);
});
test('successful official API tab without any reference is not a statutory absence or a missing report',()=>{
  const a=cohort().targets[0]!;
  const audited=auditCfb2021to24SenateViewerReferenceCounts([a],
    [snap(a.registrationNumber,a.segmentEndYear,[])]);
  assert.equal(audited.totals.sourceSegmentFailures,0);
  assert.deepEqual(audited.byYear.slice(0,2).map(x=>x.candidateRegistrationsWithoutYearSpecificReferences),[1,1]);
  assert.ok(audited.results.slice(0,2).every(x=>x.status==='no_matching_year_references'));
  assert.equal(audited.totals.actuallyFiledOriginalReportsVerified,null);
  assert.equal(audited.exclusions.committeesNeverObservedInDistrictViewerNotEnumerated,true);
});
test('duplicate viewer segment target raises instead of double counting',()=>{
  const a=cohort().targets[0]!;
  assert.throws(()=>auditCfb2021to24SenateViewerReferenceCounts([a,a],[]),
    /Duplicate official viewer target segment/);
});


test('four source-observed 2022 aoc public-subsidy affidavits are nonreport documents, not missing pcc report filings',()=>{
  const regs=new Set(['2442','2471','2491','2495']);
  const cohortTargets=cohort().targets.filter(t=>t.segmentEndYear===2022&&regs.has(t.registrationNumber));
  assert.equal(cohortTargets.length,4);
  const source=cohortTargets.map(t=>snap(t.registrationNumber,2022,[{
    ...ref(t.registrationNumber,2022,'C',0),type:'aoc',
    reportName:'2022 Affidavit of Contributions',
  }]));
  const audit=auditCfb2021to24SenateViewerReferenceCounts(cohortTargets,source);
  assert.equal(audit.ancillaryDocumentsInCandidateReportsTab.excludedFromPrincipalCommitteeReportVersionCounts,4);
  assert.deepEqual(audit.ancillaryDocumentsInCandidateReportsTab.exactAncillarySourceVersionIds,[
    '2442:22:aoc:C:0:0','2471:22:aoc:C:0:0',
    '2491:22:aoc:C:0:0','2495:22:aoc:C:0:0',
  ]);
  assert.equal(audit.ancillaryDocumentsInCandidateReportsTab.excludedDoesNotProveAnyFilingExemption,true);
  assert.equal(audit.totals.viewerReportVersionReferences,0);
  assert.equal(audit.totals.referenceIdentityMalformedFilerYears,0);
  assert.equal(audit.byYear[1]?.candidateRegistrationsWithoutYearSpecificReferences,4);
  assert.equal(audit.byYear[1]?.legallyRequiredSenateCandidateReportCount,null);
});

test('unrecognized candidate viewer non-pcc document type fails closed instead of becoming a principal report',()=>{
  const t=cohort().targets[0]!;
  const raw=snap(t.registrationNumber,2022,[{
    ...ref(t.registrationNumber,2022,'C',0),type:'unknown-other-document',
  }]);
  assert.throws(()=>auditCfb2021to24SenateViewerReferenceCounts([t],[raw]),
    /Unreviewed non-pcc source viewer document/);
});
