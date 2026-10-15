/**
 * #864 source-only follow-up. NINE V20 exact PDF identity/fetch holds
 * and FOUR official 2022 amendments beyond original 3-version cap.
 * Original official signed PDFs only, ephemeral bytes; output metadata only.
 * This cannot establish report legal filing obligations, amounts or historical public-by.
 */
import{readFileSync}from'node:fs';
import{pathToFileURL}from'node:url';
import{
 chooseActual38ServingSenatorsIn2021And2022,
 independentlyReplayOriginal268AndAttach2022CfbDistricts,
 originalHeader
}from'./acquire-cfb-864-38-served-2021-22-original-amended-yearend-pdfs-v20.mjs';
import{fetchCfbCandidateHistoricalReportReferenceSnapshot}from'../src/evidence/cfb-candidate-report-history.js';
import{fetchCfbReportViewerText}from'../src/evidence/cfb-current-report-acquisition.js';
export const SCHEMA='cfb-864-nine-held-four-overflow-original-pdf-probe-v22';
const V20='docs/evaluation/source-proof/cfb-2021-22-38-actually-served-132-yearend-versions-v20.psv';
const VIEWER='docs/evaluation/source-proof/cfb-2021-22-38-actually-served-original-viewer-yearend-coverage-v20.psv';
const HASH=/^[a-f0-9]{64}$/;
const EXPECTED_HELD=new Set([
'17140:21:pcc:YE:0:0','17140:22:pcc:YE:0:0',
'16931:21:pcc:YE:0:0','18004:21:pcc:YE:0:0',
'17929:21:pcc:YE:0:0','17929:22:pcc:YE:0:0','17929:22:pcc:YE:0:1',
'17347:22:pcc:YE:0:0','18488:21:pcc:YE:0:1']);
const EXPECTED_EXTRA=new Set([
'17021:22:pcc:YE:0:3','17021:22:pcc:YE:0:4',
'18500:22:pcc:YE:0:3','17316:22:pcc:YE:0:3']);
const PREFIX='CFB_864_9_HOLDS_4_AMENDMENTS_V22 ';
const errorKind=e=>{
 const s=e instanceof Error?e.message:String(e);
 return /timeout|abort/i.test(s)?'original_pdf_timeout_hold':
 /HTTP [45]/i.test(s)?'original_pdf_http_hold':
 /pdf|text|parse|report|source|viewer/i.test(s)?'original_pdf_source_or_text_hold':
 'original_pdf_unclassified_hold';
};
const idOf=r=>[r.registrationNumber,r.year,r.type,r.period,r.se,String(r.amendment)].join(':');
const date=s=>{
 const m=String(s??'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 if(!m)return null;
 const d=new Date(Date.UTC(+m[3],+m[1]-1,+m[2]));
 return d.getUTCFullYear()===+m[3]&&d.getUTCMonth()===+m[1]-1&&d.getUTCDate()===+m[2]?d.toISOString().slice(0,10):null;
};
function safePdfStructure(text){
 const head=String(text??'').replace(/\u0000/g,'').replace(/\s+/g,' ').slice(0,6500);
 const period=head.match(/Period\s+Covered\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
 const header={
  textCharCount:Math.min(String(text??'').length,250000),
  hasOfficialPrincipalReceiptAndExpenditureHeading:/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(head),
  hasYearEndWord:/year[\s-]*end/i.test(head),
  hasRegistrationLabel:/Registration\s+Number\s*:/i.test(head),
  hasSenateDistrictLabel:/Senat(?:e|or)\s+District/i.test(head),
  containsPeriodCoveredLabel:/Period\s+Covered/i.test(head),
  extractedPeriodStartOn:period?date(period[1]):null,
  extractedPeriodEndOn:period?date(period[2]):null,
  hasBoardReceiptStamp:/Received\s+by\s+the\s+Board/i.test(head),
  documentLooksAmended:/amend(?:ed|ment)/i.test(head),
  documentLooksTermination:/terminat(?:ion|ed|ing)/i.test(head)
 };
 return header;
}
export function originalV20Sources(){
 const rows=readFileSync(V20,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 const v=readFileSync(VIEWER,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 if(rows.length!==132||rows.some(x=>x.length!==22)||v.length!==38||v.some(x=>x.length!==19))
  throw Error('V20 original exact PDF source and report viewer proof size drift');
 const byId=new Map(rows.map(x=>[x[0],x])),viewers=new Map(v.map(x=>[x[1],x]));
 if(byId.size!==132||viewers.size!==38)throw Error('Duplicate original CFB candidate registration or report source');
 const holds=rows.filter(x=>x[9]==='source_identity_hold'||x[9]==='source_fetch_hold');
 if(holds.length!==9||holds.some(x=>!EXPECTED_HELD.has(x[0]))
   ||EXPECTED_HELD.size!==9||rows.some(x=>x[19]!=='-'))
  throw Error('Exactly nine held original source PDF version IDs were not preserved');
 for(const x of rows){
  const k=viewers.get(x[4]);
  if(!k||k[0]!==x[2]||k[3]!==x[17]
    ||!HASH.test(x[17])||!HASH.test(k[2])
    ||!['21','22'].includes(x[0].split(':')[1]))
   throw Error('Original CFB 38 Senate committee viewer SHA/pinned registration mismatch');
 }
 return{byId,viewers,holds};
}
export function targetedYearEndVersionIds(reg,raw,source){
 const snapshot=source.viewers.get(reg);
 if(!snapshot||raw.registrationNumber!==reg||raw.segmentEndYear!==2022
  ||raw.responseSha256!==snapshot[3]||raw.sourceUrl!==
   'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+reg+'/2022/')
  throw Error('Changed original CFB source viewer response identity (HOLD)');
 const existing=raw.references.filter(x=>x.registrationNumber===reg
  &&x.type==='pcc'&&x.period==='YE'&&x.se==='0'&&['21','22'].includes(x.year)
  &&Number.isInteger(x.amendment)&&x.amendment>=0&&x.amendment<=99);
 const ids=new Set(existing.map(idOf));
 if(ids.size!==existing.length)throw Error('Duplicate report viewer version ID');
 const intended=[...EXPECTED_HELD,...EXPECTED_EXTRA].filter(x=>x.startsWith(reg+':'));
 const target=intended.filter(x=>ids.has(x));
 const absent=intended.filter(x=>!ids.has(x));
 return{target:existing.filter(x=>target.includes(idOf(x))),absent,
  viewerResponseSha256:raw.responseSha256,
  all2021and2022YearEndVersionReferences:existing.length};
}
function validatePdfRecord(t,ref,pdf,old,kind,viewers){
 const id=idOf(ref),source=originalHeader(t,ref,pdf,viewers[3]);
 const sameOld=old?source.sourcePdfSha256===old[10]&&String(source.sourcePdfBytes)===old[11]:null;
 const sourceHeader=pdf?safePdfStructure(pdf.text):null;
 const parsed=source.sourceStatus==='original_or_amended_pdf_source_binary_and_firstpage_authenticated_unclassified';
 const parent=old?.[7]==='0'?old:null;
 const storedOriginal=originalV20Sources().byId.get([t.reg,ref.year,'pcc','YE','0','0'].join(':'));
 const parentAuthenticated=storedOriginal?.[9]==='authenticated_original_pdf';
 const amendmentChronology=parsed&&ref.amendment>0&&parentAuthenticated
   &&source.boardReceivedOn>=storedOriginal[14];
 const known=old!==undefined;
 const eligible=parsed&&(ref.amendment===0||amendmentChronology)
   &&(!known||sameOld===true);
 let alias=null;
 if(eligible&&ref.amendment>0){
  const all=readFileSync(V20,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
  const same=all.find(x=>x[4]===t.reg&&x[1]===String(2000+Number(ref.year))
   &&x[10]===source.sourcePdfSha256&&x[9].startsWith('authenticated_'));
  if(same)alias=same[0];
 }
 return{
  versionId:id,person:t.officialSenator,registration:t.reg,referenceKind:kind,
  officialResponseSha256:viewers[3],sourceFullPdfSha256:source.sourcePdfSha256,
  sourcePdfBytes:source.sourcePdfBytes,
  previousV20PdfExactHashAndSizeMatch:sameOld,
  originalFirstPageStrictAuthenticated:parsed,
  originalPeriodStartOn:parsed?source.reportPeriodStartOn:null,
  originalPeriodEndOn:parsed?source.reportPeriodEndOn:null,
  originalBoardReceiptOn:parsed?source.boardReceivedOn:null,
  conservativeLegalNotBeforeOn:eligible?source.conservativePossibleReleaseNotBeforeOn:null,
  sourceOriginalParentAuthenticated:ref.amendment===0?null:parentAuthenticated,
  originalAmendmentReceiptChronologyVerified:ref.amendment===0?null:amendmentChronology,
  sameBinaryAlreadyAuthenticatedOfficialVersion:alias,
  safeHeaderStructure:sourceHeader,
  sourceStatus:eligible?(alias?'alias_of_prior_original_pdf':'candidate_authenticated_full_original_pdf_source_needs_repeated_sha_pin')
    :!parsed?'firstpage_document_identity_period_or_receipt_hold'
    :known&&sameOld!==true?'original_pdf_byte_identity_changed_hold'
    :'amendment_parent_or_chronology_hold',
  historicalExactPdfPublicByOn:null
 };
}
export function deriveBoundedTargetTasks(targets,sources,lookup){
 if(targets.length!==38||sources.holds.length!==9)
  throw Error('Only original 38 actual-serving principal lookup authorized');
 const missing=[],selected=[];
 for(const t of targets){
  if(![...EXPECTED_HELD,...EXPECTED_EXTRA].some(k=>k.startsWith(t.reg+':')))continue;
  const api=lookup.get(t.reg);
  if(!api){missing.push({person:t.officialSenator,registration:t.reg,sourceStatus:'original_viewer_fetch_hold'});continue}
  try{
   const x=targetedYearEndVersionIds(t.reg,api,sources);
   selected.push(...x.target.map(ref=>({t,ref,old:sources.byId.get(idOf(ref)),viewer:sources.viewers.get(t.reg)})));
   missing.push(...x.absent.map(id=>({id,registration:t.reg,sourceStatus:'exact_version_not_in_current_source_viewer_hold'})));
  }catch{
   missing.push({person:t.officialSenator,registration:t.reg,sourceStatus:'source_viewer_sha_or_shape_drift_hold'});
  }
 }
 return{selected,missing};
}
export async function recoverNineHeldFourAmendments(){
 const sources=originalV20Sources();
 const targets=independentlyReplayOriginal268AndAttach2022CfbDistricts(
  chooseActual38ServingSenatorsIn2021And2022());
 const regs=[...new Set([...EXPECTED_HELD,...EXPECTED_EXTRA].map(x=>x.split(':')[0]))].sort();
 const lookup=new Map(),sourceErrors=[];
 for(const reg of regs){
  try{lookup.set(reg,await fetchCfbCandidateHistoricalReportReferenceSnapshot(reg,2022))}
  catch(e){sourceErrors.push({registration:reg,kind:errorKind(e)})}
 }
 const plan=deriveBoundedTargetTasks(targets,sources,lookup);
 const versions=[];
 for(const task of plan.selected){
  const {t,ref,old,viewer}=task;
  try{
   const pdf=await fetchCfbReportViewerText(ref,{
    method:'POST',referer:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+t.reg+'/2022/',
    searchType:'Candidate'});
   versions.push(validatePdfRecord(t,ref,pdf,old,old?'prior_version_hold':'unselected_amendment',viewer));
  }catch(e){
   versions.push({versionId:idOf(ref),person:t.officialSenator,registration:t.reg,
    referenceKind:old?'prior_version_hold':'unselected_amendment',
    originalOfficialFetchFailure:errorKind(e),sourceStatus:'original_full_pdf_fetch_hold',
    historicalExactPdfPublicByOn:null});
  }
 }
 if(versions.length+plan.missing.filter(x=>x.id).length+sourceErrors.length>15)
  throw Error('Original exact source bounded version/committee scope exceeded');
 return{schema:SCHEMA,reportedScope:'nine preserved V20 holds and four previously capped official 2022 amendment IDs',
  expectedVersionIds:13,selectedOfficialVersionIds:versions.length,
  originalPdfStrictCandidateAuthentication:versions.filter(x=>x.sourceStatus==='candidate_authenticated_full_original_pdf_source_needs_repeated_sha_pin').length,
  preservedSameBinaryAliases:versions.filter(x=>x.sourceStatus==='alias_of_prior_original_pdf').length,
  heldPdfOrViewerVersions:versions.filter(x=>x.sourceStatus.endsWith('hold')).length+plan.missing.filter(x=>x.id).length,
  sourceErrors,exactVersionNotListedOrChangedViewer:plan.missing,
  reportVersions:versions,
  historicPublicByVersionsProven:0,legallyOwedReportDenominator:null,
  originalAll268PageArchiveShaReplayRequired:true,
  noPrivateTransactionsDonorsOrOriginalPdfBodyPublished:true,
  noProductionOrModelWrites:true
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Fixed original source IDs only');
 const output=JSON.stringify(await recoverNineHeldFourAmendments());
 if(output.length>21000||/donorName|vendorName|rawReportPdf|%PDF-|privateDatabase/.test(output))
  throw Error('Unsafe original PDF source output (metadata only)');
 console.log(PREFIX+output);
}
