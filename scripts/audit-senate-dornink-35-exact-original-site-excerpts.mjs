/**
 * Issue #864: original full-byte verification of Gene Dornink campaign sites.
 * Authenticates 12 short extracts from 2019-pre2020 Senate SD27 site and 23
 * from pre-Nov-2022 candidate-owned Senate SD23 platform/home originals.
 * No first authored dates, official legislative vote claims or forecasts.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const govHash='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const opts=process.argv.slice(2);
function arg(k){const i=opts.indexOf(k);assert.ok(i>=0&&opts[i+1]&&!opts[i+1].startsWith('--'),'Missing '+k);return resolve(opts[i+1]);}
function original(p,min=50,max=6500000){const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'Complete original required '+p);return readFileSync(p);}
const governmentHtml=original(arg('--official-html'),9000),
 governmentReceipt=JSON.parse(original(arg('--official-receipt')).toString()),
 swearing=original(arg('--official-special-swearing-html'),9000);
assert.equal(sha(governmentHtml),govHash);
assert.equal(governmentReceipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(governmentReceipt.source.sourceBytesSha256,govHash);
assert.equal(sha(swearing),governmentReceipt.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(
 governmentHtml,governmentReceipt.source.observedAt,swearing,
 governmentReceipt.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const ledger=JSON.parse(original(resolve('data/evaluation/senate-dornink-35-2019-2022-original-firstparty-excerpts-v1.json')).toString());
const scope=ledger.scope;
assert.equal(ledger.schema,'mn-gene-dornink-2019-2022-original-campaign-sites-35-short-literal-policy-quote-leads-v1');
assert.equal(scope.issue,864);
assert.equal(scope.originalGovernmentMinnesotaSenateServiceDirectorySha256,govHash);
assert.equal(scope.totalDistinctActuallyServingSenators2021to2025,95);
assert.equal(scope.originalAcquisitionWorkflowRun,38192154846);
assert.equal(scope.originalAcquisitionArtifact,11720994420);
assert.equal(scope.sourceAcquisitionDocumentedOriginalDomain,'dorninkforsenate.com');
assert.equal(scope.olderPreviouslyProbedDistinctDomain,'genedorninkforsenate.com');
assert.equal(scope.previousAuthenticatedOriginalSiteCoveredSenators,86);
assert.equal(scope.previousAuthenticatedShortOriginalIssueQuotes,1105);
assert.equal(scope.newServingSenatorsWithAuthenticPreElectionSitePolicies,1);
assert.equal(scope.actualVerifiedCompleteOriginalCandidateSiteHtmlPages,3);
assert.equal(scope.shortExactNonduplicateOriginalCandidateExcerpts,35);
assert.equal(scope.original2020District,'27');
assert.equal(scope.original2022District,'23');
assert.equal(scope.archivedSiteCaptureNotFirstAuthoredDate,true);
assert.equal(scope.oldDistrictStatementsRemainAttributedToOldElection,true);
assert.equal(scope.candidateSiteSelfReportsNotAuthenticatedOfficialVotes,true);
assert.equal(scope.notASiteWideCompleteIssueCensus,true);
assert.equal(scope.archiveFailuresAndCappedCDXUnknownNotPolicyAbsence,true);
assert.equal(scope.productionDatabaseReadsWrites,0);
assert.equal(scope.officialSenateRollCallVerificationsFromCandidateQuotes,0);
assert.equal(scope.forecastTrainingScheduler2027Changes,0);
assert.equal(ledger.pages.length,3);assert.equal(ledger.excerpts.length,35);
const sourceDir=arg('--archived-original-source-dir');
const acquisition=JSON.parse(original(join(sourceDir,'gene-dornink-authentic-original-historical-domain-research-manifest.json')).toString());
assert.equal(acquisition.schema,'mn-senate-gene-dornink-documented-2020-22-campaign-domain-originals-v1');
assert.equal(acquisition.issue,864);
assert.equal(acquisition.officialFullLRLServiceSourceSHA256,govHash);
assert.equal(acquisition.documentedHistoricalCandidateOwnedDomain,'dorninkforsenate.com');
assert.equal(acquisition.otherPreviouslyFailedDistinctDomain,'genedorninkforsenate.com');
assert.equal(acquisition.previousOfficial95MemberCoverageWithQuotes,86);
assert.equal(acquisition.researchDateConstrainedOriginalCDXWindows,6);
assert.equal(acquisition.preservedFullRawWaybackCDXIndexes,5);
assert.equal(acquisition.fullSHA1VerifiedOriginalCandidateOwnedHTML,6);
assert.equal(acquisition.quotesAutomaticallyClassified,0);
assert.equal(acquisition.productionDatabaseReadsWrites,0);
assert.equal(acquisition.modelForecastTrainingSchedulerChanges,0);
assert.equal(acquisition.queryOutcomes.length,6);
const sourcePages=new Map(),indexed=new Map(),people=new Set(),pageProof=[];
for(const p of ledger.pages){
 assert.ok(!sourcePages.has(p.id),'Duplicate source page '+p.id);
 assert.equal(p.person,'Gene Dornink');
 people.add(p.person);
 assert.equal(p.originalPostDateIndependentlyEstablished,false);
 assert.equal(p.previousLegislativeVotesOrBillAuthorshipOfficiallyVerified,false);
 assert.equal(p.eligibleForProductionForecasts,false);
 assert.match(p.originalHtmlSha256,/^[a-f0-9]{64}$/);
 assert.match(p.independentOriginalCdxSha256,/^[a-f0-9]{64}$/);
 assert.match(p.originalCdxIndexedSha1Base32,/^[A-Z2-7]{32}$/);
 const actual=validateActualSenateServiceForElection(official,p.person,p.officialSenateDistrict,p.historicalElectionYear);
 assert.equal(actual.status,'verified_senate_service',p.person);
 assert.equal(actual.serviceForThisElectionFollowingYearVerified,true);
 assert.equal(actual.officialName,'Gene Dornink');
 const cutoff=p.historicalElectionYear===2020?'2020-11-03T00:00:00.000Z'
  :p.historicalElectionYear===2022?'2022-11-08T00:00:00.000Z':null;
 assert.ok(cutoff);
 assert.ok(p.archiveCaptureUTC<cutoff,'Pre-election original archival cutoff failed');
 const candidates=acquisition.queryOutcomes.flatMap(w=>w.replays
  .filter(r=>r.originalHtmlFile===p.originalHtmlFile).map(r=>({w,r})));
 assert.equal(candidates.length,1,'One independently pinned original replay must match each page');
 const {w,r}=candidates[0];
 assert.equal(w.year,p.historicalElectionYear);
 assert.equal(w.district,p.officialSenateDistrict);
 assert.equal(w.originalCdxHttpStatus,200);
 assert.equal(w.indexError,null);
 assert.equal(w.originalCdxFile,p.indexFile);
 assert.equal(w.originalCdxBytesSha256,p.independentOriginalCdxSha256);
 assert.equal(r.originalCandidateUrl,p.originalUrl);
 assert.equal(r.archiveCaptureUtc,p.archiveCaptureUTC);
 assert.equal(r.responseSha256,p.originalHtmlSha256);
 assert.equal(r.indexedOriginalSha1Base32,p.originalCdxIndexedSha1Base32);
 assert.equal(r.wholeHtmlBytesMatchOriginalCdxSha1,true);
 assert.equal(r.originalCandidateIdentityInVisibleText,true);
 assert.equal(r.replayHttpStatus,200);
 let cdx=indexed.get(p.indexFile);
 if(!cdx){
  const raw=original(join(sourceDir,p.indexFile));
  assert.equal(sha(raw),p.independentOriginalCdxSha256,'Original independent CDX full response differs');
  cdx=JSON.parse(raw.toString());
  assert.deepEqual(cdx[0],['timestamp','original','mimetype','statuscode','digest','length']);
  assert.equal(cdx.length-1,w.originalCdxRows);
  indexed.set(p.indexFile,cdx);
 }
 const timestamp=p.archiveCaptureUTC.replace(/[^0-9]/g,'').slice(0,14);
 assert.equal(cdx.slice(1).filter(v=>v[0]===timestamp&&v[1]===p.originalUrl
  &&v[2]==='text/html'&&v[3]==='200'
  &&v[4]===p.originalCdxIndexedSha1Base32).length,1,
 'Exact original Wayback timestamp+URL+SHA1 digest missing from pinned CDX');
 const bytes=original(join(sourceDir,p.originalHtmlFile),200);
 assert.equal(sha(bytes),p.originalHtmlSha256,'Entire original source HTML SHA mismatch');
 assert.equal(historicalArchiveSha1Base32(bytes),p.originalCdxIndexedSha1Base32,
  'Entire original source SHA1 must independently equal Wayback original index');
 const visible=originalCampaignVisibleText(bytes);
 assert.ok(visible.includes(p.campaignIdentityAnchor),'Candidate first-party identity anchor missing '+p.id);
 assert.ok(visible.includes('Dornink'));
 if(p.historicalElectionYear===2020){
  assert.equal(p.officialSenateDistrict,'27');
  assert.ok(visible.includes('What Gene Will fight for'));
  assert.ok(p.historicalProvenance.includes('2019_archived'));
  assert.ok(!p.historicalProvenance.includes('2022_Senate'));
 }else{
  assert.equal(p.officialSenateDistrict,'23');
  assert.ok(visible.includes('Prepared and Paid for by Dornink for Senate'));
  assert.ok(p.historicalProvenance.includes('2022_original_Senate_SD23'));
  if(p.id==='dornink-sd23-2022-platform')assert.ok(visible.includes('As your State Senator, Gene will fight for these issues:'));
  if(p.id==='dornink-sd23-2022-home')assert.ok(visible.includes('your next Senator for District 23'));
 }
 sourcePages.set(p.id,visible);
 pageProof.push({id:p.id,actualSenatorServiceAndDistrictVerified:true,
  archivedByUtc:p.archiveCaptureUTC,sourceElectionYear:p.historicalElectionYear,
  sourceSenateDistrict:p.officialSenateDistrict,originalFirstAuthorshipDateNotAsserted:true,
  exactRawOriginalUrl:p.originalUrl,fullSourceHtmlSHA256:sha(bytes),
  wholeOriginalCDXSHA256:sha(original(join(sourceDir,p.indexFile))),
  originalArchiveCDXIndexedSha1Base32:historicalArchiveSha1Base32(bytes),
  candidateIdentityAndElectionOfficeVerified:true});
}
assert.equal(people.size,1);
assert.equal(sourcePages.size,3);
assert.equal(indexed.size,3);
const ids=new Set(),allLiterals=new Set(),excerptProof=[];
const counts=new Map();
for(const q of ledger.excerpts){
 assert.ok(!ids.has(q.id),'Duplicate excerpt key');ids.add(q.id);
 assert.ok(!allLiterals.has(q.exactShortExcerpt),'Duplicate literal short excerpt');allLiterals.add(q.exactShortExcerpt);
 assert.ok(sourcePages.has(q.pageId),'No authentic historical page '+q.id);
 assert.match(q.issueFamily,/^[a-z_]+$/);
 assert.equal(q.sourceStatementKind,'original_candidate_campaign_policy_priority');
 assert.ok(q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130);
 assert.equal(q.firstAuthoredDateKnown,false);
 assert.equal(q.officialSenateVoteVerified,false);
 assert.equal(q.eligibleForForecast,false);
 assert.ok(sourcePages.get(q.pageId).includes(q.exactShortExcerpt),'Original site lacks literal exact quote '+q.id);
 counts.set(q.pageId,(counts.get(q.pageId)||0)+1);
 excerptProof.push({id:q.id,originalPageId:q.pageId,originalExactLiteralSha256:sha(Buffer.from(q.exactShortExcerpt)),
  independentlyAuthenticatedOriginalHtmlAndCdx:true,authoredDateAndOfficialVotesNotClaimed:true});
}
assert.equal(counts.get('dornink-sd27-home-before-2020'),12);
assert.equal(counts.get('dornink-sd23-2022-platform'),16);
assert.equal(counts.get('dornink-sd23-2022-home'),7);
assert.equal(excerptProof.length,35);
const audit={schema:'mn-dornink-2020-22-original-site-35-short-excerpts-independent-complete-html-cdx-audit-v1',
 originalGovernmentFullLRLServiceSHA256:sha(governmentHtml),
 preElectionOriginalFullHTMLFilesIndependentlyReopened:pageProof.length,
 wholeOriginalWaybackIndexFilesReopened:indexed.size,
 originalExactShortIssueExcerptsSourceMatched:excerptProof.length,
 newActuallyServedSenatorsFirstPartyObserved:1,
 prior95MemberVerifiedOriginalCampaignSourceCoverage:86,
 historicalOriginalCampaignYearsKeptDistinct:[2020,2022],
 historicalCapturedOriginalFirstAuthoredDateClaimed:false,
 authenticatedOfficialSenateVotesFromWebsite:false,
 automaticForecastOrEvidenceIngestion:0,productionDatabaseWrites:0,
 sourcePages:pageProof,exactLiteralOriginalSourceShortExcerptProof:excerptProof};
const dest=arg('--output-json');mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(audit,null,2)+'\n',{flag:'wx'});
console.log('DORNINK ORIGINAL SITE 35 EXACT FIRST-PARTY QUOTES SHA/CDX AUDITED '+JSON.stringify({
 entireHTML:pageProof.length,wholeCDX:3,quotes:excerptProof.length,
 newActuallyServedSenatorPeople:1,forecastsOrProductionWrites:0}));
