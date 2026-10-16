/** #864 primary Minnesota CFB year-end calendars and contemporaneous §10A originals. */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
 originalCfbYearEndLegalReleaseThreshold,
 CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS,
} from '../../src/evidence/cfb-2023-24-yearend-statutory-thresholds.js';
const ck=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/cfb-2023-24-original-board-yearend-calendar-and-revisor-release-checkpoint.json','utf8'));
test('five original, source-SHA/byte-verified CFB/Revisor documents fix release floor and no false legal denominator',()=>{
 assert.equal(ck.issue,864);
 assert.equal(ck.officialPrimarySources.length,5);
 const urls=new Set(ck.officialPrimarySources.map((x:{url:string})=>x.url));
 assert.equal(urls.size,5);
 for(const s of ck.officialPrimarySources){
  assert.ok(/^https:\/\/(cfb\.mn\.gov|www\.revisor\.mn\.gov)\//.test(s.url));
  assert.match(s.sourceSha256,/^[a-f0-9]{64}$/);
  assert.ok(Number.isInteger(s.bytes)&&s.bytes>=300);
  assert.ok(s.findings.length>=2);
 }
 assert.equal(ck.officialPrimarySources.filter((s:{media:string})=>s.media==='pdf').length,2);
 assert.equal(ck.officialPrimarySources.filter((s:{media:string})=>s.media==='html').length,3);
 assert.equal(ck.coverageScope.committeeSpecificStatutoryFilingObligationDenominator,null);
 assert.equal(ck.coverageScope.historicalActualPublicByCount,0);
 assert.equal(ck.primarySourceAcquisition.correctedFullMetadataRun.allFiveOriginalSourceSHAAndBytesVerified,true);
 assert.equal(ck.primarySourceAcquisition.correctedFullMetadataRun.noSourceFetchOrParseHolds,true);
 assert.equal(ck.primarySourceAcquisition.independentFullSourceRecheck.allFiveExactOriginalPdfAndStatuteSha256MatchPriorCorrectedRun,true);
 assert.equal(ck.primarySourceAcquisition.independentFullSourceRecheck.allFiveExactSourceByteLengthsMatchPriorCorrectedRun,true);
 assert.equal(ck.primarySourceAcquisition.independentFullSourceRecheck.original2023And2024YearEndCalendarCoverageAndDueDateFlagsMatch,true);
 assert.equal(ck.primarySourceAcquisition.independentFullSourceRecheck.noSourceFetchOrParseHolds,true);
 assert.notEqual(ck.primarySourceAcquisition.independentFullSourceRecheck.runId,
   ck.primarySourceAcquisition.correctedFullMetadataRun.runId);
 assert.equal(ck.primarySourceAcquisition.initialExploratoryRun.artifactId,11712580664);
 assert.match(ck.primarySourceAcquisition.initialExploratoryRun.warning,/parser detached/);
 assert.ok(ck.limits.BoardReceivedByDateIsNotActualPublicBy);
 assert.ok(ck.limits.earliestStatutoryReleaseDateIsNotActualOnlinePublicationDate);
 assert.equal(ck.safeguards.noRawPdfHtmlBodyPersisted,true);
 assert.equal(ck.safeguards.noProductionReadOrWrite,true);
});
test('original Board annual-report due-date source URLs, report dates and Revisor law match pinned primary proof',()=>{
 for(const year of [2023,2024] as const){
  const t=originalCfbYearEndLegalReleaseThreshold(year);
  const source=ck.officialPrimarySources.find((s:{url:string})=>s.url===t.officialOriginalBoardCalendar);
  assert.ok(source);
  assert.equal(source.media,'pdf');
  assert.equal(ck.exactStatutoryCalendarDates.filter((x:{reportYear:number})=>x.reportYear===year).length,1);
  const recorded=ck.exactStatutoryCalendarDates.find((x:{reportYear:number})=>x.reportYear===year);
  assert.equal(recorded.coveredFrom,t.originalCoveredStartOn);
  assert.equal(recorded.coveredThrough,t.originalCoveredEndOn);
  assert.equal(recorded.ordinaryYearEndDueOn,t.ordinaryYearEndDueOn);
  assert.equal(recorded.localNonpublicUntil,t.statutoryNonpublicUntilLocal);
  assert.equal(recorded.actualHistoricalPublicationOn,null);
  assert.equal(recorded.filingLegallyOwedBySpecificCommittee,null);
 }
 assert.equal(ck.officialPrimarySources.find((x:{url:string})=>
    x.url===CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS.chapter10A20_2023).bytes,107443);
 assert.equal(ck.officialPrimarySources.find((x:{url:string})=>
    x.url===CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS.chapter10A20_2024).bytes,108098);
 assert.equal(ck.officialPrimarySources.find((x:{url:string})=>
    x.url===CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS.chapter10A243_2024).bytes,63690);
});
