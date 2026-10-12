import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const from=(path:string):Record<string,any>=>JSON.parse(readFileSync(path,'utf8'));
const v2=from('docs/evaluation/source-proof/senate-864-v2-all-1452-original-pdf-neon-parity-receipt.json');
const roster=from('docs/evaluation/source-proof/senate-864-protected-roster-session-boundary-v1-receipt.json');
const v5=from('docs/evaluation/source-proof/senate-864-v5-protected-neon-seven-family-baseline.json');
const first=from('docs/evaluation/source-proof/senate-864-v1-protected-committee-source-db-parity-receipt.json');

test('V2 receipt is exactly attached to successful 1452-SHA protected ROLLBACK run and original source',()=>{
 assert.equal(v2.schemaVersion,'mn-864-verified-all-1452-original-pdfs-protected-neon-v2-receipt-v1');
 assert.equal(v2.issue,864);
 assert.equal(v2.receiptId,6117412541);
 assert.equal(v2.protectedRunId,38201074454);
 assert.equal(v2.mainCommit,'7fd5fe14e9819b5e5a084c67529b2d383211f4a1');
 assert.equal(v2.originalSourceCohort.firstSourceArtifactRun,38066441841);
 assert.equal(v2.originalSourceCohort.originalMetadataArtifacts,4);
 assert.equal(v2.originalSourceCohort.independentlyRecoveredOcrMetadataArtifacts,16);
 assert.equal(v2.originalSourceCohort.originalPdfsPreviouslyTooLowText,207);
 assert.deepEqual(v2.transaction,{
  repeatableRead:true,readOnly:true,explicitRollback:true,
  noDatabaseWrites:true,noPrivateRowsExported:true,
  authenticatedExistingNeonDefaultBranch:true,
  deployedProductionBranchIndependentlyProven:false,
 });
 const c=v2.counts;
 assert.equal(c.originalPdfUrls,1452);
 assert.equal(c.independentlyShaKnown,1452);
 assert.equal(c.oneToOneStoredSourceUrls,1452);
 assert.equal(c.matchingOriginalRawSha,1452);
 assert.equal(c.originalRawShaMismatches,0);
 assert.equal(c.missingStoredSourceUrls,0);
 assert.equal(c.duplicatePersistedSourceUrls,0);
 assert.equal(c.extraStoredOriginalDocuments,0);
 assert.equal(first.stored.sourceUrlsOneToOne,1452);
 assert.equal(first.stored.exactRawPdfShaMatches,1245);
 assert.equal(first.originalSourceScope.lowTextOriginalPdfHashNotComparedInThisRun,207);
 assert.equal(c.matchingOriginalRawSha-first.stored.exactRawPdfShaMatches,207);
 assert.equal(v2.byYear.length,4);
 assert.deepEqual(v2.byYear.map((x:{year:number})=>x.year),[2022,2023,2024,2025]);
 assert.deepEqual(v2.byYear.map((r:{originalPdfUrls:number})=>r.originalPdfUrls),[325,454,258,415]);
 assert.ok(v2.byYear.every((x:{originalPdfUrls:number,originalParsedRawShaMatches:number,originalParsedRawShaMismatches:number})=>
  x.originalPdfUrls===x.originalParsedRawShaMatches&&x.originalParsedRawShaMismatches===0));
 assert.equal(c.persistedCommitteeEvents,153);
 assert.equal(c.persistedCommitteeChoices,988);
});

test('one actual missing original 2024 named-choice token, NOT 10 missing member votes or missing 2025 event',()=>{
 const c=v2.counts;
 assert.equal(c.originalDetailedRolls,152);
 assert.equal(c.fullyMatchedDetailedRolls,151);
 assert.equal(c.originalDetailedNamedTokens,981);
 assert.equal(c.matchedDetailedNamedTokens,971);
 assert.equal(c.keyOnlyOriginalRolls,1);
 assert.equal(c.keyOnlyEventUrlHashDateMatches,1);
 assert.equal(c.keyOnlyChoiceCountMatches,1);
 assert.equal(c.keyOnlyChoiceTokensUnverified,8);
 assert.equal(c.allRecognizedRollsIncludingKeyOnly,153);
 assert.equal(c.allNamedTokensIncludingKeyOnly,989);
 assert.equal(c.namedMismatchRolls,1);
 assert.equal(c.namedMismatchSourceTokens,10);
 assert.equal(c.namedMismatchPersistedTokens,9);
 assert.equal(c.namedMismatchDigestIntersection,9);
 assert.equal(c.sourceTokensMissingFromStored,1);
 assert.equal(c.storedTokensNotInSource,0);
 assert.equal(v2.mismatchPdfCategories.original_named_choices_mismatch,1);
 // The older comparison did not have the recovered OCR source actions.
 assert.equal(first.stored.candidateRollsExactMatched,134);
 const y2024=v2.byYear.find((x:{year:number})=>x.year===2024);
 assert.equal(y2024.recognizedOriginalRollCalls,49);
 assert.equal(y2024.matchedRecognizedRollCalls,48);
 assert.equal(y2024.originalNamedChoiceTokens,228);
 assert.equal(y2024.storedCommitteeMemberChoices,227);
 const y2025=v2.byYear.find((x:{year:number})=>x.year===2025);
 assert.equal(y2025.recognizedOriginalRollCalls,32);
 assert.equal(y2025.storedCommitteeEvents,33);
 assert.equal(v2.mismatchPdfCategories.persisted_vote_event_not_matched_to_source,1);
 assert.equal(v2.limitations.sourceKeyOnlyRollNotNameOrTallyVerified,true);
 assert.equal(v2.limitations.single2024ChoiceTokenNotPersisted,true);
 assert.equal(v2.limitations.namedVoteRepairNotAuthorized,true);
});

