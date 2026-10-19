/** Explain existing holds using exact current regulator rows. Never weaken gates. */
import {validDay} from './cfb-report-schedule-raw.mjs';
import {createHash} from 'node:crypto';
/** Include every parsed field and raw CSV column; preserve duplicate copies.
 * CSV row order is not an identity field. This never certifies a PDF row. */
export function originalComparatorRowsetSha(rows){
 if(!Array.isArray(rows)||rows.length>300000)throw Error('Unbounded original rows');
 return createHash('sha256').update(JSON.stringify(rows.map(r=>JSON.stringify(r)).sort())).digest('hex');
}
const key=r=>[r.filerReg,r.year,r.rowKey].join('|');
const reg=s=>/^\d{3,8}$/.test(s||'');
const amount=s=>{const clean=String(s??'').replace(/[$, ]/g,'');if(!/^\d{1,10}(?:\.\d{1,2})?$/.test(clean))return null;const x=Number(clean);return x>0&&Number.isSafeInteger(Math.round(x*100))?Math.round(x*100):null};
const valid=r=>reg(r.filerReg)&&/^202[1-5]$/.test(String(r.year))&&/^[a-f0-9]{64}$/.test(r.rowKey||'')&&reg(r.contributorReg)&&validDay(r.transactionDate)&&amount(r.amount)!==null&&typeof r.contributor==='string'&&r.contributor.length>=5&&!r.sourceConflict;
const categories=new Set(['Individual','Self','Lobbyist','Political Committee/Fund','Party Unit','Candidate Committee','Other','Registered with Hennepin County']);
export function reconcileHeldPacComparators({cohort,allRows,outcomes,originalRows}){
 if(cohort.length!==116||allRows.length>50000||outcomes.length>830||originalRows.length>300000)throw Error('Bounded original comparator scope');
 const candidates=new Set(outcomes.flatMap(o=>(o.privateBlockCandidates||[]).map(h=>h.key)));
 const targets=cohort.filter(r=>candidates.has(key(r)));
 if(targets.length!==25)throw Error('Pinned 25 provisional targets changed');
 const held=targets.filter(t=>allRows.some(r=>r.filerReg===t.filerReg&&r.year===t.year&&!valid(r)));
 if(held.length!==23)throw Error('Pinned 23 comparator holds changed');
 const groups=new Set(held.map(t=>t.filerReg+'|'+t.year));
 const broken=allRows.filter(r=>groups.has(r.filerReg+'|'+r.year)&&!valid(r));
 const sourceIndex=new Map();
 for(const r of originalRows){const k=[r.filerRegistrationNumber,r.year,r.rowKey].join('|');if(!sourceIndex.has(k))sourceIndex.set(k,[]);sourceIndex.get(k).push(r)}
 const types=Object.fromEntries([...categories,'UNKNOWN'].map(x=>[x,0]));
 let exact=0,notObserved=0,mismatch=0,stillMissing=0,sourceHasRegistration=0,originalCopies=0;
 const sourceUnresolved=new Set();
 for(const r of broken){
  const matches=sourceIndex.get(key(r))||[];
  if(!matches.length){notObserved++;sourceUnresolved.add(key(r));continue}
  const s=matches[0];
  if(matches.some(x=>x.transactionDate!==s.transactionDate||amount(x.amount)!==amount(s.amount)||x.contributor!==s.contributor||
    x.contributorType!==s.contributorType||x.contributorRegistrationNumber!==s.contributorRegistrationNumber)||
   s.transactionDate!==r.transactionDate||amount(s.amount)!==amount(r.amount)||s.contributor!==r.contributor||
   (s.contributorRegistrationNumber||'')!==r.contributorReg){mismatch++;sourceUnresolved.add(key(r));continue}
  exact++;originalCopies+=matches.length;types[categories.has(s.contributorType)?s.contributorType:'UNKNOWN']++;
  if(reg(s.contributorRegistrationNumber))sourceHasRegistration++;else stillMissing++;
 }
 return {version:'senate864-pac23-original-comparator-accounting-v1',provisionalTargetTransactions:25,
  comparatorCompleteTargets:2,heldTargetTransactions:23,heldReceivingCommitteeYearGroups:groups.size,
  uniqueUnusableComparatorTransactions:broken.length,exactCurrentRegulatorCanonicalKeyMatches:exact,matchingCurrentRegulatorRowCopies:originalCopies,
  currentOriginalRowNotUniquelyObserved:notObserved,currentOriginalFieldMismatches:mismatch,
  originalRowsStillWithoutRegistration:stillMissing,originalRowsWithRegistration:sourceHasRegistration,
  originalEntityTypes:types,
  targetCasesWithAnyUnobservedOrMismatchedComparator:held.filter(t=>broken.some(r=>r.filerReg===t.filerReg&&r.year===t.year&&sourceUnresolved.has(key(r)))).length,
  originalSourceObservedIn2026NotHistoricalPublication:true,unchangedStrictComparatorHolds:23,
  transactionsPromoted:0,eligibilityWrites:0,noNameBasedRegistrationAssignment:true};
}
