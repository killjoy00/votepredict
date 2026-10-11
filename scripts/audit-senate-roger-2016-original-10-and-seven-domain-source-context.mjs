/**
 * #864 one-shot OFFLINE original-byte proof. Actual 2021-serving MN Senate
 * persons independently checked from original full government LRL source
 * BEFORE validating 2016 Chamberlain candidate campaign website statements.
 * Entire authentic source: all five complete Wayback CDX JSON response bodies,
 * all seven retained historic original HTML pages (including 2019 unrelated
 * WordPress material, explicitly NOT candidate statements), acquisition UTC
 * receipts and ten short 2016 candidate-owned issue excerpts.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText,recheckOriginalHistoricalExcerpt}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import ledger from '../data/evaluation/senate-roger-chamberlain-2016-original-10-economic-issue-excerpts-and-domain-review-v1.json' with {type:'json'};
import previous from '../data/evaluation/senate-ruud-2013-chamberlain-2022-original-26-exact-policy-excerpts-v1.json' with {type:'json'};
const sha=b=>createHash('sha256').update(b).digest('hex');
const get=s=>{const a=process.argv.slice(2),i=a.indexOf(s);
 assert.ok(i>=0&&a.filter(x=>x===s).length===1&&a[i+1]&&!a[i+1].startsWith('--'),'Missing original source '+s);
 return resolve(a[i+1]);};
const bounded=(p,min=40,max=5500000)=>{const st=statSync(p);
 assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'missing/unbounded original source '+p);
 return readFileSync(p);};
function main(){
 assert.equal(process.argv.length,10);
 const officialHTML=bounded(get('--entire-original-government-senate-html'),9000);
 const governmentReceipt=JSON.parse(bounded(get('--original-government-utc-sha-audit')).toString());
 const originalDir=get('--original-seven-window-site-html-cdx-dir');
 const output=get('--output');
 assert.equal(sha(officialHTML),ledger.source.historicalFullMNOfficialLRLHtmlSHA256);
 assert.equal(governmentReceipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
 assert.equal(governmentReceipt.source.sourceBytesSha256,sha(officialHTML));
 const official=parseOfficialMnSenateServiceDirectory(officialHTML,governmentReceipt.source.observedAt);
 assert.equal(official.senators.length,105);
 for(const [name,dist]of [['David Tomassoni','6'],['Carrie Ruud','10'],['Roger Chamberlain','38']]){
  const status=validateActualSenateServiceForElection(official,name,dist,2020);
  assert.equal(status.status,'verified_senate_service',name);
  assert.equal(status.serviceForThisElectionFollowingYearVerified,true,name);
 }
 const sc=ledger.scope,src=ledger.source;
 assert.equal(ledger.issue,undefined); // Source issue is explicitly inside scoped ledger.
 assert.equal(sc.issue,864);
 assert.equal(sc.originalAuthenticFullHtmlPageBodiesCrosschecked,7);
 assert.equal(sc.fullOriginalIndependentHistoricalCdxJsonSourcesCrosschecked,5);
 assert.equal(sc.distinctExactShortIssueStatements,10);
 assert.equal(sc.originalArchivalPublicByUtc,'2016-02-27T08:24:48.000Z');
 assert.equal(sc.firstAuthoredDateIndependentlyProven,false);
 assert.equal(sc.claimOfBeingReissuedAs2020Platform,false);
 assert.equal(sc.productionDatabaseEvidenceModelForecastSchedulerChanges,0);
 assert.equal(sc.Tomassoni2019WordPressReceiptsAreHisPoliticStatements,false);
 assert.equal(sc.CarrieRuud2016RepeatOf2013IssueCopyNotRecounted,true);
 assert.equal(sc.Roger2020SenatorPodcastSiteNotElectionPlatform,true);
 assert.equal(ledger.reviewOfAllSevenOriginalHtml.length,7);
 assert.equal(ledger.tenCandidateSiteExactStatements.length,10);
 const sourceManifest=JSON.parse(bounded(join(originalDir,src.sourceOriginalManifest),100).toString());
 assert.equal(sourceManifest.schema,'mn-2020-actual-senators-seven-historical-wayback-domain-windows-gap-inventory-v1');
 assert.equal(sourceManifest.issue,864);
 assert.equal(sourceManifest.fullOriginalGovernmentSha256,sha(officialHTML));
 assert.equal(sourceManifest.actualStateSenatorPeopleProvenBeforeNetwork,3);
 assert.equal(sourceManifest.queryWindows,7);
 assert.equal(sourceManifest.sourceCDXFullJSONFilesReopened,5);
 assert.equal(sourceManifest.actualOriginalHTMLPageReplaysRecovered,7);
 assert.equal(sourceManifest.queriesNeverClaimCompleteArchivedWebsiteEnumeration,true);
 assert.equal(sourceManifest.archivedCaptureUTCOnlyPublicByNotAuthorDate,true);
 assert.equal(sourceManifest.policyPositionExcerptsAutomaticallyAdmitted,0);
 assert.equal(sourceManifest.productionDatabaseReadsWritesOrForecastChanges,0);
 const originalPages=new Map(),indexes=[],covered=new Set();
 for(const window of sourceManifest.sourceWindows){
  assert.ok(window.noCandidateIssueStatementFoundInBoundedSampleNeverProvesAbsence);
  if(window.sourceIndexFilename){
   const raw=bounded(join(originalDir,window.sourceIndexFilename),20,1700000);
   assert.equal(sha(raw),window.responseBodySHA256,'Original ENTIRE CDX source index altered');
   const json=JSON.parse(raw.toString());
   assert.ok(Array.isArray(json)&&json.length>=2&&json.length<=301);
   assert.deepEqual(json[0],['timestamp','original','mimetype','statuscode','digest','length']);
   assert.equal(json.length-1,window.originalRows);
   indexes.push({domain:window.domain,sourceFile:window.sourceIndexFilename,
    rows:window.originalRows,wholeCdxSha256:sha(raw),rowsReopened:json.length-1,
    reachedBound:window.indexCappedAt300});
   for(const r of window.originalReplays){
    if(!r.sourceFile)continue;
    const bytes=bounded(join(originalDir,r.sourceFile),64,3000000);
    assert.equal(sha(bytes),r.responseBodySHA256,'Original entire HTML page not genuine');
    assert.equal(historicalArchiveSha1Base32(bytes),r.originalIndexedWaybackCDXSha1Base32,
     'Entire original archive SHA-1 does not match independently archived CDX digest');
    assert.equal(r.fullOriginalByteDigestMatchesSeparateOriginalCdx,true);
    assert.equal(r.senatorSurnameIsInVisiblePage,true);
    const timestamp=r.waybackCaptureUtc.replace(/[^0-9]/g,'').slice(0,14);
    assert.ok(json.slice(1).some(row=>row[0]===timestamp
      &&row[1]===r.originalFirstPartyURL&&row[3]==='200'
      &&row[4]===r.originalIndexedWaybackCDXSha1Base32),
     'Source original URL/timestamp/SHA-1 does not exist in whole original Wayback index');
    assert.ok(!originalPages.has(r.sourceFile));
    originalPages.set(r.sourceFile,{window,record:r,bytes,visible:originalCampaignVisibleText(bytes)});
   }
  }else{
   assert.equal(window.verifiedFullOriginalHtmlReplays,0);
   assert.ok(window.indexError);
  }
  covered.add(window.person);
 }
 assert.equal(covered.size,3);
 assert.equal(indexes.length,5);
 assert.equal(originalPages.size,7);
 const classifications=[];
 for(const group of ledger.reviewOfAllSevenOriginalHtml){
  const page=originalPages.get(group.file);
  assert.ok(page,'Missing one of ALL SEVEN retained historical original website HTML bodies');
  assert.equal(page.window.person,group.personDomainLead);
  assert.ok(page.visible.includes(group.requiredVisibleTerm),
   'Historical source content no longer matches independently reviewed author/ownership context');
  if(group.personDomainLead==='David Tomassoni'){
   assert.equal(group.candidateOwnedPoliticalAttributionAllowed,false);
   assert.equal(group.selectedNewExcerpts,0);
   assert.ok(page.visible.includes('free online printable receipts'));
   assert.ok(page.visible.includes('Just another WordPress site'));
  }
  if(group.personDomainLead==='Carrie Ruud')assert.equal(group.selectedNewExcerpts,0);
  if(group.personDomainLead==='Roger Chamberlain'&&group.sourceClass.includes('2020_senator_owned')){
   assert.equal(group.candidateOwnedPoliticalAttributionAllowed,false);
   assert.equal(group.selectedNewExcerpts,0);
  }
  if(group.sourceClass==='genuine_2016_candidate_owned_chamberlain_for_senate_issues_page'){
   assert.equal(page.record.originalFirstPartyURL,src.firstPartyArchivedCampaignURL);
   assert.equal(page.record.waybackCaptureUtc,src.originalArchivedCaptureUtc);
   assert.equal(sha(page.bytes),src.originalWholeHtmlSHA256);
   assert.equal(page.record.originalIndexedWaybackCDXSha1Base32,src.independentWaybackOriginalPayloadSHA1Base32);
   assert.equal(group.selectedNewExcerpts,10);
   assert.equal(group.candidateOwnedPoliticalAttributionAllowed,true);
   assert.ok(page.visible.includes('Economy - Jobs'));
   assert.ok(page.visible.includes('Goals'));
  }
  classifications.push({sourceFile:group.file,personDomainLead:group.personDomainLead,
   historicalSourceClass:group.sourceClass,candidateOwnedPolicyQuotationAllowed:group.candidateOwnedPoliticalAttributionAllowed,
   newlySelectedExactQuotes:group.selectedNewExcerpts,originalSourceSHA256:sha(page.bytes)});
 }
 const campaigns=classifications.filter(c=>c.newlySelectedExactQuotes>0);
 assert.equal(campaigns.length,1);
 const candidate=originalPages.get(src.originalArchivedCampaignPageFile);
 assert.ok(candidate&&candidate.visible.includes(src.attributionProofText));
 assert.ok(indexes.some(i=>i.sourceFile===src.originalFullIndependentCDXFile
  &&i.wholeCdxSha256===src.originalWholeCDXSHA256));
 const oldRoger=new Set(previous.candidateOriginalLiteralResearchStatements
  .filter(q=>q.page!=='ruud2013home').map(q=>q.quote));
 const seen=new Set(),verified=[];
 for(const q of ledger.tenCandidateSiteExactStatements){
  assert.ok(q.id&&q.issueFamily&&q.conservativeMeaning&&q.attributedTo==='Roger Chamberlain');
  assert.ok(!oldRoger.has(q.exactExcerpt),'Quote already in prior Roger source ledger');
  assert.ok(!seen.has(q.exactExcerpt)&&q.exactExcerpt.length>=8&&q.exactExcerpt.length<=130);
  assert.equal(q.historic2016CaptureOnlyNot2020Authorship,true);
  assert.equal(q.automaticEvidenceForecastAdmission,false);
  const recheck=recheckOriginalHistoricalExcerpt({
   originalHtml:candidate.bytes,
   expectedOriginalHtmlSha256:src.originalWholeHtmlSHA256,
   expectedHistoricalCdxPayloadDigestSha1Base32:src.independentWaybackOriginalPayloadSHA1Base32,
   shortExcerpt:q.exactExcerpt});
  seen.add(q.exactExcerpt);
  verified.push({id:q.id,issueFamily:q.issueFamily,sourcePage:src.originalArchivedCampaignPageFile,
   literalOriginalSiteQuoteSHA256:recheck.excerptSha256,
   originalWebsitePageSha256:recheck.sourceHtmlSha256,
   actualHistoricalPublicByUtc:src.originalArchivedCaptureUtc,
   firstAuthoredDateUnverified:true,forecastsNotAutomaticallyEligible:true});
 }
 assert.equal(verified.length,10);
 const proof={schema:'mn-senate-roger-2016-full-source-10-candidate-issue-quotes-seven-page-context-proof-v1',
  verifiedRealSenatorsServed2021:3,entireGovernmentSenateServiceHTMLSha256:sha(officialHTML),
  fullHistoricalCDXIndexJSONsRehashed:indexes.length,completeSelectedOriginalWebsiteBodiesRehashed:originalPages.size,
  unrelated2019TomassoniWordPressBodiesExcluded:2,olderRuud2016BodiesNotRecounted:2,
  Roger2020PersonalSiteBodiesNotRecertifiedAsCandidateCampaign:2,
  authentic2016ChamberlainOriginalCandidateWebsiteIssuesPages:1,
  newDistinct2016FirstPartyCandidateSiteLiteralIssueQuotesVerified:verified.length,
  historicalSiteCaptureIsPublicByNotAuthoredAt:true,
  noOfficialMemberVotesDerivedFromCandidateSelfReports:true,
  noProductionDBForecastModelSchedulerChanges:0,
  originalFullCDXSources:indexes,sourceBodyClassifications:classifications,
  allExactSourceSnippetProofs:verified};
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
 console.log('CHAMBERLAIN-2016 ORIGINAL 10 SHORT QUOTES / ALL 7 HTML / ALL 5 CDX '+JSON.stringify({
  actual2021StateSenators:3,wholeCDX:indexes.length,fullHTMLBodies:originalPages.size,
  authentic2016CandidateOriginals:1,excludedTomassoniWordpress:2,
  quotedCandidateOriginalExcerpts:verified.length,productionChanges:0}));
}
main();
