/**
 * Issue #987 / Track D. Read-only historical legislative TEXT crosswalk:
 * HF5247 May 7 House 3rd engrossment, May 7 Senate 1st unofficial engrossment,
 * May 19 official conference report, and independently introduced SF3257.
 *
 * This proves only what the exact retrieved versions contain, NOT what was
 * available at floor voting minute. No private VotePredict data and no
 * ingestion, serving, modeling, or vote-label changes. Government PDFs and
 * HTML exist only transiently in memory/CI temp and are never committed.
 */
import {createHash} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import journal from '../docs/evaluation/senate-media-2024-hawj-hf5247-official-journals-20261012.json' with {type:'json'};
export const VERSION='track-d-hawj-2024-hf5247-actual-versions-bilingual-crosswalk-v1';
export const SOURCES=Object.freeze([
 Object.freeze({id:'hf5247-house-third-engrossment',
  url:'https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/versions/3/pdf/',
  media:'pdf',bill:'HF5247',version:'3rd Engrossment',listedPostedDay:'2024-05-03',htmlDisplayedTimestamp:'2024-05-07 19:29'}),
 Object.freeze({id:'hf5247-first-unofficial-senate-engrossment',
  url:'https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/versions/ue/1/',
  media:'html',bill:'HF5247',version:'1st Unofficial Engrossment',listedPostedDay:'2024-05-07',htmlDisplayedTimestamp:'2024-05-07 17:36'}),
 Object.freeze({id:'hf5247-conference-committee-report-may19',
  url:'https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/versions/ccr/0/pdf/',
  media:'pdf',bill:'HF5247',version:'Conference Committee Report',listedPostedDay:'2024-05-19',htmlDisplayedTimestamp:null}),
 Object.freeze({id:'sf3257-original-2023-proposal',
  url:'https://www.revisor.mn.gov/bills/93/2023/0/SF/3257/versions/0/pdf/',
  media:'pdf',bill:'SF3257',version:'As Introduced',listedPostedDay:'2023-04-12',htmlDisplayedTimestamp:null})
]);
const CONTENT_MAX=32_000_000, TEXT_MAX=25_000_000;
export const FRAGMENTS=Object.freeze([
 Object.freeze({id:'transportation_translation_provision_title',phrase:'driver and vehicle services; materials in a language other than english'}),
 Object.freeze({id:'translated_equivalent_materials',phrase:'equivalent materials'}),
 Object.freeze({id:'qualifying_nonenglish_languages',phrase:'qualifying language'}),
 Object.freeze({id:'dvs_deputy_registrar',phrase:'deputy registrar'}),
 Object.freeze({id:'DVS_driver_license_agent',phrase:"driver's license agent"}),
 Object.freeze({id:'sponsored_bill_exact_SF3257',phrase:'sf 3257'}),
 Object.freeze({id:'original_SF3257_bilingual_services',phrase:'bilingual'})
]);
export function proofAnchor(r=journal){
 const a=r?.priorAuthenticatedPreVoteHistoricWrittenHawjPolicySource,c=r?.counts;
 if(r?.version!=='track-d-2024-hawj-hf5247-primary-official-senate-journal-individual-ballot-receipts-v1'||
  a?.earliestSourceVerifiedCaptureUtc!=='2024-03-24T19:01:09Z'||
  a?.rawHistoricalOriginalHtmlSha256!=='aa6da6e8722e33f2f692ba31bfd6699cf97768e74c788dbdb0786a75a3ad5743'||
  c?.distinctHF5247IndividualRollCallsPersonallyListingHawjYes!==3||
  c?.currentAsOfRelevantBillTextSectionsIndependentlyAuthenticated!==0)throw Error('not the separately verified official Senate roll and original text anchor');
 return {historicalSenator:'Foung Hawj',firstOriginalVerifiedUtc:a.earliestSourceVerifiedCaptureUtc,
  originalHtmlSha256:a.rawHistoricalOriginalHtmlSha256,
  knownOfficialMay7AndMay19Hf5247YesVotes:3,namedStandaloneBills:a.namedProposalTopicBills};
}
export function validateAllowlist(sources=SOURCES){
 if(sources!==SOURCES||sources.length!==4||new Set(sources.map(x=>x.url)).size!==4)throw Error('unknown bill text source set');
 for(const s of sources){
  const u=new URL(s.url);
  if(u.protocol!=='https:'||u.hostname!=='www.revisor.mn.gov'||u.search||u.hash||u.port||u.username||u.password||
   !/^\/bills\/93\/202[34]\/0\/(HF\/5247|SF\/3257)\/versions\/(3\/pdf|ue\/1|ccr\/0\/pdf|0\/pdf)\/$/.test(u.pathname))throw Error('wrong 93rd legislative source exact version');
 }
 return true;
}
function normalize(s){return s.normalize('NFKC').replace(/[\u2018\u2019]/g,"'")
 .replace(/\u00ad/g,'').replace(/\s+/g,' ').trim().toLowerCase();}
