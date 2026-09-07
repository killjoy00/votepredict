import test from 'node:test';
import assert from 'node:assert/strict';
import { executeDeepResearch, planDeepResearch } from '../src/evidence/deep-revision.js';
import type { DeepResearchProvider } from '../src/evidence/provider.js';

test('Deep research plan targets the consequential under-evidenced swing member', () => {
  const members = [
    { membershipId: 'covered', yesProbability: 0.5, evidenceQuality: 0.95, evidenceAgeDays: 1 },
    { membershipId: 'research-me', yesProbability: 0.5, evidenceQuality: 0.1, evidenceAgeDays: 365 },
    { membershipId: 'likely-yes', yesProbability: 0.95, evidenceQuality: 0.95, evidenceAgeDays: 1 },
  ];
  const plan = planDeepResearch(members, { passageRule: { kind: 'fixed', requiredYes: 2 }, targetLimit: 1 });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].membershipId, 'research-me');
});

test('Deep research returns inspectable before/after member and chamber changes', async () => {
  const members = [
    { membershipId: 'covered', memberName: 'Covered Member', yesProbability: 0.5, evidenceQuality: 0.95, evidenceAgeDays: 1 },
    { membershipId: 'research-me', memberName: 'Research Member', yesProbability: 0.5, evidenceQuality: 0.1, evidenceAgeDays: 365 },
    { membershipId: 'likely-yes', memberName: 'Likely Yes', yesProbability: 0.95, evidenceQuality: 0.95, evidenceAgeDays: 1 },
  ];

  const provider: DeepResearchProvider = {
    name: 'fixture-provider',
    version: '1',
    async research(request) {
      assert.equal(request.targets.length, 1);
      assert.equal(request.targets[0].membershipId, 'research-me');
      return {
        provider: this.name,
        providerVersion: this.version,
        evidence: [
          {
            sourceUrl: 'https://example.test/member-statement',
            kind: 'direct_statement',
            stance: 'supports',
            claim: 'Member says they plan to vote for the bill.',
            sourceQuality: 'member_primary',
            relevance: 'direct',
            freshness: 'current',
            confidence: 0.95,
            targetMembershipId: 'research-me',
          },
          {
            sourceUrl: 'https://example.test/bill-context',
            kind: 'context',
            stance: 'neutral',
            claim: 'General bill background.',
            sourceQuality: 'reputable_secondary',
            relevance: 'medium',
            freshness: 'recent',
            confidence: 0.8,
          },
        ],
        diagnostics: { searched: 2 },
      };
    },
  };

  const result = await executeDeepResearch(members, {
    forecastId: 'forecast-1',
    billId: 'bill-1',
    chamberId: 'house',
    asOf: '2026-09-07T04:00:00Z',
    passageRule: { kind: 'fixed', requiredYes: 2 },
    targetLimit: 1,
  }, provider);

  const researched = result.memberUpdates.find((row) => row.membershipId === 'research-me');
  assert.ok(researched);
  assert.equal(researched?.evidenceCount, 1);
  assert.equal(researched?.probabilityBefore, 0.5);
  assert.ok((researched?.probabilityAfter ?? 0) > 0.5);
  assert.ok(result.chamberBefore);
  assert.ok(result.chamberAfter);
  assert.ok((result.chamberAfter?.passageProbability ?? 0) > (result.chamberBefore?.passageProbability ?? 0));
  assert.equal(result.diagnostics.unscopedEvidence, 1);
  assert.deepEqual(result.diagnostics.providerDiagnostics, { searched: 2 });
});

test('Deep research does not manufacture a probability for a cannot-predict member', async () => {
  const provider: DeepResearchProvider = {
    name: 'fixture-provider',
    async research(request) {
      return {
        provider: this.name,
        evidence: [{
          sourceUrl: 'https://example.test/statement',
          kind: 'direct_statement',
          stance: 'supports',
          claim: 'A supportive statement exists.',
          sourceQuality: 'member_primary',
          relevance: 'direct',
          freshness: 'current',
          confidence: 0.9,
          targetMembershipId: request.targets[0].membershipId,
        }],
      };
    },
  };
  const result = await executeDeepResearch([
    { membershipId: 'unknown', cannotPredictReason: 'insufficient historical support' },
    { membershipId: 'yes', yesProbability: 0.9 },
    { membershipId: 'no', yesProbability: 0.1 },
  ], {
    forecastId: 'forecast-2',
    chamberId: 'house',
    asOf: '2026-09-07T04:00:00Z',
    passageRule: { kind: 'fixed', requiredYes: 2 },
    targetLimit: 1,
  }, provider);
  const unknown = result.memberUpdates.find((row) => row.membershipId === 'unknown');
  assert.equal(unknown?.probabilityAfter, undefined);
  assert.equal(result.chamberAfter, undefined);
  assert.equal(result.diagnostics.unresolvedMembers, 1);
});
