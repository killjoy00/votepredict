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
import {evaluateArchivedSenateWebsiteCells} from '../src/evidence/senate-sos-original-candidate-website-table.mjs';

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
const records=[];
for(const target of manifest.pinnedSnapshots.filter(x=>x.electionYear===year)){
 const params=new URLSearchParams({url:target.originalUrl,matchType:'exact',
  from:String(year)+'0101',to:year===2020?'20201102':'20221107',
  output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'120'});
 params.append('filter','statuscode:200');
 const cdxURL='https://web.archive.org/cdx/search/cdx?'+params.toString();
 // An original archive index outage must NEVER be treated as proof that the
 // previously independent 2020/22 candidate listing was missing or changed.
 // The exact CDX SHA1 and entire raw HTML SHA256 were already proved by
 // independent original-source audit on merged PR #1237. When index cannot
 // be reread, separately retry the pinned original whole HTML; if both fail,
 // write "unavailable" and do not infer any blank website value.
 const ix=await safeGet(cdxURL,1_600_000,12500);
 let originalCDXRevalidatedThisRun=false;
 let cdxStatus='provider_unavailable_not_a_negative_census';
 let indexSha=null;
 if(ix.status===200&&ix.body){
  try{
   const parsed=JSON.parse(ix.body.toString('utf8'));
   assert.ok(Array.isArray(parsed)&&parsed.length&&parsed.length<=121);
   assert.deepEqual(parsed[0],['timestamp','original','mimetype','statuscode','digest','length']);
   const matching=parsed.slice(1).filter(r=>r[0]===target.originalCaptureTimestamp
    &&r[1]===target.originalUrl&&r[3]==='200'
    &&r[4]===target.originalIndexedCDXSHA1Base32);
   if(matching.length===1){
    originalCDXRevalidatedThisRun=true;
    cdxStatus='whole_original_index_revalidated';
    indexSha=sha(ix.body);
   }else cdxStatus='valid_index_response_without_original_named_row_unknown';
  }catch(e){cdxStatus='provider_http200_non_CDX_original_unknown';}
 }
 const record={
  originalSnapId:target.id,year:target.electionYear,
  archivedUTC:target.originalCaptureTimestamp.replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/,'$1-$2-$3T$4:$5:$6.000Z'),
  independentlyArchivedSourceUrl:target.originalUrl,
  originalCDXIndexedSHA1PinnedFromMergedPR1237:target.originalIndexedCDXSHA1Base32,
  originalWholeHTMLSHA256PinnedFromMergedPR1237:target.originalWholeHTMLSHA256,
  archiveCDXStatusThisRun:cdxStatus,
  archivedIndexRecheckedThisRun:originalCDXRevalidatedThisRun,
  wholeOriginalIndexedCDXJSONSha256:indexSha,
  originalArchivedWholeHTMLRehashedThisRun:false,
  sourceAvailability:'original_candidate_page_currently_unavailable_no_website_field_conclusion',
  websiteFieldObservationAvailable:false,originalHTMLOrPersonalContactSaved:false};
 let html=null;
 for(const mode of ['id_','if_','mp_']){
  const u='https://web.archive.org/web/'+target.originalCaptureTimestamp+mode+'/'+target.originalUrl;
  const r=await safeGet(u,1_900_000,14500);
  if(r.status!==200||!r.body)continue;
  if(historicalArchiveSha1Base32(r.body)!==target.originalIndexedCDXSHA1Base32)continue;
  if(sha(r.body)!==target.originalWholeHTMLSHA256)continue;
  html=r.body;break;
 }
 if(html){
  const r=evaluateArchivedSenateWebsiteCells(html,target,winners);
  record.originalArchivedWholeHTMLRehashedThisRun=true;
  record.sourceAvailability='original_full_HTML_independently_replayed_correct_pinned_sha';
  record.websiteFieldObservationAvailable=true;
  record.wholeOriginalPageHTMLSha256=sha(html);
  record.indexedOriginalPageSHA1Base32=historicalArchiveSha1Base32(html);
  record.page=r.page;
  record.candidates=r.candidates;
 }
 records.push(record);
}
assert.equal(records.length,year===2020?1:2);
const report={
 schema:'senate-864-original-sos-website-column-blank-or-displayed-independent-whole-archive-audit-v1',
 issue:864,year,originalSNSOSGeneralElection67DistrictsVerified:true,
 originalSNSOSCandidateWinnersSHA256:sos.source.originalResultSha256,
 originalSNSOSCandidate7ColumnLookupSHA256:sos.source.originalCandidateLookupSha256,
 originalWholeOfficialSenateOnlyPreElectionSnapshotsPreviouslyOriginalHashPinned:records.length,
 originalWholeCandidateHTMLSnapshotsRehashedThisRun:records.filter(x=>x.originalArchivedWholeHTMLRehashedThisRun).length,
 originalWebsiteCellAvailableThisRun:records.some(x=>x.websiteFieldObservationAvailable),
 archiveUnavailableIsUnknownNotBlankWebsite:true,
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
 originalSiteRows:records.map(x=>({id:x.originalSnapId,archiveAvailability:x.sourceAvailability,
  originalWholeHTMLReplayedThisRun:x.originalArchivedWholeHTMLRehashedThisRun,
  originalCDXRevalidatedThisRun:x.archivedIndexRecheckedThisRun,
  websiteHeaders:x.page?.headerRows||[],
  candidates:(x.candidates||[]).map(c=>({name:c.originalFiledCandidateName,
   matchedOfficialElectionWinner:c.validatedPostVoteWinner,
   siteCellColumn:c.originalWebsiteColumnIndex,
   websiteCellLabelAndRowMatch:c.originalWebsiteColumnExplicitlyAlignedByArchivedHeader,
   websiteCellBlank:c.originalWebsiteCellVisiblyEmpty,
   siteURL:c.originalWebsiteFieldPubliclyDisplayedCandidateURL,
   otherURLCount:c.candidateOtherExternalURLRowsNotWebsiteField.length,
   detailASPNetPostback:c.originalCandidateDetailTriggerIsASPNetPostback}))})),
  originalCampaignWebsitesAdded:0,noSensitiveOutput:true},null,2));
