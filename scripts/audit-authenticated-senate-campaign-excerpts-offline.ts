/**
 * #864 historical candidate issue platform short excerpts reverified against
 * real original Wayback pages from a previously downloaded GitHub artifact.
 *
 * Zero-network planning:
 * node --import tsx scripts/audit-authenticated-senate-campaign-excerpts-offline.ts \
 *   --output /tmp/senate-archived-excerpt-research-queue.json
 *
 * Real source recheck:
 * node --import tsx scripts/audit-authenticated-senate-campaign-excerpts-offline.ts \
 *   --archive-dir /path/to/unzipped/senate-campaign-public-archive-source-acquisition-v1 \
 *   --output /tmp/senate-archived-excerpt-proof.json
 *
 * Does NOT set earliest original post date, connect to DB, import evidence,
 * infer membership winners, or change any forecast.
 */
import { mkdirSync,readFileSync,statSync,writeFileSync } from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import excerptLeads from '../data/evaluation/senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1.json' with {type:'json'};
import {
  auditHistoricalCampaignExcerptLeadManifest,type ExcerptLedger,
} from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';

const args=process.argv.slice(2);
function opt(name:string):string|undefined{
  const at=args.indexOf(name);
  const value=at>=0?args[at+1]:args.find(x=>x.startsWith(name+'='))?.slice(name.length+1);
  return value&&!value.startsWith('--')?value:undefined;
}
function main(){
  const output=opt('--output'),archiveDir=opt('--archive-dir');
  if(!output)throw new Error('Missing --output');
  const ledger=excerptLeads as unknown as ExcerptLedger;
  const sourceFiles:Record<string,Uint8Array>={};
  if(archiveDir){
    const resolvedRoot=resolve(archiveDir);
    for(const row of ledger.candidates){
      const name=row.originalHtmlSource.sourceArchiveOriginalHtmlFileName;
      if(!/^wayback-replay-snapshot-(?:0[1-9]|1[0-2])\.html$/.test(name))
        throw new Error('Unsafe original archive source filename');
      const target=resolve(join(resolvedRoot,name));
      if(target===resolve(output)||!target.startsWith(resolvedRoot+'/'))
        throw new Error('Offline audit cannot overwrite/escape original archive source root');
      if(statSync(target).size>3*1024*1024)throw new Error('Original archive HTML exceeds 3 MiB');
      sourceFiles[name]=readFileSync(target);
    }
  }
  const result=auditHistoricalCampaignExcerptLeadManifest(ledger,sourceFiles);
  const out=resolve(output);
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(result,null,2)+'\n',
    {encoding:'utf8',mode:0o600,flag:'wx'});
  console.log(JSON.stringify({output:out,
    sourceHtmlPagesVerified:result.totals.originalHtmlFilesProvidedAndCrossChecked,
    exactSourceExcerptsVerified:result.totals.shortExcerptsReverifiedAgainstOriginalBytes,
    membershipEvidenceReconciliationComplete:false,
    forecastEligible:0,
  },null,2));
}
main();
