/** Persist one independently verified original historical campaign page as context only. */
export function contextDraft(proof,membershipId){
 return {
  target:{membershipId},kind:'context',stance:'neutral',
  claim:'Archived historical candidate site independently verified by original file and CDX index.',
  sourceQuality:'member_primary',relevance:'low',freshness:'stale',
  extractionMethod:'historical-original-html-cdx-independent',
  extractionVersion:'senate-864-72-original-html-context-v1',confidence:1,
  metadata:{contextType:'historical_source_receipt',subtype:'archived_original_candidate_page',
    sourceSubtype:'historical_candidate_original_page',
    archiveCaptureUtc:proof.archiveCapturedAtUtc,originalUrl:proof.originalUrl,
    originalHtmlSha256:proof.originalHtmlSha256,
    originalCdxSha1Base32:proof.originalCdxSha1Base32,
    contextOnly:true,sourceVerified:true,mechanicallyActionable:false,
    firstAuthoredDateKnown:false,asOfEligible:false,sameDayEligible:false,modelWeight:0}
 };
}
