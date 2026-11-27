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
