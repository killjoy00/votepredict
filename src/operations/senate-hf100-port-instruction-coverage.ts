/**
 * Research-only continuation of HF100's Port amendment against the printed
 * first unofficial engrossment. Caller pins BOTH original Senate Journal and
 * original Revisor PDF bytes before invoking this helper in CI.
 *
 * All 19 source instruction headings are enumerated in their original order.
 * Local edits are rehearsed against original page.line coordinates, never
 * against a reflowed bill. Structural rewrites are deliberately held. This
 * module neither returns bill text nor certifies amendment completion.
 */
import {compact,type PaperAction} from './senate-vote-paper-parser.js';
import {
  assessHf100PrintedLinePilot,exactPrintedBillLine,
  insertBeforeNthPrintedAnchor,literalAnchorPositions,replaceAllExactlyPrinted
} from './senate-hf100-printed-line-pilot.js';

export const HF100_PORT_COVERAGE_VERSION='senate-hf100-port-instruction-coverage-v1' as const;
type Operation='prior_checked'|'before'|'after'|'replace'|'terminal_period'|'structural_hold';
type Instruction={
  prefix:string; page:number;lines:readonly number[];operation:Operation;
  needle?:string;value?:string;count?:number;
};

/**
 * These are headings / complete short instructions from the authenticated
 * journal, not invented bill wording. Long quoted insertions remain held even
 * though their first clauses can be identified. Each target is an ORIGINAL
 * first-UE printed coordinate, not a cumulative post-edit line reference.
 */
const PORT_INSTRUCTIONS:readonly Instruction[]=[
  {prefix:'Page 56, line 7, before the second "eight" insert "more than"',
   page:56,lines:[7],operation:'prior_checked'},
  {prefix:'Page 56, line 8, before "100" insert "more than"',
   page:56,lines:[8],operation:'prior_checked'},
  {prefix:'Page 71, line 23, before "eight" insert "up to"',
   page:71,lines:[23],operation:'prior_checked'},
  {prefix:'Page 71, line 26, before "800" insert "up to"',
   page:71,lines:[26],operation:'prior_checked'},
  {prefix:'Page 144, line 22, delete everything after "(a)" and insert "The CanGrow revolving loan account',
   page:144,lines:[22],operation:'structural_hold'},
  {prefix:'Page 144, delete line 23',
   page:144,lines:[23],operation:'structural_hold'},
  {prefix:'Page 146, line 10, before "revolving" insert "CanGrow"',
   page:146,lines:[10],operation:'before',needle:'revolving',value:'CanGrow'},
  {prefix:'Page 148, line 12, delete "2024" and insert "2025"',
   page:148,lines:[12],operation:'replace',needle:'2024',value:'2025'},
  {prefix:'Page 175, line 7, delete everything after "(a)" and insert "The CanStartup revolving loan account',
   page:175,lines:[7],operation:'structural_hold'},
  {prefix:'Page 175, delete line 8',
   page:175,lines:[8],operation:'structural_hold'},
  {prefix:'Page 177, line 8, before "revolving" insert "CanStartup"',
   page:177,lines:[8],operation:'before',needle:'revolving',value:'CanStartup'},
  {prefix:'Page 251, line 21, delete "2024" and insert "2025"',
   page:251,lines:[21],operation:'replace',needle:'2024',value:'2025'},
  {prefix:'Page 291, line 26, delete "grants issued" and insert "deposit in the CanGrow revolving loan',
   page:291,lines:[26],operation:'replace',needle:'grants issued',
   value:'deposit in the CanGrow revolving loan account established'},
  {prefix:'Page 291, line 27, delete everything after the second comma, and insert "subdivision 4."',
   page:291,lines:[27],operation:'structural_hold'},
  {prefix:'Page 291, delete lines 28 to 32',
   page:291,lines:[28,29,30,31,32],operation:'structural_hold'},
  {prefix:'Page 292, line 1, after "percent" insert "of this appropriation"',
   page:292,lines:[1],operation:'after',needle:'percent',value:'of this appropriation'},
  {prefix:'Page 292, line 26, after "for" insert "deposit in"',
   page:292,lines:[26],operation:'after',needle:'for',value:'deposit in'},
  {prefix:'Page 292, line 27, delete "program" and insert "revolving loan account"',
   page:292,lines:[27],operation:'replace',needle:'program',value:'revolving loan account'},
  {prefix:'Page 292, line 28, before the period, insert ", subdivision 3"',
   page:292,lines:[28],operation:'terminal_period',value:', subdivision 3'}
];

