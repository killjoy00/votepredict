/**
 * Issue #864: independent raw original Wayback CDX+HTML authenticated five
 * previously uncovered 2021-25 MN senators' historically scoped site excerpts.
 * Excerpts are research lead facts ONLY, not proof of official Senate votes or
 * newly authored 2022 platforms (older House copy remains explicitly old).
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const governmentOriginal='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const args=process.argv.slice(2);
function arg(k){const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+k);return resolve(args[i+1]);}
function read(p,min=50,max=5500000){
 const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'Missing full original '+p);
 return readFileSync(p);
}
const gov=read(arg('--official-html'),9000),receipt=JSON.parse(read(arg('--official-receipt')).toString()),
 swear=read(arg('--official-special-swearing-html'),9000);
assert.equal(sha(gov),governmentOriginal);assert.equal(receipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(receipt.source.sourceBytesSha256,governmentOriginal);
assert.equal(sha(swear),receipt.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(gov,receipt.source.observedAt,
 swear,receipt.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const ledger=JSON.parse(read(resolve('data/evaluation/senate-last16-five-new-original-site-policy-excerpts-v1.json'),2000,100000).toString());
const scope=ledger.scope;
assert.equal(ledger.schema,'mn-senate-last16-five-newly-recovered-original-historical-site-issue-excerpts-v1');
assert.equal(scope.issue,864);
assert.equal(scope.officialTrueServingSenators,95);
assert.equal(scope.originalLRLSHA256,governmentOriginal);
assert.equal(scope.last16SourceAcquisitionRun,38186753218);
assert.equal(scope.last16SourceArtifact,11719882698);
assert.equal(scope.rarickSevenSourceAcquisitionRun,38186897084);
assert.equal(scope.rarickSevenSourceArtifact,11719617752);
assert.equal(scope.rarickOriginalCompleteCdxAcquisitionRun,38175993447);
assert.equal(scope.rarickOriginalCompleteCdxArtifact,11716126718);
assert.equal(scope.priorServingSenatorsWithAuthenticOriginalSiteExcerpts,79);
assert.equal(scope.priorOriginalSiteShortResearchRows,1006);
assert.equal(scope.newActualServingSenatorsWithSiteQuotes,5);
assert.equal(scope.completeOriginalSiteSourcePages,12);
assert.equal(scope.exactHistoricallyAttributedShortExcerpts,73);
assert.equal(scope.earlierHouseCampaignPositionsNeverCalled2022SenatePledges,true);
assert.equal(scope.candidatePriorVoteClaimsNotOfficialSenateVotes,true);
assert.equal(scope.archivalUTCNotFirstPublishedDate,true);
assert.equal(scope.notAnExhaustiveOriginalSiteCensus,true);
assert.equal(scope.productionReadsWritesOrForecasts,0);
assert.equal(ledger.unobservedAreUnknownNotNoPolicy,true);
assert.equal(ledger.pages.length,12);
assert.equal(ledger.excerpts.length,73);
const lastDir=arg('--last16-original-dir'),rarickDir=arg('--rarick-seven-original-dir'),firstDir=arg('--first20-original-dir');
const lastManifest=JSON.parse(read(join(lastDir,'last16-targeted-candidate-original-archive-manifest.json')).toString());
assert.equal(lastManifest.schema,'mn-2021-25-last16-targeted-uncovered-original-site-64-archive-search-windows-v1');
assert.equal(lastManifest.independentGovernmentLRLSourceSha256,governmentOriginal);
assert.equal(lastManifest.actualServingStateSenatorsVerifiedAgainstGovernmentBeforeArchiveNetwork,16);
assert.equal(lastManifest.independentDateSegmentedCandidateSiteWindows,64);
assert.equal(lastManifest.completeOriginalCdxResponseFilesRetained,18);
assert.equal(lastManifest.digestAndVisibleIdentityMatchedCompleteArchivedHtml,20);
assert.equal(lastManifest.baselineActualSenatorsWithAnyOriginalFirstPartyExcerpt,79);
assert.equal(lastManifest.baselineActualSenatorsUnobserved,16);
assert.equal(lastManifest.exactCandidatePolicyExcerptsAutomaticallyAdmitted,0);
const rarickManifest=JSON.parse(read(join(rarickDir,'rarick-seven-2021-full-original-issues-recovery-manifest.json')).toString());
assert.equal(rarickManifest.schema,'mn-senate-rarick-seven-2021-issue-subpage-originals-from-previous-complete-32-row-cdx-v1');
assert.equal(rarickManifest.originalLRLGovernmentSha256,governmentOriginal);
assert.equal(rarickManifest.originalWholeCdxSha256,'c0f0bece80b238cd4a92583823e6d96e72f191de164e43d88a9dbe3327dc60bb');
assert.equal(rarickManifest.independentlyAuthenticatedCandidatePaidFullHTML,7);
assert.equal(rarickManifest.exactCDXIndexedOriginalsPriorTo2022Election,7);
assert.equal(rarickManifest.originalSourceQuotedPositionsAutomaticallyAdded,0);
const firstManifest=JSON.parse(read(join(firstDir,'first-20-senators-historical-candidate-site-originals-manifest.json')).toString());
assert.equal(firstManifest.schema,'mn-2021-25-first-batch-20-uncovered-actual-senators-26-original-archive-search-windows-v1');
assert.equal(firstManifest.independentGovernmentLRLSourceSha256,governmentOriginal);
const rarickIndexFile='10-jason-rarick-2022-entire-original-cdx.json';
const rarickCdxBytes=read(join(firstDir,rarickIndexFile),3000);
assert.equal(sha(rarickCdxBytes),rarickManifest.originalWholeCdxSha256);
const rarickOriginalWindow=firstManifest.originalSourceWindows.filter(w=>w.person==='Jason Rarick'&&w.originalCandidateDomainLead==='jasonrarick.com');
assert.equal(rarickOriginalWindow.length,1);
assert.equal(rarickOriginalWindow[0].fullOriginalCdxFilename,rarickIndexFile);
assert.equal(rarickOriginalWindow[0].fullOriginalCdxResponseSha256,rarickManifest.originalWholeCdxSha256);
assert.equal(rarickOriginalWindow[0].indexRows,32);
const rawIndexes=new Map([[rarickIndexFile,JSON.parse(rarickCdxBytes.toString())]]);
function fullIndex(name,expected,originalDir){
 if(rawIndexes.has(name)){
  const bytes=read(join(name===rarickIndexFile?firstDir:originalDir,name));
  assert.equal(sha(bytes),expected);
  return rawIndexes.get(name);
 }
 const bytes=read(join(originalDir,name));
 assert.equal(sha(bytes),expected,'Full original CDX bytes altered');
 const arr=JSON.parse(bytes.toString());
 assert.deepEqual(arr[0],['timestamp','original','mimetype','statuscode','digest','length']);
 rawIndexes.set(name,arr);return arr;
}
assert.deepEqual(rawIndexes.get(rarickIndexFile)[0],['timestamp','original','mimetype','statuscode','digest','length']);
assert.equal(rawIndexes.get(rarickIndexFile).length-1,32);
const pageIds=new Set(),persons=new Set(),visiblePageById=new Map(),proof=[];
for(const p of ledger.pages){
 assert.ok(!pageIds.has(p.id),'Duplicate page identity');pageIds.add(p.id);
 assert.equal(p.originalFirstPublishedDateProven,false);
 assert.equal(p.officialSenateLegislativeActionsProven,false);
 assert.equal(p.automaticallyEligibleForForecast,false);
 assert.equal(p.serviceElectionYear,2022);
 const v=validateActualSenateServiceForElection(official,p.person,p.district,2022);
 assert.equal(v.status,'verified_senate_service',p.person);
 assert.equal(v.serviceForThisElectionFollowingYearVerified,true,p.person+' 2023 senate district');
 persons.add(p.person);
 assert.ok(p.candidateSiteIdentityAnchor.length>10);
 let source,indexName,expectedIndexHash,originalHtmlPath,originalUrl,utc,indexedDigest,expectedSha;
 if(p.sourceGroup==='last16'){
  const matches=lastManifest.originalSourceWindows.flatMap(w=>w.originalHtmlReplays
   .filter(r=>r.retainedRawOriginalHtml===p.rawHtmlFile).map(r=>({w,r})));
  assert.equal(matches.length,1,'Must uniquely reopen acquired full original '+p.id);
  const {w,r}=matches[0];
  assert.equal(w.person,p.person);
  assert.equal(w.originalOfficialElectionDistrict,p.district);
  assert.equal(w.electionYear,p.serviceElectionYear);
  assert.equal(w.indexHttpStatus,200);
  assert.equal(w.indexError,null);
  assert.equal(r.fullOriginalByteDigestMatchesSeparateOriginalCdx,true);
  assert.equal(r.replayHttpStatus,200);
  indexName=w.fullOriginalCdxFilename;
  expectedIndexHash=w.fullOriginalCdxResponseSha256;
  source=fullIndex(indexName,expectedIndexHash,lastDir);
  originalHtmlPath=join(lastDir,p.rawHtmlFile);
  originalUrl=r.originalSiteUrl;utc=r.captureUtc;
  indexedDigest=r.originalCdxIndexedSha1Base32;expectedSha=r.fullResponseSha256;
 }else{
  assert.equal(p.sourceGroup,'rarick');
  assert.equal(p.person,'Jason Rarick');
  const records=rarickManifest.sourcePages.filter(r=>r.originalFullHtmlFile===p.rawHtmlFile);
  assert.equal(records.length,1,'Original Rarick 2021 full issue page missing from independent source proof');
  const r=records[0];
  assert.equal(r.archiveReplayedHttpStatus,200);
  assert.equal(r.verifiedOriginalHtmlSha1AgainstOriginalCdx,true);
  assert.equal(r.visibleCandidateName,true);
  assert.equal(r.visibleSenateCampaignFooter,true);
  indexName=rarickIndexFile;expectedIndexHash=rarickManifest.originalWholeCdxSha256;
  source=fullIndex(indexName,expectedIndexHash,firstDir);
  originalHtmlPath=join(rarickDir,p.rawHtmlFile);
  originalUrl=r.originalCandidateUrl;utc=r.archiveCaptureUtc;
  indexedDigest=r.sha1IndexedInIndependentOriginal32RowCdx;
  expectedSha=r.completeResponseBytesSha256;
 }
 assert.ok(utc<'2022-11-08T00:00:00.000Z','2022 election cutoff violated');
 const timestamp=utc.replace(/[^0-9]/g,'').slice(0,14);
 const match=source.slice(1).filter(v=>v[0]===timestamp&&v[1]===originalUrl
   &&v[2]==='text/html'&&v[3]==='200'&&v[4]===indexedDigest);
 assert.equal(match.length,1,'Archival URL/UTC/digest absent from entire unmodified CDX');
 const html=read(originalHtmlPath,150);
 assert.equal(sha(html),expectedSha,'Original complete HTML altered');
 assert.equal(historicalArchiveSha1Base32(html),indexedDigest,'Indexed SHA1 Base32 not equal original bytes');
 const visible=originalCampaignVisibleText(html);
 assert.ok(visible.includes(p.candidateSiteIdentityAnchor),'Campaign identity anchor absent '+p.id);
 if(p.person==='Eric Lucero'){
  assert.equal(p.originalCampaignScope,'2016_house_campaign_not_2022_senate_platform');
  assert.ok(visible.includes('Eric Lucero for State Representative'));
 }
 if(p.person==='Jason Rarick'){
  assert.equal(p.originalCampaignScope,'2021_senate_site_retains_earlier_house_era_claims');
  assert.ok(visible.includes('Rarick'));
 }
 if(p.person==='Matt Klein'){
  assert.equal(p.originalCampaignScope,'2022_senate_candidate_general_issues');
 }
 if(p.person==='Kelly Morrison'){
  assert.ok(p.originalCampaignScope.startsWith('2022_senate_candidate_'));
 }
 visiblePageById.set(p.id,visible);
 proof.push({pageId:p.id,officialSenator:v.officialName,actualElectionDistrict:p.district,originalCampaignScope:p.originalCampaignScope,
  independentOriginalUrl:originalUrl,originalArchiveCapturePublicByUTC:utc,originalCompleteHTMLSha256:sha(html),
  independentCompleteSourceCdxSHA256:expectedIndexHash,originalArchiveCdxSHA1Base32:indexedDigest,
  literalOriginalHtmlIndependentlyVerifiedAgainstFullCdx:true,campaignOriginalIdentityTextVerified:true,
  exactFirstAuthoredDateProven:false,officialSenateActionProven:false});
}
assert.equal(persons.size,5);
assert.equal(pageIds.size,12);
const kupecHomepage=lastManifest.originalSourceWindows.flatMap(w=>w.originalHtmlReplays
 .filter(r=>r.retainedRawOriginalHtml==='22-robert-kupec-2022--1-original-20220703215005.html').map(r=>({w,r})));
assert.equal(kupecHomepage.length,1,'Kupec 2022 Senate identity original homepage not available');
const idSource=kupecHomepage[0],homeHtml=read(join(lastDir,'22-robert-kupec-2022--1-original-20220703215005.html'));
assert.equal(sha(homeHtml),idSource.r.fullResponseSha256);
assert.equal(historicalArchiveSha1Base32(homeHtml),idSource.r.originalCdxIndexedSha1Base32);
assert.ok(originalCampaignVisibleText(homeHtml).includes('Rob Kupec for Minnesota Senate District 4'));
const homeIndex=fullIndex(idSource.w.fullOriginalCdxFilename,idSource.w.fullOriginalCdxResponseSha256,lastDir);
assert.equal(homeIndex.slice(1).filter(v=>v[0]==='20220703215005'
 &&v[1]==='https://www.kupec4mnsenate.com/'&&v[4]===idSource.r.originalCdxIndexedSha1Base32).length,1);
const seenIds=new Set(),seenLiteral=new Set(),quoteProof=[];
const allowedKinds=new Set(['candidate_site_issue_priority','older_2016_minnesota_house_campaign_issue_priority',
 'first_person_2022_senate_campaign_general_priority',
 'candidate_self_reported_prior_house_legislation_unverified',
 'candidate_self_reported_prior_house_advocacy_unverified',
 'candidate_self_reported_prior_house_vote_unverified']);
for(const q of ledger.excerpts){
 assert.ok(!seenIds.has(q.id),'Duplicate quote ID');seenIds.add(q.id);
 assert.ok(!seenLiteral.has(q.exactShortExcerpt),'Duplicate short literal');seenLiteral.add(q.exactShortExcerpt);
 assert.match(q.issueFamily,/^[a-z_]+$/);
 assert.ok(allowedKinds.has(q.attributionClass));
 assert.ok(q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130);
 assert.equal(q.firstAuthoredDateKnown,false);
 assert.equal(q.officialLegislativeActionVerified,false);
 assert.equal(q.automaticallyEligibleForForecast,false);
 assert.ok(visiblePageById.has(q.pageId),'No authentic original page for '+q.id);
 assert.ok(visiblePageById.get(q.pageId).includes(q.exactShortExcerpt),'Exact short excerpt absent from original '+q.id);
 quoteProof.push({excerptId:q.id,sourcePage:q.pageId,issueFamily:q.issueFamily,
  attributionClass:q.attributionClass,exactOriginalVisibleShortExcerptSha256:sha(Buffer.from(q.exactShortExcerpt)),
  literalExcerptCrosscheckedFromRawOriginal:true});
}
assert.equal(quoteProof.length,73);
assert.equal(new Set(quoteProof.map(q=>q.sourcePage)).size,12);
assert.equal(rawIndexes.size,6,'Expected exact 5 original issue CDXs plus one supporting identity original CDX');
const audited={schema:'mn-senate-five-new-actual-senators-73-historical-firstparty-excerpts-original-byte-and-cdx-audit-v1',
 officialGovernmentServiceOriginalSHA256:sha(gov),sourceAcquisitionLast16Run:38186753218,
 sourceAcquisitionRarickRun:38186897084,sourceOriginalRarickCdxRun:38175993447,
 actualServingStateSenatorsIndependentlyVerified:persons.size,completeOriginalFullIssueHTMLReopened:proof.length,
 completeIndependentOriginalWaybackCdxSourceIndexes:rawIndexes.size,
 additionalKupecCandidateSenateHomepageOriginalValidated:true,
 exactDistinctOriginalSourceShortResearchExcerpts:quoteProof.length,
 oldHouseAndPriorLegislativeSelfClaimsSeparated:true,
 originalCaptureNotFirstPublished:true,notACompleteOriginalWebsiteCensus:true,
 productionEvidenceOrDBWrites:0,officialVoteClaimsConfirmed:0,modelTrainingOrSchedulerChanges:0,
 completeOriginalIssuePageProof:proof,exactShortExcerptProof:quoteProof};
const dest=arg('--output-json');mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(audited,null,2)+'\n',{flag:'wx'});
console.log('FIVE NEW SENATE SERVICE PEOPLE 73 EXACT ORIGINAL HISTORY SHORT EXCERPTS REAUTHENTICATED '+JSON.stringify({
 originalHTML:proof.length,originalFullCDX:rawIndexes.size,
 exactShortExcerpts:quoteProof.length,actualServingSenators:persons.size,productionWrites:0}));
