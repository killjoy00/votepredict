const IGNORED_TOKENS = new Set(['jr','sr','ii','iii','iv','hon','rep','sen','representative','senator']);

function token(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function candidateFinancePersonKey(value: string): string | null {
  const tokens = value
    .split(/\s+/)
    .map(token)
    .filter(Boolean)
    .filter(value => !IGNORED_TOKENS.has(value));
  if (tokens.length < 2) return null;
  const first = tokens.find(value => value.length > 1);
  const last = [...tokens].reverse().find(value => value.length > 1);
  if (!first || !last) return null;
  return first + '|' + last;
}

export interface CandidateFinanceMembershipCandidate {
  membershipId: string;
  memberName: string;
}

export function resolveCandidateFinanceMembership(
  candidateName: string,
  candidates: readonly CandidateFinanceMembershipCandidate[],
): CandidateFinanceMembershipCandidate | null {
  const exact = candidates.filter(candidate =>
    candidate.memberName.trim().toLowerCase() === candidateName.trim().toLowerCase());
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const key = candidateFinancePersonKey(candidateName);
  if (!key) return null;
  const structural = candidates.filter(candidate => candidateFinancePersonKey(candidate.memberName) === key);
  return structural.length === 1 ? structural[0] : null;
}
