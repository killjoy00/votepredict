/**
 * #912: combine separately generated *private* exact-Wayback media batches.
 *
 * node --import tsx research/scripts/reconcile-senate-media-batches-private.ts \
 *   --context /PRIVATE/media-context.jsonl --roster /PRIVATE/senate-roster.jsonl \
 *   --batch-dir /PRIVATE/media-batch-0 --batch-dir /PRIVATE/media-batch-12 \
 *   --output-dir /PRIVATE/media-reconciled
 *
 * No DB/network/Neon/GitHub API, model or production writes. Never upload raw
 * snapshots, source identifiers or context exports to GitHub or CI.
 */
import { createHash } from 'node:crypto';
import {
  existsSync,mkdirSync,readFileSync,realpathSync,writeFileSync,
} from 'node:fs';
import { basename,dirname,isAbsolute,resolve,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  reconcileSenateMediaPrivateBatches,
  MEDIA_BATCH_RECONCILIATION_VERSION,
  type PrivateMediaBatchManifest,
  type SenateMediaPrivateBatch,
} from '../evidence/senate-media-batch-reconciliation.ts';
import type {
  SenateMediaContextExport,SenateMediaRosterYear,SenateMediaSourceSnapshot,
} from '../evidence/senate-media-remarks-audit.ts';
import type { MediaArchiveFetchResult } from '../evidence/senate-media-archive-rehydration.ts';

const REPO=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
const SHA=/^[0-9a-f]{64}$/;
const FILES=['source-attempts.jsonl','human-review-queue.jsonl','discovery-audit.json',
  'authenticated-original-snapshots.jsonl'] as const;

function opts():{context:string;roster:string;batchDirs:string[];output:string}{
  const argv=process.argv.slice(2);
  if(argv.length%2)throw Error('Expected only named key/value arguments');
  const entries=new Map<string,string>();
  const batchDirs:string[]=[];
  for(let i=0;i<argv.length;i+=2){
    const k=argv[i]!,value=argv[i+1]!;
    if(!['--context','--roster','--batch-dir','--output-dir'].includes(k)
      || !value.trim() || value.startsWith('--'))throw Error('Unrecognized or empty private input option');
    if(k==='--batch-dir')batchDirs.push(value);
    else if(entries.has(k))throw Error('Duplicate private input option');
    else entries.set(k,value);
  }
  if(!entries.get('--context') || !entries.get('--roster')
    || !entries.get('--output-dir') || batchDirs.length>1000)
    throw Error('Need absolute --context, --roster and new --output-dir; up to 1000 --batch-dir entries');
  return {
    context:entries.get('--context')!,
    roster:entries.get('--roster')!,
    output:entries.get('--output-dir')!,batchDirs,
  };
}
function privateExisting(path:string,dir=false):string{
  if(!isAbsolute(path))throw Error('Private audit input must use an absolute local path');
  const real=realpathSync(path);
  if(real===REPO || real.startsWith(REPO+sep))
    throw Error('Refusing to read private source files from the Git checkout');
  if(dir && !existsSync(resolve(real,'manifest.json')))
    throw Error('Private batch directory is missing a manifest');
  return real;
}
function privateOutput(path:string):string{
  if(!isAbsolute(path))throw Error('Private audit output must use an absolute local path');
  const dest=resolve(path);
  if(existsSync(dest))throw Error('Refusing to overwrite an existing private output directory');
  const parent=realpathSync(dirname(dest));
  const output=resolve(parent,basename(dest));
  if(output===REPO || output.startsWith(REPO+sep))
    throw Error('Refusing to write private source material in Git checkout');
  return output;
}
function sha(body:Buffer|string):string{return createHash('sha256').update(body).digest('hex');}
function file(path:string,maxBytes:number):string{
  const data=readFileSync(path);
  if(!data.byteLength || data.byteLength>maxBytes)throw Error('Private audit input missing or above byte limit');
  return data.toString('utf8');
}
function json<T>(body:string):T{
  let decoded:unknown;
  try{decoded=JSON.parse(body);}catch{throw Error('Malformed private audit JSON');}
  if(!decoded || typeof decoded!=='object' || Array.isArray(decoded))
    throw Error('Expected private audit JSON object');
  return decoded as T;
}
function jsonl<T>(body:string,maxRows=20000):T[]{
  const rows=body.trimEnd().split(/\r?\n/);
  if(!body.trim() || rows.length>maxRows)throw Error('Empty or overlong private audit JSONL');
  return rows.map(line=>json<T>(line));
}
function optionalJsonl<T>(body:string|undefined,maxRows=20000):T[]{
  return body===undefined ? [] : jsonl<T>(body,maxRows);
}
function authenticateBatchFile(
  base:string,
  name:string,
  recorded:PrivateMediaBatchManifest['files'][string],
  maxBytes:number,
  expectedRows?:number,
):string{
  if(!recorded || !Number.isInteger(recorded.bytes)
    || recorded.bytes<1 || recorded.bytes>maxBytes
    || typeof recorded.sha256!=='string' || !SHA.test(recorded.sha256))
    throw Error('Private archive manifest missing file integrity proof');
  const path=resolve(base,name);
  const content=readFileSync(path);
  if(content.byteLength!==recorded.bytes
    || content.byteLength>maxBytes
    || sha(content)!==recorded.sha256)throw Error('Private archive output file SHA/size mismatch');
  const text=content.toString('utf8');
  if(expectedRows!==undefined) {
    if(recorded.rows!==expectedRows
      || text.trimEnd().split(/\r?\n/).length!==expectedRows)
      throw Error('Private archive manifest JSONL row count disagrees with file');
  }
  return text;
}

