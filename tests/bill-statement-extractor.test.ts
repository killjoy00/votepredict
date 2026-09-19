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
