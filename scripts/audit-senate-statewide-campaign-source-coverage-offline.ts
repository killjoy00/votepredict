/**
 * #864 C: offline winner-election-cohort campaign-source completeness ledger.
 *
 * Fully source-original crosschecked:
 * node --import tsx scripts/audit-senate-statewide-campaign-source-coverage-offline.ts \
 *   --2020-st /artifact/2020-sos-general-stsenate.response \
 *   --2020-cand /artifact/2020-sos-general-cand.response \
 *   --2022-st /artifact/2022-sos-general-stsenate.response \
 *   --2022-cand /artifact/2022-sos-general-cand.response \
 *   --output /tmp/2021-25-senate-campaign-source-coverage.json
 *
 * No flags except --output: ledger-only, source original SHA not rerun.
 * Never uses Neon, Vercel, websites, forecasts or ingestion.
 */
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {auditSos2020to2022OriginalGeneralCensus} from '../src/evidence/senate-2020-22-official-general-census.js';
import {auditStatewideSenateCampaignSourceRecovery} from '../src/evidence/senate-statewide-winner-campaign-source-coverage.js';
const args=process.argv.slice(2);
const flag=(name:string)=>{
 const i=args.indexOf(name);
 const v=i>=0?args[i+1]:args.find(a=>a.startsWith(name+'='))?.slice(name.length+1);
 return v&&!v.startsWith('--')?v:undefined;
};
function originalBytes(path:string){
 const f=resolve(path),stat=statSync(f);
 if(!stat.isFile()||stat.size<100||stat.size>3*1024*1024)
   throw Error('Historical government original source must be a bounded regular file');
 return readFileSync(f);
}
function main(){
 const out=flag('--output');
 if(!out)throw Error('Provide a unique --output report path');
 const paths=['--2020-st','--2020-cand','--2022-st','--2022-cand'].map(flag);
 if(paths.filter(Boolean).length!==0&&paths.filter(Boolean).length!==4)
   throw Error('All four original 2020/22 SOS government files required to crosscheck');
 if(paths.some(x=>x&&resolve(x)===resolve(out)))
   throw Error('Refusing to overwrite an official source original');
 const have=paths.every(Boolean);
 const censuses=have?{
  y2020:auditSos2020to2022OriginalGeneralCensus(2020,originalBytes(paths[0]!),originalBytes(paths[1]!)),
  y2022:auditSos2020to2022OriginalGeneralCensus(2022,originalBytes(paths[2]!),originalBytes(paths[3]!)),
 }:undefined;
 if(censuses&&(!censuses.y2020.source.originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence
   ||!censuses.y2022.source.originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence))
   throw Error('Independent SOS source SHA-256 differs from first published original acquisition');
 const report=auditStatewideSenateCampaignSourceRecovery(censuses);
 const destination=resolve(out);
 mkdirSync(dirname(destination),{recursive:true});
 const output={...report,cliOriginalSOSSourceBytesRehashedAndCrosschecked:have,
  cliDidNotConnectToAnyExternalDatabase:true};
 writeFileSync(destination,JSON.stringify(output,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({
  output:destination,candidateWinnerElectionObservations:report.totals.winnerElectionObservations,
  officialOriginalCensusesRehashed:have?2:0,
  originalCampaignPagesForWinningCandidates:report.totals.winnerOriginalHistoricIssuePageSources,
  winnerWebsiteLeadsOnly:report.totals.winnerWebsitePublisherLinkLeads,
  candidateSurvey2022WinnerExcerptsUnverifiedHistoricalPublicBy:report.totals.winnerPublisherSurveyQuotesWithoutHistoricalPublicBy,
  verifiedMemberYearDenominator:false,
  noProductionWrites:true,
 }));
}
main();
