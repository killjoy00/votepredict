/**
 * #864 research-only OFFLINE proof: original official LRL Senate-service
 * directory + six whole independent 2019-2020 Wayback CDX indexes
 * + all 24 unmodified original candidate website HTML bodies + 26 quotes.
 * No network, databases, 2027, forecasts, scheduler or production changes.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText,recheckOriginalHistoricalExcerpt}
 from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import ledger from '../../data/evaluation/senate-six-2020-original-pages-26-new-exact-first-party-excerpts-v1.json' with {type:'json'};
const sha=b=>createHash('sha256').update(b).digest('hex');
function source(p,min=50,max=5500000){
 const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'missing/incomplete original '+p);
 return readFileSync(p);
}
function arg(name){
 const a=process.argv.slice(2),i=a.indexOf(name);
 assert.ok(i>=0&&a.filter(x=>x===name).length===1&&a[i+1]&&!a[i+1].startsWith('--'),'missing '+name);
 return resolve(a[i+1]);
}
function main(){
 assert.equal(process.argv.length,10);
 const govPath=arg('--official-original-html'),receiptPath=arg('--original-official-utc-sha'),
 dir=arg('--original-six-2020-html-cdx-dir'),out=arg('--output');
 const gov=source(govPath,9000), meta=JSON.parse(source(receiptPath).toString());
 assert.equal(sha(gov),ledger.proof.originalGovernmentSHA256);
 assert.equal(meta.source?.url,'https://www.lrl.mn.gov/legdb/senate_dir');
 assert.equal(meta.source?.sourceBytesSha256,sha(gov));
 const official=parseOfficialMnSenateServiceDirectory(gov,meta.source.observedAt);
 const manifest=JSON.parse(source(join(dir,'acquisition-manifest.json')).toString());
 assert.equal(manifest.totals.actuallyServedSenatorPeople,6);
 assert.equal(manifest.totals.authenticOriginalHtmlAndIndependentCdxMatches,24);
 assert.equal(manifest.originalIndependentlyVerifiedOfficialLRLSenateDirectory.sourceSha256,sha(gov));
 assert.equal(manifest.actualSenateCandidateDomains.length,6);
 const all=new Map(),review=[];
 for(const p of manifest.actualSenateCandidateDomains){
  const service=validateActualSenateServiceForElection(official,p.candidateIdentity2020Lead,p.electionDistrict2020,2020);
  assert.equal(service.status,'verified_senate_service',p.candidateIdentity2020Lead);
  assert.equal(service.serviceForThisElectionFollowingYearVerified,true);
  assert.equal(service.officialName,p.actualLRLServedSenatorName);
  assert.equal(p.originalOfficialSenateDirectoryHtmlSha256,sha(gov));
  assert.equal(p.independentlyParsedHistoricalCdx,true);
  assert.equal(p.historicIndexHttpReceipt.status,200);
  const indexFile=source(join(dir,p.rawArchivedCdxIndexFile),20,1700000);
  assert.equal(sha(indexFile),p.historicIndexHttpReceipt.responseBodySha256);
  const index=JSON.parse(indexFile.toString());
  assert.deepEqual(index[0],['timestamp','original','mimetype','statuscode','digest','length']);
  assert.ok(index.length>1&&index.length<=301);
  assert.equal(p.authenticOriginalPageReceipts.length,4);
  for(const r of p.authenticOriginalPageReceipts){
   assert.ok(!all.has(r.originalFullHtmlSourceFile),'duplicate source filename');
   const bytes=source(join(dir,r.originalFullHtmlSourceFile),32,3000000);
   assert.equal(sha(bytes),r.originalFullHtmlSha256);
   assert.equal(historicalArchiveSha1Base32(bytes),r.independentlyIndexedHistoricalOriginalSha1Base32);
   const stamp=r.firstAttestedArchiveCaptureAtUtc.replace(/[^0-9]/g,'').slice(0,14);
   assert.ok(index.slice(1).some(row=>row[0]===stamp&&row[1]===r.originalWebsiteUrl
     &&row[3]==='200'&&row[4]===r.independentlyIndexedHistoricalOriginalSha1Base32));
   assert.equal(r.actualRetrievedOriginalHtmlMatchesIndependentHistoricalCdxDigest,true);
   all.set(r.originalFullHtmlSourceFile,{bytes,rec:r,
     person:p.candidateIdentity2020Lead,district:p.electionDistrict2020,
     visible:originalCampaignVisibleText(bytes)});
  }
  review.push({person:p.candidateIdentity2020Lead,allOriginalHtmlCount:4,
    fullIndependentCDXRows:index.length-1,indexReached300RowCap:p.historicalIndexReachedRowCap,
    statewideOrIndividualIssueCoverageCertified:false});
 }
 assert.equal(all.size,24);
 assert.equal(ledger.proof.officialActuallyServing2021Senators,6);
 assert.equal(ledger.proof.wholeOriginalCDXIndexes,6);
 assert.equal(ledger.proof.originalHTMLPages,24);
 assert.equal(ledger.proof.additionalShortStatements,26);
 assert.equal(ledger.proof.sourceDatesOnlyPublicByNotFirstAuthorship,true);
 assert.equal(ledger.proof.StevePageContainsOld2016CopyNotFresh2020Policy,true);
 assert.equal(ledger.proof.productionDatabaseEvidenceForecastModelSchedulerChanges,0);
 const byPage=new Map(ledger.sourcePages.map(p=>[p.id,p]));
 assert.equal(byPage.size,2);
 const ids=new Set(),phrases=new Set(),proof=[];
 for(const q of ledger.statements){
  assert.ok(!ids.has(q.id)&&!phrases.has(q.exactExcerpt),'duplicate quotation lead');
  ids.add(q.id);phrases.add(q.exactExcerpt);
  assert.ok(q.issueFamily&&q.exactExcerpt.length>=8&&q.exactExcerpt.length<=130);
  const p=byPage.get(q.pageId);assert.ok(p,'unlisted original page');
  const full=all.get(p.file);assert.ok(full,'missing full original HTML');
  assert.equal(p.person,full.person);assert.equal(p.district2020,full.district);
  assert.equal(p.url,full.rec.originalWebsiteUrl);
  assert.equal(p.captureUtc,full.rec.firstAttestedArchiveCaptureAtUtc);
  assert.equal(p.sha256,full.rec.originalFullHtmlSha256);
  assert.equal(p.cdxSha1,full.rec.independentlyIndexedHistoricalOriginalSha1Base32);
  const v=full.visible;
  if(q.pageId==='kunesh2020vision'){
   assert.ok(v.includes('Investing in Strong Families and Strong Communities'));
   assert.equal(q.statementKind,'original_2020_candidate_vision_platform');
  }else if(q.pageId==='cwod2019news'){
   const start=v.indexOf('Statement from Cwodzinski on Southwest');
   const end=v.indexOf('Early Voting Starts Soon');
   assert.ok(start>=0&&end>start&&v.slice(start,end).includes(q.exactExcerpt),
    'Quoted publisher relay/endorsement must not be attributed as original Cwodzinski statement');
   assert.equal(q.statementKind,'original_first_person_2016_statement_retained_in_2019_archive');
  }else throw Error('Unexpected historical page identity');
  const check=recheckOriginalHistoricalExcerpt({
   originalHtml:full.bytes,expectedOriginalHtmlSha256:p.sha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:p.cdxSha1,shortExcerpt:q.exactExcerpt});
  proof.push({id:q.id,person:p.person,originalCaptureUtc:p.captureUtc,
    originalHtmlSha256:check.sourceHtmlSha256,quoteSha256:check.excerptSha256,
    onlyResearchLead:true,originalAuthoredDateUnknown:true});
 }
 assert.equal(proof.length,26);
 assert.equal(proof.filter(p=>p.person==='Mary Kunesh').length,23);
 assert.equal(proof.filter(p=>p.person==='Steve Cwodzinski').length,3);
 const report={schema:'mn-2020-26-site-quote-original-byte-source-recheck-v1',
  originalGovernmentSenatorServiceSHA256:sha(gov),governmentActualServingPeople:6,
  fullOriginalHistoricalCDXIndexes:6,fullOriginalHistoricalPageBodies:24,
  exactFirstPartyWebsitePolicyStatementsVerified:26,originalAuthorDatesInferred:0,
  publisherEndorsementOrArticleStatementsMisattributed:0,
  former2016CopyMisrepresentedAsNew2020Writing:0,officialVotesInferred:0,
  statewideCoverageCertified:false,productionChanges:0,bySiteReview:review,exactQuoteProof:proof};
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log('VERIFIED 2020-SIX-SENATOR ALL-ORIGINAL-PAGES AND 26 NEW EXCERPTS '+JSON.stringify({
    stateSenators:6,indexes:6,wholeHtml:24,excerpts:26,productionChanges:0}));
}
main();
