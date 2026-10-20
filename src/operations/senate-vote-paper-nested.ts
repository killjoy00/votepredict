/** Source-only extraction of nested Senate amendment proposals.
 * An adopted amendment-to-an-amendment modifies its parent proposal, NOT
 * necessarily the bill. No records, votes, or assembled versions are written.
 */
import {createHash} from 'node:crypto';
import {ballotSignature,stripInterposedSenateJournalRollHeader} from './senate-vote-paper-parser.js';
import {parseSenateJournalText} from '../sources/minnesota/senate-journals.js';

export const NESTED_PAPER_PARSER_VERSION='senate-nested-source-paper-v1' as const;
export interface NestedSenateSourcePaper{
 sourceOnlyKey:string;
 sourceStart:number;sourceEnd:number;billIdentifier:string;
 mover:string;parentMover:string;parentOrdinal:string;
 literalText:string;literalSha256:string;
 yeas:number|null;nays:number|null;ballotSha256:string|null;
 disposition:'adopted_to_parent'|'rejected'|'unknown';
 /** The journal identifies a parent description, not a stable A-number. */
 exactNumberedParentProven:false;
 appliesDirectlyToBill:false;
 fullBillTextAssembled:false;
 acceptedVoteEventLinked:false;
}

const nestedHead=/\bSenator\s+([A-ZÀ-ž][A-Za-zÀ-ž'’.-]*(?:\s+[A-ZÀ-ž][A-Za-zÀ-ž'’.-]*){0,2})\s+moved\s+to\s+amend\s+the\s+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th)?)\s+([A-ZÀ-ž][A-Za-zÀ-ž'’.-]*(?:\s+[A-ZÀ-ž][A-Za-zÀ-ž'’.-]*){0,2})\s+amendment\s+to\s+([HS])\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?0*(\d{1,6})\s+as\s+follows\s*:/gi;
const nextMotion=/\bSenator\s+[A-ZÀ-ž][A-Za-zÀ-ž'’.-]*(?:\s+[A-ZÀ-ž][A-Za-zÀ-ž'’.-]*){0,3}\s+moved\s+(?:to|that)\b/i;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const compact=(s:string)=>s.replace(/\s+/g,' ').trim();

/**
 * Recognizes only explicit ordinal + named parent + bill statements.
 * Absent a complete source question and a literal edit, do not emit a paper.
 * Ballot proof is optional and never inferred from just a matching tally.
 */
export function parseNestedSenateSourcePapers(
 text:string, knownMemberNames:readonly string[]=[]
):NestedSenateSourcePaper[]{
 if(typeof text!=='string'||text.length>8_000_000)throw Error('Nested journal source outside audit bounds');
 const result:NestedSenateSourcePaper[]=[];
 for(const h of text.matchAll(nestedHead)){
  const start=h.index!,remaining=text.slice(start+h[0].length,Math.min(text.length,start+1_500_000));
  const question=/\bThe question (?:was taken|recurred)\b/i.exec(remaining);
  if(!question)continue;
  const competing=nextMotion.exec(remaining.slice(0,question.index));
  if(competing)continue; // never splice a different source motion into this proposal
  const body=remaining.slice(0,question.index);
  // A divided proposal needs separately authenticated portions. An appeal or
  // withdrawal is a different Senate question, not a ballot on this paper.
  if(/\b(?:request(?:ed)? (?:a )?division|first portion|second portion|appealed the decision|ruled[\s\S]{0,120}out of order|amendment was withdrawn|withdrew (?:the|his|her) amendment)\b/i.test(body))continue;
  if(!/\b(?:Page\s+\d+\s*,|delete|insert|strike|replace)\b/i.test(body))continue;
  const literal=text.slice(start,start+h[0].length+question.index).trimEnd();
  if(literal.length<65||literal.length>150_000)continue;
  const after=remaining.slice(question.index);
  const anotherMotion=nextMotion.exec(after);
  const localWindow=after.slice(0,Math.min(anotherMotion?.index??after.length,18_000));
  const questionMarkers=[...localWindow.matchAll(/\bThe question (?:was taken|recurred)\b/gi)];
  const local=localWindow.slice(0,questionMarkers[1]?.index??localWindow.length);
  const rollMarker=/\bThe roll was called\b/i.exec(local);
  const questionText=compact(local.slice(0,Math.min(rollMarker?.index??400,400)));
  // Do not silently label a ruling/appeal/parent-bill question as a vote
  // on this nested amendment. A valid question must explicitly be about
  // adopting or rejecting an amendment *to another amendment*.
  if(!/^The question (?:was taken|recurred)\s+on\b/i.test(questionText)
   ||!/\b(?:adoption|rejection)\s+of\b/i.test(questionText)
   ||!/\bamendment\s+to\s+(?:the\s+)?(?:[\w'’.\s]{0,75})?\bamendment\b/i.test(questionText)
   ||/\b(?:decision of the President|ruling|appeal|division|portion)\b/i.test(questionText))continue;
  const roll=/\bThe roll was called,\s*and there were yeas\s+(\d+)\s+and nays\s+(\d+)/i.exec(local);
  const yea=roll?Number(roll[1]):null,nay=roll?Number(roll[2]):null;
  let ballotSha256:string|null=null;
  if(roll&&Number.isSafeInteger(yea)&&Number.isSafeInteger(nay)&&yea!+nay!>0&&yea!+nay!<=90){
   const candidate=stripInterposedSenateJournalRollHeader(literal+'\n'+local);
   try{
    const parsed=parseSenateJournalText({text:candidate,sessionKey:'source-only',
     sourceUrl:'https://example.test/original',knownMemberNames,allowRosterMismatch:false});
    if(parsed.length===1&&parsed[0].yeaCount===yea&&parsed[0].nayCount===nay){
     ballotSha256=ballotSignature(parsed[0].memberVotes.map(v=>({name:v.sourceName,choice:v.choice})),yea!,nay!);
    }
   }catch{ /* partial roster or nested parser ambiguity: retain NULL */ }
  }
  const end=start+literal.length;
  const disposition:NestedSenateSourcePaper['disposition']=
   /\bSo the amendment to the amendment was not adopted\b/i.test(local)?'rejected'
   :/\bSo the amendment to the amendment was adopted\b/i.test(local)?'adopted_to_parent'
   :'unknown';
  result.push({sourceOnlyKey:sha(JSON.stringify([start,end,sha(literal)])),
   sourceStart:start,sourceEnd:end,billIdentifier:h[4]!.toUpperCase()+'F'+Number(h[5]),
   mover:compact(h[1]!),parentMover:compact(h[3]!),parentOrdinal:h[2]!.toLowerCase(),
   literalText:literal,literalSha256:sha(literal),
   yeas:yea,nays:nay,ballotSha256,disposition,exactNumberedParentProven:false,
   appliesDirectlyToBill:false,fullBillTextAssembled:false,acceptedVoteEventLinked:false});
  if(result.length>200)throw Error('Nested source-paper action count exceeded bound');
 }
 return result;
}
