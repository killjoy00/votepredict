import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const SOURCE='docs/evaluation/source-proof/cfb-2021-25-board-yearend-all-entity-count-context.json';
const data=JSON.parse(readFileSync(SOURCE,'utf8'));
test('five public Board memo baselines are source-attached but never misclassified as Senate committee counts',()=>{
  assert.equal(data.schemaVersion,'cfb-2021-25-all-entity-campaign-finance-year-end-board-memo-count-context-v1');
  assert.deepEqual(data.yearEndReportCohorts.map((x:any)=>x.reportYear),[2021,2022,2023,2024,2025]);
  assert.equal(data.scopeIncludes.length,4);
  for(const item of data.yearEndReportCohorts){
    assert.match(item.source??item.deadlineSource,/^https:\/\/(?:register\.)?cfb\.mn\.gov\/pdf\//);
    assert.match(item.dueOn,/^\d{4}-\d\d-\d\d$/);
  }
  assert.equal(data.policy.doNotUseAllEntityCountsAsSenateDenominator,true);
  assert.equal(data.policy.doNotInferMissingExactCountsFromPercentage,true);
  assert.equal(data.notEstablished.statewideSenateCandidateCommitteesLegallyRegisteredByYear,null);
  assert.equal(data.notEstablished.statewideSenateCandidateRequiredReports2021to2025,null);
  assert.equal(data.notEstablished.statewideSenateCandidateActuallyFiledOriginalReports2021to2025,null);
  assert.equal(data.policy.issue864Open,true);
});
test('2021 means more than 1350 notices, NOT exactly 1350 obligated reports',()=>{
  const p=data.yearEndReportCohorts[0];
  assert.equal(p.noticesSentLowerExclusiveBound,1350);
  assert.equal(p.officialExactReportsDue,null);
  assert.equal(p.officialExactFiledByDeadline,null);
  assert.equal(p.isAnExactFilingDenominator,false);
});
test('2022 memo 1,515 owed / 1,367 timely mismatches its printed 98% claim; do not repair by guess',()=>{
  const p=data.yearEndReportCohorts[1];
  assert.equal(p.officialExactReportsDue,1515);
  assert.equal(p.officialExactFiledByDeadline,1367);
  assert.equal(p.boardTextPrintedPercent,98);
  assert.equal(Math.round(1000*p.officialExactFiledByDeadline/p.officialExactReportsDue)/10,90.2);
  assert.equal(p.ratioImpliedByCountsPercentRoundedOneDecimal,90.2);
  assert.equal(p.printedPercentInconsistentWithSourceCounts,true);
  assert.equal(p.potentialCorrectionAuthoritativelyConfirmed,false);
  assert.equal(data.policy.doNotReplaceBoard2022CountWithRatioDerivedEstimatedCount,true);
});
test('2023 1299 expected has no final confirmed obligation or timely filing count',()=>{
  const p=data.yearEndReportCohorts[2];
  assert.equal(p.officialReportsExpectedBeforeDeadline,1299);
  assert.equal(p.officialExactReportsDueAfterReconciliation,null);
  assert.equal(p.officialExactFiledByDeadline,null);
});
test('2024 all-entity report owed, timely and remaining-at-memo values are time-separated',()=>{
  const p=data.yearEndReportCohorts[3];
  assert.equal(p.officialExactReportsDue,1320);
  assert.equal(p.officialExactFiledByDeadline,1212);
  assert.equal(p.dueMinusTimelyFilings,108);
  assert.equal(p.officialStillOutstandingAtMemoDate,64);
  assert.equal(p.printedPercentInconsistentWithSourceCounts,false);
  assert.equal(p.stillOutstandingIsLaterSnapshotNotEqualToLateAtDeadline,true);
});
test('2025 reporting year-end due in 2026; narrated 93% no count base, not historically 2025 public',()=>{
  const p=data.yearEndReportCohorts[4];
  assert.equal(p.dueOn,'2026-02-02');
  assert.equal(p.boardNarrativePercentReceivedAtFebruary2026Meeting,93);
  assert.equal(p.boardNarrativeReportCountBase,null);
  assert.equal(p.officialExactReportsDue,null);
  assert.equal(p.officialExactFiledByDeadline,null);
  assert.equal(p.isAnExactFilingDenominator,false);
  assert.equal(data.notEstablished.historicDocumentPublicByTimeline,null);
});
