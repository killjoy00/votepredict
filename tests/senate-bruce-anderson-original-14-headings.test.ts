import assert from 'node:assert/strict';
import {test} from 'node:test';
import ledger from '../data/evaluation/senate-bruce-anderson-14-full-original-issues-leads-v1.json' with {type:'json'};

test('Bruce Anderson is one new actual senator with 14 original issue headings',()=>{
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.scope.senatorsPreviouslyWithFirstPartyIssueOriginals,84);
 assert.equal(ledger.scope.shortSourceResearchRowsBeforeAddition,1079);
 assert.equal(ledger.scope.newlyCoveredActualSenators,1);
 assert.equal(ledger.pages.length,1);
 assert.equal(ledger.excerpts.length,14);
 assert.equal(ledger.pages[0].person,'Bruce Anderson');
 assert.equal(ledger.pages[0].officialSenateDirectoryName,'Bruce Douglas Anderson');
 assert.equal(ledger.pages[0].district,'29');
 assert.equal(ledger.pages[0].serviceElectionYear,2022);
 assert.equal(ledger.scope.productionDatabaseOrForecastsOrOfficialVotes,0);
});

test('all 14 exactly short historical issue headings remain pinned and never auto-imported to production',()=>{
 assert.equal(new Set(ledger.excerpts.map(q=>q.id)).size,14);
 assert.equal(new Set(ledger.excerpts.map(q=>q.exactShortExcerpt)).size,14);
 assert.ok(ledger.excerpts.every(q=>q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130));
 assert.ok(ledger.excerpts.every(q=>q.pageId==='bruce-original-2022-issues'));
 assert.ok(ledger.excerpts.every(q=>q.attributionClass==='historical_candidate_site_issue_heading_not_specific_first_authorship_date'));
 assert.ok(ledger.excerpts.every(q=>q.firstAuthoredDateKnown===false&&
  q.officialLegislativeActionVerified===false&&q.automaticallyEligibleForForecast===false));
 assert.equal(ledger.pages[0].automaticallyEligibleForForecast,false);
});

test('2022 capture of 2012-footer website is not mistaken for original publication in either year',()=>{
 assert.equal(ledger.scope.sourceSiteFooterCopyright2012DoesNotProvePageFirstAuthorDate,true);
 assert.equal(ledger.scope.originalArchived2022CaptureIsPublicByOnly,true);
 assert.equal(ledger.scope.firstAuthoredDateProven,false);
 assert.equal(ledger.pages[0].firstAuthoredDateKnown,false);
 assert.equal(ledger.pages[0].historicalSourceKind,
  'candidate_owned_2022_capture_with_2012_copyright_footer_no_first_authored_date');
 assert.equal(ledger.pages[0].candidateIdentityFromSeparateOriginalSameDateOembed,
  'Issues – Bruce Anderson for State Senate');
 assert.equal(ledger.scope.originCampaignBrandingSeparateAuthenticOEmbed,true);
 assert.equal(ledger.scope.source2022ExactOriginalAcquisitionRun,38187575772);
 assert.equal(ledger.scope.source2022ExactOriginalArtifact,11719743549);
 assert.equal(ledger.scope.independentFullOriginal160RowCDXRun,38175993447);
 assert.equal(ledger.scope.independentFullOriginal160RowCDXArtifact,11716126718);
});

test('unknown historical sites not reported as absence of senator platform',()=>{
 assert.equal(ledger.scope.fullOriginalSiteCensusProven,false);
 assert.equal(ledger.scope.archiveAbsenceNeverNoPolicy,true);
 assert.match(ledger.pages[0].originalFullHtmlSHA256,/^[0-9a-f]{64}$/);
 assert.match(ledger.pages[0].wholeIndependentSourceCdxSHA256,/^[0-9a-f]{64}$/);
 assert.match(ledger.pages[0].originalCdxSHA1Base32,/^[A-Z2-7]{32}$/);
});
