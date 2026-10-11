/**
 * #864 C: deeper ORIGINAL campaign-page policy coverage for ACTUALLY SERVED
 * Minnesota senators. Combines v1's 24 source leads with 35 extra visibly
 * attested campaign passages, without equating claimed prior action with a
 * verified bill/vote. Rechecks all 9 source HTML versions and 109 quote spans.
 * Reused original source archives, no production/forecast/network behavior.
 */
import additions from '../../data/evaluation/senate-original-campaign-additional-35-statement-excerpts-v1.json' with {type:'json'};
import archivedIndex from '../../data/evaluation/senate-wayback-real-cdx-selected-replay-2024-25-v1.json' with {type:'json'};
import {
 combineSevenActuallyServedDatedCampaignIssueSources,
 type AllSevenSenatorOriginals,
 type DatedSenatorIssueStatement,
} from './senate-seven-served-person-dated-campaign-coverage.js';
import {recheckOriginalHistoricalExcerpt}
 from './senate-authenticated-campaign-excerpt-audit.js';
import {ISSUE_POSITION_FAMILIES} from './issue-position-extractor.js';
import type {AuditedOfficialSenateDirectory}
 from './senate-official-ever-served-directory.js';

export const DEEPER_2022_TO_2025_SERVED_SENATOR_CAMPAIGN_STATEMENTS=
 'senate-2022-25-seven-actually-served-59-dated-excerpt-source-ledger-v2' as const;
export type AdditionalOriginalAnnPages={
 ann2024OctOriginal:Uint8Array;
 ann2024NovOriginal:Uint8Array;
};
export type DeeperSenatorCampaignOriginals=
 AllSevenSenatorOriginals&AdditionalOriginalAnnPages;

const expectedByPerson={
 'Carla Nelson':6,'Nicole Mitchell':2,'Ann Johnson Stewart':14,
 'Keri Heintzeman':4,'Michael Holmstrom Jr':9,
} as const;
type Person=keyof typeof expectedByPerson;
const annLater=[
 {id:'snapshot-02',filename:'wayback-replay-snapshot-02.html',
  capture:'2024-10-10T02:14:35.000Z',
  sha256:'c1824620e9fa2421489e74705eabfbdcd106e2d23e63576d8de5dc3616b57398',
  digest:'PYSWN7TK5UMHYD2D7MPXRDJ4MCXF2K6Y'},
 {id:'snapshot-03',filename:'wayback-replay-snapshot-03.html',
  capture:'2024-11-03T07:19:05.000Z',
  sha256:'0656a2fa39cc7caff89e905f8d257eb568266e1db6e213441836d8769e2eeac8',
  digest:'DUWLEMDJ27HQ5LD4D2AA7GEZXDMLZDOL'},
] as const;
type SourceVersion={
 id:string;html:Uint8Array;sha256:string;digest:string;
 capturedAtUtc:string;url:string;
};

/** Do not assume later dated archived pages contain the earlier text without
 * individually reopening and authenticating BOTH exact original page bytes.
 */
export function verifyTwoLaterAnn2024OriginalPageVersions(
 pages:AdditionalOriginalAnnPages,quote:string,
):Array<{id:string;originalHtmlSha256:string;archivedAtUtc:string;sourceUrl:string}>{
 const originals=[pages.ann2024OctOriginal,pages.ann2024NovOriginal];
 if(originals.some(b=>!(b instanceof Uint8Array)||b.byteLength<100||b.byteLength>3_000_000))
  throw Error('Both real later 2024 Ann campaign page HTML versions are required');
 return annLater.map((p,i)=>{
  const index=archivedIndex.targets.find(t=>t.id===p.id);
  if(!index||index.candidateName!=='Ann Johnson Stewart'
    ||index.district!=='45'||index.electionYear!==2024
    ||index.capturedAt!==p.capture||index.cdxDigest!==p.digest
    ||index.originalUrl!=='https://annjohnsonstewart.com/priorities/'
    ||index.archiveUrl!==
      'https://web.archive.org/web/'+p.capture.replace(/\D/g,'').slice(0,14)+'id_/'+index.originalUrl)
   throw Error('Independently indexed later Ann historical Senate campaign page identity changed');
  recheckOriginalHistoricalExcerpt({
   originalHtml:originals[i],
   expectedOriginalHtmlSha256:p.sha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:p.digest,
   shortExcerpt:quote,
  });
  return{id:p.id,originalHtmlSha256:p.sha256,
   archivedAtUtc:p.capture,sourceUrl:index.originalUrl};
 });
}

