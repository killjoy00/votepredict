/**
 * #864 2022 Senate candidate-written Ballotpedia issue positions.
 * Bounded offline attribution for REAL downloaded 2026 publisher HTML
 * *without* backdating publication to 2022. Publisher candidate survey is
 * NOT an original candidate-owned campaign website source.
 */
import {createHash} from 'node:crypto';
import leadData from '../../data/evaluation/senate-2022-candidate-survey-original-quote-leads-v1.json' with {type:'json'};
import official from '../../data/evaluation/senate-targeted-official-general-election-outcomes-2022-25-v1.json' with {type:'json'};
import {originalCampaignVisibleText} from './senate-authenticated-campaign-excerpt-audit.js';
import {strictCandidateKey} from './sos-senate-historical-candidate-inventory.js';
import {ISSUE_POSITION_FAMILIES} from './issue-position-extractor.js';

export const SENATE_2022_SURVEY_ATTRIBUTION_VERSION='mn-2022-senate-candidate-survey-respondent-attribution-audit-v1' as const;
type SurveySource=(typeof leadData.sources)[number];
type SurveyExcerpt=(typeof leadData.excerpts)[number];
type SurveyInputs={sd4Html?:Uint8Array;sd32Html?:Uint8Array};
const norm=(value:string)=>value.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
const speakerKey=(name:string,district:string)=>strictCandidateKey(name)+'|'+district;
const QUOTE_TYPES=new Set(['promise_action','explicit_support','explicit_opposition','priority_statement']);
const known={
 'ballotpedia-mn-senate-2022-sd4':{
  district:'4',file:'2022-sd4-ballotpedia-article.response',
  hash:'c1d0945bbcf87a0448f94a05509c65cb02202b49ed037765d6091ecfd64df038',
  candidates:['Rob Kupec','Dan Bohmer'],
 },
 'ballotpedia-mn-senate-2022-sd32':{
  district:'32',file:'2022-sd32-ballotpedia-article.response',
  hash:'a09ef6bfb9804fa885579906746a38c0fde444d4466bd000b6ea65e997793ac8',
  candidates:['Kate Luthner','Michael Kreun'],
 },
} as const;
type SourceId=keyof typeof known;
function isSourceId(x:string):x is SourceId{return x in known;}
function validMetadata(){
 if(leadData.schema!=='mn-2022-senate-candidate-submitted-publisher-policy-excerpts-v1'
   ||leadData.scope.sourceClass!=='candidate_written_quoted_survey_published_by_independent_outlet'
   ||leadData.scope.originalCampaignWebsiteSource!==false
   ||leadData.scope.independent2022ArchivePublicByProven!==false
   ||leadData.scope.earliestPreElectionAvailabilityCertified!==false
   ||leadData.scope.eligibleForImmediateForecast!==0
   ||leadData.sourceAcquisition.githubActionsRunId!==38089571113
   ||leadData.sources.length!==2||leadData.excerpts.length!==8)
   throw Error('Unrecognized or upgraded archived 2022 questionnaire claim');
 const outcomes=official.candidates.filter(x=>x.electionOn==='2022-11-08'
   &&(x.district==='4'||x.district==='32'));
 if(outcomes.length!==4)
   throw Error('SOS official 2022 winning/losing identity rows missing');
 const candidates=new Set<string>();
 for(const src of leadData.sources){
  if(!isSourceId(src.id))throw Error('Unknown newspaper source, not in bounded official discovery');
  const want=known[src.id];
  if(src.district!==want.district||src.localOriginalResponseFilename!==want.file
    ||src.acquisitionResponseBodySha256!==want.hash
    ||!src.url.startsWith('https://news.ballotpedia.org/2022/')
    ||src.dateSeenAsPageTextNotOriginalArchiveProof!==true
    ||src.historicalPublicationAttestedByIndependentArchive!==null
    ||src.speakerSections.length!==2||src.headlineDatePublishedClaim>='2022-11-08')
    throw Error('2022 publisher source provenance is not compatible with bounded observations');
  for(const section of src.speakerSections){
    const id=speakerKey(section.candidateName,src.district);
    if(!new Set<string>(want.candidates).has(section.candidateName)||candidates.has(id))
      throw Error('Invalid/duplicated 2022 candidate speaker heading');
    candidates.add(id);
    const outcome=outcomes.find(x=>speakerKey(x.candidateName,x.district)===id);
    if(!outcome||outcome.generalElectionOutcome!==section.electionOutcome)
      throw Error('Wrong official 2022 outcome: cannot import opponent quote to winner');
  }
 }
 if(candidates.size!==4)throw Error('Expected four bounded candidate respondents');
 const ids=new Set<string>();
 for(const row of leadData.excerpts){
  if(ids.has(row.id)||!row.id.startsWith('bp22-')||!isSourceId(row.sourceId)
    ||!candidates.has(speakerKey(row.candidateName,known[row.sourceId].district))
    ||row.sourceClass!=='publisher_candidate_respondent_quote_not_candidate_campaign_site'
    ||row.verifiedForHistoricalAsOf!==false||row.eligibleForForecast!==false
    ||row.historicalPublicByAt!==null||row.senatorMembershipReference!==null
    ||row.evidenceRowReference!==null||row.exactShortExcerpt.length<8
    ||row.exactShortExcerpt.length>110
    ||!ISSUE_POSITION_FAMILIES.includes(row.issueFamily as typeof ISSUE_POSITION_FAMILIES[number])
    ||!QUOTE_TYPES.has(row.candidateCommitment))
    throw Error('Invalid short candidate excerpt, issue family or historical availability');
  ids.add(row.id);
  const section=leadData.sources.find(s=>s.id===row.sourceId)?.speakerSections
    .find(s=>s.candidateName===row.candidateName);
  if(!section||section.electionOutcome!==row.electionOutcome)
    throw Error('Candidate excerpt outcome/ownership does not match publisher headings');
 }
 if(ids.size!==8)throw Error('Expected exactly eight directly attributed short survey policy excerpts');
 return outcomes;
}
/** Delimit candidate-provided quoted material by explicit named speaker labels,
 * NOT by nearby candidate mentions elsewhere in the publisher article. */
