/**
 * #864: Research-only independently archived first-party exact original
 * campaign and senator-owned issue statements. 2013 Carrie Ruud Senate SD10
 * homepage was observed AFTER the 2012 election, old text not pre-election
 * availability. Nov 2022 Roger Chamberlain Senate SD36 election homepage
 * supports original first-party site attribution; /legislative-priorities/
 * is SENATOR-owned and old acts are self-reports, NOT official roll calls.
 *
 * Full ORIGINAL government Minnesota LRL actual State Senate service
 * source rehashed independently by one-shot runner, ALL 10 original
 * candidate site HTML bodies from source artifact, BOTH independent
 * whole original Wayback CDX indexes, exactly 26 literal issue excerpts.
 * No source-to-production DB/forecast/model/scheduler use.
 */
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-ruud-2013-chamberlain-2022-original-26-exact-policy-excerpts-v1.json' with {type:'json'};
import firstPartyTargets from '../../data/evaluation/senate-ruud-2013-chamberlain-2022-targeted-first-party-original-replays-v1.json' with {type:'json'};
import {parseWaybackCdxJson} from '../../src/evidence/wayback.js';
import {
 historicalArchiveSha1Base32,originalCampaignVisibleText,recheckOriginalHistoricalExcerpt,
} from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {
 validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory,
} from '../../src/evidence/senate-official-ever-served-directory.js';

export const RUUD_CHAMBERLAIN_26_ORIGINAL_ISSUE_QUOTE_PROOF_VERSION=
 'mn-ruud-2013-chamberlain-2022-26-original-policy-exact-quote-proof-v1' as const;
