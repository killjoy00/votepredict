/**
 * #864 V11: add exactly one independently SHA-backed PUBLIC official Senate
 * historical-year directory result to previously accepted protected V10.
 * No original member names, URLs, source text, row IDs, or choices exported.
 */
import {YEA_V10_SAFE_SCHEMA_VERSION,YEA_V10_SAFE_ROSTER_KEYS,
 YEA_V10_SAFE_RESOLVER_REASONS,YEA_V10_SAFE_RESOLVER_STATUSES,
 serializeApprovedYeaV10SafeScalars} from
 './senate-864-2024-yea-v10-roster-safe-scalars.js';
import {SENATE_864_YEA_V9_SAFE_KEYS} from
 './senate-864-2024-yea-v9-safe-scalars.js';

export const V11_OFFICIAL_SOURCE_KEYS=[
 'officialLrl2024YearServiceCandidateCount',
 'officialLrl2024YearResolverStatus',
 'officialLrl2024YearResolverReason',
 'originalLrlDirectoryShaIndependentlyVerified',
 'officialDirectoryYearServiceNotExactHearingDay',
 'officialDirectoryObservedIn2026NotContemporaneous2024',
] as const;
export const V11_SAFE_SCHEMA_VERSION=
 'senate-864-2024-one-yea-lrl-original-year-roster-v11' as const;
export function serializeApprovedYeaV11SafeScalars(value:unknown):string{
 if(value===null||typeof value!=='object'||Array.isArray(value)||
  Object.getPrototypeOf(value)!==Object.prototype)
  throw Error('V11 safe result not a plain object');
 const obj=value as Record<string,unknown>;
 const names=[...SENATE_864_YEA_V9_SAFE_KEYS,
  ...YEA_V10_SAFE_ROSTER_KEYS,...V11_OFFICIAL_SOURCE_KEYS];
 if(JSON.stringify(Object.keys(obj).sort())!==JSON.stringify(names.sort()))
  throw Error('V11 safe result extra/unexpected/missing field');
 const count=obj.officialLrl2024YearServiceCandidateCount;
 const status=obj.officialLrl2024YearResolverStatus;
 const reason=obj.officialLrl2024YearResolverReason;
 if(obj.schemaVersion!==V11_SAFE_SCHEMA_VERSION||
  obj.originalLrlDirectoryShaIndependentlyVerified!==true||
  obj.officialDirectoryYearServiceNotExactHearingDay!==true||
  obj.officialDirectoryObservedIn2026NotContemporaneous2024!==true||
  typeof count!=='number'||!Number.isSafeInteger(count)||count<67||count>90||
  !YEA_V10_SAFE_RESOLVER_STATUSES.includes(status as never)||
  !YEA_V10_SAFE_RESOLVER_REASONS.includes(reason as never)||
  ((status==='unmatched')!==
   (reason==='empty_normalized_source'||reason==='no_conservative_roster_match')))
  throw Error('V11 government year-service evidence or safe status inconsistent');
 // Freeze 2024 outstanding YEA and the prior exact V10 unmatched condition.
 if(obj.directMembershipOrAliasCandidateCount!==0||
  obj.membershipsWithBothDateBoundsCoveringHearingDay!==0||
  obj.historicalBackfillRosterCount!==68||
  obj.historicalBackfillActiveCount!==67||
  obj.historicalBackfillResolverStatus!=='unmatched'||
  obj.historicalBackfillResolverReason!=='no_conservative_roster_match')
  throw Error('V10 previously proven existing Senate roster status changed');
 const base=Object.fromEntries([...SENATE_864_YEA_V9_SAFE_KEYS,
  ...YEA_V10_SAFE_ROSTER_KEYS].map(k=>[k,obj[k]]));
 base.schemaVersion=YEA_V10_SAFE_SCHEMA_VERSION;
 const rechecked=JSON.parse(serializeApprovedYeaV10SafeScalars(base));
 const out={
  ...rechecked,schemaVersion:V11_SAFE_SCHEMA_VERSION,
  officialLrl2024YearServiceCandidateCount:count,
  officialLrl2024YearResolverStatus:status,
  officialLrl2024YearResolverReason:reason,
  originalLrlDirectoryShaIndependentlyVerified:true,
  officialDirectoryYearServiceNotExactHearingDay:true,
  officialDirectoryObservedIn2026NotContemporaneous2024:true,
 };
 const result=JSON.stringify(out);
 if(result.length>4200)throw Error('V11 safe output exceeds byte bound');
 return result;
}
