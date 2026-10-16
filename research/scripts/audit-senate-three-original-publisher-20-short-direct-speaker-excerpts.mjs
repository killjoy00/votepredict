/**
 * #864 public archived ORIGINAL publisher named-speaker research receipts.
 * Verifies original whole MPR, Sahan Journal and Senate DFL HTML, entire
 * independent Wayback CDX URL+UTC+SHA1 and the original speaker sections.
 * Candidate direct publisher quotes are NOT candidate-owned site evidence.
 * Pha 2022 and Tomassoni 2020 materials POSTDATE respective elections;
 * no retroactive forecast or official Senate votes are established.
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
const govSha='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const opts=process.argv.slice(2);
function arg(s){const i=opts.indexOf(s);assert.ok(i>=0&&opts[i+1]&&!opts[i+1].startsWith('--'),'Missing '+s);return resolve(opts[i+1]);}
function full(p,min=50,max=6000000){const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'Missing full archived original '+p);return readFileSync(p);}
const directoryRaw=full(arg('--official-html'),9000),receipt=JSON.parse(full(arg('--official-receipt')).toString()),
 swearing=full(arg('--official-special-swearing-html'),9000);
assert.equal(sha(directoryRaw),govSha);assert.equal(receipt.source.sourceBytesSha256,govSha);
assert.equal(sha(swearing),receipt.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(directoryRaw,receipt.source.observedAt,
 swearing,receipt.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const ledger=JSON.parse(full(resolve('data/evaluation/senate-three-original-publisher-direct-speech-20-excerpts-v1.json'),2000,100000).toString());
assert.equal(ledger.schema,'mn-senate-three-original-archived-publisher-attributed-speaker-20-exact-short-quotes-v1');
const s=ledger.scope;
assert.equal(s.issue,864);
assert.equal(s.actualServingStateSenators2021To2025,95);
assert.equal(s.originalCandidateOwnedWebsiteSourceCoverageUnaffected,true);
assert.equal(s.preexistingFirstPartySiteQuotedSenatorsBaselineAtAcquisition,87);
assert.equal(s.preexistingHistoricalFirstPartySiteExcerptRowsBaselineAtAcquisition,1140);
assert.equal(s.firstPartySiteCoverageIncrementFromThisIndependentPublisherLedger,0);
assert.equal(s.independentOriginalPublisherAcquisitionRun,38193981012);
assert.equal(s.originalPublisherRecentArtifactId,11722957357);
assert.equal(s.originalPublisherOlderArtifactId,11722646920);
assert.equal(s.entirePublisherHTMLOriginalsIndependentlyCrosschecked,3);
assert.equal(s.separatePublisherOriginalCDXIndexes,3);
assert.equal(s.distinctNamedActualSenatorSpeakerTurns,3);
assert.equal(s.exactShortFirstPersonExcerpts,20);
assert.equal(s.doronPublicByBeforeJanuary282025SpecialElection,true);
assert.equal(s.phaOriginalNov2022AfterNov8Election,true);
assert.equal(s.tomassoniOriginalNov2020AfterNov3Election,true);
assert.equal(s.historicPublisherClaimDateNotOriginalFirstAuthoredDate,true);
assert.equal(s.noAutomaticForecastVoteEligibility,true);
assert.equal(s.sourceIsPublisherHostedNotCandidateWebsite,true);
assert.equal(s.original2022PhaDuplicateHTMLVersionsNotDoubleCounted,true);
assert.equal(s.noAutomaticOfficialVoteProof,true);
assert.equal(s.productionDatabaseReadsWrites,0);
assert.equal(s.modelForecastTrainingScheduler2027Changes,0);
assert.equal(ledger.pages.length,3);assert.equal(ledger.excerpts.length,20);
const roots={recent:arg('--publisher-recent-original-dir'),older:arg('--publisher-older-original-dir')};
const sourceManifest={};
for(const kind of Object.keys(roots)){
 const d=JSON.parse(full(join(roots[kind],'historical-publisher-'+kind+'-original-evidence-recovery.json')).toString());
 assert.equal(d.schema,'mn-eight-unobserved-separate-public-attributed-publisher-archive-tracks-v1');
 assert.equal(d.track,kind);
 assert.equal(d.originalFullGovernmentLRLSHA256,govSha);
 assert.equal(d.independentOriginal87of95CampaignSiteCoverageSHA256,
  'a59826f30bd46fd955d9136091ae18c00977351f2420f1f55819264a15f68713');
 assert.equal(d.distinctHistoricalPublisherSources,kind==='recent'?2:5);
 assert.equal(d.publisherArticlesNotCandidateCampaignWebsites,true);
 assert.equal(d.automaticallyNewCandidateCampaignSiteQuotes,0);
 assert.equal(d.postVotePublicationNeverRetroactivelyPredictsVote,true);
 assert.equal(d.originalArchivedCaptureNotFirstPublishedDate,true);
 assert.equal(d.productionDatabaseReadsWrites,0);
 sourceManifest[kind]=d;
}
const provenOriginalSections=new Map(),cdxHashes=new Map(),verifiedPeople=new Set(),proof=[];
for(const p of ledger.pages){
 assert.equal(p.candidateCampaignWebsiteOriginal,false);
 assert.equal(p.originalFirstAuthoredDateProven,false);
 assert.equal(p.officialRollCallProven,false);
 assert.equal(p.automaticallyEligibleForForecast,false);
 assert.equal(p.sourceKind,'firstperson_named_speaker_in_independently_original_archived_publisher_HTML_NOT_candidate_owned_campaign_site');
 const year=p.person==='Doron Clark'?2025:p.person==='Susan Pha'?2022:2020;
 const member=validateActualSenateServiceForElection(official,p.person,p.senateDistrict,year);
 assert.equal(member.status,'verified_senate_service');
 assert.equal(member.officialName,p.officialSenatorName);
 assert.equal(member.serviceForThisElectionFollowingYearVerified,true);
 verifiedPeople.add(member.officialName);
 const original=sourceManifest[p.sourceGroup].sources.filter(q=>
  q.sourceReplays.some(z=>z.fullOriginalFile===p.originalHtmlFile));
 assert.equal(original.length,1,'Original published source identity must be present exactly once');
 const acquisition=original[0];
 assert.equal(acquisition.person,p.person);
 assert.equal(acquisition.publisherDate,p.articleClaimDate);
 assert.equal(acquisition.publisherHostedNotCandidateOwnedSite,true);
 const replay=acquisition.sourceReplays.filter(z=>z.fullOriginalFile===p.originalHtmlFile);
 assert.equal(replay.length,1);
 assert.equal(replay[0].originalURL,p.originalURL);
 assert.equal(replay[0].captureUTC,p.publicByUTC);
 assert.equal(replay[0].fullHTMLSHA256,p.originalRawHtmlSha256);
 assert.equal(replay[0].originalIndexedSHA1Base32,p.originalCdxSha1Base32);
 assert.equal(replay[0].fullOriginalMatchesIndependentIndex,true);
 assert.equal(replay[0].replayHTTPStatus,200);
 assert.equal(acquisition.originalIndexSHA256,p.originalWholeCdxSha256);
 assert.equal(acquisition.originalFullCDXFile,p.originalCdxFile);
 let rows=cdxHashes.get(p.originalCdxFile);
 if(!rows){
  const cdxBytes=full(join(roots[p.sourceGroup],p.originalCdxFile),80);
  assert.equal(sha(cdxBytes),p.originalWholeCdxSha256);
  rows=JSON.parse(cdxBytes.toString());
  assert.deepEqual(rows[0],['timestamp','original','mimetype','statuscode','digest','length']);
  assert.equal(rows.length-1,acquisition.indexRows);
  cdxHashes.set(p.originalCdxFile,rows);
 }
 const timestamp=p.publicByUTC.replace(/[^0-9]/g,'').slice(0,14);
 assert.equal(rows.slice(1).filter(r=>r[0]===timestamp&&r[1]===p.originalURL
  &&r[2]==='text/html'&&r[3]==='200'&&r[4]===p.originalCdxSha1Base32).length,1,
  'Full original independent archive CDX lacks exact URL capture and indexed digest');
 const bytes=full(join(roots[p.sourceGroup],p.originalHtmlFile),200);
 assert.equal(sha(bytes),p.originalRawHtmlSha256);
 assert.equal(historicalArchiveSha1Base32(bytes),p.originalCdxSha1Base32);
 const visible=originalCampaignVisibleText(bytes);
 const start=visible.indexOf(p.historicalNamedCandidateSectionStart);
 assert.ok(start>=0,'Missing named speaker start '+p.id);
 const end=visible.indexOf(p.historicalNamedCandidateSectionEnd,start+p.historicalNamedCandidateSectionStart.length);
 assert.ok(end>start,'Missing named speaker end '+p.id);
 const quoteRegion=visible.slice(start,end);
 const directQuotes=[...quoteRegion.matchAll(/“([^”]+)”/g)].map(x=>x[1]);
 assert.ok(directQuotes.length>=2,'Not enough directly quoted speaker paragraphs '+p.id);
 assert.ok(p.publicByUTC.slice(0,10)>=p.articleClaimDate,'Archive original predates claimed article publication date');
 const afterVote=p.publicByUTC.slice(0,10)>p.sourceElection;
 if(p.person==='Doron Clark'){
  assert.equal(afterVote,false);
  assert.equal(p.sourceElectionRelation,'direct_candidate_quotes_before_special_election_but_not_candidate_owned_site');
  assert.ok(quoteRegion.includes('Doron Clark, DFL'));
 }else if(p.person==='Susan Pha'){
  assert.equal(afterVote,true);
  assert.equal(p.sourceElectionRelation,'2022_senator_elect_interview_after_general_election_before_2023_sworn_no_retroactive_2022_prediction');
  assert.ok(quoteRegion.includes('Susan Pha never really cared for politics.'));
 }else{
  assert.equal(p.person,'David Tomassoni');
  assert.equal(afterVote,true);
  assert.equal(p.sourceElectionRelation,'2020_official_Senate_presidency_first_person_statement_AFTER_Nov3_general_not_campaign_promise');
  assert.ok(quoteRegion.includes('Senator Tomassoni released the following statement:'));
 }
 provenOriginalSections.set(p.id,{quoteRegion,directQuotes,p,afterVote});
 proof.push({pageId:p.id,officialTrueSenateService:member.officialName,
  originalPublisher:p.originalPublisher,publisherNotOwnedCampaignWebsite:true,
  articleClaimDateNotOriginalFirstAuthoredDate:p.articleClaimDate,originalPublicByUTC:p.publicByUTC,
  afterElectionForThisPriorVote:afterVote,wholeOriginalHTMLSHA256:sha(bytes),
  originalEntireWaybackCDXSHA256:p.originalWholeCdxSha256,
  originalSourceIndexedSHA1Base32:p.originalCdxSha1Base32,
  completeOriginalSourceAuthentic:true,namedDirectSpeakerSectionIsolated:true});
}
assert.equal(verifiedPeople.size,3);assert.equal(provenOriginalSections.size,3);assert.equal(cdxHashes.size,3);
const seen=new Set(),speakerProof=[],perPage=new Map();
for(const q of ledger.excerpts){
 const actual=provenOriginalSections.get(q.pageId);
 assert.ok(actual,'Missing direct original source speaker named section');
 assert.ok(!seen.has(q.exactOriginalSpeakerExcerpt));seen.add(q.exactOriginalSpeakerExcerpt);
 assert.ok(q.exactOriginalSpeakerExcerpt.length>=8&&q.exactOriginalSpeakerExcerpt.length<=130);
 assert.match(q.issueFamily,/^[a-z_]+$/);
 assert.equal(q.attributionClass,'exact_named_candidate_direct_quote_in_historical_publisher_HTML');
 assert.equal(q.originalSpeakerQuotedRegionVerified,true);
 assert.equal(q.firstAuthoredDateProven,false);
 assert.equal(q.officialSenateActionVerified,false);
 assert.equal(q.automaticallyEligibleForForecast,false);
 assert.ok(actual.quoteRegion.includes(q.exactOriginalSpeakerExcerpt),
  'Quote absent from original isolated named speaker section '+q.id);
 assert.ok(actual.directQuotes.some(fullSpeakerQuote=>fullSpeakerQuote.includes(q.exactOriginalSpeakerExcerpt)),
  'Quote absent from authentic direct first-person quoted paragraph '+q.id);
 perPage.set(q.pageId,(perPage.get(q.pageId)||0)+1);
 speakerProof.push({excerptId:q.id,publisherOriginalPageId:q.pageId,
  exactFirstPersonSourceShortExcerptSHA256:sha(Buffer.from(q.exactOriginalSpeakerExcerpt)),
  namedSpeakerExactOriginalHTMLVerified:true,afterElectionForReferencedVote:actual.afterVote,
  notOriginalCampaignWebsiteSource:true,automaticForecastEligibility:false});
}
assert.equal(speakerProof.length,20);
assert.equal(perPage.get('doron-mpr-jan2025-original-interview'),7);
assert.equal(perPage.get('pha-sahan-nov2022-original-interview'),7);
assert.equal(perPage.get('tomassoni-senatedfl-nov2020-original-statement'),6);
const result={schema:'mn-original-historic-publisher-3-senator-20-direct-original-quotes-verified-v1',
 actualServingStateSenatorPeopleReconfirmed:verifiedPeople.size,
 authenticOriginalPublisherEntireCDXIndexesReopened:cdxHashes.size,
 authenticWholePublisherHTMLReopened:proof.length,
 exactOriginalNamedSpeakerDirectQuotePassagesVerified:speakerProof.length,
 publisherSourceTypeNotCandidateOwnedCampaignWebsite:true,
 publisherNewCampaignWebsiteCoverageIncrement:0,
 pastVotesNotRetroactivelyPredicted:true,
 noOfficialLegislativeVoteEvidenceFromCandidateSpeech:true,
 productionReadsWritesOrForecastUpdates:0,pages:proof,exactShortQuotes:speakerProof};
const dest=arg('--output-json');mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log('VERIFIED 20 DISTINCT ORIGINAL ARCHIVED PUBLISHER NAMED SENATOR QUOTES '+JSON.stringify({
 persons:verifiedPeople.size,wholePublisherOriginals:proof.length,wholeOriginalIndexes:cdxHashes.size,
 shortLiteralPublisherSpeakerQuotes:speakerProof.length,campaignSiteCoverageIncrement:0,production:0}));
