import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P2_REMAINING_APPLICABILITY_RULES,
  remainingApplicabilityPatternHits,
  remainingApplicabilitySnippet,
} from '../src/evidence/historical-density-p2-remaining-applicability.js';

const EXPECTED_KEYS = [
  'coleman_parental_education_control',
  'coleman_pro_life',
  'duckworth_parental_education_choice',
  'hoffman_close_corporate_tax_loopholes',
  'hoffman_disability_employment_protections',
  'hoffman_gas_tax_opposition',
  'hoffman_hate_crime_penalty_enhancement',
  'hoffman_solar_standard',
  'jasinski_stand_your_ground',
  'koran_end_emergency_powers',
  'koran_gas_tax_opposition',
  'lang_pro_life',
  'mathews_defund_planned_parenthood',
  'mathews_second_amendment',
  'murphy_minimum_wage_15_indexed',
  'utke_gas_tax_opposition',
  'utke_law_enforcement_resources',
].sort();

test('remaining P2 applicability rules cover exactly the 17 novel semantic groups', () => {
  assert.equal(P2_REMAINING_APPLICABILITY_RULES.length, 17);
  assert.deepEqual(
    P2_REMAINING_APPLICABILITY_RULES.map((rule) => rule.semanticKey).sort(),
    EXPECTED_KEYS,
  );
  assert.equal(
    new Set(P2_REMAINING_APPLICABILITY_RULES.map((rule) => rule.semanticKey)).size,
    17,
  );
  assert.ok(P2_REMAINING_APPLICABILITY_RULES.every((rule) => rule.candidatePatterns.length > 0));
});

test('narrow issue screens nominate issue presence but do not encode applicability', () => {
  const plannedParenthood = P2_REMAINING_APPLICABILITY_RULES.find(
    (rule) => rule.semanticKey === 'mathews_defund_planned_parenthood',
  );
  const wage = P2_REMAINING_APPLICABILITY_RULES.find(
    (rule) => rule.semanticKey === 'murphy_minimum_wage_15_indexed',
  );
  const emergency = P2_REMAINING_APPLICABILITY_RULES.find(
    (rule) => rule.semanticKey === 'koran_end_emergency_powers',
  );
  assert.ok(plannedParenthood && wage && emergency);

  assert.ok(
    remainingApplicabilityPatternHits(
      'Appropriations to Planned Parenthood are prohibited.',
      plannedParenthood,
    ).length > 0,
  );
  assert.ok(
    remainingApplicabilityPatternHits(
      'The minimum wage is increased and indexed annually.',
      wage,
    ).length > 0,
  );
  assert.ok(
    remainingApplicabilityPatternHits(
      'The peacetime emergency authority is modified.',
      emergency,
    ).length > 0,
  );
});

test('bounded snippets stay centered on the matched issue phrase', () => {
  const gas = P2_REMAINING_APPLICABILITY_RULES.find(
    (rule) => rule.semanticKey === 'utke_gas_tax_opposition',
  );
  assert.ok(gas);
  const text = `${'before '.repeat(100)}The motor fuel tax rate is increased.${' after'.repeat(100)}`;
  const hit = remainingApplicabilityPatternHits(text, gas)[0];
  assert.ok(hit);
  const snippet = remainingApplicabilitySnippet(text, hit, 80);
  assert.match(snippet, /motor fuel tax/i);
  assert.ok(snippet.length < 280);
});
