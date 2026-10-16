/**
 * #864: independent full-original-source byte audit of 33 historically scoped
 * candidate-owned issue leads for Kiffmeyer (older House + Secretary of State),
 * Newman (actual 2020 Senate) and Kreun (2021 School Board, NOT 2022 Senate).
 * Only entire original Wayback CDX, independent SHA1 indexed historical HTML,
 * authentic committee identity and literal source text are admitted offline.
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
const expectedGov='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const args=process.argv.slice(2);
function arg(k){const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+k);return resolve(args[i+1]);}
function load(p,min=50,max=6500000){const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'Missing full original '+p);return readFileSync(p);}
const gov=load(arg('--official-html'),9000),receipt=JSON.parse(load(arg('--official-receipt')).toString()),
 swear=load(arg('--official-special-swearing-html'),9000);
assert.equal(sha(gov),expectedGov);assert.equal(receipt.source.sourceBytesSha256,expectedGov);
assert.equal(receipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(sha(swear),receipt.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(gov,receipt.source.observedAt,
 swear,receipt.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const ledger=JSON.parse(load(resolve('data/evaluation/senate-kiffmeyer-newman-kreun-four-original-historic-site-excerpts-v1.json'),2000,100000).toString());
assert.equal(ledger.schema,'mn-eight-unobserved-three-served-older-election-original-site-33-excerpts-v1');
const scope=ledger.scope;
assert.equal(scope.issue,864);
assert.equal(scope.officialActualServingSenatorPopulation,95);
assert.equal(scope.originalOfficialSenateServiceDirectorySha256,expectedGov);
assert.equal(scope.baselineResearchSenatorsWithOriginalSiteIssueLeads,87);
assert.equal(scope.baselineOriginalShortCandidateExcerpts,1140);
assert.equal(scope.parallelAcquisitionRun,38193297084);
assert.equal(scope.legacy2020SourceArtifactId,11722567112);
assert.equal(scope.recent2022SourceArtifactId,11722142765);
assert.equal(scope.newlyOriginalSiteQuotedActuallyServingPeople,3);
assert.equal(scope.originalCandidateOwnedFullHtmlPages,4);
assert.equal(scope.shortExactHistoricallyAttributedExcerpts,33);
assert.equal(scope.olderHouseAndSOSAndSchoolBoardSitesNot2020or2022SenateCampaignPledges,true);
assert.equal(scope.sourcePublicByCaptureDateNotFirstAuthored,true);
assert.equal(scope.broadSenateHomepageIssueSalienceNotSpecificLegislativePromise,true);
assert.equal(scope.originalSourceDomainIdentityFromAuthenticPaidForOrCandidateTitle,true);
assert.equal(scope.noOfficialSenateVotesVerified,true);
assert.equal(scope.noOriginalCampaignPlatformFullCensusClaim,true);
assert.equal(scope.failedArchiveIndexesNotEvidenceOfNoPolicies,true);
assert.equal(scope.productionDatabaseReadsWrites,0);
assert.equal(scope.forecastModelsEvidenceAutoImport,0);
assert.equal(ledger.pages.length,4);
assert.equal(ledger.excerpts.length,33);
const roots={legacy2020:arg('--legacy2020-source-dir'),recent2022:arg('--recent2022-source-dir')};
const acquisition={};
for(const name of Object.keys(roots)){
 const p=join(roots[name],'eight-senator-'+name+'-original-source-recovery.json');
 const doc=JSON.parse(load(p,2000).toString());
 assert.equal(doc.schema,'mn-senate-eight-originals-parallel-wayback-tracks-v1');
 assert.equal(doc.issue,864);
 assert.equal(doc.track,name);
 assert.equal(doc.originalGovernmentWholeLRLDirectorySHA256,expectedGov);
 assert.equal(doc.priorVerified95ActualSenatorCoverageSHA256,'a59826f30bd46fd955d9136091ae18c00977351f2420f1f55819264a15f68713');
 assert.equal(doc.originalSenatorPopulation,95);
 assert.equal(doc.originalSourceQuotedPeopleBeforeThisPass,87);
 assert.equal(doc.originalSiteShortResearchRowsBeforeThisPass,1140);
 assert.equal(doc.firstPartyQuoteLeadsAutomaticallyAdmitted,0);
 assert.equal(doc.officialSenateVotesVerified,0);
 assert.equal(doc.productionDatabaseReadsWrites,0);
 assert.equal(doc.modelForecastScheduler2027Changes,0);
 acquisition[name]=doc;
}
const indexHashes=new Map(),pageVisible=new Map(),serving=new Set(),originalProof=[];
for(const p of ledger.pages){
 assert.ok(!pageVisible.has(p.id),'Duplicate candidate original source page');
 assert.equal(p.originalFirstAuthoredDateProven,false);
 assert.equal(p.officialLegislativeVoteOrBillProven,false);
 assert.equal(p.automaticallyEligibleForForecast,false);
 assert.match(p.fullHTMLSHA256,/^[0-9a-f]{64}$/);
 assert.match(p.independentOriginalCDXSHA256,/^[0-9a-f]{64}$/);
 assert.match(p.originalCdxSHA1Base32,/^[A-Z2-7]{32}$/);
 const year=p.person==='Michael Kreun'?2022:2020;
 const member=validateActualSenateServiceForElection(official,p.person,p.stateSenateDistrict2020,year);
 assert.equal(member.status,'verified_senate_service',p.person);
 assert.equal(member.serviceForThisElectionFollowingYearVerified,true);
 assert.equal(member.officialName,p.officialSenatorName);
 serving.add(member.officialName);
 const all=acquisition[p.group].sourceWindows.flatMap(w=>w.authenticatedRawOriginalHtml
  .filter(r=>r.rawOriginalHTMLFile===p.htmlFile).map(r=>({w,r})));
 assert.equal(all.length,1,'Exact original must appear in independently captured source manifest');
 const {w,r}=all[0];
 assert.equal(w.person,p.person);
 assert.equal(w.originalArchiveIndexHTTPStatus,200);
 assert.equal(w.originalArchiveIndexResponseSHA256,p.independentOriginalCDXSHA256);
 assert.equal(w.wholeOriginalArchiveIndexFile,p.indexFile);
 assert.equal(r.indexedOriginalURL,p.originalUrl);
 assert.equal(r.originalPublicByUTC,p.historicOriginalArchivedUTC);
 assert.equal(r.indexedOriginalSHA1Base32,p.originalCdxSHA1Base32);
 assert.equal(r.fullResponseSHA256,p.fullHTMLSHA256);
 assert.equal(r.originalHTMLSHA1MatchesOriginalCDX,true);
 const target=(year===2022?'2022-11-08T00:00:00.000Z':'2020-11-03T00:00:00.000Z');
 assert.ok(p.historicOriginalArchivedUTC<target);
 const indexKey=p.group+'/'+p.indexFile;
 let rows=indexHashes.get(indexKey);
 if(!rows){
  const bytes=load(join(roots[p.group],p.indexFile),100);
  assert.equal(sha(bytes),p.independentOriginalCDXSHA256);
  rows=JSON.parse(bytes.toString());
  assert.deepEqual(rows[0],['timestamp','original','mimetype','statuscode','digest','length']);
  assert.equal(rows.length-1,w.archiveIndexRows);
  indexHashes.set(indexKey,rows);
 }
 const originalTimestamp=p.historicOriginalArchivedUTC.replace(/[^0-9]/g,'').slice(0,14);
 assert.equal(rows.slice(1).filter(v=>v[0]===originalTimestamp&&v[1]===p.originalUrl
  &&v[2]==='text/html'&&v[3]==='200'&&v[4]===p.originalCdxSHA1Base32).length,1,
 'Original page url, archived public-by timestamp and SHA1 MUST be in independent entire CDX');
 const html=load(join(roots[p.group],p.htmlFile),100);
 assert.equal(sha(html),p.fullHTMLSHA256);
 assert.equal(historicalArchiveSha1Base32(html),p.originalCdxSHA1Base32);
 const text=originalCampaignVisibleText(html);
 assert.ok(text.includes(p.candidateCampaignIdentityCue),
  'Original committee identity mismatch '+p.id);
 if(p.id==='kiffmeyer-2009-house16b-original-issues'){
  assert.equal(p.historicSourceOffice,'Minnesota House District 16B');
  assert.equal(p.originalSourceElectionContext,'2008_House_campaign_site_observable_2009_not_2020_Senate');
  assert.ok(text.includes('Mary Kiffmeyer for State Representative'));
 }else if(p.id==='kiffmeyer-2007-secretary-state-business-original'){
  assert.equal(p.historicSourceOffice,'Minnesota Secretary of State');
  assert.ok(p.originalSourceElectionContext.startsWith('older_Secretary_of_State'));
 }else if(p.id==='newman-2020-sd18-original-home'){
  assert.equal(p.historicSourceOffice,'Minnesota Senate District 18');
  assert.ok(text.includes('Scott Newman for Minnesota State Senate'));
 }else{
  assert.equal(p.id,'kreun-2021-schoolboard-original-home');
  assert.equal(p.historicSourceOffice,'Spring Lake Park School Board');
  assert.equal(p.originalSourceElectionContext,'2021_School_Board_re_election_not_2022_Senate_promise');
  assert.ok(text.includes('Michael Kreun for Spring Lake Park School Board'));
 }
 pageVisible.set(p.id,text);
 originalProof.push({id:p.id,officialServingSenator:p.officialSenatorName,
  actualHistoricalOffice:p.historicSourceOffice,originalPublicByUtc:p.historicOriginalArchivedUTC,
  completeOriginalArchiveCDXSHA256:p.independentOriginalCDXSHA256,
  originalIndexedSha1Base32:p.originalCdxSHA1Base32,
  entireOriginalHtmlSha256:sha(html),
  archivedOriginalHtmlMatchesEntireIndependentIndex:true,
  exactHistoricalCampaignIdentityChecked:true,originalFirstPublishedDateUnproven:true});
}
assert.equal(serving.size,3);
assert.equal(pageVisible.size,4);
assert.equal(indexHashes.size,3);
const idSet=new Set(),literalSet=new Set(),qProof=[],counts=new Map();
for(const q of ledger.excerpts){
 assert.ok(!idSet.has(q.id));idSet.add(q.id);
 assert.ok(!literalSet.has(q.exactShortExcerpt));literalSet.add(q.exactShortExcerpt);
 assert.ok(pageVisible.has(q.pageId));
 assert.ok(q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130);
 assert.match(q.issueFamily,/^[a-z_]+$/);
 assert.equal(q.firstAuthoredDateKnown,false);
 assert.equal(q.officialLegislativeActionVerified,false);
 assert.equal(q.eligibleForForecast,false);
 assert.ok(pageVisible.get(q.pageId).includes(q.exactShortExcerpt),
  'Exact original historically attributed quote is not present '+q.id);
 counts.set(q.pageId,(counts.get(q.pageId)||0)+1);
 qProof.push({id:q.id,pageId:q.pageId,literalExactShortExcerptSHA256:sha(Buffer.from(q.exactShortExcerpt)),
  fromOriginalIndexedHTML:true,notAutomaticallyForecastEvidence:true});
}
assert.equal(counts.get('kiffmeyer-2009-house16b-original-issues'),18);
assert.equal(counts.get('kiffmeyer-2007-secretary-state-business-original'),8);
assert.equal(counts.get('newman-2020-sd18-original-home'),2);
assert.equal(counts.get('kreun-2021-schoolboard-original-home'),5);
assert.equal(qProof.length,33);
const proof={schema:'mn-3-actual-senators-33-historical-office-scope-firstparty-original-source-proof-v1',
 issue:864,originalGovernmentServiceDirectorySha256:sha(gov),
 originalFullCDXIndexFilesIndependentlyReopened:indexHashes.size,
 wholeSHA1MatchedFullOriginalCandidateHTMLPages:originalProof.length,
 actualServingSenatorsVerified:serving.size,
 exactLiteralShortResearchExcerptsMatched:qProof.length,
 olderSecretaryOfStateAndHouseAndSchoolBoardNotSenatePositions:true,
 newmanHomepage2020GeneralPriorities:true,
 archivalFullSiteCensusNotAsserted:true,firstAuthorDatesUnproven:true,
 officialVoteAndForecastAutomaticallyEligible:0,productionDatabaseChanges:0,
 originals:originalProof,shortExcerpts:qProof};
const dest=arg('--output-json');mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log('3 SENATORS AND 33 LEGACY OFFICE-SCOPED ORIGINAL ISSUE EXCERPTS VERIFIED '+JSON.stringify({
 cdx:indexHashes.size,fullOriginalHTML:originalProof.length,actualSenators:serving.size,excerpts:qProof.length,production:0}));
