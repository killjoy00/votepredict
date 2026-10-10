/**
 * #864: no-credentials, NO NETWORK, no database / model/forecast modifications.
 *
 * node --import tsx scripts/plan-senate-campaign-archive-source-recovery-offline.ts \
 *     --output /tmp/senate-campaign-archive-queries.json
 *
 * Optional imported CDX responses:
 * --cdx-export /path/to/priorly-exported-cdx.json
 *
 * The export input MUST be locally obtained from independently reviewed CDX
 * source(s); this tool cannot authenticate a caller-supplied index response.
 */
import { mkdirSync,readFileSync,statSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import {
  planCampaignArchiveSourceRecovery,
  type CampaignPageLeadManifest, type OfflineCdxResult,
} from '../src/evidence/campaign-archive-source-recovery.js';
import type { SenateSosSeedManifest } from '../src/evidence/sos-senate-historical-candidate-inventory.js';

const DEFAULT_LEADS='data/evaluation/senate-campaign-issue-page-url-leads-2024-25-v1.json';
const DEFAULT_WINNERS='data/evaluation/senate-sos-campaign-website-seeds-2021-25-v1.json';
const args=process.argv.slice(2);
function flag(name:string):string|undefined{
  const at=args.indexOf(name);
  const value=at>=0?args[at+1]:args.find(x=>x.startsWith(name+'='))?.slice(name.length+1);
  return value&&!value.startsWith('--')?value:undefined;
}
function bounded(path:string,maxBytes:number):string{
  const full=resolve(path);
  if(statSync(full).size>maxBytes)throw new Error('Offline input exceeds '+maxBytes+' byte cap');
  return readFileSync(full,'utf8');
}
function main(){
  const outputArg=flag('--output');
  if(!outputArg)throw new Error('--output required');
  const leadPath=flag('--leads')??DEFAULT_LEADS;
  const winnerPath=flag('--websites')??DEFAULT_WINNERS;
  const cdxPath=flag('--cdx-export');
  const target=resolve(outputArg);
  for(const source of [leadPath,winnerPath,cdxPath]){
    if(source&&resolve(source)===target)throw new Error('Refusing to overwrite offline input');
  }
  const leads=JSON.parse(bounded(leadPath,4*1024*1024)) as CampaignPageLeadManifest;
  const winners=JSON.parse(bounded(winnerPath,4*1024*1024)) as SenateSosSeedManifest;
  let indexed:OfflineCdxResult[]=[];
  if(cdxPath){
    const input=JSON.parse(bounded(cdxPath,16*1024*1024)) as unknown;
    if(!input||typeof input!=='object'||Array.isArray(input))
      throw new Error('Expected imported CDX envelope');
    const o=input as Record<string,unknown>;
    if(o.schema!=='campaign-archive-offline-cdx-index-v1'||!Array.isArray(o.results)
      ||o.results.length>16)throw new Error('Invalid bounded CDX import format');
    indexed=o.results as OfflineCdxResult[];
  }
  const report=planCampaignArchiveSourceRecovery(leads,winners,indexed);
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,JSON.stringify(report,null,2)+'\n',
    {encoding:'utf8',mode:0o600,flag:'wx'});
  console.log(JSON.stringify({
    output:target,
    domains:report.totals.candidateDomains,
    candidateIssuePagesToResearch:report.totals.exactPolicyPageUrlLeads,
    explicitArchiveQueries:report.totals.archiveRequests,
    offlineResponsesReviewed:report.totals.providedOfflineCdxResponses,
    independentlyVerifiedPreVoteIssueStatements:0,
    originalHistoricalPageBytesVerified:0,
    completenessCertified:false,
  },null,2));
}
main();
