import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  auditSenateMediaRemarks,
  type SenateMediaContextExport,
  type SenateMediaRosterYear,
  type SenateMediaSourceSnapshot,
  type SenateMediaReview,
} from '../src/evidence/senate-media-remarks-audit.js';

const captured = '2023-04-04T10:11:12Z';
const published = '2023-04-02T12:00:00Z';
const article = '<html><head><meta property="article:published_time" content="2023-04-02T12:00:00Z"></head>'
  + '<body><p>Sen. Example said, "Our schools need more funding."</p>'
  + '<p>Sen. Example joined several lawmakers at the hearing.</p></body></html>';
const hash = createHash('sha256').update(Buffer.from(article)).digest('hex');
const original = 'https://www.mprnews.org/story/2023/04/02/senate-school-spending';

function context(): SenateMediaContextExport {
  const archiveUrl = 'https://web.archive.org/web/20230404101112id_/' + original;
  return {
    evidenceId: 'evidence-1',
    sourceDocumentId: 'source-1',
    sourceKind: 'wayback_local_trade_news',
    sourceUrl: archiveUrl, sourceSha256: hash,
    seedId: 'mpr-news-story-archive', publisher: 'MPR News',
    originalUrl: original, archiveUrl,
    archiveCapturedAt: captured, archiveDigest: 'CDXDIGESTTEST',
    publisherPublishedAt: published, evidencePublishedAt: captured,
    evidenceKind: 'context', stance: 'neutral',
    contextOnly: true, sameDayEligible: false,
    modelWeight: 0, articleInfersLegislativeStance: false,
    mentionedMembers: ['Alice Example'],
  };
}
function member(): SenateMediaRosterYear {
  return {
    year: 2023, senatorId: 'senator-alice', membershipId: 'membership-23',
    senatorName: 'Alice Example', activeFrom: '2023-01-03', activeThrough: '2023-12-31',
  };
}
function snapshot(): SenateMediaSourceSnapshot {
  return { sourceDocumentId: 'source-1', rawBodyBase64: Buffer.from(article).toString('base64') };
}
function review(): SenateMediaReview {
  return {
    sourceDocumentId: 'source-1', membershipId: 'membership-23',
    disposition: 'exact_named_quote', issueCategory: 'education',
    exactQuote: 'Our schools need more funding.',
    attributionCue: 'Sen. Example said',
    sourcePassage: 'Sen. Example said, "Our schools need more funding."',
    publisherPublishedAt: published,
    publicationDateProof: 'content="2023-04-02T12:00:00Z"',
    reviewedBy: 'human-reviewer', reviewedAt: '2026-10-10T19:00:00Z',
  };
}
function audit(options: {
  contexts?: SenateMediaContextExport[];
  roster?: SenateMediaRosterYear[];
  snapshots?: SenateMediaSourceSnapshot[];
  reviews?: SenateMediaReview[];
} = {}) {
  return auditSenateMediaRemarks({
    contexts: options.contexts ?? [context()],
    roster: options.roster ?? [member()],
    snapshots: options.snapshots ?? [snapshot()],
    reviews: options.reviews ?? [review()],
  });
}

test('exact verified named quote needs matching archived raw bytes, passage, issue, person and two independent dates', () => {
  const result = audit();
  assert.equal(result.verifiedAttributedQuotePassages, 1);
  assert.equal(result.reviewResults[0]?.verified, true);
  assert.equal(result.reviewResults[0]?.provenPublicBy, captured);
  assert.equal(result.reviewResults[0]?.publishedAt, published);
  assert.equal(result.reviewResults[0]?.exactQuote, 'Our schools need more funding.');
  assert.equal(result.bySenatorYear[0]?.verifiedPublicationYearQuotes, 1);
  const publisher = result.byPublisherYear.find(x => x.year === 2023 && x.seedId === 'mpr-news-story-archive');
  assert.equal(publisher?.distinctArchivedArticles, 1);
  assert.equal(publisher?.verifiedAttributableQuotes, 1);
  assert.equal(result.byPublisherYear.length, 44 * 5);
  assert.equal(result.policy.stanceInferred, false);
  assert.equal(result.policy.noHistoricalCompletenessCertificate, true);
  assert.equal(result.policy.productionDatabaseRead, false);
});

test('a contextual news mention with no reviewer is unverified even if archive mentioned a senator', () => {
  const result = audit({ reviews: [], snapshots: [] });
  assert.equal(result.verifiedAttributedQuotePassages, 0);
  assert.equal(result.unreviewedArchivedArticles, 1);
  assert.equal(result.bySenatorYear[0]?.archiveArticleMentions, 1);
  assert.equal(result.bySenatorYear[0]?.verifiedPublicationYearQuotes, 0);
  assert.match(result.bySenatorYear[0]!.missingness, /not_no_public_remark/);
});

test('article mentioning senator and quoting a different person cannot become their statement', () => {
  const other = review();
  other.attributionCue = 'A lobbyist said';
  other.sourcePassage = 'A lobbyist said, "Our schools need more funding."';
  const result = audit({ reviews: [other] });
  assert.equal(result.verifiedAttributedQuotePassages, 0);
  assert.ok(result.reviewResults[0]?.failures.includes('passage_not_in_original_article'));
  assert.ok(result.reviewResults[0]?.failures.includes('speaker_not_explicitly_named_in_attribution'));
});

