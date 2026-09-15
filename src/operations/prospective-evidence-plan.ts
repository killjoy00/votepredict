export const PROSPECTIVE_EVIDENCE_PLAN_VERSION = 'production-prospective-evidence-plan-v1' as const;
export const PROSPECTIVE_EVIDENCE_OWNER_USER_ID = 'system:prospective-evidence-v1' as const;
export const PROSPECTIVE_EVIDENCE_SESSION = '2027-2028' as const;
export const PROSPECTIVE_EVIDENCE_RESEARCH_MODE = 'quick' as const;
export const PROSPECTIVE_EVIDENCE_CADENCE_HOURS = 24 as const;
export const PROSPECTIVE_EVIDENCE_SEED_LIMIT = 10 as const;
export const PROSPECTIVE_EVIDENCE_STARTING_MEMBER_MODEL_VERSION = 'member-eb-v1.2-decay180' as const;

export function prospectiveEvidenceTarget(chamber: 'house' | 'senate'): {
  targetKind: 'house_floor_passage' | 'senate_floor_passage';
  conditionalOn: 'a House floor vote' | 'a Senate floor vote';
} {
  return chamber === 'house'
    ? { targetKind: 'house_floor_passage', conditionalOn: 'a House floor vote' }
    : { targetKind: 'senate_floor_passage', conditionalOn: 'a Senate floor vote' };
}
