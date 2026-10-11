import assert from 'node:assert/strict';
import {test} from 'node:test';
import ledger from '../data/evaluation/senate-carlson-hawj-2020-22-original-first-party-17-issue-excerpts-v1.json' with {type:'json'};

test('2020/22 exact first-party campaign quotations are only attributed to two real senators',()=>{
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.scope.actualNewQualifyingSenators,2);
 assert.equal(ledger.scope.trueServiceDenominator2021To2025,95);
 assert.equal(ledger.pages.length,3);
 assert.equal(ledger.excerpts.length,17);
 assert.deepEqual([...new Set(ledger.pages.map(p=>p.person))].sort(),['Foung Hawj','Jim Carlson']);
 assert.ok(ledger.pages.every(p=>p.firstAuthoredDateProven===false));
 assert.equal(ledger.scope.productionEvidenceRowsAdded,0);
 assert.equal(ledger.scope.forecastOrTrainingChanges,0);
});

test('capture timestamps are strictly pre-election observations, not first-post dates',()=>{
 const cutoffs:{[year:number]:string}={2020:'2020-11-03T00:00:00.000Z',2022:'2022-11-08T00:00:00.000Z'};
 for(const page of ledger.pages){
  assert.ok(page.archiveCaptureUtc<cutoffs[page.electionYear]);
  assert.match(page.htmlSha256,/^[0-9a-f]{64}$/);
  assert.match(page.archiveCdxSha1Base32,/^[A-Z2-7]{32}$/);
  assert.match(page.sourceIndexSha256,/^[0-9a-f]{64}$/);
  assert.ok(page.originalUrl.startsWith('http'));
  assert.equal(page.firstAuthoredDateProven,false);
 }
 assert.equal(ledger.scope.exactOldAuthorPostedDateNeverInferred,true);
});

test('short source passages have stable unique ids and do not auto-import historical model positions',()=>{
 assert.equal(new Set(ledger.excerpts.map(q=>q.id)).size,17);
 assert.equal(new Set(ledger.excerpts.map(q=>q.exactShortExcerpt)).size,17);
 assert.ok(ledger.excerpts.every(q=>q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130));
 assert.ok(ledger.excerpts.every(q=>ledger.pages.some(p=>p.id===q.pageId)));
 assert.ok(ledger.excerpts.every(q=>q.automaticallyEligibleForForecast===false&&q.firstAuthoredDateKnown===false));
 assert.ok(ledger.excerpts.every(q=>q.officialLegislativeActionVerified===false));
 assert.equal(ledger.excerpts.filter(q=>q.pageId==='carlson-2020-issues').length,8);
 assert.equal(ledger.excerpts.filter(q=>q.pageId==='hawj-2022-reelection').length,8);
 assert.equal(ledger.excerpts.filter(q=>q.pageId==='hawj-2020-reused-older').length,1);
});

test('Hawj older source self-reports and 2022 community priorities are not flattened into promises',()=>{
 const older=ledger.excerpts.filter(q=>q.pageId==='hawj-2020-reused-older');
 assert.ok(older.every(q=>q.attributionClass==='older_retained_candidate_past_work_self_report'));
 const campaign=ledger.excerpts.filter(q=>q.pageId==='hawj-2022-reelection');
 assert.equal(campaign.filter(q=>q.attributionClass==='candidate_letter_community_priority').length,6);
 assert.equal(campaign.filter(q=>q.attributionClass==='candidate_letter_first_person_action').length,2);
 assert.equal(ledger.scope.hawj2020PastWorkClaimsAreUnverifiedSelfReports,true);
 assert.equal(ledger.scope.hawj2022CommunityPrioritiesNotUnconditionalPersonalPledges,true);
});

test('uncertain or disqualified source pages retain exclusions instead of synthetic zero stances',()=>{
 assert.equal(ledger.scope.archiveFailuresNeverProveNoPolicy,true);
 assert.ok(ledger.sourceExclusions.some(x=>x.person==='Gene Dornink'));
 assert.ok(ledger.sourceExclusions.some(x=>x.person==='Michael Kreun'));
 assert.ok(ledger.sourceExclusions.some(x=>x.person==='Eric Lucero'));
 assert.ok(ledger.sourceExclusions.some(x=>x.person==='Jim Carlson'));
});
