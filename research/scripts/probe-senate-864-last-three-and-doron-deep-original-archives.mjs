/**
 * Issue 864 research only. Four independent historical source searches:
 * 3 remaining 2020 candidate-owned site gaps and Doron Clark's Jan 2025
 * original priorities / party questionnaire historical-version problem.
 * This acquisition NEVER promotes a quote or changes production.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const argv=process.argv.slice(2);
function arg(k){const i=argv.indexOf(k);assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing '+k);return resolve(argv[i+1]);}
const sha=b=>createHash('sha256').update(b).digest('hex');
function whole(path,min=100,max=7000000){
 const st=statSync(path);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'Original missing '+path);
 return readFileSync(path);
}
const track=argv[argv.indexOf('--track')+1];
const seeds=JSON.parse(whole(resolve('data/evaluation/senate-864-last-three-and-doron-2025-deep-original-source-queries-v1.json'),1000).toString());
assert.equal(seeds.schema,'mn-senate-864-remaining-three-and-doron-deep-original-source-queries-v1');
assert.equal(seeds.issue,864);
assert.equal(seeds.verification.currentOriginalWebsiteCovered,92);
assert.equal(seeds.verification.currentSiteExcerpts,1194);
assert.equal(seeds.verification.productionReadWrites,0);
assert.ok(['wiger','tomassoni','bakk','doron'].includes(track),'Unexpected target');
const person=seeds.people[track];
assert.ok(person&&person.queries.length>=7);
const government=whole(arg('--official-html'),9000);
const governmentReceipt=JSON.parse(whole(arg('--official-receipt')).toString());
const swear=whole(arg('--official-special-swearing-html'),9000);
assert.equal(sha(government),'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51');
assert.equal(governmentReceipt.source.sourceBytesSha256,sha(government));
assert.equal(governmentReceipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(sha(swear),governmentReceipt.supplementalSwearingSource.sourceBytesSha256);
const senate=parseOfficialMnSenateServiceDirectory(government,
 governmentReceipt.source.observedAt,swear,governmentReceipt.supplementalSwearingSource.observedAt);
assert.equal(senate.senators.length,105);
const actual=validateActualSenateServiceForElection(senate,person.name,person.district,person.electionYear);
assert.equal(actual.status,'verified_senate_service');
assert.equal(actual.officialName,person.official);
assert.equal(actual.serviceForThisElectionFollowingYearVerified,true);
const coverageRaw=whole(arg('--source-coverage-json'),10000);
const coverage=JSON.parse(coverageRaw.toString());
assert.equal(coverage.schema,'mn-2021-25-95-real-state-senator-original-first-party-research-coverage-v1');
assert.equal(coverage.summary.actualServingStateSenators,95);
assert.equal(coverage.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,92);
assert.equal(coverage.summary.totalExactResearchExcerptRowsForVerifiedSenators,1194);
assert.equal(coverage.summary.sourceOriginalGovernmentSHA256,sha(government));
const existing=coverage.byActuallyServedSenator.find(x=>x.officialName===person.official);
assert.ok(existing);
assert.equal(existing.originalSiteQuoteLeadCount,person.siteQuotesBefore);
const out=arg('--out-dir');mkdirSync(out,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function get(url){
 let last=null;
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const r=await fetch(url,{headers:{'User-Agent':'MN-2021-25-Historic-Source-Research/1.0'},
    signal:AbortSignal.timeout(18000)});
   const bytes=Buffer.from(await r.arrayBuffer());
   assert.ok(bytes.length<=7000000,'Source exceeds 7MB bound');
   last={status:r.status,bytes,contentType:r.headers.get('content-type'),url:r.url,ok:r.ok,attempt};
   if([429,502,503,504].includes(r.status)&&attempt<2){await pause(1200);continue;}
   return last;
  }catch(e){last={status:null,bytes:Buffer.alloc(0),contentType:null,ok:false,attempt,error:String(e).slice(0,200)};}
 }
 return last;
}
function iso(t){
 assert.match(t,/^\d{14}$/);
 return t.replace(/^(....)(..)(..)(..)(..)(..)$/,'$1-$2-$3T$4:$5:$6.000Z');
}
function identity(html){
 const v=originalCampaignVisibleText(html);
 return {mentionsFullCandidateName:v.toLowerCase().includes(person.name.toLowerCase()),
  mentionsCandidateSurname:new RegExp('\\b'+person.name.split(' ').at(-1)+'\\b','i').test(v),
  candidateCampaignFooter:/prepared and paid for by|paid for by|committee to elect|campaign committee/i.test(v),
  spamOrRepurposed:/payday loan|credit cards?|online casino|[ぁ-んァ-ン]{5,}/i.test(v),
  policyOrIssuesLanguage:/schools?|housing|healthcare|education|taxes?|jobs?|budget|workers?|public safety|priorities|platform|polic(y|ies)/i.test(v),
  limitedContext:v.slice(0,1200)};
}
function sourceTypeAllowed(kind){
 return ['candidate_owned_domain_hypothesis','candidate_owned_policy_page_historic',
 'other_office_governor_site_not_2020_senate',
 'campaign_produced_collateral_at_third_party_host',
 'party_questionnaire_link_page_not_candidate_site',
 'independent_publisher_candidate_written_reply_not_site',
 'party_questionnaire_version_not_proven'].includes(kind);
}
async function replay(indexId,row,mode,mime){
 const [timestamp,url,kind,status,digest]=row;
 const replayUrl='https://web.archive.org/web/'+timestamp+mode+'/'+url;
 const result={originalUrl:url,originalTimestampUtc:iso(timestamp),originalIndexSHA1Base32:digest,
  replayUrl,mode,replayStatus:null,replayedBodySha256:null,
  independentlyMatchesFullOriginalArchiveSHA1:false,originalFile:null,
  originalCandidateIdentityContext:null,sourceAutomaticallyAdmissible:false};
 const r=await get(replayUrl);
 result.replayStatus=r.status;
 if(r.bytes.length)result.replayedBodySha256=sha(r.bytes);
 if(r.status===200&&r.bytes.length>100&&/^[A-Z2-7]{32}$/.test(digest)&&historicalArchiveSha1Base32(r.bytes)===digest){
  result.independentlyMatchesFullOriginalArchiveSHA1=true;
  result.originalFile=indexId+'-'+timestamp+'-'+mode+'-whole-original.'+(mime==='application/pdf'?'pdf':'html');
  writeFileSync(join(out,result.originalFile),r.bytes,{flag:'wx'});
  if(mime==='text/html')result.originalCandidateIdentityContext=identity(r.bytes);
 }
 return result;
}
async function queryOne(q,i){
 assert.ok(sourceTypeAllowed(q.kind));
 assert.ok(['exact','prefix','domain'].includes(q.match));
 assert.match(q.from,/^\d{8}$/);assert.match(q.to,/^\d{8}$/);
 assert.ok(q.from<=q.to);
 assert.ok(q.to<=person.electionDate.replaceAll('-',''),'Cannot query after election');
 const id=String(i+1).padStart(2,'0')+'-'+track;
 const params=new URLSearchParams({url:q.url,matchType:q.match,from:q.from,to:q.to,
  output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'100'});
 params.append('filter','statuscode:200');params.append('filter','mimetype:'+q.mime);
 const originalIndexUrl='https://web.archive.org/cdx/search/cdx?'+params.toString();
 const r=await get(originalIndexUrl);
 const item={id,query:q,originalIndexUrl,originalIndexStatus:r.status,
  entireReturnedIndexSha256:r.bytes.length?sha(r.bytes):null,entireReturnedIndexFile:null,
  exactIndependentIndexRows:0,boundedIndexMayBeTruncated:false,error:r.error||null,
  originalReplays:[],replayLimitPerQuery:4,
  candidateOwnedSiteAlreadyAuthenticated:false,preElectionPDFVersionVerified:false,
  noAutomaticExcerptOrForecastEligibility:true};
 if(!r.ok){item.error=item.error||'Original archive index unavailable: '+r.status;return item;}
 let table;
 try{
  table=JSON.parse(r.bytes.toString());
  assert.ok(Array.isArray(table)&&table.length>=1&&table.length<=101);
  assert.deepEqual(table[0],['timestamp','original','mimetype','statuscode','digest','length']);
  item.exactIndependentIndexRows=table.length-1;
  item.boundedIndexMayBeTruncated=table.length-1===100;
  item.entireReturnedIndexFile=id+'-whole-returned-archive-index.json';
  writeFileSync(join(out,item.entireReturnedIndexFile),r.bytes,{flag:'wx'});
 }catch(e){item.error='Original index not verified JSON: '+String(e).slice(0,200);return item;}
 const cutoff=person.electionDate.replaceAll('-','')+'000000';
 const candidates=table.slice(1).filter(x=>x[0]<cutoff&&x[2]===q.mime&&x[3]==='200'
  &&/^[A-Z2-7]{32}$/.test(x[4])&&/^https?:\/\//i.test(x[1]))
  .sort((a,b)=>{
   const score=x=>/priorities|issues|platform|policy|positions/i.test(x[1])?1:0;
   return score(b)-score(a)||b[0].localeCompare(a[0]);
  });
 const triedPaths=new Set();
 for(const row of candidates){
  const path=new URL(row[1]).pathname.toLowerCase();
  if(triedPaths.has(path))continue;triedPaths.add(path);
  for(const mode of ['id_','if_']){
   if(item.originalReplays.length>=4)break;
   const rec=await replay(id,row,mode,q.mime);
   item.originalReplays.push(rec);
   if(rec.independentlyMatchesFullOriginalArchiveSHA1)break;
  }
  if(item.originalReplays.length>=4)break;
 }
 return item;
}
const queries=person.queries;
const items=new Array(queries.length);
let cursor=0;
await Promise.all(Array.from({length:3},async()=>{
 while(cursor<queries.length){
  const n=cursor++;items[n]=await queryOne(queries[n],n);await pause(250);
 }
}));
async function commonCrawlHints(){
 if(track!=='doron')return [];
 const result=[];
 for(const index of ['CC-MAIN-2024-51','CC-MAIN-2025-05','CC-MAIN-2025-08']){
  const url='https://index.commoncrawl.org/'+index+'-index?url=www.doronforsenate.org%2Fpriorities&output=json';
  const r=await get(url);
  const lines=r.ok?r.bytes.toString().trim().split('\n').filter(Boolean):[];
  const records=[];
  for(const line of lines.slice(0,30)){
   try{const x=JSON.parse(line);records.push({url:x.url,timestamp:x.timestamp,digest:x.digest,
    warcFilename:x.filename,offset:x.offset,length:x.length,mime:x.mime,status:x.status});}catch{}
  }
  result.push({index,url,status:r.status,wholeIndexResponseSHA256:r.bytes.length?sha(r.bytes):null,
   resultCount:records.length,records,hasNotReopenedFullWARCBytes:true,
   independentlyAuthenticatedPreElectionPageBody:false});
 }
 return result;
}
const cc=await commonCrawlHints();
const findings=items.flatMap(x=>x.originalReplays.filter(r=>r.independentlyMatchesFullOriginalArchiveSHA1)
 .map(r=>({queryId:x.id,kind:x.query.kind,originalUrl:r.originalUrl,originalTimestampUtc:r.originalTimestampUtc,
  sha256:r.replayedBodySha256,identity:r.originalCandidateIdentityContext,fullOriginalFile:r.originalFile})));
const report={schema:'mn-senate-864-last-three-and-doron-deep-acquisition-4-way-v1',issue:864,
 track,person:person.name,officialName:person.official,senateDistrict:person.district,
 serviceElectionYear:person.electionYear,electionDate:person.electionDate,
 originalGovernmentFullHtmlSHA256:sha(government),originalSupplementalSwearingSha256:sha(swear),
 censusEntireReportSha256:sha(coverageRaw),censusRealSenators:95,
 censusPreviouslyAuthenticatedCandidateOwnedSites:92,censusShortCandidateOwnedSiteQuotes:1194,
 currentCandidateOwnedSiteQuotesBeforeThisAcquisition:person.siteQuotesBefore,
 sourceQueries:items,commonCrawlUnverifiedIndexHints:cc,
 independentlyOriginalDigestMatchedFullArchiveBodies:findings,
 candidateOwnedSiteCoverageIncreaseFromAcquisition:0,
 exactLiteralSourceExcerptsAutomaticallyAccepted:0,
 currentDoronQuestionnairePDFBytesCertifiedJanuary2025:false,
 noCandidateOwnedSiteCountWithoutIndependentIdentityAndQuoteAudit:true,
 policyStatementCaptureDateNotFirstAuthoredDate:true,
 originalSiteAndPartyPublishedKindsNeverConflated:true,
 originalArchiveFailuresAreUnknownNotEvidenceOfNoStatement:true,
 sourceArchivesMayBeCappedOrRateLimited:true,
 productionDbReadsOrWrites:0,automaticForecastIngestion:0,modelTrainingOrSchedulersChanged:0};
const file='original-campaign-research-'+track+'-deep-probe.json';
writeFileSync(join(out,file),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('HISTORIC SOURCE ACQUISITION COMPLETED '+JSON.stringify({
 track,queryCount:items.length,indexSuccess:items.filter(x=>!!x.entireReturnedIndexFile).length,
 verifiedFullIndexedOriginals:findings.length,verifiedOriginalFileList:findings.map(x=>x.fullOriginalFile),
 cappedIndices:items.filter(x=>x.boundedIndexMayBeTruncated).length,
 originalWebsiteEvidenceAutomaticallyAdded:0,productionDbWrites:0}));
