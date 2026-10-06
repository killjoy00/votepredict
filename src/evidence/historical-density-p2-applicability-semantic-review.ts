export type P2ApplicabilitySemanticDecision =
  | 'applicable'
  | 'not_applicable'
  | 'ambiguous_fail_closed';

export interface P2ApplicabilitySemanticReviewDecision {
  decision: P2ApplicabilitySemanticDecision;
  reasonCode: string;
  billPolicyDirection: string | null;
  alignmentDirection: 'position_aligns_with_bill' | 'position_conflicts_with_bill' | null;
}

const decisions = new Map<string, P2ApplicabilitySemanticReviewDecision>();

function add(
  keys: readonly string[],
  decision: P2ApplicabilitySemanticDecision,
  reasonCode: string,
  billPolicyDirection: string | null = null,
  alignmentDirection: 'position_aligns_with_bill' | 'position_conflicts_with_bill' | null = null,
): void {
  for (const key of keys) {
    if (decisions.has(key)) throw new Error(`Duplicate P2 applicability semantic review key: ${key}`);
    decisions.set(key, { decision, reasonCode, billPolicyDirection, alignmentDirection });
  }
}

add(
  ['gas_tax|HF1684|2021-04-22'],
  'applicable',
  'direct_material_policy_match',
  'indexes_gasoline_excise_tax_upward_with_highway_construction_cost_index',
  'position_conflicts_with_bill',
);

add(
  ['school_choice_parental_control|SF2575|2022-03-03'],
  'applicable',
  'single_purpose_direct_policy_match',
  'expands_parental_notice_of_curriculum_review_and_alternative_instruction_rights',
  'position_aligns_with_bill',
);

add([
  'school_choice_parental_control|HF1065|2021-04-22',
  'long_term_care_protections|HF2128|2021-04-29',
  'long_term_care_protections|SF383|2021-04-29',
  'long_term_care_protections|SF4410|2022-04-26',
], 'ambiguous_fail_closed', 'mixed_omnibus_fail_closed');

add([
  'school_choice_parental_control|SF3534|2022-05-20',
], 'ambiguous_fail_closed', 'specific_policy_present_but_claim_does_not_resolve_direction');

add([
  'long_term_care_protections|SF970|2021-04-15',
], 'ambiguous_fail_closed', 'reform_direction_and_whole_bill_mapping_ambiguous');

add([
  'long_term_care_protections|SF1257|2022-05-17',
], 'ambiguous_fail_closed', 'protective_mechanism_direction_ambiguous');

add([
  'abortion|SF970|2021-04-15',
  'abortion|HF1065|2021-04-22',
  'abortion|HF4300|2022-05-03',
], 'not_applicable', 'fetal_alcohol_false_positive');

add([
  'abortion|HF991|2021-04-28',
  'abortion|HF3669|2022-05-11',
], 'not_applicable', 'stillbirth_definition_not_abortion_policy');

add([
  'abortion|HF2128|2021-04-29',
  'abortion|HF3989|2022-05-12',
], 'not_applicable', 'pregnancy_or_reproductive_health_context_not_abortion_policy');

add([
  'abortion|SF2673|2022-04-25',
  'abortion|HF2725|2022-05-22',
], 'not_applicable', 'unborn_child_criminal_law_not_abortion_policy');

add([
  'abortion|SF383|2021-04-29',
  'abortion|SF4410|2022-04-26',
], 'not_applicable', 'abortion_term_present_without_new_substantive_whole_bill_direction');

add([
  'gas_tax|HF4293|2022-05-02',
  'gas_tax|HF4406|2022-05-09',
], 'not_applicable', 'international_fuel_tax_agreement_reference_not_gas_tax_rate');

