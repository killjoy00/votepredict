import test from 'node:test';
import assert from 'node:assert/strict';
import quoteReceipts from '../../docs/evaluation/senate-media-2024-hawj-mcewen-original-written-quote-receipts-20261012.json' with {type:'json'};
import {VERSION,QUERIES,quoteAnchor,validateQueries,evaluateReadOnlyPublicStatus,checkOne,run}
 from '../../scripts/probe-senate-media-hawj-hf5247-public-bill-action-bridge.mjs';
const html=(value)=>'<html><head><script>fake SF 4056 2024 94th legislature</script></head><body><main><p>'+value+'</p></main><p>'+'X'.repeat(700)+'</p></body></html>';
test('exact actual previously SHA2/individual-quote authenticated Hawj March24 2024 source anchor, not a modern statement',()=>{
 assert.equal(VERSION,'track-d-hawj-hf5247-2024-public-omnibus-action-bridge-v1');
 const a=quoteAnchor();
 assert.equal(a.senator,'Foung Hawj');
 assert.equal(a.earliestOriginalHtmlUtc,'2024-03-24T19:01:09Z');
 assert.equal(a.earliestOriginalHtmlSha256,'aa6da6e8722e33f2f692ba31bfd6699cf97768e74c788dbdb0786a75a3ad5743');
 assert.equal(a.officialMemberHistoryUrl,'https://www.lrl.mn.gov/legdb/fulldetail?ID=15380');
 assert.equal(a.originalPublisherUrl,'https://senatedfl.mn/senator-foung-hawj-testifies-in-support-of-transportation-equity-legislation/');
 for(const bad of [
  r=>r.sources.find(x=>x.senator==='Foung Hawj').rawOriginalHttpHtmlSha256='f'.repeat(64),
  r=>r.sources.find(x=>x.senator==='Foung Hawj').hasBoundedQuoteOwnedByNamedSenator=false,
  r=>r.sources.find(x=>x.senator==='Foung Hawj').officialMemberHistoryUrl='https://www.lrl.mn.gov/legdb/fulldetail?ID=2'
 ]){
  const fake=structuredClone(quoteReceipts);bad(fake);assert.throws(()=>quoteAnchor(fake));
 }
});
test('exact 2023-24 legislative session prevents accidental 2025-26 SAME bill-number collisions',()=>{
 assert.equal(validateQueries(),true);
 assert.equal(QUERIES.length,7);
 assert.equal(new Set(QUERIES.map(q=>q.url)).size,7);
 assert.ok(QUERIES.filter(q=>q.chamber==='HF').every(q=>q.num==='5247'));
 assert.ok(QUERIES.filter(q=>q.chamber==='SF').every(q=>['1416','3257','3250','4056'].includes(q.num)));
 assert.ok(QUERIES.filter(q=>q.chamber!=='secondary').every(q=>q.url.includes('/bills/93/')));
 assert.ok(!QUERIES.some(q=>q.url.includes('/94/2026/')||q.url.includes('/94/2025/')));
 assert.throws(()=>validateQueries(QUERIES.map(x=>({...x}))));
});
test('official 93rd legislature Hawj source pages can carry actions but only exact session is admissible',()=>{
 const src=QUERIES.find(x=>x.id==='sf3250-2023-24');
 const ok=evaluateReadOnlyPublicStatus(html('SF 3250 Status in Senate - 93rd Legislature (2023 - 2024) 03/18/2024 1st Engrossment Comm report: to pass'),src);
 assert.equal(ok.allSelectedMarkersVisible,true);
 assert.equal(ok.exactSessionAndBillIdentity,true);
 assert.match(ok.publicSourceOriginalBodySha256,/^[a-f0-9]{64}$/);
 const wrong=evaluateReadOnlyPublicStatus(html('SF 3250 Status in Senate - 94th Legislature (2025 - 2026) 03/18/2024 and 2023 - 2024'),src);
 assert.equal(wrong.exactSessionAndBillIdentity,false);
});
test('HF5247 chamber dates are not a named Hawj roll call; returned markers are aggregate only',()=>{
 const src=QUERIES.find(x=>x.id==='hf5247-2023-24');
 const s=evaluateReadOnlyPublicStatus(html('HF 5247 Status in Senate 93rd Legislature (2023 - 2024) 05/07/2024 Third reading Passed vote: 55-10. 05/19/2024 Senate adopted CC vote: 34-12. Third reading vote: 34-14. 05/24/2024 Chapter 127'),src);
 assert.equal(s.exactSessionAndBillIdentity,true);
 assert.equal(s.allSelectedMarkersVisible,true);
 assert.equal(s.actionMarkerObservations.senateMay7FloorPassTallyMentioned,true);
 assert.equal(s.actionMarkerObservations.senateMay19ThirdReadingTallyMentioned,true);
 assert.equal(s.actionMarkerObservations.senateMay19ConferenceTallyMentioned,true);
 assert.equal(s.actionMarkerObservations.laterMay24Chapter127Marker,true);
 assert.equal(s.thisIsNotOfficialIndividualSenateJournalVoteValidation,true);
});
test('fourth final engrossment topic language is retrospective statutory content, NOT text as available before May19 floor',()=>{
 const src=QUERIES.find(x=>x.id==='hf5247-fourth-engrossment');
 const s=evaluateReadOnlyPublicStatus(html('HF 5247, 93rd Legislature (2023 - 2024) Fourth engrossment. 1001 Johnson Parkway full-service office. Equivalent materials and qualifying language; competitive bidding.'),src);
 assert.equal(s.allSelectedMarkersVisible,true);
 assert.equal(s.actionMarkerObservations.sectionTextContainsTranslatedMaterials,true);
 assert.equal(s.actionMarkerObservations.sectionTextContainsBidding,true);
 assert.equal(s.actionMarkerObservations.sectionTextContainsStPaulLocation,true);
 assert.equal(s.thisIsTodayObservedStatusHtmlNotAnAuthenticatedHistorical2024StatusSnapshot,true);
});
test('secondary tracker Hawj YES tip requires actual name inside yes list, never promotes official individual Senate vote',()=>{
 const src=QUERIES.find(x=>x.id==='hawj-secondary-conservation-yes');
 const okay=evaluateReadOnlyPublicStatus(html('HF5247 May 19, 2024. Yes Votes: Liz Boldon, Foung Hawj, Grant Hauschild. No Votes: Other Member.'),src);
 assert.equal(okay.allSelectedMarkersVisible,true);
 assert.equal(okay.actionMarkerObservations.secondarySourceListsHawjUnderYesVotes,true);
 const wrong=evaluateReadOnlyPublicStatus(html('HF5247 May 19, 2024. Yes Votes: Someone Else. No Votes: Foung Hawj.'),src);
 assert.equal(wrong.actionMarkerObservations.secondarySourceListsHawjUnderYesVotes,false);
 assert.equal(okay.thisIsNotOfficialIndividualSenateJournalVoteValidation,true);
});
test('hidden markup and a 2026 SF4056 bill do not validate 2024 Hawj source status',()=>{
 const q=QUERIES.find(x=>x.id==='sf4056-2023-24');
 const page=html('SF 4056 94th Legislature (2025 - 2026) from a different senator')+
  '<script>SF 4056 93rd Legislature (2023 - 2024) 02/22/2024 04/15/2024</script>';
 const x=evaluateReadOnlyPublicStatus(page,q);
 assert.equal(x.exactSessionAndBillIdentity,false);
 assert.equal(x.allSelectedMarkersVisible,false);
});
test('redirect/bad mime/fake changed source fail closed without a name, bill or member-vote promotion',async()=>{
 const q=QUERIES.find(x=>x.id==='hf5247-2023-24');
 for(const [f,status] of [
  [async()=>new Response('',{status:302,headers:{location:'https://unrelated.example/'}}),'redirect_refused_unknown'],
  [async()=>new Response('unavailable',{status:503}),'http_unavailable_unknown'],
  [async()=>new Response('not html',{headers:{'content-type':'text/plain'}}),'not_original_public_html_unknown'],
  [async()=>new Response('<html>'+('Z'.repeat(800))+'</html>',{headers:{'content-type':'text/html'}}),'source_identity_or_expected_action_marker_missing_unknown']
 ]){
  const x=await checkOne(q,f);assert.equal(x.observedStatus,status);
  assert.equal(x.originalSenateJournalMemberBallotAuthenticated,false);
 }
});
test('all seven public statuses unavailable -> historical source still valid but omnibus vote bridge UNKNOWN and no production implication',async()=>{
 let requests=0;
 const r=await run(async(_url,options)=>{requests++;assert.equal(options.redirect,'manual');return new Response('unavailable',{status:503});});
 assert.equal(requests,7);
 assert.equal(r.selectedPublicSourceUrls,7);
 assert.equal(r.officialRevisorPagesObservedWithSelectedMarkers,0);
 assert.equal(r.may7AndMay19SenateChamberAggregateVoteCandidate,false);
 assert.equal(r.enactedBillFinalTextTopicConnectionsObserved,false);
 assert.equal(r.secondaryHawjYesTipObserved,false);
 assert.equal(r.officialIndividualSenateJournalHawjBallotVerified,false);
 assert.equal(r.exact2024BillVersionAvailableBeforeMay19VoteVerified,false);
 assert.equal(r.automaticSFToOmnibusLegislativeIdentityEquivalence,false);
 assert.equal(r.productionPredictionOrTrainingEligibilityProved,false);
 assert.equal(r.noHistoricGovWebPageOrCurrentSourceTextPersisted,true);
 assert.equal(r.noPrivateVotePredictRowsQueried,true);
 assert.equal(r.noProductionCollectorModelDatabaseServingOrVoteScoringChanged,true);
});
