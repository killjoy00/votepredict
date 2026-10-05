import test from 'node:test';
import assert from 'node:assert/strict';
import { extractExplicitBillStatementsV4, QUICK_EVIDENCE_STATEMENT_EXTRACTOR_V4_VERSION } from '../src/evidence/bill-statement-extractor-v4';

const bills = [
  { id: '11111111-1111-1111-1111-111111111111', identifier: 'HF1234' },
  { id: '22222222-2222-2222-2222-222222222222', identifier: 'SF55' },
  { id: '33333333-3333-3333-3333-333333333333', identifier: 'HF1' },
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

test('v4 preserves tight first-person whole-bill support', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Mary Franson',
    'Legislative update. I strongly support HF 1234 because it addresses this issue for our district.',
  ));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'supports');
  assert.equal(rows[0].extractionVersion, QUICK_EVIDENCE_STATEMENT_EXTRACTOR_V4_VERSION);
  assert.equal(rows[0].metadata?.quickEvidenceCandidate, false);
  assert.equal(rows[0].metadata?.evaluationOnly, true);
});

test('v4 preserves tight named-member opposition', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Alice Mann',
    'Senator Alice Mann opposes SF55 and will vote against SF 55 if it reaches the floor.',
  ));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'opposes');
});

test('v4 excludes completed vote-to-pass action history', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Doron Clark',
    'Senator Doron Clark voted to pass Senate File 55 after debate on the measure.',
  ));
  assert.equal(rows.length, 0);
});

test('v4 preserves explicit negated support as opposition', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Alice Mann',
    'Senator Alice Mann cannot support Senate File 55 in its current form.',
  ));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'opposes');
});

test('v4 rejects another actor voting against a bill near the target member', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Bidal Duran',
    'Representative Bidal Duran said she was disappointed that Democrats voted against HF1234.',
  ));
  assert.equal(rows.length, 0);
});

test('v4 rejects favorable language about only a bill provision', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Alice Mann',
    'Senator Alice Mann supports the childcare provision in SF55 but did not state a position on the full bill.',
  ));
  assert.equal(rows.length, 0);
});

test('v4 rejects opposition to an amendment rather than the referenced bill', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Mary Franson',
    'Representative Mary Franson opposes the amendment to HF1234 and supports a different approach.',
  ));
  assert.equal(rows.length, 0);
});

test('v4 rejects support for an alternative proposal merely compared with the bill', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Alice Mann',
    'Senator Alice Mann supports an alternative proposal to SF55.',
  ));
  assert.equal(rows.length, 0);
});

test('v4 rejects bare against language that is not an attributed vote or opposition verb', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Mary Franson',
    'Representative Mary Franson spoke against the background of debate over HF1234.',
  ));
  assert.equal(rows.length, 0);
});

test('v4 remains fail-closed when member attribution is too distant from the stance cue', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Alice Mann',
    'Senator Alice Mann discussed the long history and many competing perspectives surrounding the proposal before noting that she supports SF55.',
  ));
  assert.equal(rows.length, 0);
});


test('v4 treats opposing as opposition and ignores Back to profile navigation in the Skraba HF1 failure mode', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Roger J Skraba',
    'Minnesota House of Representatives House Menu Legislative News and Views - Rep. Roger Skraba (R) Back to profile RELEASE: Rep. Skraba Statement Opposing House File 1 Friday, January 20, 2023',
  ));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].target?.billId, '33333333-3333-3333-3333-333333333333');
  assert.equal(rows[0].stance, 'opposes');
});

test('v4 does not treat bare Back to profile navigation as bill support', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Mary Franson',
    'Legislative News and Views - Rep. Mary Franson Back to profile House File 1234 Friday update.',
  ));
  assert.equal(rows.length, 0);
});

test('v4 still recognizes bare back when it directly governs an exact bill identifier', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Mary Franson',
    'Representative Mary Franson said, I back HF1234 and urge colleagues to pass it.',
  ));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'supports');
});


test('v4 preserves prospective vote commitments', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Doron Clark',
    'Senator Doron Clark will vote for Senate File 55 when it reaches the floor.',
  ));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'supports');
});

test('v4 excludes completed negative vote action history', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Mary Franson',
    'Representative Mary Franson voted no on HF1234 after final debate.',
  ));
  assert.equal(rows.length, 0);
});

test('v4 excludes member-news index vote headlines', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Mary Franson',
    'Legislative Update - RELEASE: Rep. Mary Franson votes to pass HF 1234 - Friday update.',
  ));
  assert.equal(rows.length, 0);
});

test('v4 excludes procedural move-to-committee vote language', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Mary Franson',
    'While HF1234 went beyond the audit recommendations, I did vote in favor of moving the bill to the State Government Finance Committee.',
  ));
  assert.equal(rows.length, 0);
});

test('v4 does not attach support for a different object to a later bill mention', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Mary Franson',
    'It is vital we support and invest in these schools to support our students. House File 1234 would provide comprehensive funding for community schools.',
  ));
  assert.equal(rows.length, 0);
});

test('v4 rejects historical citation context where support governs an investment, not the cited bill', () => {
  const rows = extractExplicitBillStatementsV4(input(
    'Alice Mann',
    'Child care budget (HHS 2015 Budget, 05/17/15, S.F. 55). In 2015, Senator Alice Mann supported an unprecedented investment in child protection.',
  ));
  assert.equal(rows.length, 0);
});
