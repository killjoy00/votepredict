export type CfbCandidateFinanceTarget = {
  registrationNumber: string;
  segmentEndYear: number;
};

const TARGET_BATCHES = {
  core: [
    { registrationNumber: '15677', segmentEndYear: 2022 },
    { registrationNumber: '15677', segmentEndYear: 2024 },
    { registrationNumber: '15677', segmentEndYear: 2026 },
    { registrationNumber: '19238', segmentEndYear: 2026 },
  ],
  'recent-high-volume-1': [
    { registrationNumber: '18873', segmentEndYear: 2026 },
    { registrationNumber: '16553', segmentEndYear: 2026 },
    { registrationNumber: '18781', segmentEndYear: 2026 },
    { registrationNumber: '18129', segmentEndYear: 2026 },
    { registrationNumber: '18430', segmentEndYear: 2026 },
    { registrationNumber: '18796', segmentEndYear: 2026 },
    { registrationNumber: '17868', segmentEndYear: 2026 },
    { registrationNumber: '18845', segmentEndYear: 2026 },
  ],
  'recent-high-volume-2': [
    { registrationNumber: '18749', segmentEndYear: 2026 },
    { registrationNumber: '19214', segmentEndYear: 2026 },
    { registrationNumber: '19069', segmentEndYear: 2026 },
    { registrationNumber: '19314', segmentEndYear: 2026 },
    { registrationNumber: '19368', segmentEndYear: 2026 },
    { registrationNumber: '19119', segmentEndYear: 2026 },
    { registrationNumber: '19205', segmentEndYear: 2026 },
    { registrationNumber: '19227', segmentEndYear: 2026 },
  ],
  'recent-high-volume-3': [
    { registrationNumber: '19193', segmentEndYear: 2026 },
    { registrationNumber: '18332', segmentEndYear: 2026 },
    { registrationNumber: '19199', segmentEndYear: 2026 },
    { registrationNumber: '19281', segmentEndYear: 2026 },
    { registrationNumber: '18727', segmentEndYear: 2026 },
    { registrationNumber: '18550', segmentEndYear: 2026 },
    { registrationNumber: '18917', segmentEndYear: 2026 },
    { registrationNumber: '17316', segmentEndYear: 2026 },
  ],
} as const satisfies Record<string, readonly CfbCandidateFinanceTarget[]>;

export type CfbCandidateFinanceTargetBatchName = keyof typeof TARGET_BATCHES;

export function cfbCandidateFinanceTargetBatchNames(): CfbCandidateFinanceTargetBatchName[] {
  return Object.keys(TARGET_BATCHES) as CfbCandidateFinanceTargetBatchName[];
}

export function resolveCfbCandidateFinanceTargetBatch(
  request?: string | null,
): {
  name: CfbCandidateFinanceTargetBatchName;
  targets: readonly CfbCandidateFinanceTarget[];
} {
  const match = request?.match(/(?:^|\s)batch=([a-z0-9-]+)(?:\s|$)/i);
  const requested = (match?.[1]?.toLowerCase() ?? 'core') as CfbCandidateFinanceTargetBatchName;
  if (!Object.prototype.hasOwnProperty.call(TARGET_BATCHES, requested)) {
    throw new Error(
      'Unknown CFB candidate-finance target batch: ' + requested
      + '. Allowed: ' + cfbCandidateFinanceTargetBatchNames().join(', '),
    );
  }
  return {
    name: requested,
    targets: TARGET_BATCHES[requested],
  };
}
