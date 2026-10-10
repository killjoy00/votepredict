import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport,
  type OriginalSenateCommitteeYearAudit,
  type PersistedSenateCommitteeSourceExport,
} from '../src/evidence/senate-committee-source-to-db-reconciliation.js';

const officialUrl = 'https://www.lrl.mn.gov/archive/minutes/senate/2023/fin/20230308/Fin_20230308_Minutes.pdf';
const pdfSha = 'a'.repeat(64);
const sourceKey = 'senate-committee:' + createHash('sha256').update(officialUrl).digest('hex').slice(0, 16) + ':0';
const originalChoiceHashes = [
  createHash('sha256').update('yea:Johnson').digest('hex'),
  createHash('sha256').update('nay:Murphy').digest('hex'),
].sort();

function original(): OriginalSenateCommitteeYearAudit {
  return {
    auditedYear: 2023,
    independentlyDiscoveredOriginalMinutesPdfLinks: 1,
    originalPdfsFetchedAndParsed: 1,
    originalPdfsFailedOrUnparsed: 0,
    unresolvedOriginalDocuments: [],
    documentProofs: [{
      document: {
        year: 2023, committeeName: 'Finance', meetingDate: '2023-03-08',
        sourceUrl: officialUrl, originalRawPdfSha256: pdfSha,
      },
      voteObservations: [{
        externalKey: sourceKey, yeaCount: 1, nayCount: 1,
        individualVotesAvailable: true, namedMemberChoicesInPdf: 2,
        choiceIdentitySha256: originalChoiceHashes,
      },{
        externalKey: sourceKey.slice(0,-1) + '1', yeaCount: 4, nayCount: 2,
        individualVotesAvailable: false, namedMemberChoicesInPdf: 0,
        choiceIdentitySha256: [],
      }],
      contextOnlyActions: [{
        sourceObservationKey: officialUrl + '|action:voice_vote|abcd1234',
        actionKind: 'voice_vote', individualVotesAvailable: false,
      }],
    }],
  };
}
function db(): PersistedSenateCommitteeSourceExport {
  return {
    sourceDocumentId: '01111111-1111-4111-8111-111111111111',
    sourceUrl: officialUrl, sourceSha256: pdfSha,
    metadataMeetingDate: '2023-03-08',
    metadataCommitteeName: 'Finance',
    voteEvents: [{
      eventId: '02222222-2222-4222-8222-222222222222',
      externalKey: sourceKey, occurredOn: '2023-03-08',
      yeaCount: 1, nayCount: 1,
      memberVotes: [
        { normalizedName: 'Johnson', choice: 'yea', membershipId: '3333' },
        { normalizedName: 'Murphy', choice: 'nay', membershipId: '4444' },
      ],
    },{
      eventId: '05555555-5555-4555-8555-555555555555',
      externalKey: sourceKey.slice(0,-1) + '1', occurredOn: '2023-03-08',
      yeaCount: 4, nayCount: 2, memberVotes: [],
    }],
    contextActions: [{
      evidenceId: '06666666-6666-4666-8666-666666666666',
      ingestionIdentityKey: officialUrl + '|action:voice_vote|abcd1234',
      subtype: 'voice_vote', evidenceKind: 'context',
      meetingDate: '2023-03-08', membershipId: null,
      sourceVerified: 'true',
    }],
  };
}

test('original PDF named member choice hashes, tally, count-only, context action and date match offline export exactly', () => {
  const result = reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport([original()], [db()]);
  assert.equal(result.sourceOriginalPdfsAvailable, 1);
  assert.equal(result.privateExportSourcesProvided, 1);
  assert.deepEqual(result.sourceAuditYearsSupplied, [2023]);
  assert.equal(result.summary.documentsWithAnyMismatch, 0);
  assert.equal(result.summary.sourceCandidateRollCalls, 2);
  assert.equal(result.summary.exactSourceToDatabaseMatchedRollCalls, 2);
  assert.equal(result.summary.sourceCandidateContextActions, 1);
  assert.equal(result.summary.exactSourceToDatabaseMatchedContextActions, 1);
  assert.equal(result.originalPdfToDatabaseRows[0]?.issues.length, 0);
  assert.equal(result.byYearCommittee[0]?.committeeName, 'Finance');
  assert.equal(result.noCompletionCertificate, true);
  assert.equal(result.all2021To2025OfficialVoteDenominator, null);
  assert.equal(result.year2021OfficialPrintMinutesUnreconciled, true);
  assert.equal(result.noLiveDatabaseAccessOrMutation, true);
  assert.ok(!JSON.stringify(result).includes('Johnson'));
  assert.ok(!JSON.stringify(result).includes('Murphy'));
});

test('no private source export is NOT silently reported as complete or as zero committee votes', () => {
  const result = reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport([original()], []);
  assert.equal(result.summary.sourceDocumentMismatchCount, 1);
  assert.equal(result.summary.exactSourceToDatabaseMatchedRollCalls, 0);
  assert.ok(result.originalPdfToDatabaseRows[0]?.issues.includes('original_source_not_in_export'));
  assert.equal(result.all2021To2025OfficialVoteDenominator, null);
  assert.equal(result.noCompletionCertificate, true);
});