const GOV='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const iso=(s:string)=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const FAMILIES=new Set<string>(ISSUE_POSITION_FAMILIES);
const KINDS=new Set([
 'candidate_owned_policy_statement',
 'senator_owned_2022_issues_future_priority',
 'candidate_claim_of_prior_legislative_activity_not_official_vote',
]);
type OriginalReplayReceipt={
 sourceTargetIndex?:number;person?:string;
 actuallyServedMNStateSenateIn2021?:boolean;
 originalFirstPartyHistoricalURL?:string;actualArchivedCaptureUTC?:string;
 originalIndexedCDXSHA1Base32?:string;originalCandidateFullHtmlFile?:string|null;
 originalCandidateFullHtmlSHA256?:string|null;
 originalWholeHtmlMatchesOriginalIndexedSHA1?:boolean;
 personSurnameVerifiedInVisiblePage?:boolean;
 sourceIsFullAuthenticatedOriginalHistoricalIndividualSite?:boolean;
 originalFirstAuthorPublicationDateIndependentlyProven?:boolean;
 automaticallyProvenElectionCampaignPolicyQuote?:boolean;
 exactCandidatePolicyExcerptsYetAdded?:number;
};
export type RuudChamberlainExactOriginalAcquisition={
 schema?:string;sourceOriginalGovernmentLRLSenateServiceSHA256?:string;
 originalIndependentFullWaybackIndexArtifact?:number;
 actual2021ServingSenatorsProvenBeforeNetwork?:number;
 wholePreviouslyAcquiredIndependentCDXIndexesRehashed?:number;
 entirePreviousOriginalAcquisitionManifestSha256?:string;
 requestedExactlyIndexedHistoricOriginalPages?:number;
 authenticOriginalHistoricalPageBodies?:number;
 byPerson?:Record<string,number>;
 results?:OriginalReplayReceipt[];
 productionEvidenceDBForecastModelSchedulerChanges?:number;
 researchExcerptsAutoAdmitted?:number;
 missingSourcesCannotProveNoPositions?:boolean;
 originalArchivedDateIsOnlyPublicByNotAuthoredAt?:boolean;
 current2026OwnershipOfDomainsNeverUsedToAttributeHistoricalPolicy?:boolean;
};
export function independentlyProveRuudChamberlain26OriginalCampaignAndSenatorIssuesExcerpts(
 official:AuditedOfficialSenateDirectory,
 receipt:RuudChamberlainExactOriginalAcquisition,
 allTenFullCandidateOriginalHtml:Readonly<Record<string,Uint8Array>>,
 twoIndependentOriginalCDXJSON:Readonly<Record<string,unknown>>,
 twoOriginalCdxRawSHA256:Readonly<Record<string,string>>,
){
 const sc=ledger.scope,p=ledger.provenance;
 if(ledger.schema!=='mn-ruud-2013-chamberlain-2022-26-original-exact-candidate-owned-and-senator-issues-statement-leads-v1'
  ||sc.issue!==864||sc.verifiedActual2021MinnesotaStateSenatePeople!==2
  ||sc.selectedAuthenticatedHistoricOriginalIssuePages!==3
  ||sc.allAcquiredFullOriginalPageBodiesRehashed!==10
  ||sc.originalIndependentFullIndexJsonRehashed!==2
  ||sc.exactResearchStatementExcerpts!==26
  ||sc.ruud2013PostElectionCopyNotAvailableToForecastBefore2012Election!==true
  ||sc.roger2022HomepageDirectlyIdentifiesSenateDistrict36Election!==true
  ||sc.roger2022LegislativePrioritiesAreSenatorOwnedNotNecessarilyOfficialCampaignStatement!==true
  ||sc.previouslyObservedRuud2012PartyChairSiteExcluded!==true
  ||sc.roger2020PersonalPodcastExcluded!==true
  ||sc.previousOutsideGroupIndependentExpenditureExcluded!==true
  ||sc.originalArchiveCaptureDatePublicByNotFirstWritten!==true
  ||sc.earlierLegislativeActionsAreCampaignSiteSelfClaimsNotRecordedVotes!==true
  ||sc.automaticallyEligibleForProductionForecast!==0
  ||sc.productionDatabaseEvidenceModelSchedulerChanges!==0
  ||p.originalFullOfficialLRLSenateServiceRun!==38094976711
  ||p.originalFullOfficialLRLArtifact!==11685387674
  ||p.originalGovernmentSha256!==GOV
  ||p.originalFullCDXSourceRun!==38162916977
  ||p.originalFullCDXArtifact!==11711190862
  ||p.targetedOriginalHTMLRun!==38163386171
  ||p.targetedOriginalHTMLArtifact!==11711570602
  ||p.targetedSourceArtifactName!=='ruud-2013-chamberlain-2022-ten-exact-wayback-index-original-html-v1'
  ||p.targetedSourceManifest!=='source-acquisition-manifest.json'
  ||p.originalCDXFiles.length!==2
  ||ledger.people.length!==2
  ||ledger.candidateOwnedOriginalIssueSourceSections.length!==3
  ||ledger.candidateOriginalLiteralResearchStatements.length!==26)
  throw Error('Changing original historical campaign quote/source/actual member provenance or scope prohibited');
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||official.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||official.source.sourceBytesSha256!==GOV
  ||!iso(official.source.observedAt)
  ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true
  ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false)
  throw Error('Complete genuine independent government actual Senate-service directory unavailable');
 const expectedNames=[
  {name:'Carrie Ruud',lrl:'Carrie L. Ruud',district:'10',count:5},
  {name:'Roger Chamberlain',lrl:'Roger C. Chamberlain',district:'38',count:21},
 ];
 for(const [i,person] of expectedNames.entries()){
  const candidate=ledger.people[i];
  if(!candidate||candidate.name!==person.name||candidate.actualLRLName!==person.lrl
   ||candidate.actual2021SenateDistrict!==person.district
   ||candidate.selectedUniqueExcerpts!==person.count)
   throw Error('Wrong actual 2021 serving candidate person/identity/district quotation coverage');
  const service=validateActualSenateServiceForElection(
   official,person.name,person.district,2020);
  if(service.status!=='verified_senate_service'
   ||service.serviceForThisElectionFollowingYearVerified!==true
   ||service.officialName!==person.lrl)
   throw Error('Person not actually proved by independent government source to serve Minnesota State Senate in 2021');
 }
 if(receipt.schema!=='mn-ruud-2013-chamberlain-2022-ten-exact-indexed-source-replay-receipts-v1'
  ||receipt.sourceOriginalGovernmentLRLSenateServiceSHA256!==GOV
  ||receipt.originalIndependentFullWaybackIndexArtifact!==11711190862
  ||receipt.actual2021ServingSenatorsProvenBeforeNetwork!==2
  ||receipt.wholePreviouslyAcquiredIndependentCDXIndexesRehashed!==2
  ||receipt.entirePreviousOriginalAcquisitionManifestSha256!=='1df07f5392238ad5954983ab6263f57f27dbf9653e27cb459143fc6b8c2cd1df'
  ||receipt.requestedExactlyIndexedHistoricOriginalPages!==10
  ||receipt.authenticOriginalHistoricalPageBodies!==10
  ||receipt.byPerson?.['Carrie Ruud']!==5
  ||receipt.byPerson?.['Roger Chamberlain']!==5
  ||receipt.results?.length!==10
  ||receipt.productionEvidenceDBForecastModelSchedulerChanges!==0
  ||receipt.researchExcerptsAutoAdmitted!==0
  ||receipt.missingSourcesCannotProveNoPositions!==true
  ||receipt.originalArchivedDateIsOnlyPublicByNotAuthoredAt!==true
  ||receipt.current2026OwnershipOfDomainsNeverUsedToAttributeHistoricalPolicy!==true
  ||firstPartyTargets.targets.length!==10)
  throw Error('Authentic full ten-original-page historical archive provenance receipt invalid');
 const allRows=[];
 if(Object.keys(twoIndependentOriginalCDXJSON).length!==2
  ||Object.keys(twoOriginalCdxRawSHA256).length!==2)
  throw Error('Must independently reopen precisely two WHOLE original historical Wayback CDX source files');
 for(const orig of p.originalCDXFiles){
  const raw=twoIndependentOriginalCDXJSON[orig.file];
  if(raw===undefined
   ||twoOriginalCdxRawSHA256[orig.file]!==orig.sha256
   ||!['ruudchamberlain-02-original-cdx-index.json','ruudchamberlain-05-original-cdx-index.json'].includes(orig.file))
   throw Error('Independent original Wayback CDX whole JSON SHA256 file does not match pinned immutable original');
  const parsed=parseWaybackCdxJson(raw);
  if(parsed.length<10||parsed.length>300)
   throw Error('Original CDX index unexpectedly truncated or over historical 300-row bound');
  allRows.push(...parsed);
 }
 const originals=new Map<number,typeof firstPartyTargets.targets[number]>();
 const usedFiles=new Set<string>();
 for(const [i,target] of firstPartyTargets.targets.entries()){
  const entry=receipt.results[i];
  const name='targeted-'+String(i+1).padStart(2,'0')+'-original-'+target.timestamp+'.html';
  const bytes=allTenFullCandidateOriginalHtml[name];
  if(originals.has(i)||usedFiles.has(name)||!entry||!bytes
   ||bytes.length<32||bytes.length>2_500_000
   ||target.person!==entry.person
   ||entry.sourceTargetIndex!==i
   ||entry.originalFirstPartyHistoricalURL!==target.originalUrl
   ||entry.actualArchivedCaptureUTC!==target.archiveCapturedUTC
   ||entry.originalIndexedCDXSHA1Base32!==target.cdxSha1
   ||entry.originalCandidateFullHtmlFile!==name
   ||entry.originalWholeHtmlMatchesOriginalIndexedSHA1!==true
   ||entry.sourceIsFullAuthenticatedOriginalHistoricalIndividualSite!==true
   ||entry.personSurnameVerifiedInVisiblePage!==true
   ||entry.originalFirstAuthorPublicationDateIndependentlyProven!==false
   ||entry.automaticallyProvenElectionCampaignPolicyQuote!==false
   ||entry.exactCandidatePolicyExcerptsYetAdded!==0
   ||entry.originalCandidateFullHtmlSHA256!==sha(bytes)
   ||historicalArchiveSha1Base32(bytes)!==target.cdxSha1
   ||!allRows.some(c=>c.original===target.originalUrl
     &&c.timestamp===target.timestamp&&c.digest===target.cdxSha1
     &&c.capturedAt===target.archiveCapturedUTC)
   ||!originalCampaignVisibleText(bytes).toLowerCase().includes(
    target.person.split(' ').at(-1)!.toLowerCase()))
   throw Error('One of all TEN original complete candidate website HTML sources fails original CDX indexed SHA1/URL/UTC/replay SHA256');
  originals.set(i,target);
  usedFiles.add(name);
 }
 if(Object.keys(allTenFullCandidateOriginalHtml).length!==10
  ||Object.keys(allTenFullCandidateOriginalHtml).some(f=>!usedFiles.has(f)))
  throw Error('Every original historical candidate page must be reopened and SHA rechecked');
 const sections=new Map<string,{
  html:Uint8Array;capture:string;url:string;htmlSha:string;cdxSha:string;
  text:string;senator:string;
 }>();
 for(const sel of ledger.candidateOwnedOriginalIssueSourceSections){
  const original=originals.get(sel.sourceIndex);
  const bytes=allTenFullCandidateOriginalHtml[sel.htmlFile];
  if(!original||!bytes
   ||sel.senator!==original.person
   ||sel.htmlFile!=='targeted-'+String(sel.sourceIndex+1).padStart(2,'0')
      +'-original-'+original.timestamp+'.html'
   ||sel.originalURL!==original.originalUrl
   ||sel.captureUtc!==original.archiveCapturedUTC
   ||sel.originalCDXSHA1!==original.cdxSha1
   ||sha(bytes)!==sel.sourceSHA256
   ||sections.has(sel.id))
   throw Error('Selected original first-party campaign issues-page section not tied to authenticated source');
  const visible=originalCampaignVisibleText(bytes);
  const begin=visible.indexOf(sel.visibleBegin);
  const end=visible.indexOf(sel.visibleEndBefore,begin+sel.visibleBegin.length);
  if(begin<0||end<=begin||!visible.includes(sel.senateElectionSiteIdentity))
   throw Error('Original candidate-owned policy subsection boundaries or campaign site identity do not exist');
  if(sel.id==='ruud2013home'&&(sel.senator!=='Carrie Ruud'
    ||sel.sourceIndex!==4
    ||sel.originalContentRetainsOldPostElectionLanguage!==true
    ||sel.captureUtc<='2012-11-06T00:00:00.000Z'
    ||!visible.includes('WE WON! THANK YOU!')
    ||!visible.includes('Vote for Carrie Ruud in November!')))
   throw Error('Ruud authentic 2013 first-party SENATE campaign page retains post-Nov-2012 election copy; never backdate');
  if(sel.id==='roger2022priorities'&&(sel.senator!=='Roger Chamberlain'
    ||sel.sourceIndex!==7
    ||sel.captureUtc>='2022-11-08T00:00:00.000Z'
    ||!visible.includes('I Will Continue To Work On:')))
   throw Error('Roger original SENATOR-owned 2022 issues page must be distinguished from official campaign or roll calls');
  if(sel.id==='roger2022electionHome'&&(sel.senator!=='Roger Chamberlain'
    ||sel.sourceIndex!==8
    ||sel.captureUtc>='2022-11-08T00:00:00.000Z'
    ||!visible.includes('I would like to represent you in the Minnesota Senate – District 36.')))
   throw Error('Roger original 2022 first-party SENATE ELECTION home campaign identity unverified');
  sections.set(sel.id,{
   html:bytes,url:sel.originalURL,capture:sel.captureUtc,
   htmlSha:sel.sourceSHA256,cdxSha:sel.originalCDXSHA1,
   text:visible.slice(begin,end),senator:sel.senator,
  });
 }
 if(sections.size!==3
  ||ledger.candidateOwnedOriginalIssueSourceSections.map(x=>x.id).join('|')
   !=='ruud2013home|roger2022priorities|roger2022electionHome')
  throw Error('Three distinct correctly classified actual historical website issue sections required');
 const ids=new Set<string>(),quoteText=new Set<string>(),
  counts=new Map<string,number>(),families=new Map<string,number>(),verified=[];
 for(const excerpt of ledger.candidateOriginalLiteralResearchStatements){
  const section=sections.get(excerpt.page);
  if(!section||ids.has(excerpt.id)||quoteText.has(excerpt.quote)
   ||!/^ruud-chamberlain-historic-\d{3}$/.test(excerpt.id)
   ||!FAMILIES.has(excerpt.issue)||!KINDS.has(excerpt.kind)
   ||excerpt.quote.length<8||excerpt.quote.length>130
   ||excerpt.meaning.length<8
   ||excerpt.originalCaptureTimestampIsPublicByNotAuthorFirst!==true
   ||excerpt.sourceMustBeWithinActualOriginalSiteVisibleSection!==true
   ||excerpt.notIndependentlyProvenSenateVote!==true
   ||excerpt.automaticProductionIngestion!==false
   ||!section.text.includes(excerpt.quote)
   ||(excerpt.page==='roger2022priorities'
     &&excerpt.kind==='candidate_owned_policy_statement')
   ||(excerpt.page==='ruud2013home'
     &&excerpt.kind!=='candidate_owned_policy_statement'))
   throw Error('Literal original candidate/senator website excerpt or conservative issue/provenance classification invalid: '+excerpt.id);
  const tested=recheckOriginalHistoricalExcerpt({
   originalHtml:section.html,expectedOriginalHtmlSha256:section.htmlSha,
   expectedHistoricalCdxPayloadDigestSha1Base32:section.cdxSha,
   shortExcerpt:excerpt.quote,
  });
  ids.add(excerpt.id);quoteText.add(excerpt.quote);
  counts.set(excerpt.page,(counts.get(excerpt.page)??0)+1);
  families.set(excerpt.issue,(families.get(excerpt.issue)??0)+1);
  verified.push({
   id:excerpt.id,actuallyServed2021Senator:section.senator,
   historicalSiteCharacter:excerpt.page==='roger2022priorities'
    ?'senator_owned_legislative_priorities_not_automatically_candidate_campaign'
    :excerpt.page==='ruud2013home'
     ?'2012_senate_campaign_text_captured_in_2013'
     :'first_party_2022_senate_district_36_candidate_home',
   statementKind:excerpt.kind,issueFamily:excerpt.issue,
   exactOriginalHistoricalSiteExcerpt:excerpt.quote,
   conservativeMeaning:excerpt.meaning,
   originalWebsiteURL:section.url,
   firstAttestedPublicByArchiveUTC:section.capture,
   completeOriginalHTMLSHA256:section.htmlSha,
   independentOriginalIndexedCDXSHA1:section.cdxSha,
   exactExcerptSHA256:tested.excerptSha256,
   originalFirstWrittenOrElectionAvailabilityEarlierThanCaptureUnproven:true as const,
   selfDescribedLegislationIsNotOfficialRecordedSenateVote:true as const,
   evidenceAutoEligibleForProductionOrForecast:false as const,
  });
 }
 if(verified.length!==26||quoteText.size!==26||ids.size!==26
  ||counts.get('ruud2013home')!==5
  ||counts.get('roger2022priorities')!==13
  ||counts.get('roger2022electionHome')!==8)
  throw Error('Must verify 5 Ruud and 21 Chamberlain UNIQUE literal original issue statements with correct cycles');
 return {
  schema:RUUD_CHAMBERLAIN_26_ORIGINAL_ISSUE_QUOTE_PROOF_VERSION,
  actual2021ServingStateSenatorsNewDirectIssueCoverage:2,
  historicalFirstPartyFullOriginalHTMLPagesRehashed:originals.size,
  wholeOriginalIndependentWaybackCDXSourceFilesReopened:2,
  originalCampaignAndSenatorPolicyPageSectionsProven:sections.size,
  exactShortOriginalPolicyWebsiteExcerptsVerified:verified.length,
  bySiteSection:Object.fromEntries(counts.entries()),
  byIssueFamily:Object.fromEntries([...families.entries()].sort((a,b)=>a[0].localeCompare(b[0]))),
  sourceOriginalHTMLArtifactId:11711570602,
  ruud2013SiteRetainsOld2012PostElectionLanguage:true,
  chamberlain2022CandidateElectionHomeAndSenatorOwnedPrioritiesDistinguished:true,
  external2022IndependentExpenditureNeverAdmittedAsFirstParty:true,
  officialSenateRecordedVotesAutomaticallyInferred:0,
  productionDatabaseEvidenceForecastModelSchedulerChanges:0,
  exactOriginalHistoricalWebsiteQuotes:verified,
 };
}
