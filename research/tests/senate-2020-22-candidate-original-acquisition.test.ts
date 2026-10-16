import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readdirSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
 historicalSourceTargets,retrieveSmallPublicOriginal,base32Sha1,
 filteredCandidateQuestionnaireCdx,acquireSenateOriginal2020to2022Sources,
} from '../../scripts/acquire-senate-2020-22-candidate-original-sources.js';
import {auditSos2020to2022OriginalGeneralCensus} from '../../src/evidence/senate-2020-22-official-general-census.js';
const article=historicalSourceTargets()[0].url;
const syntheticPage=Buffer.from('<html><body>Rob Kupec: Support education and rural health care.</body></html>');
const sha1=base32Sha1(syntheticPage);
const cdxHeader=['timestamp','original','mimetype','statuscode','digest','length'];
const cdxRow=(timestamp:string,original:string=article,digest:string=sha1)=>[
 timestamp,original,'text/html','200',digest,'1234',
];
test('six exact, public original sources distinguish 2020/2022 candidate-result files from filing website schema',()=>{
 const arr=historicalSourceTargets();
 assert.equal(arr.length,6);
 assert.equal(arr.filter(x=>x.kind==='candidate_submitted_publisher_questionnaire').length,2);
 assert.equal(arr.filter(x=>x.kind.startsWith('official_postvote')).length,4);
 assert.ok(arr.every(x=>x.url.startsWith('https://')));
 assert.ok(arr.filter(x=>x.kind==='official_postvote_7field_ballot_candidate_lookup_not_filing')
   .every(x=>x.url.endsWith('cand.txt')));
 assert.ok(!arr.some(x=>/candidate-files-layout|2026/.test(x.url)));
});
test('no arbitrary host, private URL, or HTTP source can be fetched',async()=>{
 const mock=async()=>{throw Error('should not call mock');};
 for(const url of [
  'http://news.ballotpedia.org/2022','https://localhost/private',
  'https://evil.example/a','https://user:pass@news.ballotpedia.org/2022',
 ])await assert.rejects(()=>retrieveSmallPublicOriginal(url,mock as typeof fetch),/Unapproved/);
});
test('strict pre-2022-general result filter excludes next-year, election-day, cross-candidate and malformed captures',()=>{
 const input=[
  cdxHeader,
  cdxRow('20221015000102'),
  cdxRow('20221016000102',article.replace('/2022/10/07/','/2022/10/19/')),
  cdxRow('20221108000102'),
  cdxRow('20261015000102'),
  cdxRow('20221015000102'),
 ];
 const matches=filteredCandidateQuestionnaireCdx(article,input);
 assert.equal(matches.length,1);
 assert.equal(matches[0].capturedAt,'2022-10-15T00:01:02.000Z');
 assert.equal(matches[0].digest,sha1);
});
test('actual original page bytes match their independently indexed Base32 SHA1, not date printed in later HTML',()=>{
 assert.equal(sha1.length,32);
 assert.equal(base32Sha1(syntheticPage),sha1);
 assert.notEqual(base32Sha1(Buffer.from(syntheticPage.toString()+' later edit')),sha1);
});
test('public source HTTP errors, no Wayback captures and post-election 7-field source remain explicitly not proof',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-2022-original-run-'));
 try{
  const mock=async()=>new Response('unavailable',{status:503});
  const data=await acquireSenateOriginal2020to2022Sources(join(dir,'result'),mock as typeof fetch);
  assert.equal(data.totals.directPublicRequests,6);
  assert.equal(data.totals.waybackIndexQueries,2);
  assert.equal(data.totals.priorGeneralWaybackArchiveHtmlSha1Matches,0);
  assert.equal(data.totals.historicalCandidateIssueExcerptsManuallyAttributed,0);
  assert.equal(data.scope.candidateSosFilingOriginalsVerified,false);
  assert.equal(data.totals.evidenceAddedToModel,0);
  assert.equal(readdirSync(join(dir,'result')).length,1);
  const file=join(dir,'result','acquisition-manifest.json');
  assert.equal(statSync(file).mode&0o777,0o600);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('bounded real fetch flow stores original candidate questionnaire and 2020 result bytes and original hash-matched 2022 Wayback snapshot',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-2022-matching-wayback-'));
 try{
  const pageUrl='https://news.ballotpedia.org/2022/10/07/all-candidates-for-minnesota-state-senate-district-4-complete-ballotpedias-candidate-connection-survey/';
  const articleBytes='<html><body>2026 current publisher page</body></html>';
  const snapshotUrl='https://web.archive.org/web/20221015000102id_/'+pageUrl;
  const mock=async(url:string|URL|Request):Promise<Response>=>{
   const address=String(url);
   if(address.startsWith('https://web.archive.org/cdx/search/cdx?')){
    const orig=new URL(address).searchParams.get('url');
    if(orig===pageUrl)return new Response(JSON.stringify([cdxHeader,cdxRow('20221015000102')]),{status:200});
    return new Response(JSON.stringify([cdxHeader]),{status:200});
   }
   if(address===snapshotUrl)return new Response(syntheticPage,{status:200,headers:{'content-type':'text/html'}});
   if(address.startsWith('https://news.ballotpedia.org/'))return new Response(articleBytes,{status:200});
   if(address.startsWith('https://electionresultsfiles.sos.mn.gov/'))return new Response('001;Test Candidate;001;State Senator District 4;01;DFL;R\n',{status:200});
   return new Response('unavailable',{status:404});
  };
  const report=await acquireSenateOriginal2020to2022Sources(join(dir,'result'),mock as typeof fetch);
  assert.equal(report.totals.directPublisherPagesAcquired,2);
  assert.equal(report.totals.generalElectionPostvoteFilesAcquired,4);
  assert.equal(report.totals.priorGeneralWaybackIndexEntries,1);
  assert.equal(report.totals.priorGeneralWaybackArchiveHtmlSha1Matches,1);
  assert.equal(report.scope.originalCandidateQuestionnairePostingDateIndependentlyEstablished,false);
  const saved=join(dir,'result','2022-sd4-ballotpedia-article-20221015000102.html');
  assert.equal(readFileSync(saved).toString(),syntheticPage.toString());
  assert.equal(createHash('sha256').update(readFileSync(saved)).digest('hex'),
    createHash('sha256').update(syntheticPage).digest('hex'));
  assert.equal(report.totals.historicalCandidateIssueExcerptsManuallyAttributed,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

function syntheticOfficialSenateGeneralElection(year:2020|2022){
 const result:string[]=[];const lookup:string[]=[];
 for(let d=1;d<=67;d++){
  const officeId=String(120+d).padStart(4,'0'),title='State Senator District '+d;
  const candidates=[
   {code:'0301',name:'Synthetic Winner District '+d,party:'R',votes:22000+d},
   ...(year===2020||d<=59?[{code:'0401',name:'Synthetic Loser District '+d,party:'DFL',votes:12500+d}]:[]),
   ...(year===2020&&d<=12||year===2022&&d<=5?
     [{code:'0501',name:'Synthetic Third District '+d,party:'IND',votes:500+d}]:[]),
  ];
  for(const person of candidates){
   result.push(['MN','','',officeId,title,String(d),person.code,person.name,'','',
     person.party,'10','10',String(person.votes),'55.00','35000'].join(';'));
   lookup.push([officeId+person.code,person.name,officeId,title,'88','03',person.party].join(';'));
  }
  result.push(['MN','','',officeId,title,String(d),'9901','WRITE-IN','','',
   'WI','10','10','10','0.01','35000'].join(';'));
 }
 // Non-Senate candidates may appear in the full official SOS candidate lookup.
 lookup.push('01010301;President Example;0101;U.S. President;88;03;R');
 return {st:Buffer.from(result.join('\r\n')+'\r\n'),
  cand:Buffer.from(lookup.join('\r\n')+'\r\n')};
}
test('67 original Senate general races produce exactly 2020: 146 names/79 losers, 2022: 131 names/64 losers',()=>{
 for(const year of [2020,2022] as const){
  const input=syntheticOfficialSenateGeneralElection(year);
  const report=auditSos2020to2022OriginalGeneralCensus(year,input.st,input.cand);
  assert.equal(report.totals.senateDistricts,67);
  assert.equal(report.totals.nonWriteinElectionWinnerCandidates,67);
  assert.equal(report.totals.uniqueNamedBallotCandidates,year===2020?146:131);
  assert.equal(report.totals.nonwinningNamedCandidates,year===2020?79:64);
  assert.equal(report.totals.writeInAggregateRows,67);
  assert.equal(report.source.originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence,false);
  assert.ok(report.candidates.every(c=>!c.eligibleForHistoricalPreVoteForecast
    &&!c.campaignIssueStatementPublicByProven
    &&c.campaignWebsiteOriginalSOSFilingField===null));
  assert.equal(report.totals.certifiedOriginalFiledCandidateUniverse,false);
 }
});
test('original post-election results and candidate lookup must agree on every candidate, ID, party and district',()=>{
 const input=syntheticOfficialSenateGeneralElection(2020);
 const wrong=Buffer.from(input.cand.toString('utf8').replace('Synthetic Winner District 1','Different Candidate'));
 assert.throws(()=>auditSos2020to2022OriginalGeneralCensus(2020,input.st,wrong),
   /does not match independent/);
 const wrongYear=Buffer.from(input.st.toString('utf8').replace('State Senator District 1','State Representative District 1'));
 assert.throws(()=>auditSos2020to2022OriginalGeneralCensus(2020,wrongYear,input.cand));
 const missingDistrict=Buffer.from(input.st.toString('utf8').split('\r\n')
   .filter(x=>!x.includes('State Senator District 67')).join('\r\n'));
 assert.throws(()=>auditSos2020to2022OriginalGeneralCensus(2020,missingDistrict,input.cand),
   /universe mismatch/);
});
test('historic filing export row with a campaign website column cannot masquerade as 7-field election cand.txt',()=>{
 const input=syntheticOfficialSenateGeneralElection(2022);
 const wrong=Buffer.from(input.cand.toString('utf8').replace(
  'Synthetic Winner District 1;0121;State Senator District 1;88;03;R',
  'Synthetic Winner District 1;0121;State Senator District 1;88;03;R;SITE;HTTPS://SITE.EXAMPLE'));
 assert.throws(()=>auditSos2020to2022OriginalGeneralCensus(2022,input.st,wrong),
   /exactly seven fields/);
 const maintenance=Buffer.from('<html><body><h1>Maintenance in progress</h1></body></html>'.repeat(10));
 assert.throws(()=>auditSos2020to2022OriginalGeneralCensus(2022,maintenance,input.cand),
   /maintenance page/);
});
