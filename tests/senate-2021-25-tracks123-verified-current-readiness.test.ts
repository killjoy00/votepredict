import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import test from 'node:test';

/** #864 — source-file-identity-pinned original evidence vs actual private DB gates.
 * Research-only; NO application/Postgres client, remote access or production write. */
const mainPath='docs/evaluation/source-proof/senate-2021-25-tracks123-verified-current-readiness.json';
const j=JSON.parse(readFileSync(mainPath,'utf8'));
const load=(key:string):Buffer=>readFileSync(j.sourcePins[key].path);
const parse=(key:string):any=>JSON.parse(load(key).toString('utf8'));
const psv=(key:string):string[][]=>load(key).toString('utf8').trimEnd().split('\n').map(x=>x.split('|'));
const blob=(bytes:Buffer):string=>
 createHash('sha1').update('blob '+bytes.byteLength+'\0').update(bytes).digest('hex');

test('nine original independently acquired upstream ledgers have exactly pinned immutable Git blob hashes',()=>{
 assert.equal(j.issue,864);
 assert.equal(j.schema,'mn-2021-25-Senate-three-tracks-source-proof-and-private-readonly-db-gate-v2');
 assert.equal(Object.keys(j.sourcePins).length,9);
 for(const entry of Object.values(j.sourcePins) as Array<{path:string;sha:string}>){
  assert.ok(entry.path.startsWith('docs/')||entry.path.startsWith('data/evaluation/'));
  assert.match(entry.sha,/^[a-f0-9]{40}$/);
  assert.equal(blob(readFileSync(entry.path)),entry.sha,'Modified source ledger '+entry.path);
 }
});

test('71 authentic observed source references have precisely 68 original PDF identities, two source holds, one same-PDF alias, zero proved historical public-by',()=>{
 const a=psv('finance');assert.equal(a.length,71);
 assert.equal(new Set(a.map(x=>x[0])).size,71);
 assert.ok(a.every(x=>x.length===21));
 const cnt=(kind:string)=>a.filter(x=>x[8]===kind).length;
 assert.equal(cnt('original_pdf_first_page_authenticated'),43);
 assert.equal(cnt('distinct_authenticated_amended_pdf'),25);
 assert.equal(cnt('HOLD_source_pdf_not_authenticated'),1);
 assert.equal(cnt('HOLD_first_page_registration_unverified'),1);
 assert.equal(cnt('duplicate_official_amendment_reference_pdf_alias'),1);
 const yes=a.filter(x=>x[8]==='original_pdf_first_page_authenticated'
  ||x[8]==='distinct_authenticated_amended_pdf');
 assert.equal(new Set(yes.map(x=>x[7])).size,68);
 assert.ok(a.every(x=>x[18]==='false'&&x[20]==='historical_public_display_not_independently_proven'));
 assert.equal(new Set(a.map(x=>x[3])).size,j.finance.actualServedSenatorPanel);
 assert.equal(j.finance.yearEnd2023And2024VersionReferences,71);
 assert.equal(j.finance.authenticDistinctOriginalPdfBodies,68);
 assert.equal(j.finance.originalIdentityHolds,2);
 assert.equal(j.finance.duplicateOfficialVersionAlias,1);
 assert.equal(j.finance.exactPublicByHistReportVersionsProven,0);
 assert.equal(j.finance.legallyOwed2021To2025ReportDenominator,null);
});

test('two original Minnesota Revenue PCR source years produce 38 distinct reg-year matches and six explicitly not observed',()=>{
 const a=psv('revenue');assert.equal(a.length,44);
 assert.equal(new Set(a.map(x=>x[0]+':'+x[2])).size,44);
 assert.equal(new Set(a.map(x=>x[2])).size,22);
 assert.equal(a.filter(x=>x[8]==='independent_named_PCR_register_row').length,38);
 assert.equal(a.filter(x=>x[8]==='not_observed_in_this_retrospective_PCR_list').length,6);
 assert.ok(a.every(x=>x[10]==='unknown_actual_2023_CFb_registration_status'
   &&x[11]==='unknown_actual_2024_CFb_registration_status'));
 assert.equal(j.finance.independentlyObservedRevenueCommitteeYears,38);
 assert.equal(j.finance.independentlyCheckedRevenueCommitteeYears,44);
});