test('the same original Minutes URL with a changed official PDF hash cannot be equated to an older persisted copy', () => {
  const prior = { ...db(), sourceSha256: 'b'.repeat(64) };
  const result = reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport([original()], [prior]);
  assert.ok(result.originalPdfToDatabaseRows[0]?.issues.includes('original_pdf_hash_mismatch'));
  assert.equal(result.summary.exactSourceToDatabaseMatchedRollCalls, 0);
});

test('a duplicated source, unexpected event, missing event, action and mismatched tally are all auditable separately', () => {
  const duplicated = reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport([original()], [db(), db()]);
  assert.ok(duplicated.originalPdfToDatabaseRows[0]?.issues.includes('duplicate_persisted_source'));
  const altered = db();
  altered.voteEvents[0]!.yeaCount = 10;
  altered.voteEvents[1]!.externalKey = 'unexpected-event-key';
  altered.contextActions[0]!.ingestionIdentityKey = 'missing-original-action-key';
  const audit = reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport([original()], [altered]);
  assert.ok(audit.originalPdfToDatabaseRows[0]?.issues.includes('persisted_roll_call_tally_mismatch'));
  assert.ok(audit.originalPdfToDatabaseRows[0]?.issues.includes('missing_original_roll_call_event'));
  assert.ok(audit.originalPdfToDatabaseRows[0]?.issues.includes('persisted_vote_event_not_matched_to_source'));
  assert.ok(audit.originalPdfToDatabaseRows[0]?.issues.includes('missing_original_context_action'));
  assert.ok(audit.originalPdfToDatabaseRows[0]?.issues.includes('persisted_context_action_not_matched_to_source'));
});

test('mismatched named identities and missing membership resolution remain a gap even with correct yea/nay tally', () => {
  const altered = db();
  altered.voteEvents[0]!.memberVotes[0]!.choice = 'nay';
  altered.voteEvents[0]!.memberVotes[1]!.membershipId = null;
  const result = reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport([original()], [altered]);
  const issues = result.originalPdfToDatabaseRows[0]!.issues;
  assert.ok(issues.includes('original_named_choices_mismatch'));
  assert.ok(issues.includes('unresolved_persisted_member_identity'));
  assert.equal(result.summary.exactSourceToDatabaseMatchedRollCalls, 1);
});

test('the count-only rollcall may NEVER have synthetic individual members, nor voice motions become named votes', () => {
  const altered = db();
  altered.voteEvents[1]!.memberVotes.push({
    normalizedName: 'Someone', choice: 'yea', membershipId: 'fake',
  });
  altered.contextActions[0]!.membershipId = 'fake';
  const result = reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport([original()], [altered]);
  const issues = result.originalPdfToDatabaseRows[0]!.issues;
  assert.ok(issues.includes('unexpected_individual_choices_on_count_only'));
  assert.ok(issues.includes('context_action_semantics_mismatch'));
  assert.equal(result.summary.exactSourceToDatabaseMatchedRollCalls, 1);
  assert.equal(result.summary.exactSourceToDatabaseMatchedContextActions, 0);
});

test('original PDF source failure and 2021 print gap cannot produce a complete source-to-database certificate', () => {
  const failed = original();
  failed.originalPdfsFailedOrUnparsed++;
  failed.independentlyDiscoveredOriginalMinutesPdfLinks++;
  failed.unresolvedOriginalDocuments.push({
    sourceUrl: 'https://www.lrl.mn.gov/archive/minutes/senate/2023/fin/20230309/Fin_20230309_Minutes.pdf',
    meetingDate: '2023-03-09',
  });
  const result = reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport([failed], [db()]);
  assert.equal(result.sourceOriginalPdfsUnavailable, 1);
  assert.equal(result.sourceOriginalPdfsAvailable, 1);
  assert.equal(result.year2021OfficialPrintMinutesUnreconciled, true);
  const invalid = original(); invalid.documentProofs[0]!.document.year = 2021;
  assert.throws(() => reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport([invalid], []), /invalid year/);
});

test('duplicate original PDF source proofs and inconsistent year links fail closed', () => {
  const duplicate = original();
  duplicate.originalPdfsFetchedAndParsed = 2;
  duplicate.independentlyDiscoveredOriginalMinutesPdfLinks = 2;
  duplicate.documentProofs.push(duplicate.documentProofs[0]!);
  assert.throws(() => reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport([duplicate], []), /Duplicate official source URL/);
  const wrongCount = original(); wrongCount.originalPdfsFetchedAndParsed = 3;
  assert.throws(() => reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport([wrongCount], []), /internally inconsistent/);
  const y2021 = original(); y2021.auditedYear = 2021;
  assert.throws(() => reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport([y2021], []), /Unrecognized/);
});
