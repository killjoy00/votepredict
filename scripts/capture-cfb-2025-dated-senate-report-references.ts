/**
 * Issue #864. ONE-TIME finite public CFB 2025 report-reference discovery
 * for the 41 Senate committees independently dated as registered in 2025.
 *
 * Existing 2026 candidate-election segments may expose 2025 report refs.
 * This is NOT a PDF acquisition, a legal report obligation inventory, or a
 * proof of historical publication date. NEVER affect serving/production DB.
 */
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  selectCfb2025DatedSenateRegistrationTargets
} from '../src/evidence/cfb-2025-dated-senate-registration-cohort.js';
import {
  fetchCfbCandidateHistoricalReportReferenceSnapshot,
} from '../src/evidence/cfb-candidate-report-history.js';
import {
  auditCfbSenateCandidateReportReferences,
  type CfbCandidateInventorySnapshot,
} from '../src/evidence/cfb-candidate-report-inventory.js';

const BASE='https://register.cfb.mn.gov';
const ledgerPath='docs/evaluation/source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json';
const datedPath='docs/evaluation/source-proof/cfb-2026-public-current-senate-registration-dates.psv';
const originalDatedSha256='31376fef8883e40d86091632b7d0581ee034553f56f43d56744ebe7c3c9a94ec';
const args=process.argv.slice(2);
if (args.length!==2 || args[0]!=='--output' || !args[1]) {
  throw Error('Required: --output <JSON file>');
}
const output=resolve(args[1]);
if (/\/source-proof\/.*\.json$/.test(output) || output===resolve(ledgerPath)) {
  throw Error('Cannot overwrite official original source ledgers');
}
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
async function main() {
  const ledger=JSON.parse(readFileSync(ledgerPath,'utf8'));
  const dated=readFileSync(datedPath,'utf8');
  if (hash(dated.trimEnd())!==originalDatedSha256) {
    throw Error('Dated Senate registration source fingerprint differs from pinned official snapshot');
  }
  const cohort=selectCfb2025DatedSenateRegistrationTargets(ledger,dated);
  if (cohort.datedRegistration2025.length!==41 ||
    cohort.datedRegistration2026Excluded.length!==78 ||
    cohort.registrationDateStillUnverified.length!==15 ||
    cohort.otherDatedRegistrationYearsNotAutoAssigned.length!==0 ||
    cohort.observedOnlyOn2026ElectionSegment!==134 ||
    !cohort.datedRegistration2025.includes('19205')) {
    throw Error('2025 source-confirmed candidate cohort changed; re-review before any acquisition');
  }
  const registrations=cohort.datedRegistration2025;
  const snapshots: CfbCandidateInventorySnapshot[]=new Array(registrations.length);
  let next=0;
  async function worker() {
    while (next<registrations.length) {
      const at=next++;
      const registrationNumber=registrations[at]!;
      try {
        const snapshot=await fetchCfbCandidateHistoricalReportReferenceSnapshot(registrationNumber,2026);
        if (snapshot.registrationNumber!==registrationNumber ||
          snapshot.segmentEndYear!==2026 ||
          snapshot.sourceUrl!==BASE+'/reports-and-data/viewers/campaign-finance/candidates/'+registrationNumber+'/2026/' ||
          snapshot.apiUrl!==BASE+'/reports-and-data/viewers/campaign-finance/candidates/api') {
          throw Error('Unexpected official CFB report reference source identity');
        }
        snapshots[at]={...snapshot,status:'acquired'};
      } catch(error) {
        snapshots[at]={
          registrationNumber,
          segmentEndYear:2026,
          sourceUrl:BASE+'/reports-and-data/viewers/campaign-finance/candidates/'+registrationNumber+'/2026/',
          status:'fetch_failed',
          // No arbitrary response-body text retained.
          errorKind: error instanceof Error ? error.name.slice(0,40) : 'unknown',
        };
      }
      await new Promise(resolve=>setTimeout(resolve,150));
    }
  }
  await Promise.all([worker(),worker()]);
  const inventory=auditCfbSenateCandidateReportReferences(
    registrations.map(registrationNumber=>({registrationNumber,year:2025})),snapshots,
  );
  const targets2025=inventory.byYear.find(x=>x.year===2025);
  if (!targets2025) throw Error('2025 audit grouping missing');
  const sourceFailures=snapshots.filter(x=>x.status!=='acquired').length;
  const malformed=inventory.filerYears.reduce((n,r)=>n+r.invalidReferences,0);
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify({
    version:'cfb-2025-registered-senate-report-viewer-references-v1',
    capturedAt:new Date().toISOString(),
    sourceViewerDomain:'register.cfb.mn.gov',
    targetCohort:cohort,
    sourceCandidateReferenceResponses:snapshots.map(s=>s.status==='acquired'?{
      registrationNumber:s.registrationNumber,
      segmentEndYear:s.segmentEndYear,
      status:s.status,
      viewerUrl:s.sourceUrl,
      apiUrl:s.apiUrl,
      fetchedAt:s.fetchedAt,
      rawApiResponseSha256:s.responseSha256,
      originalApiReferenceCount:s.references.length,
      reportYearInScope:2025,
    }:{
      registrationNumber:s.registrationNumber,segmentEndYear:s.segmentEndYear,
      status:s.status,sourceUrl:s.sourceUrl,errorKind:s.errorKind,
    }),
    audited2025ReportReferences:inventory,
    sourceSourceFailures:sourceFailures,
    malformedReportReferences:malformed,
    historicalOfficialRegisteredFilerDenominator:null,
    statutoryRequiredReportDenominator:null,
    actualFiledOriginalPdfProofCount:0,
    historicalPublicByProofCount:0,
    servingModelOrProductionDbChanged:false,
  },null,2)+'\n',{encoding:'utf8',flag:'wx'});
  console.log(JSON.stringify({
    version:'cfb-2025-registered-senate-report-viewer-references-v1',
    registeredDuring2025CandidateCount:registrations.length,
    viewerSegmentYear:2026,
    sourceAcquired:registrations.length-sourceFailures,
    sourceFailures,
    malformedReportReferences:malformed,
    candidates2025WithReportReferences:targets2025.filerYearsWithViewerReferences,
    candidates2025WithoutMatchingYearReferences:targets2025.noMatchingYearReferences,
    distinct2025ReportReferences:targets2025.observedDistinctReportReferences,
    original2025ReportPdfProofs:0,
    official2025RequiredReports:null,
    firstIndependentOriginalPdfControl19205Observed:inventory.filerYears.some(x=>x.registrationNumber==='19205'&&x.referenceCount>0),
    output,
  },null,2));
  if(sourceFailures>0 || malformed>0 || inventory.filerYears.length!==41 ||
    !inventory.filerYears.some(x=>x.registrationNumber==='19205'&&x.referenceCount>0)) {
    process.exitCode=1; // actual source missingness, never proof no filings
  }
}
main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1});
