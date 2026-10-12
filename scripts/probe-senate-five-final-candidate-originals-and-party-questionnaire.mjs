/**
 * #864 final five: five independent parallel 2020/2022/2025 candidate-owned
 * website archive checks plus independently sourced, separately typed direct
 * candidate/legislator historical remarks. Never confuse publisher/party
 * statements, current site, and original archived campaign position evidence.
 * Entire government, prior research census, CDX and HTML SHA must be reopened.
 * This script WRITES ONLY GitHub Actions research artifacts, never the app DB.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';

const sha=b=>createHash('sha256').update(b).digest('hex');
const governmentSHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const coverageSHA='b102b4bdc25386358474f00847f5ed9d89c03b3a4e5fd7eec8fa41f2e98103f0';
const pinnedPhaIndexSHA='6c7e322bc0bf23c0c75d8fe91edd5cbd0988ab1dc225a6e594bc1508327c29c9';
const argv=process.argv.slice(2);
function arg(f){const i=argv.indexOf(f);assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing '+f);return argv[i+1];}
function load(p,min=50,max=7000000){const v=statSync(p);assert.ok(v.isFile()&&v.size>=min&&v.size<=max,'Missing full original '+p);return readFileSync(p);}
const track=arg('--person');assert.ok(['pha','clark','tomassoni','wiger','bakk'].includes(track));
const out=resolve(arg('--out-dir'));mkdirSync(out,{recursive:true});
const gov=load(resolve(arg('--official-html')),9000);
const receipt=JSON.parse(load(resolve(arg('--official-receipt'))).toString());
const swearing=load(resolve(arg('--official-special-swearing-html')),9000);
assert.equal(sha(gov),governmentSHA);
assert.equal(receipt.source.sourceBytesSha256,governmentSHA);
assert.equal(receipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(sha(swearing),receipt.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(
 gov,receipt.source.observedAt,swearing,receipt.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const priorRaw=load(resolve(arg('--prior-90-coverage-json')),9000,2000000);
assert.equal(sha(priorRaw),coverageSHA);
const prior=JSON.parse(priorRaw.toString());
assert.equal(prior.summary.actualServingStateSenators,95);
assert.equal(prior.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,90);
assert.equal(prior.summary.actuallyServedSenatorsUnobservedInSelectedOriginalSiteSourceLedgers,5);
assert.equal(prior.summary.totalExactResearchExcerptRowsForVerifiedSenators,1173);
const people={
 pha:{person:'Susan Pha',official:'Susan Pha',district:'38',electionYear:2022,election:'2022-11-08'},
 clark:{person:'Doron Clark',official:'Doron Clark',district:'60',electionYear:2025,election:'2025-01-28'},
 tomassoni:{person:'David Tomassoni',official:'David J. Tomassoni',district:'6',electionYear:2020,election:'2020-11-03'},
 wiger:{person:'Charles Wiger',official:'Sr., Charles W. Wiger',district:'43',electionYear:2020,election:'2020-11-03'},
 bakk:{person:'Thomas Bakk',official:'Thomas M. Bakk',district:'3',electionYear:2020,election:'2020-11-03'}
};
const p=people[track];
const actuallyServed=validateActualSenateServiceForElection(official,p.person,p.district,p.electionYear);
assert.equal(actuallyServed.status,'verified_senate_service');
assert.equal(actuallyServed.officialName,p.official);
assert.equal(actuallyServed.serviceForThisElectionFollowingYearVerified,true);
const member=prior.byActuallyServedSenator.find(q=>q.officialName===p.official);
assert.ok(member);assert.equal(member.originalSiteQuoteLeadCount,0);
const cutoff=p.election.replaceAll('-','')+'000000';
const Q=(host,path,match='exact',from='20000101',lead='unverified domain hypothesis')=>
 ({host,path,match,from,lead,kind:'candidate_owned_domain_hypothesis'});
const M=(url,articleDate,attribution)=>({url,articleDate,attribution,kind:'publisher_or_caucus_not_candidate_owned_site'});
const seeds={
 pha:{
  sites:[
   Q('votesusanpha.com','/','exact','20210101','independently historical 2022 candidate domain indexed 26 old originals'),
   Q('www.susanphaforsenate.com','/','exact','20210101','2022 Pioneer Press candidate questionnaire publicly printed this website'),
   Q('susanphaforsenate.com','/issues','prefix','20210101','2022 published candidate domain, verify 2022 original'),
   Q('votesusanpha.com','/platform','prefix','20210101','previous domain candidate policy page hypotheses'),
  ],
  media:[M('https://www.yahoo.com/news/minnesota-elections-2022-senate-district-043100446.html',
    '2022-10-18','Pioneer Press candidate-submitted District 38 pre-election questionnaire mirrored at Yahoo')]
 },
 clark:{
  sites:[
   Q('www.doronforsenate.org','/','exact','20241201','2025 January 12 publicly linked genuine committee candidate domain'),
   Q('www.doronforsenate.org','/priorities','exact','20241201','2025 special original issues page, prior Wayback digest mismatch'),
   Q('doronforsenate.org','/priorities','prefix','20241201','2025 pre-January 28 original priorities alternatives'),
   Q('doronforsenate.org','/about','prefix','20241201','2025 pre-special election biography/priority section'),
  ],
  media:[M('https://naomikritzer.com/2025/01/12/special-election-2025-senate-district-60/',
    '2025-01-12','Jan12 contemporary outsider blog actually links candidate-submitted SD60 DFL policy questionnaire Google Drive file ID')],
  googleDriveCandidateQuestionnaire:'1pbX-cHOKJFfMT4roJDXx-cNUdPs_-G46'
 },
 tomassoni:{
  sites:[
   Q('tomassoni4senate.com','/','exact','20000101','historical formerly authentic campaign domain, all post-2016 spam strictly excluded'),
   Q('www.tomassoni4senate.com','/issues','prefix','20000101','historical pre-spam site hypothetical issues originals'),
   Q('tomassoniforsenate.com',null,'domain','20000101','historical candidate Senate committee alternate'),
   Q('davetomassoni.com',null,'domain','20000101','historical candidate personally named alternate'),
  ],
  media:[
   M('https://senatedfl.mn/senator-tomassoni-calls-for-special-session-to-immediately-pass-supplemental-budget/',
      '2020-09-28','Senate DFL caucus published attributed original pre-election Tomassoni special session priorities'),
   M('https://senatedfl.mn/senate-bonding-committee-heading-to-the-iron-range/',
      '2015-09-14','older senator-authored 2015 direct infrastructure priority context, not 2020 platform')
  ]
 },
 wiger:{
  sites:[
   Q('www.senate.mn','/senatorwiger','prefix','20060101','2012 actual candidate questionnaire links official Senate Wiger site, NOT campaign committee domain'),
   Q('wigerforsenate.com',null,'domain','20050101','old genuine candidate committee name hypothesis'),
   Q('chuckwiger.com',null,'domain','20050101','old candidate named site hypothesis'),
   Q('senatorwiger.com',null,'domain','20050101','personal domain hypothesis'),
  ],
  media:[
   M('https://senatedfl.mn/senator-wiger-statement-on-second-special-session/',
      '2020-07-22','2020 direct senator statement addressing policing infrastructure education public spending'),
   M('https://senatedfl.mn/preventing-the-use-of-lead-in-fish-tackle/',
      '2020-03-05','2020 explicitly attributed first-person Wiger lead fishing tackle regulation policy'),
   M('https://patch.com/minnesota/oakdale/chuck-wiger-candidate-for-minnesota-senate-district-43',
      '2012-08-20','2012 candidate-submitted publisher profile not owned campaign site')
  ]
 },
 bakk:{
  sites:[
   Q('bakkforsenate.com',null,'domain','20000101','unverified old Senate campaign name hypothesis'),
   Q('tombakkforsenate.com',null,'domain','20000101','unverified old campaign name hypothesis'),
   Q('tombakk.com','/','exact','20000101','known historical 2008 governor bid; do NOT attribute as 2020 Senate campaign'),
   Q('bakkformn.com',null,'domain','20000101','unverified historic campaign domain'),
  ],
  media:[
   M('https://www.mprnews.org/story/2020/01/13/senate-gop-priorities-include-tax-relief-for-farmers-social-security-recipients',
      '2020-01-13','MPR January 13 2020 direct written Tom Bakk affordable health school paid leave public safety quote'),
   M('https://wtip.org/a-conversation-with-senator-tom-bakk/',
      '2020-02-20','WTIP February 2020 actual Bakk audio interview, no independently verified full verbatim transcript'),
   M('https://senatedfl.mn/author/senator-david-tomassoni/',
      '2020-09-23','Senate DFL article index references a joint 2020 Tomassoni-Bakk statement; index is not Bakk direct speaker attribution')
  ]
 }
};
const cfg=seeds[track];
assert.ok(cfg.sites.length===4&&cfg.media.length>=1);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(url){
 let answer;
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const r=await fetch(url,{headers:{'User-Agent':'MN-2021-25-Historical-StateSenate-Original-Site-Research/1.0'},
    signal:AbortSignal.timeout(24000)});
   const bytes=Buffer.from(await r.arrayBuffer());
   assert.ok(bytes.length<6000000,'Unbounded source');
   answer={status:r.status,ok:r.ok,bytes,attempt,responseUrl:r.url,contentType:r.headers.get('content-type')};
   if([429,502,503,504].includes(r.status)&&attempt<2){await sleep(1500);continue;}
   return answer;
  }catch(e){answer={status:null,ok:false,bytes:Buffer.alloc(0),attempt,error:String(e).slice(0,220)};}
 }
 return answer;
}
function context(bytes){
 const t=originalCampaignVisibleText(bytes);
 return {candidateNameAppears:t.toLowerCase().includes(p.person.toLowerCase()),
  candidateSurnameAppears:t.toLowerCase().includes(p.person.split(' ').at(-1).toLowerCase()),
  campaignOrOfficeText:/paid for by|prepared and paid|committee to elect|state senate|senator/i.test(t),
  apparentSpam:/casino|credit card|payday loan|[ぁ-んァ-ン]{5,}/i.test(t),
  originalVisibleFirst1400:t.slice(0,1400),
  policyContexts:[...t.matchAll(/\b(policy|priorities|schools?|housing|education|healthcare|economy|taxes?|public safety|workers?|legislation|bonding)\b/gi)]
   .slice(0,10).map(m=>t.slice(Math.max(0,m.index-60),Math.min(t.length,m.index+120)))};
}
function archiveCapture(t){
 assert.match(t,/^\d{14}$/);
 return t.replace(/^(....)(..)(..)(..)(..)(..)$/,'$1-$2-$3T$4:$5:$6.000Z');
}
let seq=0;
async function indexed(query){
 const id=String(++seq).padStart(2,'0')+'-'+track;
 const url=query.kind==='candidate_owned_domain_hypothesis'?query.host+(query.path??''):query.url;
 const params=new URLSearchParams({url,matchType:query.kind==='candidate_owned_domain_hypothesis'?query.match:'exact',
  from:query.kind==='candidate_owned_domain_hypothesis'?query.from:query.articleDate.replaceAll('-',''),
  to:p.election.replaceAll('-',''),output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',
  limit:'100'});
 params.append('filter','statuscode:200');params.append('filter','mimetype:text/html');
 if(query.kind==='candidate_owned_domain_hypothesis'&&query.match==='domain')params.set('collapse','urlkey');
 const cdxURL='https://web.archive.org/cdx/search/cdx?'+params.toString();
 const cdx=await get(cdxURL);
 const result={id,track,person:p.person,originalSiteHypothesisKind:query.kind,
  originalTargetUrl:url,lead:query.lead??query.attribution,
  originalArchiveIndexUrl:cdxURL,archiveIndexStatus:cdx.status,
  originalEntireCdxSHA256:cdx.bytes.length?sha(cdx.bytes):null,
  originalCdxFile:null,originalIndexRows:0,indexError:cdx.error||null,
  archivesNeverProofOfNoPolicy:true,originalFullHTMLReplays:[],
  publisherNotCandidateOwnedSite:query.kind!=='candidate_owned_domain_hypothesis'};
 let candidates=[];
 if(cdx.ok){
  try{
   const table=JSON.parse(cdx.bytes.toString());
   assert.ok(Array.isArray(table)&&table.length>=1&&table.length<=101);
   assert.deepEqual(table[0],['timestamp','original','mimetype','statuscode','digest','length']);
   result.originalIndexRows=table.length-1;
   result.originalCdxFile=id+'-entire-index.json';
   writeFileSync(join(out,result.originalCdxFile),cdx.bytes,{flag:'wx'});
   candidates=table.slice(1).filter(x=>x[0]<cutoff&&x[2]==='text/html'&&x[3]==='200'
    &&/^[A-Z2-7]{32}$/.test(x[4])&&/^https?:\/\//.test(x[1]))
    .sort((a,b)=>{
     const rank=v=>/issues?|priorities|platform|policy|position/i.test(v[1])?8:0;
     return rank(b)-rank(a)||b[0].localeCompare(a[0]);
    });
  }catch(e){result.indexError='Invalid or non-CDX response '+String(e).slice(0,150);}
 }else result.indexError=result.indexError||'HTTP '+cdx.status;
 const used=new Set();
 for(const row of candidates){
  const path=new URL(row[1]).pathname.toLowerCase().replace(/\/$/,'');
  if(used.has(path))continue;used.add(path);
  if(result.originalFullHTMLReplays.length>=2)break;
  result.originalFullHTMLReplays.push(await replay(id,row[0],row[1],row[4],'id_'));
 }
 console.log('FINAL FIVE ORIGINAL SOURCE '+JSON.stringify({person:p.person,site:query.kind==='candidate_owned_domain_hypothesis',
  seed:url,index:cdx.status,rows:result.originalIndexRows,
  originalSHAHTML:result.originalFullHTMLReplays.filter(x=>x.fullOriginalHTMLFile).length}));
 return result;
}
async function replay(key,time,url,digest,mode){
 const source='https://web.archive.org/web/'+time+mode+'/'+url;
 const r=await get(source);
 const v={captureUTC:archiveCapture(time),originalURL:url,originalIndexedSHA1Base32:digest,
  replayMode:mode,replayURL:source,replayHTTPStatus:r.status,
  fullOriginalResponseSha256:r.bytes.length?sha(r.bytes):null,
  fullBytesMatchOriginalIndependentArchiveIndex:false,
  fullOriginalHTMLFile:null,originalSourceIdentityContext:null,
  originalCaptureDoesNotProveFirstAuthoredDate:true,noSourceExcerptsAutoAdmitted:true};
 if(r.ok&&r.status===200&&r.bytes.length>100){
  v.fullBytesMatchOriginalIndependentArchiveIndex=historicalArchiveSha1Base32(r.bytes)===digest;
  if(v.fullBytesMatchOriginalIndependentArchiveIndex){
   v.fullOriginalHTMLFile=key+'-'+time+'-'+mode+'-whole-original.html';
   writeFileSync(join(out,v.fullOriginalHTMLFile),r.bytes,{flag:'wx'});
   v.originalSourceIdentityContext=context(r.bytes);
  }
 }
 return v;
}
const allQueries=[...cfg.sites,...cfg.media];
let next=0,results=new Array(allQueries.length);
await Promise.all(Array.from({length:3},async()=>{
 while(next<allQueries.length){
  const n=next++;results[n]=await indexed(allQueries[n]);await sleep(400);
 }
}));
let historicalPhaCDX=null;
if(track==='pha'){
 const input=load(join(resolve(arg('--preindexed-susan2022-dir')),
  '05-susan-pha-recent2022-full-original-cdx.json'),300);
 assert.equal(sha(input),pinnedPhaIndexSHA);
 const rows=JSON.parse(input.toString());
 assert.deepEqual(rows[0],['timestamp','original','mimetype','statuscode','digest','length']);
 assert.equal(rows.length-1,26);
 writeFileSync(join(out,'susan2022-26-complete-independent-original-cdx.json'),input,{flag:'wx'});
 const selected=['20211202192625','20220120082334','20220408135432',
  '20220805035440','20221028052750','20221104214400'];
 const replays=[];
 for(const time of selected){
  const found=rows.slice(1).filter(q=>q[0]===time&&q[1]==='https://votesusanpha.com/');
  assert.equal(found.length,1);
  for(const mode of ['id_','if_']){
   replays.push(await replay('pha-retry',time,found[0][1],found[0][4],mode));
  }
 }
 historicalPhaCDX={wholeOriginalCdxSHA256:sha(input),originalCdxRowCount:26,
  provenance:'Reopened complete source CDX from prior independent original-source acquisition #38193297084 artifact #11722142765',
  originalReplays:replays};
}
let doron=null;
if(track==='clark'){
 const id='1pbX-cHOKJFfMT4roJDXx-cNUdPs_-G46';
 const variants=[
  'https://drive.google.com/uc?export=download&id='+id,
  'https://drive.usercontent.google.com/download?id='+id+'&export=download&confirm=t'
 ];
 const records=[];
 for(let i=0;i<variants.length;i++){
  const r=await get(variants[i]);
  const hasPDF=r.bytes.subarray(0,5).toString()==='%PDF-';
  const originalFile=hasPDF?'doron-2025-sd60-questionnaire-current-download-UNPROVEN-JAN2025.pdf':null;
  if(hasPDF&&i===0)writeFileSync(join(out,originalFile),r.bytes,{flag:'wx'});
  records.push({sourceURL:variants[i],httpStatus:r.status,contentType:r.contentType,
   responseSha256:r.bytes.length?sha(r.bytes):null,bytes:r.bytes.length,
   containsPDFHeader:hasPDF,sourceBinaryFile:hasPDF&&i===0?originalFile:null});
 }
 doron={historicalSourceLinkOnBeforePrimaryPublishedJan12_2025:
  'https://naomikritzer.com/2025/01/12/special-election-2025-senate-district-60/',
  historicalCandidateCompletedDFLPartyQuestionnaireGoogleDriveID:id,
  historicalArticleExplicitlyLinkedThisSameDocumentBeforeJan14Primary:true,
  PDFDownloadedIn2026NotProvenSameBytesAsJan2025:true,
  PDFVersionCreationModificationHistoryNotIndependentlyVerified:true,
  PDFPolicyQuotesAutomaticallyApproved:0,
  currentPublicFileRequests:records};
}
const report={schema:'mn-senate-five-remaining-historical-original-site-and-direct-publisher-five-parallel-v1',
 issue:864,person:p.person,officialOriginalGovernmentSenatorName:p.official,
 actualSenateServiceElectionYear:p.electionYear,actualSenateDistrict:p.district,
 originalElectionDate:p.election,originalLRLGovernmentFullSHA256:sha(gov),
 prior90PersonSourceQuoteCoverageRawJSONSHA256:sha(priorRaw),
 alreadySourceQuotedActuallyServingPeople:90,totalActualServingMN2021to2025:95,
 candidateOwnedSiteArchivedHypotheses:cfg.sites.length,independentPublisherArchivedURLs:cfg.media.length,
 wholeOriginalArchiveCDXIndexes:results.filter(x=>x.originalCdxFile).length,
 entireSHA1IndexedOriginalHTMLPages:results.flatMap(x=>x.originalFullHTMLReplays).filter(x=>x.fullOriginalHTMLFile).length,
 candidateOwnedSiteIdentityStillRequiresSpecificReview:true,
 directPublisherQuoteSourcesSeparateFromSiteCoverage:true,
 allArchiveErrorsUnobservedNotNoPolicy:true,
 siteQuoteResearchRowsAutomaticallyAdded:0,
 independentlyVerifiedOfficialLegislativeVotesFromStatements:0,
 productionDatabaseReadsWrites:0,modelForecastTrainingScheduler2027Changes:0,
 allSourceQueries:results,independentFullSusanPha2022RootCDX:historicalPhaCDX,
 doronJanuary2025PartyCandidateQuestionnaire: doron};
writeFileSync(join(out,'five-senator-'+track+'-historical-original-recovery.json'),
 JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('ONE OF FIVE HISTORICAL SOURCE RESEARCH COMPLETE '+JSON.stringify({
 person:p.person,fullCDX:report.wholeOriginalArchiveCDXIndexes,fullDigestMatchedHTML:report.entireSHA1IndexedOriginalHTMLPages,
 phaRecovered:historicalPhaCDX?.originalReplays.filter(x=>x.fullOriginalHTMLFile).length??0,
 doronPdf:doron?.currentPublicFileRequests.some(x=>x.containsPDFHeader)??false,
 modelDatabaseWrites:0}));
