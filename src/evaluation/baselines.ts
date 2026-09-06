export interface HistoricalMemberVote {
  memberId: string;
  party: string;
  occurredAt: string;
  outcome: 0 | 1;
}

export interface BaselineContext {
  priorVotes: HistoricalMemberVote[];
}

function mean(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

export function globalRateBaseline(context: BaselineContext, fallback = 0.5): number {
  return mean(context.priorVotes.map((vote) => vote.outcome)) ?? fallback;
}

export function partyRateBaseline(context: BaselineContext, party: string, fallback = 0.5): number {
  const partyRate = mean(context.priorVotes.filter((vote) => vote.party === party).map((vote) => vote.outcome));
  return partyRate ?? globalRateBaseline(context, fallback);
}

export function memberHistoryBaseline(
  context: BaselineContext,
  memberId: string,
  party: string,
  options: { priorStrength?: number; fallback?: number } = {},
): number {
  const priorStrength = options.priorStrength ?? 4;
  if (priorStrength < 0) throw new Error('priorStrength cannot be negative');
  const partyPrior = partyRateBaseline(context, party, options.fallback ?? 0.5);
  const memberVotes = context.priorVotes.filter((vote) => vote.memberId === memberId);
  const yesCount = memberVotes.reduce((sum, vote) => sum + vote.outcome, 0);
  return (yesCount + priorStrength * partyPrior) / (memberVotes.length + priorStrength);
}

export function priorVotesOnly(votes: readonly HistoricalMemberVote[], occurredAt: string): HistoricalMemberVote[] {
  return votes.filter((vote) => vote.occurredAt < occurredAt);
}
