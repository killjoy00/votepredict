import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const K = {
  overlapSchema: 'historical-density-2023-24-senate-electronic-minute-target-overlap-v1',
  sourceSchema: 'historical-density-2023-24-senate-electronic-minute-top20-freeze-v1',
  textSchema: 'historical-density-2023-24-senate-top20-text-extraction-v1',
  decisionSchema: 'historical-density-2023-24-senate-top20-semantic-review-tranche-2-decisions-v1',
  packetSchema: 'historical-density-2023-24-senate-top20-semantic-review-tranche-2-packet-v1',
  reviewSchema: 'historical-density-2023-24-senate-top20-semantic-review-tranche-2-v1',
  tranche: 'SENATE-2023-24-TOP20-SEMANTIC-002',
  overlapId: 11501649286,
  overlapDigest: 'sha256:c5ed67e03a2aabb7b41df147beb2d4e814b6db834055387efaf716e3b6ac3f42',
  associationProof: 'dbb3e5e4ce5191ec4fb47aa1f777f72067a3dca7fedefc0871ac41ed341adbf1',
  sourceId: 11502134219,
  sourceDigest: 'sha256:bb6318582f5fb01e9078fbaa6c2b67c43274ca4b4f8f6ced95aa7f9625975d50',
  selectionProof: '1a6bc27b8b8bb433b060abfe213f1db7ad3463902536be5f741ed166b9b84e0f',
  sourceBytesProof: '1f18cc0ff5f5477b4dd3ded5889c2bf6c779ee2276cb5b208492e6ff2610ecf7',
  textId: 11502902302,
  textDigest: 'sha256:c73031633618f4a599a8e1ae1147eb9cd2b429db229335dccef14961a3aa835c',
  textMergeSha: 'b3e91058d1e9071491690d3ca6cde58cf733230c',
  extractionProof: 'ad0e37fc543ec8be11adfdab8c09f6212bc5ba45f4a6af105a2dc2a723f8d9af',
  pdfSha: '4b600090857e7cdd1d69fd609157a4fecf4777e07c616522157c7c112a098d82',
  textSha: 'cdc4b1f22ad4a3d3a0affb75e6d04172898a24da2383d72125886b250e750270',
  reviewKeySha: 'ca408a87707d4f7c951aa271c4436ce1c5be78644d9a2f44e70aecf0f4b124a0',
  packetProof: 'b4637fad80e1903d20dc6cd98ddee9e9154f5a79d45f2379a7c685cb36db7c75',
};
const ALLOWED = [
  'not_applicable_to_candidate_bill',
  'bill_context_only_no_member_direction',
  'directional_member_statement',
  'ambiguous_fail_closed',
];
const sha = (value) => createHash('sha256').update(value).digest('hex');
const setSha = (values) => sha(`${[...values].sort().join('\n')}\n`);
const proof = (value) => sha(JSON.stringify(value));
const json = (path) => JSON.parse(readFileSync(resolve(path), 'utf8'));
const need = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return resolve(value);
};
const ok = (condition, message) => { if (!condition) throw new Error(message); };
function billRegex(identifier) {
  const m = /^(HF|SF)(\d+)$/.exec(identifier);
  ok(m, `Unsupported bill identifier ${identifier}`);
  return new RegExp(`\\b${m[1][0]}\\.?\\s*${m[1][1]}\\.?\\s*${m[2]}\\b`, 'i');
}

const overlapPath = need('VOTEPREDICT_SENATE_2023_24_OVERLAP_PATH');
const sourcePath = need('VOTEPREDICT_SENATE_2023_24_TOP20_FREEZE_PATH');
const textPath = need('VOTEPREDICT_SENATE_2023_24_TOP20_TEXT_EXTRACTION_PATH');
const decisionsPath = resolve(process.env.VOTEPREDICT_SENATE_2023_24_TOP20_SEMANTIC_DECISIONS_PATH
  ?? 'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-2-decisions-v1.json');
const outputDir = resolve(process.env.VOTEPREDICT_SENATE_2023_24_TOP20_SEMANTIC_OUTPUT_DIR
  ?? 'tmp/historical-density-2023-24-senate-top20-semantic-review-tranche-2');
const overlap = json(overlapPath);
const source = json(sourcePath);
const text = json(textPath);
const decisions = json(decisionsPath);

