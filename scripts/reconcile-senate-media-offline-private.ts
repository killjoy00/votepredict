/**
 * #987/#946 / Track D: PRIVATE, OFFLINE, READ-ONLY crosswalk.
 *
 * node --import tsx scripts/reconcile-senate-media-offline-private.ts \
 *   --context PRIVATE-media-context.jsonl \
 *   --roster PRIVATE-roster.jsonl \
 *   --public-batch PUBLIC-senate-media-public-wayback-proof-batch.json \
 *   --reviews PRIVATE-human-review.jsonl \
 *   --snapshots PRIVATE-original-byte-snapshots.jsonl \
 *   --output PRIVATE-reconciled-senator-year-report.json
 *
 * --reviews, --snapshots and --public-batch optional; without them original
 * source/statement proofs remain unknown. NEVER run in GitHub Actions/CI.
 * No network, DB, SQL, Neon, GitHub, model, serving or file overwrite.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  reconcileSenateMediaProofAndCoverage,
  type OfflinePublicBatchReport,
  type OfflinePublicLead,
} from '../src/evidence/senate-media-offline-proof-reconciliation.js';
import type {
  SenateMediaContextExport,SenateMediaRosterYear,
  SenateMediaReview,SenateMediaSourceSnapshot,
} from '../src/evidence/senate-media-remarks-audit.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const LEDGER=resolve(ROOT,'docs/evaluation/senate-media-public-article-discovery-2021-25.json');
const OPTS=new Set(['--context','--roster','--public-batch','--reviews','--snapshots','--output']);
function args():Record<string,string>{
  const opts:Record<string,string>={};
  const v=process.argv.slice(2);
  if(v.length%2!==0||v.length>OPTS.size*2)throw Error('Invalid CLI arguments');
  for(let i=0;i<v.length;i+=2){
    const key=v[i]!,arg=v[i+1]!;
    if(!OPTS.has(key)||key in opts||!arg||arg.startsWith('--'))
      throw Error('Unexpected offline reconciliation input option');
    opts[key]=resolve(arg);
  }
  if(!opts['--context']||!opts['--roster']||!opts['--output'])
    throw Error('Require restricted --context, --roster and private --output');
  if(new Set(Object.values(opts)).size!==Object.values(opts).length)
    throw Error('Input and output paths must be distinct');
  if(Object.values(opts).includes(LEDGER))throw Error('Cannot overwrite public research ledger');
  return opts;
}
function textFile(path:string,limit:number):string{
  const body=readFileSync(path,'utf8');
  if(!body||Buffer.byteLength(body)>limit)throw Error('Offline file empty or over limit');
  return body;
}
function jsonl<T>(value:string,label:string):T[]{
  const lines=value.trimEnd().split(/\r?\n/);
  if(lines.length>50000)throw Error('Offline '+label+' row bound exceeded');
  return lines.map((line,i)=>{
    let obj:unknown;
    try{obj=JSON.parse(line);}catch{throw Error('Invalid JSONL '+label+' row '+(i+1));}
    if(!obj||typeof obj!=='object'||Array.isArray(obj))
      throw Error('Non-object JSONL '+label+' row');
    return obj as T;
  });
}
async function main():Promise<void>{
  const p=args();
  const ledger=JSON.parse(textFile(LEDGER,300_000)) as {
    selectedNonExhaustiveArticleLeads:OfflinePublicLead[];
  };
  const contextBody=textFile(p['--context']!,80_000_000);
  const rosterBody=textFile(p['--roster']!,8_000_000);
  const context=jsonl<SenateMediaContextExport>(contextBody,'context');
  const roster=jsonl<SenateMediaRosterYear>(rosterBody,'roster');
  const reviews=p['--reviews']
    ?jsonl<SenateMediaReview>(textFile(p['--reviews'],20_000_000),'review'):[];
  const snapshots=p['--snapshots']
    ?jsonl<SenateMediaSourceSnapshot>(textFile(p['--snapshots'],200_000_000),'snapshot'):[];
  const batchBody=p['--public-batch']?textFile(p['--public-batch'],250_000):null;
  const publicBatch=batchBody?JSON.parse(batchBody) as OfflinePublicBatchReport:null;
  const result=reconcileSenateMediaProofAndCoverage({
    publicLedger:ledger.selectedNonExhaustiveArticleLeads,
    publicBatch,contexts:context,roster,reviews,snapshots,
  });
  const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
  const report={
    ...result,
    inputAudit:{
      originalContextExportSha256:hash(contextBody),
      rosterExportSha256:hash(rosterBody),
      publicBatchArtifactJsonSha256:batchBody?hash(batchBody):null,
      suppliedPrivateHumanReviewRows:reviews.length,
      suppliedOriginalPrivateByteSnapshots:snapshots.length,
      originalRawArticleBytesPersistedInReport:false,
      originalQuoteSourcePassagesPersistedInReport:false,
      authorizedPrivateExportProvidedByOperator:true,
      networkOrDatabaseCallsByThisTool:0,
    },
  };
  // Private-only, create-new-only, restrictive filesystem permissions. Do NOT
  // upload to public workflow logs, a public repo, public artifact or issue.
  writeFileSync(p['--output']!,JSON.stringify(report,null,2)+'\n',
    {flag:'wx',mode:0o600});
  console.log(JSON.stringify({
    version:result.version,studyYears:result.studyYears,
    suppliedPublicUrlLeads:result.checkedInPublicLeadUrls,
    publicBatchUrlRows:result.suppliedPublicBatchUrlRows,
    suppliedPrivateContextRows:result.suppliedPrivateContextRows,
    crossMatchedPublicReplaySourceRecords:result.publicReplayToPrivateStoredSourceMetadataMatches,
    originalPrivateHumanVerifiedNamedQuotePassages:result.humanVerifiedNamedQuotePassagesInPrivateAudit,
    suppliedDistinctSenatorYearIds:result.bySenatorYear.length,
    excludedUnknownStatewideMediaDenominator:true,
    rawPrivateEvidenceLogged:false,databaseAndNetworkAccess:false,
  }));
}
main().catch(()=>{
  // Never echo private file paths, source contents, query strings or details.
  console.error('Private offline media reconciliation rejected invalid or unavailable inputs');
  process.exitCode=1;
});
