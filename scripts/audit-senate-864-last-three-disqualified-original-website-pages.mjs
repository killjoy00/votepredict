/**
 * #864 independently inspect complete actual historical original Wayback
 * HTML against exact whole CDX indexes, verify 2008 Tom Bakk site is for
 * Governor (not Senate) and 2019 Tomassoni-address site is unrelated SEO
 * content (not Senate campaign). Original source authenticity alone !=
 * candidate issue authenticity; independent negative classification.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
const args=process.argv.slice(2);
const a=k=>{const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+k);return resolve(args[i+1]);};
const original=p=>{const st=statSync(p);assert.ok(st.isFile()&&st.size>60&&st.size<8000000,'Required original missing: '+p);return readFileSync(p);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(original(resolve('data/evaluation/senate-864-bakk-governor-tomassoni-repurposed-site-original-disqualification-receipts-v1.json')).toString());
assert.equal(manifest.schema,'senate-864-three-final-site-gaps-independently-disqualified-original-archive-bodies-v1');
assert.equal(manifest.issue,864);
assert.equal(manifest.acquisitionRunId,38284822219);
assert.equal(manifest.originalPages.length,4);
const gov=original(a('--official-html')),govProof=JSON.parse(original(a('--official-receipt')).toString()),swear=original(a('--official-special-swearing-html'));
assert.equal(sha(gov),'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51');
assert.equal(govProof.source.sourceBytesSha256,sha(gov));
assert.equal(govProof.supplementalSwearingSource.sourceBytesSha256,sha(swear));
const directory=parseOfficialMnSenateServiceDirectory(gov,govProof.source.observedAt,swear,govProof.supplementalSwearingSource.observedAt);
assert.equal(directory.senators.length,105);
const baseline=JSON.parse(original(a('--baseline-1285-json')).toString());
assert.equal(baseline.summary.actualServingSenators,95);
assert.equal(baseline.summary.peopleWithAnyAuthenticatedOriginalSiteExcerpt,92);
assert.equal(baseline.summary.combinedSelectedOriginalCandidateOwnedSiteResearchExcerpts,1285);
const group={bakk:a('--bakk-dir'),tomassoni:a('--tomassoni-dir')};
const seen=new Set(),receipts=[];
for(const p of manifest.originalPages){
 assert.ok(group[p.track]&&p.sourceArtifactId===(p.track==='bakk'?11762593532:11763435134));
 assert.match(p.wholeOriginalHtmlSha256,/^[0-9a-f]{64}$/);
 assert.match(p.originalIndexedSha1Base32,/^[A-Z2-7]{32}$/);
 assert.ok(p.observedByUtc<'2020-11-03T00:00:00.000Z');
 const record=validateActualSenateServiceForElection(directory,p.person,p.track==='bakk'?'3':'6',2020);
 assert.equal(record.status,'verified_senate_service');
 assert.equal(record.officialName,p.officialName);
 assert.equal(record.serviceForThisElectionFollowingYearVerified,true);
 const originalCoverage=baseline.byActuallyServedSenator.find(x=>x.officialName===p.officialName);
 assert.ok(originalCoverage&&originalCoverage.selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound===0);
 const html=original(join(group[p.track],p.originalHtmlArtifactName));
 assert.equal(sha(html),p.wholeOriginalHtmlSha256,'Original entire HTML SHA256 mismatch');
 assert.equal(historicalArchiveSha1Base32(html),p.originalIndexedSha1Base32,'Whole original HTML does not match indexed CDX digest');
 const index=JSON.parse(original(join(group[p.track],p.wholeCdxIndexFile)).toString());
 assert.deepEqual(index[0],['timestamp','original','mimetype','statuscode','digest','length']);
 const ts=p.observedByUtc.replace(/\D/g,'').slice(0,14);
 assert.equal(index.slice(1).filter(x=>x[0]===ts&&x[1]===p.originalUrl&&x[2]==='text/html'&&x[3]==='200'&&x[4]===p.originalIndexedSha1Base32).length,1,
  'Original capture URL/date/SHA1 not independently indexed');
 const key=p.track+'|'+p.originalUrl+'|'+p.originalIndexedSha1Base32;
 assert.ok(!seen.has(key),'Duplicated original');
 seen.add(key);
 const text=originalCampaignVisibleText(html).toLowerCase();
 let disqualification;
 if(p.track==='bakk'){
  assert.ok(text.includes('tom bakk for governor'));
  assert.ok(text.includes("paid for by bakk - minnesota's next governor committee"));
  assert.ok(text.includes('governor'));
  disqualification='original_paid_for_governor_campaign_not_a_minneapolis_senate_or_minnesota_senate_campaign';
 }else{
  assert.ok(text.includes('free online printable receipts'));
  assert.ok(text.includes('tomassoni4senate'));
  assert.ok(!text.includes('david tomassoni'));
  assert.ok(!text.includes('dave tomassoni'));
  assert.ok(!/prepared.{0,50}paid for by.*tomassoni/.test(text));
  disqualification='unrelated_receipt_template_content_reusing_former_campaign_domain';
 }
 receipts.push({person:p.officialName,sourceUrl:p.originalUrl,capturedByUtc:p.observedByUtc,
  originalCDXIndexedSha1Base32:p.originalIndexedSha1Base32,originalWholeHtmlSha256:sha(html),
  verifiedCompleteOriginalCDXAndHtmlFingerprints:true,
  negativeProvenanceFinding:disqualification,
  candidateOwnedMinnesotaSenateCampaignWebsite:false,
  published2020CandidateIssuePolicyQuoteRows:0,
  sourceFullHTMLNotSavedInGit:true});
}
assert.equal(receipts.length,4);
assert.equal(receipts.filter(x=>x.person==='Thomas M. Bakk').length,2);
assert.equal(receipts.filter(x=>x.person==='David J. Tomassoni').length,2);
const result={schema:'senate-864-independent-whole-original-four-campaign-site-negative-source-audit-v1',
 issue:864,actualServingSenators:95,priorOriginalCandidateSiteCoveredPeople:92,priorSelectedOriginalCampaignSiteSnippets:1285,
 independentlyVerifiedWholeOriginalBodies:4,
 bakk2008GovernorSiteBodiesDisqualified:2,tomassoni2019UnrelatedReceiptSeoBodiesDisqualified:2,
 wigerGenuine2020OwnedSiteOriginalStillUnknown:true,
 originalCandidateOwnedSitePeopleIncrement:0,newOriginalCandidateIssueQuoteFragments:0,
 originalArchivedProviderMissingNoProofOfPolicyAbsence:true,
 archivedHistoricalDateNotFirstPostAuthoredDate:true,
 governmentLegislatorWebsitesAndPublisherInterviewsNeverCampaignOwned:true,
 noOfficialLegislativeRollCallCertifications:true,noProductionDbReadsWrites:0,noModelTrainingForecastOrDeploymentChanges:true,negativeEvidence:receipts};
const out=a('--out-dir');mkdirSync(out,{recursive:true});
writeFileSync(join(out,'senate-864-independent-bakk-governor-tomassoni-repurposed-original-site-disqualification-audit.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log('INDEPENDENT NEGATIVE SOURCE AUDIT '+JSON.stringify({wholeOriginalSHA1CdXVerified:receipts.length,governorNotSenateSite:2,
 unrelatedReusedTomassoniSEO:2,realSenateSitePeopleStill:92,candidateSiteSelectedQuotesStill:1285,productionChanges:0},null,2));
