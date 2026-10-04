import test from 'node:test';
import assert from 'node:assert/strict';
import { extractExplicitBillStatementsV3, QUICK_EVIDENCE_STATEMENT_EXTRACTOR_V3_VERSION } from '../src/evidence/bill-statement-extractor-v3';

const bills = [
  { id: '11111111-1111-1111-1111-111111111111', identifier: 'HF1234' },
  { id: '22222222-2222-2222-2222-222222222222', identifier: 'SF55' },
];

function input(memberName: string, text: string) {
  return {
    membershipId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    memberName,
    text,
    fetchedAt: '2026-09-19T12:00:00.000Z',
    bills,
    sourceSubtype: 'member_primary_article' as const,
  };
}

test('v3 preserves tight first-person whole-bill support', () => {
  const rows = extractExplicitBillStatementsV3(input(
    'Mary Franson',
    'Legislative update. I strongly support HF 1234 because it addresses this issue for our district.',
  ));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'supports');
  assert.equal(rows[0].extractionVersion, QUICK_EVIDENCE_STATEMENT_EXTRACTOR_V3_VERSION);
  assert.equal(rows[0].metadata?.quickEvidenceCandidate, false);
  assert.equal(rows[0].metadata?.evaluationOnly, true);
});

test('v3 preserves tight named-member opposition', () => {
  const rows = extractExplicitBillStatementsV3(input(
    'Alice Mann',
    'Senator Alice Mann opposes SF55 and will vote against SF 55 if it reaches the floor.',
  ));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'opposes');
});

test('v3 preserves named-member vote-to-pass language', () => {
  const rows = extractExplicitBillStatementsV3(input(
    'Doron Clark',
    'Senator Doron Clark voted to pass Senate File 55 after debate on the measure.',
  ));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'supports');
});

test('v3 preserves explicit negated support as opposition', () => {
  const rows = extractExplicitBillStatementsV3(input(
    'Alice Mann',
    'Senator Alice Mann cannot support Senate File 55 in its current form.',
  ));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'opposes');
});

test('v3 rejects another actor voting against a bill near the target member', () => {
  const rows = extractExplicitBillStatementsV3(input(
    'Bidal Duran',
    'Representative Bidal Duran said she was disappointed that Democrats voted against HF1234.',
  ));
  assert.equal(rows.length, 0);
});

test('v3 rejects favorable language about only a bill provision', () => {
  const rows = extractExplicitBillStatementsV3(input(
    'Alice Mann',
    'Senator Alice Mann supports the childcare provision in SF55 but did not state a position on the full bill.',
  ));
  assert.equal(rows.length, 0);
});

test('v3 rejects opposition to an amendment rather than the referenced bill', () => {
  const rows = extractExplicitBillStatementsV3(input(
    'Mary Franson',
    'Representative Mary Franson opposes the amendment to HF1234 and supports a different approach.',
  ));
  assert.equal(rows.length, 0);
});

test('v3 rejects support for an alternative proposal merely compared with the bill', () => {
  const rows = extractExplicitBillStatementsV3(input(
    'Alice Mann',
    'Senator Alice Mann supports an alternative proposal to SF55.',
  ));
  assert.equal(rows.length, 0);
});

test('v3 rejects bare against language that is not an attributed vote or opposition verb', () => {
  const rows = extractExplicitBillStatementsV3(input(
    'Mary Franson',
    'Representative Mary Franson spoke against the background of debate over HF1234.',
  ));
  assert.equal(rows.length, 0);
});

test('v3 remains fail-closed when member attribution is too distant from the stance cue', () => {
  const rows = extractExplicitBillStatementsV3(input(
    'Alice Mann',
    'Senator Alice Mann discussed the long history and many competing perspectives surrounding the proposal before noting that she supports SF55.',
  ));
  assert.equal(rows.length, 0);
});