function readBatch(path:string):SenateMediaPrivateBatch{
  const base=privateExisting(path,true);
  const manifest=json<PrivateMediaBatchManifest>(
    file(resolve(base,'manifest.json'),150_000));
  if(!manifest.files || typeof manifest.files!=='object' || Array.isArray(manifest.files)
    || Object.keys(manifest.files).some(name=>!FILES.includes(name as typeof FILES[number])))
    throw Error('Unexpected private batch manifest artifact names');
  const n=manifest.attempted;
  if(!Number.isSafeInteger(n)||n<1||n>12)throw Error('Invalid private archive batch size');
  for(const key of FILES.slice(0,3))
    if(!Object.hasOwn(manifest.files,key))throw Error('Missing private batch artifact integrity entry');
  const receipt=authenticateBatchFile(base,'source-attempts.jsonl',
    manifest.files['source-attempts.jsonl']!,1_000_000,n);
  const queue=authenticateBatchFile(base,'human-review-queue.jsonl',
    manifest.files['human-review-queue.jsonl']!,2_000_000,n);
  const discovery=authenticateBatchFile(base,'discovery-audit.json',
    manifest.files['discovery-audit.json']!,2_000_000);
  const attempts=jsonl<Omit<MediaArchiveFetchResult,'snapshot'>>(receipt,12);
  const humanQueue=jsonl<Record<string,unknown>>(queue,12);
  for(let i=0;i<n;i++){
    const attempt=attempts[i],q=humanQueue[i];
    if(!attempt || !q || q.sourceDocumentId!==attempt.sourceDocumentId
      || q.sourceProofDisposition!==attempt.status
      || q.reviewDisposition!=='unreviewed'
      || q.rawBytesAuthenticated!==(attempt.status==='verified_original_bytes')
      || q.namedSpeakerVerified!==false || q.issueClassified!==false
      || q.exactQuotationVerified!==false)
      throw Error('Private human review queue is inconsistent or unexpectedly marked verified');
  }
  const audit=json<Record<string,unknown>>(discovery);
  if(audit.verifiedAttributedQuotePassages!==0
    || audit.corpusContextItemsInSuppliedExport===undefined)
    throw Error('Private batch discovery audit unexpectedly certifies a media statement');
  const snapsIncluded=Object.hasOwn(manifest.files,'authenticated-original-snapshots.jsonl');
  if(snapsIncluded !== (manifest.verifiedSourceBodies>0))
    throw Error('Private batch snapshot file presence disagrees with recorded matches');
  const snapBody=snapsIncluded
    ? authenticateBatchFile(base,'authenticated-original-snapshots.jsonl',
      manifest.files['authenticated-original-snapshots.jsonl']!,48_000_000,manifest.verifiedSourceBodies)
    : undefined;
  const snapshots=optionalJsonl<SenateMediaSourceSnapshot>(snapBody,12);
  return {manifest,attempts,snapshots};
}
function privateWrite(path:string,value:string):void{
  writeFileSync(path,value,{encoding:'utf8',mode:0o600,flag:'wx'});
}
function serializeJsonl(items:unknown[]):string{
  return items.map(item=>JSON.stringify(item)).join('\n')+(items.length?'\n':'');
}
function main():void{
  const arg=opts();
  const output=privateOutput(arg.output);
  const contexts=jsonl<SenateMediaContextExport>(file(privateExisting(arg.context),80_000_000));
  const roster=jsonl<SenateMediaRosterYear>(file(privateExisting(arg.roster),10_000_000),5000);
  const dirs=arg.batchDirs.map(path=>privateExisting(path,true));
  if(new Set(dirs).size!==dirs.length)throw Error('Repeated private archive directory');
  const batches=dirs.map(readBatch);
  const reconciled=reconcileSenateMediaPrivateBatches({contexts,roster,batches});
  mkdirSync(output,{mode:0o700});
  const files:Record<string,{sha256:string;bytes:number;rows?:number}>={};
  const store=(name:string,body:string,rows?:number)=>{
    privateWrite(resolve(output,name),body);
    files[name]={sha256:sha(body),bytes:Buffer.byteLength(body),...(rows===undefined?{}:{rows})};
  };
  store('source-retrieval-coverage.json',JSON.stringify(reconciled.summary,null,2)+'\n');
  if(reconciled.authenticatedSnapshots.length){
    store('authenticated-original-snapshots.jsonl',
      serializeJsonl(reconciled.authenticatedSnapshots),reconciled.authenticatedSnapshots.length);
  }
  store('manifest.json',JSON.stringify({
    version:MEDIA_BATCH_RECONCILIATION_VERSION,createdAt:new Date().toISOString(),
    sourceInputSha256:sha(readFileSync(arg.context)),
    rosterInputSha256:sha(readFileSync(arg.roster)),
    privateBatchCount:batches.length,
    privateBatchManifestSha256:dirs.map(dir=>sha(readFileSync(resolve(dir,'manifest.json')))),
    rawArticleBytesRemainPrivate:true,
    newsMentionsNotQuotes:true,
    noHumanReviewPerformed:true,
    noCompletenessCertificate:true,
    noDatabaseOrNetworkAccess:true,
    files,
  },null,2)+'\n');
  console.log(JSON.stringify({
    privateOutputDirectory:output,
    batchCount:batches.length,
    eligibleSourceDocuments:reconciled.summary.eligibleDistinctArchivedArticles,
    retrievalAttempts:reconciled.summary.attemptedDistinctSources,
    exactOriginalByteMatches:reconciled.summary.exactOriginalHashMatched,
    sourceHashMismatches:reconciled.summary.originalHashMismatched,
    sourcesNotAttempted:reconciled.summary.notAttempted,
    sourceCorpusCoverageComplete:reconciled.summary.retrievalAttemptsCompleteForEligibleExport,
    namedSenatorQuotesVerified:0,
    originalMediaArticleBytesRemainPrivate:true,
  },null,2));
}
try{main();}
catch {
  // Do not expose operator paths, source URLs, articles, PostgreSQL secrets,
  // or potentially sensitive input/manifest content in diagnostic output.
  console.error('Private Senate media batch reconciliation failed; check input manifests and source identity locally');
  process.exitCode=1;
}
