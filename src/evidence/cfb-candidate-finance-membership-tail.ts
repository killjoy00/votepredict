export type CfbCandidateFinanceMembershipTailGroup = {
  registrationNumber: string;
  segmentEndYear: number;
  candidateName: string;
  chamber: string;
  totalRows: number;
  resolvedRows: number;
};

export function cfbCandidateFinanceTargetKey(input: {
  registrationNumber: string;
  segmentEndYear: number;
}): string {
  return input.registrationNumber + ':' + input.segmentEndYear;
}

export function selectCfbCandidateFinanceMembershipTail(
  groups: readonly CfbCandidateFinanceMembershipTailGroup[],
  excludedKeys: ReadonlySet<string>,
  limit: number,
): CfbCandidateFinanceMembershipTailGroup[] {
  const boundedLimit = Math.max(1, Math.min(32, Math.trunc(limit) || 1));
  return groups
    .filter(group =>
      group.resolvedRows > 0
      && !excludedKeys.has(cfbCandidateFinanceTargetKey(group)))
    .sort((left, right) =>
      right.resolvedRows - left.resolvedRows
      || right.totalRows - left.totalRows
      || left.segmentEndYear - right.segmentEndYear
      || left.registrationNumber.localeCompare(right.registrationNumber))
    .slice(0, boundedLimit);
}


export function areResolvableCfbCandidateFinanceRowsPersisted(
  resolvableRowKeys: readonly string[],
  persistedRowKeys: ReadonlySet<string>,
): boolean {
  return resolvableRowKeys.length > 0
    && resolvableRowKeys.every(rowKey => persistedRowKeys.has(rowKey));
}

export function isCfbCandidateFinanceMembershipTailRequest(request?: string | null): boolean {
  return /(?:^|\s)batch=membership-tail(?:\s|$)/i.test(request ?? '');
}
