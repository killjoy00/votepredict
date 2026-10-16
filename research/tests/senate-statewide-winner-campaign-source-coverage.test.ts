import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,statSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import seeds from '../../data/evaluation/senate-sos-campaign-website-seeds-2021-25-v1.json' with {type:'json'};
import {
 auditStatewideSenateCampaignSourceRecovery,type HistoricalOriginalGeneralCensus,
} from '../../src/evidence/senate-statewide-winner-campaign-source-coverage.js';
const observed=seeds.winners;
function verifiedSenatorsFixture(){
 // An independently documented member can win elections in multiple years.
 // The directory has ONE row per person, with combined service terms.
 // Never create one fake person per election-winner observation.
 const members=new Map<string,{
   officialName:string;officialNameRaw:string;
   officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir';
   senateServiceTerms:Array<{startsYear:number;endsYear:number;district:string}>;
 }>();
 for(const observation of observed){
   const norm=observation.candidateName.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/);
   const id=(norm[0]??'')+'|'+(norm.at(-1)??'');
   const sourceYear=observation.sourceId==='sos-general-2020'?2021:
     observation.sourceId==='sos-general-2022'?2023:2025;
   const endYear=observation.sourceId==='sos-general-2020'?2022:
     observation.sourceId==='sos-general-2022'?2024:2026;
   const existing=members.get(id);
   const term={startsYear:sourceYear,endsYear:endYear,district:observation.district};
   if(existing)existing.senateServiceTerms.push(term);
   else members.set(id,{
     officialName:observation.candidateName,officialNameRaw:observation.candidateName,
     officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
     senateServiceTerms:[term],
   });
 }

 return {
  schema:'mn-lrl-official-senate-ever-served-directory-v1' as const,
  source:{
   url:'https://www.lrl.mn.gov/legdb/senate_dir' as const,
   observedAt:'2026-10-10T19:00:00.000Z',sourceBytesSha256:'a'.repeat(64),
   sourceBytesLength:310000,
   originalHistoricDateForDisplayedDirectoryEstablished:false as const,
   directoryIsSenatorServiceNotCandidateFiling:true as const,
  },
  senators:[
   ...members.values(),
   // An independent previously served Senate member also qualifies after a lost election.
   {
     officialName:'Jerry Relph',officialNameRaw:'Relph, Jerry',
     officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir' as const,
     senateServiceTerms:[{startsYear:2017,endsYear:2020,district:'14'}],
   },
  ],
 };
}
function fakeOriginal(year:2020|2022):HistoricalOriginalGeneralCensus{
 const winners=observed.filter(c=>c.sourceId==='sos-general-'+year);
 const extra=year===2020?79:64;
 return {
  schema:'senate-official-general-2020-22-original-result-census-v1',
  officialGeneralElectionDate:year===2020?'2020-11-03':'2022-11-08',
  source:{
   originalResultSha256:year===2020
    ?'c2937b1fee5ae077603d892adf03c4ce83e2bb2592753680d5bfdeb4aecf7ba5'
    :'eb8980245094cf8af0cd08a69c42ae0262fb5a692b09a49be2aee959aecaae74',
   originalCandidateLookupSha256:year===2020
    ?'8a0596d788b651ec27c05aa576bed31a3a51efd83c2cd2ee2ae5fdcc2f02965a'
    :'0973d5962a0afc830ac9374c43f70269871a6377d956b552065c0cf06bec3538',
   originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence:true,
   bothOriginalGovernmentFilesPresentAndStructurallyCrossChecked:true,
   originalSOSFiledCandidateWebsiteFieldVerified:false,
   completeHistoricalFilingUniverseVerified:false,
  },
  totals:{
   senateDistricts:67,uniqueNamedBallotCandidates:year===2020?146:131,
   nonWriteinElectionWinnerCandidates:67,nonwinningNamedCandidates:extra,
   writeInAggregateRows:67,certifiedOriginalFiledCandidateUniverse:false,
  },
  candidates:[
   ...winners.map(x=>({
    electionYear:year,candidateName:x.candidateName,district:x.district,
    generalOutcome:'winner' as const,
    sourceEvidenceClass:'postvote_election_result_identity_only' as const,
    campaignWebsiteOriginalSOSFilingField:null,eligibleForHistoricalPreVoteForecast:false as const,
   })),
   ...Array.from({length:extra},(_,i)=>({
    electionYear:year,candidateName:year===2020&&i===0?'Jerry Relph':'Mock Defeated Candidate '+i,
    district:year===2020&&i===0?'14':String((i%67)+1),generalOutcome:'nonwinner' as const,
    sourceEvidenceClass:'postvote_election_result_identity_only' as const,
    campaignWebsiteOriginalSOSFilingField:null,eligibleForHistoricalPreVoteForecast:false as const,
   })),
  ],
 };
}
test('never publish unverified person names as actual senators based only on SOS winner status',()=>{
 const report=auditStatewideSenateCampaignSourceRecovery();
 assert.equal(report.totals.electionWinnerObservationsUsedOnlyForSourceJoin,139);
 assert.equal(report.totals.namedSenatorOnlyElectionObservationsConfirmedByLRL,0);
 assert.equal(report.totals.electionWinnersWithoutIndependentLRLServiceMatchExcluded,139);
 assert.deepEqual(report.senatorElectionObservations,[]);
 assert.equal(report.scope.onlyVerifiedEverServedPeopleIncluded,true);
});
test('139 post-election winner observations with separately confirmed LRL terms, NOT 139 unique seated senators',()=>{
 const r=auditStatewideSenateCampaignSourceRecovery(undefined,verifiedSenatorsFixture());
 assert.equal(r.totals.electionWinnerObservationsUsedOnlyForSourceJoin,139);
 assert.equal(r.totals.namedSenatorOnlyElectionObservationsConfirmedByLRL,139);
 assert.equal(r.totals.original2020And2022WinnerObservationsUsedInternallyForJoin,134);
 assert.equal(r.totals.special2024And2025WinnerObservationsUsedInternallyForJoin,5);
 assert.deepEqual(r.cohorts.map(x=>[x.cohort,x.verifiedEverServedSenatorElectionObservations]),
  [['2020_general',67],['2022_general',67],['2024_special',1],['2025_special',4]]);
 assert.equal(r.scope.statewideMemberYearCompletenessCertified,false);
 assert.equal(r.scope.independentStatewideLegislatorMembershipRosterReconciled,true);
 assert.equal(r.scope.aMissingSourceIsNotAProvenAbsentCampaignWebsite,true);
 assert.ok(r.senatorElectionObservations.every(x=>
  x.membershipId===null&&!x.actualLegislativeMembershipStartEndVerified
  &&x.immediateForecastEvidenceAdmissions===0));
});
test('historical source page recovery numerator, site URL leads and 2022 survey must remain distinct',()=>{
 const r=auditStatewideSenateCampaignSourceRecovery(undefined,verifiedSenatorsFixture());
 assert.equal(r.totals.winnerWebsitePublisherLinkLeads,4);
 assert.equal(r.totals.winnerOriginalHistoricIssuePageSources,3);
 assert.equal(r.totals.winningCandidateOwnedArchivedIssueExcerptLeads,10);
 assert.equal(r.totals.winnerPublisherSurveyQuotesWithoutHistoricalPublicBy,4);
 assert.equal(r.totals.verifiedSenatorElectionObservationsWithoutAuthenticatedHistoricIssuePage,136);
 assert.equal(r.totals.neverServedOpponentIssueExcerptsExcludedFromNamedOutput,true);
 assert.equal(r.totals.historicOriginalSOSFilingWebsiteAssignments,0);
 assert.equal(r.totals.statementsAdmittedToForecast,0);
 assert.equal(r.cohorts[0].archivedOriginalCampaignIssuePageWinners,0);
 assert.equal(r.cohorts[1].archivedOriginalCampaignIssuePageWinners,0);
 assert.equal(r.cohorts[1].winnersWithUnverified2022CandidateSurveyQuote,2);
 assert.equal(r.cohorts[2].archivedOriginalCampaignIssuePageWinners,1);
 assert.equal(r.cohorts[3].archivedOriginalCampaignIssuePageWinners,2);
});
test('named 2025 winners have source-specific proof; Amanda website lead is not historic issue text',()=>{
 const r=auditStatewideSenateCampaignSourceRecovery(undefined,verifiedSenatorsFixture());
 const pick=(name:string,year?:number)=>r.senatorElectionObservations.find(x=>
   x.candidateName===name&&(year===undefined||x.electionYear===year));
 // Same senator appears as a 2020 general winner AND a 2024 special winner;
 // the verified 2024 platform must not be retrospectively attributed to 2020.
 assert.equal(pick('Ann Johnson Stewart',2024)?.independentHistoricalOriginalCampaignPageCount,1);
 assert.equal(pick('Ann Johnson Stewart',2020)?.independentHistoricalOriginalCampaignPageCount,0);
 assert.equal(pick('Keri Heintzeman')?.originalCampaignIssueShortExcerptLeads,3);
 assert.equal(pick('Michael Holmstrom Jr')?.originalCampaignIssueShortExcerptLeads,3);
 assert.equal(pick('Amanda Hemmingsen-Jaeger')?.candidateWebsitePublisherLeads.length,1);
 assert.equal(pick('Amanda Hemmingsen-Jaeger')?.independentHistoricalOriginalCampaignPageCount,0);
 assert.equal(pick('Doron Clark')?.candidateWebsitePublisherLeads.length,0);
 assert.equal(pick('Doron Clark')?.websiteAbsentIndependentlyProven,false);
 assert.equal(pick('Rob Kupec')?.candidateSubmitted2022PublisherSurveyExcerptLeads,2);
 assert.equal(pick('Michael Kreun')?.candidateSubmitted2022PublisherSurveyExcerptLeads,2);
 assert.ok(!r.senatorElectionObservations.some(x=>x.candidateName==='Louis McNutt'));
});
test('both state original result audits must reconcile all 67 exact winning name and district identities',()=>{
 const yes=auditStatewideSenateCampaignSourceRecovery({
  y2020:fakeOriginal(2020),y2022:fakeOriginal(2022),
 },verifiedSenatorsFixture());
 assert.equal(yes.totals.originalGovernmentCensusesReconciledInThisRun,2);
 assert.ok(yes.senatorElectionObservations.filter(x=>x.electionYear===2020
  ||x.electionYear===2022).every(x=>x.independentOriginalGeneralCensusCrossMatchedInThisRun));
 const one=fakeOriginal(2020);
 one.candidates.find(x=>x.generalOutcome==='winner'&&x.district==='4')!.candidateName='Different Person';
 assert.throws(()=>auditStatewideSenateCampaignSourceRecovery({
  y2020:one,y2022:fakeOriginal(2022),
 }),/mismatched separately downloaded original SOS candidate/);
});
test('historically serving senator is retained when later losing an election; never-served opponents stay anonymous',()=>{
 const yes=auditStatewideSenateCampaignSourceRecovery({
  y2020:fakeOriginal(2020),y2022:fakeOriginal(2022),
 },verifiedSenatorsFixture());
 assert.equal(yes.totals.everServedSenatorsWhoLostAGeneralRaceAlsoIncluded,1);
 assert.equal(yes.totals.generalCandidateNonwinnerObservationsWithoutIndependentSenateServiceExcluded,142);
 assert.equal(yes.actualSenatorCampaignElectionsTheyLost.length,1);
 const former=yes.actualSenatorCampaignElectionsTheyLost[0];
 assert.equal(former.candidateName,'Jerry Relph');
 assert.equal(former.campaignElectionOutcome,'lost_this_election_but_actual_senate_member');
 assert.equal(former.officialLRLTerm,'2017-2020 SD14');
 assert.equal(former.actuallyServedNextTermFromThisElection,false);
 assert.equal(former.originalSOSGeneralCandidateResultRetrievedOn,'2026-10-10');
 assert.equal(former.policyPositionSourceDate,null);
 assert.equal(former.preElectionForecastEvidenceAdmitted,0);
 assert.ok(!JSON.stringify(yes).includes('Mock Defeated Candidate'));
});
test('source audit fails closed on fake filing evidence, postvote forecast availability or missing original source',()=>{
 const y20=fakeOriginal(2020),y22=fakeOriginal(2022);
 assert.throws(()=>auditStatewideSenateCampaignSourceRecovery({y2020:y20}),
  /Both raw-original/);
 const invalid=fakeOriginal(2020);
 invalid.candidates[0].eligibleForHistoricalPreVoteForecast=true as false;
 assert.throws(()=>auditStatewideSenateCampaignSourceRecovery({
  y2020:invalid,y2022:y22,
 }),/corrupted or backdated/);
 const bad=fakeOriginal(2022);
 bad.source.originalResultSha256='b'.repeat(64);
 assert.throws(()=>auditStatewideSenateCampaignSourceRecovery({
  y2020:y20,y2022:bad,
 }),/original byte provenance/);
});
test('offline CLI preserves explicit no-production/no-member-year status and refuses overwrites',()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-statewide-source-cohorts-'));
 try{
  const output=join(dir,'report.json');
  const argv=['--import','tsx','scripts/audit-senate-statewide-campaign-source-coverage-offline.ts'];
  execFileSync('node',[...argv,'--output',output],{timeout:20000,stdio:'pipe'});
  const obj=JSON.parse(readFileSync(output,'utf8'));
  assert.equal(obj.totals.electionWinnerObservationsUsedOnlyForSourceJoin,139);
  assert.equal(obj.totals.namedSenatorOnlyElectionObservationsConfirmedByLRL,0);
  assert.equal(obj.senatorElectionObservations.length,0);
  assert.equal(obj.totals.originalGovernmentCensusesReconciledInThisRun,0);
  assert.equal(obj.cliOriginalSOSSourceBytesRehashedAndCrosschecked,false);
  assert.equal(obj.scope.statewideMemberYearCompletenessCertified,false);
  assert.equal(statSync(output).mode&0o777,0o600);
  assert.throws(()=>execFileSync('node',[...argv,'--output',output],{timeout:20000,stdio:'pipe'}));
  writeFileSync(join(dir,'fake-sos.txt'),'not valid election file');
  assert.throws(()=>execFileSync('node',[...argv,'--2020-st',join(dir,'fake-sos.txt'),
   '--output',join(dir,'second.json')],{timeout:20000,stdio:'pipe'}));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
