/**
 * #864 Campaign issue historical source audit, OFFLINE.
 *
 * 1. Generate 2024/2025 Common Crawl query queue:
 * node --import tsx scripts/audit-senate-commoncrawl-offline.ts --output /tmp/cc-queries.json
 *
 * 2. Import an operator-exported single Common Crawl CDXJ JSONL query result:
 * node --import tsx scripts/audit-senate-commoncrawl-offline.ts \
 *   --query-id cc-0001 --index-jsonl /path/to/cdx.jsonl \
 *   --output /tmp/cc-index-review.json
 *
 * 3. Verify one operator-downloaded HTTP 206 WARC.gz byte range, using 1-based
 *    --record-number and optional local original HTTP payload preservation:
 * node --import tsx scripts/audit-senate-commoncrawl-offline.ts \
 *   --query-id cc-0001 --index-jsonl /path/to/cdx.jsonl \
 *   --record-number 1 --warc-gz /path/to/one-record.warc.gz \
 *   --payload-output /tmp/untrusted-campaign-page.html \
 *   --output /tmp/cc-warc-proof.json
 *
 * No automatic network calls, Common Crawl queries, Neon/Vercel reads/writes,
 * production backfill, statement publishing, serving, model or scheduler work.
 */
import { mkdirSync,readFileSync,statSync,writeFileSync } from 'node:fs';
import {dirname,resolve} from 'node:path';
import {
  planSenateCommonCrawlIndexResearch,reviewOfflineCommonCrawlIndexRows,
  type CommonCrawlCatalog,
} from '../src/evidence/senate-commoncrawl-historical-recovery.js';
import {inspectSenateCommonCrawlWarcBytes} from '../src/evidence/senate-commoncrawl-warc-proof.js';
import type {CampaignPageLeadManifest} from '../src/evidence/campaign-archive-source-recovery.js';

const cli=process.argv.slice(2);
function option(name:string):string|undefined{
  const at=cli.indexOf(name),inline=cli.find(x=>x.startsWith(name+'='));
  const val=at>=0?cli[at+1]:inline?.slice(name.length+1);
  return val&&!val.startsWith('--')?val:undefined;
}
function readLimited(path:string,bytes:number):Buffer{
  const source=resolve(path);
  if(statSync(source).size>bytes)throw new Error('Local offline input exceeds bounded file-size limit: '+source);
  return readFileSync(source);
}
function json<T>(path:string,bytes:number):T{
  return JSON.parse(readLimited(path,bytes).toString('utf8')) as T;
}
function main(){
  const out=option('--output');
  if(!out)throw new Error('--output is required');
  const sitesFile=option('--leads')??'data/evaluation/senate-campaign-issue-page-url-leads-2024-25-v1.json';
  const catalogFile=option('--catalog')??'data/evaluation/senate-commoncrawl-index-windows-2024-25-v1.json';
  const indexFile=option('--index-jsonl'),qid=option('--query-id');
  const warcFile=option('--warc-gz'),recordNumber=option('--record-number');
  const payloadFile=option('--payload-output');
  if(Boolean(indexFile)!==Boolean(qid))throw new Error('Provide --index-jsonl and --query-id together');
  if(Boolean(warcFile)!==Boolean(recordNumber))throw new Error('Provide --warc-gz and --record-number together');
  if(warcFile&&!indexFile)throw new Error('WARC verification requires an offline index query');
  if(payloadFile&&!warcFile)throw new Error('Payload saving requires verified offline WARC input');
  if(recordNumber&&(!/^[1-9]\d*$/.test(recordNumber)||+recordNumber>400))
    throw new Error('Use a 1-based record number of 1–400');
  const files=[sitesFile,catalogFile,indexFile,warcFile].filter((x):x is string=>!!x).map(x=>resolve(x));
  if(files.includes(resolve(out))||payloadFile&&[...files,resolve(out)].includes(resolve(payloadFile)))
    throw new Error('Refusing to overwrite or alias input/report and original-payload outputs');
  const leads=json<CampaignPageLeadManifest>(sitesFile,4*1024*1024);
  const catalog=json<CommonCrawlCatalog>(catalogFile,512*1024);
  const plan=planSenateCommonCrawlIndexResearch(leads,catalog);
  let reviewed:ReturnType<typeof reviewOfflineCommonCrawlIndexRows>|null=null;
  let warc:ReturnType<typeof inspectSenateCommonCrawlWarcBytes>|null=null;
  if(indexFile){
    const query=plan.queries.find(q=>q.id===qid);
    if(!query)throw new Error('Unrecognized source query id');
    const raw=readLimited(indexFile,2_000_000).toString('utf8');
    reviewed=reviewOfflineCommonCrawlIndexRows(query,raw);
  }
  if(warcFile){
    const row=reviewed?.records[Number(recordNumber)-1];
    if(!row)throw new Error('Selected Common Crawl index record does not exist or is excluded by cutoff');
    warc=inspectSenateCommonCrawlWarcBytes(row,readLimited(warcFile,8*1024*1024),leads);
  }
  const report={
    ...plan,
    importedCdxIndexReview:reviewed,
    locallyCrossCheckedWarcBytes:warc?.report??null,
    reportIsAnOriginalArchivePublicationTimeAttestation:false,
    promotedHistoricalCampaignStatements:0,
  };
  // Nothing is written until all source checks above have passed.
  if(payloadFile && warc){
    const full=resolve(payloadFile);
    mkdirSync(dirname(full),{recursive:true});
    writeFileSync(full,warc.originalHttpPagePayloadBytes,{flag:'wx',mode:0o600});
  }
  const target=resolve(out);
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,JSON.stringify(report,null,2)+'\n',
    {flag:'wx',mode:0o600,encoding:'utf8'});
  console.log(JSON.stringify({
    output:target,plannedCrawlIndexQueries:plan.totals.plannedTargetedQueries,
    importedIndexRows:reviewed?.counts.indexCandidateRecords??0,
    verifiedAgainstSuppliedWarcDigests:Boolean(warc),
    historicalCampaignStatementsPromoted:0,
    independentlyAuthenticatedRemoteArchiveSource:false,
    forecastEligible:false,
  },null,2));
}
main();
