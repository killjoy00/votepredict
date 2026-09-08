export interface DriftWindow {
  modelVersion: string;
  sliceKey: string;
  metric: 'brier' | 'mean_absolute_yes_error' | 'calibration_error';
  baselineValue: number;
  observedValue: number;
  sampleSize: number;
}

export interface DriftDecision extends DriftWindow {
  drifted: boolean;
  absoluteDelta: number;
  relativeDegradation: number;
  threshold: number;
  reason: string;
}

export function detectModelDrift(
  window: DriftWindow,
  options: { minimumSampleSize?: number; maximumRelativeDegradation?: number; minimumAbsoluteDelta?: number } = {},
): DriftDecision {
  const minimumSampleSize = options.minimumSampleSize ?? 30;
  const maximumRelativeDegradation = options.maximumRelativeDegradation ?? 0.2;
  const minimumAbsoluteDelta = options.minimumAbsoluteDelta ?? 0.02;
  if (![window.baselineValue, window.observedValue].every((value) => Number.isFinite(value) && value >= 0)) throw new Error('drift metrics must be finite and non-negative');
  const absoluteDelta = window.observedValue - window.baselineValue;
  const relativeDegradation = window.baselineValue === 0 ? (absoluteDelta > 0 ? Number.POSITIVE_INFINITY : 0) : absoluteDelta / window.baselineValue;
  const enoughData = window.sampleSize >= minimumSampleSize;
  const drifted = enoughData && absoluteDelta >= minimumAbsoluteDelta && relativeDegradation >= maximumRelativeDegradation;
  return {
    ...window,
    drifted,
    absoluteDelta,
    relativeDegradation,
    threshold: maximumRelativeDegradation,
    reason: !enoughData
      ? `Only ${window.sampleSize} observations; ${minimumSampleSize} required.`
      : drifted ? `Metric degraded ${(relativeDegradation * 100).toFixed(1)}%.` : 'Metric remains within the configured tolerance.',
  };
}
