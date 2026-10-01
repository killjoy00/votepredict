import test from 'node:test';
import assert from 'node:assert/strict';
import { extractIssuePositions } from '../src/evidence/issue-position-extractor.js';

const base = {
  membershipId: '11111111-1111-1111-1111-111111111111',
  memberName: 'Jane Doe',
  publishedAt: '2024-08-01T12:00:00.000Z',
  fetchedAt: '2024-08-02T12:00:00.000Z',
  sourceSubtype: 'campaign_site_page' as const,
};

test('issue-position extractor captures explicit support without requiring a bill number', () => {
  const rows = extractIssuePositions({
    ...base,
    text: 'I support paid family and medical leave for Minnesota workers.',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'supports');
  assert.equal(rows[0].kind, 'related_statement');
  assert.equal(rows[0].metadata?.policyFamily, 'labor_employment');
  assert.equal(rows[0].metadata?.commitmentType, 'explicit_support');
  assert.equal(rows[0].metadata?.exactBillPosition, false);
  assert.equal(rows[0].metadata?.mechanicallyActionable, false);
  assert.equal(rows[0].metadata?.modelWeight, 0);
});

test('issue-position extractor captures explicit opposition as the source statement, not a bill stance', () => {
  const rows = extractIssuePositions({
    ...base,
    text: 'I oppose property tax increases that make housing less affordable.',
  });
  // More than one policy family in the same sentence is intentionally ambiguous
  // and must not be forced into a single issue bucket.
  assert.deepEqual(rows, []);

  const unambiguous = extractIssuePositions({
    ...base,
    text: 'I oppose property tax increases.',
  });
  assert.equal(unambiguous.length, 1);
  assert.equal(unambiguous[0].stance, 'opposes');
  assert.equal(unambiguous[0].metadata?.policyFamily, 'taxes_revenue');
  assert.equal(unambiguous[0].metadata?.commitmentType, 'explicit_opposition');
});

test('issue-position extractor preserves promises as unclear direction rather than inventing support or opposition', () => {
  const rows = extractIssuePositions({
    ...base,
    text: 'I will work to improve access to health care across Minnesota.',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'unclear');
  assert.equal(rows[0].metadata?.policyFamily, 'health');
  assert.equal(rows[0].metadata?.commitmentType, 'promise_action');
});

test('issue-position extractor accepts attributable named-member statements', () => {
  const rows = extractIssuePositions({
    ...base,
    sourceSubtype: 'member_primary_article',
    text: 'Senator Doe supports stronger consumer protections.',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stance, 'supports');
  assert.equal(rows[0].metadata?.policyFamily, 'commerce_consumer');
});

test('issue-position extractor fails closed on unattributed or multi-family language', () => {
  assert.deepEqual(extractIssuePositions({
    ...base,
    text: 'Minnesota schools need additional resources.',
  }), []);

  assert.deepEqual(extractIssuePositions({
    ...base,
    text: 'I support better schools and lower taxes.',
  }), []);
});

test('issue-position extractor ignores descriptive issue mentions without a commitment', () => {
  const rows = extractIssuePositions({
    ...base,
    text: 'Our district has many hospitals and health care employers.',
  });
  assert.deepEqual(rows, []);
});
