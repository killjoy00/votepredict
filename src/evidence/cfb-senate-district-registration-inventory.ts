/**
 * Issue #864 – OFFLINE, source-observed Senate candidate registration discovery.
 * No statewide historical reporting denominator may be inferred from these
 * election-segment pages. A candidate label is NOT a filing obligation.
 */
export const CFB_SENATE_DISTRICT_REGISTRATION_INVENTORY_VERSION =
  'cfb-senate-district-registration-observed-v1' as const;
export const CFB_SENATE_ROSTER_SEGMENTS = [2020, 2022, 2024, 2026] as const;
export const CFB_SENATE_HISTORICAL_REPORT_YEARS = [2021, 2022, 2023, 2024, 2025] as const;
export const CFB_SENATE_DISTRICT_COUNT = 67;
const HOST = 'register.cfb.mn.gov';
const ROOT = '/reports-and-data/viewers/campaign-finance/districts-constitutional-offices/Senate/';

export interface CfbSenateDistrictCandidateLabel {
  registrationNumber: string;
  candidateDisplayName: string;
}
export type CfbSenateDistrictObservationStatus =
  | 'candidate_labels_observed'
  | 'no_candidate_labels_visible'
  | 'source_fetch_failed'
  | 'source_html_invalid'
  | 'source_scope_mismatch'
  | 'source_candidate_labels_invalid';
export interface CfbSenateDistrictPageObservation {
  district: number;
  segmentEndYear: 2020 | 2022 | 2024 | 2026;
  sourceUrl: string;
  retrievedAt: string | null;
  htmlSha256: string | null;
  responseBytes: number | null;
  status: CfbSenateDistrictObservationStatus;
  candidates: CfbSenateDistrictCandidateLabel[];
  malformedCandidateLabels: number;
  error: string | null;
}