function sourceVersions(person:Person,base:DatedSenatorIssueStatement,
 inputs:DeeperSenatorCampaignOriginals,
):SourceVersion[]{
 if(!base.authenticatedHistoricalOriginalPage
   ||!base.originalHistoricCaptureAtUtc
   ||!base.independentlyIndexedHistoricCdxDigestSha1Base32
   ||base.originalAuthorFirstPostedAtUtc!==null
   ||base.originalFiledSosWebsiteFieldVerified!==false
   ||base.historicalForecastFeatureAutomaticallyEligible!==false)
  throw Error('Cannot attach claimed historic quote to an unauthenticated campaign original');
 const firstHtml=person==='Carla Nelson'?inputs.carla['carla-2022-page-a']:
  person==='Nicole Mitchell'?inputs.nicole['nicole2022-priorities-feb01']:
  person==='Ann Johnson Stewart'?inputs.archived2024to25['snapshot-01']:
  person==='Keri Heintzeman'?inputs.archived2024to25['snapshot-05']:
  inputs.archived2024to25['snapshot-09'];
 if(!(firstHtml instanceof Uint8Array))
  throw Error('Missing original first campaign page for an actual served senator');
 const versions:SourceVersion[]=[{
  id:'original-first',html:firstHtml,sha256:base.originalSourceSha256,
  digest:base.independentlyIndexedHistoricCdxDigestSha1Base32,
  capturedAtUtc:base.originalHistoricCaptureAtUtc,url:base.originalSourceUrl,
 }];
 if(person==='Carla Nelson'||person==='Nicole Mitchell'){
  const next=person==='Carla Nelson'?
    inputs.carla['carla-2022-page-b']:
    inputs.nicole['nicole2022-priorities-nov05'];
  if(!(next instanceof Uint8Array)
     ||!base.secondOriginalHtmlSha256
     ||!base.secondIndependentHistoricCdxDigestSha1Base32
     ||!base.secondIndependentCaptureAtUtc)
   throw Error('Second independent 2022 exact original page required');
  versions.push({
   id:'original-repeated-2022',html:next,sha256:base.secondOriginalHtmlSha256,
   digest:base.secondIndependentHistoricCdxDigestSha1Base32,
   capturedAtUtc:base.secondIndependentCaptureAtUtc,
   url:person==='Carla Nelson'?'https://www.carlanelson.com/home-page-2/':
     base.originalSourceUrl,
  });
 }
 if(person==='Ann Johnson Stewart')
  versions.push(...annLater.map((p,i)=>({
   id:p.id,
   html:i===0?inputs.ann2024OctOriginal:inputs.ann2024NovOriginal,
   sha256:p.sha256,digest:p.digest,capturedAtUtc:p.capture,
   url:'https://annjohnsonstewart.com/priorities/',
  })));
 return versions;
}

/** Existing baseline's seven named actual senators, 24 source excerpts, and
 * 30 raw-byte hash/quote checks are mandatory before adding any new excerpt.
 * New statements have no inferred member vote or legislation and do not
 * establish the candidate's actual first publication date.
 */