test('five 2025/26 authentic government report identities do not become 2023/24 report or termination claims',()=>{
 const rows=psv('terminated');
 assert.equal(rows.length,5);assert.equal(new Set(rows.map(x=>x[3])).size,5);
 assert.equal(new Set(rows.map(x=>x[4])).size,5);
 assert.ok(rows.every(x=>x.length===16&&/^[a-f0-9]{64}$/.test(x[4]??'')
  &&x[11]==='authenticated_official_original_full_PDF_identity'
  &&x[13]==='unknown_actual_legally_effective_termination_mechanism'
  &&x[15]==='unknown_historic_pdf_version_public_by'));
 assert.deepEqual(rows.map(x=>x[3]).sort(),[
  '17362:25:pcc:YE:0:0',
  '18763:25:pcc:YE:0:0','18763:25:pcc:YE:0:1',
  '18763:26:pcc:YE:0:0','18763:26:pcc:YE:0:1',
 ]);
 assert.equal(rows.filter(x=>x[0]==='18763').length,4);
 assert.equal(rows.filter(x=>x[0]==='17362').length,1);
 assert.equal(j.finance.official2026RecentTermination.registration,'18763');
 assert.equal(j.finance.official2026RecentTermination.registeredOn,'2022-02-07');
 assert.equal(j.finance.official2026RecentTermination.terminatedOn,'2026-09-05');
 assert.match(j.finance.official2026RecentTermination.officialFullAPIbodySHA256,/^[a-f0-9]{64}$/);
 assert.equal(j.finance.official2026RecentTermination.originalAPIbytes,3121);
 assert.equal(j.finance.official2026RecentTermination.notProofTerminatedIn2023Or2024,true);
 assert.equal(j.finance.andersonExactTerminationDate,null);
});

test('2021 original print vote denominator unknown; 2022-25 electronically indexed 1592 meetings and 141 unlinked remain separate',()=>{
 const a=parse('committee'),s=parse('prior'),missing=parse('unlinked');
 assert.equal(a.totals.indexedMeetings,1592);
 assert.equal(a.totals.meetingsWithoutMinutes,141);
 assert.equal(a.totals.originalPdfLinks,1452);
 assert.equal(s.sourceProofMilestones.recoveredByOcr,207);
 assert.equal(missing.meetingGroups.reduce((n:number,g:any)=>n+g.missingMinutesMeetingDates.length,0),141);
 assert.equal(j.committee.electronicIndexedMeetings2022To2025,1592);
 assert.equal(j.committee.withOriginalMinutes,1451);
 assert.equal(j.committee.withoutOriginalMinutes,141);
 assert.equal(j.committee.originalMinutesPdfUrls,1452);
 assert.equal(j.committee.previouslyRecoveredOriginalOCR,207);
 assert.equal(j.committee.original2021OfficialPrintMeetingDenominator,null);
 assert.equal(j.committee.year2022PrintElectronicParityEstablished,false);
 assert.equal(j.committee.exactStoredVoteRowsReconciled,false);
});

