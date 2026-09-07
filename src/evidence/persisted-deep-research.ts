import { executeDeepResearch, planDeepResearch, type DeepForecastMember, type DeepResearchContext, type DeepResearchExecution } from './deep-revision';
import type { DeepResearchProvider, DeepResearchSourceReference } from './provider';
import {
  completeResearchRun,
  createResearchRun,
  failResearchRun,
  linkEvidenceToRevision,
  persistEvidenceDiagnostics,
  persistEvidenceItem,
  persistResearchTargets,
} from './repository';

export interface PersistedDeepResearchOptions {
  baseRevisionId?: string;
  resultRevisionId?: string;
  configuration?: Record<string, unknown>;
  materializeSource(reference: DeepResearchSourceReference): Promise<string>;
}

export interface PersistedDeepResearchResult {
  researchRunId: string;
  execution: DeepResearchExecution;
  persistedEvidenceIds: Array<string | undefined>;
  unpersistedEvidenceCount: number;
}

export async function runPersistedDeepResearch(
  members: readonly DeepForecastMember[],
  context: DeepResearchContext,
  provider: DeepResearchProvider,
  options: PersistedDeepResearchOptions,
): Promise<PersistedDeepResearchResult> {
  const targets = planDeepResearch(members, context);
  const researchRunId = await createResearchRun({
    forecastId: context.forecastId,
    baseRevisionId: options.baseRevisionId,
    provider: provider.name,
    providerVersion: provider.version,
    asOf: context.asOf,
    targetLimit: context.targetLimit ?? 12,
    configuration: options.configuration,
  });

  try {
    await persistResearchTargets(researchRunId, targets);
    const execution = await executeDeepResearch(members, context, provider);

    const sourceDocumentByUrl = new Map<string, string>();
    for (const reference of execution.sourceReferences) {
      if (sourceDocumentByUrl.has(reference.url)) continue;
      const sourceDocumentId = await options.materializeSource(reference);
      if (!sourceDocumentId) throw new Error(`Source materialization returned no source document ID for ${reference.url}`);
      sourceDocumentByUrl.set(reference.url, sourceDocumentId);
    }

    const persistedEvidenceIds: Array<string | undefined> = [];
    for (const draft of execution.evidence) {
      const sourceDocumentId = sourceDocumentByUrl.get(draft.sourceUrl);
      if (!sourceDocumentId) {
        persistedEvidenceIds.push(undefined);
        continue;
      }
      persistedEvidenceIds.push(await persistEvidenceItem(sourceDocumentId, draft));
    }

    await persistEvidenceDiagnostics(persistedEvidenceIds, execution.diagnostics.evidence);

    if (options.resultRevisionId) {
      for (let index = 0; index < execution.evidence.length; index += 1) {
        const evidenceItemId = persistedEvidenceIds[index];
        if (!evidenceItemId) continue;
        const draft = execution.evidence[index];
        const memberUpdate = draft.targetMembershipId
          ? execution.memberUpdates.find((update) => update.membershipId === draft.targetMembershipId)
          : undefined;
        const memberEvidenceIndex = memberUpdate?.evidence.indexOf(draft) ?? -1;
        const decision = memberEvidenceIndex >= 0 ? memberUpdate?.evidenceDecisions[memberEvidenceIndex] : undefined;
        await linkEvidenceToRevision({
          revisionId: options.resultRevisionId,
          evidenceItemId,
          membershipId: draft.targetMembershipId,
          disposition: decision?.mechanicallyActionable ? 'included' : 'excluded',
          rationale: decision?.rationale ?? 'Stored as source-backed context; no member-level mechanical impact was applied.',
          probabilityBefore: memberUpdate?.probabilityBefore,
          probabilityAfter: memberUpdate?.probabilityAfter,
          metadata: {
            researchRunId,
            provider: execution.provider,
            providerVersion: execution.providerVersion,
          },
        });
      }
    }

    await completeResearchRun(researchRunId, options.resultRevisionId);
    return {
      researchRunId,
      execution,
      persistedEvidenceIds,
      unpersistedEvidenceCount: persistedEvidenceIds.filter((id) => id === undefined).length,
    };
  } catch (error) {
    await failResearchRun(researchRunId, error);
    throw error;
  }
}
