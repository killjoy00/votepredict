/**
 * #864 historical Senate campaign policy quotations -> official election
 * winners -> (optional) explicitly-authorized, SELECT-ONLY membership/evidence
 * snapshot. No Neon/Vercel queries, model changes or evidence writes.
 *
 * A post-election winner is an IDENTITY JOIN only: NOT a forecast feature.
 * Never inherit a defeated opponent's campaign positions in the seat.
 */
import originals from '../../data/evaluation/senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1.json' with {type:'json'};
import priorSeeds from '../../data/evaluation/senate-sos-campaign-website-seeds-2021-25-v1.json' with {type:'json'};
import {strictCandidateKey,type SenateSosSeedManifest} from './sos-senate-historical-candidate-inventory.js';
import type {ExcerptLedger} from './senate-authenticated-campaign-excerpt-audit.js';

export const SENATE_CAMPAIGN_WINNER_RECONCILIATION_VERSION='senate-2022-25-winning-campaign-source-join-v1' as const;
export type SessionSlug='2023-2024'|'2025-2026';
export interface OutcomeRecord {
  sourceId:string;electionOn:string;district:string;candidateName:string;votes:number;
  generalElectionOutcome:'winner'|'loser';
  resultDataClass:'post_election_result_only';
  sourceIsPreElectionEvidence:false;
  candidateSourceWebsiteOfficialSOSFieldUnverified:true;
  earlyUseAsModelFeatureProhibited:true;
}
export interface OutcomeSource{
  id:string;publisher:'Minnesota Secretary of State';kind:string;
  electionOn:string;district:string;resultUrl:string;
  requiredMembershipSessionForRetrospectiveIdentity:SessionSlug;
  winnersKnownToForecastOnlyAfterElection:true;
}
export interface OutcomeManifest{
  schema:'mn-sos-targeted-senate-general-election-outcomes-2022-25-v1';
  scope:{
    observedRaces:number;winnerKnownOnlyAfterElection:true;
    officialResultPagesIdentifiedAsUnofficialTallies:true;
    fullStatewideElectionUniverseCertified:false;
    noDbMembershipIds:true;noProductionDatabaseReadOrWrite:true;
  };
  sources:OutcomeSource[];
  candidates:OutcomeRecord[];
}
export interface ExportMember{
  membershipId:string;
  senatorName:string;sessionSlug:SessionSlug;district:string;
  startsOn:string|null;endsOn:string|null;
  party:string; recordedIssuePositionItems:number;
}
export interface ExportEvidence {
  evidenceItemId:string;membershipId:string;sourceDocumentId:string;
  sourceUrl:string;sourceContentSha256:string;sourceKind:string;
  sourceSubtype:string|null;contextType:string|null;issueFamily:string|null;
  stance:string|null;publishedAt:string|null;
  excerptMatches:Array<{excerptId:string;exactExcerptPresent:boolean}>;
}
export interface RestrictedMemberExport {
  schema:'senate-campaign-membership-evidence-ro-export-v1';
  scope:{
    kind:'direct_neon_protected_sandbox_read_only';
    defaultProductionFalse:true;
    readOnlyTransactionConfirmed:true;
    restrictedDatabaseRoleValidated:true;
    session:'2025-2026';
    checkedDistricts:string[];
    completenessOfDistrictSnapshot:boolean;
    connectedToActualProductionEvidence:false;
    doesNotAssertProductionCompleteness:true;
  };
  exportedAt:string;members:ExportMember[];evidence:ExportEvidence[];
}
function id(s:string):boolean{return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);}
function isoDate(d:string):number{
  if(!/^\d{4}-\d\d-\d\d$/.test(d))throw Error('Election calendar date malformed');
  const ms=Date.parse(d+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==d)
    throw Error('Impossible election calendar date');
  return ms;
}
function isoCapture(date:string):number{
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.000)?Z$/.test(date))
    throw Error('Capture UTC timestamp malformed');
  const ms=Date.parse(date);
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,19)!==date.slice(0,19))
    throw Error('Capture UTC timestamp impossible');
  return ms;
}
function key(name:string,dist:string):string{return strictCandidateKey(name)+'|'+dist;}
const requiredElections=new Map([
  ['2022|4','Rob Kupec'],['2022|32','Michael Kreun'],
  ['2024|45','Ann Johnson Stewart'],['2025|6','Keri Heintzeman'],
  ['2025|29','Michael Holmstrom Jr'],['2025|47','Amanda Hemmingsen-Jaeger'],
]);
function validatedSourceOutcomes(official:OutcomeManifest){
  if(official.schema!=='mn-sos-targeted-senate-general-election-outcomes-2022-25-v1'
    ||official.scope.observedRaces!==6
    ||official.scope.winnerKnownOnlyAfterElection!==true
    ||official.scope.officialResultPagesIdentifiedAsUnofficialTallies!==true
    ||official.scope.fullStatewideElectionUniverseCertified!==false
    ||official.scope.noDbMembershipIds!==true
    ||official.scope.noProductionDatabaseReadOrWrite!==true
    ||official.sources.length!==6||official.candidates.length!==12)
    throw Error('Unexpected or upgraded official result claim');
  const srcMap=new Map<string,OutcomeSource>(),winnerCount=new Map<string,number>();
  for(const source of official.sources){
    if(srcMap.has(source.id)||source.publisher!=='Minnesota Secretary of State'
      ||source.winnersKnownToForecastOnlyAfterElection!==true
      ||source.kind!=='official_publisher_unofficial_general_results_post_vote_identity_only'
      ||!source.resultUrl.startsWith('https://electionresults.sos.mn.gov/')
      ||!['2022','2024','2025'].includes(source.electionOn.slice(0,4))
      ||!['2023-2024','2025-2026'].includes(source.requiredMembershipSessionForRetrospectiveIdentity)
      ||!requiredElections.has(source.electionOn.slice(0,4)+'|'+source.district))
      throw Error('Unverifiable general election result source');
    isoDate(source.electionOn);
    srcMap.set(source.id,source);
  }
  const rows=new Map<string,OutcomeRecord>(),seen=new Set<string>();
  for(const c of official.candidates){
    const s=srcMap.get(c.sourceId);
    if(!s||s.district!==c.district||s.electionOn!==c.electionOn
      ||c.resultDataClass!=='post_election_result_only'
      ||c.sourceIsPreElectionEvidence!==false
      ||c.candidateSourceWebsiteOfficialSOSFieldUnverified!==true
      ||c.earlyUseAsModelFeatureProhibited!==true
      ||!['winner','loser'].includes(c.generalElectionOutcome)
      ||!Number.isSafeInteger(c.votes)||c.votes<=0)
      throw Error('Invalid or backdated candidate election result');
    const k=s.electionOn+'|'+key(c.candidateName,c.district);
    if(seen.has(k))throw Error('Duplicate official candidate identity');
    seen.add(k);rows.set(k,c);
    if(c.generalElectionOutcome==='winner')winnerCount.set(c.sourceId,(winnerCount.get(c.sourceId)??0)+1);
  }
  for(const src of official.sources){
    if(winnerCount.get(src.id)!==1)throw Error('Exactly one winner expected for target Senate race');
    const expected=requiredElections.get(src.electionOn.slice(0,4)+'|'+src.district);
    if(official.candidates.find(c=>c.sourceId===src.id&&c.generalElectionOutcome==='winner')
      ?.candidateName!==expected)throw Error('Expected independently checked Senate winner does not match SOS observations');
  }
  return {sources:srcMap,byIdentity:rows};
}
function memberExportValid(exported:RestrictedMemberExport) {
  if(exported.schema!=='senate-campaign-membership-evidence-ro-export-v1'
    ||exported.scope.kind!=='direct_neon_protected_sandbox_read_only'
    ||exported.scope.defaultProductionFalse!==true
    ||exported.scope.readOnlyTransactionConfirmed!==true
    ||exported.scope.restrictedDatabaseRoleValidated!==true
    ||exported.scope.connectedToActualProductionEvidence!==false
    ||exported.scope.doesNotAssertProductionCompleteness!==true
    ||exported.scope.session!=='2025-2026'
    ||exported.scope.completenessOfDistrictSnapshot!==true
    ||exported.scope.checkedDistricts.slice().sort().join('|')!=='29|45|6'
    ||exported.members.length>12||exported.evidence.length>300)
    throw Error('Read-only sandbox source not sufficiently scoped or validated');
  isoCapture(exported.exportedAt);
  const ids=new Set<string>();
  for(const m of exported.members){
    if(!id(m.membershipId)||ids.has(m.membershipId)||m.sessionSlug!=='2025-2026'
      ||!['6','29','45'].includes(m.district)||!m.senatorName||!m.party
      ||!Number.isSafeInteger(m.recordedIssuePositionItems)||m.recordedIssuePositionItems<0
      ||m.recordedIssuePositionItems>100_000)
      throw Error('Incorrect or duplicated member id/session/source export');
    ids.add(m.membershipId);
    if(m.startsOn)isoDate(m.startsOn);
    if(m.endsOn)isoDate(m.endsOn);
    if(m.startsOn&&m.endsOn&&m.startsOn>m.endsOn)
      throw Error('Impossible membership dates');
  }
  const evidenceIds=new Set<string>();
  for(const e of exported.evidence){
    if(!id(e.evidenceItemId)||evidenceIds.has(e.evidenceItemId)
      ||!id(e.membershipId)||!ids.has(e.membershipId)
      ||!id(e.sourceDocumentId)
      ||!e.sourceUrl.startsWith('http')
      ||!/^([0-9a-f]{64})$/.test(e.sourceContentSha256)
      ||e.contextType!=='issue_position'
      ||e.sourceSubtype!=='campaign_site_page'
      ||!Array.isArray(e.excerptMatches)||e.excerptMatches.length>13)
      throw Error('Unscoped or invalid campaign-only evidence row');
    evidenceIds.add(e.evidenceItemId);
    if(e.publishedAt)isoCapture(e.publishedAt);
    if(e.excerptMatches.some(m=>typeof m.excerptId!=='string'||typeof m.exactExcerptPresent!=='boolean'))
      throw Error('Invalid existing database excerpt match');
  }
}
export function reconcileHistoricalCampaignWinnerExcerpts(
  official:OutcomeManifest,
  ledger:ExcerptLedger=originals as unknown as ExcerptLedger,
  exported?:RestrictedMemberExport,
){
  const checked=validatedSourceOutcomes(official);
  if(ledger.schema!=='senate-authenticated-campaign-policy-excerpt-leads-2024-25-v1'
    ||ledger.scope.attributableShortExcerptLeads!==13
    ||ledger.scope.eligibleForImmediateForecast!==0
    ||ledger.candidates.length!==4)
    throw Error('Unrecognized or promoted original issue excerpt ledger');
  if(exported)memberExportValid(exported);
  const prior=priorSeeds as SenateSosSeedManifest;
  const winnerSeed=new Set(prior.winners.map(w=>key(w.candidateName,w.district)));
  const membershipMap=new Map<string,ExportMember[]>();
  for(const m of exported?.members??[]){
    const k=key(m.senatorName,m.district);
    membershipMap.set(k,[...(membershipMap.get(k)??[]),m]);
  }
  const memberRows=exported?.evidence??[];
  const outputs=[];
  let winners=0,losers=0,winnerExcerpts=0,loserExcerpts=0,joined=0,ambiguous=0;
  let existingExactExcerpts=0,originalPageHashMatches=0;
  for(const c of ledger.candidates){
    const year=c.electionYear,dist=c.district;
    if(!/^\d{1,2}$/.test(dist)||year!==2024&&year!==2025)
      throw Error('Unexpected policy excerpt year/district');
    const source=official.sources.find(s=>s.electionOn.slice(0,4)===String(year)&&s.district===dist);
    if(!source)throw Error('Archived issue-page candidate missing official result race');
    const outcome=checked.byIdentity.get(source.electionOn+'|'+key(c.candidateName,dist));
    if(!outcome)throw Error('Archived campaign page cannot be joined to a named official ballot candidate');
    const count=c.excerpts.length;
    if(count<1||count>13||c.excerpts.some(e=>e.immediatelyEligibleForForecast!==false))
      throw Error('Promotion of unreviewed campaign excerpt');
    const winner=outcome.generalElectionOutcome==='winner';
    if(winner){
      winners++;winnerExcerpts+=count;
      if(!winnerSeed.has(key(c.candidateName,dist)))
        throw Error('SOS independent post-election winner seed disagreement');
    }else{losers++;loserExcerpts+=count;}
    const possibilities=winner?membershipMap.get(key(c.candidateName,dist))??[]:[];
    const eligible=possibilities.filter(m=>{
      const last=m.endsOn?isoDate(m.endsOn):Date.UTC(2026,11,31);
      const start=m.startsOn?isoDate(m.startsOn):Date.UTC(2025,0,1);
      return last>=isoDate(source.electionOn)&&start<=Date.UTC(2026,11,31);
    });
    if(eligible.length>1)ambiguous++;
    const m=eligible.length===1?eligible[0]:null;
    if(m)joined++;
    const rows=m?memberRows.filter(row=>row.membershipId===m.membershipId):[];
    let contentMatches=0,exactMatches=0;
    for(const row of rows){
      if(row.sourceContentSha256===c.originalHtmlSource.originalHtmlResponseSha256)
        contentMatches++;
      for(const hit of row.excerptMatches) {
        if(hit.exactExcerptPresent&&c.excerpts.some(e=>e.id===hit.excerptId))
          exactMatches++;
      }
    }
    existingExactExcerpts+=exactMatches;
    originalPageHashMatches+=contentMatches;
    outputs.push({
      candidateName:c.candidateName,electionYear:year,district:dist,
      officialResultSourceUrl:source.resultUrl,
      generalElectionOn:source.electionOn,
      postElectionWinnerEvidenceOnly:true,
      electionOutcome:outcome.generalElectionOutcome,
      candidateIssueExcerptLeads:count,
      historicCaptureAt:c.originalHtmlSource.sourceArchiveCaptureAt,
      retrospectiveSessionTarget:source.requiredMembershipSessionForRetrospectiveIdentity,
      eligibleForForecastNow:false,
      loserIssuePositionsMustNotAttachToWinner:!winner,
      readOnlyDatabaseExportProvided:Boolean(exported),
      membershipJoinStatus:!winner?'losing_opponent_excluded':
        !exported?'not_queried':
        eligible.length>1?'ambiguous_multiple_memberships':
        eligible.length===1?'unique_name_district_session_and_date_match':
        'member_not_in_restricted_snapshot',
      membershipId:m?.membershipId??null,
      existingCampaignSiteIssueItemsInSnapshot:m?.recordedIssuePositionItems??null,
      existingCampaignSiteEvidenceRowsInExport:exported?(m?rows.length:0):null,
      exactExistingExcerptSpanMatches:exported?(m?exactMatches:0):null,
      matchingOriginalHtmlSha256SourceRows:exported?(m?contentMatches:0):null,
      sourceWebsiteFieldFromOfficialHistoricalFilingProven:false,
      verifiedPrimaryCutoffEligibility:false,
      actualProductionEvidenceRead:false,
    });
  }
  if(winners!==3||losers!==1||winnerExcerpts!==10||loserExcerpts!==3)
    throw Error('Unexpected winner/loser identity attribution or issue excerpt counts');
  return {
    schema:SENATE_CAMPAIGN_WINNER_RECONCILIATION_VERSION,
    scope:{
      electionYears:[2024,2025],officialOutcomeOnlyAfterVote:true,
      sourceIsNotPreElectionForecastFeature:true,
      noProductionReadsOrWritesByThisReconciler:true,
      actualProductionDBEvidenceAudited:false,
      sandboxOnlyExportAccepted:Boolean(exported),
      statewideSenatorCampaignCompletenessCertified:false,
      historical2020to2022OriginalWebsiteFilingsComplete:false,
      authorizedProductionEvidenceReconciliationComplete:false,
      modelEvidenceInserted:0,
    },
    totals:{
      electionOutcomeRacesCrossChecked:official.sources.length,
      candidateIssuePageLeadsChecked:winners+losers,
      winnerCandidateSources:winners,loserCandidateSources:losers,
      winnerIssueExcerptLeads:winnerExcerpts,loserIssueExcerptLeads:loserExcerpts,
      uniquelyJoinedRestrictedSandboxMemberships:joined,ambiguousMembershipCandidates:ambiguous,
      restrictedSandboxSameOriginalHtmlHashEvidenceRows:exported?originalPageHashMatches:null,
      restrictedSandboxExistingExactExcerptSpanHits:exported?existingExactExcerpts:null,
      forecastEligibleEvidenceRows:0,
    },
    sourceRows:outputs,
    limitations:[
      'Elections are post-vote identity sources, not eligible as pre-vote features.',
      'Defeated candidates never inherit the winner membership; matching district alone is insufficient.',
      '2024/2025 archive captures have attested publication UPPER bounds, not website post dates.',
      'A protected sandbox export cannot claim production roster/evidence completeness.',
      'No direct production connection, Vercel environment or evidence ingestion was performed.',
    ],
  };
}
