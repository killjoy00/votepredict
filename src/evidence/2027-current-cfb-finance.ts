import {createHash} from 'node:crypto';
import {parseCfbCurrentReportGrid,cfbReportViewerUrl} from './cfb-current-report-acquisition';
import type {CfbReportViewerReference} from './cfb-report-pdf-proof';
export const FINANCE_LIMITS=Object.freeze({incoming:12,returning:12,requests:80,maxGridBytes:2*1024*1024,maxPdfBytes:4*1024*1024,maxBytes:48*1024*1024,runMs:240000});
export const FINANCE_ROSTER_SHA='3b062058cbe77d2ff6caad8719a65535ad75849d48e0c627c9b460ef48df17bd';
export const FINANCE_RECEIPT_TYPE='application/vnd.votepredict.2027-preseason-finance-report-review+json';
export const FINANCE_EVENT_TYPE='application/vnd.votepredict.2027-preseason-finance-collection+json';
export const FINANCE_MARKER='VOTEPREDICT_2027_CURRENT_CFB_FINANCE_PILOT_20261126';
type Member={lrlId:string;seat:string;name:string;electionName:string};
export type FinanceMember=Member&{cohort:'incoming'|'returning'};
export type FinanceRegistration={registrationNumber:string;seat:string;nameKey:string;registeredOn:string;terminatedOn:string|null};
export function financeRoster(raw:string,pilot:{summary:{rosterSha256:string};targets:Member[]}):FinanceMember[]{
  if(createHash('sha256').update(raw).digest('hex')!==FINANCE_ROSTER_SHA||pilot.summary.rosterSha256!==FINANCE_ROSTER_SHA)throw Error('Finance roster digest mismatch');
  const r=JSON.parse(raw) as {session:string;complete:boolean;members:Member[]};
  if(r.session!=='2027-2028'||!r.complete||r.members.length!==201||new Set(r.members.map(m=>m.lrlId)).size!==201||new Set(r.members.map(m=>m.seat)).size!==201||pilot.targets.length!==51||new Set(pilot.targets.map(m=>m.lrlId)).size!==51)throw Error('Unexpected finance roster scope');
  for(const t of pilot.targets)if(!r.members.some(m=>m.lrlId===t.lrlId&&m.seat===t.seat&&m.name===t.name))throw Error('Incoming identity mismatch');
  const ids=new Set(pilot.targets.map(m=>m.lrlId));
  return r.members.map(m=>({...m,cohort:ids.has(m.lrlId)?'incoming':'returning'}));
}
function cleanName(s:string){
  const v=s.replace(/<[^>]+>/g,' ').replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/&#39;|&apos;/gi,"'").replace(/&#(\d+);/g,(_,n:string)=>{const k=Number(n);return k>=32&&k<=0x10ffff?String.fromCodePoint(k):' ';}).trim();
  const comma=v.split(',');const natural=comma.length===2?comma[1]+' '+comma[0]:v;
  return natural.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’.-]/g,'').replace(/[^a-z0-9 ]+/g,' ').trim().replace(/\s+/g,' ');
}
function day(s:unknown){
  if(typeof s!=='string')return null;const m=/^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z?)?$/.exec(s.trim());
  if(!m)return null;const d=new Date(m[1]+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===m[1]?m[1]:null;
}
function seat(office:unknown,district:unknown){
  const d=String(district??'').trim().toUpperCase();
  const m=/^0*([1-9]\d?)([AB]?)$/.exec(d);
  if(!m||Number(m[1])>67)return null;
  return office==='House'&&m[2]?'house:'+Number(m[1])+m[2]:office==='Senate'&&!m[2]?'senate:'+Number(m[1]):null;
}
function grid(payload:unknown){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('CFB grid object invalid');
  const r=payload as {cols:unknown;data:unknown};
  if(!Array.isArray(r.cols)||r.cols.some(x=>typeof x!=='string')||new Set(r.cols).size!==r.cols.length||!r.data||typeof r.data!=='object'||Array.isArray(r.data))throw Error('CFB grid schema invalid');
  const cols=r.cols as string[];const rows=Object.values(r.data as Record<string,unknown>).flatMap(v=>{if(!Array.isArray(v)||v.some(x=>!Array.isArray(x)||x.length<cols.length))throw Error('CFB grid row invalid');return v as unknown[][];});
  if(!rows.length||rows.length>2000)throw Error('CFB grid row bound');return {cols,rows};
}
export function parseFinanceRegistry(raw:unknown){
  const {cols,rows}=grid(raw);const keys=['RegisteredEntityID','CandidateFullName','OfficeSoughtFullName','District','RegistrationDate','TerminationDate'];
  const indexes=keys.map(k=>cols.indexOf(k));if(indexes.some(i=>i<0))throw Error('CFB official candidate identity fields absent');
  const result:FinanceRegistration[]=[];let malformed=0;const seen=new Map<string,string>();
  for(const r of rows){
    const [reg,n,office,d,registered,terminated]=indexes.map(i=>r[i]);
    if(office!=='House'&&office!=='Senate')continue;
    const id=String(reg??'').trim(),s=seat(office,d),nameKey=typeof n==='string'?cleanName(n):'',registeredOn=day(registered),terminatedOn=day(terminated);
    if(!/^\d{3,8}$/.test(id)||!s||!nameKey||nameKey.length>110||!registeredOn||(terminated!==null&&terminated!==undefined&&terminated!==''&&!terminatedOn)||(terminatedOn&&terminatedOn<registeredOn)){malformed++;continue;}
    const row={registrationNumber:id,seat:s,nameKey,registeredOn,terminatedOn};const value=JSON.stringify(row);
    if(seen.has(id)&&seen.get(id)!==value)throw Error('Conflicting official CFB registration rows');
    if(!seen.has(id)){seen.set(id,value);result.push(row);}
  }
  return {rows:result,rawRows:rows.length,malformedLegislativeRows:malformed,columns:cols};
}
function rosterSeat(v:string){const m=/^(house|senate):0*([1-9]\d?)([AB]?)$/.exec(v);return m?m[1]+':'+Number(m[2])+m[3]:v;}
export function matchFinanceRoster(members:readonly FinanceMember[],registrations:readonly FinanceRegistration[]){
  const matches:Array<{member:FinanceMember;registration:FinanceRegistration}>=[];
  const gaps:Array<{lrlId:string;seat:string;cohort:FinanceMember['cohort'];reason:string}>=[];
  for(const m of members){
    const names=new Set([cleanName(m.name),cleanName(m.electionName)]);
    const found=registrations.filter(r=>r.seat===rosterSeat(m.seat)&&names.has(r.nameKey));
    const active=found.filter(r=>!r.terminatedOn);const eligible=active.length?active:found;
    if(eligible.length!==1){gaps.push({lrlId:m.lrlId,seat:m.seat,cohort:m.cohort,reason:eligible.length?'ambiguous_committee':'no_exact_name_and_district'});continue;}
    matches.push({member:m,registration:eligible[0]});
  }
  if(new Set(matches.map(m=>m.registration.registrationNumber)).size!==matches.length)throw Error('Registration mapped to multiple people');
  return {matches,gaps};
}
export function currentFinanceReference(raw:unknown,registration:string){
  return selectCurrentFinanceReference(parseCfbCurrentReportGrid(raw).references,registration);
}
export function selectCurrentFinanceReference(references:readonly CfbReportViewerReference[],registration:string){
  const refs=references.filter(r=>r.registrationNumber===registration&&r.filingYear===2026&&['26','2026'].includes(r.year)&&r.type==='pcc');
  // The Board currently advertises its 2026 pre-general list. Do not assume
  // every report on it is the latest version, or silently skip a later report.
  const pre=refs.filter(r=>/pre[\s-]*general/i.test(r.reportName));
  if(!pre.length)return {reference:null,reason:'no_2026_pre_general_reference'};
  if(refs.some(r=>/post[\s-]*general|year[\s-]*end|final|termination/i.test(r.reportName)))return {reference:null,reason:'later_or_final_report_requires_review'};
  if(new Set(pre.map(r=>[r.year,r.type,r.period,r.se].join('|'))).size!==1)return {reference:null,reason:'ambiguous_pre_general_period'};
  const selected=[...pre].sort((a,b)=>b.amendment-a.amendment);
  if(!Number.isInteger(selected[0].amendment)||selected[0].amendment<0||selected[0].amendment>100||!/^[-a-zA-Z0-9]{1,12}$/.test(selected[0].period)||!/^[-a-zA-Z0-9]{1,12}$/.test(selected[0].se))return {reference:null,reason:'invalid_reference'};
  return {reference:selected[0],reason:null};
}
export function selectFinancePilot<T extends {member:FinanceMember;reference:CfbReportViewerReference}>(rows:readonly T[],prior:ReadonlySet<string>=new Set()){
  const fresh=rows.filter(r=>!prior.has(r.member.lrlId)).sort((a,b)=>Number(a.member.lrlId)-Number(b.member.lrlId));
  return [...fresh.filter(r=>r.member.cohort==='incoming').slice(0,FINANCE_LIMITS.incoming),...fresh.filter(r=>r.member.cohort==='returning').slice(0,FINANCE_LIMITS.returning)];
}
function reportDate(s:string){
  let m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());if(m)return day(m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0'));
  const d=new Date(s.trim()+' 00:00:00 UTC');return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):null;
}
export function reviewFinanceSummary(text:string,reference:CfbReportViewerReference,observedAt:string){
  const t=text.replace(/\u0000/g,'');const flat=t.slice(0,14000).replace(/\s+/g,' ');
  if(!/Report\s+of\s+Receipts\s+and\s+Expenditures\s+for\s+Principal\s+Campaign\s+Committee/i.test(flat))throw Error('Official candidate report heading absent');
  const reg=flat.match(/Registration\s+Number\s*:?\s*(\d{3,8})\b/i)?.[1];
  const period=flat.match(/Period\s+Covered\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const received=flat.match(/Received\s+by\s+the\s+Board\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
  const start=period?reportDate(period[1]):null,end=period?reportDate(period[2]):null,filed=received?reportDate(received[1]):null;
  if(reg!==reference.registrationNumber||!start||end!=='2026-10-19'||!filed||start>end||filed<end||filed>observedAt.slice(0,10))throw Error('Candidate report identity/coverage/receipt date unverified');
  const pos=t.search(/Committee\s+Transaction\s+Summary/i);if(pos<0)throw Error('Official summary not found');
  const block=t.slice(pos,pos+11500).split(/\r?\n/);
  function cells(re:RegExp){
    const lines=block.filter(l=>re.test(l));if(lines.length!==1)return null;
    const amounts=[...lines[0].matchAll(/(?<![\w.])(-?\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?!\d)/g)].map(m=>Number(m[1].replace(/[$,\s]/g,''))*100).map(Math.round);
    return amounts.length&&amounts.length<=3&&amounts.every(Number.isSafeInteger)?amounts:null;
  }
  const receiptCells=cells(/\btotal\s+receipts\b/i),disbursementCells=cells(/\btotal\s+expenditures\s+and\s+disbursements\b/i),balanceCells=cells(/\bending\s+cash\s+balance\b/i),loanCells=cells(/\btotal\s+outstanding\s+balance\s+of\s+all\s+loans\b/i);
  const total=(a:number[]|null)=>a?.length===3&&a[0]+a[1]===a[2]?a[2]:null;
  return {registrationNumber:reg,reportUrl:cfbReportViewerUrl(reference),coverageStartOn:start,coverageEndOn:end,boardReceivedOn:filed,receiptCellsCents:receiptCells,disbursementCellsCents:disbursementCells,endingCashCellsCents:balanceCells,outstandingLoanCellsCents:loanCells,totalReceiptsCents:total(receiptCells),totalDisbursementsCents:total(disbursementCells),endingCashBalanceCents:balanceCells?.length===1?balanceCells[0]:null,outstandingLoanBalanceCents:loanCells?.length===1?loanCells[0]:null,aggregateScope:'printed_report_summary_not_transaction_reconciliation',exactHistoricalPublicBy:null};
}
