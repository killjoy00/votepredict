import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const p=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2022-print-2023-a49-media-committee-source-gates.json','utf8'
));
test('2022 original Senate print minutes not misrepresented as reconciled with electronic',()=>{
 assert.equal(p.issue,864);
 assert.equal(p.sourceGate2022.hearingDate,'2022-04-07');
 assert.equal(p.sourceGate2022.electronicPrintedNamedRollParagraphs,7);
 assert.equal(p.sourceGate2022.electronicPrintedYeaNayNameOccurrences,67);
 assert.equal(p.sourceGate2022.electronicPrintedAbsentNameOccurrences,3);
 assert.equal(p.sourceGate2022.electronicSF4269A17AbsentFieldUnprintedInRetrievedText,true);
 assert.equal(p.sourceGate2022.printOriginalInventoryUrl,'https://www.lrl.mn.gov/minutes/');
 assert.equal(p.sourceGate2022.separateOriginalPrintPagesObtained,false);
 assert.equal(p.sourceGate2022.separateOriginalPrintPagesVisuallyReviewed,false);
 assert.equal(p.sourceGate2022.printOriginalBinarySHA256,null);
 assert.equal(p.sourceGate2022.sourcePrintVersusElectronicVoteParityConcluded,false);
 assert.equal(p.sourceGate2022.sourcePrintAbsentRecordsAssumedToBeZero,false);
 assert.equal(p.sourceGate2022.cannotCertifyOriginalPrintCoverageOrStatewideDenominator,true);
});
test('2023 actual A49 oral motion and original source misheaded A26 explicitly separate',()=>{
 const s=p.sourceGate2023;
 assert.equal(s.bill,'SF3157');
 assert.equal(s.hearingDate,'2023-04-03');
 assert.deepEqual(s.sourceMotionReportTally,{yea:2,nay:6,absent:2});
 assert.equal(s.sourceActuallyMovedAmendmentLabel,'A49');
 assert.equal(s.sourceConclusionPrintedLabel,'A26');
 assert.ok(s.nearbyDifferentMotion.includes('Earlier Jasinski A26'));
 assert.equal(s.previousAuthenticatedOriginalHtmlSHA256,
  'efbcf9bf503fcde638854a244748959e89ed336079099a51a44a16bb9bc1c203');
 assert.equal(s.sourceRepeatedA26ConclusionDoesNotCorroborateA49Audio,true);
 assert.equal(s.lrlPdfSourceTextHasSameMisheadedA26Conclusion,true);
 assert.equal(s.lrlPdfSourceTextOriginalBinarySHA256IndependentlyReverified,false);
});
test('actual historical MP3/recording publication entry is just a lead, not audible evidence',()=>{
 const s=p.sourceGate2023;
 assert.equal(s.officialGranicusAudioPublisherURL,
  'https://mnsenate.granicus.com/ViewPublisher.php?view_id=2');
 assert.equal(s.originalArchiveMp3URL,
  'https://archive-video.granicus.com/mnsenate/mnsenate_05ee7227-6441-421d-834c-8b3a48059cea.mp3');
 assert.equal(s.directOriginalMediaFileRetrievedAndSHA256Authenticated,false);
 assert.equal(s.originalMediaPlaybackOrCaptionTranscriptReviewed,false);
 assert.equal(s.exactSourceAudioCueOfA49MotionLocated,false);
 assert.equal(s.noReliableMotionTimecodeKnown,true);
 assert.equal(s.independentMediaA49VsA26MotionAdjudicationCompleted,false);
 assert.equal(s.underlyingNamedYeaNaySideVotesNotReclassified,true);
});
test('source limits remain immutable and issue cannot automatically close',()=>{
 assert.equal(p.schemaVersion,
  'senate-2022-finance-print-vs-electronic-and-2023-transportation-a49-a26-independent-source-gates-v1');
 for(const [key,value] of Object.entries(p.holds))
  assert.equal(value,true,key);
});