export function originalRespondentSectionText(
 html:Uint8Array,source:Pick<SurveySource,'speakerSections'>,candidateName:string,
):string{
 if(html.byteLength>600_000||!html.byteLength)
   throw Error('Publisher HTML original exceeds capped 600KiB');
 const all=originalCampaignVisibleText(html);
 const candidates=source.speakerSections;
 const section=candidates.find(s=>s.candidateName===candidateName);
 if(!section)throw Error('Candidate is not an explicitly attributed speaker in the article');
 const start=all.indexOf(section.speakerLabel);
 const end=start<0?-1:all.indexOf(section.endSpeakerLabel,start+section.speakerLabel.length);
 if(start<0||end<=start
    ||all.indexOf(section.speakerLabel,start+section.speakerLabel.length)>=0
      &&all.indexOf(section.speakerLabel,start+section.speakerLabel.length)<end)
   throw Error('Missing, duplicated or ambiguously delimited candidate response heading');
 const afterHeading=all.slice(start+section.speakerLabel.length,end).trim();
 if(afterHeading.length<20||afterHeading.length>14000)
   throw Error('Empty or unbounded named 2022 candidate answer section');
 return afterHeading;
}
export function exactPolicySpanInSpeakerSection(
 html:Uint8Array,source:Pick<SurveySource,'speakerSections'>,
 candidateName:string,excerpt:string,
):boolean{
 const section=norm(originalRespondentSectionText(html,source,candidateName));
 return section.includes(norm(excerpt));
}
export function auditSenate2022SurveyAttribution(inputs:SurveyInputs={}){
 validMetadata();
 const provided=[inputs.sd4Html,inputs.sd32Html].filter(Boolean);
 if(provided.length===1)throw Error('Both candidate 2022 publisher original responses required, not a partial cohort');
 const hasOriginals=provided.length===2;
 const sourcePayloads=new Map<string,Uint8Array>();
 if(hasOriginals){
  sourcePayloads.set('ballotpedia-mn-senate-2022-sd4',inputs.sd4Html!);
  sourcePayloads.set('ballotpedia-mn-senate-2022-sd32',inputs.sd32Html!);
 }
 const verifiedSources=[];
 for(const src of leadData.sources){
  const payload=sourcePayloads.get(src.id);
  let originalBodyMatchesSha=false;
  if(payload){
    const sha=createHash('sha256').update(payload).digest('hex');
    if(sha!==src.acquisitionResponseBodySha256)
      throw Error('2022 publisher original source SHA-256 mismatch; may have changed');
    originalBodyMatchesSha=true;
    for(const speaker of src.speakerSections)
      originalRespondentSectionText(payload,src,speaker.candidateName);
  }
  verifiedSources.push({
    sourceId:src.id,district:src.district,
    publisher:src.publisher,sourceUrl:src.url,
    originalResponseSha256:src.acquisitionResponseBodySha256,
    publisherArticleDateClaim:src.headlineDatePublishedClaim,
    local2026OriginalPublisherBodyVerified:originalBodyMatchesSha,
    independentlyVerifiedPublishedIn2022:false,
    historicalFirstPublicBy:null,
    surveyPublisherNotCampaignSite:true,
  });
 }
 const rows=leadData.excerpts.map((row:SurveyExcerpt)=>{
  const src=leadData.sources.find(s=>s.id===row.sourceId)!;
  const body=sourcePayloads.get(src.id);
  const matched=body?exactPolicySpanInSpeakerSection(body,src,row.candidateName,row.exactShortExcerpt):false;
  if(body&&!matched)throw Error('Source quote missing from explicitly named candidate respondent answer: '+row.id);
  return {
    candidateName:row.candidateName,district:src.district,
    electionYear:2022,
    postElectionOutcome:row.electionOutcome,
    sourceId:src.id,sourceUrl:src.url,
    excerptId:row.id,issueFamily:row.issueFamily,
    commitment:row.candidateCommitment,exactShortExcerpt:row.exactShortExcerpt,
    correctOriginalSpeakerSectionVerified:matched,
    originalDownloadedSourceSha256:src.acquisitionResponseBodySha256,
    independent2022PublicBy:null,
    historicalForecastEligible:false,
    eligibleAsRetrospectiveArchiveDiscoveryOnly:true,
    candidateOwnCampaignSiteStatement:false,
    isLoserExcerptNotAssignableToSenator:row.electionOutcome==='loser',
    existingEvidenceItemId:null,
  };
 });
 const win=rows.filter(r=>r.postElectionOutcome==='winner'),loss=rows.filter(r=>r.postElectionOutcome==='loser');
 if(win.length!==4||loss.length!==4)
   throw Error('Expected four directly candidate-submitted winning and losing excerpts');
 return {
  schema:SENATE_2022_SURVEY_ATTRIBUTION_VERSION,
  scope:{
    electionYear:2022,historicalTargetYears:[2023,2024,2025],
    originalPublisherHtmlRechecked:hasOriginals,
    originalCampaignSiteBytesAcquired:false,
    noIndependentBeforeElectionArchiveCapture:true,
    independentlyPublicBeforeElectionCertified:false,
    originalSOSFiledCampaignWebsiteEvidenceVerified:false,
    actualLegislatorMembershipIdsAudited:false,
    sourceToProductionEvidenceReconciled:false,
    noNeonOrVercelConnection:true,
    zeroEvidenceOrForecastWrites:true,
    statewideSurveyCoverageCertified:false,
  },
  totals:{
    publisherArticles:verifiedSources.length,candidateSpeakers:4,
    senatorElectionWinnersWithCandidateWrittenSurvey:2,
    nonwinningOpponentsWithCandidateWrittenSurvey:2,
    winningCandidateIssueExcerptLeads:win.length,
    excludedLosingOpponentIssueExcerptLeads:loss.length,
    verifiedPublisherHTMLSourceFiles:verifiedSources.filter(s=>s.local2026OriginalPublisherBodyVerified).length,
    verifiedNamedSpeakerQuoteSpans:rows.filter(r=>r.correctOriginalSpeakerSectionVerified).length,
    quoteSpansIndependentlyProvenPublicBefore2022General:0,
    modelEligibleOrAdmittedStatements:0,
  },
  sourceReports:verifiedSources,
  excerpts:rows,
  caveats:[
    'Post-election results support retrospective identity, never historical feature availability.',
    'Quotes come from candidate responses to Ballotpedia, not candidate campaign domains.',
    '2026 acquired original publisher bytes are authentic to 2026 retrieval only; publication claimed 2022 is not original archive proof.',
    'An absent input does not certify zero candidate quotations; it means this audit did not recheck source bytes.',
    'Neither a defeated candidate answer nor a 2022 publicity date is a winning senator issue-position evidence item.',
  ],
 };
}
