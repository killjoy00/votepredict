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
}

export interface LegislatorPrediction {
  legislatorId: string;
  vote: 'yes' | 'no' | 'abstain';
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
  senateYes: number;
  senateNo: number;
  senateAbstain: number;
  likelyToPass: boolean;
  passageConfidence: number;
  keyFactors: string[];
  predictions: LegislatorPrediction[];
  generatedAt: string;
}