test('independent V5 roster baseline has identical year/person/membership row counts to new protected roster comparison',()=>{
 assert.equal(roster.schemaVersion,'mn-864-verified-protected-senate-session-boundary-roster-v1');
 assert.equal(roster.issue,864);
 assert.equal(roster.receiptId,6117769199);
 assert.equal(roster.protectedRunId,38203733724);
 assert.equal(roster.mainCommit,'0283a8d2e3860055164f0d665578ba73e99437fd');
 assert.equal(roster.baselineRunId,38196817626);
 assert.equal(roster.baselineReceiptId,6116826026);
 assert.equal(v5.sourceReceiptId,6116826026);
 assert.deepEqual(roster.transaction,{
  repeatableRead:true,readOnly:true,explicitRollback:true,
  noDatabaseWrites:true,noPrivatePersonRowsExported:true,
  authenticatedExistingNeonDefaultBranch:true,
  deployedProductionBranchIndependentlyProven:false,
 });
 const rows=roster.byCalendarYear;
 assert.equal(rows.length,5);
 assert.deepEqual(rows.map((r:{year:number})=>r.year),[2021,2022,2023,2024,2025]);
 assert.deepEqual(rows.map((r:{sessionClampedPeople:number})=>r.sessionClampedPeople),[67,67,67,68,70]);
 assert.deepEqual(rows.map((r:{sessionClampedMembershipRows:number})=>r.sessionClampedMembershipRows),[67,67,67,68,70]);
 assert.deepEqual(rows.map((r:{outOfSessionMembershipRows:number})=>r.outOfSessionMembershipRows),[0,0,131,66,66]);
 const base=v5.groups.roster;
 for(const x of rows){
  const previous=base.find((r:{year:string})=>r.year===String(x.year));
  assert.ok(previous);
  assert.equal(x.v5People,Number(previous.people));
  assert.equal(x.snapshotPeople,Number(previous.people));
  assert.equal(x.v5MembershipRows,Number(previous.memberships));
  assert.equal(x.snapshotMembershipRows,Number(previous.memberships));
  assert.equal(x.extraRowsBeyondDistinctPeople,x.v5MembershipRows-x.v5People);
  assert.equal(x.sessionClampedMembershipRows+x.outOfSessionMembershipRows,x.v5MembershipRows);
 }
});

test('2023 V5 record inflation is exactly 66 former-session plus 65 future-session rows',()=>{
 const by=roster.byYearAndSession;
 assert.equal(by.length,9);
 const y=roster.byCalendarYear.find((r:{year:number})=>r.year===2023);
 assert.equal(y.v5MembershipRows,198);
 assert.equal(y.v5People,90);
 assert.equal(y.sessionClampedPeople,67);
 const earlier=by.find((r:{year:number,session:string})=>r.year===2023&&r.session==='2021-2022');
 const current=by.find((r:{year:number,session:string})=>r.year===2023&&r.session==='2023-2024');
 const later=by.find((r:{year:number,session:string})=>r.year===2023&&r.session==='2025-2026');
 assert.equal(earlier.rows_from_session_not_intersecting_calendar_year,66);
 assert.equal(earlier.session_clamped_active_membership_rows,0);
 assert.equal(current.session_clamped_active_membership_rows,67);
 assert.equal(later.rows_from_session_not_intersecting_calendar_year,65);
 assert.equal(later.session_clamped_active_membership_rows,0);
 assert.equal(earlier.v5_membership_rows+current.v5_membership_rows+later.v5_membership_rows,198);
 assert.equal(roster.limitations.calendarYearSessionClampNotOfficialActualServiceProof,true);
 assert.equal(roster.limitations.individualMemberServiceAndGov95RosterNotPersonReconciled,true);
 assert.equal(roster.limitations.storedMemberRowsNotChanged,true);
});

test('verified source parity and session-clamped rosters do not certify complete votes, deployed production or forecast eligibility',()=>{
 assert.equal(v2.limitations.originalPdfCohortNotAllOfficialMeetings,true);
 assert.equal(v2.limitations.meetingsWithoutOriginalMinutesPdfs,141);
 assert.equal(v2.limitations.parserCandidateRollsNotExhaustive,true);
 assert.equal(v2.limitations.year2021PrintSourceMissing,true);
 assert.equal(v2.limitations.year2022PrintElectronicEquivalenceUnproven,true);
 assert.equal(v2.limitations.noHistoricalAsOfEligibilityCertification,true);
 assert.equal(v2.limitations.parentIssueRemainsOpen,true);
 assert.equal(roster.limitations.historicalEligibilityNotCertified,true);
 assert.equal(roster.limitations.issue864Open,true);
 const doc1=readFileSync('docs/evaluation/senate-864-all-1452-original-pdf-ocr-neon-parity-v2.md','utf8');
 const doc2=readFileSync('docs/evaluation/senate-864-senator-roster-session-boundary-diagnostic.md','utf8');
 assert.match(doc1,/Verified V2 protected result/);
 assert.match(doc2,/Independently verified protected result/);
 assert.doesNotMatch(doc1,/V2 must remain \*\*UNVERIFIED\*\*/);
 assert.doesNotMatch(doc2,/new roster diagnostic pending reviewed PR CI/);
 assert.match(doc1,/keep #864 open/i);
 assert.match(doc2,/Parent #864 stays open/i);
});
