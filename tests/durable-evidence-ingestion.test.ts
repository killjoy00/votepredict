import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evidenceIngestionKey,
  evidenceSeriesKey,
  normalizeDurableEvidenceDraftForSource,
  type DurableEvidenceDraft,
} from '../src/evidence/durable-ingestion';

const draft: DurableEvidenceDraft = {
  kind: 'context',
  stance: 'neutral',
  claim: 'Official campaign-finance aggregate.',
  publishedAt: '2026-07-01T00:00:00.000Z',
  sourceQuality: 'official',
  relevance: 'low',
  freshness: 'current',
  extractionMethod: 'deterministic-test',
  extractionVersion: 'v1',
  metadata: { ignoredByKey: true },
};

const base = {
  sourceUrl: 'https://example.test/source.csv',
  contentSha256: 'a'.repeat(64),
  membershipId: '11111111-1111-1111-1111-111111111111',
  billId: '22222222-2222-2222-2222-222222222222',
  draft,
};

test('durable evidence ingestion key is deterministic and SHA-256 shaped', () => {
  const first = evidenceIngestionKey(base);
  const second = evidenceIngestionKey({ ...base, draft: { ...draft, metadata: { differentMetadata: true } } });
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('durable evidence ingestion key changes when source content changes', () => {
  assert.notEqual(
    evidenceIngestionKey(base),
    evidenceIngestionKey({ ...base, contentSha256: 'b'.repeat(64) }),
  );
});

test('durable evidence ingestion key is scoped to the resolved member and bill', () => {
  assert.notEqual(
    evidenceIngestionKey(base),
    evidenceIngestionKey({ ...base, membershipId: '33333333-3333-3333-3333-333333333333' }),
  );
  assert.notEqual(
    evidenceIngestionKey(base),
    evidenceIngestionKey({ ...base, billId: '44444444-4444-4444-4444-444444444444' }),
  );
});

test('durable evidence ingestion key changes for a materially different claim', () => {
  assert.notEqual(
    evidenceIngestionKey(base),
    evidenceIngestionKey({ ...base, draft: { ...draft, claim: 'A different sourced claim.' } }),
  );
});

test('legacy campaign-finance bulk transaction dates are not persisted as publication dates', () => {
  const normalized = normalizeDurableEvidenceDraftForSource({ sourceKind: 'campaign_finance_bulk' }, {
    ...draft,
    metadata: {
      contextType: 'campaign_finance',
      subtype: 'candidate_contributions',
      latestReceiptDate: '2026-07-01',
    },
  });

  assert.equal(normalized.publishedAt, undefined);
  assert.equal(normalized.metadata?.asOfEligible, false);
  assert.equal(normalized.metadata?.availabilityStatus, 'awaiting_regulatory_disclosure_proof');
  assert.equal(normalized.metadata?.transactionDateIsAvailability, false);
  assert.equal(normalized.metadata?.latestReceiptDate, '2026-07-01');
});

test('non-finance durable evidence keeps its proven publication timestamp unchanged', () => {
  const normalized = normalizeDurableEvidenceDraftForSource({ sourceKind: 'official_committee_archive' }, draft);
  assert.equal(normalized, draft);
});

test('campaign-finance series key is stable across changing aggregate claims', () => {
  const financeDraft: DurableEvidenceDraft = {
    ...draft,
    metadata: {
      contextType: 'campaign_finance',
      subtype: 'candidate_contributions',
      cycleYears: [2026, 2025],
    },
  };
  const first = evidenceSeriesKey({ membershipId: base.membershipId, draft: financeDraft });
  const second = evidenceSeriesKey({
    membershipId: base.membershipId,
    draft: { ...financeDraft, claim: 'A newer aggregate amount.' },
  });
  assert.equal(first, second);
  assert.equal(first, `campaign_finance:candidate_contributions:membership:${base.membershipId}:cycle:2025-2026`);
});

test('campaign-finance series key separates member, subtype, and cycle', () => {
  const financeDraft: DurableEvidenceDraft = {
    ...draft,
    metadata: {
      contextType: 'campaign_finance',
      subtype: 'candidate_contributions',
      cycleYears: [2025, 2026],
    },
  };
  const baseKey = evidenceSeriesKey({ membershipId: base.membershipId, draft: financeDraft });
  assert.notEqual(baseKey, evidenceSeriesKey({
    membershipId: '33333333-3333-3333-3333-333333333333',
    draft: financeDraft,
  }));
  assert.notEqual(baseKey, evidenceSeriesKey({
    membershipId: base.membershipId,
    draft: { ...financeDraft, metadata: { ...financeDraft.metadata, subtype: 'independent_expenditures' } },
  }));
  assert.notEqual(baseKey, evidenceSeriesKey({
    membershipId: base.membershipId,
    draft: { ...financeDraft, metadata: { ...financeDraft.metadata, cycleYears: [2027, 2028] } },
  }));
});

test('explicit evidence series key is honored outside campaign finance', () => {
  const explicit = evidenceSeriesKey({
    membershipId: base.membershipId,
    draft: { ...draft, metadata: { evidenceSeriesKey: 'official-role:lrl-15544:2025-2026' } },
  });
  assert.equal(explicit, 'official-role:lrl-15544:2025-2026');
});
