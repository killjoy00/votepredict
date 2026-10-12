/**
 * Issue #864: authenticate Bruce Anderson 14 original historical site issue
 * headings against full 160-row original Wayback CDX SHA1/Base32 and source
 * HTML SHA256. Site ownership corroborated independently by contemporaneous
 * first-party issue embed because issues body alone lacks senator name.
 * Preserve copyright footer 2012, unknown first-posted date.
 * Research only, zero production/prediction/model/vote changes.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const govSHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const args=process.argv.slice(2);
function arg(k){const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+k);return resolve(args[i+1]);}
function read(p,min=50,max=5000000){const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,p);return readFileSync(p);}
const gov=read(arg('--official-html'),9000),receipt=JSON.parse(read(arg('--official-receipt')).toString()),
 swear=read(arg('--official-special-swearing-html'),9000);
assert.equal(sha(gov),govSHA);
assert.equal(receipt.source.sourceBytesSha256,govSHA);
assert.equal(sha(swear),receipt.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(gov,receipt.source.observedAt,
 swear,receipt.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const ledger=JSON.parse(read(resolve('data/evaluation/senate-bruce-anderson-14-full-original-issues-leads-v1.json')).toString());
const s=ledger.scope;
assert.equal(ledger.schema,'mn-senate-bruce-anderson-14-historical-original-campaign-issues-short-leads-v1');
assert.equal(s.issue,864);
assert.equal(s.governmentOriginalSenateServiceSHA256,govSHA);
assert.equal(s.source2022ExactOriginalAcquisitionRun,38187575772);
assert.equal(s.source2022ExactOriginalArtifact,11719743549);
assert.equal(s.independentFullOriginal160RowCDXRun,38175993447);
assert.equal(s.independentFullOriginal160RowCDXArtifact,11716126718);
assert.equal(s.senatorsPreviouslyWithFirstPartyIssueOriginals,84);
assert.equal(s.shortSourceResearchRowsBeforeAddition,1079);
assert.equal(s.newlyCoveredActualSenators,1);
assert.equal(s.fullOriginalHistoricalIssuePages,1);
assert.equal(s.shortLiteralIssueHeadings,14);
assert.equal(s.sourceSiteFooterCopyright2012DoesNotProvePageFirstAuthorDate,true);
assert.equal(s.originalArchived2022CaptureIsPublicByOnly,true);
assert.equal(s.firstAuthoredDateProven,false);
assert.equal(s.originCampaignBrandingSeparateAuthenticOEmbed,true);
assert.equal(s.fullOriginalSiteCensusProven,false);
assert.equal(s.archiveAbsenceNeverNoPolicy,true);
assert.equal(s.productionDatabaseOrForecastsOrOfficialVotes,0);
assert.equal(ledger.pages.length,1);
assert.equal(ledger.excerpts.length,14);
const p=ledger.pages[0];
assert.equal(p.id,'bruce-original-2022-issues');
assert.equal(p.person,'Bruce Anderson');
assert.equal(p.officialSenateDirectoryName,'Bruce Douglas Anderson');
assert.equal(p.district,'29');
assert.equal(p.serviceElectionYear,2022);
assert.equal(p.originalUrl,'https://www.bruceforsenate.com/issues/');
assert.equal(p.archiveCapturePublicByUTC,'2022-10-28T09:08:42.000Z');
assert.equal(p.originalHtmlFile,'bruce-anderson-20221028090842-full-issues-original.html');
assert.equal(p.originalFullHtmlSHA256,'96b3660689b66e9f727641093653daabbde343fef33e2da363419a1a0c9968e3');
assert.equal(p.wholeIndependentSourceCdxSHA256,'c9e6bedc2dd0874e3782fb2da431c466f8851a07050d440c23bb3ffe89bb9202');
assert.equal(p.originalCdxSHA1Base32,'A6VXHCA25EDES6BLU3BTKGLVMMVLFGGE');
assert.equal(p.historicalSourceKind,'candidate_owned_2022_capture_with_2012_copyright_footer_no_first_authored_date');
assert.equal(p.candidateIdentityFromSeparateOriginalSameDateOembed,'Issues – Bruce Anderson for State Senate');
assert.equal(p.firstAuthoredDateKnown,false);
assert.equal(p.officialVoteVerified,false);
assert.equal(p.automaticallyEligibleForForecast,false);
assert.ok(p.archiveCapturePublicByUTC<'2022-11-08T00:00:00.000Z');
const member=validateActualSenateServiceForElection(official,p.person,p.district,2022);
assert.equal(member.status,'verified_senate_service');
assert.equal(member.serviceForThisElectionFollowingYearVerified,true);
assert.equal(member.officialName,p.officialSenateDirectoryName);
const priorDir=arg('--first20-source-dir'),bruceDir=arg('--bruce-exact-original-dir');
const first=JSON.parse(read(join(priorDir,'first-20-senators-historical-candidate-site-originals-manifest.json')).toString());
assert.equal(first.schema,'mn-2021-25-first-batch-20-uncovered-actual-senators-26-original-archive-search-windows-v1');
assert.equal(first.independentGovernmentLRLSourceSha256,govSHA);
const w=first.originalSourceWindows.filter(w=>w.person==='Bruce Anderson'&&w.originalCandidateDomainLead==='bruceforsenate.com');
assert.equal(w.length,1);
assert.equal(w[0].indexRows,160);
assert.equal(w[0].indexError,null);
assert.equal(w[0].fullOriginalCdxResponseSha256,p.wholeIndependentSourceCdxSHA256);
const bytes=read(join(priorDir,w[0].fullOriginalCdxFilename));
assert.equal(sha(bytes),p.wholeIndependentSourceCdxSHA256);
const rows=JSON.parse(bytes.toString());
assert.deepEqual(rows[0],['timestamp','original','mimetype','statuscode','digest','length']);
assert.equal(rows.length-1,160);
const key='20221028090842';
const cdxMatch=rows.slice(1).filter(r=>r[0]===key&&r[1]===p.originalUrl
 &&r[2]==='text/html'&&r[3]==='200'&&r[4]===p.originalCdxSHA1Base32);
assert.equal(cdxMatch.length,1,'The full original independent CDX must index this exact URL+time+digest');
const ident=w[0].originalHtmlReplays.filter(r=>r.retainedRawOriginalHtml==='14-bruce-anderson-2022-1-original-20221028152223.html');
assert.equal(ident.length,1);
const embed=read(join(priorDir,ident[0].retainedRawOriginalHtml));
assert.equal(sha(embed),ident[0].fullResponseSha256);
assert.equal(historicalArchiveSha1Base32(embed),ident[0].originalCdxIndexedSha1Base32);
assert.equal(ident[0].originalSiteUrl,'https://www.bruceforsenate.com/issues/embed/');
assert.equal(ident[0].captureUtc,'2022-10-28T15:22:23.000Z');
assert.ok(originalCampaignVisibleText(embed).includes(p.candidateIdentityFromSeparateOriginalSameDateOembed),
 'No independent contemporaneous candidate ownership attribution from original embed');
const receiptFile=JSON.parse(read(join(bruceDir,'bruce-anderson-2022-exact-issues-original-source-proof.json')).toString());
assert.equal(receiptFile.schema,'mn-bruce-anderson-exact-2022-original-issues-recovery-v1');
assert.equal(receiptFile.issue,864);
assert.equal(receiptFile.actualServingSenator,p.officialSenateDirectoryName);
assert.equal(receiptFile.originalComplete160RowCdxSHA256,p.wholeIndependentSourceCdxSHA256);
assert.equal(receiptFile.exactCandidateIssueOriginalUrl,p.originalUrl);
assert.equal(receiptFile.independentlyCdxIndexedOriginalCaptureUtc,p.archiveCapturePublicByUTC);
assert.equal(receiptFile.independentlyCdxIndexedSha1Base32,p.originalCdxSHA1Base32);
assert.equal(receiptFile.fullRawReplayHtmlSha256,p.originalFullHtmlSHA256);
assert.equal(receiptFile.exactSha1Base32MatchesEntireOriginalIndex,true);
assert.equal(receiptFile.distinctOriginalCandidateIdentityAndOfficeProvenBySameDateFullEmbed,true);
assert.equal(receiptFile.replayHttpStatus,200);
assert.equal(receiptFile.originalHtmlRetainedFilename,p.originalHtmlFile);
assert.equal(receiptFile.candidateIssuePositionExcerptsAutomaticallyIngested,0);
const html=read(join(bruceDir,p.originalHtmlFile),500);
assert.equal(sha(html),p.originalFullHtmlSHA256);
assert.equal(historicalArchiveSha1Base32(html),p.originalCdxSHA1Base32);
const originalVisible=originalCampaignVisibleText(html);
assert.ok(originalVisible.startsWith('Issues Home Contribute Volunteer Endorse Lawn Sign About Bruce Issues Contact Issues'));
assert.ok(originalVisible.includes('(c) 2012'),'Original old website footer must not be erased');
const seen=new Set(),quoteProof=[];
for(const q of ledger.excerpts){
 assert.equal(q.pageId,p.id);
 assert.equal(q.attributionClass,'historical_candidate_site_issue_heading_not_specific_first_authorship_date');
 assert.match(q.issueFamily,/^[a-z_]+$/);
 assert.ok(q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130);
 assert.equal(q.firstAuthoredDateKnown,false);
 assert.equal(q.officialLegislativeActionVerified,false);
 assert.equal(q.automaticallyEligibleForForecast,false);
 assert.ok(!seen.has(q.exactShortExcerpt));seen.add(q.exactShortExcerpt);
 assert.ok(originalVisible.includes(q.exactShortExcerpt),'Missing exact short original HTML heading '+q.id);
 quoteProof.push({excerptId:q.id,shortOriginalQuoteSHA256:sha(Buffer.from(q.exactShortExcerpt)),
  independentlyReopenedCompleteOriginalHTMLLiteralMatched:true,notOriginalFirstPublicationProof:true});
}
assert.equal(quoteProof.length,14);
const output={schema:'mn-bruce-anderson-14-original-site-2022-capture-independent-entire-cdx-html-audit-v1',
 trueMinnesotaSenatorServiceVerified:1,officialOriginalGovernmentSHA256:sha(gov),
 fullOriginal160RowCdxSHA256:sha(bytes),originalCapturedHtmlSHA256:sha(html),
 firstPartySenateCandidateAttributionFromSeparateSameDateOriginalEmbed:true,
 fullOriginalIssuesPageAndIndependentCdxSha1Base32Reverified:true,
 exactShortHistoricalOriginalSiteIssueHeadings:14,old2012CopyrightNotFirstAuthoredDate:true,
 archiveFailuresProofOfNoCandidatePolicy:false,productionDatabaseAndForecastWrites:0,
 originalFirstPartyPublicByUtc:p.archiveCapturePublicByUTC,originalCandidateUrl:p.originalUrl,
 separatelySHAAuthenticatedLiteralExcerpts:quoteProof};
const dest=arg('--output-json');mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log('BRUCE HISTORIC ORIGINAL 14 FIRST-PARTY SOURCE HEADINGS AUDITED '+JSON.stringify({
 servingSenatorsNew:1,exactShortSourceHeadings:14,fullCDXRows:160,productionWrites:0}));
