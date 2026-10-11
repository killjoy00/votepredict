/** Issue #864: the Board's statewide report population is not Senate legal-filing duty. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectCfbBoardContemporaryYearEndMemo,
  BOARD_YE_OPERATIONS_ORIGINAL_SOURCES,
} from '../src/evidence/cfb-2023-24-board-contemporaneous-yearend-filing-counts.js';
const intro='State of Minnesota\nDate: January 31, 2024\nExecutive Director’s Report – Board Operations\nYear-end Reports\n';
const y23=intro+'Campaign Finance Program. The year-end report of receipts and expenditures for 2023 is due on January 31, 2024. Reports are expected from 1,299 candidate committees, political party units, and political committees and funds. This is the first reporting period where CFRO is being used to file reports.';
const y24=intro+'Campaign Finance Program. The year-end report of receipts and expenditures for 2024 was due on January 31, 2025. Of the 1,320 reports due from candidate committees, political party units, and political committees and funds, 1,212 (92%) were filed by the deadline. As of the date of this memo there are 64 reports still outstanding.';
test('2023 report count 1299 is January 2024 Board expectation for all political filers, not observed Senate numerator',()=>{
 const x=inspectCfbBoardContemporaryYearEndMemo(2023,y23);
 assert.equal(x.combinedProgramReportsExpectedOrDue,1299);
 assert.equal(x.reportCountType,'reports_expected_at_deadline');
 assert.equal(x.combinedProgramReportsFiledByDeadline,null);
 assert.equal(x.combinedProgramReportsStillOutstandingAtMemoDate,null);
 assert.equal(x.memoDate,'2024-01-31');
 assert.equal(x.yearEndDueOn,'2024-01-31');
 assert.equal(x.Senate22YearEndLegalOwedDenominator,null);
 assert.equal(x.actualReportsPubliclyPostedByVersion,null);
 assert.equal(x.anyOneSenateCommitteeRequiredToFile,null);
});
test('2024 report count 1320 due with 1212 filed and 64 outstanding as-of Feb 5 2025 is cross-category',()=>{
 const x=inspectCfbBoardContemporaryYearEndMemo(2024,y24);
 assert.equal(x.combinedProgramReportsExpectedOrDue,1320);
 assert.equal(x.reportCountType,'reports_due');
 assert.equal(x.combinedProgramReportsFiledByDeadline,1212);
 assert.equal(x.combinedProgramReportsStillOutstandingAtMemoDate,64);
 assert.equal(x.memoDate,'2025-02-05');
 assert.equal(x.yearEndDueOn,'2025-01-31');
 assert.equal(x.historicBoardPerVersionPublicByNotVerified,true);
 assert.equal(x.Senate22YearEndLegalOwedDenominator,null);
 assert.equal(x.anyOneSenateCommitteeRequiredToFile,null);
});
test('current Board pages, count misprints, missing candidate/party categories and unknown years are rejected',()=>{
 assert.throws(()=>inspectCfbBoardContemporaryYearEndMemo(2023,
    y23.replace('1,299','1,300')),/expected\/due count/);
 assert.throws(()=>inspectCfbBoardContemporaryYearEndMemo(2024,
    y24.replace('1,212','1,213')),/expected\/due count/);
 assert.throws(()=>inspectCfbBoardContemporaryYearEndMemo(2024,
    y24.replace('64 reports','65 reports')),/expected\/due count/);
 assert.throws(()=>inspectCfbBoardContemporaryYearEndMemo(2023,
    y23.replace('political party units','other')),/cross-filer aggregate scope/);
 assert.throws(()=>inspectCfbBoardContemporaryYearEndMemo(2023,
    'Modern candidate viewer tab without Board memo'),/Board Operations annual memo/);
 assert.throws(()=>inspectCfbBoardContemporaryYearEndMemo(2025 as 2023,y23),
    /Only contemporaneous/);
 assert.equal(BOARD_YE_OPERATIONS_ORIGINAL_SOURCES.report2023.sourceUrl,
  'https://cfb.mn.gov/pdf/bdinfo/agendas/2024_02_07_materials.pdf');
 assert.equal(BOARD_YE_OPERATIONS_ORIGINAL_SOURCES.report2024.sourceUrl,
  'https://cfb.mn.gov/pdf/bdinfo/agendas/2025_02_13_materials.pdf');
});
