import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';

const file=new URL('../docs/evaluation/source-proof/senate-2025-apr09-energy-sf2393-caption-action-provisional-source-ledger.json',import.meta.url);
const original=readFileSync(file);
const j=JSON.parse(original.toString('utf8'));
const sha=(x:string)=>createHash('sha256').update(x).digest('hex');

test('original source proof pins exact official 2025-04-09 hearing and caption SHA rather than trusting ASR bill number',()=>{
 assert.equal(j.schemaVersion,'senate-2025-apr09-energy-sf2393-original-caption-committee-action-provisional-review-v1');
 assert.equal(j.issue,864);
 assert.equal(j.sourceHearing.hearingDate,'2025-04-09');
 assert.equal(j.sourceHearing.mtgid,'1051286');
 assert.equal(j.sourceHearing.officialMediaUrl,'https://www.lrl.mn.gov/media/file?mtgid=1051286');
 assert.equal(j.sourceHearing.solePostedCommitteeAgendaBill,'SF2393');
 assert.equal(j.sourceHearing.officialScheduleUrl,'https://www.senate.mn/schedule/senate/20250409');
 assert.equal(j.sourceHearing.billHistoryReportDated,'2025-04-10');
 assert.match(j.sourceHearing.officialBillHistoryMotionDisposition,/pass as amended and re-refer to Finance/i);
 assert.equal(j.captionOnlyCandidateClaim.displayedMisrecognizedSenateFileCandidate,'SF2323');
 assert.equal(j.captionOnlyCandidateClaim.displayedMisrecognizedSenateFileCandidateMustNotBeUsed,true);
 assert.equal(j.officialCrossCheck.correctBillAttributionBasedOnOfficialAgendaAndBillHistoryNotCaption,true);
});
test('specific actual original HTML and caption payload SHAs and existing failure status are immutable',()=>{
 const p=j.earlierOriginalPageAndCaptionProof;
 assert.equal(p.captionCueFirstRunId,38107642535);
 assert.equal(p.firstRunOverallConclusion,'failure_due_to_different_2025_source');
 assert.equal(p.sourceArtifactId,11689504269);
 assert.equal(p.firstRunZipSha256,'89553b84d8be7d8fc2efc48cd223c59655c01a10129b518694e597ed20a8f676');
 assert.equal(p.firstRunJsonSha256,'6c39b11830b2c3e53e0b14f037203cbbe85e0b0b4e07dc0a3f1610f0d56ff00c');
 assert.equal(p.firstRunJsonBytes,115002);
 assert.equal(p.sameHearingOriginalRecordHtmlSha256,
 '1d93e10ed46ba3a1c67b643e60fde2e3cd6da27e614fbe936b5156f6d055502d');
 assert.equal(p.sameHearingOriginalAutoCaptionPayloadSha256,
 '20489ee0e8556eca5f862d4afc0c6a36b4c4eb0bc42ebb7705386c1409442416');
 assert.equal(p.originalAutoCaptionBytes,604618);
 assert.equal(p.originalCaptionTimestampMarkers,3576);
 assert.ok([p.firstRunJsonSha256,p.sameHearingOriginalRecordHtmlSha256,
 p.sameHearingOriginalAutoCaptionPayloadSha256].every((x:string)=>/^[a-f0-9]{64}$/.test(x)));
});
test('only time-localized provisional original ASR vote cue windows: original names and exact bill/9-2 NOT certified',()=>{
 const x=j.boundedSourceMotionCueTimeWindow;
 assert.equal(x.length,3);
 assert.deepEqual(x.map((a:any)=>[a.candidateKind,a.automaticCaptionDataTimeSeconds]),[
  ['roll_call_request',7654],['individual_sides_spoken_auto_caption',7696],
  ['reported_roll_tally_auto_caption',7711]]);
 assert.ok(x.every((a:any)=>a.automaticCaptionDataTimeSeconds>7600&&a.automaticCaptionDataTimeSeconds<7800
   &&/^[a-f0-9]{64}$/.test(a.sourceContextSha256)));
 assert.equal(j.captionOnlyCandidateClaim.reportedYea,9);
 assert.equal(j.captionOnlyCandidateClaim.reportedNay,2);
 assert.equal(j.captionOnlyCandidateClaim.namedIndividualSidesCertified,false);
 assert.equal(j.captionOnlyCandidateClaim.rollCallAndBillMotionExactIdentityCertified,false);
 assert.equal(j.captionOnlyCandidateClaim.independentAudioPlaybackPerformed,false);
 assert.equal(j.captionOnlyCandidateClaim.distinctVoteCertified,false);
 assert.equal(j.officialCrossCheck.officialBillHistoryDoesNotAttestSpokenNineToTwoTally,true);
 assert.equal(j.officialCrossCheck.officialBillHistoryDoesNotAttestIndividualMemberSides,true);
});
test('unlinked video is not legally date-certified same-day vote evidence or an inferred source-denominator observation',()=>{
 assert.equal(j.provenanceDating.hearingEventDate,'2025-04-09');
 assert.equal(j.provenanceDating.sourceMediaOriginalHistoricalPublicBy,null);
 assert.equal(j.provenanceDating.sourceCaptionHistoricalPublicBy,null);
 assert.equal(j.provenanceDating.forecastAvailableOn,null);
 assert.equal(j.provenanceDating.noSameDayEligibility,true);
 assert.equal(j.limitations.originalMinutesLinkAbsentInElectronicIndex,true);
 assert.equal(j.limitations.keepAmendmentDivisionSeparateFromCommitteeRecommendation,true);
 assert.equal(j.limitations.sourceWitnessTallyAloneNeverIndividualYeaNay,true);
 assert.equal(j.limitations.sourceMotionNotEligibleAsRecordedMemberVotes,true);
 assert.equal(j.limitations.issue864MustRemainOpen,true);
});
