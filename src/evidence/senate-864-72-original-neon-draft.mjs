/** #864. A research SOURCE RECEIPT, not a policy position, recorded vote or forecast input. */
export const EXTRACTION_VERSION='senate-864-72-original-html-context-v1';
export function historicalOriginalDraft(row){
 if(!row||typeof row.membershipId!=='string'||typeof row.key!=='string'
  ||typeof row.originalSha!=='string'||!row.provenance?.archiveUrl)
  throw Error('Missing independently proven historical original');
 const meta=row.provenance;
 return {
  source:{
   sourceKind:'wayback_campaign_site',sourceUrl:meta.archiveUrl,
   contentSha256:row.originalSha,jurisdictionSlug:'us-mn',chamberSlug:'senate',
   httpStatus:200,
   metadata:{originalUrl:row.originalUrl,archiveCapturedAt:meta.archiveCapturedAtUtc,
    issue864HistoricalOriginal:meta},
  },
  drafts:[{
   target:{membershipId:row.membershipId},kind:'context',stance:'neutral',
   claim:row.claim,sourceQuality:'member_primary',relevance:'low',freshness:'stale',
   extractionMethod:'original-candidate-html-cdx-source-receipt',
   extractionVersion:EXTRACTION_VERSION,confidence:1,
   metadata:{
    contextType:'historical_source_receipt',subtype:'verified_original_candidate_html',
    issue864HistoricalOriginal:meta,ingestionIdentityKey:row.key,
    sourceVerified:true,contextOnly:true,mechanicallyActionable:false,
    asOfEligible:false,sameDayEligible:false,modelWeight:0,
    originalFirstAuthoredDateKnown:false,officialVoteVerified:false,
    availableAt:meta.archiveCapturedAtUtc,
   }
  }]
 };
}
