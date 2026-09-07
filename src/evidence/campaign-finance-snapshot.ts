import snapshotJson from '../../data/cfb-2025-2026-snapshot.json';

interface RankedAmount {
  name: string;
  amount: number;
  count: number;
  type?: string;
  employer?: string;
  direction?: string;
}

interface CandidateSnapshot {
  committeeName: string;
  candidateName: string;
  chamber: string;
  registrationNumber?: string;
  matchKey: string;
  lastNameKey: string;
  contributions: {
    transactionCount: number;
    totalAmount: number;
    latestReceiptDate?: string;
    topContributors: RankedAmount[];
    byContributorType: RankedAmount[];
    topEmployers: RankedAmount[];
  };
  independentExpenditures: {
    transactionCount: number;
    totalAmount: number;
    forAmount: number;
    againstAmount: number;
    latestDate?: string;
    topSpenders: RankedAmount[];
  };
}

interface CampaignFinanceSnapshot {
  schemaVersion: string;
  generatedAt: string;
  cycleYears: number[];
  provenance: {
    landingPage: string;
    contributions: { url: string; contentSha256: string; cycleRows: number };
    independentExpenditures: { url: string; contentSha256: string; cycleRows: number };
  };
  candidates: CandidateSnapshot[];
}

const snapshot = snapshotJson as CampaignFinanceSnapshot;
const ignoredNameTokens = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'hon', 'rep', 'sen', 'representative', 'senator']);

export interface CampaignFinanceMemberContext {
  membershipId: string;
  memberName: string;
  candidateName: string;
  committeeName: string;
  registrationNumber?: string;
  contributions?: {
    sourceUrl: string;
    transactionCount: number;
    totalAmount: number;
    latestReceiptDate?: string;
    topContributors: RankedAmount[];
    byContributorType: RankedAmount[];
    topEmployers: RankedAmount[];
  };
  independentExpenditures?: {
    sourceUrl: string;
    transactionCount: number;
    totalAmount: number;
    forAmount: number;
    againstAmount: number;
    latestDate?: string;
    topSpenders: RankedAmount[];
  };
}

export interface CampaignFinanceSnapshotInfo {
  schemaVersion: string;
  generatedAt: string;
  cycleYears: number[];
  candidateCommitteeCount: number;
  contributionRows: number;
  independentExpenditureRows: number;
}

function normalizeToken(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function nameIdentity(memberName: string): { matchKey?: string; lastNameKey?: string } {
  const tokens = memberName
    .split(/\s+/)
    .map((token) => normalizeToken(token))
    .filter((token) => token && !ignoredNameTokens.has(token));
  if (tokens.length === 0) return {};
  const lastNameKey = tokens[tokens.length - 1];
  const first = tokens.find((token) => token.length > 1) ?? tokens[0];
  return { matchKey: first && lastNameKey ? `${first}|${lastNameKey}` : undefined, lastNameKey };
}

function findCandidate(memberName: string, chamber?: string): CandidateSnapshot | undefined {
  const identity = nameIdentity(memberName);
  const chamberCandidates = chamber
    ? snapshot.candidates.filter((candidate) => candidate.chamber === chamber.toLowerCase())
    : snapshot.candidates;

  if (identity.matchKey) {
    const exact = chamberCandidates.find((candidate) => candidate.matchKey === identity.matchKey);
    if (exact) return exact;
  }
  if (!identity.lastNameKey) return undefined;
  const sameLastName = chamberCandidates.filter((candidate) => candidate.lastNameKey === identity.lastNameKey);
  return sameLastName.length === 1 ? sameLastName[0] : undefined;
}

export function campaignFinanceSnapshotInfo(): CampaignFinanceSnapshotInfo {
  return {
    schemaVersion: snapshot.schemaVersion,
    generatedAt: snapshot.generatedAt,
    cycleYears: [...snapshot.cycleYears],
    candidateCommitteeCount: snapshot.candidates.length,
    contributionRows: snapshot.provenance.contributions.cycleRows,
    independentExpenditureRows: snapshot.provenance.independentExpenditures.cycleRows,
  };
}

export function getCampaignFinanceContextForMember(input: {
  membershipId: string;
  memberName: string;
  chamber?: string;
}): CampaignFinanceMemberContext | undefined {
  const candidate = findCandidate(input.memberName, input.chamber);
  if (!candidate) return undefined;
  const contributions = candidate.contributions.transactionCount > 0
    ? {
        sourceUrl: snapshot.provenance.contributions.url,
        transactionCount: candidate.contributions.transactionCount,
        totalAmount: candidate.contributions.totalAmount,
        latestReceiptDate: candidate.contributions.latestReceiptDate,
        topContributors: candidate.contributions.topContributors,
        byContributorType: candidate.contributions.byContributorType,
        topEmployers: candidate.contributions.topEmployers,
      }
    : undefined;
  const independentExpenditures = candidate.independentExpenditures.transactionCount > 0
    ? {
        sourceUrl: snapshot.provenance.independentExpenditures.url,
        transactionCount: candidate.independentExpenditures.transactionCount,
        totalAmount: candidate.independentExpenditures.totalAmount,
        forAmount: candidate.independentExpenditures.forAmount,
        againstAmount: candidate.independentExpenditures.againstAmount,
        latestDate: candidate.independentExpenditures.latestDate,
        topSpenders: candidate.independentExpenditures.topSpenders,
      }
    : undefined;
  if (!contributions && !independentExpenditures) return undefined;
  return {
    membershipId: input.membershipId,
    memberName: input.memberName,
    candidateName: candidate.candidateName,
    committeeName: candidate.committeeName,
    registrationNumber: candidate.registrationNumber,
    contributions,
    independentExpenditures,
  };
}

export function getCampaignFinanceContexts(inputs: readonly {
  membershipId: string;
  memberName: string;
  chamber?: string;
}[]): CampaignFinanceMemberContext[] {
  return inputs.flatMap((input) => {
    const context = getCampaignFinanceContextForMember(input);
    return context ? [context] : [];
  });
}
