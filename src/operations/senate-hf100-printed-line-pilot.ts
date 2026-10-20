/** Source-only, fail-closed HF100 first unofficial engrossment printed-line pilot.
 * Source journal and Revisor PDF digests MUST be verified by the caller.
 * This tests local anchor operations only. It does not create an amended bill,
 * validate a composite amendment, establish publication timing or link votes.
 */
import {compact,type PaperAction} from './senate-vote-paper-parser.js';

export const HF100_FIRST_UE_PDF='https://www.revisor.mn.gov/bills/93/2023/0/HF/100/versions/ue/1/pdf/';
export const HF100_PRINTED_LINE_PILOT_VERSION='senate-hf100-printed-line-pilot-v1' as const;

export interface Hf100PrintedLinePilot {
 schemaVersion:typeof HF100_PRINTED_LINE_PILOT_VERSION;
 case:'HF100';base:'first_unofficial_engrossment';
 originalActions:8;adoptedAmendments:4;rejectedAmendmentsExcluded:1;
 printedBaseLinesVerified:5;
 partialPortInsertionsVerified:4;
 completeHoffmanLineReplacementsVerified:2;
 fullyCheckedAdoptedAmendments:1;
 adoptedAmendmentsStillHeldForCompositeApplication:3;
 allFourAdoptedAmendmentsApplied:false;
 completeAssembledBillText:false;
 preVotePublicationProven:false;
 eventLinksAdded:0;
}

/** No fallback to nearest lines or substring searches across pages. */
export function exactPrintedBillLine(pdfText:string,page:number,line:number):string {
 if(!Number.isInteger(page)||!Number.isInteger(line)||page<1||line<1)
  throw Error('Invalid Revisor printed-line coordinate');
 const re=new RegExp('(?:^|\\n)[ \\t]*'+page+'\\.'+line+'[ \\t]+([^\\r\\n]+)','g');
 const matches=[...pdfText.replace(/\r/g,'').matchAll(re)];
 if(matches.length!==1)
  throw Error('Revisor printed-line coordinate missing or repeated');
 const result=matches[0]![1]!.trim();
 if(!result||result.length>500)throw Error('Revisor printed-line body unavailable or unbounded');
 return result;
}

/** Avoid accidental matching of 800 inside 1800 or eight inside eighteenth. */
export function literalAnchorPositions(line:string,needle:string):number[]{
 if(!needle||needle.length>160)throw Error('Invalid literal line anchor');
 const positions:number[]=[];
 for(let at=0;;){
  const index=line.indexOf(needle,at);
  if(index<0)break;
  const before=index?line[index-1]!:'';const after=line[index+needle.length]??'';
  if(!/[A-Za-z0-9]/.test(before)&&!/[A-Za-z0-9]/.test(after))positions.push(index);
  at=index+1;
 }
 return positions;
}
export function insertBeforeNthPrintedAnchor(line:string,needle:string,insertion:string,
 ordinal:number,requiredOccurrences:number):string {
 const indices=literalAnchorPositions(line,needle);
 if(!Number.isInteger(ordinal)||ordinal<1||indices.length!==requiredOccurrences
  ||ordinal>indices.length||!insertion.trim())
  throw Error('Printed-line insertion anchor count or ordinal is not uniquely proved');
 const offset=indices[ordinal-1]!;
 const next=line.slice(0,offset)+insertion+' '+line.slice(offset);
 if(next===line)throw Error('Printed-line insertion did not change source');
 return next;
}
export function replaceAllExactlyPrinted(line:string,oldText:string,newText:string,required:number):string {
 const indices=literalAnchorPositions(line,oldText);
 if(!newText||newText===oldText||!Number.isInteger(required)||required<1
  ||indices.length!==required)
  throw Error('Printed-line replacement anchor cardinality changed');
 let result=line;
 for(const index of [...indices].reverse())result=result.slice(0,index)+newText+result.slice(index+oldText.length);
 if(result===line||literalAnchorPositions(result,oldText).length!==0)
  throw Error('Printed-line replacement did not consume every specified old anchor');
 return result;
}

function instructions(action:PaperAction):string{
 const text=action.proposedText;
 if(typeof text!=='string'||!text.trim()||!/\bas follows:\s*/i.test(text))
  throw Error('Original proposed amendment wording unavailable');
 return compact(text.split(/\bas follows:\s*/i).slice(1).join('as follows: '));
}

