/**
 * #864 historical Senate campaign issue statements: OFFLINE original-byte recheck.
 * Full archived HTML remains in retained GitHub Actions source artifact; repo
 * contains only short excerpts, source SHA-256, CDX digest and provenance.
 *
 * This does not read Neon, install evidence rows, infer membership winner, or
 * decide whether any statement was available at an earlier forecast cutoff.
 */
import { createHash } from 'node:crypto';
import historicalTargets from '../../data/evaluation/senate-wayback-real-cdx-selected-replay-2024-25-v1.json' with {type:'json'};
import siteLeads from '../../data/evaluation/senate-campaign-issue-page-url-leads-2024-25-v1.json' with {type:'json'};
import { ISSUE_POSITION_FAMILIES } from './issue-position-extractor.js';

export const ORIGINAL_CAMPAIGN_EXCERPT_AUDIT_VERSION =
  'senate-original-archived-campaign-excerpt-audit-v1' as const;
const ENCODE='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const hash=(bytes:Uint8Array)=>
  createHash('sha256').update(bytes).digest('hex');
export function historicalArchiveSha1Base32(bytes:Uint8Array):string{
  const digest=createHash('sha1').update(bytes).digest();
  let held=0,bits=0,text='';
  for(const n of digest) {
    held=(held<<8)|n;bits+=8;
    while(bits>=5) {text+=ENCODE[(held>>(bits-5))&31];bits-=5;}
    held&=(1<<bits)-1;
  }
  if(bits)text+=ENCODE[(held<<(5-bits))&31];
  return text;
}
export function originalCampaignVisibleText(bytes:Uint8Array):string{
  const html=Buffer.from(bytes).toString('utf8');
  const withoutHidden=html
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
    .replace(/<[^>]+>/g,' ');
  const decoded=withoutHidden
    .replace(/&#(?:x([0-9a-f]{1,6})|(\d{1,7}));/gi,(_m:string,hex:string|undefined,decimal:string|undefined)=>{
      const code=hex?parseInt(hex,16):parseInt(decimal??'',10);
      return Number.isSafeInteger(code)&&code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)
        ?String.fromCodePoint(code):' ';
    })
    .replace(/&(amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|ldquo|rdquo|ndash|mdash|hellip);/gi,
      (_m:string,named:string)=>{
        const replacements:Record<string,string>={
          amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'’',lsquo:'‘',
          ldquo:'“',rdquo:'”',ndash:'–',mdash:'—',hellip:'…',
        };
        return replacements[named.toLowerCase()]??' ';
      });
  return decoded.replace(/\s+/g,' ').trim();
}
export function recheckOriginalHistoricalExcerpt(input:{
  originalHtml:Uint8Array;
  expectedOriginalHtmlSha256:string;
  expectedHistoricalCdxPayloadDigestSha1Base32:string;
  shortExcerpt:string;
}){
  if(!/^[0-9a-f]{64}$/.test(input.expectedOriginalHtmlSha256)
    ||!/^[A-Z2-7]{32}$/.test(input.expectedHistoricalCdxPayloadDigestSha1Base32)
    ||input.originalHtml.length<32||input.originalHtml.length>3*1024*1024)
    throw new Error('Invalid or unbounded archived source identity');
  const hex=hash(input.originalHtml);
  if(hex!==input.expectedOriginalHtmlSha256)
    throw new Error('Original historical campaign HTML SHA-256 mismatch');
  const indexed=historicalArchiveSha1Base32(input.originalHtml);
  if(indexed!==input.expectedHistoricalCdxPayloadDigestSha1Base32)
    throw new Error('Original historical HTML bytes disagree with acquired Wayback CDX SHA-1');
  const excerpt=input.shortExcerpt.replace(/\s+/g,' ').trim();
  if(excerpt.length<8||excerpt.length>130)
    throw new Error('Missing/oversized short campaign excerpt');
  const visible=originalCampaignVisibleText(input.originalHtml);
  if(!visible.includes(excerpt))
    throw new Error('Original historical campaign excerpt missing from visible page content');
  return {
    sourceHtmlSha256:hex,indexedSourcePayloadSha1Base32:indexed,
    excerptSha256:createHash('sha256').update(excerpt,'utf8').digest('hex'),
    shortExcerpt:excerpt,sourceHtmlBytesCrossChecked:true,exactVisibleExcerptCrossChecked:true,
    sourceHtmlBodyFirstPostedDateIndependentlyEstablished:false,
    remotelyFetchedCdxAndSourceBytesForThisCheck:false,
    eligibleForImmediateProductionIngestion:false,
  };
}
export interface ExcerptLedger {
  schema:'senate-authenticated-campaign-policy-excerpt-leads-2024-25-v1';
  scope:{
    historicalCoverageIssue:number;
    uniqueCandidateOriginalIssuePages:number;
    attributableShortExcerptLeads:number;
    eligibleForImmediateForecast:number;
    productionDatabaseReads:number;
    productionDatabaseWrites:number;
    statewideCompletenessCertified:false;
  };
  provenance:{
    originalRunId:number;githubActionsArtifactId:number;
    originalArchiveArtifactZipSha256:string;
    originalSourceBytesPersistedInGitRepository:false;
  };
  candidates:Array<{
    candidateName:string;district:string;electionYear:number;
    sourceEvidenceType:'candidate_campaign_issue_platform_page';
    campaignSiteAssignmentFromOriginalHistoricSosFilingCertified:false;
    officialSenatorMembershipOrVictoryVerifiedForEachExcerpt:false;
    originalHtmlSource:{
      pinnedWaybackReplayId:string;sourceArchiveCaptureAt:string;
      sourceArchiveOriginalHtmlFileName:string;originalHtmlResponseSha256:string;
      originalBodySha1MatchesHistoricalCdxIndex:true;
      originalPageByteSourceArtifactId:number;
      sourceIsStrictlyBeforeGeneralElection:true;sourceIsStrictlyBeforePrimaryElection:false;
    };
    excerpts:Array<{
      id:string;issueFamily:string;candidateCommitment:string;
      exactShortExcerptFromOriginalArchivedPage:string;
      issueInterpretation:string;
      textVerifiedInOriginalHtmlByHumanReview:true;
      snippetOnlyNoSurroundingPageOrBillText:true;
      attestedSnippetPublicByNoLaterThan:string;
      earlierOriginalPublicationTimeIndependentlyKnown:false;
      sourceSnapshotToBeRecheckedByOfflineAudit:string;
      immediatelyEligibleForForecast:false;
      matchedToProductionEvidenceId:false;
      legislatorMembershipAttributionAudited:false;
    }>;
  }>;
}
export function auditHistoricalCampaignExcerptLeadManifest(
  ledger:ExcerptLedger, suppliedOriginalHtml:Readonly<Record<string,Uint8Array>>={},
) {
  if(ledger.schema!=='senate-authenticated-campaign-policy-excerpt-leads-2024-25-v1'
    ||ledger.scope.historicalCoverageIssue!==864
    ||ledger.scope.uniqueCandidateOriginalIssuePages!==4
    ||ledger.scope.attributableShortExcerptLeads!==13
    ||ledger.scope.eligibleForImmediateForecast!==0
    ||ledger.scope.productionDatabaseReads!==0||ledger.scope.productionDatabaseWrites!==0
    ||ledger.scope.statewideCompletenessCertified!==false
    ||ledger.provenance.originalRunId!==38086478508
    ||ledger.provenance.githubActionsArtifactId!==11682363094
    ||ledger.provenance.originalArchiveArtifactZipSha256!=='c20cd41da68fac461f05f17b6782abb34202d4add22cd9b5ea826610c3a8f8fb'
    ||ledger.provenance.originalSourceBytesPersistedInGitRepository!==false
    ||ledger.candidates.length!==4)
    throw new Error('Unexpected source excerpt campaign corpus denominator or provenance');
  const used=new Set<string>(),identities=new Set<string>(),usedFiles=new Set<string>();
  const families=new Set<string>(ISSUE_POSITION_FAMILIES);
  const statuses=[];
  let providedFiles=0,verified=0,providedExcerpts=0;
  for(const c of ledger.candidates){
    const key=c.candidateName+'|'+c.district+'|'+c.electionYear;
    if(identities.has(key)||c.sourceEvidenceType!=='candidate_campaign_issue_platform_page'
      ||c.campaignSiteAssignmentFromOriginalHistoricSosFilingCertified!==false
      ||c.officialSenatorMembershipOrVictoryVerifiedForEachExcerpt!==false)
      throw new Error('Missing or misattributed historical campaign candidate identity');
    identities.add(key);
    const known=siteLeads.candidates.filter(x=>x.candidateName===c.candidateName
      &&x.district===c.district&&x.electionYear===c.electionYear);
    if(known.length!==1)throw new Error('Archived quote assigned to wrong candidate/district');
    const source=c.originalHtmlSource;
    const matching=historicalTargets.targets.filter(t=>t.id===source.pinnedWaybackReplayId
      &&t.candidateName===c.candidateName&&t.district===c.district&&t.electionYear===c.electionYear
      &&t.capturedAt===source.sourceArchiveCaptureAt
      &&new URL(t.originalUrl).hostname.replace(/^www\./,'')===known[0].campaignHost);
    if(matching.length!==1||source.originalPageByteSourceArtifactId!==11682363094
      ||source.originalBodySha1MatchesHistoricalCdxIndex!==true
      ||source.sourceIsStrictlyBeforeGeneralElection!==true
      ||source.sourceIsStrictlyBeforePrimaryElection!==false
      ||!/^wayback-replay-snapshot-(?:0[1-9]|1[0-2])\.html$/.test(source.sourceArchiveOriginalHtmlFileName)
      ||!/^([0-9a-f]{64})$/.test(source.originalHtmlResponseSha256)
      ||usedFiles.has(source.sourceArchiveOriginalHtmlFileName))
      throw new Error('Unpinned, missing or cross-candidate original archived page bytes');
    usedFiles.add(source.sourceArchiveOriginalHtmlFileName);
    const target=matching[0],date=Date.parse(target.capturedAt),
      primary=Date.parse(known[0].primaryElectionOn+'T00:00:00Z'),
      general=Date.parse(known[0].generalElectionOn+'T00:00:00Z');
    if(!Number.isFinite(date)||!(date>=primary&&date<general))
      throw new Error('Archived campaign page violates primary/general election availability bound');
    const sourceBytes=suppliedOriginalHtml[source.sourceArchiveOriginalHtmlFileName];
    const itemResults=[];
    if(sourceBytes)providedFiles++;
    for(const excerpt of c.excerpts){
      if(!excerpt.id||used.has(excerpt.id)||!families.has(excerpt.issueFamily)
        ||!['explicit_support','explicit_opposition','promise_action','priority_statement'].includes(excerpt.candidateCommitment)
        ||excerpt.textVerifiedInOriginalHtmlByHumanReview!==true
        ||excerpt.snippetOnlyNoSurroundingPageOrBillText!==true
        ||excerpt.attestedSnippetPublicByNoLaterThan!==source.sourceArchiveCaptureAt
        ||excerpt.earlierOriginalPublicationTimeIndependentlyKnown!==false
        ||excerpt.sourceSnapshotToBeRecheckedByOfflineAudit!==source.pinnedWaybackReplayId
        ||excerpt.immediatelyEligibleForForecast!==false
        ||excerpt.matchedToProductionEvidenceId!==false
        ||excerpt.legislatorMembershipAttributionAudited!==false)
        throw new Error('Ambiguous, premature or cross-candidate issue position source excerpt');
      used.add(excerpt.id);
      const quote=excerpt.exactShortExcerptFromOriginalArchivedPage;
      if(typeof quote!=='string'||quote.length<8||quote.length>130)
        throw new Error('Missing/oversized exact policy quote');
      let check:ReturnType<typeof recheckOriginalHistoricalExcerpt>|null=null;
      if(sourceBytes){
        check=recheckOriginalHistoricalExcerpt({
          originalHtml:sourceBytes,
          expectedOriginalHtmlSha256:source.originalHtmlResponseSha256,
          expectedHistoricalCdxPayloadDigestSha1Base32:target.cdxDigest,
          shortExcerpt:quote,
        });
        verified++;
      }
      providedExcerpts++;
      itemResults.push({
        id:excerpt.id,issueFamily:excerpt.issueFamily,
        candidateCommitment:excerpt.candidateCommitment,
        issueInterpretation:excerpt.issueInterpretation,
        shortExcerpt:quote,sourceFirstAttestedAt:source.sourceArchiveCaptureAt,
        locallyReverifiedOriginalPageAndShortQuote:Boolean(check),
        excerptSha256:check?.excerptSha256??createHash('sha256').update(quote).digest('hex'),
        originallyPublishedBeforeCapture: null,
        sourceIsPreGeneralNotPrePrimary:true,
        candidateMembershipJoinCompleted:false,
        forecastEligible:false,
      });
    }
    statuses.push({
      candidateName:c.candidateName,district:c.district,
      sourceHtmlFile:source.sourceArchiveOriginalHtmlFileName,
      expectedOriginalHtmlSha256:source.originalHtmlResponseSha256,
      cdxDigest:target.cdxDigest,
      originalArchiveUrl:target.archiveUrl,
      verifiedOriginalHtmlBytesLocally:Boolean(sourceBytes),
      recoveredShortPositions:itemResults,
    });
  }
  if(providedExcerpts!==ledger.scope.attributableShortExcerptLeads)
    throw new Error('Unexpected source excerpt corpus row count');
  if(Object.keys(suppliedOriginalHtml).some(file=>!usedFiles.has(file)))
    throw new Error('Unrecognized or unused original archive page was submitted');
  return {
    schema:ORIGINAL_CAMPAIGN_EXCERPT_AUDIT_VERSION,
    scope:{sourceArchiveYearRange:[2024,2025],noNetwork:true,noProductionDatabase:true,
      noSourceInsertion:true,
      originalHistoricalSosWebsiteFieldVerified:false,
      statewideSenateCampaignSiteUniverseCertified:false,
      membershipEvidenceRowReconciliationCertified:false,
      inputArchiveSourceBytesSupplied:Boolean(providedFiles),
      indexedContentDigestCrossCheckedAgainstProvidedBytes:providedFiles===4,
      sourceAttestationIsNotOriginalPagePostDate:true,
      noAutomaticForecastPromotion:true},
    totals:{
      campaignCandidates:statuses.length,expectedShortExcerptLeads:providedExcerpts,
      originalHtmlFilesProvidedAndCrossChecked:providedFiles,
      shortExcerptsReverifiedAgainstOriginalBytes:verified,
      recordsEligibleForForecastInThisAudit:0,
    },
    candidates:statuses,
  };
}
