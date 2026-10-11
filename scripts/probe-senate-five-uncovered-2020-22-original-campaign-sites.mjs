/**
 * #864 original public archive recovery for five independently verified
 * 2021-2025 Minnesota State Senators lacking selected first-party excerpts.
 * Six date-segmented CDX windows; complete original CDX + SHA-matched HTML.
 * No false assertion of original authorship date or prior election availability.
 * No database, forecasts, models, scheduler, 2027 program, or outreach.
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
const pins=[
 {person:'Gene Dornink',electionDistrict:'27',electionYear:2020,host:'genedorninkforsenate.com',from:'20180101',to:'20201102',label:'dornink_2018_2020'},
 {person:'Foung Hawj',electionDistrict:'67',electionYear:2020,host:'founghawj.com',from:'20180101',to:'20201102',label:'hawj_2018_2020'},
 {person:'Foung Hawj',electionDistrict:'67',electionYear:2022,host:'founghawj.com',from:'20210101',to:'20221107',label:'hawj_2021_2022'},
 {person:'Michael Kreun',electionDistrict:'32',electionYear:2022,host:'michaelformnsenate.com',from:'20220101',to:'20221107',label:'kreun_2022'},
 {person:'Eric Lucero',electionDistrict:'30',electionYear:2022,host:'ericlucero.com',from:'20220101',to:'20221107',label:'lucero_2022'},
 {person:'Jim Carlson',electionDistrict:'51',electionYear:2020,host:'carlsonforsenate.org',from:'20180101',to:'20201102',label:'carlson_2018_2020'},
];
const govExpected='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const args=process.argv.slice(2);
function arg(k){const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+k);return resolve(args[i+1]);}
function original(p,min=20,max=5500000){const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'missing official source '+p);return readFileSync(p);}
const gov=original(arg('--official-html'),9000);
const audit=JSON.parse(original(arg('--official-receipt')).toString());
const out=arg('--out-dir');
assert.equal(sha(gov),govExpected);
assert.equal(audit.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(audit.source.sourceBytesSha256,govExpected);
const official=parseOfficialMnSenateServiceDirectory(gov,audit.source.observedAt);
const people=[...new Set(pins.map(p=>p.person))];
assert.equal(people.length,5);
assert.equal(pins.length,6);
for(const p of pins){
 const verified=validateActualSenateServiceForElection(official,p.person,p.electionDistrict,p.electionYear);
 assert.equal(verified.status,'verified_senate_service',p.person);
 assert.equal(verified.serviceForThisElectionFollowingYearVerified,true,p.person);
}
mkdirSync(out,{recursive:true});
const http=async(url,timeout=35000)=>{
 const requestedAtUtc=new Date().toISOString();
 try{
  const res=await fetch(url,{headers:{'User-Agent':'MN-Senate-2020-Historical-Public-Source-Research/1.0 (offline-evidence-gap-audit)'},signal:AbortSignal.timeout(timeout)});
  const bytes=Buffer.from(await res.arrayBuffer());
  if(bytes.length>4000000)throw Error('unbounded public archive bytes');
  return {ok:res.ok,status:res.status,bytes,requestedAtUtc,
   receivedAtUtc:new Date().toISOString(),actualUrl:res.url,
   contentType:res.headers.get('content-type')};
 }catch(e){return {ok:false,status:null,bytes:Buffer.alloc(0),requestedAtUtc,
   receivedAtUtc:new Date().toISOString(),error:String(e).slice(0,180)};}
};
function cdxUrl(t){
 const u=new URL('https://web.archive.org/cdx/search/cdx');
 for(const [k,v]of Object.entries({
  url:t.host,matchType:'domain',from:t.from,to:t.to,output:'json',
  fl:'timestamp,original,mimetype,statuscode,digest,length',
  filter:'statuscode:200',limit:'300'}))u.searchParams.set(k,v);
 return u.toString();
}
function classify(r){
 const url=r[1]||'';
 if(!/^https?:\/\//i.test(url)||!r[2]?.toLowerCase().includes('html'))return -100;
 if(!/^(200)$/.test(r[3]))return -100;
 const path=new URL(url).pathname;
 let weight=/\/(issue|priorit|platform|vision|polic|position|education|tax|environment|health)/i.test(path)?30:0;
 if(/\/(about|meet|home|index|campaign)/i.test(path))weight+=12;
 if(/^\/(?:index\.(html?|php))?$/i.test(path))weight+=8;
 if(/\/(wp-content|assets|images|css|static|file|upload)/i.test(path))weight-=20;
 return weight;
}
const manifests=[];
for(const t of pins){
 const url=cdxUrl(t),r=await http(url,35000);
 const record={person:t.person,electionDistrict:t.electionDistrict,electionYear:t.electionYear,domain:t.host,
  fromInclusive:t.from,toInclusive:t.to,queryUrl:url,requestObservedUtc:r.requestedAtUtc,
  responseObservedUtc:r.receivedAtUtc,requestHttpStatus:r.status,
  responseBodySHA256:r.bytes.length?sha(r.bytes):null,
  sourceIndexFilename:r.ok?t.label+'-entire-original-cdx.json':null,
  originalRows:0,indexCappedAt300:false,archivedHtmlCandidatesInBoundedIndex:0,
  selectedOriginalReplaysAttempted:0,verifiedFullOriginalHtmlReplays:0,
  originalReplays:[],indexError:null,
  noCandidateIssueStatementFoundInBoundedSampleNeverProvesAbsence:true};
 let rows=[];
 if(!r.ok)record.indexError=r.error||('HTTP '+r.status);
 else{
  try{
   const raw=JSON.parse(r.bytes.toString('utf8'));
   assert.ok(Array.isArray(raw)&&raw.length>0&&raw.length<=301);
   assert.deepEqual(raw[0],['timestamp','original','mimetype','statuscode','digest','length']);
   rows=raw.slice(1);
   record.originalRows=rows.length;
   record.indexCappedAt300=rows.length===300;
   record.archivedHtmlCandidatesInBoundedIndex=rows.filter(v=>classify(v)>=0).length;
   writeFileSync(join(out,record.sourceIndexFilename),r.bytes,{flag:'wx'});
  }catch(e){record.indexError='Original archive index invalid/unparseable: '+String(e).slice(0,150);
   record.sourceIndexFilename=null;}
 }
 // At most TWO original HTML URLs per window; strictly pre-general capture.
 // A 2020 query is not a 2022 source and no original author date is inferred.
 if(rows.length){
  const selected=[],seen=new Set();
  const ranked=rows.filter(v=>classify(v)>=0
   &&/^\d{14}$/.test(v[0])&&v[0]<(t.electionYear===2020?'20201103000000':'20221108000000')
   &&/^[A-Z2-7]{32}$/.test(v[4]))
   .sort((a,b)=>classify(b)-classify(a)||b[0].localeCompare(a[0]));
  for(const v of ranked){
   const key=v[1].replace(/^https?:\/\/(?:www\.)?/i,'').toLowerCase().replace(/\/$/,'');
   if(seen.has(key))continue;seen.add(key);selected.push(v);
   if(selected.length===2)break;
  }
  for(const [i,v]of selected.entries()){
   record.selectedOriginalReplaysAttempted++;
   const replay='https://web.archive.org/web/'+v[0]+'id_/'+v[1];
   const p=await http(replay,35000);
   const result={originalFirstPartyURL:v[1],waybackCaptureUtc:
     v[0].replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/,'$1-$2-$3T$4:$5:$6.000Z'),
    originalIndexedWaybackCDXSha1Base32:v[4],waybackReplayUrl:replay,
    requestHttpStatus:p.status,replayedAtUtc:p.receivedAtUtc,
    responseBodySHA256:p.bytes.length?sha(p.bytes):null,sourceFile:null,visibleOriginalSourcePreview:null,
    fullOriginalByteDigestMatchesSeparateOriginalCdx:false,senatorSurnameIsInVisiblePage:false,
    candidateElectionPlatformContextIndependentlyReviewed:false,claimOfHistoricalPolicyExtracted:false};
   if(p.ok&&p.bytes.length>=64&&p.bytes.length<=3000000){
    const dig=historicalArchiveSha1Base32(p.bytes);
    result.fullOriginalByteDigestMatchesSeparateOriginalCdx=dig===v[4];
    const last=t.person.split(' ').at(-1).toLowerCase();
    const visible=originalCampaignVisibleText(p.bytes);
    result.senatorSurnameIsInVisiblePage=visible.toLowerCase().includes(last);
    if(result.fullOriginalByteDigestMatchesSeparateOriginalCdx&&result.senatorSurnameIsInVisiblePage)
     result.visibleOriginalSourcePreview=visible.slice(0,4500);
    if(result.fullOriginalByteDigestMatchesSeparateOriginalCdx&&result.senatorSurnameIsInVisiblePage){
     const f=t.label+'-'+String(i+1)+'-original-'+v[0]+'.html';
     writeFileSync(join(out,f),p.bytes,{flag:'wx'});
     result.sourceFile=f;record.verifiedFullOriginalHtmlReplays++;
    }
   }
   record.originalReplays.push(result);
  }
 }
 record.currentBoundedGapClassification=record.indexError
  ?'index_access_or_parse_unknown_not_no_policy'
  :record.verifiedFullOriginalHtmlReplays>0
   ?'original_archive_html_found_policy_and_campaign_cycle_still_unreviewed'
   :record.originalRows===0?'bounded_archive_index_empty_not_no_policy'
   :record.indexCappedAt300?'index_capped_no_replayed_original_not_no_policy'
   :'index_has_rows_but_no_full_authenticated_candidate_body_in_selected_sample';
 manifests.push(record);
 console.log('HISTORICAL SOURCE GAP PROBE '+JSON.stringify({
  person:t.person,window:t.label,status:r.status,indexRows:record.originalRows,
  capped:record.indexCappedAt300,originalHTML:record.verifiedFullOriginalHtmlReplays,
  gap:record.currentBoundedGapClassification}));
}
const report={schema:'mn-2020-22-five-uncovered-actual-senators-six-wayback-domain-windows-v1',
 issue:864,fullOriginalGovernmentSha256:sha(gov),actualStateSenatorPeopleProvenBeforeNetwork:people.length,
 queryWindows:manifests.length,sourceCDXFullJSONFilesReopened:manifests.filter(m=>m.sourceIndexFilename).length,
 actualOriginalHTMLPageReplaysRecovered:manifests.reduce((s,m)=>s+m.verifiedFullOriginalHtmlReplays,0),
 queriesNeverClaimCompleteArchivedWebsiteEnumeration:true,
 archivedCaptureUTCOnlyPublicByNotAuthorDate:true,identityUsesActual2021StateSenateServiceNotBallotWin:true,
 olderUnrelatedOrDuplicateArchivesMustNotCountAsFirstPartyQuotes:true,
 policyPositionExcerptsAutomaticallyAdmitted:0,officialSenateVoteClaimsInferred:0,
 productionDatabaseReadsWritesOrForecastChanges:0,sourceWindows:manifests};
writeFileSync(join(out,'five-actual-senator-new-original-archive-source-recovery.json'),
 JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('SOURCE-ONLY FIVE SENATOR HISTORICAL ORIGINAL ARCHIVE GAP RESULTS '+JSON.stringify({
 people:people.length,windows:report.queryWindows,indexes:report.sourceCDXFullJSONFilesReopened,
 originalFullSitePages:report.actualOriginalHTMLPageReplaysRecovered,productionChanges:0}));