/**
 * One whole amendment (Hoffman) is deliberately supported. Port's other 15
 * instructions, both other adopted amendments, and the rejected amendment
 * are NOT interpreted as text transformations.
 */
export function assessHf100PrintedLinePilot(
 actions:readonly PaperAction[],firstUnofficialPdfText:string
):Hf100PrintedLinePilot {
 if(actions.length!==8||actions.some((a,i)=>a.sequence!==i+2||a.billIdentifier!=='HF100')
  ||!firstUnofficialPdfText.includes('UEH0100-1')
  ||!firstUnofficialPdfText.includes('HF100 FIRST UNOFFICIAL'))
  throw Error('HF100 source order or first-unofficial engrossment identity changed');
 const amendmentSequences=[2,3,4,6,7];
 const amendments=actions.filter(a=>a.kind==='amendment');
 const adopted=amendments.filter(a=>a.outcome==='adopted');
 const rejected=amendments.filter(a=>a.outcome==='rejected');
 if(amendments.length!==5||amendments.some((a,i)=>
   a.sequence!==amendmentSequences[i]||a.baseLocator!=='versions/ue/1/')
  ||adopted.map(a=>a.sequence).join(',')!=='2,3,6,7'
  ||rejected.length!==1||rejected[0]!.sequence!==4)
  throw Error('HF100 adopted/rejected source action sequence or base drift');
 const passage=actions[7];
 if(passage?.kind!=='passage'
  ||JSON.stringify(passage.priorAdoptedKeys)!==JSON.stringify(adopted.map(a=>a.key))
  ||passage.priorAdoptedKeys.includes(rejected[0]!.key))
  throw Error('HF100 passage chain is not the four adopted source actions');
 const port=actions[0]!,hoffman=actions[5]!;
 if(!/\bSenator Port moved to amend\b/i.test(port.motionText)
  ||!/\bSenator Hoffman moved to amend\b/i.test(hoffman.motionText))
  throw Error('HF100 source actors for scoped printed-line proof changed');
 const portText=instructions(port);
 const portPrefixes=[
  'Page 56, line 7, before the second "eight" insert "more than"',
  'Page 56, line 8, before "100" insert "more than"',
  'Page 71, line 23, before "eight" insert "up to"',
  'Page 71, line 26, before "800" insert "up to"',
 ];
 if(!portText.startsWith(portPrefixes.join(' '))||portText.length<=portPrefixes.join(' ').length)
  throw Error('HF100 Port partial instructions no longer source-exact or not composite');
 const previews=[
  {page:56,line:7,anchor:'eight',add:'more than',ordinal:2,count:2},
  {page:56,line:8,anchor:'100',add:'more than',ordinal:1,count:1},
  {page:71,line:23,anchor:'eight',add:'up to',ordinal:1,count:1},
  {page:71,line:26,anchor:'800',add:'up to',ordinal:1,count:1}
 ];
 for(const p of previews){
  const line=exactPrintedBillLine(firstUnofficialPdfText,p.page,p.line);
  insertBeforeNthPrintedAnchor(line,p.anchor,p.add,p.ordinal,p.count);
 }
 const hoffmanText=instructions(hoffman);
 const match=hoffmanText.match(/^Page (\d+), line (\d+), delete "([^"]+)" and insert "([^"]+)" and delete "([^"]+)" and insert "([^"]+)"$/);
 if(!match||Number(match[1])!==296||Number(match[2])!==19
  ||match[3]!==match[5]||match[4]!==match[6])
  throw Error('HF100 Hoffman original single-line double replacement is not complete');
 const baseLine=exactPrintedBillLine(firstUnofficialPdfText,296,19);
 const changed=replaceAllExactlyPrinted(baseLine,match[3]!,match[4]!,2);
 if(literalAnchorPositions(changed,match[4]!).length!==literalAnchorPositions(baseLine,match[4]!).length+2)
  throw Error('HF100 Hoffman exact new replacement count changed');
 return {schemaVersion:HF100_PRINTED_LINE_PILOT_VERSION,case:'HF100',base:'first_unofficial_engrossment',
  originalActions:8,adoptedAmendments:4,rejectedAmendmentsExcluded:1,
  printedBaseLinesVerified:5,partialPortInsertionsVerified:4,
  completeHoffmanLineReplacementsVerified:2,fullyCheckedAdoptedAmendments:1,
  adoptedAmendmentsStillHeldForCompositeApplication:3,
  allFourAdoptedAmendmentsApplied:false,completeAssembledBillText:false,
  preVotePublicationProven:false,eventLinksAdded:0};
}
