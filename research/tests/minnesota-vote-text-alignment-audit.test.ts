import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  MINNESOTA_VOTE_TEXT_AUDIT_VERSION,
  auditVoteTextLinks,
  compareLegislativeVersionTexts,
  discoverRevisorBillTextVersionLeads,
  type VoteTextAuditEvent,
  type AuditedLegislativeText,
  type ProposedVoteTextLink,
} from '../evidence/minnesota-vote-text-alignment-audit.ts';

const HF100_URL = 'https://www.revisor.mn.gov/bills/93/2023/0/HF/100/';
const sourceHash = 'a'.repeat(64);
const textHash = 'b'.repeat(64);

function versionLink(path: string, label: string, date: string): string {
  return '<a href="versions/' + path + '/">' + label
    + '</a> <a href="versions/' + path + '/pdf/">PDF</a> | Posted on ' + date + ' |';
}

test('shadow Revisor audit recovers 13 numbered HF100 versions, two unofficial, two CCR including alphabetic A', () => {
  const html = Array.from({ length: 13 }, (_, ordinal) =>
    versionLink(String(ordinal), ordinal === 0 ? 'Introduction' : ordinal + 'th Engrossment', '04/25/2023'))
    .concat(
      versionLink('ue/1', '1st Unofficial Engrossment', '04/26/2023'),
      versionLink('ue/2', '2nd Unofficial Engrossment', '04/28/2023'),
      versionLink('ccr/0', 'CCR-HF0100', '05/16/2023'),
      versionLink('ccr/A', 'CCR-HF0100A', '05/17/2023'),
    ).join('\n');
  const versions = discoverRevisorBillTextVersionLeads(html, HF100_URL);
  assert.equal(versions.length, 17);
  assert.deepEqual(versions.reduce<Record<string, number>>((counts, row) => {
    counts[row.family] = (counts[row.family] ?? 0) + 1;
    return counts;
  }, {}), { engrossment: 13, unofficial_engrossment: 2, conference_report: 2 });
  assert.deepEqual(versions.at(-1), {
    versionKey: 'CCR-HF0100A', versionPath: 'versions/ccr/A/', family: 'conference_report',
    postedOn: '2023-05-17', textUrl: HF100_URL + 'versions/ccr/A/',
    independentlyVerifiedPublicBy: null,
  });
  assert.equal(versions[0].independentlyVerifiedPublicBy, null);
});

test('official status URL and relative-source identity must match and hostile links fail closed', () => {
  assert.throws(() => discoverRevisorBillTextVersionLeads('', 'https://evil.example/bills/93/2023/0/HF/100/'), /official Revisor/);
  const links = [
    versionLink('ue/1', 'First UE', '04/26/2023'),
    '<a href="https://evil.example/versions/ccr/0/">Evil</a> Posted on 05/16/2023',
    '<a href="/bills/93/2023/0/HF/101/versions/ccr/0/">Other bill</a> Posted on 05/17/2023',
    versionLink('ccr/A', 'CCR-A', '02/30/2023'),
  ].join('\n');
  const versions = discoverRevisorBillTextVersionLeads(links, HF100_URL);
  assert.equal(versions.length, 1);
  assert.equal(versions[0].versionPath, 'versions/ue/1/');
});

test('conflicting source listings for one version path cannot silently overwrite', () => {
  const html = versionLink('ccr/0', 'CCR-A', '05/16/2023')
    + versionLink('ccr/0', 'CCR-B', '05/17/2023');
  assert.throws(() => discoverRevisorBillTextVersionLeads(html, HF100_URL), /Conflicting/);
});

const event: VoteTextAuditEvent = {
  eventKey: 'official:senate:HF100:2023-04-28:roll3',
  session: '2023-2024', chamber: 'senate', occurredOn: '2023-04-28',
  billIdentifier: 'HF100', voteKind: 'passage',
  motionText: 'Question on passage as amended',
  officialSourceUrl: 'https://www.senate.mn/journals/2023-2024/20230428059.pdf',
  officialSourceSha256: sourceHash,
};
const text: AuditedLegislativeText = {
  textId: 'HF100-UE2', session: '2023-2024', billIdentifier: 'HF100',
  kind: 'bill_version', versionKey: '2nd Unofficial Engrossment',
  officialSourceUrl: HF100_URL + 'versions/ue/2/',
  contentSha256: textHash, postedOn: '2023-04-28',
  independentlyVerifiedPublicBy: null, retrievedAt: '2026-10-12T20:00:00Z',
};
const reviewedLink: ProposedVoteTextLink = {
  eventKey: event.eventKey, textId: text.textId,
  proofKind: 'reviewed_official_event_text_match',
  proofUrl: event.officialSourceUrl,
  proofLocator: 'printed Senate Journal 6890, independently reviewed explicit text match',
  proofEventSourceSha256: sourceHash, proofTextSha256: textHash,
};
function one(
  vote = event,
  doc = text,
  link: ProposedVoteTextLink = reviewedLink,
  cutoffAt?: string,
) {
  return auditVoteTextLinks({ events: [vote], texts: [doc], links: [link], cutoffAt })[0];
}

