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

test('zone-less publisher time cannot authenticate a historically available named senator quote',()=>{
  const unstated='2023-04-02T12:00:00';
  const matchingArticle=article.replace(published,unstated);
  const c=context();
  c.publisherPublishedAt=unstated;
  c.sourceSha256=createHash('sha256').update(matchingArticle).digest('hex');
  const v=review();
  v.publisherPublishedAt=unstated;
  v.publicationDateProof='content="'+unstated+'"';
  const result=audit({
    contexts:[c],reviews:[v],
    snapshots:[{sourceDocumentId:'source-1',
      rawBodyBase64:Buffer.from(matchingArticle).toString('base64')}],
  });
  assert.equal(result.verifiedAttributedQuotePassages,0);
  assert.ok(result.reviewResults[0]?.failures.includes('invalid_publisher_date'));
  assert.ok(result.reviewResults[0]?.failures.includes('publisher_publication_date_not_proven'));
  const untimed=context();
  untimed.evidencePublishedAt='2023-04-04T10:11:12'; // not implicitly UTC
  assert.ok(audit({contexts:[untimed]}).reviewResults[0]?.failures
    .includes('archive_url_capture_or_evidence_date_mismatch'));
  const reviewer=review(); reviewer.reviewedAt='2026-10-10T19:00:00';
  assert.throws(()=>audit({reviews:[reviewer]}),/Invalid disposition or missing human media review/);
});

test('invalid calendar instants and impossible offset clocks fail closed instead of rolling dates',()=>{
  const invalid=['2023-02-29T12:00:00Z','2023-04-31T12:00:00Z',
    '2023-04-02T12:00:00+14:30','2023-04-02T12:00:00+25:00',
    '2023-04-02T24:00:00Z','2023-04-02T12:00:00.1234Z'];
  for(const time of invalid) {
    const matchingArticle=article.replace(published,time);
    const c=context();c.publisherPublishedAt=time;
    c.sourceSha256=createHash('sha256').update(matchingArticle).digest('hex');
    const v=review();v.publisherPublishedAt=time;
    v.publicationDateProof='content="'+time+'"';
    const result=audit({
      contexts:[c],reviews:[v],
      snapshots:[{sourceDocumentId:'source-1',
        rawBodyBase64:Buffer.from(matchingArticle).toString('base64')}],
    });
    assert.equal(result.verifiedAttributedQuotePassages,0,time);
    assert.ok(result.reviewResults[0]?.failures.includes('invalid_publisher_date'),time);
    assert.ok(result.reviewResults[0]?.failures.includes('publisher_publication_date_not_proven'),time);
  }
  const invalidArchive=context();
  invalidArchive.archiveUrl='https://web.archive.org/web/20230431101112id_/'+original;
  invalidArchive.sourceUrl=invalidArchive.archiveUrl;
  invalidArchive.archiveCapturedAt='2023-04-31T10:11:12Z';
  invalidArchive.evidencePublishedAt=invalidArchive.archiveCapturedAt;
  const result=audit({contexts:[invalidArchive]});
  assert.equal(result.verifiedAttributedQuotePassages,0);
  assert.ok(result.reviewResults[0]?.failures.includes('archive_url_capture_or_evidence_date_mismatch'));
});

