import { createHash } from 'node:crypto';

export const EVIDENCE_QUALITY_ARCHIVE_PROOF_VERSION = 'evidence-quality-pre-vote-archive-proof-v1' as const;

export type EvidenceQualityArchiveProofClassification =
  | 'verified_pre_vote_archive_match'
  | 'archive_exists_but_excerpt_not_found'
  | 'archive_only_after_vote'
  | 'no_archive_capture'
  | 'ambiguous_snapshot'
  | 'non_archive_publication_proof';

export function normalizeArchiveProofText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function archiveProofExcerptFingerprint(excerpt: string): string {
  return createHash('sha256').update(normalizeArchiveProofText(excerpt)).digest('hex');
}

export function archiveTextContainsFrozenExcerpt(snapshotText: string, excerpt: string): boolean {
  const normalizedExcerpt = normalizeArchiveProofText(excerpt);
  if (normalizedExcerpt.length < 80) return false;
  if (normalizedExcerpt.split(' ').filter(Boolean).length < 12) return false;
  const normalizedSnapshot = normalizeArchiveProofText(snapshotText);
  return normalizedSnapshot.includes(normalizedExcerpt);
}

export function strictVoteDateCutoff(occurredOn: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) throw new Error('Vote cutoff must be YYYY-MM-DD');
  const parsed = new Date(occurredOn + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== occurredOn) {
    throw new Error('Invalid vote cutoff date');
  }
  return parsed.toISOString();
}

export function archiveCapturePredatesVote(capturedAt: string, occurredOn: string): boolean {
  const captureMs = Date.parse(capturedAt);
  if (!Number.isFinite(captureMs)) throw new Error('Invalid archive capture timestamp');
  return captureMs < Date.parse(strictVoteDateCutoff(occurredOn));
}
