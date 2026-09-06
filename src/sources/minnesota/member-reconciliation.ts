import { normalizeMemberName } from './house-votes';

export interface MembershipCandidate {
  membershipId: string;
  legislatorId: string;
  name: string;
  normalizedName?: string;
  aliases?: string[];
}

export type MembershipResolution =
  | { status: 'matched'; membershipId: string; legislatorId: string; reason: string }
  | { status: 'ambiguous'; candidateMembershipIds: string[]; reason: string }
  | { status: 'unmatched'; reason: string };

function stripHouseTitle(value: string): string {
  return value.replace(/^spk\.?\s+/i, '').replace(/^speaker\s+/i, '').trim();
}

function normalizedAliases(candidate: MembershipCandidate): string[] {
  return [candidate.normalizedName ?? normalizeMemberName(candidate.name), ...(candidate.aliases ?? []).map(normalizeMemberName)]
    .filter(Boolean);
}

function surnameForms(normalizedFullName: string): string[] {
  const tokens = normalizedFullName.split(' ').filter(Boolean);
  if (tokens.length === 0) return [];
  const values = new Set<string>([tokens[tokens.length - 1]]);
  if (tokens.length >= 2) values.add(tokens.slice(-2).join(' '));
  if (tokens.length >= 3) values.add(tokens.slice(-3).join(' '));
  return [...values];
}

function givenInitials(normalizedFullName: string, surname: string): string {
  const fullTokens = normalizedFullName.split(' ').filter(Boolean);
  const surnameTokens = surname.split(' ').filter(Boolean);
  const givenTokens = fullTokens.slice(0, Math.max(0, fullTokens.length - surnameTokens.length));
  return givenTokens.map((token) => token[0]).join('');
}

function uniqueMatched(candidates: MembershipCandidate[], reason: string): MembershipResolution {
  if (candidates.length === 1) {
    return {
      status: 'matched',
      membershipId: candidates[0].membershipId,
      legislatorId: candidates[0].legislatorId,
      reason,
    };
  }
  if (candidates.length > 1) {
    return {
      status: 'ambiguous',
      candidateMembershipIds: candidates.map((candidate) => candidate.membershipId),
      reason,
    };
  }
  return { status: 'unmatched', reason };
}

export function reconcileHouseMemberName(sourceName: string, candidates: MembershipCandidate[]): MembershipResolution {
  const stripped = stripHouseTitle(sourceName);
  const normalizedSource = normalizeMemberName(stripped);
  if (!normalizedSource) return { status: 'unmatched', reason: 'empty normalized source name' };

  const exact = candidates.filter((candidate) => normalizedAliases(candidate).includes(normalizedSource));
  if (exact.length > 0) return uniqueMatched(exact, 'exact normalized name or alias match');

  const commaMatch = stripped.match(/^([^,]+),\s*(.+)$/);
  if (commaMatch) {
    const sourceSurname = normalizeMemberName(commaMatch[1]);
    const sourceInitials = normalizeMemberName(commaMatch[2]).split(' ').filter(Boolean).map((token) => token[0]).join('');
    const initialMatches = candidates.filter((candidate) => {
      return normalizedAliases(candidate).some((alias) => {
        const surname = surnameForms(alias).find((form) => form === sourceSurname);
        if (!surname) return false;
        const candidateInitials = givenInitials(alias, surname);
        return sourceInitials.length > 0 && candidateInitials.startsWith(sourceInitials);
      });
    });
    if (initialMatches.length > 0) return uniqueMatched(initialMatches, 'surname and given-initial match');
  }

  const surnameMatches = candidates.filter((candidate) => {
    return normalizedAliases(candidate).some((alias) => surnameForms(alias).includes(normalizedSource));
  });
  if (surnameMatches.length > 0) return uniqueMatched(surnameMatches, 'unique surname-form match');

  return { status: 'unmatched', reason: 'no conservative roster match' };
}