test('no version link is counted as bill-only; numbered bill never becomes a verified text version', () => {
  const output = auditVoteTextLinks({ events: [event], texts: [], links: [] })[0];
  assert.equal(output.status, 'bill_only');
  assert.equal(output.provisionSupportInferred, false);
});

test('strict independent time proof separates historical availability from posting dates', () => {
  const cutoff = '2023-04-28T12:00:00Z';
  const independentReceipt = {
    kind: 'independent_archive_capture' as const,
    sourceUrl: 'https://web.archive.org/web/20230427200100/https://www.revisor.mn.gov/',
    sourceSha256: 'c'.repeat(64),
    locator: 'Synthetic verified archive capture clock, indexed response and original body digest',
  };
  const early = {
    ...text, postedOn: '2023-04-27',
    independentlyVerifiedPublicBy: '2023-04-27T20:01:00Z',
    historicalAvailabilityEvidence: independentReceipt,
  };
  assert.equal(one().status, 'reviewed_exact_text_link');
  assert.equal(one().historicalCutoffEligibility, 'unknown');
  assert.equal(one(event, text, reviewedLink, cutoff).historicalCutoffEligibility, 'unknown');
  assert.equal(one(event, early, reviewedLink, cutoff).historicalCutoffEligibility, 'proven_before_cutoff');
  assert.equal(one(event, {
    ...text, independentlyVerifiedPublicBy: '2023-04-28T15:00:00Z',
    historicalAvailabilityEvidence: independentReceipt,
  }, reviewedLink, cutoff).historicalCutoffEligibility, 'not_proven_before_cutoff');
  assert.equal(one(event, {
    ...early, independentlyVerifiedPublicBy: '2023-04-27T15:01:00-05:00',
  }, reviewedLink, cutoff).historicalCutoffEligibility, 'proven_before_cutoff');

  for (const unsupportedTime of ['2023-04-27', '2023-04-27T20:01:00',
    '2023-02-30T20:01:00Z', '2023-04-27T24:01:00Z', '2023-04-27T20:01:00+15:00']) {
    assert.equal(one(event, { ...early, independentlyVerifiedPublicBy: unsupportedTime },
      reviewedLink, cutoff).historicalCutoffEligibility, 'unknown');
  }
  assert.equal(one(event, { ...early, historicalAvailabilityEvidence: null },
    reviewedLink, cutoff).historicalCutoffEligibility, 'unknown');
  assert.equal(one(event, { ...early, historicalAvailabilityEvidence: {
    ...independentReceipt, sourceSha256: 'not-original-bytes',
  } }, reviewedLink, cutoff).historicalCutoffEligibility, 'unknown');
  assert.equal(one(event, { ...early, historicalAvailabilityEvidence: {
    ...independentReceipt, locator: '',
  } }, reviewedLink, cutoff).historicalCutoffEligibility, 'unknown');
  assert.throws(() => one(event, early, reviewedLink, '2023-04-28'), /Invalid cutoff timestamp/);
  assert.throws(() => one(event, early, reviewedLink, '2023-04-28T12:00:00'), /Invalid cutoff timestamp/);
});


test('date-later enacted or engrossed version is a conflict, not the earlier vote text', () => {
  assert.equal(one(event, { ...text, postedOn: '2023-05-20' }).status, 'later_version_conflict');
});

test('two competing conference report variants must not silently collapse', () => {
  const reportA: AuditedLegislativeText = { ...text, textId: 'CCR-A', kind: 'conference_report', versionKey: 'CCR-HF0100A', postedOn: '2023-05-17' };
  const report0: AuditedLegislativeText = { ...text, textId: 'CCR-0', kind: 'conference_report', versionKey: 'CCR-HF0100', postedOn: '2023-05-16' };
  const vote = { ...event, eventKey: 'cc-2023-05-19', occurredOn: '2023-05-19', voteKind: 'motion' as const };
  const results = auditVoteTextLinks({ events: [vote], texts: [reportA, report0], links: [
    { ...reviewedLink, eventKey: vote.eventKey, textId: reportA.textId },
    { ...reviewedLink, eventKey: vote.eventKey, textId: report0.textId },
  ] });
  assert.equal(results[0].status, 'ambiguous_text_links');
});

