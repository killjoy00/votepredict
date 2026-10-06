import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P2_APPLICABILITY_CLAIM_RULES,
  applicabilityPatternHits,
  applicabilitySnippet,
} from '../src/evidence/historical-density-p2-applicability.js';

test('frozen P2 applicability rules preserve 14 directional semantic groups and 17 source rows', () => {
  assert.equal(P2_APPLICABILITY_CLAIM_RULES.length, 14);
  assert.equal(P2_APPLICABILITY_CLAIM_RULES.reduce((count, rule) => count + rule.sourceRows.length, 0), 17);
  assert.deepEqual(P2_APPLICABILITY_CLAIM_RULES.find((rule) => rule.id === 'p2-coleman-gas-tax')?.sourceRows, [7, 20, 25]);
  assert.deepEqual(P2_APPLICABILITY_CLAIM_RULES.find((rule) => rule.id === 'p2-coleman-small-business-tax-relief')?.sourceRows, [21, 23]);
});

test('generic ideology and campaign-theme claims are not mechanically nominated', () => {
  const generic = P2_APPLICABILITY_CLAIM_RULES.find((rule) => rule.id === 'p2-lang-lower-taxes-spending-restraint');
  assert.ok(generic);
  assert.equal(generic.screenPolicy, 'reject_claim_too_generic');
  assert.deepEqual(applicabilityPatternHits('A bill relating to income taxes and appropriations.', generic), []);
});

test('narrow issue rules nominate only issue presence, never applicability or alignment', () => {
  const gas = P2_APPLICABILITY_CLAIM_RULES.find((rule) => rule.id === 'p2-coleman-gas-tax');
  const care = P2_APPLICABILITY_CLAIM_RULES.find((rule) => rule.id === 'p2-port-minnesotacare-for-all');
  const abortion = P2_APPLICABILITY_CLAIM_RULES.find((rule) => rule.id === 'p2-koran-pro-life');
  assert.ok(gas && care && abortion);
  assert.ok(applicabilityPatternHits('Section 1. The motor fuel tax rate is modified.', gas).length > 0);
  assert.ok(applicabilityPatternHits('MinnesotaCare eligibility is amended.', care).length > 0);
  assert.ok(applicabilityPatternHits('A section regulating abortion services.', abortion).length > 0);
  assert.equal(applicabilityPatternHits('A transportation bonding bill.', gas).length, 0);
});

test('candidate snippets remain bounded around the matched issue phrase', () => {
  const gas = P2_APPLICABILITY_CLAIM_RULES.find((rule) => rule.id === 'p2-coleman-gas-tax');
  assert.ok(gas);
  const text = `${'before '.repeat(100)}The gasoline tax rate is increased by statute.${' after'.repeat(100)}`;
  const hit = applicabilityPatternHits(text, gas)[0];
  assert.ok(hit);
  const snippet = applicabilitySnippet(text, hit, 80);
  assert.match(snippet, /gasoline tax/i);
  assert.ok(snippet.length < 260);
});
