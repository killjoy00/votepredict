/**
 * Issue #864: choose actual 2025-dated Senate candidate registrations from
 * independent, official CFB 2026-current registration dates, but ONLY for
 * registrations appearing exclusively in the 2026 Senate election viewer.
 *
 * Election segment date and legal report year MUST NOT be conflated.
 */
export const CFB_2025_DATED_SENATE_COHORT_VERSION =
  'cfb-2025-senate-dated-registration-reference-cohort-v1' as const;

interface SourceViewerIndex {
  observedCandidateRegistrationIndex: {
    registrationIdsCsv: string;
    segmentMembershipMaskHex: string;
    distinctRegistrations: number;
  };
}
function dateValid(value:string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value+'T00:00:00.000Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === value;
}
export function selectCfb2025DatedSenateRegistrationTargets(
  viewer: SourceViewerIndex, officialRegistryPsv: string,
) {
  const { registrationIdsCsv,segmentMembershipMaskHex,distinctRegistrations } =
    viewer.observedCandidateRegistrationIndex;
  const ids = registrationIdsCsv.split(',');
  if (ids.length !== distinctRegistrations || ids.length<1 ||
    !/^[1-9a-f]+$/.test(segmentMembershipMaskHex) ||
    segmentMembershipMaskHex.length !== ids.length ||
    new Set(ids).size !== ids.length ||
    ids.join(',') !== [...ids].sort().join(',') ||
    ids.some(id => !/^\d{3,8}$/.test(id))) {
    throw Error('Untrusted source viewer registration IDs or segment masks');
  }
  // Accept a final text-file newline, never silently correct interior source
  // errors/duplicate IDs. All listed date facts were source-validated upstream.
  const lines = officialRegistryPsv.trimEnd().split('\n');
  const dated = new Map<string,{ registered:string; terminated:string|null }>();
  let previousId = '';
  for (const line of lines) {
    const match = /^(\d{3,8})\|(\d{4}-\d{2}-\d{2})\|(\d{4}-\d{2}-\d{2})?$/.exec(line.trim());
    if (!match || !dateValid(match[2]!) ||
      (match[3] && !dateValid(match[3])) || (match[3] && match[3] < match[2]!) ||
      match[1]!<=previousId || dated.has(match[1]!)) throw Error('Invalid/deduped current-registry source row');
    previousId=match[1]!;
    dated.set(match[1]!,{registered:match[2]!,terminated:match[3]??null});
  }
  const unknown: string[] = [];
  const registered2026: string[] = [];
  const registered2025: string[] = [];
  const datedOutsideTarget: string[] = [];
  for (let i=0;i<ids.length;i++) {
    if (segmentMembershipMaskHex[i] !== '8') continue;
    const id=ids[i]!;
    const date=dated.get(id);
    if (!date) {unknown.push(id);continue;}
    if (date.registered.startsWith('2025-')) registered2025.push(id);
    else if (date.registered.startsWith('2026-')) registered2026.push(id);
    else datedOutsideTarget.push(id);
  }
  return {
    version:CFB_2025_DATED_SENATE_COHORT_VERSION,
    observedOnlyOn2026ElectionSegment:registered2025.length+registered2026.length+unknown.length+datedOutsideTarget.length,
    datedRegistration2025:registered2025,
    datedRegistration2026Excluded:registered2026,
    registrationDateStillUnverified:unknown,
    otherDatedRegistrationYearsNotAutoAssigned:datedOutsideTarget,
    candidateReportYear:2025 as const,
    candidateViewerSegmentEndYear:2026 as const,
    reportRequirementProved:false as const,
    actualOriginalReportFilingProved:false as const,
    pdfContentsOrHistoricalPublicByProved:false as const,
  };
}
