/**
 * #864: one finite report-viewer provenance cohort, NOT a denominator for
 * Senate committees legally registered or legally required to file.
 *
 * Start with the original 494-ID source-pinned CFB Senate district inventory,
 * retain ONLY registration IDs independently displayed in the 2022 and/or
 * 2024 district election viewer segments, then inspect their matching
 * candidate reports_data tabs for the 2021-2024 calendar years.
 *
 * A viewer report reference is not authenticated PDF bytes, an obligation,
 * proof of historical publication, or evidence of a historical as-of date.
 */
import { createHash } from 'node:crypto';
import {
  auditCfbSenateCandidateReportReferences,
  type CfbCandidateInventorySnapshot,
} from '../../src/evidence/cfb-candidate-report-inventory.js';

export const CFB_SENATE_2021_24_REPORT_REFERENCE_COUNT_VERSION =
  'cfb-senate-2021-24-396-source-viewer-snapshot-counts-v1' as const;
export const CFB_SENATE_SOURCE_VIEWER_CHECKPOINT_PATH =
  'docs/evaluation/source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json';
export const CFB_SENATE_SOURCE_REGISTRATION_IDS_SHA256 =
  'cc6f3830ee1730a31781f282b5ecca0deba8ebfec50c949b28b8ae5f9cf497a3';
export const CFB_SENATE_SOURCE_MEMBERSHIP_MASK_SHA256 =
  'c70219a32a752e024d95d4d318cb43daa33bf45e5c3a2634b6652f7019aca91c';

type SegmentEndYear = 2022 | 2024;
export interface CfbSenateSourceViewerTarget {
  registrationNumber: string;
  segmentEndYear: SegmentEndYear;
  sourceMembershipMask: string;
}
interface SourcePinnedSenateViewerIndex {
  observedCandidateRegistrationIndex: {
    distinctRegistrations: number;
    registrationIdsCsv: string;
    segmentMembershipMaskHex: string;
    registrationIdsNewlineSha256: string;
    registrationMaskHexSha256: string;
  };
  provenance: { runId: number; artifactId: number; rawJsonSha256: string };
}

function hash(input: string): string {
  return createHash('sha256').update(input,'utf8').digest('hex');
}

/** This is a source selection bound, not a history-of-registration classifier. */
export function deriveCfb2021to24SenateViewerCohort(
  source: SourcePinnedSenateViewerIndex,
): {
  targets: CfbSenateSourceViewerTarget[];
  scopedDistinctRegistrationNumbers: string[];
  sourcePinnedTotalRegistrationNumbers: number;
  notSelectedViewer2020Only: number;
  notSelectedViewer2026Only: number;
  notSelectedViewer2020And2026ButNoMidSegment: number;
  legalRegistrationAndFilingDenominator: null;
} {
  const index=source.observedCandidateRegistrationIndex;
  const ids=index.registrationIdsCsv.split(',');
  const masks=index.segmentMembershipMaskHex;
  if (source.provenance.runId!==38081628130 || source.provenance.artifactId!==11680891630
    || source.provenance.rawJsonSha256!=='83770615658f7cf47802b05257bcbd45bed0c7c41ec19dfe99c31ca91b746c04'
    || ids.length!==494 || index.distinctRegistrations!==494
    || masks.length!==ids.length || !/^[0-9a-f]+$/.test(masks)
    || ids.some(id=>!/^\d{3,8}$/.test(id))
    || new Set(ids).size!==ids.length || ids.join(',')!==[...ids].sort().join(',')
    || hash(ids.join('\n'))!==CFB_SENATE_SOURCE_REGISTRATION_IDS_SHA256
    || hash(masks)!==CFB_SENATE_SOURCE_MEMBERSHIP_MASK_SHA256
    || index.registrationIdsNewlineSha256!==CFB_SENATE_SOURCE_REGISTRATION_IDS_SHA256
    || index.registrationMaskHexSha256!==CFB_SENATE_SOURCE_MEMBERSHIP_MASK_SHA256) {
    throw Error('Original CFB Senate 494 registration/segment source checkpoint changed');
  }
  const targets:CfbSenateSourceViewerTarget[]=[];
  const scopedIds=new Set<string>();
  let only2020=0, only2026=0, only2020and2026=0;
  for(let i=0;i<ids.length;i++){
    const id=ids[i]!;
    const mask=Number.parseInt(masks[i]!,16);
    if(!Number.isInteger(mask) || mask<1 || mask>15) throw Error('Invalid CFB Senate district source mask');
    if(mask===1) only2020++;
    if(mask===8) only2026++;
    if(mask===9) only2020and2026++;
    for (const [bit,segmentEndYear] of [[2,2022],[4,2024]] as const){
      if(!(mask&bit)) continue;
      targets.push({registrationNumber:id,segmentEndYear,sourceMembershipMask:masks[i]!});
      scopedIds.add(id);
    }
  }
  targets.sort((a,b)=>a.segmentEndYear-b.segmentEndYear
    || a.registrationNumber.localeCompare(b.registrationNumber));
  const distinct=[...scopedIds].sort();
  if(targets.length!==396 || targets.filter(t=>t.segmentEndYear===2022).length!==270
    || targets.filter(t=>t.segmentEndYear===2024).length!==126
    || distinct.length!==275 || only2020!==84 || only2026!==134
    || only2020and2026!==1
    || !targets.some(t=>t.registrationNumber==='18443'&&t.segmentEndYear===2022)){
    throw Error('CFB viewer cohort scope drift; inspect original Senate registry selection');
  }
  return {
    targets, scopedDistinctRegistrationNumbers:distinct,
    sourcePinnedTotalRegistrationNumbers:494,
    notSelectedViewer2020Only:only2020,
    notSelectedViewer2026Only:only2026,
    notSelectedViewer2020And2026ButNoMidSegment:only2020and2026,
    legalRegistrationAndFilingDenominator:null,
  };
}

