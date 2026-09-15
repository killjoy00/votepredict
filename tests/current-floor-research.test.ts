import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRiskBandUncertainty,
  fitRiskBandUncertainty,
  prepareCurrentFloorResearch,
  runCurrentFloorResearchReplay,
  type CurrentFloorResearchDataset,
  type ResearchReplayRow,
} from '../src/evaluation/current-floor-research.js';
import { MEMBER_MODEL_VERSION } from '../src/forecasting/member-model.js';
import type { DeterministicBillFeatures } from '../src/features/bills.js';
import type { QuickReplayAnalogueSupport } from '../src/evaluation/historical-quick-replay.js';

function features(area: string): DeterministicBillFeatures {
  return {
    schemaVersion: 'bill-features-v2',
    bodyHash: `hash-${area}`,
    tokenCount: 120,
    lineCount: 10,
    sectionCount: 2,
    titleTokens: [area],
    keywords: [area, 'policy'],
    policyAreas: [area],
    actionTypes: ['authorization'],
    affectedEntities: ['agencies'],
    fiscal: { appropriation: false, taxChange: false, bonding: false, direction: 'unknown' },
  };
}

function dataset(): CurrentFloorResearchDataset {
  const events = [
    { voteEventId: 'e1', billId: 'b1', identifier: 'HF1', title: 'Education policy', sessionId: 's1', session: '2021-2022', chamberId: 'c1', chamber: 'house', occurredOn: '2021-02-10', yeaCount: 1, nayCount: 1, passed: true },
    { voteEventId: 'e2', billId: 'b2', identifier: 'HF2', title: 'Tax policy', sessionId: 's1', session: '2021-2022', chamberId: 'c1', chamber: 'house', occurredOn: '2021-03-10', yeaCount: 1, nayCount: 0, passed: true },
    { voteEventId: 'e3', billId: 'b3', identifier: 'HF3', title: 'Education update', sessionId: 's1', session: '2021-2022', chamberId: 'c1', chamber: 'house', occurredOn: '2021-04-10', yeaCount: 1, nayCount: 1, passed: true },
  ];
  const versionsByBill = new Map([
    ['b1', [{ id: 'v1', billId: 'b1', publishedAt: '2021-02-01T00:00:00.000Z', createdAt: '2021-02-01T00:00:00.000Z', rawText: 'education '.repeat(30), features: features('education') }]],
    ['b2', [{ id: 'v2', billId: 'b2', publishedAt: '2021-03-01T00:00:00.000Z', createdAt: '2021-03-01T00:00:00.000Z', rawText: 'taxes '.repeat(30), features: features('taxes') }]],
    ['b3', [{ id: 'v3', billId: 'b3', publishedAt: '2021-04-01T00:00:00.000Z', createdAt: '2021-04-01T00:00:00.000Z', rawText: 'education '.repeat(30), features: features('education') }]],
  ]);
  const memberships = [
    { membershipId: 'm1', legislatorId: 'l1', sessionId: 's1', chamberId: 'c1', party: 'A' },
    { membershipId: 'm2', legislatorId: 'l2', sessionId: 's1', chamberId: 'c1', party: 'A' },
  ];
  const historicalVotes = [
    { voteEventId: 'e1', occurredOn: '2021-02-10', chamberId: 'c1', membershipId: 'm1', legislatorId: 'l1', party: 'A', choice: 'yea' as const },
    { voteEventId: 'e1', occurredOn: '2021-02-10', chamberId: 'c1', membershipId: 'm2', legislatorId: 'l2', party: 'A', choice: 'nay' as const },
    { voteEventId: 'e2', occurredOn: '2021-03-10', chamberId: 'c1', membershipId: 'm1', legislatorId: 'l1', party: 'A', choice: 'nay' as const },
    { voteEventId: 'e3', occurredOn: '2021-04-10', chamberId: 'c1', membershipId: 'm1', legislatorId: 'l1', party: 'A', choice: 'yea' as const },
    { voteEventId: 'e3', occurredOn: '2021-04-10', chamberId: 'c1', membershipId: 'm2', legislatorId: 'l2', party: 'A', choice: 'nay' as const },
  ];
  return { events, versionsByBill, memberships, historicalVotes };
}

function support(): Map<string, QuickReplayAnalogueSupport> {
  return new Map(['e1', 'e2', 'e3'].map((eventId) => [eventId, {
    prefiltered: 1,
    selected: 1,
    selectedAnalogueIds: ['prior'],
    member: new Map([
      ['l1', { yesWeight: 0, weight: 0 }],
      ['l2', { yesWeight: 0, weight: 0 }],
    ]),
  }]));
}

test('issue-conditioned evidence can move a member away from generic history without rewriting baseline history', () => {
  const data = dataset();
  const analogue = support();
  const prepared = prepareCurrentFloorResearch(data, analogue);
  const baseline = runCurrentFloorResearchReplay(data, prepared, { id: 'baseline', analogue: null }, analogue);
  const issue = runCurrentFloorResearchReplay(data, prepared, {
    id: 'issue', analogue: null, issue: { priorStrength: 3, maximumWeight: 8 },
  }, analogue);
  const baseTarget = baseline.find((row) => row.result.voteEventId === 'e3');
  const issueTarget = issue.find((row) => row.result.voteEventId === 'e3');
  assert.ok(baseTarget && issueTarget);
  const baseMember = baseTarget.result.memberPredictions.find((row) => row.legislatorId === 'l1');
  const issueMember = issueTarget.result.memberPredictions.find((row) => row.legislatorId === 'l1');
  assert.ok(baseMember?.yesProbability !== undefined && issueMember?.yesProbability !== undefined);
  assert.ok(issueMember.yesProbability > baseMember.yesProbability);
});

