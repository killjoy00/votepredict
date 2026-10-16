/**
 * #864. Bounded self-service discovery of PRE-2018 original Common Crawl
 * candidate-domain snapshots. Existing PRs #1233/#1239 covered selected
 * later 2016/2018/2020 collections; this probes four distinct older indexes.
 *
 * Original candidate identity must be independently tied to the ORIGINAL
 * official 2020 SOS results, original LRL service directory, and already
 * audited site coverage. Neither archived index presence nor original HTML
 * alone establishes owned Senate campaign or an attributed candidate policy.
 *
 * Never write original HTML, contact details, source index bodies, or WARC
 * bytes to disk, stdout, Actions artifacts or Git. No API auth, outreach,
 * production environment, models, forecasts, database or deployment access.
 */
import assert from 'node:assert/strict';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {auditSos2020to2022OriginalGeneralCensus}
 from '../../src/evidence/senate-2020-22-official-general-census.js';
import {sha256,parseOriginalIndex,verifyOriginalWarc}
 from '../../src/evidence/senate-864-pre2018-commoncrawl-provenance.mjs';

const argv=process.argv.slice(2);
const arg=k=>{const i=argv.indexOf(k);assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing '+k);return resolve(argv[i+1]);};
const targetId=argv[argv.indexOf('--target')+1];
assert.ok(['wiger','tomassoni','bakk'].includes(targetId),'Only three known 2020 website-gap people');
const manifest=JSON.parse(readFileSync(resolve('data/evaluation/senate-864-pre2018-alternative-commoncrawl-original-site-targets-v1.json'),'utf8'));
assert.equal(manifest.schema,'senate-864-pre2018-new-collection-original-candidate-site-research-v1');
assert.equal(manifest.issue,864);
assert.deepEqual(manifest.pre2018Collections,['CC-MAIN-2013-48','CC-MAIN-2014-52','CC-MAIN-2015-11','CC-MAIN-2017-04']);
assert.equal(manifest.originalOfficialCensus.servingStateSenators2021to2025,95);
assert.equal(manifest.originalOfficialCensus.ownedSitePeopleBefore,92);
assert.equal(manifest.originalOfficialCensus.selectedOwnedSiteShortFragmentsBefore,1285);
assert.equal(manifest.sourceSafety.noProductionDatabaseReadsWrites,true);
assert.equal(manifest.sourceSafety.noExternalContactOrCorrespondence,true);
const lead=manifest.targets.find(x=>x.id===targetId);
assert.ok(lead&&lead.electionYear===2020);

const original=p=>{const s=statSync(p);assert.ok(s.isFile()&&s.size>=100&&s.size<=10_000_000);return readFileSync(p);};
const gov=original(arg('--official-html'));
const swearing=original(arg('--official-special-swearing-html'));
const govtReceipt=JSON.parse(original(arg('--official-receipt')).toString('utf8'));
assert.equal(sha256(gov),manifest.originalOfficialCensus.governmentActualSenateDirectorySha256);
assert.equal(sha256(gov),govtReceipt.source.sourceBytesSha256);
assert.equal(sha256(swearing),govtReceipt.supplementalSwearingSource.sourceBytesSha256);
const service=parseOfficialMnSenateServiceDirectory(gov,govtReceipt.source.observedAt,swearing,govtReceipt.supplementalSwearingSource.observedAt);
assert.equal(service.senators.length,105);
const person=validateActualSenateServiceForElection(service,lead.name,lead.district,2020);
assert.equal(person.status,'verified_senate_service');
assert.equal(person.serviceForThisElectionFollowingYearVerified,true);
const sosRoot=arg('--sos-original-dir');
const ss=auditSos2020to2022OriginalGeneralCensus(2020,
 original(join(sosRoot,'2020-sos-general-stsenate.response')),
 original(join(sosRoot,'2020-sos-general-cand.response')));
assert.equal(ss.totals.senateDistricts,67);
assert.equal(ss.totals.nonWriteinElectionWinnerCandidates,67);
assert.equal(ss.source.originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence,true);
assert.equal(ss.source.originalResultSha256,manifest.originalOfficialCensus.original2020SosStsenateSha256);
assert.equal(ss.source.originalCandidateLookupSha256,manifest.originalOfficialCensus.original2020SosCandSha256);
const winner=ss.candidates.filter(x=>x.generalOutcome==='winner'&&x.district===lead.district);
assert.equal(winner.length,1);
assert.ok(winner[0].candidateName.toLowerCase().includes(lead.name.split(' ').at(-1).toLowerCase()));

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let requests=0;
async function publicHttp(u,{headers={},max=1_400_000,timeoutMs=14000}={}){
 const parsed=new URL(u);
 assert.equal(parsed.protocol,'https:');
 assert.ok(['index.commoncrawl.org','data.commoncrawl.org'].includes(parsed.hostname));
 assert.equal(parsed.username,'');assert.equal(parsed.password,'');assert.equal(parsed.port,'');
 assert.ok(requests<9,'Exhausted bounded permitted public requests');
 requests++;
 try{
  const response=await fetch(u,{method:'GET',redirect:'error',headers:{
   accept:'application/json,text/plain,*/*;q=0.3',
   'user-agent':'VotePredict-864-archival-evidence-validation/1.0',...headers},
   signal:AbortSignal.timeout(timeoutMs)});
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>max)return {code:response.status,error:'oversized_public_source_unknown'};
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>max)return {code:response.status,error:'oversized_received_source_unknown'};
  return {code:response.status,bytes,range:response.headers.get('content-range'),error:null};
 }catch(e){return {code:null,error:String(e.name||'NetworkUnavailable').slice(0,90)};}
}
const queryResults=[];
const full=[];
for(const collection of manifest.pre2018Collections){
 const params=new URLSearchParams({url:lead.originalUrl,matchType:'domain',output:'json'});
 params.append('filter','status:200');
 const indexUrl='https://index.commoncrawl.org/'+collection+'-index?'+params.toString();
 await sleep(700);
 const fetched=await publicHttp(indexUrl,{timeoutMs:14000});
 const result={collection,indexStatus:fetched.code,indexBodySha256:fetched.bytes?sha256(fetched.bytes):null,
  indexInterpretation:'unavailable_or_nonindex_unknown',indexRecords:0,eligibleHistoricalRecords:0,
  exactWarc206Attempted:false,originalFullSourceAuthenticated:false,
  indexNotACompleteCensus:true,networkError:fetched.error};
 queryResults.push(result);
 if(fetched.code!==200||!fetched.bytes)continue;
 const parsed=parseOriginalIndex(fetched.bytes,{collection,expectedHost:lead.originalUrl});
 result.indexInterpretation=parsed.status;
 result.indexRecords=parsed.rows||0;result.eligibleHistoricalRecords=parsed.eligibleRows||0;
 if(parsed.status!=='valid_original_index_rows'||full.length)continue;
 // Original URLs with query strings or unsafe personal data cannot be retained.
 const candidate=parsed.entries.find(row=>{
  try{const u=new URL(row.url);return !u.search&&!u.hash&&u.pathname.length<120&&!u.pathname.includes('@');}
  catch{return false;}
 });
 if(!candidate)continue;
 const first=candidate.offset,last=first+candidate.length-1;
 assert.ok(Number.isSafeInteger(last)&&last>=first);
 const originalURL='https://data.commoncrawl.org/'+candidate.filename;
 result.exactWarc206Attempted=true;
 await sleep(700);
 const request=await publicHttp(originalURL,{headers:{Range:'bytes='+first+'-'+last,'Accept-Encoding':'identity'},
  max:3_000_000,timeoutMs:18000});
 result.warcHttpStatus=request.code;
 result.warcExactContentRange=request.code===206&&request.range?.startsWith('bytes '+first+'-'+last+'/')&&
  request.bytes?.length===candidate.length||false;
 if(!result.warcExactContentRange)continue;
 const proof=verifyOriginalWarc(request.bytes,candidate);
 if(proof.status!=='authenticated_original_html'){
  result.originalWarcVerificationStatus=proof.status;continue;
 }
 result.originalWarcVerificationStatus=proof.status;
 result.originalFullSourceAuthenticated=true;
 // Safe hashes and source-time/office-cue only: neither private contact
 // details nor copyright-bearing whole source text is exported.
 full.push({candidateOfficialName:person.officialName,
  candidateOfficial2020SosWinnerName:winner[0].candidateName,
  candidateOfficial2020SosDistrict:lead.district,
  sourceContext:'older_capture_not_2020_authored_platform',
  originalSourceUrl:proof.originalUrl,originalObservationUTC:proof.observationUTC,
  indexedSha1Base32:proof.indexedSha1Base32,originalHtmlSha256:proof.originalHtmlSha256,
  originalHtmlBytes:proof.originalHtmlBytes,
  compressedOriginalWarcSha256:proof.compressedOriginalWarcSha256,
  potentialSenateOfficeCue:proof.potentialSenateOfficeCue,
  originalGovernorCue:proof.originalGovernorCue,repurposedTemplateCue:proof.repurposedTemplateCue,
  originalCandidateOwnershipIndependentlyProven:false,
  literalIssueStatementCandidateAttributed:false,
  originalCandidateOwnedSiteAdmitted:false,
  noAutomaticQuoteAdmitted:true});
}
const result={
 schema:'senate-864-pre2018-cc-original-source-alternative-probe-receipt-v1',
 issue:864,readOnlyIndependentArchiveAndGovernmentSources:true,
 person:person.officialName,official2020District:lead.district,
 original2020ElectionDate:'2020-11-03',sourceDomainHypothesis:lead.originalUrl,
 officialOriginal2020ElectionWinnersCount:67,originalLRLSenatorServiceVerified:true,
 sourceDisqualifications:lead.disqualifications,
 indexedSourceQueries:queryResults,wholeWarcSha1VerifiedOriginalPages:full,
 wholeAuthenticatedOriginalCount:full.length,
 newlyAdmittedCandidateOwnedWebsitePeople:0,newlyAdmittedCandidateOwnedWebsiteQuotes:0,
 baselineActuallyServedSenators:95,baselineOwnedSiteCovered:92,baselineSelectedSiteShortFragments:1285,
 previousFalsePositiveSourcesMustRemainExcluded:true,
 boundedRequests:requests,indexErrorsNeverProveSiteNonexistence:true,
 historicalOriginalFullHtmlNeverPrintedOrPersisted:true,privateAddressesPhonesEmailsNeverPrintedOrPersisted:true,
 oldArchiveObservationCannotProve2020Authorship:true,websiteOfficeCommitteeAndStanceRequireIndependentFutureAudit:true,
 noEmailsOutreachOrRecordsRequests:true,productionDatabaseReadsWrites:0,forecastTrainingDeploySchedulerChanges:0};
const out=arg('--out-dir');mkdirSync(out,{recursive:true});
writeFileSync(join(out,'senate-864-pre2018-'+targetId+'-independent-commoncrawl-archive-receipt-v1.json'),
 JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
console.log('SANITIZED EARLY COMMON CRAWL ORIGINAL RESEARCH '+JSON.stringify({
 person:result.person,originalGovernmentIdentityValid:true,
 indexRecords:queryResults.map(x=>({collection:x.collection,status:x.indexInterpretation,
  httpStatus:x.indexStatus,eligible:x.eligibleHistoricalRecords,fullOriginalRehashed:x.originalFullSourceAuthenticated})),
 wholeAuthenticatedOriginalCount:full.length,admittedCandidateOwnedSites:0,admittedStatements:0,
 totalPublicRequests:requests,noSensitiveSourceContentRetained:true}));
