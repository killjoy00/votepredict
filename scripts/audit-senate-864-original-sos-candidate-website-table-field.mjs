/**
 * Issue 864: evidence-based original Minnesota SOS pre-election filed
 * candidate "Website" table column for 2020/22 State Senate.
 *
 * Audit observed public SOS WEBSITE CELL, not independently owned Senate
 * campaign site existence. A BLANK cell, even when proven, does NOT mean
 * the candidate lacked a campaign site, nor that the SOS retained an export.
 *
 * Validate exact Wayback whole original SHA1/CDX row and entire HTML SHA256
 * pinned by prior independent original audits; never persist original HTML
 * (which may include private contact information in broader page versions).
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {auditSos2020to2022OriginalGeneralCensus}
 from '../src/evidence/senate-2020-22-official-general-census.js';
import {historicalArchiveSha1Base32}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';

const args=process.argv.slice(2);
const need=k=>{const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),k+' missing');return resolve(args[i+1]);};
const year=Number(args[args.indexOf('--election-year')+1]);
assert.ok(year===2020||year===2022,'Only historical 2020/22 SOS in scope');
const out=need('--out-dir');mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
function input(p,min=30,max=7_000_000){const f=statSync(p);assert.ok(f.isFile()&&f.size>=min&&f.size<=max,'Required original source not found '+p);return readFileSync(p);}
const manifest=JSON.parse(input(resolve('data/evaluation/senate-864-original-sos-website-field-and-retained-records-route-v1.json'),1200).toString());
assert.equal(manifest.issue,864);
assert.equal(manifest.schema,'senate-864-official-sos-preelection-candidate-website-tablefield-and-retained-records-route-v1');
assert.equal(manifest.productionDatabaseReadsWrites,0);
const oss=manifest.electionAndRosterAnchors;
assert.equal(oss.actualServingSenators2021to2025,95);
assert.equal(oss.originalCandidateOwnedSitePeople92,92);
assert.equal(oss.selectedOriginalOwnedSiteIssueResearchSnippets,1285);
const originals=need('--sos-original-dir');
const sos=auditSos2020to2022OriginalGeneralCensus(year,
 input(join(originals,year+'-sos-general-stsenate.response'),1000),
 input(join(originals,year+'-sos-general-cand.response'),1000));
assert.equal(sos.totals.senateDistricts,67);
assert.equal(sos.totals.nonWriteinElectionWinnerCandidates,67);
assert.equal(sos.source.originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence,true);
assert.equal(sos.source.originalResultSha256,oss['sos'+year+'SenateResultsSHA256']);
assert.equal(sos.source.originalCandidateLookupSha256,oss['sos'+year+'CandLookupSHA256']);
const winners=new Map(sos.candidates.filter(c=>c.generalOutcome==='winner').map(c=>[c.district,c.candidateName]));
assert.equal(winners.size,67);

function safeGet(url,max=1_900_000,timeout=19000){
 assert.ok(url.startsWith('https://web.archive.org/'),'Only indexed old original official archive host may be queried');
 return (async()=>{
  try{
   const res=await fetch(url,{headers:{accept:'application/json,text/html,*/*;q=0.5','user-agent':'VotePredict-MN-SOS-864-original-website-field-audit/1.0'},
    signal:AbortSignal.timeout(timeout)});
   const len=Number(res.headers.get('content-length')||0);
   if(len>max)return {status:res.status,body:null,error:'source beyond bounded archive size'};
   const b=Buffer.from(await res.arrayBuffer());
   if(b.length>max)return {status:res.status,body:null,error:'received oversized archive'};
   return {status:res.status,body:b,error:null};
  }catch(e){return {status:null,body:null,error:String(e).slice(0,170)};}
 })();
}
const decode=s=>String(s).replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(m,h,d)=>String.fromCodePoint(parseInt(h||d,h?16:10))).replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const plain=s=>decode(String(s).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const normalized=s=>plain(s).toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function parseRows(raw){
 const rows=[];
 for(const m of raw.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)){
  if(m[0].length>50000)continue;
  const els=[...m[0].matchAll(/<(td|th)\b[^>]*>[\s\S]*?<\/\1>/gi)];
  if(!els.length)continue;
  const cells=els.map(x=>({tag:x[1].toLowerCase(),html:x[0],value:plain(x[0])}));
  rows.push(cells);
 }
 return rows;
}
function campaignUrlFromWebsiteCell(cell){
 if(!cell)return null;
 const direct=[];
 for(const a of cell.html.matchAll(/<a\b([^>]*)>/gi)){
  const h=/\bhref\s*=\s*["']([^"']+)["']/i.exec(a[1])?.[1];
  if(h)direct.push(decode(h));
 }
 if(cell.value&&/^(?:https?:\/\/|www\.)?[a-z\d][a-z\d.-]+\.[a-z]{2,}(?:[\/?#][^\s]*)?$/i.test(cell.value))direct.push(cell.value);
 for(const raw of direct){
  if(raw.length>270||raw.includes('@')||/\s/.test(raw))continue;
  try{const u=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);
   if(!['https:','http:'].includes(u.protocol)||!u.hostname.includes('.')||u.username||u.password)continue;
   if(/\.sos\.(?:mn\.gov|state\.mn\.us)$/.test(u.hostname.toLowerCase()))continue;
   return u.href;
  }catch{}
 }
 return null;
}
function evaluatePage(buf,snapshot){
 const page=buf.toString('utf8');
 const all=parseRows(page);
 // A true website column is identifiable only if the archived ORIGINAL
 // table itself labels it. Do not infer a website column from shape alone.
 const headers=all.filter(c=>c.some(x=>/^(?:candidate name|name of candidate)$/i.test(x.value))
  &&c.some(x=>/^(?:campaign website|website|web site)$/i.test(x.value)));
 const evidenceHeaders=headers.map(c=>({labels:c.map(x=>{
   if(/candidate name/i.test(x.value))return 'candidate name';
   if(/^(?:campaign website|website|web site)$/i.test(x.value))return 'website';
   if(/^party/i.test(x.value))return 'party';
   if(/(?:file|filing) date/i.test(x.value))return 'file date';
   return '(other column)';
  }),cellCount:c.length,nameColumnIndex:c.findIndex(x=>/^(?:candidate name|name of candidate)$/i.test(x.value)),
  websiteColumnIndex:c.findIndex(x=>/^(?:campaign website|website|web site)$/i.test(x.value))}));
 const watched=[];
 const target=manifest.pinnedSnapshots.find(x=>x.id===snapshot.id);
 assert.ok(target);
 for(const person of target.people){
  assert.ok(winners.get(person.officialSosWinnerDistrict)?.toLowerCase().includes(person.surname.toLowerCase()),'Not correct 2020 or 2022 official SOS winner for '+person.surname);
  let rows=all.filter(c=>c.length>=4 && normalized(c[1].value)===normalized(person.originalFiledName));
  assert.equal(rows.length,1,'Exactly one original named candidate row expected for '+person.surname+' got '+rows.length);
  const cells=rows[0];
  const best=evidenceHeaders.find(h=>h.nameColumnIndex===1&&h.cellCount===cells.length);
  const cellIndex=best?.websiteColumnIndex??null;
  const websiteCell=Number.isInteger(cellIndex)&&cellIndex>=0?cells[cellIndex]:null;
  const website=campaignUrlFromWebsiteCell(websiteCell);
  // Additional diagnostic: if table header cannot be aligned, record only
  // source-matched individual *external URL* counts by cell index, not unknown
  // other text which might contain personal fields.
  const externallyLinked= [];
  for(let i=0;i<cells.length;i++){
   const ur=campaignUrlFromWebsiteCell(cells[i]);
   if(ur)externallyLinked.push({columnIndex:i,unclassifiedPublicURL:ur});
  }
  const handler=/<a\b[^>]*href=["']\s*javascript:\s*__doPostBack/i.test(cells[1].html);
  watched.push({
   person:person.officialName,originalFiledCandidateName:person.originalFiledName,
   validatedPostVoteWinner: winners.get(person.officialSosWinnerDistrict),
   validatedGeneralElectionDistrict:person.officialSosWinnerDistrict,
   originalNamedTableRowFound:true,originalRowColumnCount:cells.length,
   originalWebsiteColumnExplicitlyAlignedByArchivedHeader:!!best,
   originalWebsiteColumnIndex:cellIndex,
   originalWebsiteCellVisiblyEmpty:websiteCell?websiteCell.value.length===0:null,
   originalWebsiteCellCharacterCount:websiteCell?.value.length??null,
   originalWebsiteFieldPubliclyDisplayedCandidateURL:website,
   candidateOtherExternalURLRowsNotWebsiteField:externallyLinked.filter(x=>x.columnIndex!==cellIndex),
   originalCandidateDetailTriggerIsASPNetPostback:handler,
   noWebsiteShownInThisArchivedListingDoesNotEstablishNoOwnedWebsite:true,
   filedWebsiteDomainAndCampaignAuthorshipNotProvenByCandidateList:true
  });
 }
 const counts={totalRows:all.length,numberOriginalHeaderRowsWithWebsiteLabel:evidenceHeaders.length,
  headerRows:evidenceHeaders.slice(0,4),
  targetOriginalCandidateRows:watched.length,
  originalNamedTargetRowsWithWebsiteHeaderAligned:watched.filter(x=>x.originalWebsiteColumnExplicitlyAlignedByArchivedHeader).length,
  originalWebsiteFieldShowsURLForTargets:watched.filter(x=>x.originalWebsiteFieldPubliclyDisplayedCandidateURL).length};
 return {page:counts,candidates:watched};
}
const records=[];
for(const target of manifest.pinnedSnapshots.filter(x=>x.electionYear===year)){
 const params=new URLSearchParams({url:target.originalUrl,matchType:'exact',
  from:String(year)+'0101',to:year===2020?'20201102':'20221107',
  output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'120'});
 params.append('filter','statuscode:200');
 const cdxURL='https://web.archive.org/cdx/search/cdx?'+params.toString();
 const ix=await safeGet(cdxURL,1_600_000);
 assert.equal(ix.status,200,'Unavailable original CDX index for '+target.id+' '+ix.error);
 assert.ok(ix.body,'CDX source bytes absent for '+target.id);
 const parsed=JSON.parse(ix.body.toString('utf8'));
 assert.ok(Array.isArray(parsed)&&parsed.length<=121);
 assert.deepEqual(parsed[0],['timestamp','original','mimetype','statuscode','digest','length']);
 const matching=parsed.slice(1).filter(r=>r[0]===target.originalCaptureTimestamp&&r[1]===target.originalUrl&&r[3]==='200'
  &&r[4]===target.originalIndexedCDXSHA1Base32);
 assert.equal(matching.length,1,'Missing original independently indexed dated candidate list '+target.id);
 let html=null,lastError='all replay variants unavailable';
 for(const mode of ['id_','if_','mp_','']){
  const u='https://web.archive.org/web/'+target.originalCaptureTimestamp+mode+'/'+target.originalUrl;
  const r=await safeGet(u);
  if(r.status!==200||!r.body){lastError=r.error||'http '+r.status;continue;}
  if(historicalArchiveSha1Base32(r.body)!==target.originalIndexedCDXSHA1Base32){lastError='Archive wrapper or wrong full original indexed digest';continue;}
  if(sha(r.body)!==target.originalWholeHTMLSHA256){lastError='Whole original HTML SHA256 mismatch';continue;}
  html=r.body;break;
 }
 assert.ok(html,'Original whole source CDX+SHA256 did not replay for '+target.id+': '+lastError);
 const r=evaluatePage(html,target);
 records.push({
  originalSnapId:target.id,year:target.electionYear,archivedUTC:target.originalCaptureTimestamp.replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/,'$1-$2-$3T$4:$5:$6.000Z'),
  wholeOriginalIndexedCDXJSONSha256:sha(ix.body),
  indexedOriginalPageSHA1Base32:historicalArchiveSha1Base32(html),
  wholeOriginalPageHTMLSha256:sha(html),independentlyArchivedSourceUrl:target.originalUrl,
  completeOriginalSourceCryptographicMatch:true,
  ...r
 });
}
assert.equal(records.length,year===2020?1:2);
const report={
 schema:'senate-864-original-sos-website-column-blank-or-displayed-independent-whole-archive-audit-v1',
 issue:864,year,originalSNSOSGeneralElection67DistrictsVerified:true,
 originalSNSOSCandidateWinnersSHA256:sos.source.originalResultSha256,
 originalSNSOSCandidate7ColumnLookupSHA256:sos.source.originalCandidateLookupSha256,
 originalWholeOfficialSenateOnlyPreElectionSnapshotsRehashed:records.length,
 originalSnapshotRowsAndWebsiteCellAudits:records,
 sourceWebsiteBlankInArchivedCandidateRowCannotProveNoCandidateCampaignSite:true,
 originalCandidateWebsiteFromResultsTableNotFull21ColumnFiledExport:true,
 userApprovalRequiredBeforeDataPracticesRequest:true,originalHistoricWebsiteExportStillMissing:true,
 sourceObservationTimeNotOriginalFirstDatePosted:true,
 existing92Of95AuthenticatedCandidateOwnedSitePeopleUnchanged:true,
 existing1285WebsiteResearchExcerptsUnchanged:true,personalContactDataOrOriginalPageNeverPersisted:true,
 productionDatabaseWritesReads:0,trainingForecastAppDeployedChanges:0};
writeFileSync(join(out,'senate-864-original-sos-'+year+'-website-cell-archive-audit-v1.json'),
 JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log('ORIGINAL SOS ARCHIVED PUBLIC CANDIDATE WEBSITE CELL '+JSON.stringify({
 year,wholeOriginalMatches:records.length,officialSOS67DistrictWinners:true,
 originalSiteRows:records.map(x=>({id:x.originalSnapId,websiteHeaders:x.page.headerRows,
  candidates:x.candidates.map(c=>({name:c.originalFiledCandidateName,
   matchedOfficialElectionWinner:c.validatedPostVoteWinner,
   siteCellColumn:c.originalWebsiteColumnIndex,
   websiteCellLabelAndRowMatch:c.originalWebsiteColumnExplicitlyAlignedByArchivedHeader,
   websiteCellBlank:c.originalWebsiteCellVisiblyEmpty,
   siteURL:c.originalWebsiteFieldPubliclyDisplayedCandidateURL,
   otherURLCount:c.candidateOtherExternalURLRowsNotWebsiteField.length,
   detailASPNetPostback:c.originalCandidateDetailTriggerIsASPNetPostback}))})),
  originalCampaignWebsitesAdded:0,noSensitiveOutput:true},null,2));
