/**
 * #864: require ORIGINAL 2022 campaign platform HTML for exactly three more
 * people independently proven by LRL to have ACTUALLY served in Senate.
 * All 25 source-exact short campaign page statements are rechecked against
 * independently indexed Wayback SHA-1 and original HTML SHA-256.
 *
 * IMPORTANT historical attribution: Bonnie Westlin's Jan 2022 page is
 * older SD34 candidate-site copy. It is observed in 2022, but never labeled
 * a newly issued 2022 SD42 campaign policy page. This matters more than
 * guessing that a previous campaign's web text was renewed for a new race.
 * No network, production DB, evidence ingestion, bill votes or forecasting.
 */
import research from '../../data/evaluation/senate-three-2022-original-sites-25-short-excerpt-proofs-v1.json' with {type:'json'};
import {recheckOriginalHistoricalExcerpt,originalCampaignVisibleText} from
 './senate-authenticated-campaign-excerpt-audit.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory} from
 './senate-official-ever-served-directory.js';
import {ISSUE_POSITION_FAMILIES} from './issue-position-extractor.js';

export const THREE_NEW_SERVED_SENATOR_2022_CAMPAIGN_EXCERPT_VERSION=
 'mn-2022-original-three-additional-served-senator-page-25-issue-excerpts-v1' as const;
const PINS=[
 {id:'judy22',name:'Judy Seeberger',district:'41',
  file:'judy22-original-20220805034927-0.html',
  url:'https://judyforsenate.com/priorities/',
  capture:'2022-08-05T03:49:27.000Z',
  observed:'2026-10-11T02:06:25.331Z',
  sha:'6e11f2eb741a078ee976a16c6689fce4d3bc3f0a2b5f6b11d592ecd8d8bd2b38',
  digest:'ZHWCYBNABFKNGLESR4MQ4CFNEYW7WMYX',
  excerptCount:7,contextStart:'Judy’s Priorities',contextEnd:'News Donate Photos',
  historicClass:'2022_senate_campaign_page',
 },
 {id:'bonnie22',name:'Bonnie Westlin',district:'42',
  file:'bonnie22-original-20220122104435-0.html',
  url:'https://www.bonniewestlinformnsenate.com/legislative-issues/',
  capture:'2022-01-22T10:44:35.000Z',
  observed:'2026-10-11T02:06:29.273Z',
  sha:'9ea89e6cb9dea726cef81a44edac9b390c2fd3ab6d51cac4b46a94fc4f8fbb08',
  digest:'4FWFR6YJFJ6KMEGU6Z4G3FUTQ327ESPN',
  excerptCount:8,contextStart:'MY LEGISLATIVE PRIORITIES',
  contextEnd:'Endorsements “Women Winning',
  historicClass:'2022_archived_older_sd34_campaign_copy_not_certified_2022_sd42_website',
 },
 {id:'steve22',name:'Steve Cwodzinski',district:'49',
  file:'steve22-original-20220805062728-0.html',
  url:'https://cwodforsenate.com/vision',
  capture:'2022-08-05T06:27:28.000Z',
  observed:'2026-10-11T02:06:31.170Z',
  sha:'a0c53827a068bea8186b022b50ff1981ed510a1af15ef70fe807188fed53f1df',
  digest:'SKLV4TI26GL5YYMCYANAXILAMII4F3YE',
  excerptCount:10,contextStart:'STEVE’S VISION',
  contextEnd:'About Vision Endorsements Media Volunteer',
  historicClass:'2022_senate_reelection_campaign_page',
 },
] as const;
type SiteId=typeof PINS[number]['id'];
export type SourcePages={
 judy22:Uint8Array;bonnie22:Uint8Array;steve22:Uint8Array;
};
export type AcquiredOriginalPageManifest={
 schema?:string;
 totals?:{
  onlyOfficialActuallyServedSenatorsExamined?:number;
  actualOriginalHtmlDigestAndCdxMatched?:number;
  candidateIssueExcerptPositionRowsPromoted?:number;
  productionModelOrDbWrites?:number;
 };
 senators?:Array<{
  person?:string;districtAt2022Election?:string;
  indexSuccessfullyParsed?:boolean;
  officialSourceOriginalHtmlSha256?:string;
  replays?:Array<{
   originalHtmlFile?:string;originalCampaignUrl?:string;
   archiveCapturedAtUtc?:string;originalWaybackCdxDigestSha1Base32?:string;
   originalHtmlSourceSha256?:string;
   independentActualArchivedHtmlEqualsOriginalCdxDigest?:boolean;
   originalPageIncludesSenatorCampaignIdentity?:boolean;
   originalHttp?:{observedAtUtc?:string;status?:number|null};
  }>;
 }>;
};
const isUtc=(x:string)=>{
 const t=Date.parse(x);return Number.isFinite(t)&&new Date(t).toISOString()===x;
};

