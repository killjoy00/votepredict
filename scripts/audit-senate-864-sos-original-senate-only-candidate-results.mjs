/**
 * #864: direct verified original Oct-2020 Minnesota Secretary of State
 * STATE-SENATE-ONLY candidate results page capture, plus 2022 analog.
 * Different from post-vote 7-column cand.txt, which has no website field.
 * Original whole HTML must match indexed CDX SHA1 / pre-election timestamp.
 * Extract only candidate name, state Senate district and website; never
 * expose/store residence, phone, email, cookies, viewstate, or whole page.
 * Archived results with no matched names are NOT a negative census.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,statSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {auditSos2020to2022OriginalGeneralCensus} from '../src/evidence/senate-2020-22-official-general-census.js';
import {historicalArchiveSha1Base32} from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const arg=k=>{let a=process.argv.indexOf(k);assert.ok(a>=0&&process.argv[a+1]&&!process.argv[a+1].startsWith('--'),'Missing '+k);return resolve(process.argv[a+1]);};
const year=Number(process.argv[process.argv.indexOf('--year')+1]);assert.ok(year===2020||year===2022);
const out=arg('--out-dir');mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
function bytes(path,min=50,max=6e6){const st=statSync(path);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'Missing pinned original '+path);return readFileSync(path);}
const seed=JSON.parse(bytes(resolve('data/evaluation/senate-864-sos-official-2020-22-state-senate-only-archived-results-targets-v1.json'),500).toString());
assert.equal(seed.schema,'senate-864-official-sos-2020-2022-original-state-senate-candidate-results-targets-v1');
assert.equal(seed.issue,864);
assert.equal(seed.productionDBReadsWrites,0);
const t=seed.years[String(year)],proof=JSON.parse(bytes(resolve('data/evaluation/senate-864-official-sos-historical-filed-website-export-recovery-targets-v1.json'),1000).toString());
const originals=arg('--sos-original-dir');
const official=auditSos2020to2022OriginalGeneralCensus(year,
 bytes(join(originals,year+'-sos-general-stsenate.response'),1000),
 bytes(join(originals,year+'-sos-general-cand.response'),1000));
assert.equal(official.totals.senateDistricts,67);
assert.equal(official.totals.nonWriteinElectionWinnerCandidates,67);
assert.equal(official.source.originalResultSha256,proof.previousOfficialOriginalElectionWinners['originalSOS'+year+'StsenateSha256']);
assert.equal(official.source.originalCandidateLookupSha256,proof.previousOfficialOriginalElectionWinners['originalSOS'+year+'CandidateLookupSha256']);
const wishes=year===2020?[['Wiger','43'],['Tomassoni','6'],['Bakk','3']]:[['Dziedzic','60'],['Weber','21']];
const winnerByDistrict=new Map(official.candidates.filter(x=>x.generalOutcome==='winner').map(x=>[x.district,x.candidateName]));
for(const [n,d] of wishes)assert.ok(winnerByDistrict.get(d)?.toLowerCase().includes(n.toLowerCase()),'Invalid historical official Senate winner for '+n);
const dedup=new Set();
const qResults=[];
let numRequests=0;
async function get(u,timeout=14500,max=1_900_000){
 numRequests++;
 assert.ok(u.startsWith('https://web.archive.org/'),'Strictly archive-only source');
 try{
  const r=await fetch(u,{headers:{accept:'application/json,text/html;q=0.9,*/*;q=0.2','user-agent':'VotePredictMinnesotaSenateOriginalSOSResearch/1.0'},signal:AbortSignal.timeout(timeout)});
  const b=Buffer.from(await r.arrayBuffer());
  if(b.length>max)return {status:r.status,body:null,error:'Page too large for safe candidate filing audit'};
  return {status:r.status,body:b,error:null};
 }catch(e){return {status:null,body:null,error:String(e).slice(0,180)};}
}
const iso=s=>s.replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/,'$1-$2-$3T$4:$5:$6.000Z');
const plain=s=>String(s).replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'')
.replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim();
const tidyUrl=s=>{
 if(!s||s.length>320||s.includes('@')||/\s/.test(s))return null;
 try{const u=new URL(/^https?:\/\//i.test(s)?s:'https://'+s);
  return ['https:','http:'].includes(u.protocol)&&u.hostname.includes('.')&&!u.username&&!u.password?u.href:null;}
 catch{return null;}
};
function candidateRows(html){
 const matched=[],allCellsHistogram={},targetMentionedInFullPage={};
 const originalText=plain(html);
 for(const [surname] of wishes)targetMentionedInFullPage[surname]=new RegExp('\\b'+surname+'\\b','i').test(originalText);
 let actualTDrows=0,candidateNameCells=0;
 for(const hit of html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)){
  const row=hit[0];if(row.length>45000)continue;
  const cells=[...row.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/gi)].map(x=>x[0]);
  if(cells.length<2)continue;
  actualTDrows++;
  allCellsHistogram[String(cells.length)]=(allCellsHistogram[String(cells.length)]||0)+1;
  const textCells=cells.map(c=>plain(c));
  for(const [surname,d] of wishes){
   const nameCellIndexes=textCells.flatMap((v,i)=>new RegExp('\\b'+surname+'\\b','i').test(v)&&v.length<=230?[i]:[]);
   if(!nameCellIndexes.length)continue;
   candidateNameCells++;
   // Never use arbitrary row links as campaign websites, especially
   // State SOS profile links. Only a explicitly website-labeled anchor
   // on THE SAME ORIGINAL ROW can be considered a preliminary lead.
   const siteAnchors=[];
   for(let i=0;i<cells.length;i++){
    for(const tag of cells[i].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
     const label=plain(tag[2]);
     if(!/(candidate|campaign|official)\s*website|\bwebsite\b/i.test(label))continue;
     const href=/\bhref=["']([^"']+)["']/i.exec(tag[1])?.[1]||'';
     const url=tidyUrl(href);
     if(url&&!/\.sos\.(mn\.gov|state\.mn\.us)\/?/i.test(url))siteAnchors.push({originalTableCellIndex:i,websiteLabel:label.slice(0,50),website:url});
    }
   }
   // Separately characterize any original field that is actually labeled
   // Campaign Website, and do not confuse it with candidate district.
   const originalTextSenateDistrict=textCells.flatMap(v=>{
    const m=/State\s+Senat(?:e|or)\s+District\s+0*(\d{1,2})/i.exec(v);
    return m?[String(Number(m[1]))]:[];
   })[0]||null;
   const personName=nameCellIndexes.map(i=>textCells[i]).find(x=>x.length<=115&&!x.includes('@'))||null;
   matched.push({
    searchedActualSenatorSurname:surname,officialGeneralWinnerDistrict:d,
    officialGeneralWinnerName:winnerByDistrict.get(d),
    originalNamedCandidateShortCellText:personName?.slice(0,115)||null,
    originalTableCellIndexesContainingSurname:nameCellIndexes,
    originalSameRowExplicitSenateDistrict:originalTextSenateDistrict,
    originalSameRowExplicitWebsiteLinks:siteAnchors.slice(0,5),
    originalRawHtmlDoesNotProvideVerifiedCurrentCampaignOwnership:true,
    validNamedPersonPlusWebsiteAndDistrictStrictlyMatched:siteAnchors.length>0&&originalTextSenateDistrict===d,
    originalFullElectionCensusUnproven:true
   });
  }
 }
 return {matchedWinnerRows:matched.slice(0,40),htmlRowElements:actualTDrows,
  originalTableCellCountHistogram:allCellsHistogram,
  originalDocumentContainsTargetSurnames:targetMentionedInFullPage,
  originalNamedCandidateRowHits:candidateNameCells,
  textContainsSenateOffice:/(State Senator District|State Senate District|Senate)/i.test(html),
  sourceIsRawFullCandidateFiledExport:false};
}
for(const target of t.targets){
 assert.ok(/^https:\/\/candidates\.sos\.(?:state\.mn\.us|mn\.gov)\/CandidateFilingResults\.aspx/i.test(target));
 const params=new URLSearchParams({url:target,matchType:'exact',from:String(year)+'0101',to:t.to,
  output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'100'});
 params.append('filter','statuscode:200');params.append('filter','mimetype:text/html');
 const indexUrl='https://web.archive.org/cdx/search/cdx?'+params.toString();
 const index=await get(indexUrl,16500,1_500_000);
 const check={target,indexUrl,indexHttpStatus:index.status,indexWholeOriginalBodySHA256:index.body?sha(index.body):null,
  indexActualCdxRows:0,indexIsOriginalCdx:false,originalVerifiedHtmlSnapshots:[],issue:index.error,
  archiveFailureDoesNotProveNoCandidateWebsite:true};
 qResults.push(check);
 let rows;
 try{
  if(index.status!==200||!index.body)throw Error('Archive index status '+index.status);
  const d=JSON.parse(index.body.toString('utf8'));
  assert.ok(Array.isArray(d)&&d.length&&d.length<=101);
  assert.deepEqual(d[0],['timestamp','original','mimetype','statuscode','digest','length']);
  rows=d.slice(1);check.indexIsOriginalCdx=true;check.indexActualCdxRows=rows.length;
 }catch(e){check.issue='Provider non-CDX or unavailable original index '+String(e).slice(0,200);continue;}
 rows=rows.filter(r=>/^\d{14}$/.test(r?.[0]||'')&&r[0]<(t.to+'235959')
  &&r[3]==='200'&&r[2]==='text/html'&&/^[A-Z2-7]{32}$/.test(r[4]||''))
  .sort((a,b)=>b[0].localeCompare(a[0]));
 for(const row of rows){
  if(check.originalVerifiedHtmlSnapshots.length>=3)break;
  const tag=row[0]+'|'+row[4];if(dedup.has(tag))continue;dedup.add(tag);
  let original=null;
  for(const suffix of ['id_','if_','mp_']){
   const a='https://web.archive.org/web/'+row[0]+suffix+'/'+row[1];
   const r=await get(a,15000,1_600_000);
   if(r.status!==200||!r.body||r.body.length<120)continue;
   if(historicalArchiveSha1Base32(r.body)!==row[4])continue;
   original=r.body;break;
  }
  if(!original)continue;
  const filtered=candidateRows(original.toString('utf8'));
  check.originalVerifiedHtmlSnapshots.push({
   originalUrl:row[1],originalCapturedUtc:iso(row[0]),wholeOriginalSHA256:sha(original),
   indexedSourceSHA1Base32:row[4],wholeOriginalIndexSHA256:check.indexWholeOriginalBodySHA256,
   originalSenateOfficeSpecificUrlQueryConfirmed:/[?&]senate=True(?:&|$)/i.test(row[1]),
   ...filtered,originalFullHtmlBytesNotRetained:true});
 }
}
const report={schema:'senate-864-official-sos-original-2020-22-senate-only-candidate-website-snapshot-audit-v1',issue:864,
 year,originalSOS67SenateDistrictWinnersRehashed:true,
 postvoteOriginalSenateResultsSHA256:official.source.originalResultSha256,postvoteCandidateLookupSHA256:official.source.originalCandidateLookupSha256,
 verifiedPreGeneralElectionOriginalCandidateResultsWholeHtmlPages:qResults.reduce((n,x)=>n+x.originalVerifiedHtmlSnapshots.length,0),
 originalNamedWinnerSameTableRowWebsiteCount:qResults.reduce((n,x)=>n+x.originalVerifiedHtmlSnapshots.reduce((s,p)=>s+p.matchedWinnerRows.filter(k=>k.originalSameTableRowWebsite).length,0),0),
 sourceOriginalWebsitesNotCandidateIssueStatements:true,original21ColumnFiledWebsiteBulkExportRecovered:false,
 lacksOriginalHistoricalWebsiteOrIndexNotMissingCandidatePlatform:true,sitePeopleCoverageBeforeAfter92:true,
 siteOriginalSelectedExcerptsBeforeAfter1285:true,
 queries:qResults,siteQuotesAutoAccepted:0,productionDatabaseReadsWrites:0,modelTrainingDeploymentOrPredictionChanges:0,
 requests:numRequests,rawOriginalPersonalDataStored:false};
writeFileSync(join(out,'senate-864-original-sos-'+year+'-senate-only-candidate-results-archive-evidence.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log('STRICT ORIGINAL HISTORIC SOS SENATE ONLY '+JSON.stringify({year,
  officialOriginalSOS67SenateWinners:true,
  targets:qResults.map(x=>({originalUrl:x.target,wholeCdxRows:x.indexActualCdxRows,indexStatus:x.indexHttpStatus,
   verifiedSourceBodies:x.originalVerifiedHtmlSnapshots.map(y=>({captured:y.originalCapturedUtc,wholeSha256:y.wholeOriginalSHA256,
    indexedSHA1:y.indexedSourceSHA1Base32,namedCandidateRows:y.matchedWinnerRows,originalTableRowCount:y.htmlRowElements,
    pageActuallyMentionsSenate:y.textContainsSenateOffice})),error:x.issue})),
  candidateSiteShortResearchRowsAdded:0,rawSensitiveOriginalBodiesRetained:false},null,2));
