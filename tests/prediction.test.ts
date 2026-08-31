import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPredictionResult, majorityNeeded, predictionSchema } from '../src/services/openai.js';
import type { Legislator } from '../src/types/index.js';

const legislators: Legislator[] = [
  { id: 'h-dfl', name: 'House DFL', party: 'DFL', chamber: 'house', district: '1A', title: 'Representative' },
  { id: 'h-gop', name: 'House GOP', party: 'Republican', chamber: 'house', district: '1B', title: 'Representative' },
  { id: 's-dfl', name: 'Senate DFL', party: 'DFL', chamber: 'senate', district: '1', title: 'Senator' },
  { id: 's-gop', name: 'Senate GOP', party: 'Republican', chamber: 'senate', district: '2', title: 'Senator' },
];

test('majorityNeeded does not treat an even split as passage', () => {
  assert.equal(majorityNeeded(134), 68);
  assert.equal(majorityNeeded(67), 34);
  assert.equal(majorityNeeded(2), 2);
});

test('structured-output schema uses only portable constraints', () => {
  const schema = JSON.stringify(predictionSchema);
  assert.doesNotMatch(schema, /"(?:minimum|maximum|maxItems|minItems)"/);
});

test('prediction totals are derived from individual predictions', () => {
  const result = buildPredictionResult({
    billTitle: 'Test bill',
    legislators,
    generatedAt: '2026-08-31T00:00:00.000Z',
    output: {
      analysis: 'A test analysis.',
      dflYesPercent: 80,
      republicanYesPercent: 20,
      independentYesPercent: 50,
      passageConfidence: 72,
      keyFactors: ['Partisan split'],
      exceptions: [{
        legislatorId: 'h-gop',
        name: 'House GOP',
        vote: 'yes',
        confidence: 73,
        reasoning: 'Crosses the aisle.',
      }],
    },
  });

  assert.deepEqual(
    [result.houseYes, result.houseNo, result.houseAbstain, result.houseUncertain],
    [2, 0, 0, 0],
  );
  assert.deepEqual(
    [result.senateYes, result.senateNo, result.senateAbstain, result.senateUncertain],
    [1, 1, 0, 0],
  );
  assert.equal(result.predictions.length, legislators.length);
  assert.equal(result.likelyToPass, false);
  assert.match(result.predictions.find((prediction) => prediction.legislatorId === 'h-gop')!.reasoning, /Crosses/);
});

test('close caucus estimates remain uncertain rather than becoming abstentions', () => {
  const result = buildPredictionResult({
    billTitle: 'Close call',
    legislators,
    output: {
      analysis: 'Too close to call.',
      dflYesPercent: 52,
      republicanYesPercent: 48,
      independentYesPercent: 50,
      passageConfidence: 55,
      keyFactors: [],
      exceptions: [],
    },
  });

  assert.equal(result.houseUncertain, 2);
  assert.equal(result.senateUncertain, 2);
  assert.equal(result.houseAbstain + result.senateAbstain, 0);
});

test('unknown model exceptions cannot be assigned to a real member', () => {
  const result = buildPredictionResult({
    billTitle: 'Unknown exception',
    legislators,
    output: {
      analysis: 'Test.',
      dflYesPercent: 90,
      republicanYesPercent: 10,
      independentYesPercent: 50,
      passageConfidence: 75,
      keyFactors: [],
      exceptions: [{
        legislatorId: 'invented-id',
        name: 'Invented Person',
        vote: 'yes',
        confidence: 99,
        reasoning: 'Invented.',
      }],
    },
  });

  assert.equal(result.houseYes, 1);
  assert.equal(result.houseNo, 1);
});
