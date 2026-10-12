/**
 * #864: reopen independently indexed full original 2022 Bruce Anderson
 * candidate issues page. The previous 20-person probe required surname in
 * visible issues HTML and saved only oEmbed; verify identity from *separate*
 * same-date/same-domain authentic first-party title-bearing original instead.
 * Source acquisition is not automated statement admission or forecast input.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const originalGovSHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const originalIndexSHA='c9e6bedc2dd0874e3782fb2da431c466f8851a07050d440c23bb3ffe89bb9202';
const originalUrl='https://www.bruceforsenate.com/issues/';
const exactIndexCapture='20221028090842';
const originalIndexDigest='A6VXHCA25EDES6BLU3BTKGLVMMVLFGGE';
const args=process.argv.slice(2);
function opt(k){const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+k);return resolve(args[i+1]);}
function read(p,min=50,max=6000000){const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,p);return readFileSync(p);}
const gov=read(opt('--official-html'),9000),audit=JSON.parse(read(opt('--official-receipt')).toString());
const swearing=read(opt('--official-special-swearing-html'),9000);
const firstDir=opt('--prior-first20-original-dir'),out=opt('--out-dir');
assert.equal(sha(gov),originalGovSHA);
assert.equal(audit.source.sourceBytesSha256,originalGovSHA);
assert.equal(sha(swearing),audit.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(gov,audit.source.observedAt,
 swearing,audit.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const senator=validateActualSenateServiceForElection(official,'Bruce Anderson','29',2022);
assert.equal(senator.status,'verified_senate_service');
assert.equal(senator.serviceForThisElectionFollowingYearVerified,true);
const m=JSON.parse(read(join(firstDir,'first-20-senators-historical-candidate-site-originals-manifest.json')).toString());
assert.equal(m.schema,'mn-2021-25-first-batch-20-uncovered-actual-senators-26-original-archive-search-windows-v1');
assert.equal(m.independentGovernmentLRLSourceSha256,originalGovSHA);
const previous=m.originalSourceWindows.find(w=>w.person==='Bruce Anderson'&&w.originalCandidateDomainLead==='bruceforsenate.com');
assert.ok(previous);
assert.equal(previous.originalOfficialElectionDistrict,'29');
assert.equal(previous.electionYear,2022);
assert.equal(previous.indexRows,160);
assert.equal(previous.fullOriginalCdxResponseSha256,originalIndexSHA);
const cdx=read(join(firstDir,previous.fullOriginalCdxFilename));
assert.equal(sha(cdx),originalIndexSHA);
const rows=JSON.parse(cdx.toString());
assert.deepEqual(rows[0],['timestamp','original','mimetype','statuscode','digest','length']);
assert.equal(rows.length-1,160);
assert.equal(rows.slice(1).filter(v=>v[0]===exactIndexCapture&&v[1]===originalUrl&&v[2]==='text/html'&&v[3]==='200'&&v[4]===originalIndexDigest).length,1);
const identifying=previous.originalHtmlReplays.filter(x=>x.retainedRawOriginalHtml==='14-bruce-anderson-2022-1-original-20221028152223.html');
assert.equal(identifying.length,1);
const title=identifying[0],titleHtml=read(join(firstDir,title.retainedRawOriginalHtml));
assert.equal(title.originalSiteUrl,'https://www.bruceforsenate.com/issues/embed/');
assert.equal(title.captureUtc,'2022-10-28T15:22:23.000Z');
assert.equal(title.fullResponseSha256,sha(titleHtml));
assert.equal(historicalArchiveSha1Base32(titleHtml),title.originalCdxIndexedSha1Base32);
assert.ok(originalCampaignVisibleText(titleHtml).includes('Issues – Bruce Anderson for State Senate'),
 'Independent contemporaneous exact-domain source must state actual senator and office');
const timestampUtc='2022-10-28T09:08:42.000Z';
assert.ok(timestampUtc<'2022-11-08T00:00:00.000Z');
const waybackUrl='https://web.archive.org/web/'+exactIndexCapture+'id_/'+originalUrl;
let outcome=null;
for(let attempt=1;attempt<=3;attempt++){
 try{
  const response=await fetch(waybackUrl,{
   headers:{'User-Agent':'Minnesota-Senate-Original-Site-Attribution-Research/1.0'},
   signal:AbortSignal.timeout(35000)});
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length<4000000);
  outcome={httpStatus:response.status,actualUrl:response.url,bytes,attempt,
   contentType:response.headers.get('content-type')};
  if([429,502,503,504].includes(response.status)&&attempt<3)continue;
  break;
 }catch(e){
  outcome={httpStatus:null,bytes:Buffer.alloc(0),attempt,error:String(e).slice(0,200)};
  if(attempt===3)break;
 }
}
assert.ok(outcome);
mkdirSync(out,{recursive:true});
const record={schema:'mn-bruce-anderson-exact-2022-original-issues-recovery-v1',
 issue:864,officialOriginalStateSenateDirectorySHA256:sha(gov),actualServingSenator:senator.officialName,
 originalFirst20SourceRun:38175993447,originalFirst20SourceArtifact:11716126718,
 originalComplete160RowCdxSHA256:sha(cdx),exactCandidateIssueOriginalUrl:originalUrl,
 independentlyCdxIndexedOriginalCaptureUtc:timestampUtc,independentlyCdxIndexedSha1Base32:originalIndexDigest,
 archiveOriginalReplayUrl:waybackUrl,replayHttpStatus:outcome.httpStatus,
 replayAttempts:outcome.attempt,fullRawReplayHtmlSha256:outcome.bytes.length?sha(outcome.bytes):null,
 originalHtmlRetainedFilename:null,exactSha1Base32MatchesEntireOriginalIndex:false,
 distinctOriginalCandidateIdentityAndOfficeProvenBySameDateFullEmbed:true,
 originalVisibleIssueTextFirst8000:null,
 candidateIssuePositionExcerptsAutomaticallyIngested:0,archiveFailureImpliesNoPolicies:false,
 firstAuthoredDateInferredFromArchive:false,productionReadsWritesAndForecasts:0};
if(outcome.httpStatus===200&&outcome.bytes.length>=100){
 record.exactSha1Base32MatchesEntireOriginalIndex=historicalArchiveSha1Base32(outcome.bytes)===originalIndexDigest;
 if(record.exactSha1Base32MatchesEntireOriginalIndex){
  record.originalHtmlRetainedFilename='bruce-anderson-20221028090842-full-issues-original.html';
  writeFileSync(join(out,record.originalHtmlRetainedFilename),outcome.bytes,{flag:'wx'});
  record.originalVisibleIssueTextFirst8000=originalCampaignVisibleText(outcome.bytes).slice(0,8000);
 }
}
writeFileSync(join(out,'bruce-anderson-2022-exact-issues-original-source-proof.json'),
 JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log('BRUCE ANDERSON 2022 FULL ORIGINAL ISSUES '+JSON.stringify({
 status:record.replayHttpStatus,independentOriginalDigestMatched:record.exactSha1Base32MatchesEntireOriginalIndex,
 retainedFullHTML:record.originalHtmlRetainedFilename,productionWrites:0}));
