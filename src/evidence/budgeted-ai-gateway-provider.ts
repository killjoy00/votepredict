import { AiGatewayDeepResearchProvider } from './ai-gateway-provider';
import type { DeepResearchProviderResult, DeepResearchRequest } from './provider';
import { assertExternalUsageBudget, deepResearchDailyLimit, recordExternalUsage } from '@/operations/usage';

export class BudgetedAiGatewayDeepResearchProvider extends AiGatewayDeepResearchProvider {
  override async research(request: DeepResearchRequest): Promise<DeepResearchProviderResult> {
    const provider = this.name;
    const operation = 'deep_research';
    const limit = deepResearchDailyLimit();
    await assertExternalUsageBudget(provider, operation, limit);
    try {
      const result = await super.research(request);
      await recordExternalUsage({
        provider,
        operation,
        forecastId: request.forecastId,
        success: true,
        units: {
          targets: request.targets.length,
          evidenceItems: result.evidence.length,
          sourceReferences: result.sourceReferences?.length ?? 0,
        },
        metadata: { providerVersion: result.providerVersion ?? this.version ?? null, dailyLimit: limit },
      });
      return result;
    } catch (error) {
      await recordExternalUsage({
        provider,
        operation,
        forecastId: request.forecastId,
        success: false,
        units: { targets: request.targets.length },
        error,
        metadata: { providerVersion: this.version ?? null, dailyLimit: limit },
      }).catch(() => undefined);
      throw error;
    }
  }
}
