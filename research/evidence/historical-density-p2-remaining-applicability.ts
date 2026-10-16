export interface P2RemainingApplicabilityRule {
  semanticKey: string;
  candidatePatterns: readonly { label: string; source: string }[];
}

export interface P2RemainingApplicabilityPatternHit {
  label: string;
  index: number;
  match: string;
}

export const P2_REMAINING_APPLICABILITY_RULES: readonly P2RemainingApplicabilityRule[] = [
  {
    semanticKey: 'coleman_pro_life',
    candidatePatterns: [
      { label: 'abortion', source: '\\babortion\\b' },
      { label: 'unborn', source: '\\bunborn\\b' },
      { label: 'fetal', source: '\\bfetal\\b|\\bfetus\\b' },
      { label: 'reproductive_policy', source: '\\breproductive (?:freedom|health|rights)\\b' },
    ],
  },
  {
    semanticKey: 'mathews_defund_planned_parenthood',
    candidatePatterns: [
      { label: 'planned_parenthood', source: '\\bPlanned Parenthood\\b' },
    ],
  },
  {
    semanticKey: 'mathews_second_amendment',
    candidatePatterns: [
      { label: 'firearm', source: '\\bfirearms?\\b' },
      { label: 'gun', source: '\\bguns?\\b' },
      { label: 'second_amendment', source: '\\bSecond Amendment\\b' },
      { label: 'pistol', source: '\\bpistols?\\b' },
    ],
  },
  {
    semanticKey: 'lang_pro_life',
    candidatePatterns: [
      { label: 'abortion', source: '\\babortion\\b' },
      { label: 'unborn', source: '\\bunborn\\b' },
      { label: 'fetal', source: '\\bfetal\\b|\\bfetus\\b' },
      { label: 'reproductive_policy', source: '\\breproductive (?:freedom|health|rights)\\b' },
    ],
  },
  {
    semanticKey: 'murphy_minimum_wage_15_indexed',
    candidatePatterns: [
      { label: 'minimum_wage', source: '\\bminimum wage\\b' },
      { label: 'minimum_hourly_wage', source: '\\bminimum hourly wage\\b' },
      { label: 'wage_rate', source: '\\bwage rate\\b' },
    ],
  },
  {
    semanticKey: 'jasinski_stand_your_ground',
    candidatePatterns: [
      { label: 'stand_your_ground', source: '\\bstand your ground\\b' },
      { label: 'duty_to_retreat', source: '\\bduty to retreat\\b' },
      { label: 'self_defense', source: '\\bself[- ]defen[cs]e\\b' },
      { label: 'use_of_force', source: '\\buse of (?:deadly )?force\\b' },
    ],
  },
  {
    semanticKey: 'coleman_parental_education_control',
    candidatePatterns: [
      { label: 'parental_education', source: '\\bparent(?:al|s)[^.!?]{0,90}\\b(?:education|school|curriculum)\\b' },
      { label: 'curriculum_review', source: '\\bcurriculum[^.!?]{0,60}\\b(?:review|notice|inspect|access)\\b' },
      { label: 'school_choice', source: '\\bschool choice\\b' },
      { label: 'education_savings', source: '\\beducation savings (?:account|program)s?\\b' },
      { label: 'nonpublic_school', source: '\\bnon[- ]?public schools?\\b' },
      { label: 'private_school', source: '\\bprivate schools?\\b' },
    ],
  },
  {
    semanticKey: 'hoffman_close_corporate_tax_loopholes',
    candidatePatterns: [
      { label: 'corporate_income_tax', source: '\\bcorporate income tax(?:es)?\\b' },
      { label: 'corporate_tax', source: '\\bcorporate tax(?:es)?\\b' },
      { label: 'tax_loophole', source: '\\btax loopholes?\\b' },
      { label: 'corporate_loophole', source: '\\bcorporat(?:e|ion)[^.!?]{0,80}\\bloopholes?\\b' },
    ],
  },
  {
    semanticKey: 'hoffman_hate_crime_penalty_enhancement',
    candidatePatterns: [
      { label: 'hate_crime', source: '\\bhate crimes?\\b' },
      { label: 'bias_motivated', source: '\\bbias[- ]motivated\\b' },
      { label: 'motivated_by_bias', source: '\\bmotivated by bias\\b' },
      { label: 'bias_assault', source: '\\bbias[^.!?]{0,80}\\bassault\\b|\\bassault[^.!?]{0,80}\\bbias\\b' },
    ],
  },
  {
    semanticKey: 'hoffman_gas_tax_opposition',
    candidatePatterns: [
      { label: 'gas_tax', source: '\\bgas(?:oline)? tax\\b' },
      { label: 'motor_fuel_tax', source: '\\bmotor fuel tax\\b' },
      { label: 'fuel_tax', source: '\\bfuel tax\\b' },
      { label: 'gasoline_tax_near', source: '\\b(?:tax|rate)[^.!?]{0,60}\\bgasoline\\b|\\bgasoline[^.!?]{0,60}\\b(?:tax|rate)\\b' },
    ],
  },
  {
    semanticKey: 'hoffman_solar_standard',
    candidatePatterns: [
      { label: 'solar_standard', source: '\\bsolar (?:energy )?standard\\b' },
      { label: 'community_solar', source: '\\bcommunity solar\\b' },
      { label: 'solar_energy', source: '\\bsolar energy\\b' },
      { label: 'solar_garden', source: '\\bsolar garden\\b' },
    ],
  },
  {
    semanticKey: 'utke_gas_tax_opposition',
    candidatePatterns: [
      { label: 'gas_tax', source: '\\bgas(?:oline)? tax\\b' },
      { label: 'motor_fuel_tax', source: '\\bmotor fuel tax\\b' },
      { label: 'fuel_tax', source: '\\bfuel tax\\b' },
      { label: 'gasoline_tax_near', source: '\\b(?:tax|rate)[^.!?]{0,60}\\bgasoline\\b|\\bgasoline[^.!?]{0,60}\\b(?:tax|rate)\\b' },
    ],
  },
  {
    semanticKey: 'utke_law_enforcement_resources',
    candidatePatterns: [
      { label: 'law_enforcement', source: '\\blaw enforcement\\b' },
      { label: 'peace_officer', source: '\\bpeace officers?\\b' },
      { label: 'police', source: '\\bpolice\\b' },
    ],
  },
  {
    semanticKey: 'duckworth_parental_education_choice',
    candidatePatterns: [
      { label: 'parental_education', source: '\\bparent(?:al|s)[^.!?]{0,90}\\b(?:education|school|curriculum)\\b' },
      { label: 'school_choice', source: '\\bschool choice\\b' },
      { label: 'education_savings', source: '\\beducation savings (?:account|program)s?\\b' },
      { label: 'nonpublic_school', source: '\\bnon[- ]?public schools?\\b' },
      { label: 'private_school', source: '\\bprivate schools?\\b' },
    ],
  },
  {
    semanticKey: 'koran_end_emergency_powers',
    candidatePatterns: [
      { label: 'peacetime_emergency', source: '\\bpeacetime emergency\\b' },
      { label: 'emergency_powers', source: '\\bemergency powers?\\b' },
      { label: 'emergency_authority', source: '\\bemergency authority\\b' },
      { label: 'executive_order', source: '\\bexecutive orders?\\b' },
    ],
  },
  {
    semanticKey: 'koran_gas_tax_opposition',
    candidatePatterns: [
      { label: 'gas_tax', source: '\\bgas(?:oline)? tax\\b' },
      { label: 'motor_fuel_tax', source: '\\bmotor fuel tax\\b' },
      { label: 'fuel_tax', source: '\\bfuel tax\\b' },
      { label: 'gasoline_tax_near', source: '\\b(?:tax|rate)[^.!?]{0,60}\\bgasoline\\b|\\bgasoline[^.!?]{0,60}\\b(?:tax|rate)\\b' },
    ],
  },
  {
    semanticKey: 'hoffman_disability_employment_protections',
    candidatePatterns: [
      { label: 'ada', source: '\\bADA\\b|\\bAmericans with Disabilities Act\\b' },
      { label: 'disability_employment', source: '\\bdisabilit(?:y|ies)[^.!?]{0,100}\\b(?:employment|employee|workforce|hiring)\\b' },
      { label: 'reasonable_accommodation', source: '\\breasonable accommodations?\\b' },
      { label: 'state_agency_disability', source: '\\bstate agenc(?:y|ies)[^.!?]{0,120}\\bdisabilit(?:y|ies)\\b|\\bdisabilit(?:y|ies)[^.!?]{0,120}\\bstate agenc(?:y|ies)\\b' },
    ],
  },
] as const;

export function remainingApplicabilityPatternHits(
  text: string,
  rule: P2RemainingApplicabilityRule,
): P2RemainingApplicabilityPatternHit[] {
  const hits: P2RemainingApplicabilityPatternHit[] = [];
  for (const pattern of rule.candidatePatterns) {
    const regex = new RegExp(pattern.source, 'i');
    const match = regex.exec(text);
    if (!match || match.index === undefined) continue;
    hits.push({ label: pattern.label, index: match.index, match: match[0] });
  }
  return hits.sort((a, b) => a.index - b.index || a.label.localeCompare(b.label));
}

export function remainingApplicabilitySnippet(
  text: string,
  hit: P2RemainingApplicabilityPatternHit,
  radius = 280,
): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  const needle = hit.match.replace(/\s+/g, ' ').trim();
  const index = compact.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return compact.slice(0, radius * 2);
  return compact.slice(
    Math.max(0, index - radius),
    Math.min(compact.length, index + needle.length + radius),
  );
}
