/**
 * #864 historical campaign source → official post-vote winner → 2025-26
 * Senate membership (optional protected sandbox SELECT-only export).
 *
 * node --import tsx scripts/reconcile-senate-campaign-winners-offline.ts \
 *   --output /tmp/senate-winner-source-identity.json
 *
 * node --import tsx scripts/reconcile-senate-campaign-winners-offline.ts \
 *   --database-export /path/to/explicitly-authorized-sandbox-SELECT-report.json \
 *   --output /tmp/senate-winner-member-join.json
 *
 * Never connects to database, Vercel, Neon or any web URL.
 */
import {mkdirSync,statSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import official from '../data/evaluation/senate-targeted-official-general-election-outcomes-2022-25-v1.json' with {type:'json'};
import {
  reconcileHistoricalCampaignWinnerExcerpts,
  type OutcomeManifest,type RestrictedMemberExport,
} from '../src/evidence/senate-campaign-winner-membership-reconciliation.js';
const args=process.argv.slice(2);
function arg(name:string){
  const at=args.indexOf(name);
  const val=at>=0?args[at+1]:args.find(a=>a.startsWith(name+'='))?.slice(name.length+1);
  return val&&!val.startsWith('--')?val:undefined;
}
function main(){
  const out=arg('--output');if(!out)throw Error('Provide --output');
  const input=arg('--database-export');
  if(input&&resolve(input)===resolve(out))throw Error('Cannot overwrite confidential input source');
  let exported:RestrictedMemberExport|undefined;
  if(input){
    if(statSync(input).size>8*1024*1024)throw Error('Sandbox export input exceeds 8MiB');
    const contents=JSON.parse(readFileSync(input,'utf8')) as unknown;
    if(!contents||typeof contents!=='object'||Array.isArray(contents))
      throw Error('Expected explicit source export JSON');
    exported=contents as RestrictedMemberExport;
  }
  const report=reconcileHistoricalCampaignWinnerExcerpts(official as OutcomeManifest,undefined,exported);
  mkdirSync(dirname(resolve(out)),{recursive:true});
  writeFileSync(out,JSON.stringify(report,null,2)+'\n',
    {flag:'wx',mode:0o600,encoding:'utf8'});
  console.log(JSON.stringify({
    output:resolve(out),winnerCandidates:report.totals.winnerCandidateSources,
    losingOpponentCandidates:report.totals.loserCandidateSources,
    winnerPolicyExcerpts:report.totals.winnerIssueExcerptLeads,
    excludedLoserPolicyExcerpts:report.totals.loserIssueExcerptLeads,
    membershipExportReceived:Boolean(exported),
    linkedSandboxMemberships:report.totals.uniquelyJoinedRestrictedSandboxMemberships,
    productionEvidenceReconciled:false,
    forecastEvidenceAdded:0,
  }));
}
main();
