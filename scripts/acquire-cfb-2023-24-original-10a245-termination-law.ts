/**
 * #864 finance original statutes only. Two source-year Minnesota Revisor
 * §10A.245 HTML bodies read into memory only, store metadata SHA/bytes and
 * operative flags, not names, financial rows or full law HTML.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {
 ORIGINAL_2023_24_CFB_ADMIN_TERMINATION_VERSION,
 ORIGINAL_REVISOR_TERMINATION_2023,
 ORIGINAL_REVISOR_TERMINATION_2024,
 auditOriginalSection10A245Source,
} from '../src/evidence/cfb-2023-24-original-10a245-committee-termination.js';
const SOURCES=[{year:2023 as const,url:ORIGINAL_REVISOR_TERMINATION_2023},
 {year:2024 as const,url:ORIGINAL_REVISOR_TERMINATION_2024}];
async function fetchOfficialHistoricalStatute(input:(typeof SOURCES)[number]){
 const source=new URL(input.url);
 if(source.protocol!=='https:'||source.hostname!=='www.revisor.mn.gov')
  throw Error('Original Minnesota Revisor host required');
 const r=await fetch(input.url,{redirect:'follow',
  headers:{'user-agent':'Mozilla/5.0 VotePredict original finance law 10A245 proof','accept':'text/html'},
  signal:AbortSignal.timeout(50_000)});
 if(!r.ok)throw Error('Official historical Revisor HTTP '+r.status);
 const url=new URL(r.url);
 if(url.protocol!=='https:'||url.hostname!=='www.revisor.mn.gov')
  throw Error('Original Revisor redirected outside authenticated domain');
 const bytes=new Uint8Array(await r.arrayBuffer());
 if(bytes.byteLength<1000||bytes.byteLength>500_000)
  throw Error('Historical original Revisor statute response out of bounds');
 const sha=createHash('sha256').update(bytes).digest('hex'),size=bytes.byteLength;
 const body=new TextDecoder('utf8').decode(bytes);
 const audit=auditOriginalSection10A245Source({
  lawYear:input.year,originalRevisorHtml:body});
 return{...audit,year:input.year,sha256:sha,
   originalHtmlBytes:size,observedAt:new Date().toISOString(),
   sourceTitleAndOperativeLawVerified:true};
}
function err(e:unknown){
 const s=e instanceof Error?e.message:String(e);
 return /timeout|abort/i.test(s)?'original_revisor_timeout':
  /HTTP \d{3}/i.test(s)?'original_revisor_http_unavailable':
  'original_regulator_statute_identity_not_verified';
}
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==2||a[0]!=='--output'||!a[1])throw Error('Only --output artifacts/<new>.json');
 const path=resolve(a[1]);
 if(!path.startsWith(resolve('artifacts')+sep)||!path.endsWith('.json'))
  throw Error('Only source metadata new artifacts JSON output allowed');
 const rows=[] as Array<Awaited<ReturnType<typeof fetchOfficialHistoricalStatute>>>;
 for(const x of SOURCES)rows.push(await fetchOfficialHistoricalStatute(x));
 if(rows.length!==2||rows.some(x=>!x.sourceTitleAndOperativeLawVerified))
  throw Error('Both original 2023 and 2024 regulatory law sources are required');
 const result={
  schemaVersion:ORIGINAL_2023_24_CFB_ADMIN_TERMINATION_VERSION,
  issue:864,observedAt:new Date().toISOString(),
  original2023And2024SourceRecords:rows,
  legalInterpretationScope:{
   candidateCommitteeInactivityIsNotImmediateOnLeavingSenate:true,
   initialInactivityCriterionLaterOfSixYearsSinceLastElectionOrLastService:true,
   BoardTerminationMayOccurOnlyAfterCertifiedNoticeAnd60Days:true,
   BoardTerminationIsDiscretionaryNotAutomatic:true,
   individualCommitteeRegistrationAndOriginalTerminationRecordsProvenCount:0,
   legallyOwed2023Or2024SenatorYEReportDenominator:null,
   historicalActualCFBVersionPublicByProofCount:0,
   noPredictionOrModelEligibility:true,
  },
  safeguards:{governmentPrimarySourceOnly:true,noOriginalHtmlStored:true,
   noCandidateOrDonorTransactions:true,noProductionDatabaseReadWrite:true,
   noModelForecastServingSchedulerOr2027Changes:true,
   keepIssue864Open:true},
 };
 mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({issue:864,
  originals:rows.map(x=>({year:x.year,url:x.sourceUrl,sha:x.sha256,bytes:x.originalHtmlBytes,
    sixYearRule:x.principalCommitteeInactiveOnlyAtLaterOfSixYearsAfterLastCandidacyOrService,
    BoardCertifiedSixtyDays:x.administrativeTerminationOnlyAfter60DayWrittenCertifiedMailNotice})),
  legallyOwedSenatorCommitteeReports:null,exactPublicByProofs:0,
  output:path,productionWrites:0},null,2));
}
main().catch(e=>{console.error(err(e));process.exitCode=1;});