test('caption-like anonymous pronoun, surname-only or absent direct quotation fails closed', () => {
  const bad = review();
  bad.attributionCue = 'They said';
  const result = audit({ reviews: [bad] });
  assert.equal(result.verifiedAttributedQuotePassages, 0);
  assert.ok(result.reviewResults[0]?.failures.includes('speaker_not_explicitly_named_in_attribution'));
  const missing = review(); missing.exactQuote = '';
  assert.ok(audit({ reviews: [missing] }).reviewResults[0]?.failures
    .includes('no_exact_quote_and_named_attribution_passage'));
});

test('a matching DB hash without verified original snapshot cannot prove quotation content', () => {
  const result = audit({ snapshots: [] });
  assert.equal(result.verifiedAttributedQuotePassages, 0);
  assert.ok(result.reviewResults[0]?.failures.includes('original_snapshot_bytes_unavailable'));
});

test('wrong original bytes hash and absent publisher date proof invalidate an otherwise plausible quotation', () => {
  const wrong = Buffer.from(article.replace('funding', 'testing')).toString('base64');
  const result = audit({ snapshots: [{ ...snapshot(), rawBodyBase64: wrong }] });
  assert.equal(result.verifiedAttributedQuotePassages, 0);
  assert.ok(result.reviewResults[0]?.failures.includes('archived_original_bytes_hash_mismatch'));
  const undated = review(); undated.publicationDateProof = '';
  const result2 = audit({ reviews: [undated] });
  assert.ok(result2.reviewResults[0]?.failures.includes('original_publisher_date_proof_missing'));
});

test('publisher date cannot be changed to backdate article before official capture', () => {
  const bad = context();
  bad.publisherPublishedAt = '2023-04-05T00:00:00Z';
  const verdict = audit({ contexts: [bad] });
  assert.equal(verdict.verifiedAttributedQuotePassages, 0);
  assert.ok(verdict.reviewResults[0]?.failures.includes('publisher_publication_date_not_proven'));
  assert.ok(verdict.reviewResults[0]?.failures.includes('publisher_date_after_archive'));
  const unproven = context(); unproven.publisherPublishedAt = null;
  assert.equal(audit({ contexts: [unproven] }).verifiedAttributedQuotePassages, 0);
});

test('member identity or membership dates not matching publication date cannot be borrowed', () => {
  const altered = member(); altered.activeFrom = '2023-04-03';
  const verdict = audit({ roster: [altered] });
  assert.equal(verdict.verifiedAttributedQuotePassages, 0);
  assert.ok(verdict.reviewResults[0]?.failures.includes('senator_not_active_on_publication_date'));
  const unresolved = review(); unresolved.membershipId = 'not-the-senator';
  assert.ok(audit({ reviews: [unresolved] }).reviewResults[0]?.failures
    .includes('unresolved_senate_membership_in_publication_year'));
});

test('bad Wayback path or unstated neutral context cannot acquire a verified remark', () => {
  const c = context(); c.archiveUrl = 'https://web.archive.org/web/20230403101112id_/' + original;
  const result = audit({ contexts: [c] });
  assert.equal(result.verifiedAttributedQuotePassages, 0);
  assert.ok(result.reviewResults[0]?.failures.includes('archive_url_capture_or_evidence_date_mismatch'));
  const c2 = context(); c2.articleInfersLegislativeStance = true;
  assert.ok(audit({ contexts: [c2] }).reviewResults[0]?.failures
    .includes('not_neutral_archived_context'));
});

test('2026 contexts are excluded explicitly rather than counted inside 2025', () => {
  const c = context();
  c.archiveCapturedAt = '2026-01-01T10:11:12Z';
  c.evidencePublishedAt = c.archiveCapturedAt;
  c.archiveUrl = 'https://web.archive.org/web/20260101101112id_/' + original;
  c.sourceUrl = c.archiveUrl;
  const result = audit({ contexts: [c], snapshots: [], reviews: [] });
  assert.equal(result.corpusContextItemsOutsideStudyYears, 1);
  assert.equal(result.corpusContextItemsInSuppliedExport, 0);
  assert.equal(result.verifiedAttributedQuotePassages, 0);
  assert.equal(result.byPublisherYear.every(x => x.exportedContextItems === 0), true);
});

test('multiple verified quote passages can share a source; context item denominator stays one', () => {
  const second = review();
  second.issueCategory = 'education-funding';
  second.exactQuote = 'schools need more funding';
  second.sourcePassage = 'Sen. Example said, "Our schools need more funding."';
  const result = audit({ reviews: [review(), second] });
  assert.equal(result.verifiedAttributedQuotePassages, 2);
  assert.equal(result.distinctArchivedArticlesInExport, 1);
  assert.equal(result.corpusContextItemsInSuppliedExport, 1);
});

test('invalid duplicate input IDs are rejected instead of silently counted as additional remarks', () => {
  assert.throws(() => audit({ contexts: [context(), context()] }), /duplicate media context/);
  assert.throws(() => audit({ reviews: [review(), review()] }), /Duplicate media review verdict/);
  assert.throws(() => audit({ snapshots: [snapshot(), snapshot()] }), /duplicate archived media snapshot/);
  assert.throws(() => audit({ roster: [member(), member()] }), /duplicate senator-year roster/);
});

test('a non-quote review is classification only, never admitted as a direct named quotation', () => {
  const contextual: SenateMediaReview = {
    sourceDocumentId: 'source-1', disposition: 'contextual_mention',
    membershipId: 'membership-23', reviewedBy: 'human-reviewer',
    reviewedAt: '2026-10-10T19:00:00Z',
  };
  const result = audit({ reviews: [contextual] });
  assert.equal(result.verifiedAttributedQuotePassages, 0);
  assert.equal(result.reviewResults[0]?.disposition, 'contextual_mention');
  assert.equal(result.reviewResults[0]?.exactQuote, null);
});