test('participation model leaves conditional member probability intact and reduces unconditional chamber yes mass for repeated nonparticipation', () => {
  const data = dataset();
  const analogue = support();
  const prepared = prepareCurrentFloorResearch(data, analogue);
  const baseline = runCurrentFloorResearchReplay(data, prepared, { id: 'baseline', analogue: null }, analogue);
  const participation = runCurrentFloorResearchReplay(data, prepared, {
    id: 'participation', analogue: null,
    participation: { fallback: 0.98, partyPriorStrength: 10, memberPriorStrength: 2 },
  }, analogue);
  const baseTarget = baseline.find((row) => row.result.voteEventId === 'e3');
  const participationTarget = participation.find((row) => row.result.voteEventId === 'e3');
  assert.ok(baseTarget && participationTarget);
  const baseMember = baseTarget.result.memberPredictions.find((row) => row.legislatorId === 'l2');
  const participationMember = participationTarget.result.memberPredictions.find((row) => row.legislatorId === 'l2');
  assert.equal(participationMember?.yesProbability, baseMember?.yesProbability);
  assert.ok(participationTarget.meanParticipationProbability < 1);
  assert.ok((participationTarget.result.expectedYes ?? Infinity) < (baseTarget.result.expectedYes ?? -Infinity));
});

test('process context blends only from strictly prior events with the same pre-vote context key', () => {
  const data = dataset();
  const analogue = support();
  const prepared = prepareCurrentFloorResearch(data, analogue);
  const baseline = runCurrentFloorResearchReplay(data, prepared, { id: 'baseline', analogue: null }, analogue);
  const process = runCurrentFloorResearchReplay(data, prepared, {
    id: 'process', analogue: null, process: { priorStrength: 2, maximumWeight: 4 },
  }, analogue);
  const baseTarget = baseline.find((row) => row.result.voteEventId === 'e3');
  const processTarget = process.find((row) => row.result.voteEventId === 'e3');
  assert.ok(baseTarget && processTarget);
  assert.equal(processTarget.processContext.key, baseTarget.processContext.key);
  const baseMember = baseTarget.result.memberPredictions.find((row) => row.legislatorId === 'l1');
  const processMember = processTarget.result.memberPredictions.find((row) => row.legislatorId === 'l1');
  assert.ok(baseMember?.yesProbability !== undefined && processMember?.yesProbability !== undefined);
  assert.notEqual(processMember.yesProbability, baseMember.yesProbability);
});

function syntheticRiskRows(): ResearchReplayRow[] {
  const rows: ResearchReplayRow[] = [];
  for (let index = 0; index < 40; index += 1) {
    const highRisk = index >= 20;
    const expectedYes = 60;
    const residual = highRisk ? (index % 2 === 0 ? 12 : -12) : (index % 2 === 0 ? 2 : -2);
    const probabilities = Array.from({ length: 100 }, () => 0.6);
    rows.push({
      result: {
        voteEventId: `risk-${index}`,
        session: '2021-2022',
        chamber: 'house',
        occurredOn: `2021-05-${String((index % 20) + 1).padStart(2, '0')}`,
        status: 'replayable',
        modelVersion: MEMBER_MODEL_VERSION,
        targetVersionId: `version-${index}`,
        activeMembers: 100,
        directAnalogueMembers: 100,
        selectedAnalogues: 1,
        memberPredictions: [],
        passageProbability: 0.8,
        expectedYes,
        yesLow: 50,
        yesHigh: 70,
        actualYes: expectedYes + residual,
        passed: true,
      },
      chamberProbabilities: probabilities,
      independentVariance: probabilities.reduce((sum, probability) => sum + probability * (1 - probability), 0),
      riskScore: highRisk ? 0.9 : 0.1,
      meanParticipationProbability: 0.98,
      policyAreas: ['education'],
      processContext: { key: 'x', billAgeDays: 30, versionCount: 1, companionPriorPass: false, priorSameBillPass: false },
    });
  }
  return rows;
}

test('event-specific uncertainty learns a larger systematic sigma for higher-risk historical events', () => {
  const rows = syntheticRiskRows();
  const fit = fitRiskBandUncertainty(rows, 2);
  assert.equal(fit.systematicSigmaVotes.length, 2);
  assert.ok(fit.systematicSigmaVotes[1] > fit.systematicSigmaVotes[0]);
  const applied = applyRiskBandUncertainty(rows, fit);
  assert.equal(applied.length, rows.length);
  assert.ok((applied[30].result.yesHigh ?? 0) - (applied[30].result.yesLow ?? 0)
    >= (applied[5].result.yesHigh ?? 0) - (applied[5].result.yesLow ?? 0));
});
