/**
 * PR-only #864: re-authenticate official legislative service directly, and
 * reconcile one already source-authenticated 2025 Senate committee's original
 * filed PDFs/amendments vs still-unknown statutory filing obligations.
 * Persist source metadata only; no PDF bodies, donor names or transactions.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {
  OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
  OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,
  parseOfficialMnSenateServiceDirectory,
} from '../src/evidence/senate-official-ever-served-directory.js';
import {
  SENATE_SD6_2025_REPORT_OBLIGATION_CASE_VERSION,
  SENATE_SD6_2025_PROOF_PATH,reconcileServedSenatorSd6ReportCase,
} from '../src/evidence/cfb-2025-served-sd6-report-obligation-case.js';
async function lrlHtml(url:string){
  const res=await fetch(url,{headers:{'user-agent':'VotePredict/2.0 historical-only-SD6-filer-obligation-audit'},
    redirect:'follow',signal:AbortSignal.timeout(45_000)});
  const actual=new URL(res.url),expected=new URL(url);
  if(!res.ok||actual.protocol!=='https:'||actual.hostname!=='www.lrl.mn.gov'
    ||actual.pathname!==expected.pathname||actual.search!==expected.search)
    throw Error('Original official Minnesota LRL source request failed identity');
  const bytes=new Uint8Array(await res.arrayBuffer());
  if(bytes.length<9000||bytes.length>5_000_000)throw Error('Original official LRL HTML out of bounds');
  const observedAt=new Date().toISOString();
  return{url,bytes,observedAt,sha256:createHash('sha256').update(bytes).digest('hex')};
}
async function main(){
  const a=process.argv.slice(2);
  if(a.length!==2||a[0]!=='--output'||!a[1])throw Error('Use --output artifacts/<file>.json');
  const output=resolve(a[1]);
  if(!output.startsWith(resolve('artifacts')+sep)||!output.endsWith('.json'))
    throw Error('Cannot store source metadata outside artifacts');
  const old=readFileSync(SENATE_SD6_2025_PROOF_PATH);
  const metadataSourceSha256=createHash('sha256').update(old).digest('hex');
  const [service,sworn]=await Promise.all([
    lrlHtml(OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL),
    lrlHtml(OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL),
  ]);
  const verifiedDirectory=parseOfficialMnSenateServiceDirectory(
    service.bytes,service.observedAt,sworn.bytes,sworn.observedAt);
  const result=reconcileServedSenatorSd6ReportCase(
    verifiedDirectory,JSON.parse(old.toString('utf8')));
  const artifact={
    // 'result' already contains the schema identifier (avoid duplicate object keys).
    assembledAt:new Date().toISOString(),
    sourceProofMetadataFile:SENATE_SD6_2025_PROOF_PATH,
    originalMetadataFileSha256:metadataSourceSha256,
    actualServiceSources:[
      {url:service.url,sha256:service.sha256,bytes:service.bytes.length,observedAt:service.observedAt},
      {url:sworn.url,sha256:sworn.sha256,bytes:sworn.bytes.length,observedAt:sworn.observedAt},
    ],
    ...result,
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({
    verifiedActualSenator:result.scope.person,
    sourceOriginalReportCount:result.sourceResults.originalPdfVersionReferences,
    amendmentCount:result.sourceResults.amendmentVersionReferences,
    newOriginalPdfsThisAudit:result.sourceResults.newlyAuthenticatedPdfCount,
    obligationDenominator:result.committeeYearDuty.legallyRequiredReportCount,
    verifiedPublicBy:result.sourceResults.historicalPublicByVerified,
    unresolvedCoverageConflicts:result.sourceResults.reportPeriodsWithHeldCalendarMismatch,
    output,
  },null,2));
  if(result.sourceResults.originalPdfVersionReferences!==4
    ||result.sourceResults.amendmentVersionReferences!==1
    ||result.committeeYearDuty.legallyRequiredReportCount!==null)process.exitCode=1;
}
main().catch(e=>{
  console.error(e instanceof Error?e.message.replace(/https?:\/\/\S+/g,'[official source]'):'unknown source error');
  process.exitCode=1;
});
