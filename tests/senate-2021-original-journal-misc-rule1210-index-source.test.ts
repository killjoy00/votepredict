import test from 'node:test';
import assert from 'node:assert/strict';
import {
 SENATE_2021_MISC_JOURNAL_PDF,SENATE_2021_RULE1210_INDEX_VERSION,
 find2021SenateJournalRule1210IndexReferences
} from '../src/evidence/senate-2021-original-journal-misc-rule1210-index-source.js';

const filler=('Official Senate Journal indexed publication and legislative proceedings. ').repeat(16);
function fixture(){
 return 'MISCELLANEOUS INDEX '+filler+
 'Rule #12.10 – Committee report of vote references '+
 ' S.F.0002................................268 '+
 ' S.F.0566............................417 '+
 ' S.F.1457............................764 '+
 ' S.F.1470............................666 '+
 ' Rule #14.1 – President, quorum establishment '+
 ' January 11, 2021....................75 '+filler;
}
test('2021 Senate Journal original miscellaneous INDEX probe is not official print committee minutes',()=>{
 assert.equal(SENATE_2021_MISC_JOURNAL_PDF,
  'https://www.senate.mn/journals/2021-2022/2021misc.pdf');
 assert.equal(SENATE_2021_RULE1210_INDEX_VERSION,
  'senate-2021-official-misc-journal-rule1210-publication-reference-discovery-v1');
});
test('find ONLY source-bounded Rule12.10 bill-page references before Rule14.1',()=>{
 const r=find2021SenateJournalRule1210IndexReferences(fixture());
 assert.equal(r.foundUniqueBoundedRule12BeforeRule14Section,true);
 assert.equal(r.sourceSpecificRuleHeadingCount,1);
 assert.equal(r.candidateReferencePairsFound,4);
 assert.deepEqual(r.candidateIndexedRule1210BillPageReferences,[
  {bill:'SF2',journalPrintedPage:268},
  {bill:'SF566',journalPrintedPage:417},
  {bill:'SF1457',journalPrintedPage:764},
  {bill:'SF1470',journalPrintedPage:666}
 ]);
 assert.deepEqual(r.candidateIndexedUniqueSFNumbers,['SF1457','SF1470','SF2','SF566']);
 assert.match(r.indexSectionSHA256,/^[a-f0-9]{64}$/);
 assert.equal(r.potentialIndexExtractionMissesPossible,true);
 assert.equal(r.notVerifiedFull2021JournalRule1210Census,true);
 assert.equal(r.rule1210IndexNotAllSenateCommitteeVotes,true);
 assert.equal(r.rule1210IndexReferencesNotNamedRollSourceObservations,true);
 assert.equal(r.noCommitteeMemberVoteSideAssignments,true);
 assert.equal(r.noFloorVotesOrStatewideCoverageInferred,true);
 assert.equal(r.not2021OfficialPrintedLRLCommitteeMinuteVolume,true);
 assert.equal(r.issue864MustRemainOpen,true);
});
test('reject year-index contamination, wrong rules and accidental floor votes',()=>{
 assert.throws(()=>find2021SenateJournalRule1210IndexReferences(fixture().replace(
  'MISCELLANEOUS INDEX','SENATE FLOOR VOTE ROLL INDEX')),/MISCELLANEOUS INDEX/);
 assert.throws(()=>find2021SenateJournalRule1210IndexReferences(fixture().replace(
  'Rule #12.10','Rule #40.7')),/not uniquely present/);
 assert.throws(()=>find2021SenateJournalRule1210IndexReferences(fixture().replace(
  'Rule #14.1','Rule #12.10')),/not uniquely present/);
 assert.throws(()=>find2021SenateJournalRule1210IndexReferences(fixture().replace(
  'Rule #14.1','Rule #20.1')),/not bounded/);
});
test('reject duplicate or inadequate indexed bill-page reference pairs',()=>{
 assert.throws(()=>find2021SenateJournalRule1210IndexReferences(fixture().replace(
  'S.F.1457............................764','S.F.0002............................268')),
  /missing\/duplicated/);
 assert.throws(()=>find2021SenateJournalRule1210IndexReferences(fixture().replace(
  'S.F.1457............................764','Senate floor roll appendix')),
  /missing\/duplicated|Rule12.10/);
 assert.throws(()=>find2021SenateJournalRule1210IndexReferences(fixture().replace(
  'S.F.1470............................666','Senate floor roll appendix').replace(
  'S.F.1457............................764','Senate floor roll appendix')),
  /missing\/duplicated/);
});
test('index sources contain bill-page leads ONLY, never day-specific 2021 member votes',()=>{
 const x=find2021SenateJournalRule1210IndexReferences(fixture());
 assert.equal(x.rule1210IndexReferencesNotNamedRollSourceObservations,true);
 assert.equal(x.noPrivateProductionDatabaseReadsWrites,true);
 assert.equal(x.notVerifiedFull2021JournalRule1210Census,true);
});
