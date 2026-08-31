export interface Legislator {
  id: string;
  name: string;
  party: string;
  chamber: 'house' | 'senate';
  district: string;
  title: string;
  imageUrl?: string;
  email?: string;
}

export type RosterSource = 'openstates' | 'minnesota-legislature' | 'verified-snapshot';

export interface LegislatorRoster {
  legislators: Legislator[];
  source: RosterSource;
  asOf: string;
}

export interface Bill {
  id: string;
  number: string;
  title: string;
  session: string;
  sponsors: Array<{ name: string; primary: boolean }>;
  status: string;
  subjects: string[];
  abstract?: string;
  lastActionDate?: string;
  committee?: string;
  sourceUrl?: string;
}

export type PredictedVote = 'yes' | 'no' | 'abstain' | 'uncertain';

export interface LegislatorPrediction {
  legislatorId: string;
  vote: PredictedVote;
  confidence: number;
  reasoning: string;
}

export interface VotePredictionResult {
  billTitle: string;
  billNumber?: string;
  analysis: string;
  houseYes: number;
  houseNo: number;
  houseAbstain: number;
  houseUncertain: number;
  senateYes: number;
  senateNo: number;
  senateAbstain: number;
  senateUncertain: number;
  likelyToPass: boolean;
  passageConfidence: number;
  keyFactors: string[];
  predictions: LegislatorPrediction[];
  methodology: string;
  generatedAt: string;
}