function visibleHtml(s){
 return normalize(s.replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(head|script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
  .replace(/<[^>]*>/g,' ')
  .replace(/&(?:nbsp|#160);/gi,' ').replace(/&amp;/gi,'&')
  .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?Number.parseInt(n.slice(1),16):Number(n))));
}
export function inspectText(text,source,htmlMode=false){
 if(typeof text!=='string'||text.length>TEXT_MAX||!SOURCES.includes(source))throw Error('untrusted official bill-source text');
 const normalized=htmlMode?visibleHtml(text):normalize(text);
 const session93=source.media==='pdf'?
   (/a bill for an act|conference committee report/i.test(normalized)):
   (normalized.includes('93rd legislature')&&normalized.includes('2023 - 2024'));
 const billIdentified=source.bill==='HF5247'?
   (/\bh\.?\s*f\.?\s*(?:no\.?\s*)?5247\b/i.test(normalized)):
   (/\bs\.?\s*f\.?\s*(?:no\.?\s*)?3257\b/i.test(normalized));
 const postedDaySourceOnly=source.listedPostedDay;
 const present=FRAGMENTS.map(t=>({id:t.id,shortSourceCuePresent:normalized.includes(t.phrase)}));
 const required=['transportation_translation_provision_title','translated_equivalent_materials','qualifying_nonenglish_languages','dvs_deputy_registrar'];
 const full=required.every(k=>present.some(t=>t.id===k&&t.shortSourceCuePresent));
 return {exactBillAndSessionIdentified:session93&&billIdentified,
  sampledVisibleTextChars:normalized.length,shortSourcePolicyFragments:present,
  allFourSpecificDvsLanguageMarkersInExactDocument:full,
  postedDayFromModernVersionIndexOnly:postedDaySourceOnly,
  headerRenderedTimestampFromModernCurrentPageOnly:source.htmlDisplayedTimestamp,
  publicationClockBeforeRollNotIndependentlyProven:true,
  absentMatchDoesNotEstablishAbsenceOfAllRelatedTransportPolicies:true,
  noIndividualHawjVoteOnThisSpecificSFProven:true};
}
async function bounded(r,s){
 const cap=CONTENT_MAX,header=r.headers.get('content-length');
 if(header!==null&&(!/^\d+$/.test(header)||Number(header)>cap))throw Error('oversize or malformed source length');
 const chunks=[],read=r.body?.getReader();if(!read)throw Error('missing response body');let size=0;
 for(;;){const q=await read.read();if(q.done)break;size+=q.value.byteLength;if(size>cap){await read.cancel().catch(()=>{});throw Error('source cap');}chunks.push(Buffer.from(q.value));}
 if(size<10000)throw Error('unexpectedly short original');
 const b=Buffer.concat(chunks);
 if(s.media==='pdf'&&(!b.subarray(0,5).equals(Buffer.from('%PDF-'))||!b.subarray(-2048).toString('latin1').includes('%%EOF')))throw Error('invalid PDF');
 return b;
}
export async function pdfToTextEphemeral(raw){
 const dir=await mkdtemp(join(tmpdir(),'track-d-bill-text-'));
 try{
  const p=join(dir,'original.pdf');await writeFile(p,raw,{flag:'wx'});
  const pdfInfo=execFileSync('pdfinfo',[p],{encoding:'utf8',timeout:45000,maxBuffer:100000});
  const pages=Number(pdfInfo.match(/^Pages:\s*(\d+)/m)?.[1]);
  if(!Number.isSafeInteger(pages)||pages<1||pages>1500)throw Error('invalid government bill PDF pages');
  const text=execFileSync('pdftotext',['-layout','-enc','UTF-8',p,'-'],{encoding:'utf8',timeout:160000,maxBuffer:TEXT_MAX});
  return {text,pages};
 }finally{await rm(dir,{recursive:true,force:true});}
}
export async function probeOne(s,f=fetch,extract=pdfToTextEphemeral){
 validateAllowlist();
 const row={sourceId:s.id,originalUrl:s.url,docType:s.media,
  originalBillVersion:s.version,listedPostedDate:s.listedPostedDay,
  modernPageDisplayedTimestamp:s.htmlDisplayedTimestamp,
  status:'public_bill_text_unknown',fullResponseSha256:null,rawResponseBytes:null,pdfPages:null,
  exactDocumentFragmentProof:null,fullOriginalTextPersisted:false};
 try{
  const r=await f(s.url,{redirect:'manual',method:'GET',
   headers:{accept:s.media==='pdf'?'application/pdf':'text/html','accept-encoding':'identity','user-agent':'VotePredict/2.0 public-minnesota-legislative-text-crosswalk'},
   signal:AbortSignal.timeout(110000)});
  if(r.status!==200){row.status=r.status>=300&&r.status<400?'original_redirect_unknown':'http_unavailable_unknown';return row;}
  const mime=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(s.media==='pdf'&&!['application/pdf','application/octet-stream'].includes(mime)||s.media==='html'&&mime!=='text/html'){row.status='unexpected_content_type_unknown';return row;}
  const b=await bounded(r,s),sha=createHash('sha256').update(b).digest('hex');
  row.fullResponseSha256=sha;row.rawResponseBytes=b.length;
  let text=b.toString('utf8');
  if(s.media==='pdf'){const result=await extract(b);text=result.text;row.pdfPages=result.pages;}
  row.exactDocumentFragmentProof=inspectText(text,s,s.media==='html');
  row.status=row.exactDocumentFragmentProof.exactBillAndSessionIdentified?'exact_official_bill_version_fetched_sha256_and_text_inspected':'source_identity_mismatch_unknown';
 }catch(e){row.status='original_unavailable_or_parse_unknown';row.failureCategory=String(e?.message||'error').slice(0,105);}
 return row;
}
export async function run(f=fetch,extract=pdfToTextEphemeral){
 const anchor=proofAnchor();const sources=[];
 for(const x of SOURCES)sources.push(await probeOne(x,f,extract));
 const pre=sources.filter(x=>x.docType==='html'),ccr=sources.find(x=>x.sourceId==='hf5247-conference-committee-report-may19'),sf=sources.find(x=>x.sourceId==='sf3257-original-2023-proposal');
 const preComplete=pre.every(x=>x.status==='exact_official_bill_version_fetched_sha256_and_text_inspected');
 const preNoDvs=preComplete&&pre.every(x=>!x.exactDocumentFragmentProof?.allFourSpecificDvsLanguageMarkersInExactDocument);
 const ccrDvs=ccr?.status==='exact_official_bill_version_fetched_sha256_and_text_inspected'&&ccr.exactDocumentFragmentProof?.allFourSpecificDvsLanguageMarkersInExactDocument;
 return {version:VERSION,researchDateLocal:'2026-10-12',historicalAnchor:anchor,
  publicSourceVersionsAttempted:4,
  primaryOfficialBillTextSourcesVerified:sources.filter(x=>x.status==='exact_official_bill_version_fetched_sha256_and_text_inspected').length,
  may7TwoExactDocumentVersionsSuccessfullyReviewedForSpecificDvsLanguage:preComplete,
  specificFullDvsBilingualMaterialProvisionAbsentFromBothExaminedMay7DocumentVersions:preNoDvs,
  specificFullDvsBilingualMaterialProvisionPresentInMay19ConferenceReport:!!ccrDvs,
  exactStandaloneSF3257IntroducedOriginalPdfRetrieved:sf?.status==='exact_official_bill_version_fetched_sha256_and_text_inspected',
  may19ConferenceOriginalClockBeforeActualRollsNotCertified:true,
  datedMay20FinalEngrossmentNotUsableAsEarlierMay19PrevoteProof:true,
  unrelatedOmnibusYeaDoesNotLabelStandaloneSF3257Yea:true,
  noForecastEligibilityOrProductionLabelApproved:true,
  noPrivateVotePredictRowsReviewed:true,noOriginalFullPdfHtmlTextCommitted:true,
  noCollectorModelDbIngestionServingForecastChanges:true,sources};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const at=process.argv.indexOf('--output'),path=process.argv[at+1];
 if(at<0||!/^artifacts\/[a-z0-9._-]+\.json$/i.test(path||''))throw Error('safe public metadata artifact required');
 const out=await run();mkdirSync('artifacts',{recursive:true});writeFileSync(path,JSON.stringify(out,null,2)+'\n');
 console.log('TRACK_D_HF5247_BILINGUAL_POLICY_VERSION_CROSSWALK='+JSON.stringify({
  verified:out.primaryOfficialBillTextSourcesVerified,may7Complete:out.may7TwoExactDocumentVersionsSuccessfullyReviewedForSpecificDvsLanguage,
  may7Absent:out.specificFullDvsBilingualMaterialProvisionAbsentFromBothExaminedMay7DocumentVersions,
  may19CcrPresent:out.specificFullDvsBilingualMaterialProvisionPresentInMay19ConferenceReport,
  sf3257Primary:out.exactStandaloneSF3257IntroducedOriginalPdfRetrieved,
  pages:out.sources.map(x=>({id:x.sourceId,status:x.status,sha256:x.fullResponseSha256,bytes:x.rawResponseBytes,pdfPages:x.pdfPages,
   evidence:x.exactDocumentFragmentProof,problem:x.failureCategory||null}))
 }));
}
