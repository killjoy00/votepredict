/**
 * #864 source-only replay risk proof: the historic committee importer uses
 * sourceDocumentUrlShaPrefix + parser observationIndex as persisted event key
 * and ON CONFLICT DO UPDATE. Parser v3 added independently authenticated named
 * actions, which can shift those indices. Never authorize database mutations
 * from parser gains, a matching member-choice slate, or raw counts.
 *
 * This verifier uses *synthetic only* action anchors and numeric slots.
 * Original source document names, people, raw URLs, motion text and private
 * event keys must not be embedded in source-only receipts.
 */
export type SyntheticSourceAction={
 observationIndex:number;
 actionAnchor:string;
};
export type SourceReplayRiskInput={
 originalPdfShaAuthenticated:boolean;
 oldCandidateCount:number;
 currentCandidateCount:number;
 oldAnchoredActions:readonly SyntheticSourceAction[]|null;
 currentAnchoredActions:readonly SyntheticSourceAction[]|null;
};
/** Fail-closed result; never a stored parity or replay authorization. */
export function evaluateSenate864ParserPositionalKeyReplayRisk(input:SourceReplayRiskInput){
 const n=input.oldCandidateCount,m=input.currentCandidateCount;
 if(input.originalPdfShaAuthenticated!==true||
  !Number.isSafeInteger(n)||!Number.isSafeInteger(m)||n<0||m<0||n>100||m>100)
  throw Error('Original SHA or parser action counts unverified');
 function indexed(rows:readonly SyntheticSourceAction[]|null,count:number){
  if(rows===null)return null;
  if(rows.length!==count)throw Error('Insufficient old/new action-anchor coverage');
  const seen=new Set<string>();
  return rows.map((x,i)=>{
   if(x.observationIndex!==i||
    !/^[a-z][a-z0-9_-]{1,25}:[a-z0-9_-]{1,45}$/.test(x.actionAnchor)||
    seen.has(x.actionAnchor))
    throw Error('Source anchor ambiguous, duplicate, or observation-index drift');
   seen.add(x.actionAnchor);
   return x.actionAnchor;
  });
 }
 const old=indexed(input.oldAnchoredActions,n),current=indexed(input.currentAnchoredActions,m);
 let oldKeyReusedForDifferentSourceActionCount=0,oldActionsNoLongerInSourceCount=0;
 let newlyRecognizedActionsRequiringSourceIdentityReviewCount=Math.max(0,m-n);
 if(old&&current){
  for(let i=0;i<n;i++){
   if(!current.includes(old[i]!))oldActionsNoLongerInSourceCount++;
   if(i<current.length&&current[i]!==old[i])oldKeyReusedForDifferentSourceActionCount++;
  }
  newlyRecognizedActionsRequiringSourceIdentityReviewCount=
    current.filter(a=>!old.includes(a)).length;
 }
 return {
  schemaVersion:'senate-864-historic-committee-positional-event-key-risk-v1' as const,
  issue:864 as const,
  originalPdfShaAuthenticated:true as const,
  oldNamedParserCandidates:n,currentNamedParserCandidates:m,
  netCandidateGain:m-n,
  oldEventKeySlotsAtRiskWhenSourceActionReordered:n,
  oldKeyReusedForDifferentSourceActionCount,
  originalActionsNoLongerPresentCount:oldActionsNoLongerInSourceCount,
  newlyRecognizedActionsRequiringSourceIdentityReviewCount,
  oldAndNewOriginalActionAnchorSetsIndependentlyComplete:old!==null&&current!==null,
  externalKeyUsesParserObservationIndex:true as const,
  conflictHandlerCanUpdateExistingVoteEvent:true as const,
  legacyStoredActionToCurrentActionMappingVerified:false as const,
  legacyStoredEventAndMemberVoteRekeyAuthorized:false as const,
  parserV3RebackfillAllowed:false as const,
  noStoredOrProductionDataReadOrWritten:true as const,
  noPersonalNameMotionTextUrlOrChoiceDigestEmitted:true as const,
  completeOfficialHistoricalVoteUniverseNotCertified:true as const,
  issue864Open:true as const,
 };
}
