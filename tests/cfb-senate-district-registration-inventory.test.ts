import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cfbSenateDistrictPageUrl,
  parseCfbSenateDistrictCandidatePage,
  failedCfbSenateDistrictPage,
  auditCfbSenateDistrictRegistrationInventory,
} from '../src/evidence/cfb-senate-district-registration-inventory.js';

function source(district: number, segment: number, labels: string[] = []) {
  const rows = labels.map(item => {
    const [name, registration] = item.split('::');
    return '<label><input type="checkbox" name="candidates[]" value="' +
      registration + '">' + name + '</label>';
  }).join('\n');
  const html = '<!doctype html><html><body class="template-default districts_constitutional_offices-index">' +
    '<a href="/reports-and-data/viewers/campaign-finance/districts-constitutional-offices/Senate/' +
    district + '/' + segment + '">Candidate comparison</a><h2>Senate ' + district + '</h2>' +
    '<form id="parent_filter_candidates"><fieldset>' + rows + '</fieldset></form>' +
    '</body></html><!-- ' + 'x'.repeat(550) + ' -->';
  return parseCfbSenateDistrictCandidatePage({
    district, segmentEndYear: segment,
    sourceUrl: cfbSenateDistrictPageUrl(district, segment),
    fetchedAt: '2026-10-10T19:42:00.000Z', htmlSha256: 'a'.repeat(64),
    responseBytes: html.length, html,
  });
}

test('extracts real-form-style CFB numeric registration values, not candidate name dedupe', () => {
  const sd64 = source(64, 2022, [
    'Bushard, Robert::18937', 'Cohen, Richard J::11829', 'Murphy, Erin::18443',
  ]);
  assert.equal(sd64.status, 'candidate_labels_observed');
  assert.deepEqual(sd64.candidates.map(x => x.registrationNumber), ['11829', '18443', '18937']);
  const sd6 = source(6, 2026, [
    'Heintzeman, Keri::19205', 'Carnahan, Jennifer::19207', 'Eichorn, Justin::18077',
  ]);
  assert.deepEqual(sd6.candidates.map(x => x.registrationNumber), ['18077', '19205', '19207']);
  const audit = auditCfbSenateDistrictRegistrationInventory([sd64, sd6]);
  assert.equal(audit.observedUniqueCandidateRegistrations, 6);
  assert.equal(audit.knownOriginalDocumentControlIds.senate64_2021_22_registration18443Observed, true);
  assert.equal(audit.knownOriginalDocumentControlIds.senate6_2025_registration19205Observed, true);
  assert.equal(audit.historicalFinanceDenominator.registeredSenateCommittees2021to2025, null);
});

test('a same-name candidate with a NEW registration stays a separate committee identity', () => {
  const one = source(64, 2022, ['Bushard, Robert::18937']);
  const two = source(64, 2026, ['Bushard, Robert::19531']);
  const audit = auditCfbSenateDistrictRegistrationInventory([one, two]);
  assert.equal(audit.observedUniqueCandidateRegistrations, 2);
  assert.deepEqual(audit.ambiguousDisplayNameCollisions, [
    { displayName: 'Bushard, Robert', separateRegistrationIds: ['18937', '19531'] },
  ]);
});

test('2024 missing candidate selections are SOURCE-empty and never an official zero', () => {
  const offcycle = source(35, 2024);
  assert.equal(offcycle.status, 'no_candidate_labels_visible');
  assert.equal(offcycle.candidates.length, 0);
  const audit = auditCfbSenateDistrictRegistrationInventory([offcycle]);
  assert.equal(audit.sourceSummary.missingDistrictSegments.length, 267);
  assert.equal(audit.sourceSummary.allDistrictSegmentsCapturedAndParsed, false);
  assert.equal(audit.historicalFinanceDenominator.expectedStatutoryReports, null);
  assert.equal(audit.historicalFinanceDenominator.completeHistoricalTerminationHistory, false);
  assert.equal(audit.historicalFinanceDenominator.candidateNotShownImpliesNoCommittee, false);
  assert.equal(audit.historicalFinanceDenominator.completenessCertified, false);
});

