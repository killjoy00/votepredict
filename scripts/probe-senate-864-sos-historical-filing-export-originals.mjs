/**
 * VotePredict #864 — original 2020/22 Minnesota Secretary of State
 * filed-candidate download retrieval, distinct from POST-vote cand.txt.
 *
 * At most 1 bounded 2026 official portal discovery page and a handful
 * of official-historical archive CDX/index original full-body replays.
 * Extract only public candidate NAME, STATE SENATE DISTRICT and CAMPAIGN
 * WEBSITE. Original candidate-file body may contain residence/campaign
 * address, phone and email; NEVER print/store/archive/upload those bytes.
 *
 * Reject live 2026 filing file as 2020/22 original; reject Wayback non-CDX
 * provider HTTP200; require SHA1(Base32) original complete 2020/22 bytes
 * to match independently observed original CDX indexed digest.
 * Independently rehash and reconcile 67 district 2020/22 SOS winners.
 * Absolutely no production, databases, forecast, training, deployment.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {auditSos2020to2022OriginalGeneralCensus}
 from '../src/evidence/senate-2020-22-official-general-census.js';
import {parseOfficialMnSenateServiceDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const args=process.argv.slice(2);
const flag=k=>{let i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing required '+k);return resolve(args[i+1]);};
const yyyy=Number(args[args.indexOf('--election-year')+1]);
assert.ok([2020,2022].includes(yyyy),'Only original 2020 and 2022 Senate elections in scope');
const out=flag('--out-dir');mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const file=(p,min=100,max=8_000_000)=>{const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'Expected unmodified authoritative original '+p);return readFileSync(p);};
const manifest=JSON.parse(file(resolve('data/evaluation/senate-864-official-sos-historical-filed-website-export-recovery-targets-v1.json'),1000).toString());
assert.equal(manifest.schema,'senate-864-sos-2020-2022-historical-filed-candidate-website-export-source-probe-v1');
assert.equal(manifest.issue,864);
assert.equal(manifest.candidateFilingWebsiteFieldIndexZeroBased,15);
assert.equal(manifest.productionDatabaseReadWrites,0);
const yr=manifest.years.find(x=>x.electionYear===yyyy);assert.ok(yr);
const official=file(flag('--official-html'),9000),metadata=JSON.parse(file(flag('--official-receipt'),300).toString());
const swear=file(flag('--official-special-swearing-html'),9000);
assert.equal(sha(official),manifest.previousOfficialOriginalElectionWinners.officialLRLSenateHtmlSha256);
assert.equal(metadata.source.sourceBytesSha256,sha(official));
assert.equal(metadata.supplementalSwearingSource.sourceBytesSha256,sha(swear));
const service=parseOfficialMnSenateServiceDirectory(official,metadata.source.observedAt,swear,metadata.supplementalSwearingSource.observedAt);
assert.equal(service.senators.length,105);
const ss=flag('--sos-original-dir');
const rawSt=file(join(ss,yyyy+'-sos-general-stsenate.response'),1000);
const rawCa=file(join(ss,yyyy+'-sos-general-cand.response'),1000);
const historical=auditSos2020to2022OriginalGeneralCensus(yyyy,rawSt,rawCa);
assert.equal(historical.totals.senateDistricts,67);
assert.equal(historical.totals.nonWriteinElectionWinnerCandidates,67);
assert.equal(historical.source.originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence,true);
assert.equal(historical.source.originalResultSha256,manifest.previousOfficialOriginalElectionWinners['originalSOS'+yyyy+'StsenateSha256']);
assert.equal(historical.source.originalCandidateLookupSha256,manifest.previousOfficialOriginalElectionWinners['originalSOS'+yyyy+'CandidateLookupSha256']);
const winnerByDistrict=new Map(historical.candidates.filter(c=>c.generalOutcome==='winner').map(c=>[c.district,c]));
assert.equal(winnerByDistrict.size,67);
function restrictedUrl(url){
 try{const u=new URL(url);return u.protocol==='https:'&&[
   'candidates.sos.mn.gov','candidates.sos.state.mn.us','www.sos.mn.gov','sos.mn.gov','web.archive.org'
 ].includes(u.hostname.toLowerCase())&&!u.username&&!u.password&&!u.port;}
 catch{return false;}
}
let httpCalls=0;
async function get(url,extraHeaders={},max=3_000_000,timeout=14000){
 assert.ok(restrictedUrl(url),'Request outside pinned official/authenticated Wayback sources '+url);
 httpCalls++;
 let last={status:null,size:0,body:null,contentType:null,finalUrl:url,error:null};
 for(let attempt=0;attempt<2;attempt++){
  try{
   const res=await fetch(url,{headers:{accept:'text/html,text/plain,application/json,*/*;q=0.3','user-agent':'VotePredict #864 historical SOS candidate-file public-only archive research/1.0',...extraHeaders},redirect:'follow',signal:AbortSignal.timeout(timeout)});
   const hdr=res.headers.get('content-length');
   if(hdr&&Number(hdr)>max)return {status:res.status,size:Number(hdr),body:null,contentType:res.headers.get('content-type'),error:'Response length exceeds original limit',finalUrl:res.url};
   const bytes=Buffer.from(await res.arrayBuffer());
   if(bytes.length>max)return {status:res.status,size:bytes.length,body:null,contentType:res.headers.get('content-type'),error:'Source over limit',finalUrl:res.url};
   last={status:res.status,size:bytes.length,body:bytes,contentType:res.headers.get('content-type'),finalUrl:res.url,error:null};
   if(attempt===0&&[429,502,503,504].includes(res.status))continue;
   return last;
  }catch(e){last={status:null,size:0,body:null,contentType:null,finalUrl:url,error:String(e).slice(0,160)};}
 }
 return last;
}
const dec=s=>String(s).replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ').trim();
function aTags(body){
 const html=body.toString('utf8');
 const out=[];
 for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/ig)){
  const props=m[1],name=dec(m[2].replace(/<[^>]*>/g,''));
  const href=/\bhref\s*=\s*(["'])(.*?)\1/i.exec(props)?.[2]||
             /\bhref\s*=\s*([^\s>]+)/i.exec(props)?.[1]||'';
  const onclick=/\bonclick\s*=\s*(["'])(.*?)\1/i.exec(props)?.[2]||'';
  if(/candidate filing|candidate.{0,20}general election|text file layout|downloadable/i.test(name)
    ||/\.(?:txt|csv)(?:\?|$)/i.test(href)||/download/i.test(href+onclick)){
   let resolved=null;
   try{resolved=new URL(dec(href),'https://candidates.sos.mn.gov/').toString();}catch{}
   out.push({label:name.slice(0,110),href:dec(href).slice(0,260),absoluteResolvedUrl:resolved,
    postbackOnly:/javascript:|__doPostBack/i.test(href+onclick),eventTargetCue:onclick.includes('__doPostBack')?onclick.slice(0,150):null});
  }
 }
 return out.slice(0,35);
}
const main=await get(manifest.publishedOfficialCandidateFilingPortal);
const layout=await get(manifest.officiallyPublishedCandidateFileLayout);
const landing={sourceUrl:manifest.publishedOfficialCandidateFilingPortal,status:main.status,originalHtmlSha256:main.body?sha(main.body):null,originalHtmlBytes:main.size,downloadLinks:main.status===200&&main.body?aTags(main.body):[],error:main.error,
 homepageExplicitElection2026:main.body?/November\s+3,?\s+2026/i.test(main.body.toString('utf8')):false};
const layoutProof={sourceUrl:manifest.officiallyPublishedCandidateFileLayout,status:layout.status,rawBodySha256:layout.body?sha(layout.body):null,
 originalHasCampaignWebsiteField:layout.body?/Federal,\s*State,\s*and\s*County\s+Candidates[\s\S]{0,900}\bCampaign Website\b/i.test(layout.body.toString('utf8')):false};
const rawDownloadUrls=landing.downloadLinks.filter(x=>/candidate filings.*federal.*state.*county/i.test(x.label)
 &&x.absoluteResolvedUrl&&restrictedUrl(x.absoluteResolvedUrl)&&!x.postbackOnly).map(x=>x.absoluteResolvedUrl);
const otherDirect=landing.downloadLinks.filter(x=>/candidates in the general election.*federal.*state.*county/i.test(x.label)
 &&x.absoluteResolvedUrl&&restrictedUrl(x.absoluteResolvedUrl)&&!x.postbackOnly).map(x=>x.absoluteResolvedUrl);
const allResolved=[...new Set(rawDownloadUrls)].slice(0,4);
const current=[];
for(const url of allResolved){
 const r=await get(url,{},2_500_000,12000);
 current.push({url,observationClass:'current_2026_export_only_not_historical',status:r.status,sourceSha256:r.body?sha(r.body):null,size:r.size,
  fieldReport:r.body?shortSanitizedSenateFileStats(r.body):null,doesNotEstablish2020or2022CandidateWebsite:true});
}
// No storing of ANY raw original content, including current CSV with addresses.
function validWeb(v){
 if(!v||v.includes('@')||v.length>340||/\s/.test(v))return null;
 try{
  const u=new URL(/^https?:\/\//i.test(v)?v:'https://'+v);
  if(!['http:','https:'].includes(u.protocol)||!u.hostname.includes('.')||u.username||u.password)return null;
  return u.toString();
 }catch{return null;}
}
function shortSanitizedSenateFileStats(original){
 const bytes=original.toString('utf8').replace(/^\ufeff/,'');
 // Includes original residential/campaign addresses, phones and e-mails. Inspect
 // ONLY candidate name, Senate district and website field in process memory.
 if(/<\s*(?:html|!doctype|body|head)\b/i.test(bytes.slice(0,700)))return {isValidSemicolonCandidateFiling:false,reason:'HTML/provider content, not original OSS semicolon export'};
 const rows=[];
 for(const line of bytes.split(/\r?\n/)){
  const cells=line.replace(/\r$/,'').split(';');
  if(cells.length<17)continue;
  const title=cells[3]?.trim()||'';
  const match=/^State\s+Senat(?:or|e)\s+District\s+0*(\d{1,2})\b/i.exec(title);
  if(!match)continue;
  const district=String(Number(match[1]));if(!Number(district)||Number(district)>67)continue;
  const name=cells[1]?.trim();if(!name)continue;
  rows.push({name,district,website:validWeb(cells[15]?.trim()||'')});
 }
 const dist=new Set(rows.map(r=>r.district));
 return {isValidSemicolonCandidateFiling:rows.length>0,candidateStateSenateRowCount:rows.length,
  numberDistinctSenateDistrictsObserved:dist.size,
  stateSenateRowsWithValidSubmittedWebsite:rows.filter(r=>r.website!==null).length,
  possibleHistoricCohortCompletenessNotCertified:true,rawAddressesPhonesEmailsNeverPrintedOrSaved:true,
  _rowsInMemoryOnly:rows};
}
function statsPublicOnly(r){if(!r)return null;const { _rowsInMemoryOnly, ...safe}=r;return safe;}
for(const c of current){if(c.fieldReport)c.fieldReport=statsPublicOnly(c.fieldReport);}
const knownOfficialCandidates=landing.downloadLinks.filter(x=>x.absoluteResolvedUrl&&restrictedUrl(x.absoluteResolvedUrl)&&!x.postbackOnly);
const aliases=[
 'https://candidates.sos.mn.gov/',
 'https://candidates.sos.mn.gov/CandidateFilingResults.aspx?candidateid=0&executive=False&federal=False&judicial=False&level=1&office=0&party=0&representative=False&senate=True',
 'https://candidates.sos.state.mn.us/',
 ...allResolved,
 ...knownOfficialCandidates.filter(x=>/candidate filings/i.test(x.label)).map(x=>x.absoluteResolvedUrl)
];
const targets=[...new Set(aliases)].slice(0,10);
const indexEntries=[],verified=[];
const dtLimit=yr.preElectionCdxEndDate;
for(const target of targets){
 // The old portal may not have an accessible original CDX capture. Record the
 // provider failure as unknown; DO NOT report zero historic filings.
 const q=new URLSearchParams({url:target,matchType:'exact',from:String(yyyy)+'0101',to:dtLimit,output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'50'});
 q.append('filter','statuscode:200');
 const u='https://web.archive.org/cdx/search/cdx?'+q.toString();
 const res=await get(u,{},1_250_000,13000);
 let entries=[],failure=res.error;
 if(res.status===200&&res.body){
  try{
   const json=JSON.parse(res.body.toString('utf8'));
   assert.ok(Array.isArray(json)&&json.length>0&&json.length<=51,'Invalid original CDX item count');
   assert.deepEqual(json[0],['timestamp','original','mimetype','statuscode','digest','length']);
   entries=json.slice(1);
  }catch(e){failure='Provider HTTP200 non-CDX content: '+String(e).slice(0,160);}
 }
 const info={originalQueryTarget:target,originalIndexQuery:u,status:res.status,originalWholeIndexSha256:res.body?sha(res.body):null,
  trueOriginalCdxRows:entries.length,originalHistoricWholeBodyVerified:0,
  indexMissingOrInvalidDoesNotMeanNoFile:true,error:failure||(!entries.length?'No qualifying original CDX row available':null)};
 indexEntries.push(info);
 if(!entries.length)continue;
 const valid=entries.filter(r=>Array.isArray(r)&&/^\d{14}$/.test(r[0]||'')&&r[0]<dtLimit+'235959'
  &&/^[A-Z2-7]{32}$/.test(r[4]||'')&&r[3]==='200'
  &&/^https?:\/\/candidates\.sos\.(?:mn\.gov|state\.mn\.us)\//i.test(r[1]||'')).sort((a,b)=>b[0].localeCompare(a[0]));
 const used=new Set();let attempted=0;
 for(const r of valid){
  if(used.has(r[4])||attempted++>=2)continue;
  used.add(r[4]);
  for(const mode of ['id_','if_','mp_','']){
   const arch='https://web.archive.org/web/'+r[0]+mode+'/'+r[1];
   const original=await get(arch,{},2_500_000,13000);
   if(original.status!==200||!original.body||historicalArchiveSha1Base32(original.body)!==r[4])continue;
   const content=r[1].toLowerCase().includes('.txt')||/file/i.test(target)?'file':'portal_page';
   const stat=content==='file'?shortSanitizedSenateFileStats(original.body):null;
   const names=content==='portal_page'?aTags(original.body):[];
   const saved={originalCaptureObservedByUtc:r[0].replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/,'$1-$2-$3T$4:$5:$6.000Z'),
    originalUrl:r[1],indexedOriginalSHA1Base32:r[4],completeWholeOriginalSourceSHA256:sha(original.body),
    completeOriginalIndexedCDXSHA256:info.originalWholeIndexSha256,
    sourceClass:content,originalCandidateSenateFilingExportMatched:stat?.isValidSemicolonCandidateFiling||false,
    stateSenateSummary:statsPublicOnly(stat),
    archivedPortalCandidateDownloadLinks:names,
    originalRawFileWithResidenceAddressStoredAnywhere:false,
    originalObservedByOnlyNotFirstPublished:true,sourceElectionYear:yyyy};
   if(stat?.isValidSemicolonCandidateFiling){
    const matched=(stat._rowsInMemoryOnly||[]).filter(x=>winnerByDistrict.get(x.district)?.candidateName.toLowerCase().includes(x.name.split(' ').at(-1).toLowerCase())
      &&x.website);
    saved.officialSosWinnerWebsiteLeadMatches=matched.map(x=>({officialSosGeneralDistrict:x.district,
      candidateName:x.name,candidateFiledWebsiteUrl:x.website,archivedPreElectionOriginalDomain:true})).slice(0,80);
    saved.officialWinnerMatchesNotCompleteFiledCandidateWebsiteCensus=true;
   }
   info.originalHistoricWholeBodyVerified++;verified.push(saved);
   break;
  }
  if(info.originalHistoricWholeBodyVerified>=1)break;
 }
}
const report={schema:'senate-864-historical-2020-22-SOS-filed-candidate-website-archive-recon-v1',issue:864,
 electionYear:yyyy,officialElectionDate:yr.generalElectionDate,
 governmentOriginalSosGeneralElectionFilesIndependent:true,
 governmentOfficialLRLActualSenateServiceDirectorySHA256:sha(official),
 governmentOfficialGeneralSOSStateSenateWinnerCount:historical.totals.nonWriteinElectionWinnerCandidates,
 governmentOriginalSOSGeneralStateSenateFileSHA256:historical.source.originalResultSha256,
 governmentOriginalSOSGeneralCandidateLookupSHA256:historical.source.originalCandidateLookupSha256,
 officialCurrentSOSPortal2026DownloadDiscovery:landing,
 officialCurrentSOSCandidateFileLayout:layoutProof,
 currentPublicDownloadEndpointsOnlySource2026:current,
 currentPublicGeneralElectionDownloadLinkCandidates:otherDirect,
 officialHistoricPreElectionCdxIndexChecks:indexEntries,
 independentlyWholeOriginalCDXSha1MatchingHistoricalCandidateFilingPages:verified,
 historicalTrueCandidateFilingWebsiteExportCount:verified.filter(x=>x.originalCandidateSenateFilingExportMatched).length,
 originalHistoricalSenateCampaignWebsiteDenominatorVerified:verified.some(x=>x.originalCandidateSenateFilingExportMatched),
 independentWholeSourceDigestValidationRequired:true,
 originRawPersonalAddressPhoneEmailBytesNotStoredNotPrintedNotUploaded:true,
 historicalSOSFiledCandidateOriginalIsNotSevenFieldPostVoteElectionLookup:true,
 candidateWebsiteFieldPresenceNotCandidateIssueStatementOrOfficialVote:true,
 lackOfArchivedPageNotProofOfNoCandidateWebsite:true,
 originalObservationNotFirstDatePublished:true,
 previous95ServingSenators:95,previousCandidateOwnedSiteCovered92:92,previousOriginalCandidateSiteSelectedSnippets1285:1285,
 newOwnedCandidateSiteQuoteFragments:0,productionDatabaseReadsWrites:0,modelsForecastersSchedulersDeploymentsChanged:0,
 boundedRequests:httpCalls};
const name='senate-864-'+yyyy+'-SOS-original-filed-candidate-export-recovery-report.json';
writeFileSync(join(out,name),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log('ORIGINAL MN SOS HISTORIC WEBSITE FIELD '+JSON.stringify({
 year:yyyy,currentPortalElection2026:landing.homepageExplicitElection2026,
 directOfficialFilingFileLinkCount:allResolved.length,
 downloadLinkRefs:landing.downloadLinks.map(x=>({label:x.label,href:x.href,postbackOnly:x.postbackOnly})),
 nowCurrentOnlyOfficialCandidateFilingShape:current.map(x=>({url:x.url,status:x.status,senateSummary:x.fieldReport})),
 verifiedHistoricWholeOriginalPages:verified.length,verifiedHistoricallyFiledCandidateWebsiteExports:report.historicalTrueCandidateFilingWebsiteExportCount,
 indexStatuses:indexEntries.map(x=>({target:x.originalQueryTarget,status:x.status,validCdxRows:x.trueOriginalCdxRows,wholeVerified:x.originalHistoricWholeBodyVerified,
  error:x.error})),rawSensitiveCandidateRecordRetained:false,originalSosWinnerRosterRehashed:true,productionUse:false},null,2));
