/**
 * Issue #864 — real 2022 Senate campaign priorities for an actual senator.
 * Nicole Mitchell, verified Minnesota Senate SD47 service 2023–25.
 * Both *original* archived 2022 HTML pages and original CDX digests must match.
 * As-of historical site capture is NOT author first posting date or bill vote.
 *
 * This audit NEVER reads/writes Neon, Vercel or forecast evidence.
 */
import source from '../../data/evaluation/senate-nicole-mitchell-2022-original-priorities-excerpts-v1.json' with {type:'json'};
import {
 recheckOriginalHistoricalExcerpt,originalCampaignVisibleText,
} from './senate-authenticated-campaign-excerpt-audit.js';
import {
 validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory,
} from './senate-official-ever-served-directory.js';
import {ISSUE_POSITION_FAMILIES} from './issue-position-extractor.js';

export const HISTORIC_2022_NICOLE_ORIGINAL_QUOTE_AUDIT='senate-nicole-2022-original-priority-four-excerpt-proof-v1' as const;
const expected={
 'nicole2022-priorities-feb01':{
  original:'https://www.nicolemitchell.org/priorities',
  capture:'2022-02-01T00:55:54.000Z',
  fetched:'2026-10-11T01:04:48.050Z',
  file:'mitchell-historical-20220201005554-0.html',
  sha256:'e88c085174a9e5cfbdc23216405254763d9816d83d31ef03d18a4975e47daa51',
  cdx:'TVGIODYLDQ33ZPUY6522BDQDUKJ5CAA7',
 },
 'nicole2022-priorities-nov05':{
  original:'https://www.nicolemitchell.org/priorities',
  capture:'2022-11-05T16:03:01.000Z',
  fetched:'2026-10-11T01:04:49.147Z',
  file:'mitchell-historical-20221105160301-1.html',
  sha256:'a950fb05606c470c9ecc88a972afca887b42504130e603111d7e6dfafa57d73b',
  cdx:'HOD3ELVKGD5SN6NL5THHFTHCMUUWXGZ3',
 },
} as const;
type Id=keyof typeof expected;
export type OriginalNicole2022Bytes=Readonly<{
 'nicole2022-priorities-feb01':Uint8Array;
 'nicole2022-priorities-nov05':Uint8Array;
}>;
const excerptIds=[
 'mitchell22-education-funding','mitchell22-early-education',
 'mitchell22-climate','mitchell22-elections',
] as const;
export function auditNicoleMitchell2022OriginalCampaignQuotes(
 official:AuditedOfficialSenateDirectory,originals:OriginalNicole2022Bytes,
){
 const service=validateActualSenateServiceForElection(official,'Nicole Mitchell','47',2022);
 if(service.status!=='verified_senate_service'
   ||service.serviceForThisElectionFollowingYearVerified!==true
   ||service.officialName!=='Nicole L. Mitchell'
   ||service.officialServiceSource!=='https://www.lrl.mn.gov/legdb/senate_dir')
   throw Error('Nicole Mitchell actual Senate service in SD47 must be proven by official original LRL directory');
 if(source.schema!=='mn-senate-2022-nicole-mitchell-two-historical-priority-originals-four-excerpts-v1'
   ||source.scope.person!=='Nicole Mitchell'||source.scope.senateDistrict!=='47'
   ||source.scope.original2022OfficialFiledCandidateWebsiteFieldVerified!==false
   ||source.scope.authenticatedEarliestSourceCaptureUtc!=='2022-02-01T00:55:54.000Z'
   ||source.scope.forecastAutomaticallyEligible!==false
   ||source.scope.issueExcerptCount!==4||source.scope.originalHistoricPageVersions!==2
   ||source.provenance.originalCurrentAcquisitionGitHubRunId!==38100551887
   ||source.provenance.archivedOriginalArtifactId!==11687282664
   ||source.provenance.archivedOriginalArtifactZipSha256!==
      'ec3d348fdf2f1fc5b94a30a0e78f153b5179805ef6f771d99e7dbed36a510857'
   ||source.provenance.originalAcquisitionManifestSha256!==
      'bf84f6110b6984889f98228d848b53f5cddbe8787928b7a9c98836ee487c6c47'
   ||source.originals.length!==2||source.shortIssues.length!==4)
   throw Error('Original 2022 archived campaign source content or provenance is not trusted');
 const seen=new Set<string>();
 const pages=source.originals.map(p=>{
  if(!(p.id in expected)||seen.has(p.id))throw Error('Unrecognized/duplicated original source snapshot');
  const proof=expected[p.id as Id];
  if(p.originalUrl!==proof.original||p.archivedOriginalCapturedAtUtc!==proof.capture
    ||p.fetchedUtc!==proof.fetched||p.file!==proof.file
    ||p.actualOriginalBodySha256!==proof.sha256
    ||p.originalHistoricalCdxIndexBase32Sha1!==proof.cdx
    ||p.actualHttpStatus!==200
    ||p.independentlyConfirmedOriginalByMatchingCdxDigest!==true
    ||p.fileIsCandidateOwnedSenateIssuePage!==true
    ||p.archivedOriginalCapturedAtUtc>='2022-11-08T00:00:00Z'
    ||p.archivedOriginalCapturedAtUtc<'2022-01-01T00:00:00Z')
   throw Error('Wrong original 2022 archive capture, digest or election availability');
  seen.add(p.id);
  const bytes=originals[p.id as Id];
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<100
    ||bytes.byteLength>2_500_000)
   throw Error('Both original 2022 campaign pages must be supplied, bounded and source-byte-verifiable');
  const candidateText=originalCampaignVisibleText(bytes);
  if(!candidateText.includes('Nicole Mitchell for Minnesota State Senate')
    ||!candidateText.includes('Priorities Focusing on What Matters.')
    ||!candidateText.includes('Paid for by Nicole Mitchell for State Senate'))
   throw Error('Original archived source does not authenticate actual 2022 Senate candidate campaign content');
  return{
   snapshotId:p.id,sourceOriginalUrl:proof.original,
   originalCapturedAtUtc:proof.capture,originalFetchedAtUtc:proof.fetched,
   originalHtmlSha256:proof.sha256,originalIndependentCdxSha1:proof.cdx,
   originalCandidateOwnedPageTextValidated:true,
   candidateIssueTextFirstPublishedAt:null,
   policyExcerptMatchResults:[] as {quoteId:string;exactVisibleExcerptMatched:boolean;excerptSha256:string}[],
  };
 });
 const ids=new Set<string>(),rows=[];
 for(const [i,quote] of source.shortIssues.entries()){
  if(quote.id!==excerptIds[i]||ids.has(quote.id)
   ||!ISSUE_POSITION_FAMILIES.includes(quote.family as typeof ISSUE_POSITION_FAMILIES[number])
   ||!['explicit_support','explicit_opposition','promise_action','priority_statement'].includes(quote.commitment)
   ||typeof quote.quotedExcerpt!=='string'||quote.quotedExcerpt.length<9
   ||quote.quotedExcerpt.length>120||quote.verifiedInBothOriginalCopiesByHumanReview!==true
   ||quote.sourceFirstAttestedPublicByNoLaterThanUtc!==expected['nicole2022-priorities-feb01'].capture
   ||quote.secondIndependentlyAttestedSiteCaptureUtc!==expected['nicole2022-priorities-nov05'].capture
   ||quote.authorFirstPublishedAt!==null||quote.historicalForecastFeatureAutomaticallyEligible!==false
   ||quote.linkedSenateMembershipId!==null||quote.billVoteInferredFromCampaignText!==false)
   throw Error('Invalid original campaign quote/date/category or accidental forecast admission');
  ids.add(quote.id);
  const checked=[];
  for(const page of pages){
   const capture=expected[page.snapshotId as Id];
   const match=recheckOriginalHistoricalExcerpt({
    originalHtml:originals[page.snapshotId as Id],
    expectedOriginalHtmlSha256:capture.sha256,
    expectedHistoricalCdxPayloadDigestSha1Base32:capture.cdx,
    shortExcerpt:quote.quotedExcerpt,
   });
   checked.push(match);
   page.policyExcerptMatchResults.push({
    quoteId:quote.id,exactVisibleExcerptMatched:match.exactVisibleExcerptCrossChecked,
    excerptSha256:match.excerptSha256,
   });
  }
  if(checked.length!==2||checked.some(x=>!x.exactVisibleExcerptCrossChecked))
   throw Error('Short candidate quote not present in both independently dated 2022 originals');
  rows.push({
   quoteId:quote.id,senatorName:'Nicole Mitchell',independentLRLOfficialName:service.officialName,
   verifiedSenateServiceTerm:service.term,office:'MN Senate District 47',
   originalCandidateOwnedCampaignPageUrl:'https://www.nicolemitchell.org/priorities',
   originalSourceRetrievedAtUtc:expected['nicole2022-priorities-feb01'].fetched,
   firstAttestedExactStatementPublicByUtc:expected['nicole2022-priorities-feb01'].capture,
   independentlyReattestedUnchangedExcerptAtUtc:expected['nicole2022-priorities-nov05'].capture,
   issueFamily:quote.family,interpretation:quote.interpretation,
   exactShortExcerpt:quote.quotedExcerpt,exactOriginalHtmlSpanMatches:2,
   earliestAuthorOriginalPostedAt:null,
   sourceSite2022SOSFilingWebsiteFieldProven:false,
   membershipId:null,evidenceRowId:null,
   automaticallyForecastEligible:false,
  });
 }
 return{
  schema:HISTORIC_2022_NICOLE_ORIGINAL_QUOTE_AUDIT,
  originalIndependentLRLSenatorSource:{
   url:service.officialServiceSource,originalObservedAtUtc:official.source.observedAt,
   originalSha256:official.source.sourceBytesSha256,
  },
  provenance:{
   originalArchiveAcquisitionRunId:source.provenance.originalCurrentAcquisitionGitHubRunId,
   originalSourceArtifactId:source.provenance.archivedOriginalArtifactId,
   originalArtifactZipSha256:source.provenance.archivedOriginalArtifactZipSha256,
  },
  scope:{
   actualSenatePeopleNamed:1,unknownAuthorFirstPostTime:true,
   allOriginalPolicyPagesAvailableByFeb01_2022:true,
   original2022FiledCandidateWebsiteVerified:false,
   onlyIndependentLRLActualSenatorShown:true,
   authenticOriginalCapturedHtmlVersions:2,
   noNeonVercelDatabaseReadOrWrite:true,historyOnlyNoModelEvidenceIngestion:true,
  },
  totals:{
   originalDateAttestedCampaignIssuePageVersions:pages.length,
   shortSenatorAuthoredCampaignExcerpts:rows.length,
   exactQuoteVisibleSpanAndSourceHashCrossChecks:pages.reduce((n,p)=>n+p.policyExcerptMatchResults.length,0),
   nonSenatorQuoteRowsInSourceReport:0,
   priorForecastEvidenceAdmission:0,
  },
  originalPages:pages,datedShortCandidateStatements:rows,
 };
}
