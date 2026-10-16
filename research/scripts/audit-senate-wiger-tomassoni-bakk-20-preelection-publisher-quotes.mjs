/**
 * Issue #864 — independently reopen three full original 2020 pre-election
 * publisher pages and entire Wayback original CDX. Check direct named quote
 * speaker regions for Wiger / Tomassoni / Bakk. PUBLISHER source, not
 * Senator-owned candidate committee site nor official vote evidence.
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
const govSHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const argv=process.argv.slice(2);
function arg(k){const i=argv.indexOf(k);assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing '+k);return resolve(argv[i+1]);}
function full(p,min=50,max=6500000){const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'Original missing '+p);return readFileSync(p);}
const gov=full(arg('--official-html'),9000),receipt=JSON.parse(full(arg('--official-receipt')).toString()),swear=full(arg('--official-special-swearing-html'),9000);
assert.equal(sha(gov),govSHA);
assert.equal(receipt.source.sourceBytesSha256,govSHA);
assert.equal(receipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(sha(swear),receipt.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(gov,receipt.source.observedAt,swear,receipt.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const ledger=JSON.parse(full(resolve('data/evaluation/senate-wiger-tomassoni-bakk-2020-original-publisher-20-excerpts-v1.json'),1000,75000).toString());
assert.equal(ledger.schema,'mn-three-2020-preelection-publisher-original-20-senator-quoted-excerpts-v1');
const scope=ledger.scope;
assert.equal(scope.issue,864);
assert.equal(scope.officialTrueServingSenatorPopulation,95);
assert.equal(scope.priorOriginalCandidateOwnedSiteCoveragePeople,90);
assert.equal(scope.originalCandidateSiteCoverageIncrease,0);
assert.equal(scope.originalCandidateSiteResearchExcerptIncrease,0);
assert.equal(scope.sourceAcquisitionWorkflowRun,38196317659);
assert.equal(scope.fullOriginalPublisherHTMLPages,3);
assert.equal(scope.independentWholeOriginalCdxIndexes,3);
assert.equal(scope.originalDirectSpeakerFragments,20);
assert.equal(scope.authenticSourcePublisherNotSenatorOwnedWebsite,true);
assert.equal(scope.originalBeforeNov32020General,true);
assert.equal(scope.originalCapturedDateNotFirstAuthoredDate,true);
assert.equal(scope.TomBakk2008GovernorUnderConstructionSiteNot2020SenatePlatform,true);
assert.equal(scope.TomassoniOldCandidateDomainRepurposedSpamExcluded,true);
assert.equal(scope.allOfficialVotesAndBillsNeedSeparateOfficialVerification,true);
assert.equal(scope.automaticForecastIngestion,0);
assert.equal(scope.productionDbReadsWrites,0);
assert.equal(scope.modelTrainingScheduler2027Changes,0);
assert.equal(ledger.pages.length,3);assert.equal(ledger.excerpts.length,20);
const names=new Set(),originalText=new Map(),proof=[],indexes=new Set();
const roots={wiger:arg('--wiger-original-dir'),tomassoni:arg('--tomassoni-original-dir'),bakk:arg('--bakk-original-dir')};
for(const p of ledger.pages){
 const key=p.id.split('-')[0];
 assert.ok(roots[key]);
 assert.equal(p.historicalElectionYear,2020);
 assert.equal(p.notCandidateOwnedCampaignSite,true);
 assert.equal(p.originalPostDateUnknown,true);
 assert.equal(p.officialRollcallVoteNotVerified,true);
 assert.equal(p.forecastAutoEligible,false);
 assert.ok(p.originalPublicByUtc<'2020-11-03T00:00:00.000Z');
 assert.match(p.originalHtmlSha256,/^[a-f0-9]{64}$/);
 assert.match(p.originalCdxSha256,/^[a-f0-9]{64}$/);
 assert.match(p.originalIndexedSha1Base32,/^[A-Z2-7]{32}$/);
 const member=validateActualSenateServiceForElection(official,p.person,p.official2020District,2020);
 assert.equal(member.status,'verified_senate_service');
 assert.equal(member.officialName,p.officialName);
 assert.equal(member.serviceForThisElectionFollowingYearVerified,true);
 names.add(p.officialName);
 const source=JSON.parse(full(join(roots[key],'five-senator-'+key+'-historical-original-recovery.json')).toString());
 assert.equal(source.schema,'mn-senate-five-remaining-historical-original-site-and-direct-publisher-five-parallel-v1');
 assert.equal(source.person,p.person);
 assert.equal(source.actualSenateDistrict,p.official2020District);
 assert.equal(source.actualSenateServiceElectionYear,2020);
 assert.equal(source.originalLRLGovernmentFullSHA256,govSHA);
 assert.equal(source.prior90PersonSourceQuoteCoverageRawJSONSHA256,'b102b4bdc25386358474f00847f5ed9d89c03b3a4e5fd7eec8fa41f2e98103f0');
 assert.equal(source.siteQuoteResearchRowsAutomaticallyAdded,0);
 assert.equal(source.productionDatabaseReadsWrites,0);
 const hits=source.allSourceQueries.flatMap(q=>q.originalFullHTMLReplays
   .filter(replay=>replay.fullOriginalHTMLFile===p.originalHtmlFile)
   .map(replay=>({q,replay})));
 assert.equal(hits.length,1,'Exactly one independently recorded original publisher replay required');
 const {q,replay}=hits[0];
 assert.equal(q.originalSiteHypothesisKind,'publisher_or_caucus_not_candidate_owned_site');
 assert.equal(q.originalEntireCdxSHA256,p.originalCdxSha256);
 assert.equal(q.originalCdxFile,p.originalCdxFile);
 assert.equal(replay.originalURL,p.originalUrl);
 assert.equal(replay.captureUTC,p.originalPublicByUtc);
 assert.equal(replay.originalIndexedSHA1Base32,p.originalIndexedSha1Base32);
 assert.equal(replay.fullOriginalResponseSha256,p.originalHtmlSha256);
 assert.equal(replay.fullBytesMatchOriginalIndependentArchiveIndex,true);
 assert.equal(replay.replayHTTPStatus,200);
 const rawIndex=full(join(roots[key],p.originalCdxFile),100);
 assert.equal(sha(rawIndex),p.originalCdxSha256);
 const rows=JSON.parse(rawIndex.toString());
 assert.deepEqual(rows[0],['timestamp','original','mimetype','statuscode','digest','length']);
 assert.equal(rows.length-1,q.originalIndexRows);
 const stamp=p.originalPublicByUtc.replace(/[^0-9]/g,'').slice(0,14);
 assert.equal(rows.slice(1).filter(r=>r[0]===stamp&&r[1]===p.originalUrl&&r[2]==='text/html'
  &&r[3]==='200'&&r[4]===p.originalIndexedSha1Base32).length,1,
  'Original publisher page URL and capture byte-digest not found in full original CDX');
 indexes.add(p.originalCdxFile);
 const html=full(join(roots[key],p.originalHtmlFile),250);
 assert.equal(sha(html),p.originalHtmlSha256);
 assert.equal(historicalArchiveSha1Base32(html),p.originalIndexedSha1Base32);
 const text=originalCampaignVisibleText(html);
 const start=text.indexOf(p.namedSpeakerCue);
 assert.ok(start>=0,'Named original senator introduced in publisher page '+p.id);
 const after=text.slice(start);
 let end=-1;
 if(key==='wiger') end=after.indexOf('Senator Chuck Wiger Senate District 43');
 if(key==='tomassoni') end=after.indexOf('Senator David Tomassoni Senate District 6');
 if(key==='bakk') end=after.indexOf('Bakk said in a written statement.');
 assert.ok(end>100,'Direct original quoted first-person statement not reliably bounded '+p.id);
 const speakerRegion=after.slice(0,end);
 const directQuotes=[...speakerRegion.matchAll(/“([^”]+)”/g)].map(x=>x[1]);
 assert.ok(directQuotes.length>=1,'Original publisher must include named quoted text');
 originalText.set(p.id,{speakerRegion,directQuotes,p});
 proof.push({pageId:p.id,actuallyServedSenator:p.officialName,
  originalCdxWholeSHA256:sha(rawIndex),
  originalFullPublisherHTMLSHA256:sha(html),
  originalIndexedSHA1Base32:historicalArchiveSha1Base32(html),
  archivedByBefore2020GeneralUtc:p.originalPublicByUtc,
  namedSpeakerRegionExists:true,publisherNotCandidateOwnedSite:true,
  exactHistoricalFirstAuthorshipUnproven:true,
  officialSenateVoteNotConcluded:true});
}
assert.equal(names.size,3);assert.equal(originalText.size,3);assert.equal(indexes.size,3);
const excerptProof=[],seen=new Set(),counts=new Map();
for(const q of ledger.excerpts){
 assert.equal(q.speakerKind,'named_2020_senator_direct_statement_quoted_in_original_publisher_not_campaign_site');
 assert.equal(q.originalFirstAuthoredDateUnproven,true);
 assert.equal(q.officialVoteOrLegislativeActionUnconfirmed,true);
 assert.equal(q.eligibleForProductionForecast,false);
 assert.ok(q.exactShortSpeakerExcerpt.length>=8&&q.exactShortSpeakerExcerpt.length<=130);
 assert.match(q.issueFamily,/^[a-z_]+$/);
 assert.ok(!seen.has(q.exactShortSpeakerExcerpt));seen.add(q.exactShortSpeakerExcerpt);
 const source=originalText.get(q.pageId);
 assert.ok(source,'Original page source missing');
 assert.ok(source.speakerRegion.includes(q.exactShortSpeakerExcerpt),'Not inside exactly named senator original quote scope '+q.id);
 assert.ok(source.directQuotes.some(quote=>quote.includes(q.exactShortSpeakerExcerpt)),
  'Not inside authentic original directly quoted speech '+q.id);
 counts.set(q.pageId,(counts.get(q.pageId)||0)+1);
 excerptProof.push({id:q.id,originalPageId:q.pageId,originalQuotedSpeakerLiteralSHA256:sha(Buffer.from(q.exactShortSpeakerExcerpt)),
  originalPublisherSourceByteAndFullIndexAuthenticated:true,
  noAutomaticCampaignSiteOrForecastEligibility:true});
}
assert.equal(counts.get('wiger-2020-pre-general-original-publisher'),9);
assert.equal(counts.get('tomassoni-2020-pre-general-original-publisher'),7);
assert.equal(counts.get('bakk-2020-pre-general-original-publisher'),4);
assert.equal(excerptProof.length,20);
const audit={schema:'mn-three-2020-preelection-original-publisher-full-cdx-html-and-20-senator-quotes-proof-v1',
 issue:864,actualServingPeopleVerified:3,wholeIndependentOriginalCDXFilesRechecked:3,
 fullOriginalPublisherArchiveHtmlRechecked:3,exactDirectSenatorSpeakerExcerptsProven:20,
 politicianOwnedCandidateWebsiteResearchCoverageIncrement:0,
 officiallyVerifiedRollcallSenateVotes:0,productionDBReadsWritesAndModelForecastChanges:0,
 historicOriginalPages:proof,shortVerifiedPublisherSpeechResearchExcerpts:excerptProof};
const dest=arg('--output-json');mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(audit,null,2)+'\n',{flag:'wx'});
console.log('WIGER/TOMASSONI/BAKK ORIGINAL PREELECTION 20 PUBLISHER-SPOKEN QUOTES PROVEN '+JSON.stringify({
 senators:3,fullOriginalCDX:3,fullHTML:3,literalSpeakerQuotes:20,websiteCoverageNew:0,production:0}));
