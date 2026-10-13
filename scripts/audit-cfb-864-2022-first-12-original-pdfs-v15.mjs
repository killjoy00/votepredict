/**
 * #864 ONLY exact official original/amended CFB report-version identity.
 * Reconcile 24 independently source-authenticated 2022 C/E PDF binaries
 * from SD1-12 to the 95 OFFICIALLY ACTUALLY SERVED 2021-25 senators.
 * Candidate viewer label is NOT evidence a person ever served.
 * User-excluded: bulk finance, legacy eligibility, legal filing obligations.
 * No protected DB, production, donors, PDF bodies, schedules or outreach.
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {cfb2022OriginalCePdfTargets}
 from '../src/evidence/cfb-2022-senate-original-ce-pdf-proof.js';
import {cfbSenateDistrictPageUrl,parseCfbSenateDistrictCandidatePage}
 from '../src/evidence/cfb-senate-district-registration-inventory.js';
export const SCHEMA='cfb-864-2022-12-senator-official-report-pdf-service-source-crosswalk-v15';
export const CROSSWALK='docs/evaluation/source-proof/cfb-2021-25-95-serving-senator-report-version-source-crosswalk-v14.psv';
export const PDF_LEDGER='docs/evaluation/source-proof/cfb-2022-senate-24-original-ce-pdf-headers.psv';
const sha=x=>createHash('sha256').update(x).digest('hex');
const HEX=/^[0-9a-f]{64}$/;
// Three independently corroborated EXACT historical CFB display-name forms.
// Reg/district/original literal CFB label MUST ALL match. LRL actual service
// and committee original-report first-page hashes are separate original proof.
// Kupec & McEwen: official MN Legislative Reference Library explicitly lists
// "Rob" and "Jen"; their 2022 state Members-Elect roster names the same.
// Wesenberg: original CFB 2022-09-07 Board meeting materials p.32/37 names
// "Wesenberg for Senate (18778)" and "Nathan", while CFB official candidate
// viewer names #18778 "Nathanial L" and state 2022 Members-Elect Senate SD10
// roster names Nathan Wesenberg. No generic Nathan↔Nathanial guess permitted.
export const VERIFIED_REGISTRATION_NAME_FORMS=Object.freeze([
 {reg:'18917',district:4,official:'Robert Kupec',cfbLabel:'Kupec, Rob',
  officialIdentityUrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15578',
  corroboratingOriginal:'https://www.house.mn.gov/hinfo/leginfo/memelectroster.pdf'},
 {reg:'18581',district:8,official:'Jennifer A McEwen',cfbLabel:'McEwen, Jen',
  officialIdentityUrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15537',
  corroboratingOriginal:'https://www.house.mn.gov/hinfo/leginfo/memelectroster.pdf'},
 {reg:'18778',district:10,official:'Nathan Wesenberg',cfbLabel:'Wesenberg, Nathanial L',
  officialIdentityUrl:'https://cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/18778/2026/',
  corroboratingOriginal:'https://cfb.mn.gov/pdf/bdinfo/agendas/2022_09_07_materials.pdf'}
]);
function identityKey(fullName,reverse=false){
 const raw=String(fullName).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9, ]/g,' ').replace(/\s+/g,' ').trim();
 let first,last;
 if(reverse){
  const pieces=raw.split(',').map(x=>x.trim());
  if(pieces.length!==2||!pieces[0]||!pieces[1])return null;
  last=pieces[0].split(/\s+/).at(-1);
  first=pieces[1].split(/\s+/)[0];
 }else{
  const tokens=raw.replaceAll(',',' ').split(/\s+/).filter(x=>!['jr','sr','ii','iii','iv'].includes(x));
  first=tokens[0];last=tokens.at(-1);
 }
 if(!first||!last||!/^[a-z]+$/.test(first)||!/^[a-z]+$/.test(last))return null;
 return first+'|'+last;
}
export function readPinnedActualSenatorRoster(text=readFileSync(CROSSWALK,'utf8')){
 const rows=text.trimEnd().split('\n').map(x=>x.split('|'));
 if(rows.length!==95||rows.some(x=>x.length!==10))throw Error('Original-source Senate 95 row identity ledger changed');
 const map=new Map();
 for(const r of rows){
  const name=r[0],k=identityKey(name);
  if(!k||map.has(k)||r[9]!=='true')throw Error('Ambiguous authenticated official senator name');
  const districts=new Set(r[2].split(';').flatMap(x=>{
   const m=/^(20(?:2[1-5])):(\d{1,2}(?:,\d{1,2})*)$/.exec(x);
   return m?[...m[2].split(',').map(d=>m[1]+':'+d)]:[];
  }));
  map.set(k,{name,districts,sourceYears:r[1]});
 }
 return map;
}
export function readPinnedOriginal24ReportPdfs(text=readFileSync(PDF_LEDGER,'utf8')){
 const targets=cfb2022OriginalCePdfTargets();
 if(targets.length!==24)throw Error('Original 2022 source panel 24 target count changed');
 const rows=text.trimEnd().split('\n').map(x=>x.split('|'));
 if(rows.length!==24||rows.some(x=>x.length!==8))throw Error('Original 24 PDF source provenance changed');
 const map=new Map(rows.map(r=>[r[0],r]));
 if(map.size!==24)throw Error('Original CFB 2022 unique PDF version identity changed');
 for(const t of targets){
  const r=map.get(t.id);
  if(!r||!HEX.test(r[1])||!Number.isSafeInteger(Number(r[2]))
   ||r[3]!=='2022-01-01'||r[4]!==t.expectedPeriodEndOn
   ||r[6]!==t.dueOn
   ||!/^\d{4}-\d\d-\d\d$/.test(r[5])
   ||!/^\d{4}-\d\d-\d\d$/.test(r[7])||r[7]<=r[6]
   ||r[7]<r[5])throw Error('Original source header/period/receipt/law floor mismatch '+t.id);
 }
 return{targets,metadata:map};
}
export function joinOfficial2022DistrictLabelsToSenateService(observations,
 roster=readPinnedActualSenatorRoster()){
 const{targets,metadata}=readPinnedOriginal24ReportPdfs();
 const pages=new Map();
 for(const o of observations){
  if(!Number.isInteger(o.district)||o.district<1||o.district>12
   ||o.segmentEndYear!==2022||pages.has(o.district))
   throw Error('Expected unique 2022 district original source page');
  pages.set(o.district,o);
 }
 const rows=[],byStatus={};
 for(let district=1;district<=12;district++){
  const target=targets.find(t=>t.district===district && t.period==='C');
  if(!target)throw Error('Missing C report for official 2022 district');
  const companion=targets.find(t=>t.district===district && t.period==='E');
  if(!companion||companion.reg!==target.reg)throw Error('Official C/E original parent registration drift');
  const page=pages.get(district);
  let status='official_page_not_acquired_hold',person=null,possibleNameAliasOf=null,aliasCandidateCfbSourceLabel=null,sourceAliasProof=null;
  if(page){
   if(page.status==='candidate_labels_observed'
     &&page.candidates?.length&&page.htmlSha256===target.districtPageSha){
    const matched=page.candidates.filter(c=>c.registrationNumber===target.reg);
    if(matched.length===1){
     const key=identityKey(matched[0].candidateDisplayName,true);
     const serving=key?roster.get(key):null;
     if(serving){
      if(serving.districts.has('2022:'+district)
       ||serving.districts.has('2023:'+district)){
       status='original_CFB_district_label_and_actual_Senate_service_verified';
       person=serving.name;
      }else status='name_matches_senator_but_district_service_year_unconfirmed_hold';
     }else{
      const proven=VERIFIED_REGISTRATION_NAME_FORMS.find(x=>x.reg===target.reg
       &&x.district===district&&x.cfbLabel===matched[0].candidateDisplayName);
      const backed=proven&&[...roster.values()].filter(r=>r.name===proven.official
       &&(r.districts.has('2022:'+district)||r.districts.has('2023:'+district)));
      if(proven&&backed?.length===1){
       status='original_CFB_exact_registration_label_independently_corrob_LRL_name_form_verified';
       person=backed[0].name;
       sourceAliasProof=proven.officialIdentityUrl;
      }else{
      // Diagnostic only: the original CFB display label may use a nickname,
      // but an exact shared surname and 2022/2023 district NEVER by itself
      // authenticates identity or a distinct CFB registration.
      const originalLabel=matched[0].candidateDisplayName;
      const labelParts=String(originalLabel).split(',').map(x=>x.trim());
      if(labelParts.length===2 && labelParts[0] && labelParts[1]){
       const surname=identityKey(labelParts[0]+', '+labelParts[1],true)?.split('|').at(-1);
       const eligible=[...roster.values()].filter(r=>
        (r.districts.has('2022:'+district)||r.districts.has('2023:'+district))
        &&identityKey(r.name)?.split('|').at(-1)===surname);
       if(eligible.length===1){
        possibleNameAliasOf=eligible[0].name;
        // The SOURCE CFB public principal name is retained ONLY where
        // unique independently serving-senator surname and district agree;
        // this is a manual nickname review LEAD, never an inferred alias.
        aliasCandidateCfbSourceLabel=originalLabel;
       }
      }
      status='registration_label_not_uniquely_proven_serving_senator_hold';
      }
     }
    }else status='registration_not_uniquely_in_source_district_hold';
   }else status='official_page_or_candidate_labels_unverified_hold';
  }
  const entry={
   district,registration:target.reg,observedMatchedOfficialSenator:person,
   independentlyUnverifiedNicknameIdentityLead:possibleNameAliasOf,
   sourceCandidateLabelNeedsOfficialNicknameReview:aliasCandidateCfbSourceLabel,
   sourceAliasProofUrl:sourceAliasProof,
   sourceStatus:status,
   originalDistrict2022SourcePageSha256:page?.htmlSha256??null,
   originalDistrictSourcePageStatus:page?.status??'not_acquired',
   originalViewerApiSha256:target.viewerSha,
   reportVersionIds:[target.id,companion.id],
   originalSourcePdfSha256s:[metadata.get(target.id)[1],metadata.get(companion.id)[1]],
   originalSourcePdfBytes:[Number(metadata.get(target.id)[2]),Number(metadata.get(companion.id)[2])],
   reportPeriodStarts:[metadata.get(target.id)[3],metadata.get(companion.id)[3]],
   reportPeriodEnds:[metadata.get(target.id)[4],metadata.get(companion.id)[4]],
   boardReceivedDates:[metadata.get(target.id)[5],metadata.get(companion.id)[5]],
   calendarDueDates:[metadata.get(target.id)[6],metadata.get(companion.id)[6]],
   legallyPossibleButNotProvenReleaseFloors:[metadata.get(target.id)[7],metadata.get(companion.id)[7]],
   exactHistoricalActualPublicByDates:[null,null],
   existing2022OriginalPDFsAlreadyAuthenticated:true,
   legalReportObligationsInferred:false,
  };
  rows.push(entry);byStatus[status]=(byStatus[status]||0)+1;
 }
 if(rows.length!==12||new Set(rows.map(r=>r.registration)).size!==12
  ||new Set(rows.flatMap(r=>r.reportVersionIds)).size!==24)
  throw Error('Original 2022 PDF source identity duplicates');
 return{
  schema:SCHEMA,pdfSourceLedger:PDF_LEDGER,originalServing95Roster:CROSSWALK,
  source2022Districts:12,exactOriginalPDFVersionsIndependentlyAuthenticated:24,
  actualSenatorPrincipalRegistrationsSourceRejoined:rows.filter(r=>r.observedMatchedOfficialSenator).length,
  actualSenatorExactSourceReportPdfVersions:rows.filter(r=>r.observedMatchedOfficialSenator).length*2,
  notJoinedToActualServiceNeverMeansNoCandidateReport:true,
  firstPublicDisplayOfExactReportPDFIndependentlyProven:0,
  noFilingObligationDenominator:true,noTransactionOrLegacyEligibilityWork:true,
  noProductionReadsOrWrites:true,statusCounts:byStatus,rows
 };
}
async function officialPage(district,fetchPublic){
 const url=cfbSenateDistrictPageUrl(district,2022);
 try{
  const r=await fetchPublic(url,{
   headers:{accept:'text/html','user-agent':'VotePredict/2.0 public-original-CFB-report-pdf-service-join'},
   signal:AbortSignal.timeout(22000),redirect:'follow'
  });
  const actual=new URL(r.url);
  if(!r.ok||actual.hostname!=='register.cfb.mn.gov'
   ||actual.pathname.replace(/\/$/,'')!==new URL(url).pathname
   ||!(/text\/html/i.test(r.headers.get('content-type')??'')))
   throw Error('Official CFB candidate source invalid');
  const claimed=Number(r.headers.get('content-length')??0);
  if(claimed>1800000)throw Error('CFB source unbounded');
  const buffer=Buffer.from(await r.arrayBuffer());
  if(buffer.byteLength<500||buffer.byteLength>1800000)
   throw Error('Original CFB source HTML bytes invalid');
  return parseCfbSenateDistrictCandidatePage({
   district,segmentEndYear:2022,sourceUrl:url,fetchedAt:new Date().toISOString(),
   htmlSha256:sha(buffer),html:buffer.toString('utf8'),
   responseBytes:buffer.byteLength
  });
 }catch{
  return{district,segmentEndYear:2022,status:'source_fetch_failed',
   candidates:[],htmlSha256:null};
 }
}
export async function acquireV15Source(fetchPublic=fetch){
 const roster=readPinnedActualSenatorRoster();
 const results=new Array(12);
 let next=0;
 const worker=async()=>{
  for(;;){
   const index=next++;
   if(index>=12)break;
   results[index]=await officialPage(index+1,fetchPublic);
  }
 };
 await Promise.all([worker(),worker(),worker()]);
 return joinOfficial2022DistrictLabelsToSenateService(results,roster);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Only fixed public official CFB 12-district lookup accepted');
 const result=await acquireV15Source();
 // Original PDFs and unselected/nonserving CFB candidate names never logged.
 const output=JSON.stringify(result);
 if(output.length>35000||/donor|contributor|rowKey|<html|%PDF-/i.test(output))
  throw Error('Unsafe original PDF source-identity audit output');
 console.log('CFB_864_2022_12_SENATOR_ORIGINAL_CE_V15 '+output);
}
