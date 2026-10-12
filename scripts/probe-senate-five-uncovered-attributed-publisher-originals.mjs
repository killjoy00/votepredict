/**
 * #864: two parallel public publisher-original media tracks for five senators
 * whose HISTORICAL CANDIDATE OWNED website statements are still unobserved.
 * Original article HTML / direct speaker position = different evidence class.
 * Archived pre vs post election and authored/published timestamps are distinct.
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
const govSha='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const coverageSha='a59826f30bd46fd955d9136091ae18c00977351f2420f1f55819264a15f68713';
const argv=process.argv.slice(2);
function arg(x){const n=argv.indexOf(x);assert.ok(n>=0&&argv[n+1]&&!argv[n+1].startsWith('--'),'Missing '+x);return argv[n+1];}
function load(p,min=50,max=6000000){const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,p);return readFileSync(p);}
const track=arg('--track');assert.ok(['recent','older'].includes(track));
const out=resolve(arg('--out-dir'));mkdirSync(out,{recursive:true});
const gov=load(resolve(arg('--official-html')),9000);
const receipt=JSON.parse(load(resolve(arg('--official-receipt'))).toString());
const swearing=load(resolve(arg('--official-special-swearing-html')),9000);
assert.equal(sha(gov),govSha);assert.equal(receipt.source.sourceBytesSha256,govSha);
assert.equal(sha(swearing),receipt.supplementalSwearingSource.sourceBytesSha256);
const roster=parseOfficialMnSenateServiceDirectory(gov,receipt.source.observedAt,swearing,receipt.supplementalSwearingSource.observedAt);
assert.equal(roster.senators.length,105);
const coverageBytes=load(resolve(arg('--coverage-json')),9000,2000000);
assert.equal(sha(coverageBytes),coverageSha);
const coverage=JSON.parse(coverageBytes.toString());
assert.equal(coverage.summary.actualServingStateSenators,95);
assert.equal(coverage.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,87);
assert.equal(coverage.summary.actuallyServedSenatorsUnobservedInSelectedOriginalSiteSourceLedgers,8);
const senatorList=[
 {person:'Susan Pha',official:'Susan Pha',district:'38',year:2022},
 {person:'Doron Clark',official:'Doron Clark',district:'60',year:2025},
 {person:'Charles Wiger',official:'Sr., Charles W. Wiger',district:'43',year:2020},
 {person:'Thomas Bakk',official:'Thomas M. Bakk',district:'3',year:2020},
 {person:'David Tomassoni',official:'David J. Tomassoni',district:'6',year:2020}
];
for(const p of senatorList){
 const member=validateActualSenateServiceForElection(roster,p.person,p.district,p.year);
 assert.equal(member.status,'verified_senate_service',p.person);
 assert.equal(member.officialName,p.official);
 assert.equal(member.serviceForThisElectionFollowingYearVerified,true);
 assert.equal(coverage.byActuallyServedSenator.find(x=>x.officialName===p.official).originalSiteQuoteLeadCount,0);
}
const sources={
 recent:[
 {id:'doron-mpr-2025',person:'Doron Clark',
 url:'https://www.mprnews.org/story/2025/01/14/meet-the-9-candidates-in-an-election-to-decide-control-of-the-minnesota-senate',
 publisherDate:'2025-01-14',archiveLastDay:'2025-01-27',electionDate:'2025-01-28',
 speechClass:'contemporaneous_reporter_selected_direct_candidate_quote',
 afterElection:false,claimedArticleQuoteWithoutOriginalNotYetVerified:true},
 {id:'pha-sahan-aftervote-2022',person:'Susan Pha',
 url:'https://sahanjournal.com/democracy-politics/susan-pha-minnesota-senator-elect-legislature-district-38-brooklyn-park/',
 publisherDate:'2022-11-22',archiveLastDay:'2023-01-02',electionDate:'2022-11-08',
 speechClass:'post_election_pre_sworn_direct_interview',
 afterElection:true,claimedArticleQuoteWithoutOriginalNotYetVerified:true}
 ],
 older:[
 {id:'wiger-patch-candidate-2012',person:'Charles Wiger',
 url:'https://patch.com/minnesota/oakdale/chuck-wiger-candidate-for-minnesota-senate-district-43',
 publisherDate:'2012-08-20',archiveLastDay:'2012-11-05',electionDate:'2012-11-06',
 speechClass:'older_2012_publisher_candidate_questionnaire_not_owned_site',
 afterElection:false,claimedArticleQuoteWithoutOriginalNotYetVerified:true},
 {id:'wiger-patch-selfwritten-2012',person:'Charles Wiger',
 url:'https://patch.com/minnesota/oakdale/wiger-minnesota-school-trust-land-management-due-for-reform',
 publisherDate:'2012-02-26',archiveLastDay:'2012-11-05',electionDate:'2012-11-06',
 speechClass:'older_2012_candidate_authored_publisher_column',
 afterElection:false,claimedArticleQuoteWithoutOriginalNotYetVerified:true},
 {id:'bakk-wtip-2020-radio',person:'Thomas Bakk',
 url:'https://wtip.org/a-conversation-with-senator-tom-bakk/',
 publisherDate:'2020-02-20',archiveLastDay:'2020-11-02',electionDate:'2020-11-03',
 speechClass:'2020_reporter_embedded_audio_missing_firstparty_verbatim_transcript',
 afterElection:false,claimedArticleQuoteWithoutOriginalNotYetVerified:false},
 {id:'bakk-duluth2020-no-response',person:'Thomas Bakk',
 url:'https://www.duluthnewstribune.com/news/2020-voter-guide-minnesota-senate-3rd-district',
 publisherDate:'2020-10-24',archiveLastDay:'2020-11-02',electionDate:'2020-11-03',
 speechClass:'2020_voter_guide_explicitly_no_candidate_response',
 afterElection:false,claimedArticleQuoteWithoutOriginalNotYetVerified:false},
 {id:'tomassoni-dfl-aftervote-2020',person:'David Tomassoni',
 url:'https://senatedfl.mn/senator-david-tomassoni-elected-president-of-the-minnesota-senate/',
 publisherDate:'2020-11-13',archiveLastDay:'2021-01-04',electionDate:'2020-11-03',
 speechClass:'post_election_senate_party_published_named_first_person_statement',
 afterElection:true,claimedArticleQuoteWithoutOriginalNotYetVerified:true}
 ]
};
const chosen=sources[track];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function http(url){
 let o;
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const response=await fetch(url,{headers:{'User-Agent':'MN-Senate-Public-Publisher-Original-Archive-ReadOnly-Research/1.0'},signal:AbortSignal.timeout(26000)});
   const body=Buffer.from(await response.arrayBuffer());
   assert.ok(body.length<5000000,'Oversized original publisher source');
   o={status:response.status,ok:response.ok,body,attempt,url:response.url};
   if([429,502,503,504].includes(response.status)&&attempt<2){await pause(1200);continue;}
   return o;
  }catch(error){o={status:null,ok:false,body:Buffer.alloc(0),attempt,error:String(error).slice(0,230)};}
 }
 return o;
}
async function inspect(p){
 assert.ok(p.publisherDate<=p.archiveLastDay);
 const current=await http(p.url);
 const query=new URLSearchParams({url:p.url,matchType:'exact',from:p.publisherDate.replaceAll('-',''),
   to:p.archiveLastDay.replaceAll('-',''),output:'json',
   fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'100'});
 query.append('filter','statuscode:200');query.append('filter','mimetype:text/html');
 const archiveURL='https://web.archive.org/cdx/search/cdx?'+query.toString();
 const index=await http(archiveURL);
 const report={...p,historicalActualServingSenatorVerified:true,
  publisherHostedNotCandidateOwnedSite:true,
  currentResponseStatus:current.status,current2026FullHTMLSha256:current.body.length?sha(current.body):null,
  current2026FullHTMLFile:null,currentHTMLIsNotHistoricalEvidence:true,
  originalCDXURL:archiveURL,originalIndexStatus:index.status,originalIndexSHA256:index.body.length?sha(index.body):null,
  originalFullCDXFile:null,indexRows:0,indexError:index.error||null,
  sourceReplays:[],candidateSpeakerVerbatimAudioOrTurnNotYetProven:true,
  candidateWebsiteQuoteCoverageIncrement:0,oldPostElectionStoriesCannotPredictPastElections:true};
 if(current.ok&&current.body.length>100){
  report.current2026FullHTMLFile=p.id+'-current-NOT-authentic-history.html';
  writeFileSync(join(out,report.current2026FullHTMLFile),current.body,{flag:'wx'});
  const v=originalCampaignVisibleText(current.body);
  report.currentVisibleIncludesNamedSenator=v.includes(p.person);
  report.currentVisibleFirst750=v.slice(0,750);
 }
 let rows=[];
 if(index.ok){
  try{
   const data=JSON.parse(index.body.toString());
   assert.ok(Array.isArray(data)&&data.length>=1&&data.length<=101);
   assert.deepEqual(data[0],['timestamp','original','mimetype','statuscode','digest','length']);
   rows=data.slice(1);
   report.indexRows=rows.length;
   report.originalFullCDXFile=p.id+'-complete-original-cdx.json';
   writeFileSync(join(out,report.originalFullCDXFile),index.body,{flag:'wx'});
  }catch(error){report.indexError='Index empty/invalid '+String(error).slice(0,150);}
 }else report.indexError=report.indexError||'HTTP '+index.status;
 const captures=rows.filter(v=>v[3]==='200'&&v[2]==='text/html'&&/^[A-Z2-7]{32}$/.test(v[4])
  &&v[0]<=p.archiveLastDay.replaceAll('-','')+'235959').sort((a,b)=>a[0].localeCompare(b[0]));
 for(const row of captures.slice(0,2)){
  const replay='https://web.archive.org/web/'+row[0]+'id_/'+row[1];
  const res=await http(replay);
  const v={originalURL:row[1],captureUTC:row[0].replace(/^(....)(..)(..)(..)(..)(..)$/,'$1-$2-$3T$4:$5:$6.000Z'),
   originalIndexedSHA1Base32:row[4],replayHTTPStatus:res.status,
   fullHTMLSHA256:res.body.length?sha(res.body):null,
   fullOriginalMatchesIndependentIndex:false,fullOriginalFile:null,namedCandidateVisible:false};
  if(res.ok&&res.status===200&&res.body.length>100){
   v.fullOriginalMatchesIndependentIndex=historicalArchiveSha1Base32(res.body)===row[4];
   if(v.fullOriginalMatchesIndependentIndex){
    v.fullOriginalFile=p.id+'-'+row[0]+'-original-archived-publisher.html';
    writeFileSync(join(out,v.fullOriginalFile),res.body,{flag:'wx'});
    const t=originalCampaignVisibleText(res.body);
    v.namedCandidateVisible=t.includes(p.person);
    v.originalVisibleFirst1300=t.slice(0,1300);
   }
  }
  report.sourceReplays.push(v);
 }
 console.log('ORIGINAL PUBLISHER '+JSON.stringify({track,person:p.person,article:p.id,
  current:current.status,archiveIndex:index.status,rows:report.indexRows,
  originalHTML:report.sourceReplays.filter(x=>x.fullOriginalFile).length,postElection:p.afterElection}));
 return report;
}
const reports=await Promise.all(chosen.map(inspect));
const output={schema:'mn-eight-unobserved-separate-public-attributed-publisher-archive-tracks-v1',
 issue:864,track,originalFullGovernmentLRLSHA256:sha(gov),independentOriginal87of95CampaignSiteCoverageSHA256:sha(coverageBytes),
 distinctHistoricalPublisherSources:chosen.length,fullOriginalPublisherHTMLReverified:reports.flatMap(q=>q.sourceReplays).filter(r=>r.fullOriginalFile).length,
 publisherArticlesNotCandidateCampaignWebsites:true,automaticallyNewCandidateCampaignSiteQuotes:0,
 candidateSubmittedAndReportedSpeechNotYetAuditedExactQuotes:true,
 postVotePublicationNeverRetroactivelyPredictsVote:true,originalArchivedCaptureNotFirstPublishedDate:true,
 emptyOrRateLimitedIndexesAreUnknown:true,productionDatabaseReadsWrites:0,
 officialLegislativeVotesProvedByArticles:0,modelsForecastsTrainingSchedulers2027Changes:0,sources:reports};
writeFileSync(join(out,'historical-publisher-'+track+'-original-evidence-recovery.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log('PUBLISHER HISTORICAL TRACK '+JSON.stringify({track,sourcePages:chosen.length,
 independentlyAuthenticatedOriginals:output.fullOriginalPublisherHTMLReverified,production:0}));