/** Count viewer references only, keeping original/amended report-version keys separate. */
export function auditCfb2021to24SenateViewerReferenceCounts(
  targetSegments: readonly CfbSenateSourceViewerTarget[],
  snapshots: readonly CfbCandidateInventorySnapshot[],
) {
  const keys=new Set<string>();
  for(const target of targetSegments){
    const key=target.registrationNumber+':'+target.segmentEndYear;
    if(keys.has(key)) throw Error('Duplicate official viewer target segment');
    keys.add(key);
  }
  const targets=targetSegments.flatMap(target=>([target.segmentEndYear-1,target.segmentEndYear] as const)
    .map(year=>({registrationNumber:target.registrationNumber,year})));
  // CFB mixes candidate public-subsidy affidavits into reports_data. The
  // official source explicitly identifies these as type=aoc, not a principal
  // campaign committee report of receipts/expenditures (type=pcc).
  // Retain exact non-report IDs in the audit, but NEVER count them as a filed
  // campaign finance report, missing report, or malformed principal filing.
  // Fail closed on a new document kind or unexpected affidavit identity.
  const allowedAncillaryAocIds=new Set([
    '2442:22:aoc:C:0:0', '2471:22:aoc:C:0:0',
    '2491:22:aoc:C:0:0', '2495:22:aoc:C:0:0',
  ]);
  const ancillaryDocuments=snapshots.flatMap(snapshot=>snapshot.status==='acquired'
    ? snapshot.references.filter(ref=>ref.type!=='pcc').map(ref=>
      [ref.registrationNumber,ref.year,ref.type,ref.period,ref.se,ref.amendment].join(':'))
    : []);
  if(new Set(ancillaryDocuments).size!==ancillaryDocuments.length
    || ancillaryDocuments.some(id=>!allowedAncillaryAocIds.has(id))) {
    throw Error('Unreviewed non-pcc source viewer document; manual reclassification required');
  }
  const principalCampaignCommitteeSnapshots=snapshots.map(snapshot=>snapshot.status==='acquired'
    ? {...snapshot,references:snapshot.references.filter(ref=>ref.type==='pcc')}
    : snapshot);
  const inventory=auditCfbSenateCandidateReportReferences(targets,principalCampaignCommitteeSnapshots);
  const allRows=inventory.filerYears;
  const reports=inventory.reports;
  const byYear=[2021,2022,2023,2024].map(year=>{
    const entries=allRows.filter(r=>r.year===year);
    const versionRefs=reports.filter(r=>r.reportYear===year);
    const originalRefs=versionRefs.filter(r=>r.amendment===0);
    const amendments=versionRefs.filter(r=>r.amendment>0);
    const obligationKeys=new Set(versionRefs.map(r=>{
      // Same registration/year/report-period/special flag across amendments
      // counts as one observed VIEWER report group, NOT legal duty.
      const tokens=r.reportId.split(':');
      return tokens.slice(0,5).join(':');
    }));
    return {
      reportYear:year,
      sourceScopedCandidateRegistrations:entries.length,
      officialReportViewerApiSnapshotsAcquired:entries.filter(r=>r.status==='source_references_observed'
        || r.status==='no_matching_year_references').length,
      viewerSourceFailures:entries.filter(r=>r.status==='source_fetch_failed').length,
      invalidOrConflictingSourceRows:entries.filter(r=>r.status==='source_payload_invalid'
        || r.status==='source_snapshots_conflict').length,
      candidateRegistrationsWithYearSpecificReferences:
        entries.filter(r=>r.status==='source_references_observed').length,
      candidateRegistrationsWithoutYearSpecificReferences:
        entries.filter(r=>r.status==='no_matching_year_references').length,
      observedDistinctViewerReportGroups:obligationKeys.size,
      originalViewerVersionReferences:originalRefs.length,
      amendedViewerVersionReferences:amendments.length,
      totalViewerVersionReferences:versionRefs.length,
      originalPdfAuthenticatedInThisAudit:0,
      actuallyFiledOriginalReportsIndependentlyConfirmed:null,
      legallyRequiredSenateCandidateReportCount:null,
      statewideLegallyActiveSenateCommitteeCount:null,
      historicPublicByVerifiedCount:0,
    };
  });
  return {
    version:CFB_SENATE_2021_24_REPORT_REFERENCE_COUNT_VERSION,
    scope:{
      sourcePinnedCandidateRegistrationUnion:494,
      viewerSelectionIsHistoricRegistrationProof:false,
      sourceViewerSegments:[2022,2024],
      reportYears:[2021,2022,2023,2024],
      scopedCandidateSegments:targetSegments.length,
      expectedCandidateFilerYearPairs:targets.length,
      scopeOnly2022And2024ViewerDisplayedCommittees:true,
    },
    sourceResults:inventory.inputs,
    byYear,
    results:inventory.filerYears.map(r=>({
      registrationNumber:r.registrationNumber,
      reportYear:r.year,
      sourceSegmentEndYear:r.segmentEndYear,
      status:r.status,
      originalSourceResponseSha256:r.sourceResponseSha256,
      reportVersionReferenceIds:r.referenceIds,
      invalidReferences:r.invalidReferences,
    })),
    totals:{
      viewerReportVersionReferences:reports.length,
      originalViewerVersionReferences:reports.filter(r=>r.amendment===0).length,
      amendmentVersionReferences:reports.filter(r=>r.amendment>0).length,
      sourceSegmentFailures:snapshots.filter(s=>s.status==='fetch_failed').length,
      candidateSegmentsWithSuccessfulViewerResponse:snapshots.filter(s=>s.status==='acquired').length,
      sourcePayloadOrIdentityInvalidFilerYears:allRows.filter(r=>r.status==='source_payload_invalid'
        || r.status==='source_snapshots_conflict').length,
      referenceIdentityMalformedFilerYears:allRows.filter(r=>r.invalidReferences>0).length,
      actuallyFiledOriginalReportsVerified:null,
      historicCommitteeYearRequiredReportDenominator:null,
    },
    ancillaryDocumentsInCandidateReportsTab: {
      sourceCategory:'aoc',
      legalDocumentKind:'affidavit_of_contributions_for_public_subsidy',
      officialStatute:'https://www.revisor.mn.gov/statutes/2022/cite/10A.323',
      excludedFromPrincipalCommitteeReportVersionCounts:ancillaryDocuments.length,
      exactAncillarySourceVersionIds:[...ancillaryDocuments].sort(),
      excludedDoesNotProveAnyFilingExemption:true,
    },
    exclusions:{
      sourceViewer2020Only84NotProbed:true,
      sourceViewer2026Only134NotProbedHere:true,
      sourceViewer2020And2026OnlyOneNotProbed:true,
      sourceDated2025Cohort41CapturedSeparately:true,
      committeesNeverObservedInDistrictViewerNotEnumerated:true,
      lawfullyRegisteredButDidNotRunInElectionMayNotAppear:true,
      originalAmendmentZeroIsNotPdfProof:true,
      zeroViewerReferencesIsNotProofOfZeroFilings:true,
    },
    safeguards:{
      noPdfBodiesReadOrStored:true,
      noDonorTransactionContentStored:true,
      noSourceHtmlStored:true,
      noProductionDatabaseReadOrWrite:true,
      noPredictionsOrServingChanges:true,
      noModelTraining:true,
      noSchedulers:true,
      issue864Open:true,
    },
  };
}
