// Report-level aggregate rows only. Never scan donor schedules for money.
export const FINANCE_DETAIL_TYPE='application/vnd.votepredict.2027-preseason-finance-summary-validation+json';
export const FINANCE_DETAIL_MARKER='VOTEPREDICT_2027_CFB_EXACT_ORIGINAL_SUMMARY_20261127';
const amount=/(?<![\w.\d])(\(?-?\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\)?)(?![\w.\d])/g;
function cents(s:string):number|null{
  const v=s.replace(/[$,\s]/g,'');
  if(v.startsWith('(')!==v.endsWith(')')||/^\(-/.test(v))return null;
  const negative=v.startsWith('-')||v.startsWith('(');
  const parts=v.replace(/^[-(]|[)]$/g,'').split('.');
  if(parts.length!==2||!/^\d+$/.test(parts[0])||!/^\d{2}$/.test(parts[1]))return null;
  const n=Number(parts[0])*100+Number(parts[1]);
  return Number.isSafeInteger(n)?negative?-n:n:null;
}
type Row={number:string;label:string;amounts:number[]|null};
function rows(lines:string[]):Row[]{
  const out:Row[]=[];let active:{number:string;lines:string[]}|null=null;
  function finish(){
    if(!active)return;
    const full=active.lines.join(' ');
    const matches=[...full.matchAll(amount)];
    const values=matches.map(m=>cents(m[1]));
    out.push({number:active.number,label:full.replace(amount,' ').replace(/\bSum\s+#\d+\s+(?:to|thru|through)\s+#\d+\b/gi,' ').replace(/\s+/g,' ').trim(),amounts:values.every(x=>x!==null)?values as number[]:null});
    active=null;
  }
  for(const line of lines){
    // A schedule heading ends the aggregate section; a printed Schedule
    // reference within a numbered summary row does not.
    if(/^\s*(?:Schedule\s+[A-Z]\d|Page\s+\d+\b|Campaign Finance Reporter|Certification\b|Affidavit\b)/i.test(line)){finish();break;}
    const m=/^\s*(\d{1,2}[A-Z]?)\s+(\S.*)$/i.exec(line);
    if(m){finish();active={number:m[1].toUpperCase(),lines:[m[2]]};}
    else if(active&&line.trim()){
      if(active.lines.length>=4){finish();continue;}
      active.lines.push(line.trim());
    }
  }
  finish();return out;
}
export function recoverFinanceSummary(textWithPageBreaks:string,priorReceiptsCents:number){
  if(!Number.isSafeInteger(priorReceiptsCents))throw Error('Prior verified receipt total missing');
  const pages=textWithPageBreaks.replace(/\u0000/g,'').split('\f').slice(0,6);
  const summaries=pages.filter(p=>/^\s*Committee\s+Transaction\s+Summary\s*$/im.test(p));
  const loanPages=pages.filter(p=>/^\s*(?:Notes,\s*Loans,?\s*(?:and|&)\s*Unpaid Bills Summary|Summary of Notes,\s*Loans,?\s*(?:and|&)\s*Unpaid Bills)\s*$/im.test(p));
  const all=rows(summaries.length===1?summaries[0].split(/\r?\n/):[]);
  const hasDisbursementHeader=summaries.length===1&&/Cash\s+Unpaid\s+Bills\s+In[- ]kind\s+Total/i.test(summaries[0].replace(/\s+/g,' '));
  const openingRows=all.filter(r=>r.number==='1'&&/^Beginning cash balance\b/i.test(r.label));
  const receiptRows=all.filter(r=>r.number==='10'&&/^Total Receipts\b/i.test(r.label));
  const spendingRows=all.filter(r=>['17','19'].includes(r.number)&&/^Total Expenditures (?:and|&) Disbursements\b/i.test(r.label));
  const cashRows=all.filter(r=>['18','20'].includes(r.number)&&/^Ending cash balance\b/i.test(r.label));
  const loanRows=[...all,...loanPages.flatMap(p=>rows(p.split(/\r?\n/)))].filter(r=>/^(?:Total outstanding balance of all loans|Total outstanding balance of loans)\b/i.test(r.label));
  const one=(r:Row[])=>r.length===1?r[0].amounts:null;
  const o=one(openingRows),r=one(receiptRows),s=one(spendingRows),b=one(cashRows),l=one(loanRows);
  const receiptsAgree=r?.length===3&&r[0]+r[1]===r[2]&&r[2]===priorReceiptsCents;
  const spendAgree=!!(receiptsAgree&&hasDisbursementHeader&&s?.length===4&&s[0]+s[1]+s[2]===s[3]);
  const cashAgree=!!(spendAgree&&o?.length===1&&b?.length===1&&r&&s&&o[0]+r[0]-s[0]===b[0]&&
    cashRows[0].number===String(Number(spendingRows[0].number)+1));
  return {
    totalReceiptsCents:receiptsAgree?r![2]:null,
    cashReceiptsCents:receiptsAgree?r![0]:null,
    inKindReceiptsCents:receiptsAgree?r![1]:null,
    totalDisbursementsCents:spendAgree?s![3]:null,
    cashDisbursementsCents:spendAgree?s![0]:null,
    unpaidBillsDisbursementsCents:spendAgree?s![1]:null,
    inKindDisbursementsCents:spendAgree?s![2]:null,
    beginningCashBalanceCents:cashAgree?o![0]:null,
    endingCashBalanceCents:cashAgree?b![0]:null,
    // A single explicitly labeled original loan summary amount is a reported
    // balance, not independent debt reconciliation; do not infer missing zero.
    reportedOutstandingLoanBalanceCents:receiptsAgree&&l?.length===1?l[0]:null,
    aggregateScope:'printed_report_summary_not_transaction_reconciliation',
    diagnostics:{summaryPages:summaries.length,loanSummaryPages:loanPages.length,hasDisbursementHeader,openingRows:openingRows.length,receiptRows:receiptRows.length,spendingRows:spendingRows.length,cashRows:cashRows.length,loanRows:loanRows.length,openingCells:o?.length??0,receiptCells:r?.length??0,spendingCells:s?.length??0,cashCells:b?.length??0,loanCells:l?.length??0,receiptsAgree:!!receiptsAgree,spendingArithmeticVerified:spendAgree,cashArithmeticVerified:cashAgree},
  };
}

// This diagnostic is deliberately vocabulary-only: no literal amounts,
// names, addresses, arbitrary text or schedule contents leave the worker.
export const FINANCE_LAYOUT_MARKER='VOTEPREDICT_2027_CFB_EXACT_ORIGINAL_LAYOUT_DIAGNOSTIC_20261127';
const layoutVocabulary=new Set(('begin beginning opening start starting initial cash balance balances on hand as of at end ending closing year period report receipts receipt expenditures expenditure spending disbursements disbursement total subtotal outstanding loans loan notes note unpaid bills bill payment payments paid in kind contributions contribution transfers transfer other from to through and or all for by sum less add plus minus net funds amount amounts schedule reported previous current same').split(' '));
export function diagnoseFinanceLayout(text:string){
  const pages=text.replace(/\u0000/g,'').split('\f').slice(0,6);
  const matching=pages.filter(p=>/^\s*Committee\s+Transaction\s+Summary\s*$/im.test(p));
  if(matching.length!==1)return {summaryPages:matching.length,lines:[]};
  const source=matching[0].split(/\r?\n/);
  const heading=source.findIndex(l=>/^\s*Committee\s+Transaction\s+Summary\s*$/i.test(l));
  const lines=source.slice(heading+1,heading+121);
  const boundary=lines.findIndex(l=>/^\s*(?:Schedule\s+[A-Z]\d|Campaign Finance Reporter|Certification\b|Affidavit\b)/i.test(l));
  const bounded=boundary===-1?lines:lines.slice(0,boundary);
  const interesting=new Set<number>();
  for(let i=0;i<bounded.length;i++){
    if(/\b(?:cash|balance|receipts?|expenditures?|disbursements?|loans?|notes?|unpaid)\b/i.test(bounded[i])){
      for(let j=Math.max(0,i-1);j<=Math.min(bounded.length-1,i+1);j++)interesting.add(j);
    }
  }
  return {summaryPages:1,lines:[...interesting].sort((a,b)=>a-b).filter(i=>bounded[i].trim()).map(i=>{
    const line=bounded[i];
    return {lineIndex:i,rowPrefix:/^\s*(\d{1,2}[A-Z]?)\s+/i.exec(line)?.[1]?.toUpperCase()??null,
      labelTokens:(line.replace(amount,' ').toLowerCase().match(/[a-z]+/g)??[]).filter(t=>layoutVocabulary.has(t)).slice(0,24),
      moneyCells:[...line.matchAll(amount)].length};
  })};
}

// Exact electronic layout observed on all 24 originals in protected run
// 46060153487. No scan of arbitrary pages, no guessing across wrapped rows.
export const FINANCE_DETAIL_V2_TYPE='application/vnd.votepredict.2027-preseason-finance-summary-validation-v2+json';
export const FINANCE_DETAIL_V2_MARKER='VOTEPREDICT_2027_CFB_EXACT_ORIGINAL_SUMMARY_V2_20261127';
export function recoverFinanceSummaryV2(text:string,priorReceiptsCents:number){
  const legacy=recoverFinanceSummary(text,priorReceiptsCents);
  const pages=text.replace(/\u0000/g,'').split('\f').slice(0,6);
  const summaries=pages.filter(p=>/^\s*Committee\s+Transaction\s+Summary\s*$/im.test(p));
  const page=summaries.length===1?summaries[0].split(/\r?\n/):[];
  const heading=page.findIndex(l=>/^\s*Committee\s+Transaction\s+Summary\s*$/i.test(l));
  const after=heading<0?[]:page.slice(heading+1,heading+121);
  const boundary=after.findIndex(l=>/^\s*(?:Schedule\s+[A-Z]\d|Campaign Finance Reporter|Certification\b|Affidavit\b)/i.test(l));
  const lines=boundary<0?after:after.slice(0,boundary);
  // Use exactly the same safe label projection as the protected layout
  // diagnostic. Full literal labels were not retained by that diagnostic:
  // punctuation, footnotes, and words outside its vocabulary must not be
  // guessed from synthetic text. Row positions, uniqueness, cell counts,
  // prior receipt reproduction and arithmetic remain mandatory.
  const tokenLabel=(i:number)=>(lines[i]??'').replace(amount,' ').toLowerCase()
    .match(/[a-z]+/g)?.filter(t=>layoutVocabulary.has(t)).join(' ')??'';
  const matchesLabel=(i:number,expected:string)=>tokenLabel(i)===expected;
  const money=(i:number,n:number)=>{
    const cells=[...(lines[i]??'').matchAll(amount)].map(m=>cents(m[1]));
    return cells.length===n&&cells.every(x=>x!==null)?cells as number[]:null;
  };
  const prefix=(l:string)=>/^\s*(\d{1,2}[A-Z]?)\s+\S/i.exec(l)?.[1]?.toUpperCase();
  const unique=(i:number,id:string)=>prefix(lines[i]??'')===id&&lines.filter(l=>prefix(l)===id).length===1;
  const sumEquals=(a:readonly number[],b:number)=>{
    const s=a.reduce((x,y)=>x+y,0);return Number.isSafeInteger(s)&&s===b;
  };
  const receiptLabel=unique(23,'10')&&matchesLabel(6,'receipts cash in kind total')&&matchesLabel(23,'total receipts sum to');
  const openingLabel=matchesLabel(2,'beginning cash balance')&&matchesLabel(4,'same as previous year ending cash balance')&&money(4,0)!==null;
  const headerLabel=matchesLabel(25,'disbursements cash unpaid bills in kind total');
  const layout=lines.length>=55&&receiptLabel&&headerLabel;
  const o=layout&&openingLabel?money(2,1):null;
  const r=layout?money(23,3):null;
  const spendLabel=unique(41,'19')&&matchesLabel(40,'total expenditures and')&&
    matchesLabel(41,'sum to')&&matchesLabel(42,'disbursements')&&money(40,0)!==null&&money(42,0)!==null;
  const spend=layout&&spendLabel?money(41,4):null;
  const cashLabel=unique(44,'20')&&matchesLabel(43,'ending cash')&&matchesLabel(44,'balance on')&&money(43,0)!==null;
  const ending=layout&&cashLabel?money(44,1):null;
  const loanLabel=(i:number,id:string,qualifier:string)=>unique(i,id)&&matchesLabel(i,'total outstanding balance of all loans '+qualifier);
  const loanALabel=loanLabel(48,'21A','current year');
  const loanBLabel=loanLabel(49,'21B','year to year');
  const loanCLabel=loanLabel(50,'21C','sum');
  const loanA=layout&&loanALabel?money(48,1):null;
  const loanB=layout&&loanBLabel?money(49,1):null;
  const loanC=layout&&loanCLabel?money(50,1):null;
  const receiptAgree=!!(r&&sumEquals(r.slice(0,2),r[2])&&r[2]===priorReceiptsCents&&
    legacy.totalReceiptsCents===r[2]&&legacy.cashReceiptsCents===r[0]&&legacy.inKindReceiptsCents===r[1]);
  const spendAgree=!!(receiptAgree&&spend&&sumEquals(spend.slice(0,3),spend[3]));
  const cashAgree=!!(spendAgree&&o&&ending&&r&&spend&&sumEquals([o[0],r[0],-spend[0]],ending[0]));
  const loanAgree=!!(receiptAgree&&loanA&&loanB&&loanC&&sumEquals([loanA[0],loanB[0]],loanC[0]));
  return {...legacy,
    // Keep already verified receipt fields even if an unsupported layout is held.
    totalDisbursementsCents:spendAgree?spend![3]:null,
    cashDisbursementsCents:spendAgree?spend![0]:null,
    unpaidBillsDisbursementsCents:spendAgree?spend![1]:null,
    inKindDisbursementsCents:spendAgree?spend![2]:null,
    beginningCashBalanceCents:cashAgree?o![0]:null,
    endingCashBalanceCents:cashAgree?ending![0]:null,
    reportedOutstandingLoanBalanceCents:loanAgree?loanC![0]:null,
    diagnostics:{...legacy.diagnostics,observedElectronicLayout:layout,receiptLabelVerified:receiptLabel,openingLabelVerified:openingLabel,disbursementHeaderVerified:headerLabel,spendingLabelVerified:spendLabel,cashLabelVerified:cashLabel,loanALabelVerified:loanALabel,loanBLabelVerified:loanBLabel,loanCLabelVerified:loanCLabel,
      openingCells:o?.length??0,receiptCells:r?.length??0,spendingCells:spend?.length??0,cashCells:ending?.length??0,
      loanCells:loanC?.length??0,receiptsAgree:receiptAgree,spendingArithmeticVerified:spendAgree,
      cashArithmeticVerified:cashAgree,loanArithmeticVerified:loanAgree}
  };
}


// One explicitly reviewed archive batch at a time. Never select "latest" or
// rerun a completed batch merely because another batch is now available.
export const FINANCE_DETAIL_EXPANSION_MARKER='VOTEPREDICT_2027_CFB_EXACT_ORIGINAL_EXPANSION_V2_20261128';
export const FINANCE_DETAIL_INITIAL_SOURCE_RUN='46037317625:1';
export function selectFinanceRecoveryMode(message:string){
  const layoutMode=message.includes(FINANCE_LAYOUT_MARKER);
  const recoveryMode=message.includes(FINANCE_DETAIL_MARKER);
  const v2Mode=message.includes(FINANCE_DETAIL_V2_MARKER);
  const expansionMode=message.includes(FINANCE_DETAIL_EXPANSION_MARKER);
  if(Number(layoutMode)+Number(recoveryMode)+Number(v2Mode)+Number(expansionMode)!==1)throw Error('Exactly one finance operation marker required');
  const selectorLines=message.split(/\r?\n/).filter(l=>l.includes('VOTEPREDICT_CFB_SOURCE_RUN'));
  if(!expansionMode){
    if(selectorLines.length)throw Error('Unexpected finance source run selector');
    return {layoutMode,recoveryMode,v2Mode,expansionMode,sourceRun:FINANCE_DETAIL_INITIAL_SOURCE_RUN};
  }
  const markers=message.split(/\r?\n/).filter(l=>l===FINANCE_DETAIL_EXPANSION_MARKER);
  const match=selectorLines.length===1?/^VOTEPREDICT_CFB_SOURCE_RUN=(\d{1,20}:1)$/.exec(selectorLines[0]):null;
  if(markers.length!==1||!match||match[1]===FINANCE_DETAIL_INITIAL_SOURCE_RUN)throw Error('Invalid finance expansion source run selector');
  return {layoutMode,recoveryMode,v2Mode,expansionMode,sourceRun:match[1]};
}
