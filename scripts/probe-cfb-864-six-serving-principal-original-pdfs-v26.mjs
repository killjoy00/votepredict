/**
 * #864 original government candidate reports for six serving senators not yet
 * in the 434-version SHA-authentic source PDF panel. Source-only, read-only.
 * Five require explicit legal-name / nickname identity proof; a same-district
 * original registration is a LEAD, not a verified legal person equivalence.
 * One Doron Clark 2025 special-election senator has exact CFB candidate name.
 * Printed header and original Board date only; no bulk donation or owed reports.
 */
import{readFileSync}from'node:fs';
import{pathToFileURL}from'node:url';
import{parsePermanent57RegistrationLeadPsv,verifyPinned57AgainstOriginalSourceCheckpoint}
 from'./audit-cfb-864-57-actual-serving-candidate-registration-leads-v17.mjs';
import{verify434OriginalCfbSources}from'./audit-cfb-864-434-exact-report-versions-475-committee-years-v24.mjs';
import{fetchCfbCandidateHistoricalReportReferenceSnapshot}from'../src/evidence/cfb-candidate-report-history.js';
import{fetchCfbReportViewerText}from'../src/evidence/cfb-current-report-acquisition.js';
export const SCHEMA='cfb-864-six-uncovered-person-report-full-PDF-original-source-probe-v26';
const REG=Object.freeze({
 'Bill G. Ingebrigtsen':['16311','ALIAS_HOLD',2022],
 'Gregory D. Clausen':['17441','ALIAS_HOLD',2022],
 'Jeff R. Howe':['18337','ALIAS_HOLD',2022],
 'Jim Carlson':['16246','ALIAS_HOLD',2022],
 'Matt D. Klein':['17924','ALIAS_HOLD',2022],
 'Doron Clark':['19196','EXACT',2026]
});
const MARK='CFB_864_SIX_SERVING_REGISTRATIONS_REPORT_PDFS_V26 ';
const SHA=/^[a-f0-9]{64}$/;
const DATE=(s)=>{
 const m=String(s??'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 if(!m)return null;const d=new Date(Date.UTC(+m[3],+m[1]-1,+m[2]));
 return d.getUTCFullYear()===+m[3]&&d.getUTCMonth()===+m[1]-1&&d.getUTCDate()===+m[2]?d.toISOString().slice(0,10):null;
};
const dateEnglish=s=>{
 const m=String(s??'').match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
 const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 if(!m)return null;const mon=months.indexOf(m[1].toLowerCase());
 return mon<0?null:DATE((mon+1)+'/'+m[2]+'/'+m[3]);
};
const kind=e=>{
 const s=e instanceof Error?e.message:String(e);
 return /timeout|abort/i.test(s)?'transport_timeout_hold':
 /HTTP [45]/i.test(s)?'official_pdf_http_hold':
 /pdf|text|source|report/i.test(s)?'official_pdf_source_or_parse_hold':'official_source_unclassified_hold';
};
const id=x=>[x.registrationNumber,x.year,x.type,x.period,x.se,String(x.amendment)].join(':');
function certifiedTargetSix(){
 verifyPinned57AgainstOriginalSourceCheckpoint();
 const v24=verify434OriginalCfbSources();
 if(v24.officialExactReportVersionReferences!==434||v24.verifiedOriginalPrincipalPdfSenators!==85)
  throw Error('Prior original committee source panel changed');
 const coverage=readFileSync('docs/evaluation/source-proof/cfb-2021-25-95-serving-senators-85-authentic-89-viewer-principals-v24.psv','utf8')
  .trimEnd().split('\n').map(x=>x.split('|'));
 const leads=parsePermanent57RegistrationLeadPsv();
 if(coverage.length!==95||leads.length!==57)throw Error('Original CFB candidate registry source not complete');
 const result=[];
 for(const [person,[reg,identity,segment]] of Object.entries(REG)){
  const p=coverage.find(x=>x[0]===person);
  const l=leads.find(x=>x.officialSenator===person);
  if(!p||!l||p[4]!==reg||l.committeeRegistrationLead!==reg
   ||l.identityStatus!==identity||p[5]!==identity||Number(p[6])!==0
   ||(segment===2022&&l.earliestOriginalViewerSegment!==2020)
   ||(segment===2026&&l.earliestOriginalViewerSegment!==2024)
   ||!SHA.test(l.originalCandidatePageSha256))
   throw Error('Unproven candidate registration and actual-serving identity for '+person);
  const service2025=p[2].split(';').find(x=>x.startsWith('2025:'));
  if(segment===2026&&(!p[1].split(',').includes('2025')||service2025!=='2025:60'))
   throw Error('Official original LRL 2025 Senate service oath/district unverified');
  result.push({person,registration:reg,identity,segment,
   originalCandidateSourceDistrict:l.originalCandidatePageDistrict,
   originalGovernmentSourcePageSHA256:l.originalCandidatePageSha256,
   officialHistoricActualServiceTermDistricts:p[2],
   cfbNameVariant:l.originalCfbCandidateLabel});
 }
 if(result.length!==6||new Set(result.map(x=>x.registration)).size!==6)
  throw Error('Selected six source committee registrations not unique');
 return result;
}
export function validateHeaderOnly(person,source,ref,viewerSha){
 const text=String(source?.text??'').replace(/\u0000/g,'').replace(/\s+/g,' ').slice(0,6500);
 const out={
  sourcePdfSHA256:SHA.test(source?.contentSha256)?source.contentSha256:null,
  sourcePdfBytes:Number.isSafeInteger(source?.bytes)?source.bytes:null,
  originalPdfRetrievedAt:source?.fetchedAt??null,
  officialReportViewerResponseSHA256:viewerSha,
  headingForPrincipalCampaignCommittee:/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(text),
  hasSenateOfficeText:/Senat(?:e|or)\s+District/i.test(text),
  originalPrintedDistricts:[...new Set([...text.matchAll(/Senat(?:e|or)\s+District\s*:?\s*(\d{1,2})\b/gi)].map(m=>Number(m[1])))],
  registrationNumberExplicitlyPrintedNearHeading:false,
  registrationNumberClearlyContradicts:false,
  periodStartOn:null,periodEndOn:null,boardReceivedOn:null,
  category:'file_identity_requires_full_firstpage_review',
  exactHistoricalPdfPublicBy:null
 };
 const printed=text.match(/Registration\s+Number\s*:\s*(\d{4,8})\b/i)?.[1]??null;
 const label=text.search(/Registration\s+Number\s*:/i);
 const vicinity=label>=0?text.slice(Math.max(0,label-550),label+600):'';
 out.registrationNumberClearlyContradicts=printed!==null&&printed!==person.registration;
 out.registrationNumberExplicitlyPrintedNearHeading=
  !out.registrationNumberClearlyContradicts&&label>=0&&new RegExp('(?:^|\\D)'+person.registration+'(?:\\D|$)').test(vicinity);
 const dates=text.match(/Period\s+Covered\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
 out.periodStartOn=dates?DATE(dates[1]):null;out.periodEndOn=dates?DATE(dates[2]):null;
 const received=text.match(/Received\s+by\s+the\s+Board\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
 out.boardReceivedOn=received?dateEnglish(received[1]):null;
 const serviceDistricts=[...person.officialHistoricActualServiceTermDistricts.matchAll(/20\d\d:(\d{1,2}(?:,\d{1,2})*)/g)]
  .flatMap(x=>x[1].split(',').map(Number));
 const office=out.originalPrintedDistricts.length===1
  &&(serviceDistricts.includes(out.originalPrintedDistricts[0])
     ||out.originalPrintedDistricts[0]===person.originalCandidateSourceDistrict);
 const strict=out.sourcePdfSHA256!==null&&out.sourcePdfBytes>=1000&&office
  &&out.headingForPrincipalCampaignCommittee&&out.registrationNumberExplicitlyPrintedNearHeading
  &&out.periodStartOn!==null&&out.periodEndOn!==null&&out.boardReceivedOn!==null
  &&out.periodStartOn<=out.periodEndOn&&out.boardReceivedOn>=out.periodEndOn
  &&!out.registrationNumberClearlyContradicts;
 out.category=strict?(person.identity==='EXACT'
  ?'original_pcc_pdf_binary_header_authenticated_direct_person_source'
  :'original_pcc_pdf_registration_header_authenticated_person_nickname_equivalence_hold')
  :'original_pdf_firstpage_form_identity_or_period_hold';
 return out;
}
export function selectCandidateYearReports(person,snapshot){
 const s=person.segment,reg=person.registration;
 if(snapshot.registrationNumber!==reg||snapshot.segmentEndYear!==s
  ||snapshot.sourceUrl!=='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+reg+'/'+s+'/'
  ||!SHA.test(snapshot.responseSha256))
  throw Error('Official candidate CFB original report viewer source identity changed');
 const refs=snapshot.references.filter(ref=>ref.registrationNumber===reg&&ref.type==='pcc'
  &&ref.amendment===0&&(s===2022?['21','22'].includes(ref.year)&&ref.period==='YE'&&ref.se==='0':
    ref.year==='25'&&['C','E','YE'].includes(ref.period)&&['0','1'].includes(ref.se)))
  .sort((a,b)=>a.year.localeCompare(b.year)||a.period.localeCompare(b.period)||a.se.localeCompare(b.se));
 if(refs.length>(s===2022?2:8)||new Set(refs.map(id)).size!==refs.length)
  throw Error('Official 2025/2022 exact original CFB Senate report version reference scope overshot');
 return refs;
}
export async function probeSix(){
 const targets=certifiedTargetSix();
 const output=[];
 for(const t of targets){
  const body={person:t.person,registration:t.registration,identityStatus:t.identity,
   originalCandidateRegistryOriginalPageSHA256:t.originalGovernmentSourcePageSHA256,
   originalReportsFoundInCurrentPublicViewer:0,originalPdfResults:[],
   sourceStatus:'original_candidate_registration_verified_report_versions_under_review'};
  try{
   const snapshot=await fetchCfbCandidateHistoricalReportReferenceSnapshot(t.registration,t.segment);
   const refs=selectCandidateYearReports(t,snapshot);
   body.officialReportViewerSHA256=snapshot.responseSha256;
   body.originalReportsFoundInCurrentPublicViewer=refs.length;
   for(const ref of refs){
    try{
     const original=await fetchCfbReportViewerText(ref,{method:'POST',referer:snapshot.sourceUrl,searchType:'Candidate'});
     const header=validateHeaderOnly(t,original,ref,snapshot.responseSha256);
     body.originalPdfResults.push({versionId:id(ref),registeredCandidateSourceIdentity:t.identity,
      ...header,notStatutoryFilingObligationEvidence:true});
    }catch(e){body.originalPdfResults.push({versionId:id(ref),sourceStatus:kind(e),
      exactHistoricalPdfPublicBy:null,notStatutoryFilingObligationEvidence:true})}
   }
  }catch(e){body.sourceStatus=kind(e)}
  output.push(body);
 }
 return{schema:SCHEMA,actualServingPeopleInNamedOriginalCFBRegistrationPanel:6,
  originalNameVariantsAwaitingIndependentLegalIdentity:5,
  candidateCommitteeOriginalRegistryNameExact:1,
  retrievedSourceVersionReferences:output.reduce((n,x)=>n+x.originalReportsFoundInCurrentPublicViewer,0),
  completePdfFirstpageSourceAuthenticatedDirectPerson:output.flatMap(x=>x.originalPdfResults).filter(x=>x.category==='original_pcc_pdf_binary_header_authenticated_direct_person_source').length,
  legalNameVariantPrintedCFBCommitteePdfsHeldAsPersonIdentity:output.flatMap(x=>x.originalPdfResults).filter(x=>x.category==='original_pcc_pdf_registration_header_authenticated_person_nickname_equivalence_hold').length,
  results:output,independentlyDatedExactHistoricalPDFPublicByCount:0,statutoryReportObligationDenominator:null,
  noPrivateDonorOrTransactionRowsOrPdfBodiesExported:true,noProductionReadWriteOrAsOfEligibilityChanges:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('No override or user-supplied candidate ID permitted');
 const s=JSON.stringify(await probeSix());
 if(s.length>25000||/vendorName|donorName|privateDatabase|%PDF-|rawReportPdf/.test(s))
  throw Error('Only original public government PDF source metadata may be emitted');
 console.log(MARK+s);
}
