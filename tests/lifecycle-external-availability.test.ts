import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyLifecycleExternalAvailability } from '../src/evaluation/lifecycle-external-availability.js';

function row(overrides: Record<string, unknown> = {}) {
  return {
    evidenceId: 'e1',
    sourceDocumentId: 'd1',
    billId: 'b1',
    membershipId: 'm1',
    session: '2025-2026',
    sourceKind: 'member_primary_article',
    evidenceKind: 'direct_statement',
    stance: 'supports',
    publishedAt: '2026-03-01T12:00:00Z',
    fetchedAt: '2026-09-01T12:00:00Z',
    metadata: { subtype: 'explicit_bill_statement', sourceVerified: true },
    newsPublicationDateSource: null,
    ...overrides,
  } as any;
}

test('verified member-primary statement uses publication date even when fetched later', () => {
  const decision = classifyLifecycleExternalAvailability(row());
  assert.equal(decision.accepted, true);
  if (decision.accepted) {
    assert.equal(decision.row.family, 'member_primary_bill_statement');
    assert.equal(decision.row.availableOn, '2026-03-01');
  }
});

test('news statement requires page-metadata publication date', () => {
  const weak = classifyLifecycleExternalAvailability(row({
    sourceKind: 'public_news_article',
    newsPublicationDateSource: 'gdelt_seen_at',
  }));
  assert.deepEqual(weak, { accepted: false, reason: 'news_date_not_page_metadata' });
  const strong = classifyLifecycleExternalAvailability(row({
    sourceKind: 'public_news_article',
    newsPublicationDateSource: 'page_metadata',
  }));
  assert.equal(strong.accepted, true);
});

test('official structured evidence uses the official published date', () => {
  const decision = classifyLifecycleExternalAvailability(row({
    membershipId: null,
    sourceKind: 'house_research_bill_summary',
    evidenceKind: 'context',
    stance: 'neutral',
    metadata: { contextType: 'structured_public', subtype: 'bill_summary_version', asOfEligible: true },
  }));
  assert.equal(decision.accepted, true);
  if (decision.accepted) assert.equal(decision.row.family, 'official_bill_summary');
});

test('campaign finance transaction dates are not treated as public availability dates', () => {
  const decision = classifyLifecycleExternalAvailability(row({
    billId: null,
    sourceKind: 'campaign_finance_bulk',
    evidenceKind: 'context',
    stance: 'neutral',
    metadata: { contextType: 'campaign_finance' },
  }));
  assert.deepEqual(decision, {
    accepted: false,
    reason: 'campaign_finance_transaction_date_not_disclosure_date',
  });
});

test('mutable campaign pages are excluded without historical archive provenance', () => {
  const decision = classifyLifecycleExternalAvailability(row({
    sourceKind: 'campaign_site',
  }));
  assert.deepEqual(decision, {
    accepted: false,
    reason: 'mutable_campaign_page_without_archive_date',
  });
});

test('explicit as-of ineligibility always fails closed', () => {
  const decision = classifyLifecycleExternalAvailability(row({
    metadata: { subtype: 'explicit_bill_statement', sourceVerified: true, asOfEligible: false },
  }));
  assert.deepEqual(decision, { accepted: false, reason: 'explicit_as_of_ineligible' });
});
