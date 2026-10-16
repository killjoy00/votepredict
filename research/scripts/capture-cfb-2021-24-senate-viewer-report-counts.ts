/**
 * One-time PR-only #864 public CFB candidate report-reference count discovery.
 * Exactly 396 candidate reports_data requests selected from original source-
 * pinned 2022/2024 Senate-district viewer election segments (275 distinct IDs).
 * No PDFs, private report content, donor information or database access.
 *
 * node --import tsx scripts/capture-cfb-2021-24-senate-viewer-report-counts.ts \
 *   --output artifacts/cfb-2021-24-senate-historical-viewer-reference-counts.json
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import {
  fetchCfbCandidateHistoricalReportReferenceSnapshot,
} from '../../src/evidence/cfb-candidate-report-history.js';
import type { CfbCandidateInventorySnapshot } from '../../src/evidence/cfb-candidate-report-inventory.js';
import {
  CFB_SENATE_SOURCE_VIEWER_CHECKPOINT_PATH,
  auditCfb2021to24SenateViewerReferenceCounts,
  deriveCfb2021to24SenateViewerCohort,
} from '../../src/evidence/cfb-2021-24-senate-viewer-report-counts.js';

const BASE='https://register.cfb.mn.gov';
function safeErrorType(error:unknown):string {
  if(error instanceof Error){
    // Never copy response HTML or personal-data-containing exception bodies.
    if(/timeout|abort/i.test(error.message)) return 'timeout_or_abort';
    if(/HTTP [45]\d\d/i.test(error.message)) return 'source_http_error';
    if(/redirect|official/i.test(error.message)) return 'source_identity_error';
    if(/parse|JSON|tabcontent|references/i.test(error.message)) return 'source_payload_parse_error';
    return error.name.slice(0,50) || 'unclassified_error';
  }
  return 'unclassified_error';
}
async function main() {
  const args=process.argv.slice(2);
  if(args.length!==2 || args[0]!=='--output' || !args[1]) {
    throw Error('Required: --output artifacts/<newfile>.json; no arbitrary registrations/ranges');
  }
  const output=resolve(args[1]);
  if(!output.startsWith(resolve('artifacts')+sep) || !output.endsWith('.json')) {
    throw Error('Metadata-only artifact must be a new JSON under artifacts/');
  }
  const original=JSON.parse(readFileSync(CFB_SENATE_SOURCE_VIEWER_CHECKPOINT_PATH,'utf8'));
  const cohort=deriveCfb2021to24SenateViewerCohort(original);
  const snapshots:CfbCandidateInventorySnapshot[]=new Array(cohort.targets.length);
  let next=0;
  async function worker(){
    while(next<cohort.targets.length){
      const i=next++;
      const target=cohort.targets[i]!;
      const url=BASE+'/reports-and-data/viewers/campaign-finance/candidates/'
        +target.registrationNumber+'/'+target.segmentEndYear+'/';
      try {
        const s=await fetchCfbCandidateHistoricalReportReferenceSnapshot(
          target.registrationNumber,target.segmentEndYear);
        if(s.registrationNumber!==target.registrationNumber
          || s.segmentEndYear!==target.segmentEndYear
          || s.sourceUrl!==url
          || s.apiUrl!==BASE+'/reports-and-data/viewers/campaign-finance/candidates/api'
          || !/^[a-f0-9]{64}$/.test(s.responseSha256)
          || s.references.length>64) {
          throw Error('Source identity or reference count failed contract');
        }
        snapshots[i]={...s,status:'acquired'};
      }catch(error){
        snapshots[i]={
          status:'fetch_failed',
          registrationNumber:target.registrationNumber,
          segmentEndYear:target.segmentEndYear,
          sourceUrl:url,
          errorKind:safeErrorType(error),
        };
      }
      await new Promise(done=>setTimeout(done,150));
    }
  }
  await Promise.all([worker(),worker()]);
  const audit=auditCfb2021to24SenateViewerReferenceCounts(cohort.targets,snapshots);
  const artifact={
    schemaVersion:audit.version,
    capturedAt:new Date().toISOString(),
    sourceScope:{
      ...cohort,
      targets:undefined,
      ...audit.scope,
      sourcePinned2020to2026RegistrationCheckpoint:CFB_SENATE_SOURCE_VIEWER_CHECKPOINT_PATH,
      sourcePinnedRegistrationCheckpointSha256:original.provenance.rawJsonSha256,
      excluded2020OnlyRegistrations:cohort.notSelectedViewer2020Only,
      excluded2026OnlyRegistrations:cohort.notSelectedViewer2026Only,
    },
    sourceObservations:snapshots.map(s=>s.status==='acquired'?{
      registrationNumber:s.registrationNumber,
      segmentEndYear:s.segmentEndYear,
      status:s.status,
      sourceUrl:s.sourceUrl,
      fetchedAt:s.fetchedAt,
      sourceApiBodySha256:s.responseSha256,
      referencesExtractedForTwoYearSegment:s.references.length,
      sourceReportVersionIds:s.references.map(r=>
        [r.registrationNumber,r.year,r.type,r.period,r.se,r.amendment].join(':')).sort(),
    }:{
      registrationNumber:s.registrationNumber,
      segmentEndYear:s.segmentEndYear,
      status:s.status,
      sourceUrl:s.sourceUrl,
      errorKind:s.errorKind,
    }),
    audit,
    statewideLegallyActiveSenateCommitteeYears:null,
    senateCandidateLegallyOwedReportDenominator:null,
    senateCandidateActuallyFiledOriginalReportDenominator:null,
    candidateReportViewerReferencesAreProofOfLegalFiling:false,
    historicallyVerifiedPublicByReportCount:0,
    noRawReportPdfOrHtmlOrCandidateFinanceDetailsStored:true,
    productionReadOrWrite:false,
    modelOrServingChanged:false,
    schedulerAdded:false,
    issue864RemainsOpen:true,
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(artifact,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  const failures=audit.totals.sourceSegmentFailures;
  const malformed=audit.totals.referenceIdentityMalformedFilerYears;
  const invalid=audit.totals.sourcePayloadOrIdentityInvalidFilerYears;
  console.log(JSON.stringify({
    schemaVersion:audit.version,
    scopedUniqueRegistrationIds:cohort.scopedDistinctRegistrationNumbers.length,
    officialCandidateViewerApiRequestsExpected:cohort.targets.length,
    responsesSucceeded:audit.totals.candidateSegmentsWithSuccessfulViewerResponse,
    responsesFailed:failures,
    invalidFilerYears:invalid,
    yearSpecificMalformedFilerYears:malformed,
    byYear:audit.byYear,
    totals:audit.totals,
    failedSnapshots:snapshots.filter(s=>s.status==='fetch_failed').slice(0,20).map(s=>({
      registrationNumber:s.registrationNumber,segmentEndYear:s.segmentEndYear,
      status:s.status,errorKind:s.errorKind,
    })),
    caution:'Scoped CFB viewer original/amendment references, not PDF proofs, legally owed or actually filed report counts',
    statewideRequiredReportDenominator:null,
    statewideActuallyFiledOriginalReports:null,
    historicalPublicByVerifiedCount:0,
    output,productionAction:'none',
  },null,2));
  if(failures>0 || invalid>0 || malformed>0
    || audit.totals.candidateSegmentsWithSuccessfulViewerResponse!==396){
    process.exitCode=1;
  }
}
main().catch(error=>{
  console.error(error instanceof Error?error.message:String(error));
  process.exitCode=1;
});