ok(overlap.schemaVersion === K.overlapSchema
  && overlap.overlap?.associationProofSha256 === K.associationProof
  && overlap.overlap?.minuteTargetAssociations === 1727
  && overlap.policy?.targetVoteOutcomesRead === false,
'Canonical overlap drifted');
ok(source.schemaVersion === K.sourceSchema
  && source.sourceOverlap?.artifactId === K.overlapId
  && source.sourceOverlap?.artifactDigest === K.overlapDigest
  && source.selection?.selectionProofSha256 === K.selectionProof
  && source.sourceFreeze?.sourceBytesProofSha256 === K.sourceBytesProof
  && source.sourceFreeze?.documentCount === 20
  && source.policy?.targetVoteOutcomesRead === false,
'Canonical top-20 source freeze drifted');
ok(text.schemaVersion === K.textSchema
  && text.sourceFreeze?.artifactId === K.sourceId
  && text.sourceFreeze?.artifactDigest === K.sourceDigest
  && text.summary?.documents === 20
  && text.summary?.readableEmbeddedTextDocuments === 20
  && text.summary?.insufficientEmbeddedTextDocuments === 0
  && text.summary?.totalTextChars === 63078
  && text.summary?.totalTextWords === 9488
  && text.summary?.extractionProofSha256 === K.extractionProof
  && text.policy?.targetVoteOutcomesRead === false,
'Canonical #792 text extraction drifted');

const sourceDoc = source.sourceFreeze.documents.find((row) => row.rank === 2);
const textDoc = text.documents.find((row) => row.rank === 2);
ok(sourceDoc?.contentSha256 === K.pdfSha
  && textDoc?.pdfContentSha256 === K.pdfSha
  && textDoc?.textSha256 === K.textSha
  && sourceDoc.minuteUrl === textDoc.minuteUrl
  && sourceDoc.allCandidateTargetEventIds?.length === 11,
'Rank-2 source identity drifted');
const fullText = readFileSync(resolve(dirname(textPath), textDoc.archivedTextRelativePath), 'utf8');
ok(sha(fullText) === K.textSha, 'Frozen rank-1 text hash drifted');

const grouped = new Map();
for (const a of overlap.overlap.associations.filter((row) => row.minuteUrl === sourceDoc.minuteUrl)) {
  ok(a.minuteMeetingDate === sourceDoc.minuteMeetingDate
    && a.minuteCommitteeName === sourceDoc.minuteCommitteeName
    && sourceDoc.minuteMeetingDate < a.targetVoteDate,
  `Unsafe association ${a.voteEventId}`);
  grouped.set(a.voteEventId, [...(grouped.get(a.voteEventId) ?? []), a]);
}
const rows = [...grouped.entries()].map(([voteEventId, group]) => {
  const a = group[0];
  ok(group.every((x) => x.billId === a.billId && x.identifier === a.identifier
    && x.targetVoteDate === a.targetVoteDate && x.uncoveredRows === a.uncoveredRows),
  `Conflicting association ${voteEventId}`);
  return {
    reviewKey: [K.pdfSha, K.textSha, voteEventId, a.billId].join('|'),
    documentRank: 2,
    minuteUrl: sourceDoc.minuteUrl,
    minuteCommitteeName: sourceDoc.minuteCommitteeName,
    minuteMeetingDate: sourceDoc.minuteMeetingDate,
    sourcePdfSha256: K.pdfSha,
    sourceTextSha256: K.textSha,
    sourceTextRelativePath: textDoc.archivedTextRelativePath,
    candidateTarget: {
      voteEventId, billId: a.billId, identifier: a.identifier,
      targetVoteDate: a.targetVoteDate, uncoveredRows: a.uncoveredRows,
      referralCommittee: a.referralCommittee, normalizedCommittee: a.normalizedCommittee,
      referralDates: [...new Set(group.map((x) => x.referralDate))].sort(),
    },
  };
}).sort((a, b) => a.candidateTarget.targetVoteDate.localeCompare(b.candidateTarget.targetVoteDate)
  || a.candidateTarget.identifier.localeCompare(b.candidateTarget.identifier)
  || a.candidateTarget.voteEventId.localeCompare(b.candidateTarget.voteEventId));
rows.forEach((row, index) => { row.row = index + 1; });
ok(rows.length === 11
  && setSha(rows.map((row) => row.reviewKey)) === K.reviewKeySha
  && new Set(rows.map((row) => row.candidateTarget.billId)).size === 8
  && JSON.stringify(rows.map((row) => row.candidateTarget.voteEventId).sort())
    === JSON.stringify([...sourceDoc.allCandidateTargetEventIds].sort()),
'Deterministic rank-1 cohort drifted');

