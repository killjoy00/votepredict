/**
 * #864 source-only current 2026 first-party/publisher acquisition.
 * No key, database, model, scheduler, emails or outside human contact.
 * An observed ORIGINAL publisher body and named speaker quote can prove the
 * wording was available by the GET observation UTC, NOT first authorship date.
 * Never record copyrighted original article bodies in Git or Actions output.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

const manifestPath='data/evaluation/senate-864-2026-incumbent-duckworth-exact-speaker-leads-v1.json';
const safeHosts=new Set(['transcripts.cnn.com','www.mnsenaterepublicans.com','www.mprnews.org']);
export function normalizeVisibleHtml(raw){
 if(typeof raw!=='string')throw Error('Expected text/html body');
 const body=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<[^>]*>/g,' ')
  .replace(/&(?:nbsp|amp|quot|apos|rsquo|lsquo|ldquo|rdquo|mdash|ndash);/gi,match=>({
   '&nbsp;':' ','&amp;':'&','&quot;':'"','&apos;':"'",'&rsquo;':"'",'&lsquo;':"'",'&ldquo;':'"','&rdquo;':'"','&mdash;':'-','&ndash;':'-'
  }[match.toLowerCase()]??match))
  .replace(/&#(?:x([a-f0-9]+)|([0-9]+));/gi,(_,hex,dec)=>{
   const n=parseInt(hex||dec,hex?16:10);
   return n>=32&&n<=0x10ffff?String.fromCodePoint(n):' ';
  })
  .normalize('NFKC')
  .replace(/[‘’]/g,"'").replace(/[“”]/g,'"')
  .replace(/\s+/g,' ').trim();
 return body;
}
function matchText(s){return s.normalize('NFKC').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim().toLowerCase();}
function fullDate(day){
 assert.match(day,/^2026-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])$/);
 const date=new Date(day+'T12:00:00Z');
 assert.equal(date.toISOString().slice(0,10),day);
 return new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(date);
}
export function auditPublicOriginalHtml(originalSource,rawBytes,observedAtUtc){
 const url=new URL(originalSource.url);
 assert.equal(url.protocol,'https:');
 assert.ok(safeHosts.has(url.hostname));
 assert.ok(!url.username&&!url.password&&!url.search&&!url.hash);
 assert.ok(Buffer.isBuffer(rawBytes) && rawBytes.length>=500 && rawBytes.length<=4_000_000);
 assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(observedAtUtc));
 const visible=normalizeVisibleHtml(rawBytes.toString('utf8'));
 const lower=matchText(visible);
 const issue=matchText(originalSource.shortIssueCue);
 const cue=matchText(originalSource.speakerCue);
 const idx=lower.indexOf(issue);
 const located=idx>=0;
 const localSpeaker=located?lower.slice(Math.max(0,idx-2000),Math.min(lower.length,idx+1500)).includes('duckworth'):false;
 const dateAppears=lower.includes(matchText(fullDate(originalSource.dateDisplayed)));
 const sourceSpeakerAppears=lower.includes(cue);
 return {
  sourceId:originalSource.id,sourceUrl:url.href,
  observedAtUtc,rawWholeHtmlBytes:rawBytes.length,
  rawWholeOriginalHtmlSha256:createHash('sha256').update(rawBytes).digest('hex'),
  displayedCalendarDate:originalSource.dateDisplayed,
  displayedCalendarDateVisibleInAcquiredBody:dateAppears,
  expectedNamedSpeakerCueVisible:sourceSpeakerAppears,
  issueCueVisible:located,issueCueInDuckworthSpeakerNeighborhood:localSpeaker,
  originalPublisherHtmlAndSpeakerCueAuthenticated:dateAppears&&sourceSpeakerAppears&&located&&localSpeaker,
  originalExact2026FirstAuthoredTimestampProven:false,
  independentlyArchivedPublisherHistoricalCopyObtained:false,
  statementHumanQuoteReviewStillRequired:true,
  automaticallyStoredVotePredictEvidence:false,
  election2026AsOfAvailabilityOnlyByObservationUtc:true
 };
}
export function verifyManifest(m){
 assert.equal(m.issue,864);
 assert.equal(m.population.currentIncumbentGeneralNominees,49);
 assert.equal(m.population.totalSelectedOriginalHistoricalCampaignSiteExcerpts,716);
 assert.equal(m.existingProtectedAggregate.campaignEvidenceRowsYearBucket2026,140);
 assert.equal(m.existingProtectedAggregate.distinct2026CampaignSourceDocuments,65);
 assert.equal(m.existingProtectedAggregate.exactSourceShaUrlOrClaimMatchAvailable,false);
 const sources=m.duckworth.newDated2026SourceLeads;
 assert.equal(sources.length,4);
 assert.equal(new Set(sources.map(x=>x.id)).size,4);
 assert.equal(new Set(sources.map(x=>x.url)).size,4);
 for(const s of sources){
  const u=new URL(s.url);
  assert.ok(safeHosts.has(u.hostname)&&u.protocol==='https:'&&!u.search&&!u.hash);
  assert.ok(fullDate(s.dateDisplayed).endsWith('2026'));
  assert.ok(typeof s.speakerCue==='string'&&s.speakerCue.toLowerCase().includes('duckworth'));
  assert.ok(typeof s.shortIssueCue==='string'&&s.shortIssueCue.length>15&&s.shortIssueCue.length<130);
 }
 assert.equal(m.boundaries.sourceResearchNotIngestion,true);
 assert.equal(m.boundaries.noProductionDatabaseReadsOrWrites,true);
 assert.equal(m.boundaries.jan25Jan26SamePolicyClusterNotTwoUnrelatedPositions,true);
 return sources;
}
export async function fetchOne(s,call=fetch){
 const sourceUrl=new URL(s.url);
 const observedAtUtc=new Date().toISOString();
 let response;
 try{
  response=await call(sourceUrl.href,{redirect:'manual',headers:{'user-agent':'VotePredict-public-source-audit/1.0 (research; no credentials)'},signal:AbortSignal.timeout(16000)});
 }catch{
  return {sourceId:s.id,url:s.url,observedAtUtc,status:'public_source_network_unavailable_unknown',exactSourceOriginalAuthenticated:false};
 }
 if(response.status!==200){
  return {sourceId:s.id,url:s.url,observedAtUtc,httpStatus:response.status,status:'public_source_http_unavailable_unknown',exactSourceOriginalAuthenticated:false};
 }
 if(!String(response.headers.get('content-type')||'').toLowerCase().includes('text/html')){
  return {sourceId:s.id,url:s.url,observedAtUtc,status:'original_html_content_type_not_supported_unknown',exactSourceOriginalAuthenticated:false};
 }
 const rawLen=Number(response.headers.get('content-length')||0);
 if(rawLen>4_000_000){
  return {sourceId:s.id,url:s.url,observedAtUtc,status:'source_body_too_large_unknown',exactSourceOriginalAuthenticated:false};
 }
 let raw;
 try{
  const reader=response.body.getReader();const blocks=[];let total=0;
  for(;;){
   const chunk=await reader.read();if(chunk.done)break;
   total+=chunk.value.length;if(total>4_000_000)throw Error('oversize');
   blocks.push(chunk.value);
  }
  raw=Buffer.concat(blocks);
 }catch{
  return {sourceId:s.id,url:s.url,observedAtUtc,status:'incomplete_or_too_large_source_body_unknown',exactSourceOriginalAuthenticated:false};
 }
 try{
  const audit=auditPublicOriginalHtml(s,raw,observedAtUtc);
  return { ...audit,httpStatus:200,
   status:audit.originalPublisherHtmlAndSpeakerCueAuthenticated?'original_html_date_and_speaker_cue_verified':'original_html_available_but_date_or_speaker_cue_unverified',
   exactSourceOriginalAuthenticated:audit.originalPublisherHtmlAndSpeakerCueAuthenticated };
 }catch{
  return {sourceId:s.id,url:s.url,observedAtUtc,status:'unexpected_original_html_or_attribution_unknown',exactSourceOriginalAuthenticated:false};
 }
}
export async function main(){
 const args=process.argv.slice(2);
 assert.ok(args.length===2 && args[0]==='--out-dir' && !args[1].startsWith('--'));
 const dir=resolve(args[1]);mkdirSync(dir,{recursive:true});
 const sources=verifyManifest(JSON.parse(readFileSync(resolve(manifestPath),'utf8')));
 const results=await Promise.all(sources.map(s=>fetchOne(s)));
 assert.equal(results.length,4);
 const result={schema:'senate-864-2026-duckworth-original-public-html-source-retrieval-v1',
  asOfUtc:new Date().toISOString(),expected2026Election:'2026-11-03',sourceOriginalCandidates:4,
  publicOriginalHtmlAndSpeakerProven:results.filter(x=>x.exactSourceOriginalAuthenticated).length,
  providerFailuresNeverNegativeEvidence:true,originalFirstAuthoredTimeNotProven:true,
  researchOnly:true,personalEmailsContactsAndCopyrightedArticlesSaved:false,
  privateDatabaseAccessCount:0,productionWrites:0,forecastChanges:0,results};
 writeFileSync(join(dir,'senate-864-2026-duckworth-original-html-speaker-source-receipts.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({sources:results.length,authenticated:result.publicOriginalHtmlAndSpeakerProven,
  statuses:results.map(x=>({id:x.sourceId,status:x.status}))}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main().catch(error=>{console.error('Source audit failed safely: '+error.message);process.exitCode=1;});
}
