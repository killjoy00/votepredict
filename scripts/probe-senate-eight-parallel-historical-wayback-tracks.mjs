/**
 * #864 parallel historical original campaign-source discovery for 8 remaining
 * actually-serving MN senators. Track-specific candidate domain hypotheses are
 * NOT proof of ownership, dates or legislative positions.
 * Only literal SHA1 indexed original HTML may become a separate audited quote.
 * No production DB, forecast, training, prediction or 2027 changes.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
  from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
  from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const governmentSha='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const coverageSha='a59826f30bd46fd955d9136091ae18c00977351f2420f1f55819264a15f68713';
const argv=process.argv.slice(2);
function arg(flag){const i=argv.indexOf(flag);assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing '+flag);return argv[i+1];}
function read(p,min=50,max=6000000){const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'Invalid original source '+p);return readFileSync(p);}
const track=arg('--track');assert.ok(['recent2022','legacy2020'].includes(track));
const out=resolve(arg('--out-dir'));mkdirSync(out,{recursive:true});
const gov=read(resolve(arg('--official-html')),9000),receipt=JSON.parse(read(resolve(arg('--official-receipt'))).toString());
const swear=read(resolve(arg('--official-special-swearing-html')),9000);
assert.equal(sha(gov),governmentSha);assert.equal(receipt.source.sourceBytesSha256,governmentSha);
assert.equal(receipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(sha(swear),receipt.supplementalSwearingSource.sourceBytesSha256);
const directory=parseOfficialMnSenateServiceDirectory(gov,receipt.source.observedAt,swear,receipt.supplementalSwearingSource.observedAt);
assert.equal(directory.senators.length,105);
const coverageBytes=read(resolve(arg('--coverage-json')),9000,2000000);
assert.equal(sha(coverageBytes),coverageSha,'Must authenticate entire 87/95 prior original website source coverage');
const coverage=JSON.parse(coverageBytes.toString());
assert.equal(coverage.summary.actualServingStateSenators,95);
assert.equal(coverage.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,87);
assert.equal(coverage.summary.actuallyServedSenatorsUnobservedInSelectedOriginalSiteSourceLedgers,8);
assert.equal(coverage.summary.totalExactResearchExcerptRowsForVerifiedSenators,1140);
const persons=[
 {name:'Susan Pha',officialName:'Susan Pha',district:'38',year:2022},
 {name:'Michael Kreun',officialName:'Michael E. Kreun',district:'32',year:2022},
 {name:'Doron Clark',officialName:'Doron Clark',district:'60',year:2025},
 {name:'Mary Kiffmeyer',officialName:'Mary Kiffmeyer',district:'30',year:2020},
 {name:'David Tomassoni',officialName:'David J. Tomassoni',district:'6',year:2020},
 {name:'Scott Newman',officialName:'Scott J. Newman',district:'18',year:2020},
 {name:'Charles Wiger',officialName:'Sr., Charles W. Wiger',district:'43',year:2020},
 {name:'Thomas Bakk',officialName:'Thomas M. Bakk',district:'3',year:2020}
];
assert.equal(persons.length,8);
const byName=new Map(persons.map(x=>[x.name,x]));
for(const p of persons){
 const s=coverage.byActuallyServedSenator.find(x=>x.officialName===p.officialName);
 assert.ok(s,'One of eight actual senators is missing '+p.name);
 assert.equal(s.originalSiteQuoteLeadCount,0,'Wrong remaining source census '+p.name);
 const l=validateActualSenateServiceForElection(directory,p.name,p.district,p.year);
 assert.equal(l.status,'verified_senate_service',p.name);
 assert.equal(l.officialName,p.officialName);
 assert.equal(l.serviceForThisElectionFollowingYearVerified,true);
}
const Q=(name,host,path,match='exact',from='20000101',to='20201102',lead='unverified candidate domain hypothesis')=>
 ({name,host,path,match,from,to,lead});
const sets={
 recent2022:[
 Q('Susan Pha','votesusanpha.com','/issues','prefix','20210101','20221107','Authenticated 2022 candidate domain issue path hypothesis'),
 Q('Susan Pha','votesusanpha.com','/platform','prefix','20210101','20221107','Authenticated 2022 domain issue path hypothesis'),
 Q('Susan Pha','votesusanpha.com','/priorities','prefix','20210101','20221107','Authenticated 2022 domain issue path hypothesis'),
 Q('Susan Pha','votesusanpha.com','/about','prefix','20210101','20221107','Authenticated 2022 candidate domain biographical positions'),
 Q('Susan Pha','www.votesusanpha.com','/','exact','20210101','20221107','Verified 2022 domain apex original www'),
 Q('Susan Pha','susanphaforsenate.com','/','exact','20210101','20221107','Present-day candidate domain, historical availability UNPROVEN'),
 Q('Susan Pha','susanpha.com',null,'domain','20180101','20221107','Alternate candidate domain discovery hypothesis'),
 Q('Michael Kreun','www.michaelformnsenate.com','/','exact','20210101','20221107','Candidate-owned original 2022 site home'),
 Q('Michael Kreun','www.michaelformnsenate.com','/priorities','exact','20210101','20221107','Current issue page requiring 2022 original evidence'),
 Q('Michael Kreun','michaelformnsenate.com','/priorities','exact','20210101','20221107','Non-www 2022 campaign priorities'),
 Q('Michael Kreun','michaelformnsenate.com',null,'domain','20210101','20221107','2022 actual candidate site historic origin'),
 Q('Michael Kreun','www.michaelformnsenate.com','/about','prefix','20210101','20221107','Possible personal priorities candidate bio'),
 Q('Michael Kreun','michaelkreun.com',null,'domain','20210101','20221107','Alternate candidate domain hypothesis'),
 Q('Michael Kreun','kreunforsenate.com',null,'domain','20210101','20221107','Alternate candidate domain hypothesis')
 ],
 legacy2020:[
 Q('Mary Kiffmeyer','kiffmeyer.org',null,'domain','20050101','20201102','Original name domain; reject repurposed hosting'),
 Q('Mary Kiffmeyer','marykiffmeyer.com',null,'domain','20050101','20201102','Older personally named candidate domain hypothesis'),
 Q('Mary Kiffmeyer','kiffmeyerforsenate.com',null,'domain','20110101','20201102','Older Senate committee domain hypothesis'),
 Q('Mary Kiffmeyer','marykiffmeyerforsenate.com',null,'domain','20110101','20201102','Older Senate committee domain hypothesis'),
 Q('Mary Kiffmeyer','marykiffmeyer.org',null,'domain','20050101','20201102','Older personal domain hypothesis'),
 Q('Scott Newman','www.scottnewmanforsenate.com','/issues','prefix','20110101','20201102','Authentic MN senator original 2020 Issues navigation'),
 Q('Scott Newman','scottnewmanforsenate.com','/issues','prefix','20110101','20201102','MN senator original campaign issues non-www'),
 Q('Scott Newman','www.scottnewmanforsenate.com','/about','prefix','20110101','20201102','Authentic MN senator candidate issue biography'),
 Q('Scott Newman','scottnewmanforsenate.com',null,'domain','20110101','20201102','Authentic MN senator campaign not California Josh Newman'),
 Q('Charles Wiger','chuckwiger.com',null,'domain','20050101','20201102','Historical name campaign domain hypothesis'),
 Q('Charles Wiger','chuckwigerforsenate.com',null,'domain','20050101','20201102','Historical name campaign domain hypothesis'),
 Q('Charles Wiger','wigerforsenate.com',null,'domain','20050101','20201102','Historical state Senate committee domain hypothesis'),
 Q('Charles Wiger','senatorwiger.com',null,'domain','20050101','20201102','Historical Senator name domain hypothesis'),
 Q('Thomas Bakk','bakkforsenate.com',null,'domain','20000101','20201102','Historical campaign Senate domain hypothesis'),
 Q('Thomas Bakk','tombakkforsenate.com',null,'domain','20000101','20201102','Historical campaign Senate domain hypothesis'),
 Q('Thomas Bakk','tombakk.org',null,'domain','20000101','20201102','Alternate historic name domain hypothesis'),
 Q('Thomas Bakk','tombakk.com','/issues','prefix','20050101','20201102','Beware 2008 Governor site; do not mistake office'),
 Q('David Tomassoni','tomassoni4senate.com',null,'domain','20000101','20151231','Pre-2016 genuine domain hypothesis; 2016+ verified spam'),
 Q('David Tomassoni','tomassoniforsenate.com',null,'domain','20000101','20201102','Historic alternate Senate domain hypothesis'),
 Q('David Tomassoni','davetomassoni.com',null,'domain','20000101','20201102','Historical candidate name domain hypothesis'),
 Q('David Tomassoni','davetomassoni4senate.com',null,'domain','20000101','20201102','Historical candidate Senate name domain hypothesis')
 ]
};
const queries=sets[track];
assert.equal(new Set(queries.map(q=>q.name)).size,track==='legacy2020'?5:2);
const cutoff=q=>q.name==='Doron Clark'?'20250128000000':
  byName.get(q.name).year===2022?'20221108000000':'20201103000000';
for(const q of queries){
 const p=byName.get(q.name);assert.ok(p);
 assert.ok(q.to.replaceAll('-','')<cutoff(q).slice(0,8));
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function retrieve(url){
 let result;
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const response=await fetch(url,{headers:{'User-Agent':'MN-Senate-2021-25-Historic-Original-Source-Research/1.0'},
    signal:AbortSignal.timeout(26000)});
   const bytes=Buffer.from(await response.arrayBuffer());
   assert.ok(bytes.length<4000000,'Bound original source');
   result={status:response.status,ok:response.ok,bytes,url:response.url,attempt,contentType:response.headers.get('content-type')};
   if([429,502,503,504].includes(response.status)&&attempt<2){await sleep(1800);continue;}
   return result;
  }catch(error){result={status:null,ok:false,bytes:Buffer.alloc(0),attempt,error:String(error).slice(0,200)};}
 }
 return result;
}
const visible=b=>originalCampaignVisibleText(b);
function indicators(body,p){
 const a=body.toLowerCase(),surname=p.name.split(' ').at(-1).toLowerCase();
 return {candidateFullNameIncluded:a.includes(p.name.toLowerCase()),candidateSurnameIncluded:a.includes(surname),
  paidForCommitteeTextIncluded:/prepared and paid for|paid for by|committee to elect|campaign committee/i.test(body),
  likelySiteReusedSpam:/\b(casino|payday loan|credit card|porn|japanese|薬|キャッシング)\b/i.test(body),
  candidateIssueContext:[...body.matchAll(/\b(issues?|priorities|platform|taxes|schools?|education|healthcare|transportation|labor|housing|regulations|budget|rights)\b/gi)]
   .slice(0,12).map(m=>body.slice(Math.max(0,m.index-90),Math.min(body.length,m.index+160))),
  visibleFirst2000:body.slice(0,2000)};
}
let pos=0;
async function one(q){
 const p=byName.get(q.name);
 const id=String(++pos).padStart(2,'0')+'-'+q.name.toLowerCase().replace(/[^a-z]+/g,'-')+'-'+track;
 const params=new URLSearchParams({url:q.host+(q.path??''),matchType:q.match,from:q.from,to:q.to,
  output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'120'});
 params.append('filter','statuscode:200');params.append('filter','mimetype:text/html');
 if(q.match==='domain')params.set('collapse','urlkey');
 const indexUrl='https://web.archive.org/cdx/search/cdx?'+params.toString();
 const r=await retrieve(indexUrl);
 const row={id,person:p.name,officialName:p.officialName,verifiedActualServiceDistrict:p.district,
  relevantElectionYear:p.year,candidateDomainLead:q.host,sourceURLPrefix:q.path,
  queryMatchType:q.match,candidateDomainLeadAttribution:q.lead,
  originalArchiveIndexURL:indexUrl,originalArchiveIndexHTTPStatus:r.status,
  originalArchiveIndexResponseSHA256:r.bytes.length?sha(r.bytes):null,
  wholeOriginalArchiveIndexFile:null,archiveIndexRows:0,indexCappedAt120:false,
  indexError:r.error||null,authenticatedRawOriginalHtml:[],archiveFailureDoesNotProveNoPolicy:true};
 let cd=[];
 if(r.ok){
  try{
   const j=JSON.parse(r.bytes.toString());
   assert.ok(Array.isArray(j)&&j.length>=1&&j.length<=121);
   assert.deepEqual(j[0],['timestamp','original','mimetype','statuscode','digest','length']);
   cd=j.slice(1);
   row.wholeOriginalArchiveIndexFile=id+'-full-original-cdx.json';
   writeFileSync(join(out,row.wholeOriginalArchiveIndexFile),r.bytes,{flag:'wx'});
   row.archiveIndexRows=cd.length;row.indexCappedAt120=cd.length===120;
  }catch(e){row.indexError='index parse/shape: '+String(e).slice(0,150);}
 }else row.indexError=row.indexError||'HTTP '+r.status;
 const indexed=cd.filter(v=>v[0]&&v[0]<cutoff(q)&&v[2]==='text/html'&&v[3]==='200'
  &&/^[A-Z2-7]{32}$/.test(v[4])&&/^https?:\/\//.test(v[1])&&
  !/\/(?:wp-content|wp-json|cdn-cgi)\b/i.test(v[1]))
  .sort((a,b)=>{
   const quality=v=>/(issue|priority|platform|policy|about|education|health|tax)/i.test(v[1])?7:0;
   return quality(b)-quality(a)||b[0].localeCompare(a[0]);
  });
 const found=new Set();
 for(const v of indexed){
  const parsed=new URL(v[1]);
  const k=parsed.pathname.replace(/\/$/,'').toLowerCase();
  if(found.has(k))continue;found.add(k);
  if(row.authenticatedRawOriginalHtml.length>=2)break;
  const archivedUrl='https://web.archive.org/web/'+v[0]+'id_/'+v[1];
  const got=await retrieve(archivedUrl);
  const capture=v[0].replace(/^(....)(..)(..)(..)(..)(..)$/,'$1-$2-$3T$4:$5:$6.000Z');
  const html={indexedOriginalURL:v[1],originalPublicByUTC:capture,indexedOriginalSHA1Base32:v[4],
   replayHTTPStatus:got.status,fullResponseSHA256:got.bytes.length?sha(got.bytes):null,
   originalHTMLSHA1MatchesOriginalCDX:false,rawOriginalHTMLFile:null,identityCues:null,
   captureIsNotFirstAuthoredDate:true,zeroAutomaticCandidatePolicyExcerpts:true};
  if(got.ok&&got.status===200&&got.bytes.length>150){
   html.originalHTMLSHA1MatchesOriginalCDX=historicalArchiveSha1Base32(got.bytes)===v[4];
   if(html.originalHTMLSHA1MatchesOriginalCDX){
    html.rawOriginalHTMLFile=id+'-'+row.authenticatedRawOriginalHtml.length+'-'+v[0]+'-full-original.html';
    writeFileSync(join(out,html.rawOriginalHTMLFile),got.bytes,{flag:'wx'});
    html.identityCues=indicators(visible(got.bytes),p);
   }
  }
  row.authenticatedRawOriginalHtml.push(html);
 }
 console.log('CANDIDATE HISTORICAL '+track+' '+JSON.stringify({person:p.name,domain:q.host,
  path:q.path,CDX:r.status,rows:row.archiveIndexRows,
  fullOriginalHtml:row.authenticatedRawOriginalHtml.filter(x=>x.rawOriginalHTMLFile).length,
  indexError:row.indexError}));
 return row;
}
const slots=3,results=new Array(queries.length);let next=0;
await Promise.all(Array.from({length:slots},async()=>{
 while(next<queries.length){const ix=next++;results[ix]=await one(queries[ix]);await sleep(350);}
}));
const result={schema:'mn-senate-eight-originals-parallel-wayback-tracks-v1',issue:864,track,
 originalGovernmentWholeLRLDirectorySHA256:sha(gov),priorVerified95ActualSenatorCoverageSHA256:sha(coverageBytes),
 originalSenatorPopulation:95,originalSourceQuotedPeopleBeforeThisPass:87,
 originalSiteShortResearchRowsBeforeThisPass:1140,officialEightUnobservedNames:persons.map(p=>p.officialName),
 trackActuallyServingSenators:[...new Set(queries.map(q=>q.name))],
 independentOriginalCDXWindows:queries.length,
 wholeOriginalCDXFiles:results.filter(r=>r.wholeOriginalArchiveIndexFile).length,
 SHA1Base32MatchedUnmodifiedOriginalHTMLFiles:results.flatMap(r=>r.authenticatedRawOriginalHtml).filter(v=>v.rawOriginalHTMLFile).length,
 historicalAuthoredDateAutomaticallyEstablished:false,archivalFailuresAreUnknownNotPolicyAbsence:true,
 originalCandidateWebsiteOwnershipNotInferredFromGuessDomains:true,firstPartyQuoteLeadsAutomaticallyAdmitted:0,
 officialSenateVotesVerified:0,productionDatabaseReadsWrites:0,modelForecastScheduler2027Changes:0,
 sourceWindows:results};
writeFileSync(join(out,'eight-senator-'+track+'-original-source-recovery.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log('ARCHIVED TRACK COMPLETE '+JSON.stringify({track,sites:result.independentOriginalCDXWindows,
 wholeOriginalCdx:result.wholeOriginalCDXFiles,
 authenticatedFullOriginalHtml:result.SHA1Base32MatchedUnmodifiedOriginalHTMLFiles,production:0}));
