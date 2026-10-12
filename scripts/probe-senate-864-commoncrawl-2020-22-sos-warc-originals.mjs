/**
 * #864: independent Common Crawl 2020/2022 original-source recovery.
 * Each query is backed by an official collection; any archived HTML must
 * match index original digest AND WARC target/date AND exact HTTP 206 bytes.
 * All research sources must link independently to both official post-election
 * SOS vote-winner identities and the original actual Senate service directory.
 * No archive discovery or mutable 2026 questionnaire can be auto-admitted as
 * original authored position, candidate-owned site, official vote or forecast.
 * Public HTTP only; no Neon/production, emails, releases or deploys.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {auditSos2020to2022OriginalGeneralCensus}
 from '../src/evidence/senate-2020-22-official-general-census.js';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const argv=process.argv.slice(2);
function a(k){const i=argv.indexOf(k);assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing argument '+k);return resolve(argv[i+1]);}
const group=argv[argv.indexOf('--group')+1];
assert.ok(['newman','weber','kari','threegap'].includes(group),'Unexpected research scope');
const out=a('--out-dir');mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
function file(p,min=100,max=10_000_000){
 const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'Missing independently acquired source bytes '+p);
 return readFileSync(p);
}
const manifest=JSON.parse(file(resolve('data/evaluation/senate-864-2020-22-original-archive-alternate-index-and-official-sos-reconciliation-v1.json'),3000).toString());
assert.equal(manifest.schema,'senate-864-2020-22-independent-commoncrawl-original-issue-and-questionnaire-recovery-v1');
assert.equal(manifest.issue,864);
assert.equal(manifest.baseline.actualServedPeople,95);
assert.equal(manifest.baseline.siteCoveredPeople,92);
assert.equal(manifest.baseline.selectedCandidateOwnedOriginalSiteExcerpts,1285);
assert.equal(manifest.baseline.latestSeparateOriginalCaucusFragments,16);
assert.equal(manifest.productionReadsWrites,0);
assert.equal(manifest.forecastOrModelChanges,0);
const track=manifest.groups[group];assert.ok(track&&track.targets.length===(group==='weber'?4:3)&&track.indexes.length===4);
const official=file(a('--official-html'),9000),govReceipt=JSON.parse(file(a('--official-receipt'),300).toString()),swear=file(a('--official-special-swearing-html'),9000);
assert.equal(sha(official),manifest.baseline.officialSenateDirectoryOriginalSha256);
assert.equal(govReceipt.source.sourceBytesSha256,sha(official));
assert.equal(govReceipt.supplementalSwearingSource.sourceBytesSha256,sha(swear));
const lrl=parseOfficialMnSenateServiceDirectory(official,govReceipt.source.observedAt,swear,govReceipt.supplementalSwearingSource.observedAt);
assert.equal(lrl.senators.length,105);
const year=track.year;
const sosRoot=a('--sos-original-dir');
const st=file(join(sosRoot,year+'-sos-general-stsenate.response'),1000);
const cand=file(join(sosRoot,year+'-sos-general-cand.response'),1000);
const officialSos=auditSos2020to2022OriginalGeneralCensus(year,st,cand);
assert.equal(officialSos.source.originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence,true);
assert.equal(officialSos.totals.senateDistricts,67);
assert.equal(officialSos.totals.nonWriteinElectionWinnerCandidates,67);
assert.equal(officialSos.source.originalResultSha256,year===2020?manifest.baseline.officialSosOriginal2020StsenateSha256:manifest.baseline.officialSosOriginal2022StsenateSha256);
assert.equal(officialSos.source.originalCandidateLookupSha256,year===2020?manifest.baseline.officialSosOriginal2020CandSha256:manifest.baseline.officialSosOriginal2022CandSha256);
const baseline=JSON.parse(file(a('--baseline-1285-json'),10000).toString());
assert.equal(baseline.summary.actualServingSenators,95);
assert.equal(baseline.summary.peopleWithAnyAuthenticatedOriginalSiteExcerpt,92);
assert.equal(baseline.summary.combinedSelectedOriginalCandidateOwnedSiteResearchExcerpts,1285);
const actualFor=[];
for(const lead of track.targets) {
 assert.equal(lead.electionYear,year);
 assert.equal(lead.copyCanBeAdmittedOnlyAfterOriginalWholeArchiveHashAndSpeechAudit,true);
 assert.ok(lead.url.startsWith('https://')||lead.url.startsWith('http://'));
 assert.match(lead.id,/^[a-z0-9-]{6,70}$/);
 const person=validateActualSenateServiceForElection(lrl,lead.person,lead.district,year);
 assert.equal(person.status,'verified_senate_service');
 assert.equal(person.serviceForThisElectionFollowingYearVerified,true);
 assert.ok(baseline.byActuallyServedSenator.some(x=>x.officialName===person.officialName));
 const candidates=officialSos.candidates.filter(x=>x.district===lead.district&&x.generalOutcome==='winner');
 assert.equal(candidates.length,1);
 const surname=lead.person.split(' ').at(-1).toLowerCase();
 assert.ok(candidates[0].candidateName.toLowerCase().includes(surname),'Wrong senator for official SOS general winner '+lead.id);
 assert.equal(candidates[0].sourceEvidenceClass,'postvote_election_result_identity_only');
 assert.equal(candidates[0].campaignWebsiteOriginalSOSFilingField,null);
 actualFor.push({targetId:lead.id,person:lead.person,officialServiceName:person.officialName,
  originalOfficialSosWinnerName:candidates[0].candidateName,officialSosDistrict:lead.district,
  sosPostvoteWinnerIdentityMatched:true,actualSenateServiceVerified:true,
  originalSosFilingCampaignWebsiteColumnVerified:false});
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b32=s=>/^[A-Z2-7]{32}$/.test(s);
const maxIndexBytes=1_400_000;
let totalRequests=0;
async function http(url,headers={},ms=12500,max=1_400_000){
 totalRequests++;
 try{
  const r=await fetch(url,{headers:{'user-agent':'VotePredictResearchSourceAudit/1.0 historical public Minnesota senate evidence (github.com/killjoy00/votepredict)',accept:'application/json,text/plain;q=0.8,*/*;q=0.2',...headers},signal:AbortSignal.timeout(ms)});
  const cl=r.headers.get('content-length');
  if(cl&&Number(cl)>max)return {status:r.status,contentType:r.headers.get('content-type'),data:null,error:'Content-Length exceeds bounded archive retrieval'};
  const ab=await r.arrayBuffer();
  if(ab.byteLength>max)return {status:r.status,contentType:r.headers.get('content-type'),data:null,error:'Whole response exceeds bounded archive retrieval'};
  return {status:r.status,contentType:r.headers.get('content-type'),contentRange:r.headers.get('content-range'),data:Buffer.from(ab),error:null};
 }catch(e){return {status:null,contentType:null,data:null,error:String(e).slice(0,180)};}
}
function originalPage(source,original,entry){
 try{
  const gz=gunzipSync(source,{maxOutputLength:10_000_000});
  const sep=Buffer.from('\r\n\r\n');
  const hi=gz.indexOf(sep);assert.ok(hi>40&&hi<15_000);
  const warcHeaders=gz.subarray(0,hi).toString('latin1');
  assert.ok(warcHeaders.startsWith('WARC/1.0\r\n')||warcHeaders.startsWith('WARC/1.1\r\n'),'Not WARC original');
  function h(name){const re=new RegExp('(?:^|\\r\\n)'+name+':\\s*([^\\r\\n]+)','i');return warcHeaders.match(re)?.[1]?.trim()||null;}
  assert.equal(h('WARC-Type'),'response');
  assert.equal(h('WARC-Target-URI'),original);
  assert.ok(h('WARC-Date')?.startsWith(entry.timestamp.slice(0,4)+'-'+entry.timestamp.slice(4,6)+'-'+entry.timestamp.slice(6,8)+'T'+entry.timestamp.slice(8,10)+':'+entry.timestamp.slice(10,12)+':'+entry.timestamp.slice(12,14)),'WARC date differs from CDX timestamp');
  assert.equal(h('WARC-Payload-Digest')?.toUpperCase(),'SHA1:'+entry.digest,'WARC payload hash differs from original CDX');
  const bodyStart=hi+sep.length,he=gz.indexOf(sep,bodyStart);
  assert.ok(he>bodyStart&&he-bodyStart<30_000,'No bounded original HTTP response header');
  const httpHeaders=gz.subarray(bodyStart,he).toString('latin1');
  assert.match(httpHeaders,/^HTTP\/\d(?:\.\d)? 200(?:\s|\r)/,'Not actual original 200 HTTP response');
  assert.match(httpHeaders,/content-type:\s*(?:text\/html|application\/xhtml\+xml)/i,'Original HTTP page is not HTML');
  const html=gz.subarray(he+sep.length);
  assert.ok(html.length>=200&&html.length<=5_000_000,'Original HTML length invalid');
  assert.equal(historicalArchiveSha1Base32(html),entry.digest,'Original HTML does not match independent Common Crawl WARC payload digest');
  return {ok:true,originalHtml:html,originalCompressedWarcSourceSha256:sha(source),
   originalWarcHeaderSha256:sha(gz.subarray(0,hi)),
   originalHtmlSha256:sha(html),originalHtmlBytes:html.length,
   originalShortVisibleTextPreview:originalCampaignVisibleText(html).slice(0,900),
   originalCandidateIdentityCueFound:originalCampaignVisibleText(html).toLowerCase().includes(entry.person.toLowerCase()),
   qualifiedAsHistoricalOriginalPolicyStatementAutomatically:false};
 }catch(e){return {ok:false,reason:String(e).slice(0,240)};}
}
function hostMatches(rowUrl,targetUrl,matchType){
 const u=new URL(rowUrl),v=new URL(targetUrl);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port)return false;
 const h=x=>x.hostname.toLowerCase().replace(/^www\./,'');
 if(h(u)!==h(v))return false;
 if(matchType==='exact')return u.pathname.replace(/\/$/,'')===v.pathname.replace(/\/$/,'')&&u.search===v.search;
 if(matchType==='prefix')return u.pathname.startsWith(v.pathname);
 return false;
}
async function probe(lead) {
 const record={id:lead.id,person:lead.person,year:lead.electionYear,district:lead.district,sourceUrl:lead.url,
  publisherOrCampaignCategoryOnlyHypothesized:lead.sourceClass,
  knownResearchContext:lead.context,originalOfficialElectionAndServiceIdentityVerified:true,
  indexQueries:[],verifiedFullOriginalPages:[],qualifyingRecordsFound:0,
  eligibleLiteralSpeakerPositionsAutomatically:0,
  campaignSiteQuoteCountIncrementAutomatically:0,
  currentLiveWebsitePositionNotHistoricallyBackdated:true,
  missesAreNotEvidenceOfStatementAbsence:true};
 let failedIndexes=0;
 for(const col of track.indexes){
  assert.match(col,/^CC-MAIN-202[02]-\d\d$/);
  const params=new URLSearchParams({url:lead.url,output:'json',matchType:lead.matchType});
  params.append('filter','status:200');
  const endpoint='https://index.commoncrawl.org/'+col+'-index?'+params.toString();
  await sleep(1100);
  const ix=await http(endpoint,{},13500,maxIndexBytes);
  const row={collection:col,queryUrl:endpoint,originalIndexHttpStatus:ix.status,
   originalIndexPayloadSHA256:ix.data?sha(ix.data):null,indexPayloadFile:null,parseStatus:null,
   indexRecordCount:0,qualifyingIndexedRecordCount:0,indexedCandidateSnapshotSamples:[],error:ix.error};
  record.indexQueries.push(row);
  if(ix.status!==200){failedIndexes++;row.parseStatus=ix.status===404?'provider_index_404_not_a_negative_census':'provider_non_200_unknown';if(failedIndexes>=3)break;continue;}
  let values;
  try{
   const lines=ix.data.toString('utf8').trim().split(/\r?\n/);
   assert.ok(lines.length>0&&lines.length<=150,'Index has too many rows');
   values=lines.map(s=>JSON.parse(s));
   assert.ok(values.every(x=>x&&typeof x==='object'&&'timestamp'in x&&'url'in x&&'digest'in x&&'filename'in x&&'offset'in x&&'length'in x),'Provider body is not real Common Crawl JSONL');
   row.parseStatus='commoncrawl_original_index_rows';
   row.indexRecordCount=values.length;
   const f=lead.id+'-'+col+'-full-original-index.jsonl';
   writeFileSync(join(out,f),ix.data,{flag:'wx'});
   row.indexPayloadFile=f;
  }catch(e){failedIndexes++;row.parseStatus='http200_non_commoncrawl_index_unknown';row.error=String(e).slice(0,170);if(failedIndexes>=3)break;continue;}
  const candidates=values.filter(x=>x.status==='200'&&['text/html','application/xhtml+xml'].includes(x.mime)
   &&/^\d{14}$/.test(x.timestamp)&&x.timestamp<track.electionDate.replaceAll('-','')+'000000'
   &&hostMatches(x.url,lead.url,lead.matchType)
   &&b32(x.digest)&&String(x.filename).startsWith('crawl-data/'+col+'/')
   &&/^\d{1,12}$/.test(String(x.offset))&&/^\d{1,8}$/.test(String(x.length))
   &&Number(x.length)>=100&&Number(x.length)<=3_000_000);
  row.qualifyingIndexedRecordCount=candidates.length;record.qualifyingRecordsFound+=candidates.length;
  row.indexedCandidateSnapshotSamples=candidates.slice(0,4).map(x=>({timestamp:x.timestamp,url:x.url,digest:x.digest}));
  const unique=new Set();
  for(const x of candidates){
   if(unique.has(x.digest)||record.verifiedFullOriginalPages.length>=2)continue;
   unique.add(x.digest);
   const start=Number(x.offset),end=start+Number(x.length)-1;
   const dataUrl='https://data.commoncrawl.org/'+x.filename;
   await sleep(1200);
   const res=await http(dataUrl,{Range:'bytes='+start+'-'+end,Accept:'application/octet-stream','Accept-Encoding':'identity'},16000,3_000_000);
   const download={archiveFileUrl:dataUrl,requestedHttpByteRange:'bytes='+start+'-'+end,
    httpStatus:res.status,contentRange:res.contentRange??null,
    returnedLength:res.data?.length??0,rangeMatchesExactCompressedWarcSource:false,
    warcReconstruction:null,error:res.error};
   row.warcAttempt=download;
   if(res.status!==206||!res.data||res.data.length!==Number(x.length)||!res.contentRange?.startsWith('bytes '+start+'-'+end+'/')){
    download.error=download.error||'HTTP 206 original byte-range not exactly satisfied; cannot trust entire WARC record';
    continue;
   }
   download.rangeMatchesExactCompressedWarcSource=true;
   const decoded=originalPage(res.data,x.url,{...x,person:lead.person});
   download.warcReconstruction=decoded.ok?'whole_warc_target_date_and_payload_digest_valid':'original_full_body_digest_validation_failed';
   if(!decoded.ok){download.error=decoded.reason;continue;}
   const warcFilename=lead.id+'-'+col+'-'+x.timestamp+'-whole-original-warc-range.gz';
   const htmlFilename=lead.id+'-'+col+'-'+x.timestamp+'-whole-original-http.html';
   writeFileSync(join(out,warcFilename),res.data,{flag:'wx'});
   writeFileSync(join(out,htmlFilename),decoded.originalHtml,{flag:'wx'});
   record.verifiedFullOriginalPages.push({sourceOriginalUrl:x.url,archivedAtUtc:x.timestamp.replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/,'$1-$2-$3T$4:$5:$6.000Z'),
    collection:col,originalIndexedPayloadSHA1Base32:x.digest,
    originalWarcRangeFile:warcFilename,originalWarcRangeSHA256:decoded.originalCompressedWarcSourceSha256,
    originalFullHtmlFile:htmlFilename,wholeOriginalHtmlSHA256:decoded.originalHtmlSha256,
    wholeOriginalHtmlBytes:decoded.originalHtmlBytes,
    originalCandidateIdentityCueFound:decoded.originalCandidateIdentityCueFound,
    originalVisiblePreviewForResearchOnly:decoded.originalShortVisibleTextPreview,
    candidateOwnedCampaignSiteOwnershipManuallyAudited:false,
    literalSpeakerStatementAdded:0,archiveObservedByNotFirstAuthored:true,forecastsEligible:0});
  }
  if(record.verifiedFullOriginalPages.length>=2)break;
 }
 return record;
}
const results=[];
for(const lead of track.targets){
 try{results.push(await probe(lead));}
 catch(e){results.push({id:lead.id,sourceUrl:lead.url,originalRetrievalError:String(e).slice(0,240),
  verifiedFullOriginalPages:[],qualifyingRecordsFound:0,candidateSiteQuoteCountIncrementAutomatically:0});}
}
const report={schema:'senate-864-independent-2020-22-commoncrawl-WARC-original-with-official-postvote-SOS-person-identity-v1',
 issue:864,group,year,archiveProvider:'official_Common_Crawl_2020_2022_CDXJ_plus_exact_original_WARC_HTTP_range',
 originalIndependent2020or2022OfficialGeneralSosBytesVerified:true,original2020or2022SosFull67DistrictCensusMatched:true,
 original2020or2022OfficialGeneralSosOriginalResultSHA256:officialSos.source.originalResultSha256,
 original2020or2022OfficialGeneralSosCandidateSHA256:officialSos.source.originalCandidateLookupSha256,
 generalElectionWinningCandidatesAndActualLRLServedPersonsReconciled:actualFor,
 true2021to2025ActualServingSenators:95,
 sourceOriginalCandidateSiteCoveredSenatorsBefore:92,sourceOriginalCandidateSiteSelectedResearchExcerptsBefore:1285,
 newVerifiedHistoricOriginalSitePolicyExcerptsAutoAccepted:0,
 newVerifiedCandidateCompletedHistoricQuestionnaireQuotesAutoAccepted:0,
 fourCollectionBoundedIndexProbesNotExhaustiveWebArchive:true,
 originalSosSevenFieldCandidateLookupDoesNotContainHistoricalFiledCandidateWebsite:true,
 originalRecordObservedBeforeElectionNotDateOriginallyAuthored:true,
 noInferenceFromArchiveIndexFailures:true,
 productionReadsWrites:0,forecastModelChanges:0,
 originalPublicIndexHttpRequestsAndWarcRangeAttempts:totalRequests,
 targets:results,
 recoveredWholeOriginalWarcPages:results.reduce((n,r)=>n+(r.verifiedFullOriginalPages?.length||0),0)};
writeFileSync(join(out,'senate-864-'+group+'-independent-commoncrawl-sos-original-recovery-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('2020/22 COMMONCRAWL AND SOS OFFICIAL RECONCILIATION '+JSON.stringify({group,
 government2020or2022OfficialWinnerCensus:true,matchedOfficialSenatorTargets:actualFor.length,
 archiveRequests:totalRequests,newFullyWarcDigestVerifiedOriginals:report.recoveredWholeOriginalWarcPages,
 byTarget:results.map(r=>({id:r.id,idx:r.indexQueries?.map(i=>i.parseStatus||i.originalIndexHttpStatus),
  qualifyingRows:r.qualifyingRecordsFound||0,fullWarc:r.verifiedFullOriginalPages.length,
  warcAttempts:(r.indexQueries||[]).filter(q=>q.warcAttempt).map(q=>({collection:q.collection,status:q.warcAttempt.httpStatus,returnedBytes:q.warcAttempt.returnedLength,rangeOK:q.warcAttempt.rangeMatchesExactCompressedWarcSource,reconstructed:q.warcAttempt.warcReconstruction,error:q.warcAttempt.error}))})),
 positionsAutoPromoted:0},null,2));
