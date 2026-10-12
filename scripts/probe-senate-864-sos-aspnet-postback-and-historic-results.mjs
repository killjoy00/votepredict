/**
 * #864 MN SOS historical original candidate-site source round 2.
 * The federal/state/county FILED candidate text export isn't an <a href>
 * download: it is ASP.NET __doPostBack('ctl00$ContentPlaceHolder1$lbStateMediaFile','').
 * Discover the exact live 2026 POST schema solely as a transport reference,
 * NEVER as historical 2020/22 Senate website evidence.
 *
 * Look for independently originally-indexed PRE-election official
 * CandidateFilingResults.aspx GET snapshots on both legacy/current SOS hosts.
 * Validate whole raw original Wayback HTML SHA1 equal indexed original CDX;
 * person+website must be on SAME original table row and district not inferred.
 * Do not save/print raw 2026 candidate exports, personal addresses/phone/email,
 * historical original full HTML or opaque ASP.NET viewstate/cookies.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {auditSos2020to2022OriginalGeneralCensus} from '../src/evidence/senate-2020-22-official-general-census.js';
import {historicalArchiveSha1Base32} from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const args=process.argv.slice(2);
const arg=k=>{const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+k);return resolve(args[i+1]);};
const year=Number(args[args.indexOf('--year')+1]);assert.ok(year===2020||year===2022);
const out=arg('--out-dir');mkdirSync(out,{recursive:true});
function file(p,min=100,max=8e6){const x=statSync(p);assert.ok(x.isFile()&&x.size>=min&&x.size<=max,'Missing original SOS source '+p);return readFileSync(p);}
const sha=b=>createHash('sha256').update(b).digest('hex');
const m=JSON.parse(file(resolve('data/evaluation/senate-864-official-sos-historical-filed-website-export-recovery-targets-v1.json'),1500).toString());
assert.equal(m.schema,'senate-864-sos-2020-2022-historical-filed-candidate-website-export-source-probe-v1');
assert.equal(m.candidateFilingWebsiteFieldIndexZeroBased,15);
assert.equal(m.productionDatabaseReadWrites,0);
const original=arg('--sos-original-dir');
const sos=auditSos2020to2022OriginalGeneralCensus(year,
 file(join(original,year+'-sos-general-stsenate.response'),1000),
 file(join(original,year+'-sos-general-cand.response'),1000));
assert.equal(sos.totals.senateDistricts,67);
assert.equal(sos.totals.nonWriteinElectionWinnerCandidates,67);
assert.equal(sos.source.originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence,true);
const originals=m.previousOfficialOriginalElectionWinners;
assert.equal(sos.source.originalResultSha256,originals['originalSOS'+year+'StsenateSha256']);
assert.equal(sos.source.originalCandidateLookupSha256,originals['originalSOS'+year+'CandidateLookupSha256']);
const winners=new Map(sos.candidates.filter(x=>x.generalOutcome==='winner').map(x=>[x.district,x.candidateName]));
assert.equal(winners.size,67);
const safelyAllowed=u=>{try{const x=new URL(u);return x.protocol==='https:'&&
 ['candidates.sos.mn.gov','candidates.sos.state.mn.us','web.archive.org'].includes(x.hostname.toLowerCase())&&!x.username&&!x.password&&!x.port;}catch{return false;}};
let requests=0;
async function request(url,opt={},limit=2_000_000,deadline=14000){
 assert.ok(safelyAllowed(url),'Rejected nonofficial or nonarchive source');
 requests++;
 try{
  const r=await fetch(url,{...opt,redirect:'follow',signal:AbortSignal.timeout(deadline)});
  const n=Number(r.headers.get('content-length')||0);
  if(n>limit)return {status:r.status,body:null,bytes:n,error:'Large response blocked',disposition:null,finalUrl:r.url};
  const b=Buffer.from(await r.arrayBuffer());
  if(b.length>limit)return {status:r.status,body:null,bytes:b.length,error:'Response over bounded bytes',disposition:null,finalUrl:r.url};
  return {status:r.status,body:b,bytes:b.length,error:null,disposition:r.headers.get('content-disposition'),contentType:r.headers.get('content-type'),finalUrl:r.url,cookie:r.headers.getSetCookie?.()||[]};
 }catch(e){return {status:null,body:null,bytes:0,error:String(e).slice(0,180),disposition:null,finalUrl:url};}
}
const unescape=s=>String(s).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const plain=s=>unescape(String(s).replace(/<script\b[^>]*>[\s\S]*?<\/script>/ig,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/ig,'').replace(/<[^>]+>/g,' '));
function attr(tag,k){const m=new RegExp('\\b'+k+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s>]+))','i').exec(tag);return unescape(m?.[1]??m?.[2]??m?.[3]??'');}
function cleanWebsite(s){
 const raw=unescape(s).replace(/^\s*['"]|['"]\s*$/g,'');
 if(!raw||/@/.test(raw)||/\s/.test(raw)||raw.length>300||/^(?:n\/a|none|null)/i.test(raw))return null;
 try{const u=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.')||/\.local$/.test(u.hostname))return null;return u.toString();}
 catch{return null;}
}
function senateTextCandidateCounts(b){
 if(!b)return null;
 const t=b.toString('utf8').replace(/^\ufeff/,'');
 if(/<\s*(?:!doctype|html|body)\b/i.test(t.slice(0,350)))return {semicolonsCandidateFile:false,htmlOrProviderFailure:true};
 const rows=[];
 for(const line of t.split(/\r?\n/)){
  const a=line.split(';');if(a.length<16)continue;
  const dist=/^State\s+Senat(?:or|e)\s+District\s+0*(\d{1,2})\b/i.exec(a[3]||'');
  if(!dist||Number(dist[1])<1||Number(dist[1])>67||!a[1]?.trim())continue;
  rows.push({district:String(Number(dist[1])),name:a[1].trim(),website:cleanWebsite(a[15])});
 }
 return {semicolonsCandidateFile:rows.length>0,senateCandidateRows:rows.length,
  senateDistricts:new Set(rows.map(x=>x.district)).size,senatorsWithCampaignWebsiteField:rows.filter(x=>x.website).length,
  originalRawAddressesPhonesEmailsStored:false,originalElectionsExcludedFrom2026Observation:true};
}
async function submitLive2026Form(){
 const portal='https://candidates.sos.mn.gov/';
 const pg=await request(portal,{},1_200_000,16000);
 const result={currentSourceUrl:portal,landingHttpStatus:pg.status,landingSHA256:pg.body?sha(pg.body):null,
  current2026TransportOnly:true,postbackEventTarget:'ctl00$ContentPlaceHolder1$lbStateMediaFile',
  historical2020or2022ExportAuthenticated:false,
  postHttpStatus:null,returnedFileName:null,rawResponseSha256:null,
  current2026SenateFileShape:null,error:pg.error||null,
  originalUnredactedRawBodyOrPersonalDataPersisted:false};
 if(pg.status!==200||!pg.body)return result;
 const text=pg.body.toString('utf8');
 const fields=new URLSearchParams();
 const inputs=[...text.matchAll(/<input\b[^>]*>/gi)];
 for(const x of inputs){
  const tag=x[0],name=attr(tag,'name');
  if(name.startsWith('__')&&name.length<=90)fields.set(name,attr(tag,'value'));
 }
 fields.set('__EVENTTARGET',result.postbackEventTarget);
 fields.set('__EVENTARGUMENT','');
 if(!fields.get('__VIEWSTATE')){result.error='No ASP.NET postback hidden viewstate on official current form';return result;}
 // ASP.NET states are ONLY used in ephemeral POST and never written/logged.
 const cookies=(pg.cookie||[]).map(x=>x.split(';')[0]).filter(x=>!/\s/.test(x.split('=')[0])).join('; ');
 const resp=await request(portal,{method:'POST',
  headers:{'content-type':'application/x-www-form-urlencoded','accept':'text/plain,application/octet-stream,*/*','origin':portal.slice(0,-1),'referer':portal,...(cookies?{'cookie':cookies}:{})},
  body:fields.toString()},2_500_000,16000);
 result.postHttpStatus=resp.status;
 result.rawResponseSha256=resp.body?sha(resp.body):null;
 result.current2026SenateFileShape=senateTextCandidateCounts(resp.body);
 // Content-Disposition is a public file label only, never download data.
 result.returnedFileName=(resp.disposition||'').match(/filename\*?=(?:UTF-8''|["'])?([^"';\r\n]+)/i)?.[1]||null;
 result.httpContentType=resp.contentType||null;
 result.redirectedToOtherOfficialOriginalEndpoint=resp.finalUrl!==portal&&safelyAllowed(resp.finalUrl)?resp.finalUrl:null;
 result.error=resp.error;
 return result;
}
const live=year===2020?await submitLive2026Form():{checkedOnlyIn2020ParallelTrack:true,historicalClaimFromLiveSite:false};
const known=[{name:"Scott Newman",surname:"newman",year:2020,district:"18"},
 {name:"Charles Wiger",surname:"wiger",year:2020,district:"43"},
 {name:"David Tomassoni",surname:"tomassoni",year:2020,district:"6"},
 {name:"Thomas Bakk",surname:"bakk",year:2020,district:"3"},
 {name:"Kari Dziedzic",surname:"dziedzic",year:2022,district:"60"},
 {name:"Bill Weber",surname:"weber",year:2022,district:"21"}].filter(x=>x.year===year);
for(const k of known)assert.ok(winners.get(k.district)?.toLowerCase().includes(k.surname),'SOS original election winner not matched '+k.name);
function websiteOnSameTableRow(html){
 const found=[];
 for(const m of html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)){
  const row=m[0];
  if(row.length>12_000)continue;
  const cells=[...row.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/gi)].map(x=>x[0]);
  if(cells.length<3)continue;
  const candidateName=plain(cells[0]);
  for(const k of known){
   if(!new RegExp('\\b'+k.surname+'\\b','i').test(candidateName))continue;
   const webCell=cells[2];
   let website=null;
   for(const link of webCell.matchAll(/<a\b[^>]*>/ig)){
    const href=attr(link[0],'href');
    const good=cleanWebsite(href);
    if(good){website=good;break;}
   }
   if(!website)website=cleanWebsite(plain(webCell));
   const context=html.slice(Math.max(0,m.index-2100),m.index);
   const match=[...context.matchAll(/State\s+Senat(?:or|e)\s+District\s+0*(\d{1,2})/ig)].at(-1);
   const originalHtmlDistrict=match?String(Number(match[1])):null;
   found.push({person:k.name,originalSenateElectionYear:year,originalOfficialGeneralWinnerDistrict:k.district,
    historicalOfficialSOSRowName:candidateName.slice(0,130),historicalOriginalHtmlDistrict:originalHtmlDistrict,
    historicalFiledWebsiteDisplayedInSameRow:website,
    explicitSenateDistrictVerifiedInOriginalNearbyHeading:originalHtmlDistrict===k.district,
    officialWebsiteRowDoesNotEstablishCandidateOwnedIssueText:true});
  }
 }
 return found.slice(0,50);
}
const targets=[
 'https://candidates.sos.mn.gov/CandidateFilingResults.aspx',
 'https://candidates.sos.state.mn.us/CandidateFilingResults.aspx',
 'https://candidates.sos.mn.gov/CandidateFilingResults.aspx?senate=True',
 'https://candidates.sos.state.mn.us/CandidateFilingResults.aspx?senate=True'
];
const queries=[],wholeOriginalPages=[];
const cutoff=year===2020?'20201102':'20221107';
for(const target of targets){
 const q=new URLSearchParams({url:target,matchType:'prefix',from:String(year)+'0101',
  to:cutoff,output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'85'});
 q.append('filter','statuscode:200');
 const endpoint='https://web.archive.org/cdx/search/cdx?'+q.toString();
 const ix=await request(endpoint,{},1_300_000,17000);
 let rows=[],error=ix.error;
 if(ix.status===200&&ix.body){
  try{
   const d=JSON.parse(ix.body.toString('utf8'));
   assert.ok(Array.isArray(d)&&d.length>0&&d.length<=86);
   assert.deepEqual(d[0],['timestamp','original','mimetype','statuscode','digest','length']);
   rows=d.slice(1);
  }catch(e){error='Provider HTTP 200 non-CDX result: '+String(e).slice(0,170);}
 }
 const meta={target,sourceOriginalWholeIndexURL:endpoint,httpStatus:ix.status,wholeIndexSha256:ix.body?sha(ix.body):null,
  validCdxRows:rows.length,queriedHistoricalYear:year,
  fullOriginalHtmlVerified:0,
  missingResultDoesNotProveNoFiledCandidates:true,error};
 queries.push(meta);
 const valid=rows.filter(r=>/^\d{14}$/.test(r?.[0]||'')
  &&r[0]<cutoff+'235959'
  &&/^https?:\/\/candidates\.sos\.(?:state\.mn\.us|mn\.gov)\//i.test(r?.[1]||'')
  &&/CandidateFilingResults\.aspx/i.test(r[1])
  &&/^[A-Z2-7]{32}$/.test(r?.[4]||'')&&r[3]==='200'&&r[2]==='text/html');
 valid.sort((a,b)=>b[0].localeCompare(a[0]));
 const seen=new Set();
 for(const r of valid){
  if(seen.has(r[4])||meta.fullOriginalHtmlVerified>=2)continue;
  seen.add(r[4]);
  const rurl='https://web.archive.org/web/'+r[0]+'id_/'+r[1];
  const orig=await request(rurl,{},1_900_000,16000);
  if(orig.status!==200||!orig.body||historicalArchiveSha1Base32(orig.body)!==r[4])continue;
  const text=orig.body.toString('utf8');
  const personRows=websiteOnSameTableRow(text);
  // Only safe extracted (candidate name, submitted website and district).
  wholeOriginalPages.push({indexedPreElectionOriginalUrl:r[1],
   originalArchivedCaptureUtc:r[0].replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/,'$1-$2-$3T$4:$5:$6.000Z'),
   originalIndexedSHA1Base32:r[4],originalWholeHtmlSHA256:sha(orig.body),
   independentOriginalWholeCDXIndexSha256:meta.wholeIndexSha256,
   originalAnyNamesWithSameRowWebsite:personRows.length,
   selectedOfficialWinnerSameRowWebsiteLeads:personRows,
   sourceOriginal2020or2022SosPageNotCompleteFiledCandidateCensus:true,
   originalWholeSourcePersonalContactFieldsNeverLoggedSavedOrUploaded:true});
  meta.fullOriginalHtmlVerified++;
 }
}
const report={schema:'senate-864-original-sos-2020-22-aspnet-download-and-senate-results-page-research-v1',
 issue:864,originalElectionYear:year,official2020or2022ElectionDistrictCount:67,
 sourceIndependentOriginalOfficialSOSGeneralStsenateSHA256:sos.source.originalResultSha256,
 sourceIndependentOriginalOfficialSOSGeneralCandidateLookupSHA256:sos.source.originalCandidateLookupSha256,
 originalSOS2020or2022WinnersReconciled:true,
 originalHistoricalFiledCandidateWebsiteExportObtained:false,
 officialCandidateFileCurrent2026ASPNetDownloadTransportProof:live,
 preElectionOriginalCandidateResultsPageArchiveIndexQueries:queries,
 wholeVerifiedArchivedCandidateResultsPages:wholeOriginalPages,
 candidateWebsiteOriginalFiledFullUniverseNotCertified:true,
 originalResultCandidateRowWebsiteDoesNotCertifyFirstPartyIssuePlatform:true,
 archivedPageCaptureNotOriginalAuthorFirstPublication:true,
 allOriginalSensitiveContactFieldsNeverPersistedOrExposed:true,
 noEvidenceOfNoWebsiteFromUnreplayedArchive:true,
 baselineActualServing95:95,baselineCandidateSiteCovered92:92,
 baselineSiteIssueFragments1285:1285,
 newCandidateOwnedCampaignIssueResearchExcerptsAutoAdded:0,
 anyOfficialVotesCertified:false,productionDBReadsWrites:0,trainingScoringForecastOrDeploymentChanges:0,
 totalPublicRequests:requests};
writeFileSync(join(out,'senate-864-sos-'+year+'-historical-filed-websites-postback-and-archived-results.json'),
 JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log('MN SOS ASPNET FILING DOWNLOAD AND HISTORIC WEBSITE ORIGINAL '+JSON.stringify({
 electionYear:year,officialSOS67DistrictWinners:true,
 current2026StateCandidateFileASPNetPostback:live,
 originalCandidateResultsQueryOutcome:queries.map(q=>({target:q.target,status:q.httpStatus,authenticIndexRows:q.validCdxRows,fullOriginalPages:q.fullOriginalHtmlVerified,error:q.error})),
 originalWholeAuthenticatedSenateResultPages:wholeOriginalPages.length,
 originalRowsForNamedWinnerCandidates:wholeOriginalPages.flatMap(x=>x.selectedOfficialWinnerSameRowWebsiteLeads),
 originalUnredactedCandidateFilingBodyRetained:false,modelChanges:0},null,2));
