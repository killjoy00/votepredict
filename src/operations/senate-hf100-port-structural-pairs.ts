/**
 * HF100 Port cross-line proof, source-only and non-serving.
 * Caller MUST authenticate original April 28, 2023 Senate Journal and
 * first-unofficial Revisor PDF SHA-256/length before calling.
 *
 * Only three tightly scoped PAIRS of Port instructions are rehearsed against
 * immutable ORIGINAL printed page.line coordinates. Never reflow/renumber or
 * emit reconstructed text. Port's unqualified 177.8 repeated anchor remains
 * held and no complete amended bill is certified.
 */
import {compact,type PaperAction} from './senate-vote-paper-parser.js';
import {exactPrintedBillLine} from './senate-hf100-printed-line-pilot.js';
import {assessHf100PortInstructionCoverage} from './senate-hf100-port-instruction-coverage.js';

export const HF100_PORT_STRUCTURAL_PAIRS_VERSION='senate-hf100-port-structural-pairs-v1' as const;
type Coordinate={page:number;line:number;expected:string};
type PairName='cangrow_account'|'canstartup_account'|'cangrow_appropriation';
type PairSpec={
 name:PairName; ordinals:readonly [number,number];
 source:readonly [string,string];
 targets:readonly Coordinate[];
 boundary:Coordinate;
 kind:'after_a'|'second_comma';
 quote:string;
};
const specs:readonly PairSpec[]=[
 {
  name:'cangrow_account',ordinals:[5,6],kind:'after_a',
  quote:'The CanGrow revolving loan account is established in the special revenue fund. Money in the account, including interest, is appropriated to the commissioner to make loan financing grants under the CanGrow program.',
  source:[
   'Page 144, line 22, delete everything after "(a)" and insert "The CanGrow revolving loan account is established in the special revenue fund. Money in the account, including interest, is appropriated to the commissioner to make loan financing grants under the CanGrow program."',
   'Page 144, delete line 23'
  ],
  targets:[
   {page:144,line:22,expected:'Subd. 4. Loan financing grants. (a) The office shall establish a revolving loan account'},
   {page:144,line:23,expected:'to make loan financing grants under the CanGrow program.'}
  ],
  boundary:{page:144,line:24,expected:'(b) The office must award grants to nonprofit corporations through a competitive grant'}
 },
 {
  name:'canstartup_account',ordinals:[9,10],kind:'after_a',
  quote:'The CanStartup revolving loan account is established in the special revenue fund. Money in the account, including interest, is appropriated to the commissioner to make grants under the CanStartup program.',
  source:[
   'Page 175, line 7, delete everything after "(a)" and insert "The CanStartup revolving loan account is established in the special revenue fund. Money in the account, including interest, is appropriated to the commissioner to make grants under the CanStartup program."',
   'Page 175, delete line 8'
  ],
  targets:[
   {page:175,line:7,expected:'Subd. 3. Grants. (a) The commissioner shall establish a revolving loan account to make'},
   {page:175,line:8,expected:'grants under the CanStartup program.'}
  ],
  boundary:{page:175,line:9,expected:'(b) The commissioner must award grants to nonprofit corporations through a competitive'}
 },
 {
  name:'cangrow_appropriation',ordinals:[14,15],kind:'second_comma',
  quote:'subdivision 4.',
  source:[
   'Page 291, line 27, delete everything after the second comma, and insert "subdivision 4."',
   'Page 291, delete lines 28 to 32'
  ],
  targets:[
   {page:291,line:27,expected:'Minnesota Statutes, section 342.69, to eligible'},
   {page:291,line:28,expected:'organizations to help farmers navigate the'},
   {page:291,line:29,expected:'regulatory structure of the legal cannabis'},
   {page:291,line:30,expected:'industry and to nonprofit corporations to'},
   {page:291,line:31,expected:'provide loans to farmers for expansion into'},
   {page:291,line:32,expected:'the legal cannabis industry. Of these amounts,'}
  ],
  boundary:{page:292,line:1,expected:'up to three percent may be used for'}
 }
];

