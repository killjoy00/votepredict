/**
 * Issue #864. Present-day, PUBLIC Minnesota CFB candidate register cross-check.
 * This module only reconciles official 2026-retrieved candidate list metadata
 * to the previously source-observed Senate viewer footprint (2020/22/24/26).
 * It cannot certify historical registration intervals, legal reporting duties,
 * or the presence/absence of filings during 2021–2025.
 */
export const CFB_CANDIDATE_REGISTRY_CROSSCHECK_VERSION =
  'cfb-senate-public-current-registry-crosscheck-v1' as const;
export type CfbCandidateRegistryListAction =
  'all-registered-candidates' | 'recent-candidate-terminations';

export interface CfbCandidateRegistryListRow {
  registrationNumber: string;
  office: string | null;
  district: string | null;
  registrationDate: string | null;
  terminationDate: string | null;
}
export interface CfbParsedCandidateRegistryGrid {
  action: CfbCandidateRegistryListAction;
  columns: string[];
  rawRowCount: number;
  rows: CfbCandidateRegistryListRow[];
  rejectedRowCount: number;
}
function rootObject(value: unknown): Record<string,unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string,unknown> : null;
}
function formatDay(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const stamp = value.trim();
  if (!stamp) return null;
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z)?)?$/.exec(stamp);
  if (!m) return undefined;
  const day = m[1]!;
  const utc = new Date(day + 'T00:00:00.000Z');
  return !Number.isNaN(utc.getTime()) && utc.toISOString().slice(0,10) === day ? day : undefined;
}
function boundedField(value: unknown, max=30): string | null {
  if (value===null || value===undefined || value==='') return null;
  const v = String(value).trim();
  return v && v.length <= max && /^[\p{L}\p{N} .,'/-]+$/u.test(v) ? v : null;
}
export function parseCfbCandidateRegistryGrid(
  payload: string | unknown,
  action: CfbCandidateRegistryListAction,
): CfbParsedCandidateRegistryGrid {
  if (!['all-registered-candidates','recent-candidate-terminations'].includes(action)) {
    throw Error('Unapproved CFB list action');
  }
  const object = rootObject(typeof payload==='string' ? JSON.parse(payload) as unknown : payload);
  if (!object || !Array.isArray(object.cols)) throw Error('Missing official CFB column schema');
  const cols = object.cols;
  if (cols.some(x => typeof x !== 'string') || new Set(cols).size !== cols.length) {
    throw Error('CFB column schema contains duplicate or malformed fields');
  }
  const columns: string[] = cols;
  const registration = columns.indexOf('RegisteredEntityID');
  const registeredAt = columns.indexOf('RegistrationDate');
  const terminatedAt = columns.indexOf('TerminationDate');
  const officeName = columns.indexOf('OfficeSoughtFullName');
  const officeKey = columns.indexOf('OfficeKey');
  const district = columns.indexOf('District');
  if ([registration,registeredAt,terminatedAt,district].some(i => i < 0) ||
    (officeName < 0 && officeKey < 0)) throw Error('CFB candidate registration/termination scope columns absent');
  const data = rootObject(object.data);
  if (!data) throw Error('CFB candidate registration grid missing row data');
  const rows: CfbCandidateRegistryListRow[] = [];
  let rawRowCount = 0;
  let rejectedRowCount = 0;
  for (const group of Object.values(data)) {
    if (!Array.isArray(group)) { rejectedRowCount++; continue; }
    for (const raw of group) {
      rawRowCount++;
      if (!Array.isArray(raw) || raw.length < columns.length) { rejectedRowCount++; continue; }
      const reg = String(raw[registration] ?? '').trim();
      const date = formatDay(raw[registeredAt]);
      const term = formatDay(raw[terminatedAt]);
      const office = boundedField(raw[officeName >= 0 ? officeName : officeKey],35);
      const dist = boundedField(raw[district],15);
      if (!/^\d{3,8}$/.test(reg) || date === undefined ||
        term === undefined || date === null || !office) {
        rejectedRowCount++; continue;
      }
      // A term date before the purported registration date is a source
      // conflict: do not accept it as a verified registration interval.
      if (term && term < date) { rejectedRowCount++; continue; }
      rows.push({
        registrationNumber: reg, office, district: dist,
        registrationDate: date, terminationDate: term,
      });
    }
  }
  return {action, columns, rawRowCount, rows, rejectedRowCount};
}
export interface CfbCandidateRegistrySource {
  action: CfbCandidateRegistryListAction;
  apiUrl: string;
  fetchedAt: string;
  responseSha256: string;
  grid: CfbParsedCandidateRegistryGrid;
}
function validSource(s: CfbCandidateRegistrySource): boolean {
  if (s.apiUrl !== 'https://register.cfb.mn.gov/reports/api/' ||
    !/^[0-9a-f]{64}$/.test(s.responseSha256) || s.grid.action !== s.action) return false;
  const t = new Date(s.fetchedAt);
  return !Number.isNaN(t.getTime()) && t.toISOString() === s.fetchedAt &&
    s.grid.rawRowCount === s.grid.rows.length + s.grid.rejectedRowCount;
}
export interface CfbObservedViewerRegistrationCheckpoint {
  observedCandidateRegistrationIndex: {
    registrationIdsCsv: string;
    distinctRegistrations: number;
    knownOriginalReportControlIds: string[];
  };
}
export function auditCfbCurrentCandidateRegistryAgainstSenateViewer(
  viewer: CfbObservedViewerRegistrationCheckpoint,
  allRegistered: CfbCandidateRegistrySource,
  recentTerminations: CfbCandidateRegistrySource,
) {
  const ids = viewer.observedCandidateRegistrationIndex.registrationIdsCsv.split(',');
  if (!ids.length || ids.length !== viewer.observedCandidateRegistrationIndex.distinctRegistrations ||
    ids.some(x => !/^\d{3,8}$/.test(x)) || new Set(ids).size !== ids.length ||
    ids.join(',') !== [...ids].sort().join(',')) {
    throw Error('Candidate viewer reference inventory is malformed');
  }
  if (!validSource(allRegistered) || !validSource(recentTerminations) ||
    allRegistered.action !== 'all-registered-candidates' ||
    recentTerminations.action !== 'recent-candidate-terminations') {
    throw Error('Official source identity/provenance invalid');
  }
  const byReg = new Map<string,CfbCandidateRegistryListRow[]>();
  for (const row of allRegistered.grid.rows) {
    byReg.set(row.registrationNumber,[...(byReg.get(row.registrationNumber) ?? []),row]);
  }
  const conflictingIds: string[] = [];
  for (const [reg, rows] of byReg) {
    if (new Set(rows.map(x=>JSON.stringify(x))).size > 1) conflictingIds.push(reg);
  }
  const controls = viewer.observedCandidateRegistrationIndex.knownOriginalReportControlIds;
  if (!controls.includes('18443') || !controls.includes('19205')) {
    throw Error('Missing independently original-PDF-verified Senate registration controls');
  }
  const known = new Set(ids);
  const currentRows = [...byReg.values()].flat();
  const allOfficeSenate = currentRows.filter(row=>row.office === 'Senate' &&
    !conflictingIds.includes(row.registrationNumber));
  const currentSenateIds = [...new Set(allOfficeSenate.map(row=>row.registrationNumber))].sort();
  const outsideViewer = currentSenateIds.filter(id=>!known.has(id));
  const overlapping = ids.filter(id=>byReg.has(id));
  const unresolvedCurrentAbsences = ids.filter(id=>!byReg.has(id));
  const possibleOfficeDiscrepancies = ids.filter(id=>
    byReg.has(id) && !byReg.get(id)!.some(row=>row.office==='Senate'));
  const terminationIds = new Set(recentTerminations.grid.rows.map(row=>row.registrationNumber));
  const recentlyTerminatedIdsInViewer = ids.filter(id=>terminationIds.has(id));
  const registrationMetadata = ids.map(registrationNumber=>{
    const candidates = byReg.get(registrationNumber) ?? [];
    const row = candidates[0] ?? null;
    return {
      registrationNumber,
      currentPublicListStatus: candidates.length === 0 ? 'not_listed_in_2026_current_source'
        : conflictingIds.includes(registrationNumber) ? 'source_registration_conflict'
        : 'registration_present_in_2026_current_source',
      currentOffice: row && !conflictingIds.includes(registrationNumber) ? row.office : null,
      currentDistrict: row && !conflictingIds.includes(registrationNumber) ? row.district : null,
      listedRegistrationDate: row && !conflictingIds.includes(registrationNumber) ? row.registrationDate : null,
      listedTerminationDate: row && !conflictingIds.includes(registrationNumber) ? row.terminationDate : null,
      committeeActivity2021to2025: null as null,
      statutoryReportsDue2021to2025: null as null,
    };
  });
  return {
    schemaVersion: CFB_CANDIDATE_REGISTRY_CROSSCHECK_VERSION,
    source: {
      allRegistered: {
        action: allRegistered.action, url: allRegistered.apiUrl,
        responseSha256: allRegistered.responseSha256, fetchedAt: allRegistered.fetchedAt,
        rows: allRegistered.grid.rawRowCount,
        parsedRows: allRegistered.grid.rows.length,
        rejectedRows: allRegistered.grid.rejectedRowCount,
      },
      recentTerminations: {
        action: recentTerminations.action, url: recentTerminations.apiUrl,
        responseSha256: recentTerminations.responseSha256, fetchedAt: recentTerminations.fetchedAt,
        rows: recentTerminations.grid.rawRowCount,
        parsedRows: recentTerminations.grid.rows.length,
        rejectedRows: recentTerminations.grid.rejectedRowCount,
      },
    },
    snapshot: {
      candidateRegistrationsFromAllOfficesCurrentlyListed: new Set(currentRows.map(x=>x.registrationNumber)).size,
      currentListedSenateRegistrationIds: currentSenateIds.length,
      currentSenateIdsAbsentFromElectionSegmentViewer: outsideViewer,
      currentSourceRegistrationIdConflicts: conflictingIds.sort(),
      viewerCandidateIdsObserved: ids.length,
      viewerIdsListedOnCurrentSource: overlapping.length,
      viewerIdsNotListedOnCurrentSource: unresolvedCurrentAbsences.length,
      viewerIdsListedUnderNonSenateOffice: possibleOfficeDiscrepancies,
      viewerIdsInRecentTerminationListing: recentlyTerminatedIdsInViewer,
      bothKnownOriginalReportControlsInCurrentList: controls.every(id=>byReg.has(id)),
      sourceContainsInvalidRows: allRegistered.grid.rejectedRowCount !== 0 || recentTerminations.grid.rejectedRowCount !== 0,
    },
    viewerRegistrationCrosscheck: registrationMetadata,
    historicalFinanceDenominator: {
      committeeRegistrationsLegallyActiveIn2021to2025: null as null,
      legallyRequiredCandidateReportCount: null as null,
      originalReportsFiledCount: null as null,
      legalNonfilersAndExemptions: null as null,
      independentHistoricalRegistrationAndTerminationEpisodesVerified: false,
      absentFrom2026ListImpliesHistoricallyTerminated: false,
      presentOn2026ListImpliesHistoricallyRegistered: false,
      registrationDateProvesReportObligation: false,
      fullStatewideHistoricalFilingDenominatorCertified: false,
      reason: '2026-retrieved current registration and recent termination snapshots are not complete historical life-cycle ledgers; additional termination, rerun, legal-calendar and actual-filing proofs are required.',
    },
    safety: {
      publicRegistryMetadataOnly: true,
      candidateOrTreasurerContactDetailsPersisted: false,
      donorOrFinanceTransactionDetailsPersisted: false,
      productionDatabaseAccess: false,
      forecastRetrainingOrServingChanges: false,
    },
  };
}
