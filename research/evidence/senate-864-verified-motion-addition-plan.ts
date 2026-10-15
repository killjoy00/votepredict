/**
 * #864: exact-original, historical-roster-resolved, read-only-snapshot-bound
 * committee named vote ADDED-ONLY integration plan. This does not open a DB,
 * construct SQL, mutate legacy events or allow positional event replay.
 *
 * Important: counting source candidates != proving absent stored votes.
 * Unresolved source names, old positional rows and duplicate motion slates
 * become explicit HOLD; never insert/replace on an ambiguous stored match.
 */
import {createHash} from 'node:crypto';
export type RecordedSide='yea'|'nay';
export type VerifiedSide={
 sourceName:string;historicalMembershipId:string|null;choice:RecordedSide;
};
export type OriginalMotion={
 year:2022|2023|2024|2025;
 hearingDate:string;committeeName:string;originalSourceSha256:string;
 originalNormalizedTextSha256:string;originalMotionContextSha256:string;
 originalTextOffset:number;recordedYea:number;recordedNay:number;
 billIdentifier:string|null;amendmentRef:string|null;
 originalExplicitNamedRoll:boolean;independentOriginalBodyShaAuthenticated:boolean;
 historicMemberServiceDayIndependentlyValidated:boolean;
 memberSides:VerifiedSide[];
};
export type StoredMotion={
 externalKey:string;originalSourceSha256:string;
 originalTextOffset:number|null;originalMotionContextSha256:string|null;
 hearingDate:string;committeeName:string;billIdentifier:string|null;
 amendmentRef:string|null;recordedYea:number;recordedNay:number;
 memberSides:VerifiedSide[];
 storedMemberChoicesComplete:boolean;
};
export type CompleteSourceSnapshot={
 originalSourceSha256:string;
 queryReadOnlyAndRolledBack:boolean;
 sourceDocumentShaExactlyMatched:boolean;
 exhaustiveStoredSourceEventRowsCompared:boolean;
 matchedDeployedDatabaseBindingIndependentlyVerified:boolean;
 events:StoredMotion[];
};
export type MotionPlanRow={
 status:'already_stored_verified'|'candidate_add_only_after_separate_approval'|
  'hold_unverified_original_or_member'|'hold_ambiguous_existing_event'|
  'hold_stored_event_disagrees';
 stableExternalKey:string|null;
 sourceYeaCount:number;sourceNayCount:number;
 existingEventKeyNotExported:true;
 memberNamesNotExported:true;
};
const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
const hex=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid=(s:string|null)=>s!==null&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s);
const normalize=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const score=(rows:VerifiedSide[])=>rows
 .map(v=>[v.historicalMembershipId,v.choice].join(':')).sort().join('|');
const exact=(a:OriginalMotion,b:StoredMotion)=>
 a.originalSourceSha256===b.originalSourceSha256&&
 a.hearingDate===b.hearingDate&&a.committeeName===b.committeeName&&
 a.billIdentifier===b.billIdentifier&&a.amendmentRef===b.amendmentRef&&
 a.recordedYea===b.recordedYea&&a.recordedNay===b.recordedNay&&
 b.storedMemberChoicesComplete===true&&score(a.memberSides)===score(b.memberSides);