export interface Hf100PortStructuralPairsProof {
 schemaVersion:typeof HF100_PORT_STRUCTURAL_PAIRS_VERSION;
 journalStructuralInstructions:6;
 structuralPairsConsidered:3;
 structurallyPairedInstructionsVerified:number;
 structuralPairsVerified:number;
 structuralPairsHeld:number;
 /** Prior Port local checks are independent; this is NOT composite replay. */
 priorIsolatedLocalInstructionsVerified:number;
 totalIsolatedPortInstructionsVerified:number;
 portInstructionsStillHeld:number;
 /** PDF text may coalesce printed spaces; do not infer typography. */
 exactFinalTextWhitespaceCertified:false;
 renumberedPageLinesProven:false;
 portFullyApplied:false;
 completeAssembledBillText:false;
 preVotePublicationProven:false;
 eventLinksAdded:0;
 outcomes:readonly {pair:PairName;instructions:readonly [number,number];
  status:'preview_checked'|'held';
  reason:'source_and_printed_span'|'coordinate_or_printed_content_mismatch'|'preview_invariant_failed'|'prior_related_edit_held'}[];
}
function withoutSpaces(value:string):string{
 return compact(value).replace(/\s+/g,'');
}
function checkSourcePair(body:string,spec:PairSpec):void{
 // A quoted inserted sentence MUST be complete, and immediately followed by
 // the specified line deletion: a heading-only match cannot claim a patch.
 const expected=spec.source.join(' ');
 if(body.indexOf(expected)<0||body.indexOf(expected,body.indexOf(expected)+1)>=0)
  throw Error('Port complete structural quoted instruction or paired deletion no longer source-exact');
 if(!spec.source[0].includes('"'+spec.quote+'"'))
  throw Error('Port quoted structural replacement does not match reviewed source');
}
function readPrintedSpan(pdf:string,spec:PairSpec):string[]|null{
 const all=[...spec.targets,spec.boundary];
 const lines:string[]=[];
 for(const c of all){
  let original:string;
  try{original=exactPrintedBillLine(pdf,c.page,c.line)}
  catch{return null}
  // Only whitespace is tolerated because the original Revisor PDF extraction
  // fuses some text glyphs (e.g. 'commissionershall', 'cannabisindustry').
  // Every non-whitespace character, punctuation and case MUST match.
  if(withoutSpaces(original)!==withoutSpaces(c.expected))return null;
  lines.push(original);
 }
 return lines;
}
function previewPairedChange(spec:PairSpec,lines:readonly string[]):void{
 const original=lines[0]!,nextOriginal=lines[1]!;
 let a:string,b:string;
 if(spec.kind==='after_a'){
  const marker='(a)';
  const where=original.indexOf(marker);
  if(where<0||original.indexOf(marker,where+1)>=0||!nextOriginal)
   throw Error('Port original (a) structural target ambiguous');
  // Two independent bounded operations on the same ORIGINAL first-UE line.
  a=original.slice(0,where+marker.length)+' '+spec.quote;
  b=original.replace(/\(a\)[^\n]*$/,marker+' '+spec.quote);
  if(a!==b||!a.endsWith(spec.quote)||a.includes(original.slice(where+marker.length).trim()))
   throw Error('Port (a) replacement/deletion preview inconsistent');
 }else{
  const commaPositions=[...original.matchAll(/,/g)].map(x=>x.index!);
  if(commaPositions.length!==2||!original.endsWith('to eligible'))
   throw Error('Port original second-comma structural target ambiguous');
  a=original.slice(0,commaPositions[1]!+1)+' '+spec.quote;
  b=original.replace(/^(.*?,.*?,)[^\n]*$/,'$1 '+spec.quote);
  if(a!==b||!a.endsWith(', '+spec.quote)||a.includes('to eligible'))
   throw Error('Port second-comma replacement/deletion preview inconsistent');
 }
 // The entire subsequent original printed line range is consumed, but the
 // following printed boundary is not modified. No invented reflowing.
 if(!a||a===original||!b||!lines.at(-1)||spec.targets.length<2)
  throw Error('Port paired structural operation incomplete');
}
export function assessHf100PortStructuralPairs(
 actions:readonly PaperAction[],firstUnofficialPdfText:string
):Hf100PortStructuralPairsProof {
 const prior=assessHf100PortInstructionCoverage(actions,firstUnofficialPdfText);
 if(prior.sourceInstructionsIdentified!==19||prior.previouslyVerifiedLocalEdits!==4
  ||prior.structuralInstructionsHeld!==6||actions[0]?.outcome!=='adopted')
  throw Error('Port structural source sequence/disposition changed');
 const body=compact(actions[0]!.proposedText??'');
 let verified=0;
 const outcomes:Hf100PortStructuralPairsProof['outcomes'][number][]=[];
 for(const spec of specs){
  checkSourcePair(body,spec);
  const span=readPrintedSpan(firstUnofficialPdfText,spec);
  if(!span){
   outcomes.push({pair:spec.name,instructions:spec.ordinals,
    status:'held',reason:'coordinate_or_printed_content_mismatch'});
   continue;
  }
  // The appropriation cross-line rewrite depends on the prior 291.26
  // replacement, which must have a UNIQUE original literal anchor.
  if(spec.kind==='second_comma'&&prior.outcomes[12]?.result!=='local_checked'){
   outcomes.push({pair:spec.name,instructions:spec.ordinals,
    status:'held',reason:'prior_related_edit_held'});
   continue;
  }
  try{
   previewPairedChange(spec,span);
   verified++;
   outcomes.push({pair:spec.name,instructions:spec.ordinals,
    status:'preview_checked',reason:'source_and_printed_span'});
  }catch{
   outcomes.push({pair:spec.name,instructions:spec.ordinals,
    status:'held',reason:'preview_invariant_failed'});
  }
 }
 if(outcomes.length!==3||verified>3)throw Error('Port structural pair coverage not exhaustive');
 const priorIsolated=prior.previouslyVerifiedLocalEdits+prior.additionalLocalEditsVerified;
 return {
  schemaVersion:HF100_PORT_STRUCTURAL_PAIRS_VERSION,
  journalStructuralInstructions:6,structuralPairsConsidered:3,
  structurallyPairedInstructionsVerified:verified*2,
  structuralPairsVerified:verified,structuralPairsHeld:3-verified,
  priorIsolatedLocalInstructionsVerified:priorIsolated,
  totalIsolatedPortInstructionsVerified:priorIsolated+verified*2,
  portInstructionsStillHeld:19-(priorIsolated+verified*2),
  exactFinalTextWhitespaceCertified:false,renumberedPageLinesProven:false,
  portFullyApplied:false,completeAssembledBillText:false,
  preVotePublicationProven:false,eventLinksAdded:0,outcomes
 };
}