test('senator service and same-surname peers use the publisher LOCAL calendar day, not the UTC day',()=>{
  // April 2 at 11:30 p.m. in a declared -05:00 zone is already April 3 UTC.
  const local='2023-04-02T23:30:00-05:00';
  const datedArticle=article.replace(published,local);
  const c=context();
  c.publisherPublishedAt=local;
  c.sourceSha256=createHash('sha256').update(datedArticle).digest('hex');
  const v=review();
  v.publisherPublishedAt=local;
  v.publicationDateProof='content="'+local+'"';
  const snapshot={sourceDocumentId:'source-1',
    rawBodyBase64:Buffer.from(datedArticle).toString('base64')};
  const accepted=audit({contexts:[c],reviews:[v],snapshots:[snapshot]});
  assert.equal(accepted.verifiedAttributedQuotePassages,1); // valid zoned timestamp
  assert.equal(accepted.bySenatorYear[0]?.verifiedPublicationYearQuotes,1);
  const notYetInSenate=member();notYetInSenate.activeFrom='2023-04-03';
  const blocked=audit({contexts:[c],reviews:[v],snapshots:[snapshot],
    roster:[notYetInSenate]});
  assert.equal(blocked.verifiedAttributedQuotePassages,0);
  assert.ok(blocked.reviewResults[0]?.failures.includes('senator_not_active_on_publication_date'));

  const sameSurnamePeer:SenateMediaRosterYear={
    year:2023,senatorId:'senator-bob',membershipId:'membership-bob-23',
    senatorName:'Bob Example',activeFrom:'2023-04-02',activeThrough:'2023-04-02',
  };
  const ambiguous=audit({contexts:[c],reviews:[v],snapshots:[snapshot],
    roster:[member(),sameSurnamePeer]});
  assert.equal(ambiguous.verifiedAttributedQuotePassages,0);
  assert.ok(ambiguous.reviewResults[0]?.failures
    .includes('ambiguous_senator_surname_requires_full_named_cue'));
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

test('repeated source contexts cannot conceal a non-neutral record and certify an exact quote',()=>{
  const valid=context();
  const bad={...valid,evidenceId:'evidence-2',contextOnly:false,modelWeight:1};
  for(const rows of [[valid,bad],[bad,valid]]) {
    const result=audit({contexts:rows});
    assert.equal(result.corpusContextItemsInSuppliedExport,2);
    assert.equal(result.distinctArchivedArticlesInExport,1);
    assert.equal(result.missingOrInvalidProvenanceArticles,1);
    assert.equal(result.verifiedAttributedQuotePassages,0);
    assert.ok(result.reviewResults[0]?.failures.includes('not_neutral_archived_context'));
    assert.equal(result.byPublisherYear.find(x=>
      x.year===2023 && x.seedId==='mpr-news-story-archive')?.exportedContextItems,2);
  }
  const benign={...valid,evidenceId:'evidence-2',mentionedMembers:['Bob Example']};
  const accepted=audit({contexts:[valid,benign]});
  assert.equal(accepted.corpusContextItemsInSuppliedExport,2);
  assert.equal(accepted.distinctArchivedArticlesInExport,1);
  assert.equal(accepted.verifiedAttributedQuotePassages,1);
  // Distinct context observations do not multiply the one reviewed quote.
  assert.equal(accepted.bySenatorYear[0]?.archiveArticleMentions,1);
});

test('same archived source must not change capture, publisher or publication date between evidence rows',()=>{
  const valid=context();
  const variants=[
    {...valid,evidenceId:'evidence-2',archiveCapturedAt:'2023-04-05T10:11:12Z'},
    {...valid,evidenceId:'evidence-2',publisherPublishedAt:'2023-04-01T12:00:00Z'},
    {...valid,evidenceId:'evidence-2',archiveDigest:'DIFFERENT_ARCHIVE_DIGEST'},
    {...valid,evidenceId:'evidence-2',publisher:'Another Publisher'},
    {...valid,evidenceId:'evidence-2',sourceUrl:'https://web.archive.org/web/bad-id_/'},
  ];
  for(const other of variants)
    for(const rows of [[valid,other],[other,valid]])
      assert.throws(()=>audit({contexts:rows}),
        /Conflicting source identities in media context export/);
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

test('an attributable reporter paraphrase is not a verbatim quotation, even with exact article hash', () => {
  const paraphrased = article.replace('"Our schools need more funding."', 'Our schools need more funding.');
  const contextual = context();
  contextual.sourceSha256 = createHash('sha256').update(Buffer.from(paraphrased)).digest('hex');
  const verdict = review();
  verdict.sourcePassage = 'Sen. Example said, Our schools need more funding.';
  const auditResult = audit({
    contexts: [contextual],
    reviews: [verdict],
    snapshots: [{ sourceDocumentId: 'source-1', rawBodyBase64: Buffer.from(paraphrased).toString('base64') }],
  });
  assert.equal(auditResult.verifiedAttributedQuotePassages, 0);
  assert.ok(auditResult.reviewResults[0]?.failures.includes('claimed_quote_not_delimited_as_direct_speech'));
});

test('invalid reviewer or unsupported media disposition cannot falsely mark a source as reviewed', () => {
  const unreviewed = review();
  unreviewed.reviewedBy = '';
  assert.throws(() => audit({ reviews: [unreviewed] }), /missing human media review/);
  const unexpected = review();
  unexpected.disposition = 'made_up_disposition' as SenateMediaReview['disposition'];
  assert.throws(() => audit({ reviews: [unexpected] }), /Invalid disposition/);
});

test('same-year active senators sharing a surname cannot be resolved from Sen. Surname alone',()=>{
  const duplicate: SenateMediaRosterYear={
    year:2023, senatorId:'senator-bob',membershipId:'membership-bob-23',
    senatorName:'Bob Example',activeFrom:'2023-01-03',activeThrough:'2023-12-31',
  };
  const result=audit({roster:[member(),duplicate]});
  assert.equal(result.verifiedAttributedQuotePassages,0);
  assert.ok(result.reviewResults[0]?.failures
    .includes('ambiguous_senator_surname_requires_full_named_cue'));
});

test('full-name cue in source-authenticated original resolves shared-surname senator uniquely',()=>{
  const fullArticle=article.replace('Sen. Example said','Sen. Alice Example said');
  const c=context(); c.sourceSha256=createHash('sha256').update(fullArticle).digest('hex');
  const v=review();
  v.attributionCue='Sen. Alice Example said';
  v.sourcePassage='Sen. Alice Example said, "Our schools need more funding."';
  const duplicate:SenateMediaRosterYear={
    year:2023, senatorId:'senator-bob',membershipId:'membership-bob-23',
    senatorName:'Bob Example',activeFrom:'2023-01-03',activeThrough:'2023-12-31',
  };
  const result=audit({
    contexts:[c],roster:[member(),duplicate],
    snapshots:[{sourceDocumentId:'source-1',rawBodyBase64:Buffer.from(fullArticle).toString('base64')}],
    reviews:[v],
  });
  assert.equal(result.verifiedAttributedQuotePassages,1);
  assert.equal(result.reviewResults[0]?.verified,true);
});

test('unresolved term of same-surname peer is ambiguous, but known out-of-term peer is not',()=>{
  const uncertain:SenateMediaRosterYear={
    year:2023,senatorId:'senator-bob',membershipId:'membership-bob-23',
    senatorName:'Bob Example',activeFrom:null,activeThrough:null,
  };
  const uncertainResult=audit({roster:[member(),uncertain]});
  assert.equal(uncertainResult.verifiedAttributedQuotePassages,0);
  assert.ok(uncertainResult.reviewResults[0]?.failures
    .includes('ambiguous_senator_surname_requires_full_named_cue'));
  const outOfTerm={...uncertain,activeFrom:'2023-06-01',activeThrough:'2023-12-31'};
  const result=audit({roster:[member(),outOfTerm]});
  assert.equal(result.verifiedAttributedQuotePassages,1);
});

test('a surname embedded inside another last name is not explicit attribution',()=>{
  const changed=article.replace('Sen. Example said','Alice Exampleson said');
  const c=context();c.sourceSha256=createHash('sha256').update(changed).digest('hex');
  const v=review();v.attributionCue='Alice Exampleson said';
  v.sourcePassage='Alice Exampleson said, "Our schools need more funding."';
  const result=audit({
    contexts:[c],reviews:[v],
    snapshots:[{sourceDocumentId:'source-1',rawBodyBase64:Buffer.from(changed).toString('base64')}],
  });
  assert.equal(result.verifiedAttributedQuotePassages,0);
  assert.ok(result.reviewResults[0]?.failures.includes('speaker_not_explicitly_named_in_attribution'));
});

test('one original archive cannot be classified both unavailable and an authenticated named quote',()=>{
  const unavailable:SenateMediaReview={
    sourceDocumentId:'source-1',disposition:'source_unavailable',
    reviewedBy:'reviewer',reviewedAt:'2026-10-10T19:00:00Z',
  };
  for(const order of [[unavailable,review()],[review(),unavailable]]) {
    assert.throws(()=>audit({reviews:order}),/Contradictory media source-unavailable and named-quote reviews/);
  }
  const contextual:SenateMediaReview={
    sourceDocumentId:'source-1',disposition:'contextual_mention',
    reviewedBy:'reviewer',reviewedAt:'2026-10-10T19:00:00Z',
  };
  // Distinct context and exact quote reviews of the same article CAN coexist.
  const accepted=audit({reviews:[contextual,review()]});
  assert.equal(accepted.verifiedAttributedQuotePassages,1);
});


/**
 * Entirely synthetic original-page test. The actual 2024 MPR Hauschild page
 * has NOT been obtained as original Wayback HTML, and this fixture does NOT
 * represent any newly verified public senator quotation or source row.
 */
const transcriptPublished='2024-02-19T10:32:00-06:00';
const transcriptCaptured='2024-02-22T15:00:00Z';
const transcriptOriginal='https://www.mprnews.org/episode/2024/02/19/'
  +'without-total-dfl-support-the-north-star-act-is-going-south';
const transcriptRemark='I feel that immigration is a federal issue.';
const transcriptTurn='GRANT HAUSCHILD: Well, that is exactly right. '
  + transcriptRemark;
const transcriptHost='CATHY WURZER: Do you support the North Star Act?';
const transcriptHtml=(heading=true)=>'<html><head><meta property="article:published_time" content="'
  +transcriptPublished+'"></head><body>'
  +(heading?'<h2>Audio transcript</h2>':'<h2>Publisher interview story</h2>')
  +'<p>'+transcriptHost+'</p><p>'+transcriptTurn+'</p>'
  +'<p>CATHY WURZER: The transcript is only a current synthetic example.</p></body></html>';
function transcriptInputs(html=transcriptHtml(),url=transcriptOriginal){
  const capture='20240222150000';
  const wayback='https://web.archive.org/web/'+capture+'id_/'+url;
  const c:SenateMediaContextExport={
    ...context(),
    sourceDocumentId:'source-transcript',
    evidenceId:'evidence-transcript',
    originalUrl:url,archiveUrl:wayback,sourceUrl:wayback,
    sourceSha256:createHash('sha256').update(html).digest('hex'),
    archiveCapturedAt:transcriptCaptured,
    evidencePublishedAt:transcriptCaptured,
    archiveDigest:'SYNTHETIC-NOT-A-REAL-CDX-DIGEST',
    publisherPublishedAt:transcriptPublished,
    mentionedMembers:['Grant Hauschild'],
  };
  const m:SenateMediaRosterYear={
    year:2024,senatorId:'senator-hauschild',membershipId:'membership-hauschild-24',
    senatorName:'Grant Hauschild',activeFrom:'2023-01-03',activeThrough:'2024-12-31',
  };
  const v:SenateMediaReview={
    sourceDocumentId:c.sourceDocumentId,disposition:'exact_named_quote',
    membershipId:m.membershipId,
    quotePresentation:'speaker_labeled_transcript',
    issueCategory:'immigration-jurisdiction',
    exactQuote:transcriptRemark,
    attributionCue:'GRANT HAUSCHILD:',
    sourcePassage:transcriptTurn,
    publisherPublishedAt:transcriptPublished,
    publicationDateProof:'content="'+transcriptPublished+'"',
    reviewedBy:'synthetic-test-reviewer',reviewedAt:'2026-10-10T19:00:00Z',
  };
  const shot:SenateMediaSourceSnapshot={
    sourceDocumentId:c.sourceDocumentId,rawBodyBase64:Buffer.from(html).toString('base64'),
  };
  return {c,m,v,shot};
}
function transcriptAudit(input:ReturnType<typeof transcriptInputs>){
  return audit({contexts:[input.c],roster:[input.m],
    reviews:[input.v],snapshots:[input.shot]});
}

test('synthetic 2024 first-party MPR speaker turn permits source-text quote only with exact archived bytes and full speaker name',()=>{
  const p=transcriptInputs();
  const verdict=transcriptAudit(p);
  assert.equal(verdict.verifiedAttributedQuotePassages,1);
  assert.equal(verdict.reviewResults[0]?.verified,true);
  assert.equal(verdict.reviewResults[0]?.quotePresentation,'speaker_labeled_transcript');
  assert.equal(verdict.reviewResults[0]?.archivedAudioIndependentlyAuthenticated,false);
  assert.equal(verdict.reviewResults[0]?.publishedAt,transcriptPublished);
  // 3 DAYS AFTER the purported broadcast date: no historical same-day audio/transcript proof!
  assert.equal(verdict.reviewResults[0]?.provenPublicBy,transcriptCaptured);
  assert.equal(verdict.policy.noHistoricalCompletenessCertificate,true);
  assert.equal(verdict.policy.stanceInferred,false);
  assert.equal(verdict.policy.productionDatabaseRead,false);
});

test('without explicit transcript mode an unquoted speaker label is not a reporter direct quotation',()=>{
  const p=transcriptInputs();
  delete p.v.quotePresentation;
  const verdict=transcriptAudit(p);
  assert.equal(verdict.verifiedAttributedQuotePassages,0);
  assert.ok(verdict.reviewResults[0]?.failures
    .includes('claimed_quote_not_delimited_as_direct_speech'));
});

test('speaker-labeled transcript MUST be the original first-party MPR article and contain transcript heading',()=>{
  const foreign=transcriptInputs(transcriptHtml(),
    'https://another-publication.example/episode/2024/02/19/senate-interview');
  const verdict=transcriptAudit(foreign);
  assert.equal(verdict.verifiedAttributedQuotePassages,0);
  assert.ok(verdict.reviewResults[0]?.failures
    .includes('speaker_transcript_requires_original_first_party_mpr_source'));

  const noSection=transcriptInputs(transcriptHtml(false));
  const missing=transcriptAudit(noSection);
  assert.equal(missing.verifiedAttributedQuotePassages,0);
  assert.ok(missing.reviewResults[0]?.failures
    .includes('speaker_transcript_section_not_in_original_article'));
});

test('surname-only speaker label, wrong full senator, or wrong cue cannot borrow a full-name MPR voice',()=>{
  const p=transcriptInputs();
  p.v.attributionCue='HAUSCHILD:';
  const missing=transcriptAudit(p);
  assert.equal(missing.verifiedAttributedQuotePassages,0);
  assert.ok(missing.reviewResults[0]?.failures
    .includes('speaker_transcript_full_member_label_missing'));
  const badMember=transcriptInputs();
  badMember.m.senatorName='Another Hauschild';
  const wrong=transcriptAudit(badMember);
  assert.equal(wrong.verifiedAttributedQuotePassages,0);
  assert.ok(wrong.reviewResults[0]?.failures
    .includes('speaker_transcript_full_member_label_missing'));
});

test('a host next-speaker reply or quote from the other turn cannot be assigned to senator',()=>{
  const p=transcriptInputs();
  const otherVoice='The answer belongs to Cathy Wurzer, not the senator.';
  const html=transcriptHtml().replace(
    'CATHY WURZER: The transcript is only a current synthetic example.',
    'CATHY WURZER: '+otherVoice);
  const x=transcriptInputs(html);
  x.v.sourcePassage=transcriptTurn+' CATHY WURZER: '+otherVoice;
  x.v.exactQuote=otherVoice;
  const result=transcriptAudit(x);
  assert.equal(result.verifiedAttributedQuotePassages,0);
  assert.ok(result.reviewResults[0]?.failures
    .includes('speaker_transcript_quote_outside_named_senator_turn'));
  assert.equal(x.v.sourcePassage!.includes(x.v.exactQuote!),true);
  assert.equal(p.v.exactQuote,transcriptRemark);
});

test('unverified original bytes, changed hash and future-senator service date still reject labeled transcripts',()=>{
  const p=transcriptInputs();
  const noBytes=audit({contexts:[p.c],roster:[p.m],reviews:[p.v],snapshots:[]});
  assert.equal(noBytes.verifiedAttributedQuotePassages,0);
  assert.ok(noBytes.reviewResults[0]?.failures.includes('original_snapshot_bytes_unavailable'));

  const changed=transcriptInputs();
  changed.c.sourceSha256='0'.repeat(64);
  const mismatch=transcriptAudit(changed);
  assert.equal(mismatch.verifiedAttributedQuotePassages,0);
  assert.ok(mismatch.reviewResults[0]?.failures.includes('archived_original_bytes_hash_mismatch'));

  const notSworn=transcriptInputs();
  notSworn.m.activeFrom='2024-02-20';
  const invalidMember=transcriptAudit(notSworn);
  assert.equal(invalidMember.verifiedAttributedQuotePassages,0);
  assert.ok(invalidMember.reviewResults[0]?.failures.includes('senator_not_active_on_publication_date'));
});

test('transcript cannot use undated publication, after-capture article time or missing human reviewed issue',()=>{
  const bad=transcriptInputs();
  bad.v.publisherPublishedAt='2024-02-19T10:32:00'; // missing publisher timezone
  assert.equal(transcriptAudit(bad).verifiedAttributedQuotePassages,0);
  const after=transcriptInputs();
  after.c.publisherPublishedAt='2024-02-23T10:32:00Z';
  after.v.publisherPublishedAt=after.c.publisherPublishedAt;
  assert.equal(transcriptAudit(after).verifiedAttributedQuotePassages,0);
  const noIssue=transcriptInputs();
  noIssue.v.issueCategory='';
  assert.ok(transcriptAudit(noIssue).reviewResults[0]?.failures.includes('issue_not_reviewed'));
  const unsupported=transcriptInputs();
  unsupported.v.quotePresentation='asserted_from_live_audio' as SenateMediaReview['quotePresentation'];
  assert.ok(transcriptAudit(unsupported).reviewResults[0]?.failures
    .includes('unsupported_direct_quote_presentation'));
});

