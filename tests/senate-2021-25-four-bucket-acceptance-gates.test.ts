import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const data=(p:string)=>readFileSync(new URL('../'+p,import.meta.url));
const json=(p:string)=>JSON.parse(data(p).toString('utf8'));
const blob=(b:Uint8Array)=>createHash('sha1').update('blob '+b.byteLength+'\0').update(b).digest('hex');
const dst='docs/evaluation/source-proof/senate-2021-25-four-bucket-acceptance-gap-scorecard.json';
const c=json(dst);
const paths=c.sourceProofFiles;
const sources=Object.fromEntries(Object.entries(paths).map(([k,v])=>[k,jsonSafe(data((v as {path:string}).path))]));
function jsonSafe(b:Buffer):any{
 const s=b.toString('utf8');
 try{return JSON.parse(s)}catch{return s}
}
test('all eight upstream source proofs are byte-pinned, not copied from mutable summaries',()=>{
 assert.equal(c.issue,864);
 assert.equal(c.schemaVersion,'senate-2021-25-four-evidence-bucket-source-debt-gates-v1');
 assert.equal(Object.keys(paths).length,8);
 for(const obj of Object.values(paths) as Array<{path:string;expectedGitBlobSha:string}>){
   assert.match(obj.expectedGitBlobSha,/^[a-f0-9]{40}$/);
   assert.equal(blob(data(obj.path)),obj.expectedGitBlobSha,obj.path);
 }
});
test('four electronic year slices and all 207 already-recovered scanned originals reconcile',()=>{
 const a=sources.committeeElectronicMinutes,ocr=sources.committeeRecoveredLowTextPdfs;
 const gap=sources.committeeUnlinkedMeetings;
 const expected=[337,517,300,438],years=c.historicalYearCells;
 assert.deepEqual(years.map((r:any)=>r.year),[2021,2022,2023,2024,2025]);
 assert.equal(years[0].committeeIndexedElectronicMeetings,null);
 assert.equal(years[0].committeeMinutesLinkedMeetings,null);
 for(let i=1;i<years.length;i++){
   const r=years[i],orig=a.years[i-1];
   assert.equal(r.year,orig.year);
   assert.equal(r.committeeIndexedElectronicMeetings,orig.indexedMeetings);
   assert.equal(r.committeeMinutesLinkedMeetings,orig.meetingsWithMinutes);
   assert.equal(r.committeeMissingMinutesMeetings,orig.meetingsWithoutMinutes);
   assert.equal(r.committeePdfLinks,orig.originalPdfLinks);
 }
 assert.deepEqual(years.slice(1).map((r:any)=>r.committeeIndexedElectronicMeetings),expected);
 assert.equal(a.totals.indexedMeetings,1592);
 assert.equal(a.totals.originalPdfLinks,1452);
 assert.equal(a.totals.meetingsWithoutMinutes,141);
 assert.equal(ocr.allOcrCohorts.finalOcrRecovered,207);
 assert.equal(ocr.allOcrCohorts.remainingScannedOriginals,0);
 assert.equal(gap.meetingGroups.reduce((n:number,g:any)=>n+g.missingMinutesMeetingDates.length,0),141);
 assert.equal(gap.datedMediaCandidateTriage.indexOnlyMediaCandidateMeetings,138);
 assert.equal(gap.datedMediaCandidateTriage.indexedMeetingsWithoutDatedMediaCandidate,3);
 assert.equal(c.sourceProofMilestones.committeeNamed2025ElectionsSourceCandidateBlocks,15);
 assert.equal(c.sourceProofMilestones.committeeNamed2025ElectionsCandidateChoiceTokens,163);
});
test('2021-24 CFB source viewer references cannot become 2025/statewide obligation denominators',()=>{
 const f=sources.finance2021to2024,n=sources.finance2025Partial;
 const rows=c.historicalYearCells;
 assert.equal(f.observations.responsesAcquired,396);
 assert.equal(f.scope.distinctRegistrationNumbersInScope,275);
 assert.equal(f.observations.principalCampaignCommitteeOriginalVersionReferencesAmendmentZero,941);
 assert.equal(f.observations.principalCampaignCommitteeAmendedVersionReferencesAmendmentPositive,437);
 for(let i=0;i<4;i++){
  assert.equal(rows[i].financeSourceObservedOriginalVersionReferences,f.byReportYear[i].pccOriginalVersionReferences);
  assert.equal(rows[i].financeSourceObservedAmendedVersionReferences,f.byReportYear[i].pccAmendmentVersionReferences);
 }
 assert.equal(n.observedReportReferences.registeredCandidateCommitteesQueried,41);
 assert.equal(n.observedReportReferences.originalVersionReferencesAmendmentZero,60);
 assert.equal(n.observedReportReferences.amendedVersionReferencesAmendmentPositive,25);
 assert.equal(rows[4].financeSourceObservedOriginalVersionReferences,60);
 assert.equal(rows[4].financeSourceObservedAmendedVersionReferences,25);
 assert.equal(c.acceptanceUnknowns.statewide2021to2025StatutorilyOwedCfbReportDenominator,null);
 assert.equal(c.acceptanceUnknowns.independentlyProvenOriginalCfbReportHistoricPublicByCountWithinTheseSourceTranches,0);
 const held=sources.financeTerminationHeld;
 assert.equal(held.summary.independentSelectedTerminationCheckboxesVerified,0);
 assert.equal(held.summary.individualLegallyOwedYearEndCount,null);
});
test('verified source-live media context by archive-capture year is NOT named quotations',()=>{
 const m=sources.mediaAggregate;
 assert.equal(m.source.workflowRunId,38093691235);
 assert.equal(m.scope.postgresTransactionRolledBack,true);
 assert.equal(m.scope.privateSourceRowsOrArticleBodiesExported,false);
 for(const y of c.historicalYearCells){
  const x=m.studyCaptureYears[String(y.year)];
  assert.equal(y.mediaContextItemsObservedCaptureYear,x.contextRows);
  assert.equal(y.mediaDistinctSourceDocumentsWithinYear,x.distinctSourceDocumentsWithinYear);
 }
 assert.equal(m.totals.study2021To2025ContextRows,794);
 assert.equal(m.totals.outsideStudyYearsContextRows,154);
 assert.equal(m.totals.allCaptureYearsContextRows,948);
 assert.equal(c.sourceProofMilestones.mediaSourceDocumentsSummedWithinYears,688);
 assert.equal(c.acceptanceUnknowns.mediaSenatorNamedQuoteCertifiedCount,null);
 assert.equal(c.acceptanceUnknowns.mediaAllStatewideHistoricalPublisherArticleDenominator,null);
});
test('only actual senator campaign source excerpts; 2026 observed publisher snippets remain historically unproven',()=>{
 const s=sources.campaignSixServed as string;
 assert.match(s,/six actual senators, twenty short attributed research leads/i);
 assert.match(s,/sixteen issue excerpts have original archived page public-by dates/i);
 assert.match(s,/four are historically UNVERIFIED/i);
 assert.equal(c.sourceProofMilestones.campaignEverServedSenatorSourcePersonCount,6);
 assert.equal(c.sourceProofMilestones.campaignDatedSourceResearchExcerpts,20);
 assert.equal(c.sourceProofMilestones.campaignHistoricalArchiveCaptureProvenExcerpts,16);
 assert.equal(c.sourceProofMilestones.campaign2026OnlyObservedExcerpts,4);
 assert.equal(c.acceptanceUnknowns.statewideEverServedSenatorCampaignWebsiteAndIssueVersionDenominator,null);
});
test('explicitly unknown complete denominator and historical freeze cannot be promoted by parser counts',()=>{
 for(const [k,v] of Object.entries(c.acceptanceUnknowns)){
  if(/denominator|complete$/i.test(k)&&typeof v==='boolean') assert.equal(v,false,k);
 }
 assert.equal(c.acceptanceUnknowns.officialStatewide2021to2025SenateCommitteeRecordedVoteDenominator,null);
 assert.equal(c.acceptanceUnknowns.privateSourceToExistingHistoricalEvidencePerRowComplete,false);
 assert.equal(c.acceptanceUnknowns.historicalFourBucketCompletenessCertified,false);
 assert.equal(c.dateRules.officialCommitteeHearingActionAvailableOnActualHearingDate,true);
 assert.equal(c.dateRules.committeeSameDayForecastEligibilityWithoutMotionClock,false);
 assert.equal(c.dateRules.financeLegalReleaseFloorNotIndependentHistoricallyProvenPublicBy,true);
 assert.equal(c.permissionsAndFreeze.noAutomaticMemberVotesFromAggregatesOrAttendance,true);
 assert.equal(c.permissionsAndFreeze.noNonServingPeoplePromotedAsSenatorCampaignPositions,true);
 assert.equal(c.permissionsAndFreeze.noProductionReadWriteOrModelServingSchedulerChanges,true);
 assert.equal(c.permissionsAndFreeze.issue864MustRemainOpen,true);
});
