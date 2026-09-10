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

// Current-roster display names do not always match the legal/given name used by CFB.
// Keep these deterministic and explicit rather than introducing fuzzy nickname matching.
// Keys and values are normalized person names after titles/suffixes are removed.
const candidateNameAliases = new Map<string, readonly string[]>([
  ['house|bjornolson', ['christianbjornolson']],
  ['house|lizlee', ['kaozouapaelizabethlee']],
  ['senate|jimcarlson', ['jimacarlson', 'jamesacarlson', 'jamescarlson']],
  ['senate|michaelholmstrom', ['michaelholmstrom']],
  ['senate|stevedrazkowski', ['stevenjdrazkowski', 'stevendrazkowski']],
]);

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

export type CampaignFinanceResolutionStatus = 'resolved_with_activity' | 'resolved_without_activity' | 'not_in_activity_snapshot' | 'ambiguous';
export type CampaignFinanceResolutionMethod = 'normalized_full_name' | 'explicit_alias' | 'snapshot_match_key' | 'unique_last_name';

export interface CampaignFinanceMemberResolution {
  membershipId: string;
  memberName: string;
  status: CampaignFinanceResolutionStatus;
  method?: CampaignFinanceResolutionMethod;
  candidateName?: string;
  committeeName?: string;
  registrationNumber?: string;
  context?: CampaignFinanceMemberContext;
}

function normalizeToken(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizedPersonName(value: string): string {
  return value
    .split(/\s+/)
    .map((token) => normalizeToken(token))
    .filter((token) => token && !ignoredNameTokens.has(token))
    .join('');
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

function uniqueCandidate(candidates: readonly CandidateSnapshot[]): CandidateSnapshot | 'ambiguous' | undefined {
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) return 'ambiguous';
  return undefined;
}

function findCandidate(memberName: string, chamber?: string): { candidate?: CandidateSnapshot; method?: CampaignFinanceResolutionMethod; ambiguous?: boolean } {
  const chamberKey = chamber?.toLowerCase();
  const chamberCandidates = chamberKey
    ? snapshot.candidates.filter((candidate) => candidate.chamber === chamberKey)
    : snapshot.candidates;
  const personKey = normalizedPersonName(memberName);

  const fullName = uniqueCandidate(chamberCandidates.filter((candidate) => normalizedPersonName(candidate.candidateName) === personKey));
  if (fullName === 'ambiguous') return { ambiguous: true };
  if (fullName) return { candidate: fullName, method: 'normalized_full_name' };

  if (chamberKey) {
    const aliases = candidateNameAliases.get(`${chamberKey}|${personKey}`);
    if (aliases) {
      const aliasMatch = uniqueCandidate(chamberCandidates.filter((candidate) => aliases.includes(normalizedPersonName(candidate.candidateName))));
      if (aliasMatch === 'ambiguous') return { ambiguous: true };
      if (aliasMatch) return { candidate: aliasMatch, method: 'explicit_alias' };
    }
  }

  const identity = nameIdentity(memberName);
  if (identity.matchKey) {
    const exact = uniqueCandidate(chamberCandidates.filter((candidate) => candidate.matchKey === identity.matchKey));
    if (exact === 'ambiguous') return { ambiguous: true };
    if (exact) return { candidate: exact, method: 'snapshot_match_key' };
  }
  if (!identity.lastNameKey) return {};
  const sameLastName = uniqueCandidate(chamberCandidates.filter((candidate) => candidate.lastNameKey === identity.lastNameKey));
  if (sameLastName === 'ambiguous') return { ambiguous: true };
  return sameLastName ? { candidate: sameLastName, method: 'unique_last_name' } : {};
}

function contextForCandidate(input: { membershipId: string; memberName: string }, candidate: CandidateSnapshot): CampaignFinanceMemberContext | undefined {
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

export function resolveCampaignFinanceMember(input: {
  membershipId: string;
  memberName: string;
  chamber?: string;
}): CampaignFinanceMemberResolution {
  const match = findCandidate(input.memberName, input.chamber);
  if (match.ambiguous) {
    return { membershipId: input.membershipId, memberName: input.memberName, status: 'ambiguous' };
  }
  if (!match.candidate) {
    // The bundled snapshot is activity-derived: absence means no committee row was found
    // in the contribution/IE corpus. It is not proof that roster identity resolution failed.
    return { membershipId: input.membershipId, memberName: input.memberName, status: 'not_in_activity_snapshot' };
  }
  const context = contextForCandidate(input, match.candidate);
  return {
    membershipId: input.membershipId,
    memberName: input.memberName,
    status: context ? 'resolved_with_activity' : 'resolved_without_activity',
    method: match.method,
    candidateName: match.candidate.candidateName,
    committeeName: match.candidate.committeeName,
    registrationNumber: match.candidate.registrationNumber,
    context,
  };
}

export function resolveCampaignFinanceMembers(inputs: readonly {
  membershipId: string;
  memberName: string;
  chamber?: string;
}[]): CampaignFinanceMemberResolution[] {
  return inputs.map(resolveCampaignFinanceMember);
}

export function getCampaignFinanceContextForMember(input: {
  membershipId: string;
  memberName: string;
  chamber?: string;
}): CampaignFinanceMemberContext | undefined {
  return resolveCampaignFinanceMember(input).context;
}

export function getCampaignFinanceContexts(inputs: readonly {
  membershipId: string;
  memberName: string;
  chamber?: string;
}[]): CampaignFinanceMemberContext[] {
  return resolveCampaignFinanceMembers(inputs).flatMap((resolution) => resolution.context ? [resolution.context] : []);
}
