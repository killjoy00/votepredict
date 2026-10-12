/**
 * #864 original three archived pre-election publisher source bodies:
 * independendently audit all 25 brief literal first-person actual-serving
 * senator fragments, exact archive CDX SHA1 original digest and government roster.
 * STRICTLY Category B publisher source: never a campaign-owned website count.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const argv=process.argv.slice(2);
function arg(k){const i=argv.indexOf(k);assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing '+k);return resolve(argv[i+1]);}
function original(path,min=30,max=7000000){const v=statSync(path);assert.ok(v.isFile()&&v.size>=min&&v.size<=max,'Original bytes absent '+path);return readFileSync(path);}
const sha=b=>createHash('sha256').update(b).digest('hex');
const gov=original(arg('--official-html'),9000),receipt=JSON.parse(original(arg('--official-receipt')).toString()),swear=original(arg('--official-special-swearing-html'),9000);
assert.equal(sha(gov),'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51');
assert.equal(receipt.source.sourceBytesSha256,sha(gov));
assert.equal(receipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(receipt.supplementalSwearingSource.sourceBytesSha256,sha(swear));
const officials=parseOfficialMnSenateServiceDirectory(gov,receipt.source.observedAt,swear,receipt.supplementalSwearingSource.observedAt);
assert.equal(officials.senators.length,105);
const covered=JSON.parse(original(arg('--coverage-json'),10000).toString());
assert.equal(covered.summary.actualServingStateSenators,95);
assert.equal(covered.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,92);
assert.equal(covered.summary.totalExactResearchExcerptRowsForVerifiedSenators,1194);
assert.equal(covered.summary.sourceOriginalGovernmentSHA256,sha(gov));
const previous=JSON.parse(original(resolve('data/evaluation/senate-wiger-tomassoni-bakk-2020-original-publisher-20-excerpts-v1.json'),1000).toString());
assert.equal(previous.excerpts.length,20);
const ledger=JSON.parse(original(resolve('data/evaluation/senate-bakk-tomassoni-wiger-25-original-publisher-direct-positions-v1.json'),1000).toString());
assert.equal(ledger.schema,'mn-bakk-tomassoni-wiger-25-original-firstperson-publisher-fragments-v1');
const scope=ledger.scope;
assert.equal(scope.issue,864);
assert.equal(scope.officialActual2021to2025ServingSenators,95);
assert.equal(scope.baselineAuthenticatedCandidateOwnedWebsitePeople,92);
assert.equal(scope.baselineShortAuthenticatedCandidateOwnedSiteExcerpts,1194);
assert.equal(scope.previousSpecificPublisherExcerptsFrom1188And1196,40);
assert.equal(scope.newAuthenticatedPublisherDirectSpeechExcerpts,25);
assert.equal(scope.publisherOriginalFullPages,3);
assert.equal(scope.publisherOriginalWholeCDXIndexes,3);
assert.equal(scope.sourceAcquisitionRun,38199484424);
assert.equal(scope.publisherNotCandidateOwnedWebsite,true);
assert.equal(scope.originalSiteCoverageIncrement,0);
assert.equal(scope.originalSiteResearchExcerptIncrement,0);
assert.equal(scope.bakkCampaignInterviewExact2020Original,true);
assert.equal(scope.tomassoniPipelineQuoteJanuary2020Original,true);
assert.equal(scope.wigerOlder2015SenateStatementNotSameElectionCyclePlatform,true);
assert.equal(scope.noAutomaticPredictionEligibility,true);
assert.equal(scope.productionDatabaseReadsWrites,0);
assert.equal(scope.forecastModelTrainingScheduler2027Changes,0);
assert.equal(ledger.pages.length,3);assert.equal(ledger.excerpts.length,25);
const roots={bakk:arg('--bakk-original-dir'),tomassoni:arg('--tomassoni-original-dir'),wiger:arg('--wiger-original-dir')};
const dates={bakk:'2020-10-08',tomassoni:'2020-01-31',wiger:'2015-05-19'};
const pageProof=[],speeches=new Map(),archiveNames=new Set();
const originalOwnedSiteQuotesUnchanged=92;
for(const page of ledger.pages){
 const key=page.id.split('-')[0],root=roots[key];
 assert.ok(root&&dates[key]);
 assert.equal(page.claimedArticlePublicationDate,dates[key]);
 assert.equal(page.candidateOwnedWebsite,false);
 assert.equal(page.eligibleForProductionForecast,false);
 assert.equal(page.originalTextResearchOnly,true);
 assert.equal(page.sourceStatementNotOfficialLegislativeVoteVerification,true);
 assert.equal(page.originalAuthorshipTimeBeyondCaptureNotIndependentlyEstablished,true);
 assert.equal(page.historicalElectionYear,2020);
 assert.ok(page.originalPublicByUtc<'2020-11-03T00:00:00.000Z');
 assert.ok(page.claimedArticlePublicationDate<'2020-11-03');
 assert.equal(page.independentAcquisitionRun,38199484424);
 assert.match(page.originalIndexedSha1Base32,/^[A-Z2-7]{32}$/);
 assert.match(page.originalHtmlSha256,/^[a-f0-9]{64}$/);
 assert.match(page.originalCdxSha256,/^[a-f0-9]{64}$/);
 const member=validateActualSenateServiceForElection(officials,page.person,page.officialSenateDistrict,2020);
 assert.equal(member.status,'verified_senate_service');assert.equal(member.officialName,page.officialName);
 assert.equal(member.serviceForThisElectionFollowingYearVerified,true);
 const provenance=JSON.parse(original(join(root,'senate-'+key+'-candidate-publisher-original-report-v1.json'),1000).toString());
 assert.equal(provenance.schema,'mn-senate-864-four-independently-original-publisher-evidence-research-v1');
 assert.equal(provenance.issue,864);assert.equal(provenance.track,key);
 assert.equal(provenance.person,page.person);
 assert.equal(provenance.originalGovernmentSHA256,sha(gov));
 assert.equal(provenance.coveredActuallyServing95,95);
 assert.equal(provenance.existingCandidateOwnedWebsitePersons,originalOwnedSiteQuotesUnchanged);
 assert.equal(provenance.existingCandidateOwnedSiteQuotes,1194);
 assert.equal(provenance.websiteCoverageIncrement,0);
 assert.equal(provenance.exactNewLiteralPublisherCandidateQuotesAdmitted,0);
 assert.equal(provenance.productionReadsWrites,0);
 const query=provenance.documentChecks[page.acquisitionReportSourceIndex];
 assert.ok(query&&query.originalPublisherDocumentPreElectionVerified===true);
 assert.equal(query.entireIndexFile,page.originalCdxFile);
 assert.equal(query.wholeIndexResponseSha256,page.originalCdxSha256);
 assert.equal(query.indexError,null);
 const found=query.replays.filter(r=>r.originalFullHTMLFile===page.originalHtmlFile&&r.rawIndexDigestMatchesFullResponse);
 assert.equal(found.length,1,'Exactly one original source replay must correspond to pinned page');
 const rec=found[0];
 assert.equal(rec.url,page.originalArchiveFullPublisherUrl);
 assert.equal(rec.originalCapturedUtc,page.originalPublicByUtc);
 assert.equal(rec.originalIndexedSHA1Base32,page.originalIndexedSha1Base32);
 assert.equal(rec.originalFullResponseSHA256,page.originalHtmlSha256);
 assert.equal(rec.replayStatus,200);
 const cdx=original(join(root,page.originalCdxFile),100);
 assert.equal(sha(cdx),page.originalCdxSha256);
 const rows=JSON.parse(cdx.toString());
 assert.deepEqual(rows[0],['timestamp','original','mimetype','statuscode','digest','length']);
 const stamp=page.originalPublicByUtc.replace(/[^0-9]/g,'').slice(0,14);
 assert.equal(rows.slice(1).filter(r=>r[0]===stamp&&r[1]===page.originalArchiveFullPublisherUrl&&r[2]==='text/html'&&r[3]==='200'&&r[4]===page.originalIndexedSha1Base32).length,1);
 archiveNames.add(page.originalCdxFile);
 const html=original(join(root,page.originalHtmlFile),500);
 assert.equal(sha(html),page.originalHtmlSha256);
 assert.equal(historicalArchiveSha1Base32(html),page.originalIndexedSha1Base32);
 const visible=originalCampaignVisibleText(html);
 assert.ok(visible.includes(page.namedSpeakerCue),'Original indexed whole body must identify correct speaker');
 let candidateBlocks=[];
 if(key==='bakk'){
  assert.ok(visible.includes('The following transcript has been edited for clarity'));
  assert.ok(visible.includes('Meet Senator Tom Bakk - DFL Candidate for Senate 3'));
  const paras=[...html.toString().matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m=>originalCampaignVisibleText(Buffer.from(m[1])));
  const begin=paras.findIndex(p=>p.includes('(Senator Tom Bakk) A:'));
  const finish=paras.findIndex((p,i)=>i>begin&&p.startsWith('Q: That is DFL Senator Tom Bakk'));
  assert.ok(begin>=0&&finish>begin+10,'KAXE interviewer/candidate Q/A structure must be intact');
  let inBakk=false;
  for(const p of paras.slice(begin,finish)){
   if(p.startsWith('Q: '))inBakk=false;
   if(p.startsWith('A: ')||p.includes('(Senator Tom Bakk) A:'))inBakk=true;
   if(inBakk)candidateBlocks.push(p);
  }
  assert.ok(candidateBlocks.length>=14,'Bakk direct original replies from verified interview required');
 } else if(key==='wiger'){
  const start=visible.indexOf(page.namedSpeakerCue);
  const end=visible.indexOf('Senator Chuck Wiger Senate District 43',start);
  assert.ok(end>start+400);
  const words=visible.slice(start,end);
  assert.ok(words.includes('“I am proud of the bill'));
  assert.ok(words.includes('be done as soon as possible.”'));
  candidateBlocks=[words];
 }else{
  const start=visible.indexOf('But Democratic Sen. David Tomassoni');
  const end=visible.indexOf('The commission will hear',start);
  assert.ok(start>=0&&end>start+120);
  const attr=visible.slice(start,end);
  assert.ok(attr.includes('Tomassoni said.'));
  candidateBlocks=[...attr.matchAll(/“([^”]+)”/g)].map(q=>q[1]);
  assert.equal(candidateBlocks.length,2,'Only literal quoted Tomassoni speaker content admissible');
 }
 speeches.set(page.id,{page,candidateBlocks});
 pageProof.push({pageId:page.id,officialName:page.officialName,
  originalCompletePublisherHTMLSha256:sha(html),entireOriginalCdxSHA256:sha(cdx),
  originalIndexedArchiveSHA1Base32:historicalArchiveSha1Base32(html),
  originalArchivedPreNov2020:true,directNamedCandidateSpeechRegionVerified:true,
  publisherNotCandidateOwnedSite:true,
  publisherClaimDateNotCertifiedFirstAuthoredTime:true,
  noIndependentProofOfOfficialVotes:true});
}
assert.equal(speeches.size,3);assert.equal(archiveNames.size,3);
const oldLiterals=new Set(previous.excerpts.map(x=>x.exactShortSpeakerExcerpt));
const seenLiteral=new Set(),seenIds=new Set(),rows=[];
const counts={bakk:0,tomassoni:0,wiger:0};
for(const item of ledger.excerpts){
 const entry=speeches.get(item.pageId);
 assert.ok(entry);
 const key=item.pageId.split('-')[0];
 assert.equal(item.attribution,'named_actual_serving_senator_original_firstperson_speech_on_independent_publisher');
 assert.equal(item.contemporaneousOffice,'Minnesota Senate');
 assert.equal(item.historicalPublicationDateNotFirstAuthored,true);
 assert.equal(item.legislativeVoteSelfReportNotOfficialVoteProof,true);
 assert.equal(item.eligibleForProductionForecast,false);
 assert.match(item.issueFamily,/^[a-z_]+$/);
 assert.ok(item.exactShortSpeakerExcerpt.length>=8&&item.exactShortSpeakerExcerpt.length<=130);
 assert.ok(!seenIds.has(item.id));seenIds.add(item.id);
 assert.ok(!seenLiteral.has(item.exactShortSpeakerExcerpt));seenLiteral.add(item.exactShortSpeakerExcerpt);
 assert.ok(!oldLiterals.has(item.exactShortSpeakerExcerpt),'Do not duplicate previously audited publisher excerpts');
 assert.ok(entry.candidateBlocks.some(b=>b.includes(item.exactShortSpeakerExcerpt)),
  'Literal fragment is not in directly attributed original speaker paragraph/quote: '+item.id);
 counts[key]++;
 rows.push({id:item.id,sourcePageId:item.pageId,sha256DirectOriginalSpeakerFragment:sha(Buffer.from(item.exactShortSpeakerExcerpt)),
  originalFullHTMLAndIndependentCDXReverified:true,quotedSenatorActualHistoricalServiceVerified:true,
  noAutomaticCandidateOwnedSiteOrPredictionEligibility:true});
}
assert.deepEqual(counts,{bakk:15,tomassoni:4,wiger:6});
assert.equal(rows.length,25);
const proof={schema:'mn-senate-864-three-complete-publisher-original-cdx-html-and-25-senator-quoted-fragments-proof-v1',
 issue:864,sourceAcquisitionRun:38199484424,officialWholeSourceSHA256:sha(gov),
 totalActual2021To2025ServingSenators:95,completeOriginalPublisherHTMLPages:3,
 independentCompleteOriginalPublisherCDX:3,shortLiteralDirectAttributedExcerptRows:25,
 perSenatorCounts:counts,candidateOwnedHistoricalWebsiteCoveragePriorAndPost:92,
 candidateOwnedWebsiteExactResearchExcerptsPriorAndPost:1194,
 verifiedOfficialLegislativeVotes:0,productionDbReadsWrites:0,
 noPredictionForecastOrModelUpdates:true,
 originals:pageProof,validatedDirectSpeakerExcerpts:rows};
const path=arg('--output-json');mkdirSync(dirname(path),{recursive:true});
writeFileSync(path,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log('INDEPENDENT ORIGINAL PUBLISHER 25 SHORT SPEAKER QUOTES PROVEN '+JSON.stringify({
 officialSenators:3,originalPublisherPages:3,wholeCdxIndexes:3,exactDirectOriginalQuotedFragments:25,
 bakk15:counts.bakk,wiger6:counts.wiger,tomassoni4:counts.tomassoni,
 historicCandidateOwnedSitePeopleUnchanged:92,originalSiteExcerptRowsUnchanged:1194,production:0}));
