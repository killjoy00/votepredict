export const MIN_REPLAY_DECISIVE_MEMBER_VOTES = 20;
export const MIN_REPLAY_BILL_TEXT_LENGTH = 100;

export interface HistoricalReplayCase {
  voteEventId: string;
  billId: string;
  billVersionId: string;
  identifier: string;
  title: string;
  session: string;
  chamber: string;
  occurredOn: string;
  cutoff: string;
  billVersionPublishedAt: string;
  billTextLength: number;
  passed: boolean;
  yeaCount: number;
  nayCount: number;
  decisiveMemberVotes: number;
  storedEvidenceCount: number;
  billScopedEvidenceCount: number;
  memberScopedEvidenceCount: number;
  evidenceKinds: string[];
  sourceKinds: string[];
  extractionMethods: string[];
}

export interface ReplayCohortSlice {
  cases: number;
  passed: number;
  failed: number;
  withStoredEvidence: number;
  withoutStoredEvidence: number;
}

export interface ReplayCohortSummary extends ReplayCohortSlice {
  bySessionChamber: Record<string, ReplayCohortSlice>;
}

function parsedUtcDate(value: string): string | undefined {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return parsedUtcDate(`${value}T00:00:00.000Z`) === value;
}

/**
 * Vote events currently retain only a calendar date. To avoid accidentally using
 * same-day information that may have appeared after the target vote, replay inputs
 * must come from an earlier calendar date. Missing or invalid timestamps fail closed.
 */
export function isStrictlyPreVoteTimestamp(
  timestamp: string | null | undefined,
  occurredOn: string,
): boolean {
  if (!timestamp || !isValidCalendarDate(occurredOn)) return false;
  const timestampDate = parsedUtcDate(timestamp);
  return timestampDate !== undefined && timestampDate < occurredOn;
}

/**
 * The replay research cutoff is the end of the calendar day before the official
 * vote date. This is deliberately conservative until vote_events stores vote time.
 */
export function strictPreVoteCutoff(occurredOn: string): string {
  if (!isValidCalendarDate(occurredOn)) {
    throw new Error(`Invalid vote date: ${occurredOn}`);
  }
  const cutoff = new Date(`${occurredOn}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 1);
  return `${cutoff.toISOString().slice(0, 10)}T23:59:59.999Z`;
}

export function replayCaseValidationErrors(replayCase: HistoricalReplayCase): string[] {
  const errors: string[] = [];

  if (!isValidCalendarDate(replayCase.occurredOn)) {
    errors.push('vote date is invalid');
  }
  if (!isStrictlyPreVoteTimestamp(replayCase.billVersionPublishedAt, replayCase.occurredOn)) {
    errors.push('target bill version is not strictly pre-vote');
  }
  if (replayCase.cutoff !== strictPreVoteCutoff(replayCase.occurredOn)) {
    errors.push('research cutoff is not the end of the prior calendar day');
  }
  if (replayCase.billTextLength < MIN_REPLAY_BILL_TEXT_LENGTH) {
    errors.push(`bill text is shorter than ${MIN_REPLAY_BILL_TEXT_LENGTH} characters`);
  }
  if (replayCase.decisiveMemberVotes < MIN_REPLAY_DECISIVE_MEMBER_VOTES) {
    errors.push(`fewer than ${MIN_REPLAY_DECISIVE_MEMBER_VOTES} decisive member votes are available`);
  }
  if (!Number.isInteger(replayCase.yeaCount) || replayCase.yeaCount < 0) {
    errors.push('yea count is invalid');
  }
  if (!Number.isInteger(replayCase.nayCount) || replayCase.nayCount < 0) {
    errors.push('nay count is invalid');
  }
  if (replayCase.storedEvidenceCount < 0 || replayCase.billScopedEvidenceCount < 0 || replayCase.memberScopedEvidenceCount < 0) {
    errors.push('stored evidence counts cannot be negative');
  }

  return errors;
}

function emptySlice(): ReplayCohortSlice {
  return {
    cases: 0,
    passed: 0,
    failed: 0,
    withStoredEvidence: 0,
    withoutStoredEvidence: 0,
  };
}

function addCase(slice: ReplayCohortSlice, replayCase: HistoricalReplayCase): void {
  slice.cases += 1;
  if (replayCase.passed) slice.passed += 1;
  else slice.failed += 1;
  if (replayCase.storedEvidenceCount > 0) slice.withStoredEvidence += 1;
  else slice.withoutStoredEvidence += 1;
}

export function summarizeReplayCohort(cases: readonly HistoricalReplayCase[]): ReplayCohortSummary {
  const total = emptySlice();
  const bySessionChamber: Record<string, ReplayCohortSlice> = {};

  for (const replayCase of cases) {
    addCase(total, replayCase);
    const key = `${replayCase.session}:${replayCase.chamber}`;
    const slice = bySessionChamber[key] ?? emptySlice();
    addCase(slice, replayCase);
    bySessionChamber[key] = slice;
  }

  return {
    ...total,
    bySessionChamber,
  };
}
