/**
 * #864: Independently reopen all complete original 20-senator batch sources.
 * Read-only public historical candidate-campaign issue excerpt evidence.
 * Distinguishes 2012/2016 copy, older House campaign material, self-reported
 * legislation and archival capture timestamps from 2022 Senate publication.
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
const sourceRun=38175993447,sourceArtifact=11716126718;
const argv=process.argv.slice(2);
function arg(k){const i=argv.indexOf(k);assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing '+k);return resolve(argv[i+1]);}
function original(p,min=50,max=5000000){
 const s=statSync(p);
 assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'Missing original source '+p);
 return readFileSync(p);
}
const officialHtml=original(arg('--official-html'),9000);
const officialAudit=JSON.parse(original(arg('--official-receipt')).toString());
const officialSwearing=original(arg('--official-special-swearing-html'),9000);
assert.equal(sha(officialHtml),govHash);
assert.equal(officialAudit.source.sourceBytesSha256,govHash);
assert.equal(officialAudit.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(sha(officialSwearing),officialAudit.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(
 officialHtml,officialAudit.source.observedAt,
 officialSwearing,officialAudit.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const ledger=JSON.parse(original(resolve('data/evaluation/senate-first-20-original-nine-actual-senators-61-short-excerpts-v1.json')).toString());
assert.equal(ledger.schema,'mn-senate-first-20-batch-nine-original-firstparty-candidate-issue-quote-leads-v1');
assert.equal(ledger.scope.issue,864);
assert.equal(ledger.scope.originalOfficialGovernmentSHA256,govHash);
assert.equal(ledger.scope.originalSourceAcquisitionRun,sourceRun);
assert.equal(ledger.scope.originalAcquisitionArtifact,sourceArtifact);
assert.equal(ledger.scope.trueServiceSenators2021To2025,95);
assert.equal(ledger.scope.newActualSenatorsWithFirstPartyIssueQuotes,9);
assert.equal(ledger.scope.shortDistinctLiteralQuoteLeads,61);
assert.equal(ledger.scope.candidateSiteOriginalAuthoredDatesInferred,false);
assert.equal(ledger.scope.oldHouseSiteNeverClaimed2022SenatePlatform,true);
assert.equal(ledger.scope.pastLegislationSelfReportsNeverOfficialVotes,true);
assert.equal(ledger.scope.noCompleteArchiveCensusClaim,true);
assert.equal(ledger.scope.archiveErrorsAndRepurposedSitesNeverNoPolicy,true);
assert.equal(ledger.scope.sourceResearchNotProduction,true);
assert.equal(ledger.scope.productionDBWrites,0);
assert.equal(ledger.scope.forecastTrainingChanges,0);
assert.equal(ledger.pages.length,11);
assert.equal(ledger.excerpts.length,61);
const originDir=arg('--original-acquisition-dir');
const m=JSON.parse(original(join(originDir,'first-20-senators-historical-candidate-site-originals-manifest.json')).toString());
assert.equal(m.schema,'mn-2021-25-first-batch-20-uncovered-actual-senators-26-original-archive-search-windows-v1');
assert.equal(m.independentGovernmentLRLSourceSha256,govHash);
assert.equal(m.actualServingStateSenatorsVerifiedAgainstGovernmentBeforeArchiveNetwork,20);
assert.equal(m.independentDateSegmentedCandidateSiteWindows,26);
assert.equal(m.completeOriginalCdxResponseFilesRetained,19);
assert.equal(m.digestAndVisibleIdentityMatchedCompleteArchivedHtml,43);
assert.equal(m.exactCandidatePolicyExcerptsAutomaticallyAdmitted,0);
assert.equal(m.forecastDataOrProductionDatabaseReadsWrites,0);
assert.equal(m.originalSourceWindows.length,26);
assert.equal(m.senateRoster.length,20);
const peopleInFullAcquisition=new Set(m.senateRoster.map(x=>x.person));
assert.equal(peopleInFullAcquisition.size,20);
const knownFirstPartyPersons=new Set();
const checks=[],visiblePages=new Map(),pageIds=new Set(),sourceIndexesReopened=new Map();
const oldSourceClassifications=new Set([
 'senate_issue_positions_observable_2021_first_authorship_unproven',
 '2022_senate_candidate_issue_platform',
 'older_senate_sd28_campaign_issues_observable_2021_not_a_fresh_2022_sd26_platform',
 'older_minnesota_house_campaign_policy_not_2022_senate_platform',
 'older_house_campaign_pawlenty_era_copy_observable_2021',
 'older_2016_senate_campaign_issues_observable_2021',
 'original_2016_senate_issues_article_retained_2019',
 'older_2018_senate_campaign_issues_retained_2022',
 'older_2012_senate_candidate_homepage_copy_captured_2016'
]);
for(const p of ledger.pages){
 assert.ok(!pageIds.has(p.id),'Duplicate historical source page');
 pageIds.add(p.id);
 assert.ok(knownFirstPartyPersons.size<=9);
 assert.ok(peopleInFullAcquisition.has(p.person),'Candidate not among independently checked 20');
 knownFirstPartyPersons.add(p.person);
 assert.ok(oldSourceClassifications.has(p.historicalPageAttribution),'Unknown cross-cycle provenance class');
 assert.equal(p.websiteStatementsFirstAuthoredDateKnown,false);
 assert.equal(p.verifiedOfficialVotes,false);
 assert.equal(p.forecastsAutoEligible,false);
 assert.ok(/^[a-f0-9]{64}$/.test(p.originalHtmlSha256));
 assert.ok(/^[a-f0-9]{64}$/.test(p.sourceWindowCdxSha256));
 assert.ok(/^[A-Z2-7]{32}$/.test(p.archiveOriginalCdxDigestSha1Base32));
 const match=validateActualSenateServiceForElection(official,p.person,p.district,p.electionYear);
 assert.equal(match.status,'verified_senate_service',p.person);
 assert.equal(match.serviceForThisElectionFollowingYearVerified,true,p.person+' election SD'+p.district);
 const electionCutoff=p.electionYear===2020?'2020-11-03T00:00:00.000Z':'2022-11-08T00:00:00.000Z';
 assert.ok(/^[12][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$/.test(p.archiveCaptureUtc));
 assert.ok(p.archiveCaptureUtc<electionCutoff,'Source captured after election cutoff');
 const windows=m.originalSourceWindows.filter(w=>w.person===p.person
    &&w.originalHtmlReplays.some(replay=>replay.retainedRawOriginalHtml===p.originalHtmlFilename));
 assert.equal(windows.length,1,'Source must map to one exact original archive window');
 const w=windows[0];
 assert.equal(w.originalOfficialElectionDistrict,p.district);
 assert.equal(w.electionYear,p.electionYear);
 assert.equal(w.indexHttpStatus,200);
 assert.equal(w.indexError,null);
 assert.equal(w.fullOriginalCdxFilename,p.sourceWindowCdxFile);
 assert.equal(w.fullOriginalCdxResponseSha256,p.sourceWindowCdxSha256);
 let index=sourceIndexesReopened.get(p.sourceWindowCdxFile);
 if(!index){
  const bytes=original(join(originDir,p.sourceWindowCdxFile));
  assert.equal(sha(bytes),p.sourceWindowCdxSha256,'Independent raw source index SHA mismatch');
  index=JSON.parse(bytes.toString());
  assert.deepEqual(index[0],['timestamp','original','mimetype','statuscode','digest','length']);
  assert.equal(index.length-1,w.indexRows);
  sourceIndexesReopened.set(p.sourceWindowCdxFile,index);
 }
 const timestamp=p.archiveCaptureUtc.replace(/[^0-9]/g,'').slice(0,14);
 const matching=index.slice(1).filter(row=>row[0]===timestamp
    &&row[1]===p.archivedOriginalSiteUrl&&row[2]==='text/html'
    &&row[3]==='200'&&row[4]===p.archiveOriginalCdxDigestSha1Base32);
 assert.equal(matching.length,1,'Exact CDX independent historical original proof missing');
 const replay=w.originalHtmlReplays.find(x=>x.retainedRawOriginalHtml===p.originalHtmlFilename);
 assert.ok(replay&&replay.fullOriginalByteDigestMatchesSeparateOriginalCdx===true);
 assert.equal(replay.sha1CdxMatchedOriginalHtml,undefined);
 assert.equal(replay.originalSiteUrl,p.archivedOriginalSiteUrl);
 assert.equal(replay.captureUtc,p.archiveCaptureUtc);
 assert.equal(replay.originalCdxIndexedSha1Base32,p.archiveOriginalCdxDigestSha1Base32);
 assert.equal(replay.fullResponseSha256,p.originalHtmlSha256);
 assert.equal(replay.replayHttpStatus,200);
 const bytes=original(join(originDir,p.originalHtmlFilename));
 assert.equal(sha(bytes),p.originalHtmlSha256,'Original unmodified full HTML SHA mismatch');
 assert.equal(historicalArchiveSha1Base32(bytes),p.archiveOriginalCdxDigestSha1Base32,
  'Independent archived CDX SHA1 Base32 does not match recovered original HTML bytes');
 const visible=originalCampaignVisibleText(bytes);
 assert.ok(visible.includes(p.committeeAttributionText),'Candidate committee/site attribution missing: '+p.id);
 assert.ok(visible.toLowerCase().includes(p.person.split(' ').at(-1).toLowerCase()));
 if(p.person==='Steve Drazkowski'){
  assert.ok(visible.includes('Representative Steve Drazkowski'),'House-era site must remain House-era');
  assert.ok(p.historicalPageAttribution.includes('house'),'House source mischaracterized');
 }
 if(p.person==='Jeremy Miller'){
  assert.ok(visible.includes('Senate District 28'),'Older SD28 source must not become new SD26 source');
  assert.ok(p.historicalPageAttribution.includes('older_senate_sd28'));
 }
 if(p.person==='Andrew Mathews')assert.ok(visible.includes('josh 2016-07-19'));
 if(p.person==='Jason Isaacson')assert.ok(visible.includes('Oct 20, 2016'));
 if(p.person==='Jeff Howe')assert.ok(visible.includes('in 2018'));
 if(p.person==='Bill Weber')assert.ok(visible.includes('Posted on September 20, 2012'));
 if(p.person==='Torrey Westrom')assert.ok(p.archiveCaptureUtc.startsWith('2021'));
 if(p.person==='Bill Lieske')assert.ok(p.historicalPageAttribution.startsWith('2022'));
 visiblePages.set(p.id,visible);
 checks.push({pageId:p.id,person:match.officialName,sourceKind:p.historicalPageAttribution,
  historicalOriginalURL:p.archivedOriginalSiteUrl,archiveCaptureUtc:p.archiveCaptureUtc,
  fullOriginalHtmlSha256:sha(bytes),fullOriginalCdxSha256:sha(original(join(originDir,p.sourceWindowCdxFile))),
  originalCdxSha1Base32:historicalArchiveSha1Base32(bytes),
  fullOriginalsReopenedAndIndependentIndexAndGovernmentServiceMatched:true});
}
assert.equal(knownFirstPartyPersons.size,9);
assert.equal(pageIds.size,11);
assert.equal(sourceIndexesReopened.size,9);
const attributionClasses=new Set([
 'candidate_issue_position_or_original_campaign_self_report',
 'candidate_self_reported_prior_legislation_unverified',
 'candidate_listed_bill_not_officially_verified',
 'candidate_self_reported_prior_advocacy_unverified'
]);
const ids=new Set(),texts=new Set(),quotes=[];
for(const q of ledger.excerpts){
 assert.ok(!ids.has(q.id),'Duplicate source quote ID');ids.add(q.id);
 assert.ok(q.pageId&&visiblePages.has(q.pageId),'Quote page has no original proven HTML');
 assert.ok(/^[a-z_]+$/.test(q.issueFamily));
 assert.ok(attributionClasses.has(q.attributionClass));
 assert.ok(typeof q.exactShortExcerpt==='string'&&q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130);
 assert.ok(!texts.has(q.exactShortExcerpt),'Duplicate short quote across site pages');texts.add(q.exactShortExcerpt);
 assert.equal(q.firstAuthoredDateKnown,false);
 assert.equal(q.officialLegislativeActionVerified,false);
 assert.equal(q.automaticallyEligibleForForecast,false);
 assert.ok(visiblePages.get(q.pageId).includes(q.exactShortExcerpt),'Exact source-visible excerpt missing: '+q.id);
 quotes.push({id:q.id,sourcePage:q.pageId,issueFamily:q.issueFamily,attributionClass:q.attributionClass,
  literalShortExcerptSha256:sha(Buffer.from(q.exactShortExcerpt,'utf8')),
  exactLiteralSourceTextIndependentlyReopened:true,candidateOriginalAuthorshipDateNotInvented:true});
}
assert.equal(quotes.length,61);
assert.equal(new Set(quotes.map(q=>q.sourcePage)).size,11);
assert.equal(ledger.excludedUnreliableOriginalSourceCandidates.length,11);
for(const x of ledger.excludedUnreliableOriginalSourceCandidates)
 assert.ok(!knownFirstPartyPersons.has(x.person),'Cannot both exclude and count original site');
const report={schema:'mn-2021-25-nine-new-senators-61-firstparty-historical-site-originals-independent-audit-v1',
 originalGovernmentSenateServiceSHA256:sha(officialHtml),
 sourceAcquisitionRun:sourceRun,sourceAcquisitionArtifactId:sourceArtifact,
 originalCandidateCompleteHtmlAudited:checks.length,
 independentCompleteCdxIndexesReopened:sourceIndexesReopened.size,
 distinctVerifiedServingSenatorPeople:knownFirstPartyPersons.size,
 exactNonduplicateShortFirstPartyExcerptResearchLeads:quotes.length,
 uncategorizedReusedOlderCyclePages:0,originalAuthoredPublicationDateInferred:false,
 sourceResearchOnly:true,officialVoteClaimsAutoVerified:0,productionWrites:0,forecastTrainingOrSchedulerChanges:0,
 authenticatedOriginalPages:checks,individuallyExactQuotedShortExcerpts:quotes};
const dest=arg('--output-json');mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('FIRST 20 ORIGINAL SENATOR INDEPENDENT AUDIT '+JSON.stringify({
 actualNewSenators:9,originalFullHtml:11,sourceCdxIndexes:sourceIndexesReopened.size,
 exactShortSourceExcerpts:61,productionChanges:0}));
