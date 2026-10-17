/**
 * #864: PDF TABLE-GEOMETRY review for 116 historical candidate contributions
 * by two PACs source-attested only in 2026. Every call requires a separately
 * SHA-verified original PDF body. Tabular rows come from pdf-parse's positioned
 * original PDF vector-table extraction, never from bulk-record text generation.
 *
 * A printed PAC registration, date, and amount in the SAME original A1-PAC
 * table row is evidence of CURRENT exact-PDF source containment only.
 * It cannot prove WHEN that PDF version was public in 2021-25.
 */
import {
 normalizePrintedName,parsePrintedDates,validDay
} from './cfb-report-schedule-raw.mjs';

export const PAC116_A1_GEOMETRY_SCHEMA='cfb-864-pac116-a1-original-geometry-v4';
const REG=/^[0-9]{3,8}$/;
const HEX=/^[0-9a-f]{64}$/;
const YEAR=/^202[1-5]$/;
const ID=/^[A-Za-z0-9:_-]{12,90}$/;
const TOKEN_SKIP=new Set([
 'mn','minn','minnesota','fund','fd','pac','committee','political',
 'of','and','the','action','registered','contribution','contributions',
 'received','commerce','state'
]);

export function isOriginalA1PacPage(text){
 if(typeof text!=='string'||text.length>1000000)return false;
 const page=text.replace(/\s+/g,' ');
 if(/^\s*INSTRUCTIONS?\s+FOR\s+(?:SCHEDULE|SCH[.])\s*A\s*1/i.test(page))
  return false;
 return /\b(?:SCHEDULE|SCH[.])\s*A\s*1\s*[-–:]?\s*(?:PAC|POLITICAL\s+COMMITTEES?\b|POLITICAL\s+FUNDS?\b)/i
  .test(page);
}
export function exactPrintedPacReg(text,registration){
 return REG.test(registration??'')&&typeof text==='string'&&
  new RegExp('(?:^|[^0-9])'+registration+'(?=$|[^0-9])').test(text);
}
function amountCents(value){
 if(typeof value!=='string'&&typeof value!=='number')return null;
 const clean=String(value).trim().replace(/^\$\s*/,'').replace(/,/g,'');
 if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(clean))return null;
 const n=Number(clean);
 return n>0&&Number.isSafeInteger(Math.round(n*100))
  ?Math.round(n*100):null;
}
function printedTotal(value){
 const s=String(value??'').replace(/\s+/g,' ').trim();
 const m=s.match(/^\$?\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.([0-9]{2}))?\s*$/);
 return m?amountCents(m[1]+'.'+(m[2]??'00')):null;
}
function tokens(value){
 return new Set(normalizePrintedName(value).split(' ')
  .filter(x=>x.length>=4&&!TOKEN_SKIP.has(x)));
}
function nameCorroborates(printed,canonical,registered){
 const literal=normalizePrintedName(printed);
 if(literal.length<8)return false;
 const fullNames=[canonical,registered].map(normalizePrintedName)
  .filter(n=>n.length>=7);
 if(fullNames.some(name=>(' '+literal+' ').includes(' '+name+' ')))
  return true;
 const printedTokens=tokens(printed);
 const ownTokens=new Set([...tokens(canonical),...tokens(registered)]);
 const overlaps=[...printedTokens].filter(x=>ownTokens.has(x));
 // Registration number is independently printed in the SAME table row.
 // Require one uncommon substantive organization token as a corroborating
 // printed legal name, rather than accepting arbitrary adjacent text.
 return overlaps.length>=1;
}
function validRowIdentity(r){
 return REG.test(r?.filerReg??'')&&
  YEAR.test(String(r?.year??''))&&HEX.test(r?.rowKey??'');
}
function validRow(r){
 return validRowIdentity(r)&&REG.test(r?.contributorReg??'')&&
  validDay(r?.transactionDate)&&amountCents(r?.amount)!==null&&
  typeof r?.contributor==='string'&&r.contributor.length>=6;
}
const keyFor=r=>[r.filerReg,String(r.year),r.rowKey].join('|');
const fingerprint=r=>[
 r.contributorReg,r.transactionDate,amountCents(r.amount),
 normalizePrintedName(r.contributor)
].join('|');
function assertRows(allRows,cohortKeys){
 if(!Array.isArray(allRows)||allRows.length>50000)throw Error('Unbounded committee-year comparator');
 const byKey=new Map(),signatureIndex=new Map(),
  uncertainCommittees=new Set();
 for(const r of allRows){
  if(!validRowIdentity(r))
   throw Error('Unsafe original PDF comparator identity');
  const k=keyFor(r),finger=fingerprint(r);
  if(r.sourceConflict===true||
   (byKey.has(k)&&fingerprint(byKey.get(k))!==finger))
   uncertainCommittees.add(r.filerReg+'|'+r.year);
  byKey.set(k,r);
  // Malformed or unidentified comparator contributions cannot simply be
  // filtered away: their unknown fields may hide a competing PDF row.
  if(!validRow(r)){
   uncertainCommittees.add(r.filerReg+'|'+r.year);
   continue;
  }
  const group=[r.filerReg,String(r.year),r.contributorReg,
   r.transactionDate,amountCents(r.amount)].join('|');
  if(!signatureIndex.has(group))signatureIndex.set(group,new Set());
  signatureIndex.get(group).add(k);
 }
 for(const key of cohortKeys){
  if(!byKey.has(key)||!validRow(byKey.get(key)))
   throw Error('Full receiving committee comparator missing valid PAC contribution');
 }
 return {byKey,signatureIndex,uncertainCommittees};
}
function tableHeaders(table){
 if(!Array.isArray(table)||table.length<2||table.length>2000)return null;
 const headers=table.slice(0,8).map(row=>Array.isArray(row)?row.map(
  cell=>String(cell??'').replace(/\s+/g,' ').trim()):[]);
 const cells=headers.flat();
 const joined=cells.join(' ').toLowerCase();
 if(!/\bdate\b/.test(joined)||!/\b(?:registration|reg[.])\b/.test(joined)||
  !/\btotal\b/.test(joined)||!/\b(?:cash|col[. ]*1)\b/.test(joined))
  return null;
 // A1-PAC form's last monetary column is explicitly "Col. 3 Total".
 // Fail closed if more than one column could be the total column.
 const totals=new Set(),regs=new Set(),dates=new Set(),names=new Set();
 for(const row of headers)row.forEach((s,i)=>{
  if(/\b(?:col[. ]*3\b|total\b)/i.test(s))totals.add(i);
  if(/\bregistration\b|(?:^|\s)reg(?:istration)?\s*(?:#|number)\b/i.test(s))
   regs.add(i);
  if(/\bdate\b/i.test(s)&&/\b(?:received|date)\b/i.test(s))dates.add(i);
  if(/\bname\b/i.test(s)&&/\b(?:committee|fund|contributor|address)\b/i.test(s))
   names.add(i);
 });
 if(totals.size!==1||regs.size!==1||dates.size!==1||
  names.size!==1)return null;
 const [totalIndex]=totals,[regIndex]=regs,[dateIndex]=dates,[nameIndex]=names;
 if(new Set([totalIndex,regIndex,dateIndex,nameIndex]).size!==4)return null;
 return {totalIndex,regIndex,dateIndex,nameIndex};
}
function scanTable({table,rows,report,pageNumber,registeredNames}){
 const headers=tableHeaders(table);
 if(!headers)return {header:false,hits:[],identityCandidates:0};
 const hits=[],seenRows=new Set();
 let identityCandidates=0;
 for(let i=0;i<table.length;i++){
  const cells=table[i];
  if(!Array.isArray(cells)||cells.length<headers.totalIndex+1)continue;
  const flat=cells.map(v=>String(v??'').trim());
  const dates=[...new Set(parsePrintedDates(flat[headers.dateIndex]))];
  if(dates.length!==1)continue;
  const amount=printedTotal(flat[headers.totalIndex]);
  if(amount===null)continue;
  for(const r of rows){
   // The regulated committee number must be in its actual original
   // registration-number COLUMN, never in a zip, footer or page header.
   if(!exactPrintedPacReg(flat[headers.regIndex],r.contributorReg))continue;
   identityCandidates++;
   if(dates[0]!==r.transactionDate||amount!==amountCents(r.amount))
    continue;
   if(!nameCorroborates(flat[headers.nameIndex],r.contributor,
    registeredNames.get(r.contributorReg)??''))continue;
   const hitKey=keyFor(r)+'|'+report.reportVersionId+'|'+pageNumber+'|'+i;
   if(seenRows.has(hitKey))continue;
   seenRows.add(hitKey);
   hits.push({
    key:keyFor(r),reportVersionId:report.reportVersionId,
    pageNumber,tableRow:i,identityRegistered:r.contributorReg
   });
  }
 }
 return {header:true,hits,identityCandidates};
}

/**
 * Input tablePages are positions returned by PDFParse.getTable, indexed by
 * numeric PDF page number. PDF SHA verified is a REQUIREMENT, not optional.
 * Keep individual hit locators inside the private protected action.
 */
export function verifyOriginalA1PacTable({
 report,pageText,tablePages,allRows,registeredNames,sourceHashVerified
}){
 if(!sourceHashVerified||!report||!ID.test(report.reportVersionId??'')||
  !REG.test(report.committeeReg??'')||!YEAR.test(String(report.reportYear))||
  !HEX.test(report.pdfSha??'')||!Number.isInteger(report.pageNumber)||
  report.pageNumber<1||report.pageNumber>2000)
  throw Error('Unverified PDF version, original body or page identity');
 if(!isOriginalA1PacPage(pageText))
  return {a1Page:false,tableCount:0,verifiedTableHeaders:0,
   visibleIdentityRowCandidates:0,privateHits:[]};
 if(!Array.isArray(tablePages)||tablePages.length>300)
  throw Error('Original table geometry page input out of bounds');
 const relevant=allRows.filter(r=>r.filerReg===report.committeeReg&&
  Number(r.year)===Number(report.reportYear));
 const hits=[];
 let tableCount=0,verifiedTableHeaders=0,visibleIdentityRowCandidates=0;
 for(const table of tablePages){
  if(!Array.isArray(table))continue;
  tableCount++;
  const outcome=scanTable({table,rows:relevant,report,
   pageNumber:report.pageNumber,registeredNames});
  if(outcome.header)verifiedTableHeaders++;
  visibleIdentityRowCandidates+=outcome.identityCandidates;
  hits.push(...outcome.hits);
 }
 return {
  a1Page:true,tableCount,verifiedTableHeaders,
  visibleIdentityRowCandidates,privateHits:hits
 };
}
export function safeOriginalA1PacCohortSummary({
 cohort,allRows,reports,pageOutcomes,pdfHashesChecked,
 pagesEligibleForGeometry,pagesSkippedByLimit,parseFailedPages
}){
 if(!Array.isArray(cohort)||!Array.isArray(reports)||
  !Array.isArray(pageOutcomes)||cohort.length>2000||reports.length>830||
  pageOutcomes.length>2000||!Number.isInteger(pdfHashesChecked)||
  !Number.isInteger(pagesEligibleForGeometry)||
  !Number.isInteger(pagesSkippedByLimit)||
  !Number.isInteger(parseFailedPages))
  throw Error('Bounded source page proof required');
 const scoped=new Set(cohort.map(keyFor));
 if(scoped.size!==116)throw Error('Expected 116 distinct PAC finance records');
 const {signatureIndex,uncertainCommittees}=assertRows(allRows,scoped);
 const sourceReports=new Set(reports.map(r=>r.reportVersionId));
 const grouped=new Map(),collision=new Set();
 let candidatePairs=0,unselectedCandidateHits=0,withA1Header=0,
  withGeometry=0,printedIdentityRows=0;
 for(const p of pageOutcomes){
  withA1Header+=Number(p.a1Page===true);
  withGeometry+=Number(p.verifiedTableHeaders>0);
  printedIdentityRows+=p.visibleIdentityRowCandidates;
  for(const hit of p.privateHits){
   if(!sourceReports.has(hit.reportVersionId))
    throw Error('Original PDF proof outside indexed report cohort');
   if(!scoped.has(hit.key)){unselectedCandidateHits++;continue;}
   const r=cohort.find(row=>keyFor(row)===hit.key);
   const collisionKey=[
    r.filerReg,r.year,r.contributorReg,r.transactionDate,
    amountCents(r.amount)
   ].join('|');
   if(uncertainCommittees.has(r.filerReg+'|'+r.year)||
    (signatureIndex.get(collisionKey)?.size??0)!==1){
    collision.add(hit.key);continue;
   }
   if(!grouped.has(hit.key))grouped.set(hit.key,new Map());
   const pair=hit.reportVersionId;
   if(!grouped.get(hit.key).has(pair))
    grouped.get(hit.key).set(pair,new Set());
   grouped.get(hit.key).get(pair).add(hit.pageNumber+'|'+hit.tableRow);
  }
 }
 let uniquePairs=0,duplicateOriginalRows=0,distinctRows=0,amendmentAmbiguous=0;
 for(const versions of grouped.values()){
  let cleanForRow=0;
  for(const locators of versions.values()){
   if(locators.size===1){uniquePairs++;cleanForRow++;}
   else duplicateOriginalRows++;
  }
  if(cleanForRow)distinctRows++;
  if(cleanForRow>1)amendmentAmbiguous++;
 }
 const result={
  schema:PAC116_A1_GEOMETRY_SCHEMA,
  originalPdfReportVersionsInCohort:reports.length,
  originalPdfBodiesRehashed:pdfHashesChecked,
  originalPacA1PagesEligible:pagesEligibleForGeometry,
  originalPacA1PagesWithVerifiedTableHeaders:withGeometry,
  originalPacA1PagesChecked:pageOutcomes.length,
  geometryPagesDeferredDueToBound:pagesSkippedByLimit,
  geometryPagesExtractorFailed:parseFailedPages,
  a1PagesPresent:withA1Header,
  sameRowRegisteredEntityCandidates:printedIdentityRows,
  uniqueSourceTableVersionRowPairs:uniquePairs,
  distinctContributionsWithExactSourceTableRow:distinctRows,
  ambiguousDuplicateRowsWithinVersion:duplicateOriginalRows,
  withMultipleOriginalOrAmendedVersions:amendmentAmbiguous,
  collisionsWithOtherCanonicalContributionRows:collision.size,
  comparatorRowsOutsidePAC116AlsoMatched:unselectedCandidateHits,
  receivingCommitteeYearsWithUnusableComparator:uncertainCommittees.size,
  unresolvedAmong116:116-distinctRows,
  historicalOriginalVersionFirstPublicByProven:0,
  historicalQualifiedPACFinanceFeatures:0,
  historicalAsOfEligibilityModified:false,
  modelWeightsOrServingModified:false
 };
 for(const n of Object.values(result))
  if(typeof n==='number'&&(!Number.isSafeInteger(n)||n<0||n>1000000))
   throw Error('Unsafe original source geometry summary');
 return result;
}
