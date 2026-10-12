import test from 'node:test';
import assert from 'node:assert/strict';
import report from '../docs/evaluation/senate-media-2024-hf5247-actual-transport-policy-version-crosswalk-20261012.json' with {type:'json'};
import journal from '../docs/evaluation/senate-media-2024-hawj-hf5247-official-journals-20261012.json' with {type:'json'};
import {VERSION,SOURCES,proofAnchor,validateAllowlist} from '../scripts/probe-senate-media-hf5247-may7-may19-bilingual-versions.mjs';
const PINNED=[
  {
    "id": "hf5247-house-third-engrossment",
    "url": "https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/versions/3/pdf/",
    "status": "exact_official_bill_version_fetched_sha256_and_text_inspected",
    "sha": "acdf6e4f5b1d288a55022bfbfa9be68d7760c6257fca22a33801f9b50e5cef4b",
    "bytes": 2421494,
    "pages": 148,
    "cues": [
      {
        "name": "transportation_translation_provision_title",
        "present": false
      },
      {
        "name": "translated_equivalent_materials",
        "present": false
      },
      {
        "name": "qualifying_nonenglish_languages",
        "present": false
      },
      {
        "name": "dvs_deputy_registrar",
        "present": false
      },
      {
        "name": "DVS_driver_license_agent",
        "present": false
      },
      {
        "name": "sponsored_bill_exact_SF3257",
        "present": false
      },
      {
        "name": "original_SF3257_bilingual_services",
        "present": false
      }
    ]
  },
  {
    "id": "hf5247-first-unofficial-senate-engrossment",
    "url": "https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/versions/ue/1/",
    "status": "exact_official_bill_version_fetched_sha256_and_text_inspected",
    "sha": "0ac7ca21c2b31fb617fd39e9d03f07de0d7547ba9c6762e763182061759fa0ce",
    "bytes": 1474193,
    "pages": null,
    "cues": [
      {
        "name": "transportation_translation_provision_title",
        "present": false
      },
      {
        "name": "translated_equivalent_materials",
        "present": false
      },
      {
        "name": "qualifying_nonenglish_languages",
        "present": false
      },
      {
        "name": "dvs_deputy_registrar",
        "present": false
      },
      {
        "name": "DVS_driver_license_agent",
        "present": false
      },
      {
        "name": "sponsored_bill_exact_SF3257",
        "present": false
      },
      {
        "name": "original_SF3257_bilingual_services",
        "present": false
      }
    ]
  },
  {
    "id": "hf5247-conference-committee-report-may19",
    "url": "https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/versions/ccr/0/pdf/",
    "status": "exact_official_bill_version_fetched_sha256_and_text_inspected",
    "sha": "61e758157d10fbde5a1873376e274604c394b103a0e22cf58f569ffb7fb48663",
    "bytes": 20789303,
    "pages": 1432,
    "cues": [
      {
        "name": "transportation_translation_provision_title",
        "present": false
      },
      {
        "name": "translated_equivalent_materials",
        "present": true
      },
      {
        "name": "qualifying_nonenglish_languages",
        "present": true
      },
      {
        "name": "dvs_deputy_registrar",
        "present": true
      },
      {
        "name": "DVS_driver_license_agent",
        "present": true
      },
      {
        "name": "sponsored_bill_exact_SF3257",
        "present": false
      },
      {
        "name": "original_SF3257_bilingual_services",
        "present": true
      }
    ]
  },
  {
    "id": "sf3257-original-2023-proposal",
    "url": "https://www.revisor.mn.gov/bills/93/2023/0/SF/3257/versions/0/pdf/",
    "status": "original_unavailable_or_parse_unknown",
    "sha": null,
    "bytes": null,
    "pages": null,
    "cues": null
  }
];
test('first live four official source version checks plus nine synthetic adversarial tests are pinned',()=>{
 assert.equal(VERSION,'track-d-hawj-2024-hf5247-actual-versions-bilingual-crosswalk-v1');
 assert.equal(report.version,'senate-media-hf5247-2024-actual-version-bilingual-policy-crosswalk-public-receipts-v1');
 assert.equal(report.provenance.issue,987);
 assert.equal(report.provenance.pr,1230);
 assert.equal(report.provenance.firstSuccessfulLivePublicSourceRunId,38274372589);
 assert.equal(report.provenance.firstSuccessfulSourceHead,'00efc5b35f82b7419380fc05f4045f50d34e422c');
 assert.equal(report.provenance.firstMetadataOnlyArtifactId,11758516879);
 assert.equal(report.provenance.firstAdversarialSyntheticTestsPassed,9);
 assert.equal(validateAllowlist(),true);
});
test('authentic entire government source raw SHA256 and byte receipts and expected version identity stable',()=>{
 const now=report.billVersionDocuments.map(x=>({id:x.id,url:x.originalOfficialBillDocumentUrl,status:x.originalSourceStatus,sha:x.actualDownloadedEntireSourceRawSha256,
  bytes:x.originalDownloadedSourceByteLength,pages:x.sourceOriginalPdfPages,cues:x.originalVisibleSourceFragmentEvidence?.map(z=>({name:z.id,present:z.shortSourceCuePresent}))??null}));
 assert.deepEqual(now,PINNED);
 assert.equal(now.length,4);
 assert.deepEqual(now.map(x=>x.url),SOURCES.map(x=>x.url));
 for(const x of now.slice(0,3)){
  assert.equal(x.status,'exact_official_bill_version_fetched_sha256_and_text_inspected');
  assert.match(x.sha,/^[0-9a-f]{64}$/);
  assert.ok(x.bytes>200000);
  assert.equal(x.cues.length,7);
 }
});
test('both original May7 text versions have zero distinctive bilingual DVS policy cues, do not promote Hawj omnibus YES as SF3257',()=>{
 const [third,unofficial]=report.billVersionDocuments;
 assert.equal(third.id,'hf5247-house-third-engrossment');
 assert.equal(third.sourceOriginalPdfPages,148);
 assert.equal(third.originalDownloadedSourceByteLength,2421494);
 assert.equal(third.actualDownloadedEntireSourceRawSha256,'acdf6e4f5b1d288a55022bfbfa9be68d7760c6257fca22a33801f9b50e5cef4b');
 assert.equal(unofficial.originalDownloadedSourceByteLength,1474193);
 assert.equal(unofficial.actualDownloadedEntireSourceRawSha256,'0ac7ca21c2b31fb617fd39e9d03f07de0d7547ba9c6762e763182061759fa0ce');
 for(const x of [third,unofficial]){
  assert.equal(x.compositeFourSpecificDvsMarkersPresent,false);
  assert.ok(x.originalVisibleSourceFragmentEvidence.every(y=>!y.shortSourceCuePresent));
 }
 assert.equal(report.counts.exactMay7DatedDocumentVersionsActuallyRead,2);
 assert.equal(report.counts.exactMay7VersionsHavingAllFourSpecificDvsTranslatedMaterialMarkers,0);
 assert.equal(report.decision.originalMay7SourceDocumentsBothLackAllFourDvsTranslatedMaterialsMarkers,true);
 assert.equal(report.decision.originalMay7SourceDocumentsBothLackEachOfFourDistinctDvsCoreCues,true);
 assert.equal(report.decision.doNotLabelMay7OmnibusYeaAsHawjSpecificBilingualSF3257Vote,true);
});
test('May19 conference PDF authentic original contains exact three DVS issue cues but long title/first-post cutoff still not certified',()=>{
 const c=report.billVersionDocuments[2];
 assert.equal(c.id,'hf5247-conference-committee-report-may19');
 assert.equal(c.sourceOriginalPdfPages,1432);
 assert.equal(c.originalDownloadedSourceByteLength,20789303);
 assert.equal(c.actualDownloadedEntireSourceRawSha256,'61e758157d10fbde5a1873376e274604c394b103a0e22cf58f569ffb7fb48663');
 const cues=new Map(c.originalVisibleSourceFragmentEvidence.map(y=>[y.id,y.shortSourceCuePresent]));
 for(const key of ['translated_equivalent_materials','qualifying_nonenglish_languages','dvs_deputy_registrar','DVS_driver_license_agent']) assert.equal(cues.get(key),true,key);
 assert.equal(cues.get('transportation_translation_provision_title'),false);
 assert.equal(report.decision.may19ConferenceOriginalContainsEquivalentMaterialsQualifyingLanguageAndDeputyRegistrarCues,true);
 assert.equal(report.decision.may19ConferenceOriginalLongSectionTitleExactContinuousMatchNotFound,true);
 assert.equal(report.decision.may19ConferenceBillVersionNotYetProvedPubliclyAvailableBeforeBothIndividualHawjVotes,true);
});
test('SF3257 failed fetch is UNKNOWN, not false proof text differs; strict no production label',()=>{
 const s=report.billVersionDocuments[3];
 assert.equal(s.id,'sf3257-original-2023-proposal');
 assert.equal(s.originalSourceStatus,'original_unavailable_or_parse_unknown');
 assert.equal(s.actualDownloadedEntireSourceRawSha256,null);
 assert.equal(s.originalVisibleSourceFragmentEvidence,null);
 assert.equal(report.counts.completeOriginalRevisorBillVersionDocumentsSHA256Authenticated,3);
 assert.equal(report.counts.originalSF3257VersionDownloadedAndAuthenticated,0);
 assert.equal(report.counts.exactSF3257ToHF5247SectionEquivalenceApproved,0);
 assert.equal(report.decision.sf3257IntroducedOriginalStillUnknownInThisBoundedRun,true);
 assert.equal(report.decision.noDirectSF3257VoteFromOmnibusYea,true);
 assert.equal(report.counts.sourceToPolicySpecificVoteForecastTrainingLabelsApproved,0);
});
test('historical Hawj source before three official HF5247 YES events remains anchored and not an automatic issue-level vote',()=>{
 const prior=proofAnchor();
 assert.equal(prior.originalHtmlSha256,report.preexistingPrimaryVoteAndContemporaneousSpeechProof.originalWrittenSourceRawSha256);
 assert.equal(prior.firstOriginalVerifiedUtc,report.preexistingPrimaryVoteAndContemporaneousSpeechProof.historicalOriginalWrittenSourceUtc);
 assert.equal(journal.counts.distinctHF5247IndividualRollCallsPersonallyListingHawjYes,3);
 assert.equal(report.preexistingPrimaryVoteAndContemporaneousSpeechProof.standaloneSF3257NamedRollcallProven,false);
 assert.equal(report.decision.noExactRevisorHtmlPostingMinuteAssumedBeforeMay7Roll,true);
 assert.equal(report.decision.may20FourthEngrossmentNotProofOfMay19PrevoteText,true);
 assert.equal(report.decision.noWholeRawGovernmentPdfOrArticleHtmlStored,true);
 assert.equal(report.decision.noPrivateVotePredictSourceRowsOrProdDatabaseInspected,true);
 assert.equal(report.decision.noProductionCollectorIngestionStoredVotesModelServingForecastOrDeploymentTouched,true);
});
