export type P2ApplicabilityScreenPolicy = 'screen_issue_match' | 'reject_claim_too_generic';

export interface P2ApplicabilityClaimRule {
  id: string;
  sourceRows: readonly number[];
  memberName: string;
  stance: 'supports' | 'opposes';
  normalizedClaim: string;
  issueFamily: string;
  screenPolicy: P2ApplicabilityScreenPolicy;
  candidatePatterns: readonly { label: string; source: string }[];
  conservativeReason?: string;
}

export interface P2ApplicabilityPatternHit {
  label: string;
  index: number;
  match: string;
}

export const P2_APPLICABILITY_CLAIM_RULES: readonly P2ApplicabilityClaimRule[] = [
  {
    id: 'p2-school-choice-parental-control',
    sourceRows: [1],
    memberName: 'Andrew Mathews',
    stance: 'supports',
    normalizedClaim: 'Andrew Mathews supports educational accountability, school choice, and parental control in education.',
    issueFamily: 'school_choice_parental_control',
    screenPolicy: 'screen_issue_match',
    candidatePatterns: [
      { label: 'school_choice', source: '\\bschool choice\\b' },
      { label: 'education_savings', source: '\\beducation savings (?:account|program)s?\\b' },
      { label: 'nonpublic_school', source: '\\bnon[- ]?public schools?\\b' },
      { label: 'private_school', source: '\\bprivate schools?\\b' },
      { label: 'parental_education_control', source: '\\bparent(?:al|s)[^.!?]{0,80}\\b(?:education|school)\\b' },
    ],
  },
  {
    id: 'p2-klein-campaign-themes',
    sourceRows: [2],
    memberName: 'Matt D. Klein',
    stance: 'supports',
    normalizedClaim: 'Matt Klein’s campaign emphasized educational opportunity, livable wages, and access to health care.',
    issueFamily: 'education_wages_health_care',
    screenPolicy: 'reject_claim_too_generic',
    candidatePatterns: [],
    conservativeReason: 'Multi-issue campaign theme is not specific enough to infer whole-bill applicability.',
  },
  {
    id: 'p2-westrom-smaller-government-economic-opportunity',
    sourceRows: [3],
    memberName: 'Torrey Westrom',
    stance: 'supports',
    normalizedClaim: 'Torrey Westrom advocates smaller government and expanded economic opportunity.',
    issueFamily: 'government_scope_economic_development',
    screenPolicy: 'reject_claim_too_generic',
    candidatePatterns: [],
    conservativeReason: 'General governing philosophy is not a bill-specific policy position.',
  },
  {
    id: 'p2-frentz-campaign-themes',
    sourceRows: [6],
    memberName: 'Nick A. Frentz',
    stance: 'supports',
    normalizedClaim: 'Nick Frentz’s campaign emphasized education, good jobs, and transportation.',
    issueFamily: 'education_jobs_transportation',
    screenPolicy: 'reject_claim_too_generic',
    candidatePatterns: [],
    conservativeReason: 'Multi-issue campaign theme is not specific enough to infer whole-bill applicability.',
  },
  {
    id: 'p2-coleman-gas-tax',
    sourceRows: [7, 20, 25],
    memberName: 'Julia E. Coleman',
    stance: 'opposes',
    normalizedClaim: 'Julia Coleman explicitly opposes a gas tax increase as part of her stated policy priorities.',
    issueFamily: 'gas_tax',
    screenPolicy: 'screen_issue_match',
    candidatePatterns: [
      { label: 'gas_tax', source: '\\bgas(?:oline)? tax\\b' },
      { label: 'motor_fuel_tax', source: '\\bmotor fuel tax\\b' },
      { label: 'fuel_tax', source: '\\bfuel tax\\b' },
      { label: 'gasoline_tax_near', source: '\\b(?:tax|rate)[^.!?]{0,60}\\bgasoline\\b|\\bgasoline[^.!?]{0,60}\\b(?:tax|rate)\\b' },
    ],
  },
  {
    id: 'p2-murphy-minnesotacare-for-all',
    sourceRows: [11],
    memberName: 'Erin P. Murphy',
    stance: 'supports',
    normalizedClaim: 'Erin Murphy supports making MinnesotaCare available to all Minnesotans and expanding covered care.',
    issueFamily: 'minnesotacare_for_all',
    screenPolicy: 'screen_issue_match',
    candidatePatterns: [{ label: 'minnesotacare', source: '\\bMinnesotaCare\\b' }],
  },
  {
    id: 'p2-jasinski-long-term-care-protections',
    sourceRows: [14],
    memberName: 'John R. Jasinski',
    stance: 'supports',
    normalizedClaim: 'John Jasinski supports stronger protections for seniors and vulnerable adults in long-term care.',
    issueFamily: 'long_term_care_protections',
    screenPolicy: 'screen_issue_match',
    candidatePatterns: [
      { label: 'assisted_living', source: '\\bassisted living\\b' },
      { label: 'long_term_care', source: '\\blong[- ]term care\\b' },
      { label: 'vulnerable_adult', source: '\\bvulnerable adults?\\b' },
      { label: 'nursing_facility', source: '\\bnursing (?:home|facility|facilities)s?\\b' },
      { label: 'elder_care', source: '\\belder care\\b' },
    ],
  },
  {
    id: 'p2-koran-pro-life',
    sourceRows: [15],
    memberName: 'Mark W. Koran',
    stance: 'supports',
    normalizedClaim: 'Mark Koran states a continuing pro-life position.',
    issueFamily: 'abortion',
    screenPolicy: 'screen_issue_match',
    candidatePatterns: [
      { label: 'abortion', source: '\\babortion\\b' },
      { label: 'unborn', source: '\\bunborn\\b' },
      { label: 'fetal', source: '\\bfetal\\b|\\bfetus\\b' },
      { label: 'pregnancy_termination', source: '\\bpregnan(?:cy|t)[^.!?]{0,70}\\b(?:termination|abort)\\w*\\b' },
      { label: 'reproductive_policy', source: '\\breproductive (?:freedom|health|rights)\\b' },
    ],
  },
  {
    id: 'p2-lang-lower-taxes-spending-restraint',
    sourceRows: [16],
    memberName: 'Andrew R. Lang',
    stance: 'supports',
    normalizedClaim: 'Andrew Lang supports lower taxes and greater restraint in state spending.',
    issueFamily: 'taxes_state_spending',
    screenPolicy: 'reject_claim_too_generic',
    candidatePatterns: [],
    conservativeReason: 'Broad fiscal preference cannot establish direction on a specific tax, spending, or omnibus bill.',
  },
  {
    id: 'p2-duckworth-lower-taxes-spending-business',
    sourceRows: [17],
    memberName: 'Zach Duckworth',
    stance: 'supports',
    normalizedClaim: 'Zach Duckworth supports lower taxes, spending restraint, and a competitive business environment.',
    issueFamily: 'taxes_business_regulation_state_spending',
    screenPolicy: 'reject_claim_too_generic',
    candidatePatterns: [],
    conservativeReason: 'Broad fiscal/business preference cannot establish direction on a specific bill.',
  },
  {
    id: 'p2-johnson-economic-community-development',
    sourceRows: [18],
    memberName: 'Mark T. Johnson',
    stance: 'supports',
    normalizedClaim: 'Mark Johnson supports expanding economic opportunities and building vibrant communities.',
    issueFamily: 'economic_community_development',
    screenPolicy: 'reject_claim_too_generic',
    candidatePatterns: [],
    conservativeReason: 'General economic/community-development preference is not specific enough for bill applicability.',
  },
  {
    id: 'p2-coleman-small-business-tax-relief',
    sourceRows: [21, 23],
    memberName: 'Julia E. Coleman',
    stance: 'supports',
    normalizedClaim: 'Julia Coleman supports policies to expand opportunities for small businesses and let owners keep more of their money.',
    issueFamily: 'small_business_taxes',
    screenPolicy: 'reject_claim_too_generic',
    candidatePatterns: [],
    conservativeReason: 'General small-business/tax preference is not specific enough to infer direction on a target bill.',
  },
  {
    id: 'p2-port-minnesotacare-for-all',
    sourceRows: [22],
    memberName: 'Lindsey Port',
    stance: 'supports',
    normalizedClaim: 'Lindsey Port unequivocally supports creating a path to MinnesotaCare for All.',
    issueFamily: 'minnesotacare_for_all',
    screenPolicy: 'screen_issue_match',
    candidatePatterns: [{ label: 'minnesotacare', source: '\\bMinnesotaCare\\b' }],
  },
  {
    id: 'p2-coleman-public-safety-first-responders',
    sourceRows: [24],
    memberName: 'Julia E. Coleman',
    stance: 'supports',
    normalizedClaim: 'Julia Coleman identifies public safety and support for first responders as a top priority.',
    issueFamily: 'public_safety_first_responders',
    screenPolicy: 'reject_claim_too_generic',
    candidatePatterns: [],
    conservativeReason: 'Priority statement does not establish a specific policy direction for public-safety or first-responder bills.',
  },
] as const;

export function applicabilityPatternHits(text: string, rule: P2ApplicabilityClaimRule): P2ApplicabilityPatternHit[] {
  if (rule.screenPolicy !== 'screen_issue_match') return [];
  const hits: P2ApplicabilityPatternHit[] = [];
  for (const pattern of rule.candidatePatterns) {
    const regex = new RegExp(pattern.source, 'i');
    const match = regex.exec(text);
    if (!match || match.index === undefined) continue;
    hits.push({ label: pattern.label, index: match.index, match: match[0] });
  }
  return hits.sort((a, b) => a.index - b.index || a.label.localeCompare(b.label));
}

export function applicabilitySnippet(text: string, hit: P2ApplicabilityPatternHit, radius = 280): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  const needle = hit.match.replace(/\s+/g, ' ').trim();
  const index = compact.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return compact.slice(0, radius * 2);
  const start = Math.max(0, index - radius);
  const end = Math.min(compact.length, index + needle.length + radius);
  return compact.slice(start, end);
}
