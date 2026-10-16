/**
 * #864 research-only four independent primary publisher candidate Q&A and
 * historic attributed direct-statement archival search. Does NOT admit quotes.
 * Candidates' interviews != candidate-owned campaign websites. Requires exact
 * CDX original SHA1/Base32 and full original bytes for downstream quote audit.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,statSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const argv=process.argv.slice(2);
function arg(k){const i=argv.indexOf(k);assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing '+k);return resolve(argv[i+1]);}
const track=argv[argv.indexOf('--track')+1],sha=b=>createHash('sha256').update(b).digest('hex');
assert.ok(['bakk','doron','tomassoni','wiger'].includes(track),'Unexpected source research track');
function read(p,min=30,max=7000000){const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'Missing original '+p);return readFileSync(p);}
const manifest=JSON.parse(read(resolve('data/evaluation/senate-864-four-high-value-original-publisher-interview-targets-v1.json'),1000).toString());
assert.equal(manifest.issue,864);
assert.equal(manifest.schema,'mn-senate-864-four-preelection-publisher-firstperson-source-queries-v1');
assert.equal(manifest.baseline.peopleActuallyServed2021To2025,95);
assert.equal(manifest.baseline.candidateOwnedCampaignWebsiteCoverage,92);
assert.equal(manifest.baseline.candidateOwnedWebsiteShortExcerpts,1194);
assert.equal(manifest.noOriginalCampaignSiteCoverageChange,true);
const person=manifest.people[track],out=arg('--out-dir');
assert.ok(person.sources.length>=2);
mkdirSync(out,{recursive:true});
const gov=read(arg('--official-html'),9000),receipt=JSON.parse(read(arg('--official-receipt'),500).toString()),swear=read(arg('--official-special-swearing-html'),9000);
assert.equal(sha(gov),'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51');
assert.equal(receipt.source.sourceBytesSha256,sha(gov));
assert.equal(receipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(receipt.supplementalSwearingSource.sourceBytesSha256,sha(swear));
const officials=parseOfficialMnSenateServiceDirectory(gov,receipt.source.observedAt,swear,receipt.supplementalSwearingSource.observedAt);
assert.equal(officials.senators.length,105);
const actual=validateActualSenateServiceForElection(officials,person.person,person.district,person.year);
assert.equal(actual.status,'verified_senate_service');
assert.equal(actual.officialName,person.official);
assert.equal(actual.serviceForThisElectionFollowingYearVerified,true);
const coverageRaw=read(arg('--coverage-json'),10000),coverage=JSON.parse(coverageRaw.toString());
assert.equal(coverage.summary.actualServingStateSenators,95);
assert.equal(coverage.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,92);
assert.equal(coverage.summary.totalExactResearchExcerptRowsForVerifiedSenators,1194);
assert.equal(coverage.summary.sourceOriginalGovernmentSHA256,sha(gov));
const personCoverage=coverage.byActuallyServedSenator.find(x=>x.officialName===person.official);
assert.ok(personCoverage);
assert.equal(personCoverage.originalSiteQuoteLeadCount,track==='doron'?5:0);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function get(url){
 let result;
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const r=await fetch(url,{headers:{'User-Agent':'MN-Senate-Archived-FirstPerson-Evidence-Research/1.0'},
    signal:AbortSignal.timeout(24000)});
   const bytes=Buffer.from(await r.arrayBuffer());
   assert.ok(bytes.length<=7000000,'Original source exceeds 7 MB cap');
   result={status:r.status,ok:r.ok,bytes,finalUrl:r.url,contentType:r.headers.get('content-type'),attempt};
   if([429,502,503,504].includes(r.status)&&attempt<2){await pause(1200);continue;}
   return result;
  }catch(e){result={status:null,ok:false,bytes:Buffer.alloc(0),attempt,error:String(e).slice(0,150)};}
 }
 return result;
}
const eligible=c=>/^[A-Z2-7]{32}$/.test(c);
function utc(ts){assert.match(ts,/^\d{14}$/);return ts.replace(/^(....)(..)(..)(..)(..)(..)$/,'$1-$2-$3T$4:$5:$6.000Z');}
function context(body){
 const v=originalCampaignVisibleText(body);
 const last=person.person.split(' ').at(-1);
 return {candidateNameAppears:new RegExp('\\b'+last+'\\b','i').test(v),
   directSpeakerSignals:(v.match(/(?:^|\n)\s*(?:Clark|Bakk|Wiger|Tomassoni|Senator Tom Bakk|Senator Chuck Wiger)\s*[:\-]|\b(?:said|statement|interview|Q:|A:)\b/gi)||[]).length,
   oldSpeakerWasNot2020CampaignPromise:track==='wiger',
   quoteContextPreview:v.slice(0,1800)};
}
async function replay(k,row,mode){
 const [time,url,mime,status,digest]=row;
 const replayUrl='https://web.archive.org/web/'+time+mode+'/'+url;
 const r=await get(replayUrl);
 const res={url,originalCapturedUtc:utc(time),originalIndexedSHA1Base32:digest,
  replayMode:mode,replayUrl,replayStatus:r.status,replayContentType:r.contentType,
  originalFullResponseSHA256:r.bytes.length?sha(r.bytes):null,
  rawIndexDigestMatchesFullResponse:false,originalFullHTMLFile:null,
  candidateAttributionContext:null,notYetExactCandidateSpeakerQuoteVerified:true};
 if(r.status===200&&r.bytes.length>100&&eligible(digest)&&historicalArchiveSha1Base32(r.bytes)===digest){
  res.rawIndexDigestMatchesFullResponse=true;
  res.originalFullHTMLFile=k+'-'+time+'-'+mode+'-original-publisher.html';
  writeFileSync(join(out,res.originalFullHTMLFile),r.bytes,{flag:'wx'});
  res.candidateAttributionContext=context(r.bytes);
 }
 return res;
}
async function one(src,i){
 const id=track+'-'+String(i+1).padStart(2,'0');
 const cutoff=person.election.replaceAll('-','')+'000000';
 const base=new URL(src.url);
 assert.ok(['http:','https:'].includes(base.protocol));
 const params=new URLSearchParams({url:src.url,matchType:'exact',from:'20120101',to:person.election.replaceAll('-',''),output:'json',
  fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'100'});
 params.append('filter','statuscode:200');params.append('filter','mimetype:text/html');
 const indexUrl='https://web.archive.org/cdx/search/cdx?'+params.toString();
 const idx=await get(indexUrl);
 const result={id,source:src,originalIndexUrl:indexUrl,
  indexStatus:idx.status,returnedIndexResponseContentType:idx.contentType,
  wholeIndexResponseSha256:idx.bytes.length?sha(idx.bytes):null,
  returnedIndexResponseLooksLikeHtml:idx.bytes.subarray(0,64).toString().toLowerCase().includes('html'),
  invalidIndexBodyShortSignature:idx.bytes.length?idx.bytes.subarray(0,128).toString('utf8').replace(/[\r\n\t]/g,' ').slice(0,128):null,
  entireIndexFile:null,indexRows:0,indexResponseUnverified:false,indexError:idx.error||null,
  replays:[],candidateOwnedCampaignWebsite:false,automaticallyAcceptedQuotes:0,
  originalPublisherDocumentPreElectionVerified:false};
 if(!idx.ok){result.indexError=result.indexError||'HTTP '+idx.status;return result;}
 let rows;
 try{
  const arr=JSON.parse(idx.bytes.toString());
  assert.ok(Array.isArray(arr)&&arr.length>=1&&arr.length<=101);
  assert.deepEqual(arr[0],['timestamp','original','mimetype','statuscode','digest','length']);
  result.indexRows=arr.length-1;
  result.indexMayBeTruncated=result.indexRows>=100;
  result.entireIndexFile=id+'-whole-original-CDX.json';
  writeFileSync(join(out,result.entireIndexFile),idx.bytes,{flag:'wx'});
  rows=arr.slice(1).filter(x=>x[0]<cutoff&&x[2]==='text/html'&&x[3]==='200'&&eligible(x[4]));
 }catch(e){result.indexError='Non-CDX JSON/invalid response: '+String(e).slice(0,160);return result;}
 rows.sort((a,b)=>b[0].localeCompare(a[0]));
 const selected=rows.slice(0,2);
 for(const row of selected){
  for(const mode of ['id_','if_','mp_','']){
   const r=await replay(id,row,mode);
   result.replays.push(r);
   if(r.rawIndexDigestMatchesFullResponse)break;
  }
 }
 result.originalPublisherDocumentPreElectionVerified=result.replays.some(r=>r.rawIndexDigestMatchesFullResponse);
 return result;
}
const results=new Array(person.sources.length);
await Promise.all(person.sources.map(async (s,i)=>{results[i]=await one(s,i);}));
const report={schema:'mn-senate-864-four-independently-original-publisher-evidence-research-v1',
 issue:864,track,person:person.person,official:person.official,electionDate:person.election,
 genuine2021To2025ServedStateSenator:true,originalGovernmentSHA256:sha(gov),swearingOriginalSHA256:sha(swear),
 verifiedStatewideWebsiteCoverageSha256:sha(coverageRaw),coveredActuallyServing95:95,
 existingCandidateOwnedWebsitePersons:92,existingCandidateOwnedSiteQuotes:1194,
 sourceClass:'candidate_direct_publisher_hosted_original_not_candidate_owned_website',
 documentChecks:results,originalPreElectionPublisherFullHtmlVerified:results.filter(x=>x.originalPublisherDocumentPreElectionVerified).length,
 exactNewLiteralPublisherCandidateQuotesAdmitted:0,websiteCoverageIncrement:0,
 uncapturedOriginalsUnknownNotAbsence:true,archiveTimestampNotFirstWrittenDate:true,
 latestPageMayBeEditedAndIsNotHistoricEvidence:true,requireNamedSpeakerScopedLiteralIndependentQuoteAudit:true,
 productionReadsWrites:0,forecastsModelsSchedulersChanges:0};
writeFileSync(join(out,'senate-'+track+'-candidate-publisher-original-report-v1.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('PUBLISHER HISTORIC SOURCE ACQUISITION '+JSON.stringify({
 track,sourceTargets:results.length,genuineIndexResults:results.filter(x=>x.entireIndexFile).length,
 digestVerifiedHistoricHtmlPages:report.originalPreElectionPublisherFullHtmlVerified,
 pageFiles:results.flatMap(x=>x.replays.filter(r=>r.originalFullHTMLFile).map(r=>r.originalFullHTMLFile)),
 quotesAutomaticallyAccepted:0,ownedSiteQuoteCountChange:0}));
