/** Offline public official event-date crosscheck only; not Wayback media or vote-model evidence. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const d=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2023-2025-interview-official-bill-chronology-crosscheck.json',
  'utf8',
)) as {
  version:string;issues:number[];researchCheckedOn:string;scope:string;
  interviews:Array<{
    id:string;senator:string;verifiedSenateServiceSource:string;
    media:{url:string;publisher:string;currentPageDisplayedDay:string;
      currentPageDisplayedClock:string;timezoneAuthenticated:boolean;
      currentPageContainsNamedSpeakerTranscript:boolean;originalHistoricalWaybackBodyVerified:boolean};
    officialHearing?:{source:string;senateBody:string;scheduledDay:string;
      scheduledClock:string;scheduledClockTimezoneUnverified:boolean;billScheduled:string;
      originalAgendaIsActualAttendanceOrSpeakerProof:boolean;actualHearingStartClockVerified:boolean;
      meetingRecordingBytesVerified:boolean};
    officialBill?:{source:string;senateBill:string;houseCompanion:string;
      revisorBillDescription:string;primarySenateAuthor:string;introduced:string;
      committeeReport:string;senateThirdReadingPassageDay:string;
      recordedYea:number;recordedNay:number;governorApproval:string;
      sessionLawChapter:number;effectiveDay:string;senatePassageBeforeDisplayedInterviewDay:boolean;
      later2023FinalBillHistoryProvesFebruary7MediaPublication:boolean;
      billSupportDirectQuoteInArchivedMediaVerified:boolean};
    relatedStandaloneBill?:{source:string;senateBill:string;houseCompanion:string;
      primarySenateAuthor:string;namedCoauthor:string;coauthorAddedDay:string;
      committeeActionDays:string[];senateFloorPassageRecordedOnPage:boolean;
      cannotAssignOmnibusRecordedVoteToStandaloneBill:boolean};
    senatePassedOmnibusBill?:{source:string;senateBill:string;houseCompanion:string;
      authorsOnStatusPage:string[];senatorPhaListedAsSF1959Author:boolean;
      firstSenateThirdReadingPassageDay:string;yeas:number;nays:number;
      senatePassagePrecedesDisplayedInterviewDay:boolean;
      subsequentConferenceReportAndSenateRepassageDay:string;
      approvedLawDay:string;chapter:number;effectiveDay:string;
      laterEnactmentNotKnownOnInterviewDisplayedDay:boolean;
      firstVoteBelongsToOmnibusSF1959NotStandaloneSF568:boolean};
    presentDaySenateCaucusStatement?:{source:string;publisher:string;
      currentPageDisplayedDay:string;pageByline:string;actualAttributedSpeaker:string;
      membersNamed:string[];collectiveStatementNotAutomaticallyAnIndividualSenatorQuote:boolean;
      statementRefersToOmnibus65To0Passage:boolean;firstPublicByAndOriginalArchiveShaVerified:boolean};
  }>;
  safetyBoundary:Record<string,boolean>;
};

function official(url:string,host:string) {
  const u=new URL(url);
  assert.equal(u.protocol,'https:');
  assert.equal(u.hostname,host);
}
function day(s:string) {
  assert.match(s,/^20(?:23|25)-\d{2}-\d{2}$/);
  assert.equal(new Date(s+'T00:00:00Z').toISOString().slice(0,10),s);
}

test('only two actual-serving senator source leads; researcher-day is not a 2023/2025 publication time',()=>{
  assert.equal(d.version,'senate-media-interview-official-bill-chronology-crosscheck-v1');
  assert.deepEqual(d.issues,[987,946]);
  assert.equal(d.researchCheckedOn,'2026-10-10');
  assert.deepEqual(d.interviews.map(x=>x.id),[
    'mpr-2023-kunesh-native-family-preservation',
    'mpr-2025-pha-hmong-lao-veterans',
  ]);
  assert.deepEqual(d.interviews.map(x=>x.senator),['Mary Kunesh','Susan Pha']);
  for(const x of d.interviews) {
    official(x.verifiedSenateServiceSource,'www.lrl.mn.gov');
    official(x.media.url,'www.mprnews.org');
    day(x.media.currentPageDisplayedDay);
    assert.equal(x.media.publisher,'MPR News');
    assert.match(x.media.currentPageDisplayedClock,/^\d{2}:\d{2}$/);
    assert.equal(x.media.timezoneAuthenticated,false);
    assert.equal(x.media.currentPageContainsNamedSpeakerTranscript,true);
    assert.equal(x.media.originalHistoricalWaybackBodyVerified,false);
  }
});

test('Feb 7 Kunesh interview precedes SF667 Feb 27 passage; hearing time is only an agenda',()=>{
  const x=d.interviews[0]!;
  const a=x.officialHearing!,b=x.officialBill!;
  official(a.source,'mnsenate.granicus.com');
  official(b.source,'www.revisor.mn.gov');
  assert.equal(a.senateBody,'Health and Human Services');
  assert.deepEqual([a.scheduledDay,a.scheduledClock,a.billScheduled],[
    '2023-02-07','08:30','SF667',
  ]);
  assert.equal(a.scheduledClockTimezoneUnverified,true);
  assert.equal(a.originalAgendaIsActualAttendanceOrSpeakerProof,false);
  assert.equal(a.actualHearingStartClockVerified,false);
  assert.equal(a.meetingRecordingBytesVerified,false);
  assert.equal(b.primarySenateAuthor,'Kunesh');
  assert.deepEqual([b.senateBill,b.houseCompanion],['SF667','HF1071']);
  assert.deepEqual([b.introduced,b.committeeReport,b.senateThirdReadingPassageDay],[
    '2023-01-25','2023-02-08','2023-02-27',
  ]);
  assert.ok(a.scheduledDay < b.committeeReport);
  assert.ok(x.media.currentPageDisplayedDay < b.senateThirdReadingPassageDay);
  assert.deepEqual([b.recordedYea,b.recordedNay],[66,1]);
  assert.equal(b.senatePassageBeforeDisplayedInterviewDay,false);
  assert.equal(b.governorApproval,'2023-03-16');
  assert.equal(b.sessionLawChapter,16);
  assert.equal(b.effectiveDay,'2023-08-01');
  assert.equal(b.later2023FinalBillHistoryProvesFebruary7MediaPublication,false);
  assert.equal(b.billSupportDirectQuoteInArchivedMediaVerified,false);
});

test('Apr 24 Pha newsroom interview is AFTER SF1959 Apr 23 Senate vote, not a pre-vote source',()=>{
  const x=d.interviews[1]!;
  const standalone=x.relatedStandaloneBill!,omnibus=x.senatePassedOmnibusBill!;
  official(standalone.source,'www.revisor.mn.gov');
  official(omnibus.source,'www.revisor.mn.gov');
  assert.deepEqual([standalone.senateBill,standalone.houseCompanion],['SF568','HF1845']);
  assert.equal(standalone.primarySenateAuthor,'Hawj');
  assert.equal(standalone.namedCoauthor,'Pha');
  assert.equal(standalone.coauthorAddedDay,'2025-02-03');
  assert.deepEqual(standalone.committeeActionDays,['2025-04-03','2025-04-10']);
  assert.equal(standalone.senateFloorPassageRecordedOnPage,false);
  assert.equal(standalone.cannotAssignOmnibusRecordedVoteToStandaloneBill,true);
  assert.deepEqual([omnibus.senateBill,omnibus.houseCompanion],['SF1959','HF2444']);
  assert.deepEqual(omnibus.authorsOnStatusPage,['Putnam','Carlson','Mitchell']);
  assert.equal(omnibus.senatorPhaListedAsSF1959Author,false);
  assert.deepEqual([omnibus.firstSenateThirdReadingPassageDay,omnibus.yeas,omnibus.nays],[
    '2025-04-23',65,0,
  ]);
  assert.ok(omnibus.firstSenateThirdReadingPassageDay<x.media.currentPageDisplayedDay);
  assert.equal(omnibus.senatePassagePrecedesDisplayedInterviewDay,true);
  assert.equal(omnibus.firstVoteBelongsToOmnibusSF1959NotStandaloneSF568,true);
  assert.equal(omnibus.subsequentConferenceReportAndSenateRepassageDay,'2025-05-17');
  assert.equal(omnibus.approvedLawDay,'2025-05-23');
  assert.equal(omnibus.chapter,30);
  assert.equal(omnibus.effectiveDay,'2025-07-01');
  assert.equal(omnibus.laterEnactmentNotKnownOnInterviewDisplayedDay,true);
});

test('Apr 23 Senate caucus collective statement is not automatically Senator Pha individual quote',()=>{
  const x=d.interviews[1]!;
  const c=x.presentDaySenateCaucusStatement!;
  official(c.source,'senatedfl.mn');
  assert.equal(c.publisher,'Minnesota Senate DFL');
  assert.equal(c.currentPageDisplayedDay,'2025-04-23');
  assert.equal(c.pageByline,'Senator Susan Pha');
  assert.equal(c.actualAttributedSpeaker,'Senate Minnesota Asian Pacific Caucus');
  assert.deepEqual(c.membersNamed,['Tou Xiong','Foung Hawj','Susan Pha']);
  assert.equal(c.collectiveStatementNotAutomaticallyAnIndividualSenatorQuote,true);
  assert.equal(c.statementRefersToOmnibus65To0Passage,true);
  assert.equal(c.firstPublicByAndOriginalArchiveShaVerified,false);
  assert.ok(c.currentPageDisplayedDay < x.media.currentPageDisplayedDay);
});

test('none of the current media/official links certify archive publication, quote or forecast inclusion',()=>{
  const p=d.safetyBoundary;
  assert.equal(p.allNamesWereServingStateSenatorsOnDisplayedDays,true);
  assert.equal(p.officialSenateBillHistoryIsEventChronologyNotMediaPublicationProof,true);
  for(const key of [
    'currentPublisherDisplayedClockHasVerifiedTimezone',
    'original2023And2025WaybackArticleBytesVerified',
    'originalMediaArticleSha256MatchedToPrivateVotePredict',
    'archiveFirstPublicByProven',
    'individualSenatorQuoteHumanReviewedFromOriginal',
    'caucusCollectiveStatementAttributedAsPhaAlone',
    'relatedSF568GivenSF1959Vote',
    'postVoteBroadcastMovedToPreVoteForecast',
    'future2025EnactmentKnownByPriorAprilInterview',
    'authenticatedHistoricalForecastEligibility',
    'productionIngestionEvidenceOrModelsChanged',
    'knownPublisherWideDenominator',
  ]) assert.equal(p[key],false,'Invalid historical evidence advancement: '+key);
  assert.equal(Object.hasOwn(d,'rawArchivedArticle'),false);
  assert.equal(Object.hasOwn(d,'privateSourceDocumentId'),false);
  assert.equal(Object.hasOwn(d,'senatorExactVerbatimQuote'),false);
});
