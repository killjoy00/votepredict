export type NormalizedVoteChoice = 'yea' | 'nay' | 'other';
export type NormalizedVoteKind = 'passage' | 'amendment' | 'motion' | 'procedural' | 'other';

export interface NormalizedMemberVote {
  sourceName: string;
  normalizedName: string;
  choice: NormalizedVoteChoice;
  sourceOrdinal: number;
}

export interface NormalizedVoteEvent {
  externalKey: string;
  billIdentifier: string;
  voteKind: NormalizedVoteKind;
  isPassage: boolean;
  motionText: string;
  amendmentRef?: string;
  occurredOn: string;
  journalPage?: string;
  yeaCount: number;
  nayCount: number;
  otherCount: number;
  memberVotes: NormalizedMemberVote[];
  sourceUrl: string;
}

export interface HouseVoteBillLink {
  billIdentifier: string;
  sessionKey: string;
  sourceUrl: string;
}
