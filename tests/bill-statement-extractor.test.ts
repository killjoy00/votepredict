import test from 'node:test';
import assert from 'node:assert/strict';
import { extractExplicitBillStatements } from '../src/evidence/bill-statement-extractor.js';

const bills = [
  { id: '11111111-1111-1111-1111-111111111111', identifier: 'HF1234' },
  { id: '22222222-2222-2222-2222-222222222222', identifier: 'SF55' },
];

test('extracts a first-person exact-bill support statement from a member-controlled page', () => {
  const rows = extractExplicitBillStatements({
    membershipId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    memberName: 'Mary Franson',
    text: 'Legislative update. I strongly support HF 1234 because it addresses this issue for our district.',
    publishedAt: '2026-09-18T12:00:00.000Z',
    fetchedAt: '2026-09-19T12:00:00.000Z',
    bills,
    sourceSubtype: 'member_primary_article',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].target?.billId, bills[0].id);
  assert.equal(rows[0].target?.membershipId, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  assert.equal(rows[0].kind, 'direct_statement');
  assert.equal(rows[0].stance, 'supports');
  assert.equal(rows[0].metadata?.quickEvidenceCandidate, true);
  assert.equal(rows[0].metadata?.mechanicallyActionable, false);
});

test('extracts explicit titled-member opposition and accepts compact bill identifiers', () => {
  const rows = extractExplicitBillStatements({
    membershipId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    memberName: 'Alice Mann',
    text: 'Senator Alice Mann opposes SF55 and will vote against SF 55 if it reaches the floor.',
    fetchedAt: '2026-09-19T12:00:00.000Z',
    bills,
    sourceSubtype: 'campaign_site_page',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'opposes');
  assert.equal(rows[0].kind, 'direct_statement');
});

test('does not attribute another speaker stance to the member', () => {
  const rows = extractExplicitBillStatements({
    membershipId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    memberName: 'Alice Mann',
    text: 'The governor supports HF1234. The article contains no statement from Senator Mann about that bill.',
    fetchedAt: '2026-09-19T12:00:00.000Z',
    bills,
    sourceSubtype: 'member_primary_article',
  });
  assert.equal(rows.length, 0);
});

test('does not emit a directional item when support and opposition language conflict locally', () => {
  const rows = extractExplicitBillStatements({
    membershipId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    memberName: 'Alice Mann',
    text: 'I support the goal of HF1234, but I oppose HF1234 in its current form.',
    fetchedAt: '2026-09-19T12:00:00.000Z',
    bills,
    sourceSubtype: 'member_primary_article',
  });
  assert.equal(rows.length, 0);
});

test('ignores bill-like identifiers that are not in the current bill registry', () => {
  const rows = extractExplicitBillStatements({
    membershipId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    memberName: 'Mary Franson',
    text: 'I support HF999999.',
    fetchedAt: '2026-09-19T12:00:00.000Z',
    bills,
    sourceSubtype: 'member_primary_article',
  });
  assert.equal(rows.length, 0);
});

test('extracts spelled-out Minnesota bill identifiers and vote-to-pass language', () => {
  const rows = extractExplicitBillStatements({
    membershipId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    memberName: 'Doron Clark',
    text: 'Senator Doron Clark voted to pass Senate File 55 after debate on the measure.',
    publishedAt: '2026-05-04T12:00:00.000Z',
    fetchedAt: '2026-09-19T12:00:00.000Z',
    bills,
    sourceSubtype: 'member_primary_article',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].target?.billId, bills[1].id);
  assert.equal(rows[0].stance, 'supports');
  assert.equal(rows[0].kind, 'direct_statement');
});

test('extracts dotted bill identifiers and in-favor vote language', () => {
  const rows = extractExplicitBillStatements({
    membershipId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    memberName: 'Mary Franson',
    text: 'Representative Mary Franson voted in favor of H.F. No. 1234 on the House floor.',
    fetchedAt: '2026-09-19T12:00:00.000Z',
    bills,
    sourceSubtype: 'member_primary_article',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].target?.billId, bills[0].id);
  assert.equal(rows[0].stance, 'supports');
});

test('treats explicit negated support as opposition rather than support', () => {
  const rows = extractExplicitBillStatements({
    membershipId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    memberName: 'Alice Mann',
    text: 'Senator Alice Mann cannot support Senate File 55 in its current form.',
    fetchedAt: '2026-09-19T12:00:00.000Z',
    bills,
    sourceSubtype: 'member_primary_article',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'opposes');
});

test('supports multipart and hyphenated member names in explicit attribution', () => {
  const rows = extractExplicitBillStatements({
    membershipId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    memberName: 'Amanda Hemmingsen-Jaeger',
    text: 'Senator Amanda HemmingsenJaeger supports SF 55 and urged colleagues to vote for it.',
    fetchedAt: '2026-09-19T12:00:00.000Z',
    bills,
    sourceSubtype: 'member_primary_article',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'supports');
});

test('rejoins digits split by page markup inside an otherwise explicit bill identifier', () => {
  const rows = extractExplicitBillStatements({
    membershipId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    memberName: 'Mary Franson',
    text: 'Representative Mary Franson voted for House File 12 34 after the final debate.',
    fetchedAt: '2026-09-19T12:00:00.000Z',
    bills,
    sourceSubtype: 'member_primary_article',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].target?.billId, bills[0].id);
});

test('title abbreviations do not trigger the cross-sentence guard', () => {
  const rows = extractExplicitBillStatements({
    membershipId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    memberName: 'Alice Mann',
    text: 'Sen. Alice Mann voted against S.F. 55 during final debate.',
    fetchedAt: '2026-09-19T12:00:00.000Z',
    bills,
    sourceSubtype: 'member_primary_article',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'opposes');
});
