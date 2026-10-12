import test from 'node:test';
import assert from 'node:assert/strict';
import historical from '../docs/evaluation/senate-media-2022-parents-rights-gop-wcco-archive-20261012.json' with {type:'json'};
import earlier from '../docs/evaluation/senate-media-2022-benson-audio-six-publisher-originals-20261011.json' with {type:'json'};
import {VERSION,ORIGINALS,validateNewLeads} from '../scripts/probe-senate-media-2022-parental-rights-four-caucus-audacy-originals.mjs';

const PINNED=[
  {
    "utc": "2022-02-14T23:24:11Z",
    "sha1": "QKCIZE6CX4AZ2ZUOT6JNUNDKNYRYLEGP",
    "sha256": "0bf05a87365ca09a6a85114fe867995c4bfe0531a35adf61641454ed322e7696",
    "bytes": 91008,
    "people": [
      {
        "person": "Justin Eichorn",
        "found": true,
        "near": true
      },
      {
        "person": "Michelle Benson",
        "found": true,
        "near": true
      },
      {
        "person": "Paul Gazelka",
        "found": true,
        "near": true
      },
      {
        "person": "Roger Chamberlain",
        "found": true,
        "near": true
      }
    ]
  },
  {
    "utc": "2022-03-07T02:18:03Z",
    "sha1": "LWJGXK62GLCLUFK3ELND7PJLHIV6LLXW",
    "sha256": "858c8ee8fdf1b5fb2dee03cf1d5740066dac1476ec5006541f700f3803844cbd",
    "bytes": 91648,
    "people": [
      {
        "person": "Justin Eichorn",
        "found": true,
        "near": true
      },
      {
        "person": "Michelle Benson",
        "found": true,
        "near": true
      },
      {
        "person": "Paul Gazelka",
        "found": true,
        "near": true
      },
      {
        "person": "Roger Chamberlain",
        "found": true,
        "near": true
      }
    ]
  }
];
test('new historical original evidence was really recovered from live public archive workflow, not inferred from printed webpage date',()=>{
 assert.equal(VERSION,'track-d-2022-four-caucus-senators-distinct-wcco-benson-two-original-source-audit-v1');
 assert.equal(historical.version,'track-d-2022-caucus-four-senators-audacy-two-source-historical-original-receipts-v1');
 assert.equal(historical.publicProvenance.issue,987);
 assert.equal(historical.publicProvenance.pr,1235);
 assert.equal(historical.publicProvenance.firstSuccessfulPublicSourceWorkflowRunId,38276529117);
 assert.equal(historical.publicProvenance.initialExactSourceHead,'53b46e7c28b71b34112a3fadbdac2df1e5e0b255');
 assert.equal(historical.publicProvenance.publicMetadataOnlyArtifactId,11759760341);
 assert.equal(historical.publicProvenance.syntheticAdversarialTestsPassed,8);
 assert.equal(validateNewLeads().length,2);
});
test('exact original 2022 Feb14 and Mar7 GOP 4-senator source bodies indexed SHA1 and downloaded raw SHA256 remain immutable',()=>{
 const a=historical.sourceOriginals[0];
 assert.equal(a.id,ORIGINALS[0].id);
 assert.equal(a.exactPublisherUrl,ORIGINALS[0].url);
 assert.equal(a.earliestIndependentlyAuthenticatedHistoricalPublisherOriginalUtc,'2022-02-14T23:24:11Z');
 assert.equal(a.selectedOriginalWaybackIndexStatus,'index_candidates');
 const originals=a.independentlyAuthenticatedHistoricalOriginals.map(z=>({
  utc:z.captureUtc,sha1:z.indexedOriginalSha1Base32,sha256:z.downloadedOriginalHtmlRawSha256,bytes:z.rawOriginalHtmlBytes,
  people:z.originalVisibleShortCueNameNearObservations.map(k=>({person:k.senator,found:k.fragmentFound,near:k.namedSenatorNearby}))
 }));
 assert.deepEqual(originals,PINNED);
 assert.deepEqual(originals.map(x=>x.utc),['2022-02-14T23:24:11Z','2022-03-07T02:18:03Z']);
 assert.deepEqual(originals.map(x=>x.sha1),['QKCIZE6CX4AZ2ZUOT6JNUNDKNYRYLEGP','LWJGXK62GLCLUFK3ELND7PJLHIV6LLXW']);
 assert.deepEqual(originals.map(x=>x.sha256),[
 '0bf05a87365ca09a6a85114fe867995c4bfe0531a35adf61641454ed322e7696',
 '858c8ee8fdf1b5fb2dee03cf1d5740066dac1476ec5006541f700f3803844cbd']);
 assert.deepEqual(originals.map(x=>x.bytes),[91008,91648]);
 assert.ok(originals.every(x=>x.people.length===4&&x.people.every(y=>y.found&&y.near)));
 assert.ok(a.independentlyAuthenticatedHistoricalOriginals.every(x=>x.strictSourceStatus==='sha1_authenticated_original_publisher_html'));
});
test('four separate serving senator identities are source-wide named fragment candidates, NOT four unique articles or bounded complete individual quotations',()=>{
 const a=historical.sourceOriginals[0],actors=a.namedServingSenatorIndividuals;
 assert.deepEqual(actors.map(x=>x.name),['Justin Eichorn','Michelle Benson','Paul Gazelka','Roger Chamberlain']);
 assert.deepEqual(actors.map(x=>x.officialMemberHistoryUrl.split('ID=')[1]),['15480','15322','12263','15325']);
 assert.ok(actors.every(x=>x.shortOriginalCueFoundInAtLeastOneHistoricalPublisherHtml));
 assert.ok(actors.every(x=>x.fullSenatorNameNearShortOriginalCue));
 assert.ok(actors.every(x=>!x.completeHumanApprovedExactSenatorQuotation&&!x.individualQuotedParagraphBoundaryApproved&&!x.independentOriginalInterviewRecordedVoiceCertified));
 assert.equal(historical.counts.individuallyNamedSenatorsWithHistoricalShortCueAndFullNameNearby,4);
 assert.equal(historical.counts.approvedWholeQuotedIndividualStatements,0);
 assert.equal(historical.counts.originalPublisherUrlsWithSha1AndSha256AuthenticatedHistoricalHtml,1);
 assert.equal(historical.counts.distinctHistoricalOriginalHtmlBodyVersionsShaAuthenticated,2);
});
test('distinct Audacy reporter piece has current Benson text but ZERO independently archived historic original, remains UNKNOWN not missing',()=>{
 const other=historical.sourceOriginals[1];
 assert.equal(other.id,ORIGINALS[1].id);
 assert.equal(other.exactPublisherUrl,ORIGINALS[1].url);
 assert.equal(other.currentPublisherHtmlObserved.status,'current_publisher_html_sha256_observed');
 assert.match(other.currentPublisherHtmlObserved.rawCurrentHttpHtmlSha256,/^[a-f0-9]{64}$/);
 assert.equal(other.currentPublisherHtmlObserved.nowVisibleSelectedShortCues[0].speaker,'Michelle Benson');
 assert.equal(other.currentPublisherHtmlObserved.nowVisibleSelectedShortCues[0].shortCueFound,true);
 assert.equal(other.earliestIndependentlyAuthenticatedHistoricalPublisherOriginalUtc,null);
 assert.equal(other.selectedOriginalWaybackIndexStatus,'index_unavailable_unknown');
 assert.equal(other.independentlyAuthenticatedHistoricalOriginals.length,0);
 assert.ok(other.namedServingSenatorIndividuals.every(x=>!x.shortOriginalCueFoundInAtLeastOneHistoricalPublisherHtml));
 assert.equal(other.originalArchiveIndexUnavailableIsUnknownNotAbsent,true);
 assert.equal(historical.counts.originalAudacyWcco2022ArticleHtmlBodiesAuthenticated,0);
});
test('duplicate Michelle across party and WCCO pages not extra unique person; other MPR named episode still not recovered or aliased',()=>{
 assert.equal(historical.counts.newlyDiscoveredDistinctExactPublisherUrlLeadsNotAmongEarlier18_25_6,2);
 assert.equal(historical.counts.distinctHistoricallyServingStateSenators,4);
 assert.equal(historical.counts.namedSenatorShortCueSourcePairs,5);
 assert.equal(historical.temporalAndCountingLimits.fourSenatorCuesOnOneArticleNotFourArticles,true);
 assert.equal(historical.temporalAndCountingLimits.repeatedBensonOnSeparateWccoUrlNotAdditionalUniqueSenator,true);
 assert.equal(historical.temporalAndCountingLimits.independentlyDifferentMprFeb23NamedBensonKuneshProgramNotAlias,true);
 assert.equal(historical.temporalAndCountingLimits.neitherMprAudioUriFingerprintsOr2022NamedOriginalHtmlVerifiedHere,true);
 assert.equal(earlier.audio.namedEpisodeUrl,'https://www.mprnews.org/episode/2022/02/23/measures-give-parents-more-control-over-instruction-await-votes');
 assert.notEqual(otherOriginal(),earlier.audio.namedEpisodeUrl);
 function otherOriginal(){return historical.sourceOriginals[1].exactPublisherUrl;}
});
test('correct 2022 origin by-Feb14 2324 UTC not automatically pre-3pm hearing; all private/production and audio boundaries preserved',()=>{
 const b=historical.temporalAndCountingLimits;
 assert.equal(b.feb14FirstHistoricallyAuthenticatedGopCaucusPageByUtc,'2022-02-14T23:24:11Z');
 assert.equal(b.mar07SecondDistinctHistoricalOriginalVersionUtc,'2022-03-07T02:18:03Z');
 assert.equal(b.originalCaptureAtFeb14_2324UtcCannotForecastEarlierFeb14_1500CentralHearing,true);
 assert.equal(b.initialFeb14PublisherPublicationTimeNotProvedExactly,true);
 assert.equal(b.currentWccoArticleNotIndependentlyArchivedInSelectedIndex,true);
 assert.equal(b.WccoArchiveIndexUnavailableNotProofArticleAbsence,true);
 assert.equal(b.twoOriginalCaptureVersionsAreNotTwoSeparateSpeakerEvents,true);
 assert.equal(historical.counts.authenticatedOriginalAudioBodies,0);
 assert.equal(historical.counts.recordedLegislativeMemberVotesProvedByThisResearch,0);
 assert.equal(historical.counts.productionVotePredictSourceDocumentCoverageChecked,0);
 assert.equal(b.noPrivateSourceRowsOrProductionDbQueried,true);
 assert.equal(b.noCollectorIngestionPredictionModelOrServingChanged,true);
 assert.equal(b.noRawOriginalHtmlAudioWarcOrWholeArticlePersisted,true);
});
