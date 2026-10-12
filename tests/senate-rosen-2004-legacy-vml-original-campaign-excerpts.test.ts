import assert from 'node:assert/strict';
import {test} from 'node:test';
import source from '../data/evaluation/senate-rosen-old-sd24-2004-legacy-vml-original-12-excerpts-v1.json' with {type:'json'};

test('independent original historical Julie Rosen source is old SD24 IE VML, not 2020 SD23 promise',()=>{
 assert.equal(source.scope.issue,864);
 assert.equal(source.scope.officialActuallyServedMinnesotaSenators2021to2025,95);
 assert.equal(source.scope.priorVerifiedSiteQuotedSenators,85);
 assert.equal(source.scope.priorVerifiedShortSourceResearchExcerpts,1093);
 assert.equal(source.pages.length,1);
 assert.equal(source.pages[0].person,'Julie Rosen');
 assert.equal(source.pages[0].officialOriginalGovernmentServiceName,'Julie A. Rosen');
 assert.equal(source.pages[0].originalHistoricalDistrict,'24');
 assert.equal(source.pages[0].verified2020ServingDistrict,'23');
 assert.equal(source.pages[0].archiveCaptureUtc,'2004-03-25T07:00:23.000Z');
 assert.equal(source.scope.statementsNotReinterpretedAs2020SenateCampaignPledges,true);
 assert.equal(source.scope.capturedWebsiteFirstAuthorshipYearEstablished,false);
 assert.equal(source.scope.conditionalVMLExtractedSeparatelyFromModernBrowserVisibleText,true);
});

test('Rosen site first-party campaign original quotes are bounded, distinct, and not automatically forecasting evidence',()=>{
 assert.equal(source.excerpts.length,12);
 assert.equal(new Set(source.excerpts.map(q=>q.id)).size,12);
 assert.equal(new Set(source.excerpts.map(q=>q.exactShortExcerpt)).size,12);
 assert.ok(source.excerpts.every(q=>q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130));
 assert.ok(source.excerpts.every(q=>q.pageId===source.pages[0].id));
 assert.ok(source.excerpts.every(q=>q.attributionClass==='candidate_original_legacy_IE_conditional_VML_site_quotation_not_2020_pledge'));
 assert.ok(source.excerpts.every(q=>q.firstAuthoredDateKnown===false&&q.officialVoteVerified===false&&q.forecastEligible===false));
 assert.ok(source.pages[0].candidateSiteLinks.includes('contributions.htm'));
 assert.ok(source.pages[0].candidateSiteLinks.includes('platform.htm'));
 assert.equal(source.scope.productionDatabaseWrites,0);
 assert.equal(source.scope.modelsForecastsSchedulerChanges,0);
});

test('pinned original Wayback HTML, independent raw CDX and historic service source must remain unchanged',()=>{
 const p=source.pages[0];
 assert.match(p.originalFullHTMLSHA256,/^[a-f0-9]{64}$/);
 assert.match(p.independentOriginalFullCDXSHA256,/^[a-f0-9]{64}$/);
 assert.match(p.originalCDXSHA1Base32,/^[A-Z2-7]{32}$/);
 assert.equal(p.originalFullHTMLSHA256,'16be70899907f95eadb522e65a5a39de0a60f53fc87b84e81650923aa69bb015');
 assert.equal(p.independentOriginalFullCDXSHA256,'992a7550431545c3f4b4e4bca8fbf0569ad9d6f69cf6dc99a5b1678022e57816');
 assert.equal(source.scope.originalAcquisitionActionRun,38186753218);
 assert.equal(source.scope.originalAcquisitionArtifactId,11719882698);
 assert.equal(source.scope.originalArchiveSourceFormat,'Internet_Explorer_VML_conditionally_rendered_legacy_text');
 assert.equal(source.scope.noCompleteWebsiteCensusClaim,true);
});