const packetCore = {
  issue: 718, session: '2023-2024', trancheId: K.tranche,
  frozenInputs: {
    overlap: { artifactId: K.overlapId, digest: K.overlapDigest, associationProofSha256: K.associationProof },
    sourceFreeze: { artifactId: K.sourceId, digest: K.sourceDigest, selectionProofSha256: K.selectionProof, sourceBytesProofSha256: K.sourceBytesProof },
    textExtraction: { artifactId: K.textId, digest: K.textDigest, sourceCommitSha: K.textMergeSha, extractionProofSha256: K.extractionProof },
  },
  scope: { documentRanks: [2], documents: 1, reviewRows: 11, candidateTargetEvents: 11, candidateBills: 8 },
  reviewKeySha256: K.reviewKeySha,
  documents: [{
    rank: 2, minuteUrl: sourceDoc.minuteUrl, minuteCommitteeName: sourceDoc.minuteCommitteeName,
    minuteMeetingDate: sourceDoc.minuteMeetingDate, sourcePdfSha256: K.pdfSha,
    sourceTextSha256: K.textSha, sourceTextRelativePath: textDoc.archivedTextRelativePath,
    fullExtractedText: fullText,
  }],
  rows,
  allowedDecisionValues: ALLOWED,
  policy: {
    sourceTextFrozen: true, targetVoteOutcomesRead: false, outcomeUse: 'none', decisionsAutoFilled: false,
    deterministicScreenCanDeclareApplicability: false, committeeMembershipUsedAsStance: false,
    attendanceUsedAsStance: false, proceduralActionUsedAsDirectionalStance: false,
    ambiguousDefaultsToFailClosed: true, productionDatabaseQueried: false, productionWrites: false,
    featureRowsWritten: false, modelFitting: 'none', modelWeightChanged: false, servingChanged: false,
    vercelUsed: false, contextOnly: true, mechanicallyActionable: false, modelWeight: 0,
  },
};
const packetProof = proof(packetCore);
ok(packetProof === K.packetProof, `Packet proof drifted: ${packetProof}`);
const packet = { schemaVersion: K.packetSchema, generatedAt: new Date().toISOString(), ...packetCore, reviewPacketProofSha256: packetProof };

ok(decisions.schemaVersion === K.decisionSchema && decisions.issue === 718
  && decisions.session === '2023-2024' && decisions.trancheId === K.tranche
  && decisions.frozenReviewPacket?.reviewRows === 11
  && decisions.frozenReviewPacket?.reviewKeySha256 === K.reviewKeySha
  && decisions.frozenReviewPacket?.reviewPacketProofSha256 === K.packetProof
  && decisions.frozenReviewPacket?.sourcePdfSha256 === K.pdfSha
  && decisions.frozenReviewPacket?.sourceTextSha256 === K.textSha
  && decisions.policy?.everyCandidateReviewed === true
  && decisions.policy?.targetVoteOutcomesRead === false
  && decisions.policy?.proceduralActionUsedAsDirectionalStance === false
  && decisions.policy?.mechanicallyActionable === false,
'Decision manifest drifted');
ok(decisions.directionalRows.length === 0 && decisions.ambiguousFailClosedRows.length === 0,
'Tranche 2 unexpectedly contains directional or ambiguous rows');

const decisionByKey = new Map();
for (const key of decisions.notApplicableReviewKeys) decisionByKey.set(key, {
  decision: ALLOWED[0], reasonCode: 'full_text_review_no_candidate_bill_support',
  billMentionExcerpt: null, billMentionPage: null, attributedMemberName: null, memberDirection: null,
  normalizedClaim: null, supportingExcerpt: null, supportingPage: null,
  notes: decisions.decisionRationales.full_text_review_no_candidate_bill_support,
});
for (const d of decisions.billContextRows) {
  ok(!decisionByKey.has(d.reviewKey), `Duplicate decision ${d.reviewKey}`);
  decisionByKey.set(d.reviewKey, {
    decision: ALLOWED[1], reasonCode: 'candidate_bill_explicitly_present_but_only_procedural_actions_recorded',
    billMentionExcerpt: d.billMentionExcerpt, billMentionPage: d.billMentionPage,
    attributedMemberName: null, memberDirection: null, normalizedClaim: null,
    supportingExcerpt: null, supportingPage: null,
    notes: decisions.decisionRationales.candidate_bill_explicitly_present_but_only_procedural_actions_recorded,
  });
}
ok(decisionByKey.size === 11 && setSha([...decisionByKey.keys()]) === K.reviewKeySha, 'Decisions do not cover exact cohort');

