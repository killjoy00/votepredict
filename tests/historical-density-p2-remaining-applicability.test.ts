import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applicabilityPatternHits,
} from '../src/evidence/historical-density-p2-applicability.js';
import {
  P2_REMAINING_APPLICABILITY_RULES,
  P2_REMAINING_NOVEL_SEMANTIC_KEYS,
} from '../src/evidence/historical-density-p2-remaining-applicability.js';

test('remaining P2 screen has exactly 17 novel semantic groups', () => {
  assert.equal(P2_REMAINING_APPLICABILITY_RULES.length, 17);
  assert.equal(new Set(P2_REMAINING_NOVEL_SEMANTIC_KEYS).size, 17);
  assert.deepEqual(
    [...P2_REMAINING_NOVEL_SEMANTIC_KEYS],
    P2_REMAINING_APPLICABILITY_RULES.map((rule) => rule.id).sort(),
  );
  assert.ok(P2_REMAINING_APPLICABILITY_RULES.every((rule) => rule.screenPolicy === 'screen_issue_match'));
});

test('narrow issue screens nominate issue presence only', () => {
  const byId = new Map(P2_REMAINING_APPLICABILITY_RULES.map((rule) => [rule.id, rule]));

  assert.ok(
    applicabilityPatternHits(
      'A section modifies the state minimum wage and future indexing.',
      byId.get('murphy_minimum_wage_15_indexed')!,
    ).length > 0,
  );
  assert.ok(
    applicabilityPatternHits(
      'The peacetime emergency declaration expires unless approved by the legislature.',
      byId.get('koran_end_emergency_powers')!,
    ).length > 0,
  );
  assert.ok(
    applicabilityPatternHits(
      'Community solar programs and a solar energy standard are amended.',
      byId.get('hoffman_solar_standard')!,
    ).length > 0,
  );
  assert.ok(
    applicabilityPatternHits(
      'The corporate income tax is modified.',
      byId.get('hoffman_close_corporate_tax_loopholes')!,
    ).length > 0,
  );
});

test('screens do not create candidates from unrelated generic text', () => {
  for (const rule of P2_REMAINING_APPLICABILITY_RULES) {
    assert.deepEqual(
      applicabilityPatternHits(
        'A bill relating to local government administration and technical corrections.',
        rule,
      ),
      [],
      rule.id,
    );
  }
});
