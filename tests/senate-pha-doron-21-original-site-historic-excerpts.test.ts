import assert from 'node:assert/strict';
import {test} from 'node:test';
import ledger from '../data/evaluation/senate-pha-doron-2022-25-original-campaign-site-21-short-excerpts-v1.json' with {type:'json'};

test('two previously source-unobserved true serving senators: Pha genuine 2022 site and Clark genuine pre special 2025 About',()=>{
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.scope.originalTrueSenatorPopulation,95);
 assert.equal(ledger.scope.priorAuthenticatedOriginalSiteQuotedServingPeople,90);
 assert.equal(ledger.scope.priorAuthenticatedOriginalSiteShortQuoteRows,1173);
 assert.equal(ledger.scope.newActualServingSenatorsWithFirstPartyCandidateSiteOriginalShortExcerpts,2);
 assert.equal(ledger.scope.originalFullCandidateOwnedHTMLPages,3);
 assert.equal(ledger.scope.independentWholeWaybackCDXIndexFiles,2);
 assert.equal(ledger.scope.distinctShortLiteralCandidateSiteResearchExcerpts,21);
 assert.equal(ledger.pages.length,3);
 assert.equal(ledger.excerpts.length,21);
 assert.deepEqual([...new Set(ledger.pages.map(p=>p.person))],['Susan Pha','Doron Clark']);
 assert.equal(new Set(ledger.pages.map(p=>p.id)).size,3);
 assert.equal(new Set(ledger.excerpts.map(q=>q.id)).size,21);
 assert.equal(new Set(ledger.excerpts.map(q=>q.exactShortExcerpt)).size,21);
});

test('2022 Susan Pha original site old SD40 footer does not override official SD38 Senate service or invented authorship date',()=>{
 const ps=ledger.pages.filter(p=>p.person==='Susan Pha');
 assert.equal(ps.length,2);
 assert.ok(ps.every(p=>p.verifiedElectionYear===2022&&p.verifiedSenateDistrict==='38'));
 assert.deepEqual(ps.map(p=>p.archivePublicByUTC),['2022-01-20T08:23:34.000Z','2022-08-05T03:54:40.000Z']);
 assert.equal(ledger.scope.oneOriginalSusanPhaSiteOldSD40FooterPreservedButActual2022SenateSD38ServiceVerified,true);
 assert.equal(ledger.scope.susanPha2022AugCandidateOriginalEndorsementExplicitlySaysSD38,true);
 assert.ok(ps.every(p=>p.firstAuthoredDateProven===false));
 assert.equal(ledger.excerpts.filter(q=>ps.some(p=>p.id===q.pageId)).length,16);
});

test('Jan11 2025 Doron original About is dated before both special primary and general, never silently an original policy platform',()=>{
 const p=ledger.pages.find(p=>p.person==='Doron Clark')!;
 assert.equal(p.verifiedElectionYear,2025);
 assert.equal(p.verifiedSenateDistrict,'60');
 assert.equal(p.archivePublicByUTC,'2025-01-11T04:34:53.000Z');
 assert.ok(p.archivePublicByUTC<'2025-01-14T00:00:00.000Z');
 assert.ok(p.archivePublicByUTC<'2025-01-28T00:00:00.000Z');
 assert.equal(p.originalPageUrl,'https://www.doronforsenate.org/about');
 assert.equal(p.originalPaidForIdentity,'Prepared and paid for by Neighbors for Doron');
 assert.equal(ledger.scope.doronOnlyBiographicalCommunityExperienceNotPolicyPlatformPledge,true);
 assert.equal(ledger.scope.doronPrioritiesPageHistoricalOriginalHTMLNotIndependentlyRecovered,true);
 assert.equal(ledger.scope.doron2026QuestionnairePDFNotAcceptedAsJan2025OriginalHTML,true);
 const q=ledger.excerpts.filter(q=>q.pageId===p.id);
 assert.equal(q.length,5);
 assert.ok(q.every(q=>q.attributionClass.startsWith('candidate_owned_original_about_')));
});

test('entire original HTML and complete original indexed Wayback digest claims are strict, none automatically forecast-eligible',()=>{
 assert.equal(ledger.scope.originalFiveParallelSearchRun,38196317659);
 assert.equal(ledger.scope.originalPhaArchivedFullHTMLArtifact,11722779798);
 assert.equal(ledger.scope.originalClarkArchivedFullHTMLArtifact,11722919527);
 assert.ok(ledger.pages.every(p=>/^[a-f0-9]{64}$/.test(p.originalHtmlSHA256)));
 assert.ok(ledger.pages.every(p=>/^[a-f0-9]{64}$/.test(p.completeOriginalCdxSHA256)));
 assert.ok(ledger.pages.every(p=>/^[A-Z2-7]{32}$/.test(p.originalIndexedSha1Base32)));
 assert.ok(ledger.excerpts.every(q=>q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130));
 assert.ok(ledger.excerpts.every(q=>q.originalFirstAuthoredDateProven===false&&q.officialVoteOrPastActionVerified===false&&q.forecastEligibleAutomatically===false));
 assert.equal(ledger.scope.allPublisherHostedSourcesKeptSeparate,true);
 assert.equal(ledger.scope.noOfficialLegislativeVoteOrPastActionVerified,true);
 assert.equal(ledger.scope.productionDatabaseReadsWrites,0);
 assert.equal(ledger.scope.modelTrainingForecastEvidenceAutoIngestOrScheduler2027Changes,0);
});
