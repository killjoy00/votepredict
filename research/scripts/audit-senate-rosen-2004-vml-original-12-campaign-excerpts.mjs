/**
 * #864: independently reopen Julie Rosen's authenticated March 2004 original
 * Senate District 24 website and its full original Wayback CDX; extract ONLY
 * historically browser-rendered Microsoft VML conditional HTML, not arbitrary
 * hidden comments or today's visible page. Source is 2004-observable, NEVER
 * a newly drafted 2020 Senate platform. No forecast, production or votes.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const governmentSha='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const options=process.argv.slice(2);
function arg(k){const i=options.indexOf(k);assert.ok(i>=0&&options[i+1]&&!options[i+1].startsWith('--'),'Missing '+k);return resolve(options[i+1]);}
function read(p,min=50,max=6000000){const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'Full original required '+p);return readFileSync(p);}
const gov=read(arg('--official-html'),9000);
const rec=JSON.parse(read(arg('--official-receipt')).toString());
const swearing=read(arg('--official-special-swearing-html'),9000);
assert.equal(hash(gov),governmentSha);
assert.equal(rec.source.sourceBytesSha256,governmentSha);
assert.equal(rec.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(hash(swearing),rec.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(gov,rec.source.observedAt,
 swearing,rec.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const ledger=JSON.parse(read(resolve('data/evaluation/senate-rosen-old-sd24-2004-legacy-vml-original-12-excerpts-v1.json')).toString());
assert.equal(ledger.schema,'mn-rosen-original-pre2004-vml-conditional-candidate-website-12-short-excerpts-v1');
const s=ledger.scope;
assert.equal(s.issue,864);
assert.equal(s.officialActuallyServedMinnesotaSenators2021to2025,95);
assert.equal(s.priorVerifiedSiteQuotedSenators,85);
assert.equal(s.priorVerifiedShortSourceResearchExcerpts,1093);
assert.equal(s.independentOriginalLRLServiceSha256,governmentSha);
assert.equal(s.originalAcquisitionActionRun,38186753218);
assert.equal(s.originalAcquisitionArtifactId,11719882698);
assert.equal(s.originalArchiveSourceFormat,'Internet_Explorer_VML_conditionally_rendered_legacy_text');
assert.equal(s.originalSiteHistoricalDistrict,'24');
assert.equal(s.officialServing2020SenateDistrict,'23');
assert.equal(s.originalCaptureOnlyPublicByDate,'2004-03-25T07:00:23.000Z');
assert.equal(s.capturedWebsiteFirstAuthorshipYearEstablished,false);
assert.equal(s.statementsNotReinterpretedAs2020SenateCampaignPledges,true);
assert.equal(s.conditionalVMLExtractedSeparatelyFromModernBrowserVisibleText,true);
assert.equal(s.officialVotesConfirmedFromCampaignClaims,0);
assert.equal(s.researchNotForecastEvidence,true);
assert.equal(s.noCompleteWebsiteCensusClaim,true);
assert.equal(s.productionDatabaseWrites,0);
assert.equal(s.modelsForecastsSchedulerChanges,0);
assert.equal(ledger.pages.length,1);
assert.equal(ledger.excerpts.length,12);
const p=ledger.pages[0];
assert.equal(p.id,'rosen-legacy-sd24-vml-2004-homepage');
assert.equal(p.person,'Julie Rosen');
assert.equal(p.officialOriginalGovernmentServiceName,'Julie A. Rosen');
assert.equal(p.originalSiteUrl,'http://julierosen.com:80/');
assert.equal(p.originalHistoricalDistrict,'24');
assert.equal(p.verified2020ServingDistrict,'23');
assert.equal(p.verified2020ElectionYear,2020);
assert.equal(p.archiveCaptureUtc,'2004-03-25T07:00:23.000Z');
assert.equal(p.campaignIdentityOutsideVML,'Senator Julie Rosen Home Page');
assert.equal(p.originalMarkup,'legacy_ie_conditional_vml_text_boxes');
assert.equal(p.firstAuthoredDateKnown,false);
assert.equal(p.officialVoteVerified,false);
assert.equal(p.forecastEligible,false);
assert.equal(p.originalFullHTMLSHA256,'16be70899907f95eadb522e65a5a39de0a60f53fc87b84e81650923aa69bb015');
assert.equal(p.independentOriginalFullCDXSHA256,'992a7550431545c3f4b4e4bca8fbf0569ad9d6f69cf6dc99a5b1678022e57816');
assert.equal(p.originalCDXSHA1Base32,'RZYILMCALWQDKL6ZFGCXNTB33ZVSRTN3');
const check=validateActualSenateServiceForElection(official,p.person,p.verified2020ServingDistrict,2020);
assert.equal(check.status,'verified_senate_service');
assert.equal(check.officialName,p.officialOriginalGovernmentServiceName);
assert.equal(check.serviceForThisElectionFollowingYearVerified,true);
const dir=arg('--last16-original-dir');
const manifest=JSON.parse(read(join(dir,'last16-targeted-candidate-original-archive-manifest.json')).toString());
assert.equal(manifest.schema,'mn-2021-25-last16-targeted-uncovered-original-site-64-archive-search-windows-v1');
assert.equal(manifest.independentGovernmentLRLSourceSha256,governmentSha);
assert.equal(manifest.baselineActualSenatorsWithAnyOriginalFirstPartyExcerpt,79);
assert.equal(manifest.baselineActualSenatorsUnobserved,16);
assert.equal(manifest.actualServingStateSenatorsVerifiedAgainstGovernmentBeforeArchiveNetwork,16);
const windows=manifest.originalSourceWindows.filter(w=>w.person==='Julie Rosen'
 &&w.originalHtmlReplays.some(r=>r.retainedRawOriginalHtml===p.originalRawCompleteHTMLFile));
assert.equal(windows.length,1);
const w=windows[0];
assert.equal(w.electionYear,2020);
assert.equal(w.originalOfficialElectionDistrict,'23');
assert.equal(w.indexHttpStatus,200);
assert.equal(w.indexRows,1);
assert.equal(w.indexCappedAt300,false);
assert.equal(w.fullOriginalCdxFilename,p.independentOriginalFullCDXFile);
assert.equal(w.fullOriginalCdxResponseSha256,p.independentOriginalFullCDXSHA256);
const originalIndexBytes=read(join(dir,p.independentOriginalFullCDXFile));
assert.equal(hash(originalIndexBytes),p.independentOriginalFullCDXSHA256);
const originalRows=JSON.parse(originalIndexBytes.toString());
assert.deepEqual(originalRows[0],['timestamp','original','mimetype','statuscode','digest','length']);
assert.equal(originalRows.length,2);
assert.deepEqual(originalRows[1].slice(0,5),
 ['20040325070023',p.originalSiteUrl,'text/html','200',p.originalCDXSHA1Base32]);
const replay=w.originalHtmlReplays.filter(r=>r.retainedRawOriginalHtml===p.originalRawCompleteHTMLFile);
assert.equal(replay.length,1);
assert.equal(replay[0].captureUtc,p.archiveCaptureUtc);
assert.equal(replay[0].fullResponseSha256,p.originalFullHTMLSHA256);
assert.equal(replay[0].originalCdxIndexedSha1Base32,p.originalCDXSHA1Base32);
assert.equal(replay[0].fullOriginalByteDigestMatchesSeparateOriginalCdx,true);
assert.equal(replay[0].replayHttpStatus,200);
const html=read(join(dir,p.originalRawCompleteHTMLFile),2000);
assert.equal(hash(html),p.originalFullHTMLSHA256,'Complete archived original SHA256 mismatch');
assert.equal(historicalArchiveSha1Base32(html),p.originalCDXSHA1Base32,
 'Entire original page bytes must match original independent 2004 Wayback CDX SHA1 Base32');
const raw=html.toString('utf8');
assert.ok(raw.includes('<title>Senator Julie Rosen Home Page</title>'));
const vml=[...raw.matchAll(/<!--\[if gte vml 1\]>([\s\S]*?)<!\[endif\]-->/gi)]
 .map(m=>m[1]);
assert.equal(vml.length,7,'Only independently identifiable IE VML-rendered text-box bodies may be extracted');
assert.ok(vml.every(block=>block.includes('v:')||block.includes('<table')||block.includes('<p')));
assert.ok(p.candidateSiteLinks.every(link=>raw.includes('href="'+link+'"')),
 'Archived original must show platform, biography, contributions and campaign team navigation');
const legacyVisible=originalCampaignVisibleText(Buffer.from(vml.join(' '),'utf8'));
assert.ok(legacyVisible.includes('~ Julie Rosen'),'Original original VML quotes must be attributed to Julie Rosen');
assert.ok(legacyVisible.includes('We need a strong voice in District 24.'),'Historical district 24 cannot be reassigned to new SD23 2020');
assert.ok(!originalCampaignVisibleText(html).includes(ledger.excerpts[0].exactShortExcerpt),
 'Modern non-VML browser extractor MUST NOT silently claim these are standard visible text');
const seen=new Set(),quotes=[];
for(const q of ledger.excerpts){
 assert.equal(q.pageId,p.id);
 assert.match(q.issueFamily,/^[a-z_]+$/);
 assert.equal(q.attributionClass,'candidate_original_legacy_IE_conditional_VML_site_quotation_not_2020_pledge');
 assert.ok(q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130);
 assert.equal(q.firstAuthoredDateKnown,false);
 assert.equal(q.officialVoteVerified,false);
 assert.equal(q.forecastEligible,false);
 assert.ok(!seen.has(q.exactShortExcerpt),'Duplicate literal original site evidence');seen.add(q.exactShortExcerpt);
 assert.ok(legacyVisible.includes(q.exactShortExcerpt),
  'Legacy IE-visible original candidate source quote does not exactly match raw original VML: '+q.id);
 quotes.push({id:q.id,issueFamily:q.issueFamily,
  literalOriginalHistoricalShortExcerptSha256:hash(Buffer.from(q.exactShortExcerpt)),
  originallyRenderedInLegacyMicrosoftVMLText:true,
  independentlyCrossCheckedOriginalAuthenticatedArchivedHTML:true,
  originallyAuthoredDateNotAsserted:true});
}
assert.equal(quotes.length,12);
const proof={schema:'mn-2004-original-julie-rosen-conditional-IE-VML-12-excerpt-independent-proof-v1',
 verifiedOfficialServingSenators:1,governmentOriginalServiceSHA256:hash(gov),
 independentOriginalEntireCDXSHA256:hash(originalIndexBytes),
 originalFullHistoricalCandidateHtmlSHA256:hash(html),
 originalArchiveCDXSHA1Base32:historicalArchiveSha1Base32(html),
 capturedByUtc:p.archiveCaptureUtc,
 originalSiteHistoricalSD24Not2020SD23:true,
 conditionalBrowserVMLBlocksIndependentlySelected:vml.length,
 exactOriginalHistoricalCandidateShortSourceExcerpts:quotes.length,
 notModernBrowserPlainVisibleText:true,notPublishedAuthored2004Or2020Claim:true,
 researcherRecordOnlyNoProductionOrModelWrites:0,
 exactLiteralSourceEvidenceProof:quotes};
const dest=arg('--output-json');mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log('ORIGINAL ROSEN PRE-2004 HISTORICAL CANDIDATE VML AUDIT '+JSON.stringify({
 originals:1,conditionalVMLBlocks:7,originalIssueExcerptRows:12,
 officialActuallyServingPerson:true,productionChanges:0}));