test('two different amendment papers using the same A-number do not pass as a unique exact link', () => {
  const vote: VoteTextAuditEvent = {
    ...event, voteKind: 'amendment', amendmentRef: 'A-7',
  };
  const first: AuditedLegislativeText = {
    ...text, textId: 'A7-paper-v1', kind: 'amendment_text', amendmentRef: 'A-7',
  };
  const second: AuditedLegislativeText = {
    ...first, textId: 'A7-paper-v2', contentSha256: 'c'.repeat(64),
  };
  const links: ProposedVoteTextLink[] = [first, second].map((paper) => ({
    ...reviewedLink, textId: paper.textId, proofTextSha256: paper.contentSha256!,
  }));
  const response = auditVoteTextLinks({ events: [vote], texts: [first, second], links });
  assert.equal(response[0].status, 'ambiguous_text_links');
});

test('amendment vote needs exact separate amendment text and reference, not a bill version', () => {
  const amendmentVote: VoteTextAuditEvent = {
    ...event, eventKey: 'amendment-A7', voteKind: 'amendment', amendmentRef: 'A-7',
  };
  const wrongBaseLink = { ...reviewedLink, eventKey: amendmentVote.eventKey };
  assert.equal(one(amendmentVote, text, wrongBaseLink).status, 'missing_amendment_text');
  const amendText: AuditedLegislativeText = {
    ...text, textId: 'amend-A7', kind: 'amendment_text', amendmentRef: 'A-7',
  };
  assert.equal(one(amendmentVote, amendText, { ...wrongBaseLink, textId: amendText.textId }).status, 'reviewed_exact_text_link');
});

test('bill/year conflicts and hash-deficient links fail closed', () => {
  assert.equal(one(event, { ...text, billIdentifier: 'SF73' }).status, 'bill_conflict');
  assert.equal(one(event, text, { ...reviewedLink, proofTextSha256: 'bad' }).status, 'unproven_text_match');
  assert.equal(one(event, text, { ...reviewedLink, proofKind: 'bill_number_only' }).status, 'unproven_text_match');
  assert.equal(one(event, { ...text, contentSha256: null }).status, 'unproven_text_match');
  assert.equal(one(event, text, { ...reviewedLink, textId: 'nonexistent' }).status, 'missing_text_document');
});

test('identical voter slates on six separate motions retain six independently keyed events', () => {
  const amendmentEvents: VoteTextAuditEvent[] = [10, 2, 3, 5, 6, 9].map((amendmentRef, index) => ({
    ...event, eventKey: 'education-2024-02-14:' + index,
    occurredOn: '2024-02-14', voteKind: 'amendment', amendmentRef: '#' + amendmentRef,
  }));
  const outcomes = auditVoteTextLinks({ events: amendmentEvents, texts: [], links: [] });
  assert.equal(outcomes.length, 6);
  assert.equal(new Set(outcomes.map((row) => row.eventKey)).size, 6);
  assert.ok(outcomes.every((row) => row.status === 'bill_only'));
  assert.throws(() => auditVoteTextLinks({ events: [event, event], texts: [], links: [] }), /Duplicate/);
});

test('original-line comparison retains exact digest, both source-sided deltas, and no inferred policy label', () => {
  const before = 'Sec. 1. Eligible students: age 18.\nImplementation: July 1.\nNo appropriation.';
  const after = 'Sec. 1. Eligible students: age 16.\nImplementation: January 1.\nAppropriation: $100.';
  const diff = compareLegislativeVersionTexts(before, after);
  assert.equal(diff.algorithm, MINNESOTA_VOTE_TEXT_AUDIT_VERSION);
  assert.equal(diff.beforeSha256, createHash('sha256').update(before).digest('hex'));
  assert.equal(diff.afterSha256, createHash('sha256').update(after).digest('hex'));
  assert.equal(diff.changedLines, 6);
  assert.deepEqual(diff.changes.filter((row) => row.kind === 'added').map((row) => row.excerpt), after.split('\n'));
  assert.deepEqual(diff.changes.filter((row) => row.kind === 'removed').map((row) => row.excerpt), before.split('\n'));
  assert.equal(diff.policyClassification, 'unclassified');
});

test('large omnibus comparison explicitly asks for section chunking and bounded summaries count omissions', () => {
  const before = Array.from({ length: 1201 }, (_, i) => 'Sec. ' + i).join('\n');
  const outcome = compareLegislativeVersionTexts(before, before + '\nOne more line.');
  assert.equal(outcome.status, 'needs_chunking');
  assert.equal(outcome.changedLines, null);
  const narrow = compareLegislativeVersionTexts('a\nb\nc', 'd\ne\nf', 10, 2);
  assert.equal(narrow.changes.length, 2);
  assert.equal(narrow.omittedChanges, 4);
});

