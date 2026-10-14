import { reconstructSenateSourceMotionSequence, type SenateSourceMotionLedger } from './minnesota-official-motion-sequence';

export const MN_HF100_ORIGINAL_JOURNAL_PROOF_VERSION = 'mn-hf100-apr28-original-journal-proof-v1' as const;

export interface HF100OriginalJournalProof {
  parserVersion: typeof MN_HF100_ORIGINAL_JOURNAL_PROOF_VERSION;
  originalSourceActionsVerified: 8;
  namedRollsVerified: 7;
  voiceOnlyDecisionsVerified: 1;
  recordedRollTallies: string[];
  adoptedAmendmentKeys: string[];
  finalLegislativeChoice: 'final_passage_as_amended';
  voteToDbParity: 'not_checked';
  historicalPublicBy: null;
}

function compactJournal(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Independently read an actual Senate journal PDF text extraction and test the
 * fixed, human-reviewed source-only ledger against *ordered* original motion
 * anchors, individual divisions, exact substantive page/line change cues,
 * and the official result wording. NEVER infer member votes for the voice
 * amendment or map source-only actions onto historical DB event keys.
 */
export function verifyHf100April28JournalText(
  rawText: string,
  ledger: SenateSourceMotionLedger,
): HF100OriginalJournalProof {
  const reconstruction = reconstructSenateSourceMotionSequence(ledger);
  const expectedKeys = [
    'hf100-apr28-port-voice-amend',
    'hf100-apr28-hauschild-retail-amend',
    'hf100-apr28-hauschild-tax-amend',
    'hf100-apr28-johnson-table-motion',
    'hf100-apr28-hauschild-recognition-funding-amend',
    'hf100-apr28-hoffman-funding-amend',
    'hf100-apr28-pratt-finance-referral',
    'hf100-apr28-final-passage-amended',
  ];
  if (ledger.source.url !== 'https://www.senate.mn/journals/2023-2024/20230428059.pdf'
    || ledger.sourceActions.length !== expectedKeys.length
    || reconstruction.rows.some((row, i) => row.sourceOnlyKey !== expectedKeys[i])) {
    throw new Error('Source-only HF100 original-journal proof identity mismatch');
  }
  const text = compactJournal(rawText);
  // Match explicit mover motions for THIS bill only, not nearby floor actions.
  const anchors = [...text.matchAll(
    /Senator\s+(Port|Hauschild|Johnson|Hoffman|Pratt)\s+moved\s+(?:to amend|that)\s+H\.F\.\s*No\.\s*100\b/gi,
  )].map((match) => ({ mover: match[1], start: match.index ?? -1 }));
  const moverSequence = ['Port', 'Hauschild', 'Hauschild', 'Johnson', 'Hauschild', 'Hoffman', 'Pratt'];
  if (anchors.length !== moverSequence.length
    || anchors.some((anchor, i) => anchor.mover !== moverSequence[i])) {
    throw new Error('Original HF100 floor mover/motion-anchor sequence does not match source ledger');
  }

  const passageMarker = 'The question was taken on the final passage of H.F. No. 100, as amended.';
  const passageStart = text.indexOf(passageMarker, anchors.at(-1)!.start);
  const finalOutcome = 'So the bill, as amended, was passed';
  const end = text.indexOf(finalOutcome, passageStart);
  if (passageStart <= anchors.at(-1)!.start || end <= passageStart) {
    throw new Error('Original as-amended final-passage question or outcome missing');
  }
  const starts = [...anchors.map((a) => a.start), passageStart];
  const ends = [...anchors.slice(1).map((a) => a.start), passageStart, end + finalOutcome.length];
  const segments = starts.map((start, i) => text.slice(start, ends[i]));

  const cues: Array<readonly string[]> = [
    ['first unofficial engrossment', 'Page 56', 'Page 71'],
    ['first unofficial engrossment', 'Page 37', 'Page 38', 'local government'],
    ['first unofficial engrossment', 'Page 155', 'Page 157', '20 percent'],
    ['laid on the table', 'question was taken'],
    ['first unofficial engrossment', 'Page 294', 'Page 295', '23,987,000'],
    ['first unofficial engrossment', 'Page 296', '5,500,000'],
    ['re-referred to the Committee on Finance', 'question was taken'],
    ['final passage', 'as amended'],
  ];
  for (const [i, part] of segments.entries()) {
    for (const cue of cues[i]) {
      if (!part.toLowerCase().includes(cue.toLowerCase())) {
        throw new Error('Original journal source policy/body cue missing from motion ' + (i + 1) + ': ' + cue);
      }
    }
    if (i === 2 && !/amendment\s+was\s+not\s+adopted/i.test(part)) {
      throw new Error('Rejected tax escalator incorrectly promoted');
    }
    if ([0, 1, 4, 5].includes(i) && !/amendment\s+was\s+adopted/i.test(part)) {
      throw new Error('Adopted journal floor amendment has no original source result');
    }
    if ([3, 6].includes(i) && !/motion\s+did\s+not\s+prevail/i.test(part)) {
      throw new Error('Procedural defeat missing from original source');
    }
  }

  const divisionPattern = /The roll was called,\s*and there were yeas\s+(\d+)\s+and nays\s+(\d+), as follows:/gi;
  const observed = segments.map((part) =>
    [...part.matchAll(divisionPattern)].map((m) => [Number(m[1]), Number(m[2])] as const));
  if (observed[0].length !== 0) throw new Error('Voice amendment wrongly assigned a member-resolved roll');
  const tallies: string[] = [];
  for (let i = 1; i < observed.length; i++) {
    const expected = ledger.sourceActions[i];
    if (observed[i].length !== 1
      || observed[i][0][0] !== expected.yeaCount
      || observed[i][0][1] !== expected.nayCount) {
      throw new Error('Original named roll tally mismatch at source ordinal ' + (i + 1));
    }
    tallies.push(observed[i][0][0] + '-' + observed[i][0][1]);
  }
  if (!segments[7].includes(finalOutcome) || tallies.length !== 7) {
    throw new Error('Original floor passage/source-roll coverage incomplete');
  }
  return {
    parserVersion: MN_HF100_ORIGINAL_JOURNAL_PROOF_VERSION,
    originalSourceActionsVerified: 8,
    namedRollsVerified: 7,
    voiceOnlyDecisionsVerified: 1,
    recordedRollTallies: tallies,
    adoptedAmendmentKeys: reconstruction.finalAdoptedAmendmentKeys,
    finalLegislativeChoice: 'final_passage_as_amended',
    voteToDbParity: 'not_checked',
    historicalPublicBy: null,
  };
}
