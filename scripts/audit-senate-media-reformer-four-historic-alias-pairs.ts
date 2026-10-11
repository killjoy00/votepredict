/** Public historical /briefs/ vs dated-path Reformer exact Wayback probes (#946). */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 verifyReformerHistoricalAliasPaths,type AliasQueue,type OldOriginalLead,
 type PreviousOriginalDigest,
} from '../src/evidence/senate-media-reformer-four-original-url-alias-proof.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=(s:string,max:number):unknown=>{
 const body=readFileSync(resolve(ROOT,'docs/evaluation/'+s),'utf8');
 if(Buffer.byteLength(body)>max)throw Error('Untrusted public source metadata size');
 return JSON.parse(body) as unknown;
};
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Require exact --output path');
 const output=resolve(args[1]);
 if(!output.startsWith(resolve(ROOT,'artifacts')+'/')||!output.endsWith('.json'))
   throw Error('Original publisher HTML cannot be saved; only metadata artifacts');
 const queue=read('senate-media-reformer-four-historical-brief-dated-alias-queue-20261011.json',15_000) as AliasQueue;
 const lead=read('senate-media-public-article-discovery-2021-25.json',160_000) as{
  version:string;selectedNonExhaustiveArticleLeads:OldOriginalLead[];
 };
 const pin=read('senate-media-2021-25-exact-public-replay-receipts-20261010.json',140_000) as PreviousOriginalDigest;
 if(!Array.isArray(lead.selectedNonExhaustiveArticleLeads))
   throw Error('Original 31 article public URL discovery cohort unavailable');
 const outputData=await verifyReformerHistoricalAliasPaths(queue,lead.selectedNonExhaustiveArticleLeads,pin);
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(outputData,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({
  exactUrlVariantsQueried:outputData.independentlyQueriedExactPublicOriginalUrls,
  archiveUrlIndexAvailable:outputData.urlsWithHistoricalIndexedCdxCandidates,
  cdxUnknownNotArticleAbsence:outputData.urlsCdxUnavailableOrInvalidUnknown,
  sha1VerifiedOriginalHtmlVersions:outputData.exactlyIndexedSha1VerifiedRawHtmlCaptureVersions,
  aliasPairsWithBothVariantsAuthenticated:outputData.possibleAliasPairsWithBothSidesExactlyVerified,
  sharedHistoricalCanonicalPairSignals:outputData.historicalSameCanonicalPairs,
  sharedVisibleBodyFingerprintPairSignals:outputData.historicalSameVisibleTextDigestPairs,
  automaticArticleUrlDeduplications:0,
  publisherFirstPostClocksEstablished:0,senatorIndividualVoteProof:0,originalHtmlPersisted:false
 }));
}
main().catch(()=>{console.error('Historical original publisher path alias verification failed closed');process.exitCode=1;});
