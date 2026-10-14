import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyHf100April28JournalText } from '../src/evidence/minnesota-hf100-original-source-verifier.js';
import type { SenateSourceMotionLedger } from '../src/evidence/minnesota-official-motion-sequence.js';

function ledger(): SenateSourceMotionLedger {
  return JSON.parse(readFileSync(
    new URL('../data/evaluation/senate-2023-hf100-apr28-official-motion-sequence-v1.json', import.meta.url), 'utf8',
  )) as SenateSourceMotionLedger;
}

const records = [
  'Senator Port moved to amend H.F. No. 100, the first unofficial engrossment, as follows: Page 56, before line 7 insert words. Page 71, revise. The motion prevailed. So the amendment was adopted.',
  'Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows: Page 37, revise local government permission. Page 38, license caps. The question was taken on the adoption of the amendment. The roll was called, and there were yeas 38 and nays 28, as follows: affirmative roster, negative roster. The motion prevailed. So the amendment was adopted.',
  'Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows: Page 155, proposed 20 percent. Page 157, adjust. The question was taken on the adoption of the amendment. The roll was called, and there were yeas 27 and nays 37, as follows: affirmative roster, negative roster. The motion did not prevail. So the amendment was not adopted.',
  'Senator Johnson moved that H.F. No. 100 be laid on the table. The question was taken on adoption of the motion. The roll was called, and there were yeas 33 and nays 34, as follows: affirmative roster, negative roster. The motion did not prevail.',
  'Senator Hauschild moved to amend H.F. No. 100, the first unofficial engrossment, as follows: Page 294, insert 23,987,000. Page 295, funding. The question was taken on adoption of the amendment. The roll was called, and there were yeas 35 and nays 30, as follows: affirmative roster, negative roster. The motion prevailed. So the amendment was adopted.',
  'Senator Hoffman moved to amend H.F. No. 100, the first unofficial engrossment, as follows: Page 296, insert 5,500,000. The question was taken on adoption of the amendment. The roll was called, and there were yeas 65 and nays 1, as follows: affirmative roster, negative roster. The motion prevailed. So the amendment was adopted.',
  'Senator Pratt moved that H.F. No. 100 be re-referred to the Committee on Finance. The question was taken on adoption of the motion. The roll was called, and there were yeas 33 and nays 34, as follows: affirmative roster, negative roster. The motion did not prevail.',
  'The question was taken on the final passage of H.F. No. 100, as amended. The roll was called, and there were yeas 34 and nays 33, as follows: affirmative roster, negative roster. So the bill, as amended, was passed and its title was agreed to.',
];

test('independent source checker verifies all eight distinct ordered motions and before-vote policy cues', () => {
  const result = verifyHf100April28JournalText(records.join('\n'), ledger());
  assert.deepEqual(
    [result.originalSourceActionsVerified, result.namedRollsVerified, result.voiceOnlyDecisionsVerified],
    [8, 7, 1],
  );
  assert.deepEqual(result.recordedRollTallies, ['38-28', '27-37', '33-34', '35-30', '65-1', '33-34', '34-33']);
  assert.equal(result.adoptedAmendmentKeys.length, 4);
  assert.equal(result.adoptedAmendmentKeys.includes('hf100-apr28-hauschild-tax-amend'), false);
  assert.equal(result.voteToDbParity, 'not_checked');
  assert.equal(result.historicalPublicBy, null);
});

test('a reordered or substituted floor amendment cannot impersonate a source-authenticated action', () => {
  const altered = [...records];
  [altered[1], altered[2]] = [altered[2], altered[1]];
  assert.throws(() => verifyHf100April28JournalText(altered.join(' '), ledger()), /policy\/body cue|tally mismatch/);
});

test('no synthetic voice vote or missing rejection may be counted as verified', () => {
  const rollForVoice = [...records];
  rollForVoice[0] += ' The roll was called, and there were yeas 67 and nays 0, as follows:';
  assert.throws(() => verifyHf100April28JournalText(rollForVoice.join(' '), ledger()), /Voice amendment/);
  const wrongRejection = [...records];
  wrongRejection[2] = wrongRejection[2].replace('did not prevail. So the amendment was not adopted', 'prevailed. So the amendment was adopted');
  assert.throws(() => verifyHf100April28JournalText(wrongRejection.join(' '), ledger()), /Rejected tax escalator/);
});

test('wrong dates, altered tallies, missing policy content and missing final passage fail closed', () => {
  const wrongDate = ledger();
  wrongDate.source.url = 'https://www.senate.mn/journals/2023-2024/20230427058.pdf';
  assert.throws(() => verifyHf100April28JournalText(records.join(' '), wrongDate), /Untrusted/);
  const wrongTally = [...records];
  wrongTally[5] = wrongTally[5].replace('yeas 65 and nays 1', 'yeas 66 and nays 0');
  assert.throws(() => verifyHf100April28JournalText(wrongTally.join(' '), ledger()), /tally mismatch/);
  const missingText = [...records];
  missingText[1] = missingText[1].replace('local government', 'someone else');
  assert.throws(() => verifyHf100April28JournalText(missingText.join(' '), ledger()), /policy\/body cue/);
  const noFinal = [...records];
  noFinal[7] = 'No final vote retained.';
  assert.throws(() => verifyHf100April28JournalText(noFinal.join(' '), ledger()), /final-passage/);
});
