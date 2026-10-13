import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MN_SENATE_SOURCE_MOTION_SEQUENCE_VERSION,
  reconstructSenateSourceMotionSequence,
  type SenateSourceMotionLedger,
} from '../src/evidence/minnesota-official-motion-sequence.js';

const path = new URL('../data/evaluation/senate-2023-hf100-apr28-official-motion-sequence-v1.json', import.meta.url);

function fixture(): SenateSourceMotionLedger {
  return JSON.parse(readFileSync(path, 'utf8')) as SenateSourceMotionLedger;
}

test('source-only HF100 original Journal reconstructs eight distinct actions, seven named divisions and one voice/result-only adoption', () => {
  const input = fixture();
  const result = reconstructSenateSourceMotionSequence(input);
  assert.equal(result.schemaVersion, MN_SENATE_SOURCE_MOTION_SEQUENCE_VERSION);
  assert.deepEqual(
    [result.sourceActionCount, result.namedRollSourceActionCount, result.voiceOrResultOnlyActionCount,
      result.amendmentAdoptedCount, result.amendmentRejectedCount],
    [8, 7, 1, 4, 1],
  );
  assert.deepEqual(
    result.rows.map((r) => [r.motionKind, r.rollCallResult]),
    [
      ['amendment_adoption', null], ['amendment_adoption', '38-28'],
      ['amendment_adoption', '27-37'], ['lay_on_table', '33-34'],
      ['amendment_adoption', '35-30'], ['amendment_adoption', '65-1'],
      ['re_refer_to_committee', '33-34'], ['final_passage_as_amended', '34-33'],
    ],
  );
  assert.equal(input.source.rawPdfSha256, null); // Not fabricated from a page-view.
  assert.equal(input.source.historicalPublicBy, null);
  assert.equal(input.source.storedRowIdentityVerified, false);
});

test('before-each-vote amendment state includes ONLY previously adopted texts; rejected tax escalation never joins final passage', () => {
  const result = reconstructSenateSourceMotionSequence(fixture());
  const keys = [
    'hf100-apr28-port-voice-amend',
    'hf100-apr28-hauschild-retail-amend',
    'hf100-apr28-hauschild-recognition-funding-amend',
    'hf100-apr28-hoffman-funding-amend',
  ];
  assert.deepEqual(result.rows[0].activeAdoptedAmendmentsBefore, []);
  assert.deepEqual(result.rows[1].activeAdoptedAmendmentsBefore, [keys[0]]);
  assert.equal(result.rows[2].rejectedAmendment, true);
  assert.deepEqual(result.rows[3].activeAdoptedAmendmentsBefore, keys.slice(0, 2));
  assert.deepEqual(result.rows[4].activeAdoptedAmendmentsBefore, keys.slice(0, 2));
  assert.deepEqual(result.rows[6].activeAdoptedAmendmentsBefore, keys);
  assert.deepEqual(result.rows[7].activeAdoptedAmendmentsBefore, keys);
  assert.deepEqual(result.finalAdoptedAmendmentKeys, keys);
  assert.equal(result.finalAdoptedAmendmentKeys.includes('hf100-apr28-hauschild-tax-amend'), false);
  assert.equal(result.rows[7].yesVoteMeans, 'pass_bill_as_amended');
  assert.ok(result.rows.every((r) => r.provisionSupportInferred === false && r.completeBillTextHash === null
    && r.independentlyVerifiedPreVotePublicBy === null && r.storedEventIdentityEstablished === false));
});

test('tabling and re-referral YEA have their own motion semantics even when original tallies match', () => {
  const rows = reconstructSenateSourceMotionSequence(fixture()).rows;
  assert.equal(rows[3].rollCallResult, '33-34');
  assert.equal(rows[6].rollCallResult, '33-34');
  assert.notEqual(rows[3].sourceOnlyKey, rows[6].sourceOnlyKey);
  assert.equal(rows[3].yesVoteMeans, 'lay_bill_on_table');
  assert.equal(rows[6].yesVoteMeans, 'send_bill_to_committee');
  assert.equal(rows[0].namedRollRecorded, false);
  assert.equal(rows[0].rollCallResult, null);
});

test('original journal sequence refuses fabricated named voice votes, disposition flips and unverified amendment bodies', () => {
  const altered = fixture();
  altered.sourceActions[0].yeaCount = 67;
  assert.throws(() => reconstructSenateSourceMotionSequence(altered), /Voice\/result-only/);
  const flip = fixture();
  flip.sourceActions[2].textDisposition = 'adopted';
  assert.throws(() => reconstructSenateSourceMotionSequence(flip), /contradictory/);
  const notText = fixture();
  notText.sourceActions[1].journalContainsProposedAmendmentText = false;
  assert.throws(() => reconstructSenateSourceMotionSequence(notText), /Unverified amendment/);
  const wrongBase = fixture();
  wrongBase.sourceActions[4].firstUnofficialEngrossmentExplicit = false;
  assert.throws(() => reconstructSenateSourceMotionSequence(wrongBase), /Unverified amendment/);
});

test('original journal identity and ordered event anchors must not be inferred from URL, count similarity or positional dedup', () => {
  const duplicate = fixture();
  duplicate.sourceActions[6].sourceOnlyKey = duplicate.sourceActions[3].sourceOnlyKey;
  assert.throws(() => reconstructSenateSourceMotionSequence(duplicate), /Duplicate, unordered/);
  const disorder = fixture();
  disorder.sourceActions[6].journalPage = 6883;
  assert.throws(() => reconstructSenateSourceMotionSequence(disorder), /Duplicate, unordered/);
  const orphan = fixture();
  orphan.sourceActions[3].sourceOrdinal = 3;
  assert.throws(() => reconstructSenateSourceMotionSequence(orphan), /Duplicate, unordered/);
  const differentYear = fixture();
  differentYear.source.url = 'https://www.senate.mn/journals/2023-2024/20230429059.pdf';
  assert.throws(() => reconstructSenateSourceMotionSequence(differentYear), /Untrusted/);
  const hostile = fixture();
  hostile.source.url = 'https://evil.example/journals/2023-2024/20230428059.pdf';
  assert.throws(() => reconstructSenateSourceMotionSequence(hostile), /Untrusted/);
  const pretendPublished = fixture();
  pretendPublished.source.historicalPublicBy = '2023-04-28T00:00:00Z';
  assert.throws(() => reconstructSenateSourceMotionSequence(pretendPublished), /Untrusted/);
  const pretendDbReconciled = fixture();
  pretendDbReconciled.source.storedRowIdentityVerified = true;
  assert.throws(() => reconstructSenateSourceMotionSequence(pretendDbReconciled), /Untrusted/);
});

test('the original named policy changes stay distinct from passage and rejected amendments', () => {
  const input = fixture();
  assert.match(input.sourceActions[1].policySummary, /local cannabis retailer/i);
  assert.match(input.sourceActions[2].policySummary, /20 percent/i);
  assert.match(input.sourceActions[4].policySummary, /Drug-recognition/i);
  assert.match(input.sourceActions[5].policySummary, /\$5,500,000/i);
  assert.equal(input.sourceActions[3].textDisposition, 'not_applicable');
  assert.equal(input.sourceActions[6].textDisposition, 'not_applicable');
  assert.equal(input.sourceActions[7].textDisposition, 'not_applicable');
  assert.deepEqual(input.sourceActions.filter((x) => x.namedRollRecorded).map((x) => x.yeaCount), [38, 27, 33, 35, 65, 33, 34]);
});
