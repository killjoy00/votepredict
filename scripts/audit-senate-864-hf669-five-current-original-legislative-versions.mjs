/**
 * Research-only 93rd Legislature HF669 version-to-vote identity audit.
 * Download entire 2023 Revisor bill text PDF bodies and publish only SHA,
 * page counts, conservative normalized lexical comparison and explicit AS-OF
 * availability gates. Neither publication-date labels nor PDF edits prove
 * which final floor-amended section was in force at the instant of a roll.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const MAXPDF=18_000_000,MAX_TEXT=3_000_000;
const KEYS=['third_engrossment_march07','first_unofficial_march14',
 'second_unofficial_march16','third_unofficial_may22','fourth_engrossment_may23'];
const PATHS=['3','ue/1','ue/2','ue/3','4'];
const CODES=['H0669-3','UEH0669-1','UEH0669-2','UEH0669-3','H0669-4'];
const HEADINGS=['THIRD ENGROSSMENT','FIRST UNOFFICIAL ENGROSSMENT',
 'SECOND UNOFFICIAL ENGROSSMENT','THIRD UNOFFICIAL ENGROSSMENT','FOURTH ENGROSSMENT'];
const sha=x=>createHash('sha256').update(x).digest('hex');
const TERMS=['university of minnesota','public facilities authority','local roads and bridges',
 'nursing home','social security','bond proceeds fund','transportation fund',
 'water infrastructure','housing finance agency','veterans homes'];
const clean=x=>String(x).normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
export function allowOfficialFiveVersionManifest(m){
 if(m?.schema!=='senate-864-2023-hf669-original-floor-versions-asof-candidate-audit-v1'||
  m.issue!==864||m.versionSources?.length!==5||
  m.governmentRecordedSenateDecisions?.length!==2||
  m.sourceTextMayNotBeUsedForEarlierDecisionWithoutAsOfProof!==true||
  m.noDirectProductionWritesDeployServingBacktestFeatureApproval!==true||
  m.originalVersionSignedFloorAmendmentExactIdentityProofPending!==true||
  m.relatedButDistinctLegislativeDecisions?.length!==2)
  throw Error('unapproved 2023 HF669 research provenance or chronology');
 const seen=new Set();
 for(const [i,v] of m.versionSources.entries()){
  const e='https://www.revisor.mn.gov/bills/93/2023/0/HF/669/versions/'+PATHS[i]+'/';
  if(v.id!==KEYS[i]||v.path!==PATHS[i]||v.printedTitle!==HEADINGS[i]||
   v.htmlUrl!==e||v.pdfUrl!==e+'pdf/'||
   seen.has(v.id)||!/^2023-0[35]-\d{2}$/.test(v.listedPostedDate))
   throw Error('unexpected bill, legislature, exact text URL or chronological version');
  seen.add(v.id);
 }
 if(m.versionSources[2].versionPageCurrentPostedAtLocal!=='2023-03-16 04:54 p.m.'||
  m.versionSources[3].versionPageCurrentPostedAtLocal!=='2023-08-16 01:09 p.m.'||
  m.versionSources[4].versionPageCurrentPostedAtLocal!=='2024-03-18 08:09 a.m.'||
  m.versionSources[0].listedPostedDate!=='2023-03-07'||
  m.versionSources[1].listedPostedDate!=='2023-03-14'||
  m.versionSources[2].listedPostedDate!=='2023-03-16'||
  m.versionSources[3].listedPostedDate!=='2023-05-22'||
  m.versionSources[4].listedPostedDate!=='2023-05-23')
  throw Error('current publisher display fields cannot be relabeled historic first-public dates');
 const ev=m.governmentRecordedSenateDecisions;
 if(ev[0].date!=='2023-03-16'||ev[0].yes!==33||ev[0].no!==32||
  ev[1].date!=='2023-05-22'||ev[1].yes!==56||ev[1].no!==11||
  ev.some(x=>x.bill!=='HF669'))throw Error('wrong independently authenticated vote sequence');
 const distinct=m.relatedButDistinctLegislativeDecisions;
 if(distinct[0].bill!=='HF670'||distinct[1].bill!=='HF3342'||
  distinct.some(x=>x.notLegallySameAsHF669!==true))
  throw Error('HF670 / nursing home HF3342 not independent of HF669');
 return true;
}
export function verifyOfficialPageTextExtract(x,version){
 if(typeof x?.text!=='string'||x.text.length<1500||x.text.length>MAX_TEXT||
    !Number.isSafeInteger(x.pages)||x.pages<30||x.pages>300||!KEYS.includes(version.id))
  throw Error('unusable exact original legislative PDF text and pages');
 const normalized=clean(x.text);
 const compact=normalized.replace(/[^a-z0-9]/g,'');
 const code=CODES[KEYS.indexOf(version.id)].toLowerCase().replace(/[^a-z0-9]/g,'');
 if(!compact.includes(code))throw Error('revisor official PDF code does not match exact expected HF669 version');
 if(!/(?:h\s*\.?\s*f\s*\.?\s*(?:no\s*\.?\s*)?669|hf669)/i.test(x.text))
  throw Error('different bill printed in the alleged official PDF');
 const words=(normalized.match(/[a-z0-9]+/g)||[]);
 if(words.length<1500)throw Error('suspiciously empty statutory text');
 const counts=Object.fromEntries(TERMS.map(t=>[t,normalized.split(t).length-1]));
 const phraseCounts={};
 for(const term of TERMS)phraseCounts[term]=counts[term];
 const textHash=sha(Buffer.from(normalized,'utf8'));
 return {versionId:version.id,extractedDocumentCode:CODES[KEYS.indexOf(version.id)],
   normalizedTextSha256:textHash,normalizedTextWords:words.length,
   pageCount:x.pages,
   selectedPolicyTermOccurrencesOnlyNotLegalScope:phraseCounts,
   selectedTermsAbsentAreNotProofOfNoRelatedOutsideBillPolicy:true,
   extractedTextIsNotEarlierAsOfSourcePresence:true,
   normalizedTokens:words};
}
export function lexicalChangeScore(wordsA,wordsB){
 if(!Array.isArray(wordsA)||!Array.isArray(wordsB)||wordsA.length<1500||
  wordsB.length<1500||wordsA.length>300000||wordsB.length>300000)
  throw Error('incorrect multi-page comparison inputs');
 function shingles(a){
  const s=new Set();
  for(let i=0;i+7<a.length;i++)s.add(a.slice(i,i+8).join(' '));
  return s;
 }
 const a=shingles(wordsA),b=shingles(wordsB);
 let overlap=0;for(const x of a)if(b.has(x))overlap++;
 const unique=a.size+b.size-overlap;
 return {eightWordContiguousShingleOverlapCount:overlap,
  eightWordContiguousShingleJaccard:unique?Math.round(10000*overlap/unique)/10000:0,
  versionAShingleCount:a.size,versionBShingleCount:b.size,
  lexicalDistanceIsNotLegalSectionOrFiscalLineItemDelta:true};
}
async function readBoundedPdf(r,cap=MAXPDF){
 if(r.status!==200||!r.body)throw Error('official_pdf_transport_'+r.status);
 const mt=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!['application/pdf','application/octet-stream'].includes(mt))throw Error('official_pdf_mime_not_pdf');
 let n=0,a=[];const stream=r.body.getReader();
 for(;;){const d=await stream.read();if(d.done)break;
  n+=d.value.byteLength;if(n>cap){await stream.cancel().catch(()=>{});throw Error('original_pdf_oversized');}
  a.push(Buffer.from(d.value));
 }
 const bytes=Buffer.concat(a,n);
 if(bytes.length<4000||!bytes.subarray(0,6).toString('latin1').startsWith('%PDF-'))
  throw Error('original_legislative_pdf_magic_or_size_invalid');
 return bytes;
}
export async function extractInMemoryPDF(pdf){
 const {PDFParse}=await import('pdf-parse');
 const parser=new PDFParse({data:pdf});
 try{
  const obj=await parser.getText({lineEnforce:true,cellSeparator:' '});
  if(!Number.isInteger(obj.total)||obj.total<30||obj.total>300||
     !Array.isArray(obj.pages)||obj.pages.length!==obj.total||
     obj.pages.some((p,i)=>p.num!==i+1||typeof p.text!=='string'))
   throw Error('incomplete original PDF page index or extraction');
  const text=obj.pages.map(p=>p.text).join('\f');
  if(text.length>MAX_TEXT)throw Error('extracted original text too large');
  return {pages:obj.total,text};
 }finally{await parser.destroy();}
}
export async function audit(m,fetcher=fetch,extract=extractInMemoryPDF){
 allowOfficialFiveVersionManifest(m);
 const documents=[],texts=new Map();
 for(const v of m.versionSources){
  const rec={id:v.id,versionOfficialUrl:v.htmlUrl,originalPdfUrl:v.pdfUrl,
   sourcePublicAtVersionListDayClaim:v.listedPostedDate,
   currentlyRenderedSourcePagePostedField:v.versionPageCurrentPostedAtLocal,
   historicalFirstPostedUtcVerified:false,validAtMarch16ExactMoment:false,
   validAtMay22ExactMoment:false,
   officialOriginalDownloadedAndParsed:false,
   status:'UNKNOWN_ORIGINAL_VERSION_PDF',
   rawPdfSha256:null,rawPdfBytes:null,originalPages:null,
   normalizedOriginalTextSha256:null,normalizedOriginalTextWords:null,
   selectedPolicyTermOccurrencesOnlyNotLegalScope:null,
   errors:[],sourcePdfOrFullBillTextNotPersisted:true};
  try{
   const resp=await fetcher(v.pdfUrl,{method:'GET',redirect:'manual',
    headers:{accept:'application/pdf','accept-encoding':'identity',
      'user-agent':'VotePredict/2.0 historical_revisor_exact_versions_research'},
    signal:AbortSignal.timeout(65000)});
   const bytes=await readBoundedPdf(resp);
   const info=await extract(bytes);
   const verified=verifyOfficialPageTextExtract(info,v);
   rec.originalPdfSha256=sha(bytes);rec.rawPdfBytes=bytes.length;
   rec.originalPages=verified.pageCount;
   rec.normalizedOriginalTextSha256=verified.normalizedTextSha256;
   rec.normalizedOriginalTextWords=verified.normalizedTextWords;
   rec.selectedPolicyTermOccurrencesOnlyNotLegalScope=verified.selectedPolicyTermOccurrencesOnlyNotLegalScope;
   rec.officialOriginalDownloadedAndParsed=true;
   rec.status='OFFICIAL_CURRENT_REVISOR_PDF_VERSION_IDENTIFIED_FULL_SHA256';
   texts.set(v.id,verified.normalizedTokens);
  }catch(e){rec.status='OFFICIAL_CURRENT_REVISOR_PDF_OR_TEXT_UNAVAILABLE_UNKNOWN';
    rec.errors.push(String(e?.message||e).slice(0,115));}
  documents.push(rec);
 }
 const pairs=[['third_engrossment_march07','first_unofficial_march14'],
  ['first_unofficial_march14','second_unofficial_march16'],
  ['second_unofficial_march16','third_unofficial_may22'],
  ['third_unofficial_may22','fourth_engrossment_may23'],
  ['first_unofficial_march14','third_unofficial_may22']];
 const comparisons=pairs.map(([a,b])=>{
  const fa=documents.find(x=>x.id===a),fb=documents.find(x=>x.id===b);
  const possible=!!(texts.has(a)&&texts.has(b));
  return {from:a,to:b,status:possible?'TWO_OFFICIAL_ORIGINAL_PDF_BODIES_COMPARED':'PDF_UNAVAILABLE_UNKNOWN',
   fromOriginalPages:fa.originalPages,toOriginalPages:fb.originalPages,
   sameNormalizedOriginalTextHash:possible?fa.normalizedOriginalTextSha256===fb.normalizedOriginalTextSha256:null,
   comparativeOriginalPageCountDifference:possible?fb.originalPages-fa.originalPages:null,
   ...(possible?lexicalChangeScore(texts.get(a),texts.get(b)):{eightWordContiguousShingleJaccard:null}),
   sectionAndExactFloorAmendmentReconciliationStillPending:true,
   overlappingBillTitleOrNumberAloneCannotCertifySameLegislativePolicy:true};
 });
 return {schema:'senate-864-2023-hf669-five-full-original-current-revisor-pdf-version-comparison-v1',
  issue:864,versionsRequested:5,versionsOriginalSHA256AndBillIdentityAuthenticated:documents.filter(x=>x.officialOriginalDownloadedAndParsed).length,
  documents,comparisons,
  observations:{
   March16SameDayVersionShownAt1654ButVoteHourUnknown:true,
   May22UnofficialVersionCurrentHtmlHeaderShowsAugust16NotMay22:true,
   May23FourthEngrossmentCurrentHtmlHeaderShowsMarch2024NotMay2023:true,
   listingDateVersusPageHeadingConflictCannotEstablishHistoricalPublicBy:true,
   MarchAndMayFloorEventsHaveDifferentAmendmentHistory:true,
   HF670SeparateCapitalCashBillFromHF669:true,
   HF3342NursingHomeSupportSeparateNegotiatedBillFromHF669:true,
   noExactMomentOfFloorDecisionStatutoryTextIndependentlyProved:true,
   noPreviousDateAsOfModelSourcePromotion:true,
   noBillVoteMemberChoiceOrMotivationInferredFromCurrentVersions:true},
  fullRevisorPdfOrStatutoryTextPersisted:false,
  noProductionWritesModelForecastTrainingServingOrDeployments:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const m=JSON.parse(readFileSync('data/evaluation/senate-864-2023-hf669-five-official-text-versions-asof-research-v1.json','utf8'));
 const out=resolve(process.argv[2]||'/tmp/senate-864-hf669-five-comparative-originals.json');
 const result=await audit(m);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({out,originalDocuments:result.versionsOriginalSHA256AndBillIdentityAuthenticated,
  comparisons:result.comparisons.map(p=>[p.from,p.to,p.comparativeOriginalPageCountDifference,
   p.eightWordContiguousShingleJaccard])}));
}
