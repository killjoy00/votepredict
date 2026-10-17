/**
 * #864 Finance-only original PDF.js text-coordinate candidate screen.
 *
 * Text lines near one another in source PDFs are only a CANDIDATE. An exact
 * original-report source hit requires independently SHA-verified PDF bytes,
 * literal original A1 committee context, four distinct source column regions
 * (date, PAC registration, legal name, TOTAL), and an unambiguous same-row
 * date/registered legal PAC/amount match. No historic public-by is inferred.
 *
 * This module never accesses databases or changes source/forecast records.
 * Its privateHits MUST NOT be serialized to any public log.
 */
import {normalizePrintedName,parsePrintedDates,validDay}
 from './cfb-report-schedule-raw.mjs';
import {isOriginalA1RegisteredPacPage,exactPrintedPacReg}
 from './cfb-pac116-original-a1-geometry-v4.mjs';

export const POSITIONED_A1_PAC_VERSION='cfb-pac116-original-text-position-v5';
const HEX=/^[a-f0-9]{64}$/,REG=/^[0-9]{3,8}$/;
const YEAR=/^202[1-5]$/;
const COMMON=new Set(['mn','minn','minnesota','committee','fund','fd','pac',
 'political','action','contribution','contributions','the','of','and','inc',
 'for','leadership','received','cash','in','kind','total','name']);
