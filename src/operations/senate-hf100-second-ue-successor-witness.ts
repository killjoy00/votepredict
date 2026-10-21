/**
 * HF100 2nd-unofficial successor edition is an independent retrospective
 * witness, NOT a source of exact pre-vote publication or an assembled-at-vote
 * state. Caller must SHA/size pin the official successor Revisor PDF AND the
 * original Senate Journal and first-UE PDF before accepting CI evidence.
 */
import {type PaperAction} from './senate-vote-paper-parser.js';
import {assessHf100PrintedLinePilot} from './senate-hf100-printed-line-pilot.js';

export const HF100_SECOND_UE_PDF='https://www.revisor.mn.gov/bills/93/2023/0/HF/100/versions/ue/2/pdf/';
export const HF100_SUCCESSOR_WITNESS_VERSION='senate-hf100-second-ue-successor-witness-v1' as const;
type Owner='port'|'hauschild_local'|'hauschild_public_safety'|'hoffman';
export const HF100_SUCCESSOR_WITNESS_TERMS:readonly {id:string;owner:Owner;wording:string}[]=[
 {id:'port_cangrow_revolving_account',owner:'port',
  wording:'The CanGrow revolving loan account is established in the special revenue fund.'},
 {id:'port_canstartup_revolving_account',owner:'port',
  wording:'The CanStartup revolving loan account is established in the special revenue fund.'},
 {id:'port_1778_first_account_only',owner:'port',
  wording:'deposit in the CanStartup revolving loan account. Loan interest payments must be deposited in a revolving loan account'},
 {id:'port_cangrow_appropriation',owner:'port',
  wording:'$1,000,000 each year is for deposit in the CanGrow revolving loan account established under Minnesota Statutes, section 342.69, subdivision 4.'},
 {id:'hauschild_local_restrictions',owner:'hauschild_local',
  wording:'may utilize any granted regulatory authority to adopt reasonable restrictions'},
 {id:'hauschild_local_licenses',owner:'hauschild_local',
  wording:'in cities of the first class, one license for every 20,000 population'},
 {id:'hauschild_public_safety_totals',owner:'hauschild_public_safety',
  wording:'Total Appropriation$23,987,000$10,654,000'},
 {id:'hauschild_public_safety_general_fund',owner:'hauschild_public_safety',
  wording:'$10,000,000 the first year and $5,000,000 the second year are from the general fund'},
 {id:'hoffman_two_fiscal_year_replacements',owner:'hoffman',
  wording:'$5,500,000 in fiscal year 2024 and $5,500,000 in fiscal year 2025'}
];

/** Printed line numbers are coordinates, not bill language. Remove them,
 * retaining body words and punctuation. Deliberately DO NOT infer typography
 * or silently strip other source text or an intervening changed section.
 */
function evidenceBody(pdf:string):string{
 return pdf.replace(/\r/g,'')
  .replace(/(^|\n)[ \t]*\d{1,3}\.\d{1,2}[ \t]+/g,'$1')
  .replace(/[\u200b\u00ad]/g,'').replace(/\s+/g,'').toLowerCase();
}
function occurrences(haystack:string,needle:string):number{
 if(!needle)return 0;
 let count=0,from=0;
 for(;;){
  const at=haystack.indexOf(needle,from);
  if(at<0)return count;
  count++;from=at+needle.length;
 }
}

export interface Hf100SuccessorWitness {
 schemaVersion:typeof HF100_SUCCESSOR_WITNESS_VERSION;
 comparison:'first_unofficial_vs_second_unofficial';
 journalAdoptedInstructions:4;rejectedExcluded:1;
 successorSourceIsDistinctEdition:true;
 sourceWordingWitnesses:number;
 strictUniqueNewWitnesses:number;
 heldWitnesses:number;
 amendmentsWithAtLeastOneSuccessorWitness:number;
 /** Named safe check results only. No bill excerpts or ballots are logged. */
 evidence:readonly {id:string;owner:Owner;verified:boolean;oldOccurrences:number;newOccurrences:number}[];
 port1778FirstOccurrenceSuggestedBySuccessor:boolean;
 /** The successor alone is never an exhaustive firstUE -> secondUE diff. */
 fullEditionDiffProven:false;
 exactCompositeAtVoteCertified:false;
 successorPreVotePublicAvailabilityCertified:false;
 completeAssembledBillText:false;
 eventLinksAdded:0;
}
export function assessHf100SecondUnofficialSuccessor(
 actions:readonly PaperAction[],firstUnofficialPdfText:string,secondUnofficialPdfText:string
):Hf100SuccessorWitness {
 assessHf100PrintedLinePilot(actions,firstUnofficialPdfText);
 if(!secondUnofficialPdfText.includes('UEH0100-2')
  ||!secondUnofficialPdfText.includes('HF100 SECOND UNOFFICIAL'))
  throw Error('HF100 successor must be the distinct second unofficial engrossment');
 const old=evidenceBody(firstUnofficialPdfText),next=evidenceBody(secondUnofficialPdfText);
 if(old===next||next.length<200)throw Error('HF100 successor text is not a distinct complete extract');
 const evidence=HF100_SUCCESSOR_WITNESS_TERMS.map(item=>{
  const normalized=item.wording.replace(/\s+/g,'').toLowerCase();
  const oldOccurrences=occurrences(old,normalized),newOccurrences=occurrences(next,normalized);
  return {id:item.id,owner:item.owner,oldOccurrences,newOccurrences,
   verified:oldOccurrences===0&&newOccurrences===1};
 });
 const strict=evidence.filter(x=>x.verified);
 const grouped=new Set(strict.map(x=>x.owner));
 return {
  schemaVersion:HF100_SUCCESSOR_WITNESS_VERSION,
  comparison:'first_unofficial_vs_second_unofficial',
  journalAdoptedInstructions:4,rejectedExcluded:1,
  successorSourceIsDistinctEdition:true,sourceWordingWitnesses:evidence.length,
  strictUniqueNewWitnesses:strict.length,heldWitnesses:evidence.length-strict.length,
  amendmentsWithAtLeastOneSuccessorWitness:grouped.size,
  evidence,
  port1778FirstOccurrenceSuggestedBySuccessor:
   evidence.find(x=>x.id==='port_1778_first_account_only')?.verified===true,
  fullEditionDiffProven:false,exactCompositeAtVoteCertified:false,
  successorPreVotePublicAvailabilityCertified:false,
  completeAssembledBillText:false,eventLinksAdded:0
 };
}
