import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EVIDENCE_QUALITY_SOURCE_KINDS,
  EVIDENCE_QUALITY_SPONSORSHIP_POLICY_VERSION,
  applyEvidenceQualitySponsorshipPolicy,
  buildEvidenceQualityPrompt,
  isEvidenceQualitySourceKind,
  sourceContentIdentityMatches,
  supportingExcerptIsGrounded,
  validateEvidenceQualityAnnotation,
  type EvidenceQualityAnnotation,
  type EvidenceQualityCandidateContext,
} from '../src/evidence/evidence-quality';

function input(): EvidenceQualityCandidateContext {
  return {
    sourceKind: 'wayback_local_trade_news',
    sourceUrl: 'https://web.archive.org/example',
    contentMode: 'verified_full_text',
    text: 'Representative Jane Doe said she supports HF123 because the bill expands access to the program.',
    candidateMemberNames: ['Jane Doe'],
    candidateBillIdentifiers: ['HF123'],
  };
}

function annotation(): EvidenceQualityAnnotation {
  return {
    document: {
      legislativeRelevance: 'high',
      centrality: 'primary',
      contentType: 'news_report',
      novelty: 'unknown',
      corroboration: 'unknown',
      topics: ['program access'],
      documentConfidence: 0.96,
    },
    claims: [{
      memberNames: ['Jane Doe'],
      billIdentifiers: ['HF123'],
      linkage: 'exact_member_bill',
      claimType: 'explicit_position',
      stance: 'supports',
      specificity: 'exact_bill',
      explicitness: 'attributed_paraphrase',
      attributionType: 'target_member',
      attributedActor: 'Jane Doe',
      normalizedClaim: 'Jane Doe explicitly supports HF123.',
      supportingExcerpt: 'Representative Jane Doe said she supports HF123 because the bill expands access to the program.',
      extractionConfidence: 0.97,
    }],
    notes: [],
  };
}

test('Evidence Quality v1 includes semantic text sources and excludes deterministic numeric/structured families', () => {
  for (const sourceKind of [
    'wayback_local_trade_news',
    'public_news_article',
    'member_primary_article',
    'campaign_site',
    'wayback_campaign_site',
    'wayback_member_primary',
    'house_member_primary_historical_article',
    'senate_member_primary_historical_article',
    'wayback_organization_publication',
    'house_session_daily',
  ]) {
    assert.equal(isEvidenceQualitySourceKind(sourceKind), true);
  }
  for (const sourceKind of [
    'campaign_finance_bulk',
    'house_committee_minutes',
    'mn_sos_legislative_results',
    'mn_lbo_fiscal_notes',
    'legislative_conference_committee',
  ]) {
    assert.equal(isEvidenceQualitySourceKind(sourceKind), false);
  }
  assert.equal(EVIDENCE_QUALITY_SOURCE_KINDS.length, 10);
});

test('Evidence Quality v1 prompt is outcome-blind and forbids vote prediction and unsupported stance inference', () => {
  const prompt = buildEvidenceQualityPrompt(input());
  assert.match(prompt, /Do NOT predict how anyone will vote/);
  assert.match(prompt, /Do NOT use or infer later outcomes/);
  assert.match(prompt, /party affiliation, ideology, donors, endorsements, article tone/i);
  assert.match(prompt, /stance of supports\/opposes\/mixed is allowed only/i);
  assert.match(prompt, /Candidate members:/);
  assert.match(prompt, /Jane Doe/);
  assert.match(prompt, /HF123/);
});

test('content identity comparison requires exact SHA-256 equality', () => {
  const hash = 'a'.repeat(64);
  assert.equal(sourceContentIdentityMatches(hash, hash.toUpperCase()), true);
  assert.equal(sourceContentIdentityMatches(hash, 'b'.repeat(64)), false);
  assert.equal(sourceContentIdentityMatches('not-a-hash', hash), false);
});

test('supporting excerpts must be grounded in supplied source text', () => {
  assert.equal(
    supportingExcerptIsGrounded(input().text, 'Jane Doe said she supports HF123'),
    true,
  );
  assert.equal(
    supportingExcerptIsGrounded(input().text, 'Jane Doe opposed HF123'),
    false,
  );
});

test('valid evidence-quality annotation passes validation', () => {
  assert.doesNotThrow(() => validateEvidenceQualityAnnotation(annotation(), input()));
});

test('directional stance cannot be inferred from a legislative action', () => {
  const value = annotation();
  value.claims[0] = {
    ...value.claims[0],
    claimType: 'legislative_action',
    stance: 'supports',
  };
  assert.throws(
    () => validateEvidenceQualityAnnotation(value, input()),
    /Directional stance requires/,
  );
});

test('classifier cannot return an unknown member or bill identity', () => {
  const value = annotation();
  value.claims[0] = {
    ...value.claims[0],
    memberNames: ['Someone Else'],
  };
  assert.throws(
    () => validateEvidenceQualityAnnotation(value, input()),
    /unknown member/,
  );
});


test('verified exact-bill sponsorship is normalized to support under the sponsorship policy', () => {
  const value = annotation();
  value.claims[0] = {
    ...value.claims[0],
    claimType: 'sponsorship',
    stance: 'none',
    explicitness: 'none',
    attributionType: 'official_record',
    attributedActor: null,
    normalizedClaim: 'Jane Doe is a sponsor of HF123.',
    supportingExcerpt: 'Representative Jane Doe said she supports HF123 because the bill expands access to the program.',
  };
  const normalized = applyEvidenceQualitySponsorshipPolicy(value);
  assert.equal(EVIDENCE_QUALITY_SPONSORSHIP_POLICY_VERSION, 'evidence-quality-sponsorship-support-v1');
  assert.equal(normalized.claims[0].stance, 'supports');
  assert.doesNotThrow(() => validateEvidenceQualityAnnotation(normalized, input()));
});

test('sponsorship cannot remain neutral once an exact member-bill relationship is verified', () => {
  const value = annotation();
  value.claims[0] = {
    ...value.claims[0],
    claimType: 'sponsorship',
    stance: 'none',
    explicitness: 'none',
    attributionType: 'official_record',
    attributedActor: null,
  };
  assert.throws(
    () => validateEvidenceQualityAnnotation(value, input()),
    /sponsorship must be treated as support/i,
  );
});

test('sponsorship support still requires an exact member-bill relationship', () => {
  const value = annotation();
  value.claims[0] = {
    ...value.claims[0],
    claimType: 'sponsorship',
    stance: 'supports',
    linkage: 'member_only',
    billIdentifiers: [],
    specificity: 'none',
    explicitness: 'none',
    attributionType: 'official_record',
    attributedActor: null,
  };
  assert.throws(
    () => validateEvidenceQualityAnnotation(value, input()),
    /exact member-bill relationship/i,
  );
});