const key=r=>[r.filerReg,String(r.year),r.rowKey].join('|');
function moneyToCents(n){
 const cleaned=String(n??'').replace(/[$, ]/g,'');
 if(!/^\d{1,10}(?:\.\d{1,2})?$/.test(cleaned))return null;
 const value=Number(cleaned);
 return value>0&&Number.isSafeInteger(Math.round(value*100))
  ?Math.round(value*100):null;
}
function numericDollars(str){
 if(typeof str!=='string')return [];
 const rx=/(?<![A-Za-z0-9])(?:\$\s*(?:\d{1,3}(?:,\d{3})+|\d{1,9})(?:\.\d{2})?|\d{1,3}(?:,\d{3})+\.\d{2}|\d{1,9}\.\d{2})(?![A-Za-z0-9])/g;
 const values=[];
 for(const m of str.matchAll(rx)){
  const c=moneyToCents(m[0]);
  if(c!==null)values.push(c);
 }
 return values;
}
function distinctNameEvidence(source,canonical,registered){
 const printed=normalizePrintedName(source);
 if(!printed||printed.length<8)return false;
 const names=[canonical,registered].filter(x=>typeof x==='string')
  .map(normalizePrintedName).filter(s=>s.length>=7);
 if(names.some(n=>(' '+printed+' ').includes(' '+n+' ')))return true;
 const fromPrint=new Set(printed.split(/\s+/).filter(t=>
  t.length>=5&&!COMMON.has(t)));
 return names.some(name=>name.split(/\s+/).some(
  t=>t.length>=5&&!COMMON.has(t)&&fromPrint.has(t)));
}
function safeItem(raw){
 if(!raw||typeof raw.str!=='string'||raw.str.length>1500||
  !Array.isArray(raw.transform)||raw.transform.length!==6||
  !raw.transform.every(Number.isFinite)||raw.str.trim().length===0)
  return null;
 const x=Number(raw.transform[4]),y=Number(raw.transform[5]);
 const width=Number(raw.width??0),fontSize=Math.hypot(
  Number(raw.transform[0]),Number(raw.transform[1]));
 if(!Number.isFinite(width)||width<0||width>2000||
  !Number.isFinite(fontSize)||fontSize<0||fontSize>200||
  x<-100||x>2000||y<-100||y>3000)return null;
 return {str:raw.str.trim(),x,y,width,fontSize};
}
function linesFromItems(items){
 if(!Array.isArray(items)||items.length>25000)
  throw Error('Unbounded PDF text-position source items');
 const parsed=items.map(safeItem).filter(Boolean)
  .sort((a,b)=>b.y-a.y||a.x-b.x);
 const lines=[];
 for(const item of parsed){
  const top=lines.at(-1);
  // Use a tight baseline (PDF typographic coordinates), never combine
  // arbitrary neighbouring printed rows into one canonical transaction.
  if(top&&Math.abs(top.y-item.y)<=Math.min(3,Math.max(1.5,item.fontSize*0.35))){
   top.items.push(item);
  }else lines.push({y:item.y,items:[item]});
  if(lines.length>25000)throw Error('Too many CFB PDF positioned rows');
 }
 for(const line of lines){
  line.items.sort((a,b)=>a.x-b.x);
  line.text=line.items.map(x=>x.str).join(' ');
 }
 return {lines,positionedItems:parsed.length,discardedItems:items.length-parsed.length};
}
function label(item,kind){
 const s=item.str;
 if(kind==='date')return /\bdate(?:\s+(?:received|of))?\b/i.test(s);
 if(kind==='reg')return /\bregistration\b|\breg[.]?\s*(?:#|no[.]?|number)\b/i.test(s);
 if(kind==='name')return /\b(?:contributor|name(?:\s+and|\s+of)?)\b/i.test(s);
 if(kind==='total')return /\b(?:col[. ]*3|total(?:\s+\(?cash)?)\b/i.test(s);
 return false;
}
function findHeaderRegions(lines,candidateY){
 // Require 4 different x positions in an actual HEADER printed ABOVE the
 // transaction. Multiple possible headings cause HOLD (not an arbitrary pick).
 const prior=lines.filter(l=>l.y>candidateY+2&&l.y<candidateY+230);
 const choices=[];
 for(const top of prior){
  const near=prior.filter(l=>Math.abs(l.y-top.y)<45&&l.y<=top.y+2);
  const fields=['date','reg','name','total'];
  const matches=fields.map(kind=>near.flatMap(l=>l.items).filter(i=>label(i,kind)));
  if(matches.some(m=>m.length!==1))continue;
  const xs=matches.map(m=>m[0].x);
  if(!(xs[0]+8<xs[1]&&xs[1]+8<xs[2]&&xs[2]+8<xs[3]))continue;
  const headerY=Math.min(...matches.map(m=>m[0].y));
  if(headerY<=candidateY+2)continue;
  const key=xs.map(Math.round).join('|');
  if(!choices.some(x=>x.key===key))choices.push({key,xs,headerY});
 }
 if(choices.length!==1)return null;
 const xs=choices[0].xs;
 return {
  columns:['date','reg','name','total'],
  boundaries:[(xs[0]+xs[1])/2,(xs[1]+xs[2])/2,(xs[2]+xs[3])/2]
 };
}
function inColumn(item,region,kind){
 const x=item.x+Math.min(item.width,Math.max(0,item.str.length*2))/2;
 const b=region.boundaries;
 if(kind==='date')return x<b[0];
 if(kind==='reg')return x>=b[0]&&x<b[1];
 if(kind==='name')return x>=b[1]&&x<b[2];
 if(kind==='total')return x>=b[2];
 return false;
}
function geometryProves(line,row,region,registered){
 if(!region)return false;
 const dates=line.items.filter(i=>inColumn(i,region,'date')&&
  parsePrintedDates(i.str).includes(row.transactionDate));
 const ids=line.items.filter(i=>inColumn(i,region,'reg')&&
  exactPrintedPacReg(i.str,row.contributorReg));
 const names=line.items.filter(i=>inColumn(i,region,'name')&&
  distinctNameEvidence(i.str,row.contributor,registered));
 const amounts=line.items.filter(i=>inColumn(i,region,'total')&&
  numericDollars(i.str).includes(moneyToCents(row.amount)));
 return dates.length===1&&ids.length===1&&names.length===1&&
  amounts.length===1;
}
function rowValid(r){
 return r&&REG.test(r.filerReg??'')&&
  YEAR.test(String(r.year))&&HEX.test(r.rowKey??'')&&
  REG.test(r.contributorReg??'')&&
  typeof r.contributor==='string'&&r.contributor.length>=5&&
  validDay(r.transactionDate)&&moneyToCents(r.amount)!==null;
}
function shortestDistance(lines,y,predicate){
 let d=Infinity;
 for(const l of lines){
  if(predicate(l))d=Math.min(d,Math.abs(l.y-y));
 }
 return d;
}
function sourcePACAnchorBlock(lines,lineIndex,registeredNames,candidates,report){
 const anchor=lines[lineIndex],regs=[...registeredNames.keys()];
 const hasReg=regs.filter(id=>exactPrintedPacReg(anchor.text,id));
 if(!hasReg.length)return null;
 const nearest={
  date:shortestDistance(lines,anchor.y,l=>parsePrintedDates(l.text).length>0),
  money:shortestDistance(lines,anchor.y,l=>numericDollars(l.text).length>0),
  name:shortestDistance(lines,anchor.y,l=>hasReg.some(id=>
   distinctNameEvidence(l.text,registeredNames.get(id),
    registeredNames.get(id))))
 };
 // A bounded *diagnostic* extraction envelope, not an invented printed
 // table. A qualifying name/date/total in neighbouring lines is never
 // upgraded to exact original table containment by this helper.
 const nearby=lines.filter(l=>Math.abs(l.y-anchor.y)<=48);
 const dates=new Set(nearby.flatMap(l=>parsePrintedDates(l.text)));
 const amounts=new Set(nearby.flatMap(l=>numericDollars(l.text)));
 const otherRegs=new Set();
 for(const line of nearby)for(const id of regs)
  if(exactPrintedPacReg(line.text,id))otherRegs.add(id);
 const candidateRows=[];
 let rejectedCompetingDate=0,rejectedMultipleRegs=0;
 for(const row of candidates){
  if(!hasReg.includes(row.contributorReg))continue;
  if(!dates.has(row.transactionDate)||
   !amounts.has(moneyToCents(row.amount)))continue;
  const named=nearby.some(l=>distinctNameEvidence(
   l.text,row.contributor,registeredNames.get(row.contributorReg)));
  if(!named)continue;
  // Two distinct transaction dates or different PAC registrations in one
  // proximity envelope may straddle multiple actual report rows.
  if(dates.size!==1){rejectedCompetingDate++;continue;}
  if(otherRegs.size!==1){rejectedMultipleRegs++;continue;}
  candidateRows.push({
   key:key(row),reportVersionId:report.reportVersionId,
   pageNumber:report.pageNumber,anchorLine:lineIndex
  });
 }
 return {nearest,candidateRows,rejectedCompetingDate,
  rejectedMultipleRegs};
}

function sourceStats(){
 return {a1SourcePositioned:false,positionedItems:0,discardedItems:0,
  sourceLines:0,pacIdLines:0,regAndDateLines:0,regAndMoneyLines:0,
  regDateMoneyLines:0,regDateMoneyNameLines:0,
  cohortCandidateRecords:0,source4FieldCandidates:0,
  candidateRowsWith4ColumnHeader:0,positionedGeometryOriginalHitPairs:0,
  nearestPACDateWithin12:0,nearestPACDateWithin32:0,
  nearestPACDateWithin80:0,nearestPACMoneyWithin12:0,
  nearestPACMoneyWithin32:0,nearestPACMoneyWithin80:0,
  nearestPACNameWithin12:0,nearestPACNameWithin32:0,
  nearestPACNameWithin80:0,
  provisionalMultiBaselinePairsBeforeCollision:0,
  blockDateConflictHolds:0,blockMultiplePACRegistrationHolds:0,
  textLayerTooSparse:false,privatePositionedCandidates:[],
  privateQualifiedHits:[],privateBlockCandidates:[]};
}
export function reconcilePositionedOriginalA1Page({
 items,cachedPageText,report,allRows,registeredNames,sourceHashVerified
}){
 if(sourceHashVerified!==true||!report||!HEX.test(report.pdfSha??'')||
  !REG.test(report.committeeReg??'')||!YEAR.test(String(report.reportYear))||
  !Number.isInteger(report.pageNumber)||report.pageNumber<1||
  report.pageNumber>2500||typeof report.reportVersionId!=='string'||
  !Array.isArray(allRows)||allRows.length>50000||
  !(registeredNames instanceof Map)||registeredNames.size!==2||
  [...registeredNames.keys()].some(x=>!REG.test(x)))
  throw Error('Unverified original PDF/source identity or unbounded inputs');
 const outcome=sourceStats();
 if(!isOriginalA1RegisteredPacPage(cachedPageText,
  [...registeredNames.keys()]))return outcome;
 const {lines,positionedItems,discardedItems}=linesFromItems(items);
 outcome.sourceLines=lines.length;outcome.positionedItems=positionedItems;
 outcome.discardedItems=discardedItems;
 outcome.a1SourcePositioned=true;
 outcome.textLayerTooSparse=positionedItems<8;
 const candidates=allRows.filter(r=>rowValid(r)&&
  r.filerReg===report.committeeReg&&
  Number(r.year)===Number(report.reportYear)&&
  registeredNames.has(r.contributorReg));
 const cohortMatchKeys=new Set(), sourceCandidates=new Set();
 const strictHits=new Set();
 for(let li=0;li<lines.length;li++){
  const line=lines[li];
  if(![...registeredNames.keys()].some(reg=>exactPrintedPacReg(line.text,reg)))
   continue;
  outcome.pacIdLines++;
  const block=sourcePACAnchorBlock(
   lines,li,registeredNames,candidates,report);
  if(block){
   for(const [kind,label] of [
    ['date','Date'],['money','Money'],['name','Name']
   ]){
    for(const limit of [12,32,80]){
     if(block.nearest[kind]<=limit)
      outcome['nearestPAC'+label+'Within'+limit]++;
    }
   }
   outcome.blockDateConflictHolds+=block.rejectedCompetingDate;
   outcome.blockMultiplePACRegistrationHolds+=block.rejectedMultipleRegs;
   outcome.privateBlockCandidates.push(...block.candidateRows);
   outcome.provisionalMultiBaselinePairsBeforeCollision+=block.candidateRows.length;
  }
  const dates=parsePrintedDates(line.text);
  const dollars=numericDollars(line.text);
  if(dates.length)outcome.regAndDateLines++;
  if(dollars.length)outcome.regAndMoneyLines++;
  if(dates.length&&dollars.length)outcome.regDateMoneyLines++;
  let anyFour=false, anyHeader=false;
  for(const row of candidates){
   if(!exactPrintedPacReg(line.text,row.contributorReg)||
    !dates.includes(row.transactionDate)||
    !dollars.includes(moneyToCents(row.amount)))continue;
   const name=distinctNameEvidence(line.text,row.contributor,
    registeredNames.get(row.contributorReg)??'');
   if(!name)continue;
   anyFour=true;const k=key(row);
   cohortMatchKeys.add(k);
   sourceCandidates.add(k+'|'+report.reportVersionId+'|'+report.pageNumber+'|'+li);
   const region=findHeaderRegions(lines,line.y);
   if(region){
    anyHeader=true;
    if(geometryProves(line,row,region,
     registeredNames.get(row.contributorReg)??'')){
      strictHits.add(k+'|'+report.reportVersionId+'|'+
       report.pageNumber+'|'+li);
      outcome.privateQualifiedHits.push({
       key:k,reportVersionId:report.reportVersionId,
       pageNumber:report.pageNumber,tableRow:li
      });
    }
   }
   outcome.privatePositionedCandidates.push({
    key:k,reportVersionId:report.reportVersionId,
    pageNumber:report.pageNumber,lineIndex:li
   });
  }
  if(anyFour)outcome.regDateMoneyNameLines++;
  if(anyHeader)outcome.candidateRowsWith4ColumnHeader++;
 }
 outcome.cohortCandidateRecords=cohortMatchKeys.size;
 outcome.source4FieldCandidates=sourceCandidates.size;
 outcome.positionedGeometryOriginalHitPairs=strictHits.size;
 return outcome;
}
export function safePositionedOriginalSummary({
 cohort,allRows,reports,pageOutcomes,originalBodiesRehashed,
 selectedUniquePages,sourcePagesDeferred,parseErrors
}){
 if(!Array.isArray(cohort)||!Array.isArray(allRows)||
  !Array.isArray(reports)||!Array.isArray(pageOutcomes)||
  cohort.length!==116||allRows.length>50000||
  reports.length>830||pageOutcomes.length>830||
  ![originalBodiesRehashed,selectedUniquePages,sourcePagesDeferred,parseErrors]
   .every(x=>Number.isSafeInteger(x)&&x>=0&&x<=10000))
  throw Error('Malformed or unbounded A1 original text-position summary');
 const selected=new Set(cohort.map(key)),reportIds=new Set(reports.map(x=>
  x.reportVersionId));
 if(selected.size!==116)throw Error('PAC cohort source dedupe mismatch');
 const byRow=new Map(),blockByRow=new Map(),strictByRow=new Map(),
  candidateAnchorsByVersion=new Map();
 const scalar=['positionedItems','discardedItems','sourceLines','pacIdLines',
  'regAndDateLines','regAndMoneyLines','regDateMoneyLines',
  'regDateMoneyNameLines','candidateRowsWith4ColumnHeader',
  'nearestPACDateWithin12','nearestPACDateWithin32',
  'nearestPACDateWithin80','nearestPACMoneyWithin12',
  'nearestPACMoneyWithin32','nearestPACMoneyWithin80',
  'nearestPACNameWithin12','nearestPACNameWithin32',
  'nearestPACNameWithin80','provisionalMultiBaselinePairsBeforeCollision',
  'blockDateConflictHolds','blockMultiplePACRegistrationHolds'];
 const totals=Object.fromEntries(scalar.map(s=>[s,0]));
 let pagesPositioned=0,pagesSparse=0,privateCandidatePairs=0,
  positionQualifiedPairs=0,competingSourceRows=0,
  collisions=0,uncertainReceiving=0;
 const signatures=new Map(),unsafeReceiving=new Set();
 for(const r of allRows){
  if(!REG.test(r.filerReg??'')||!YEAR.test(String(r.year))||
   !HEX.test(r.rowKey??''))throw Error('Malformed receiving committee comparator');
  if(r.sourceConflict===true||!rowValid(r))
   unsafeReceiving.add(r.filerReg+'|'+r.year);
  if(!rowValid(r))continue;
  const sig=[r.filerReg,r.year,r.contributorReg,
   r.transactionDate,moneyToCents(r.amount)].join('|');
  if(!signatures.has(sig))signatures.set(sig,new Set());
  signatures.get(sig).add(key(r));
 }
 for(const outcome of pageOutcomes){
  pagesPositioned+=Number(outcome.a1SourcePositioned===true);
  pagesSparse+=Number(outcome.textLayerTooSparse===true);
  for(const f of scalar){
   if(!Number.isSafeInteger(outcome[f])||outcome[f]<0||outcome[f]>100000)
    throw Error('Unsafe original PDF aggregate diagnostic');
   totals[f]+=outcome[f];
  }
  for(const hit of outcome.privateBlockCandidates??[]){
   if(!reportIds.has(hit.reportVersionId))
    throw Error('Original multiline block outside PDF report registry');
   if(!selected.has(hit.key))continue;
   if(!blockByRow.has(hit.key))blockByRow.set(hit.key,new Set());
   blockByRow.get(hit.key).add(hit.reportVersionId+'|'+
    hit.pageNumber+'|'+hit.anchorLine);
   const versionKey=hit.key+'|'+hit.reportVersionId;
   if(!candidateAnchorsByVersion.has(versionKey))
    candidateAnchorsByVersion.set(versionKey,new Set());
   candidateAnchorsByVersion.get(versionKey).add(
    hit.pageNumber+'|'+hit.anchorLine);
  }
  for(const hit of outcome.privatePositionedCandidates??[]){
   if(!reportIds.has(hit.reportVersionId))
    throw Error('Source candidate missing original report version');
   if(!selected.has(hit.key))continue;
   privateCandidatePairs++;
   if(!byRow.has(hit.key))byRow.set(hit.key,new Set());
   byRow.get(hit.key).add(hit.reportVersionId+'|'+hit.pageNumber+'|'+
    hit.lineIndex);
  }
  for(const hit of outcome.privateQualifiedHits??[]){
   if(!reportIds.has(hit.reportVersionId))
    throw Error('Positioned original hit missing registered report version');
   if(!selected.has(hit.key))continue;
   const row=cohort.find(x=>key(x)===hit.key);
   const sig=[row.filerReg,row.year,row.contributorReg,
    row.transactionDate,moneyToCents(row.amount)].join('|');
   if(unsafeReceiving.has(row.filerReg+'|'+row.year)||
    (signatures.get(sig)?.size??0)!==1){collisions++;continue;}
   positionQualifiedPairs++;
   if(!strictByRow.has(hit.key))strictByRow.set(hit.key,new Set());
   strictByRow.get(hit.key).add(hit.reportVersionId+'|'+hit.pageNumber+'|'+
    hit.tableRow);
  }
 }
 const uniqueSourceVersionsByRow=new Map();
 let privateSingleAnchorVersionCount=0,
  privateRepeatedAnchorVersionCount=0;
 for(const [versionKey,anchors] of candidateAnchorsByVersion){
  if(anchors.size===1)privateSingleAnchorVersionCount++;
  else privateRepeatedAnchorVersionCount++;
 }
 let provisionalWithFullComparator=0,
  provisionalHeldForIncompleteComparator=0,
  provisionalHeldForDuplicateSameSignature=0,
  provisionalWithMultipleVersions=0,
  provisionalWithOneVersion=0;
 for(const [rowKey,locations] of blockByRow){
  const receipt=cohort.find(x=>key(x)===rowKey);
  const group=receipt.filerReg+'|'+receipt.year;
  const sig=[receipt.filerReg,receipt.year,receipt.contributorReg,
   receipt.transactionDate,moneyToCents(receipt.amount)].join('|');
  if(unsafeReceiving.has(group))
   provisionalHeldForIncompleteComparator++;
  else if((signatures.get(sig)?.size??0)!==1)
   provisionalHeldForDuplicateSameSignature++;
  else provisionalWithFullComparator++;
  const versions=new Set([...locations].map(x=>x.split('|')[0]));
  uniqueSourceVersionsByRow.set(rowKey,versions.size);
  if(versions.size>1)provisionalWithMultipleVersions++;
  else provisionalWithOneVersion++;
 }
 const summary={
  schema:POSITIONED_A1_PAC_VERSION,
  originalReportsInCandidateCohort:reports.length,
  originalPdfBodiesShaRehashed:originalBodiesRehashed,
  uniqueOriginalA1RegisteredPacPagesSelected:selectedUniquePages,
  originalPagesDeferredBySafeCap:sourcePagesDeferred,
  originalPdfTextExtractionErrors:parseErrors,
  originalA1PagesWithPositionedItems:pagesPositioned,
  originalPagesWithSparsePositionedText:pagesSparse,
  ...totals,
  originalSameBaselineSourceCandidatePairs:privateCandidatePairs,
  distinctPACContributionsWithPositionedCandidate:byRow.size,
  distinctPACContributionsWithProvisionalMultilineBlock:blockByRow.size,
  sourceProvisionalMultilineBlockPairs:[...blockByRow.values()]
   .reduce((sum,values)=>sum+values.size,0),
  provisionalOriginalReportVersionPairs:candidateAnchorsByVersion.size,
  provisionalOriginalVersionsWithOneAnchor:privateSingleAnchorVersionCount,
  provisionalOriginalVersionsWithMultipleAnchors:privateRepeatedAnchorVersionCount,
  provisionalRowsWithOneCandidateVersion:provisionalWithOneVersion,
  provisionalRowsWithMultipleCandidateVersions:provisionalWithMultipleVersions,
  provisionalRowsWithCompleteComparator:provisionalWithFullComparator,
  provisionalRowsHeldForIncompleteComparator:provisionalHeldForIncompleteComparator,
  provisionalRowsHeldForDuplicateSignature:provisionalHeldForDuplicateSameSignature,
  provisionalRowsPromotedToExactSourceByLayoutIsolation:0,
  sameBaselinePairsWithExplicitColumnsAndComparator:positionQualifiedPairs,
  distinctPACContributionsWithPositionedVerifiedOriginalRow:strictByRow.size,
  canonicalCompetitionOrIncompleteRecipientRowsHeld:collisions,
  receivingCommitteeYearGroupsWithIncompleteComparator:unsafeReceiving.size,
  unresolvedInOriginalCohort:116-strictByRow.size,
  independentlyProvenHistoricalExactVersionPublicBy:0,
  historicalEligibleIssueFinanceFeaturesActivated:0,
  historicalEligibilityOrServingChanged:false
 };
 for(const v of Object.values(summary))
  if(typeof v==='number'&&(!Number.isSafeInteger(v)||v<0||v>10000000))
   throw Error('Unsafe public CFB source-coordinate summary');
 return summary;
}