export function deepenActualSenatorHistoricalCampaignStatementLedger(
 official:AuditedOfficialSenateDirectory,inputs:DeeperSenatorCampaignOriginals,
){
 const baseline=combineSevenActuallyServedDatedCampaignIssueSources(official,inputs);
 if(additions.schema!=='mn-senate-additional-original-campaign-issue-short-excerpts-v1'
   ||additions.scope.issue!==864
   ||additions.scope.newSourceTextExcerptCount!==35
   ||additions.scope.nonSenatorStatementCount!==0
   ||additions.scope.extraQuotedStatementsAreNotProofOfLegislativeActions!==true
   ||additions.scope.sourceIsNotProductionEvidence!==true
   ||additions.scope.partOfCompleteStatewideCorpus!==false
   ||additions.rows.length!==35
   ||baseline.totals.actualSenators!==7
   ||baseline.totals.shortAttributedIssueStatements!==24
   ||baseline.totals.authenticatedHistoricalCampaignExcerpts!==20
   ||baseline.totals.originalHistoricalCampaignHtmlVersionsRechecked!==7
   ||baseline.totals.originalHtmlExactVisibleQuoteSpanChecks!==30)
  throw Error('Previously authenticated senator-only excerpt baseline or additional campaign fixture changed');

 const original=baseline.senators.flatMap(s=>s.sourceStatements);
 const allIds=new Set(original.map(s=>s.quoteId));
 const knownExcerpts=new Set(original.map(s=>s.senatorName+'|'+s.exactAttributedExcerpt));
 const actualVersions=new Map<Person,SourceVersion[]>();
 const checks=new Map<string,Array<{
  sourceId:string;sourceUrl:string;historicalCapturedAtUtc:string;
  originalHtmlSha256:string;indexedOriginalCdxSha1:string;
  exactExcerptSourceByteHashMatched:true;exactVisibleExcerptMatched:true;
 }>>();
 const annex=additions.rows.map(q=>{
  if(!(q.person in expectedByPerson))
   throw Error('Named campaign excerpts require actual independently attested Senate service, never just candidate status');
  const person=q.person as Person;
  if(!ISSUE_POSITION_FAMILIES.includes(q.family as typeof ISSUE_POSITION_FAMILIES[number])
   ||!['claimed_past_action','expressed_commitment','policy_priority'].includes(q.statementCharacter)
   ||!q.id||allIds.has(q.id)||typeof q.exactShortExcerpt!=='string'
   ||q.exactShortExcerpt.length<9||q.exactShortExcerpt.length>130
   ||q.exactShortExcerpt!==q.exactShortExcerpt.replace(/\s+/g,' ').trim()
   ||knownExcerpts.has(person+'|'+q.exactShortExcerpt)
   ||!q.conservativeInterpretation||q.conservativeInterpretation.length>240
   ||q.sourceAttributionType!=='candidate_owned_campaign_platform_copy_not_necessarily_spoken_verbatim'
   ||q.billVoteIndependentlyProven!==false
   ||q.originalAuthorFirstPublicationTimeKnown!==false
   ||q.autoForecastEligible!==false)
   throw Error('Ambiguous, duplicate, wrong-family, personally misattributed or prematurely admitted campaign issue excerpt');
  allIds.add(q.id);
  knownExcerpts.add(person+'|'+q.exactShortExcerpt);
  const senator=baseline.senators.find(s=>s.name===person);
  const reference=senator?.sourceStatements.find(s=>s.authenticatedHistoricalOriginalPage);
  if(!senator||!reference||reference.senatorName!==person
     ||!reference.verifiedSenateServiceTerm
     ||!reference.officialLRLSenatorName)
   throw Error('Senator campaign person must be independently shown to have ACTUALLY SERVED');
  const versions=actualVersions.get(person)??sourceVersions(person,reference,inputs);
  actualVersions.set(person,versions);
  const sourceChecks=versions.map(v=>{
   if(!(v.html instanceof Uint8Array)
      ||v.capturedAtUtc<reference.originalHistoricCaptureAtUtc!
      ||v.capturedAtUtc>=reference.electionDay+'T00:00:00.000Z')
    throw Error('Later campaign copies cannot be backdated or assigned after original general election');
   recheckOriginalHistoricalExcerpt({
    originalHtml:v.html,expectedOriginalHtmlSha256:v.sha256,
    expectedHistoricalCdxPayloadDigestSha1Base32:v.digest,
    shortExcerpt:q.exactShortExcerpt,
   });
   return{
    sourceId:v.id,sourceUrl:v.url,historicalCapturedAtUtc:v.capturedAtUtc,
    originalHtmlSha256:v.sha256,indexedOriginalCdxSha1:v.digest,
    exactExcerptSourceByteHashMatched:true as const,
    exactVisibleExcerptMatched:true as const,
   };
  });
  checks.set(q.id,sourceChecks);
  return{
   ...reference,
   quoteId:q.id,issueFamily:q.family,
   exactAttributedExcerpt:q.exactShortExcerpt,
   conservativeIssueInterpretation:q.conservativeInterpretation,
   statementCharacter:q.statementCharacter,
   campaignTextAttributionKind:q.sourceAttributionType,
   claimedPriorActionRequiresIndependentLegislativeVerification:
     q.statementCharacter==='claimed_past_action',
   individualBillSupportOppositionOrVoteProven:false as const,
   personallySpokenVerbatimByCandidateIndependentlyProven:false as const,
   expansionSource:'additional_original_campaign_site_human_reviewed_excerpt_v1' as const,
   historicalOriginalCopiesWithExactQuoteRechecked:sourceChecks,
  };
 });
 const byPerson=Object.entries(expectedByPerson).map(([name,count])=>({
  name,additionalShortCampaignStatements:annex.filter(q=>q.senatorName===name).length,
  expected:count,
 }));
 if(byPerson.some(x=>x.additionalShortCampaignStatements!==x.expected))
  throw Error('Silent scope drift in 2022-2025 served-senator campaign expansion');

 // Additionally re-open BOTH later 2024 Ann originals for each of the four
 // previously published Ann excerpts. Later capture ≠ guaranteed old text.
 const earlierAnn=baseline.senators.find(s=>s.name==='Ann Johnson Stewart');
 if(!earlierAnn||earlierAnn.sourceStatements.length!==4)
  throw Error('Cannot independently reconcile previous Ann excerpts to later original pages');
 const annOldProof=earlierAnn.sourceStatements.map(q=>({
  quoteId:q.quoteId,
  laterIndependentVerifiedCaptures:verifyTwoLaterAnn2024OriginalPageVersions(
   inputs,q.exactAttributedExcerpt),
 }));
 if(annOldProof.some(p=>p.laterIndependentVerifiedCaptures.length!==2))
  throw Error('All four original 2024 Ann passages need both later versions rechecked');
 const expanded=baseline.senators.map(s=>({
  ...s,
  sourceStatements:[
   ...s.sourceStatements.map(row=>({
    ...row,expansionSource:'previously_verified_seven_senator_ledger_v1' as const,
   })),
   ...annex.filter(row=>row.senatorName===s.name),
  ],
 }));
 const all=expanded.flatMap(s=>s.sourceStatements);
 const originalCampaign=all.filter(s=>s.authenticatedHistoricalOriginalPage);
 const publisherModern=all.filter(s=>!s.authenticatedHistoricalOriginalPage);
 const extraQuoteChecks=[...checks.values()].reduce((n,x)=>n+x.length,0);
 const priorAnnLaterProofChecks=annOldProof.reduce(
  (n,p)=>n+p.laterIndependentVerifiedCaptures.length,0);
 const totalSpanChecks=baseline.totals.originalHtmlExactVisibleQuoteSpanChecks+
  extraQuoteChecks+priorAnnLaterProofChecks;
 if(all.length!==59||allIds.size!==59
   ||originalCampaign.length!==55||publisherModern.length!==4
   ||annex.length!==35||extraQuoteChecks!==71||priorAnnLaterProofChecks!==8
   ||totalSpanChecks!==109
   ||expanded.length!==7
   ||all.some(s=>s.admittedProductionEvidenceId!==null
      ||s.historicalForecastFeatureAutomaticallyEligible!==false
      ||s.originalAuthorFirstPostedAtUtc!==null))
  throw Error('Raw-source verified 59-excerpt senator-only historical coverage unexpectedly changed');
 return{
  schema:DEEPER_2022_TO_2025_SERVED_SENATOR_CAMPAIGN_STATEMENTS,
  originalOfficialSenateServiceSource:baseline.officialSenatorServiceSource,
  sourceControls:{
   actuallyServedIndividualProvenByOfficialLRLOriginalHtml:true,
   historicalCampaignSourceBytesRequiredForEveryNewExcerpt:true,
   bothLaterAnnOriginalsByteAndCdxVerified:true,
   original2022AuthorshipFirstPostedDateUnknown:true,
   modernPublisherOnly2022BackdatingForbidden:true,
   pastLegislativeAccomplishmentClaimsNotIndependentVoteProof:true,
   original2020And2022SOSCampaignWebsiteFilingFieldVerified:false,
   originalStatewideCampaignCorpusComplete:false,
   noProductionDBReadWriteEvidenceAdmissionTrainingOrForecast:true,
  },
  totals:{
   namedActualSenatePeople:expanded.length,
   previousShortStatementLeads:original.length,
   newHumanReviewedSourceStatementLeads:annex.length,
   datedShortStatementResearchLeads:all.length,
   independentlyDateAttestedOriginalCampaignExcerptLeads:originalCampaign.length,
   modernPublisherOnlyHistoricallyUnattestedExcerpts:publisherModern.length,
   candidateSiteOriginalHtmlVersionsReopenedAndVerified:9,
   baselineOriginalSpanChecks:baseline.totals.originalHtmlExactVisibleQuoteSpanChecks,
   extraExcerptOriginalHtmlSpanChecks:extraQuoteChecks,
   legacyAnnQuoteLater2024OriginalRechecks:priorAnnLaterProofChecks,
   totalExactOriginalHtmlAndHistoricalCdxExcerptChecks:totalSpanChecks,
   neverServedPoliticiansIncluded:0,forecastRowsAutomaticallyAdmitted:0,
  },
  ann2024LegacyReattestation:annOldProof,
  additionalStatementSourceProofs:[...checks.entries()].map(([id,p])=>({
   quoteId:id,originalVersions:p,
  })),
  byPersonNewExcerptCounts:byPerson.map(({name,additionalShortCampaignStatements})=>({
   senatorName:name,additionalShortCampaignStatements,
  })),
  limitations:[
   'All excerpts are source-site campaign messaging; a third-person campaign paragraph is not a personally spoken quote.',
   'Claimed legislative accomplishments require separate roll/text and vote verification; no retrospective vote or bill support inferred.',
   'Source exact text is historically attested by the archived capture, not by an independently known first author-posted date.',
   'The four modern Ballotpedia candidate questionnaires have no independent 2022 original-page text proof and keep 2026 observation dates.',
   'Holmstrom 2025-08-26 site capture is not proven available before a same-day primary forecast cutoff.',
   'The 59 short excerpts cover seven actual senators, not a complete statewide 2021-25 senate website/page/issue-denominator census.',
  ],
  senators:expanded,
 };
}
