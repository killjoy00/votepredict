/** Source-local paper identity. No positional event-key replay or tally-only matching. */
import {createHash} from 'node:crypto';
import {normalizeMemberName} from '../sources/minnesota/house-votes.js';
import {parseSenateJournalText} from '../sources/minnesota/senate-journals.js';

export const PAPER_PARSER='senate-journal-paper-v1';
export const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
export const compact=(s:string)=>s.replace(/[\u200b\u00ad]/g,'').replace(/\s+/g,' ').trim();
export const billIdentifier=(s:string)=>{const m=s.match(/\b([HS])\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?0*(\d{1,6})\b/i);return m?m[1].toUpperCase()+'F'+Number(m[2]):null;};
const ordinals:Record<string,number>={first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10};
export function explicitVersionLocator(text:string):string|null {
 const m=compact(text).match(/\b(?:the\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th)?)\s+(unofficial\s+)?engrossment\b/i);
 if(m){const n=ordinals[m[1].toLowerCase()]??Number.parseInt(m[1]);return 'versions/'+(m[2]?'ue/':'')+n+'/';}
 if(/\b(?:as introduced|the introduction)\b/i.test(text))return 'versions/0/';
 return null;
}
export interface Ballot {name:string;choice:string}
export function ballotSignature(votes:readonly Ballot[],yeas:number,nays:number):string|null {
 if(!Array.isArray(votes)||votes.some(v=>!v||typeof v.name!=='string'||typeof v.choice!=='string'))return null;
 if(!Number.isInteger(yeas)||!Number.isInteger(nays)||yeas+nays===0)return null;
 const normalized=votes.map(v=>[normalizeMemberName(v.name),v.choice]);
 if(normalized.some(([n,c])=>!n||!['yea','nay'].includes(c))||new Set(normalized.map(v=>v[0])).size!==normalized.length
  ||normalized.filter(v=>v[1]==='yea').length!==yeas||normalized.filter(v=>v[1]==='nay').length!==nays)return null;
 return hash(JSON.stringify(normalized.sort((a,b)=>a[0].localeCompare(b[0]))));
}
/**
 * Some authenticated Senate Journal PDFs print a page heading directly
 * between "... as follows:" and "Those who voted in the affirmative were:".
 * A page header is NOT a voter. Strip only a tightly identified official
 * header for a SECOND, strict named-ballot parse; retain source character
 * offsets and all original bytes for source provenance.
 */
