import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HistoricalArchiveDeepResearchProvider,
  historicalArchivePacketErrors,
  type HistoricalArchivePacket,
} from '../src/evidence/historical-archive-provider.js';
import type { DeepResearchRequest } from '../src/evidence/provider.js';

const HASH = 'a'.repeat(64);

function packet(overrides: Partial<HistoricalArchivePacket> = {}): HistoricalArchivePacket {
  return {
    schemaVersion: 'historical-official-archives-v1',
    forecastId: 'vote-1',
    billId: 'bill-1',
    chamberId: 'house-id',
    asOf: '2026-03-09T23:59:59.999Z',
    sources: [{
      id: 'source-1',
      url: 'https://www.house.mn.gov/sessiondaily/article/123',
      title: 'Historical House article',
      publishedAt: '2026-03-08T15:00:00.000Z',
      provenanceKind: 'official_historical_record',
      contentSha256: HASH,
    }],
    evidence: [{
      sourceId: 'source-1',
      kind: 'direct_statement',
      stance: 'supports',
      claim: 'The member said they support the bill.',
      sourceQuality: 'official',
      relevance: 'direct',
      freshness: 'current',
      confidence: 0.95,
      targetMembershipId: 'membership-1',
      mechanicallyActionable: true,
    }],
    ...overrides,
  };
}

function request(overrides: Partial<DeepResearchRequest> = {}): DeepResearchRequest {
  return {
    forecastId: 'vote-1',
    billId: 'bill-1',
    chamberId: 'house-id',
    asOf: '2026-03-09T23:59:59.999Z',
    targets: [{
      membershipId: 'membership-1',
      memberName: 'Example Member',
      rationale: 'Pivotal and uncertain.',
    }],
    ...overrides,
  };
}

test('valid official historical packet produces verified source-backed evidence', async () => {
  const provider = new HistoricalArchiveDeepResearchProvider([packet()]);
  const result = await provider.research(request());

  assert.equal(result.provider, 'historical-official-archives');
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].publishedAt, '2026-03-08T15:00:00.000Z');
  assert.equal(result.evidence[0].sourceUrl, 'https://www.house.mn.gov/sessiondaily/article/123');
  assert.equal(result.evidence[0].metadata?.sourceVerified, true);
  assert.equal(result.evidence[0].metadata?.afterAsOf, false);
  assert.equal(result.evidence[0].metadata?.mechanicallyActionable, true);
  assert.equal(result.evidence[0].metadata?.sourceContentSha256, HASH);
});

test('context-only evidence remains explicitly non-actionable in provider output', async () => {
  const value = packet({
    evidence: [{
      sourceId: 'source-1',
      kind: 'context',
      stance: 'supports',
      claim: 'The member previously discussed adjacent policy.',
      sourceQuality: 'official',
      relevance: 'medium',
      freshness: 'recent',
      confidence: 0.9,
      targetMembershipId: 'membership-1',
      mechanicallyActionable: false,
    }],
  });
  const result = await new HistoricalArchiveDeepResearchProvider([value]).research(request());
  assert.equal(result.evidence[0].metadata?.mechanicallyActionable, false);
  assert.equal(result.diagnostics?.contextOnlyEvidenceCount, 1);
});

test('sources published after the replay cutoff fail closed', () => {
  const value = packet({
    sources: [{
      id: 'source-1',
      url: 'https://www.house.mn.gov/sessiondaily/article/123',
      publishedAt: '2026-03-10T00:00:00.000Z',
      provenanceKind: 'official_historical_record',
      contentSha256: HASH,
    }],
  });
  assert.ok(historicalArchivePacketErrors(value).some((error) => /published after/i.test(error)));
  assert.throws(() => new HistoricalArchiveDeepResearchProvider([value]), /published after/i);
});

test('archive snapshots must themselves have existed by the replay cutoff', () => {
  const value = packet({
    sources: [{
      id: 'source-1',
      url: 'https://example.org/member-statement',
      archiveUrl: 'https://web.archive.org/web/20260311000000/https://example.org/member-statement',
      publishedAt: '2026-03-08T10:00:00.000Z',
      capturedAt: '2026-03-11T00:00:00.000Z',
      provenanceKind: 'archive_snapshot',
      contentSha256: HASH,
    }],
  });
  assert.ok(historicalArchivePacketErrors(value).some((error) => /captured after/i.test(error)));
});

test('request identity and exact cutoff must match the packet', async () => {
  const provider = new HistoricalArchiveDeepResearchProvider([packet()]);
  await assert.rejects(
    provider.research(request({ asOf: '2026-03-08T23:59:59.999Z' })),
    /asOf does not exactly match/i,
  );
  await assert.rejects(
    provider.research(request({ chamberId: 'senate-id' })),
    /chamberId does not match/i,
  );
});

test('evidence cannot be attached to a membership outside the planned Deep targets', async () => {
  const provider = new HistoricalArchiveDeepResearchProvider([packet()]);
  await assert.rejects(
    provider.research(request({
      targets: [{ membershipId: 'membership-2', rationale: 'Different target.' }],
    })),
    /unrequested membership/i,
  );
});

test('duplicate forecast packets are rejected', () => {
  assert.throws(
    () => new HistoricalArchiveDeepResearchProvider([packet(), packet()]),
    /Duplicate historical archive packet/i,
  );
});
