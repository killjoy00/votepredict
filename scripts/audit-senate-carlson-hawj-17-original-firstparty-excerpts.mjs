/**
 * #864 original-byte source-only independent verification for 17 new short
 * first-party Minnesota Senate website excerpt leads, TWO actual senators.
 * Historical government LRL + entire original Wayback CDX JSON + unmodified
 * full captured HTML must all independently match pinned source digests.
 * No mutation of production evidence, predictions, database or model.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const govExpected='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const sourceRun=38173412344,sourceArtifact=11714578217;
const sha=b=>createHash('sha256').update(b).digest('hex');
const args=process.argv.slice(2);
function arg(k){const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+k);return resolve(args[i+1]);}
function read(p,min=50,max=5000000){const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'Missing complete original '+p);return readFileSync(p);}
const gov=read(arg('--official-html'),9000),receipt=JSON.parse(read(arg('--official-receipt')).toString('utf8'));
const swearing=read(arg('--official-special-swearing-html'),9000);
assert.equal(sha(gov),govExpected);
assert.equal(receipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(receipt.source.sourceBytesSha256,govExpected);
assert.equal(sha(swearing),receipt.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(gov,receipt.source.observedAt,swearing,receipt.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const ledger=JSON.parse(read(resolve('data/evaluation/senate-carlson-hawj-2020-22-original-first-party-17-issue-excerpts-v1.json')).toString());
assert.equal(ledger.schema,'mn-senate-two-actually-served-2020-22-original-websites-17-verified-short-first-party-excerpts-v1');
assert.equal(ledger.scope.issue,864);
assert.equal(ledger.scope.independentOriginalOfficialGovernmentSHA256,govExpected);
assert.equal(ledger.scope.originalSourceAcquisitionRun,sourceRun);
assert.equal(ledger.scope.originalAcquisitionArtifact,sourceArtifact);
assert.equal(ledger.scope.actualNewQualifyingSenators,2);
assert.equal(ledger.scope.shortFirstPartyStatements,17);
assert.equal(ledger.scope.trueServiceDenominator2021To2025,95);
assert.equal(ledger.scope.exactOldAuthorPostedDateNeverInferred,true);
assert.equal(ledger.scope.hawj2020PastWorkClaimsAreUnverifiedSelfReports,true);
assert.equal(ledger.scope.hawj2022CommunityPrioritiesNotUnconditionalPersonalPledges,true);
assert.equal(ledger.scope.notEntireHistoricWebsiteCensus,true);
assert.equal(ledger.scope.archiveFailuresNeverProveNoPolicy,true);
assert.equal(ledger.scope.productionEvidenceRowsAdded,0);
assert.equal(ledger.scope.forecastOrTrainingChanges,0);
assert.equal(ledger.pages.length,3);
assert.equal(ledger.excerpts.length,17);
const dir=arg('--original-acquisition-dir');
const manifest=JSON.parse(read(join(dir,'five-actual-senator-new-original-archive-source-recovery.json')).toString('utf8'));
assert.equal(manifest.schema,'mn-2020-22-five-uncovered-actual-senators-six-wayback-domain-windows-v1');
assert.equal(manifest.fullOriginalGovernmentSha256,govExpected);
assert.equal(manifest.actualStateSenatorPeopleProvenBeforeNetwork,5);
assert.equal(manifest.queryWindows,6);
assert.equal(manifest.policyPositionExcerptsAutomaticallyAdmitted,0);
assert.equal(manifest.productionDatabaseReadsWritesOrForecastChanges,0);
assert.equal(manifest.sourceWindows.length,6);
const families=new Set(['health_care','drug_affordability','paid_leave','clean_energy','public_education','infrastructure','gun_safety','criminal_justice','public_safety','tax_policy','affordable_housing','employment','climate','economic_equity']);
const sourceKinds=new Map([
 ['carlson-2020-issues','first_party_2020_election_issue_platform'],
 ['hawj-2022-reelection','2022_first_party_candidate_reelection_letter'],
 ['hawj-2020-reused-older','older_cycle_reelection_past_work_copy_observable_by_2020_capture']
]);
const pageContent=new Map(),originalProof=[];
for(const p of ledger.pages){
 assert.equal(p.pageKind,sourceKinds.get(p.id),'Source page classification not allowed');
 assert.equal(p.firstAuthoredDateProven,false);
 assert.ok(['Jim Carlson','Foung Hawj'].includes(p.person));
 assert.ok([2020,2022].includes(p.electionYear));
 assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(p.archiveCaptureUtc));
 const electionCutoff=p.electionYear===2020?'2020-11-03T00:00:00.000Z':'2022-11-08T00:00:00.000Z';
 assert.ok(p.archiveCaptureUtc<electionCutoff,'Post-election source cannot prove earlier election availability');
 const service=validateActualSenateServiceForElection(official,p.person,p.district,p.electionYear);
 assert.equal(service.status,'verified_senate_service',p.person);
 assert.equal(service.serviceForThisElectionFollowingYearVerified,true,p.person);
 assert.ok(p.person==='Jim Carlson'?p.district==='51':p.district==='67');
 const window=manifest.sourceWindows.find(w=>w.sourceIndexFilename===p.sourceWindowFile);
 assert.ok(window,'Must reopen the independent complete original CDX for '+p.id);
 assert.equal(window.indexError,null);
 assert.equal(window.requestHttpStatus,200);
 assert.equal(window.responseBodySHA256,p.sourceIndexSha256);
 assert.equal(window.domain,new URL(p.originalUrl).hostname.replace(/^www\./,''));
 const index=read(join(dir,p.sourceWindowFile));
 assert.equal(sha(index),p.sourceIndexSha256);
 const fullRows=JSON.parse(index.toString('utf8'));
 assert.deepEqual(fullRows[0],['timestamp','original','mimetype','statuscode','digest','length']);
 assert.equal(fullRows.length-1,window.originalRows,'Original full CDX index row count mismatch');
 const timestamp=p.archiveCaptureUtc.replace(/\D/g,'').slice(0,14);
 const matching=fullRows.slice(1).filter(r=>r[0]===timestamp&&r[1]===p.originalUrl&&r[4]===p.archiveCdxSha1Base32
   &&r[3]==='200'&&r[2]==='text/html');
 assert.equal(matching.length,1,'Expected exact independently sourced CDX proof for '+p.id);
 const replay=window.originalReplays.find(r=>r.sourceFile===p.originalSourceFile);
 assert.ok(replay&&replay.fullOriginalByteDigestMatchesSeparateOriginalCdx===true&&replay.requestHttpStatus===200);
 assert.equal(replay.waybackCaptureUtc,p.archiveCaptureUtc);
 assert.equal(replay.originalFirstPartyURL,p.originalUrl);
 assert.equal(replay.responseBodySHA256,p.htmlSha256);
 assert.equal(replay.originalIndexedWaybackCDXSha1Base32,p.archiveCdxSha1Base32);
 const html=read(join(dir,p.originalSourceFile),1500);
 assert.equal(sha(html),p.htmlSha256);
 assert.equal(historicalArchiveSha1Base32(html),p.archiveCdxSha1Base32);
 const visible=originalCampaignVisibleText(html);
 assert.ok(visible.includes(p.committeeAttributionText),'Candidate paid-for footer absent');
 if(p.id==='carlson-2020-issues')assert.ok(visible.includes('Issues All Minnesotans should have the health care'));
 if(p.id==='hawj-2022-reelection')assert.ok(visible.includes('I am excited to seek reelection'));
 if(p.id==='hawj-2020-reused-older')assert.ok(visible.includes('Thank you for re-electing me to serve a second term'));
 pageContent.set(p.id,visible);
 originalProof.push({pageId:p.id,person:service.officialName,sourceKind:p.pageKind,
  originalUrl:p.originalUrl,archivePublicByUtc:p.archiveCaptureUtc,originalHtmlSha256:sha(html),
  sourceWaybackOriginalCdxSha1Base32:historicalArchiveSha1Base32(html),
  fullIndependentWaybackCdxSHA256:sha(index),sourceHtmlLength:html.length,
  originalPageBytesAndIndependentCdxBothReopenedAndMatched:true});
}
const uniquePersons=new Set(ledger.pages.map(p=>p.person));
assert.equal(uniquePersons.size,2);
const seenIds=new Set(),seenWords=new Set(),quoteProof=[];
for(const q of ledger.excerpts){
 assert.ok(!seenIds.has(q.id),'Duplicate excerpt identity');
 seenIds.add(q.id);
 assert.ok(families.has(q.issueFamily));
 assert.ok(!seenWords.has(q.exactShortExcerpt),'Overlapping duplicate short quote');
 seenWords.add(q.exactShortExcerpt);
 const page=ledger.pages.find(p=>p.id===q.pageId);
 assert.ok(page,'Excerpt refers to an unverified original source page');
 assert.ok(q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130);
 assert.ok(pageContent.get(page.id).includes(q.exactShortExcerpt),'Exact short quote not in full original HTML');
 const kind=page.id==='carlson-2020-issues'?'candidate_platform_policy'
  :page.id==='hawj-2020-reused-older'?'older_retained_candidate_past_work_self_report'
  :q.id==='hawj-2022-07'||q.id==='hawj-2022-08'
   ?'candidate_letter_first_person_action':'candidate_letter_community_priority';
 assert.equal(q.attributionClass,kind,'Do not turn community priorities into personal pledges');
 assert.equal(q.firstAuthoredDateKnown,false);
 assert.equal(q.officialLegislativeActionVerified,false);
 assert.equal(q.automaticallyEligibleForForecast,false);
 quoteProof.push({id:q.id,pageId:q.pageId,issue:q.issueFamily,excerptSha256:sha(Buffer.from(q.exactShortExcerpt,'utf8')),
  sourceCaptureUtc:page.archiveCaptureUtc,independentOriginalPageBytesAndCdxMatched:true,
  exactOriginalHtmlVisibleExcerptPresent:true,attributionClass:kind,authoredOnNotInferred:true});
}
assert.equal(quoteProof.length,17);
assert.equal(quoteProof.filter(q=>q.pageId==='carlson-2020-issues').length,8);
assert.equal(quoteProof.filter(q=>q.pageId==='hawj-2022-reelection').length,8);
assert.equal(quoteProof.filter(q=>q.pageId==='hawj-2020-reused-older').length,1);
const report={schema:'mn-carlson-hawj-17-exact-original-first-party-source-independent-proof-v1',
 verifiedActualServingSenators:2,originalFullGovernmentSourceSHA256:sha(gov),
 fullIndependentOriginalCdxIndexesReopened:3,originalFullArchivedHtmlSourcesReopened:3,
 exactDistinctFirstPartyShortExcerptsReauthenticated:17,sourceAcquisitionRun:sourceRun,
 originalSourceArtifactId:sourceArtifact,sourceAuditUtc:new Date().toISOString(),
 originalAuthorPublishedTimeProven:false,2020HawjOldCycleLanguageNotReclassified:true,
 Hawj2022CommunityPrioritiesNotSameAsPromise:true,
 authenticOriginalArchivedPages:originalProof,exactQuoteProof:quoteProof,
 researchOnly:true,productionEvidenceRowsWritten:0,forecastsOrModelsModified:0};
const out=arg('--output-json');
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('FIRST PARTY CARLSON HAWJ 17 EXACT ORIGINAL EXCERPTS INDEPENDENTLY AUTHENTICATED '+JSON.stringify({
 senatorPeople:2,originalFullHtml:3,entireOriginalCDX:3,exactShortExcerpts:17,productionChanges:0}));
