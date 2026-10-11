import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runMprOriginalResearch} from './probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Required: --output artifacts/*.json');
const output=resolve(args[1]);
if(!output.startsWith(resolve(root,'artifacts')+'/')||!output.endsWith('.json'))
 throw Error('Only bounded source metadata JSON may be retained in artifacts');
const r=await runMprOriginalResearch();
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(r,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({version:r.version,selectedMprReporterStoryCount:r.publicOriginalReporterStoriesSelected,
 selectedNamedSenatorSpeechCandidates:r.selectedNamedSenatorQuotedSpeechCandidates,
 rawOriginalHistoricallySha1Authenticated:r.sha1AuthenticatedHistoricalOriginalHtmlBodies,
 shortOriginalHistoricallyAuthenticatedCueHits:r.historicallySha1AuthenticatedPositiveShortCueChecks,
 sources:r.sourcePages.map(x=>({id:x.sourceId,
 currentPublisherBody:x.firstPartyCurrent.status,currentCuePresence:x.firstPartyCurrent.cues?.map(q=>q.cueFound)??null,
 waybackStatus:x.waybackOriginal.indexStatus,
 waybackOriginals:x.waybackOriginal.originalHtmlReplayAttempts.map(v=>({utc:v.captureUtc,status:v.status,cues:v.shortCues?.map(q=>q.cueFound)??null})),
 commonCrawl:x.commonCrawlOriginal.queriedCollections.map(c=>({id:c.collection,index:c.indexStatus,
   matches:c.indexedCandidates,originals:c.originalWarcReplayAttempts.map(v=>({utc:v.captureUtc,status:v.status,cues:v.shortCues?.map(q=>q.cueFound)??null}))}))})),
 fullSourceHtmlOrWarcsPersisted:false,noIndividualSenatorRecordedVotes:false}));
