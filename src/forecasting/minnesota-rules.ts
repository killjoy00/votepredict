import type { PassageRule } from './chamber';

// Ordinary floor-passage baseline only. Special majorities (e.g. certain state
// debt and veto overrides) require a verified measure-specific rule.
// https://www.revisor.mn.gov/constitution/#article_4
// https://www.revisor.mn.gov/statutes/cite/2.021
export function ordinaryMinnesotaPassageRule(chamber: string): PassageRule {
  if (chamber === 'house') return { kind: 'absolute-majority', seats: 134 };
  if (chamber === 'senate') return { kind: 'absolute-majority', seats: 67 };
  throw new Error('Unsupported Minnesota chamber');
}
