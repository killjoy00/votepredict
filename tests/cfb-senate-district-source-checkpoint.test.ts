import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = 'docs/evaluation/source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json';
type Ledger = {
  provenance: Record<string, any>;
  sourceCoverage: { pagesAttempted: number; pagesAcquiredAndParsed: number; sourceFailures: number; bySegment: Array<{year:number;pages:number;pagesWithVisibleCandidates:number;pagesWithoutVisibleCandidates:number;observedIds:number;sourceEmptyDistricts?:number[]}> };
  observedCandidateRegistrationIndex: {
    distinctRegistrations: number;
    observedOnlyIn2026Segment: number;
    observedIn2020Or2022Or2024: number;
    registrationIdsCsv: string;
    segmentMembershipMaskHex: string;
    bitBySegment: Record<string, number>;
    registrationIdsNewlineSha256: string;
    registrationMaskHexSha256: string;
    registrationKeyColonMaskLinesSha256: string;
    knownOriginalReportControlIds: string[];
    sameNameDifferentRegistrationIds: Array<{name:string;ids:string[]}>;
    sameRegistrationDifferentNameCount: number;
  };
  historicalDenominator: Record<string, unknown>;
  safeguards: Record<string, unknown>;
};
function load(): Ledger {
  return JSON.parse(readFileSync(source, 'utf8')) as Ledger;
}
function sha(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
function registrations(ledger: Ledger) {
  const index = ledger.observedCandidateRegistrationIndex;
  const ids = index.registrationIdsCsv.split(',');
  const masks = [...index.segmentMembershipMaskHex].map(ch => Number.parseInt(ch, 16));
  return {index, ids, masks};
}

test('all 494 observed official numeric registration IDs and segment masks are cryptographically pinned', () => {
  const ledger = load();
  const {index, ids, masks} = registrations(ledger);
  assert.equal(ids.length, 494);
  assert.equal(masks.length, 494);
  assert.equal(index.distinctRegistrations, 494);
  assert.equal(new Set(ids).size, 494);
  assert.deepEqual(ids, [...ids].sort());
  assert.ok(ids.every(id => /^\d{3,8}$/.test(id)));
  assert.ok(masks.every(mask => Number.isInteger(mask) && mask > 0 && mask < 16));
  assert.equal(sha(ids.join('\n')), index.registrationIdsNewlineSha256);
  assert.equal(sha(index.segmentMembershipMaskHex), index.registrationMaskHexSha256);
  assert.equal(sha(ids.map((id, i) => id + ':' + masks[i]!.toString(16)).join('\n')),
    index.registrationKeyColonMaskLinesSha256);
  assert.equal(index.registrationIdsNewlineSha256, 'cc6f3830ee1730a31781f282b5ecca0deba8ebfec50c949b28b8ae5f9cf497a3');
  assert.equal(index.registrationMaskHexSha256, 'c70219a32a752e024d95d4d318cb43daa33bf45e5c3a2634b6652f7019aca91c');
});

test('268 original source page captures span 67 Senate districts and four viewer segments', () => {
  const ledger = load();
  const {index, masks} = registrations(ledger);
  assert.equal(ledger.sourceCoverage.pagesAttempted, 268);
  assert.equal(ledger.sourceCoverage.pagesAcquiredAndParsed, 268);
  assert.equal(ledger.sourceCoverage.sourceFailures, 0);
  assert.deepEqual(ledger.sourceCoverage.bySegment.map(x => x.pages), [67, 67, 67, 67]);
  assert.deepEqual(ledger.sourceCoverage.bySegment.map(x => x.year), [2020, 2022, 2024, 2026]);
  assert.deepEqual(ledger.sourceCoverage.bySegment.map(x => x.observedIds), [231, 270, 126, 249]);
  for (const row of ledger.sourceCoverage.bySegment) {
    const n = masks.filter(mask => Boolean(mask & index.bitBySegment[String(row.year)])).length;
    assert.equal(n, row.observedIds);
    assert.equal(row.pagesWithVisibleCandidates + row.pagesWithoutVisibleCandidates, 67);
    assert.equal(row.pagesWithoutVisibleCandidates, row.sourceEmptyDistricts?.length ?? 0);
  }
});

test('2026-only observed IDs and apparent empty pages cannot become historical reporting obligations', () => {
  const ledger = load();
  const {index, masks} = registrations(ledger);
  assert.equal(masks.filter(mask => mask === 8).length, 134);
  assert.equal(index.observedOnlyIn2026Segment, 134);
  assert.equal(index.observedIn2020Or2022Or2024, 360);
  assert.deepEqual(ledger.sourceCoverage.bySegment.find(r => r.year === 2024)?.sourceEmptyDistricts,
    [5,9,13,16,18,19,21,22,27,30,35,41,42,46,47,49,58,61,64]);
  assert.equal(ledger.historicalDenominator.officialSenateFilerCount2021to2025, null);
  assert.equal(ledger.historicalDenominator.officialActiveCommitteeFilerYears, null);
  assert.equal(ledger.historicalDenominator.requiredReports, null);
  assert.equal(ledger.historicalDenominator.actualFiledOriginalReports, null);
  assert.equal(ledger.historicalDenominator.completenessCertified, false);
  assert.equal(ledger.historicalDenominator.terminatedAndReactivatedHistoryVerified, false);
});

test('case-verified original-report registrations are present, name collisions remain separate', () => {
  const ledger = load();
  const {index, ids} = registrations(ledger);
  assert.deepEqual(index.knownOriginalReportControlIds, ['18443', '19205']);
  assert.ok(index.knownOriginalReportControlIds.every(id => ids.includes(id)));
  assert.equal(index.sameNameDifferentRegistrationIds.length, 8);
  assert.ok(index.sameNameDifferentRegistrationIds.every(x => x.ids.length === 2 && x.ids.every(id => ids.includes(id))));
  assert.deepEqual(index.sameNameDifferentRegistrationIds.find(x => x.name === 'Bushard, Robert')?.ids,
    ['18937', '19531']);
  assert.equal(index.sameRegistrationDifferentNameCount, 0);
});

test('source artifact ZIP/raw original bytes and 268-page canonical digest are pinned, no DB/model changes', () => {
  const ledger = load();
  assert.equal(ledger.provenance.runId, 38081628130);
  assert.equal(ledger.provenance.artifactId, 11680891630);
  assert.equal(ledger.provenance.zipSha256, 'fe85e6d3e4ae64d24d3153ae23b976267769cea8e57400e8008f2daffbace5a1');
  assert.equal(ledger.provenance.rawJsonSha256, '83770615658f7cf47802b05257bcbd45bed0c7c41ec19dfe99c31ca91b746c04');
  assert.equal(ledger.provenance.canonical268PageProofWithIdsSha256, '08c27a830b9ce8084997dac7203a421f08dbf2af20a22c602be3703d74ff9747');
  assert.ok(Object.values(ledger.provenance.canonicalSegmentProofSha256).every(x => /^[a-f0-9]{64}$/.test(x)));
  assert.equal(ledger.safeguards.noProductionDatabaseReadOrWrite, true);
  assert.equal(ledger.safeguards.noForecastOrModelChange, true);
});