function validateOriginal(a:OriginalMotion){
 if(a.originalExplicitNamedRoll!==true||a.independentOriginalBodyShaAuthenticated!==true||
  a.historicMemberServiceDayIndependentlyValidated!==true||
  !hex(a.originalSourceSha256)||!hex(a.originalNormalizedTextSha256)||
  !hex(a.originalMotionContextSha256)||
  !Number.isSafeInteger(a.originalTextOffset)||a.originalTextOffset<0||
  a.hearingDate.slice(0,4)!==String(a.year)||
  !/^202[2-5]-\d\d-\d\d$/.test(a.hearingDate)||
  !a.committeeName||a.committeeName.length>150||
  !Number.isSafeInteger(a.recordedYea)||!Number.isSafeInteger(a.recordedNay)||
  a.recordedYea+a.recordedNay<1||a.recordedYea+a.recordedNay>22||
  a.memberSides.length!==a.recordedYea+a.recordedNay)
  return false;
 const names=new Set<string>(),members=new Set<string>();
 for(const v of a.memberSides){
  if(!v.sourceName.trim()||v.sourceName.length>90||
   !uuid(v.historicalMembershipId)||
   !['yea','nay'].includes(v.choice))return false;
  const n=normalize(v.sourceName);
  if(names.has(n)||members.has(v.historicalMembershipId!))return false;
  names.add(n);members.add(v.historicalMembershipId!);
 }
 return a.memberSides.filter(v=>v.choice==='yea').length===a.recordedYea&&
  a.memberSides.filter(v=>v.choice==='nay').length===a.recordedNay;
}
export function stableSenateCommitteeOriginalMotionKey(original:OriginalMotion){
 if(!hex(original.originalSourceSha256)||
  !hex(original.originalNormalizedTextSha256)||
  !hex(original.originalMotionContextSha256)||
  !Number.isSafeInteger(original.originalTextOffset)||original.originalTextOffset<0)
  throw Error('Stable original source motion needs source/text SHA and exact original offset');
 return 'senate-committee-original-v1:'+sha([
  original.originalSourceSha256,original.originalNormalizedTextSha256,
  original.originalMotionContextSha256,String(original.originalTextOffset),
 ].join('|')).slice(0,48);
}
export function planVerifiedSenateCommitteeNamedRollAdditions(
 rows:readonly OriginalMotion[],snapshot:CompleteSourceSnapshot){
 if(!hex(snapshot.originalSourceSha256)||
  !Array.isArray(rows)||rows.length>100||!Array.isArray(snapshot.events)||snapshot.events.length>200)
  throw Error('Bounded original-source vote and stored snapshot required');
 const snapValid=snapshot.queryReadOnlyAndRolledBack===true&&
  snapshot.sourceDocumentShaExactlyMatched===true&&
  snapshot.exhaustiveStoredSourceEventRowsCompared===true&&
  snapshot.matchedDeployedDatabaseBindingIndependentlyVerified===true;
 const seenOffsets=new Set<number>(),seenStable=new Set<string>();
 const rowsPlanned:MotionPlanRow[]=[];
 for(const a of rows){
  let key:string|null=null;
  if(hex(a.originalSourceSha256)&&hex(a.originalNormalizedTextSha256)&&
   hex(a.originalMotionContextSha256)&&Number.isSafeInteger(a.originalTextOffset)&&
   a.originalTextOffset>=0)
   key=stableSenateCommitteeOriginalMotionKey(a);
  if(a.originalSourceSha256!==snapshot.originalSourceSha256||
   !validateOriginal(a)||!key||seenOffsets.has(a.originalTextOffset)||seenStable.has(key)){
   rowsPlanned.push({
    status:'hold_unverified_original_or_member',stableExternalKey:null,
    sourceYeaCount:a.recordedYea,sourceNayCount:a.recordedNay,
    existingEventKeyNotExported:true,memberNamesNotExported:true
   });
   continue;
  }
  seenOffsets.add(a.originalTextOffset);seenStable.add(key);
  if(!snapValid){
   rowsPlanned.push({
    status:'hold_unverified_original_or_member',stableExternalKey:null,
    sourceYeaCount:a.recordedYea,sourceNayCount:a.recordedNay,
    existingEventKeyNotExported:true,memberNamesNotExported:true
   });
   continue;
  }
  const rowsForDoc=snapshot.events.filter(x=>x.originalSourceSha256===a.originalSourceSha256);
  const byStableKey=rowsForDoc.filter(x=>x.externalKey===key||
   (x.originalTextOffset===a.originalTextOffset&&
    x.originalMotionContextSha256===a.originalMotionContextSha256));
  let status:MotionPlanRow['status'];
  if(byStableKey.length>1)status='hold_ambiguous_existing_event';
  else if(byStableKey.length===1)
   status=exact(a,byStableKey[0]!)?'already_stored_verified':'hold_stored_event_disagrees';
  else{
   // Legacy source events use parser ordinal; match only if stable original
   // amendment/bill identity AND all independently printed individual choices
   // are exact. Unanchored same bill/tally/member slate creates a HOLD.
   const potential=rowsForDoc.filter(s=>
    s.hearingDate===a.hearingDate&&s.committeeName===a.committeeName&&
    s.billIdentifier===a.billIdentifier&&
    s.recordedYea===a.recordedYea&&s.recordedNay===a.recordedNay&&
    (s.amendmentRef===a.amendmentRef||s.amendmentRef===null||
     a.amendmentRef===null));
   if(potential.length===0)
    status='candidate_add_only_after_separate_approval';
   else if(potential.length===1&&a.amendmentRef!==null&&
    potential[0]!.amendmentRef===a.amendmentRef&&exact(a,potential[0]!))
    status='already_stored_verified';
   else status='hold_ambiguous_existing_event';
  }
  rowsPlanned.push({
   status,stableExternalKey:status==='candidate_add_only_after_separate_approval'?key:null,
   sourceYeaCount:a.recordedYea,sourceNayCount:a.recordedNay,
   existingEventKeyNotExported:true,memberNamesNotExported:true
  });
 }
 return {
  schemaVersion:'senate-864-original-anchored-add-only-named-vote-plan-v1' as const,
  historicalYearScope:'2022-2025' as const,
  originalSourceSha256:snapshot.originalSourceSha256,
  sourceNamedRolls:rows.length,
  existingExactVerified:rowsPlanned.filter(x=>x.status==='already_stored_verified').length,
  addOnlyCandidatesAwaitingExplicitDatabaseApproval:
   rowsPlanned.filter(x=>x.status==='candidate_add_only_after_separate_approval').length,
  ambiguouslyExistingOrConflicting:
   rowsPlanned.filter(x=>x.status==='hold_ambiguous_existing_event'||
    x.status==='hold_stored_event_disagrees').length,
  unresolvedSourceRosterOrSnapshot:
   rowsPlanned.filter(x=>x.status==='hold_unverified_original_or_member').length,
  originalSourceAndStoredMemberChoiceSideListsNeverExported:true,
  noAutomaticDatabaseWrites:true,
  noLegacyPositionalUpdates:true,
  noContextActionInferredMemberVotes:true,
  plans:rowsPlanned
 };
}
