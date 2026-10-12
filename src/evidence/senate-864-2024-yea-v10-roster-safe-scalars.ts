/**
 * #864: extend only the already-approved V9 count-only receipt with a
 * SOURCE-PERSON-IN-MEMORY check against the exact historical Senate roster
 * reconciliation algorithm. No names, hashes, IDs, source PDF text or SQL rows
 * are exported. A matching roster is NOT proof of historic ingestion cause.
 */
import {SENATE_864_YEA_V9_SAFE_KEYS,V9_SAFE_SCHEMA_VERSION,
 serializeApprovedYeaV9SafeScalars} from
 './senate-864-2024-yea-v9-safe-scalars.js';

export const YEA_V10_SAFE_ROSTER_KEYS=[
 'historicalBackfillRosterCount',
 'historicalBackfillActiveCount',
 'historicalBackfillResolverStatus',
 'historicalBackfillResolverReason',
 'uniqueOriginalBackfillSourceFormInProtectedMemory',
] as const;
export const YEA_V10_SAFE_SCHEMA_VERSION=
 'senate-864-2024-single-yea-private-person-source-v10' as const;
export const YEA_V10_SAFE_RESOLVER_STATUSES=[
 'matched','ambiguous','unmatched',
] as const;
export const YEA_V10_SAFE_RESOLVER_REASONS=[
 'exact_normalized_or_alias',
 'surname_given_initials',
 'unique_surname_form',
 'empty_normalized_source',
 'no_conservative_roster_match',
] as const;
export type SafeV10Reason=typeof YEA_V10_SAFE_RESOLVER_REASONS[number];
export type SafeV10Status=typeof YEA_V10_SAFE_RESOLVER_STATUSES[number];

export function mapActualRosterResolverReason(reason:string):SafeV10Reason{
 const mapping:Record<string,SafeV10Reason>={
  'exact normalized name or alias match':'exact_normalized_or_alias',
  'surname and given-initial match':'surname_given_initials',
  'unique surname-form match':'unique_surname_form',
  'empty normalized source name':'empty_normalized_source',
  'no conservative roster match':'no_conservative_roster_match',
 };
 if(!Object.hasOwn(mapping,reason))
  throw Error('Unreviewed roster reason: fail closed');
 return mapping[reason]!;
}
export function serializeApprovedYeaV10SafeScalars(raw:unknown):string{
 if(raw===null||typeof raw!=='object'||Array.isArray(raw)||
  Object.getPrototypeOf(raw)!==Object.prototype)
  throw Error('V10 reviewed scalar object required');
 const record=raw as Record<string,unknown>;
 const keys=[...SENATE_864_YEA_V9_SAFE_KEYS,...YEA_V10_SAFE_ROSTER_KEYS];
 if(JSON.stringify(Object.keys(record).sort())!==JSON.stringify([...keys].sort()))
  throw Error('V10 scalar fields must exactly match allowlist');
 if(record.schemaVersion!==YEA_V10_SAFE_SCHEMA_VERSION||
  record.uniqueOriginalBackfillSourceFormInProtectedMemory!==true)
  throw Error('V10 original source identity or version not authenticated');
 const roster=record.historicalBackfillRosterCount;
 const active=record.historicalBackfillActiveCount;
 if(typeof roster!=='number'||!Number.isSafeInteger(roster)||
  roster<1||roster>150||typeof active!=='number'||!Number.isSafeInteger(active)||
  active<0||active>roster)
  throw Error('V10 session roster or active membership bound');
 const status=record.historicalBackfillResolverStatus;
 const reason=record.historicalBackfillResolverReason;
 if(!YEA_V10_SAFE_RESOLVER_STATUSES.includes(status as SafeV10Status)||
  !YEA_V10_SAFE_RESOLVER_REASONS.includes(reason as SafeV10Reason))
  throw Error('V10 unreviewed roster status or reason');
 if((status==='matched'||status==='ambiguous')&&
  (reason==='empty_normalized_source'||reason==='no_conservative_roster_match'))
  throw Error('V10 status and reason inconsistent');
 if(status==='unmatched'&&
  reason!=='empty_normalized_source'&&reason!=='no_conservative_roster_match')
  throw Error('V10 status and reason inconsistent');
 // Reuse V9's independently reviewed exact-key, scalar bound, rollback,
 // original 10/9/1 and required-unproven-root-cause invariants unchanged.
 const old=Object.fromEntries(
  SENATE_864_YEA_V9_SAFE_KEYS.map(k=>[k,record[k]]),
 );
 old.schemaVersion=V9_SAFE_SCHEMA_VERSION;
 const base=JSON.parse(serializeApprovedYeaV9SafeScalars(old));
 base.schemaVersion=YEA_V10_SAFE_SCHEMA_VERSION;
 const out={
  ...base,
  historicalBackfillRosterCount:roster,
  historicalBackfillActiveCount:active,
  historicalBackfillResolverStatus:status,
  historicalBackfillResolverReason:reason,
  uniqueOriginalBackfillSourceFormInProtectedMemory:true,
 };
 const data=JSON.stringify(out);
 if(data.length>3500)throw Error('V10 output length cap');
 return data;
}
