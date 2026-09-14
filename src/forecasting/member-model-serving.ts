import { MEMBER_MODEL_VERSION } from './member-model';

export const DECAY180_MEMBER_MODEL_VERSION = 'member-eb-v1.2-decay180' as const;
export const DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS = 180 as const;
export const MEMBER_MODEL_ROLLBACK_ENV = 'VOTEPREDICT_MEMBER_MODEL_ROLLBACK_V11' as const;
export const MEMBER_MODEL_SHADOW_KIND = 'member_model_shadow' as const;

export type ServingMemberModelVersion = typeof MEMBER_MODEL_VERSION | typeof DECAY180_MEMBER_MODEL_VERSION;

export interface ServingMemberModelConfig {
  modelVersion: ServingMemberModelVersion;
  memberHistoryHalfLifeDays: null | typeof DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS;
  shadowModelVersion: ServingMemberModelVersion;
  shadowMemberHistoryHalfLifeDays: null | typeof DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS;
  rollbackActive: boolean;
}

function rollbackRequested(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true' || value?.toLowerCase() === 'yes';
}

/**
 * Decay-180 is the serving default. The legacy v1.1 model remains available as an
 * explicit emergency rollback without changing the frozen v1.1 evaluation helpers.
 * Whichever arm is not serving is persisted as a non-serving member shadow.
 */
export function resolveServingMemberModelConfig(
  env: Pick<NodeJS.ProcessEnv, typeof MEMBER_MODEL_ROLLBACK_ENV> = process.env,
): ServingMemberModelConfig {
  const rollbackActive = rollbackRequested(env[MEMBER_MODEL_ROLLBACK_ENV]);
  if (rollbackActive) {
    return {
      modelVersion: MEMBER_MODEL_VERSION,
      memberHistoryHalfLifeDays: null,
      shadowModelVersion: DECAY180_MEMBER_MODEL_VERSION,
      shadowMemberHistoryHalfLifeDays: DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS,
      rollbackActive: true,
    };
  }
  return {
    modelVersion: DECAY180_MEMBER_MODEL_VERSION,
    memberHistoryHalfLifeDays: DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS,
    shadowModelVersion: MEMBER_MODEL_VERSION,
    shadowMemberHistoryHalfLifeDays: null,
    rollbackActive: false,
  };
}
