/**
 * Issue #864: independent original byte + archive CDX + full government Senate service
 * audit of second batch historical first-party candidate issue-source excerpts.
 * The old House and 2018 congressional candidate sources are attributed AS old
 * candidate sources for individuals who independently served Minnesota Senate;
 * none proves 2020/22 Senate-specific authored policy or a verified official vote.
 * Research only: no production database, forecast, scheduler or evidence writes.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const gHash='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const sourceRun=38177884783,sourceArtifact=11717125740;
const args=process.argv.slice(2);
function arg(k){const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+k);return resolve(args[i+1]);}
function read(p,min=50,max=5500000){
 const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'Missing complete archived original '+p);
 return readFileSync(p);
}
const officialHtml=read(arg('--official-html'),9000),receipt=JSON.parse(read(arg('--official-receipt')).toString()),
 swearing=read(arg('--official-special-swearing-html'),9000);
assert.equal(sha(officialHtml),gHash);
assert.equal(receipt.source.sourceBytesSha256,gHash);
assert.equal(receipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(sha(swearing),receipt.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(
 officialHtml,receipt.source.observedAt,swearing,receipt.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const ledger=JSON.parse(read(resolve('data/evaluation/senate-second20-15-original-serving-senators-issue-excerpts-v1.json'),4000,250000).toString());
const s=ledger.scope;
assert.equal(ledger.schema,'mn-senate-second-twenty-15-new-actual-serving-senators-historical-firstparty-original-policy-leads-v1');
assert.equal(s.issue,864);
assert.equal(s.trueActualSenators2021To2025,95);
assert.equal(s.originalSourceAcquisitionRun,sourceRun);
assert.equal(s.originalSourceArtifactId,sourceArtifact);
assert.equal(s.originalGovernmentSenateServiceDirectorySHA256,gHash);
assert.equal(s.sourceAcquisitionProved20PreviouslyUncoveredActualServingSenators,true);
assert.equal(s.newActuallyServingSenatorsWithOriginalFirstPartyIssueLead,15);
assert.equal(s.exactDistinctCandidateSiteSourceExcerpts,137);
assert.equal(s.noOriginalAuthoredPublicationDatesInferred,true);
assert.equal(s.olderHouseAndCongressSourcesNot2020Or2022SenatePlatforms,true);
assert.equal(s.candidateStatementsAboutPassedLegislationDoNotVerifyOfficialVotes,true);
assert.equal(s.originalWaybackCaptureUTCOnlyPublicBy,true);
assert.equal(s.completeWebsiteCensusClaimed,false);
assert.equal(s.noSourceAbsenceInferenceFromFailedOrCappedArchives,true);
assert.equal(s.productionDatabaseWrites,0);
assert.equal(s.forecastOrModelChanges,0);
assert.equal(ledger.pages.length,18);
assert.equal(ledger.excerpts.length,137);
const originalDir=arg('--original-acquisition-dir');
const manifest=JSON.parse(read(join(originalDir,'second-20-senators-historical-candidate-site-originals-manifest.json')).toString());
assert.equal(manifest.schema,'mn-2021-25-second-batch-20-uncovered-actual-senators-33-original-archive-search-windows-v1');
assert.equal(manifest.independentGovernmentLRLSourceSha256,gHash);
assert.equal(manifest.baselineActualSenatorsWithAnyOriginalFirstPartyExcerpt,64);
assert.equal(manifest.baselineActualSenatorsUnobserved,31);
assert.equal(manifest.actualServingStateSenatorsVerifiedAgainstGovernmentBeforeArchiveNetwork,20);
assert.equal(manifest.independentDateSegmentedCandidateSiteWindows,33);
assert.equal(manifest.completeOriginalCdxResponseFilesRetained,24);
assert.equal(manifest.digestAndVisibleIdentityMatchedCompleteArchivedHtml,66);
assert.equal(manifest.exactCandidatePolicyExcerptsAutomaticallyAdmitted,0);
assert.equal(manifest.forecastDataOrProductionDatabaseReadsWrites,0);
assert.equal(manifest.sourceOnlyNoPolicyAutomaticallyCounted,true);
assert.equal(manifest.special2025SenateElectionCutoffsIndependentlyPinned,true);
assert.equal(manifest.originalSourceWindows.length,33);
assert.equal(manifest.senateRoster.length,20);
assert.equal(manifest.originalSourceWindows.filter(w=>w.unexpectedWindowFailure).length,0);
const allTwenty=new Set(manifest.senateRoster.map(x=>x.person));
assert.equal(allTwenty.size,20);
const indexProof=new Map(),sourceText=new Map(),seenPages=new Set(),
 people=new Set(),pageProof=[],quoteProof=[];
const validKind=new Set([
 '2025_senate_special_campaign_source',
 'pre_redistricting_sd45_site_copy_captured_2022_not_fresh_sd43',
 '2022_senate_campaign_first_party_source',
 'older_2011_13_senate_campaign_issue_copy_not_fresh_2020',
 'older_senate_2012_13_platform_not_fresh_2020',
 '2020_senate_campaign_issues_source',
 'older_2012_candidate_site_environment_self_report_not_2020',
 '2020_senate_campaign_platform',
 'older_2016_senate_campaign_platform_not_fresh_2020',
 '2020_senate_campaign_tax_policy_prior_actions_self_reported',
 '2020_senate_campaign_public_safety_prior_actions_self_reported',
 '2018_us_congress_campaign_not_2020_state_senate_platform',
 'older_2014_senate_campaign_platform_not_fresh_2020',
 '2022_senate_site_with_legacy_house_2b_copy_not_new_2022_authorship',
 '2020_minnesota_house_53a_platform_not_2022_senate',
 '2018_minnesota_house_53a_campaign_issues_not_2022_senate'
]);
for(const p of ledger.pages){
 assert.ok(!seenPages.has(p.id),'Duplicated candidate issue page');
 seenPages.add(p.id);
 assert.ok(validKind.has(p.pageKind),'Unclassified old source '+p.id);
 assert.ok(allTwenty.has(p.person),'Uncovered independent 20 cohort match absent');
 people.add(p.person);
 assert.equal(p.firstAuthoredDateEstablished,false);
 assert.equal(p.verifiedLegislativeVoteClaim,false);
 assert.equal(p.automaticallyEligibleForForecast,false);
 assert.match(p.originalHtmlSha256,/^[a-f0-9]{64}$/);
 assert.match(p.sourceIndexSha256,/^[a-f0-9]{64}$/);
 assert.match(p.originalArchiveCdxSha1Base32,/^[A-Z2-7]{32}$/);
 const verified=validateActualSenateServiceForElection(official,p.person,p.district,p.electionYear);
 assert.equal(verified.status,'verified_senate_service',p.person);
 assert.equal(verified.serviceForThisElectionFollowingYearVerified,true,p.person+' SD'+p.district);
 const cutoff=p.electionYear===2020?'2020-11-03T00:00:00.000Z'
  :p.electionYear===2022?'2022-11-08T00:00:00.000Z'
  :p.person==='Amanda Hemmingsen-Jaeger'?'2025-11-04T00:00:00.000Z':null;
 assert.ok(cutoff,'Unsupported special-election date');
 assert.ok(p.archivePublicByUtc<cutoff,'Original archive capture not prior to actual election');
 const found=manifest.originalSourceWindows.flatMap(w=>w.originalHtmlReplays
   .filter(r=>r.retainedRawOriginalHtml===p.originalSourceFile).map(r=>({w,r})));
 assert.equal(found.length,1,'Source filename must match one independently acquired source');
 const {w,r}=found[0];
 assert.equal(w.person,p.person);
 assert.equal(w.originalOfficialElectionDistrict,p.district);
 assert.equal(w.electionYear,p.electionYear);
 assert.equal(w.indexHttpStatus,200);
 assert.equal(w.indexError,null);
 assert.equal(w.fullOriginalCdxFilename,p.sourceIndexFile);
 assert.equal(w.fullOriginalCdxResponseSha256,p.sourceIndexSha256);
 assert.equal(r.captureUtc,p.archivePublicByUtc);
 assert.equal(r.fullResponseSha256,p.originalHtmlSha256);
 assert.equal(r.originalCdxIndexedSha1Base32,p.originalArchiveCdxSha1Base32);
 assert.equal(r.fullOriginalByteDigestMatchesSeparateOriginalCdx,true);
 assert.equal(r.senatorSurnameInVisibleBody,true);
 assert.equal(r.replayHttpStatus,200);
 assert.ok(/^https?:\/\//i.test(r.originalSiteUrl));
 let cdx=indexProof.get(p.sourceIndexFile);
 if(!cdx){
  const bytes=read(join(originalDir,p.sourceIndexFile));
  assert.equal(sha(bytes),p.sourceIndexSha256,'Full independent Wayback CDX bytes hash incorrect');
  const rows=JSON.parse(bytes.toString());
  assert.deepEqual(rows[0],['timestamp','original','mimetype','statuscode','digest','length']);
  assert.equal(rows.length-1,w.indexRows);
  cdx=rows;
  indexProof.set(p.sourceIndexFile,cdx);
 }
 const timestamp=p.archivePublicByUtc.replace(/[^0-9]/g,'').slice(0,14);
 const exact=cdx.slice(1).filter(v=>v[0]===timestamp
    &&v[1]===r.originalSiteUrl&&v[2]==='text/html'
    &&v[3]==='200'&&v[4]===p.originalArchiveCdxSha1Base32);
 assert.equal(exact.length,1,'Exact capture not independently in original CDX');
 const html=read(join(originalDir,p.originalSourceFile),100);
 assert.equal(sha(html),p.originalHtmlSha256);
 assert.equal(historicalArchiveSha1Base32(html),p.originalArchiveCdxSha1Base32);
 const visible=originalCampaignVisibleText(html);
 assert.ok(visible.includes(p.committeeAttributionText),'Candidate-owned attribution absent '+p.id);
 assert.ok(visible.toLowerCase().includes(p.person.split(' ').at(-1).toLowerCase()));
 if(p.person==='Ann Rest'){
  assert.ok(visible.includes('Senator Ann Rest, SD45'),'Site is PRE-redistricting SD45 material, not freshly authored SD43');
  assert.equal(p.pageKind,'pre_redistricting_sd45_site_copy_captured_2022_not_fresh_sd43');
 }
 if(p.person==='Patricia Torres Ray'){
  assert.equal(p.pageKind,'2018_us_congress_campaign_not_2020_state_senate_platform');
  assert.ok(visible.includes('Paid for by Patricia Torres Ray for Congress'),'Do not pretend 2018 US House is 2020 Senate');
 }
 if(p.person==='Tou Xiong'){
  assert.ok(p.pageKind.includes('house_53a'));
  assert.ok(visible.includes('53A'),'Old Minnesota House candidate office mismatch');
 }
 if(p.person==='Steve Green'){
  assert.ok(visible.includes('Representative 2B'),'Retained 2020 House copy even though 2022 site for Senate');
  assert.equal(p.pageKind,'2022_senate_site_with_legacy_house_2b_copy_not_new_2022_authorship');
 }
 if(p.person==='Kari Dziedzic'){
  assert.ok(visible.includes('August 23, 2012'),'Original 2012 blog self-report, not 2020 authorship');
 }
 sourceText.set(p.id,visible);
 pageProof.push({pageId:p.id,senator:verified.officialName,originalCampaignSourceClass:p.pageKind,
  independentSourceURL:r.originalSiteUrl,publicArchiveCaptureUTC:p.archivePublicByUtc,
  completeOriginalSourceHtmlSha256:sha(html),
  completeOriginalSourceCdxSha256:p.sourceIndexSha256,
  originalCdxSha1Base32:historicalArchiveSha1Base32(html),
  sourceIdentityCampaignFootersAndNonModernOfficeChronologyRetained:true,
  originalBytesDigestCheckedIndependentlyAgainstCdx:true});
}
assert.equal(people.size,15);
assert.equal(seenPages.size,18);
assert.equal(indexProof.size,15);
const ids=new Set(),literal=new Set();
for(const q of ledger.excerpts){
 assert.ok(!ids.has(q.id));ids.add(q.id);
 assert.ok(!literal.has(q.exactShortExcerpt));literal.add(q.exactShortExcerpt);
 assert.ok(sourceText.has(q.pageId),'No authenticated first-party original for '+q.id);
 assert.match(q.issueFamily,/^[a-z_]+$/);
 assert.ok(q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130);
 assert.ok(['candidate_campaign_policy_statement','candidate_self_reported_prior_legislation_unverified']
  .includes(q.attributionClass),'Do not imply proven official legislative vote');
 assert.equal(q.firstAuthoredDateKnown,false);
 assert.equal(q.officialLegislativeActionVerified,false);
 assert.equal(q.automaticallyEligibleForForecast,false);
 assert.ok(sourceText.get(q.pageId).includes(q.exactShortExcerpt),
   'Quoted exact visible text absent from unmodified original HTML: '+q.id+' '+q.exactShortExcerpt);
 quoteProof.push({excerptId:q.id,pageId:q.pageId,issueFamily:q.issueFamily,attributionClass:q.attributionClass,
  originalLiteralQuoteSha256:sha(Buffer.from(q.exactShortExcerpt,'utf8')),
  exactQuoteVerifiedInFullOriginalHTML:true,officialVoteNotInferred:true});
}
assert.equal(quoteProof.length,137);
assert.equal(new Set(quoteProof.map(q=>q.pageId)).size,18);
const exclusions=ledger.unresolvedOrDisqualifiedSourceLeads;
assert.equal(exclusions.length,11);
for(const missing of ['Doron Clark','Kelly Morrison','Scott Newman','Charles Wiger','Thomas Bakk']){
 assert.ok(exclusions.some(x=>x.person===missing),'Missingness exclusion absent '+missing);
 assert.ok(!people.has(missing),'Unknown source must not become first-party counted');
}
const proof={schema:'mn-senate-second-20-15-serving-senators-137-literal-first-party-source-independent-audit-v1',
 originalGovernmentFullLRLSHA256:sha(officialHtml),sourceRun,sourceArtifact,
 trueServingMemberDenominator:95,distinctNewCoveredPeople:people.size,
 independentUnmodifiedOriginalHtmlSources:pageProof.length,
 fullIndependentCdxIndexFilesReopened:indexProof.size,
 exactHistoricallyQualifiedCampaignSourceExcerptRows:quoteProof.length,
 priorTotalWithOriginalIssueSiteLeads:64,priorTotalAuthenticatedShortResearchRows:869,
 researchOnly:true,fullHistoricSiteCensusProven:false,authorshipDatesOrOfficialVotesClaimed:false,
 futureForecastOrProductionDBWrites:0,
 independentlyAuthenticatedHistoricalPages:pageProof,individuallyProvenShortExcerpts:quoteProof,
 excludeUnverifiedDomainsRepurposedSpamAndIncorrectStateCandidate:true};
const dest=arg('--output-json');mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log('SECOND 20 SENATORS EXACT ORIGINAL BYTES FIRST-PARTY RESEARCH AUDIT '+JSON.stringify({
 newlyCoveredActualStateSenatorPeople:15,fullAuthenticatedOriginalHtml:pageProof.length,
 originalIndependentCDXIndexes:indexProof.size,exactLiteralShortExcerpts:quoteProof.length,
 noProductionChanges:true}));
