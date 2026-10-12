/**
 * #864 V9: strict numerical/boolean allowlist for a protected YEA diagnostic.
 * The prior V8 raw-string blacklist flagged the literal *name* of the
 * reviewed "noMemberNameSourceURLRowIDOrFingerprintExported" boolean, even
 * though the private SQL transaction had already ROLLED BACK. V9 validates
 * exact field identity, value type, logical bounds, and value invariants.
 * No names, original PDF URLs, private row IDs or SHA tokens are serialized.
 */
export const SENATE_864_YEA_V9_SAFE_KEYS=[
 'schemaVersion',
 'issue',
 'sourceOriginalPDFHashAuthenticated',
 'originalMissingSourceYeaFingerprints',
 'storedExactChoiceIntersection',
 'originalNamedRollChoices',
 'storedNamedRollChoices',
 'uniqueSourceNameInProtectedMemory',
 'directMembershipOrAliasCandidateCount',
 'membershipsWithBothDateBoundsCoveringHearingDay',
 'exactActualServiceDateIndependentlyProven',
 'rootCauseProven',
 'storedRowRepairAuthorized',
 'protectedReadOnlyTransaction',
 'explicitRollback',
 'noMemberNameSourceURLRowIDOrFingerprintExported',
 'existingDefaultBranchNotVerifiedDeployedProductionBinding',
 'print2021Print2022And141NoPdfMeetingsUnresolved',
 'officialCompleteCommitteeVoteUniverseNotCertified',
 'issue864Open',
] as const;
const TRUE_FIELDS=[
 'sourceOriginalPDFHashAuthenticated',
 'uniqueSourceNameInProtectedMemory',
 'protectedReadOnlyTransaction',
 'explicitRollback',
 'noMemberNameSourceURLRowIDOrFingerprintExported',
 'existingDefaultBranchNotVerifiedDeployedProductionBinding',
 'print2021Print2022And141NoPdfMeetingsUnresolved',
 'officialCompleteCommitteeVoteUniverseNotCertified',
 'issue864Open',
] as const;
const FALSE_FIELDS=[
 'exactActualServiceDateIndependentlyProven','rootCauseProven','storedRowRepairAuthorized',
] as const;
export const V9_SAFE_SCHEMA_VERSION=
 'senate-864-2024-single-yea-private-person-source-v9' as const;

/** Reject unknown fields/strings and any noncanonical or impossible number.
 * Return a newly created object with only preapproved safe scalar fields.
 */
export function serializeApprovedYeaV9SafeScalars(raw:unknown):string{
 if(raw===null||typeof raw!=='object'||Array.isArray(raw)||
  Object.getPrototypeOf(raw)!==Object.prototype)
  throw Error('V9 safe receipt: object required');
 const record=raw as Record<string,unknown>;
 const keys=Object.keys(record).sort();
 if(JSON.stringify(keys)!==JSON.stringify([...SENATE_864_YEA_V9_SAFE_KEYS].sort()))
  throw Error('V9 safe receipt: exact allowlist failed');
 if(record.schemaVersion!==V9_SAFE_SCHEMA_VERSION||record.issue!==864||
  record.originalMissingSourceYeaFingerprints!==1||
  record.storedExactChoiceIntersection!==9||
  record.originalNamedRollChoices!==10||record.storedNamedRollChoices!==9||
  TRUE_FIELDS.some(k=>record[k]!==true)||
  FALSE_FIELDS.some(k=>record[k]!==false))
  throw Error('V9 safe receipt: immutable source, rollback or proof boundary');
 const membership=record.directMembershipOrAliasCandidateCount;
 const active=record.membershipsWithBothDateBoundsCoveringHearingDay;
 if(typeof membership!=='number'||!Number.isSafeInteger(membership)||
  membership<0||membership>30||typeof active!=='number'||
  !Number.isSafeInteger(active)||active<0||active>membership)
  throw Error('V9 safe receipt: membership bound and count');
 // Do not emit raw input even after checking it. Reconstruct precisely the
 // approved shape, preventing arbitrary private data from joining the receipt.
 const result=Object.fromEntries(
  SENATE_864_YEA_V9_SAFE_KEYS.map(k=>[k,record[k]]),
 );
 const serialized=JSON.stringify(result);
 if(serialized.length>3000)
  throw Error('V9 safe receipt: serialized size cap');
 return serialized;
}
