/**
 * Issue #864 offline independent cross-provider provenance audit.
 * Reopen the actually downloaded original 2020 Common Crawl WARC gzip,
 * original independent CDXJ JSONL + raw Scott Newman campaign-owned homepage;
 * reconstruct exact WARC/HTTP boundaries, SHA1/Base32 and SHA256 receipts.
 * Reconcile authentic official LRL service and original MN SOS 2020 results,
 * then explicitly measure overlap with prior Wayback original excerpts.
 * Never promote original site coverage counts or new issue positions automatically.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readFileSync,mkdirSync,statSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {auditSos2020to2022OriginalGeneralCensus}
 from '../src/evidence/senate-2020-22-official-general-census.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const args=process.argv.slice(2);
function arg(k){const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+k);return resolve(args[i+1]);}
function get(p,min=20,max=10_000_000){const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'Original byte input invalid '+p);return readFileSync(p);}
const hash=b=>createHash('sha256').update(b).digest('hex');
const n=s=>String(s).normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
const receipt=JSON.parse(get(resolve('data/evaluation/senate-864-newman-2020-authenticated-original-commoncrawl-secondary-WARC-receipt-v1.json'),1200).toString());
assert.equal(receipt.schema,'senate-864-newman-independent-commoncrawl-2020-original-full-WARC-receipt-v1');
assert.equal(receipt.issue,864);
assert.equal(receipt.person,'Scott Newman');
assert.equal(receipt.officialName,'Scott J. Newman');
assert.equal(receipt.district,'18');
assert.equal(receipt.electionYear,2020);
assert.equal(receipt.websiteCoveredSenators,92);
assert.equal(receipt.selectedCandidateOwnedCampaignSiteShortResearchExcerptsAfter,1285);
assert.equal(receipt.rawOriginalProof.runId,38275506880);
assert.equal(receipt.rawOriginalProof.artifactId,11758783024);
assert.equal(receipt.productionDbReadWrites,0);
assert.equal(receipt.modelTrainingForecastChanges,0);
const gov=get(arg('--official-html'),9000),meta=JSON.parse(get(arg('--official-receipt'),700).toString()),swear=get(arg('--official-special-swearing-html'),9000);
assert.equal(hash(gov),receipt.originalGovernmentDirectoryHtmlSha256);
assert.equal(meta.source.sourceBytesSha256,hash(gov));
assert.equal(meta.supplementalSwearingSource.sourceBytesSha256,hash(swear));
const service=parseOfficialMnSenateServiceDirectory(gov,meta.source.observedAt,swear,meta.supplementalSwearingSource.observedAt);
assert.equal(service.senators.length,105);
const person=validateActualSenateServiceForElection(service,receipt.person,receipt.district,2020);
assert.equal(person.status,'verified_senate_service');assert.equal(person.officialName,receipt.officialName);
assert.equal(person.serviceForThisElectionFollowingYearVerified,true);
const sos=arg('--sos-original-dir');
const general=auditSos2020to2022OriginalGeneralCensus(2020,
 get(join(sos,'2020-sos-general-stsenate.response'),1000),get(join(sos,'2020-sos-general-cand.response'),1000));
assert.equal(general.source.originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence,true);
assert.equal(general.source.originalResultSha256,receipt.original2020OfficialSosStsenateSha256);
assert.equal(general.source.originalCandidateLookupSha256,receipt.original2020OfficialSosCandSha256);
assert.equal(general.totals.senateDistricts,67);assert.equal(general.totals.nonWriteinElectionWinnerCandidates,67);
const winning=general.candidates.filter(x=>x.district==='18'&&x.generalOutcome==='winner');
assert.equal(winning.length,1);assert.ok(winning[0].candidateName.toLowerCase().includes('newman'));
const baseline=JSON.parse(get(arg('--1285-matrix-json'),10000).toString());
assert.equal(baseline.summary.actualServingSenators,95);
assert.equal(baseline.summary.peopleWithAnyAuthenticatedOriginalSiteExcerpt,92);
assert.equal(baseline.summary.combinedSelectedOriginalCandidateOwnedSiteResearchExcerpts,1285);
const basePerson=baseline.byActuallyServedSenator.find(x=>x.officialName===receipt.officialName);
assert.ok(basePerson&&basePerson.selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound===2);
const priorLedger=JSON.parse(get(resolve('data/evaluation/senate-kiffmeyer-newman-kreun-four-original-historic-site-excerpts-v1.json'),1500).toString());
const old=priorLedger.pages.filter(x=>x.person==='Scott Newman');
assert.equal(old.length,1);
assert.equal(old[0].fullHTMLSHA256,receipt.previousIndependentlyWaybackAuthenticatedSameOriginalSenateCampaignHomepage.originalWholeHtmlSha256);
assert.equal(old[0].originalCdxSHA1Base32,receipt.previousIndependentlyWaybackAuthenticatedSameOriginalSenateCampaignHomepage.originalCdxSha1Base32);
const previousQuotes=priorLedger.excerpts.filter(x=>x.pageId===old[0].id);
assert.equal(previousQuotes.length,2);
const original=receipt.independentlyOriginalSourceProof;
assert.equal(original.historicalCommonCrawlCollection,'CC-MAIN-2020-29');
assert.ok(original.historicalCaptureUtc<'2020-11-03T00:00:00.000Z');
assert.equal(original.originalUrl,old[0].originalUrl);
const originalDir=arg('--newman-original-dir');
const record=get(join(originalDir,original.compressedEntireOriginalWarcRecordFilename),100);
const html=get(join(originalDir,original.sourceEntireHtmlFilename),200);
const cdxRaw=get(join(originalDir,original.wholeIndependentIndexJsonlFilename),80);
const probe=JSON.parse(get(join(originalDir,'senate-864-newman-independent-commoncrawl-sos-original-recovery-report.json'),300).toString());
assert.equal(probe.schema,'senate-864-independent-2020-22-commoncrawl-WARC-original-with-official-postvote-SOS-person-identity-v1');
assert.equal(probe.originalIndependent2020or2022OfficialGeneralSosBytesVerified,true);
assert.equal(probe.sourceOriginalCandidateSiteCoveredSenatorsBefore,92);
assert.equal(probe.sourceOriginalCandidateSiteSelectedResearchExcerptsBefore,1285);
assert.equal(probe.recoveredWholeOriginalWarcPages,1);
const page=probe.targets.find(x=>x.id==='newman-campaign-home');
assert.ok(page);
assert.equal(page.verifiedFullOriginalPages.length,1);
const pp=page.verifiedFullOriginalPages[0];
assert.equal(pp.originalIndexedPayloadSHA1Base32,original.independentlyIndexedCdxjDigestSha1Base32);
assert.equal(pp.wholeOriginalHtmlSHA256,original.originalFullHttpHtmlSha256);
assert.equal(pp.originalWarcRangeSHA256,original.originalCompressedWarcRangeSha256);
const ci=page.indexQueries.find(x=>x.collection===original.historicalCommonCrawlCollection);
assert.ok(ci&&ci.warcAttempt&&ci.warcAttempt.rangeMatchesExactCompressedWarcSource===true);
assert.equal(ci.warcAttempt.httpStatus,206);
assert.equal(ci.warcAttempt.warcReconstruction,'whole_warc_target_date_and_payload_digest_valid');
assert.equal(hash(record),original.originalCompressedWarcRangeSha256);
assert.equal(hash(html),original.originalFullHttpHtmlSha256);
assert.equal(historicalArchiveSha1Base32(html),original.independentlyIndexedCdxjDigestSha1Base32);
const lines=cdxRaw.toString('utf8').trim().split(/\r?\n/).map(s=>JSON.parse(s));
const ts=original.historicalCaptureUtc.replace(/\D/g,'').slice(0,14);
const matching=lines.filter(x=>x.url===original.originalUrl&&x.timestamp===ts&&x.digest===original.independentlyIndexedCdxjDigestSha1Base32
 &&x.status==='200'&&x.mime==='text/html'&&x.filename.startsWith('crawl-data/'+original.historicalCommonCrawlCollection+'/'));
assert.equal(matching.length,1);
assert.equal(Number(matching[0].length),record.length,'Downloaded compressed WARC bytes are not original independent index length');
assert.equal(ci.warcAttempt.requestedHttpByteRange,'bytes='+matching[0].offset+'-'+(Number(matching[0].offset)+record.length-1));
assert.equal(ci.warcAttempt.returnedLength,record.length);
const gz=gunzipSync(record,{maxOutputLength:10_000_000});
const separator=Buffer.from('\r\n\r\n'),at=gz.indexOf(separator);
assert.ok(at>40&&at<15000);
const headers=gz.subarray(0,at).toString('latin1');assert.match(headers,/^WARC\/1\.[01]\r\n/);
function h(key){return headers.match(new RegExp('(?:^|\\r\\n)'+key+':\\s*([^\\r\\n]+)','i'))?.[1]?.trim()||null;}
assert.equal(h('WARC-Type'),'response');
assert.equal(h('WARC-Target-URI'),original.originalUrl);
assert.equal(h('WARC-Payload-Digest')?.toUpperCase(),'SHA1:'+original.independentlyIndexedCdxjDigestSha1Base32);
assert.equal(h('WARC-Date')?.slice(0,19),original.historicalCaptureUtc.slice(0,19));
const start=at+separator.length,recordLength=Number(h('Content-Length'));
assert.ok(Number.isSafeInteger(recordLength)&&recordLength>=200&&recordLength<10_000_000);
const httpEnd=start+recordLength;
assert.ok(httpEnd<=gz.length);
const split=gz.indexOf(separator,start);
assert.ok(split>start&&split<start+30000&&split<httpEnd);
const httpHead=gz.subarray(start,split).toString('latin1');
assert.match(httpHead,/^HTTP\/1\.[01] 200(?:\s|\r)/);
assert.match(httpHead,/content-type:\s*text\/html/i);
assert.ok(/^(?:\r\n){0,4}$/.test(gz.subarray(httpEnd).toString('latin1')));
assert.ok(gz.subarray(split+separator.length,httpEnd).equals(html),'Independent WARC uncompressed raw original HTTP does not equal persisted original HTML');
const visible=n(originalCampaignVisibleText(html));
assert.ok(visible.includes('scott newman'),'Wrong 2020 original senator identity');
assert.ok(visible.includes('scott newman for senate'),'Missing owned campaign identity');
assert.ok(visible.includes('prepared and paid for by scott newman for senate committee'),'Missing original 2020 paid-for committee footer');
const previousExactQuotesInSecondProvider=previousQuotes.map(q=>({
 priorExactExcerpt:q.exactShortExcerpt,
 sourcePageId:q.pageId,
 sameShortExactExcerptFoundInNewIndependentCommonCrawlOriginal:visible.includes(n(q.exactShortExcerpt))
}));
const audit={schema:'senate-864-2020-newman-original-wayback-vs-commoncrawl-cross-provider-full-byte-audit-v1',issue:864,
 status:'whole_original_WARC_SHA1_and_HTML_SHA256_and_official_SOS_LRL_identity_verified',
 person:receipt.officialName,capturedOriginalSourceUtc:original.historicalCaptureUtc,
 originalUrl:original.originalUrl,
 independentSource:{originalWarcCompressedSHA256:hash(record),rawHttpHTMLSHA256:hash(html),
  commonCrawlIndependentIndexedSHA1Base32:historicalArchiveSha1Base32(html),
  originalCdxjIndexResponseSHA256:hash(cdxRaw),
  originalIndexLineMatched:true,
  originalHttp206AndContentRangeMatched:true,
  wholeOriginalWarcHttpContentLengthAndTrailerBoundariesMatched:true,
  originalCandidateSenateCommitteeIdentityMatched:true,
  originalSourceCapturedBefore2020GeneralElection:true},
 officialCrosscheck:{senateActualServiceVerified:true,originalMN2020Sos67DistrictWinnerCensusRehashed:true,
  originalSosWinnerName:winning[0].candidateName,senateDistrict:'18',
  originalSosCandidateFiledWebsiteFieldNotAvailable:true},
 secondaryArchiveCorroboration:{earlierWaybackOriginalArchivedUtc:old[0].historicOriginalArchivedUTC,
  earlierWaybackEntireHtmlSha256:old[0].fullHTMLSHA256,
  previousTwoSelectedBroadWebsiteQuotes:previousExactQuotesInSecondProvider,
  crossProviderOriginalSourceDifferenceDoesNotProveNewIssues:true},
 noSiteCoveragePersonIncrement:0,noOriginalSiteExcerptIncrement:0,
 originalOwnedCampaignSitePeopleRemain:92,originalWebsiteShortResearchExcerptsRemain:1285,
 alternativePublisherQuestionnaireSourcesOriginalsNotRecoveredHere:true,
 archivalDateObservedByNotFirstAuthored:true,notOfficialLegislativeRollCall:true,
 notProductionSourceDatabaseParityProof:true,productionDbReadWrites:0,forecastTrainingScoringChanges:0};
const out=arg('--out-dir');mkdirSync(out,{recursive:true});
writeFileSync(join(out,'senate-864-2020-newman-independent-wayback-commoncrawl-original-audit.json'),JSON.stringify(audit,null,2)+'\n',{flag:'wx'});
console.log('INDEPENDENT ORIGINAL 2020 NEWMAN SOURCE AUDIT '+JSON.stringify({
 officialService:true,sourceOriginalWebsiteCommittee:true,
 originalCCindexedWarcSHA1Matched:true,rawOriginalSiteSHA256:hash(html),
 originalCdxjEntireIndexSHA256:hash(cdxRaw),
 prior2WebsiteExcerptsFoundOnCommonCrawl:previousExactQuotesInSecondProvider.map(x=>x.sameShortExactExcerptFoundInNewIndependentCommonCrawlOriginal),
 newQuotesAdded:0,coveredActualSenators:92,selectedOriginalSiteFragments:1285,noModelOrDBChanges:true},null,2));
