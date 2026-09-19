import { captureMemberHistoryCap20ProspectiveShadow } from './member-history-cap20-prospective-capture';
import { captureQuickEvidenceShadow } from './quick-evidence-shadow';
import {
  executeRuntimeForecast,
  type ForecastRuntimeRequest,
  type ForecastRuntimeResult,
} from './runtime';

export async function executeQuickRuntimeForecast(
  request: ForecastRuntimeRequest,
): Promise<ForecastRuntimeResult> {
  if (request.researchMode !== 'quick') {
    throw new Error('executeQuickRuntimeForecast requires researchMode=quick');
  }
  const quick = await executeRuntimeForecast(request);
  try {
    await captureMemberHistoryCap20ProspectiveShadow(request, quick);
  } catch (error) {
    console.error('Prospective cap-20 shadow capture failed', {
      revisionId: quick.revisionId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    await captureQuickEvidenceShadow(request, quick);
  } catch (error) {
    console.error('Quick Evidence shadow capture failed', {
      revisionId: quick.revisionId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return quick;
}