test('the recent second campaign batch is separate 15 unique people/137 exact leads after first 9 unique people/61 leads',()=>{
 const a=parse('campaignFirst'),b=parse('campaignSecond');
 assert.equal(a.scope.trueServiceSenators2021To2025,95);
 assert.equal(a.scope.newActualSenatorsWithFirstPartyIssueQuotes,9);
 assert.equal(b.scope.trueActualSenators2021To2025,95);
 assert.equal(b.scope.newActuallyServingSenatorsWithOriginalFirstPartyIssueLead,15);
 assert.equal(a.excerpts.length,61);assert.equal(b.excerpts.length,137);
 const first=new Set<string>(a.pages.map((x:any)=>x.person));
 const second=new Set<string>(b.pages.map((x:any)=>x.person));
 assert.equal(first.size,9);assert.equal(second.size,15);
 assert.ok([...first].every(person=>!second.has(person)),'A supposedly new second-batch person was already in first batch');
 assert.equal(j.campaign.actualServing2021To2025StateSenators,95);
 assert.equal(j.campaign.senatorsWithOriginalFirstPartyExcerptLeads,79);
 assert.equal(j.campaign.exactOriginalExcerptResearchRows,1006);
 assert.equal(j.campaign.noSelectedExcerptLeadsCount,16);
 assert.equal(j.campaign.stillUnobservedSelectedResearchSenators.length,16);
 assert.equal(new Set(j.campaign.stillUnobservedSelectedResearchSenators).size,16);
 assert.equal(j.campaign.senatorsWithOriginalFirstPartyExcerptLeads+j.campaign.noSelectedExcerptLeadsCount,95);
 assert.equal(j.campaign.firstTwentyNewPeople,9);
 assert.equal(j.campaign.secondTwentyNewPeople,15);
 assert.equal(j.campaign.firstTwentyExactExcerpts+j.campaign.secondTwentyExactExcerpts,198);
 assert.equal(j.campaign.originalFullRosterJSONbytes,87438);
 assert.match(j.campaign.originalFullRosterJSON_SHA256,/^[a-f0-9]{64}$/);
 assert.equal(j.campaign.allOfficialFiledCampaignWebsiteAndVersionsDenominator,null);
});

test('protected original VotePredict media aggregate is real, not 794 reviewed named speech claims or an authorized row export',()=>{
 const source=parse('media'),out=j.media;
 assert.equal(source.source.workflowRunId,38093691235);
 assert.equal(source.scope.postgresTransactionRolledBack,true);
 assert.equal(source.scope.globallyStrictSelectOnlyRole,false);
 assert.equal(source.totals.study2021To2025ContextRows,794);
 assert.equal(source.totals.outsideStudyYearsContextRows,154);
 assert.equal(source.totals.allCaptureYearsContextRows,948);
 assert.equal(source.totals.study2021To2025DistinctDocsSummedByYear,688);
 for(const y of [2021,2022,2023,2024,2025]){
  assert.equal(out.contextRowsByArchiveYear[String(y)],source.studyCaptureYears[String(y)].contextRows);
 }
 assert.equal(out.privateRowExportPerformed,false);
 assert.equal(out.actuallyHumanVerifiedSenatorQuoteCount,null);
 assert.equal(out.verifiedDeployedProductionBranch,false);
 assert.equal(out.protectedOriginalSQLRoleGloballyStrictSELECTOnly,false);
});

test('source-to-existing-DB tools are present but no original row matches or completion certificate can be inferred',()=>{
 const gate=j.reconciliation;
 for(const k of ['committeeSQL','committeeOffline','financeSQL','financeOffline',
    'mediaStrictPrivateExport','mediaOffline']){
  assert.ok(existsSync(gate[k]),'Expected existing reviewed offline/private SQL route absent: '+k);
 }
 assert.equal(gate.userDirectedReadOnlyCompletion,true);
 assert.equal(gate.exactAuthorizedVotePredictRestrictedSELECTOnlyRoleAvailableInThisAudit,false);
 assert.equal(gate.fullRowLevelSourceToExistingEvidenceComplete,false);
 assert.equal(gate.noFallbackToUnrestrictedOwnerRole,true);
 assert.equal(gate.existingMediaAggregateDoesNotProveRowLevelCompleteness,true);
 assert.equal(gate.existingThreeDistrictCampaignPilotDoesNotProveStatewide,true);
 assert.equal(gate.historyCompleteAndModelEligible,false);
 assert.equal(j.freeze.noProductionDatabaseReadWriteInThisIncrement,true);
 assert.equal(j.freeze.noForecastServingModelSchedulerOr2027Actions,true);
 assert.equal(j.freeze.issue864MustStayOpen,true);
});