export function stripInterposedSenateJournalRollHeader(local:string):string {
 return local.replace(
  /(The roll was called,\s*and there were yeas\s+\d+\s+and nays\s+\d+,\s*as follows:\s*)\[?\d{1,3}(?:ST|ND|RD|TH)\s+DAY\]\s*(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\s*,\s*[A-Z]+\s+\d{1,2},\s+\d{4}\s{0,8}\d{2,6}\s*(?=Those who voted in the affirmative were:)/gi,
  '$1'
 );
}

export interface PaperAction {
 key:string;sequence:number;start:number;end:number;billIdentifier:string;
 kind:'amendment'|'passage'|'conference'|'procedural';motionText:string;questionText:string;
 proposedText:string|null;baseLocator:string|null;outcome:'adopted'|'rejected'|'unknown';
 priorAdoptedKeys:string[];yeas:number|null;nays:number|null;ballotSignature:string|null;
 rollStart:number|null;
}
/** Preserve original extracted-character locators. Unknown/truncated proposals are never full papers. */
export function parseJournalPaperActions(text:string,knownNames:readonly string[]):PaperAction[]{
 const results:PaperAction[]=[];
 const proposal=/\b(?:Senator\s+)?[A-ZÀ-ž][A-Za-zÀ-ž'’.-]*(?:\s+[A-ZÀ-ž][A-Za-zÀ-ž'’.-]*)?\s+moved\s+to\s+amend\s+[HS]\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?\d{1,6}\b/g;
 const heads=[...text.matchAll(proposal)];
 for(let i=0;i<heads.length;i++){
  const start=heads[i].index!,boundary=heads[i+1]?.index??text.length;
  const span=text.slice(start,Math.min(boundary,start+1_500_000));
  const stop=/\b(?:The question (?:was taken|recurred)|The motion (?:did not prevail|prevailed)|The amendment was (?:not )?adopted)\b/i.exec(span);
  if(!stop)continue; // Never call a truncated block the complete proposal.
  const literal=span.slice(0,stop.index).trimEnd();
  if(literal.length<95||!/\b(?:as follows|page\s+\d+,\s*line|delete|insert|strike)\b/i.test(literal))continue;
  // Nested amendments and withdrawal motions require their own question/paper
  // sequence; never label the combined block as one exact proposed paper.
  if(/\bmoved\s+(?:to\s+(?:amend|withdraw)|that)\b|\bwithdrew (?:the|his|her) amendment\b|\bamendment was withdrawn\b/i.test(literal.slice(heads[i][0].length)))continue;
  const bill=billIdentifier(heads[i][0]);if(!bill)continue;
  const following=span.slice(stop.index);
  // The next explicit motion/third reading bounds this proposal's outcome.
  const next=/\b(?:Senator\s+)?[A-ZÀ-ž][A-Za-zÀ-ž'’.-]*(?:\s+[A-ZÀ-ž][A-Za-zÀ-ž'’.-]*){0,3}\s+moved\b|\b[HS]\.F\. No\. \d+ was read/.exec(following);
  const tail=following.slice(0,next?.index??following.length);
  const question=tail.match(/The question (?:was taken|recurred)[\s\S]*?(?=The roll was called|\n\s*The motion)/i)?.[0]??'';
  const roll=tail.match(/The roll was called,\s*and there were yeas\s+(\d+)\s+and nays\s+(\d+)/i);
  if(/\b(?:passage|repassage|withdraw|amendment to (?:the |an? )?amendment)\b/i.test(question))continue;
  const parsed=roll?parseSenateJournalText({text:heads[i][0]+'\n'+tail,sessionKey:'source-only',sourceUrl:'https://example.test/source',knownMemberNames:knownNames,allowRosterMismatch:true}):[];
  const votes=parsed.length===1?parsed[0].memberVotes.map(v=>({name:v.sourceName,choice:v.choice})):[];
  const outcome=/\b(?:motion did not prevail|amendment was not adopted)\b/i.test(tail)?'rejected'
   :/\b(?:motion prevailed|amendment was adopted)\b/i.test(tail)?'adopted':'unknown';
  const end=start+literal.length,key=hash(JSON.stringify([start,end,hash(literal)]));
  results.push({key,sequence:0,start,end,billIdentifier:bill,kind:'amendment',motionText:compact(literal.split(/\bas follows\b/i)[0]),
   questionText:compact(question),proposedText:literal,baseLocator:explicitVersionLocator(literal.slice(0,500)),outcome,
   priorAdoptedKeys:[],yeas:roll?Number(roll[1]):null,nays:roll?Number(roll[2]):null,
   ballotSignature:roll?ballotSignature(votes,Number(roll[1]),Number(roll[2])):null,
   rollStart:roll?start+stop.index+(roll.index??0):null});
 }
 // Other named questions keep distinct actions, even if tallies and ballots repeat.
 const rolls=[...text.matchAll(/The roll was called,\s*and there were yeas\s+(\d+)\s+and nays\s+(\d+)/gi)];
 for(let i=0;i<rolls.length;i++){
  const roll=rolls[i],at=roll.index!,previous=rolls[i-1]?.index??0;
  const context=text.slice(Math.max(previous,at-10000),at);
  const questions=[...context.matchAll(/The question (?:was taken|recurred)[\s\S]*$/gi)];
  if(!questions.length)continue;
  // matchAll with a trailing wildcard finds the first marker; take the last explicitly.
  const markers=[...context.matchAll(/The question (?:was taken|recurred)/gi)];
  const qStart=markers.at(-1)!.index!,question=compact(context.slice(qStart));
  if(results.some(a=>a.rollStart===at)||/\bamendment\b/i.test(question))continue; // linked through a literal, or explicitly unresolved
  const lastBill=[...context.matchAll(/\b[HS]\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?\d{1,6}\b/gi)].at(-1);
  const bill=lastBill?billIdentifier(lastBill[0]):null;if(!bill)continue;
  const kind=/\b(?:final passage|repassage|passage of (?:the )?bill)\b/i.test(question)?'passage'
   :/\bconference\b/i.test(context.slice(qStart-500))?'conference':'procedural';
  const end=rolls[i+1]?.index??text.length;
  const local=text.slice(Math.max(0,at-2600,(rolls[i-1]?.index??-10000)+(rolls[i-1]?.[0].length??0)),end);
  const parsed=parseSenateJournalText({text:local,sessionKey:'source-only',sourceUrl:'https://example.test/source',knownMemberNames:knownNames,allowRosterMismatch:true});
  let verifiedBallot=parsed.length===1
   ?ballotSignature(parsed[0].memberVotes.map(v=>({name:v.sourceName,choice:v.choice})),Number(roll[1]),Number(roll[2])):null;
  if(!verifiedBallot){
   const adjusted=stripInterposedSenateJournalRollHeader(local);
   if(adjusted!==local){
    try{
     const restored=parseSenateJournalText({text:adjusted,sessionKey:'source-only',
      sourceUrl:'https://example.test/source',knownMemberNames:knownNames,allowRosterMismatch:false});
     if(restored.length===1&&restored[0].yeaCount===Number(roll[1])&&restored[0].nayCount===Number(roll[2])){
      verifiedBallot=ballotSignature(restored[0].memberVotes.map(v=>({name:v.sourceName,choice:v.choice})),Number(roll[1]),Number(roll[2]));
     }
    }catch{/* Any incomplete or ambiguous original remains unlinked. */}
   }
  }
  const start=Math.max(previous,at-10000)+qStart,key=hash(JSON.stringify([start,at,hash(question)]));
  results.push({key,sequence:0,start,end:at,billIdentifier:bill,kind,motionText:question,questionText:question,
   proposedText:null,baseLocator:explicitVersionLocator(context.slice(qStart)),outcome:'unknown',
   priorAdoptedKeys:[],yeas:Number(roll[1]),nays:Number(roll[2]),
   ballotSignature:verifiedBallot,rollStart:at});
 }
 results.sort((a,b)=>a.start-b.start);
 const adopted=new Map<string,string[]>();
 results.forEach((a,i)=>{a.sequence=i+1;a.priorAdoptedKeys=[...(adopted.get(a.billIdentifier)??[])];
  if(a.kind==='amendment'&&a.outcome==='adopted')adopted.set(a.billIdentifier,[...a.priorAdoptedKeys,a.key]);});
 return results;
}

export interface ComparableRoll {billIdentifier:string;motionText:string;yeas:number;nays:number;ballotSignature:string|null}
function questionOnly(text:string){
 const markers=[...text.matchAll(/The question (?:was taken|recurred)/gi)];
 return compact(markers.length?text.slice(markers.at(-1)!.index):text).slice(0,800);
}
export function rollMatches(a:PaperAction,r:ComparableRoll):boolean {
 return !!a.ballotSignature&&r.ballotSignature===a.ballotSignature&&a.billIdentifier===r.billIdentifier
  &&a.yeas===r.yeas&&a.nays===r.nays&&questionOnly(a.questionText)===questionOnly(r.motionText);
}
