import assert from 'node:assert/strict';
import {test} from 'node:test';
import ledger from '../data/evaluation/senate-kiffmeyer-newman-kreun-four-original-historic-site-excerpts-v1.json' with {type:'json'};

test('3 verified 2021-25 serving MN senators gain 33 original historically office-scoped candidate source quotes',()=>{
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.scope.officialActualServingSenatorPopulation,95);
 assert.equal(ledger.scope.baselineResearchSenatorsWithOriginalSiteIssueLeads,87);
 assert.equal(ledger.scope.baselineOriginalShortCandidateExcerpts,1140);
 assert.equal(ledger.scope.newlyOriginalSiteQuotedActuallyServingPeople,3);
 assert.equal(ledger.scope.originalCandidateOwnedFullHtmlPages,4);
 assert.equal(ledger.scope.shortExactHistoricallyAttributedExcerpts,33);
 assert.deepEqual([...new Set(ledger.pages.map(p=>p.person))].sort(),
 ['Mary Kiffmeyer','Michael Kreun','Scott Newman']);
 assert.equal(ledger.pages.length,4);
 assert.equal(ledger.excerpts.length,33);
 assert.equal(new Set(ledger.pages.map(p=>p.id)).size,4);
 assert.equal(new Set(ledger.excerpts.map(q=>q.id)).size,33);
 assert.equal(new Set(ledger.excerpts.map(q=>q.exactShortExcerpt)).size,33);
});

test('Kiffmeyer old House and Secretary of State, Newman 2020 Senate and Kreun school board campaigns are NOT flattened',()=>{
 const find=(id:string)=>ledger.pages.find(p=>p.id===id)!;
 assert.equal(find('kiffmeyer-2009-house16b-original-issues').historicSourceOffice,'Minnesota House District 16B');
 assert.equal(find('kiffmeyer-2007-secretary-state-business-original').historicSourceOffice,'Minnesota Secretary of State');
 assert.equal(find('newman-2020-sd18-original-home').historicSourceOffice,'Minnesota Senate District 18');
 assert.equal(find('kreun-2021-schoolboard-original-home').historicSourceOffice,'Spring Lake Park School Board');
 assert.equal(find('kreun-2021-schoolboard-original-home').originalSourceElectionContext,
 '2021_School_Board_re_election_not_2022_Senate_promise');
 assert.equal(ledger.scope.olderHouseAndSOSAndSchoolBoardSitesNot2020or2022SenateCampaignPledges,true);
 assert.equal(ledger.scope.sourcePublicByCaptureDateNotFirstAuthored,true);
 assert.equal(ledger.scope.broadSenateHomepageIssueSalienceNotSpecificLegislativePromise,true);
 assert.ok(ledger.pages.every(p=>p.originalFirstAuthoredDateProven===false));
 assert.ok(ledger.pages.every(p=>p.officialLegislativeVoteOrBillProven===false));
 assert.ok(ledger.pages.every(p=>p.automaticallyEligibleForForecast===false));
});

test('33 exact historical source excerpts are short, distinct and never automatically eligible for forecast',()=>{
 const pageIds=new Set(ledger.pages.map(p=>p.id));
 assert.ok(ledger.excerpts.every(q=>pageIds.has(q.pageId)));
 assert.ok(ledger.excerpts.every(q=>q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130));
 assert.ok(ledger.excerpts.every(q=>q.firstAuthoredDateKnown===false&&
   q.officialLegislativeActionVerified===false&&q.eligibleForForecast===false));
 const count=Object.fromEntries(ledger.pages.map(p=>[p.id,ledger.excerpts.filter(q=>q.pageId===p.id).length]));
 assert.deepEqual(count,{
 'kiffmeyer-2009-house16b-original-issues':18,
 'kiffmeyer-2007-secretary-state-business-original':8,
 'newman-2020-sd18-original-home':2,
 'kreun-2021-schoolboard-original-home':5
 });
 assert.ok(ledger.excerpts.some(q=>q.attributionClass==='candidate_senate_site_public_safety_salience_not_specific_bill_pledge'));
 assert.ok(ledger.excerpts.some(q=>q.attributionClass==='candidate_self_reported_prior_school_board_action_unverified'));
});

test('whole original SHA receipts and no-production safeguards remain immutable',()=>{
 assert.equal(ledger.scope.parallelAcquisitionRun,38193297084);
 assert.equal(ledger.scope.legacy2020SourceArtifactId,11722567112);
 assert.equal(ledger.scope.recent2022SourceArtifactId,11722142765);
 assert.equal(ledger.scope.originalOfficialSenateServiceDirectorySha256,
 'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51');
 assert.ok(ledger.pages.every(p=>/^[a-f0-9]{64}$/.test(p.fullHTMLSHA256)));
 assert.ok(ledger.pages.every(p=>/^[a-f0-9]{64}$/.test(p.independentOriginalCDXSHA256)));
 assert.ok(ledger.pages.every(p=>/^[A-Z2-7]{32}$/.test(p.originalCdxSHA1Base32)));
 assert.equal(ledger.scope.noOfficialSenateVotesVerified,true);
 assert.equal(ledger.scope.noOriginalCampaignPlatformFullCensusClaim,true);
 assert.equal(ledger.scope.failedArchiveIndexesNotEvidenceOfNoPolicies,true);
 assert.equal(ledger.scope.productionDatabaseReadsWrites,0);
 assert.equal(ledger.scope.forecastModelsEvidenceAutoImport,0);
});