test('2020 is predecessor discovery context only, NOT an eligible finance report year', () => {
  const old = source(6, 2020, ['Horoshak, Christopher::2228', 'Tomassoni, David J::15317']);
  const audit = auditCfbSenateDistrictRegistrationInventory([old]);
  assert.equal(audit.bySegment.find(x => x.segmentEndYear === 2020)?.distinctRegistrationIdsObserved, 2);
  assert.deepEqual(audit.scope.financeReportYears, [2021, 2022, 2023, 2024, 2025]);
  assert.equal(audit.historicalFinanceDenominator.candidateAppearanceImpliesCommitteeActiveInReportYear, false);
});

test('rejects wrong office, district/year, unsupported segment and untrusted host', () => {
  assert.throws(() => cfbSenateDistrictPageUrl(68, 2022), /District must/);
  assert.throws(() => cfbSenateDistrictPageUrl(1, 2025), /District must/);
  const wrong = source(35, 2022, ['Abeler, Jim::17868']);
  assert.equal(wrong.status, 'candidate_labels_observed');
  const noSenateHeading = source(6, 2024, []);
  const prepared = {
    district: 6, segmentEndYear: 2024,
    sourceUrl: 'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/districts-constitutional-offices/House/6/2024',
    fetchedAt: '2026-10-10T19:42:00.000Z', htmlSha256: 'a'.repeat(64),
    responseBytes: 1500, html: '<html>' + 'x'.repeat(1490),
  };
  assert.throws(() => parseCfbSenateDistrictCandidatePage(prepared), /source URL/);
  assert.throws(() => parseCfbSenateDistrictCandidatePage({ ...prepared,
    sourceUrl: 'https://example.com/reports-and-data/viewers/campaign-finance/districts-constitutional-offices/Senate/6/2024',
  }), /source URL/);
  assert.equal(noSenateHeading.status, 'no_candidate_labels_visible');
});

test('malformed candidate registration values fail closed, never add false rows', () => {
  const bad = source(64, 2022, ['Murphy, Erin::not-a-registration']);
  assert.equal(bad.status, 'source_candidate_labels_invalid');
  assert.equal(bad.malformedCandidateLabels, 1);
  assert.deepEqual(bad.candidates, []);
  const audit = auditCfbSenateDistrictRegistrationInventory([bad]);
  assert.equal(audit.observedUniqueCandidateRegistrations, 0);
  assert.equal(audit.bySegment.find(x => x.segmentEndYear === 2022)?.sourceFailuresOrInvalid, 1);
});

test('failed source never counts as a candidate or creates a zero-report proof', () => {
  const failed = failedCfbSenateDistrictPage({
    district: 35, segmentEndYear: 2022, sourceUrl: cfbSenateDistrictPageUrl(35, 2022),
    error: 'HTTP 503',
  });
  assert.equal(failed.status, 'source_fetch_failed');
  const audit = auditCfbSenateDistrictRegistrationInventory([failed]);
  assert.equal(audit.sourceSummary.allDistrictSegmentsCapturedAndParsed, false);
  assert.equal(audit.historicalFinanceDenominator.originalReportsActuallyFiled, null);
});

test('conflicting same-page captures are surfaced; exact duplicate is deduplicated', () => {
  const one = source(35, 2022, ['Abeler, Jim::17868']);
  const two = source(35, 2022, ['Rehrauer, Kari::18698']);
  const duplicated = auditCfbSenateDistrictRegistrationInventory([one, one]);
  assert.equal(duplicated.bySegment.find(x => x.segmentEndYear === 2022)?.distinctRegistrationIdsObserved, 1);
  const conflicted = auditCfbSenateDistrictRegistrationInventory([one, two]);
  assert.deepEqual(conflicted.sourceSummary.contradictorySnapshots, ['2022:35']);
  assert.equal(conflicted.observedUniqueCandidateRegistrations, 0);
});