export function cfbSenateDistrictPageUrl(district: number, segmentEndYear: number): string {
  if (!Number.isInteger(district) || district < 1 || district > CFB_SENATE_DISTRICT_COUNT ||
    !CFB_SENATE_ROSTER_SEGMENTS.includes(segmentEndYear as typeof CFB_SENATE_ROSTER_SEGMENTS[number])) {
    throw Error('District must be 1–67 and election segment 2020/2022/2024/2026');
  }
  return 'https://' + HOST + ROOT + district + '/' + segmentEndYear;
}
function htmlText(content: string): string {
  return content.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ').trim();
}
function inputValue(tag: string): string | null {
  const quoted = tag.match(/\bvalue\s*=\s*(["'])([^"']{1,80})\1/i);
  if (quoted) return quoted[2] ?? null;
  return tag.match(/\bvalue\s*=\s*(\d{3,8})(?:\s|$)/i)?.[1] ?? null;
}
function validSourcePageUrl(actual: string, district: number, segment: number): boolean {
  try {
    const source = new URL(actual);
    const expected = new URL(cfbSenateDistrictPageUrl(district, segment));
    return source.protocol === 'https:' && source.hostname === HOST &&
      source.pathname.replace(/\/$/, '') === expected.pathname &&
      source.search === '' && source.hash === '';
  } catch { return false; }
}
function historicalTimestamp(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
}

/**
 * Analyze only the Senate district selection controls. The CFB server embeds
 * registration numbers as candidate-checkbox values, not profile links.
 * Failure to find labels is a SOURCE observation, never proof of no filers.
 */
export function parseCfbSenateDistrictCandidatePage(input: {
  district: number;
  segmentEndYear: number;
  sourceUrl: string;
  fetchedAt: string;
  htmlSha256: string;
  html: string;
  responseBytes: number;
}): CfbSenateDistrictPageObservation {
  const { district, segmentEndYear } = input;
  cfbSenateDistrictPageUrl(district, segmentEndYear);
  if (!validSourcePageUrl(input.sourceUrl, district, segmentEndYear)) {
    throw Error('Official Senate district source URL does not match district/segment');
  }
  if (!historicalTimestamp(input.fetchedAt) || !/^[0-9a-f]{64}$/.test(input.htmlSha256) ||
    !Number.isInteger(input.responseBytes) || input.responseBytes < 500 || input.responseBytes > 3_000_000 ||
    input.html.length < 500) {
    throw Error('Original CFB page provenance is missing or malformed');
  }
  const result: CfbSenateDistrictPageObservation = {
    district, segmentEndYear: segmentEndYear as CfbSenateDistrictPageObservation['segmentEndYear'],
    sourceUrl: input.sourceUrl, retrievedAt: input.fetchedAt, htmlSha256: input.htmlSha256,
    responseBytes: input.responseBytes, status: 'source_html_invalid',
    candidates: [], malformedCandidateLabels: 0, error: null,
  };
  if (!/districts_constitutional_offices-index/.test(input.html) ||
    !/districts-constitutional-offices/i.test(input.html)) return result;
  if (!new RegExp('Senate\\s+' + district + '(?:\\b|<)', 'i').test(htmlText(input.html))) {
    return { ...result, status: 'source_scope_mismatch' };
  }
  const seen = new Map<string, string>();
  let malformed = 0;
  for (const match of input.html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)) {
    const inner = match[1] ?? '';
    const name = htmlText(inner.replace(/<input\b[^>]*>/gi, ''));
    if (!/^[\p{L}][^<>@\n]{1,100},\s*[\p{L}]/u.test(name) || name.length > 110) continue;
    const tag = inner.match(/<input\b([^>]*)>/i)?.[1];
    const registration = tag ? inputValue(tag) : null;
    if (!registration || !/^\d{3,8}$/.test(registration)) { malformed++; continue; }
    const old = seen.get(registration);
    if (old && old !== name) { malformed++; continue; }
    seen.set(registration, name);
  }
  const candidates = [...seen.entries()].map(([registrationNumber, candidateDisplayName]) =>
    ({ registrationNumber, candidateDisplayName })).sort((a, b) =>
      a.registrationNumber.localeCompare(b.registrationNumber));
  return { ...result, candidates, malformedCandidateLabels: malformed,
    status: malformed > 0 ? 'source_candidate_labels_invalid' :
      candidates.length ? 'candidate_labels_observed' : 'no_candidate_labels_visible' };
}

export function failedCfbSenateDistrictPage(input: {
  district: number; segmentEndYear: number; sourceUrl: string; error: string;
}): CfbSenateDistrictPageObservation {
  cfbSenateDistrictPageUrl(input.district, input.segmentEndYear);
  if (!validSourcePageUrl(input.sourceUrl, input.district, input.segmentEndYear)) {
    throw Error('Failed source URL must still be the approved CFB Senate district URL');
  }
  return {
    district: input.district,
    segmentEndYear: input.segmentEndYear as CfbSenateDistrictPageObservation['segmentEndYear'],
    sourceUrl: input.sourceUrl, retrievedAt: null, htmlSha256: null, responseBytes: null,
    status: 'source_fetch_failed', candidates: [], malformedCandidateLabels: 0,
    error: input.error.slice(0, 150) || 'source unavailable',
  };
}

/**
 * Source-observed candidate registration inventory. A null statewide universe
 * means unknown, even if the 268 pages were all scanned successfully.
 */
export function auditCfbSenateDistrictRegistrationInventory(
  observations: readonly CfbSenateDistrictPageObservation[],
) {
  const byKey = new Map<string, CfbSenateDistrictPageObservation[]>();
  for (const observation of observations) {
    // Reject unscoped rows rather than silently mixing election segments.
    cfbSenateDistrictPageUrl(observation.district, observation.segmentEndYear);
    const expected = cfbSenateDistrictPageUrl(observation.district, observation.segmentEndYear);
    if (!validSourcePageUrl(observation.sourceUrl, observation.district, observation.segmentEndYear) ||
      observation.sourceUrl !== expected) throw Error('Unexpected official source locator');
    const key = observation.segmentEndYear + ':' + observation.district;
    byKey.set(key, [...(byKey.get(key) ?? []), observation]);
  }
  const pages: CfbSenateDistrictPageObservation[] = [];
  const duplicatesInConflict: string[] = [];
  const missing: string[] = [];
  for (const segment of CFB_SENATE_ROSTER_SEGMENTS) {
    for (let district = 1; district <= CFB_SENATE_DISTRICT_COUNT; district++) {
      const key = segment + ':' + district;
      const observed = byKey.get(key) ?? [];
      if (observed.length === 0) { missing.push(key); continue; }
      if (new Set(observed.map(x => JSON.stringify(x))).size > 1) {
        duplicatesInConflict.push(key);
        continue;
      }
      const row = observed[0]!;
      if (row.status !== 'candidate_labels_observed' &&
        row.status !== 'no_candidate_labels_visible') {
        if (row.candidates.length) throw Error('Failed or invalid CFB source must not contribute registrations');
      } else if (!row.htmlSha256 || !/^[a-f0-9]{64}$/.test(row.htmlSha256) ||
        !row.retrievedAt || !historicalTimestamp(row.retrievedAt) ||
        !Number.isInteger(row.responseBytes)) {
        throw Error('Observed candidates must have original CFB source provenance');
      }
      const ids = new Map<string, string>();
      for (const label of row.candidates) {
        if (!/^\d{3,8}$/.test(label.registrationNumber) ||
          !/^[\p{L}]/u.test(label.candidateDisplayName)) throw Error('Malformed CFB candidate label');
        if (ids.has(label.registrationNumber) &&
          ids.get(label.registrationNumber) !== label.candidateDisplayName) {
          throw Error('Contradictory candidate registration on same page');
        }
        ids.set(label.registrationNumber, label.candidateDisplayName);
      }
      pages.push(row);
    }
  }
  const registries = new Map<string, Set<string>>();
  for (const page of pages) {
    if (page.status !== 'candidate_labels_observed') continue;
    for (const label of page.candidates) {
      const labels = registries.get(label.registrationNumber) ?? new Set<string>();
      labels.add(label.candidateDisplayName);
      registries.set(label.registrationNumber, labels);
    }
  }
  const candidateNamesToRegs = new Map<string, Set<string>>();
  for (const [reg, names] of registries) {
    for (const name of names) {
      const refs = candidateNamesToRegs.get(name) ?? new Set<string>();
      refs.add(reg);
      candidateNamesToRegs.set(name, refs);
    }
  }
  const bySegment = CFB_SENATE_ROSTER_SEGMENTS.map(segmentEndYear => {
    const segmentPages = pages.filter(page => page.segmentEndYear === segmentEndYear);
    const candidateRegs = new Set(segmentPages.flatMap(page => page.candidates.map(label => label.registrationNumber)));
    return {
      segmentEndYear,
      pagesExpected: CFB_SENATE_DISTRICT_COUNT,
      pagesAcquiredAndParsed: segmentPages.filter(page => page.status === 'candidate_labels_observed' ||
        page.status === 'no_candidate_labels_visible').length,
      pagesWithCandidateLabels: segmentPages.filter(page => page.status === 'candidate_labels_observed').length,
      pagesWithNoVisibleLabels: segmentPages.filter(page => page.status === 'no_candidate_labels_visible').length,
      sourceFailuresOrInvalid: segmentPages.filter(page => page.status !== 'candidate_labels_observed' &&
        page.status !== 'no_candidate_labels_visible').length,
      candidateSelectionLabelsObserved: segmentPages.reduce((n, page) => n + page.candidates.length, 0),
      distinctRegistrationIdsObserved: candidateRegs.size,
      registrationIds: [...candidateRegs].sort(),
      reportingYearsCoveredByProof: null as null,
      legalReportingObligationsCoveredByProof: null as null,
    };
  });
  return {
    schemaVersion: CFB_SENATE_DISTRICT_REGISTRATION_INVENTORY_VERSION,
    scope: {
      office: 'Minnesota Senate',
      districtsPerSegment: CFB_SENATE_DISTRICT_COUNT,
      segmentsUsedOnlyForCandidateDiscovery: [...CFB_SENATE_ROSTER_SEGMENTS],
      2020: 'predecessor context only; not a 2020 report/evidence expansion',
      financeReportYears: [...CFB_SENATE_HISTORICAL_REPORT_YEARS],
    },
    sourceSummary: {
      expectedDistrictSegmentPages: CFB_SENATE_ROSTER_SEGMENTS.length * CFB_SENATE_DISTRICT_COUNT,
      inputSnapshots: observations.length,
      resolvedDistinctPages: pages.length,
      missingDistrictSegments: missing,
      contradictorySnapshots: duplicatesInConflict,
      allDistrictSegmentsCapturedAndParsed: missing.length === 0 && duplicatesInConflict.length === 0 &&
        pages.length === CFB_SENATE_ROSTER_SEGMENTS.length * CFB_SENATE_DISTRICT_COUNT &&
        pages.every(p => p.status === 'candidate_labels_observed' || p.status === 'no_candidate_labels_visible'),
    },
    bySegment,
    observedCandidateRegistrationIds: [...registries.keys()].sort(),
    observedUniqueCandidateRegistrations: registries.size,
    ambiguousDisplayNameCollisions: [...candidateNamesToRegs.entries()]
      .filter(([, refs]) => refs.size > 1)
      .map(([displayName, refs]) => ({ displayName, separateRegistrationIds: [...refs].sort() }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    oneRegistrationMultipleDisplayLabels: [...registries.entries()]
      .filter(([, names]) => names.size > 1)
      .map(([registrationNumber, names]) => ({ registrationNumber, observedLabels: [...names].sort() }))
      .sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber)),
    knownOriginalDocumentControlIds: {
      senate64_2021_22_registration18443Observed: registries.has('18443'),
      senate6_2025_registration19205Observed: registries.has('19205'),
    },
    historicalFinanceDenominator: {
      registeredSenateCommittees2021to2025: null as null,
      registeredSenateFilerYears: null as null,
      expectedStatutoryReports: null as null,
      originalReportsActuallyFiled: null as null,
      nonfilersAndExemptions: null as null,
      completeHistoricalTerminationHistory: false,
      datedRegistrationsAndOfficeIdentityVerified: false,
      candidateAppearanceImpliesCommitteeActiveInReportYear: false,
      candidateAppearanceImpliesRequiredReport: false,
      candidateNotShownImpliesNoCommittee: false,
      completenessCertified: false,
      reason: 'Segment candidate selections are 2026 retrieval-time discoveries, not a certified 2021-2025 historical registration/termination or required-report ledger.',
    },
    safeguards: {
      originalHtmlBodyRetained: false,
      donorOrOfficerContactTextRetained: false,
      productionDbAccess: false,
      historicalPublicByRewritten: false,
      servingOrRetrainingChange: false,
    },
  };
}
