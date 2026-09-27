import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cfbCandidateFinanceTargetKey,
  isCfbCandidateFinanceMembershipTailRequest,
  selectCfbCandidateFinanceMembershipTail,
} from '../src/evidence/cfb-candidate-finance-membership-tail.js';

test('membership tail excludes completed targets and ranks by resolved rows', () => {
  const groups = [
    { registrationNumber: '100', segmentEndYear: 2024, candidateName: 'A A', chamber: 'house', totalRows: 40, resolvedRows: 40 },
    { registrationNumber: '200', segmentEndYear: 2024, candidateName: 'B B', chamber: 'house', totalRows: 60, resolvedRows: 50 },
    { registrationNumber: '300', segmentEndYear: 2026, candidateName: 'C C', chamber: 'senate', totalRows: 90, resolvedRows: 0 },
    { registrationNumber: '400', segmentEndYear: 2022, candidateName: 'D D', chamber: 'senate', totalRows: 55, resolvedRows: 50 },
  ];
  const selected = selectCfbCandidateFinanceMembershipTail(
    groups,
    new Set([cfbCandidateFinanceTargetKey(groups[1])]),
    10,
  );
  assert.deepEqual(selected.map(group => cfbCandidateFinanceTargetKey(group)), ['400:2022', '100:2024']);
});

test('membership tail enforces a bounded selection size', () => {
  const groups = Array.from({ length: 50 }, (_, index) => ({
    registrationNumber: String(1000 + index),
    segmentEndYear: 2026,
    candidateName: 'Candidate ' + index,
    chamber: 'house',
    totalRows: 100 - index,
    resolvedRows: 100 - index,
  }));
  assert.equal(selectCfbCandidateFinanceMembershipTail(groups, new Set(), 1000).length, 32);
});


test('membership tail trigger recognizes issue-comment and dispatch batch syntax', () => {
  assert.equal(
    isCfbCandidateFinanceMembershipTailRequest(
      '[source-expansion-cfb-candidate-finance] batch=membership-tail continue',
    ),
    true,
  );
  assert.equal(isCfbCandidateFinanceMembershipTailRequest('batch=membership-tail'), true);
  assert.equal(isCfbCandidateFinanceMembershipTailRequest('batch=core'), false);
});
