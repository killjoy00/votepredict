import { captureMemberHistoryCap20ProspectiveShadow } from './member-history-cap20-prospective-capture';
import { captureQuickEvidenceShadow } from './quick-evidence-shadow';
import { recordCaptureAttempt } from '@/operations/forecast-capture-observability';
import { pool } from '@/lib/db';
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
  // Both initial attempt records committed with the revision and sealed inputs.
  try {
    const cap20=await captureMemberHistoryCap20ProspectiveShadow(request, quick);
    await recordCaptureAttempt(pool,quick.revisionId,'member_cap20',cap20?'completed':'not_applicable');
  } catch (error) {
    await recordCaptureAttempt(pool,quick.revisionId,'member_cap20','failed').catch(()=>{
      console.error('FORECAST_CAPTURE_LEDGER_UNAVAILABLE',{revisionId:quick.revisionId,captureKind:'member_cap20'});
    });
    console.error('Prospective cap-20 shadow capture failed', {
      revisionId: quick.revisionId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    const evidence=await captureQuickEvidenceShadow(request, quick);
    await recordCaptureAttempt(pool,quick.revisionId,'quick_evidence',evidence?'completed':'not_applicable');
  } catch (error) {
    await recordCaptureAttempt(pool,quick.revisionId,'quick_evidence','failed').catch(()=>{
      console.error('FORECAST_CAPTURE_LEDGER_UNAVAILABLE',{revisionId:quick.revisionId,captureKind:'quick_evidence'});
    });
    console.error('Quick Evidence shadow capture failed', {
      revisionId: quick.revisionId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return quick;
}
