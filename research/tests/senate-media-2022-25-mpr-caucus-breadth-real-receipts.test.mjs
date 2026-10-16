import test from 'node:test';
import assert from 'node:assert/strict';
import receipts from '../../docs/evaluation/senate-media-2022-25-mpr-caucus-breadth-20261011.json' with {type:'json'};
import {VERSION,LEADS,validateLeads} from '../../scripts/probe-senate-media-2022-25-mpr-caucus-breadth-originals.mjs';
const byId=new Map();
for(const row of receipts.sourceOriginals){
 const prev=byId.get(row.id)||[];prev.push(row);byId.set(row.id,prev);
}
test('preserve exact real 2022–25 9 URL public archive experiment run artifact SHA256 and source metadata digest',()=>{
 assert.equal(receipts.version,'senate-media-nine-mpr-caucus-public-original-receipts-v1');
 assert.equal(receipts.initialSuccessfulLiveAction.githubRunId,38196297501);
 assert.equal(receipts.initialSuccessfulLiveAction.artifactId,11723990035);
 assert.equal(receipts.initialSuccessfulLiveAction.artifactZipBytes,4651);
 assert.equal(receipts.initialSuccessfulLiveAction.artifactZipSha256,'eaf10600bedc7481931f9c6c816b7e0037604acec6b34ea7a97a22993d0f5d0b');
 assert.equal(receipts.initialSuccessfulLiveAction.decodedSourceMetadataBytes,27605);
 assert.equal(receipts.initialSuccessfulLiveAction.decodedSourceMetadataSha256,'ddc315562b5f08fad78578aee45066204e139f7d8945f48150c95428a76c6834');
 assert.equal(receipts.initialSuccessfulLiveAction.originalProbeAdversarialOfflineTestsPassed,8);
 assert.equal(VERSION,'senate-media-mpr-caucus-ten-senator-breadth-source-proof-v1');
});
test('the ten original SHA1-index and SHA256 verified HTML snapshots span only six exact publisher URLs',()=>{
 assert.equal(receipts.sourceOriginals.length,10);
 assert.equal(byId.size,6);
 assert.deepEqual([...byId].map(([id,r])=>[id,r.length]),[
 ['2022-parental-rights-mpr-second-episode',2],
 ['2023-steve-cwodzinski-education-funding',1],
 ['2023-john-hoffman-mississippi-compact',2],
 ['2024-zach-duckworth-free-meals',2],
 ['2025-sandra-pappas-capital-bonding',2],
 ['2025-senate-asian-pacific-joint-caucus-sgu-veterans',1]
 ]);
 for(const row of receipts.sourceOriginals){
  assert.match(row.indexedSha1Base32,/^[A-Z2-7]{32}$/);
  assert.match(row.rawOriginalHtmlSha256,/^[a-f0-9]{64}$/);
  assert.ok(row.rawOriginalHtmlBytes>2000);
  assert.equal(row.originalSha1IndexedAndRawBodySha1Consistent,true);
  assert.equal(row.senatorPrintedSpeakerTurnAuthenticatedByThisFirstPass,false);
 }
 assert.equal(receipts.scope.independentlySha1AuthenticatedOriginalHtmlCaptureCount,10);
 assert.equal(receipts.scope.distinctOriginalPublisherUrlsWithAuthenticatedOriginalHtml,6);
});
test('first 2022 named Benson/Kunesh MPR interview original UNKNOWN but second 2022 related program original article verified, no audio alias established',()=>{
 const p=byId.get('2022-parental-rights-mpr-second-episode');
 assert.equal(p[0].captureUtc,'2022-02-24T02:53:02Z');
 assert.equal(p[0].rawOriginalHtmlSha256,'4c0d261abbbee79f31a2520b983bb84c8a998a488cf7e834b673b65d3b6be780');
 assert.equal(receipts.indexBoundaries.original2022TwoSenatorInterview,'index_unavailable_unknown');
 assert.match(receipts.indexBoundaries.relatedSameDayDifferentPage,/no identical audio or article alias relationship proved/);
 assert.deepEqual(LEADS[0].namedIndividualSenators,['Michelle Benson','Mary Kunesh']);
 assert.equal(LEADS[1].priorKnownSourceLead,true);
});
test('indexed earliest Feb 1 2023 Cwodzinski page SHA replay mismatch does not establish presence that early',()=>{
 assert.match(receipts.indexBoundaries.cwodzinskiFirstIndexed2023Capture,/digest mismatch/);
 assert.equal(byId.get('2023-steve-cwodzinski-education-funding')[0].captureUtc,'2023-03-14T11:26:30Z');
});
test('one collective 2025 SGU caucus statement, after relevant Senate legislation, not three direct Pha Xiong Hawj quotes',()=>{
 assert.equal(byId.get('2025-senate-asian-pacific-joint-caucus-sgu-veterans').length,1);
 assert.equal(byId.get('2025-senate-asian-pacific-joint-caucus-sgu-veterans')[0].captureUtc,'2025-07-25T01:47:33Z');
 assert.deepEqual(LEADS[7].namedIndividualSenators,['Susan Pha','Tou Xiong','Foung Hawj']);
 assert.equal(LEADS[7].historicalQuoteCandidate,false);
 assert.equal(LEADS[7].postEvent,true);
 assert.equal(receipts.interpretation.jointCaucusPostPassageVeteransStatementCannotForecastThatPriorVote,true);
 assert.match(receipts.indexBoundaries.groupPhaVeteransStatement,/not three separately/);
});
test('other 2025 individual Senate caucus source posts are current publisher leads without independent historical original proof',()=>{
 assert.equal(byId.has('2025-pha-individual-caucus-child-protection'),false);
 assert.equal(byId.has('2025-coleman-individual-caucus-school-security'),false);
 assert.match(receipts.indexBoundaries.phaMarch2025IndividualStatement,/original_indexes_unavailable/);
 assert.match(receipts.indexBoundaries.colemanAug2025IndividualStatement,/historical original index unavailable/);
 assert.equal(LEADS[6].attributionClass,'individual_named_senator_original_party_caucus_published_direct_statement');
 assert.equal(LEADS[8].attributionClass,'individual_named_senator_original_party_caucus_published_direct_statement');
});
test('curated sample, 10 named senators on 9 current publisher pages not 10 certified voices or private missing evidence count',()=>{
 assert.equal(validateLeads().length,9);
 assert.equal(receipts.scope.selectedExactCurrentPublisherURLs,9);
 assert.equal(receipts.scope.additionalSelectedPublisherURLLeads,7);
 assert.equal(receipts.scope.namedDistinctServingSenatorsRepresented,10);
 assert.equal(receipts.scope.privateSourceDocumentOrEvidenceRowsChecked,0);
 assert.equal(receipts.scope.individualSpeakerTurnsAuthenticatedByFirstPass,0);
 assert.equal(receipts.interpretation.shaIndexedHtmlAndBodyProofNotHumanReviewedFullQuote,true);
 assert.equal(receipts.interpretation.sourceLeadsNotStatewidePopulationDenominator,true);
 assert.equal(receipts.interpretation.noRawHtmlMp3PdfWarcPersisted,true);
 assert.equal(receipts.interpretation.noForecastModelServingCollectorOrProductionDatabaseChanges,true);
});