test('review requires the exact archived event source and flags impossible amendment adoption', () => {
  assert.equal(one(event, text, { ...reviewedLink, proofUrl: 'https://example.org/not-the-senate-journal' }).status, 'unproven_text_match');
  const amendmentVote: VoteTextAuditEvent = {
    ...event, eventKey: 'amendment-rejected-A7', voteKind: 'amendment', amendmentRef: 'A-7', passed: false,
  };
  const amendText: AuditedLegislativeText = {
    ...text, textId: 'amend-A7', kind: 'amendment_text', amendmentRef: 'A-7',
  };
  const proposed: ProposedVoteTextLink = {
    ...reviewedLink, eventKey: amendmentVote.eventKey,
    textId: amendText.textId, textDisposition: 'adopted',
  };
  assert.equal(one(amendmentVote, amendText, proposed).status, 'disposition_conflict');
  assert.equal(one(amendmentVote, amendText, { ...proposed, textDisposition: 'rejected' }).status, 'reviewed_exact_text_link');
});

test('unnumbered Senate floor amendments can be linked ONLY through a distinct primary-journal motion anchor', () => {
  const unnumbered: VoteTextAuditEvent = {
    ...event, eventKey: 'hf100-local-retail-motion',
    voteKind: 'amendment', amendmentRef: null,
    officialAmendmentAnchor: 'journal:p6884:action2', passed: true,
  };
  const embeddedPaper: AuditedLegislativeText = {
    ...text, textId: 'hf100-local-retail-proposed-paper',
    kind: 'amendment_text', amendmentRef: null,
    officialAmendmentAnchor: 'journal:p6884:action2',
  };
  const proposed: ProposedVoteTextLink = {
    ...reviewedLink, eventKey: unnumbered.eventKey,
    textId: embeddedPaper.textId, textDisposition: 'adopted',
    proofLocator: 'Journal 6884-6885, action 2: official unnumbered amendment text',
  };
  assert.equal(one(unnumbered, embeddedPaper, proposed).status, 'reviewed_exact_text_link');
  assert.equal(one(unnumbered, { ...embeddedPaper, officialAmendmentAnchor: 'journal:p6886:action3' }, proposed).status, 'missing_amendment_text');
  assert.equal(one({ ...unnumbered, officialAmendmentAnchor: undefined }, embeddedPaper, proposed).status, 'missing_amendment_text');
  assert.equal(one(unnumbered, { ...embeddedPaper, amendmentRef: 'A-7' }, proposed).status, 'missing_amendment_text');
  assert.equal(one(unnumbered, embeddedPaper, { ...proposed, proofEventSourceSha256: undefined }).status, 'unproven_text_match');
  assert.equal(one(unnumbered, embeddedPaper, proposed, '2023-04-28T12:00:00Z').historicalCutoffEligibility, 'unknown');
});

test('unnumbered amendment source anchors cannot be fabricated or shared by two distinct motions', () => {
  const vote: VoteTextAuditEvent = {
    ...event, voteKind: 'amendment', amendmentRef: null,
    officialAmendmentAnchor: 'journal:p6884:action2',
  };
  const duplicate = { ...vote, eventKey: 'second-distinct-official-motion' };
  assert.throws(() => auditVoteTextLinks({ events: [vote, duplicate], texts: [], links: [] }), /duplicate official journal/);
  assert.throws(() => auditVoteTextLinks({ events: [{ ...vote, officialAmendmentAnchor: 'some-ad-hoc-label' }], texts: [], links: [] }), /journal amendment identity/);
  assert.throws(() => auditVoteTextLinks({ events: [vote], texts: [{ ...text, kind: 'amendment_text', officialAmendmentAnchor: 'bad anchor' }], links: [] }), /Invalid original-journal/);
});

test('journal amendment source anchors are scoped to the exact source, not globally across journals', () => {
  const first: VoteTextAuditEvent = {
    ...event, voteKind: 'amendment', amendmentRef: null,
    officialAmendmentAnchor: 'journal:p6884:action2',
  };
  const second: VoteTextAuditEvent = {
    ...first, eventKey: 'separate-source-same-page-and-sequence',
    officialSourceUrl: 'https://www.senate.mn/journals/2023-2024/20230519074.pdf',
  };
  const outcomes = auditVoteTextLinks({ events: [first, second], texts: [], links: [] });
  assert.deepEqual(outcomes.map((row) => row.status), ['bill_only', 'bill_only']);
  assert.throws(() => auditVoteTextLinks({
    events: [first, { ...second, officialSourceUrl: first.officialSourceUrl }],
    texts: [], links: [],
  }), /duplicate official journal amendment identity/);
});
