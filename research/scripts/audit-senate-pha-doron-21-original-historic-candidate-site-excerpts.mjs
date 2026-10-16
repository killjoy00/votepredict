/**
 * Issue #864: an independent 2-person 21-quote original-byte site audit.
 * 2022 Pha original site SHA1 replays 2022 Jan and Aug vs entire 26-row CDX,
 * and Doron Jan11 2025 full /about original vs whole archived original CDX.
 * Distinguish SD40 legacy footer from verified 2022 actual SD38 service,
 * and 2025 biographical experiences from unverified /priorities page.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const officialHash='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const phaIndexHash='6c7e322bc0bf23c0c75d8fe91edd5cbd0988ab1dc225a6e594bc1508327c29c9';
const argv=process.argv.slice(2);
function arg(k){const i=argv.indexOf(k);assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing '+k);return resolve(argv[i+1]);}
function full(p,min=50,max=6000000){const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'Full archived original required '+p);return readFileSync(p);}
const officialRaw=full(arg('--official-html'),9000);
const receipt=JSON.parse(full(arg('--official-receipt')).toString());
const special=full(arg('--official-special-swearing-html'),9000);
assert.equal(sha(officialRaw),officialHash);
assert.equal(receipt.source.sourceBytesSha256,officialHash);
assert.equal(sha(special),receipt.supplementalSwearingSource.sourceBytesSha256);
const roster=parseOfficialMnSenateServiceDirectory(officialRaw,receipt.source.observedAt,
 special,receipt.supplementalSwearingSource.observedAt);
assert.equal(roster.senators.length,105);
const ledger=JSON.parse(full(resolve('data/evaluation/senate-pha-doron-2022-25-original-campaign-site-21-short-excerpts-v1.json'),2000).toString());
assert.equal(ledger.schema,'mn-2022-25-pha-clark-three-authentic-senate-sites-21-short-original-research-excerpts-v1');
const scope=ledger.scope;
assert.equal(scope.issue,864);
assert.equal(scope.originalTrueSenatorPopulation,95);
assert.equal(scope.priorAuthenticatedOriginalSiteQuotedServingPeople,90);
assert.equal(scope.priorAuthenticatedOriginalSiteShortQuoteRows,1173);
assert.equal(scope.originalFiveParallelSearchRun,38196317659);
assert.equal(scope.originalPhaArchivedFullHTMLArtifact,11722779798);
assert.equal(scope.originalClarkArchivedFullHTMLArtifact,11722919527);
assert.equal(scope.originalOfficialGovernmentLRLSenateDirectorySHA256,officialHash);
assert.equal(scope.newActualServingSenatorsWithFirstPartyCandidateSiteOriginalShortExcerpts,2);
assert.equal(scope.originalFullCandidateOwnedHTMLPages,3);
assert.equal(scope.independentWholeWaybackCDXIndexFiles,2);
assert.equal(scope.distinctShortLiteralCandidateSiteResearchExcerpts,21);
for(const key of ['oneOriginalSusanPhaSiteOldSD40FooterPreservedButActual2022SenateSD38ServiceVerified',
 'susanPha2022AugCandidateOriginalEndorsementExplicitlySaysSD38',
 'doronAuthenticAboutSiteCapturedPreJanuary14PrimaryAndJanuary28SpecialElection',
 'doronPrioritiesPageHistoricalOriginalHTMLNotIndependentlyRecovered',
 'doronOnlyBiographicalCommunityExperienceNotPolicyPlatformPledge',
 'doron2026QuestionnairePDFNotAcceptedAsJan2025OriginalHTML',
 'webArchiveCaptureNotProofFirstAuthorDate','noCompleteCandidatePolicySiteCensus',
 'noOfficialLegislativeVoteOrPastActionVerified','allPublisherHostedSourcesKeptSeparate']) assert.equal(scope[key],true,key);
assert.equal(scope.productionDatabaseReadsWrites,0);
assert.equal(scope.modelTrainingForecastEvidenceAutoIngestOrScheduler2027Changes,0);
assert.equal(ledger.pages.length,3);assert.equal(ledger.excerpts.length,21);
const phaDir=arg('--pha-original-dir'),clarkDir=arg('--clark-original-dir');
const manifest={};
for(const [name,dir,other] of [['Susan Pha',phaDir,{district:'38',year:2022,archive:'11722779798'}],
 ['Doron Clark',clarkDir,{district:'60',year:2025,archive:'11722919527'}]]){
 const t=name==='Susan Pha'?'pha':'clark';
 const b=full(join(dir,'five-senator-'+t+'-historical-original-recovery.json'),2000);
 const d=JSON.parse(b.toString());
 assert.equal(d.schema,'mn-senate-five-remaining-historical-original-site-and-direct-publisher-five-parallel-v1');
 assert.equal(d.issue,864);
 assert.equal(d.person,name);
 assert.equal(d.actualSenateDistrict,other.district);
 assert.equal(d.actualSenateServiceElectionYear,other.year);
 assert.equal(d.originalLRLGovernmentFullSHA256,officialHash);
 assert.equal(d.prior90PersonSourceQuoteCoverageRawJSONSHA256,'b102b4bdc25386358474f00847f5ed9d89c03b3a4e5fd7eec8fa41f2e98103f0');
 assert.equal(d.alreadySourceQuotedActuallyServingPeople,90);
 assert.equal(d.totalActualServingMN2021to2025,95);
 assert.equal(d.siteQuoteResearchRowsAutomaticallyAdded,0);
 assert.equal(d.productionDatabaseReadsWrites,0);
 assert.equal(d.modelForecastTrainingScheduler2027Changes,0);
 assert.equal(d.candidateOwnedSiteIdentityStillRequiresSpecificReview,true);
 manifest[name]=d;
}
const pha=manifest['Susan Pha'];
assert.equal(pha.independentFullSusanPha2022RootCDX.wholeOriginalCdxSHA256,phaIndexHash);
assert.equal(pha.independentFullSusanPha2022RootCDX.originalCdxRowCount,26);
const old=full(join(phaDir,'susan2022-26-complete-independent-original-cdx.json'),100);
assert.equal(sha(old),phaIndexHash);
const first=JSON.parse(old.toString());
assert.deepEqual(first[0],['timestamp','original','mimetype','statuscode','digest','length']);
assert.equal(first.length,27);
const clark=manifest['Doron Clark'];
assert.equal(clark.doronJanuary2025PartyCandidateQuestionnaire.PDFDownloadedIn2026NotProvenSameBytesAsJan2025,true);
assert.equal(clark.doronJanuary2025PartyCandidateQuestionnaire.PDFPolicyQuotesAutomaticallyApproved,0);
const originalText=new Map(),personNames=new Set(),indexCache=new Map(),fullPageProof=[];
for(const p of ledger.pages){
 assert.equal(p.firstAuthoredDateProven,false);
 assert.equal(p.officialLegislativeActsVerified,false);
 assert.equal(p.forecastAutoEligibility,false);
 const lookup=validateActualSenateServiceForElection(roster,p.person,p.verifiedSenateDistrict,p.verifiedElectionYear);
 assert.equal(lookup.status,'verified_senate_service');
 assert.equal(lookup.officialName,p.officialSenateDirectoryName);
 assert.equal(lookup.serviceForThisElectionFollowingYearVerified,true);
 personNames.add(p.person);
 const personManifest=manifest[p.person];
 const dir=p.person==='Susan Pha'?phaDir:clarkDir;
 let replay,rows;
 if(p.person==='Susan Pha'){
  assert.equal(p.verifiedSenateDistrict,'38');
  assert.equal(p.verifiedElectionYear,2022);
  assert.equal(p.completeOriginalCdxSHA256,phaIndexHash);
  assert.equal(p.completeOriginalCdxFilename,'susan2022-26-complete-independent-original-cdx.json');
  replay=personManifest.independentFullSusanPha2022RootCDX.originalReplays
   .filter(r=>r.fullOriginalHTMLFile===p.originalRawHtmlFile);
  rows=first;
 }else{
  assert.equal(p.verifiedSenateDistrict,'60');
  assert.equal(p.verifiedElectionYear,2025);
  assert.equal(p.originalPageUrl,'https://www.doronforsenate.org/about');
  const sources=personManifest.allSourceQueries.filter(x=>x.originalCdxFile===p.completeOriginalCdxFilename);
  assert.equal(sources.length,1);
  assert.equal(sources[0].originalEntireCdxSHA256,p.completeOriginalCdxSHA256);
  assert.equal(sources[0].originalIndexRows,3);
  replay=sources[0].originalFullHTMLReplays.filter(r=>r.fullOriginalHTMLFile===p.originalRawHtmlFile);
  const ix=full(join(dir,p.completeOriginalCdxFilename),100);
  assert.equal(sha(ix),p.completeOriginalCdxSHA256);
  rows=JSON.parse(ix.toString());
  assert.deepEqual(rows[0],['timestamp','original','mimetype','statuscode','digest','length']);
  assert.equal(rows.length,4);
  indexCache.set(p.completeOriginalCdxFilename,true);
 }
 assert.equal(replay.length,1);
 const r=replay[0];
 assert.equal(r.originalURL,p.originalPageUrl);
 assert.equal(r.captureUTC,p.archivePublicByUTC);
 assert.equal(r.originalIndexedSHA1Base32,p.originalIndexedSha1Base32);
 assert.equal(r.fullOriginalResponseSha256,p.originalHtmlSHA256);
 assert.equal(r.fullBytesMatchOriginalIndependentArchiveIndex,true);
 assert.equal(r.replayHTTPStatus,200);
 const ts=p.archivePublicByUTC.replace(/[^0-9]/g,'').slice(0,14);
 assert.equal(rows.slice(1).filter(row=>row[0]===ts&&row[1]===p.originalPageUrl
  &&row[2]==='text/html'&&row[3]==='200'&&row[4]===p.originalIndexedSha1Base32).length,1,
  'Whole independent original CDX must index the exact same original full body');
 const html=full(join(dir,p.originalRawHtmlFile),500);
 assert.equal(sha(html),p.originalHtmlSHA256);
 assert.equal(historicalArchiveSha1Base32(html),p.originalIndexedSha1Base32);
 const visible=originalCampaignVisibleText(html);
 assert.ok(visible.includes(p.originalCandidateIdentityAnchor),'Genuine candidate site identity missing '+p.id);
 assert.ok(visible.includes(p.issuePrioritySectionStart),'Missing original candidate statement region '+p.id);
 if(p.person==='Susan Pha'){
  assert.ok(p.archivePublicByUTC<'2022-11-08T00:00:00.000Z');
  assert.ok(visible.includes('Susan Pha for Senate SD40 District'),
   'Old SD40 stale site footer must be kept and not rewritten as 2022 SD38 authorship');
  if(p.id==='pha-2022-aug05-original-senate-home'){
   assert.ok(visible.includes('I fully support and endorse Susan for the SD38 Senate seat'));
   assert.ok(visible.includes('Chris Eaton State Senator'));
  }
  assert.equal(p.sourceOffice,'Minnesota State Senate campaign');
 }else{
  assert.ok(p.archivePublicByUTC<'2025-01-14T00:00:00.000Z');
  assert.ok(p.archivePublicByUTC<'2025-01-28T00:00:00.000Z');
  assert.ok(visible.includes(p.originalPaidForIdentity),'Candidate committee authentic original paid-for footer absent');
  assert.ok(visible.startsWith('About Doron'));
  assert.ok(visible.includes('Priorities'), 'Navigation mentions priorities but original priorities BODY not recovered');
 }
 originalText.set(p.id,visible);
 fullPageProof.push({pageId:p.id,officialSenatorName:p.officialSenateDirectoryName,
  entireIndependentOriginalCdxSHA256:p.completeOriginalCdxSHA256,
  originalIndexedSHA1Base32:historicalArchiveSha1Base32(html),
  wholeOriginalSourceHtmlSHA256:sha(html),
  originalSiteCapturePublicByUTC:p.archivePublicByUTC,
  originalFirstAuthoredDateUnknown:true,
  originalCandidateSiteIdentityAndLRLStateSenatorServiceVerified:true,
  original2022PhaStaleSD40FooterNot2012SenateOfficeClaim:p.person==='Susan Pha',
  originalDoron2025AboutNotRecoveredPrioritiesPage:p.person==='Doron Clark'});
}
assert.equal(personNames.size,2);
assert.equal(originalText.size,3);
const seen=new Set(),proof=[],perPage=new Map();
for(const q of ledger.excerpts){
 const text=originalText.get(q.pageId);
 assert.ok(text,'No independently original page for '+q.id);
 assert.ok(!seen.has(q.exactShortExcerpt));seen.add(q.exactShortExcerpt);
 assert.match(q.issueFamily,/^[a-z_]+$/);
 assert.ok(q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130);
 assert.equal(q.quoteActuallyObservedOnEntireOriginalHTML,true);
 assert.equal(q.originalFirstAuthoredDateProven,false);
 assert.equal(q.officialVoteOrPastActionVerified,false);
 assert.equal(q.forecastEligibleAutomatically,false);
 assert.ok(text.includes(q.exactShortExcerpt),'Original visible HTML lacks literal exact quote '+q.id);
 if(q.attributionClass==='candidate_owned_original_senate_site_explicit_policy_priority'){
  const after=text.indexOf('AS YOUR SENATOR I WILL STAND STRONG FOR');
  const endSection=text.indexOf('Donate Thank you',after);
  const fallbackEnd=text.indexOf('ENDORSEMENTS',after);
  const stop=endSection>=0?endSection:fallbackEnd;
  assert.ok(stop>after,'No clearly bounded originally rendered site priorities section');
  assert.ok(text.slice(after,stop).includes(q.exactShortExcerpt),'Policy quote belongs outside original priorities section '+q.id);
 }else if(q.pageId.startsWith('clark')){
  assert.match(q.attributionClass,/^candidate_owned_original_about_/);
  assert.match(q.attributionClass,/(?:not_platform_pledge|not_official_result|not_specific_bill)$/);
 }else assert.match(q.attributionClass,/^candidate_owned_original_senate_site_/);
 perPage.set(q.pageId,(perPage.get(q.pageId)||0)+1);
 proof.push({id:q.id,exactShortOriginalHtmlLiteralSHA256:sha(Buffer.from(q.exactShortExcerpt)),
  originallyArchivedCandidateOwnedSitePageId:q.pageId,
  electionYearAndActualSenateServiceVerified:true,
  fullOriginalHTMLAndIndependentCDXDigestReopened:true,
  editoriallyScopedOfficeAndPolicyKind:q.attributionClass,
  originalDateAndOfficialVoteNotInferred:true});
}
assert.equal(perPage.get('pha-2022-jan20-original-senate-home'),14);
assert.equal(perPage.get('pha-2022-aug05-original-senate-home'),2);
assert.equal(perPage.get('clark-2025-jan11-original-candidate-about'),5);
assert.equal(proof.length,21);
const audit={schema:'mn-pha-doron-full-original-pre-election-site-21-short-literal-source-audit-v1',
 issue:864,officialGovernmentOriginalSHA256:sha(officialRaw),
 independentEntireOriginalIndexFilesReopened:2,
 wholeOriginalCampaignOwnedHtmlPagesReopened:3,
 actualServingPreviouslyUnobservedSenators:2,
 exactShortQuoteSourceLiteralVerified:21,
 PhaStaleDistrict40FooterRetainedAndVerifiedActual2022District38:true,
 Doron2025PrioritiesPageNotAuthenticatedOnlyOriginalAbout:true,
 officialRollcallVotesAuthenticatedFromCandidateSelfReports:0,
 originalFirstAuthoredDatesIndependentlyProven:0,
 productionDatabaseReadsWritesOrForecastChanges:0,
 originalPages:fullPageProof,exactShortLiteralResearchExcerptProof:proof};
const out=arg('--output-json');mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,JSON.stringify(audit,null,2)+'\n',{flag:'wx'});
console.log('TWO HISTORIC MN SENATE ORIGINAL CANDIDATE SITES 21 EXACT EXCERPTS AUTHENTIC '+JSON.stringify({
 actualServingPeople:2,fullOriginalHTML:3,completeIndependentCDX:2,exactQuotes:21,dbWrites:0}));
