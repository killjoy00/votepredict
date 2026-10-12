import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const a=JSON.parse(readFileSync(new URL('../data/evaluation/senate-864-2026-49-incumbent-public-source-reference-crosswalk-v1.json',import.meta.url)));
const b=JSON.parse(readFileSync(new URL('../data/evaluation/senate-864-2026-incumbent-duckworth-exact-speaker-leads-v1.json',import.meta.url)));
const s=a.rows;
test('all 49 sitting 2026 Senate nominees appear exactly once, and sum to original independently verified 716 historical excerpts',()=>{
 assert.equal(a.issue,864);assert.equal(a.election,'2026-11-03');
 assert.equal(s.length,49);assert.equal(a.summary.incumbentNominees,49);
 assert.equal(new Set(s.map(x=>x.district)).size,49);
 assert.equal(new Set(s.map(x=>x.senator.toLowerCase())).size,49);
 assert.equal(s.reduce((n,x)=>n+x.selectedOlderOriginalSiteExcerpts,0),716);
 assert.ok(s.every(x=>Number.isInteger(x.selectedOlderOriginalSiteExcerpts)&&x.selectedOlderOriginalSiteExcerpts>0));
 assert.deepEqual(s.map(x=>x.district),[1,2,3,4,6,7,8,9,10,11,12,14,16,17,18,19,23,25,27,28,29,30,31,32,33,34,35,36,38,39,40,41,42,45,46,47,48,55,56,57,58,59,60,61,62,63,64,66,67]);
});
test('public CODE SEARCH is never promoted into exact 2026 source or private evidence',()=>{
 const hit=s.filter(x=>x.mainPublicRepoStringSearch==='observed_string_in_prior_research_or_code');
 const unknown=s.filter(x=>x.mainPublicRepoStringSearch==='not_observed_by_bounded_search_unknown');
 assert.equal(hit.length,22);assert.equal(unknown.length,27);
 assert.equal(a.summary.publicRepositoryMentionDetectedByBoundedQuery,22);
 assert.equal(a.summary.noMentionDetectedByBoundedQuery,27);
 assert.ok(s.every(x=>x.exactCurrentVersionInPublicLedger==='unverified'
   && x.privateVotePredictSourceDocumentAndEvidenceItemJoin==='unknown_not_performed'));
 assert.equal(a.limitations.codeSearchMissIsUnknownNotDatabaseAbsence,true);
 assert.equal(a.limitations.aGitHubCodeSearchHitMayOnlyReferToHistoricalDomain,true);
 assert.equal(a.limitations.protectedNeonAggregateDoesNotCertifyProductionIdentityOrIndividualMatches,true);
});
test('candidate provenance and exact data mirrors separate 2026 Duckworth source ledger',()=>{
 const person=s.find(x=>x.district===57);
 assert.equal(person.senator,'Zach Duckworth');
 assert.equal(person.selectedOlderOriginalSiteExcerpts,14);
 assert.ok(person.researchSourceUrl.includes('voteduckworth.com/issues'));
 assert.equal(b.duckworth.original2022CaptureUtc,'2022-01-18T02:14:14.000Z');
 assert.equal(b.duckworth.newDated2026SourceLeads.length,4);
 assert.equal(b.existingProtectedAggregate.personByPersonMatchedAgainstNew2026Leads,0);
});
test('the 49 URL/source rows have basic type and no private PII or implicit outcome forecasts',()=>{
 for(const r of s){
  const u=new URL(r.researchSourceUrl);
  assert.equal(u.protocol,'https:');
  assert.ok(!u.username&&!u.password);
  assert.ok(typeof r.senator==='string'&&r.senator.length>3);
  assert.ok(!JSON.stringify(r).includes('sourceDocumentId'));
  assert.ok(!JSON.stringify(r).includes('password'));
 }
 assert.equal(a.summary.privateOrProductionPerMemberDatabaseRecordsAccessed,0);
 assert.equal(a.limitations.noOutsideHumanContact,true);
 assert.equal(a.limitations.doNotAutoIngestOrPromote,true);
});
