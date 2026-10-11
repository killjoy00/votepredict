/**
 * Public 3 previously unverified original Minnesota Reformer stories,
 * six exact URL variants (dated and historical /briefs/ hypothesis).
 * No full article text, audio, legislature votes or private material.
 *
 * node --import tsx scripts/probe-senate-media-three-missing-reformer-briefs.ts \
 *  --output artifacts/senate-media-three-original-brief-gap-proofs.json
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {researchThreeMissingHistoricallyOriginalBriefs,
 type BriefQueue,type OriginalLead,
} from '../src/evidence/senate-media-three-missing-newsroom-brief-original-audit.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function read(path:string,cap:number):unknown{
 const raw=readFileSync(resolve(root,'docs/evaluation',path),'utf8');
 if(Buffer.byteLength(raw)>cap)throw Error('Oversized unknown public research metadata');
 return JSON.parse(raw) as unknown;
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Require --output artifacts/*.json');
 const out=resolve(args[1]);
 if(!out.startsWith(resolve(root,'artifacts')+'/')||!out.endsWith('.json')||out.includes('\0'))
  throw Error('Original source HTML/audio cannot be persisted outside metadata artifacts');
 const q=read('senate-media-three-unverified-reformer-brief-original-archive-hypotheses-20261011.json',30_000) as BriefQueue;
 const cohort=read('senate-media-2021-25-further-independent-reporting-15-leads.json',180_000) as{
  version:string;newIndividuallyNamedSenatorSpeakerCandidates:number;
  independentOriginalReporterArticleLeads:OriginalLead[];
 };
 if(cohort.version!=='public-2021-25-further-independent-15-reformer-articles-v1'
   ||cohort.newIndividuallyNamedSenatorSpeakerCandidates!==24
   ||!Array.isArray(cohort.independentOriginalReporterArticleLeads))
  throw Error('Incorrect original publisher lead universe or corrected serving senator speaker count');
 const result=await researchThreeMissingHistoricallyOriginalBriefs(q,cohort.independentOriginalReporterArticleLeads);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({
  historicallyUnverifiedSelectedOriginalUrlLeads:3,
  separatelyAttributedCurrentPublisherSenatorSpeechCandidates:6,
  exactOriginalPublisherUrlVariantsQueried:result.originalPublisherUrlVariantsIndividuallyIndexed,
  indexedCandidateUrlVariants:result.sourceUrlVariantsWithCdxOriginalCandidates,
  unavailableCdxUnknown:result.cdxIndexUnknownOriginalUrlVariants,
  exactOriginalHistoricalHtmlSha1Matches:result.originalIndexedSha1ConsistentHtmlBodiesFound,
  alternativePublisherBriefPathsWithOriginalHistoricalBodies:
   result.briefCandidatesWithSomeAuthenticatedOriginalPublisherBody,
  alternativeOriginalsWithAllNamedShortTextCueMatches:
   result.briefCandidatesWithAllShortNamedSenatorTextCuesInAnAuthenticBody,
  historicallyProvenOriginalArticleDuplicateAliases:0,
  originalAudioVerified:0,fullHumanApprovedQuotes:0,actualRecordedSenateVotes:0,
  originalRawHtmlSaved:false,
 }));
}
main().catch(()=>{
 console.error('Public historical Reformer /briefs/ source replay research failed closed');
 process.exitCode=1;
});
