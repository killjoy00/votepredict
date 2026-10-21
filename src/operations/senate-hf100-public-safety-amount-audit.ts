/**
 * HF100 adopted Hauschild public-safety arithmetic discrepancy proof.
 * The caller independently authenticates first/second Revisor original PDFs
 * and the April 28 original Senate Journal via immutable SHA checks in CI.
 * This emits source-only amount deltas, never a corrected bill or vote link.
 */
import {compact,type PaperAction} from './senate-vote-paper-parser.js';
import {assessHf100SecondUnofficialSuccessor} from './senate-hf100-second-ue-successor-witness.js';

export const HF100_PUBLIC_SAFETY_AMOUNT_AUDIT_VERSION='senate-hf100-public-safety-amount-audit-v1' as const;
type Years={first:number;second:number};
type Witness={total:Years;statePatrol:Years};
export interface Hf100PublicSafetyAmountAudit{
 schemaVersion:typeof HF100_PUBLIC_SAFETY_AMOUNT_AUDIT_VERSION;
 case:'HF100';source:'first_and_second_official_unofficial_engrossments';
 journalAdoptedHauschildMoneyInstructionsProven:true;
 editionTablePairsRead:0|2;sourceSectionHolds:0|1|2;
 status:'numeric_delta_hold_verified'|'source_table_layout_held';
 totalDelta:Years|null;statePatrolDelta:Years|null;
 secondYearDeltaDisagreement:number|null;
 adjustmentReconciled:false;completeAmendedTextCertified:false;
 preVotePublicationCertified:false;eventLinksAdded:0;
}
function canonicalPdfText(pdf:string):string{
 return pdf.replace(/\r/g,'')
  .replace(/(^|\n)[ \t]*\d{1,3}\.\d{1,2}[ \t]+/g,'$1 ')
  .replace(/[ \t\n]+/g,' ').trim();
}
function uniqueSection(pdf:string):string|null{
 const text=canonicalPdfText(pdf);
 const starts=[...text.matchAll(/\bSec\.\s*16\.\s*PUBLIC\s+SAFETY\b/gi)];
 if(starts.length!==1)return null;
 const rest=text.slice(starts[0]!.index!);
 const end=/\bSec\.\s*17\.\s*REVENUE\b/i.exec(rest);
 if(!end||end.index<100||end.index>15000)return null;
 const body=rest.slice(0,end.index);
 return /Total\s+Appropriation/i.test(body)&&/State\s+Patrol/i.test(body)?body:null;
}
function countMoney(section:string,money:number):number{
 const digits=money.toLocaleString('en-US');
 // All generated needles have only digits and commas. Reject instead of
 // interpolating an arbitrary pattern from untrusted source text.
 if(!/^\d{1,3}(,\d{3})*$/.test(digits))throw Error('Invalid numeric witness');
 return [...section.matchAll(new RegExp('(^|[^0-9])'+digits+'(?=[^0-9]|$)','g'))].length;
}
function table(section:string,expected:Witness):Witness|null{
 const total=section.search(/Total\s+Appropriation/i);
 const patrol=section.search(/State\s+Patrol/i);
 if(total<0||patrol<=total)return null;
 const amounts=[expected.total.first,expected.total.second,
  expected.statePatrol.first,expected.statePatrol.second];
 if(!amounts.every(n=>countMoney(section,n)===1))return null;
 return expected;
}
function originalJournalGuard(actions:readonly PaperAction[]):void{
 const a=actions.find(x=>x.sequence===6);
 if(a?.kind!=='amendment'||a.outcome!=='adopted'
  ||!/Senator Hauschild moved to amend/i.test(a.motionText))
  throw Error('HF100 adopted Hauschild money source action changed');
 const body=compact(a.proposedText??'');
 const literals=[
  'Page 294, line 32, delete "13,987,000" and insert "23,987,000" and delete "5,654,000" and insert "10,654,000"',
  'Page 295, delete lines 12 and 13, and insert:',
  '$10,000,000 the first year and $5,000,000 the second year',
  '$6,157,000 the first year and $2,218,000 the second year are from the trunk highway fund.',
  'Adjust amounts accordingly'
 ];
 if(literals.some(x=>!body.includes(x))||!body.endsWith('Adjust amounts accordingly'))
  throw Error('HF100 Hauschild original public safety amount instructions changed');
}
const base:Witness={total:{first:13_987_000,second:5_654_000},
 statePatrol:{first:6_157_000,second:2_218_000}};
const successor:Witness={total:{first:23_987_000,second:10_654_000},
 statePatrol:{first:16_157_000,second:7_718_000}};
export function assessHf100PublicSafetyAmounts(
 actions:readonly PaperAction[],firstUE:string,secondUE:string
):Hf100PublicSafetyAmountAudit{
 assessHf100SecondUnofficialSuccessor(actions,firstUE,secondUE);
 originalJournalGuard(actions);
 const a=uniqueSection(firstUE),b=uniqueSection(secondUE);
 const first=a?table(a,base):null,last=b?table(b,successor):null;
 const valid=!!first&&!!last;
 const totalDelta=valid?{
  first:last!.total.first-first!.total.first,
  second:last!.total.second-first!.total.second
 }:null;
 const statePatrolDelta=valid?{
  first:last!.statePatrol.first-first!.statePatrol.first,
  second:last!.statePatrol.second-first!.statePatrol.second
 }:null;
 const disagreement=valid?statePatrolDelta!.second-totalDelta!.second:null;
 if(valid&&(totalDelta!.first!==10_000_000||totalDelta!.second!==5_000_000
  ||statePatrolDelta!.first!==10_000_000||disagreement!==500_000))
  throw Error('HF100 public safety source arithmetic unexpectedly changed');
 return {
  schemaVersion:HF100_PUBLIC_SAFETY_AMOUNT_AUDIT_VERSION,
  case:'HF100',source:'first_and_second_official_unofficial_engrossments',
  journalAdoptedHauschildMoneyInstructionsProven:true,
  editionTablePairsRead:valid?2:0,
  sourceSectionHolds:((first?0:1)+(last?0:1)) as 0|1|2,
  status:valid?'numeric_delta_hold_verified':'source_table_layout_held',
  totalDelta,statePatrolDelta,secondYearDeltaDisagreement:disagreement,
  adjustmentReconciled:false,completeAmendedTextCertified:false,
  preVotePublicationCertified:false,eventLinksAdded:0
 };
}