const reviewedRows = rows.map((row) => {
  const d = decisionByKey.get(row.reviewKey);
  ok(d && String(d.notes).trim(), `Missing rationale ${row.reviewKey}`);
  const mentioned = billRegex(row.candidateTarget.identifier).test(fullText);
  if (d.decision === ALLOWED[0]) ok(!mentioned, `Not-applicable bill is present ${row.reviewKey}`);
  if (d.decision === ALLOWED[1]) ok(mentioned && fullText.includes(d.billMentionExcerpt)
    && Number.isInteger(d.billMentionPage) && d.billMentionPage > 0,
  `Context-only provenance invalid ${row.reviewKey}`);
  return { ...row, review: d, sourceTextReviewedInFull: true, contextOnly: true, mechanicallyActionable: false, modelWeight: 0 };
});
const counts = Object.fromEntries(ALLOWED.map((value) => [value, reviewedRows.filter((row) => row.review.decision === value).length]));
ok(counts[ALLOWED[0]] === 11 && counts[ALLOWED[1]] === 0 && counts[ALLOWED[2]] === 0 && counts[ALLOWED[3]] === 0,
`Decision counts drifted ${JSON.stringify(counts)}`);
const reviewedRowProofSha256 = proof(reviewedRows.map((row) => ({
  reviewKey: row.reviewKey, candidateTarget: row.candidateTarget, sourcePdfSha256: row.sourcePdfSha256,
  sourceTextSha256: row.sourceTextSha256, review: row.review, contextOnly: true, mechanicallyActionable: false, modelWeight: 0,
})));
const reviewCore = {
  issue: 718, session: '2023-2024', trancheId: K.tranche,
  frozenReviewPacket: {
    reviewKeySha256: K.reviewKeySha, reviewPacketProofSha256: K.packetProof, reviewRows: 11,
    sourcePdfSha256: K.pdfSha, sourceTextSha256: K.textSha,
    canonicalTextArtifactId: K.textId, canonicalTextArtifactDigest: K.textDigest,
  },
  reviewMethod: 'manual_full_frozen_text_outcome_blind',
  summary: {
    documentsReviewed: 1, reviewRows: 11, candidateTargetEvents: 11, candidateBills: 8,
    decisions: counts, directionalRows: 0, mechanicallyActionableRows: 0,
  },
  reviewedRows, reviewedRowProofSha256,
  policy: {
    targetVoteOutcomesRead: false, outcomeUse: 'none', committeeMembershipUsedAsStance: false,
    attendanceUsedAsStance: false, proceduralActionUsedAsDirectionalStance: false,
    sameDayEvidenceExcludedAbsentOrderingProof: true, ambiguousDefaultsToFailClosed: true, sourceTextFrozen: true,
    productionDatabaseQueried: false, productionWrites: false, featureRowsWritten: false, modelFitting: 'none',
    modelWeightChanged: false, servingChanged: false, vercelUsed: false, contextOnly: true,
    mechanicallyActionable: false, modelWeight: 0, reviewOutputCreatesProductionEvidence: false,
    nextStepBoundary: 'Continue bounded semantic review over the remaining canonical top-20 frozen texts. Do not write feature rows or alter model/serving behavior from these review results.',
  },
};
const reviewProofSha256 = proof(reviewCore);
const report = { schemaVersion: K.reviewSchema, generatedAt: new Date().toISOString(), ...reviewCore, reviewProofSha256 };
mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, `${K.packetSchema}.json`), `${JSON.stringify(packet, null, 2)}\n`);
writeFileSync(resolve(outputDir, `${K.reviewSchema}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ senate2023_24Top20SemanticReviewTranche2: {
  reviewRows: 11, candidateBills: 8, decisions: counts, reviewKeySha256: K.reviewKeySha,
  reviewPacketProofSha256: packetProof, reviewedRowProofSha256, reviewProofSha256,
  targetVoteOutcomesRead: false, mechanicallyActionableRows: 0, featureRowsWritten: false,
} }, null, 2));