add([
  'minnesotacare_for_all|HF1065|2021-04-22',
  'minnesotacare_for_all|HF1952|2021-04-26',
  'minnesotacare_for_all|SF1160|2021-04-27',
  'minnesotacare_for_all|HF2128|2021-04-29',
  'minnesotacare_for_all|SF383|2021-04-29',
  'minnesotacare_for_all|SF4410|2022-04-26',
  'minnesotacare_for_all|HF4293|2022-05-02',
  'minnesotacare_for_all|HF4300|2022-05-03',
  'minnesotacare_for_all|HF4406|2022-05-09',
  'minnesotacare_for_all|SF4116|2022-05-22',
], 'not_applicable', 'existing_enrollee_administration_or_benefit_interaction_not_universal_eligibility_expansion');

add([
  'minnesotacare_for_all|SF519|2021-05-05',
], 'not_applicable', 'application_assistance_without_eligibility_expansion');

add([
  'minnesotacare_for_all|SF3472|2022-03-14',
], 'not_applicable', 'program_funding_without_universal_eligibility_expansion');

add([
  'school_choice_parental_control|SF975|2021-04-14',
  'school_choice_parental_control|HF2128|2021-04-29',
  'school_choice_parental_control|SF383|2021-04-29',
  'school_choice_parental_control|HF3872|2022-05-04',
], 'not_applicable', 'term_hit_incidental_to_nonmatching_policy');

add([
  'school_choice_parental_control|HF4300|2022-05-03',
], 'not_applicable', 'generic_parent_or_nonpublic_school_reference_not_specific_choice_control_direction');

add([
  'school_choice_parental_control|HF4406|2022-05-09',
], 'not_applicable', 'technical_corrections_not_substantive_school_choice_policy');

add([
  'long_term_care_protections|HF333|2021-03-25',
  'long_term_care_protections|SF1846|2021-04-19',
  'long_term_care_protections|HF1077|2021-04-20',
  'long_term_care_protections|HF1952|2021-04-26',
  'long_term_care_protections|SF1160|2021-04-27',
  'long_term_care_protections|HF991|2021-04-28',
  'long_term_care_protections|SF173|2021-05-03',
  'long_term_care_protections|SF2774|2022-02-14',
  'long_term_care_protections|SF2957|2022-02-17',
  'long_term_care_protections|HF4366|2022-04-27',
  'long_term_care_protections|HF4293|2022-05-02',
  'long_term_care_protections|HF4406|2022-05-09',
  'long_term_care_protections|HF3669|2022-05-11',
  'long_term_care_protections|SF3257|2022-05-12',
  'long_term_care_protections|HF3989|2022-05-12',
  'long_term_care_protections|SF3338|2022-05-17',
  'long_term_care_protections|HF1829|2022-05-20',
  'long_term_care_protections|HF3249|2022-05-20',
], 'not_applicable', 'term_hit_in_insurance_tax_housing_admin_or_other_nonprotection_context');

add([
  'long_term_care_protections|SF1098|2021-04-15',
  'long_term_care_protections|SF4091|2022-04-26',
  'long_term_care_protections|SF4091|2022-05-22',
], 'not_applicable', 'building_code_or_frontline_worker_context_not_frozen_resident_protection_claim');

add([
  'long_term_care_protections|SF443|2021-04-21',
], 'not_applicable', 'hospice_predatory_offender_notice_outside_frozen_claim_scope');

add([
  'long_term_care_protections|SF2876|2022-03-21',
], 'not_applicable', 'emergency_staffing_and_waiver_operations_not_specific_resident_protection_claim');

add([
  'long_term_care_protections|SF2673|2022-04-25',
], 'not_applicable', 'vulnerable_adult_financial_exploitation_reference_not_reliable_whole_bill_care_protection_direction');

add([
  'long_term_care_protections|HF4065|2022-05-22',
], 'not_applicable', 'long_term_care_service_recode_not_stronger_resident_protection_claim');

export const P2_APPLICABILITY_SEMANTIC_REVIEW_DECISIONS =
  Object.freeze(Object.fromEntries([...decisions.entries()].sort(([a], [b]) => a.localeCompare(b))));

export function p2ApplicabilityReviewKey(issueFamily: string, identifier: string, occurredOn: string): string {
  return `${issueFamily}|${identifier}|${occurredOn}`;
}
