/**
 * Issue #946 only: public archived original Common Crawl exact-dated URL
 * recovery. No MPR network research. MPR Hauschild selected printed transcript
 * has July 2025 FIRST VERIFIED observation cutoff; never treated as 2024 text.
 */
import {appendFileSync,readFileSync,writeFileSync} from 'node:fs';
import {getTrackDHistoricalShadowPins} from './audit-senate-media-track-d-cross-ingester-readonly-v3.js';
import {
 REFORMER_CC_V7,REFORMER_CC_MAIN_MARKER,
 selectReformerCrawlQueries,runReformerSevenCommonCrawlRecovery,
} from '../src/evaluation/senate-946-reformer-exact-commoncrawl-originals.js';

export function requireReformerCommonCrawlReviewedMain(e:NodeJS.ProcessEnv){
 if(e.GITHUB_ACTIONS!=='true'||
  e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  e.GITHUB_EVENT_NAME!=='push'||
  e.GITHUB_REF!=='refs/heads/main'||e.GITHUB_RUN_ATTEMPT!=='1'||
  e.REFORMER_CC_KEYLESS_PASSED!=='true'||
  e.REFORMER_CC_REVIEWED_MAIN_MARKER!=='true')
  throw Error('Unreviewed Reformer original WARC research request denied');
 return true;
}
export function validateMprJuly2025ResearchCutoff(){
 const r=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-track-d-946-987-seven-alias-three-pdf-actual-results-20261019.json',
  'utf8'));
 const row=r.mpr.perPdf.find((x:any)=>x.id==='mpr-2024-hauschild-3play');
 if(r.mpr.issue!==987||row.archiveUtc!=='2025-07-27T18:09:08Z'||
  row.indexedArchiveAndOriginalPdfBodySha1Verified!==true||
  row.historicallyAuthenticatedOriginalEarlierThanPrevious2025Proof!==false||
  r.policy.retrospectiveForecastFeatureEligibilityAdded!==0)
  throw Error('Existing independently verified July 2025 MPR source boundary changed');
 return {selectedHauschildPrintedHtmlFirstVerifiedMonth:'2025-07',
  hauschildTranscriptPdfArchiveCopyProvedByUtc:'2025-07-27T18:09:08Z',
  noMprNetworkResearch:true,no2024TranscriptionBackdating:true};
}
async function main(){
 let phase='offline-original-plan-validation';
 try{
  if(process.argv.length!==3||
   !['--preview','--capture'].includes(process.argv[2]))
   throw Error('Require exactly --preview or --capture');
  const pins=getTrackDHistoricalShadowPins();
  const queries=selectReformerCrawlQueries(pins);
  const mpr=validateMprJuly2025ResearchCutoff();
  if(queries.length!==14)throw Error('Unexpected Reformer CC index scope');
  if(process.argv[2]==='--preview'){
   console.log('REFORMER_CC_V7_PREVIEW='+JSON.stringify({
    version:REFORMER_CC_V7,
    orderedSources:[...new Set(queries.map(x=>x.target.id))],
    exactHistoricCcCollections:queries.map(x=>({
     publicBriefId:x.target.id,collection:x.collection,
    })),
    originalIndexRequests:14,
    networkRequests:0,productionOrDatabaseWrites:0,
    mpr,
   }));
   return;
  }
  requireReformerCommonCrawlReviewedMain(process.env);
  phase='public-exact-original-archive-replay';
  const result=await runReformerSevenCommonCrawlRecovery(pins);
  phase='metadata-only-output-validation';
  const text=JSON.stringify(result);
  if(text.length>45000||result.exactSelectedIndexRequests!==14||
   result.noDirectPublisherOrMprOrWaybackRequests!==true||
   result.noPrivateDatabaseOrSourceCatalogModelForecastWrites!==true||
   result.rawWarcHtmlAudioOrTranscriptPersisted!==false||
   result.historicalForecastPromotions!==0||
   /"(?:rawHtmlInMemory|htmlContent|fullText|originalHtml|rawTranscript|audioBytes|articleBody)"\s*:/.test(text))
   throw Error('Unexpected raw media source contents or research boundary');
  console.log('REFORMER_CC_V7_ACTUAL_RESULT='+text);
  writeFileSync('reformer-946-v7-original-commoncrawl-public-metadata.json',
   text+'\n',{flag:'wx',encoding:'utf8'});
  if(process.env.GITHUB_STEP_SUMMARY)
   appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '## #946 original dated-path alternative archive recovery\n\n'+
    '- Seven exact Reformer dated-URL hypotheses, fourteen selected Common Crawl indexes\n'+
    '- Authenticated original dated publisher URL paths: '+
    result.distinctOriginalDatedPathUrlsAuthenticated+'\n'+
    '- SHA1-index-authenticated original WARC HTML copies: '+
    result.sha1AuthenticatedOriginalDatedWarcVersions+'\n'+
    '- Source initial publisher posting time, alias equality, full senator quotes, recorded votes and retrospective forecasts: **not established**\n'+
    '- MPR transcript: research cutoff **July 2025**; no new MPR queries or 2024 backdating\n');
 }catch{
  console.error('REFORMER_CC_V7_HOLD='+phase);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/run-senate-946-reformer-exact-commoncrawl-originals-v7.ts'))
 void main();