export interface Hf100PortInstructionCoverage {
  schemaVersion:typeof HF100_PORT_COVERAGE_VERSION;
  sourceInstructionsIdentified:19;
  previouslyVerifiedLocalEdits:4;
  /** Number of DISTINCT original page.line coordinates resolved from PDF text. */
  printedCoordinatesResolved:number;
  /** Additional supported local operations whose anchors were unique. */
  additionalLocalEditsVerified:number;
  /** Six instructions need cross-line replacement/deletion semantics. */
  structuralInstructionsHeld:6;
  /** Local edits that cannot be attested from the parsed text layer. */
  localEditsHeld:number;
  instructionsStillHeld:number;
  portFullyApplied:false;
  anyAdoptedAmendmentIntegratedIntoComposite:false;
  completeAssembledBillText:false;
  preVotePublicationProven:false;
  eventLinksAdded:0;
  /** Only ordinal/status/reason, never source text or resulting bill lines. */
  outcomes:readonly {ordinal:number;result:'local_checked'|'held';
    reason:'prior_proof'|'unique_anchor'|'structural_unimplemented'|
    'coordinate_unavailable'|'anchor_unresolved'}[];
}
function sourceInstructionHeadings(port:PaperAction):void {
  if(typeof port.proposedText!=='string')throw Error('Port original text unavailable');
  const pieces=port.proposedText.split(/\bas follows:\s*/i);
  if(pieces.length!==2)throw Error('Port original amendment framing changed');
  const body=compact(pieces[1]!);
  const count=[...body.matchAll(/\bPage \d{1,3},/g)].length;
  if(count!==PORT_INSTRUCTIONS.length)throw Error('Port source instruction count changed');
  let lastIndex=-1;
  for(const instruction of PORT_INSTRUCTIONS){
    const index=body.indexOf(instruction.prefix);
    if(index<=lastIndex||body.indexOf(instruction.prefix,index+1)!==-1)
      throw Error('Port source instruction wording/order changed');
    lastIndex=index;
  }
}

function checkLocalEdit(instruction:Instruction,line:string):void {
  let next:string;
  const needle=instruction.needle??'',value=instruction.value??'';
  switch(instruction.operation){
    case 'before':
      next=insertBeforeNthPrintedAnchor(line,needle,value,1,1);
      break;
    case 'replace':
      next=replaceAllExactlyPrinted(line,needle,value,1);
      break;
    case 'after': {
      const positions=literalAnchorPositions(line,needle);
      if(positions.length!==1)throw Error('After-anchor not unique');
      const end=positions[0]!+needle.length;
      next=line.slice(0,end)+' '+value+line.slice(end);
      break;
    }
    case 'terminal_period':
      // A period within the section number cannot be mistaken for the final
      // punctuation. No generic "last period on page" fallback.
      if(line!=='section 116J.659.')throw Error('Terminal-period context changed');
      next='section 116J.659'+value+'.';
      break;
    default:throw Error('Not a supported local edit');
  }
  if(next===line||!next)throw Error('Local edit did not change source');
}

/**
 * Non-fatal holds are part of the evidence result. A missing or typography-
 * fused literal does NOT justify inserting a speculative space or searching
 * an adjacent line. The existing four Port checks and complete Hoffman
 * check remain hard gates, as do original action order and rejected exclusion.
 */
export function assessHf100PortInstructionCoverage(
  actions:readonly PaperAction[],firstUnofficialPdfText:string
):Hf100PortInstructionCoverage {
  assessHf100PrintedLinePilot(actions,firstUnofficialPdfText);
  const port=actions[0]!;
  sourceInstructionHeadings(port);
  let printedCoordinatesResolved=0,additionalLocalEditsVerified=0,localEditsHeld=0;
  const outcomes:Hf100PortInstructionCoverage['outcomes'][number][]=[];
  for(const [index,instruction] of PORT_INSTRUCTIONS.entries()){
    const originalLines:string[]=[];
    for(const line of instruction.lines){
      try{originalLines.push(exactPrintedBillLine(firstUnofficialPdfText,instruction.page,line))}
      catch{break}
    }
    const coordsAvailable=originalLines.length===instruction.lines.length;
    if(coordsAvailable)printedCoordinatesResolved+=originalLines.length;
    if(instruction.operation==='prior_checked'){
      if(!coordsAvailable)throw Error('Previously verified Port base line disappeared');
      outcomes.push({ordinal:index+1,result:'local_checked',reason:'prior_proof'});
    }else if(instruction.operation==='structural_hold'){
      outcomes.push({ordinal:index+1,result:'held',reason:coordsAvailable
        ?'structural_unimplemented':'coordinate_unavailable'});
    }else if(!coordsAvailable){
      localEditsHeld++;
      outcomes.push({ordinal:index+1,result:'held',reason:'coordinate_unavailable'});
    }else{
      try{
        checkLocalEdit(instruction,originalLines[0]!);
        additionalLocalEditsVerified++;
        outcomes.push({ordinal:index+1,result:'local_checked',reason:'unique_anchor'});
      }catch{
        localEditsHeld++;
        outcomes.push({ordinal:index+1,result:'held',reason:'anchor_unresolved'});
      }
    }
  }
  const structuralInstructionsHeld=PORT_INSTRUCTIONS.filter(p=>p.operation==='structural_hold').length;
  if(structuralInstructionsHeld!==6||additionalLocalEditsVerified+localEditsHeld!==9
    ||outcomes.length!==19)throw Error('Port evidence categories did not partition instructions');
  return {
    schemaVersion:HF100_PORT_COVERAGE_VERSION,sourceInstructionsIdentified:19,
    previouslyVerifiedLocalEdits:4,printedCoordinatesResolved,
    additionalLocalEditsVerified,structuralInstructionsHeld:6,localEditsHeld,
    instructionsStillHeld:structuralInstructionsHeld+localEditsHeld,
    portFullyApplied:false,anyAdoptedAmendmentIntegratedIntoComposite:false,
    completeAssembledBillText:false,preVotePublicationProven:false,
    eventLinksAdded:0,outcomes
  };
}