export function auditThreeMoreActuallyServedSenator2022OriginalIssueExcerpts(
 official:AuditedOfficialSenateDirectory,
 source:{acquisition:AcquiredOriginalPageManifest;originalHtml:SourcePages},
){
 const a=source.acquisition;
 if(research.schema!=='senate-three-new-actually-served-2022-archive-25-excerpt-source-proof-v1'
    ||research.scope.issue!==864||research.scope.sourceYear!==2022
    ||research.scope.actualSenatePeople!==3||research.scope.shortExcerpts!==25
    ||research.scope.originalHistoricalPagesContainingQuotedCampaignContent!==3
    ||research.scope.fullyContemporary2022CampaignPages!==2
    ||research.scope.archivedOlderCampaignCyclePages!==1
    ||research.scope.independent2020FirstAuthorDateProof!==false
    ||research.scope.historic2022SOSFiledWebsiteAssignment!==false
    ||research.scope.productionForecastEvidenceAdmitted!==0
    ||research.scope.legacyPriorCycleCampaignTextNotMisattributedTo2022Election!==true
    ||research.sourceAcquisition.githubRunId!==38104021609
    ||research.sourceAcquisition.originalArtifactId!==11688119728
    ||research.sourceAcquisition.originalArchiveZipSha256!==
      'fff6f706ed765d27e3be6a116b89d73c4cc22b59071a9dfe7bb39ea9678fa1cc'
    ||research.pages.length!==3||research.statements.length!==25)
   throw Error('Acquisition provenance or original three-member campaign excerpt sample changed');
 if(a.schema!=='senate-three-2022-original-served-candidate-campaign-domains-v1'
   ||a.totals?.onlyOfficialActuallyServedSenatorsExamined!==3
   ||a.totals?.actualOriginalHtmlDigestAndCdxMatched!==9
   ||a.totals?.candidateIssueExcerptPositionRowsPromoted!==0
   ||a.totals?.productionModelOrDbWrites!==0
   ||a.senators?.length!==3
   ||Object.keys(source.originalHtml).length!==3
   ||Object.keys(source.originalHtml).some(k=>!PINS.some(p=>p.id===k)))
  throw Error('Original archive acquisition manifest missing or tries to promote unaudited issue stances');
 const records=[];
 const uniqueIDs=new Set<string>();
 let spanChecks=0;
 for(const pin of PINS){
  const service=validateActualSenateServiceForElection(
   official,pin.name,pin.district,2022);
  if(service.status!=='verified_senate_service'
    ||service.serviceForThisElectionFollowingYearVerified!==true
    ||!service.officialName||!service.term
    ||!service.officialServiceSource?.startsWith('https://www.lrl.mn.gov/'))
   throw Error('Actual Senate service person and election-specific term must be independently verified');
  const sourcePage=research.pages.find(s=>s.id===pin.id);
  const original=a.senators.find(s=>s.person===pin.name
    &&s.districtAt2022Election===pin.district);
  const replay=original?.replays?.find(p=>p.originalHtmlFile===pin.file);
  const bytes=source.originalHtml[pin.id as SiteId];
  if(!sourcePage||!original||!replay
    ||original.officialSourceOriginalHtmlSha256!==official.source.sourceBytesSha256
    ||original.indexSuccessfullyParsed!==true
    ||sourcePage.person!==pin.name||sourcePage.district!==pin.district
    ||sourcePage.historicalClass!==pin.historicClass
    ||sourcePage.originalFile!==pin.file
    ||sourcePage.originalUrl!==pin.url
    ||sourcePage.capture!==pin.capture
    ||sourcePage.observed!==pin.observed
    ||sourcePage.sha!==pin.sha||sourcePage.digest!==pin.digest
    ||sourcePage.shortStatementCount!==pin.excerptCount
    ||replay.originalCampaignUrl!==pin.url
    ||replay.archiveCapturedAtUtc!==pin.capture
    ||replay.originalHtmlSourceSha256!==pin.sha
    ||replay.originalWaybackCdxDigestSha1Base32!==pin.digest
    ||replay.originalHttp?.observedAtUtc!==pin.observed
    ||replay.originalHttp?.status!==200
    ||replay.independentActualArchivedHtmlEqualsOriginalCdxDigest!==true
    ||replay.originalPageIncludesSenatorCampaignIdentity!==true
    ||!isUtc(pin.capture)||!isUtc(pin.observed)
    ||pin.capture>='2022-11-08T00:00:00.000Z'
    ||pin.capture<'2022-01-01T00:00:00.000Z'
    ||!bytes||bytes.length<100||bytes.length>2_500_000)
   throw Error('Missing real independently indexed pre-election 2022 source bytes or exact capture metadata');
  const visible=originalCampaignVisibleText(bytes);
  const start=visible.indexOf(pin.contextStart);
  const end=visible.indexOf(pin.contextEnd,start+pin.contextStart.length);
  if(start<0||end<start+50||!visible.includes(pin.name)
    ||pin.id==='bonnie22'&&!visible.includes('TurnSD34Blue')
    ||pin.id==='steve22'&&!visible.includes('Steve Cwodzinski for Senate')
    ||pin.id==='judy22'&&!visible.includes('Judy Seeberger for MN Senate'))
   throw Error('Archived campaign page lacks original historically attributable platform section or legacy-cycle warning');
  const section=visible.slice(start,end);
  const rows=research.statements.filter(s=>s.sourcePageId===pin.id);
  if(rows.length!==pin.excerptCount
    ||rows.some(s=>s.person!==pin.name))
   throw Error('Additional original campaign quote count or person identity changed');
  const proofs=rows.map(q=>{
   if(uniqueIDs.has(q.id)||!q.id
     ||typeof q.exactExcerpt!=='string'
     ||q.exactExcerpt.length<9||q.exactExcerpt.length>130
     ||q.exactExcerpt!==q.exactExcerpt.replace(/\s+/g,' ').trim()
     ||!ISSUE_POSITION_FAMILIES.includes(q.issueFamily as typeof ISSUE_POSITION_FAMILIES[number])
     ||!q.conservativeInterpretation||q.conservativeInterpretation.length>240
     ||q.sourceIsCandidateOwnedSiteContent!==true
     ||q.personallySpokenVerbatimNotProven!==true
     ||q.sourceCaptureIsNotOriginalFirstPost!==true
     ||q.actualLegislativeVoteProven!==false
     ||q.eligibleForAutomaticHistoricalForecast!==false
     ||pin.id==='bonnie22'&&q.sourceStatementCharacter!=='platform_support_older_cycle'
     ||pin.id!=='bonnie22'&&!['expressed_commitment','policy_priority','claimed_prior_support'].includes(q.sourceStatementCharacter)
     ||!section.includes(q.exactExcerpt))
    throw Error('Quoted Senator campaign issue text not attributable to verified original platform section or campaign cycle');
   uniqueIDs.add(q.id);
   const checked=recheckOriginalHistoricalExcerpt({
    originalHtml:bytes,expectedOriginalHtmlSha256:pin.sha,
    expectedHistoricalCdxPayloadDigestSha1Base32:pin.digest,
    shortExcerpt:q.exactExcerpt,
   });
   spanChecks++;
   if(!checked.exactVisibleExcerptCrossChecked)
    throw Error('Archived original candidate statement was not independently byte rechecked');
   return{
    quoteId:q.id,senatorName:pin.name,
    independentlyOfficialSenateServiceName:service.officialName,
    verifiedSenateServiceTerm:service.term,
    issueFamily:q.issueFamily,quotedOriginalCampaignSiteExcerpt:q.exactExcerpt,
    sourceStatementCharacter:q.sourceStatementCharacter,
    conservativeInterpretation:q.conservativeInterpretation,
    originalSiteUrl:pin.url,originalArchiveCaptureAtUtc:pin.capture,
    currentOriginalAcquisitionObservedAtUtc:pin.observed,
    independentOriginalHtmlSha256:pin.sha,
    independentWaybackOriginalCdxPayloadSha1Base32:pin.digest,
    originalCampaignCycleClass:pin.historicClass,
    sourcePageIsCapturedIn2022:true as const,
    originatedByCandidateIn2022SeparatelyProven:false as const,
    treatedAsRenewed2022SD42CampaignStatement:false as const,
    originalAuthorFirstPostedAtUtc:null,
    exactPolicyTextVisibleWithinCandidateOwnedSection:true as const,
    exactOriginalHtmlAndIndexedDigestRechecked:true as const,
    originalSosFiledCampaignWebsiteFieldVerified:false as const,
    billVoteOrLegislativeAccomplishmentIndependentlyVerified:false as const,
    automaticallyEligibleForAnyForecast:false as const,
    productionEvidenceRecordId:null,
   };
  });
  records.push({
   senatorName:pin.name,officialSenateName:service.officialName,
   officialSenateTerm:service.term,
   campaignCohort2022SenateDistrict:pin.district,
   historicalCapturedPageCycleClass:pin.historicClass,
   originalPageUrl:pin.url,originalPageFile:pin.file,
   historicallyAttestedOriginalHtmlCaptureAtUtc:pin.capture,
   actual2026ArchivedOriginalHtmlRetrievedAtUtc:pin.observed,
   sourceOriginalHtmlSha256:pin.sha,indexedIndependentOriginalSha1:pin.digest,
   historicallyAuthenticatedShortPolicyExcerpts:proofs,
  });
 }
 const modern22=records.filter(p=>
  p.historicalCapturedPageCycleClass!==
   '2022_archived_older_sd34_campaign_copy_not_certified_2022_sd42_website');
 const legacy=records.filter(p=>
  p.historicalCapturedPageCycleClass===
   '2022_archived_older_sd34_campaign_copy_not_certified_2022_sd42_website');
 if(records.length!==3||modern22.length!==2||legacy.length!==1
   ||spanChecks!==25||uniqueIDs.size!==25
   ||modern22.flatMap(x=>x.historicallyAuthenticatedShortPolicyExcerpts).length!==17
   ||legacy.flatMap(x=>x.historicallyAuthenticatedShortPolicyExcerpts).length!==8)
  throw Error('Only original 2022 senator campaign pages with explicit legacy-cycle class may be reported');
 return{
  schema:THREE_NEW_SERVED_SENATOR_2022_CAMPAIGN_EXCERPT_VERSION,
  officialVerifiedSenateDirectory:{
   sourceUrl:official.source.url,
   originalHtmlSha256:official.source.sourceBytesSha256,
   actuallyObservedAtUtc:official.source.observedAt,
  },
  originalSourceAcquisition:{
   githubRunId:research.sourceAcquisition.githubRunId,
   archivedSourceArtifactId:research.sourceAcquisition.originalArtifactId,
   originalArchiveZipSha256:research.sourceAcquisition.originalArchiveZipSha256,
  },
  totals:{
   additionalIndependentlyVerifiedActualSenatePeople:3,
   authenticOriginal2022IssuePagesIndependentlyReopened:records.length,
   candidateSourceTextStatementsRechecked:spanChecks,
   sourcePolicyStatementsFromContemporaneous2022ElectionPages:17,
   sourcePolicyStatementsFromPriorDistrictCampaignCopyOnlyObservedIn2022:8,
   totalPreviouslyVerifiedPersonResearchLeads:59,
   combinedHistoricallyDateAttestedPlusPublisherResearchLeads:84,
   automaticForecastEvidenceRowsAdmitted:0,
  },
  strictLimits:[
   'Bonnie Westlin original 2022 archived issues page visibly says District 34 and #TurnSD34Blue, so do not attribute it as a newly authored 2022 District 42 election platform.',
   'Original archive attests visible candidate-owned text no later than recorded 2022 capture, not original first author-post time or campaign-year adoption.',
   'Each quote is a candidate-campaign site passage, not necessarily personally spoken, a legislative vote, an accomplished enactment or a bill-level recorded preference.',
   'Archived original hashes and historical independent CDX SHA1 were checked against the source bytes in this audit. Full 2022 SOS filing website source field is not authenticated.',
   'This is three additional actual Minnesota Senate members, not complete statewide source coverage or authorization to alter evidence, forecasts, historical evaluations or databases.',
  ],
  senators:records,
 };
}
